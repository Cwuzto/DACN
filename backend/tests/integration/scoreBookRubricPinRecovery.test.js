const {
    lockDefenseScoreBookByChairman,
    returnScoreBookBeforePublication,
    saveMemberScoreSheet,
    lockMemberScoreSheet,
    markStudentAbsentByChairman,
    resolveRubricForRegistration,
} = require('../../src/services/defenseScoringService');
const { collectDefenseResultApprovalItems } = require('../../src/services/instituteOperationsService');
const { DEFAULT_RUBRIC_LEVEL_POLICY } = require('../../src/services/rubricLevelPolicy');

describe('Task 3: ScoreBook Rubric Pin Recovery & Council Lock Synchronization (P0.17, P0.18)', () => {
    let mockTx;
    let mockDb;

    const rubricV2 = {
        id: 2,
        version: 'v2',
        name: 'Rubric Chấm Khóa Luận 2026 V2',
        isActive: true,
        scoreLevelPolicy: DEFAULT_RUBRIC_LEVEL_POLICY,
        categories: [
            {
                id: 201,
                name: 'Nội dung',
                maxScore: 10,
                criteria: [
                    { id: 2001, code: 'CONTENT', name: 'Nội dung khóa luận', maxScore: 10, weight: 1.0 },
                ],
            },
        ],
    };

    beforeEach(() => {
        mockTx = {
            topicRegistration: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            council: {
                findUnique: jest.fn(),
                update: jest.fn().mockResolvedValue({ id: 10, scoreBookLocked: true }),
            },
            councilMember: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            defenseResult: {
                findUnique: jest.fn(),
                upsert: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            defenseMemberScore: {
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            defenseMemberCriterionScore: {
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            defenseScoreBookReturnLog: {
                create: jest.fn().mockResolvedValue({ id: 99 }),
            },
            rubricVersion: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
            },
            idempotencyRecord: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({}),
            },
            registrationStateHistory: {
                create: jest.fn().mockResolvedValue({}),
            },
            resultPublicationItem: {
                findFirst: jest.fn().mockResolvedValue(null),
            },
            userPermissionGroup: {
                findMany: jest.fn().mockResolvedValue([]),
            },
            notification: {
                createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
        };

        mockDb = {
            $transaction: jest.fn((callback) => callback(mockTx)),
            rubricVersion: mockTx.rubricVersion,
            council: mockTx.council,
            topicRegistration: mockTx.topicRegistration,
        };
    });

    test('1. Scorebook lock updates Council.scoreBookLocked = true and pins correct rubricVersion (v2, NOT default v1)', async () => {
        const registration = {
            id: 100,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncilId: 10,
            defenseCouncil: {
                id: 10,
                name: 'Hội đồng CNTT 01',
                rubricVersionId: 2,
                rubricVersion: { id: 2, version: 'v2' },
                allowFourthScoringMember: false,
                members: [
                    { id: 1, lecturerId: 101, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { id: 2, lecturerId: 102, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { id: 3, lecturerId: 103, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                ],
            },
            memberScores: [
                { id: 1, evaluatorId: 101, finalScore: 9.0, scoreLocked: true, scoreRubricVersion: 'v2', isEffective: true },
                { id: 2, evaluatorId: 102, finalScore: 8.5, scoreLocked: true, scoreRubricVersion: 'v2', isEffective: true },
                { id: 3, evaluatorId: 103, finalScore: 8.0, scoreLocked: true, scoreRubricVersion: 'v2', isEffective: true },
            ],
            defenseResult: null,
        };

        mockTx.topicRegistration.findUnique.mockResolvedValue(registration);
        mockTx.rubricVersion.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 2 || where.version === 'v2') return rubricV2;
            return null; // v1 does NOT exist!
        });
        mockTx.defenseResult.upsert.mockImplementation(async ({ create, update }) => ({
            id: 50,
            registrationId: 100,
            ...(update || create),
        }));

        const result = await lockDefenseScoreBookByChairman(
            {
                registrationId: 100,
                actorId: 101,
                idempotencyKey: 'idemp-lock-001',
            },
            { db: mockDb },
        );

        // Expect DefenseResult to pin rubric v2
        expect(mockTx.defenseResult.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({
                    scoreRubricVersion: 'v2',
                    scoreLocked: true,
                }),
                update: expect.objectContaining({
                    scoreRubricVersion: 'v2',
                    scoreLocked: true,
                }),
            }),
        );

        // Expect Council.scoreBookLocked to be set to true in the same transaction
        expect(mockTx.council.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({
                scoreBookLocked: true,
                scoreBookLockedById: 101,
            }),
        });

        expect(result.scoreLocked).toBe(true);
    });

    test('2. Scorebook return opens Council.scoreBookLocked = false, and subsequent rescoring does NOT crash with 404 PINNED_RUBRIC_NOT_FOUND', async () => {
        const lockedRegistration = {
            id: 100,
            status: 'AWAITING_FINAL_APPROVAL',
            stateVersion: 2,
            defenseCouncilId: 10,
            defenseCouncil: {
                id: 10,
                name: 'Hội đồng CNTT 01',
                rubricVersionId: 2,
                rubricVersion: { id: 2, version: 'v2' },
                members: [
                    { id: 1, lecturerId: 101, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { id: 2, lecturerId: 102, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { id: 3, lecturerId: 103, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                ],
            },
            memberScores: [
                { id: 1, evaluatorId: 101, finalScore: 9.0, scoreLocked: true, scoreRubricVersion: 'v2', isEffective: true, versionNumber: 1 },
                { id: 2, evaluatorId: 102, finalScore: 8.5, scoreLocked: true, scoreRubricVersion: 'v2', isEffective: true, versionNumber: 1 },
                { id: 3, evaluatorId: 103, finalScore: 8.0, scoreLocked: true, scoreRubricVersion: 'v2', isEffective: true, versionNumber: 1 },
            ],
            defenseResult: {
                id: 50,
                registrationId: 100,
                scoreLocked: true,
                scoreRubricVersion: 'v2',
                ledgerVersion: 1,
                finalScore: 8.5,
            },
        };

        mockTx.topicRegistration.findUnique.mockResolvedValue(lockedRegistration);
        mockTx.rubricVersion.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 2 || where.version === 'v2') return rubricV2;
            return null; // v1 does NOT exist!
        });
        mockTx.defenseResult.update.mockResolvedValue({
            ...lockedRegistration.defenseResult,
            scoreLocked: false,
            ledgerVersion: 2,
        });

        // Step 1: Admin returns scorebook
        const returnResult = await returnScoreBookBeforePublication(
            {
                registrationId: 100,
                adminId: 1,
                reason: 'Giám khảo 102 cần điều chỉnh điểm tiêu chí nội dung',
                reopenMemberScoreIds: [2],
            },
            { db: mockDb },
        );

        expect(returnResult.defenseResult.scoreLocked).toBe(false);

        // Council.scoreBookLocked must be opened (false)
        expect(mockTx.council.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({
                scoreBookLocked: false,
                scoreBookLockedAt: null,
                scoreBookLockedById: null,
            }),
        });

        // Step 2: Lecturer 102 rescores. It must resolve rubric v2 without 404!
        const registrationAfterReturn = {
            ...lockedRegistration,
            status: 'AWAITING_SCORES',
            defenseResult: {
                ...lockedRegistration.defenseResult,
                scoreLocked: false,
                ledgerVersion: 2,
            },
            memberScores: [
                lockedRegistration.memberScores[0],
                { ...lockedRegistration.memberScores[1], scoreLocked: false, versionNumber: 2 },
                lockedRegistration.memberScores[2],
            ],
        };

        mockTx.topicRegistration.findUnique.mockResolvedValue(registrationAfterReturn);
        mockTx.defenseMemberScore.findUnique.mockResolvedValue(registrationAfterReturn.memberScores[1]);
        mockTx.defenseMemberScore.update.mockImplementation(async ({ data }) => ({
            ...registrationAfterReturn.memberScores[1],
            ...data,
        }));

        // Rescoring should succeed and keep rubricVersion v2
        const rescoreResult = await saveMemberScoreSheet(
            {
                registrationId: 100,
                evaluatorId: 102,
                scores: [{ criterionCode: 'CONTENT', score: 9.0 }],
            },
            { db: mockDb },
        );

        expect(rescoreResult.scoreRubricVersion).toBe('v2');
    });

    test('3. Absent student scorebook lock sets Council.scoreBookLocked = true, preserves null scores (no fake 0)', async () => {
        const registration = {
            id: 101,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            defenseCouncilId: 10,
            defenseCouncil: {
                id: 10,
                name: 'Hội đồng CNTT 01',
                rubricVersionId: 2,
                rubricVersion: { id: 2, version: 'v2' },
                allowFourthScoringMember: false,
                members: [
                    { id: 1, lecturerId: 101, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { id: 2, lecturerId: 102, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { id: 3, lecturerId: 103, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                ],
            },
            memberScores: [],
            defenseResult: {
                attendanceStatus: 'ABSENT',
                absentMinutesText: 'Sinh viên vắng mặt không lý do tại buổi bảo vệ.',
            },
        };

        mockTx.topicRegistration.findUnique.mockResolvedValue(registration);
        mockTx.rubricVersion.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 2 || where.version === 'v2') return rubricV2;
            return null;
        });
        mockTx.defenseResult.upsert.mockImplementation(async ({ create, update }) => ({
            id: 51,
            registrationId: 101,
            ...(update || create),
        }));

        const result = await lockDefenseScoreBookByChairman(
            {
                registrationId: 101,
                actorId: 101,
                idempotencyKey: 'idemp-absent-lock-001',
            },
            { db: mockDb },
        );

        // Absent student must have null scores
        expect(result.finalScore).toBeNull();
        expect(result.rawAverageScore).toBeNull();
        expect(result.roundedFinalScore).toBeNull();

        // Council scorebook lock flag must still be set to true
        expect(mockTx.council.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: expect.objectContaining({
                scoreBookLocked: true,
                scoreBookLockedById: 101,
            }),
        });
    });

    test('4. Institute review queue respects Council.scoreBookLocked state for allowedActions', async () => {
        const directorActor = {
            id: 99,
            role: 'LECTURER',
            isDean: true,
            department: 'CNTT',
            permissions: ['DEFENSE_RESULT_APPROVE', 'DEFENSE_RESULT_VIEW'],
        };

        const dbMock = {
            topicRegistration: {
                findMany: jest.fn(),
            },
            userPermissionGroup: {
                findMany: jest.fn().mockResolvedValue([]),
            },
        };

        // When scoreBookLocked = true, Viện trưởng sees APPROVE_DEFENSE_RESULT
        dbMock.topicRegistration.findMany.mockResolvedValue([
            {
                id: 100,
                semesterId: 1,
                status: 'AWAITING_FINAL_APPROVAL',
                student: { id: 1, fullName: 'Nguyen Van A', code: '210001' },
                topic: {
                    title: 'De tai tot nghiep',
                    mentor: { id: 10, fullName: 'GVHD A', department: 'CNTT' },
                },
                defenseCouncil: {
                    id: 10,
                    name: 'HD 01',
                    scoreBookLocked: true,
                },
                resultPublicationItems: [],
            },
        ]);

        const queueLocked = await collectDefenseResultApprovalItems({
            actor: directorActor,
            semesterId: 1,
            db: dbMock,
        });

        expect(queueLocked.length).toBe(1);
        expect(queueLocked[0].allowedActions).toContain('APPROVE_DEFENSE_RESULT');

        // When scoreBookLocked = false (e.g. after return), Viện trưởng cannot approve
        dbMock.topicRegistration.findMany.mockResolvedValue([
            {
                id: 100,
                semesterId: 1,
                status: 'AWAITING_FINAL_APPROVAL',
                student: { id: 1, fullName: 'Nguyen Van A', code: '210001' },
                topic: {
                    title: 'De tai tot nghiep',
                    mentor: { id: 10, fullName: 'GVHD A', department: 'CNTT' },
                },
                defenseCouncil: {
                    id: 10,
                    name: 'HD 01',
                    scoreBookLocked: false,
                },
                resultPublicationItems: [],
            },
        ]);

        const queueUnlocked = await collectDefenseResultApprovalItems({
            actor: directorActor,
            semesterId: 1,
            db: dbMock,
        });

        expect(queueUnlocked.length).toBe(1);
        expect(queueUnlocked[0].allowedActions).toEqual([]);
    });
});
