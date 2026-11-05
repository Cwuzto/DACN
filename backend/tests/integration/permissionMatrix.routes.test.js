const mockPrisma = {
    user: { findUnique: jest.fn() },
    permissionGroup: { findMany: jest.fn() },
    permission: { findMany: jest.fn(), findUnique: jest.fn() },
    permissionGroupPermission: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        count: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

function buildAdminUser() {
    return {
        id: 1,
        role: 'ADMIN',
        email: 'admin@test.vn',
        fullName: 'Admin User',
        code: 'ADM01',
        isActive: true,
        permissionGroups: [
            {
                permissionGroup: {
                    permissions: [
                        { permission: { code: 'PERMISSION_GROUP_MANAGE' } },
                    ],
                },
            },
        ],
    };
}

describe('Integration - Permission Matrix Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'permission-matrix-secret';
        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            throw new Error('invalid token');
        });
        mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) return buildAdminUser();
            if (where.id === 2) {
                return {
                    id: 2,
                    role: 'LECTURER',
                    email: 'lecturer@test.vn',
                    fullName: 'Lecturer User',
                    code: 'GV01',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });
        mockPrisma.permissionGroup.findMany.mockImplementation(async ({ where } = {}) => {
            const ids = where?.id?.in || [];
            return ids.map((id) => ({ id }));
        });
        mockPrisma.permission.findMany.mockImplementation(async ({ where } = {}) => {
            const ids = where?.id?.in || [];
            return ids.map((id) => ({ id }));
        });
        mockPrisma.permission.findUnique.mockResolvedValue({ id: 99, code: 'PERMISSION_GROUP_MANAGE' });
        mockPrisma.permissionGroupPermission.count.mockResolvedValue(1);
        mockPrisma.auditLog.create.mockResolvedValue({ id: 501 });
    });

    test('GET /api/permissions/matrix trả về đúng cấu trúc roles x modules x role_permissions', async () => {
        mockPrisma.permissionGroup.findMany.mockResolvedValue([
            { id: 1, code: 'GVHD', name: 'Giảng viên hướng dẫn', description: 'GVHD', isSystem: true },
            { id: 2, code: 'VIEN_TRUONG', name: 'Viện trưởng', description: 'Viện trưởng', isSystem: true },
        ]);
        mockPrisma.permission.findMany.mockResolvedValue([
            { id: 10, code: 'TOPIC_CREATE', label: 'Tạo đề tài', module: 'TOPIC' },
            { id: 11, code: 'TOPIC_VIEW', label: 'Xem đề tài', module: 'TOPIC' },
            { id: 20, code: 'DEFENSE_SCORE_SUBMIT', label: 'Chấm bảo vệ', module: 'DEFENSE' },
        ]);
        mockPrisma.permissionGroupPermission.findMany.mockResolvedValue([
            { permissionGroupId: 1, permissionId: 10 },
            { permissionGroupId: 1, permissionId: 11 },
            { permissionGroupId: 2, permissionId: 20 },
        ]);

        const res = await request(app)
            .get('/api/permissions/matrix')
            .set('Authorization', 'Bearer admin-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.roles).toHaveLength(2);
        expect(res.body.data.modules).toHaveLength(2);
        expect(res.body.data.role_permissions['1']).toEqual([10, 11]);
        expect(res.body.data.role_permissions['2']).toEqual([20]);
    });

    test('POST /api/permissions/matrix/bulk cập nhật thành công ma trận', async () => {
        mockPrisma.permissionGroupPermission.deleteMany.mockResolvedValue({ count: 2 });
        mockPrisma.permissionGroupPermission.createMany.mockResolvedValue({ count: 3 });

        const payload = [
            { role_id: 1, permission_ids: [10, 11, 20] },
            { role_id: 2, permission_ids: [20] },
        ];

        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer admin-token')
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockPrisma.permissionGroupPermission.deleteMany).toHaveBeenCalledTimes(2);
        expect(mockPrisma.permissionGroupPermission.createMany).toHaveBeenCalledTimes(2);
        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 1,
                action: 'BULK_UPDATE_PERMISSION_MATRIX',
                entityType: 'PermissionMatrix',
                details: { updatedGroupsCount: 2 },
            }),
        });
        expect(mockPrisma.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            expect.objectContaining({ isolationLevel: 'Serializable' }),
        );
    });

    test('POST /api/permissions/matrix/bulk khóa nhóm theo thứ tự ID ổn định', async () => {
        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer admin-token')
            .send([
                { role_id: 2, permission_ids: [20] },
                { role_id: 1, permission_ids: [10, 99] },
            ]);

        expect(res.status).toBe(200);
        expect(mockPrisma.permissionGroupPermission.deleteMany.mock.calls).toEqual([
            [{ where: { permissionGroupId: 1 } }],
            [{ where: { permissionGroupId: 2 } }],
        ]);
    });

    test('POST /api/permissions/matrix/bulk yêu cầu đăng nhập', async () => {
        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .send([{ role_id: 1, permission_ids: [10] }]);

        expect(res.status).toBe(401);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    test('POST /api/permissions/matrix/bulk từ chối người không có quyền quản trị', async () => {
        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer lecturer-token')
            .send([{ role_id: 1, permission_ids: [10] }]);

        expect(res.status).toBe(403);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    test.each([
        ['payload không phải mảng', { role_id: 1, permission_ids: [10] }],
        ['payload rỗng', []],
        ['role_id không phải số nguyên dương', [{ role_id: 'abc', permission_ids: [10] }]],
        ['permission_ids không phải mảng', [{ role_id: 1, permission_ids: '10' }]],
        ['permission id không phải số nguyên dương', [{ role_id: 1, permission_ids: [0] }]],
        ['role_id bị trùng', [{ role_id: 1, permission_ids: [10] }, { role_id: 1, permission_ids: [11] }]],
        ['permission id bị trùng', [{ role_id: 1, permission_ids: [10, 10] }]],
    ])('POST /api/permissions/matrix/bulk trả 400 khi %s', async (_label, payload) => {
        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer admin-token')
            .send(payload);

        expect(res.status).toBe(400);
        expect(mockPrisma.permissionGroupPermission.deleteMany).not.toHaveBeenCalled();
    });

    test('POST /api/permissions/matrix/bulk trả 400 và không ghi khi group không tồn tại', async () => {
        mockPrisma.permissionGroup.findMany.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer admin-token')
            .send([{ role_id: 404, permission_ids: [10] }]);

        expect(res.status).toBe(400);
        expect(mockPrisma.permissionGroupPermission.deleteMany).not.toHaveBeenCalled();
    });

    test('POST /api/permissions/matrix/bulk trả 400 và không ghi khi permission không tồn tại', async () => {
        mockPrisma.permission.findMany.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer admin-token')
            .send([{ role_id: 1, permission_ids: [404] }]);

        expect(res.status).toBe(400);
        expect(mockPrisma.permissionGroupPermission.deleteMany).not.toHaveBeenCalled();
    });

    test('POST /api/permissions/matrix/bulk trả 409 và rollback khi xóa quyền quản trị cuối cùng', async () => {
        mockPrisma.permissionGroupPermission.count.mockResolvedValue(0);

        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer admin-token')
            .send([{ role_id: 1, permission_ids: [10] }]);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/PERMISSION_GROUP_MANAGE/);
        expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
    });

    test('POST /api/permissions/matrix/bulk không báo thành công khi audit trail thất bại', async () => {
        mockPrisma.auditLog.create.mockRejectedValue(new Error('audit unavailable'));

        const res = await request(app)
            .post('/api/permissions/matrix/bulk')
            .set('Authorization', 'Bearer admin-token')
            .send([{ role_id: 1, permission_ids: [10, 99] }]);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    });
});
