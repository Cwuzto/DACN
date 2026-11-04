const crypto = require('crypto');
const prisma = require('../config/database');

const TRANSITION_SCOPE = 'registration-transition';

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
    WorkflowTransitionError,
    commandHash,
    transitionRegistration,
};
