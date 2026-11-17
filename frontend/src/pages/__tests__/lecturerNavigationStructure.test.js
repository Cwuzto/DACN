import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    NAVIGATION_REGISTRY,
    NAVIGATION_GROUPS,
    getVisibleNavigation,
} from '../../config/navigationRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

test('UTF-8 without BOM verification for navigation files (Rule 2.4)', () => {
    const filesToCheck = [
        path.join(rootDir, 'src/config/navigationRegistry.js'),
        path.join(rootDir, 'src/auth/featurePolicies.js'),
        __filename,
    ];

    for (const filePath of filesToCheck) {
        const buffer = fs.readFileSync(filePath);
        const hasBOM = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
        assert.equal(hasBOM, false, `File ${path.basename(filePath)} must NOT contain UTF-8 BOM`);
    }
});

test('Regular GVHD without council assignment sees 4 core items across 2 workflow groups', () => {
    const regularGvhdPermissions = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_DEFENSE_GRADING',
    ];

    const userWithoutCouncil = {
        role: 'LECTURER',
        permissions: regularGvhdPermissions,
        hasDefenseCouncilAssignment: false,
        hasOutlineCouncilAssignment: false,
    };

    const visibleGroups = getVisibleNavigation(userWithoutCouncil);

    assert.equal(visibleGroups.length, 2, 'Regular GVHD without council assignment should see exactly 2 non-empty groups');
    assert.deepEqual(
        visibleGroups.map((g) => g.group),
        ['Đăng ký & đề cương', 'Hướng dẫn & tiến độ'],
        'Groups must follow canonical workflow order and exclude empty groups'
    );

    const allVisibleItems = visibleGroups.flatMap((g) => g.items);
    assert.equal(allVisibleItems.length, 4, 'Regular GVHD must see 4 core menu items');

    const expectedLecturerItems = [
        {
            key: 'my-topics',
            label: 'Đề tài phụ trách',
            route: '/lecturer/topics',
            group: 'Đăng ký & đề cương',
            permission: 'VIEW_MY_TOPICS',
        },
        {
            key: 'mentored-students',
            label: 'Duyệt nguyện vọng',
            route: '/lecturer/approvals?tab=mentor',
            group: 'Đăng ký & đề cương',
            permission: 'VIEW_MENTORED_STUDENTS',
        },
        {
            key: 'lecturer-students',
            label: 'Sinh viên đang hướng dẫn',
            route: '/lecturer/students',
            group: 'Hướng dẫn & tiến độ',
            permission: 'VIEW_MENTORED_STUDENTS',
        },
        {
            key: 'progress-checkpoints',
            label: 'Theo dõi tiến độ',
            route: '/lecturer/progress',
            group: 'Hướng dẫn & tiến độ',
            permission: 'VIEW_CHECKPOINTS',
        },
    ];

    for (let i = 0; i < expectedLecturerItems.length; i++) {
        const expected = expectedLecturerItems[i];
        const actual = allVisibleItems[i];
        assert.equal(actual.key, expected.key, `Item ${i} key mismatch`);
        assert.equal(actual.label, expected.label, `Item ${i} label mismatch`);
        assert.equal(actual.route, expected.route, `Item ${i} route mismatch`);
        assert.equal(actual.group, expected.group, `Item ${i} group mismatch`);
        assert.equal(actual.requiredPermission, expected.permission, `Item ${i} permission mismatch`);
    }

    const groupNames = visibleGroups.map((g) => g.group);
    assert.ok(!groupNames.includes('Hội đồng & bảo vệ'), 'Must not see Hội đồng & bảo vệ');
    assert.ok(!groupNames.includes('Kết quả & báo cáo'), 'Must not see Kết quả & báo cáo');
    assert.ok(!groupNames.includes('Nội dung & hệ thống'), 'Must not see Nội dung & hệ thống');
});

