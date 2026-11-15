const prisma = require('../../src/config/database');
const { listPermissions, listGroups, getPermissionMatrix } = require('../../src/services/permissionService');
const { STUDENT_BASE_PERMISSIONS } = require('../../src/constants/permissions');

describe('Student Permission Exclusion from Administrative RBAC Matrix', () => {
    test('1. STUDENT_BASE_PERMISSIONS contains exact 14 student-only capabilities', () => {
        expect(STUDENT_BASE_PERMISSIONS).toBeDefined();
        expect(STUDENT_BASE_PERMISSIONS.length).toBe(14);
        expect(STUDENT_BASE_PERMISSIONS).toContain('REGISTER_TOPIC');
        expect(STUDENT_BASE_PERMISSIONS).toContain('SUBMIT_BM01');
        expect(STUDENT_BASE_PERMISSIONS).toContain('SUBMIT_BM02');
        expect(STUDENT_BASE_PERMISSIONS).toContain('VIEW_MY_REGISTRATION');
        expect(STUDENT_BASE_PERMISSIONS).toContain('SUBMIT_FINAL_ARCHIVE');
    });

    test('2. listPermissions excludes student-only permissions and STUDENT module', async () => {
        const permissions = await listPermissions();
        const codes = permissions.map(p => p.code);
        const modules = permissions.map(p => p.module);

        expect(modules).not.toContain('STUDENT');
        STUDENT_BASE_PERMISSIONS.forEach(studentCode => {
            expect(codes).not.toContain(studentCode);
        });
    });

    test('3. listGroups excludes SYSTEM_STUDENT_BASE group', async () => {
        const groups = await listGroups();
        const groupCodes = groups.map(g => g.code);
        expect(groupCodes).not.toContain('SYSTEM_STUDENT_BASE');
    });

    test('4. getPermissionMatrix excludes student role and student permissions', async () => {
        const matrix = await getPermissionMatrix();
        const roleCodes = matrix.roles.map(r => r.code);
        expect(roleCodes).not.toContain('SYSTEM_STUDENT_BASE');
        expect(roleCodes).not.toContain('STUDENT');

        const allMatrixPerms = [];
        matrix.modules.forEach(m => {
            expect(m.module_name).not.toBe('STUDENT');
            m.permissions.forEach(p => allMatrixPerms.push(p.code));
        });

        STUDENT_BASE_PERMISSIONS.forEach(studentCode => {
            expect(allMatrixPerms).not.toContain(studentCode);
        });
    });

    test('5. updateUserPermissionGroups rejects assigning permission groups to a student', async () => {
        const { updateUserPermissionGroups } = require('../../src/controllers/userController');

        const mockStudent = {
            id: 9999,
            role: 'STUDENT',
            fullName: 'Sinh Viên Test',
        };

        const originalFindUnique = prisma.user.findUnique;
        prisma.user.findUnique = jest.fn().mockResolvedValue(mockStudent);

        const req = {
            params: { id: '9999' },
            body: { groupIds: [1, 2] },
            user: { id: 1, role: 'ADMIN' },
        };

        let statusCode = null;
        let responseJson = null;

        const res = {
            status: jest.fn().mockImplementation((code) => {
                statusCode = code;
                return res;
            }),
            json: jest.fn().mockImplementation((data) => {
                responseJson = data;
                return res;
            }),
        };

        const next = jest.fn();

        try {
            await updateUserPermissionGroups(req, res, next);
            expect(statusCode).toBe(400);
            expect(responseJson.code).toBe('STUDENT_CANNOT_HAVE_PERMISSION_GROUPS');
            expect(responseJson.message).toBe('Tài khoản Sinh viên không thể gán nhóm quyền chức vụ.');
        } finally {
            prisma.user.findUnique = originalFindUnique;
        }
    });
});
