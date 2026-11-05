import test from 'node:test';
import assert from 'node:assert/strict';
import {
    NAVIGATION_REGISTRY,
    NAVIGATION_GROUPS,
    getVisibleNavigation,
} from '../src/config/navigationRegistry.js';

test('NAVIGATION_REGISTRY contains exactly 27 items with required keys and unique keys/permissions', () => {
    assert.equal(NAVIGATION_REGISTRY.length, 27, 'Registry must contain exactly 27 entries');

    const expectedKeys = new Set([
        // Khối 1: Hồ sơ của tôi (5)
        'my-registration',
        'my-topics',
        'my-submissions',
        'my-archive',
        'my-grades',
        // Khối 2: Hướng dẫn & tiến độ (3)
        'mentored-students',
        'progress-checkpoints',
        'bm04-evaluations',
        // Khối 3: Thẩm định & quyết định (4)
        'outline-reviews',
        'bm02-reviews',
        'assignment-decisions',
        'academic-delegations',
        // Khối 4: Hội đồng & bảo vệ (3)
        'council-assignments',
        'defense-grading',
        'defense-lock',
        // Khối 5: Kết quả & công bố (3)
        'defense-result-approvals',
        'result-publications',
        'rubric-config',
        // Khối 6: Quản trị học vụ (4)
        'project-periods',
        'project-enrollments',
        'all-topics',
        'project-oversight',
        // Khối 7: Quản trị hệ thống (5)
        'users',
        'permissions',
        'announcements',
        'portal-content',
        'notifications',
    ]);

    const seenKeys = new Set();
    const seenPermissions = new Set();

    for (const item of NAVIGATION_REGISTRY) {
        assert.ok(item.key, 'Item must have a non-empty key');
        assert.ok(item.label, `Item ${item.key} must have a label`);
        assert.ok(item.icon, `Item ${item.key} must have an icon`);
        assert.ok(item.group, `Item ${item.key} must have a group`);
        assert.ok(item.requiredPermission, `Item ${item.key} must have a requiredPermission`);
        assert.ok(item.route, `Item ${item.key} must have a route`);

        assert.ok(
            NAVIGATION_GROUPS.includes(item.group),
            `Item ${item.key} group "${item.group}" must be in NAVIGATION_GROUPS`
        );
        assert.ok(expectedKeys.has(item.key), `Unexpected item key: ${item.key}`);

        assert.ok(!seenKeys.has(item.key), `Duplicate key: ${item.key}`);
        seenKeys.add(item.key);

        assert.ok(
            !seenPermissions.has(item.requiredPermission),
            `Duplicate requiredPermission: ${item.requiredPermission}`
        );
        seenPermissions.add(item.requiredPermission);
    }

    assert.equal(seenKeys.size, 27);
    assert.equal(seenPermissions.size, 27);
});

test('NAVIGATION_GROUPS defines the 7 domain groups in strict business order', () => {
    assert.deepEqual(NAVIGATION_GROUPS, [
        'Hồ sơ của tôi',
        'Hướng dẫn & tiến độ',
        'Thẩm định & quyết định',
        'Hội đồng & bảo vệ',
        'Kết quả & công bố',
        'Quản trị học vụ',
        'Quản trị hệ thống',
    ]);
});

test('Student with SYSTEM_STUDENT_BASE sees only "Hồ sơ của tôi" (4 student items)', () => {
    const studentPermissions = [
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

    const nav = getVisibleNavigation(studentPermissions);

    assert.equal(nav.length, 1, 'Student should only see 1 group');
    assert.equal(nav[0].group, 'Hồ sơ của tôi');
    assert.deepEqual(
        nav[0].items.map((i) => i.key),
        ['my-registration', 'my-submissions', 'my-archive', 'my-grades'],
        'Student should not see my-topics (lecturer only)'
    );

    // Verify student cannot see any management, review, or system groups
    const groupNames = nav.map((g) => g.group);
    assert.ok(!groupNames.includes('Hướng dẫn & tiến độ'));
    assert.ok(!groupNames.includes('Thẩm định & quyết định'));
    assert.ok(!groupNames.includes('Hội đồng & bảo vệ'));
    assert.ok(!groupNames.includes('Kết quả & công bố'));
    assert.ok(!groupNames.includes('Quản trị học vụ'));
    assert.ok(!groupNames.includes('Quản trị hệ thống'));
});

test('Lecturer with GVHD sees "Hồ sơ của tôi" (my-topics), "Hướng dẫn & tiến độ", and "Hội đồng & bảo vệ" (defense-grading)', () => {
    const gvhdPermissions = [
        'TOPIC_CREATE',
        'TOPIC_UPDATE_OWN',
        'MENTOR_REQUEST_REVIEW',
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_DEFENSE_GRADING',
    ];

    const nav = getVisibleNavigation(gvhdPermissions);

    assert.equal(nav.length, 3);
    assert.deepEqual(
        nav.map((n) => n.group),
        ['Hồ sơ của tôi', 'Hướng dẫn & tiến độ', 'Hội đồng & bảo vệ']
    );

    assert.deepEqual(
        nav[0].items.map((i) => i.key),
        ['my-topics']
    );
    assert.deepEqual(
        nav[1].items.map((i) => i.key),
        ['mentored-students', 'progress-checkpoints', 'bm04-evaluations']
    );
    assert.deepEqual(
        nav[2].items.map((i) => i.key),
        ['defense-grading']
    );
});

test('Institute leader (VIEN_TRUONG) sees "Thẩm định & quyết định", "Hội đồng & bảo vệ", "Kết quả & công bố"', () => {
    const vienTruongPermissions = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_OUTLINE_REVIEWS',
        'VIEW_BM02_REVIEWS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'VIEW_ACADEMIC_DELEGATIONS',
        'VIEW_COUNCIL_ASSIGNMENTS',
        'VIEW_DEFENSE_GRADING',
        'VIEW_DEFENSE_LOCK_LEDGER',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'VIEW_RESULT_PUBLICATIONS',
        'VIEW_RUBRIC_CONFIG',
        'VIEW_PROJECT_PERIODS',
    ];

    const nav = getVisibleNavigation(vienTruongPermissions);
    const groups = nav.map((n) => n.group);

    assert.ok(groups.includes('Thẩm định & quyết định'));
    assert.ok(groups.includes('Hội đồng & bảo vệ'));
    assert.ok(groups.includes('Kết quả & công bố'));

    const decisionGroup = nav.find((n) => n.group === 'Thẩm định & quyết định');
    assert.deepEqual(
        decisionGroup.items.map((i) => i.key),
        ['outline-reviews', 'bm02-reviews', 'assignment-decisions', 'academic-delegations']
    );

    const councilGroup = nav.find((n) => n.group === 'Hội đồng & bảo vệ');
    assert.deepEqual(
        councilGroup.items.map((i) => i.key),
        ['council-assignments', 'defense-grading', 'defense-lock']
    );

    const resultGroup = nav.find((n) => n.group === 'Kết quả & công bố');
    assert.deepEqual(
        resultGroup.items.map((i) => i.key),
        ['defense-result-approvals', 'result-publications', 'rubric-config']
    );
});

