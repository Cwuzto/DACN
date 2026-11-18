const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockSemester = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockTopic = {
    count: jest.fn(),
    deleteMany: jest.fn(),
};

const mockTopicRegistration = {
    count: jest.fn(),
    deleteMany: jest.fn(),
};

const mockCouncil = {
    count: jest.fn(),
    deleteMany: jest.fn(),
};

const mockPeriodWorkflowPolicyVersion = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
};

const mockRubricVersion = {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
};

const mockRubricCategory = {
    deleteMany: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
};

const mockPrisma = {
    semester: mockSemester,
    topic: mockTopic,
    topicRegistration: mockTopicRegistration,
    council: mockCouncil,
    periodWorkflowPolicyVersion: mockPeriodWorkflowPolicyVersion,
    rubricVersion: mockRubricVersion,
    rubricCategory: mockRubricCategory,
    user: mockUser,
    $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
            return cb(mockPrisma);
        }
        return Promise.all(cb);
    }),
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const app = require('../../src/app');
const { createPolicyVersion, getActivePolicyVersion, DEFAULT_POLICY } = require('../../src/services/workflowPolicyService');

describe('Integration - Semester Deletion and Policy Integrity (P0.1, P1.4)', () => {
    const adminUser = {
        id: 1,
        email: 'admin@example.com',
        fullName: 'Admin User',
        code: 'AD001',
        role: 'ADMIN',
        department: 'PDT',
        isActive: true,
        permissionGroups: [{
            permissionGroup: {
                code: 'QUAN_TRI_VIEN',
                permissions: [
                    { permission: { code: 'SEMESTER_MANAGE' } },
                    { permission: { code: 'PROJECT_ASSIGNMENT_PUBLISH' } },
                ],
            },
        }],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 1) return adminUser;
            return null;
        });
    });

    describe('DELETE /api/semesters/:id - Semester Deletion Safety', () => {
        test('returns 409 PERIOD_NOT_EMPTY when semester has TopicRegistration', async () => {
            mockSemester.findUnique.mockResolvedValue({
                id: 10,
                name: 'HK1 2026-2027',
                code: 'DATN-HK1-2026-27',
            });
            mockTopic.count.mockResolvedValue(0);
            mockTopicRegistration.count.mockResolvedValue(3);
            mockCouncil.count.mockResolvedValue(0);

            const res = await request(app)
                .delete('/api/semesters/10')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(409);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('PERIOD_NOT_EMPTY');
            expect(res.body.message).toMatch(/Không thể xóa đợt đồ án đã có dữ liệu học vụ/i);

            // Crucial: No data was cascade-deleted
            expect(mockTopicRegistration.deleteMany).not.toHaveBeenCalled();
            expect(mockTopic.deleteMany).not.toHaveBeenCalled();
            expect(mockCouncil.deleteMany).not.toHaveBeenCalled();
            expect(mockSemester.delete).not.toHaveBeenCalled();
        });

        test('returns 409 PERIOD_NOT_EMPTY when semester has Topic or Council', async () => {
            mockSemester.findUnique.mockResolvedValue({
                id: 11,
                name: 'HK2 2026-2027',
                code: 'DATN-HK2-2026-27',
            });
            mockTopic.count.mockResolvedValue(2);
            mockTopicRegistration.count.mockResolvedValue(0);
            mockCouncil.count.mockResolvedValue(0);

            const res = await request(app)
                .delete('/api/semesters/11')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('PERIOD_NOT_EMPTY');
            expect(mockSemester.delete).not.toHaveBeenCalled();
        });

        test('deletes empty semester and cleans up policy versions and rubrics in a single transaction without orphaned FKs', async () => {
            mockSemester.findUnique.mockResolvedValue({
                id: 12,
                name: 'HK3 2026-2027',
                code: 'DATN-HK3-2026-27',
                lockedPolicyVersionId: 99,
                lockedDefenseRubricVersionId: 88,
            });
            mockTopic.count.mockResolvedValue(0);
            mockTopicRegistration.count.mockResolvedValue(0);
            mockCouncil.count.mockResolvedValue(0);

            mockRubricVersion.findMany.mockResolvedValue([
                { id: 88, semesterId: 12 },
            ]);
            mockSemester.update.mockResolvedValue({ id: 12 });
            mockPeriodWorkflowPolicyVersion.deleteMany.mockResolvedValue({ count: 2 });
            mockRubricCategory.deleteMany.mockResolvedValue({ count: 4 });
            mockRubricVersion.deleteMany.mockResolvedValue({ count: 1 });
            mockSemester.delete.mockResolvedValue({ id: 12 });

            const res = await request(app)
                .delete('/api/semesters/12')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verified run within transaction
            expect(mockPrisma.$transaction).toHaveBeenCalled();

            // 1. Cleared locks on semester
            expect(mockSemester.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 12 },
                    data: expect.objectContaining({
                        lockedPolicyVersionId: null,
                        lockedDefenseRubricVersionId: null,
                    }),
                })
            );

            // 2. Cleaned up policy versions
            expect(mockPeriodWorkflowPolicyVersion.deleteMany).toHaveBeenCalledWith({
                where: { semesterId: 12 },
            });

            // 3. Cleaned up rubrics and rubric categories
            expect(mockRubricCategory.deleteMany).toHaveBeenCalledWith({
                where: { rubricVersionId: { in: [88] } },
            });
            expect(mockRubricVersion.deleteMany).toHaveBeenCalledWith({
                where: { id: { in: [88] } },
            });

            // 4. Deleted semester
            expect(mockSemester.delete).toHaveBeenCalledWith({
                where: { id: 12 },
            });
        });
    });

    describe('workflowPolicyService - Policy Version Lifecycle', () => {
        test('createPolicyVersion deactivates prior versions in transaction ensuring only one active version', async () => {
            let activeVersion = null;
            const policyRecords = [];

            mockPeriodWorkflowPolicyVersion.updateMany.mockImplementation(async ({ where, data }) => {
                let count = 0;
                for (const p of policyRecords) {
                    if (p.semesterId === where.semesterId && (where.isActive === undefined || p.isActive === where.isActive)) {
                        p.isActive = data.isActive;
                        count++;
                    }
                }
                return { count };
            });

            mockPeriodWorkflowPolicyVersion.findFirst.mockImplementation(async ({ where, orderBy }) => {
                const filtered = policyRecords.filter((p) => {
                    if (p.semesterId !== where.semesterId) return false;
                    if (where.isActive !== undefined && p.isActive !== where.isActive) return false;
                    return true;
                });
                if (orderBy?.version === 'desc') {
                    filtered.sort((a, b) => b.version - a.version);
                }
                return filtered[0] || null;
            });

            mockPeriodWorkflowPolicyVersion.create.mockImplementation(async ({ data }) => {
                const record = {
                    id: policyRecords.length + 1,
                    ...data,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                };
                policyRecords.push(record);
                return record;
            });

            // Create initial policy version
            const v1 = await createPolicyVersion({
                semesterId: 100,
                policy: DEFAULT_POLICY,
                createdById: 1,
            }, mockPrisma);

            expect(v1.version).toBe(1);
            expect(v1.isActive).toBe(true);

            // Create second policy version for same semester
            const v2 = await createPolicyVersion({
                semesterId: 100,
                policy: { ...DEFAULT_POLICY, revisionWindowDays: 5 },
                createdById: 1,
            }, mockPrisma);

            expect(v2.version).toBe(2);
            expect(v2.isActive).toBe(true);

            // Previous version v1 must have been deactivated
            expect(mockPeriodWorkflowPolicyVersion.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ semesterId: 100, isActive: true }),
                    data: expect.objectContaining({ isActive: false }),
                })
            );

            const v1Record = policyRecords.find((p) => p.id === v1.id);
            expect(v1Record.isActive).toBe(false);

            const v2Record = policyRecords.find((p) => p.id === v2.id);
            expect(v2Record.isActive).toBe(true);

            // Only one active policy exists
            const activePolicies = policyRecords.filter((p) => p.semesterId === 100 && p.isActive === true);
            expect(activePolicies).toHaveLength(1);
            expect(activePolicies[0].version).toBe(2);
        });
    });
});
