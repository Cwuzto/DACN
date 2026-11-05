jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findUnique: jest.fn(), findFirst: jest.fn() },
    topicRegistration: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    topic: { findUnique: jest.fn() },
    studentProjectEnrollment: { findFirst: jest.fn() },
    council: { findUnique: jest.fn() },
    councilMember: { findMany: jest.fn(), count: jest.fn() },
    defenseScoreSheet: { findMany: jest.fn(), count: jest.fn() },
    defenseResult: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    task: { groupBy: jest.fn() },
    periodWorkflowPolicyVersion: { findMany: jest.fn() },
    notification: { create: jest.fn() },
    auditLog: { create: jest.fn() },
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { PERMISSIONS } = require('../../src/constants/permissions');

const ROUTE_FILES_TO_CHECK = [
    'registrationRoutes.js',
    'evaluationRoutes.js',
    'archiveRoutes.js',
    'dashboardRoutes.js',
    'taskRoutes.js',
    'topicRoutes.js',
    'councilRoutes.js',
    'semesterRoutes.js',
];

describe('Route Capability Inventory & Role Decoupling', () => {
    describe('Static Route Code & Policy Verification', () => {
        test('no route file uses raw authorize("STUDENT") or authorize("LECTURER")', () => {
            const routesDir = path.resolve(__dirname, '../../src/routes');
            const violations = [];

            for (const file of ROUTE_FILES_TO_CHECK) {
                const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
                const studentMatch = content.match(/authorize\(\s*['"]STUDENT['"]\s*\)/g);
                const lecturerMatch = content.match(/authorize\(\s*['"]LECTURER['"]\s*\)/g);

                if (studentMatch) {
                    violations.push(`${file}: contains authorize('STUDENT') (${studentMatch.length} times)`);
                }
                if (lecturerMatch) {
                    violations.push(`${file}: contains authorize('LECTURER') (${lecturerMatch.length} times)`);
                }
            }

            expect(violations).toEqual([]);
        });
    });

    describe('Functional Capability Enforcement on Key Endpoints', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            process.env.JWT_SECRET = 'route-capability-secret';
            prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
            if (prisma.periodWorkflowPolicyVersion?.findMany) {
                prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([{ id: 1, version: 1, isActive: true }]);
            }

            jwt.verify.mockImplementation((token) => {
                if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
                if (token === 'lecturer-token') return { userId: 20, role: 'LECTURER' };
                if (token === 'unauthorized-token') return { userId: 30, role: 'LECTURER' };
                if (token === 'dean-token') return { userId: 40, role: 'LECTURER' };
                throw new Error('invalid token');
            });

            prisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where?.id === 10) {
                    return {
                        id: 10,
                        email: 'student@example.com',
                        fullName: 'Nguyen Student',
                        code: 'SV010',
                        role: 'STUDENT',
                        department: 'CNTT',
                        isActive: true,
                        permissionGroups: [{
                            permissionGroup: {
                                code: 'SYSTEM_STUDENT_BASE',
                                permissions: [
                                    { permission: { code: PERMISSIONS.VIEW_MY_GRADES } },
                                    { permission: { code: PERMISSIONS.VIEW_MY_REGISTRATION } },
                                    { permission: { code: PERMISSIONS.REGISTER_TOPIC } },
                                    { permission: { code: PERMISSIONS.RENAME_TOPIC } },
                                    { permission: { code: PERMISSIONS.REGISTRATION_CANCEL } },
                                ],
                            },
                        }],
                    };
                }
                if (where?.id === 20) {
                    return {
                        id: 20,
                        email: 'mentor@example.com',
                        fullName: 'Tran Mentor',
                        code: 'GV020',
                        role: 'LECTURER',
                        department: 'CNTT',
                        isActive: true,
                        permissionGroups: [{
                            permissionGroup: {
                                code: 'GVHD',
                                permissions: [
                                    { permission: { code: PERMISSIONS.MENTOR_REQUEST_REVIEW } },
                                    { permission: { code: PERMISSIONS.TOPIC_CREATE } },
                                ],
                            },
                        }],
                    };
                }
                if (where?.id === 30) {
                    return {
                        id: 30,
                        email: 'unauthorized@example.com',
                        fullName: 'Le Unauthorized',
                        code: 'GV030',
                        role: 'LECTURER',
                        department: 'CNTT',
                        isActive: true,
                        permissionGroups: [],
                    };
                }
                if (where?.id === 40) {
                    return {
                        id: 40,
                        email: 'dean@example.com',
                        fullName: 'Pham Dean',
                        code: 'GV040',
                        role: 'LECTURER',
                        department: 'CNTT',
                        isActive: true,
                        permissionGroups: [{
                            permissionGroup: {
                                code: 'VIEN_TRUONG',
                                permissions: [
                                    { permission: { code: PERMISSIONS.RESULT_LOCK } },
                                    { permission: { code: PERMISSIONS.DEFENSE_RESULT_APPROVE } },
                                    { permission: { code: PERMISSIONS.RESULT_PUBLICATION_PUBLISH } },
                                ],
                            },
                        }],
                    };
                }
                return null;
            });
        });

        test('GET /api/evaluations/my-grades succeeds via VIEW_MY_GRADES capability', async () => {
            prisma.topicRegistration.findMany.mockResolvedValue([{
                id: 101,
                studentId: 10,
                semesterId: 1,
                status: 'DEFENSE_PASSED',
                topic: { title: 'Do An Tot Nghiep CNTT' },
                defenseResult: { score: 9.0, isPassed: true },
                resultPublicationItems: [{ publication: { semesterId: 1, type: 'INITIAL' } }],
            }]);

            const resSuccess = await request(app)
                .get('/api/evaluations/my-grades')
                .set('Authorization', 'Bearer student-token');

            expect(resSuccess.status).toBe(200);

            const resForbidden = await request(app)
                .get('/api/evaluations/my-grades')
                .set('Authorization', 'Bearer unauthorized-token');

            expect(resForbidden.status).toBe(403);
        });

        test('POST /api/registrations/register succeeds via REGISTER_TOPIC capability', async () => {
            prisma.studentProjectEnrollment.findFirst.mockResolvedValue({
                id: 1,
                studentId: 10,
                semesterId: 1,
                status: 'ACTIVE',
            });
            prisma.semester.findUnique.mockResolvedValue({
                id: 1,
                status: 'IN_PROGRESS',
                registrationOpen: true,
                startDate: new Date(Date.now() - 86400000),
                registrationDeadline: new Date(Date.now() + 86400000),
            });
            prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([{ id: 1, semesterId: 1, version: 1, isActive: true }]);
            prisma.topic.findUnique.mockResolvedValue({
                id: 5,
                semesterId: 1,
                projectCatalogId: 1,
                status: 'APPROVED',
                mentorId: 20,
                maxStudents: 1,
                mentor: { id: 20, academicTitle: 'THAC_SI' },
                registrations: [],
                _count: { registrations: 0 },
            });
            prisma.topicRegistration.findFirst.mockResolvedValue(null);
            prisma.topicRegistration.findUnique.mockResolvedValue(null);
            prisma.topicRegistration.count.mockResolvedValue(0);
            prisma.topicRegistration.create.mockResolvedValue({
                id: 101,
                topicId: 5,
                studentId: 10,
                status: 'PENDING',
            });

            const resSuccess = await request(app)
                .post('/api/registrations/register')
                .set('Authorization', 'Bearer student-token')
                .send({ topicId: 5, semesterId: 1 });

            expect(resSuccess.status).toBe(201);

            const resForbidden = await request(app)
                .post('/api/registrations/register')
                .set('Authorization', 'Bearer unauthorized-token')
                .send({ topicId: 5, semesterId: 1 });

            expect(resForbidden.status).toBe(403);
        });

        test('PATCH /api/registrations/:id/status reviews registration via MENTOR_REQUEST_REVIEW and checks mentor ownership', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'PENDING',
                semesterId: 1,
                topic: {
                    id: 5,
                    mentorId: 20,
                    title: 'Do An Test',
                    mentor: { id: 20, academicTitle: 'THAC_SI' },
                },
                student: { id: 10, fullName: 'Student', code: 'SV010' },
            });
            prisma.topicRegistration.count.mockResolvedValue(1);
            prisma.topicRegistration.update.mockResolvedValue({
                id: 101,
                status: 'APPROVED',
            });

            const resSuccess = await request(app)
                .patch('/api/registrations/101/status')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ action: 'APPROVE' });

            expect(resSuccess.status).toBe(200);

            const resForbidden = await request(app)
                .patch('/api/registrations/101/status')
                .set('Authorization', 'Bearer unauthorized-token')
                .send({ action: 'APPROVE' });

            expect(resForbidden.status).toBe(403);
        });

        test('POST /api/evaluations/councils/:id/lock-scores enforces RESULT_LOCK capability', async () => {
            prisma.council.findUnique.mockResolvedValue({
                id: 99,
                name: 'Hoi Dong Bao Ve 01',
                councilType: 'DEFENSE_COUNCIL',
            });

            const resForbidden = await request(app)
                .post('/api/evaluations/councils/99/lock-scores')
                .set('Authorization', 'Bearer lecturer-token')
                .send({ action: 'LOCK' });

            expect(resForbidden.status).toBe(403);
        });
    });
});
