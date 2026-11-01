const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

function commandKey(prefix, key) {
    if (!key || key.length < 8) throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return `${prefix}:${key}`;
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function submitBM02({ registrationId, studentId, content, fileUrl, fileName, idempotencyKey }, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const receiptScope = 'submit-bm02-command';
    const receiptKey = commandKey('bm02', idempotencyKey);
    const hash = fingerprint({ registrationId, studentId, content: content || null, fileUrl: fileUrl || null, fileName: fileName || null });
    try {
        const result = await db.$transaction(async (tx) => {
        const existingReceipt = await tx.idempotencyRecord.findUnique({
            where: { scope_key: { scope: receiptScope, key: receiptKey } },
        });
        if (existingReceipt) {
            if (existingReceipt.commandHash !== hash) throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
            return { ...existingReceipt.response, idempotent: true };
        }
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            select: { id: true, studentId: true, status: true, stateVersion: true, periodPolicyVersionId: true, currentBM02SubmissionId: true },
        });
        if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);
        if (registration.studentId !== studentId) throw new WorkflowTransitionError('FORBIDDEN', 403);
        if (!registration.periodPolicyVersionId) throw new WorkflowTransitionError('WORKFLOW_POLICY_REQUIRED', 409);
        if (!['BM01_PASSED', 'BM02_NEEDS_REVISION'].includes(registration.status)) {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        }

        const isRevision = registration.status === 'BM02_NEEDS_REVISION';
        const prior = isRevision
            ? await tx.bM02Submission.findUnique({ where: { id: registration.currentBM02SubmissionId } })
            : await tx.bM02Submission.findFirst({
                where: { registrationId },
                orderBy: { versionNo: 'desc' },
                select: { id: true, registrationId: true, versionNo: true, attemptNo: true, outcome: true, revisionDeadlineAt: true },
            });
        if (isRevision && (!prior || prior.registrationId !== registrationId || prior.outcome !== 'REVISION_REQUIRED')) {
            throw new WorkflowTransitionError('BM02_REVISION_NOT_AVAILABLE', 409);
        }
        if (isRevision && prior.attemptNo >= 2) throw new WorkflowTransitionError('BM02_REVISION_QUOTA_EXHAUSTED', 409);
        if (isRevision && (!prior.revisionDeadlineAt || prior.revisionDeadlineAt < now)) {
            const terminal = await tx.bM02Submission.update({
                where: { id: prior.id },
                data: { outcome: 'REJECTED_TERMINAL', reviewedAt: now, notifiedAt: now },
            });
            await transitionRegistration({
                registrationId,
                expectedStatus: registration.status,
                expectedStateVersion: registration.stateVersion,
                targetStatus: 'TERMINATED_BM02',
                actorId: studentId,
                reason: 'BM02 revision deadline expired',
                reference: { command: 'EXPIRE_BM02_REVISION', submissionId: prior.id, deadlineAt: prior.revisionDeadlineAt },
                idempotencyKey: commandKey('expire-bm02', idempotencyKey),
            }, { tx });
            const response = { expired: true, submission: terminal, targetStatus: 'TERMINATED_BM02' };
            await tx.idempotencyRecord.create({
                data: { scope: receiptScope, key: receiptKey, commandHash: hash, registrationId, response: JSON.parse(JSON.stringify(response)) },
            });
            return response;
        }

        const submission = await tx.bM02Submission.create({
            data: {
                registrationId, versionNo: (prior?.versionNo || 0) + 1,
                attemptNo: isRevision ? 2 : 1, supersedesId: isRevision ? prior.id : null,
                content: content || null, fileUrl: fileUrl || null, fileName: fileName || null,
                submittedById: studentId, policyVersionId: registration.periodPolicyVersionId,
            },
        });
        if (prior) await tx.bM02Submission.update({ where: { id: prior.id }, data: { outcome: 'SUPERSEDED' } });
        const targetStatus = isRevision ? 'BM02_RESUBMITTED' : 'BM02_SUBMITTED';
        await transitionRegistration({
            registrationId, expectedStatus: registration.status, expectedStateVersion: registration.stateVersion,
            targetStatus, actorId: studentId, reason: 'BM02 submitted',
            reference: { command: 'SUBMIT_BM02', submissionId: submission.id },
            idempotencyKey: commandKey('submit-bm02', idempotencyKey),
            changes: { currentBM02SubmissionId: submission.id },
        }, { tx });
        const response = JSON.parse(JSON.stringify(submission));
        await tx.idempotencyRecord.create({
            data: { scope: receiptScope, key: receiptKey, commandHash: hash, registrationId, response },
        });
        return { ...submission, idempotent: false };
        });
        if (result.expired) {
            const error = new WorkflowTransitionError('BM02_REVISION_DEADLINE_EXPIRED', 409);
            error.result = result;
            throw error;
        }
        return result;
    } catch (error) {
        if (error?.code === 'P2002') {
            const receipt = await db.idempotencyRecord.findUnique({ where: { scope_key: { scope: receiptScope, key: receiptKey } } });
            if (receipt?.commandHash === hash) return { ...receipt.response, idempotent: true };
        }
        throw error;
    }
}

