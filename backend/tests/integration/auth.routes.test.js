jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
    },
}));

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - auth routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'integration-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'valid-token') return { userId: 11, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.email === 'student@example.com') {
                return {
                    id: 11,
                    email: 'student@example.com',
                    passwordHash: 'hashed-password',
                    fullName: 'Student Test',
                    code: 'SV011',
                    role: 'STUDENT',
                    department: 'CNTT',
                    avatarUrl: null,
                    isActive: true,
                };
            }

            if (where?.id === 11) {
                return {
                    id: 11,
                    email: 'student@example.com',
                    fullName: 'Student Test',
                    code: 'SV011',
                    role: 'STUDENT',
                    department: 'CNTT',
                    isActive: true,
                };
            }

            return null;
        });

        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('generated-token');
    });

    test('POST /api/auth/login returns token on valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'student@example.com', password: 'secret123' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.token).toBe('generated-token');
    });

    test('GET /api/auth/me returns 401 when token is missing', async () => {
        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('GET /api/auth/me returns current user with valid token', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(11);
    });
});
