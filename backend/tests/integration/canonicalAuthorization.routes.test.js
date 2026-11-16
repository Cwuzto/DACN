const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockUser = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue(10),
};

const mockPermissionGroup = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
};

const mockPermission = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
};

const mockPermissionGroupPermission = {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
};

const mockPortalTemplate = {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
};

const mockCouncil = {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(5),
};

const mockSemester = {
    findFirst: jest.fn().mockResolvedValue({ id: 1, name: 'HK1' }),
    findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'HK1' }),
};

const mockTopic = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
};

const mockTopicRegistration = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
};

const mockPrisma = {
    user: mockUser,
    permissionGroup: mockPermissionGroup,
    permission: mockPermission,
    permissionGroupPermission: mockPermissionGroupPermission,
    portalTemplate: mockPortalTemplate,
    council: mockCouncil,
    semester: mockSemester,
    topic: mockTopic,
    topicRegistration: mockTopicRegistration,
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/outlineReviewService', () => ({
    submitInitialOutline: jest.fn().mockResolvedValue({ id: 101, status: 'SUBMITTED' }),
    reopenCouncilResults: jest.fn().mockResolvedValue({ id: 99, status: 'REOPENED' }),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const app = require('../../src/app');
const { PERMISSIONS } = require('../../src/constants/permissions');

function buildTestUser(id, role, permissions = []) {
    return {
        id,
        role,
        email: `${role.toLowerCase()}${id}@test.vn`,
        fullName: `User ${id}`,
        code: `${role}-${id}`,
        department: 'CNTT',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GROUP_${id}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
        councilMembers: [],
    };
}

describe('Task 5: Canonical Authorization Routes Matrix and Separation of View vs Action Guards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'token-view-reports') return { userId: 10, role: 'LECTURER', permissionVersion: 1 };
            if (token === 'token-admin-no-perm') return { userId: 11, role: 'ADMIN', permissionVersion: 1 };
            if (token === 'token-view-permissions') return { userId: 12, role: 'ADMIN', permissionVersion: 1 };
            if (token === 'token-manage-permissions') return { userId: 13, role: 'ADMIN', permissionVersion: 1 };
            if (token === 'token-view-portal') return { userId: 14, role: 'LECTURER', permissionVersion: 1 };
            if (token === 'token-manage-portal') return { userId: 15, role: 'ADMIN', permissionVersion: 1 };
            if (token === 'token-student-with-cap') return { userId: 16, role: 'STUDENT', permissionVersion: 1 };
            if (token === 'token-student-no-cap') return { userId: 17, role: 'STUDENT', permissionVersion: 1 };
            if (token === 'token-council-manage') return { userId: 18, role: 'LECTURER', permissionVersion: 1 };
            throw new Error('Invalid token');
        });

        mockUser.findUnique.mockImplementation(({ where }) => {
            if (where.id === 10) return Promise.resolve(buildTestUser(10, 'LECTURER', [PERMISSIONS.VIEW_PROJECT_OVERSIGHT]));
            if (where.id === 11) return Promise.resolve(buildTestUser(11, 'ADMIN', [])); // Admin without permissions
            if (where.id === 12) return Promise.resolve(buildTestUser(12, 'ADMIN', [PERMISSIONS.VIEW_PERMISSIONS, PERMISSIONS.VIEW_PERMISSION_GROUPS]));
            if (where.id === 13) return Promise.resolve(buildTestUser(13, 'ADMIN', [PERMISSIONS.PERMISSION_GROUP_MANAGE]));
            if (where.id === 14) return Promise.resolve(buildTestUser(14, 'LECTURER', [PERMISSIONS.VIEW_PORTAL_CONTENT]));
            if (where.id === 15) return Promise.resolve(buildTestUser(15, 'ADMIN', [PERMISSIONS.PORTAL_CONTENT_MANAGE]));
            if (where.id === 16) return Promise.resolve(buildTestUser(16, 'STUDENT', [PERMISSIONS.SUBMIT_BM01]));
            // Student explicitly having non-empty permissions lacking SUBMIT_BM01
            if (where.id === 17) {
                return Promise.resolve(buildTestUser(17, 'STUDENT', ['VIEW_MY_TOPICS']));
            }
            if (where.id === 18) return Promise.resolve(buildTestUser(18, 'LECTURER', [PERMISSIONS.OUTLINE_COUNCIL_MANAGE]));
            return Promise.resolve(null);
        });
    });

    describe('Report Routes: /api/reports', () => {
        it('returns 401 when accessing /api/reports/overview without token', async () => {
            const res = await request(app).get('/api/reports/overview');
            expect(res.status).toBe(401);
        });

        it('allows GET /api/reports/overview with VIEW_PROJECT_OVERSIGHT capability (even for non-admin)', async () => {
            const res = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', 'Bearer token-view-reports');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('allows GET /api/dashboard/stats with REPORT_VIEW capability', async () => {
            mockUser.findUnique.mockResolvedValueOnce(buildTestUser(99, 'LECTURER', [PERMISSIONS.REPORT_VIEW]));
            jwt.verify.mockReturnValueOnce({ userId: 99, role: 'LECTURER', permissionVersion: 1 });

            const res = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', 'Bearer token-custom');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('denies GET /api/reports/overview with HTTP 403 when user has no report capability', async () => {
            const res = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', 'Bearer token-student-with-cap');

            expect(res.status).toBe(403);
        });
    });

    describe('Permission Routes: /api/permissions', () => {
        it('allows GET /api/permissions/permissions for user with VIEW_PERMISSIONS', async () => {
            const res = await request(app)
                .get('/api/permissions/permissions')
                .set('Authorization', 'Bearer token-view-permissions');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('allows GET /api/permissions/permission-groups for user with VIEW_PERMISSION_GROUPS', async () => {
            const res = await request(app)
                .get('/api/permissions/permission-groups')
                .set('Authorization', 'Bearer token-view-permissions');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('denies POST /api/permissions/permission-groups with HTTP 403 when user only has VIEW_PERMISSION_GROUPS (view-only mutation blocked)', async () => {
            const res = await request(app)
                .post('/api/permissions/permission-groups')
                .set('Authorization', 'Bearer token-view-permissions')
                .send({
                    name: 'Test Group',
                    code: 'TEST_GRP',
                    permissionCodes: ['VIEW_USERS'],
                });

            expect(res.status).toBe(403);
        });

        it('allows POST /api/permissions/permission-groups when user has action capability PERMISSION_GROUP_MANAGE', async () => {
            mockPermissionGroup.create.mockResolvedValueOnce({
                id: 50,
                code: 'TEST_GRP_NEW',
                name: 'New Group',
            });

            const res = await request(app)
                .post('/api/permissions/permission-groups')
                .set('Authorization', 'Bearer token-manage-permissions')
                .send({
                    name: 'New Group',
                    code: 'TEST_GRP_NEW',
                    permissionCodes: ['VIEW_USERS'],
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Portal Content Routes: /api/portal', () => {
        it('allows GET /api/portal/admin/TEMPLATE for user with VIEW_PORTAL_CONTENT', async () => {
            const res = await request(app)
                .get('/api/portal/admin/TEMPLATE')
                .set('Authorization', 'Bearer token-view-portal');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('denies POST /api/portal/TEMPLATE with HTTP 403 when user only has VIEW_PORTAL_CONTENT', async () => {
            const res = await request(app)
                .post('/api/portal/TEMPLATE')
                .set('Authorization', 'Bearer token-view-portal')
                .send({ name: 'Template 1' });

            expect(res.status).toBe(403);
        });
    });

    describe('Outline Submissions: /api/outline/submissions', () => {
        it('denies submission with HTTP 403 if user lacks SUBMIT_BM01 capability (no role bypass)', async () => {
            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', 'Bearer token-student-no-cap')
                .send({
                    registrationId: 10,
                    fileData: { fileUrl: 'https://example.com/doc.pdf', fileName: 'doc.pdf' },
                });

            expect(res.status).toBe(403);
        });

        it('allows submission when student has SUBMIT_BM01 capability', async () => {
            const res = await request(app)
                .post('/api/outline/submissions')
                .set('Authorization', 'Bearer token-student-with-cap')
                .send({
                    registrationId: 10,
                    fileData: { fileUrl: 'https://example.com/doc.pdf', fileName: 'doc.pdf' },
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Council Routes: Reopen results without role bypass', () => {
        it('denies POST /api/councils/:id/results/reopen when ADMIN lacks council management capability', async () => {
            const res = await request(app)
                .post('/api/councils/100/results/reopen')
                .set('Authorization', 'Bearer token-admin-no-perm')
                .send({ reason: 'Admin can thiep khong co quyen' });

            expect(res.status).toBe(403);
        });

        it('allows POST /api/councils/:id/results/reopen when caller has OUTLINE_COUNCIL_MANAGE capability', async () => {
            const res = await request(app)
                .post('/api/councils/100/results/reopen')
                .set('Authorization', 'Bearer token-council-manage')
                .send({ reason: 'Duyet mo lai ket qua de cuong' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
