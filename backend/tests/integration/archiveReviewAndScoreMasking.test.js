const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    projectArchive: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn(), count: jest.fn() },
    resultPublicationItem: { findFirst: jest.fn(), findMany: jest.fn() },
    resultPublication: { findFirst: jest.fn(), findUnique: jest.fn() },
    defenseMemberScore: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    defenseResult: { findUnique: jest.fn(), upsert: jest.fn() },
    defenseRubricScore: { deleteMany: jest.fn(), createMany: jest.fn() },
    defenseMemberCriterionScore: { deleteMany: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    rubricVersion: { findFirst: jest.fn() },
    notification: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: jest.fn() },
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
const { safeNotify } = require('../../src/services/notificationService');

const permissionGroups = (...codes) => [{
    permissionGroup: {
        code: 'TEST_GROUP',
        permissions: codes.map((code) => ({ permission: { code } })),
    },
}];

describe('Archive Review & Full Student Score Masking (C02/C04/SEC-12)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) {
                return {
                    id: 10,
                    fullName: 'Sinh Vien A',
                    code: 'SV001',
                    role: 'STUDENT',
                    isActive: true,
                    department: 'CNTT',
                };
            }
            if (where.id === 20) {
                return {
                    id: 20,
                    fullName: 'GVHD / Hoi Dong B',
                    code: 'GV001',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: permissionGroups('FINAL_DOCUMENT_REVIEW', 'DEFENSE_SCORE_SUBMIT', 'DEFENSE_SCORE_VIEW'),
                };
            }
            if (where.id === 1) {
                return {
                    id: 1,
                    fullName: 'Quan Tri Vien',
                    code: 'AD001',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: permissionGroups('FINAL_DOCUMENT_REVIEW', 'PROJECT_ASSIGNMENT_PUBLISH'),
                };
            }
            return null;
        });
    });

    describe('1. Block DEFENSE_FAILED Archive Review to COMPLETED (C02)', () => {
        it('should reject archive review with 403 when registration status is DEFENSE_FAILED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_FAILED',
                topic: { mentorId: 20, title: 'De tai IoT' },
                archive: { id: 5, status: 'SUBMITTED' },
                defenseResult: { finalScore: 3.5 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ decision: 'APPROVED', reviewerNotes: 'Duyệt hoàn thành' });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('CANNOT_COMPLETE_FAILED_DEFENSE');
            expect(res.body.message).toContain('Chỉ hồ sơ bảo vệ thành công (DEFENSE_PASSED) mới được nghiệm thu');
            expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
        });

        it('should allow archive review with 200 when registration status is DEFENSE_PASSED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 20, title: 'De tai IoT' },
                archive: { id: 5, status: 'SUBMITTED' },
                defenseResult: { finalScore: 8.5 },
            });

            prisma.projectArchive.update.mockResolvedValue({
                id: 5,
                status: 'APPROVED',
                reviewedBy: 20,
            });

            prisma.topicRegistration.update.mockResolvedValue({
                id: 101,
                status: 'COMPLETED',
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ decision: 'APPROVED', reviewerNotes: 'Đạt chuẩn' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(prisma.topicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 101 },
                data: expect.objectContaining({ status: 'COMPLETED' }),
            }));
        });
    });

    describe('2. Mask Defense Scores in getMyGrades Before Official Publication (C04, SEC-12)', () => {
        it('should return null defenseResult in getMyGrades if ResultPublicationItem does not belong to active ResultPublication', async () => {
            // Case A: DefenseResult exists, but NO publication item
            prisma.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 101,
                    studentId: 10,
                    semesterId: 1,
                    status: 'DEFENSE_PASSED',
                    topic: { title: 'AI Assistant', mentor: { fullName: 'GVHD 1' } },
                    defenseResult: { id: 1, finalScore: 9.0, isPassed: true },
                    memberScores: [
                        { evaluatorId: 20, finalScore: 9.0, scoreLocked: true, comments: 'Good' },
                    ],
                    resultPublicationItems: [],
                },
            ]);
            prisma.resultPublicationItem.findFirst.mockResolvedValue(null);

            const resUnpublished = await request(app)
                .get('/api/evaluations/my-grades')
                .set('Authorization', 'Bearer student-token');

            expect(resUnpublished.status).toBe(200);
            expect(resUnpublished.body.success).toBe(true);
            expect(resUnpublished.body.data).toHaveLength(1);
            expect(resUnpublished.body.data[0].defenseResult).toBeNull();
            expect(resUnpublished.body.data[0].memberScores).toEqual([]);
            expect(resUnpublished.body.data[0].isPublished).toBe(false);

            // Case B: Publication item exists, but publication type is invalid / inactive
            prisma.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 101,
                    studentId: 10,
                    semesterId: 1,
                    status: 'DEFENSE_PASSED',
                    topic: { title: 'AI Assistant', mentor: { fullName: 'GVHD 1' } },
                    defenseResult: { id: 1, finalScore: 9.0, isPassed: true },
                    memberScores: [
                        { evaluatorId: 20, finalScore: 9.0, scoreLocked: true, comments: 'Good' },
                    ],
                    resultPublicationItems: [
                        {
                            id: 99,
                            publication: { id: 50, semesterId: 1, type: 'DRAFT_INACTIVE' },
                        },
                    ],
                },
            ]);
            prisma.resultPublicationItem.findFirst.mockResolvedValue({
                id: 99,
                publication: { id: 50, semesterId: 1, type: 'DRAFT_INACTIVE' },
            });

            const resDraft = await request(app)
                .get('/api/evaluations/my-grades')
                .set('Authorization', 'Bearer student-token');

            expect(resDraft.status).toBe(200);
            expect(resDraft.body.data[0].defenseResult).toBeNull();
            expect(resDraft.body.data[0].memberScores).toEqual([]);
            expect(resDraft.body.data[0].isPublished).toBe(false);

            // Case C: Valid publication item belonging to active ResultPublication (type = INITIAL)
            prisma.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 101,
                    studentId: 10,
                    semesterId: 1,
                    status: 'DEFENSE_PASSED',
                    topic: { title: 'AI Assistant', mentor: { fullName: 'GVHD 1' } },
                    defenseResult: { id: 1, finalScore: 9.0, isPassed: true },
                    memberScores: [
                        { evaluatorId: 20, finalScore: 9.0, scoreLocked: true, comments: 'Good' },
                    ],
                    resultPublicationItems: [
                        {
                            id: 1,
                            publication: { id: 10, semesterId: 1, type: 'INITIAL', publishedAt: new Date() },
                        },
                    ],
                },
            ]);
            prisma.resultPublicationItem.findFirst.mockResolvedValue({
                id: 1,
                publication: { id: 10, semesterId: 1, type: 'INITIAL', publishedAt: new Date() },
            });

            const resPublished = await request(app)
                .get('/api/evaluations/my-grades')
                .set('Authorization', 'Bearer student-token');

            expect(resPublished.status).toBe(200);
            expect(resPublished.body.data[0].defenseResult).not.toBeNull();
            expect(resPublished.body.data[0].defenseResult.finalScore).toBe(9.0);
            expect(resPublished.body.data[0].memberScores).toHaveLength(1);
            expect(resPublished.body.data[0].isPublished).toBe(true);
        });
    });

    describe('3. Mask Defense Scores in GET /archives/registrations/:id (C04, SEC-12)', () => {
        it('should mask defense scores in GET /archives/registrations/:id when accessed by student before publication', async () => {
            const getRegMock = () => ({
                id: 101,
                studentId: 10,
                semesterId: 1,
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 20, title: 'AI Assistant', semester: { id: 1 } },
                defenseResult: { id: 1, finalScore: 9.5 },
                archive: { id: 1, status: 'SUBMITTED' },
                resultPublicationItems: [],
            });
            prisma.topicRegistration.findUnique.mockImplementation(async () => getRegMock());
            prisma.resultPublicationItem.findFirst.mockResolvedValue(null);

            const resStudent = await request(app)
                .get('/api/archives/registrations/101')
                .set('Authorization', 'Bearer student-token');

            expect(resStudent.status).toBe(200);
            expect(resStudent.body.success).toBe(true);
            expect(resStudent.body.data.registration.defenseResult).toBeNull();

            // Lecturer / Admin accesses the same archive -> defenseResult is preserved
            const resLecturer = await request(app)
                .get('/api/archives/registrations/101')
                .set('Authorization', 'Bearer lecturer-token');

            expect(resLecturer.status).toBe(200);
            expect(resLecturer.body.data.registration.defenseResult).not.toBeNull();
            expect(resLecturer.body.data.registration.defenseResult.finalScore).toBe(9.5);
        });
    });

    describe('4. Prevent Leaking Defense Scores in Notifications (SEC-12)', () => {
        it('should never include defense scores in notification content sent to student before official publication', async () => {
            // 4.1 Check safeNotify guard directly
            const studentPayload = {
                userId: 10, // student ID
                title: 'Diem bao ve da duoc cap nhat',
                content: 'Diem bao ve de tai "AI Assistant" da duoc cap nhat: 8.5.',
                type: 'DEFENSE',
            };

            const result = await safeNotify(studentPayload, 'saveScoreSheet');

            expect(result.ok).toBe(false);
            expect(result.skipped).toBe(true);
            expect(prisma.notification.create).not.toHaveBeenCalled();

            // 4.2 Check saveScoreSheet endpoint does not notify student with scores
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                topic: { title: 'AI Assistant', mentorId: 99 },
                defenseCouncil: {
                    members: [{ lecturerId: 20 }],
                },
            });

            prisma.defenseMemberScore.findUnique.mockResolvedValue(null);
            prisma.defenseMemberScore.create.mockResolvedValue({
                id: 301,
                registrationId: 101,
                evaluatorId: 20,
                finalScore: 8.5,
                scoreLocked: false,
            });
            prisma.defenseRubricScore.deleteMany.mockResolvedValue({});
            prisma.defenseRubricScore.createMany.mockResolvedValue({ count: 1 });
            prisma.defenseMemberScore.findMany.mockResolvedValue([
                { finalScore: 8.5, scoreLocked: false },
            ]);
            prisma.defenseResult.upsert.mockResolvedValue({ id: 401, finalScore: 8.5 });

            const validV1Scores = [
                { criterionCode: 'STRUCTURE', score: 0.5 },
                { criterionCode: 'CITATION_FORMAT', score: 0.25 },
                { criterionCode: 'LANGUAGE', score: 0.25 },
                { criterionCode: 'PROBLEM_STATEMENT', score: 1.0 },
                { criterionCode: 'RESEARCH_METHOD', score: 0.5 },
                { criterionCode: 'RESEARCH_CONTENT', score: 2.5 },
                { criterionCode: 'RESEARCH_RESULT', score: 1.0 },
                { criterionCode: 'NOVELTY', score: 0.25 },
                { criterionCode: 'APPLICABILITY', score: 0.5 },
                { criterionCode: 'PUBLICATION', score: 0.25 },
                { criterionCode: 'PRESENTATION_SKILL', score: 0.5 },
                { criterionCode: 'ATTITUDE', score: 0.5 },
                { criterionCode: 'PRESENTATION_CONTENT', score: 0.5 },
                { criterionCode: 'QA_RESPONSE', score: 0.5 },
            ];

            const resScore = await request(app)
                .put('/api/evaluations/101/score-sheet')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    scores: validV1Scores,
                    generalComment: 'Lam tot',
                });

            expect(resScore.status).toBe(200);

            // Verify no notification was sent to student containing score
            const createdNotifs = prisma.notification.create.mock.calls;
            const studentScoreNotifs = createdNotifs.filter(([call]) => {
                const data = call.data;
                return data?.userId === 10 && /(?:điểm|diem|8\.5)/i.test(`${data?.title} ${data?.content}`);
            });
            expect(studentScoreNotifs).toHaveLength(0);
        });
    });
});
