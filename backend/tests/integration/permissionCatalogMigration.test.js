const mockPrisma = {
    permissionGroup: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
    },
    permission: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
    },
    permissionGroupPermission: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
    },
    userPermissionGroup: {
        findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const { DEFAULT_GROUPS, CANONICAL_ALIAS_MAP } = require('../../src/constants/permissions');
const {
    seedPermissionCatalog,
    deleteGroup,
    updateGroup,
} = require('../../src/services/permissionService');
const { isCanonicalPermissionCode, normalizePermissionCode } = require('../../src/auth/permissionCatalog');

describe('Task 2: Protect System Groups and Canonicalize Stored Permissions', () => {
    const SYSTEM_GROUP_CODES = [
        'SYSTEM_STUDENT_BASE',
        'GVHD',
        'GIAO_VU',
        'VIEN_TRUONG',
        'QUAN_TRI_VIEN',
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('1. System groups declaration in DEFAULT_GROUPS', () => {
        test.each(SYSTEM_GROUP_CODES)(
            'nhóm %s phải có isSystem: true trong DEFAULT_GROUPS',
            (groupCode) => {
                const group = DEFAULT_GROUPS.find((g) => g.code === groupCode);
                expect(group).toBeDefined();
                expect(group.isSystem).toBe(true);
            }
        );

        test('tất cả permission trong DEFAULT_GROUPS đều hợp lệ và normalize được về canonical code', () => {
            for (const group of DEFAULT_GROUPS) {
                for (const perm of group.permissions) {
                    const canonical = normalizePermissionCode(perm);
                    expect(canonical).not.toBeNull();
                    expect(isCanonicalPermissionCode(canonical)).toBe(true);
                }
            }
        });
    });

    describe('2. seedPermissionCatalog preserves isSystem: true for system groups', () => {
        test('seed cập nhật hoặc tạo mới nhóm hệ thống với isSystem: true kể cả khi gọi nhiều lần', async () => {
            const fakePermissions = [
                { id: 101, code: 'TOPIC_CREATE' },
                { id: 102, code: 'VIEW_MY_REGISTRATION' },
            ];
            mockPrisma.permission.upsert.mockResolvedValue({});
            mockPrisma.permission.findMany.mockResolvedValue(fakePermissions);
            mockPrisma.permissionGroup.findUnique.mockImplementation(async ({ where }) => {
                if (SYSTEM_GROUP_CODES.includes(where.code)) {
                    return { id: 1, code: where.code, isSystem: true };
                }
                return null;
            });
            mockPrisma.permissionGroup.update.mockResolvedValue({});
            mockPrisma.permissionGroup.create.mockResolvedValue({});
            mockPrisma.permissionGroupPermission.deleteMany.mockResolvedValue({});

            await seedPermissionCatalog(mockPrisma);

            // Kiểm tra các lệnh update nhóm hệ thống
            const updateCalls = mockPrisma.permissionGroup.update.mock.calls;
            expect(updateCalls.length).toBeGreaterThan(0);
            for (const call of updateCalls) {
                expect(call[0].data.isSystem).toBe(true);
            }
        });
    });

    describe('3. Protected system groups cannot be deleted or have code altered', () => {
        test.each(SYSTEM_GROUP_CODES)(
            'deleteGroup từ chối xóa nhóm hệ thống %s với lỗi 403',
            async (groupCode) => {
                mockPrisma.permissionGroup.findUnique.mockResolvedValue({
                    id: 42,
                    code: groupCode,
                    name: groupCode,
                    isSystem: true,
                    permissions: [],
                });

                await expect(deleteGroup(42, { id: 1 })).rejects.toMatchObject({
                    statusCode: 403,
                });
                expect(mockPrisma.permissionGroup.delete).not.toHaveBeenCalled();
            }
        );

        test('updateGroup không cho phép sửa code của nhóm hệ thống', async () => {
            mockPrisma.permissionGroup.findUnique.mockResolvedValue({
                id: 1,
                code: 'GVHD',
                name: 'Giảng viên hướng dẫn',
                isSystem: true,
                permissions: [],
            });

            await expect(
                updateGroup(1, { code: 'GVHD_MODIFIED', name: 'GVHD Mới' }, { id: 1 })
            ).rejects.toMatchObject({
                statusCode: 403,
            });
            expect(mockPrisma.permissionGroup.update).not.toHaveBeenCalled();
        });
    });

    describe('4. Canonicalization of stored group permissions', () => {
        test('hàm seed / canonicalizer ánh xạ alias code về canonical ID khi nạp quyền vào nhóm', async () => {
            mockPrisma.permission.upsert.mockResolvedValue({});
            mockPrisma.permission.findMany.mockImplementation(async ({ where }) => {
                const codes = where?.code?.in || [];
                // Tất cả các codes được query phải là canonical code
                for (const c of codes) {
                    expect(isCanonicalPermissionCode(c)).toBe(true);
                }
                return codes.map((c, idx) => ({ id: idx + 1, code: c }));
            });
            mockPrisma.permissionGroup.findUnique.mockResolvedValue(null);
            mockPrisma.permissionGroup.create.mockResolvedValue({ id: 10 });
            mockPrisma.permissionGroupPermission.deleteMany.mockResolvedValue({});

            await seedPermissionCatalog(mockPrisma);

            const createCalls = mockPrisma.permissionGroup.create.mock.calls;
            expect(createCalls.length).toBe(DEFAULT_GROUPS.length);
            for (const call of createCalls) {
                expect(call[0].data.isSystem).toBe(true);
            }
        });
    });
});