async function issueAssignmentDecision({ registrationId, issuedById, decisionNumber, issuedAt = new Date(), idempotencyKey }, options = {}) {
    const db = options.db || prisma;
    const key = commandKey('issue-assignment-decision', idempotencyKey);
    try {
        return await db.$transaction(async (tx) => {
        const existing = await tx.assignmentDecision.findUnique({ where: { idempotencyKey: key } });
        if (existing) {
            if (existing.registrationId !== registrationId
                || existing.decisionNumber !== decisionNumber
                || existing.issuedById !== issuedById) {
                throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
            }
            return { ...existing, idempotent: true };
        }
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            select: { id: true, status: true, stateVersion: true, periodPolicyVersionId: true, currentBM02SubmissionId: true },
        });
        if (!registration?.periodPolicyVersionId || !registration.currentBM02SubmissionId) throw new WorkflowTransitionError('BM02_CURRENT_APPROVAL_REQUIRED', 409);
        const bm02 = await tx.bM02Submission.findUnique({ where: { id: registration.currentBM02SubmissionId } });
        if (!bm02 || bm02.outcome !== 'APPROVED') throw new WorkflowTransitionError('BM02_CURRENT_APPROVAL_REQUIRED', 409);
        if (!['BM02_SUBMITTED', 'BM02_RESUBMITTED'].includes(registration.status)) throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        const decision = await tx.assignmentDecision.create({
            data: { registrationId, bm02SubmissionId: bm02.id, decisionNumber, issuedAt, effectiveAt: issuedAt, issuedById, policyVersionId: registration.periodPolicyVersionId, idempotencyKey: key },
        });
        await transitionRegistration({
            registrationId, expectedStatus: registration.status, expectedStateVersion: registration.stateVersion,
            targetStatus: 'DECISION_ISSUED', actorId: issuedById, reason: `Assignment decision ${decisionNumber}`,
            reference: { command: 'ISSUE_ASSIGNMENT_DECISION', decisionId: decision.id, bm02SubmissionId: bm02.id },
            idempotencyKey: commandKey('transition-decision', idempotencyKey),
            changes: { decisionNumber, decisionDate: issuedAt },
        }, { tx });
        return { ...decision, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002') {
            const existing = await db.assignmentDecision.findUnique({ where: { idempotencyKey: key } });
            if (existing) return { ...existing, idempotent: true };
        }
        throw error;
    }
}

async function createDecisionAmendment({
    assignmentDecisionId,
    signedById,
    amendmentNumber,
    reason,
    changes,
    effectiveAt = new Date(),
    idempotencyKey,
}, options = {}) {
    const db = options.db || prisma;
    const key = commandKey('decision-amendment', idempotencyKey);
    if (!amendmentNumber || !String(amendmentNumber).trim()
        || !reason || !String(reason).trim()
        || !changes || typeof changes !== 'object' || Array.isArray(changes)
        || Object.keys(changes).length === 0) {
        throw new WorkflowTransitionError('DECISION_AMENDMENT_INPUT_INVALID', 400);
    }

    const normalized = {
        assignmentDecisionId,
        signedById,
        amendmentNumber: String(amendmentNumber).trim(),
        reason: String(reason).trim(),
        changes,
        effectiveAt: new Date(effectiveAt),
    };
    const matches = (existing) => existing.assignmentDecisionId === normalized.assignmentDecisionId
        && existing.signedById === normalized.signedById
        && existing.amendmentNumber === normalized.amendmentNumber
        && existing.reason === normalized.reason
        && JSON.stringify(existing.changes) === JSON.stringify(normalized.changes)
        && new Date(existing.effectiveAt).getTime() === normalized.effectiveAt.getTime();

    try {
        return await db.$transaction(async (tx) => {
            const existing = await tx.decisionAmendment.findUnique({ where: { idempotencyKey: key } });
            if (existing) {
                if (!matches(existing)) throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
                return { ...existing, idempotent: true };
            }
            const decision = await tx.assignmentDecision.findUnique({
                where: { id: assignmentDecisionId },
                select: { id: true },
            });
            if (!decision) throw new WorkflowTransitionError('ASSIGNMENT_DECISION_NOT_FOUND', 404);

            const amendment = await tx.decisionAmendment.create({
                data: { ...normalized, idempotencyKey: key },
            });
            return { ...amendment, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002') {
            const existing = await db.decisionAmendment.findUnique({ where: { idempotencyKey: key } });
            if (existing && matches(existing)) return { ...existing, idempotent: true };
            throw new WorkflowTransitionError('DECISION_AMENDMENT_CONFLICT', 409);
        }
        throw error;
    }
}

module.exports = { submitBM02, issueAssignmentDecision, createDecisionAmendment };
