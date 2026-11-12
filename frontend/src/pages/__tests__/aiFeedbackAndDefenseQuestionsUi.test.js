import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('AI Feedback & Defense Questions: OutlineReviewModal integrates AI feedback generator complying with Rule 2.6', () => {
    const src = read('frontend/src/components/lecturer/OutlineReviewModal.jsx');

    // Imports
    assert.match(src, /BulbOutlined/, 'OutlineReviewModal must import BulbOutlined');
    assert.match(src, /@ant-design\/icons/, 'OutlineReviewModal must import from @ant-design/icons');
    assert.match(src, /import\s+aiService\s+from\s+['"]\.\.\/\.\.\/services\/aiService['"]/, 'OutlineReviewModal must import aiService');

    // Handler & Service Call
    assert.match(src, /aiService\.generateFeedback/, 'OutlineReviewModal must call aiService.generateFeedback');
    assert.match(src, /contextType:\s*['"]BM01['"]/, 'generateFeedback payload must specify contextType BM01');

    // Button label and icon
    assert.match(src, /icon=\{<BulbOutlined\s*\/>\}/, 'OutlineReviewModal AI feedback button must use BulbOutlined icon');
    assert.match(src, />\s*AI Gợi ý nhận xét\s*<\/Button>/, 'OutlineReviewModal must have button labeled "AI Gợi ý nhận xét"');

    // Rule 2.6 verification: No raw emojis or symbols in button labels
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖💬←→+📋✓✏️👥🗑️🔓▾▴↗✕][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'OutlineReviewModal must not have raw emojis in Button labels');
});

test('AI Feedback & Defense Questions: LecturerGradingSheetPage integrates AI feedback and defense questions complying with Rule 2.6', () => {
    const src = read('frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx');

    // Imports
    assert.match(src, /BulbOutlined/, 'LecturerGradingSheetPage must import BulbOutlined');
    assert.match(src, /QuestionCircleOutlined/, 'LecturerGradingSheetPage must import QuestionCircleOutlined');
    assert.match(src, /CopyOutlined/, 'LecturerGradingSheetPage must import CopyOutlined');
    assert.match(src, /import\s+aiService\s+from\s+['"]\.\.\/\.\.\/services\/aiService['"]/, 'LecturerGradingSheetPage must import aiService');

    // AI Feedback button & call
    assert.match(src, /aiService\.generateFeedback/, 'LecturerGradingSheetPage must call aiService.generateFeedback');
    assert.match(src, />\s*AI Gợi ý nhận xét\s*<\/Button>/, 'LecturerGradingSheetPage must have button labeled "AI Gợi ý nhận xét"');

    // Defense Questions button & call
    assert.match(src, /aiService\.generateDefenseQuestions/, 'LecturerGradingSheetPage must call aiService.generateDefenseQuestions');
    assert.match(src, />\s*Tạo câu hỏi phản biện AI\s*<\/Button>/, 'LecturerGradingSheetPage must have button labeled "Tạo câu hỏi phản biện AI"');

    // Defense Questions display: 3 levels & copy question button
    assert.match(src, /FOUNDATION/, 'LecturerGradingSheetPage must support FOUNDATION question tier');
    assert.match(src, /TECHNICAL_CHALLENGE/, 'LecturerGradingSheetPage must support TECHNICAL_CHALLENGE question tier');
    assert.match(src, /FUTURE_EXPANSION/, 'LecturerGradingSheetPage must support FUTURE_EXPANSION question tier');
    assert.match(src, />\s*Sao chép câu hỏi\s*<\/Button>/, 'LecturerGradingSheetPage must have button labeled "Sao chép câu hỏi"');

    // Rule 2.6 verification: No raw emojis or symbols in button labels
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖💬←→+📋✓✏️👥🗑️🔓▾▴↗✕][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'LecturerGradingSheetPage must not have raw emojis in Button labels');
});
