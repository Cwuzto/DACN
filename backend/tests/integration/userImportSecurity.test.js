const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
    studentProfile: {
        create: jest.fn(),
        upsert: jest.fn(),
    },
    permissionGroup: {
        findUnique: jest.fn(),
    },
    userPermissionGroup: {
        create: jest.fn(),
    },
    academicDelegation: {
        findMany: jest.fn(),
    },
    semester: {
        findFirst: jest.fn(),
    },
    $transaction: jest.fn(async (callback) => {
        if (typeof callback === 'function') {
            return callback(mockPrisma);
        }
        return callback;
    }),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashed_password'),
}));

const userController = require('../../src/controllers/userController');
const { DEFAULT_GROUPS } = require('../../src/constants/permissions');
const { authenticate, clearAuthCache } = require('../../src/middlewares/auth');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-123456';

describe('Task 1: User Import Security & RBAC Enforcement', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        clearAuthCache();
        req = {
            query: {},
            body: {},
            headers: {},
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });

    describe('1. Import Excel Role Validation & Anti-Escalation', () => {
        test('rejects import request when role is ADMIN with 400 ADMIN_IMPORT_FORBIDDEN', async () => {
            req.body = {
                role: 'ADMIN',
                items: [{ code: 'ADMIN01', fullName: 'Fake Admin', email: 'admin01@tdmu.edu.vn' }],
                onDuplicate: 'SKIP',
            };

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    code: 'ADMIN_IMPORT_FORBIDDEN',
                    message: expect.stringContaining('Không được phép import tài khoản Quản trị viên'),
                })
            );
        });

        test('rejects import request when role is not STUDENT or LECTURER', async () => {
            req.body = {
                role: 'SUPERADMIN',
                items: [{ code: 'SUPER01', fullName: 'Fake Super', email: 'super@tdmu.edu.vn' }],
                onDuplicate: 'SKIP',
            };

            await userController.importUsersExcel(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    code: 'ADMIN_IMPORT_FORBIDDEN',
                })
            );
        });

        test('does NOT demote existing ADMIN account when updating students on duplicate', async () => {
            const adminCode = 'ADMIN_SECURE';
            const adminEmail = 'admin_secure@tdmu.edu.vn';

            req.body = {
                role: 'STUDENT',
                onDuplicate: 'UPDATE',
                items: [
                    {
                        'MSSV (*)': adminCode,
                        'Họ và tên (*)': 'Admin Name Modified',
                        'Giới tính (*)': 'Nam',
                        'Ngày sinh (*)': '01/01/1990',
                        'Số điện thoại (*)': '0912345678',
                        'Lớp (*)': 'D20CNTT01',
                        'Email (*)': adminEmail,
                        'Ngành (*)': 'Kỹ thuật Phần mềm',
                    },
                ],
            };

            // Existing user in DB is ADMIN
            mockPrisma.user.findMany.mockResolvedValueOnce([
                {
                    id: 99,
                    code: adminCode,
                    email: adminEmail,
                    role: 'ADMIN',
                    department: 'BAN_GIAM_HIEU',
                    academicTitle: 'TIEN_SI',
                },
            ]);

            mockPrisma.user.update.mockResolvedValueOnce({
                id: 99,
                code: adminCode,
                role: 'ADMIN',
            });

            await userController.importUsersExcel(req, res, next);

            expect(res.status).not.toHaveBeenCalledWith(400);
            expect(mockPrisma.user.update).toHaveBeenCalled();

            const updateCallArgs = mockPrisma.user.update.mock.calls[0][0];
            expect(updateCallArgs.where).toEqual({ id: 99 });
            // Must NOT set role to STUDENT
            expect(updateCallArgs.data.role).not.toBe('STUDENT');
            // Must not wipe department/academicTitle
            expect(updateCallArgs.data.department).not.toBeNull();
            // Must NOT create or upsert studentProfile for Admin
            expect(mockPrisma.studentProfile.upsert).not.toHaveBeenCalled();
            expect(mockPrisma.studentProfile.create).not.toHaveBeenCalled();

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({ updatedCount: 1 }),
                })
            );
        });

        test('does NOT demote existing ADMIN account when updating lecturers on duplicate', async () => {
            const adminCode = 'ADMIN_GV';
            const adminEmail = 'admin_gv@tdmu.edu.vn';

            req.body = {
                role: 'LECTURER',
                onDuplicate: 'UPDATE',
                items: [
                    {
                        code: adminCode,
                        fullName: 'Admin Lect Name',
                        email: adminEmail,
                        phone: '0988776655',
                        department: 'CNTT',
                        academicTitle: 'Thạc sĩ',
                    },
                ],
            };

            mockPrisma.user.findFirst.mockResolvedValueOnce({
                id: 100,
                code: adminCode,
                email: adminEmail,
                role: 'ADMIN',
                department: 'BAN_GIAM_HIEU',
                academicTitle: 'TIEN_SI',
                phone: '0988776655',
            });

            mockPrisma.user.update.mockResolvedValueOnce({
                id: 100,
                code: adminCode,
                role: 'ADMIN',
            });

            await userController.importUsersExcel(req, res, next);

            expect(mockPrisma.user.update).toHaveBeenCalled();
            const updateCallArgs = mockPrisma.user.update.mock.calls[0][0];
            expect(updateCallArgs.where).toEqual({ id: 100 });
            expect(updateCallArgs.data.role).not.toBe('LECTURER');
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({ updatedCount: 1 }),
                })
            );
        });
    });

    describe('2. GIAO_VU Permission Group Configuration', () => {
        test('GIAO_VU default group contains VIEW_PROJECT_ENROLLMENTS permission', () => {
            const giaoVuGroup = DEFAULT_GROUPS.find((group) => group.code === 'GIAO_VU');
            expect(giaoVuGroup).toBeDefined();
            expect(giaoVuGroup.permissions).toContain('VIEW_PROJECT_ENROLLMENTS');
        });
    });

    describe('3. Semester Scoped Academic Delegation in Auth Middleware', () => {
        test('filters academic delegation by currentSemesterId when provided', async () => {
            const targetUserId = 77;
            const token = jwt.sign(
                { userId: targetUserId, permissionVersion: 1 },
                process.env.JWT_SECRET || 'secret'
            );

            req.headers.authorization = `Bearer ${token}`;
            req.query.semesterId = '20261';

            mockPrisma.user.findUnique.mockResolvedValueOnce({
                id: targetUserId,
                email: 'delegatee@tdmu.edu.vn',
                fullName: 'Delegatee User',
                code: 'GV_DEL',
                role: 'LECTURER',
                department: 'CNTT',
                isActive: true,
                permissionVersion: 1,
                permissionGroups: [],
                councilMembers: [],
            });

            mockPrisma.academicDelegation.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    capabilityCode: 'TOPIC_ASSIGNMENT_DECISION_ISSUE',
                    department: 'CNTT',
                    effectiveFrom: new Date('2026-01-01'),
                    effectiveTo: new Date('2026-12-31'),
                    delegatorId: 10,
                },
            ]);

            await authenticate(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(req.user).toBeDefined();
            expect(req.user.permissions).toContain('TOPIC_ASSIGNMENT_DECISION_ISSUE');

            expect(mockPrisma.academicDelegation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        delegateeId: targetUserId,
                        status: 'ACTIVE',
                        OR: [{ semesterId: null }, { semesterId: 20261 }],
                    }),
                })
            );
        });

        test('applies only global delegations (semesterId: null) when no semesterId is present', async () => {
            const targetUserId = 78;
            const token = jwt.sign(
                { userId: targetUserId, permissionVersion: 1 },
                process.env.JWT_SECRET || 'secret'
            );

            req.headers.authorization = `Bearer ${token}`;
            // No semesterId in query, headers, or body
            mockPrisma.semester.findFirst.mockResolvedValueOnce(null);

            mockPrisma.user.findUnique.mockResolvedValueOnce({
                id: targetUserId,
                email: 'delegatee2@tdmu.edu.vn',
                fullName: 'Delegatee User 2',
                code: 'GV_DEL_2',
                role: 'LECTURER',
                department: 'CNTT',
                isActive: true,
                permissionVersion: 1,
                permissionGroups: [],
                councilMembers: [],
            });

            mockPrisma.academicDelegation.findMany.mockResolvedValueOnce([]);

            await authenticate(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(mockPrisma.academicDelegation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        delegateeId: targetUserId,
                        status: 'ACTIVE',
                        semesterId: null,
                    }),
                })
            );
        });
    });
});
