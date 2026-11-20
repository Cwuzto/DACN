import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentPath = path.join(root, 'src/components/common/AcademicRoadmapStepper.jsx');
const cssPath = path.join(root, 'src/components/common/academic-roadmap.css');

const read = (p) => fs.readFileSync(p, 'utf8');

test('Step 1: Task 1 files exist and adhere strictly to UTF-8 without BOM (Rule 2.4)', () => {
    assert.ok(fs.existsSync(componentPath), 'AcademicRoadmapStepper.jsx must exist');
    const compBuf = fs.readFileSync(componentPath);
    assert.ok(compBuf.length > 0, 'AcademicRoadmapStepper.jsx must not be empty');
    const compHasBOM = compBuf[0] === 0xef && compBuf[1] === 0xbb && compBuf[2] === 0xbf;
    assert.equal(compHasBOM, false, 'AcademicRoadmapStepper.jsx must not have UTF-8 BOM');

    assert.ok(fs.existsSync(cssPath), 'academic-roadmap.css must exist');
    const cssBuf = fs.readFileSync(cssPath);
    assert.ok(cssBuf.length > 0, 'academic-roadmap.css must not be empty');
    const cssHasBOM = cssBuf[0] === 0xef && cssBuf[1] === 0xbb && cssBuf[2] === 0xbf;
    assert.equal(cssHasBOM, false, 'academic-roadmap.css must not have UTF-8 BOM');
});

test('Step 2: Rule 2.1 compliance - No group/groupMember model references', () => {
    const src = read(componentPath);
    assert.doesNotMatch(src, /\bgroupMember\b/i, 'Must not reference legacy groupMember');
    assert.doesNotMatch(src, /\bgroupMembers\b/i, 'Must not reference legacy groupMembers');
    assert.doesNotMatch(src, /\bgroupId\b/i, 'Must not reference legacy groupId');
});

