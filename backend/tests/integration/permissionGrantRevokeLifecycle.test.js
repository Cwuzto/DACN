const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockUser = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockPermissionGroup = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockPermission = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
};

const mockUserPermissionGroup = {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
};

const mockPermissionGroupPermission = {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
};

const mockAuditLog = {
    create: jest.fn(),
};

const mockPrisma = {
    user: mockUser,
    permissionGroup: mockPermissionGroup,
    permission: mockPermission,
    userPermissionGroup: mockUserPermissionGroup,
    permissionGroupPermission: mockPermissionGroupPermission,
    auditLog: mockAuditLog,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const app = require('../../src/app');

function buildUser({ id, role, permissions = [], permissionVersion = 1 }) {
    return {
        id,
        role,
        department: 'CNTT',
        email: `${role.toLowerCase()}${id}@test.vn`,
        fullName: `User ${id}`,
        code: `${role}-${id}`,
        isActive: true,
        permissionVersion,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                id: 10,
                code: `GRP_${id}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
        councilMembers: [],
    };
}

describe('Task 6: Permission Grant/Revoke Lifecycle and Protected Matrix Authority', () => {
    const techAdminToken = 'token-tech-admin';
    const academicAssignerToken = 'token-academic-assigner';

    const techAdmin = buildUser({
        id: 1,
        role: 'ADMIN',
        permissions: ['PERMISSION_GROUP_MANAGE', 'USER_MANAGE'],
        permissionVersion: 1,
    });

    const academicAssigner = buildUser({
        id: 2,
        role: 'ADMIN',
        permissions: ['PERMISSION_GROUP_MANAGE', 'PERMISSION_ASSIGN_ACADEMIC'],
        permissionVersion: 1,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === techAdminToken) return { userId: techAdmin.id, role: techAdmin.role, permissionVersion: 1 };
            if (token === academicAssignerToken) return { userId: academicAssigner.id, role: academicAssigner.role, permissionVersion: 1 };
            throw new Error('Invalid token');
        });

        mockUser.findUnique.mockImplementation(({ where }) => {
            if (where.id === techAdmin.id) return Promise.resolve(techAdmin);
            if (where.id === academicAssigner.id) return Promise.resolve(academicAssigner);
            return Promise.resolve(null);
        });

        mockPermissionGroup.findMany.mockImplementation(async ({ where } = {}) => {
            const ids = where?.id?.in || [1, 2];
            return ids.map((id) => ({ id, code: `GRP_${id}`, name: `Group ${id}`, isSystem: false }));
        });

        const allPermissions = [
            { id: 10, code: 'USER_MANAGE' },
            { id: 20, code: 'OUTLINE_APPROVE' },
            { id: 99, code: 'PERMISSION_GROUP_MANAGE' },
        ];

        mockPermission.findMany.mockImplementation(async ({ where } = {}) => {
            if (!where || !where.id) return allPermissions;
            const ids = where.id.in || [where.id];
            return allPermissions.filter((p) => ids.includes(p.id));
        });

        mockPermission.findUnique.mockResolvedValue({ id: 99, code: 'PERMISSION_GROUP_MANAGE' });
        mockPermissionGroupPermission.count.mockResolvedValue(1);
        mockPermissionGroupPermission.deleteMany.mockResolvedValue({ count: 1 });
        mockPermissionGroupPermission.createMany.mockResolvedValue({ count: 1 });
        mockAuditLog.create.mockResolvedValue({ id: 100 });
        mockUser.updateMany.mockResolvedValue({ count: 2 });
    });

    describe('Authority boundary: Technical Admin vs Academic Assigner', () => {
        it('rejects Technical Admin attempting to modify protected academic permissions in bulk matrix with 403 PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN', async () => {
            // Group 1 initially has OUTLINE_APPROVE (protected academic)
            mockPermissionGroupPermission.findMany.mockResolvedValueOnce([
                { permissionGroupId: 1, permissionId: 20, permission: { id: 20, code: 'OUTLINE_APPROVE' } },
            ]);

            // Tech Admin tries to remove OUTLINE_APPROVE and only keep USER_MANAGE
            const res = await request(app)
                .post('/api/permissions/matrix/bulk')
                .set('Authorization', `Bearer ${techAdminToken}`)
                .send([
                    { role_id: 1, permission_ids: [10] }, // Removing 20 (OUTLINE_APPROVE)
                ]);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN');
        });

        it('allows Academic Assigner with PERMISSION_ASSIGN_ACADEMIC to modify protected academic permissions', async () => {
            mockPermissionGroupPermission.findMany.mockResolvedValueOnce([
                { permissionGroupId: 1, permissionId: 20, permission: { id: 20, code: 'OUTLINE_APPROVE' } },
            ]);

            // Academic Assigner (having both PERMISSION_GROUP_MANAGE and PERMISSION_ASSIGN_ACADEMIC) can modify
            mockUserPermissionGroup.findMany.mockResolvedValueOnce([
                { userId: 5 },
                { userId: 6 },
            ]);

            const res = await request(app)
                .post('/api/permissions/matrix/bulk')
                .set('Authorization', `Bearer ${academicAssignerToken}`)
                .send([
                    { role_id: 1, permission_ids: [10] },
                ]);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Lifecycle: Group/matrix mutations increment permissionVersion for all affected users', () => {
        it('increments permissionVersion for all users belonging to modified groups upon matrix update', async () => {
            mockPermissionGroupPermission.findMany.mockResolvedValueOnce([]);

            // Group 1 has users 101 and 102
            mockUserPermissionGroup.findMany.mockResolvedValueOnce([
                { userId: 101 },
                { userId: 102 },
            ]);

            const res = await request(app)
                .post('/api/permissions/matrix/bulk')
                .set('Authorization', `Bearer ${academicAssignerToken}`)
                .send([
                    { role_id: 1, permission_ids: [10] },
                ]);

            expect(res.status).toBe(200);
            // Verify affected users had their version incremented
            expect(mockUser.updateMany).toHaveBeenCalledWith({
                where: { id: { in: expect.arrayContaining([101, 102]) } },
                data: { permissionVersion: { increment: 1 } },
            });
        });

        it('returns 409 PERMISSION_VERSION_STALE for stale GVHD token after REPORT_VIEW revocation and refreshes on /api/auth/me', async () => {
            const gvhdUser = buildUser({
                id: 201,
                role: 'LECTURER',
                permissions: ['VIEW_MY_TOPICS', 'VIEW_MENTOR_STUDENTS'],
                permissionVersion: 2,
            });
            gvhdUser.permissionGroups = [{
                permissionGroup: {
                    id: 2,
                    code: 'GVHD',
                    permissions: [
                        { permission: { code: 'VIEW_MY_TOPICS' } },
                        { permission: { code: 'VIEW_MENTOR_STUDENTS' } },
                    ],
                },
            }];

            jwt.verify.mockImplementation((token) => {
                if (token === 'stale-gvhd-token') {
                    return { userId: 201, role: 'LECTURER', permissionVersion: 1 };
                }
                if (token === 'fresh-gvhd-token') {
                    return { userId: 201, role: 'LECTURER', permissionVersion: 2 };
                }
                throw new Error('Invalid token');
            });

            mockUser.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === 201) return gvhdUser;
                return null;
            });

            const staleRes = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', 'Bearer stale-gvhd-token');

            expect(staleRes.status).toBe(409);
            expect(staleRes.body.error).toBe('PERMISSION_VERSION_STALE');

            const meRes = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer stale-gvhd-token');

            expect(meRes.status).toBe(200);
            expect(meRes.body.data.permissions).not.toContain('REPORT_VIEW');
            expect(meRes.body.data.permissions).toContain('VIEW_MY_TOPICS');

            const freshStatsRes = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', 'Bearer fresh-gvhd-token');

            expect(freshStatsRes.status).toBe(403);
        });
    });
});
