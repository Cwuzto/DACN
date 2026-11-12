import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('BM01 Copilot: aiService exports analyzeBM01 and calls /ai/bm01-copilot', () => {
    const src = read('frontend/src/services/aiService.js');
    assert.match(src, /analyzeBM01:\s*async\s*\(payload\)/, 'aiService must define analyzeBM01');
    assert.match(src, /api\.post\('\/ai\/bm01-copilot',\s*payload\)/, 'analyzeBM01 must call POST /ai/bm01-copilot');
});

test('BM01 Copilot: BM01CopilotDrawer adheres strictly to Rule 2.6 and renders 5 dimensions', () => {
    const src = read('frontend/src/components/student/BM01CopilotDrawer.jsx');

    // Rule 2.6 verification: No raw emojis or symbols in button labels
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'BM01CopilotDrawer must not have raw emojis in Button labels');

    // Drawer and components
    assert.match(src, /BM01 Copilot — Trợ Lý Đề Cương/, 'BM01CopilotDrawer must have standard Vietnamese title');
    assert.match(src, /Phân tích tính logic 5 chiều/, 'BM01CopilotDrawer must display 5 dimensions section');
    assert.match(src, /Gợi ý cải thiện trước khi nộp chính thức/, 'BM01CopilotDrawer must display suggestions section');
    assert.match(src, /Quy tắc nội bộ \(Offline\)/, 'BM01CopilotDrawer must display fallback badge when offline');
    assert.match(src, /Gemini 2.0 Flash/, 'BM01CopilotDrawer must display Gemini provider tag');
});

test('BM01 Copilot: HybridBMFormModal integrates BM01CopilotDrawer with Rule 2.6 compliant button', () => {
    const src = read('frontend/src/components/forms/HybridBMFormModal.jsx');

    assert.match(src, /import BM01CopilotDrawer/, 'HybridBMFormModal must import BM01CopilotDrawer');
    assert.match(src, /import aiService/, 'HybridBMFormModal must import aiService');
    assert.match(src, /RobotOutlined/, 'HybridBMFormModal must import RobotOutlined');
    assert.match(src, /Đánh giá đề cương với AI/, 'HybridBMFormModal must have action button to run AI evaluation');
    assert.match(src, /<BM01CopilotDrawer/, 'HybridBMFormModal must render BM01CopilotDrawer');

    // Check Rule 2.6 on button
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'HybridBMFormModal must not have raw emojis in Button labels');
});

test('BM01 Copilot: SubmissionPage provides AI Copilot trigger for BM01 outline tasks', () => {
    const src = read('frontend/src/pages/student/SubmissionPage.jsx');

    assert.match(src, /import BM01CopilotDrawer/, 'SubmissionPage must import BM01CopilotDrawer');
    assert.match(src, /import aiService/, 'SubmissionPage must import aiService');
    assert.match(src, /RobotOutlined/, 'SubmissionPage must import RobotOutlined');
    assert.match(src, /<BM01CopilotDrawer/, 'SubmissionPage must render BM01CopilotDrawer');
});
