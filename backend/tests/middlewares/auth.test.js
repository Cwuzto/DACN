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
const {
    authenticate,
    authorizePermission,
    authorizeAllPermissions,
    assertPermission,
} = require('../../src/middlewares/auth');
const { PERMISSIONS } = require('../../src/constants/permissions');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('auth middleware authenticate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'unit-test-secret';
    });

    test('returns 401 when authorization header is missing', async () => {
        const req = createMockReq({ user: null });
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

    test('does NOT auto-grant SYSTEM_ADMIN_CORE_PERMISSIONS based on role ADMIN (Capability-First No Backdoor)', async () => {
        jwt.verify.mockReturnValue({ userId: 11, role: 'ADMIN' });
        prisma.user.findUnique.mockResolvedValue({
            id: 11,
            email: 'admin@example.com',
            fullName: 'Admin User',
            code: 'AD001',
            role: 'ADMIN',
            department: 'PDT',
            isActive: true,
            permissionGroups: [],
        });

        const req = createMockReq({
            headers: { authorization: 'Bearer valid-token' },
        });
        const res = createMockRes();
        const next = createNext();

        await authenticate(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.user.permissions).toEqual([]);
    });

    test('attaches studentProfile to req.user for student', async () => {
        jwt.verify.mockReturnValue({ userId: 101, role: 'STUDENT' });
        prisma.user.findUnique.mockResolvedValue({
            id: 101,
            email: 'student@example.com',
            fullName: 'Nguyen Van An',
            code: 'SV20260010',
            role: 'STUDENT',
            department: null,
            isActive: true,
            permissionGroups: [],
            studentProfile: {
                gender: 'MALE',
                dateOfBirth: new Date('2002-03-12T00:00:00.000Z'),
                className: 'D20PM01',
                major: 'Ky thuat phan mem',
            },
        });

        const req = createMockReq({
            headers: { authorization: 'Bearer valid-student-token' },
        });
        const res = createMockRes();
        const next = createNext();

        await authenticate(req, res, next);

        expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({
                studentProfile: expect.anything(),
            }),
        }));
        expect(req.user.studentProfile).toEqual(expect.objectContaining({
            className: 'D20PM01',
            major: 'Ky thuat phan mem',
        }));
        expect(next).toHaveBeenCalledTimes(1);
    });
});

describe('auth middleware capability guards', () => {
    test('authorizePermission allows any matching capability and exposes policy metadata', () => {
        const middleware = authorizePermission(PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_IMPORT);
        const req = createMockReq({ user: { role: 'ADMIN', permissions: [PERMISSIONS.USER_IMPORT] } });
        const res = createMockRes();
        const next = createNext();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(middleware.authorizationPolicy).toEqual({
            mode: 'ANY',
            permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_IMPORT],
        });
    });

    test('authorizeAllPermissions requires every capability', () => {
        const middleware = authorizeAllPermissions(PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_IMPORT);
        const req = createMockReq({ user: { role: 'ADMIN', permissions: [PERMISSIONS.USER_MANAGE] } });
        const res = createMockRes();
        const next = createNext();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
        expect(middleware.authorizationPolicy).toEqual({
            mode: 'ALL',
            permissions: [PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_IMPORT],
        });
    });

    test('ADMIN does not bypass a missing permission', () => {
        const middleware = authorizePermission(PERMISSIONS.SEMESTER_MANAGE);
        const req = createMockReq({ user: { role: 'ADMIN', permissions: [] } });
        const res = createMockRes();
        const next = createNext();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('capability guards return 401 without an authenticated user', () => {
        const middleware = authorizePermission(PERMISSIONS.USER_MANAGE);
        const req = createMockReq({ user: null });
        const res = createMockRes();
        const next = createNext();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('assertPermission throws 403 for resource-aware checks', () => {
        expect(() => assertPermission({ role: 'ADMIN', permissions: [] }, PERMISSIONS.RUBRIC_MANAGE))
            .toThrow(expect.objectContaining({ statusCode: 403 }));
        expect(() => assertPermission(
            { role: 'LECTURER', permissions: [PERMISSIONS.RUBRIC_MANAGE] },
            PERMISSIONS.RUBRIC_MANAGE,
        )).not.toThrow();
    });
});
