import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEATURE_POLICY_LIST } from '../src/auth/featurePolicies.js';
import {
    NAVIGATION_REGISTRY,
    NAVIGATION_GROUPS,
    getVisibleNavigation,
} from '../src/config/navigationRegistry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('NAVIGATION_REGISTRY is derived from FEATURE_POLICY_LIST without a second manual array', () => {
    const navSrc = fs.readFileSync(path.join(root, 'src/config/navigationRegistry.js'), 'utf8');
    assert.match(navSrc, /FEATURE_POLICY_LIST/, 'navigationRegistry.js must derive from FEATURE_POLICY_LIST');

    const expectedMenuPolicies = FEATURE_POLICY_LIST.filter((p) => Boolean(p.menu));
    assert.equal(NAVIGATION_REGISTRY.length, expectedMenuPolicies.length);
    assert.equal(NAVIGATION_REGISTRY.length, 26, 'Registry must contain exactly 26 workflow menu entries');

    const expectedKeys = new Set(expectedMenuPolicies.map((p) => p.key));
    const seenKeys = new Set();

    for (const item of NAVIGATION_REGISTRY) {
        assert.ok(item.key, 'Item must have a non-empty key');
        assert.ok(item.label, `Item ${item.key} must have a label`);
        assert.ok(item.icon, `Item ${item.key} must have an icon`);
        assert.ok(item.group, `Item ${item.key} must have a group`);
        assert.ok(
            item.requiredPermission || (Array.isArray(item.requiredAnyPermissions) && item.requiredAnyPermissions.length > 0),
            `Item ${item.key} must have a requiredPermission or requiredAnyPermissions`
        );
        assert.ok(item.route, `Item ${item.key} must have a route`);
        assert.ok(
            NAVIGATION_GROUPS.includes(item.group),
            `Item ${item.key} group "${item.group}" must be in NAVIGATION_GROUPS`
        );
        assert.ok(expectedKeys.has(item.key), `Unexpected item key: ${item.key}`);
        assert.ok(!seenKeys.has(item.key), `Duplicate key: ${item.key}`);
        seenKeys.add(item.key);
    }

    assert.equal(seenKeys.size, 26);
});

test('NAVIGATION_GROUPS defines the 9 workflow domain groups in strict business order', () => {
    assert.deepEqual(NAVIGATION_GROUPS, [
        'Đăng ký & đề cương',
        'Thực hiện đồ án',
        'Đợt & đăng ký',
        'Hướng dẫn & tiến độ',
        'Hội đồng & bảo vệ',
        'Bảo vệ & hoàn tất',
        'Kết quả & báo cáo',
        'Điều hành viện',
        'Nội dung & hệ thống',
    ]);
});

test('Student with SYSTEM_STUDENT_BASE sees workflow-grouped items with updated labels', () => {
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

    assert.deepEqual(
        nav.map((g) => g.group),
        ['Đăng ký & đề cương', 'Thực hiện đồ án', 'Bảo vệ & hoàn tất']
    );

    assert.deepEqual(
        nav.flatMap((g) => g.items).map((i) => ({ key: i.key, label: i.label, route: i.route })),
        [
            { key: 'my-registration', label: 'Tìm & đăng ký đề tài', route: '/student/topics' },
            { key: 'my-submissions', label: 'Việc của tôi', route: '/student/submissions' },
            { key: 'my-grades', label: 'Kết quả & điểm đồ án', route: '/student/grades' },
        ]
    );
});

