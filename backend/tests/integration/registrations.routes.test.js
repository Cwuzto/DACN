jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    topicRegistration: {
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
    notification: {
        create: jest.fn(),
    },
}));

jest.mock('../../src/constants/mentorCapacity', () => ({
    getMentorMaxSlots: jest.fn(),
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
        process.env.JWT_SECRET = 'integration-secret';
        prisma.semester.findFirst.mockResolvedValue({ id: 9 });

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 5, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 77, role: 'LECTURER' };
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
            status: 'APPROVED',
            maxStudents: 2,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            _count: { registrations: 0 },
        });
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
});
