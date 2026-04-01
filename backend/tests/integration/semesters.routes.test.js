jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    topic: {
        count: jest.fn(),
    },
    topicRegistration: {
        count: jest.fn(),
    },
    council: {
        count: jest.fn(),
    },
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - semesters routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'integration-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 1) {
                return {
                    id: 1,
                    email: 'admin@example.com',
                    fullName: 'Admin',
                    code: 'AD001',
                    role: 'ADMIN',
                    department: 'PDT',
                    isActive: true,
                };
            }
            if (where?.id === 2) {
                return {
                    id: 2,
                    email: 'lecturer@example.com',
                    fullName: 'Lecturer',
                    code: 'GV001',
                    role: 'LECTURER',
                    department: 'CNTT',
                    isActive: true,
                };
            }
            return null;
        });
    });

    test('GET /api/semesters returns semester list for authenticated user', async () => {
        prisma.semester.findMany.mockResolvedValue([
            {
                id: 1,
                name: 'HK1',
                startDate: new Date('2026-01-01T00:00:00.000Z'),
                endDate: new Date('2026-06-01T00:00:00.000Z'),
                registrationDeadline: new Date('2026-01-20T00:00:00.000Z'),
                defenseDate: null,
                status: 'ONGOING',
            },
        ]);

        const res = await request(app)
            .get('/api/semesters')
            .set('Authorization', 'Bearer admin-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('POST /api/semesters rejects non-admin role', async () => {
        const res = await request(app)
            .post('/api/semesters')
            .set('Authorization', 'Bearer lecturer-token')
            .send({
                name: 'HK2',
                startDate: '2026-07-01T00:00:00.000Z',
                registrationDeadline: '2026-07-20T00:00:00.000Z',
                endDate: '2026-12-01T00:00:00.000Z',
            });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    test('PATCH /api/semesters/:id/registration-toggle validates boolean payload', async () => {
        const res = await request(app)
            .patch('/api/semesters/1/registration-toggle')
            .set('Authorization', 'Bearer admin-token')
            .send({ registrationOpen: 'true' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    test('PATCH /api/semesters/:id/registration-toggle returns warning outside recommended window', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 1,
            name: 'HK Future',
            startDate: new Date('2099-01-10T00:00:00.000Z'),
            registrationDeadline: new Date('2099-01-20T00:00:00.000Z'),
            endDate: new Date('2099-06-01T00:00:00.000Z'),
            defenseDate: null,
            registrationOpen: false,
        });
        prisma.semester.update.mockResolvedValue({
            id: 1,
            name: 'HK Future',
            startDate: new Date('2099-01-10T00:00:00.000Z'),
            registrationDeadline: new Date('2099-01-20T00:00:00.000Z'),
            endDate: new Date('2099-06-01T00:00:00.000Z'),
            defenseDate: null,
            registrationOpen: true,
        });

        const res = await request(app)
            .patch('/api/semesters/1/registration-toggle')
            .set('Authorization', 'Bearer admin-token')
            .send({ registrationOpen: true });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(typeof res.body.warning).toBe('string');
        expect(res.body.warning.length).toBeGreaterThan(0);
    });
});