test('Lecturer with GVHD: without defense council assignment sees 4 items across 2 groups; with defense council assignment sees defense-grading (5 items across 3 groups)', () => {
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

    const navWithoutCouncil = getVisibleNavigation(gvhdPermissions);

    assert.equal(navWithoutCouncil.length, 2);
    assert.deepEqual(
        navWithoutCouncil.map((n) => n.group),
        ['Đăng ký & đề cương', 'Hướng dẫn & tiến độ']
    );

    assert.deepEqual(
        navWithoutCouncil[0].items.map((i) => ({ key: i.key, label: i.label, route: i.route })),
        [
            { key: 'my-topics', label: 'Đề tài phụ trách', route: '/lecturer/topics' },
            { key: 'mentored-students', label: 'Duyệt nguyện vọng', route: '/lecturer/approvals?tab=mentor' },
        ]
    );
    assert.deepEqual(
        navWithoutCouncil[1].items.map((i) => ({ key: i.key, label: i.label, route: i.route })),
        [
            { key: 'lecturer-students', label: 'Sinh viên đang hướng dẫn', route: '/lecturer/students' },
            { key: 'progress-checkpoints', label: 'Theo dõi tiến độ', route: '/lecturer/progress' },
        ]
    );

    const navWithCouncil = getVisibleNavigation({
        role: 'LECTURER',
        permissions: gvhdPermissions,
        hasDefenseCouncilAssignment: true,
    });

    assert.equal(navWithCouncil.length, 3);
    assert.deepEqual(
        navWithCouncil.map((n) => n.group),
        ['Đăng ký & đề cương', 'Hướng dẫn & tiến độ', 'Hội đồng & bảo vệ']
    );
    assert.deepEqual(
        navWithCouncil[2].items.map((i) => i.key),
        ['defense-grading']
    );
});

test('Institute leader (VIEN_TRUONG) sees workflow groups including single Điều hành học vụ item', () => {
    const vienTruongPermissions = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_OUTLINE_REVIEWS',
        'VIEW_BM02_REVIEWS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'VIEW_ACADEMIC_DELEGATIONS',
        'OUTLINE_COUNCIL_MANAGE',
        'DEFENSE_COUNCIL_MANAGE',
        'VIEW_DEFENSE_GRADING',
        'VIEW_DEFENSE_LOCK_LEDGER',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'VIEW_RESULT_PUBLICATIONS',
        'VIEW_RUBRIC_CONFIG',
        'VIEW_PROJECT_PERIODS',
        'REPORT_VIEW',
    ];

    const vienTruongUser = {
        role: 'LECTURER',
        permissions: vienTruongPermissions,
        hasDefenseCouncilAssignment: true,
        hasOutlineCouncilAssignment: true,
    };

    const nav = getVisibleNavigation(vienTruongUser);
    const groups = nav.map((n) => n.group);

    assert.ok(groups.includes('Đăng ký & đề cương'));
    assert.ok(groups.includes('Hội đồng & bảo vệ'));
    assert.ok(groups.includes('Kết quả & báo cáo'));
    assert.ok(groups.includes('Điều hành viện'));

    const instituteGroup = nav.find((n) => n.group === 'Điều hành viện');
    assert.deepEqual(
        instituteGroup.items.map((i) => ({ key: i.key, label: i.label, route: i.route })),
        [{ key: 'lecturer-institute', label: 'Điều hành học vụ', route: '/lecturer/institute' }]
    );

    const regGroup = nav.find((n) => n.group === 'Đăng ký & đề cương');
    assert.deepEqual(
        regGroup.items.map((i) => i.key),
        ['my-topics', 'mentored-students', 'outline-reviews']
    );

    const councilGroup = nav.find((n) => n.group === 'Hội đồng & bảo vệ');
    assert.deepEqual(
        councilGroup.items.map((i) => i.key),
        ['outline-councils', 'defense-councils', 'defense-grading', 'defense-lock']
    );

    const resultGroup = nav.find((n) => n.group === 'Kết quả & báo cáo');
    assert.deepEqual(
        resultGroup.items.map((i) => i.key),
        ['defense-result-approvals', 'result-publications', 'rubric-config', 'academic-reports']
    );
});

