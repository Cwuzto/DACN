import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('AcademicChatWidget: aiService exports generateFeedback, generateDefenseQuestions, and chatRegulation', () => {
    const src = read('frontend/src/services/aiService.js');

    // 1. generateFeedback
    assert.match(src, /generateFeedback:\s*async\s*\(payload\)/, 'aiService must define generateFeedback');
    assert.match(src, /api\.post\('\/ai\/generate-feedback',\s*payload\)/, 'generateFeedback must call POST /ai/generate-feedback');

    // 2. generateDefenseQuestions
    assert.match(src, /generateDefenseQuestions:\s*async\s*\(payload\)/, 'aiService must define generateDefenseQuestions');
    assert.match(src, /api\.post\('\/ai\/generate-defense-questions',\s*payload\)/, 'generateDefenseQuestions must call POST /ai/generate-defense-questions');

    // 3. chatRegulation
    assert.match(src, /chatRegulation:\s*async\s*\(payload\)/, 'aiService must define chatRegulation');
    assert.match(src, /api\.post\('\/ai\/regulation-chat'/, 'chatRegulation must call POST /ai/regulation-chat');
});

test('AcademicChatWidget: AcademicChatWidget.jsx adheres strictly to Rule 2.6 and contains required UI components', () => {
    const filePath = path.join(root, 'frontend/src/components/common/AcademicChatWidget.jsx');
    assert.ok(fs.existsSync(filePath), 'AcademicChatWidget.jsx must exist');
    const src = fs.readFileSync(filePath, 'utf8');

    // Rule 2.6 verification: No raw emojis or symbols in button labels
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖💬←→+📋✓✏️👥🗑️🔓▾▴↗✕][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'AcademicChatWidget must not have raw emojis in Button labels');

    // Floating position and styling
    assert.match(src, /fixed bottom-6 right-6 z-50/, 'AcademicChatWidget must have fixed bottom-right floating position');

    // Header & identity
    assert.match(src, /Trợ Lý Quy Chế Học Vụ \(AI\)/, 'AcademicChatWidget must display header title');
    assert.match(src, /Gemini 2\.0 Flash/, 'AcademicChatWidget must have Gemini model tag');

    // Icons from Ant Design
    assert.match(src, /MessageOutlined/, 'AcademicChatWidget must import MessageOutlined');
    assert.match(src, /CloseOutlined/, 'AcademicChatWidget must import CloseOutlined');
    assert.match(src, /SendOutlined/, 'AcademicChatWidget must import SendOutlined');

    // Quick Question chips
    assert.match(src, /Thời hạn nộp BM01/, 'AcademicChatWidget must include BM01 quick question chip');
    assert.match(src, /Điều kiện dừng đề tài/, 'AcademicChatWidget must include Stop condition quick question chip');
    assert.match(src, /Quy định nộp lại v2 duy nhất/, 'AcademicChatWidget must include v2 resubmission quick question chip');

    // Regulations reference
    assert.match(src, /relatedRegulations/, 'AcademicChatWidget must handle relatedRegulations in bot messages');

    // Action button label
    assert.match(src, />\s*Gửi\s*<\/Button>/, 'AcademicChatWidget must have Send button with proper Vietnamese label');
});

test('AcademicChatWidget: AppLayout.jsx imports and mounts AcademicChatWidget globally', () => {
    const src = read('frontend/src/components/layout/AppLayout.jsx');

    assert.match(src, /import AcademicChatWidget from '\.\.\/common\/AcademicChatWidget';?/, 'AppLayout must import AcademicChatWidget');
    assert.match(src, /<AcademicChatWidget\s*\/>/, 'AppLayout must render <AcademicChatWidget /> in layout root');
});
