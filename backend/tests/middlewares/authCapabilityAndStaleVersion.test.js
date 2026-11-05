jest.mock('../../src/config/database', () => {
    const mockPrisma = {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        permissionGroup: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        permission: {
            findMany: jest.fn(),
        },
        userPermissionGroup: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        permissionGroupPermission: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        auditLog: {
            create: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback(mockPrisma)),
    };
    return mockPrisma;
});

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../../src/middlewares/auth');
const { getMe } = require('../../src/controllers/authController');
const { updateUserPermissionGroups } = require('../../src/controllers/userController');
const { updateExistingGroup } = require('../../src/controllers/permissionController');
const { updateGroup, setUserGroups } = require('../../src/services/permissionService');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('Task 2: Server-Authoritative Permissions, Stale Version Guard & Anti-Escalation', () => {
    const JWT_SECRET = 'unit-test-secret-task-2';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.JWT_EXPIRES_IN = '1d';
    });

    describe('1. authenticate middleware: stale permissionVersion guard', () => {
        test('rejects with 409 PERMISSION_VERSION_STALE when token.permissionVersion < user.permissionVersion on mutation or non-me route', async () => {
            const staleToken = jwt.sign(
                { userId: 10, role: 'STUDENT', permissionVersion: 1 },
                JWT_SECRET
            );

            prisma.user.findUnique.mockResolvedValue({
                id: 10,
                email: 'student@example.com',
                fullName: 'Student User',
                code: 'SV010',
                role: 'STUDENT',
                department: 'CNTT',
                isActive: true,
                permissionVersion: 2, // Database has newer version
                permissionGroups: [],
                councilMembers: [],
            });

            const req = createMockReq({
                headers: { authorization: `Bearer ${staleToken}` },
                originalUrl: '/api/registrations/register',
                path: '/register',
                method: 'POST',
            });
            const res = createMockRes();
            const next = createNext();

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'PERMISSION_VERSION_STALE',
                    message: 'Phiên bản quyền đã được cập nhật.',
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('bypasses stale check for GET /api/auth/me and attaches latest user from DB', async () => {
            const staleToken = jwt.sign(
                { userId: 10, role: 'STUDENT', permissionVersion: 1 },
                JWT_SECRET
            );

            prisma.user.findUnique.mockResolvedValue({
                id: 10,
                email: 'student@example.com',
                fullName: 'Student User',
                code: 'SV010',
                role: 'STUDENT',
                department: 'CNTT',
                isActive: true,
                permissionVersion: 2,
                permissionGroups: [
                    {
                        permissionGroup: {
                            code: 'SYSTEM_STUDENT_BASE',
                            permissions: [
                                { permission: { code: 'VIEW_MY_REGISTRATION' } },
                                { permission: { code: 'VIEW_MY_GRADES' } },
                            ],
                        },
                    },
                ],
                councilMembers: [],
            });

            const req = createMockReq({
                headers: { authorization: `Bearer ${staleToken}` },
                originalUrl: '/api/auth/me',
                path: '/me',
                method: 'GET',
            });
            const res = createMockRes();
            const next = createNext();

            await authenticate(req, res, next);

            expect(res.status).not.toHaveBeenCalledWith(409);
            expect(next).toHaveBeenCalledTimes(1);
            expect(req.user).toEqual(
                expect.objectContaining({
                    id: 10,
                    permissionVersion: 2,
                    permissionGroups: ['SYSTEM_STUDENT_BASE'],
                    permissions: expect.arrayContaining(['VIEW_MY_REGISTRATION', 'VIEW_MY_GRADES']),
                })
            );
        });

        test('returns 401 when user is inactive even if calling /api/auth/me', async () => {
            const token = jwt.sign(
                { userId: 10, role: 'STUDENT', permissionVersion: 1 },
                JWT_SECRET
            );

            prisma.user.findUnique.mockResolvedValue({
                id: 10,
                isActive: false,
                permissionVersion: 1,
            });

            const req = createMockReq({
                headers: { authorization: `Bearer ${token}` },
                originalUrl: '/api/auth/me',
                path: '/me',
                method: 'GET',
            });
            const res = createMockRes();
            const next = createNext();

            await authenticate(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('2. getMe controller: token refresh', () => {
        test('returns fresh JWT token with latest permissionVersion and user permissions', async () => {
            const req = createMockReq({
                user: {
                    id: 10,
                    email: 'student@example.com',
                    fullName: 'Student User',
                    role: 'STUDENT',
                    permissionVersion: 3,
                    permissions: ['VIEW_MY_REGISTRATION', 'VIEW_MY_GRADES'],
                },
            });
            const res = createMockRes();
            const next = createNext();

            await getMe(req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: req.user,
                    token: expect.any(String),
                })
            );

            const responsePayload = res.json.mock.calls[0][0];
            const decodedRefreshedToken = jwt.verify(responsePayload.token, JWT_SECRET);
            expect(decodedRefreshedToken.userId).toBe(10);
            expect(decodedRefreshedToken.permissionVersion).toBe(3);
        });
    });

    describe('3. Anti-self-escalation guard', () => {
        test('admin cannot assign permission groups to self (targetUserId === req.user.id) -> 403', async () => {
            const req = createMockReq({
                user: {
                    id: 1,
                    role: 'ADMIN',
                    permissions: ['PERMISSION_GROUP_MANAGE'],
                },
                params: { id: '1' },
                body: { groupIds: [2] },
            });
            const res = createMockRes();
            const next = createNext();

            await updateUserPermissionGroups(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'CANNOT_ASSIGN_PERMISSIONS_TO_SELF',
                })
            );
        });

        test('setUserGroups service enforces anti-self-escalation check', async () => {
            await expect(
                setUserGroups(5, [2], { id: 5, permissions: ['PERMISSION_GROUP_MANAGE'] })
            ).rejects.toMatchObject({
                statusCode: 403,
                code: 'CANNOT_ASSIGN_PERMISSIONS_TO_SELF',
            });
        });
    });

    describe('4. Permission group modification', () => {
        test('admin can update permission groups and map permissions successfully', async () => {
            prisma.permissionGroup.findUnique.mockResolvedValue({
                id: 100,
                code: 'GROUP_1',
                name: 'Nhóm 1',
            });
            prisma.permissionGroup.update.mockResolvedValue({
                id: 100,
                code: 'GROUP_1',
                name: 'Tên mới',
            });
            prisma.permission.findMany.mockResolvedValue([{ id: 10 }]);

            const req = createMockReq({
                user: { id: 1, role: 'ADMIN', permissions: ['PERMISSION_GROUP_MANAGE'] },
                params: { id: '100' },
                body: { name: 'Tên mới', permissionCodes: ['VIEW_MY_REGISTRATION'] },
            });
            const res = createMockRes();
            const next = createNext();

            await updateExistingGroup(req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                })
            );
        });
    });

    describe('5. Technical admin boundary & academic group assignment guard', () => {
        test('technical admin with PERMISSION_GROUP_MANAGE cannot assign VIEN_TRUONG or GVHD -> 403', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 20,
                email: 'user20@example.com',
                fullName: 'Target User',
                role: 'LECTURER',
            });

            prisma.permissionGroup.findMany.mockResolvedValue([
                { id: 2, code: 'GVHD', isSystem: true },
            ]);

            const req = createMockReq({
                user: {
                    id: 1,
                    role: 'ADMIN',
                    permissions: ['PERMISSION_GROUP_MANAGE'], // Does not have PERMISSION_ASSIGN_ACADEMIC
                },
                params: { id: '20' },
                body: { groupIds: [2] },
            });
            const res = createMockRes();
            const next = createNext();

            await updateUserPermissionGroups(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'FORBIDDEN_ACADEMIC_GROUP_ASSIGNMENT',
                })
            );
        });

        test('academic authority with PERMISSION_ASSIGN_ACADEMIC can assign academic groups and increments target permissionVersion', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 20,
                email: 'user20@example.com',
                fullName: 'Target User',
                role: 'LECTURER',
            });

            prisma.permissionGroup.findMany.mockResolvedValue([
                { id: 2, code: 'GVHD', isSystem: true },
            ]);

            const req = createMockReq({
                user: {
                    id: 99,
                    role: 'LECTURER',
                    permissions: ['PERMISSION_GROUP_MANAGE', 'PERMISSION_ASSIGN_ACADEMIC'],
                },
                params: { id: '20' },
                body: { groupIds: [2] },
            });
            const res = createMockRes();
            const next = createNext();

            await updateUserPermissionGroups(req, res, next);

            expect(res.status).not.toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                })
            );
            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 20 },
                    data: { permissionVersion: { increment: 1 } },
                })
            );
        });
    });
});