test('GVHD with hasDefenseCouncilAssignment: true sees 5 items across 3 groups (including defense-grading)', () => {
    const regularGvhdPermissions = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_DEFENSE_GRADING',
    ];

    const userWithDefenseCouncil = {
        role: 'LECTURER',
        permissions: regularGvhdPermissions,
        hasDefenseCouncilAssignment: true,
    };

    const visibleGroups = getVisibleNavigation(userWithDefenseCouncil);

    assert.equal(visibleGroups.length, 3, 'GVHD with defense council should see 3 non-empty groups');
    assert.deepEqual(
        visibleGroups.map((g) => g.group),
        ['Đăng ký & đề cương', 'Hướng dẫn & tiến độ', 'Hội đồng & bảo vệ']
    );

    const allVisibleItems = visibleGroups.flatMap((g) => g.items);
    assert.equal(allVisibleItems.length, 5, 'GVHD with defense council sees 5 items');
    assert.ok(allVisibleItems.some((i) => i.key === 'defense-grading'), 'Must include defense-grading');
});

test('GVHD with hasOutlineCouncilAssignment: true sees outline-reviews in "Đăng ký & đề cương"', () => {
    const gvhdWithOutlineReviewPerm = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_OUTLINE_REVIEWS',
    ];

    const withoutOutline = getVisibleNavigation({
        role: 'LECTURER',
        permissions: gvhdWithOutlineReviewPerm,
        hasOutlineCouncilAssignment: false,
    });
    const itemsWithoutOutline = withoutOutline.flatMap((g) => g.items);
    assert.ok(!itemsWithoutOutline.some((i) => i.key === 'outline-reviews'), 'outline-reviews must be hidden without outline council assignment');

    const withOutline = getVisibleNavigation({
        role: 'LECTURER',
        permissions: gvhdWithOutlineReviewPerm,
        hasOutlineCouncilAssignment: true,
    });
    const itemsWithOutline = withOutline.flatMap((g) => g.items);
    assert.ok(itemsWithOutline.some((i) => i.key === 'outline-reviews'), 'outline-reviews must be visible with outline council assignment');
    const regGroup = withOutline.find((g) => g.group === 'Đăng ký & đề cương');
    assert.ok(regGroup.items.some((i) => i.key === 'outline-reviews'));
});

test('Admin without council assignment does not bypass defense-grading/outline-reviews; council managers see council items', () => {
    const adminUser = {
        role: 'ADMIN',
        permissions: [
            'VIEW_DEFENSE_GRADING',
            'VIEW_OUTLINE_REVIEWS',
        ],
        hasDefenseCouncilAssignment: false,
        hasOutlineCouncilAssignment: false,
    };
    const adminNav = getVisibleNavigation(adminUser);
    const adminItems = adminNav.flatMap((g) => g.items);
    assert.ok(!adminItems.some((i) => i.key === 'defense-grading'), 'Admin without council assignment must not bypass defense-grading');
    assert.ok(!adminItems.some((i) => i.key === 'outline-reviews'), 'Admin without council assignment must not bypass outline-reviews');

    const managerNav = getVisibleNavigation([
        'OUTLINE_COUNCIL_MANAGE',
        'DEFENSE_COUNCIL_MANAGE',
        'VIEW_DEFENSE_GRADING',
        'VIEW_OUTLINE_REVIEWS',
    ]);
    const managerItems = managerNav.flatMap((g) => g.items);
    assert.ok(managerItems.some((i) => i.key === 'defense-grading'), 'Council manager must see defense-grading');
    assert.ok(managerItems.some((i) => i.key === 'outline-reviews'), 'Council manager must see outline-reviews');
});

