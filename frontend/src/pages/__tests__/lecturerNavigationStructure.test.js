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

test('Regular GVHD with 5 core permissions sees only the 5 core lecturer menu items across 3 groups', () => {
    const regularGvhdPermissions = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_DEFENSE_GRADING',
    ];

    const visibleGroups = getVisibleNavigation(regularGvhdPermissions);

    // Only 3 groups should have visible items
    assert.equal(visibleGroups.length, 3, 'Regular GVHD should see exactly 3 non-empty groups');
    assert.deepEqual(
        visibleGroups.map((g) => g.group),
        ['Hồ sơ của tôi', 'Hướng dẫn & tiến độ', 'Hội đồng & bảo vệ'],
        'Groups must follow canonical order and exclude empty groups'
    );

    // Flat list of visible items
    const allVisibleItems = visibleGroups.flatMap((g) => g.items);
    assert.equal(allVisibleItems.length, 5, 'Regular GVHD must see exactly 5 core menu items');

    // Verify the exact 5 core routes and labels
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
        {
            key: 'bm04-evaluations',
            label: 'Phiếu nhận xét hướng dẫn',
            route: '/lecturer/progress?tab=bm04',
            group: 'Hướng dẫn & tiến độ',
            permission: 'VIEW_BM04_EVALUATIONS',
        },
        {
            key: 'defense-grading',
            label: 'Phiếu chấm bảo vệ',
            route: '/lecturer/grading',
            group: 'Hội đồng & bảo vệ',
            permission: 'VIEW_DEFENSE_GRADING',
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

    // Verify administrative/student/system groups are excluded
    const groupNames = visibleGroups.map((g) => g.group);
    assert.ok(!groupNames.includes('Thẩm định & quyết định'), 'Must not see Thẩm định & quyết định');
    assert.ok(!groupNames.includes('Kết quả & công bố'), 'Must not see Kết quả & công bố');
    assert.ok(!groupNames.includes('Quản trị học vụ'), 'Must not see Quản trị học vụ');
    assert.ok(!groupNames.includes('Quản trị hệ thống'), 'Must not see Quản trị hệ thống');
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
            { key: 'bm02-reviews', route: '/lecturer/institute?tab=bm02', label: 'Thẩm định đơn đăng ký' },
            { key: 'assignment-decisions', route: '/lecturer/institute?tab=decisions', label: 'Quyết định giao đề tài' },
            { key: 'academic-delegations', route: '/lecturer/institute?tab=delegations', label: 'Ủy quyền chuyên môn' },
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

test('NAVIGATION_REGISTRY maintains exactly 29 items, 7 groups, and valid routing structure', () => {
    assert.equal(NAVIGATION_REGISTRY.length, 29, 'Registry must maintain exactly 29 items');
    assert.equal(NAVIGATION_GROUPS.length, 7, 'Must define exactly 7 business groups');

    for (const item of NAVIGATION_REGISTRY) {
        assert.ok(item.route.startsWith('/'), `Route for ${item.key} must start with /: ${item.route}`);
        assert.ok(NAVIGATION_GROUPS.includes(item.group), `Group ${item.group} must be in NAVIGATION_GROUPS`);
        assert.ok(item.icon, `Icon for ${item.key} must be defined`);
    }
});
