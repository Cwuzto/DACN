const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    semester: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    topic: { count: jest.fn(), findFirst: jest.fn() },
    topicRegistration: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    council: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    submission: { count: jest.fn(), findMany: jest.fn() },
    task: { count: jest.fn(), findMany: jest.fn() },
    topicTitleAdjustment: { findMany: jest.fn() },
    defenseResult: { count: jest.fn(), findMany: jest.fn() },
    notification: { findMany: jest.fn() },
    academicDelegation: { findMany: jest.fn() },
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

describe('Task 1: REPORT_VIEW Scope, Route Guards & Mentor Isolation', () => {
    const activeSemester = {
        id: 1,
        code: 'HK1-2026',
        name: 'Học kỳ 1 2026',
        status: 'ONGOING',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        registrationDeadline: new Date('2026-09-15T00:00:00.000Z'),
        endDate: new Date('2027-01-15T00:00:00.000Z'),
        registrationOpen: true,
    };

    const adminNoReportUser = {
        id: 1,
        role: 'ADMIN',
        department: 'CNTT',
        email: 'admin-noreport@tdmu.edu.vn',
        fullName: 'Admin No Report',
        code: 'AD01',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [{
            permissionGroup: {
                code: 'TECH_ONLY',
                permissions: [{ permission: { code: 'USER_MANAGE' } }],
            },
        }],
        councilMembers: [],
    };

    const globalDirectorUser = {
        id: 401,
        role: 'LECTURER',
        department: 'CNTT',
        email: 'director@tdmu.edu.vn',
        fullName: 'Viện Trưởng Kiêm GVHD',
        code: 'VT401',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [{
            permissionGroup: {
                code: 'VIEN_TRUONG',
                permissions: [
                    { permission: { code: 'REPORT_VIEW' } },
                    { permission: { code: 'VIEW_MY_TOPICS' } },
                    { permission: { code: 'VIEW_MENTOR_STUDENTS' } },
                ],
            },
        }],
        councilMembers: [],
    };

    const deptScopedGroupUser = {
        id: 402,
        role: 'LECTURER',
        department: 'Kỹ thuật Phần mềm',
        email: 'dept-report@tdmu.edu.vn',
        fullName: 'Trưởng Bộ Môn KTPM',
        code: 'GV402',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [{
            permissionGroup: {
                code: 'DEPT_REPORT_CUSTOM',
                permissions: [{ permission: { code: 'REPORT_VIEW' } }],
            },
        }],
        councilMembers: [],
    };

    const missingScopeReportUser = {
        id: 403,
        role: 'LECTURER',
        department: null,
        email: 'noscope-report@tdmu.edu.vn',
        fullName: 'User Thiếu Scope',
        code: 'GV403',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [{
            permissionGroup: {
                code: 'DEPT_REPORT_CUSTOM',
                permissions: [{ permission: { code: 'REPORT_VIEW' } }],
            },
        }],
        councilMembers: [],
    };

    const delegatedReportUser = {
        id: 404,
        role: 'LECTURER',
        department: null,
        email: 'delegated-report@tdmu.edu.vn',
        fullName: 'GV Được Ủy Quyền Báo Cáo',
        code: 'GV404',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [{
            permissionGroup: {
                code: 'GVHD',
                permissions: [{ permission: { code: 'VIEW_MY_TOPICS' } }],
            },
        }],
        councilMembers: [],
    };

    const councilViewerOnlyUser = {
        id: 405,
        role: 'LECTURER',
        department: 'CNTT',
        email: 'council-viewer@tdmu.edu.vn',
        fullName: 'GV Xem Hội Đồng',
        code: 'GV405',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [{
            permissionGroup: {
                code: 'COUNCIL_VIEW_ONLY',
                permissions: [{ permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } }],
            },
        }],
        councilMembers: [],
    };

    const registrationsFixture = [
        {
            id: 101,
            semesterId: 1,
            status: 'COMPLETED',
            studentId: 1001,
            student: {
                id: 1001,
                fullName: 'SV KTPM 1',
                code: 'SV01',
                department: 'Kỹ thuật Phần mềm',
                studentProfile: { major: 'Kỹ thuật Phần mềm', className: 'D20KTPM01' },
            },
            topic: {
                id: 501,
                title: 'Đề tài KTPM',
                targetMajor: 'Kỹ thuật Phần mềm',
                mentorId: 401,
                mentor: { id: 401, fullName: 'Viện Trưởng Kiêm GVHD', email: 'director@tdmu.edu.vn', department: 'Kỹ thuật Phần mềm' },
            },
            bm04Evaluation: { conclusion: 'AGREED_FOR_DEFENSE' },
            defenseResult: { finalScore: 9.0 },
            resultPublicationItems: [{ publication: { id: 1, semesterId: 1, type: 'INITIAL' }, finalScoreSnapshot: 9.0 }],
        },
        {
            id: 102,
            semesterId: 1,
            status: 'IN_PROGRESS',
            studentId: 1002,
            student: {
                id: 1002,
                fullName: 'SV HTTT 1',
                code: 'SV02',
                department: 'Hệ thống Thông tin',
                studentProfile: { major: 'Hệ thống Thông tin', className: 'D20HTTT01' },
            },
            topic: {
                id: 502,
                title: 'Đề tài HTTT',
                targetMajor: 'Hệ thống Thông tin',
                mentorId: 202,
                mentor: { id: 202, fullName: 'GV Khác', email: 'gv202@tdmu.edu.vn', department: 'Hệ thống Thông tin' },
            },
            bm04Evaluation: null,
            defenseResult: null,
            resultPublicationItems: [],
        },
    ];

    const usersById = new Map([
        [adminNoReportUser.id, adminNoReportUser],
        [globalDirectorUser.id, globalDirectorUser],
        [deptScopedGroupUser.id, deptScopedGroupUser],
        [missingScopeReportUser.id, missingScopeReportUser],
        [delegatedReportUser.id, delegatedReportUser],
        [councilViewerOnlyUser.id, councilViewerOnlyUser],
    ]);

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            const id = Number(String(token).replace('token-', ''));
            const u = usersById.get(id);
            if (!u) throw new Error('Invalid token');
            return { userId: u.id, role: u.role, permissionVersion: 1 };
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => usersById.get(where?.id) || null);
        prisma.user.count.mockResolvedValue(10);
        prisma.semester.findFirst.mockResolvedValue(activeSemester);
        prisma.semester.findUnique.mockResolvedValue(activeSemester);
        prisma.semester.findMany.mockResolvedValue([activeSemester]);
        prisma.topic.count.mockResolvedValue(5);
        prisma.topicRegistration.findMany.mockResolvedValue(registrationsFixture);
        prisma.topicRegistration.findFirst.mockResolvedValue({ semesterId: 1 });
        prisma.topicRegistration.count.mockResolvedValue(2);
        prisma.defenseResult.count.mockResolvedValue(1);
        prisma.defenseResult.findMany.mockResolvedValue([{ finalScore: 8.5 }]);
        prisma.council.count.mockResolvedValue(1);
        prisma.council.findMany.mockResolvedValue([]);
        prisma.council.findUnique.mockResolvedValue({ id: 1, councilType: 'DEFENSE_COUNCIL', members: [] });
        prisma.submission.findMany.mockResolvedValue([]);
        prisma.submission.count.mockResolvedValue(0);
        prisma.task.findMany.mockResolvedValue([]);
        prisma.task.count.mockResolvedValue(0);
        prisma.topicTitleAdjustment.findMany.mockResolvedValue([]);
        prisma.notification.findMany.mockResolvedValue([
            { id: 1, createdAt: new Date(), type: 'APPROVAL', title: 'Test', content: 'Detail', user: { fullName: 'Admin' } },
        ]);
        prisma.academicDelegation.findMany.mockImplementation(async ({ where }) => {
            if (where?.delegateeId === delegatedReportUser.id) {
                return [{
                    id: 901,
                    capabilityCode: 'REPORT_VIEW',
                    department: 'Hệ thống Thông tin',
                    semesterId: null,
                    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
                    effectiveTo: new Date('2027-12-31T00:00:00.000Z'),
                    delegatorId: 401,
                }];
            }
            return [];
        });
    });

    describe('1. ADMIN without REPORT_VIEW has no role bypass', () => {
        it('returns 403 on all /api/reports/* and /api/dashboard aggregate endpoints', async () => {
            const endpoints = [
                '/api/reports/overview',
                '/api/reports/lecturer-workload',
                '/api/reports/export-excel',
                '/api/dashboard/stats',
                '/api/dashboard/semester-overview',
                '/api/dashboard/semesters',
                '/api/dashboard/scores',
                '/api/dashboard/activities',
            ];

            for (const url of endpoints) {
                const res = await request(app)
                    .get(url)
                    .set('Authorization', 'Bearer token-1');
                expect(res.status).toBe(403);
            }
        });
    });

    describe('2. Missing scope fails closed (403) even with REPORT_VIEW', () => {
        it('returns 403 on reports and aggregate dashboard when REPORT_VIEW has no determinable scope', async () => {
            const endpoints = [
                '/api/reports/overview',
                '/api/reports/lecturer-workload',
                '/api/reports/export-excel',
                '/api/dashboard/stats',
                '/api/dashboard/semester-overview',
                '/api/dashboard/semesters',
                '/api/dashboard/scores',
                '/api/dashboard/activities',
            ];

            for (const url of endpoints) {
                const res = await request(app)
                    .get(url)
                    .set('Authorization', 'Bearer token-403');
                expect(res.status).toBe(403);
            }
        });
    });

    describe('3. Department-scoped REPORT_VIEW (group & delegation) vs GLOBAL', () => {
        it('GLOBAL REPORT_VIEW sees all departments and can access /api/dashboard/activities', async () => {
            const overviewRes = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', 'Bearer token-401');
            expect(overviewRes.status).toBe(200);
            expect(overviewRes.body.data.kpis.totalStudents).toBe(2);

            const actRes = await request(app)
                .get('/api/dashboard/activities')
                .set('Authorization', 'Bearer token-401');
            expect(actRes.status).toBe(200);
        });

        it('department-scoped group REPORT_VIEW filters /api/reports/* to own department and ignores major expansion', async () => {
            const overviewRes = await request(app)
                .get('/api/reports/overview?major=Hệ%20thống%20Thông%20tin')
                .set('Authorization', 'Bearer token-402');
            expect(overviewRes.status).toBe(200);
            expect(overviewRes.body.data.kpis.totalStudents).toBe(0);

            const scopedOverviewRes = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', 'Bearer token-402');
            expect(scopedOverviewRes.status).toBe(200);
            expect(scopedOverviewRes.body.data.kpis.totalStudents).toBe(1);

            const workloadRes = await request(app)
                .get('/api/reports/lecturer-workload')
                .set('Authorization', 'Bearer token-402');
            expect(workloadRes.status).toBe(200);
            expect(workloadRes.body.data).toHaveLength(1);
            expect(workloadRes.body.data[0].department).toBe('Kỹ thuật Phần mềm');

            const excelRes = await request(app)
                .get('/api/reports/export-excel')
                .set('Authorization', 'Bearer token-402');
            expect(excelRes.status).toBe(200);
        });

        it('delegated department-scoped REPORT_VIEW filters reports to delegated department and fails closed on /api/dashboard/activities', async () => {
            const overviewRes = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', 'Bearer token-404');
            expect(overviewRes.status).toBe(200);
            expect(overviewRes.body.data.kpis.totalStudents).toBe(1);

            const statsRes = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', 'Bearer token-404');
            expect(statsRes.status).toBe(200);
            expect(prisma.user.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        department: { in: ['Hệ thống Thông tin'] },
                    }),
                })
            );

            const semOverviewRes = await request(app)
                .get('/api/dashboard/semester-overview')
                .set('Authorization', 'Bearer token-404');
            expect(semOverviewRes.status).toBe(200);

            const semRes = await request(app)
                .get('/api/dashboard/semesters')
                .set('Authorization', 'Bearer token-404');
            expect(semRes.status).toBe(200);

            const scoresRes = await request(app)
                .get('/api/dashboard/scores')
                .set('Authorization', 'Bearer token-404');
            expect(scoresRes.status).toBe(200);

            const activitiesRes = await request(app)
                .get('/api/dashboard/activities')
                .set('Authorization', 'Bearer token-404');
            expect(activitiesRes.status).toBe(403);
        });
    });

    describe('4. GVHD kiêm Viện trưởng /api/dashboard/lecturer only returns own mentored students', () => {
        it('returns only students mentored by actor.id = 401 and does not leak mentor 202 students', async () => {
            prisma.topicRegistration.findMany.mockImplementation(async ({ where }) => {
                if (where?.topic?.mentorId === 401) {
                    return [registrationsFixture[0]];
                }
                return registrationsFixture;
            });

            const res = await request(app)
                .get('/api/dashboard/lecturer')
                .set('Authorization', 'Bearer token-401');

            expect(res.status).toBe(200);
            expect(res.body.data.students).toHaveLength(1);
            expect(res.body.data.students[0].studentName).toBe('SV KTPM 1');
            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        topic: { mentorId: 401 },
                    }),
                })
            );
        });

        it('GET /api/registrations?scope=institute with only REPORT_VIEW does not open institute scope', async () => {
            prisma.topicRegistration.findMany.mockResolvedValue([]);

            const res = await request(app)
                .get('/api/registrations?scope=institute')
                .set('Authorization', 'Bearer token-402');

            expect(res.status).toBe(200);
            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        topic: { mentorId: 402 },
                    }),
                })
            );
        });
    });

    describe('5. Council view-only actor cannot mutate councils', () => {
        it('allows GET /api/councils (200) and denies POST/PUT/DELETE (403)', async () => {
            const listRes = await request(app)
                .get('/api/councils')
                .set('Authorization', 'Bearer token-405');
            expect(listRes.status).toBe(200);

            const createRes = await request(app)
                .post('/api/councils')
                .set('Authorization', 'Bearer token-405')
                .send({ semesterId: 1, name: 'HD Test', councilType: 'DEFENSE_COUNCIL' });
            expect(createRes.status).toBe(403);

            const updateRes = await request(app)
                .put('/api/councils/1')
                .set('Authorization', 'Bearer token-405')
                .send({ name: 'Updated' });
            expect(updateRes.status).toBe(403);

            const deleteRes = await request(app)
                .delete('/api/councils/1')
                .set('Authorization', 'Bearer token-405');
            expect(deleteRes.status).toBe(403);
        });
    });
});

