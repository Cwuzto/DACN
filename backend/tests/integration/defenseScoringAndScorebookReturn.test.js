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
    defenseScoreBookReturnLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
    },
    resultPublicationItem: {
        findFirst: jest.fn().mockResolvedValue(null),
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
const defenseScoringService = require('../../src/services/defenseScoringService');

const adminPerms = [{
    permissionGroup: {
        code: 'ADMIN_GROUP',
        permissions: [
            { permission: { code: 'DEFENSE_SCORE_VIEW' } },
            { permission: { code: 'RESULT_LOCK' } },
            { permission: { code: 'DEFENSE_SCOREBOOK_RETURN' } },
            { permission: { code: 'VIEW_RESULT_LOCKS' } },
            { permission: { code: 'VIEW_DEFENSE_LOCK_LEDGER' } },
            { permission: { code: 'VIEW_DEFENSE_GRADING' } },
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

const lecturerPerms = [{
    permissionGroup: {
        code: 'LECTURER_GROUP',
        permissions: [
            { permission: { code: 'DEFENSE_SCORE_SUBMIT' } },
            { permission: { code: 'DEFENSE_SCORE_VIEW' } },
            { permission: { code: 'VIEW_DEFENSE_GRADING' } },
        ],
    },
}];

describe('Task 4: 3-or-4-Member Rubric Scoring, Chairman ABSENT Minutes, Chairman Scorebook Lock & Pre-Publication Return', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
        prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
        prisma.defenseScoreBookReturnLog.create.mockResolvedValue({ id: 1 });

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'chairman-token') return { userId: 101, role: 'LECTURER' };
            if (token === 'secretary-token') return { userId: 102, role: 'LECTURER' };
            if (token === 'reviewer-token') return { userId: 103, role: 'LECTURER' };
            if (token === 'member4-token') return { userId: 104, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: 999, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) {
                return { id: 1, fullName: 'Admin User', role: 'ADMIN', isActive: true, permissionGroups: adminPerms };
            }
            if (where.id === 101) {
                return { id: 101, fullName: 'Chairman Lecturer', role: 'LECTURER', isActive: true, permissionGroups: chairmanPerms };
            }
            if (where.id === 102) {
                return { id: 102, fullName: 'Secretary Lecturer', role: 'LECTURER', isActive: true, permissionGroups: lecturerPerms };
            }
            if (where.id === 103) {
                return { id: 103, fullName: 'Reviewer Lecturer', role: 'LECTURER', isActive: true, permissionGroups: lecturerPerms };
            }
            if (where.id === 104) {
                return { id: 104, fullName: 'Member4 Lecturer', role: 'LECTURER', isActive: true, permissionGroups: lecturerPerms };
            }
            if (where.id === 999) {
                return { id: 999, fullName: 'Other Lecturer', role: 'LECTURER', isActive: true, permissionGroups: lecturerPerms };
            }
            return null;
        });
    });

    test('1. 3-member council divides by 3; 4-member council (allowFourthScoringMember = true) divides by 4; superseded sheets (isEffective = false) are excluded from average', async () => {
        // Case A: 3-member council
        const council3 = {
            id: 10,
            allowFourthScoringMember: false,
            members: [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', isScoringMember: true, isActive: true },
                { lecturerId: 102, roleInCouncil: 'SECRETARY', isScoringMember: true, isActive: true },
                { lecturerId: 103, roleInCouncil: 'REVIEWER', isScoringMember: true, isActive: true },
            ],
        };

        const registrationCaseA = {
            id: 1,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            topic: { mentorId: 50 },
            defenseCouncil: council3,
            defenseResult: null,
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(registrationCaseA);
        prisma.defenseMemberScore.findUnique.mockResolvedValue(null);
        prisma.defenseMemberScore.create.mockImplementation(async ({ data }) => ({
            id: 201,
            ...data,
        }));
        prisma.defenseMemberScore.findMany.mockResolvedValue([
            { id: 201, evaluatorId: 101, finalScore: 8.5, isEffective: true },
            { id: 202, evaluatorId: 102, finalScore: 9.0, isEffective: true },
            { id: 203, evaluatorId: 103, finalScore: 7.5, isEffective: true },
            // Superseded sheet from replaced reviewer should be excluded
            { id: 199, evaluatorId: 105, finalScore: 2.0, isEffective: false, supersededReason: 'REPLACED' },
        ]);
        prisma.defenseResult.upsert.mockImplementation(async ({ update, create }) => ({
            id: 301,
            ...(update || create),
        }));

        const resultCaseA = await defenseScoringService.saveMemberScoreSheet({
            registrationId: 1,
            evaluatorId: 101,
            scores: [{ criterionCode: 'C1', score: 8.5 }],
        });

        // 3 active scorers: (8.5 + 9.0 + 7.5) / 3 = 25.0 / 3 = 8.3333333...
        // superseded sheet (2.0) excluded
        expect(prisma.defenseResult.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    rawAverageScore: expect.closeTo(8.333, 2),
                    roundedFinalScore: 8.3,
                    activeScorerCount: 3,
                }),
            })
        );

        // Case B: 4-member council with allowFourthScoringMember = true
        const council4 = {
            id: 20,
            allowFourthScoringMember: true,
            members: [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', isScoringMember: true, isActive: true },
                { lecturerId: 102, roleInCouncil: 'SECRETARY', isScoringMember: true, isActive: true },
                { lecturerId: 103, roleInCouncil: 'REVIEWER', isScoringMember: true, isActive: true },
                { lecturerId: 104, roleInCouncil: 'MEMBER', isScoringMember: true, isActive: true },
            ],
        };

        const registrationCaseB = {
            id: 2,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            topic: { mentorId: 50 },
            defenseCouncil: council4,
            defenseResult: null,
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(registrationCaseB);
        prisma.defenseMemberScore.findMany.mockResolvedValue([
            { id: 201, evaluatorId: 101, finalScore: 8.0, isEffective: true },
            { id: 202, evaluatorId: 102, finalScore: 9.0, isEffective: true },
            { id: 203, evaluatorId: 103, finalScore: 8.0, isEffective: true },
            { id: 204, evaluatorId: 104, finalScore: 9.0, isEffective: true },
        ]);

        await defenseScoringService.saveMemberScoreSheet({
            registrationId: 2,
            evaluatorId: 104,
            scores: [{ criterionCode: 'C1', score: 9.0 }],
        });

        // 4 active scorers: (8.0 + 9.0 + 8.0 + 9.0) / 4 = 34.0 / 4 = 8.5
        expect(prisma.defenseResult.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    rawAverageScore: 8.5,
                    roundedFinalScore: 8.5,
                    activeScorerCount: 4,
                }),
            })
        );
    });

    test('2. Stores both rawAverageScore (unrounded) and roundedFinalScore (rounded 1 decimal place) for PRESENT students', async () => {
        const council = {
            id: 10,
            allowFourthScoringMember: false,
            members: [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', isScoringMember: true, isActive: true },
                { lecturerId: 102, roleInCouncil: 'SECRETARY', isScoringMember: true, isActive: true },
                { lecturerId: 103, roleInCouncil: 'REVIEWER', isScoringMember: true, isActive: true },
            ],
        };

        const registration = {
            id: 3,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            topic: { mentorId: 50 },
            defenseCouncil: council,
            defenseResult: { attendanceStatus: 'PRESENT' },
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(registration);
        prisma.defenseMemberScore.findUnique.mockResolvedValue(null);
        prisma.defenseMemberScore.create.mockImplementation(async ({ data }) => ({ id: 301, ...data }));

        // Raw sum = 4.9 + 5.0 + 4.95 = 14.85 -> rawAverage = 4.95 -> roundedFinalScore = 5.0
        prisma.defenseMemberScore.findMany.mockResolvedValue([
            { id: 301, evaluatorId: 101, finalScore: 4.9, isEffective: true },
            { id: 302, evaluatorId: 102, finalScore: 5.0, isEffective: true },
            { id: 303, evaluatorId: 103, finalScore: 4.95, isEffective: true },
        ]);

        await defenseScoringService.saveMemberScoreSheet({
            registrationId: 3,
            evaluatorId: 101,
            scores: [{ criterionCode: 'C1', score: 4.9 }],
        });

        expect(prisma.defenseResult.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    rawAverageScore: expect.closeTo(4.95, 2),
                    roundedFinalScore: 5.0,
                    finalScore: 5.0,
                }),
            })
        );
    });

    test('3. Separated PRESENT vs ABSENT branches on Chairman scorebook lock: PRESENT requires 100% locked sheets; ABSENT records minutes, nulls scores and cleanly locks without sheets', async () => {
        const council = {
            id: 10,
            allowFourthScoringMember: false,
            members: [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', isScoringMember: true, isActive: true },
                { lecturerId: 102, roleInCouncil: 'SECRETARY', isScoringMember: true, isActive: true },
                { lecturerId: 103, roleInCouncil: 'REVIEWER', isScoringMember: true, isActive: true },
            ],
        };

        // Branch A: PRESENT student with incomplete sheets -> 409 INCOMPLETE_MEMBER_SCORES
        const regPresentIncomplete = {
            id: 10,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            topic: { mentorId: 50 },
            defenseCouncil: council,
            defenseResult: { attendanceStatus: 'PRESENT', scoreLocked: false },
            memberScores: [
                { id: 1, evaluatorId: 101, finalScore: 8.0, scoreLocked: true, isEffective: true },
                { id: 2, evaluatorId: 102, finalScore: 8.5, scoreLocked: false, isEffective: true }, // Not locked!
                { id: 3, evaluatorId: 103, finalScore: 9.0, scoreLocked: true, isEffective: true },
            ],
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(regPresentIncomplete);

        const resIncomplete = await request(app)
            .post('/api/evaluations/10/lock-scorebook')
            .set('Authorization', 'Bearer chairman-token')
            .send({});

        expect(resIncomplete.status).toBe(409);
        expect(resIncomplete.body.code).toBe('INCOMPLETE_MEMBER_SCORES');

        // Branch B: Mark ABSENT by Chairman API (POST /api/evaluations/:registrationId/mark-absent)
        // Sub-case B1: Non-chairman lecturer cannot mark absent -> 403
        const regAbsentTarget = {
            id: 11,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            topic: { mentorId: 50 },
            defenseCouncil: council,
            defenseResult: { attendanceStatus: 'PRESENT', scoreLocked: false },
            memberScores: [
                { id: 10, evaluatorId: 102, finalScore: 7.0, isEffective: true, scoreLocked: false },
            ],
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(regAbsentTarget);

        const resForbiddenMark = await request(app)
            .post('/api/evaluations/11/mark-absent')
            .set('Authorization', 'Bearer secretary-token') // 102 is secretary, not chairman
            .send({ absentMinutesText: 'Sinh viên không đến dự thi' });

        expect(resForbiddenMark.status).toBe(403);
        expect(resForbiddenMark.body.code).toBe('ONLY_CHAIRMAN_CAN_MARK_ABSENT');

        // Sub-case B2: Chairman marks absent successfully: marks draft sheets ineffective, sets absent fields, scores null
        prisma.defenseResult.upsert.mockResolvedValue({
            id: 501,
            registrationId: 11,
            attendanceStatus: 'ABSENT',
            absentMinutesText: 'Sinh viên không đến dự thi không có lý do',
            absentConfirmedByChairId: 101,
            rawAverageScore: null,
            roundedFinalScore: null,
            finalScore: null,
        });

        const resMarkSuccess = await request(app)
            .post('/api/evaluations/11/mark-absent')
            .set('Authorization', 'Bearer chairman-token')
            .send({ absentMinutesText: 'Sinh viên không đến dự thi không có lý do' });

        expect(resMarkSuccess.status).toBe(200);
        expect(resMarkSuccess.body.success).toBe(true);
        expect(prisma.defenseMemberScore.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { registrationId: 11 },
                data: expect.objectContaining({
                    isEffective: false,
                    supersededReason: 'STUDENT_ABSENT',
                }),
            })
        );
        expect(prisma.defenseResult.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    attendanceStatus: 'ABSENT',
                    absentMinutesText: 'Sinh viên không đến dự thi không có lý do',
                    absentConfirmedByChairId: 101,
                    rawAverageScore: null,
                    roundedFinalScore: null,
                    finalScore: null,
                }),
            })
        );

        // Sub-case B3: Chairman locks scorebook for ABSENT student:
        // Does NOT require 3-4 member score sheets, does not create fake 0 scores, cleanly transitions to AWAITING_FINAL_APPROVAL
        const regAbsentReadyToLock = {
            id: 11,
            status: 'DEFENSE_READY',
            stateVersion: 1,
            topic: { mentorId: 50 },
            defenseCouncil: council,
            defenseResult: {
                attendanceStatus: 'ABSENT',
                absentMinutesText: 'Sinh viên không đến dự thi không có lý do',
                absentConfirmedByChairId: 101,
                absentConfirmedAt: new Date('2026-11-12T08:30:00Z'),
                scoreLocked: false,
                rawAverageScore: null,
                roundedFinalScore: null,
            },
            memberScores: [], // Zero member sheets!
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(regAbsentReadyToLock);
        prisma.topicRegistration.update.mockResolvedValue({
            ...regAbsentReadyToLock,
            status: 'AWAITING_FINAL_APPROVAL',
            stateVersion: 2,
        });
        prisma.defenseResult.upsert.mockResolvedValue({
            id: 501,
            registrationId: 11,
            scoreLocked: true,
            lockedBy: 101,
            rawAverageScore: null,
            roundedFinalScore: null,
            finalScore: null,
        });

        const resLockAbsent = await request(app)
            .post('/api/evaluations/11/lock-scorebook')
            .set('Authorization', 'Bearer chairman-token')
            .send({});

        expect(resLockAbsent.status).toBe(200);
        expect(resLockAbsent.body.success).toBe(true);
        expect(prisma.defenseResult.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    scoreLocked: true,
                    rawAverageScore: null,
                    roundedFinalScore: null,
                    finalScore: null,
                }),
            })
        );
    });

    test('4. Admin pre-publication returnScoreBookBeforePublication reopens selected sheets with versionNumber + 1, preserves snapshot in DefenseScoreBookReturnLog; rejects if published', async () => {
        const council = {
            id: 10,
            members: [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', isScoringMember: true, isActive: true },
                { lecturerId: 102, roleInCouncil: 'SECRETARY', isScoringMember: true, isActive: true },
                { lecturerId: 103, roleInCouncil: 'REVIEWER', isScoringMember: true, isActive: true },
            ],
        };

        const lockedReg = {
            id: 25,
            status: 'AWAITING_FINAL_APPROVAL',
            stateVersion: 2,
            topic: { mentorId: 50 },
            defenseCouncil: council,
            defenseResult: {
                id: 601,
                registrationId: 25,
                scoreLocked: true,
                lockedAt: new Date('2026-11-12T10:00:00Z'),
                lockedBy: 101,
                ledgerVersion: 1,
                rawAverageScore: 8.5,
                roundedFinalScore: 8.5,
                finalScore: 8.5,
            },
            memberScores: [
                { id: 701, evaluatorId: 101, finalScore: 8.5, scoreLocked: true, versionNumber: 1, isEffective: true },
                { id: 702, evaluatorId: 102, finalScore: 8.5, scoreLocked: true, versionNumber: 1, isEffective: true },
                { id: 703, evaluatorId: 103, finalScore: 8.5, scoreLocked: true, versionNumber: 1, isEffective: true },
            ],
        };

        // Case A: Result is already published -> 409 RESULT_ALREADY_PUBLISHED_IMMUTABLE
        prisma.topicRegistration.findUnique.mockResolvedValue(lockedReg);
        prisma.resultPublicationItem.findFirst.mockResolvedValue({ id: 99, registrationId: 25 });

        const resPublished = await request(app)
            .post('/api/evaluations/25/return-scorebook')
            .set('Authorization', 'Bearer admin-token')
            .send({
                reason: 'Sửa điểm tiêu chí 2',
                reopenMemberScoreIds: [702],
            });

        expect(resPublished.status).toBe(409);
        expect(resPublished.body.code).toBe('RESULT_ALREADY_PUBLISHED_IMMUTABLE');

        // Case B: Not published -> succeeds, reopens ONLY 702 (versionNumber + 1), creates DefenseScoreBookReturnLog
        prisma.resultPublicationItem.findFirst.mockResolvedValue(null);
        prisma.defenseResult.update.mockResolvedValue({
            ...lockedReg.defenseResult,
            scoreLocked: false,
            ledgerVersion: 2,
        });
        prisma.topicRegistration.update.mockResolvedValue({
            ...lockedReg,
            status: 'AWAITING_SCORES',
            stateVersion: 3,
        });

        const resReturnSuccess = await request(app)
            .post('/api/evaluations/25/return-scorebook')
            .set('Authorization', 'Bearer admin-token')
            .send({
                reason: 'Giám khảo 102 xin chấm lại vì nhầm barem phần mềm',
                reopenMemberScoreIds: [702],
            });

        expect(resReturnSuccess.status).toBe(200);
        expect(resReturnSuccess.body.success).toBe(true);

        // Reopens 702 with versionNumber: 2
        expect(prisma.defenseMemberScore.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 702 },
                data: expect.objectContaining({
                    scoreLocked: false,
                    versionNumber: 2,
                    reopenReason: 'Giám khảo 102 xin chấm lại vì nhầm barem phần mềm',
                    reopenedById: 1,
                }),
            })
        );
        // Did NOT reopen 701 or 703
        expect(prisma.defenseMemberScore.update).not.toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 701 } })
        );
        expect(prisma.defenseMemberScore.update).not.toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 703 } })
        );

        // Created DefenseScoreBookReturnLog with previousStateSnapshot
        expect(prisma.defenseScoreBookReturnLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    councilId: 10,
                    registrationId: 25,
                    fromLedgerVersion: 1,
                    toLedgerVersion: 2,
                    returnedByAdminId: 1,
                    reason: 'Giám khảo 102 xin chấm lại vì nhầm barem phần mềm',
                    reopenedMemberScoreIds: [702],
                    previousStateSnapshot: expect.objectContaining({
                        defenseResult: expect.objectContaining({ ledgerVersion: 1, scoreLocked: true }),
                    }),
                }),
            })
        );
    });

    test('5. getGradingStudents and getAdminDefenseCenter return registrations across all defense and archival statuses', async () => {
        prisma.semester.findFirst.mockResolvedValue({ id: 1, name: 'HK1 2026-2027' });
        prisma.topicRegistration.findMany.mockResolvedValue([
            {
                id: 1,
                status: 'DEFENSE_READY',
                student: { id: 1, fullName: 'Sinh Vien A', code: 'SV01' },
                topic: { id: 1, title: 'De tai 1', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: null,
            },
            {
                id: 2,
                status: 'AWAITING_SCORES',
                student: { id: 2, fullName: 'Sinh Vien B', code: 'SV02' },
                topic: { id: 2, title: 'De tai 2', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: null,
            },
            {
                id: 3,
                status: 'AWAITING_FINAL_APPROVAL',
                student: { id: 3, fullName: 'Sinh Vien C', code: 'SV03' },
                topic: { id: 3, title: 'De tai 3', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: { scoreLocked: true, finalScore: 8.5 },
            },
            {
                id: 4,
                status: 'DEFENSE_PASSED',
                student: { id: 4, fullName: 'Sinh Vien D', code: 'SV04' },
                topic: { id: 4, title: 'De tai 4', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: { scoreLocked: true, finalScore: 9.0 },
            },
            {
                id: 5,
                status: 'DEFENSE_FAILED',
                student: { id: 5, fullName: 'Sinh Vien E', code: 'SV05' },
                topic: { id: 5, title: 'De tai 5', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: { scoreLocked: true, finalScore: 4.0 },
            },
            {
                id: 6,
                status: 'PENDING_INSTITUTE_SIGNATURE',
                student: { id: 6, fullName: 'Sinh Vien F', code: 'SV06' },
                topic: { id: 6, title: 'De tai 6', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: { scoreLocked: true, finalScore: 8.0 },
            },
            {
                id: 7,
                status: 'ARCHIVE_INCOMPLETE',
                student: { id: 7, fullName: 'Sinh Vien G', code: 'SV07' },
                topic: { id: 7, title: 'De tai 7', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: { scoreLocked: true, finalScore: 7.5 },
            },
            {
                id: 8,
                status: 'ARCHIVE_REJECTED',
                student: { id: 8, fullName: 'Sinh Vien H', code: 'SV08' },
                topic: { id: 8, title: 'De tai 8', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: { scoreLocked: true, finalScore: 8.0 },
            },
            {
                id: 9,
                status: 'COMPLETED',
                student: { id: 9, fullName: 'Sinh Vien I', code: 'SV09' },
                topic: { id: 9, title: 'De tai 9', mentor: { id: 50, fullName: 'GVHD 1' } },
                defenseCouncil: { id: 10, members: [] },
                defenseResult: { scoreLocked: true, finalScore: 8.5 },
            },
        ]);

        // Check getGradingStudents
        const resGrading = await request(app)
            .get('/api/evaluations/grading-students')
            .set('Authorization', 'Bearer admin-token');

        expect(resGrading.status).toBe(200);
        expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: expect.objectContaining({
                        in: expect.arrayContaining([
                            'DEFENSE_READY',
                            'ELIGIBLE_BY_INSTITUTE',
                            'AWAITING_SCORES',
                            'AWAITING_FINAL_APPROVAL',
                            'DEFENSE_PASSED',
                            'DEFENSE_FAILED',
                            'PENDING_INSTITUTE_SIGNATURE',
                            'ARCHIVE_INCOMPLETE',
                            'ARCHIVE_REJECTED',
                            'COMPLETED',
                        ]),
                    }),
                }),
            })
        );

        // Check getAdminDefenseCenter
        const resAdminCenter = await request(app)
            .get('/api/evaluations/admin-defense-center')
            .set('Authorization', 'Bearer admin-token');

        expect(resAdminCenter.status).toBe(200);
        expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: expect.objectContaining({
                        in: expect.arrayContaining([
                            'DEFENSE_READY',
                            'ELIGIBLE_BY_INSTITUTE',
                            'AWAITING_SCORES',
                            'AWAITING_FINAL_APPROVAL',
                            'DEFENSE_PASSED',
                            'DEFENSE_FAILED',
                            'PENDING_INSTITUTE_SIGNATURE',
                            'ARCHIVE_INCOMPLETE',
                            'ARCHIVE_REJECTED',
                            'COMPLETED',
                        ]),
                    }),
                }),
            })
        );
    });
});