test('System administrator / Academic staff sees separated workflow groups and labels', () => {
    const adminPermissions = [
        'VIEW_PROJECT_PERIODS',
        'VIEW_PROJECT_ENROLLMENTS',
        'VIEW_ALL_TOPICS',
        'VIEW_PROJECT_OVERSIGHT',
        'REPORT_VIEW',
        'VIEW_USERS',
        'VIEW_PERMISSIONS',
        'VIEW_ANNOUNCEMENTS',
        'VIEW_PORTAL_CONTENT',
        'VIEW_NOTIFICATIONS',
    ];

    const nav = getVisibleNavigation(adminPermissions);
    const groups = nav.map((n) => n.group);

    assert.deepEqual(groups, [
        'Đợt & đăng ký',
        'Hướng dẫn & tiến độ',
        'Kết quả & báo cáo',
        'Nội dung & hệ thống',
    ]);

    assert.deepEqual(
        nav.find((g) => g.group === 'Đợt & đăng ký').items.map((i) => i.key),
        ['project-periods', 'project-enrollments', 'all-topics']
    );
    assert.deepEqual(
        nav.find((g) => g.group === 'Hướng dẫn & tiến độ').items.map((i) => i.key),
        ['project-oversight']
    );
    assert.deepEqual(
        nav.find((g) => g.group === 'Kết quả & báo cáo').items.map((i) => ({ key: i.key, label: i.label })),
        [{ key: 'academic-reports', label: 'Báo cáo học vụ' }]
    );
    assert.deepEqual(
        nav.find((g) => g.group === 'Nội dung & hệ thống').items.map((i) => ({ key: i.key, label: i.label })),
        [
            { key: 'announcements', label: 'Bản tin công khai' },
            { key: 'portal-content', label: 'Biểu mẫu & nội dung' },
            { key: 'notifications', label: 'Thông báo tài khoản' },
            { key: 'users', label: 'Người dùng' },
            { key: 'permissions', label: 'Phân quyền' },
        ]
    );
});

test('Empty groups with 0 accessible items are completely excluded from results', () => {
    const emptyNav = getVisibleNavigation([]);
    assert.deepEqual(emptyNav, []);

    const singleNav = getVisibleNavigation(['VIEW_USERS']);
    assert.equal(singleNav.length, 1);
    assert.equal(singleNav[0].group, 'Nội dung & hệ thống');
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
    const reverseOrderPermissions = [
        'VIEW_NOTIFICATIONS',
        'VIEW_ALL_TOPICS',
        'VIEW_RUBRIC_CONFIG',
        'VIEW_MY_REGISTRATION',
    ];

    const nav = getVisibleNavigation(reverseOrderPermissions);
    assert.deepEqual(
        nav.map((n) => n.group),
        [
            'Đăng ký & đề cương',
            'Đợt & đăng ký',
            'Kết quả & báo cáo',
            'Nội dung & hệ thống',
        ]
    );
});

test('GIAO_VU does not receive synthetic VIEW_PROJECT_ENROLLMENTS in navigation', () => {
    const giaoVuWithoutEnrollment = {
        role: 'LECTURER',
        permissions: ['VIEW_ALL_TOPICS'],
        permissionGroups: ['GIAO_VU'],
    };

    const nav = getVisibleNavigation(giaoVuWithoutEnrollment);
    const allItems = nav.flatMap((g) => g.items);
    assert.ok(
        !allItems.some((i) => i.key === 'project-enrollments'),
        'project-enrollments must not be visible when user lacks VIEW_PROJECT_ENROLLMENTS capability'
    );
});

test('ADMIN does not bypass council assignment check in navigation', () => {
    const adminWithoutCouncil = {
        role: 'ADMIN',
        permissions: ['VIEW_USERS', 'VIEW_PERMISSIONS', 'VIEW_DEFENSE_GRADING', 'VIEW_OUTLINE_REVIEWS'],
        hasDefenseCouncilAssignment: false,
        hasOutlineCouncilAssignment: false,
    };

    const nav = getVisibleNavigation(adminWithoutCouncil);
    const allItems = nav.flatMap((g) => g.items);
    assert.ok(!allItems.some((i) => i.key === 'outline-councils'));
    assert.ok(!allItems.some((i) => i.key === 'defense-councils'));
    assert.ok(!allItems.some((i) => i.key === 'defense-grading'));
    assert.ok(!allItems.some((i) => i.key === 'outline-reviews'));
});
