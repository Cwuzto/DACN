import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 4 files exist and adhere strictly to UTF-8 without BOM', () => {
    const files = [
        'src/pages/student/StudentWorkHubPage.jsx',
        'src/pages/student/student-work-hub.css',
    ];

    for (const file of files) {
        const fullPath = path.join(root, file);
        assert.ok(fs.existsSync(fullPath), `File ${file} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${file} must NOT have UTF-8 BOM`);
    }
});

test('Rule 2.1 compliance: No group/groupMember/groupId in StudentWorkHubPage', () => {
    const src = read('src/pages/student/StudentWorkHubPage.jsx');
    assert.doesNotMatch(src, /\bgroupMember\b/i, 'StudentWorkHubPage must not reference groupMember');
    assert.doesNotMatch(src, /\bgroupMembers\b/i, 'StudentWorkHubPage must not reference groupMembers');
    assert.doesNotMatch(src, /\bgroupId\b/i, 'StudentWorkHubPage must not reference groupId');
});

test('Rule 2.6 compliance: Strict button icons and Vietnamese labels without raw emojis', () => {
    const src = read('src/pages/student/StudentWorkHubPage.jsx');
    const forbidden = /[🤖←→+📋✓✏️👥🗑️🔓▾▴↗✕🖨️⚠️]/;

    // Ant Design Button label verification
    const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    while ((match = btnRegex.exec(src)) !== null) {
        const label = match[1].replace(/<[^>]+>/g, '').trim();
        assert.ok(!forbidden.test(label), `Button label "${label}" contains forbidden symbol/emoji`);
    }

    // HTML button label verification
    const htmlBtnRegex = /<button[^>]*>([\s\S]*?)<\/button>/g;
    while ((match = htmlBtnRegex.exec(src)) !== null) {
        const label = match[1].replace(/<[^>]+>/g, '').trim();
        assert.ok(!forbidden.test(label), `HTML button label "${label}" contains forbidden symbol/emoji`);
    }

    // Ant Design icon prop check on buttons
    assert.match(src, /<Button[^>]*icon=\{<FileSearchOutlined\s*\/>\}/, 'Must use icon prop for FileSearchOutlined');
    assert.match(src, /<Button[^>]*icon=\{<ReloadOutlined\s*\/>\}/, 'Must use icon prop for ReloadOutlined');
});

test('StudentWorkHubPage implements tri-region architecture (Cần làm ngay, Sắp tới, Đã hoàn thành)', () => {
    const src = read('src/pages/student/StudentWorkHubPage.jsx');

    // 1. Region 1: Cần làm ngay (READY)
    assert.match(src, /className="region-ready"/, 'Must have region-ready container');
    assert.match(src, /selectedReadyItem/, 'Must manage selectedReadyItem for active ready task');
    assert.match(src, /StudentWorkActions/, 'Must embed StudentWorkActions for active work item');

    // 2. Region 2: Sắp tới (UPCOMING - trong 7 ngày)
    assert.match(src, /className="region-upcoming"/, 'Must have region-upcoming container');
    assert.match(src, /Sắp tới\s*\(trong 7 ngày\)/, 'Must display title for upcoming region');
    assert.match(src, /upcomingItems/, 'Must filter items by bucket UPCOMING');

    // 3. Region 3: Đã hoàn thành (DONE)
    assert.match(src, /className="region-done"/, 'Must have region-done container');
    assert.match(src, /Đã hoàn thành/, 'Must display title for done region');
    assert.match(src, /doneItems/, 'Must filter items by bucket DONE');
});

test('StudentWorkHubPage enforces UPCOMING region restrictions: no mutation or submission buttons', () => {
    const src = read('src/pages/student/StudentWorkHubPage.jsx');

    // Find the upcoming region block
    const upcomingStart = src.indexOf('<section className="region-upcoming"');
    const upcomingEnd = src.indexOf('</section>', upcomingStart);
    assert.ok(upcomingStart !== -1 && upcomingEnd !== -1, 'Upcoming section must be bounded');

    const upcomingBlock = src.slice(upcomingStart, upcomingEnd);

    // Assert that NO submit buttons or action mutations exist inside upcoming region
    assert.doesNotMatch(upcomingBlock, /<StudentWorkActions/i, 'Upcoming block must NOT embed StudentWorkActions');
    assert.doesNotMatch(upcomingBlock, /<Button[^>]*>.*Nộp.*<\/Button>/i, 'Upcoming block must NOT have submit button');
    assert.doesNotMatch(upcomingBlock, /<button[^>]*>.*Nộp.*<\/button>/i, 'Upcoming block must NOT have submit button');
    assert.match(upcomingBlock, /Chưa mở cổng/, 'Upcoming block must show non-actionable badge "Chưa mở cổng"');
});

