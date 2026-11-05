const {
    PERMISSIONS,
    PERMISSION_CATALOG,
    DEFAULT_GROUPS,
    grantablePermissionCodes,
    GRANTABLE_PERMISSION_CODES,
} = require('../../src/constants/permissions');

describe('Permission catalog invariants & 2-tier capability foundation', () => {
    test('permission codes are unique and constants match the catalog', () => {
        const catalogCodes = PERMISSION_CATALOG.map(({ code }) => code);

        expect(new Set(catalogCodes).size).toBe(catalogCodes.length);
        expect(Object.values(PERMISSIONS).sort()).toEqual([...catalogCodes].sort());
    });

    test('default groups reference only catalog permissions without duplicates', () => {
        const catalogCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));

        for (const group of DEFAULT_GROUPS) {
            expect(new Set(group.permissions).size).toBe(group.permissions.length);
            for (const code of group.permissions) {
                expect(catalogCodes.has(code)).toBe(true);
            }
        }
    });

    test('defines all 27 required VIEW_* permissions in catalog', () => {
        const catalogCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));

        const required27ViewPermissions = [
            'VIEW_MY_REGISTRATION',
            'VIEW_MY_SUBMISSIONS',
            'VIEW_MY_ARCHIVE',
            'VIEW_MY_GRADES',
            'VIEW_MY_TOPICS',
            'VIEW_MENTOR_STUDENTS',
            'VIEW_CHECKPOINTS',
            'VIEW_BM04_EVALUATIONS',
            'VIEW_TOPIC_REVIEWS',
            'VIEW_OUTLINE_REVIEWS',
            'VIEW_BM02_REVIEWS',
            'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
            'VIEW_ACADEMIC_DELEGATIONS',
            'VIEW_DEFENSE_ASSIGNMENTS',
            'VIEW_DEFENSE_GRADING',
            'VIEW_RESULT_LOCKS',
            'VIEW_DEFENSE_RESULTS_APPROVAL',
            'VIEW_RESULT_PUBLICATIONS',
            'VIEW_CLEARANCE_CERTIFICATES',
            'VIEW_SEMESTERS',
            'VIEW_PROJECT_PERIODS',
            'VIEW_PROJECT_CATALOGS',
            'VIEW_PROJECT_ENROLLMENTS',
            'VIEW_PROJECT_OVERSIGHT',
            'VIEW_USERS',
            'VIEW_PERMISSION_GROUPS',
            'VIEW_PORTAL_CONTENT',
        ];

        expect(required27ViewPermissions).toHaveLength(27);

        for (const viewCode of required27ViewPermissions) {
            expect(catalogCodes.has(viewCode)).toBe(true);
            expect(PERMISSIONS[viewCode]).toBe(viewCode);
        }
    });

    test('replaces LEGACY_REVIEW_MANAGE with PROJECT_OVERSIGHT_MANAGE and adds PERMISSION_ASSIGN_ACADEMIC', () => {
        const catalogCodes = new Set(PERMISSION_CATALOG.map(({ code }) => code));
        const groups = Object.fromEntries(DEFAULT_GROUPS.map((group) => [group.code, new Set(group.permissions)]));

        expect(catalogCodes.has('LEGACY_REVIEW_MANAGE')).toBe(false);
        expect(PERMISSIONS.LEGACY_REVIEW_MANAGE).toBeUndefined();

        expect(catalogCodes.has('PROJECT_OVERSIGHT_MANAGE')).toBe(true);
        expect(PERMISSIONS.PROJECT_OVERSIGHT_MANAGE).toBe('PROJECT_OVERSIGHT_MANAGE');

        expect(catalogCodes.has('PERMISSION_ASSIGN_ACADEMIC')).toBe(true);
        expect(PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC).toBe('PERMISSION_ASSIGN_ACADEMIC');

        expect(groups.QUAN_TRI_VIEN.has('PROJECT_OVERSIGHT_MANAGE')).toBe(true);
        expect(groups.QUAN_TRI_VIEN.has('LEGACY_REVIEW_MANAGE')).toBe(false);
    });

    test('defines SYSTEM_STUDENT_BASE group with exactly 14 student capabilities', () => {
        const studentGroup = DEFAULT_GROUPS.find((group) => group.code === 'SYSTEM_STUDENT_BASE');
        expect(studentGroup).toBeDefined();

        const expected14Capabilities = [
            'VIEW_MY_REGISTRATION',
            'VIEW_MY_SUBMISSIONS',
            'VIEW_MY_ARCHIVE',
            'VIEW_MY_GRADES',
            'REGISTER_TOPIC',
            'RENAME_TOPIC',
            'REGISTRATION_CANCEL',
            'SUBMIT_BM01',
            'SUBMIT_BM02',
            'SUBMIT_TASK',
            'CHECKPOINT_SIGN',
            'SIGNATURE_APPEAL_SUBMIT',
            'SUBMIT_PRE_DEFENSE_ARCHIVE',
            'SUBMIT_FINAL_ARCHIVE',
        ];

        expect(expected14Capabilities).toHaveLength(14);
        expect(studentGroup.permissions).toHaveLength(14);
        expect([...studentGroup.permissions].sort()).toEqual([...expected14Capabilities].sort());
    });

    test('defines grantablePermissionCodes containing only academic delegation capabilities', () => {
        const grantable = grantablePermissionCodes || GRANTABLE_PERMISSION_CODES;
        expect(Array.isArray(grantable)).toBe(true);
        expect(grantable).toEqual(expect.arrayContaining([
            'OUTLINE_REVIEW',
            'BM02_REVIEW',
            'DEFENSE_SCORE_SUBMIT',
            'DEFENSE_RESULT_APPROVE',
        ]));

        // Technical management permissions must not be grantable via academic delegation
        const prohibitedTechnicalPermissions = [
            'USER_MANAGE',
            'USER_IMPORT',
            'PERMISSION_GROUP_MANAGE',
            'SEMESTER_MANAGE',
            'PROJECT_OVERSIGHT_MANAGE',
        ];

        for (const techPerm of prohibitedTechnicalPermissions) {
            expect(grantable.includes(techPerm)).toBe(false);
        }
    });

    test('defines QUAN_TRI_VIEN group with technical scope and ZERO academic decision rights', () => {
        const adminGroup = DEFAULT_GROUPS.find((group) => group.code === 'QUAN_TRI_VIEN');
        expect(adminGroup).toBeDefined();

        const perms = new Set(adminGroup.permissions);

        // Technical scope
        const requiredTechnicalPermissions = [
            'USER_MANAGE',
            'USER_IMPORT',
            'PERMISSION_GROUP_MANAGE',
            'SEMESTER_MANAGE',
            'PROJECT_CATALOG_MANAGE',
            'ENROLLMENT_MANAGE',
            'RUBRIC_MANAGE',
            'NOTIFICATION_MANAGE',
            'PROJECT_OVERSIGHT_MANAGE',
            'PUBLIC_ANNOUNCEMENT_MANAGE',
            'PORTAL_CONTENT_MANAGE',
            'REPORT_VIEW',
            'LECTURER_DIRECTORY_VIEW',
            'VIEW_ALL_TOPICS',
        ];
        for (const p of requiredTechnicalPermissions) {
            expect(perms.has(p)).toBe(true);
        }

        // Must NOT have council management or academic decision/scoring capabilities
        const strictlyForbiddenPermissions = [
            'DEFENSE_COUNCIL_MANAGE',
            'OUTLINE_COUNCIL_MANAGE',
            'RESULT_LOCK',
            'DEFENSE_RESULT_APPROVE',
            'RESULT_PUBLISH',
            'RESULT_PUBLICATION_PUBLISH',
            'PROJECT_ASSIGNMENT_PUBLISH',
            'DECISION_AMENDMENT_SIGN',
            'DEFENSE_SCORE_SUBMIT',
            'PERMISSION_ASSIGN_ACADEMIC',
            'MENTOR_ASSIGN',
            'TOPIC_REVIEW',
            'OUTLINE_APPROVE',
            'BM02_REVIEW',
            'BM03_CHECKPOINT_DECIDE',
            'BM04_SUBMIT',
        ];
        for (const forbidden of strictlyForbiddenPermissions) {
            expect(perms.has(forbidden)).toBe(false);
        }
    });

    test('defines VIEN_TRUONG group containing all lecturer capabilities PLUS institute decision approvals', () => {
        const leaderGroup = DEFAULT_GROUPS.find((group) => group.code === 'VIEN_TRUONG');
        const lecturerGroup = DEFAULT_GROUPS.find((group) => group.code === 'GVHD');
        expect(leaderGroup).toBeDefined();
        expect(lecturerGroup).toBeDefined();

        const leaderPerms = new Set(leaderGroup.permissions);

        // Viện trưởng must have ALL permissions of Giảng viên hướng dẫn
        for (const lecturerPerm of lecturerGroup.permissions) {
            expect(leaderPerms.has(lecturerPerm)).toBe(true);
        }

        // Plus institute decision approvals
        const requiredInstituteApprovals = [
            'MENTOR_ASSIGN',
            'MENTOR_ASSIGNMENT_ADJUST',
            'TOPIC_REVIEW',
            'OUTLINE_APPROVE',
            'OUTLINE_COUNCIL_MANAGE',
            'BM02_REVIEW',
            'PROJECT_ASSIGNMENT_PUBLISH',
            'DECISION_AMENDMENT_SIGN',
            'DEFENSE_COUNCIL_MANAGE',
            'RESULT_LOCK',
            'DEFENSE_RESULT_APPROVE',
            'RESULT_PUBLICATION_PUBLISH',
            'PERMISSION_ASSIGN_ACADEMIC',
        ];
        for (const approval of requiredInstituteApprovals) {
            expect(leaderPerms.has(approval)).toBe(true);
        }
    });
});
