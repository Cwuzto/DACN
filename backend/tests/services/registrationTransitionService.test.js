const {
    WorkflowTransitionError,
    transitionRegistration,
} = require('../../src/services/registrationTransitionService');

function createDb(overrides = {}) {
    const tx = {
        idempotencyRecord: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
        topicRegistration: {
            findUnique: jest.fn().mockResolvedValue({ id: 41, status: 'PENDING', stateVersion: 2, semesterId: 5, periodPolicyVersionId: 9 }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        registrationStateHistory: { create: jest.fn().mockResolvedValue({}) },
        ...overrides,
    };
    return { tx, idempotencyRecord: tx.idempotencyRecord, $transaction: jest.fn((callback) => callback(tx)) };
}

const command = {
    registrationId: 41,
    expectedStatus: 'PENDING',
    expectedStateVersion: 2,
    targetStatus: 'APPROVED',
    actorId: 7,
    reason: 'Mentor approval',
    idempotencyKey: 'transition-key-0001',
};

describe('registrationTransitionService', () => {
    test('writes state, append-only history and receipt in one transaction', async () => {
        const db = createDb();
        const result = await transitionRegistration(command, { db });

        expect(result).toEqual({ registrationId: 41, status: 'APPROVED', stateVersion: 3, idempotent: false });
        expect(db.tx.topicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 41, status: 'PENDING', stateVersion: 2 },
            data: { status: 'APPROVED', stateVersion: { increment: 1 } },
        }));
        expect(db.tx.registrationStateHistory.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ fromStateVersion: 2, toStateVersion: 3, actorId: 7 }),
        }));
        expect(db.tx.idempotencyRecord.create).toHaveBeenCalledTimes(1);
    });

    test('applies sanctioned non-state fields in the same compare-and-set write', async () => {
        const db = createDb();
        await transitionRegistration({ ...command, changes: { rejectReason: 'Student withdrew', councilId: null } }, { db });
        expect(db.tx.topicRegistration.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ rejectReason: 'Student withdrew', councilId: null }),
        }));
    });

    test('returns saved result for a retry with the same key', async () => {
        const db = createDb({
            idempotencyRecord: {
                findUnique: jest.fn().mockResolvedValue({
                    commandHash: require('../../src/services/registrationTransitionService').commandHash({
                        registrationId: 41, expectedStatus: 'PENDING', expectedStateVersion: 2,
                        targetStatus: 'APPROVED', actorId: 7, reason: 'Mentor approval', reference: null,
                    }),
                    response: { registrationId: 41, status: 'APPROVED', stateVersion: 3 },
                }),
                create: jest.fn(),
            },
        });
        await expect(transitionRegistration(command, { db })).resolves.toEqual(
            { registrationId: 41, status: 'APPROVED', stateVersion: 3, idempotent: true }
        );
        expect(db.tx.topicRegistration.updateMany).not.toHaveBeenCalled();
    });

    test('rejects a stale or conflicting state without history', async () => {
        const db = createDb();
        db.tx.topicRegistration.updateMany.mockResolvedValue({ count: 0 });
        await expect(transitionRegistration(command, { db })).rejects.toMatchObject(
            { code: 'STATE_VERSION_CONFLICT', status: 409 }
        );
        expect(db.tx.registrationStateHistory.create).not.toHaveBeenCalled();
    });

    test('returns the receipt when an identical concurrent command loses the CAS race', async () => {
        const db = createDb();
        const receipt = { registrationId: 41, status: 'APPROVED', stateVersion: 3 };
        const hash = require('../../src/services/registrationTransitionService').commandHash({
            registrationId: 41, expectedStatus: 'PENDING', expectedStateVersion: 2,
            targetStatus: 'APPROVED', actorId: 7, reason: 'Mentor approval', reference: null,
        });
        db.tx.topicRegistration.updateMany.mockResolvedValue({ count: 0 });
        db.tx.idempotencyRecord.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ commandHash: hash, response: receipt });
        db.idempotencyRecord = db.tx.idempotencyRecord;

        await expect(transitionRegistration(command, { db })).resolves.toEqual({ ...receipt, idempotent: true });
    });

    test('requires an idempotency key', async () => {
        const db = createDb();
        await expect(transitionRegistration({ ...command, idempotencyKey: '' }, { db }))
            .rejects.toBeInstanceOf(WorkflowTransitionError);
    });
});
