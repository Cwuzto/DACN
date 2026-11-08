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
const { login, getMe, updateProfile } = require('../../src/controllers/authController');
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

        expect(prisma.user.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { email: 'missing@example.com' },
            })
        );
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

describe('authController.getMe', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'unit-test-secret';
        process.env.JWT_EXPIRES_IN = '7d';
    });

    test('returns user and preserves studentProfile for student', async () => {
        const studentUser = {
            id: 101,
            role: 'STUDENT',
            code: 'SV20260010',
            fullName: 'Nguyen Van An',
            email: 'an.nv@school.edu.vn',
            studentProfile: {
                gender: 'MALE',
                dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
                className: 'D20PM01',
                major: 'Ky thuat phan mem',
            },
        };

        const req = createMockReq({ user: studentUser });
        const res = createMockRes();
        const next = createNext();

        await getMe(req, res, next);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    role: 'STUDENT',
                    studentProfile: expect.objectContaining({
                        className: 'D20PM01',
                    }),
                }),
            })
        );
    });
});

describe('authController.updateProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('allows student to update only avatar and phone, ignoring academic fields', async () => {
        const req = createMockReq({
            user: { id: 101, role: 'STUDENT' },
            body: {
                avatarUrl: 'https://cdn.example.com/new-avatar.png',
                phone: '0912999888',
                fullName: 'Hacked Name',
                code: 'SV99999999',
                gender: 'FEMALE',
                dateOfBirth: '01/01/2000',
                className: 'HackedClass',
                major: 'HackedMajor',
                department: 'HackedDept',
            },
        });
        const res = createMockRes();
        const next = createNext();

        prisma.user.update.mockResolvedValue({
            id: 101,
            role: 'STUDENT',
            code: 'SV20260010',
            fullName: 'Original Name',
            phone: '0912999888',
            avatarUrl: 'https://cdn.example.com/new-avatar.png',
            studentProfile: {
                className: 'D20PM01',
                major: 'Ky thuat phan mem',
            },
        });

        await updateProfile(req, res, next);

        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 101 },
                data: {
                    avatarUrl: 'https://cdn.example.com/new-avatar.png',
                    phone: '0912999888',
                },
            })
        );
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    phone: '0912999888',
                }),
            })
        );
    });
});

