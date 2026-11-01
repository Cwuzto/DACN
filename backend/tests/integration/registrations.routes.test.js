jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    topic: {
        findUnique: jest.fn(),
    },
    studentProjectEnrollment: {
        findFirst: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
    task: {
        groupBy: jest.fn(),
    },
}));

jest.mock('../../src/constants/mentorCapacity', () => ({
    getMentorMaxSlots: jest.fn(),
}));
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const { getMentorMaxSlots } = require('../../src/constants/mentorCapacity');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - registrations routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        process.env.JWT_SECRET = 'integration-secret';
        prisma.semester.findFirst.mockResolvedValue({ id: 9 });
        prisma.task.groupBy.mockResolvedValue([]);
        prisma.topicRegistration.findFirst.mockResolvedValue(null);

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 5, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 77, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 5) {
                return {
                    id: 5,
                    email: 'student@example.com',
                    fullName: 'Nguyen Van A',
                    code: 'SV005',
                    role: 'STUDENT',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 77) {
                return {
                    id: 77,
                    email: 'lecturer@example.com',
                    fullName: 'Giang Vien',
                    code: 'GV077',
                    role: 'LECTURER',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [{
                        permissionGroup: {
                            code: 'GVHD',
                            permissions: ['BM03_REVIEW', 'MENTOR_ASSIGNMENT_ADJUST'].map((code) => ({ permission: { code } })),
                        },
                    }],
                };
            }
            if (where?.id === 1) {
                return {
                    id: 1,
                    email: 'admin@example.com',
                    fullName: 'Quan Tri Vien',
                    code: 'ADMIN001',
                    role: 'ADMIN',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [{
                        permissionGroup: {
                            code: 'QUAN_TRI_VIEN',
                            permissions: ['REPORT_VIEW', 'DEFENSE_COUNCIL_MANAGE', 'MENTOR_ASSIGNMENT_ADJUST'].map((code) => ({ permission: { code } })),
                        },
                    }],
                };
            }
            return null;
        });
    });

    test('POST /api/registrations creates registration when semester is open', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2020-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: true,
        });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topic.findUnique.mockResolvedValue({
            id: 100,
            title: 'Do an AI',
            semesterId: 9,
            mentorId: 77,
            projectCatalogId: 1,
            status: 'APPROVED',
            maxStudents: 2,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 1, name: 'Do an tot nghiep' },
            _count: { registrations: 0 },
        });
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue({ id: 7001 });
        getMentorMaxSlots.mockReturnValue(15);
        prisma.topicRegistration.count.mockResolvedValue(1);
        prisma.topicRegistration.create.mockResolvedValue({
            id: 501,
            topicId: 100,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
        });

        const res = await request(app)
            .post('/api/registrations')
            .set('Authorization', 'Bearer student-token')
            .send({ topicId: 100, semesterId: 9 });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    test('POST /api/registrations rejects when semester registration is closed', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2020-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: false,
        });

        const res = await request(app)
            .post('/api/registrations')
            .set('Authorization', 'Bearer student-token')
            .send({ topicId: 100, semesterId: 9 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('POST /api/registrations rejects when student has not enrolled project catalog', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2020-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: true,
        });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topic.findUnique.mockResolvedValue({
            id: 100,
            title: 'Do an AI',
            semesterId: 9,
            mentorId: 77,
            projectCatalogId: 2,
            status: 'APPROVED',
            maxStudents: 2,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 2, name: 'Do an B' },
            _count: { registrations: 0 },
        });
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/registrations')
            .set('Authorization', 'Bearer student-token')
            .send({ topicId: 100, semesterId: 9 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('POST /api/registrations rejects when enrollment exists but not for requested semester', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2020-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: true,
        });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topic.findUnique.mockResolvedValue({
            id: 100,
            title: 'Do an AI',
            semesterId: 9,
            mentorId: 77,
            projectCatalogId: 2,
            status: 'APPROVED',
            maxStudents: 2,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 2, name: 'Do an B' },
            _count: { registrations: 0 },
        });
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/registrations')
            .set('Authorization', 'Bearer student-token')
            .send({ topicId: 100, semesterId: 9 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('GET /api/registrations returns list for lecturer role', async () => {
        prisma.topicRegistration.findMany.mockResolvedValue([
            {
                id: 1,
                student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005', email: 'student@example.com' },
                topic: { id: 100, title: 'Do an AI' },
                milestones: [],
                _count: { tasks: 0, submissions: 0 },
            },
        ]);

        const res = await request(app)
            .get('/api/registrations')
            .set('Authorization', 'Bearer lecturer-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ semesterId: 9 }),
            })
        );
    });

    test('GET /api/registrations returns all registrations for admin role', async () => {
        prisma.topicRegistration.findMany.mockResolvedValue([
            { id: 1, status: 'BM01_PASSED' },
            { id: 2, status: 'DEFENSE_READY' },
        ]);

        const res = await request(app)
            .get('/api/registrations?semesterId=9')
            .set('Authorization', 'Bearer admin-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
        expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { semesterId: 9 } }),
        );
    });

    test('GET /api/registrations rejects student role', async () => {
        const res = await request(app)
            .get('/api/registrations?semesterId=9')
            .set('Authorization', 'Bearer student-token');

        expect(res.status).toBe(403);
        expect(prisma.topicRegistration.findMany).not.toHaveBeenCalled();
    });

    test('GET /api/registrations only returns DEFENSE_READY candidates for defense assignment', async () => {
        prisma.topicRegistration.findMany.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/registrations?semesterId=9&unassignedCouncilOnly=true&councilType=DEFENSE_COUNCIL')
            .set('Authorization', 'Bearer admin-token');

        expect(res.status).toBe(200);
        expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    semesterId: 9,
                    defenseCouncilId: null,
                    status: 'DEFENSE_READY',
                }),
            }),
        );
    });

    test('GET /api/registrations returns empty list when lecturer has no active semester', async () => {
        prisma.semester.findFirst.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/registrations')
            .set('Authorization', 'Bearer lecturer-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual([]);
        expect(prisma.topicRegistration.findMany).not.toHaveBeenCalled();
    });

    test('POST /api/registrations/:id/withdraw rejects after DECISION_ISSUED', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 1,
            studentId: 5,
            status: 'DECISION_ISSUED',
            topic: { id: 100, title: 'Do an AI', mentorId: 77, mentor: { id: 77 } },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            defenseResult: null,
        });

        const res = await request(app)
            .post('/api/registrations/1/withdraw')
            .set('Authorization', 'Bearer student-token')
            .send({ reason: 'Xin rút sau quyết định' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('INVALID_TRANSITION');
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
    });

    test('PATCH /api/registrations/:id/drop rejects legacy post-decision status', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 1,
            studentId: 5,
            status: 'IN_PROGRESS',
            topic: { id: 100, title: 'Do an AI', mentorId: 77, mentor: { id: 77 } },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            defenseResult: null,
        });

        const res = await request(app)
            .patch('/api/registrations/1/drop')
            .set('Authorization', 'Bearer lecturer-token')
            .send({ reason: 'Không được hủy sau quyết định' });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('INVALID_TRANSITION');
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
    });

    test('GET /api/registrations/:id/allowed-actions returns allowed actions for student', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 1,
            studentId: 5,
            status: 'PENDING',
            stateVersion: 1,
            topic: { id: 100, title: 'Do an AI', mentorId: 77 },
            defenseCouncil: null,
            defenseResult: null,
            archive: null,
            manualReviewCases: [],
        });

        const res = await request(app)
            .get('/api/registrations/1/allowed-actions')
            .set('Authorization', 'Bearer student-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.registrationId).toBe(1);
        expect(res.body.data.allowedActions).toContain('CANCEL_REGISTRATION');
    });
});
