const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const { validateAcademicScope } = require('./academicScopeService');

const REVIEW_SCOPE = 'bm01-review-command';
const INITIAL_SUBMIT_SCOPE = 'bm01-initial-submit-command';
const RESUBMIT_SCOPE = 'bm01-resubmit-command';

function requireCommandKey(prefix, key) {
    if (!key || typeof key !== 'string' || key.trim().length < 8) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400);
    }
    return `${prefix}:${key.trim()}`;
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function addDays(date, days) {
    return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

function policyRules(policyVersion) {
    const revisionWindowDays = Number(policyVersion?.policy?.revisionWindowDays);
    const maxResubmissions = Number(policyVersion?.policy?.bm01MaxResubmissions);
    if (!Number.isInteger(revisionWindowDays) || revisionWindowDays < 1
        || !Number.isInteger(maxResubmissions) || maxResubmissions !== 1) {
        throw new WorkflowTransitionError('WORKFLOW_POLICY_INVALID', 409);
    }
    return { revisionWindowDays, maxResubmissions };
}

async function loadRegistrationAndPolicy(tx, registrationId) {
    const registration = await tx.topicRegistration.findUnique({
        where: { id: registrationId },
        select: {
            id: true,
            studentId: true,
            status: true,
            stateVersion: true,
            periodPolicyVersionId: true,
        },
    });
    if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);
    if (!registration.periodPolicyVersionId) {
        throw new WorkflowTransitionError('WORKFLOW_POLICY_REQUIRED', 409);
    }
    const policyVersion = await tx.periodWorkflowPolicyVersion.findUnique({
        where: { id: registration.periodPolicyVersionId },
        select: { id: true, policy: true },
    });
    if (!policyVersion) throw new WorkflowTransitionError('WORKFLOW_POLICY_REQUIRED', 409);
    return { registration, policyVersion, rules: policyRules(policyVersion) };
}

async function findReceipt(tx, scope, key, hash) {
    const receipt = await tx.idempotencyRecord.findUnique({
        where: { scope_key: { scope, key } },
    });
    if (!receipt) return null;
    if (receipt.commandHash !== hash) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
    }
    return { ...receipt.response, idempotent: true };
}

async function saveReceipt(tx, { scope, key, hash, registrationId, response }) {
    await tx.idempotencyRecord.create({
        data: {
            scope,
            key,
            commandHash: hash,
            registrationId,
            response: jsonValue(response),
        },
    });
}

