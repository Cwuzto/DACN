import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('AcademicReportsPage: File exists and adheres to UTF-8 without BOM (Rule 2.4)', () => {
    const rawBuffer = fs.readFileSync(path.join(root, 'frontend/src/pages/admin/AcademicReportsPage.jsx'));
    // BOM check: EF BB BF
    const hasBom = rawBuffer[0] === 0xEF && rawBuffer[1] === 0xBB && rawBuffer[2] === 0xBF;
    assert.strictEqual(hasBom, false, 'AcademicReportsPage.jsx must not have UTF-8 BOM');
});

test('AcademicReportsPage: Adheres strictly to Rule 2.6 (No raw emoji or symbols in button labels)', () => {
    const src = read('frontend/src/pages/admin/AcademicReportsPage.jsx');

    // Extract all <Button ...>...</Button> patterns
    const buttonRegex = /<Button\b[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    const buttonLabels = [];

    while ((match = buttonRegex.exec(src)) !== null) {
        buttonLabels.push(match[1]);
    }

    assert.ok(buttonLabels.length > 0, 'Page must contain at least one Button');

    const forbiddenSymbols = ['📥', '📊', '✓', '←', '→', '✏️', '👥', '🗑️', '⚠', '⚡', '🔍', '📋', '🤖', '▾', '▴', '↗'];

    for (const label of buttonLabels) {
        for (const sym of forbiddenSymbols) {
            assert.strictEqual(
                label.includes(sym),
                false,
                `Button label "${label.trim()}" must not contain raw graphic symbol "${sym}"`
            );
        }
    }

    // Must import proper icon components from @ant-design/icons
    assert.match(src, /ReloadOutlined/, 'Must import ReloadOutlined');
    assert.match(src, /DownloadOutlined/, 'Must import DownloadOutlined');
});

test('AcademicReportsPage: Integrates reportService and semesterService APIs (Zero Mock)', () => {
    const src = read('frontend/src/pages/admin/AcademicReportsPage.jsx');

    const reports = read('frontend/src/queries/reportQueries.js');
    const semesters = read('frontend/src/queries/semesterQueries.js');
    assert.match(src, /useReportOverview/);
    assert.match(src, /useLecturerWorkload/);
    assert.match(src, /useSemesters/);
    assert.match(reports, /reportService\.getOverview/, 'Overview query must call the real API');
    assert.match(reports, /reportService\.getLecturerWorkload/, 'Workload query must call the real API');
    assert.match(src, /reportService\.exportExcel/, 'Must call reportService.exportExcel');
    assert.match(semesters, /semesterService\.getAll/, 'Semester query must call the real API');
    assert.doesNotMatch(reports, /catch\s*\([^)]*\)\s*=>\s*\[\]/);

    // Must not contain setTimeout or fake data generator
    assert.strictEqual(src.includes('setTimeout('), false, 'Zero mock policy: No setTimeout mock delays allowed');
});

test('AcademicReportsPage: Renders 4 KPI cards with required icons and metrics', () => {
    const src = read('frontend/src/pages/admin/AcademicReportsPage.jsx');

    // Check KPI Icons
    assert.match(src, /UserOutlined/, 'KPI 1 must include UserOutlined');
    assert.match(src, /CheckCircleOutlined/, 'KPI 2 must include CheckCircleOutlined');
    assert.match(src, /BarChartOutlined/, 'KPI 3 must include BarChartOutlined');
    assert.match(src, /TrophyOutlined/, 'KPI 4 must include TrophyOutlined');

    // Check KPI fields referenced
    assert.match(src, /totalStudents/, 'Must reference totalStudents');
    assert.match(src, /completionRate/, 'Must reference completionRate');
    assert.match(src, /averageScore/, 'Must reference averageScore');
});

test('AcademicReportsPage: Renders 4 interactive Tabs with exact keys and names', () => {
    const src = read('frontend/src/pages/admin/AcademicReportsPage.jsx');

    assert.match(src, /Phổ điểm & Xếp loại/, 'Tab 1 label must be "Phổ điểm & Xếp loại"');
    assert.match(src, /Phễu tiến độ học vụ/, 'Tab 2 label must be "Phễu tiến độ học vụ"');
    assert.match(src, /So sánh Chuyên ngành/, 'Tab 3 label must be "So sánh Chuyên ngành"');
    assert.match(src, /Tải GVHD & Độ lệch điểm/, 'Tab 4 label must be "Tải GVHD & Độ lệch điểm"');
});

test('AcademicReportsPage: Implements score variance warning badge and Excel export handling', () => {
    const src = read('frontend/src/pages/admin/AcademicReportsPage.jsx');

    // Check variance check > 1.5
    assert.match(src, /1\.5/, 'Must check score variance threshold of 1.5');
    assert.match(src, /WarningOutlined/, 'Must use WarningOutlined for high variance');

    // Check Excel download mechanism
    assert.match(src, /Bang_Tong_Hop_Ket_Qua_Tot_Nghiep_/, 'Must generate proper Excel filename');
    assert.match(src, /createObjectURL/, 'Must use Blob URL to trigger download');
});