test('Lecturer with management/Viện trưởng capabilities sees workflow groups and items', () => {
    const leaderPermissions = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_DEFENSE_GRADING',
        'VIEW_OUTLINE_REVIEWS',
        'OUTLINE_COUNCIL_MANAGE',
        'DEFENSE_COUNCIL_MANAGE',
        'VIEW_DEFENSE_LOCK_LEDGER',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'VIEW_RESULT_PUBLICATIONS',
        'VIEW_RUBRIC_CONFIG',
        'VIEW_PROJECT_PERIODS',
        'VIEW_PROJECT_ENROLLMENTS',
        'VIEW_ALL_TOPICS',
        'VIEW_PROJECT_OVERSIGHT',
        'REPORT_VIEW',
    ];

    const visibleGroups = getVisibleNavigation(leaderPermissions);
    const groupMap = new Map(visibleGroups.map((g) => [g.group, g.items]));

    assert.deepEqual(
        groupMap.get('Đăng ký & đề cương').map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'my-topics', route: '/lecturer/topics', label: 'Đề tài phụ trách' },
            { key: 'mentored-students', route: '/lecturer/approvals?tab=mentor', label: 'Duyệt nguyện vọng' },
            { key: 'outline-reviews', route: '/lecturer/approvals?tab=bm01', label: 'Thẩm định đề cương' },
        ]
    );

    assert.deepEqual(
        groupMap.get('Hướng dẫn & tiến độ').map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'lecturer-students', route: '/lecturer/students', label: 'Sinh viên đang hướng dẫn' },
            { key: 'progress-checkpoints', route: '/lecturer/progress', label: 'Theo dõi tiến độ' },
            { key: 'project-oversight', route: '/admin/oversight', label: 'Giám sát tiến độ' },
        ]
    );

    assert.deepEqual(
        groupMap.get('Hội đồng & bảo vệ').map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'outline-councils', route: '/admin/outline-councils', label: 'Hội đồng xét duyệt đề cương' },
            { key: 'defense-councils', route: '/admin/defense-councils', label: 'Hội đồng bảo vệ' },
            { key: 'defense-grading', route: '/lecturer/grading', label: 'Phiếu chấm bảo vệ' },
            { key: 'defense-lock', route: '/admin/grading', label: 'Sổ điểm bảo vệ' },
        ]
    );

    assert.deepEqual(
        groupMap.get('Kết quả & báo cáo').map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'defense-result-approvals', route: '/admin/grading?tab=approvals', label: 'Phê duyệt kết quả' },
            { key: 'result-publications', route: '/admin/grading?tab=publish', label: 'Công bố kết quả học kỳ' },
            { key: 'rubric-config', route: '/admin/rubric-management', label: 'Tiêu chí chấm điểm' },
            { key: 'academic-reports', route: '/admin/reports', label: 'Báo cáo học vụ' },
        ]
    );

    assert.deepEqual(
        groupMap.get('Điều hành viện').map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'lecturer-institute', route: '/lecturer/institute', label: 'Điều hành học vụ' },
        ]
    );

    assert.deepEqual(
        visibleGroups.map((g) => g.group),
        [
            'Đăng ký & đề cương',
            'Đợt & đăng ký',
            'Hướng dẫn & tiến độ',
            'Hội đồng & bảo vệ',
            'Kết quả & báo cáo',
            'Điều hành viện',
        ]
    );
});

test('All items in NAVIGATION_REGISTRY strictly adhere to Rule 2.6 (No raw emoji or graphic symbols in labels)', () => {
    const forbiddenPattern = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}←→↑↓+✓✏👥🗑🔓▾▴↗]/u;

    for (const item of NAVIGATION_REGISTRY) {
        assert.ok(item.label, `Item ${item.key} must have a label`);
        assert.equal(
            forbiddenPattern.test(item.label),
            false,
            `Item ${item.key} label "${item.label}" violates Rule 2.6 by containing raw emoji or graphic symbols`
        );
        assert.equal(item.label.trim(), item.label, `Item ${item.key} label should not have untrimmed whitespace`);
    }
});

test('NAVIGATION_REGISTRY maintains 27 workflow items, 9 groups, and valid routing structure', () => {
    assert.equal(NAVIGATION_REGISTRY.length, 27, 'Registry must maintain 27 items');
    assert.equal(NAVIGATION_GROUPS.length, 9, 'Must define 9 workflow business groups');

    for (const item of NAVIGATION_REGISTRY) {
        assert.ok(item.route.startsWith('/'), `Route for ${item.key} must start with /: ${item.route}`);
        assert.ok(NAVIGATION_GROUPS.includes(item.group), `Group ${item.group} must be in NAVIGATION_GROUPS`);
        assert.ok(item.icon, `Icon for ${item.key} must be defined`);
    }
});
