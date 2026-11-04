const {
    lockMemberScoreSheet,
    lockDefenseScores,
    saveMemberScoreSheet,
    computeAggregateDefenseScore,
} = require('../../src/services/defenseScoringService');
const { WorkflowTransitionError } = require('../../src/services/registrationTransitionService');

describe('Two-Step Defense Score Lock Tests (C03)', () => {
    let mockTx;
    let mockDb;

    beforeEach(() => {
        mockTx = {
            topicRegistration: {
                findUnique: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            defenseMemberScore: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 3 }),
                findMany: jest.fn(),
            },
            defenseMemberCriterionScore: {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            defenseResult: {
                upsert: jest.fn().mockResolvedValue({ finalScore: 9.0 }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            idempotencyRecord: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({}),
            },
            registrationStateHistory: {
                create: jest.fn().mockResolvedValue({}),
            },
            userPermissionGroup: {
                findMany: jest.fn().mockResolvedValue([]),
            },
        };
        mockDb = {
            $transaction: jest.fn((callback) => callback(mockTx)),
        };
    });

    it('should reject member score lock if evaluator is not in current council (403)', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            topic: { id: 1, title: 'Đề tài A', mentorId: 999 },
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            defenseResult: null,
        });

        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 99, // not in council
                    actorId: 99,
                    idempotencyKey: 'test-idemp-key-01',
                    scores: [{ criterionCode: 'C1', score: 9.0 }],
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'EVALUATOR_NOT_IN_COUNCIL',
            status: 403,
        });
    });

    it('should reject member score lock if evaluator is mentor of the student (403 MENTOR_CANNOT_GRADE_OWN_STUDENT)', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            topic: { id: 1, title: 'Đề tài A', mentorId: 21 },
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            defenseResult: null,
        });

        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21, // mentor conflict!
                    actorId: 21,
                    idempotencyKey: 'test-idemp-key-02',
                    scores: [{ criterionCode: 'C1', score: 9.0 }],
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'MENTOR_CANNOT_GRADE_OWN_STUDENT',
            status: 403,
        });
    });

    it('should require Idempotency-Key on member score lock', async () => {
        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    // missing idempotencyKey
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            status: 400,
        });

        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    idempotencyKey: '   ',
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'IDEMPOTENCY_KEY_REQUIRED',
            status: 400,
        });
    });

    it('should prevent mutating a member score that has scoreLocked = true', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            topic: { id: 1, title: 'Đề tài A', mentorId: 999 },
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            defenseResult: null,
        });

        mockTx.defenseMemberScore.findUnique.mockResolvedValue({
            id: 501,
            registrationId: 100,
            evaluatorId: 21,
            finalScore: 8.5,
            scoreLocked: true,
        });

        // 1. saveMemberScoreSheet must reject
        await expect(
            saveMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    evaluatorRole: 'LECTURER',
                    scores: [{ criterionCode: 'C1', score: 9.0 }],
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'SCORE_LOCKED',
            status: 409,
        });

        // 2. lockMemberScoreSheet must reject duplicate lock / overwrite
        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    idempotencyKey: 'test-new-key-04',
                    scores: [{ criterionCode: 'C1', score: 9.0 }],
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'SCORE_LOCKED',
            status: 409,
        });
    });

    it('should forbid admin without RESULT_LOCK capability from locking council defense scores (403)', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            memberScores: [
                { evaluatorId: 21, finalScore: 9.0, scoreLocked: true },
                { evaluatorId: 22, finalScore: 8.5, scoreLocked: true },
                { evaluatorId: 23, finalScore: 9.5, scoreLocked: true },
            ],
        });

        await expect(
            lockDefenseScores(
                {
                    registrationId: 100,
                    action: 'LOCK',
                    actorId: 1,
                    actorRole: 'ADMIN',
                    actorPermissions: ['DEFENSE_SCORE_VIEW', 'USER_MANAGE'],
                    idempotencyKey: 'admin-lock-key-01',
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'RESULT_LOCK_REQUIRED',
            status: 403,
        });
    });

    it('should reject lockDefenseScores if any of the 3 council members has scoreLocked = false', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            memberScores: [
                { evaluatorId: 21, finalScore: 9.0, scoreLocked: true },
                { evaluatorId: 22, finalScore: 8.5, scoreLocked: false }, // Secretary has not locked!
                { evaluatorId: 23, finalScore: 9.5, scoreLocked: true },
            ],
        });

        await expect(
            lockDefenseScores(
                {
                    registrationId: 100,
                    action: 'LOCK',
                    actorId: 21,
                    actorRole: 'LECTURER',
                    actorPermissions: ['RESULT_LOCK'],
                    idempotencyKey: 'council-lock-key-02',
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'MEMBER_SCORE_NOT_LOCKED',
            status: 400,
        });
    });

    it('should reject lockDefenseScores if any member score is null, undefined, or NaN', async () => {
        // Case 1: null score
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            memberScores: [
                { evaluatorId: 21, finalScore: 9.0, scoreLocked: true },
                { evaluatorId: 22, finalScore: null, scoreLocked: true },
                { evaluatorId: 23, finalScore: 9.5, scoreLocked: true },
            ],
        });

        await expect(
            lockDefenseScores(
                {
                    registrationId: 100,
                    action: 'LOCK',
                    actorId: 21,
                    actorRole: 'LECTURER',
                    actorPermissions: ['RESULT_LOCK'],
                    idempotencyKey: 'council-lock-key-null',
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'INVALID_MEMBER_SCORE',
            status: 400,
        });

        // Case 2: undefined score
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            memberScores: [
                { evaluatorId: 21, finalScore: 9.0, scoreLocked: true },
                { evaluatorId: 22, finalScore: undefined, scoreLocked: true },
                { evaluatorId: 23, finalScore: 9.5, scoreLocked: true },
            ],
        });

        await expect(
            lockDefenseScores(
                {
                    registrationId: 100,
                    action: 'LOCK',
                    actorId: 21,
                    actorRole: 'LECTURER',
                    actorPermissions: ['RESULT_LOCK'],
                    idempotencyKey: 'council-lock-key-undefined',
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'INVALID_MEMBER_SCORE',
            status: 400,
        });

        // Case 3: NaN score
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            memberScores: [
                { evaluatorId: 21, finalScore: 9.0, scoreLocked: true },
                { evaluatorId: 22, finalScore: 'invalid-score-nan', scoreLocked: true },
                { evaluatorId: 23, finalScore: 9.5, scoreLocked: true },
            ],
        });

        await expect(
            lockDefenseScores(
                {
                    registrationId: 100,
                    action: 'LOCK',
                    actorId: 21,
                    actorRole: 'LECTURER',
                    actorPermissions: ['RESULT_LOCK'],
                    idempotencyKey: 'council-lock-key-nan',
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({
            code: 'INVALID_MEMBER_SCORE',
            status: 400,
        });
    });

    it('should successfully lock member score sheet and record idempotency', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            topic: { id: 1, title: 'Đề tài A', mentorId: 999 },
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            defenseResult: null,
        });

        mockTx.defenseMemberScore.findUnique.mockResolvedValue(null);
        mockTx.defenseMemberScore.create.mockResolvedValue({
            id: 701,
            registrationId: 100,
            evaluatorId: 21,
            finalScore: 9.0,
            scoreLocked: true,
            lockedAt: new Date(),
        });
        mockTx.defenseMemberScore.findMany.mockResolvedValue([
            { evaluatorId: 21, finalScore: 9.0 },
        ]);

        const result = await lockMemberScoreSheet(
            {
                registrationId: 100,
                evaluatorId: 21,
                actorId: 21,
                idempotencyKey: 'valid-idemp-key-777',
                scores: [{ criterionCode: 'C1', score: 9.0 }],
            },
            { db: mockDb },
        );

        expect(result.scoreLocked).toBe(true);
        expect(result.finalScore).toBe(9.0);
        expect(mockTx.idempotencyRecord.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    scope: 'defense-member-score-lock',
                    key: 'valid-idemp-key-777',
                }),
            }),
        );
    });

    it('should replay idempotency record when identical lock command is sent', async () => {
        mockTx.idempotencyRecord.findUnique.mockResolvedValue({
            id: 10,
            scope: 'defense-member-score-lock',
            key: 'cached-key-888',
            commandHash: expect.any(String),
            response: {
                registrationId: 100,
                evaluatorId: 21,
                memberScoreId: 701,
                finalScore: 9.0,
                scoreLocked: true,
            },
        });

        // We mock findUnique to return the matching hash
        const crypto = require('crypto');
        const expectedHash = crypto.createHash('sha256').update(JSON.stringify({
            registrationId: 100,
            evaluatorId: 21,
        })).digest('hex');

        mockTx.idempotencyRecord.findUnique.mockResolvedValue({
            id: 10,
            scope: 'defense-member-score-lock',
            key: 'cached-key-888',
            commandHash: expectedHash,
            response: {
                registrationId: 100,
                evaluatorId: 21,
                memberScoreId: 701,
                finalScore: 9.0,
                scoreLocked: true,
            },
        });

        const result = await lockMemberScoreSheet(
            {
                registrationId: 100,
                evaluatorId: 21,
                actorId: 21,
                idempotencyKey: 'cached-key-888',
            },
            { db: mockDb },
        );

        expect(result.idempotent).toBe(true);
        expect(result.scoreLocked).toBe(true);
        expect(mockTx.topicRegistration.findUnique).not.toHaveBeenCalled();
    });

    it('should successfully lock council defense scores when all 3 members are locked and valid', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                ],
            },
            memberScores: [
                { evaluatorId: 21, finalScore: 9.0, scoreLocked: true },
                { evaluatorId: 22, finalScore: 8.5, scoreLocked: true },
                { evaluatorId: 23, finalScore: 9.5, scoreLocked: true },
            ],
        });

        const result = await lockDefenseScores(
            {
                registrationId: 100,
                action: 'LOCK',
                actorId: 21,
                actorRole: 'LECTURER',
                actorPermissions: ['RESULT_LOCK'],
                idempotencyKey: 'council-lock-success-999',
            },
            { db: mockDb },
        );

        expect(result.status).toBe('AWAITING_FINAL_APPROVAL');
        expect(result.finalScore).toBe(9.0);
        expect(result.scoreLocked).toBe(true);
        expect(mockTx.defenseMemberScore.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { registrationId: 100 },
                data: expect.objectContaining({ scoreLocked: true }),
            }),
        );
        expect(mockTx.defenseResult.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { registrationId: 100 },
                update: expect.objectContaining({ finalScore: 9.0, scoreLocked: true }),
            }),
        );
    });
});
