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

test('AcademicChatWidget: UTF-8 without BOM verification (Rule 2.4)', () => {
    const rawBuffer = fs.readFileSync(path.join(root, 'frontend/src/components/common/AcademicChatWidget.jsx'));
    const hasBom = rawBuffer[0] === 0xEF && rawBuffer[1] === 0xBB && rawBuffer[2] === 0xBF;
    assert.strictEqual(hasBom, false, 'AcademicChatWidget.jsx must not have UTF-8 BOM');
});

test('AcademicChatWidget: Adheres strictly to Rule 2.6 (No raw emojis or symbols in button labels)', () => {
    const src = read('frontend/src/components/common/AcademicChatWidget.jsx');

    // Rule 2.6 verification: No raw emojis or symbols in button labels
    const rawEmojiRegex = /<Button[\s\S]*?>[\s\S]*?[🤖💬←→+📋✓✏️👥🗑️🔓▾▴↗✕][\s\S]*?<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'AcademicChatWidget must not have raw emojis in Button labels');

    // Extract all button children text ending in </Button>
    const buttonLabelRegex = />\s*([^<>{}\n]+?)\s*<\/Button>/g;
    let match;
    const buttonLabels = [];

    while ((match = buttonLabelRegex.exec(src)) !== null) {
        buttonLabels.push(match[1].trim());
    }

    const forbiddenSymbols = /[🤖💬←→+📋✓✏️👥🗑️🔓▾▴↗✕]/;
    for (const label of buttonLabels) {
        assert.ok(!forbiddenSymbols.test(label), `Button label "${label}" must not contain raw symbols or emojis`);
    }

    // Explicit check for known buttons and accessible action buttons
    assert.ok(buttonLabels.includes('Gửi'), 'Must contain "Gửi" button');
    assert.match(src, /aria-label=["']Làm mới["']/, 'Must provide aria-label="Làm mới" for clear button');
    assert.match(src, /aria-label=["']Đóng["']/, 'Must provide aria-label="Đóng" for close button');

    // Icons from Ant Design
    assert.match(src, /MessageOutlined/, 'Must import MessageOutlined');
    assert.match(src, /CloseOutlined/, 'Must import CloseOutlined');
    assert.match(src, /SendOutlined/, 'Must import SendOutlined');
    assert.match(src, /ClearOutlined/, 'Must import ClearOutlined');
    assert.match(src, /QuestionCircleOutlined/, 'Must import QuestionCircleOutlined');
});

test('AcademicChatWidget: Integrates useAuth hook to retrieve current user', () => {
    const src = read('frontend/src/components/common/AcademicChatWidget.jsx');
    assert.match(src, /import\s+useAuth\s+from\s+['"]\.\.\/\.\.\/hooks\/useAuth['"]/, 'AcademicChatWidget must import useAuth from hooks/useAuth');
    assert.match(src, /const\s*\{\s*user\s*\}\s*=\s*useAuth\(\)/, 'AcademicChatWidget must call useAuth() to destructure user');

    // Also verify hook file exists
    const hookPath = path.join(root, 'frontend/src/hooks/useAuth.js');
    assert.ok(fs.existsSync(hookPath), 'frontend/src/hooks/useAuth.js must exist');
    const hookSrc = fs.readFileSync(hookPath, 'utf8');
    assert.match(hookSrc, /useAuthStore/, 'useAuth hook must wrap useAuthStore');
});

test('AcademicChatWidget: Renders correct role badges for STUDENT, LECTURER, and ADMIN in Header', () => {
    const src = read('frontend/src/components/common/AcademicChatWidget.jsx');

    // Role tags in header
    assert.match(src, /<Tag color="blue">Sinh viên<\/Tag>/, 'Must render blue Tag for Sinh viên');
    assert.match(src, /<Tag color="green">Giảng viên \/ HĐ<\/Tag>/, 'Must render green Tag for Giảng viên / HĐ');
    assert.match(src, /<Tag color="purple">Quản trị viên<\/Tag>/, 'Must render purple Tag for Quản trị viên');

    // Model identity
    assert.match(src, /Gemini 3\.8 Flash/, 'Header must display Gemini 3.8 Flash model tag');

    // Role badge render helper verification
    assert.match(src, /export const renderRoleBadge\s*=/, 'AcademicChatWidget must export renderRoleBadge helper');
    assert.match(src, /case 'LECTURER':\s*return\s*<Tag color="green">Giảng viên \/ HĐ<\/Tag>/, 'renderRoleBadge maps LECTURER to green tag');
    assert.match(src, /case 'ADMIN':\s*return\s*<Tag color="purple">Quản trị viên<\/Tag>/, 'renderRoleBadge maps ADMIN to purple tag');
    assert.match(src, /case 'STUDENT':\s*default:\s*return\s*<Tag color="blue">Sinh viên<\/Tag>/, 'renderRoleBadge maps STUDENT to blue tag');
});

test('AcademicChatWidget: Renders role-specific quick questions (ROLE_QUICK_QUESTIONS & getRoleQuickQuestions)', () => {
    const src = read('frontend/src/components/common/AcademicChatWidget.jsx');

    // Student questions
    assert.match(src, /Hạn nộp BM01 khi nào\?/, 'Must contain Student question: Hạn nộp BM01 khi nào?');
    assert.match(src, /Điều kiện để được ra bảo vệ đồ án\?/, 'Must contain Student question: Điều kiện để được ra bảo vệ đồ án?');
    assert.match(src, /Khi nào bị dừng đề tài\?/, 'Must contain Student question: Khi nào bị dừng đề tài?');
    assert.match(src, /Quy định đổi tên đề tài\?/, 'Must contain Student question: Quy định đổi tên đề tài?');

    // Lecturer questions
    assert.match(src, /Tiêu chí chấm 4 nhóm chuẩn đầu ra BM04\?/, 'Must contain Lecturer question: Tiêu chí chấm 4 nhóm chuẩn đầu ra BM04?');
    assert.match(src, /Quy trình thẩm định dừng đề tài BM03\?/, 'Must contain Lecturer question: Quy trình thẩm định dừng đề tài BM03?');
    assert.match(src, /Cơ cấu điểm Hội đồng bảo vệ\?/, 'Must contain Lecturer question: Cơ cấu điểm Hội đồng bảo vệ?');
    assert.match(src, /Gợi ý câu hỏi phản biện kỹ thuật/, 'Must contain Lecturer question: Gợi ý câu hỏi phản biện kỹ thuật');

    // Admin questions
    assert.match(src, /Quy trình ban hành quyết định giao đề tài\?/, 'Must contain Admin question: Quy trình ban hành quyết định giao đề tài?');
    assert.match(src, /Xử lý quá hạn SLA 168 giờ thế nào\?/, 'Must contain Admin question: Xử lý quá hạn SLA 168 giờ thế nào?');
    assert.match(src, /Cơ chế hoạt động của 5 Sweep Jobs\?/, 'Must contain Admin question: Cơ chế hoạt động của 5 Sweep Jobs?');

    // Helper getRoleQuickQuestions
    assert.match(src, /export const getRoleQuickQuestions\s*=/, 'AcademicChatWidget must export getRoleQuickQuestions');
    assert.match(src, /useEffect\(\(\)\s*=>\s*\{[\s\S]*setQuickQuestions\(getRoleQuickQuestions\(user\?\.role\)\);[\s\S]*\},\s*\[user\?\.role\]\)/, 'Quick questions must synchronize with user.role changes');
});

test('AcademicChatWidget: Multi-turn history preserves Gemini chat contract with role and text', () => {
    const src = read('frontend/src/components/common/AcademicChatWidget.jsx');

    // Multi-turn history structure
    assert.match(src, /role:\s*m\.sender\s*===\s*'user'\s*\?\s*'user'\s*:\s*'model'/, 'History role must map user to "user" and bot to "model"');
    assert.match(src, /text:\s*m\.text/, 'History must preserve message text');
    assert.match(src, /aiService\.chatRegulation\(\{\s*message:\s*query,\s*history\s*\}\)/, 'aiService.chatRegulation must receive message and history');
});

test('AcademicChatWidget: AppLayout.jsx imports and mounts AcademicChatWidget globally', () => {
    const src = read('frontend/src/components/layout/AppLayout.jsx');

    assert.match(src, /import AcademicChatWidget from '\.\.\/common\/AcademicChatWidget';?/, 'AppLayout must import AcademicChatWidget');
    assert.match(src, /<AcademicChatWidget\s*\/>/, 'AppLayout must render <AcademicChatWidget /> in layout root');
});