async function submitBM01Initial(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('bm01-submit', input.idempotencyKey);
    const commandHash = fingerprint({
        registrationId: input.registrationId,
        studentId: input.studentId,
        content: input.content || null,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
    });

    try {
        return await db.$transaction(async (tx) => {
            const retry = await findReceipt(tx, INITIAL_SUBMIT_SCOPE, key, commandHash);
            if (retry) return retry;

            const { registration } = await loadRegistrationAndPolicy(tx, input.registrationId);
            if (registration.studentId !== input.studentId) {
                throw new WorkflowTransitionError('FORBIDDEN', 403);
            }
            // APPROVED is retained as a compatibility entry state until the
            // registration-approval migration maps all accepted rows to REGISTERED.
            if (!['REGISTERED', 'APPROVED'].includes(registration.status)) {
                throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
            }

            let task = await tx.task.findFirst({
                where: { registrationId: registration.id, taskType: 'BM01' },
            });
            if (!task) {
                task = await tx.task.create({
                    data: {
                        registrationId: registration.id,
                        title: 'BM01 - Đề cương chi tiết đồ án',
                        content: 'Nộp đề cương chi tiết đồ án.',
                        taskType: 'BM01',
                        status: 'SUBMITTED',
                    },
                });
            } else {
                await tx.task.update({
                    where: { id: task.id },
                    data: { status: 'SUBMITTED' },
                });
            }

            const submission = await tx.submission.create({
                data: {
                    taskId: task.id,
                    registrationId: registration.id,
                    submittedBy: input.studentId,
                    content: input.content || null,
                    fileUrl: input.fileUrl || null,
                    fileName: input.fileName || null,
                    submittedAt: now,
                },
            });
            await transitionRegistration({
                registrationId: registration.id,
                expectedStatus: registration.status,
                expectedStateVersion: registration.stateVersion,
                targetStatus: 'BM01_SUBMITTED',
                actorId: input.studentId,
                reason: 'Initial BM01 submitted',
                reference: { command: 'SUBMIT_BM01', submissionId: submission.id },
                idempotencyKey: `transition:${key}`,
                changes: { outlineReviewStatus: 'PENDING' },
            }, { tx });

            const response = { submission };
            await saveReceipt(tx, {
                scope: INITIAL_SUBMIT_SCOPE,
                key,
                hash: commandHash,
                registrationId: registration.id,
                response,
            });
            return { ...response, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002') {
            const receipt = await db.idempotencyRecord.findUnique({
                where: { scope_key: { scope: INITIAL_SUBMIT_SCOPE, key } },
            });
            if (receipt?.commandHash === commandHash) return { ...receipt.response, idempotent: true };
            throw new WorkflowTransitionError('BM01_CONCURRENT_COMMAND', 409);
        }
        throw error;
    }
}

async function reviewBM01(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('bm01-review', input.idempotencyKey);
    const hash = fingerprint({
        registrationId: input.registrationId,
        reviewerId: input.reviewerId,
        attemptNo: input.attemptNo,
        outcome: input.outcome,
        feedback: input.feedback || null,
    });

    if (![1, 2].includes(input.attemptNo) || !['PASSED', 'NEEDS_REVISION'].includes(input.outcome)) {
        throw new WorkflowTransitionError('BM01_REVIEW_INPUT_INVALID', 400);
    }

    try {
        return await db.$transaction(async (tx) => {
            const retry = await findReceipt(tx, REVIEW_SCOPE, key, hash);
            if (retry) return retry;

            await validateAcademicScope(tx, {
                actorId: input.reviewerId,
                registrationId: input.registrationId,
                capabilityCode: 'OUTLINE_REVIEW',
                now,
            });

            const { registration, rules } = await loadRegistrationAndPolicy(tx, input.registrationId);
            if (registration.status !== 'BM01_SUBMITTED') {
                throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
            }

            const latest = await tx.bM01Evaluation.findFirst({
                where: { registrationId: input.registrationId },
                orderBy: { attemptNo: 'desc' },
            });
            if (input.attemptNo === 1 && latest) {
                throw new WorkflowTransitionError('BM01_ATTEMPT_CONFLICT', 409);
            }
            if (input.attemptNo === 2
                && (!latest || latest.attemptNo !== 2 || latest.outcome !== null || !latest.supersedesId)) {
                throw new WorkflowTransitionError('BM01_REVISION_NOT_PENDING', 409);
            }

            const isTerminal = input.attemptNo === rules.maxResubmissions + 1
                && input.outcome === 'NEEDS_REVISION';
            const storedOutcome = isTerminal ? 'TERMINATED' : input.outcome;
            const targetStatus = input.outcome === 'PASSED'
                ? 'BM01_PASSED'
                : (isTerminal ? 'TERMINATED_BM01' : 'BM01_NEEDS_REVISION');
            const notifiedAt = input.outcome === 'NEEDS_REVISION' ? now : null;
            const deadlineAt = input.outcome === 'NEEDS_REVISION' && !isTerminal
                ? addDays(now, rules.revisionWindowDays)
                : null;
            const evaluationData = {
                outcome: storedOutcome,
                issues: input.feedback ? { feedback: String(input.feedback).trim() } : undefined,
                reviewedAt: now,
                reviewedById: input.reviewerId,
                notifiedAt,
                deadlineAt,
            };
            const evaluation = input.attemptNo === 1
                ? await tx.bM01Evaluation.create({
                    data: {
                        registrationId: input.registrationId,
                        attemptNo: 1,
                        policyVersionId: registration.periodPolicyVersionId,
                        ...evaluationData,
                    },
                })
                : await tx.bM01Evaluation.update({
                    where: { id: latest.id },
                    data: evaluationData,
                });

            await tx.task.updateMany({
                where: { registrationId: input.registrationId, taskType: 'BM01' },
                data: {
                    status: targetStatus === 'BM01_NEEDS_REVISION' ? 'REVISION' : 'COMPLETED',
                },
            });

            await transitionRegistration({
                registrationId: registration.id,
                expectedStatus: 'BM01_SUBMITTED',
                expectedStateVersion: registration.stateVersion,
                targetStatus,
                actorId: input.reviewerId,
                reason: input.feedback || `BM01 attempt ${input.attemptNo} reviewed`,
                reference: {
                    command: 'REVIEW_BM01',
                    evaluationId: evaluation.id,
                    attemptNo: input.attemptNo,
                    outcome: storedOutcome,
                },
                idempotencyKey: `transition:${key}`,
                changes: {
                    outlineReviewStatus: targetStatus === 'BM01_PASSED'
                        ? 'PASSED'
                        : (targetStatus === 'TERMINATED_BM01' ? 'FAILED' : 'REVISION_REQUIRED'),
                    outlineFeedback: input.feedback ? String(input.feedback).trim() : null,
                },
            }, { tx });

            const response = { evaluation, targetStatus };
            await saveReceipt(tx, {
                scope: REVIEW_SCOPE,
                key,
                hash,
                registrationId: registration.id,
                response,
            });
            return { ...response, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002') {
            const receipt = await db.idempotencyRecord.findUnique({
                where: { scope_key: { scope: REVIEW_SCOPE, key } },
            });
            if (receipt?.commandHash === hash) return { ...receipt.response, idempotent: true };
            throw new WorkflowTransitionError('BM01_CONCURRENT_COMMAND', 409);
        }
        throw error;
    }
}

async function submitBM01Revision(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('bm01-resubmit', input.idempotencyKey);
    const hash = fingerprint({
        registrationId: input.registrationId,
        studentId: input.studentId,
        content: input.content || null,
        fileUrl: input.fileUrl || null,
        fileName: input.fileName || null,
    });

    try {
        const result = await db.$transaction(async (tx) => {
            const retry = await findReceipt(tx, RESUBMIT_SCOPE, key, hash);
            if (retry) return retry;

            const { registration, rules } = await loadRegistrationAndPolicy(tx, input.registrationId);
            if (registration.studentId !== input.studentId) {
                throw new WorkflowTransitionError('FORBIDDEN', 403);
            }
            if (registration.status !== 'BM01_NEEDS_REVISION') {
                throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
            }

            const previous = await tx.bM01Evaluation.findFirst({
                where: { registrationId: input.registrationId },
                orderBy: { attemptNo: 'desc' },
            });
            if (!previous || previous.outcome !== 'NEEDS_REVISION') {
                throw new WorkflowTransitionError('BM01_REVISION_NOT_AVAILABLE', 409);
            }
            if (previous.attemptNo >= rules.maxResubmissions + 1) {
                throw new WorkflowTransitionError('BM01_REVISION_QUOTA_EXHAUSTED', 409);
            }
            if (!previous.deadlineAt || previous.deadlineAt < now) {
                const evaluation = await tx.bM01Evaluation.update({
                    where: { id: previous.id },
                    data: { outcome: 'TERMINATED', reviewedAt: now },
                });
                await tx.task.updateMany({
                    where: { registrationId: registration.id, taskType: 'BM01' },
                    data: { status: 'COMPLETED' },
                });
                await transitionRegistration({
                    registrationId: registration.id,
                    expectedStatus: 'BM01_NEEDS_REVISION',
                    expectedStateVersion: registration.stateVersion,
                    targetStatus: 'TERMINATED_BM01',
                    actorId: input.studentId,
                    reason: 'BM01 revision deadline expired',
                    reference: {
                        command: 'EXPIRE_BM01_REVISION',
                        evaluationId: previous.id,
                        deadlineAt: previous.deadlineAt,
                        triggeredBy: 'RESUBMIT_ATTEMPT',
                    },
                    idempotencyKey: `transition-expired:${key}`,
                    changes: { outlineReviewStatus: 'FAILED' },
                }, { tx });
                const response = { expired: true, evaluation, targetStatus: 'TERMINATED_BM01' };
                await saveReceipt(tx, {
                    scope: RESUBMIT_SCOPE,
                    key,
                    hash,
                    registrationId: registration.id,
                    response,
                });
                return response;
            }

            let task = await tx.task.findFirst({
                where: { registrationId: input.registrationId, taskType: 'BM01' },
            });
            if (!task) {
                task = await tx.task.create({
                    data: {
                        registrationId: input.registrationId,
                        title: 'BM01 - Đề cương chi tiết đồ án',
                        content: 'Nộp đề cương chi tiết đồ án.',
                        taskType: 'BM01',
                        status: 'SUBMITTED',
                    },
                });
            } else {
                await tx.task.update({
                    where: { id: task.id },
                    data: { status: 'SUBMITTED' },
                });
            }

            const submission = await tx.submission.create({
                data: {
                    taskId: task.id,
                    registrationId: registration.id,
                    submittedBy: input.studentId,
                    content: input.content || null,
                    fileUrl: input.fileUrl || null,
                    fileName: input.fileName || null,
                    submittedAt: now,
                },
            });
            const evaluation = await tx.bM01Evaluation.create({
                data: {
                    registrationId: registration.id,
                    attemptNo: previous.attemptNo + 1,
                    submittedAt: now,
                    submittedById: input.studentId,
                    submissionId: submission.id,
                    supersedesId: previous.id,
                    policyVersionId: registration.periodPolicyVersionId,
                },
            });

            await transitionRegistration({
                registrationId: registration.id,
                expectedStatus: 'BM01_NEEDS_REVISION',
                expectedStateVersion: registration.stateVersion,
                targetStatus: 'BM01_SUBMITTED',
                actorId: input.studentId,
                reason: 'BM01 revision submitted',
                reference: {
                    command: 'RESUBMIT_BM01',
                    submissionId: submission.id,
                    evaluationId: evaluation.id,
                    supersedesEvaluationId: previous.id,
                },
                idempotencyKey: `transition:${key}`,
                changes: { outlineReviewStatus: 'PENDING' },
            }, { tx });

            const response = { submission, evaluation };
            await saveReceipt(tx, {
                scope: RESUBMIT_SCOPE,
                key,
                hash,
                registrationId: registration.id,
                response,
            });
            return { ...response, idempotent: false };
        });
        if (result.expired) {
            const error = new WorkflowTransitionError('BM01_REVISION_DEADLINE_EXPIRED', 409);
            error.result = result;
            throw error;
        }
        return result;
    } catch (error) {
        if (error?.code === 'P2002') {
            const receipt = await db.idempotencyRecord.findUnique({
                where: { scope_key: { scope: RESUBMIT_SCOPE, key } },
            });
            if (receipt?.commandHash === hash) return { ...receipt.response, idempotent: true };
            throw new WorkflowTransitionError('BM01_REVISION_QUOTA_EXHAUSTED', 409);
        }
        throw error;
    }
}

module.exports = {
    reviewBM01,
    submitBM01Initial,
    submitBM01Revision,
};
