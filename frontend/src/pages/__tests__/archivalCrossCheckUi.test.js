import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Archival Cross-Check: aiService exports crossCheckArchive and calls /ai/cross-check-archive', () => {
    const src = read('frontend/src/services/aiService.js');
    assert.match(src, /crossCheckArchive:\s*async\s*\(registrationId\)/, 'aiService must define crossCheckArchive');
    assert.match(src, /api\.post\('\/ai\/cross-check-archive',\s*\{\s*registrationId\s*\}\)/, 'crossCheckArchive must call POST /ai/cross-check-archive');
});

test('Archival Cross-Check: ArchivalCrossCheckModal adheres strictly to Rule 2.6 and renders 2-column checklist', () => {
    const src = read('frontend/src/components/admin/ArchivalCrossCheckModal.jsx');

    // Rule 2.6 verification: No raw emojis or symbols in button labels
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'ArchivalCrossCheckModal must not have raw emojis in Button labels');

    // Structure
    assert.match(src, /AI Đối Soát Hồ Sơ Lưu Chiểu Đồ Án/, 'ArchivalCrossCheckModal must have standard Vietnamese title');
    assert.match(src, /Dữ liệu pháp lý/, 'ArchivalCrossCheckModal must show legal expected column');
    assert.match(src, /AI bóc tách từ tệp lưu chiểu/, 'ArchivalCrossCheckModal must show extracted column');
    assert.match(src, /Quy tắc nội bộ \(Offline\)/, 'ArchivalCrossCheckModal must support offline fallback badge');
});

test('Archival Cross-Check: ProjectOversightPage integrates ArchivalCrossCheckModal with Rule 2.6 compliant button', () => {
    const src = read('frontend/src/pages/admin/ProjectOversightPage.jsx');

    assert.match(src, /import ArchivalCrossCheckModal/, 'ProjectOversightPage must import ArchivalCrossCheckModal');
    assert.match(src, /import aiService/, 'ProjectOversightPage must import aiService');
    assert.match(src, /AI Đối soát/, 'ProjectOversightPage must have AI Đối soát button in archive table');
    assert.match(src, /<ArchivalCrossCheckModal/, 'ProjectOversightPage must render ArchivalCrossCheckModal');

    // Rule 2.6
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'ProjectOversightPage must not have raw emojis in Button labels');
});

test('Archival Cross-Check: ArchiveSubmissionModal integrates ArchivalCrossCheckModal with Rule 2.6 compliant button', () => {
    const src = read('frontend/src/components/forms/ArchiveSubmissionModal.jsx');

    assert.match(src, /import ArchivalCrossCheckModal/, 'ArchiveSubmissionModal must import ArchivalCrossCheckModal');
    assert.match(src, /import aiService/, 'ArchiveSubmissionModal must import aiService');
    assert.match(src, /AI Đối soát hồ sơ/, 'ArchiveSubmissionModal must have button to run AI cross check');
    assert.match(src, /<ArchivalCrossCheckModal/, 'ArchiveSubmissionModal must render ArchivalCrossCheckModal');

    // Rule 2.6
    const rawEmojiRegex = /<Button[^>]*>[^<]*[🤖←→+📋✓✏️👥🗑️🔓▾▴↗][^<]*<\/Button>/;
    assert.ok(!rawEmojiRegex.test(src), 'ArchiveSubmissionModal must not have raw emojis in Button labels');
});

