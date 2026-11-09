const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const { validateAcademicScope } = require('./academicScopeService');

const REVIEW_SCOPE = 'bm02-review-command';
const ACTIONS = new Set(['APPROVE', 'RETURN_FOR_REVISION', 'EXCEPTION_REVIEW']);

function requireKey(key) {
    if (!key || typeof key !== 'string' || key.trim().length < 8) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400);
    }
    return `bm02-review:${key.trim()}`;
}

function hash(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function addDays(date, days) {
    return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

function normalizeIssues(issues) {
    if (Array.isArray(issues)) return issues.map((item) => String(item).trim()).filter(Boolean);
    if (typeof issues === 'string' && issues.trim()) return [issues.trim()];
    return [];
}

async function reviewBM02(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    if (!ACTIONS.has(input.action)) throw new WorkflowTransitionError('BM02_REVIEW_ACTION_INVALID', 400);
    const issues = normalizeIssues(input.issues);
    if (input.action !== 'APPROVE' && issues.length === 0) {
        throw new WorkflowTransitionError('BM02_ISSUES_REQUIRED', 400);
    }
    const key = requireKey(input.idempotencyKey);
    const commandHash = hash({
        registrationId: input.registrationId,
        reviewerId: input.reviewerId,
        action: input.action,
        issues,
    });

    try {
        return await db.$transaction(async (tx) => {
            const receipt = await tx.idempotencyRecord.findUnique({
                where: { scope_key: { scope: REVIEW_SCOPE, key } },
            });
            if (receipt) {
                if (receipt.commandHash !== commandHash) {
                    throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
                }
                return { ...receipt.response, idempotent: true };
            }

            await validateAcademicScope(tx, {
                actorId: input.reviewerId,
                registrationId: input.registrationId,
                capabilityCode: 'BM02_REVIEW',
                now,
            });

            const registration = await tx.topicRegistration.findUnique({
                where: { id: input.registrationId },
                select: {
                    id: true,
                    status: true,
                    stateVersion: true,
                    periodPolicyVersionId: true,
                    currentBM02SubmissionId: true,
                },
            });
            if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);
            if (!registration.periodPolicyVersionId) {
                throw new WorkflowTransitionError('WORKFLOW_POLICY_REQUIRED', 409);
            }
            if (!registration.currentBM02SubmissionId) {
                throw new WorkflowTransitionError('BM02_CURRENT_SUBMISSION_REQUIRED', 409);
            }

            const submission = await tx.bM02Submission.findUnique({
                where: { id: registration.currentBM02SubmissionId },
            });
            if (!submission || submission.registrationId !== registration.id
                || submission.id !== registration.currentBM02SubmissionId) {
                throw new WorkflowTransitionError('BM02_CURRENT_SUBMISSION_REQUIRED', 409);
            }
            if (submission.policyVersionId !== registration.periodPolicyVersionId) {
                throw new WorkflowTransitionError('BM02_POLICY_VERSION_MISMATCH', 409);
            }

            const isExceptionState = registration.status === 'BM02_EXCEPTION_REVIEW';
            const expectedNormalStatus = submission.attemptNo === 1 ? 'BM02_SUBMITTED' : 'BM02_RESUBMITTED';
            if (isExceptionState) {
                if (submission.outcome !== 'EXCEPTION_REVIEW') {
                    throw new WorkflowTransitionError('BM02_EXCEPTION_REVIEW_REQUIRED', 409);
                }
                if (input.action === 'EXCEPTION_REVIEW') {
                    throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
                }
            } else if (registration.status !== expectedNormalStatus || submission.outcome !== 'PENDING_REVIEW') {
                throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
            }

            const policyVersion = await tx.periodWorkflowPolicyVersion.findUnique({
                where: { id: registration.periodPolicyVersionId },
                select: { policy: true },
            });
            const revisionWindowDays = Number(policyVersion?.policy?.revisionWindowDays);
            const maxResubmissions = Number(policyVersion?.policy?.bm02MaxResubmissions);
            if (!Number.isInteger(revisionWindowDays) || revisionWindowDays < 1
                || !Number.isInteger(maxResubmissions) || maxResubmissions !== 1) {
                throw new WorkflowTransitionError('WORKFLOW_POLICY_INVALID', 409);
            }

            const terminal = input.action === 'RETURN_FOR_REVISION'
                && submission.attemptNo >= maxResubmissions + 1;
            const outcome = input.action === 'APPROVE'
                ? 'APPROVED'
                : (input.action === 'EXCEPTION_REVIEW'
                    ? 'EXCEPTION_REVIEW'
                    : (terminal ? 'REJECTED_TERMINAL' : 'REVISION_REQUIRED'));
            const updatedSubmission = await tx.bM02Submission.update({
                where: { id: submission.id },
                data: {
                    outcome,
                    issues: issues.length ? issues : undefined,
                    reviewedById: input.reviewerId,
                    reviewedAt: now,
                    notifiedAt: now,
                    revisionDeadlineAt: outcome === 'REVISION_REQUIRED'
                        ? addDays(now, revisionWindowDays)
                        : null,
                },
            });

            let targetStatus = registration.status;
            if (input.action === 'EXCEPTION_REVIEW') targetStatus = 'BM02_EXCEPTION_REVIEW';
            if (input.action === 'RETURN_FOR_REVISION') {
                targetStatus = terminal ? 'TERMINATED_BM02' : 'BM02_NEEDS_REVISION';
            }
            if (input.action === 'APPROVE' && isExceptionState) targetStatus = expectedNormalStatus;

            if (targetStatus !== registration.status) {
                await transitionRegistration({
                    registrationId: registration.id,
                    expectedStatus: registration.status,
                    expectedStateVersion: registration.stateVersion,
                    targetStatus,
                    actorId: input.reviewerId,
                    reason: `BM02 ${input.action}`,
                    reference: {
                        command: 'REVIEW_BM02',
                        submissionId: submission.id,
                        action: input.action,
                        outcome,
                    },
                    idempotencyKey: `transition:${key}`,
                }, { tx });
            }

            const response = { submission: updatedSubmission, targetStatus };
            await tx.idempotencyRecord.create({
                data: {
                    scope: REVIEW_SCOPE,
                    key,
                    commandHash,
                    registrationId: registration.id,
                    response: jsonValue(response),
                },
            });
            return { ...response, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002') {
            const receipt = await db.idempotencyRecord.findUnique({
                where: { scope_key: { scope: REVIEW_SCOPE, key } },
            });
            if (receipt?.commandHash === commandHash) return { ...receipt.response, idempotent: true };
            throw new WorkflowTransitionError('BM02_CONCURRENT_REVIEW', 409);
        }
        throw error;
    }
}

module.exports = { reviewBM02 };
