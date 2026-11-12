import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Topic Similarity: aiService exports checkTopicSimilarity and calls /ai/topic-similarity', () => {
    const src = read('frontend/src/services/aiService.js');
    assert.match(src, /checkTopicSimilarity:\s*async\s*\(payload\)/, 'aiService must define checkTopicSimilarity');
    assert.match(src, /api\.post\('\/ai\/topic-similarity',\s*payload\)/, 'checkTopicSimilarity must call POST /ai/topic-similarity');
});

test('Topic Similarity: TopicSimilarityModal adheres strictly to Rule 2.6 and renders comparison details', () => {
    const src = read('frontend/src/components/topics/TopicSimilarityModal.jsx');

    // Rule 2.6 verification: No raw emojis or symbols in button labels
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'TopicSimilarityModal must not have raw emojis in Button labels');

    // Title and structure
    assert.match(src, /Kiểm Tra Tính Mới/, 'TopicSimilarityModal must have standard Vietnamese title');
    assert.match(src, /Gợi ý điều chỉnh tên đề tài/, 'TopicSimilarityModal must have suggestions section');
    assert.match(src, /Quy tắc nội bộ \(Offline\)/, 'TopicSimilarityModal must support offline fallback badge');
    assert.match(src, /onSelectTitle/, 'TopicSimilarityModal must support one-click suggestion selection callback');
});

test('Topic Similarity: Lecturer TopicManagementPage integrates TopicSimilarityModal with Rule 2.6 compliant button', () => {
    const src = read('frontend/src/pages/lecturer/TopicManagementPage.jsx');

    assert.match(src, /import TopicSimilarityModal/, 'Lecturer TopicManagementPage must import TopicSimilarityModal');
    assert.match(src, /import aiService/, 'Lecturer TopicManagementPage must import aiService');
    assert.match(src, /Kiểm tra tính mới AI/, 'Lecturer TopicManagementPage must have button to check novelty');
    assert.match(src, /<TopicSimilarityModal/, 'Lecturer TopicManagementPage must render TopicSimilarityModal');

    // Rule 2.6
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'Lecturer TopicManagementPage must not have raw emojis in Button labels');
});

test('Topic Similarity: Admin TopicManagementPage integrates TopicSimilarityModal with Rule 2.6 compliant button', () => {
    const src = read('frontend/src/pages/admin/TopicManagementPage.jsx');

    assert.match(src, /import TopicSimilarityModal/, 'Admin TopicManagementPage must import TopicSimilarityModal');
    assert.match(src, /import aiService/, 'Admin TopicManagementPage must import aiService');
    assert.match(src, /Kiểm tra tính mới AI/, 'Admin TopicManagementPage must have button to check novelty');
    assert.match(src, /<TopicSimilarityModal/, 'Admin TopicManagementPage must render TopicSimilarityModal');

    // Rule 2.6
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'Admin TopicManagementPage must not have raw emojis in Button labels');
});
