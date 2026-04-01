jest.mock('../../src/config/database', () => ({
    user: {
        findUnique: jest.fn(),
    },
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../../src/middlewares/auth');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('auth middleware authenticate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'unit-test-secret';
    });

    test('returns 401 when authorization header is missing', async () => {
        const req = createMockReq();
        const res = createMockRes();
        const next = createNext();

        await authenticate(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('attaches user and calls next when token is valid', async () => {
        jwt.verify.mockReturnValue({ userId: 11, role: 'ADMIN' });
        prisma.user.findUnique.mockResolvedValue({
            id: 11,
            email: 'admin@example.com',
            fullName: 'Admin User',
            code: 'AD001',
            role: 'ADMIN',
            department: 'PDT',
            isActive: true,
        });

        const req = createMockReq({
            headers: { authorization: 'Bearer valid-token' },
        });
        const res = createMockRes();
        const next = createNext();

        await authenticate(req, res, next);

        expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'unit-test-secret');
        expect(req.user).toEqual(
            expect.objectContaining({
                id: 11,
                role: 'ADMIN',
            })
        );
        expect(next).toHaveBeenCalledTimes(1);
    });
});
