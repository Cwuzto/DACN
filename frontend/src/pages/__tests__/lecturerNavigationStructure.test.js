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
        __filename,
    ];

    for (const filePath of filesToCheck) {
        const buffer = fs.readFileSync(filePath);
        const hasBOM = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
        assert.equal(hasBOM, false, `File ${path.basename(filePath)} must NOT contain UTF-8 BOM`);
    }
});

test('Regular GVHD without council assignment sees only 3 core items across 2 groups', () => {
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

    // Only 2 groups should have visible items ('Hội đồng & bảo vệ' is hidden because defense-grading requires council)
    assert.equal(visibleGroups.length, 2, 'Regular GVHD without council assignment should see exactly 2 non-empty groups');
    assert.deepEqual(
        visibleGroups.map((g) => g.group),
        ['Hồ sơ của tôi', 'Hướng dẫn & tiến độ'],
        'Groups must follow canonical order and exclude empty groups'
    );

    // Flat list of visible items: exactly 3 items
    const allVisibleItems = visibleGroups.flatMap((g) => g.items);
    assert.equal(allVisibleItems.length, 3, 'Regular GVHD must see exactly 3 core menu items');

    // Verify the exact 3 core routes and labels
    const expectedLecturerItems = [
        {
            key: 'my-topics',
            label: 'Đề tài phụ trách',
            route: '/lecturer/topics',
            group: 'Hồ sơ của tôi',
            permission: 'VIEW_MY_TOPICS',
        },
        {
            key: 'mentored-students',
            label: 'Sinh viên hướng dẫn',
            route: '/lecturer/approvals',
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

    // Verify council/administrative/student/system groups are excluded
    const groupNames = visibleGroups.map((g) => g.group);
    assert.ok(!groupNames.includes('Thẩm định & quyết định'), 'Must not see Thẩm định & quyết định');
    assert.ok(!groupNames.includes('Hội đồng & bảo vệ'), 'Must not see Hội đồng & bảo vệ');
    assert.ok(!groupNames.includes('Kết quả & công bố'), 'Must not see Kết quả & công bố');
    assert.ok(!groupNames.includes('Quản trị học vụ'), 'Must not see Quản trị học vụ');
    assert.ok(!groupNames.includes('Quản trị hệ thống'), 'Must not see Quản trị hệ thống');
});

test('GVHD with hasDefenseCouncilAssignment: true sees 4 items across 3 groups (including defense-grading)', () => {
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
        ['Hồ sơ của tôi', 'Hướng dẫn & tiến độ', 'Hội đồng & bảo vệ']
    );

    const allVisibleItems = visibleGroups.flatMap((g) => g.items);
    assert.equal(allVisibleItems.length, 4, 'GVHD with defense council sees exactly 4 items');
    assert.ok(allVisibleItems.some((i) => i.key === 'defense-grading'), 'Must include defense-grading');
});

test('GVHD with hasOutlineCouncilAssignment: true sees outline-reviews in "Thẩm định & quyết định"', () => {
    const gvhdWithOutlineReviewPerm = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_OUTLINE_REVIEWS',
    ];

    // Case 1: Without assignment -> outline-reviews is hidden
    const withoutOutline = getVisibleNavigation({
        role: 'LECTURER',
        permissions: gvhdWithOutlineReviewPerm,
        hasOutlineCouncilAssignment: false,
    });
    const itemsWithoutOutline = withoutOutline.flatMap((g) => g.items);
    assert.ok(!itemsWithoutOutline.some((i) => i.key === 'outline-reviews'), 'outline-reviews must be hidden without outline council assignment');

    // Case 2: With assignment -> outline-reviews is visible
    const withOutline = getVisibleNavigation({
        role: 'LECTURER',
        permissions: gvhdWithOutlineReviewPerm,
        hasOutlineCouncilAssignment: true,
    });
    const itemsWithOutline = withOutline.flatMap((g) => g.items);
    assert.ok(itemsWithOutline.some((i) => i.key === 'outline-reviews'), 'outline-reviews must be visible with outline council assignment');
    assert.ok(withOutline.some((g) => g.group === 'Thẩm định & quyết định'), 'Must include group Thẩm định & quyết định');
});

