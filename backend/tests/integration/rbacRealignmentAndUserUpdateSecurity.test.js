const mockPrisma = {
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
    studentProfile: {
        upsert: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
    councilMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    permissionGroup: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    permissionGroupPermission: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
    userPermissionGroup: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
    },
    auditLog: {
        create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { DEFAULT_GROUPS, ACADEMIC_PROTECTED_PERMISSIONS } = require('../../src/constants/permissions');

describe('Integration - RBAC Realignment & User Update Anti-Escalation (Task 1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
        jwt.verify.mockImplementation((token) => {
            if (token === 'tech-admin-token') {
                return { userId: 1, role: 'ADMIN' };
            }
            if (token === 'academic-admin-token') {
                return { userId: 9, role: 'ADMIN' };
            }
            throw new Error('invalid token');
        });
    });

    describe('1. RBAC Group Re-alignment Invariants', () => {
        test('QUAN_TRI_VIEN group contains zero academic protected permissions', () => {
            const techAdminGroup = DEFAULT_GROUPS.find((g) => g.code === 'QUAN_TRI_VIEN');
            expect(techAdminGroup).toBeDefined();

            const violating = techAdminGroup.permissions.filter((p) =>
                ACADEMIC_PROTECTED_PERMISSIONS.includes(p)
            );
            expect(violating).toEqual([]);
        });

        test('GIAO_VU and VIEN_TRUONG groups retain academic review and lock permissions', () => {
            const giaoVuGroup = DEFAULT_GROUPS.find((g) => g.code === 'GIAO_VU');
            const vienTruongGroup = DEFAULT_GROUPS.find((g) => g.code === 'VIEN_TRUONG');

            expect(giaoVuGroup).toBeDefined();
            expect(vienTruongGroup).toBeDefined();

            const expectedAcademicPerms = [
                'RUBRIC_LOCK',
                'DEFENSE_SCOREBOOK_RETURN',
                'ARCHIVE_ACADEMIC_AFFAIRS_REVIEW',
            ];

            for (const perm of expectedAcademicPerms) {
                expect(giaoVuGroup.permissions).toContain(perm);
                expect(vienTruongGroup.permissions).toContain(perm);
            }
        });
    });

    describe('2. Technical Admin assigns QUAN_TRI_VIEN group without 403 deadlock', () => {
        test('technical admin successfully assigns QUAN_TRI_VIEN group to a technician user (200 OK)', async () => {
            // Technical Admin Actor (has USER_MANAGE and PERMISSION_GROUP_MANAGE, but NO academic delegation)
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === 1) {
                    return {
                        id: 1,
                        role: 'ADMIN',
                        fullName: 'Tech Admin',
                        code: 'ADM_TECH',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [
                            {
                                permissionGroup: {
                                    code: 'QUAN_TRI_VIEN',
                                    permissions: [
                                        { permission: { code: 'USER_MANAGE' } },
                                        { permission: { code: 'PERMISSION_GROUP_MANAGE' } },
                                    ],
                                },
                            },
                        ],
                    };
                }
                if (where.id === 2) {
                    return {
                        id: 2,
                        role: 'ADMIN',
                        fullName: 'Technician Staff',
                        code: 'ADM_STAFF',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [],
                    };
                }
                return null;
            });

            // Group 10 is QUAN_TRI_VIEN
            const quanTriVienGroup = DEFAULT_GROUPS.find((g) => g.code === 'QUAN_TRI_VIEN');
            mockPrisma.permissionGroup.findMany.mockResolvedValue([
                {
                    id: 10,
                    code: 'QUAN_TRI_VIEN',
                    name: 'Quản trị viên',
                    permissions: quanTriVienGroup.permissions.map((code) => ({
                        permission: { code },
                    })),
                },
            ]);

            const res = await request(app)
                .post('/api/users/2/permission-groups')
                .set('Authorization', 'Bearer tech-admin-token')
                .send({ groupIds: [10] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('3. Anti-Escalation & Role Modification Guards in updateUser', () => {
        test('admin attempts to change their own role -> fails with 403 FORBIDDEN', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 1,
                role: 'ADMIN',
                fullName: 'Tech Admin',
                code: 'ADM_TECH',
                isActive: true,
                permissionVersion: 1,
                permissionGroups: [
                    {
                        permissionGroup: {
                            code: 'QUAN_TRI_VIEN',
                            permissions: [{ permission: { code: 'USER_MANAGE' } }],
                        },
                    },
                ],
            });

            const res = await request(app)
                .put('/api/users/1')
                .set('Authorization', 'Bearer tech-admin-token')
                .send({ role: 'STUDENT' });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Không thể tự thay đổi vai trò của chính mình');
        });

        test('admin without PERMISSION_ASSIGN_ACADEMIC attempts to promote user to ADMIN -> fails with 403 FORBIDDEN', async () => {
            // Tech admin without academic delegation
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === 1) {
                    return {
                        id: 1,
                        role: 'ADMIN',
                        fullName: 'Tech Admin',
                        code: 'ADM_TECH',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [
                            {
                                permissionGroup: {
                                    code: 'QUAN_TRI_VIEN',
                                    permissions: [{ permission: { code: 'USER_MANAGE' } }],
                                },
                            },
                        ],
                    };
                }
                if (where.id === 3) {
                    return {
                        id: 3,
                        role: 'LECTURER',
                        fullName: 'Lecturer User',
                        code: 'GV001',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [],
                    };
                }
                return null;
            });

            const res = await request(app)
                .put('/api/users/3')
                .set('Authorization', 'Bearer tech-admin-token')
                .send({ role: 'ADMIN' });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Quản trị viên kỹ thuật không có thẩm quyền nâng người dùng lên vai trò Quản trị viên');
        });

        test('fails with 400 when attempting to change role of student with active topic registration', async () => {
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === 1) {
                    return {
                        id: 1,
                        role: 'ADMIN',
                        fullName: 'Tech Admin',
                        code: 'ADM_TECH',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [
                            {
                                permissionGroup: {
                                    code: 'QUAN_TRI_VIEN',
                                    permissions: [{ permission: { code: 'USER_MANAGE' } }],
                                },
                            },
                        ],
                    };
                }
                if (where.id === 4) {
                    return {
                        id: 4,
                        role: 'STUDENT',
                        fullName: 'Active Student',
                        code: 'SV001',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [],
                    };
                }
                return null;
            });

            // Student has active registration in progress
            mockPrisma.topicRegistration.findFirst.mockResolvedValue({
                id: 101,
                studentId: 4,
                status: 'IN_PROGRESS',
            });

            const res = await request(app)
                .put('/api/users/4')
                .set('Authorization', 'Bearer tech-admin-token')
                .send({ role: 'LECTURER' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD');
            expect(res.body.message).toBe('Không thể đổi vai trò khi sinh viên đang có đề tài đồ án hoạt động');
        });

        test('fails with 400 when attempting to change role of lecturer actively mentoring or on council', async () => {
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === 1) {
                    return {
                        id: 1,
                        role: 'ADMIN',
                        fullName: 'Tech Admin',
                        code: 'ADM_TECH',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [
                            {
                                permissionGroup: {
                                    code: 'QUAN_TRI_VIEN',
                                    permissions: [{ permission: { code: 'USER_MANAGE' } }],
                                },
                            },
                        ],
                    };
                }
                if (where.id === 5) {
                    return {
                        id: 5,
                        role: 'LECTURER',
                        fullName: 'Active Mentor',
                        code: 'GV002',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [],
                    };
                }
                return null;
            });

            // Lecturer actively mentoring topic
            mockPrisma.topicRegistration.findFirst.mockResolvedValue({
                id: 202,
                topic: { mentorId: 5 },
                status: 'DEFENSE_READY',
            });

            const res = await request(app)
                .put('/api/users/5')
                .set('Authorization', 'Bearer tech-admin-token')
                .send({ role: 'STUDENT' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD');
            expect(res.body.message).toBe('Không thể đổi vai trò khi giảng viên đang hướng dẫn đề tài hoặc tham gia hội đồng hoạt động');
        });

        test('authorized role change updates role, swaps permission groups and logs audit event', async () => {
            // Academic admin with PERMISSION_ASSIGN_ACADEMIC
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === 9) {
                    return {
                        id: 9,
                        role: 'ADMIN',
                        fullName: 'Academic Director',
                        code: 'DIR01',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [
                            {
                                permissionGroup: {
                                    code: 'VIEN_TRUONG',
                                    permissions: [
                                        { permission: { code: 'USER_MANAGE' } },
                                        { permission: { code: 'PERMISSION_ASSIGN_ACADEMIC' } },
                                    ],
                                },
                            },
                        ],
                    };
                }
                if (where.id === 6) {
                    return {
                        id: 6,
                        role: 'LECTURER',
                        fullName: 'Transition Lecturer',
                        code: 'GV003',
                        email: 'transition@example.test',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [
                            {
                                permissionGroup: {
                                    code: 'GVHD',
                                },
                            },
                        ],
                    };
                }
                return null;
            });

            // No active registrations or council assignments
            mockPrisma.topicRegistration.findFirst.mockResolvedValue(null);
            mockPrisma.councilMember.findFirst.mockResolvedValue(null);

            // Group lookup mocks
            mockPrisma.permissionGroup.findUnique.mockImplementation(async ({ where }) => {
                if (where.code === 'SYSTEM_STUDENT_BASE') {
                    return { id: 20, code: 'SYSTEM_STUDENT_BASE', name: 'Sinh viên cơ sở' };
                }
                if (where.code === 'GVHD') {
                    return { id: 30, code: 'GVHD', name: 'Giảng viên hướng dẫn' };
                }
                return null;
            });

            mockPrisma.user.update.mockResolvedValue({
                id: 6,
                role: 'STUDENT',
                fullName: 'Transition Lecturer',
                code: 'GV003',
                email: 'transition@example.test',
                isActive: true,
            });

            const res = await request(app)
                .put('/api/users/6')
                .set('Authorization', 'Bearer academic-admin-token')
                .send({ role: 'STUDENT' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Old GVHD group removed
            expect(mockPrisma.userPermissionGroup.deleteMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 6,
                    }),
                })
            );

            // Default student group assigned
            expect(mockPrisma.userPermissionGroup.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 6,
                        permissionGroupId: 20,
                    }),
                })
            );

            // AuditLog created with UPDATE_USER_ROLE
            expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        action: 'UPDATE_USER_ROLE',
                        entityType: 'User',
                        entityId: '6',
                    }),
                })
            );
        });
    });
});
