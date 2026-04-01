jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('bcryptjs', () => ({
    compare: jest.fn(),
    hash: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
}));

const prisma = require('../../src/config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { login } = require('../../src/controllers/authController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('authController.login', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'unit-test-secret';
        process.env.JWT_EXPIRES_IN = '7d';
    });

    test('returns 400 when email or password is missing', async () => {
        const req = createMockReq({ body: { email: 'student@example.com' } });
        const res = createMockRes();
        const next = createNext();

        await login(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when user is not found', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        const req = createMockReq({
            body: { email: 'missing@example.com', password: 'secret123' },
        });
        const res = createMockRes();
        const next = createNext();

        await login(req, res, next);

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'missing@example.com' },
        });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('returns token and user payload on successful login', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 101,
            email: 'student@example.com',
            passwordHash: 'hashed-password',
            fullName: 'Test Student',
            code: 'SV001',
            role: 'STUDENT',
            department: 'CNTT',
            avatarUrl: null,
            isActive: true,
        });
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('mocked-jwt-token');

        const req = createMockReq({
            body: { email: 'student@example.com', password: 'secret123' },
        });
        const res = createMockRes();
        const next = createNext();

        await login(req, res, next);

        expect(jwt.sign).toHaveBeenCalledWith(
            { userId: 101, role: 'STUDENT' },
            'unit-test-secret',
            { expiresIn: '7d' }
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    token: 'mocked-jwt-token',
                    user: expect.objectContaining({
                        id: 101,
                        email: 'student@example.com',
                    }),
                }),
            })
        );
        expect(next).not.toHaveBeenCalled();
    });
});