test('System administrator (QUAN_TRI_VIEN) sees "Quản trị học vụ" and "Quản trị hệ thống"', () => {
    const adminPermissions = [
        'VIEW_PROJECT_PERIODS',
        'VIEW_PROJECT_ENROLLMENTS',
        'VIEW_ALL_TOPICS',
        'VIEW_PROJECT_OVERSIGHT',
        'VIEW_USERS',
        'VIEW_PERMISSIONS',
        'VIEW_ANNOUNCEMENTS',
        'VIEW_PORTAL_CONTENT',
        'VIEW_NOTIFICATIONS',
    ];

    const nav = getVisibleNavigation(adminPermissions);
    const groups = nav.map((n) => n.group);

    assert.ok(groups.includes('Quản trị học vụ'));
    assert.ok(groups.includes('Quản trị hệ thống'));

    const academicGroup = nav.find((n) => n.group === 'Quản trị học vụ');
    assert.deepEqual(
        academicGroup.items.map((i) => i.key),
        ['project-periods', 'project-enrollments', 'all-topics', 'project-oversight']
    );

    const sysAdminGroup = nav.find((n) => n.group === 'Quản trị hệ thống');
    assert.deepEqual(
        sysAdminGroup.items.map((i) => i.key),
        ['users', 'permissions', 'announcements', 'portal-content', 'notifications']
    );
});

test('Empty groups with 0 accessible items are completely excluded from results', () => {
    const emptyNav = getVisibleNavigation([]);
    assert.deepEqual(emptyNav, []);

    const singleNav = getVisibleNavigation(['VIEW_USERS']);
    assert.equal(singleNav.length, 1);
    assert.equal(singleNav[0].group, 'Quản trị hệ thống');
    assert.equal(singleNav[0].items.length, 1);
    assert.equal(singleNav[0].items[0].key, 'users');
});

test('getVisibleNavigation handles Set, Array, User object, and empty/null arguments', () => {
    const perms = ['VIEW_MY_REGISTRATION'];
    const fromArray = getVisibleNavigation(perms);
    const fromSet = getVisibleNavigation(new Set(perms));
    const fromUser = getVisibleNavigation({ permissions: perms });
    const fromNull = getVisibleNavigation(null);
    const fromUndefined = getVisibleNavigation(undefined);

    assert.equal(fromArray.length, 1);
    assert.equal(fromSet.length, 1);
    assert.equal(fromUser.length, 1);
    assert.deepEqual(fromNull, []);
    assert.deepEqual(fromUndefined, []);
});

test('Returned navigation groups strictly preserve the canonical NAVIGATION_GROUPS order', () => {
    // Pass permissions from various groups in reverse order
    const reverseOrderPermissions = [
        'VIEW_NOTIFICATIONS', // Quản trị hệ thống (Group 7)
        'VIEW_PROJECT_PERIODS', // Quản trị học vụ (Group 6)
        'VIEW_RUBRIC_CONFIG', // Kết quả & công bố (Group 5)
        'VIEW_MY_REGISTRATION', // Hồ sơ của tôi (Group 1)
    ];

    const nav = getVisibleNavigation(reverseOrderPermissions);
    assert.deepEqual(
        nav.map((n) => n.group),
        [
            'Hồ sơ của tôi',
            'Kết quả & công bố',
            'Quản trị học vụ',
            'Quản trị hệ thống',
        ]
    );
});
