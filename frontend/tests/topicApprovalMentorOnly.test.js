import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('TopicApprovalPage exists and is valid UTF-8 without BOM (Rule 2.4)', () => {
    const filePath = path.join(root, 'src/pages/lecturer/TopicApprovalPage.jsx');
    assert.ok(fs.existsSync(filePath), 'TopicApprovalPage.jsx must exist');
    const buffer = fs.readFileSync(filePath);
    const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    assert.equal(hasBOM, false, 'TopicApprovalPage.jsx must not have UTF-8 BOM');
});

test('TopicApprovalPage adheres to Rule 2.1 (TopicRegistration model, no group/groupMember)', () => {
    const src = read('src/pages/lecturer/TopicApprovalPage.jsx');
    assert.doesNotMatch(src, /\bgroupMember\b/i, 'Must not use legacy groupMember model');
    assert.doesNotMatch(src, /\bgroupMembers\b/i, 'Must not use legacy groupMembers model');
});

test('TopicApprovalPage removes council outline tab and segmented-tabs', () => {
    const src = read('src/pages/lecturer/TopicApprovalPage.jsx');
    assert.doesNotMatch(src, /segmented-tabs/, 'TopicApprovalPage must not have segmented-tabs');
    assert.doesNotMatch(src, /Hội Đồng Thẩm Định Đề Cương/i, 'Must not have council outline tab inside TopicApprovalPage');
    assert.doesNotMatch(src, /OutlineReviewModal/, 'Must not import or render OutlineReviewModal in TopicApprovalPage');
    assert.doesNotMatch(src, /councilOutlineQuery/, 'Must not query council outlines in TopicApprovalPage');
    assert.doesNotMatch(src, /pendingOutlineCount/, 'Must not have pendingOutlineCount');
    assert.doesNotMatch(src, /selectedOutlineRecord/, 'Must not have selectedOutlineRecord');
});

test('TopicApprovalPage redirects ?tab=bm01 or ?tab=outline to /lecturer/outline-evaluations with registrationId', () => {
    const src = read('src/pages/lecturer/TopicApprovalPage.jsx');
    assert.match(src, /\/lecturer\/outline-evaluations/, 'Must redirect to /lecturer/outline-evaluations');
    assert.match(
        src,
        /tabParam === ['"]bm01['"]\s*\|\|\s*tabParam === ['"]outline['"]|tabParam === ['"]outline['"]\s*\|\|\s*tabParam === ['"]bm01['"]/,
        'Must check tabParam for bm01 or outline'
    );
    assert.match(src, /Navigate to=\{`\/lecturer\/outline-evaluations/, 'Must use Navigate to redirect to /lecturer/outline-evaluations');
});

test('TopicApprovalPage adheres to Rule 2.6 (Ant Design Button icons, plain Vietnamese, no raw emoji/graphics)', () => {
    const src = read('src/pages/lecturer/TopicApprovalPage.jsx');
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
    assert.ok(buttonCount > 0, 'TopicApprovalPage must render buttons for mentor workflow');
});

test('TopicApprovalPage focuses 100% on mentor registration approval with quota display', () => {
    const src = read('src/pages/lecturer/TopicApprovalPage.jsx');
    assert.match(src, /1 Sinh viên \/ 1 Đề tài · Tối đa 10 SV\/đợt/, 'Must display 1 student / 1 topic, max 10 students quota standard');
    assert.match(src, /Chấp thuận hướng dẫn/, 'Must have accept guidance button');
    assert.match(src, /Từ chối/, 'Must have reject guidance button');
    assert.match(src, /rejectModalOpen|setRejectModalOpen/, 'Must have modal for rejection reason');
});
