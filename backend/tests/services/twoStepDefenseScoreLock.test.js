const {
    lockMemberScoreSheet,
    lockDefenseScores,
    saveMemberScoreSheet,
    lockDefenseScoreBookByChairman,
    computeAggregateDefenseScore,
} = require('../../src/services/defenseScoringService');
const { WorkflowTransitionError } = require('../../src/services/registrationTransitionService');

const buildFullV1Scores = (overrideMap = {}) => ([
    { criterionCode: 'STRUCTURE', score: 0.5 },
    { criterionCode: 'CITATION_FORMAT', score: 0.25 },
    { criterionCode: 'LANGUAGE', score: 0.25 },
    { criterionCode: 'PROBLEM_STATEMENT', score: 1.0 },
    { criterionCode: 'RESEARCH_METHOD', score: 0.5 },
    { criterionCode: 'RESEARCH_CONTENT', score: 2.0 },
    { criterionCode: 'RESEARCH_RESULT', score: 1.0 },
    { criterionCode: 'NOVELTY', score: 0.25 },
    { criterionCode: 'APPLICABILITY', score: 0.5 },
    { criterionCode: 'PUBLICATION', score: 0.25 },
    { criterionCode: 'PRESENTATION_SKILL', score: 0.5 },
    { criterionCode: 'ATTITUDE', score: 0.5 },
    { criterionCode: 'PRESENTATION_CONTENT', score: 0.75 },
    { criterionCode: 'QA_RESPONSE', score: 0.75 },
].map((row) => (
    Object.prototype.hasOwnProperty.call(overrideMap, row.criterionCode)
        ? { ...row, score: overrideMap[row.criterionCode] }
        : row
)));

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
                scores: buildFullV1Scores(),
            },
            { db: mockDb },
        );

        expect(result.scoreLocked).toBe(true);
        expect(result.finalScore).toBe(9.0);
        expect(result.aggregateFinalScore).toBeNull();
        expect(mockTx.defenseResult.upsert).not.toHaveBeenCalled();
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

    it('should reject incomplete lock (empty scores, partial scores, or incomplete saved draft)', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            topic: { id: 1, title: 'Đề tài A', mentorId: 999 },
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                ],
            },
            defenseResult: null,
        });
        mockTx.defenseMemberScore.findUnique.mockResolvedValue(null);

        // 1. Explicit empty scores: []
        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    idempotencyKey: 'incomplete-empty-1',
                    scores: [],
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({ code: 'INCOMPLETE_CRITERION_SCORES', status: 400 });

        // 2. Partial subset
        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    idempotencyKey: 'incomplete-partial-1',
                    scores: [{ criterionCode: 'STRUCTURE', score: 0.5 }],
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({ code: 'INCOMPLETE_CRITERION_SCORES', status: 400 });

        // 3. Omitting scores when saved draft is incomplete
        mockTx.defenseMemberScore.findUnique.mockResolvedValue({
            id: 702,
            registrationId: 100,
            evaluatorId: 21,
            finalScore: 0.5,
            scoreLocked: false,
            scoreRubricVersion: 'v1',
            criterionScores: [{ criterionCode: 'STRUCTURE', score: 0.5, maxScore: 0.5 }],
        });

        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    idempotencyKey: 'incomplete-draft-lock-1',
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({ code: 'INCOMPLETE_CRITERION_SCORES', status: 400 });
    });

    it('should allow lockMemberScoreSheet when all criteria are scored including 0, and allow locking a complete saved draft', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            topic: { id: 1, title: 'Đề tài A', mentorId: 999 },
            defenseCouncil: {
                id: 5,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                ],
            },
            defenseResult: null,
        });

        // All 0 scores -> valid lock with finalScore = 0
        const zeroScores = buildFullV1Scores({
            STRUCTURE: 0,
            CITATION_FORMAT: 0,
            LANGUAGE: 0,
            PROBLEM_STATEMENT: 0,
            RESEARCH_METHOD: 0,
            RESEARCH_CONTENT: 0,
            RESEARCH_RESULT: 0,
            NOVELTY: 0,
            APPLICABILITY: 0,
            PUBLICATION: 0,
            PRESENTATION_SKILL: 0,
            ATTITUDE: 0,
            PRESENTATION_CONTENT: 0,
            QA_RESPONSE: 0,
        });

        mockTx.defenseMemberScore.findUnique.mockResolvedValue(null);
        mockTx.defenseMemberScore.create.mockImplementation(async ({ data }) => ({
            id: 703,
            ...data,
        }));

        const zeroLockRes = await lockMemberScoreSheet(
            {
                registrationId: 100,
                evaluatorId: 21,
                actorId: 21,
                idempotencyKey: 'lock-zero-all-1',
                scores: zeroScores,
            },
            { db: mockDb },
        );

        expect(zeroLockRes.scoreLocked).toBe(true);
        expect(zeroLockRes.finalScore).toBe(0);
        expect(mockTx.defenseResult.upsert).not.toHaveBeenCalled();

        // Locking a complete saved draft without resending scores
        mockTx.defenseMemberScore.findUnique.mockResolvedValue({
            id: 704,
            registrationId: 100,
            evaluatorId: 21,
            finalScore: 9.0,
            scoreLocked: false,
            scoreRubricVersion: 'v1',
            criterionScores: buildFullV1Scores(),
        });
        mockTx.defenseMemberScore.update.mockImplementation(async ({ data }) => ({
            id: 704,
            registrationId: 100,
            evaluatorId: 21,
            ...data,
        }));

        const savedDraftLockRes = await lockMemberScoreSheet(
            {
                registrationId: 100,
                evaluatorId: 21,
                actorId: 21,
                idempotencyKey: 'lock-complete-draft-1',
            },
            { db: mockDb },
        );

        expect(savedDraftLockRes.scoreLocked).toBe(true);
        expect(savedDraftLockRes.finalScore).toBe(9.0);
    });

    it('should reject lockMemberScoreSheet for non-scoring council member (403) and invalid score precision (>2 decimals)', async () => {
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            topic: { id: 1, title: 'Đề tài A', mentorId: 999 },
            defenseCouncil: {
                id: 5,
                allowFourthScoringMember: false,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                    { lecturerId: 24, roleInCouncil: 'MEMBER', isActive: true, isScoringMember: false },
                ],
            },
            defenseResult: null,
        });

        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 24,
                    actorId: 24,
                    idempotencyKey: 'lock-non-scoring-1',
                    scores: buildFullV1Scores(),
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({ status: 403 });

        mockTx.defenseMemberScore.findUnique.mockResolvedValue(null);
        await expect(
            lockMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    idempotencyKey: 'lock-bad-decimal-1',
                    scores: buildFullV1Scores({ STRUCTURE: 0.125 }),
                },
                { db: mockDb },
            ),
        ).rejects.toMatchObject({ code: 'INVALID_CRITERION_SCORE', status: 400 });
    });

    it('lockDefenseScoreBookByChairman should lock PRESENT student cleanly without ReferenceError (3 and 4 effective scorers)', async () => {
        // Case 1: 3 scorers with discrepancy >= 1.5
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 5,
                allowFourthScoringMember: false,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                ],
            },
            defenseResult: { attendanceStatus: 'PRESENT', scoreLocked: false },
            memberScores: [
                { evaluatorId: 21, finalScore: 8.0, scoreLocked: true, isEffective: true },
                { evaluatorId: 22, finalScore: 9.5, scoreLocked: true, isEffective: true },
                { evaluatorId: 23, finalScore: 9.5, scoreLocked: true, isEffective: true },
            ],
        });
        mockTx.defenseResult.upsert.mockImplementation(async ({ update, create }) => ({
            id: 801,
            ...(update || create),
        }));

        const res3 = await lockDefenseScoreBookByChairman(
            {
                registrationId: 100,
                actorId: 21,
                idempotencyKey: 'chair-present-lock-3',
            },
            { db: mockDb },
        );

        expect(res3.status).toBe('AWAITING_FINAL_APPROVAL');
        expect(res3.scoreLocked).toBe(true);
        expect(res3.rawAverageScore).toBe(9.0);
        expect(res3.roundedFinalScore).toBe(9.0);
        expect(res3.finalScore).toBe(9.0);

        // Case 2: 4 effective scorers
        mockTx.topicRegistration.findUnique.mockResolvedValue({
            id: 101,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncil: {
                id: 6,
                allowFourthScoringMember: true,
                members: [
                    { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                    { lecturerId: 24, roleInCouncil: 'MEMBER', isActive: true, isScoringMember: true },
                ],
            },
            defenseResult: { attendanceStatus: 'PRESENT', scoreLocked: false },
            memberScores: [
                { evaluatorId: 21, finalScore: 8.0, scoreLocked: true, isEffective: true },
                { evaluatorId: 22, finalScore: 8.5, scoreLocked: true, isEffective: true },
                { evaluatorId: 23, finalScore: 9.0, scoreLocked: true, isEffective: true },
                { evaluatorId: 24, finalScore: 9.5, scoreLocked: true, isEffective: true },
            ],
        });

        const res4 = await lockDefenseScoreBookByChairman(
            {
                registrationId: 101,
                actorId: 21,
                idempotencyKey: 'chair-present-lock-4',
            },
            { db: mockDb },
        );

        expect(res4.status).toBe('AWAITING_FINAL_APPROVAL');
        expect(res4.rawAverageScore).toBe(8.75);
        expect(res4.roundedFinalScore).toBe(8.8);
        expect(res4.finalScore).toBe(8.8);
    });
});