test('Step 3: Rule 2.6 compliance - Button icons and Vietnamese labels without raw emojis', () => {
    const src = read(componentPath);
    const forbidden = /[🤖←→+📋✓✏️👥🗑️🔓▾▴↗✕🖨️⚠️]/;

    // Verify milestone interactive nodes have type="button"
    assert.match(src, /type="button"/, 'Milestone interactive nodes must be buttons with type="button"');

    // Verify icon components from @ant-design/icons are imported
    assert.match(src, /from ['"]@ant-design\/icons['"]/, 'Must import icons from @ant-design/icons');
    assert.match(src, /ClockCircleOutlined/, 'Must include ClockCircleOutlined in header badge');
    assert.match(src, /CheckCircleOutlined/, 'Must include CheckCircleOutlined in header pill');
    assert.match(src, /CheckOutlined/, 'Must include CheckOutlined for completed badges');
    assert.match(src, /CalendarOutlined/, 'Must include CalendarOutlined for date display');

    // Check button labels & text inside buttons do not contain forbidden raw symbols or emojis
    const buttonBlocks = src.match(/<button[^>]*>([\s\S]*?)<\/button>/g) || [];
    assert.ok(buttonBlocks.length > 0, 'Must contain button elements');
    for (const block of buttonBlocks) {
        // Strip out tags and JS expressions { ... }
        const textContent = block.replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
        if (textContent) {
            assert.ok(!forbidden.test(textContent), `Button text "${textContent}" must not contain forbidden symbols`);
        }
    }

    // Check hardcoded user-facing string literals in component
    const userFacingStrings = [
        'Lộ trình 6 Mốc Quy Trình Đồ Án Tốt Nghiệp (Theo Chuẩn Viện Công nghệ Số)',
        'Theo dõi trạng thái từng giai đoạn và mốc thời gian quan trọng của học kỳ',
        'Hoàn tất',
        'Sinh viên',
    ];
    for (const str of userFacingStrings) {
        assert.ok(!forbidden.test(str), `String "${str}" must not contain forbidden symbols`);
    }
});

test('Step 4: AcademicRoadmapStepper interface contracts and visual structure', () => {
    const src = read(componentPath);

    // Props interface verification
    assert.match(src, /role/, 'Must accept role prop');
    assert.match(src, /title/, 'Must accept title prop');
    assert.match(src, /subtitle/, 'Must accept subtitle prop');
    assert.match(src, /badgeLabel/, 'Must accept badgeLabel prop');
    assert.match(src, /progressPercent/, 'Must accept progressPercent prop');
    assert.match(src, /milestones/, 'Must accept milestones prop');

    // Container and header classes
    assert.match(src, /sd-roadmap-card/, 'Must use sd-roadmap-card container class');
    assert.match(src, /sd-roadmap-header/, 'Must render sd-roadmap-header');
    assert.match(src, /sd-roadmap-title-wrap/, 'Must render sd-roadmap-title-wrap');
    assert.match(src, /sd-roadmap-icon-badge/, 'Must render sd-roadmap-icon-badge');
    assert.match(src, /sd-roadmap-title/, 'Must render sd-roadmap-title');
    assert.match(src, /sd-roadmap-subtitle/, 'Must render sd-roadmap-subtitle');
    assert.match(src, /sd-roadmap-pct-pill/, 'Must render sd-roadmap-pct-pill');

    // Progress rail & fill
    assert.match(src, /sd-roadmap-stage/, 'Must render sd-roadmap-stage');
    assert.match(src, /sd-roadmap-rail/, 'Must render sd-roadmap-rail');
    assert.match(src, /sd-roadmap-fill/, 'Must render sd-roadmap-fill');

    // Clamped progress rail calculation
    assert.match(src, /Math\.min\(100,\s*Math\.max\(0,/, 'Progress percent width must be clamped between 0 and 100%');

    // Milestone grid and node classes
    assert.match(src, /sd-milestone-grid/, 'Must render sd-milestone-grid');
    assert.match(src, /sd-milestone-node/, 'Must render sd-milestone-node');
    assert.match(src, /sd-milestone-orb/, 'Must render sd-milestone-orb');
    assert.match(src, /sd-milestone-check-badge/, 'Must render sd-milestone-check-badge for completed state');
    assert.match(src, /sd-milestone-title/, 'Must render sd-milestone-title');
    assert.match(src, /sd-milestone-status/, 'Must render sd-milestone-status');
    assert.match(src, /sd-milestone-date/, 'Must render sd-milestone-date');

    // State classes handling
    assert.match(src, /is-completed/, 'Must handle is-completed state class');
    assert.match(src, /is-active/, 'Must handle is-active state class');
    assert.match(src, /is-pending/, 'Must handle is-pending state class');

    // CSS variables and click handler support
    assert.match(src, /style=\{step\.styleVars/, 'Must pass step.styleVars to node style');
    assert.match(src, /onClick=\{step\.onClick\}/, 'Must bind step.onClick to node click handler');
});

test('Step 5: academic-roadmap.css defines responsive styles, animations and reduced motion', () => {
    const css = read(cssPath);

    // Essential classes
    assert.match(css, /\.sd-roadmap-card/, 'Must define .sd-roadmap-card');
    assert.match(css, /\.sd-roadmap-header/, 'Must define .sd-roadmap-header');
    assert.match(css, /\.sd-roadmap-rail/, 'Must define .sd-roadmap-rail');
    assert.match(css, /\.sd-roadmap-fill/, 'Must define .sd-roadmap-fill');
    assert.match(css, /\.sd-milestone-grid/, 'Must define .sd-milestone-grid');
    assert.match(css, /\.sd-milestone-node/, 'Must define .sd-milestone-node');
    assert.match(css, /\.sd-milestone-orb/, 'Must define .sd-milestone-orb');

    // Keyframes
    assert.match(css, /@keyframes\s+sd-shimmer-flow/, 'Must define @keyframes sd-shimmer-flow');
    assert.match(css, /@keyframes\s+sd-pulse-halo/, 'Must define @keyframes sd-pulse-halo');

    // Accessibility - prefers-reduced-motion
    assert.match(css, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/, 'Must support prefers-reduced-motion: reduce');
    assert.match(css, /animation:\s*none\s*!important/, 'Must disable animations when prefers-reduced-motion');
});
