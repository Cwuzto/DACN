jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - topics routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'integration-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 5, role: 'STUDENT' };
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
            return null;
        });
    });

    test('GET /api/topics/mentors returns active lecturers', async () => {
        prisma.user.findMany.mockResolvedValue([
            {
                id: 10,
                fullName: 'Giang Vien A',
                code: 'GV010',
                academicTitle: 'THAC_SI',
                department: 'CNTT',
            },
            {
                id: 11,
                fullName: 'Giang Vien B',
                code: 'GV011',
                academicTitle: 'TIEN_SI',
                department: 'KTPM',
            },
        ]);

        const res = await request(app)
            .get('/api/topics/mentors')
            .set('Authorization', 'Bearer student-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(2);
        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: {
                role: 'LECTURER',
                isActive: true,
            },
            select: {
                id: true,
                fullName: true,
                code: true,
                academicTitle: true,
                department: true,
            },
            orderBy: { fullName: 'asc' },
        });
    });

    test('GET /api/topics/mentors returns 401 when token is missing', async () => {
        const res = await request(app).get('/api/topics/mentors');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
});