test('StudentWorkHubPage handles waitingStatus gracefully with no fake submit buttons when READY is empty', () => {
    const src = read('src/pages/student/StudentWorkHubPage.jsx');

    // Check waiting state branch
    assert.match(src, /waitingStatus\s*\?/, 'Must conditionally check waitingStatus');
    assert.match(src, /className="work-waiting-card"/, 'Must render work-waiting-card when in waiting state');
    assert.match(src, /waitingStatus\.title/, 'Must display waitingStatus.title');
    assert.match(src, /waitingStatus\.description/, 'Must display waitingStatus.description');

    // Check all-done / empty fallback branch
    assert.match(src, /className="work-empty-card"/, 'Must render work-empty-card when both ready and waiting are empty');
    assert.match(src, /Hiện chưa có việc cần làm/, 'Must display clear text when no tasks exist');
});

test('StudentWorkHubPage handles deep link ?work=<KIND> and legacy ?tab=archive', () => {
    const src = read('src/pages/student/StudentWorkHubPage.jsx');

    assert.match(src, /useSearchParams\(\)/, 'Must use useSearchParams to parse query parameters');
    assert.match(src, /searchParams\.get\(['"]work['"]\)/, 'Must read work query parameter');
    assert.match(src, /searchParams\.get\(['"]tab['"]\)/, 'Must read tab query parameter');
    assert.match(src, /tabParam === 'archive' \? 'SUBMIT_ARCHIVE' : workParam/, 'Must map tab=archive to SUBMIT_ARCHIVE');

    // Handling logic for ready, done, upcoming, and invalid
    assert.match(src, /matchReady/, 'Must look for match in readyItems');
    assert.match(src, /matchDone/, 'Must look for match in doneItems');
    assert.match(src, /matchUpcoming/, 'Must look for match in upcomingItems');
    assert.match(src, /deeplinkNotice/, 'Must manage deeplinkNotice state for user feedback');
});

test('StudentWorkHubPage urgency classification matches design specs', () => {
    const src = read('src/pages/student/StudentWorkHubPage.jsx');

    assert.match(src, /getItemUrgencyBadge/, 'Must have getItemUrgencyBadge function');
    assert.match(src, /type:\s*'overdue'/, 'Must classify overdue tasks with red badge');
    assert.match(src, /type:\s*'ack_48h'/, 'Must classify BM03_ACK tasks with purple 48h badge');
    assert.match(src, /type:\s*'urgent'/, 'Must classify <= 48h tasks with warning badge');
    assert.match(src, /type:\s*'normal'/, 'Must classify normal open tasks with cyan badge');
});

test('student-work-hub.css satisfies design system requirements (Hero Teal, Blue/Amber, Slate, Micro-interactions, Reduced Motion)', () => {
    const css = read('src/pages/student/student-work-hub.css');

    // Hero Teal colors
    assert.match(css, /#0f766e/, 'Must define Hero Teal primary #0f766e');
    assert.match(css, /#14b8a6/, 'Must define Hero Teal accent #14b8a6');
    assert.match(css, /#f0fdfa/, 'Must define Hero Teal background #f0fdfa');
    assert.match(css, /#99f6e4/, 'Must define Hero Teal border #99f6e4');

    // Blue & Amber for Upcoming
    assert.match(css, /#0284c7/, 'Must define Upcoming blue #0284c7');
    assert.match(css, /#d97706/, 'Must define Upcoming amber #d97706');
    assert.match(css, /#f8fafc/, 'Must define slate/neutral surface #f8fafc');

    // Micro-interactions (fade + slide-in 250-350ms, hover 150-200ms)
    assert.match(css, /@keyframes hubFadeSlideIn/, 'Must define hubFadeSlideIn keyframe animation');
    assert.match(css, /translateY\(10px\)/, 'Must translate 8-12px on entry animation');
    assert.match(css, /0\.3s/, 'Must execute in 250-350ms range');
    assert.match(css, /transition:\s*all\s*0\.(18|2)s/, 'Hover transitions must be in 150-200ms range');

    // Accessibility: prefers-reduced-motion
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'Must support prefers-reduced-motion');

    // Responsive design
    assert.match(css, /@media\s*\(max-width:\s*768px\)/, 'Must support 768px tablet layout');
    assert.match(css, /@media\s*\(max-width:\s*480px\)/, 'Must support mobile layout');
});
