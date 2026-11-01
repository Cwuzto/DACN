jest.mock('../../src/config/database', () => ({}));

const {
    createResultPublication,
    getEligibleApprovals,
    hashScoreEvidence,
} = require('../../src/services/defenseResultPublicationService');

const validApproval = (overrides = {}) => {
    const registration = {
        id: 101,
        semesterId: 1,
        defenseCouncilId: 12,
        periodPolicyVersionId: 9,
        student: { code: 'SV001', fullName: 'Sinh viên Một' },
        topic: { title: 'Đề tài Một' },
        defenseCouncil: { members: [{ lecturerId: 21 }, { lecturerId: 22 }, { lecturerId: 23 }] },
        council: null,
        defenseResult: {
            id: 44,
            finalScore: 8.5,
            scoreLocked: true,
            scoreRubricVersion: 'v1',
            lockedAt: new Date('2026-10-29T00:00:00.000Z'),
        },
        memberScores: [
            { evaluatorId: 21, finalScore: 8, scoreLocked: true, scoreRubricVersion: 'v1', lockedAt: new Date('2026-10-29T00:00:00.000Z') },
            { evaluatorId: 22, finalScore: 8.5, scoreLocked: true, scoreRubricVersion: 'v1', lockedAt: new Date('2026-10-29T00:00:00.000Z') },
            { evaluatorId: 23, finalScore: 9, scoreLocked: true, scoreRubricVersion: 'v1', lockedAt: new Date('2026-10-29T00:00:00.000Z') },
        ],
    };
    return {
        id: 71,
        registrationId: registration.id,
        outcome: 'PASSED',
        defenseResultId: registration.defenseResult.id,
        defenseCouncilId: registration.defenseCouncilId,
        policyVersionId: registration.periodPolicyVersionId,
        rubricVersionSnapshot: registration.defenseResult.scoreRubricVersion,
        finalScoreSnapshot: registration.defenseResult.finalScore,
        registration,
        ...overrides,
        scoreFingerprint: overrides.scoreFingerprint || hashScoreEvidence(registration),
    };
};

const transactionDb = (tx) => ({ $transaction: jest.fn((callback) => callback(tx)) });

describe('defenseResultPublicationService', () => {
    it('INV-34: excludes an effective approval when its locked score evidence has changed', async () => {
        const staleApproval = validApproval();
        staleApproval.registration.defenseResult.finalScore = 9.0;
        const tx = { defenseResultApproval: { findMany: jest.fn().mockResolvedValue([staleApproval]) } };

        await expect(getEligibleApprovals(tx, 1)).resolves.toEqual([]);
    });

    it('INV-34: excludes an approval when a council score is no longer locked', async () => {
        const staleApproval = validApproval();
        staleApproval.registration.memberScores[2].scoreLocked = false;
        const tx = { defenseResultApproval: { findMany: jest.fn().mockResolvedValue([staleApproval]) } };

        await expect(getEligibleApprovals(tx, 1)).resolves.toEqual([]);
    });

    it('INV-31: requires a predecessor for supplementary publication', async () => {
        await expect(createResultPublication({
            semesterId: 1, actorId: 8, type: 'SUPPLEMENTARY', reason: 'Bảo vệ bổ sung', idempotencyKey: 'supplementary-key-001',
        })).rejects.toMatchObject({ code: 'PUBLICATION_LINEAGE_REQUIRED', status: 400 });
    });

    it('INV-36: permits only one INITIAL publication in a semester', async () => {
        const tx = {
            resultPublication: {
                findUnique: jest.fn().mockResolvedValue(null),
                findFirst: jest.fn().mockResolvedValue({ id: 501 }),
            },
        };

        await expect(createResultPublication({
            semesterId: 1, actorId: 8, type: 'INITIAL', idempotencyKey: 'initial-key-001',
        }, { db: transactionDb(tx) })).rejects.toMatchObject({ code: 'INITIAL_PUBLICATION_ALREADY_EXISTS', status: 409 });
    });

    it('INV-33: returns the original publication for an idempotency-key replay', async () => {
        const replay = { id: 501, semesterId: 1, type: 'INITIAL', items: [{ id: 900 }] };
        const tx = { resultPublication: { findUnique: jest.fn().mockResolvedValue(replay) } };

        await expect(createResultPublication({
            semesterId: 1, actorId: 8, type: 'INITIAL', idempotencyKey: 'replay-key-001',
        }, { db: transactionDb(tx) })).resolves.toEqual({ publication: replay, idempotent: true });
    });

    it('INV-31: rejects a predecessor publication from another semester', async () => {
        const tx = {
            resultPublication: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce(null)
                    .mockResolvedValueOnce({ id: 700, semesterId: 2 }),
            },
        };

        await expect(createResultPublication({
            semesterId: 1, actorId: 8, type: 'SUPPLEMENTARY', reason: 'Bảo vệ bổ sung', previousPublicationId: 700, idempotencyKey: 'cross-semester-key-001',
        }, { db: transactionDb(tx) })).rejects.toMatchObject({ code: 'INVALID_PUBLICATION_LINEAGE', status: 409 });
    });

    it('INV-31: rejects correction when the replaced item is not in the declared predecessor publication', async () => {
        const approval = validApproval();
        const tx = {
            resultPublication: {
                findUnique: jest.fn()
                    .mockResolvedValueOnce(null)
                    .mockResolvedValueOnce({ id: 700, semesterId: 1 }),
            },
            defenseResultApproval: { findMany: jest.fn().mockResolvedValue([approval]) },
            resultPublicationItem: {
                findMany: jest.fn().mockResolvedValue([{ id: 900, publicationId: 701, registrationId: 101, sourceApprovalId: 70 }]),
            },
        };

        await expect(createResultPublication({
            semesterId: 1,
            actorId: 8,
            type: 'CORRECTION',
            reason: 'Phúc khảo hợp lệ',
            previousPublicationId: 700,
            correctionItems: [{ registrationId: 101, replacesPublicationItemId: 900 }],
            idempotencyKey: 'correction-key-001',
        }, { db: transactionDb(tx) })).rejects.toMatchObject({ code: 'INVALID_CORRECTION_SCOPE', status: 409 });
    });

    it('INV-29: writes student, topic, outcome and score as source-independent snapshot fields', async () => {
        const approval = validApproval();
        const createMany = jest.fn().mockResolvedValue({ count: 1 });
        const createdPublication = { id: 501, semesterId: 1, type: 'INITIAL' };
        const tx = {
            resultPublication: {
                findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ ...createdPublication, items: [{ id: 1 }] }),
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue(createdPublication),
            },
            defenseResultApproval: { findMany: jest.fn().mockResolvedValue([approval]) },
            resultPublicationItem: { findMany: jest.fn().mockResolvedValue([]), createMany },
            auditLog: { create: jest.fn().mockResolvedValue({}) },
        };

        await createResultPublication({
            semesterId: 1, actorId: 8, type: 'INITIAL', idempotencyKey: 'snapshot-key-001',
        }, { db: transactionDb(tx) });

        expect(createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({
                registrationId: 101,
                sourceApprovalId: 71,
                outcomeSnapshot: 'PASSED',
                finalScoreSnapshot: 8.5,
                studentCodeSnapshot: 'SV001',
                studentNameSnapshot: 'Sinh viên Một',
                topicTitleSnapshot: 'Đề tài Một',
            })],
        });
    });
});
