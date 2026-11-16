const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockAcademicDelegation = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockTopic = {
    findUnique: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
    update: jest.fn(),
};

const mockPrisma = {
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    topic: mockTopic,
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

const express = require('express');
const { authenticate } = require('../../src/middlewares/auth');
const { authorizeScopedPermission } = require('../../src/middlewares/authorizeScopedPermission');
const app = require('../../src/app');

// Build a test mini-router using authorizeScopedPermission to test scope attack scenarios
const testScopeApp = express();
testScopeApp.use(express.json());
testScopeApp.use(authenticate);
testScopeApp.get(
    '/test-resource/:id',
    authorizeScopedPermission({
        anyOf: ['OUTLINE_REVIEW'],
        resourceType: 'TOPIC',
        idFromRequest: (req) => req.params.id,
    }),
    (req, res) => {
        res.json({ success: true, resourceScope: req.resourceScope });
    }
);

function buildUser({ id, role, department = 'CNTT', permissions = [], permissionVersion = 1, isActive = true }) {
    return {
        id,
        role,
        department,
        email: `${role.toLowerCase()}${id}@test.vn`,
        fullName: `User ${role} ${id}`,
        code: `${role}-${id}`,
        isActive,
        permissionVersion,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GROUP_${role}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
        councilMembers: [],
    };
}

describe('Task 4: Authoritative Resource Scope and Delegation Hardening', () => {
    const leaderToken = 'token-leader-cntt';
    const leaderNullDeptToken = 'token-leader-null-dept';
    const delegatedLecturerToken = 'token-lecturer-delegated';

    const academicLeaderCNTT = buildUser({
        id: 1,
        role: 'LECTURER',
        department: 'CNTT',
        permissions: ['PERMISSION_ASSIGN_ACADEMIC', 'VIEW_ACADEMIC_DELEGATIONS'],
    });

    const academicLeaderNullDept = buildUser({
        id: 2,
        role: 'LECTURER',
        department: null, // Actor has NULL department
        permissions: ['PERMISSION_ASSIGN_ACADEMIC', 'VIEW_ACADEMIC_DELEGATIONS'],
    });

    const delegatedLecturer = buildUser({
        id: 3,
        role: 'LECTURER',
        department: 'CNTT',
        permissions: ['VIEW_MY_TOPICS'],
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === leaderToken) return { userId: academicLeaderCNTT.id, role: academicLeaderCNTT.role, permissionVersion: 1 };
            if (token === leaderNullDeptToken) return { userId: academicLeaderNullDept.id, role: academicLeaderNullDept.role, permissionVersion: 1 };
            if (token === delegatedLecturerToken) return { userId: delegatedLecturer.id, role: delegatedLecturer.role, permissionVersion: 1 };
            throw new Error('Invalid token');
        });

        mockUser.findUnique.mockImplementation(({ where }) => {
            if (where.id === academicLeaderCNTT.id) return Promise.resolve(academicLeaderCNTT);
            if (where.id === academicLeaderNullDept.id) return Promise.resolve(academicLeaderNullDept);
            if (where.id === delegatedLecturer.id) return Promise.resolve(delegatedLecturer);
            return Promise.resolve(null);
        });

        // Default: delegatedLecturer has active delegation for OUTLINE_REVIEW in semester 10, department CNTT
        mockAcademicDelegation.findMany.mockImplementation(({ where }) => {
            if (where && where.delegateeId === delegatedLecturer.id) {
                return Promise.resolve([{
                    id: 999,
                    delegateeId: delegatedLecturer.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    department: 'CNTT',
                    semesterId: 10,
                    status: 'ACTIVE',
                    effectiveFrom: new Date(Date.now() - 3600000),
                    effectiveTo: new Date(Date.now() + 3600000),
                }]);
            }
            return Promise.resolve([]);
        });
    });

    describe('Review Focus 1 & 2: Forged semester in query/header/body vs authoritative DB scope', () => {
        it('rejects access with DELEGATION_SCOPE_FORBIDDEN when target topic in DB is semester 20, even if client sends forged semesterId=10 in query/header/body', async () => {
            // Target topic is in semester 20, but actor delegation is for semester 10
            mockTopic.findUnique.mockResolvedValueOnce({
                id: 500,
                semesterId: 20,
                mentorId: 10,
                proposedById: 10,
                mentor: { department: 'CNTT' },
                proposedBy: { department: 'CNTT' },
            });

            const res = await request(testScopeApp)
                .get('/test-resource/500?semesterId=10')
                .set('Authorization', `Bearer ${delegatedLecturerToken}`)
                .set('x-semester-id', '10')
                .send({ semesterId: 10 });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('DELEGATION_SCOPE_FORBIDDEN');
        });

        it('grants access when authoritative resource scope matches delegation (semester 10, department CNTT)', async () => {
            mockTopic.findUnique.mockResolvedValueOnce({
                id: 501,
                semesterId: 10,
                mentorId: 10,
                proposedById: 10,
                mentor: { department: 'CNTT' },
                proposedBy: { department: 'CNTT' },
            });

            const res = await request(testScopeApp)
                .get('/test-resource/501')
                .set('Authorization', `Bearer ${delegatedLecturerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.resourceScope.semesterId).toBe(10);
            expect(res.body.resourceScope.department).toBe('CNTT');
        });
    });

    describe('Review Focus 3: Actor with null department must fail-closed', () => {
        it('rejects GET /api/delegations with HTTP 403 and DEPARTMENT_REQUIRED when actor department is null', async () => {
            const res = await request(app)
                .get('/api/delegations')
                .set('Authorization', `Bearer ${leaderNullDeptToken}`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('DEPARTMENT_REQUIRED');
            // Ensure no delegation query with department filter was executed
            expect(mockAcademicDelegation.findMany).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ department: expect.anything() }),
                })
            );
        });

        it('rejects POST /api/delegations with HTTP 403 and DEPARTMENT_REQUIRED when actor department is null', async () => {
            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderNullDeptToken}`)
                .set('Idempotency-Key', 'idem-null-dept')
                .send({
                    delegateeId: delegatedLecturer.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Uy quyen khong co don vi',
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('DEPARTMENT_REQUIRED');
        });

        it('rejects DELETE /api/delegations/:id with HTTP 403 and DEPARTMENT_REQUIRED when actor department is null', async () => {
            const res = await request(app)
                .delete('/api/delegations/123')
                .set('Authorization', `Bearer ${leaderNullDeptToken}`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('DEPARTMENT_REQUIRED');
            expect(mockAcademicDelegation.update).not.toHaveBeenCalled();
        });
    });

    describe('Review Focus 4: Cross-department list and revoke protections', () => {
        it('rejects revoking delegation belonging to another department with HTTP 403 and DEPARTMENT_MISMATCH', async () => {
            mockAcademicDelegation.findUnique.mockResolvedValueOnce({
                id: 888,
                delegatorId: 50,
                delegateeId: 51,
                capabilityCode: 'OUTLINE_REVIEW',
                department: 'KTPM', // Foreign department
                status: 'ACTIVE',
            });

            const res = await request(app)
                .delete('/api/delegations/888')
                .set('Authorization', `Bearer ${leaderToken}`); // Leader is CNTT

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('DEPARTMENT_MISMATCH');
            expect(mockAcademicDelegation.update).not.toHaveBeenCalled();
        });
    });

    describe('Stable error codes contract', () => {
        it('returns 401 AUTHENTICATION_REQUIRED if request has no token', async () => {
            const res = await request(testScopeApp).get('/test-resource/500');
            expect(res.status).toBe(401);
        });

        it('returns 403 CAPABILITY_REQUIRED if user has neither base nor delegated capability', async () => {
            const res = await request(testScopeApp)
                .get('/test-resource/500')
                .set('Authorization', `Bearer ${leaderToken}`); // Leader does NOT have OUTLINE_REVIEW

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('CAPABILITY_REQUIRED');
        });
    });
});
