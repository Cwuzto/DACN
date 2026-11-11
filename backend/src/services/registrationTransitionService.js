const crypto = require('crypto');
const prisma = require('../config/database');

const TRANSITION_SCOPE = 'registration-transition';

const ALLOWED_TRANSITIONS = Object.freeze({
    REGISTERED: ['PENDING', 'APPROVED', 'REJECTED'],
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['BM01_SUBMITTED', 'IN_PROGRESS'],
    REJECTED: [],
    BM01_SUBMITTED: ['BM01_NEEDS_REVISION', 'BM01_PASSED', 'REJECTED'],
    BM01_NEEDS_REVISION: ['BM01_RESUBMITTED'],
    BM01_RESUBMITTED: ['BM01_NEEDS_REVISION', 'BM01_PASSED', 'REJECTED'],
    BM01_PASSED: ['BM02_OPEN', 'BM02_SUBMITTED'],
    BM02_OPEN: ['BM02_SUBMITTED'],
    BM02_SUBMITTED: ['BM02_NEEDS_REVISION', 'BM02_REVISION_REQUIRED', 'BM02_APPROVED', 'BM02_REJECTED', 'BM02_EXCEPTION_REVIEW'],
    BM02_NEEDS_REVISION: ['BM02_RESUBMITTED'],
    BM02_REVISION_REQUIRED: ['BM02_RESUBMITTED'],
    BM02_RESUBMITTED: ['BM02_NEEDS_REVISION', 'BM02_REVISION_REQUIRED', 'BM02_APPROVED', 'BM02_REJECTED'],
    BM02_APPROVED: ['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03'],
    BM02_REJECTED: [],
    BM02_EXCEPTION_REVIEW: ['BM02_APPROVED', 'BM02_REJECTED'],
    DECISION_ISSUED: ['IN_PROGRESS', 'IN_PROGRESS_BM03'],
    IN_PROGRESS: ['IN_PROGRESS_BM03', 'BM03_SIGNATURE_PENDING', 'BM03_PASSED', 'AUTO_TERMINATED', 'STOP_REVIEW_PENDING'],
    IN_PROGRESS_BM03: ['BM03_SIGNATURE_PENDING', 'BM03_PASSED', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN', 'AUTO_TERMINATED', 'STOP_REVIEW_PENDING'],
    BM03_SIGNATURE_PENDING: ['IN_PROGRESS_BM03', 'BM03_PASSED', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN'],
    CHECKPOINT_SIGNATURE_APPEAL_OPEN: ['CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED', 'IN_PROGRESS_BM03'],
    CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED: ['CHECKPOINT_SIGNATURE_APPEAL_REVIEW'],
    CHECKPOINT_SIGNATURE_APPEAL_REVIEW: ['SIGNATURE_APPEAL_RESOLVED'],
    SIGNATURE_APPEAL_RESOLVED: ['IN_PROGRESS_BM03', 'BM03_PASSED'],
    BM03_PASSED: ['BM04_REVIEW', 'DEFENSE_READY', 'DEFENSE_ELIGIBLE'],
    BM04_REVIEW: ['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'NOT_ELIGIBLE_FOR_DEFENSE', 'AUTO_NOT_ELIGIBLE'],
    DEFENSE_READY: ['DEFENSE_ELIGIBLE', 'NOT_ELIGIBLE_FOR_DEFENSE', 'AWAITING_SCORES'],
    DEFENSE_ELIGIBLE: ['AWAITING_SCORES', 'NOT_ELIGIBLE_FOR_DEFENSE'],
    ELIGIBLE_BY_INSTITUTE: ['AWAITING_SCORES', 'NOT_ELIGIBLE_FOR_DEFENSE'],
    NOT_ELIGIBLE_FOR_DEFENSE: ['ELIGIBLE_BY_INSTITUTE'],
    AUTO_NOT_ELIGIBLE: ['ELIGIBLE_BY_INSTITUTE'],
    AUTO_TERMINATED: [],
    STOP_REVIEW_PENDING: ['IN_PROGRESS_BM03', 'AUTO_TERMINATED'],
    AWAITING_SCORES: ['AWAITING_FINAL_APPROVAL', 'DEFENSE_PASSED', 'DEFENSE_FAILED'],
    AWAITING_FINAL_APPROVAL: ['DEFENSE_PASSED', 'DEFENSE_FAILED'],
    DEFENSE_PASSED: ['PENDING_INSTITUTE_SIGNATURE', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED', 'COMPLETED'],
    DEFENSE_FAILED: [],
    PENDING_INSTITUTE_SIGNATURE: ['COMPLETED', 'ARCHIVE_REJECTED'],
    ARCHIVE_INCOMPLETE: [],
    ARCHIVE_REJECTED: [],
    COMPLETED: [],
});

class WorkflowTransitionError extends Error {
    constructor(code, status = 409, message = code) {
        super(message);
        this.name = 'WorkflowTransitionError';
        this.code = code;
        this.status = status;
    }
}

function commandHash(command) {
    return crypto.createHash('sha256').update(JSON.stringify(command)).digest('hex');
}

function normalizeResult(registration) {
    return {
        registrationId: registration.id,
        status: registration.status,
        stateVersion: registration.stateVersion,
    };
}

async function transitionRegistration(input, options = {}) {
    const db = options.db || prisma;
    const scope = input.scope || TRANSITION_SCOPE;
    const key = input.idempotencyKey;
    if (!key || typeof key !== 'string' || key.trim().length < 8) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400);
    }
    if (!Number.isInteger(input.actorId)) {
        throw new WorkflowTransitionError('ACTOR_REQUIRED', 400);
    }

    const fingerprint = commandHash({
        registrationId: input.registrationId,
        expectedStatus: input.expectedStatus,
        expectedStateVersion: input.expectedStateVersion,
        targetStatus: input.targetStatus,
        actorId: input.actorId,
        reason: input.reason || null,
        reference: input.reference || null,
    });

    try {
        const execute = async (tx) => {
        const existingReceipt = await tx.idempotencyRecord.findUnique({
            where: { scope_key: { scope, key } },
        });
        if (existingReceipt) {
            if (existingReceipt.commandHash !== fingerprint) {
                throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
            }
            return { ...existingReceipt.response, idempotent: true };
        }

        const current = await tx.topicRegistration.findUnique({
            where: { id: input.registrationId },
            select: { id: true, status: true, stateVersion: true, semesterId: true, periodPolicyVersionId: true },
        });
        if (!current) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);
        const currentVersion = current.stateVersion ?? 0;
        const expectedVersion = input.expectedStateVersion ?? 0;
        if (current.status !== input.expectedStatus || currentVersion !== expectedVersion) {
            throw new WorkflowTransitionError('STATE_VERSION_CONFLICT', 409);
        }
        if (typeof input.guard === 'function') {
            await input.guard({ tx, registration: current, input });
        }

        const whereClause = {
            id: current.id,
            status: input.expectedStatus,
        };
        if (current.stateVersion !== undefined) {
            whereClause.stateVersion = input.expectedStateVersion;
        }

        const compareAndSet = await tx.topicRegistration.updateMany({
            where: whereClause,
            data: {
                status: input.targetStatus,
                stateVersion: { increment: 1 },
                ...(input.changes || {}),
            },
        });
        if (compareAndSet.count !== 1) {
            throw new WorkflowTransitionError('STATE_VERSION_CONFLICT', 409);
        }

        const next = {
            id: current.id,
            status: input.targetStatus,
            stateVersion: currentVersion + 1,
        };
        const result = normalizeResult(next);
        await tx.registrationStateHistory.create({
            data: {
                registrationId: current.id,
                fromStatus: current.status,
                toStatus: input.targetStatus,
                fromStateVersion: currentVersion,
                toStateVersion: next.stateVersion,
                actorId: input.actorId,
                reason: input.reason || null,
                reference: input.reference || undefined,
                idempotencyKey: key,
            },
        });
        await tx.idempotencyRecord.create({
            data: {
                scope,
                key,
                commandHash: fingerprint,
                registrationId: current.id,
                response: result,
            },
        });
            return { ...result, idempotent: false };
        };
        return await (options.tx ? execute(options.tx) : db.$transaction(execute));
    } catch (error) {
        // A concurrent request with the same key can lose the CAS race after the
        // winning transaction commits. It is still the same command, not a conflict.
        if (error?.code === 'STATE_VERSION_CONFLICT' || error?.code === 'P2002') {
            const receipt = await db.idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
            if (receipt?.commandHash === fingerprint) return { ...receipt.response, idempotent: true };
        }
        throw error;
    }
}

module.exports = {
    TRANSITION_SCOPE,
    ALLOWED_TRANSITIONS,
    WorkflowTransitionError,
    commandHash,
    transitionRegistration,
};
