import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(root, 'src/pages/lecturer/OutlineReviewPage.jsx');
const cssPath = path.join(root, 'src/pages/lecturer/outline-review.css');

const read = (p) => fs.readFileSync(p, 'utf8');

test('OutlineReviewPage and outline-review.css exist and are valid UTF-8 without BOM (Rule 2.4)', () => {
    assert.ok(fs.existsSync(pagePath), 'OutlineReviewPage.jsx must exist');
    const pageBuf = fs.readFileSync(pagePath);
    assert.ok(pageBuf.length > 0, 'OutlineReviewPage.jsx must not be empty');
    const pageHasBOM = pageBuf[0] === 0xef && pageBuf[1] === 0xbb && pageBuf[2] === 0xbf;
    assert.equal(pageHasBOM, false, 'OutlineReviewPage.jsx must not have UTF-8 BOM');

    assert.ok(fs.existsSync(cssPath), 'outline-review.css must exist');
    const cssBuf = fs.readFileSync(cssPath);
    assert.ok(cssBuf.length > 0, 'outline-review.css must not be empty');
    const cssHasBOM = cssBuf[0] === 0xef && cssBuf[1] === 0xbb && cssBuf[2] === 0xbf;
    assert.equal(cssHasBOM, false, 'outline-review.css must not have UTF-8 BOM');
});

test('OutlineReviewPage adheres to Rule 2.1 (TopicRegistration model, no group/groupMember)', () => {
    const src = read(pagePath);
    assert.doesNotMatch(src, /\bgroupMember\b/i, 'Must not use legacy groupMember model');
    assert.doesNotMatch(src, /\bgroupMembers\b/i, 'Must not use legacy groupMembers model');
});

test('OutlineReviewPage adheres to Rule 2.6 (Ant Design Button icons, plain Vietnamese, no raw emoji/graphics in buttons)', () => {
    const src = read(pagePath);
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕🤖]/;

    const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    let buttonCount = 0;
    while ((match = btnRegex.exec(src)) !== null) {
        buttonCount++;
        const label = match[1].replace(/<[^>]+>/g, '').trim();
        if (label) {
            assert.ok(!forbidden.test(label), `Button label "${label}" must not contain forbidden symbols`);
        }
    }
    assert.ok(buttonCount > 0, 'OutlineReviewPage must render buttons with proper icons');
});

test('OutlineReviewPage implements role-based permissions: Chairman & Secretary have review button, Member has view & feedback only', () => {
    const src = read(pagePath);

    // Identifies Chairman, Secretary and Member roles
    assert.match(src, /CHAIRMAN/, 'Must handle CHAIRMAN role');
    assert.match(src, /SECRETARY/, 'Must handle SECRETARY role');
    assert.match(src, /MEMBER/, 'Must handle MEMBER role');

    // Chairman & Secretary have review capability
    assert.match(src, /Thẩm định đề cương/, 'Must render review button for Chairman and Secretary');
    // Member has view and comment only
    assert.match(src, /Xem & Góp ý/, 'Must render view and comment button for Council Member');

    // Check condition that controls button rendering based on role
    assert.match(
        src,
        /canReview|isChairmanOrSecretary|isMember|roleInCouncil|currentRoleInCouncil/,
        'Must conditionally render action buttons based on council role'
    );
});

test('OutlineReviewPage contains Bento Council Header, 4 KPI cards, Topic Table, Print Modal & AI Copilot integration', () => {
    const src = read(pagePath);

    // Bento Council Header
    assert.match(src, /bento-council-header|outline-council-card|council-header/i, 'Must have Bento Council Header element');
    assert.match(src, /Quyết định|QĐ/i, 'Must display council establishment decision');
    assert.match(src, /Chủ tịch|Thư ký|Ủy viên/i, 'Must display council members and roles');

    // 4 KPI Cards
    assert.match(src, /Chờ thẩm định|Đang chờ thẩm định/i, 'Must have pending outline KPI');
    assert.match(src, /Đã thông qua|Đạt/i, 'Must have passed outline KPI');
    assert.match(src, /Cần chỉnh sửa|Yêu cầu chỉnh sửa/i, 'Must have revision required KPI');
    assert.match(src, /Tổng số đề tài|Tổng đề tài/i, 'Must have total topics KPI');

    // Print Modal & AI Copilot
    assert.match(src, /AcademicFormPrintModal/, 'Must integrate AcademicFormPrintModal');
    assert.match(src, /BM01PrintSheet/, 'Must integrate BM01PrintSheet');
    assert.match(src, /BM01CopilotDrawer/, 'Must integrate BM01CopilotDrawer');
    assert.match(src, /OutlineReviewModal/, 'Must integrate OutlineReviewModal');

    // Deep link support ?registrationId=
    assert.match(src, /searchParams|registrationId/i, 'Must support deep link registrationId parameter');
});

test('outline-review.css defines modern styles, high-contrast palette, micro-interactions and reduced-motion', () => {
    const css = read(cssPath);

    // Vibrant KPI palette & deep sea council colors
    assert.match(css, /1e3a5f|0f2942|3b82f6|2563eb/i, 'Must have deep sea blue council branding');
    assert.match(css, /059669|ecfdf5|10b981/i, 'Must have emerald green for passed KPI');
    assert.match(css, /d97706|fffbeb|f59e0b/i, 'Must have amber for pending KPI');
    assert.match(css, /7c3aed|f5f3ff|8b5cf6/i, 'Must have amethyst purple for revision KPI');

    // Micro-interactions & animations
    assert.match(css, /fadeSlideIn|fadeIn|slideUp/i, 'Must define micro-interaction animation');
    assert.match(css, /prefers-reduced-motion:\s*reduce/, 'Must support prefers-reduced-motion');
});
