const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    topicRegistration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(),
    },
    council: { findUnique: jest.fn(), findMany: jest.fn() },
    councilMember: { findUnique: jest.fn(), findMany: jest.fn() },
    defenseResult: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
    },
    defenseMemberScore: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
    },
    defenseMemberCriterionScore: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    defenseResultApproval: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    resultPublication: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
    },
    resultPublicationItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    titleAdjustmentAppendixItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    topicAssignmentDecisionItem: {
        findFirst: jest.fn(),
    },
    bm02Submission: {
        findFirst: jest.fn(),
    },
    defenseScoreBookReturnLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
    },
    idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
    },
    registrationStateHistory: {
        create: jest.fn().mockResolvedValue({}),
    },
    notification: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
        create: jest.fn().mockResolvedValue({}),
    },
    academicDelegation: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    userPermissionGroup: {
        findMany: jest.fn().mockResolvedValue([]),
    },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');
const {
    approveDefenseResult,
    createResultPublication,
    getStudentPublishedResult,
    hashScoreEvidence,
} = require('../../src/services/defenseResultPublicationService');
const {
    saveMemberScoreSheet,
    lockMemberScoreSheet,
    lockDefenseScoreBookByChairman,
    lockDefenseScores,
    returnScoreBookBeforePublication,
} = require('../../src/services/defenseScoringService');

const adminPerms = [{
    permissionGroup: {
        code: 'ADMIN_GROUP',
        permissions: [
            { permission: { code: 'DEFENSE_RESULT_APPROVE' } },
            { permission: { code: 'RESULT_PUBLISH' } },
            { permission: { code: 'RESULT_PUBLICATION_PUBLISH' } },
            { permission: { code: 'DEFENSE_SCOREBOOK_RETURN' } },
            { permission: { code: 'RESULT_LOCK' } },
            { permission: { code: 'DEFENSE_SCORE_VIEW' } },
            { permission: { code: 'VIEW_DEFENSE_GRADING' } },
            { permission: { code: 'VIEW_MY_GRADES' } },
        ],
    },
}];

const chairmanPerms = [{
    permissionGroup: {
        code: 'LECTURER_GROUP',
        permissions: [
            { permission: { code: 'DEFENSE_SCORE_SUBMIT' } },
            { permission: { code: 'DEFENSE_SCORE_VIEW' } },
            { permission: { code: 'VIEW_DEFENSE_GRADING' } },
        ],
    },
}];

const studentPerms = [{
    permissionGroup: {
        code: 'STUDENT_GROUP',
        permissions: [
            { permission: { code: 'VIEW_MY_GRADES' } },
        ],
    },
}];

