const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    rubricVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    rubricCategory: { deleteMany: jest.fn() },
    topicRegistration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    council: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    councilMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
    },
    defenseScheduleAdjustmentLog: { create: jest.fn() },
    defenseMemberScore: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    defenseResult: { count: jest.fn() },
    notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
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
const rubricService = require('../../src/services/rubricService');
const { splitConfirmedStudentsIntoShifts } = require('../../src/controllers/councilController');

const adminPerms = [{
    permissionGroup: {
        code: 'ADMIN_GROUP',
        permissions: [
            { permission: { code: 'RUBRIC_MANAGE' } },
            { permission: { code: 'VIEW_RUBRIC_CONFIG' } },
            { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
            { permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } },
        ],
    },
}];

describe('Task 2: Defense Rubric, 22-Student Shift Splitting, Schedule Adjustment & Member Replacement', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) {
                return {
                    id: 1,
                    fullName: 'Admin User',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: adminPerms,
                };
            }
            if (where.id === 2) {
                return {
                    id: 2,
                    fullName: 'Lecturer Chair',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 10) {
                return {
                    id: 10,
                    fullName: 'Student Nguyen',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });
    });

    test('1. Reference rubric has 4 groups, 14 items, totalMaxScore = 10.0 and persists CLO + 4 level descriptions', () => {
        const rubric = rubricService.DEFAULT_REFERENCE_RUBRIC_4_GROUPS_14_ITEMS;
        expect(rubric).toBeDefined();
        expect(rubric.categories.length).toBe(4);

        const group1 = rubric.categories.find((c) => c.code === 'CAT_REPORT_FORMAT' || c.name.includes('Hình thức'));
        const group2 = rubric.categories.find((c) => c.code === 'CAT_RESEARCH_CONTENT' || c.name.includes('Nội dung'));
        const group3 = rubric.categories.find((c) => c.code === 'CAT_APPLICATION_NOVELTY' || c.name.includes('ứng dụng'));
        const group4 = rubric.categories.find((c) => c.code === 'CAT_DEFENSE_QA' || c.name.includes('trình bày'));

        expect(group1).toBeDefined();
        expect(group1.maxScore).toBe(1.0);
        expect(group2).toBeDefined();
        expect(group2.maxScore).toBe(5.0);
        expect(group3).toBeDefined();
        expect(group3.maxScore).toBe(1.0);
        expect(group4).toBeDefined();
        expect(group4.maxScore).toBe(3.0);

        const totalCriteria = rubric.categories.reduce((sum, c) => sum + c.criteria.length, 0);
        expect(totalCriteria).toBe(14);

        let calculatedTotal = 0;
        for (const cat of rubric.categories) {
            for (const cri of cat.criteria) {
                calculatedTotal += cri.maxScore;
                expect(cri.cloCode).toBeTruthy();
                expect(cri.levelGoodDesc).toBeTruthy();
                expect(cri.levelFairDesc).toBeTruthy();
                expect(cri.levelAverageDesc).toBeTruthy();
                expect(cri.levelPoorDesc).toBeTruthy();
            }
        }
        expect(Math.round(calculatedTotal * 10) / 10).toBe(10.0);
    });

    test('2. Lock Rubric API (POST /api/rubrics/:id/lock) locks rubric with totalMaxScore 10.0 and updates semester', async () => {
        const dummyRubric = {
            id: 100,
            version: 'v1_standard_14',
            totalMaxScore: 10.0,
            status: 'DRAFT',
            categories: [
                {
                    code: 'CAT1',
                    name: 'Group 1',
                    maxScore: 10.0,
                    criteria: [{ code: 'C1', label: 'Item 1', maxScore: 10.0 }],
                },
            ],
        };

        prisma.rubricVersion.findUnique.mockResolvedValue(dummyRubric);
        prisma.rubricVersion.update.mockResolvedValue({
            ...dummyRubric,
            status: 'ACTIVE',
            lockedAt: new Date('2026-11-12T00:00:00Z'),
            lockedById: 1,
        });
        prisma.semester.findUnique.mockResolvedValue({ id: 1, name: 'HK1 2026-2027' });
        prisma.semester.update.mockResolvedValue({ id: 1, lockedDefenseRubricVersionId: 100 });

        const res = await request(app)
            .post('/api/rubrics/100/lock')
            .set('Authorization', 'Bearer admin-token')
            .send({ semesterId: 1 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(prisma.rubricVersion.update).toHaveBeenCalled();
        expect(prisma.semester.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ lockedDefenseRubricVersionId: 100 }),
            })
        );
    });

    test('3. Publish defense eligible list rejects with 409 RUBRIC_NOT_LOCKED if rubric not locked; succeeds when locked', async () => {
        // Case A: Rubric not locked -> 409
        prisma.semester.findUnique.mockResolvedValue({
            id: 1,
            lockedDefenseRubricVersionId: null,
            lockedDefenseRubricVersion: null,
        });

        const resFail = await request(app)
            .post('/api/councils/semesters/1/publish-eligible-defense-list')
            .set('Authorization', 'Bearer admin-token')
            .send({});

        expect(resFail.status).toBe(409);
        expect(resFail.body.code).toBe('RUBRIC_NOT_LOCKED');

        // Case B: Rubric locked -> success
        prisma.semester.findUnique.mockResolvedValue({
            id: 1,
            lockedDefenseRubricVersionId: 100,
            lockedDefenseRubricVersion: { id: 100, lockedAt: new Date(), totalMaxScore: 10.0 },
        });
        prisma.topicRegistration.findMany.mockResolvedValue([
            { id: 11, status: 'DEFENSE_READY', bm04Evaluation: { isLocked: true } },
            { id: 12, status: 'ELIGIBLE_BY_INSTITUTE', bm04Evaluation: { isLocked: true } },
        ]);
        prisma.semester.update.mockResolvedValue({
            id: 1,
            defenseEligibleListPublishedAt: new Date(),
            defenseEligibleListPublishedById: 1,
        });

        const resSuccess = await request(app)
            .post('/api/councils/semesters/1/publish-eligible-defense-list')
            .set('Authorization', 'Bearer admin-token')
            .send({});

        expect(resSuccess.status).toBe(200);
        expect(resSuccess.body.success).toBe(true);
        expect(resSuccess.body.data.eligibleCount).toBe(2);
    });

    test('4. Council assigns 22 students to DEFENSE_COUNCIL without 10-student limit error & supports 4th scoring member', async () => {
        const council = {
            id: 50,
            councilType: 'DEFENSE_COUNCIL',
            allowFourthScoringMember: true,
            members: [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', isScoringMember: true },
                { lecturerId: 102, roleInCouncil: 'SECRETARY', isScoringMember: true },
                { lecturerId: 103, roleInCouncil: 'REVIEWER', isScoringMember: true },
                { lecturerId: 104, roleInCouncil: 'MEMBER', isScoringMember: true },
            ],
            _count: { registrations: 0, defenseRegistrations: 0, outlineRegistrations: 0 },
        };

        const registrationIds = Array.from({ length: 22 }, (_, i) => i + 1);
        const registrations = registrationIds.map((id) => ({
            id,
            status: 'DEFENSE_READY',
            student: { fullName: `Sinh Vien ${id}`, code: `SV${id}` },
            topic: { title: `De Tai ${id}`, mentorId: 999 }, // mentor not in council
            bm04Evaluation: { isLocked: true, conclusion: 'AGREED_FOR_DEFENSE' },
        }));

        prisma.council.findUnique.mockResolvedValue(council);
        prisma.topicRegistration.findMany.mockResolvedValue(registrations);
        prisma.topicRegistration.updateMany.mockResolvedValue({ count: 22 });

        const res = await request(app)
            .post('/api/councils/50/assign')
            .set('Authorization', 'Bearer admin-token')
            .send({ registrationIds });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('5. Contiguous shift splitting: 22 students -> 11 morning, 11 afternoon (student 12 order 1); 23 students -> 12 morning, 11 afternoon', () => {
        const ids22 = Array.from({ length: 22 }, (_, i) => i + 1);
        const split22 = splitConfirmedStudentsIntoShifts(ids22);

        expect(split22.length).toBe(22);
        const morning22 = split22.filter((s) => s.defenseSessionShift === 'MORNING');
        const afternoon22 = split22.filter((s) => s.defenseSessionShift === 'AFTERNOON');

        expect(morning22.length).toBe(11);
        expect(afternoon22.length).toBe(11);
        expect(morning22[0].defenseOrderInShift).toBe(1);
        expect(morning22[10].defenseOrderInShift).toBe(11);
        // Student #12 in 22 students
        expect(split22[11].defenseSequenceNo).toBe(12);
        expect(split22[11].defenseSessionShift).toBe('AFTERNOON');
        expect(split22[11].defenseOrderInShift).toBe(1);

        // 23 students
        const ids23 = Array.from({ length: 23 }, (_, i) => i + 1);
        const split23 = splitConfirmedStudentsIntoShifts(ids23);
        const morning23 = split23.filter((s) => s.defenseSessionShift === 'MORNING');
        const afternoon23 = split23.filter((s) => s.defenseSessionShift === 'AFTERNOON');

        expect(morning23.length).toBe(12);
        expect(afternoon23.length).toBe(11);
    });

    test('6. Secondary guard & Schedule confirmation (POST /api/councils/:id/confirm-and-publish-schedule) checks rubric & publishes schedule', async () => {
        // Case A: Rejects with 409 if semester rubric is not locked
        prisma.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            semester: { lockedDefenseRubricVersionId: null },
            registrations: [{ id: 1 }, { id: 2 }],
        });

        const resFail = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [1, 2] });

        expect(resFail.status).toBe(409);
        expect(resFail.body.code).toBe('RUBRIC_NOT_LOCKED');

        // Case B: Success when locked and eligible list published
        prisma.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            semester: {
                lockedDefenseRubricVersionId: 100,
                defenseEligibleListPublishedAt: new Date(),
            },
            registrations: [{ id: 1 }, { id: 2 }],
        });
        prisma.topicRegistration.findMany.mockResolvedValue([
            { id: 1, studentId: 10 },
            { id: 2, studentId: 11 },
        ]);
        prisma.council.update.mockResolvedValue({
            id: 50,
            scheduleConfirmedAt: new Date(),
            schedulePublishedAt: new Date(),
        });

        const resSuccess = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [1, 2] });

        expect(resSuccess.status).toBe(200);
        expect(resSuccess.body.success).toBe(true);
    });

    test('7. Adjust defense schedule (PATCH /api/councils/:id/registrations/:registrationId/schedule) requires reason and logs adjustment', async () => {
        // Case A: Missing reason -> 400
        const resFail = await request(app)
            .patch('/api/councils/50/registrations/11/schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ newShift: 'AFTERNOON', newOrderInShift: 2, reason: '   ' });

        expect(resFail.status).toBe(400);

        // Case B: Valid adjustment -> saves DefenseScheduleAdjustmentLog
        prisma.council.findUnique.mockResolvedValue({ id: 50 });
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 11,
            councilId: 50,
            studentId: 10,
            defenseSessionShift: 'MORNING',
            defenseOrderInShift: 5,
        });
        prisma.topicRegistration.update.mockResolvedValue({
            id: 11,
            defenseSessionShift: 'AFTERNOON',
            defenseOrderInShift: 2,
        });

        const resSuccess = await request(app)
            .patch('/api/councils/50/registrations/11/schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ newShift: 'AFTERNOON', newOrderInShift: 2, reason: 'Sinh viên trùng lịch thi sáng' });

        expect(resSuccess.status).toBe(200);
        expect(resSuccess.body.success).toBe(true);
        expect(prisma.defenseScheduleAdjustmentLog.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    registrationId: 11,
                    councilId: 50,
                    oldShift: 'MORNING',
                    newShift: 'AFTERNOON',
                    oldOrderInShift: 5,
                    newOrderInShift: 2,
                    reason: 'Sinh viên trùng lịch thi sáng',
                }),
            })
        );
    });

    test('8. Replace defense council member requires override confirmation if sheet is locked; preserves old sheets as ineffective', async () => {
        const council = {
            id: 50,
            scoreBookLocked: false,
            members: [
                { id: 501, lecturerId: 101, roleInCouncil: 'REVIEWER', isActive: true },
            ],
            registrations: [
                { id: 11, topic: { mentorId: 999 } },
            ],
        };

        prisma.council.findUnique.mockResolvedValue(council);
        prisma.councilMember.findUnique.mockResolvedValue({
            id: 501,
            councilId: 50,
            lecturerId: 101,
            roleInCouncil: 'REVIEWER',
            isActive: true,
        });

        // Case A: Conflict of interest (new lecturer is mentor)
        prisma.topicRegistration.findMany.mockResolvedValue([
            { id: 11, topic: { mentorId: 202 } },
        ]);
        const resConflict = await request(app)
            .post('/api/councils/50/members/replace')
            .set('Authorization', 'Bearer admin-token')
            .send({
                oldMemberId: 501,
                newLecturerId: 202,
                reason: 'Thay reviewer bận',
            });

        expect(resConflict.status).toBe(400);
        expect(resConflict.body.message).toMatch(/Conflict of interest/i);

        // Case B: Old member locked sheet and confirmLockedSheetOverride is missing -> 409
        prisma.topicRegistration.findMany.mockResolvedValue([
            { id: 11, topic: { mentorId: 999 } },
        ]);
        prisma.defenseMemberScore.findMany.mockResolvedValue([
            { id: 901, evaluatorId: 101, scoreLocked: true, isEffective: true },
        ]);

        const resLockedRequireConfirm = await request(app)
            .post('/api/councils/50/members/replace')
            .set('Authorization', 'Bearer admin-token')
            .send({
                oldMemberId: 501,
                newLecturerId: 303,
                reason: 'Giảng viên công tác đột xuất',
            });

        expect(resLockedRequireConfirm.status).toBe(409);
        expect(resLockedRequireConfirm.body.code).toBe('LOCKED_SHEET_OVERRIDE_CONFIRMATION_REQUIRED');

        // Case C: confirmLockedSheetOverride = true -> succeeds, marks old scores isEffective = false, creates new member
        prisma.councilMember.create.mockResolvedValue({
            id: 502,
            councilId: 50,
            lecturerId: 303,
            roleInCouncil: 'REVIEWER',
            isScoringMember: true,
            isActive: true,
        });

        const resSuccess = await request(app)
            .post('/api/councils/50/members/replace')
            .set('Authorization', 'Bearer admin-token')
            .send({
                oldMemberId: 501,
                newLecturerId: 303,
                reason: 'Giảng viên công tác đột xuất',
                confirmLockedSheetOverride: true,
            });

        expect(resSuccess.status).toBe(200);
        expect(resSuccess.body.success).toBe(true);
        expect(prisma.defenseMemberScore.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ evaluatorId: 101 }),
                data: expect.objectContaining({
                    isEffective: false,
                    supersededReason: 'Giảng viên công tác đột xuất',
                }),
            })
        );
        expect(prisma.councilMember.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 501 },
                data: expect.objectContaining({
                    isActive: false,
                    replacementReason: 'Giảng viên công tác đột xuất',
                }),
            })
        );
    });
});
