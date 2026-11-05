const mockManualReviewCase = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
};

const mockTopicRegistration = {
    update: jest.fn(),
};

const mockPrisma = {
    user: { findUnique: jest.fn() },
    manualReviewCase: mockManualReviewCase,
    topicRegistration: mockTopicRegistration,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('../../scripts/workflow-integrity/backfillWorkflowFoundation', () => ({
    ensurePolicy: jest.fn().mockResolvedValue({ id: 100, version: 1 }),
}));

jest.mock('../../src/services/registrationTransitionService', () => ({
    transitionRegistration: jest.fn().mockResolvedValue({ id: 50, status: 'IN_PROGRESS' }),
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');


function buildUser(id, role, permissions = []) {
    return {
        id,
        role,
        email: `${role.toLowerCase()}@test.vn`,
        fullName: `User ${role}`,
        code: `${role}-${id}`,
        isActive: true,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: 'TEST_GROUP',
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
    };
}

describe('Integration - Manual Review Cases Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'manual-review-secret';
        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 20, role: 'LECTURER' };
            throw new Error('invalid token');
        });
        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) return buildUser(1, 'ADMIN', ['PROJECT_OVERSIGHT_MANAGE']);
            if (where.id === 10) return buildUser(10, 'STUDENT');
            if (where.id === 20) return buildUser(20, 'LECTURER');
            return null;
        });
    });

    test('chặn người dùng không phải ADMIN truy cập danh sách', async () => {
        const res = await request(app)
            .get('/api/manual-review-cases')
            .set('Authorization', 'Bearer student-token');
        expect(res.status).toBe(403);
    });

    test('ADMIN lấy danh sách hồ sơ cần thẩm định thủ công thành công', async () => {
        prisma.manualReviewCase.findMany.mockResolvedValue([
            { id: 1, status: 'OPEN', reasonCodes: ['LEGACY_BYPASS_EVIDENCE'], registration: { id: 101 } },
        ]);
        prisma.manualReviewCase.count.mockResolvedValue(1);

        const res = await request(app)
            .get('/api/manual-review-cases?status=OPEN')
            .set('Authorization', 'Bearer admin-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.cases).toHaveLength(1);
        expect(res.body.data.pagination.total).toBe(1);
    });

    test('ADMIN xem chi tiết một ca thẩm định', async () => {
        prisma.manualReviewCase.findUnique.mockResolvedValue({
            id: 1,
            status: 'OPEN',
            registration: { id: 101, status: 'IN_PROGRESS' },
        });

        const res = await request(app)
            .get('/api/manual-review-cases/1')
            .set('Authorization', 'Bearer admin-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(1);
    });

    test('ADMIN giải quyết ca thẩm định thủ công (RESOLVE) thành công', async () => {
        prisma.manualReviewCase.findUnique.mockResolvedValue({
            id: 1,
            status: 'OPEN',
            registrationId: 101,
            registration: { id: 101, semesterId: 5, status: 'IN_PROGRESS', stateVersion: 2, periodPolicyVersionId: null },
        });
        prisma.manualReviewCase.update.mockResolvedValue({
            id: 1,
            status: 'RESOLVED',
        });

        const res = await request(app)
            .post('/api/manual-review-cases/1/resolve')
            .set('Authorization', 'Bearer admin-token')
            .send({
                resolution: 'Đã xác minh minh chứng hợp lệ từ hệ thống cũ và gán policy',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(prisma.manualReviewCase.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: 'RESOLVED',
                    resolution: 'Đã xác minh minh chứng hợp lệ từ hệ thống cũ và gán policy',
                    resolvedById: 1,
                }),
            }),
        );
    });
});