describe('Task 5: Institute Result Approval & Immutable Publication (Banning Post-Publication Edits / CORRECTION)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
        prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
        prisma.defenseScoreBookReturnLog.create.mockResolvedValue({ id: 1 });
        prisma.resultPublicationItem.findFirst.mockResolvedValue(null);
        prisma.resultPublicationItem.findMany.mockResolvedValue([]);
        prisma.resultPublicationItem.createMany.mockResolvedValue({ count: 1 });
        prisma.titleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
        prisma.topicAssignmentDecisionItem.findFirst.mockResolvedValue(null);
        prisma.bm02Submission.findFirst.mockResolvedValue(null);

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'chairman-token') return { userId: 101, role: 'LECTURER' };
            if (token === 'student-token') return { userId: 50, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) {
                return { id: 1, fullName: 'Admin User', role: 'ADMIN', isActive: true, permissionGroups: adminPerms };
            }
            if (where.id === 101) {
                return { id: 101, fullName: 'Chairman Lecturer', role: 'LECTURER', isActive: true, permissionGroups: chairmanPerms };
            }
            if (where.id === 50) {
                return { id: 50, fullName: 'Nguyen Van SinhVien', role: 'STUDENT', code: 'SV001', isActive: true, permissionGroups: studentPerms };
            }
            return null;
        });
    });

    test('1. Before publication, component scores & total score are hidden from student; visible after publication', async () => {
        // Step 1A: Before publication (resultPublicationItems is empty and findFirst returns null)
        prisma.topicRegistration.findMany.mockResolvedValue([
            {
                id: 101,
                studentId: 50,
                semesterId: 1,
                status: 'DEFENSE_PASSED',
                topic: { title: 'He thong AI Assistant' },
                defenseResult: {
                    id: 1,
                    finalScore: 8.5,
                    rawAverageScore: 8.5,
                    roundedFinalScore: 8.5,
                    scoreLocked: true,
                },
                memberScores: [
                    { evaluatorId: 101, finalScore: 8.5, scoreLocked: true, comments: 'Good' },
                ],
                resultPublicationItems: [],
            },
        ]);
        prisma.resultPublicationItem.findFirst.mockResolvedValue(null);

        const resUnpublishedGrades = await request(app)
            .get('/api/evaluations/my-grades')
            .set('Authorization', 'Bearer student-token');

        expect(resUnpublishedGrades.status).toBe(200);
        expect(resUnpublishedGrades.body.success).toBe(true);
        expect(resUnpublishedGrades.body.data[0].defenseResult).toBeNull();
        expect(resUnpublishedGrades.body.data[0].memberScores).toEqual([]);
        expect(resUnpublishedGrades.body.data[0].isPublished).toBe(false);

        const resUnpublishedResult = await request(app)
            .get('/api/evaluations/my-published-result')
            .set('Authorization', 'Bearer student-token');

        expect(resUnpublishedResult.status).toBe(200);
        expect(resUnpublishedResult.body.success).toBe(true);
        expect(resUnpublishedResult.body.data).toBeNull();

        // Step 1B: After publication
        const publishedItem = {
            id: 1,
            publicationId: 10,
            registrationId: 101,
            outcomeSnapshot: 'PASSED',
            finalScoreSnapshot: 8.5,
            studentCodeSnapshot: 'SV001',
            studentNameSnapshot: 'Nguyen Van SinhVien',
            topicTitleSnapshot: 'He thong AI Assistant Chuan BM02-A',
            publication: { id: 10, semesterId: 1, type: 'INITIAL', publishedAt: new Date() },
        };

        prisma.topicRegistration.findMany.mockResolvedValue([
            {
                id: 101,
                studentId: 50,
                semesterId: 1,
                status: 'DEFENSE_PASSED',
                topic: { title: 'He thong AI Assistant' },
                defenseResult: {
                    id: 1,
                    finalScore: 8.5,
                    rawAverageScore: 8.5,
                    roundedFinalScore: 8.5,
                    scoreLocked: true,
                },
                memberScores: [
                    { evaluatorId: 101, finalScore: 8.5, scoreLocked: true, comments: 'Good' },
                ],
                resultPublicationItems: [publishedItem],
            },
        ]);
        prisma.resultPublicationItem.findFirst.mockResolvedValue(publishedItem);

        const resPublishedGrades = await request(app)
            .get('/api/evaluations/my-grades')
            .set('Authorization', 'Bearer student-token');

        expect(resPublishedGrades.status).toBe(200);
        expect(resPublishedGrades.body.data[0].isPublished).toBe(true);
        expect(resPublishedGrades.body.data[0].defenseResult).not.toBeNull();
        expect(resPublishedGrades.body.data[0].defenseResult.finalScore).toBe(8.5);
        expect(resPublishedGrades.body.data[0].topic.title).toBe('He thong AI Assistant Chuan BM02-A');

        const resPublishedResult = await request(app)
            .get('/api/evaluations/my-published-result')
            .set('Authorization', 'Bearer student-token');

        expect(resPublishedResult.status).toBe(200);
        expect(resPublishedResult.body.data).not.toBeNull();
        expect(resPublishedResult.body.data.finalScoreSnapshot).toBe(8.5);
        expect(resPublishedResult.body.data.outcomeSnapshot).toBe('PASSED');
        expect(resPublishedResult.body.data.topicTitleSnapshot).toBe('He thong AI Assistant Chuan BM02-A');
    });

    test('2. approveDefenseResult transitions roundedFinalScore = 5.0 (raw 4.95) to DEFENSE_PASSED, roundedFinalScore = 4.9 (raw 4.94) to DEFENSE_FAILED, and ABSENT to DEFENSE_FAILED', async () => {
        const createCouncilMembers = () => [
            { id: 1, lecturerId: 101, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
            { id: 2, lecturerId: 102, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
            { id: 3, lecturerId: 103, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
        ];

        // Case 2A: raw 4.95 -> roundedFinalScore 5.0 -> DEFENSE_PASSED
        const regPassed = {
            id: 201,
            status: 'AWAITING_FINAL_APPROVAL',
            stateVersion: 1,
            student: { code: 'SV001', fullName: 'Sinh vien Mot' },
            topic: { title: 'De tai 1' },
            defenseCouncil: { members: createCouncilMembers() },
            defenseResult: {
                id: 11,
                rawAverageScore: 4.95,
                roundedFinalScore: 5.0,
                finalScore: 5.0,
                scoreLocked: true,
                scoreRubricVersion: 'v1',
                attendanceStatus: 'PRESENT',
            },
            memberScores: [
                { evaluatorId: 101, finalScore: 5.0, scoreLocked: true, isEffective: true },
                { evaluatorId: 102, finalScore: 4.9, scoreLocked: true, isEffective: true },
                { evaluatorId: 103, finalScore: 4.95, scoreLocked: true, isEffective: true },
            ],
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(regPassed);
        prisma.defenseResultApproval.findFirst.mockResolvedValue(null);
        prisma.defenseResultApproval.create.mockImplementation(async ({ data }) => ({ id: 501, ...data }));

        const resultPassed = await approveDefenseResult({
            registrationId: 201,
            actorId: 1,
            idempotencyKey: 'approve-passed-201',
        }, { db: prisma });

        expect(resultPassed.approval.outcome).toBe('PASSED');
        expect(resultPassed.approval.finalScoreSnapshot).toBe(5.0);
        expect(prisma.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: 201 }),
                data: expect.objectContaining({ status: 'DEFENSE_PASSED' }),
            })
        );

        // Case 2B: raw 4.94 -> roundedFinalScore 4.9 -> DEFENSE_FAILED
        const regFailed = {
            id: 202,
            status: 'AWAITING_FINAL_APPROVAL',
            stateVersion: 1,
            student: { code: 'SV002', fullName: 'Sinh vien Hai' },
            topic: { title: 'De tai 2' },
            defenseCouncil: { members: createCouncilMembers() },
            defenseResult: {
                id: 12,
                rawAverageScore: 4.94,
                roundedFinalScore: 4.9,
                finalScore: 4.9,
                scoreLocked: true,
                scoreRubricVersion: 'v1',
                attendanceStatus: 'PRESENT',
            },
            memberScores: [
                { evaluatorId: 101, finalScore: 4.9, scoreLocked: true, isEffective: true },
                { evaluatorId: 102, finalScore: 4.9, scoreLocked: true, isEffective: true },
                { evaluatorId: 103, finalScore: 5.0, scoreLocked: true, isEffective: true },
            ],
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(regFailed);
        prisma.defenseResultApproval.findFirst.mockResolvedValue(null);

        const resultFailed = await approveDefenseResult({
            registrationId: 202,
            actorId: 1,
            idempotencyKey: 'approve-failed-202',
        }, { db: prisma });

        expect(resultFailed.approval.outcome).toBe('FAILED');
        expect(resultFailed.approval.finalScoreSnapshot).toBe(4.9);
        expect(prisma.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: 202 }),
                data: expect.objectContaining({ status: 'DEFENSE_FAILED' }),
            })
        );

        // Case 2C: ABSENT -> outcome FAILED, score null -> DEFENSE_FAILED
        const regAbsent = {
            id: 203,
            status: 'AWAITING_FINAL_APPROVAL',
            stateVersion: 1,
            student: { code: 'SV003', fullName: 'Sinh vien Ba' },
            topic: { title: 'De tai 3' },
            defenseCouncil: { members: createCouncilMembers() },
            defenseResult: {
                id: 13,
                rawAverageScore: null,
                roundedFinalScore: null,
                finalScore: null,
                scoreLocked: true,
                scoreRubricVersion: 'v1',
                attendanceStatus: 'ABSENT',
                absentMinutesText: 'Sinh vien vang mat co ly do dot xuat.',
            },
            memberScores: [],
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(regAbsent);
        prisma.defenseResultApproval.findFirst.mockResolvedValue(null);

        const resultAbsent = await approveDefenseResult({
            registrationId: 203,
            actorId: 1,
            idempotencyKey: 'approve-absent-203',
        }, { db: prisma });

        expect(resultAbsent.approval.outcome).toBe('FAILED');
        expect(resultAbsent.approval.finalScoreSnapshot).toBeNull();
        expect(prisma.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: 203 }),
                data: expect.objectContaining({ status: 'DEFENSE_FAILED' }),
            })
        );
    });

    test('3. createResultPublication snapshots effectiveTitle (after BM02/BM02-A) and roundedFinalScore', async () => {
        const createCouncilMembers = () => [
            { id: 1, lecturerId: 101, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
            { id: 2, lecturerId: 102, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
            { id: 3, lecturerId: 103, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
        ];

        const registration = {
            id: 301,
            semesterId: 1,
            defenseCouncilId: 10,
            periodPolicyVersionId: null,
            student: { code: 'SV301', fullName: 'Le Van C' },
            topic: { title: 'De tai goc chua dieu chinh' },
            defenseCouncil: { members: createCouncilMembers() },
            defenseResult: {
                id: 31,
                finalScore: 8.3,
                rawAverageScore: 8.333,
                roundedFinalScore: 8.3,
                scoreLocked: true,
                scoreRubricVersion: 'v1',
                attendanceStatus: 'PRESENT',
                lockedAt: new Date('2026-11-20'),
            },
            memberScores: [
                { evaluatorId: 101, finalScore: 8.0, scoreLocked: true, isEffective: true, scoreRubricVersion: 'v1', lockedAt: new Date('2026-11-20') },
                { evaluatorId: 102, finalScore: 8.5, scoreLocked: true, isEffective: true, scoreRubricVersion: 'v1', lockedAt: new Date('2026-11-20') },
                { evaluatorId: 103, finalScore: 8.5, scoreLocked: true, isEffective: true, scoreRubricVersion: 'v1', lockedAt: new Date('2026-11-20') },
            ],
        };

        const approval = {
            id: 88,
            registrationId: 301,
            defenseResultId: 31,
            outcome: 'PASSED',
            finalScoreSnapshot: 8.3,
            rubricVersionSnapshot: 'v1',
            defenseCouncilId: 10,
            policyVersionId: null,
            isEffective: true,
            scoreFingerprint: hashScoreEvidence(registration),
            registration,
        };

        // Mock titleAdjustmentAppendixItem for resolveEffectiveTopicTitle
        prisma.titleAdjustmentAppendixItem.findFirst.mockResolvedValue({
            id: 1,
            registrationId: 301,
            newTitle: 'He thong IoT Smart City (Dieu chinh BM02-A)',
            appendix: {
                id: 1,
                appendixNumber: 'PL-01',
                sequenceNo: 1,
                signedDate: new Date('2026-11-10'),
                status: 'ISSUED',
            },
        });

        prisma.defenseResultApproval.findMany.mockResolvedValue([approval]);
        prisma.resultPublication.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: 50,
            semesterId: 1,
            type: 'INITIAL',
            items: [{ id: 1, registrationId: 301, topicTitleSnapshot: 'He thong IoT Smart City (Dieu chinh BM02-A)', finalScoreSnapshot: 8.3 }],
        });
        prisma.resultPublication.findFirst.mockResolvedValue(null);
        prisma.resultPublication.create.mockResolvedValue({ id: 50, semesterId: 1, type: 'INITIAL' });

        const result = await createResultPublication({
            semesterId: 1,
            actorId: 1,
            publicationType: 'INITIAL',
            idempotencyKey: 'pub-test-301',
        }, { db: prisma });

        expect(result.publication).toBeDefined();
        expect(prisma.resultPublicationItem.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({
                    registrationId: 301,
                    sourceApprovalId: 88,
                    outcomeSnapshot: 'PASSED',
                    finalScoreSnapshot: 8.3,
                    topicTitleSnapshot: 'He thong IoT Smart City (Dieu chinh BM02-A)',
                    studentCodeSnapshot: 'SV301',
                    studentNameSnapshot: 'Le Van C',
                }),
            ],
        });
    });

    test('4. Block publicationType = CORRECTION with 409 CORRECTION_AFTER_PUBLICATION_FORBIDDEN via API and service', async () => {
        // Direct service call
        await expect(createResultPublication({
            semesterId: 1,
            actorId: 1,
            publicationType: 'CORRECTION',
            reason: 'Sua diem sau cong bo',
            idempotencyKey: 'corr-key-1',
        }, { db: prisma })).rejects.toMatchObject({
            code: 'CORRECTION_AFTER_PUBLICATION_FORBIDDEN',
            status: 409,
        });

        // API call via Supertest
        const res = await request(app)
            .post('/api/evaluations/semesters/1/result-publications')
            .set('Authorization', 'Bearer admin-token')
            .set('Idempotency-Key', 'corr-api-key-1')
            .send({
                type: 'CORRECTION',
                reason: 'Yeu cau sua diem',
            });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('CORRECTION_AFTER_PUBLICATION_FORBIDDEN');
    });

    test('5. Once published, returnScoreBookBeforePublication, saveMemberScoreSheet, lockDefenseScoreBookByChairman, and approveDefenseResult are all rejected with 409 RESULT_ALREADY_PUBLISHED_IMMUTABLE', async () => {
        const publishedRegistrationId = 401;
        const publishedItem = {
            id: 99,
            publicationId: 10,
            registrationId: publishedRegistrationId,
            outcomeSnapshot: 'PASSED',
            finalScoreSnapshot: 8.0,
        };

        const registration = {
            id: publishedRegistrationId,
            status: 'DEFENSE_PASSED',
            stateVersion: 2,
            topic: { mentorId: 999, title: 'De tai Da Cong Bo' },
            defenseCouncil: {
                id: 10,
                allowFourthScoringMember: false,
                members: [
                    { lecturerId: 101, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                    { lecturerId: 102, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                    { lecturerId: 103, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                ],
            },
            defenseResult: {
                id: 41,
                finalScore: 8.0,
                roundedFinalScore: 8.0,
                scoreLocked: true,
                scoreRubricVersion: 'v1',
                attendanceStatus: 'PRESENT',
            },
            memberScores: [
                { id: 1, evaluatorId: 101, finalScore: 8.0, scoreLocked: true, isEffective: true },
                { id: 2, evaluatorId: 102, finalScore: 8.0, scoreLocked: true, isEffective: true },
                { id: 3, evaluatorId: 103, finalScore: 8.0, scoreLocked: true, isEffective: true },
            ],
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(registration);
        prisma.resultPublicationItem.findFirst.mockResolvedValue(publishedItem);

        // Action 1: returnScoreBookBeforePublication
        await expect(returnScoreBookBeforePublication({
            registrationId: publishedRegistrationId,
            adminId: 1,
            reason: 'Thu hoi de sua diem',
            reopenMemberScoreIds: [1],
            idempotencyKey: 'return-post-pub-1',
        }, { db: prisma })).rejects.toMatchObject({
            code: 'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
            status: 409,
        });

        // Action 2: saveMemberScoreSheet
        await expect(saveMemberScoreSheet({
            registrationId: publishedRegistrationId,
            evaluatorId: 101,
            actorId: 101,
            criterionScores: [{ criterionCode: 'C1', score: 9 }],
        }, { db: prisma })).rejects.toMatchObject({
            code: 'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
            status: 409,
        });

        // Action 3: lockMemberScoreSheet
        await expect(lockMemberScoreSheet({
            registrationId: publishedRegistrationId,
            evaluatorId: 101,
            actorId: 101,
            idempotencyKey: 'lock-member-post-pub-1',
        }, { db: prisma })).rejects.toMatchObject({
            code: 'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
            status: 409,
        });

        // Action 4: lockDefenseScoreBookByChairman
        await expect(lockDefenseScoreBookByChairman({
            registrationId: publishedRegistrationId,
            actorId: 101,
            idempotencyKey: 'lock-chair-post-pub-1',
        }, { db: prisma })).rejects.toMatchObject({
            code: 'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
            status: 409,
        });

        // Action 5: lockDefenseScores (admin score lock)
        await expect(lockDefenseScores({
            registrationId: publishedRegistrationId,
            action: 'UNLOCK',
            actorId: 1,
            actorRole: 'ADMIN',
            actorPermissions: ['RESULT_LOCK'],
        }, { db: prisma })).rejects.toMatchObject({
            code: 'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
            status: 409,
        });

        // Action 6: approveDefenseResult (initial)
        await expect(approveDefenseResult({
            registrationId: publishedRegistrationId,
            actorId: 1,
            idempotencyKey: 'approve-post-pub-1',
        }, { db: prisma })).rejects.toMatchObject({
            code: 'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
            status: 409,
        });

        // Action 7: approveDefenseResult with correction: true
        await expect(approveDefenseResult({
            registrationId: publishedRegistrationId,
            actorId: 1,
            correction: true,
            reason: 'Sua sau cong bo',
            idempotencyKey: 'corr-approve-post-pub-1',
        }, { db: prisma })).rejects.toMatchObject({
            code: 'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
            status: 409,
        });

        // API verification: POST /api/evaluations/admin-defense-center/:id/approve-result
        const resApiApprove = await request(app)
            .post(`/api/evaluations/admin-defense-center/${publishedRegistrationId}/approve-result`)
            .set('Authorization', 'Bearer admin-token')
            .send({ reason: 'Sua diem' });

        expect(resApiApprove.status).toBe(409);
        expect(resApiApprove.body.code).toBe('RESULT_ALREADY_PUBLISHED_IMMUTABLE');

        // API verification: POST /api/evaluations/:registrationId/return-scorebook
        const resApiReturn = await request(app)
            .post(`/api/evaluations/${publishedRegistrationId}/return-scorebook`)
            .set('Authorization', 'Bearer admin-token')
            .send({ reason: 'Tra so diem', reopenMemberScoreIds: [1] });

        expect(resApiReturn.status).toBe(409);
        expect(resApiReturn.body.code).toBe('RESULT_ALREADY_PUBLISHED_IMMUTABLE');
    });
});
