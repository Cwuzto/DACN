const mockPrisma = {
    user: {
        findUnique: jest.fn(),
    },
    academicDelegation: {
        findMany: jest.fn(),
    },
};

jest.mock('../../src/config/database', () => mockPrisma);

const {
    resolveUserCapabilities,
    getEffectivePermissions,
    clearAuthCache,
    getAuthCacheStats,
} = require('../../src/auth/capabilityResolver');
const { STUDENT_BASE_PERMISSIONS, DEFAULT_GROUPS } = require('../../src/constants/permissions');

describe('Task 3: Unified Capability Resolver Unit Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        clearAuthCache();
    });

    describe('1. resolveUserCapabilities baseline', () => {
        test('trả về null nếu user không tồn tại hoặc isActive = false', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);
            const res1 = await resolveUserCapabilities({ userId: 999, db: mockPrisma, bypassCache: true });
            expect(res1).toBeNull();

            mockPrisma.user.findUnique.mockResolvedValue({ id: 10, isActive: false });
            const res2 = await resolveUserCapabilities({ userId: 10, db: mockPrisma, bypassCache: true });
            expect(res2).toBeNull();
        });

        test('trả về ResolvedIdentity với canonical basePermissions và compatibility permissions cho sinh viên fallback', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 1,
                email: 'student@test.vn',
                fullName: 'Sinh Viên Test',
                code: 'SV001',
                role: 'STUDENT',
                department: 'CNTT',
                phone: '0123456789',
                avatarUrl: null,
                isActive: true,
                permissionVersion: 1,
                studentProfile: { className: 'CNTT-K45', major: 'CNTT' },
                permissionGroups: [],
                councilMembers: [],
            });
            mockPrisma.academicDelegation.findMany.mockResolvedValue([]);

            const identity = await resolveUserCapabilities({ userId: 1, db: mockPrisma, bypassCache: true });

            expect(identity).not.toBeNull();
            expect(identity.id).toBe(1);
            expect(identity.role).toBe('STUDENT');
            expect(identity.permissionGroups).toEqual([]);
            expect(identity.basePermissions).toEqual(expect.arrayContaining([...STUDENT_BASE_PERMISSIONS]));
            expect(identity.permissions).toEqual(expect.arrayContaining([...STUDENT_BASE_PERMISSIONS]));
            expect(identity.activeDelegations).toEqual([]);
            expect(identity.hasDefenseCouncilAssignment).toBe(false);
            expect(identity.hasOutlineCouncilAssignment).toBe(false);
        });

        test('trả về fallback GVHD permissions cho LECTURER khi chưa có nhóm quyền', async () => {
            const gvhdGroup = DEFAULT_GROUPS.find((g) => g.code === 'GVHD');
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 2,
                email: 'gvhd@test.vn',
                fullName: 'Giảng Viên Test',
                code: 'GV001',
                role: 'LECTURER',
                department: 'CNTT',
                isActive: true,
                permissionVersion: 1,
                permissionGroups: [],
                councilMembers: [
                    { id: 10, council: { councilType: 'DEFENSE_COUNCIL' } },
                ],
            });
            mockPrisma.academicDelegation.findMany.mockResolvedValue([]);

            const identity = await resolveUserCapabilities({ userId: 2, db: mockPrisma, bypassCache: true });

            expect(identity).not.toBeNull();
            expect(identity.role).toBe('LECTURER');
            expect(identity.basePermissions).toEqual(expect.arrayContaining(gvhdGroup.permissions));
            expect(identity.hasDefenseCouncilAssignment).toBe(true);
            expect(identity.hasOutlineCouncilAssignment).toBe(false);
        });

        test('chuẩn hóa alias code sang canonical trong basePermissions', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 3,
                email: 'admin@test.vn',
                fullName: 'Admin Test',
                code: 'AD001',
                role: 'ADMIN',
                isActive: true,
                permissionVersion: 2,
                permissionGroups: [
                    {
                        permissionGroup: {
                            code: 'CUSTOM_GROUP',
                            permissions: [
                                { permission: { code: 'VIEW_ALL_TOPICS' } }, // alias của TOPIC_REVIEW
                                { permission: { code: 'VIEW_NOTIFICATIONS' } }, // alias của NOTIFICATION_MANAGE
                                { permission: { code: 'USER_MANAGE' } }, // canonical
                            ],
                        },
                    },
                ],
                councilMembers: [],
            });
            mockPrisma.academicDelegation.findMany.mockResolvedValue([]);

            const identity = await resolveUserCapabilities({ userId: 3, db: mockPrisma, bypassCache: true });

            expect(identity.basePermissions).toContain('TOPIC_REVIEW');
            expect(identity.basePermissions).toContain('NOTIFICATION_MANAGE');
            expect(identity.basePermissions).toContain('USER_MANAGE');
            expect(identity.basePermissions).not.toContain('VIEW_ALL_TOPICS');
            expect(identity.basePermissions).not.toContain('VIEW_NOTIFICATIONS');
        });
    });

    describe('2. Active delegations resolution', () => {
        test('nạp đúng active delegations và không bao gồm delegations hết hạn hoặc REVOKED', async () => {
            const now = new Date('2026-11-17T10:00:00Z');
            mockPrisma.user.findUnique.mockResolvedValue({
                id: 4,
                email: 'delegatee@test.vn',
                role: 'LECTURER',
                department: 'CNTT',
                isActive: true,
                permissionVersion: 1,
                permissionGroups: [],
                councilMembers: [],
            });

            mockPrisma.academicDelegation.findMany.mockResolvedValue([
                {
                    id: 101,
                    capabilityCode: 'OUTLINE_APPROVE',
                    department: 'CNTT',
                    semesterId: 1,
                    effectiveFrom: new Date('2026-11-01T00:00:00Z'),
                    effectiveTo: new Date('2026-12-01T00:00:00Z'),
                    delegatorId: 99,
                },
            ]);

            const identity = await resolveUserCapabilities({
                userId: 4,
                at: now,
                db: mockPrisma,
                bypassCache: true,
            });

            expect(mockPrisma.academicDelegation.findMany).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    delegateeId: 4,
                    status: 'ACTIVE',
                    effectiveFrom: { lte: now },
                    effectiveTo: { gte: now },
                }),
                select: expect.any(Object),
            });
            expect(identity.activeDelegations).toHaveLength(1);
            expect(identity.activeDelegations[0].capabilityCode).toBe('OUTLINE_APPROVE');
        });
    });

    describe('3. getEffectivePermissions scope evaluation', () => {
        const sampleIdentity = {
            id: 5,
            role: 'LECTURER',
            basePermissions: ['TOPIC_CREATE', 'TOPIC_UPDATE_OWN'],
            activeDelegations: [
                {
                    id: 1,
                    capabilityCode: 'OUTLINE_APPROVE',
                    department: 'CNTT',
                    semesterId: 10,
                },
                {
                    id: 2,
                    capabilityCode: 'BM02_REVIEW',
                    department: 'KHMT',
                    semesterId: 10,
                },
                {
                    id: 3,
                    capabilityCode: 'REPORT_VIEW',
                    department: 'CNTT',
                    semesterId: 20,
                },
                {
                    id: 4,
                    capabilityCode: 'PORTAL_CONTENT_MANAGE',
                    department: null,
                    semesterId: null,
                },
            ],
        };

        test('chỉ trả về basePermissions khi context không khớp bất kỳ delegation nào', () => {
            const effective = getEffectivePermissions(sampleIdentity, { semesterId: 99, department: 'DIEN' });
            expect(effective.has('TOPIC_CREATE')).toBe(true);
            expect(effective.has('OUTLINE_APPROVE')).toBe(false);
            expect(effective.has('BM02_REVIEW')).toBe(false);
            expect(effective.has('REPORT_VIEW')).toBe(false);
            // Delegation global (null semester, null department) được áp dụng
            expect(effective.has('PORTAL_CONTENT_MANAGE')).toBe(true);
        });

        test('áp dụng delegation đúng cả semesterId và department', () => {
            const effective = getEffectivePermissions(sampleIdentity, { semesterId: 10, department: 'CNTT' });
            expect(effective.has('TOPIC_CREATE')).toBe(true);
            expect(effective.has('OUTLINE_APPROVE')).toBe(true);
            expect(effective.has('BM02_REVIEW')).toBe(false); // sai department
            expect(effective.has('REPORT_VIEW')).toBe(false); // sai semester
        });

        test('từ chối delegation khi thiếu department hoặc department không khớp', () => {
            const effective = getEffectivePermissions(sampleIdentity, { semesterId: 10 });
            expect(effective.has('OUTLINE_APPROVE')).toBe(false);
            expect(effective.has('BM02_REVIEW')).toBe(false);
        });
    });
});
