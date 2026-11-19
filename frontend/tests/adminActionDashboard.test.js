import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dashboardService from '../src/services/dashboardService.js';
import api from '../src/services/api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 2 files exist and adhere to UTF-8 without BOM', () => {
    const files = [
        'src/services/dashboardService.js',
        'src/queries/dashboardQueries.js',
        'src/pages/admin/DashboardPage.jsx',
        'src/pages/admin/CouncilAssignmentPage.jsx',
    ];

    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${f} must NOT have UTF-8 BOM`);
    }
});

test('dashboardService.getAdminActions calls GET /dashboard/admin-actions with { params: { semesterId } }', async () => {
    assert.equal(typeof dashboardService.getAdminActions, 'function');

    let capturedUrl = null;
    let capturedConfig = null;
    const originalGet = api.get;

    api.get = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return {
            success: true,
            data: {
                semesterId: 42,
                items: [
                    {
                        kind: 'OUTLINE_COUNCIL_ASSIGN',
                        count: 3,
                        title: 'Phân hội đồng đề cương',
                        description: '3 hồ sơ đã nộp BM01 đủ điều kiện phân hội đồng đề cương.',
                        dueAt: null,
                        priority: 'NORMAL',
                        target: '/admin/outline-councils?semesterId=42',
                        requiredPermission: 'OUTLINE_COUNCIL_MANAGE',
                        sourceStatus: 'BM01_SUBMITTED',
                    },
                ],
            },
        };
    };

    try {
        const res = await dashboardService.getAdminActions(42);
        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/dashboard/admin-actions');
        assert.deepEqual(capturedConfig, { params: { semesterId: 42 } });
    } finally {
        api.get = originalGet;
    }
});

test('dashboardQueries exports useAdminDashboardActions and dashboardKeys.adminActions includes scope + semesterId', () => {
    const queriesSrc = read('src/queries/dashboardQueries.js');
    assert.match(queriesSrc, /adminActions:\s*\(scope,\s*semesterId\s*=\s*null\)\s*=>\s*\[\.\.\.scope,\s*'dashboard',\s*'admin-actions',\s*\{\s*semesterId:\s*semesterId\s*\?\?\s*null\s*\}\]/);
    assert.match(queriesSrc, /export const useAdminDashboardActions\s*=/);
    assert.match(queriesSrc, /dashboardService\.getAdminActions\(semesterId\)/);
});

test('Admin DashboardPage uses useAdminDashboardActions, consistent semesterId, dynamic cards/queue, empty & error states', () => {
    const src = read('src/pages/admin/DashboardPage.jsx');

    // Uses useAdminDashboardActions and semester-scoped queries
    assert.match(src, /useAdminDashboardActions\(\s*scope\s*,\s*selectedSemesterId\s*,\s*Boolean\(selectedSemesterId\)\s*\)/);
    assert.match(src, /useDashboardStats\(\s*scope\s*,\s*selectedSemesterId/);
    assert.match(src, /useDashboardScores\(\s*scope\s*,\s*selectedSemesterId/);
    assert.match(src, /useDashboardActivities\(\s*scope\s*,\s*selectedSemesterId/);
    assert.match(src, /useDashboardOverview\(\s*scope\s*,\s*selectedSemesterId/);

    // Filters count > 0, sorts, splits top 3 cards + remaining queue
    assert.match(src, /\.filter\(\s*\(?[a-zA-Z_]\w*\)?\s*=>\s*(?:[a-zA-Z_]\w*\s*&&\s*)?[a-zA-Z_]\w*\.count\s*>\s*0\s*\)/);
    assert.match(src, /\.slice\(\s*0\s*,\s*3\s*\)/);
    assert.match(src, /\.slice\(\s*3\s*\)/);

    // Honest empty state & error state with retry
    assert.match(src, /Chưa có việc cần xử lý trong đợt này/);
    assert.match(src, /QueryErrorState/);
    assert.match(src, /onRetry=\{\(\)\s*=>\s*adminActionsQuery\.refetch\(\)\}/);

    // Validates internal target before navigate
    assert.match(src, /startsWith\(['"]\/['"]\)/);
    assert.match(src, /startsWith\(['"]\/\/['"]\)/);

    // Eliminates all hardcoded/fake blocks
    const forbiddenLiterals = [
        '|| 64',
        '2026-2027',
        '2025-2026',
        'MỐC 01',
        'MỐC 03 • HIỆN TẠI',
        '4 Bộ môn Viện CNTT',
        'Kỹ thuật Phần mềm',
        'Công nghệ Thông tin',
        'Hệ thống Thông tin',
        'Mạng máy tính & An ninh mạng',
        'Đề tài chờ BCN phê duyệt',
        'Chưa gắn Hội đồng bảo vệ',
        'Hội đồng chấm bảo vệ',
        'Khóa Sổ Điểm Hội Đồng',
    ];
    for (const literal of forbiddenLiterals) {
        assert.equal(src.includes(literal), false, `DashboardPage must NOT contain hardcoded literal: "${literal}"`);
    }

    // 375px responsive vertical stacking
    assert.match(src, /grid-cols-1/);
});

test('Rule 2.6: DashboardPage buttons use @ant-design/icons and have no raw symbols/emojis', () => {
    const src = read('src/pages/admin/DashboardPage.jsx');
    const forbiddenSymbolsRegex = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗⚠️❌]/;
    const buttonRegex = /<(?:button|Button)\b[^>]*>([\s\S]*?)<\/(?:button|Button)>/g;
    let match;
    while ((match = buttonRegex.exec(src)) !== null) {
        const textOnly = match[1].replace(/<[^>]+>/g, '').trim();
        assert.equal(
            forbiddenSymbolsRegex.test(textOnly),
            false,
            `Button contains forbidden raw symbol: "${textOnly}"`
        );
    }
});

test('Target admin pages read semesterId from URL query params', () => {
    const councilSrc = read('src/pages/admin/CouncilAssignmentPage.jsx');
    assert.match(councilSrc, /useSearchParams/);
    assert.match(councilSrc, /searchParams\.get\(['"]semesterId['"]\)/);

    const topicSrc = read('src/pages/admin/TopicManagementPage.jsx');
    assert.match(topicSrc, /useSearchParams/);
    assert.match(topicSrc, /searchParams\.get\(['"]semesterId['"]\)/);

    const gradingSrc = read('src/pages/admin/GradingDefensePage.jsx');
    assert.match(gradingSrc, /searchParams\.get\(['"]semesterId['"]\)/);
});
