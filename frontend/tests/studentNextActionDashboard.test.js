import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dashboardService from '../src/services/dashboardService.js';
import api from '../src/services/api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 4 files exist and adhere to UTF-8 without BOM', () => {
    const files = [
        'src/services/dashboardService.js',
        'src/queries/dashboardQueries.js',
        'src/pages/student/StudentDashboardPage.jsx',
    ];

    for (const file of files) {
        const fullPath = path.join(root, file);
        assert.ok(fs.existsSync(fullPath), `File ${file} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${file} must NOT have UTF-8 BOM`);
    }
});

test('dashboardService.getStudentDashboard calls GET /dashboard/student', async () => {
    assert.equal(typeof dashboardService.getStudentDashboard, 'function');

    let capturedUrl = null;
    const originalGet = api.get;
    api.get = async (url) => {
        capturedUrl = url;
        return {
            success: true,
            data: {
                hasRegistration: true,
                nextAction: {
                    kind: 'SUBMIT_BM01',
                    title: 'Nộp đề cương BM01',
                    description: 'Đề tài đã được duyệt.',
                    dueAt: '2026-12-01T17:00:00.000Z',
                    target: '/student/submissions',
                    sourceStatus: 'APPROVED',
                    canAct: true,
                },
            },
        };
    };

    try {
        const res = await dashboardService.getStudentDashboard();
        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/dashboard/student');
        assert.equal(res.data.nextAction.kind, 'SUBMIT_BM01');
    } finally {
        api.get = originalGet;
    }
});

test('dashboardQueries exports useStudentDashboard and dashboardKeys.studentDashboard(scope)', () => {
    const queriesSrc = read('src/queries/dashboardQueries.js');
    assert.match(queriesSrc, /studentDashboard:\s*\(scope\)\s*=>\s*\[\.\.\.scope,\s*'dashboard',\s*'student'\]/);
    assert.match(queriesSrc, /export const useStudentDashboard\s*=/);
    assert.match(queriesSrc, /dashboardService\.getStudentDashboard\(\)/);
});

test('StudentDashboardPage uses useStudentDashboard(scope), renders nextAction with valid target guard and error retry', () => {
    const src = read('src/pages/student/StudentDashboardPage.jsx');

    // Uses useStudentDashboard(scope)
    assert.match(src, /useStudentDashboard\(\s*scope\s*\)/);

    // Reads nextAction from dashboardData
    assert.match(src, /dashboardData\?\.nextAction/);

    // Formats dueAt only when present (DD/MM/YYYY HH:mm)
    assert.match(src, /format\(['"]DD\/MM\/YYYY HH:mm['"]\)/);

    // Action button only rendered when canAct && valid internal route
    assert.match(src, /nextAction\??\.canAct/);
    assert.match(src, /startsWith\(['"]\/['"]\)/);
    assert.match(src, /startsWith\(['"]\/\/['"]\)/);

    // Maps SUBMIT_BM01 to 'Nộp BM01' CTA
    assert.match(src, /Nộp BM01/);

    // Waiting state indicator when canAct is false
    assert.match(src, /Đang chờ xử lý/);

    // Null nextAction / no registration empty/guidance state + QueryErrorState retry
    assert.match(src, /QueryErrorState/);
    assert.match(src, /onRetry=\{\(\)\s*=>\s*\w+\.refetch\(\)\}/);
    assert.match(src, /Hiện chưa có bước tiếp theo cần thực hiện/);

    // 375px responsive vertical stacking and no blinking animations
    assert.match(src, /flex-col/);
    assert.doesNotMatch(src, /animate-pulse|animate-ping|animate-bounce/);
});

test('StudentDashboardPage removes all hardcoded/fake fallback literals', () => {
    const src = read('src/pages/student/StudentDashboardPage.jsx');
    const forbiddenLiterals = [
        'DA-2026-KTPM-04',
        '458/QĐ',
        '20/09/2026',
        '2022 - 2026',
        'HK1 2026–2027',
        'Khoa Kỹ thuật Phần mềm',
        'Sáng Thứ Ba & Sáng Thứ Sáu',
        '22/10/2026',
        '25/10/2026',
        'Turnitin',
    ];

    for (const literal of forbiddenLiterals) {
        assert.equal(src.includes(literal), false, `StudentDashboardPage must NOT contain hardcoded literal: "${literal}"`);
    }
});

test('Rule 2.6: StudentDashboardPage buttons use @ant-design/icons and have no raw symbols/emojis', () => {
    const src = read('src/pages/student/StudentDashboardPage.jsx');
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
