import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 3 files exist and adhere to UTF-8 without BOM (Rule 2.4) and Rule 2.6 button icon standards', () => {
    const files = [
        'src/components/lecturer/BM01WatchList.jsx',
        'src/components/lecturer/OverviewKpis.jsx',
        'src/components/lecturer/AttentionQueue.jsx',
        'src/pages/lecturer/LecturerDashboardPage.jsx',
    ];
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕🤖]/;

    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${f} must NOT have UTF-8 BOM`);

        const src = buffer.toString('utf8');
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = btnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} button "${label}" contains forbidden raw symbol`);
        }
    }
});

test('BM01WatchList renders unsubmitted APPROVED students with real deadline, reminder, and /lecturer/students/:registrationId navigation without manual remind', () => {
    const src = read('src/components/lecturer/BM01WatchList.jsx');

    assert.match(src, /export default function BM01WatchList\(\s*\{\s*items\s*=\s*\[\]\s*,\s*onOpenStudent\s*\}\s*\)/);
    assert.match(src, /Sinh viên chưa nộp BM01/);
    assert.match(src, /item\.studentName/);
    assert.match(src, /item\.studentCode/);
    assert.match(src, /item\.topicTitle/);

    // Deadline formatting & null fallback
    assert.match(src, /DD\/MM\/YYYY HH:mm/);
    assert.match(src, /Chưa đặt hạn/);

    // Clear text deadline states (not color-only)
    assert.match(src, /Quá hạn/);
    assert.match(src, /Còn hạn/);

    // Automatic reminder timestamp from real data
    assert.match(src, /item\.lastReminderAt/);
    assert.match(src, /Chưa gửi nhắc tự động/);

    // Navigation button with @ant-design/icons icon prop
    assert.match(src, /from '@ant-design\/icons'/);
    assert.match(src, /icon=\{<[A-Z]\w+Outlined\s*\/>\}/);
    assert.match(src, /Xem quá trình/);
    assert.match(src, /onOpenStudent\?\.\(item\)/);

    // Must NOT include any manual remind or broadcast button
    assert.equal(src.includes('Nhắc nộp'), false, 'BM01WatchList must NOT include "Nhắc nộp" button');
    assert.equal(src.includes('sendLecturerBroadcast'), false, 'BM01WatchList must NOT call broadcast');
    assert.equal(src.includes('animate-pulse'), false, 'Must NOT use blinking/pulsing animations');
    assert.equal(src.includes('animate-ping'), false, 'Must NOT use blinking/pinging animations');
});

test('OverviewKpis dynamically hides 0-count cards and shows clean summary when all counts are 0', () => {
    const src = read('src/components/lecturer/OverviewKpis.jsx');

    // Filters cards by positive count
    assert.match(src, /\.filter\(/);
    assert.match(src, /count\s*>\s*0/);

    // Preserves required typography classes
    assert.match(src, /text-xs font-semibold uppercase tracking-wide text-slate-500/);
    assert.match(src, /text-2xl font-bold text-slate-900 mt-1 tabular-nums/);

    // Clean empty/zero summary when all counts are 0
    assert.match(src, /visibleCards\.length\s*===\s*0/);
});

test('AttentionQueue clearly labels non-GVHD role items (VIEN_TRUONG / DEAN / ADMIN) vs GVHD items', () => {
    const src = read('src/components/lecturer/AttentionQueue.jsx');

    assert.match(src, /MENTOR/);
    assert.match(src, /GVHD/);
    assert.match(src, /INSTITUTE_DIRECTOR/);
    assert.match(src, /VIEN_TRUONG/);
    assert.match(src, /DEAN/);
    assert.match(src, /ADMIN/);
    assert.match(src, /Viện trưởng/);
});

test('LecturerDashboardPage integrates BM01WatchList, dynamic KPIs, existing onOpenGuidance, and query error retry', () => {
    const src = read('src/pages/lecturer/LecturerDashboardPage.jsx');

    assert.match(src, /import BM01WatchList from ['"]\.\.\/\.\.\/components\/lecturer\/BM01WatchList['"]/);
    assert.match(src, /overview\?\.watchItems/);
    assert.match(src, /<OverviewKpis\s+summary=\{mentorSummary\}\s+watchCount=\{watchItems\.length\}\s*\/>/);
    assert.match(src, /<BM01WatchList[\s\S]*?items=\{watchItems\}[\s\S]*?onOpenStudent=\{/);
    assert.match(src, /navigate\(item\.target\)/);

    // Existing onOpenGuidance and error retry intact
    assert.match(src, /navigate\(`\/lecturer\/students\/\$\{student\.registrationId\}`/);
    assert.match(src, /onOpenGuidance=\{handleOpenGuidance\}/);
    assert.match(src, /overviewQuery\.isError/);
    assert.match(src, /overviewQuery\.refetch\(\)/);
    assert.match(src, /Thử lại/);
});
