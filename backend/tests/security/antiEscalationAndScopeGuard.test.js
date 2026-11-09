const prisma = require('../../src/config/database');
const { createGroup, updateGroup, deleteGroup, setUserGroups, bulkUpdatePermissionMatrix } = require('../../src/services/permissionService');
const { validateAcademicScope } = require('../../src/services/academicScopeService');
const { ACADEMIC_PROTECTED_PERMISSIONS, TECHNICAL_PERMISSIONS } = require('../../src/constants/permissions');

describe('P0 Security Guard: Anti-Escalation, Scope Enforcement & Delegation', () => {
    describe('1. Anti-Escalation on Groups & Matrix', () => {
        test('admin cannot create group containing academic protected permissions', async () => {
            const adminActor = { id: 1, role: 'ADMIN', permissions: ['PERMISSION_GROUP_MANAGE'] };
            await expect(
                createGroup({
                    code: 'MALICIOUS_CUSTOM_GROUP',
                    name: 'Malicious Group',
                    permissionCodes: ['TOPIC_REVIEW', 'PORTAL_CONTENT_MANAGE'],
                }, adminActor)
            ).rejects.toMatchObject({
                statusCode: 403,
                code: 'FORBIDDEN_ACADEMIC_PERMISSION_MODIFICATION',
            });
        });

        test('admin cannot add academic protected permission to an existing group', async () => {
            const adminActor = { id: 1, role: 'ADMIN', permissions: ['PERMISSION_GROUP_MANAGE'] };
            const mockTx = {
                permissionGroup: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 50,
                        code: 'TECH_GROUP',
                        permissions: [{ permission: { code: 'PORTAL_CONTENT_MANAGE' } }],
                    }),
                    update: jest.fn(),
                },
                permissionGroupPermission: { deleteMany: jest.fn() },
                permission: { findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) },
            };
            jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb) => cb(mockTx));

            await expect(
                updateGroup(50, {
                    permissionCodes: ['PORTAL_CONTENT_MANAGE', 'BM02_REVIEW'],
                }, adminActor)
            ).rejects.toMatchObject({
                statusCode: 403,
                code: 'FORBIDDEN_ACADEMIC_PERMISSION_MODIFICATION',
            });
        });

        test('admin CAN update technical permissions or group metadata without touching academic permissions', async () => {
            const adminActor = { id: 1, role: 'ADMIN', permissions: ['PERMISSION_GROUP_MANAGE'] };
            const mockTx = {
                permissionGroup: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 50,
                        code: 'TECH_GROUP',
                        permissions: [{ permission: { code: 'PORTAL_CONTENT_MANAGE' } }],
                    }),
                    update: jest.fn().mockResolvedValue({ id: 50, name: 'Tên nhóm mới' }),
                },
                permissionGroupPermission: { deleteMany: jest.fn() },
                permission: { findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) },
            };
            jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb) => cb(mockTx));

            const result = await updateGroup(50, {
                name: 'Tên nhóm mới',
                permissionCodes: ['PORTAL_CONTENT_MANAGE', 'USER_MANAGE'],
            }, adminActor);

            expect(result).toBeDefined();
            expect(result.id).toBe(50);
        });

        test('bulkUpdatePermissionMatrix rejects modifications to protected academic permissions', async () => {
            const adminActor = { id: 1, role: 'ADMIN', permissions: ['PERMISSION_GROUP_MANAGE'] };
            const mockTx = {
                permissionGroup: {
                    findMany: jest.fn().mockResolvedValue([{ id: 1, code: 'GVHD' }]),
                },
                permission: {
                    findMany: jest.fn().mockImplementation(async ({ where } = {}) => {
                        if (where?.id?.in) {
                            return where.id.in.map((id) => ({ id, code: 'DEFENSE_SCORE_SUBMIT' }));
                        }
                        return [
                            { id: 10, code: 'DEFENSE_SCORE_SUBMIT' },
                            { id: 99, code: 'PERMISSION_GROUP_MANAGE' },
                        ];
                    }),
                    findUnique: jest.fn().mockResolvedValue({ id: 99, code: 'PERMISSION_GROUP_MANAGE' }),
                },
                permissionGroupPermission: {
                    findMany: jest.fn().mockResolvedValue([
                        { permissionGroupId: 1, permission: { code: 'PORTAL_CONTENT_MANAGE' } },
                    ]),
                    count: jest.fn().mockResolvedValue(1),
                    deleteMany: jest.fn(),
                    createMany: jest.fn(),
                },
                auditLog: { create: jest.fn() },
            };
            jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb) => cb(mockTx));

            await expect(
                bulkUpdatePermissionMatrix([{ role_id: 1, permission_ids: [10] }], adminActor)
            ).rejects.toMatchObject({
                statusCode: 403,
                message: expect.stringContaining('DEFENSE_SCORE_SUBMIT'),
            });
        });
    });

    describe('2. Department Scope & In-Transaction Delegation Guard', () => {
        test('succeeds when actor department matches registration authoritative department', async () => {
            const mockTx = {
                user: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 20,
                        department: 'Bộ môn Công nghệ Phần mềm',
                    }),
                },
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        topic: {
                            mentor: { department: 'Bộ môn Công nghệ Phần mềm' },
                        },
                    }),
                },
            };

            const result = await validateAcademicScope(mockTx, {
                actorId: 20,
                registrationId: 101,
                capabilityCode: 'BM02_REVIEW',
            });

            expect(result.grantedVia).toBe('DIRECT_DEPARTMENT');
            expect(result.authoritativeDepartment).toBe('Bộ môn Công nghệ Phần mềm');
        });

        test('succeeds when actor has an ACTIVE, non-expired delegation for the department', async () => {
            const now = new Date('2026-11-09T12:00:00Z');
            const mockTx = {
                user: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 25,
                        department: 'Bộ môn Hệ thống thông tin', // Different native department
                    }),
                },
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        topic: {
                            mentor: { department: 'Bộ môn Công nghệ Phần mềm' },
                        },
                    }),
                },
                academicDelegation: {
                    findFirst: jest.fn().mockResolvedValue({
                        id: 77,
                        capabilityCode: 'BM02_REVIEW',
                        department: 'Bộ môn Công nghệ Phần mềm',
                        status: 'ACTIVE',
                        effectiveFrom: new Date('2026-11-01T00:00:00Z'),
                        effectiveTo: new Date('2026-11-30T00:00:00Z'),
                    }),
                },
            };

            const result = await validateAcademicScope(mockTx, {
                actorId: 25,
                registrationId: 101,
                capabilityCode: 'BM02_REVIEW',
                now,
            });

            expect(result.grantedVia).toBe('ACADEMIC_DELEGATION');
            expect(result.delegationId).toBe(77);
        });

        test('throws 403 DELEGATION_SCOPE_MISMATCH when delegation is expired or revoked', async () => {
            const now = new Date('2026-11-09T12:00:00Z');
            const mockTx = {
                user: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 25,
                        department: 'Bộ môn Hệ thống thông tin',
                    }),
                },
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 101,
                        topic: {
                            mentor: { department: 'Bộ môn Công nghệ Phần mềm' },
                        },
                    }),
                },
                academicDelegation: {
                    findFirst: jest.fn().mockResolvedValue(null), // No active delegation in DB
                },
            };

            await expect(
                validateAcademicScope(mockTx, {
                    actorId: 25,
                    registrationId: 101,
                    capabilityCode: 'BM02_REVIEW',
                    now,
                })
            ).rejects.toMatchObject({
                statusCode: 403,
                code: 'DELEGATION_SCOPE_MISMATCH',
            });
        });
    });
});
