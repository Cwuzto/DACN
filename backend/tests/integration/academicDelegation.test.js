const mockAcademicDelegation = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
    update: jest.fn(),
};

const mockPrisma = {
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-signed-token'),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { auditLog } = require('../../src/services/auditLogService');

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

describe('Integration - Academic Delegation Subsystem (/api/delegations)', () => {
    const leaderToken = 'leader-token';
    const lecturerToken = 'lecturer-token';
    const adminToken = 'admin-token';

    const academicLeader = buildUser({
        id: 1,
        role: 'LECTURER',
        department: 'CNTT',
        permissions: ['PERMISSION_ASSIGN_ACADEMIC', 'VIEW_ACADEMIC_DELEGATIONS'],
    });

    const lecturerSameDept = buildUser({
        id: 2,
        role: 'LECTURER',
        department: 'CNTT',
        permissions: ['VIEW_MY_TOPICS'],
        permissionVersion: 3,
    });

    const lecturerOtherDept = buildUser({
        id: 3,
        role: 'LECTURER',
        department: 'KTPM',
        permissions: ['VIEW_MY_TOPICS'],
    });

    const technicalAdmin = buildUser({
        id: 4,
        role: 'ADMIN',
        department: 'SYSTEM',
        permissions: ['PERMISSION_GROUP_MANAGE', 'USER_MANAGE'],
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === leaderToken) return { userId: academicLeader.id, role: academicLeader.role, permissionVersion: academicLeader.permissionVersion };
            if (token === lecturerToken) return { userId: lecturerSameDept.id, role: lecturerSameDept.role, permissionVersion: lecturerSameDept.permissionVersion };
            if (token === adminToken) return { userId: technicalAdmin.id, role: technicalAdmin.role, permissionVersion: technicalAdmin.permissionVersion };
            throw new Error('Invalid token');
        });

        mockUser.findUnique.mockImplementation(({ where }) => {
            if (where.id === academicLeader.id) return Promise.resolve(academicLeader);
            if (where.id === lecturerSameDept.id) return Promise.resolve(lecturerSameDept);
            if (where.id === lecturerOtherDept.id) return Promise.resolve(lecturerOtherDept);
            if (where.id === technicalAdmin.id) return Promise.resolve(technicalAdmin);
            return Promise.resolve(null);
        });

        // Default mock for active delegations lookup in auth middleware
        mockAcademicDelegation.findMany.mockResolvedValue([]);
    });

    describe('POST /api/delegations - Creation and Guard Validation', () => {
        it('allows academic leader with PERMISSION_ASSIGN_ACADEMIC to delegate OUTLINE_REVIEW to lecturer in same department', async () => {
            const effectiveFrom = new Date().toISOString();
            const effectiveTo = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
            const idempotencyKey = 'idem-key-001';

            mockAcademicDelegation.findUnique.mockResolvedValueOnce(null); // No previous idempotent key
            mockAcademicDelegation.create.mockImplementationOnce(({ data }) => Promise.resolve({
                id: 101,
                ...data,
                delegator: { id: academicLeader.id, fullName: academicLeader.fullName, code: academicLeader.code },
                delegatee: { id: lecturerSameDept.id, fullName: lecturerSameDept.fullName, code: lecturerSameDept.code, department: lecturerSameDept.department },
            }));
            mockUser.update.mockResolvedValueOnce({ ...lecturerSameDept, permissionVersion: 4 });

            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderToken}`)
                .set('Idempotency-Key', idempotencyKey)
                .send({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveFrom,
                    effectiveTo,
                    reason: 'Phụ trách duyệt đề cương BM01 học kỳ 1',
                    semesterId: 10,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(101);
            expect(res.body.data.capabilityCode).toBe('OUTLINE_REVIEW');
            expect(res.body.data.status).toBe('ACTIVE');

            // Verify delegatee permissionVersion incremented
            expect(mockUser.update).toHaveBeenCalledWith({
                where: { id: lecturerSameDept.id },
                data: { permissionVersion: { increment: 1 } },
            });

            // Verify audit log recorded
            expect(auditLog).toHaveBeenCalledWith(
                academicLeader.id,
                'CREATE_ACADEMIC_DELEGATION',
                'AcademicDelegation',
                101,
                expect.objectContaining({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    department: 'CNTT',
                }),
                expect.anything()
            );
        });

        it('rejects self-delegation with HTTP 400 and CANNOT_DELEGATE_TO_SELF', async () => {
            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderToken}`)
                .set('Idempotency-Key', 'idem-self-001')
                .send({
                    delegateeId: academicLeader.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Tu uy quyen cho chinh minh',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('CANNOT_DELEGATE_TO_SELF');
            expect(mockAcademicDelegation.create).not.toHaveBeenCalled();
        });

        it('rejects delegation to lecturer in different department with HTTP 403 and DEPARTMENT_MISMATCH', async () => {
            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderToken}`)
                .set('Idempotency-Key', 'idem-diff-dept-001')
                .send({
                    delegateeId: lecturerOtherDept.id, // KTPM vs leader CNTT
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Uy quyen khac khoa',
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('DEPARTMENT_MISMATCH');
            expect(mockAcademicDelegation.create).not.toHaveBeenCalled();
        });

        it('rejects delegation with capability not in grantablePermissionCodes with HTTP 400 and INVALID_DELEGATION_CAPABILITY', async () => {
            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderToken}`)
                .set('Idempotency-Key', 'idem-invalid-cap-001')
                .send({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'USER_MANAGE', // Not an academic grantable permission
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Uy quyen trai phep admin',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('INVALID_DELEGATION_CAPABILITY');
            expect(mockAcademicDelegation.create).not.toHaveBeenCalled();
        });

        it('requires Idempotency-Key header when creating delegation (returns 400 if missing)', async () => {
            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderToken}`)
                // No Idempotency-Key header
                .send({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Thieu idempotency key',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('MISSING_IDEMPOTENCY_KEY');
            expect(mockAcademicDelegation.create).not.toHaveBeenCalled();
        });

        it('returns existing delegation when called with duplicated Idempotency-Key (idempotent replay)', async () => {
            const existingDelegation = {
                id: 99,
                delegatorId: academicLeader.id,
                delegateeId: lecturerSameDept.id,
                capabilityCode: 'OUTLINE_REVIEW',
                department: 'CNTT',
                idempotencyKey: 'dup-key-123',
                status: 'ACTIVE',
            };
            mockAcademicDelegation.findUnique.mockResolvedValueOnce(existingDelegation);

            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderToken}`)
                .set('Idempotency-Key', 'dup-key-123')
                .send({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Thu lai lan hai',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(99);
            expect(mockAcademicDelegation.create).not.toHaveBeenCalled();
            expect(mockUser.update).not.toHaveBeenCalled();
        });

        it('rejects Technical Admin (PERMISSION_GROUP_MANAGE) from creating academic delegations with HTTP 403', async () => {
            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${adminToken}`)
                .set('Idempotency-Key', 'idem-admin-block')
                .send({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveTo: new Date(Date.now() + 86400000).toISOString(),
                    reason: 'Admin leo thang quyen hoc thuat',
                });

            expect(res.status).toBe(403);
            expect(mockAcademicDelegation.create).not.toHaveBeenCalled();
        });

        it('rejects invalid date range where effectiveTo <= effectiveFrom with HTTP 400', async () => {
            const res = await request(app)
                .post('/api/delegations')
                .set('Authorization', `Bearer ${leaderToken}`)
                .set('Idempotency-Key', 'idem-invalid-dates')
                .send({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    effectiveFrom: '2026-11-10T00:00:00Z',
                    effectiveTo: '2026-11-05T00:00:00Z', // In the past relative to effectiveFrom
                    reason: 'Sai khoang thoi gian',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('INVALID_EFFECTIVE_PERIOD');
            expect(mockAcademicDelegation.create).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/delegations - List Delegations by Department', () => {
        it('returns delegations matching actor department', async () => {
            const mockList = [
                { id: 1, delegatorId: 1, delegateeId: 2, capabilityCode: 'OUTLINE_REVIEW', department: 'CNTT', status: 'ACTIVE' },
                { id: 2, delegatorId: 1, delegateeId: 2, capabilityCode: 'BM02_REVIEW', department: 'CNTT', status: 'ACTIVE' },
            ];
            mockAcademicDelegation.findMany.mockImplementation(({ where }) => {
                if (where && where.department === 'CNTT') {
                    return Promise.resolve(mockList);
                }
                return Promise.resolve([]);
            });

            const res = await request(app)
                .get('/api/delegations?status=ACTIVE')
                .set('Authorization', `Bearer ${leaderToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(mockAcademicDelegation.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    department: 'CNTT',
                    status: 'ACTIVE',
                }),
            }));
        });

        it('rejects user without PERMISSION_ASSIGN_ACADEMIC or VIEW_ACADEMIC_DELEGATIONS with HTTP 403', async () => {
            const res = await request(app)
                .get('/api/delegations')
                .set('Authorization', `Bearer ${lecturerToken}`);

            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /api/delegations/:id - Revoke Academic Delegation', () => {
        it('revokes delegation, marks status REVOKED, and increments delegatee permissionVersion', async () => {
            const existingDelegation = {
                id: 55,
                delegatorId: academicLeader.id,
                delegateeId: lecturerSameDept.id,
                capabilityCode: 'OUTLINE_REVIEW',
                department: 'CNTT',
                status: 'ACTIVE',
            };
            mockAcademicDelegation.findUnique.mockResolvedValueOnce(existingDelegation);
            mockAcademicDelegation.update.mockResolvedValueOnce({ ...existingDelegation, status: 'REVOKED' });
            mockUser.update.mockResolvedValueOnce({ ...lecturerSameDept, permissionVersion: 4 });

            const res = await request(app)
                .delete('/api/delegations/55')
                .set('Authorization', `Bearer ${leaderToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('REVOKED');

            // Verify permissionVersion bumped for delegatee
            expect(mockUser.update).toHaveBeenCalledWith({
                where: { id: lecturerSameDept.id },
                data: { permissionVersion: { increment: 1 } },
            });

            // Verify audit log
            expect(auditLog).toHaveBeenCalledWith(
                academicLeader.id,
                'REVOKE_ACADEMIC_DELEGATION',
                'AcademicDelegation',
                55,
                expect.objectContaining({
                    delegateeId: lecturerSameDept.id,
                    capabilityCode: 'OUTLINE_REVIEW',
                    department: 'CNTT',
                }),
                expect.anything()
            );
        });

        it('rejects revocation if delegation belongs to different department with HTTP 403', async () => {
            const foreignDelegation = {
                id: 60,
                delegatorId: 9,
                delegateeId: 10,
                capabilityCode: 'OUTLINE_REVIEW',
                department: 'KTPM', // Different from CNTT
                status: 'ACTIVE',
            };
            mockAcademicDelegation.findUnique.mockResolvedValueOnce(foreignDelegation);

            const res = await request(app)
                .delete('/api/delegations/60')
                .set('Authorization', `Bearer ${leaderToken}`);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('DEPARTMENT_MISMATCH');
            expect(mockAcademicDelegation.update).not.toHaveBeenCalled();
        });
    });

    describe('Auth Middleware Integration - Delegated Capabilities Resolution', () => {
        it('dynamically injects active delegated capability into req.user.permissions and allows access to protected endpoint', async () => {
            // Setup active delegation for lecturerSameDept
            const activeDelegation = {
                id: 77,
                delegatorId: academicLeader.id,
                delegateeId: lecturerSameDept.id,
                capabilityCode: 'OUTLINE_REVIEW',
                status: 'ACTIVE',
                effectiveFrom: new Date(Date.now() - 3600000), // 1 hour ago
                effectiveTo: new Date(Date.now() + 3600000),   // 1 hour later
            };

            mockAcademicDelegation.findMany.mockResolvedValueOnce([activeDelegation]);

            // Call /api/auth/me to check req.user.permissions
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${lecturerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.permissions).toContain('OUTLINE_REVIEW');
            expect(res.body.data.permissions).toContain('VIEW_MY_TOPICS');
        });

        it('does not inject expired or revoked delegations into req.user.permissions', async () => {
            // When Prisma query filters status: 'ACTIVE' and effectiveFrom <= now <= effectiveTo,
            // expired/revoked delegations will not be returned by findMany:
            mockAcademicDelegation.findMany.mockResolvedValueOnce([]);

            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${lecturerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.permissions).not.toContain('OUTLINE_REVIEW');
            expect(res.body.data.permissions).toContain('VIEW_MY_TOPICS');
        });
    });
});