test('Admin or user with council management capabilities sees council items', () => {
    // 1. Admin role sees both without assignment flags
    const adminUser = {
        role: 'ADMIN',
        permissions: [
            'VIEW_DEFENSE_GRADING',
            'VIEW_OUTLINE_REVIEWS',
        ],
    };
    const adminNav = getVisibleNavigation(adminUser);
    const adminItems = adminNav.flatMap((g) => g.items);
    assert.ok(adminItems.some((i) => i.key === 'defense-grading'), 'Admin must see defense-grading');
    assert.ok(adminItems.some((i) => i.key === 'outline-reviews'), 'Admin must see outline-reviews');

    // 2. User with council manage permissions
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

test('Lecturer with management/Viện trưởng capabilities sees tiered governance groups and items', () => {
    const leaderPermissions = [
        // Base GVHD
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_DEFENSE_GRADING',
        // Thẩm định & quyết định
        'VIEW_OUTLINE_REVIEWS',
        'VIEW_BM02_REVIEWS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'VIEW_ACADEMIC_DELEGATIONS',
        // Hội đồng & bảo vệ (council management + lock ledger)
        'OUTLINE_COUNCIL_MANAGE',
        'DEFENSE_COUNCIL_MANAGE',
        'VIEW_DEFENSE_LOCK_LEDGER',
        // Kết quả & công bố
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'VIEW_RESULT_PUBLICATIONS',
        'VIEW_RUBRIC_CONFIG',
        // Quản trị học vụ
        'VIEW_PROJECT_PERIODS',
        'VIEW_PROJECT_ENROLLMENTS',
        'VIEW_ALL_TOPICS',
        'VIEW_PROJECT_OVERSIGHT',
    ];

    const visibleGroups = getVisibleNavigation(leaderPermissions);
    const groupMap = new Map(visibleGroups.map((g) => [g.group, g.items]));

    // 1. Thẩm định & quyết định group
    assert.ok(groupMap.has('Thẩm định & quyết định'), 'Must contain Thẩm định & quyết định');
    const decisionItems = groupMap.get('Thẩm định & quyết định');
    assert.deepEqual(
        decisionItems.map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'outline-reviews', route: '/lecturer/approvals?tab=bm01', label: 'Thẩm định đề cương' },
            { key: 'institute-management', route: '/lecturer/institute', label: 'Điều hành đợt & Quyết định' },
        ]
    );

    // 2. Hội đồng & bảo vệ group
    assert.ok(groupMap.has('Hội đồng & bảo vệ'), 'Must contain Hội đồng & bảo vệ');
    const councilItems = groupMap.get('Hội đồng & bảo vệ');
    assert.deepEqual(
        councilItems.map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'outline-councils', route: '/admin/outline-councils', label: 'HĐ Xét duyệt Đề cương' },
            { key: 'defense-councils', route: '/admin/defense-councils', label: 'HĐ Bảo vệ khóa luận' },
            { key: 'defense-grading', route: '/lecturer/grading', label: 'Phiếu chấm bảo vệ' },
            { key: 'defense-lock', route: '/admin/grading', label: 'Tổng hợp & Khóa điểm' },
        ]
    );

    // 3. Kết quả & công bố group
    assert.ok(groupMap.has('Kết quả & công bố'), 'Must contain Kết quả & công bố');
    const resultItems = groupMap.get('Kết quả & công bố');
    assert.deepEqual(
        resultItems.map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'defense-result-approvals', route: '/admin/grading?tab=approvals', label: 'Phê duyệt kết quả' },
            { key: 'result-publications', route: '/admin/grading?tab=publish', label: 'Công bố kết quả' },
            { key: 'rubric-config', route: '/admin/rubric-management', label: 'Tiêu chí chấm điểm' },
        ]
    );

    // 4. Quản trị học vụ group
    assert.ok(groupMap.has('Quản trị học vụ'), 'Must contain Quản trị học vụ');
    const academicItems = groupMap.get('Quản trị học vụ');
    assert.deepEqual(
        academicItems.map((item) => ({ key: item.key, route: item.route, label: item.label })),
        [
            { key: 'project-periods', route: '/admin/project-periods', label: 'Đợt đồ án & Học kỳ' },
            { key: 'project-enrollments', route: '/admin/project-enrollments', label: 'Điều phối & Gán sinh viên' },
            { key: 'all-topics', route: '/admin/topics', label: 'Danh mục đề tài đồ án' },
            { key: 'project-oversight', route: '/admin/oversight', label: 'Theo dõi & Giám sát tiến độ' },
            { key: 'academic-reports', route: '/admin/reports', label: 'Báo cáo & Thống kê' },
        ]
    );

    // Canonical order preserved
    const visibleGroupNames = visibleGroups.map((g) => g.group);
    assert.deepEqual(
        visibleGroupNames,
        [
            'Hồ sơ của tôi',
            'Hướng dẫn & tiến độ',
            'Thẩm định & quyết định',
            'Hội đồng & bảo vệ',
            'Kết quả & công bố',
            'Quản trị học vụ',
        ]
    );
});

test('All items in NAVIGATION_REGISTRY strictly adhere to Rule 2.6 (No raw emoji or graphic symbols in labels)', () => {
    // Regex matching raw emojis or forbidden graphic characters in Rule 2.6
    const forbiddenPattern = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}←→↑↓+✓✏👥🗑🔓▾▴↗]/u;

    for (const item of NAVIGATION_REGISTRY) {
        assert.ok(item.label, `Item ${item.key} must have a label`);
        assert.equal(
            forbiddenPattern.test(item.label),
            false,
            `Item ${item.key} label "${item.label}" violates Rule 2.6 by containing raw emoji or graphic symbols`
        );
        // Ensure label does not start or end with strange whitespace or non-standard characters
        assert.equal(item.label.trim(), item.label, `Item ${item.key} label should not have untrimmed whitespace`);
    }
});

test('NAVIGATION_REGISTRY maintains exactly 26 items, 7 groups, and valid routing structure', () => {
    assert.equal(NAVIGATION_REGISTRY.length, 26, 'Registry must maintain exactly 26 items');
    assert.equal(NAVIGATION_GROUPS.length, 7, 'Must define exactly 7 business groups');

    for (const item of NAVIGATION_REGISTRY) {
        assert.ok(item.route.startsWith('/'), `Route for ${item.key} must start with /: ${item.route}`);
        assert.ok(NAVIGATION_GROUPS.includes(item.group), `Group ${item.group} must be in NAVIGATION_GROUPS`);
        assert.ok(item.icon, `Icon for ${item.key} must be defined`);
    }
});
