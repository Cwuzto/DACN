import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readBuffer = (relativePath) => fs.readFileSync(path.join(root, relativePath));

const TARGET_FILES = [
    'src/components/lecturer/BM04AiSuggestionDrawer.jsx',
    'src/components/lecturer/BM04EvaluationModal.jsx',
    'src/services/aiService.js',
];

test('BM04 AI Suggestion: Files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    TARGET_FILES.forEach((filePath) => {
        const fullPath = path.join(root, filePath);
        assert.ok(fs.existsSync(fullPath), `Tệp ${filePath} phải tồn tại`);
        const buffer = readBuffer(filePath);
        const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.strictEqual(hasBom, false, `Tệp ${filePath} không được chứa BOM`);
    });
});

test('BM04 AI Suggestion: Adheres strictly to Rule 2.6 (No raw emoji or symbols in button labels)', () => {
    const forbiddenSymbols = ['←', '→', '+', '🤖', '📋', '✓', '✏️', '👥', '🗑️', '🔓', '▾', '▴', '↗', '⚡', '🔐', '🛡️', '📊'];

    TARGET_FILES.forEach((filePath) => {
        const fullPath = path.join(root, filePath);
        if (!fs.existsSync(fullPath)) return;
        const source = read(filePath);
        const buttonMatches = source.match(/<Button\b[^>]*>[\s\S]*?<\/Button>/g) || [];
        buttonMatches.forEach((btn) => {
            forbiddenSymbols.forEach((sym) => {
                assert.ok(
                    !btn.includes(sym),
                    `Nút bấm trong ${filePath} chứa ký tự thô/emoji cấm '${sym}': ${btn}`
                );
            });
        });
    });
});

test('BM04 AI Suggestion: aiService exports generateBM04Suggestions calling /ai/bm04-suggestion', () => {
    const source = read('src/services/aiService.js');
    assert.ok(source.includes('generateBM04Suggestions:'), 'aiService phải khai báo phương thức generateBM04Suggestions');
    assert.ok(source.includes('/ai/bm04-suggestion'), 'generateBM04Suggestions phải gọi endpoint /ai/bm04-suggestion');
});

test('BM04 AI Suggestion: BM04EvaluationModal mounts AI trigger banner and connects BM04AiSuggestionDrawer', () => {
    const source = read('src/components/lecturer/BM04EvaluationModal.jsx');
    assert.ok(source.includes('BM04AiSuggestionDrawer'), 'BM04EvaluationModal phải import và sử dụng BM04AiSuggestionDrawer');
    assert.ok(source.includes('generateBM04Suggestions'), 'BM04EvaluationModal phải gọi aiService.generateBM04Suggestions');
    assert.ok(source.includes('AI Gợi ý từ BM03'), 'BM04EvaluationModal phải có nút bấm kích hoạt AI Gợi ý từ BM03');
    assert.ok(source.includes('handleApplyAllAiSuggestions'), 'BM04EvaluationModal phải có hàm áp dụng toàn bộ nhận xét');
});

test('BM04 AI Suggestion: BM04AiSuggestionDrawer renders evidence summary and 4 criteria sections', () => {
    const source = read('src/components/lecturer/BM04AiSuggestionDrawer.jsx');
    assert.ok(source.includes('evidenceSummary'), 'BM04AiSuggestionDrawer phải hiển thị tóm tắt minh chứng BM03');
    assert.ok(source.includes('thesisFormatScore'), 'BM04AiSuggestionDrawer phải hiển thị tiêu chí Hình thức BCTN');
    assert.ok(source.includes('researchContentScore'), 'BM04AiSuggestionDrawer phải hiển thị tiêu chí Nội dung nghiên cứu');
    assert.ok(source.includes('applicabilityScore'), 'BM04AiSuggestionDrawer phải hiển thị tiêu chí Tính ứng dụng');
    assert.ok(source.includes('attitudeScore'), 'BM04AiSuggestionDrawer phải hiển thị tiêu chí Thái độ & ý thức');
    assert.ok(source.includes('onApplyAll'), 'BM04AiSuggestionDrawer phải có chức năng áp dụng toàn bộ');
    assert.ok(source.includes('onApplyField'), 'BM04AiSuggestionDrawer phải có chức năng áp dụng từng tiêu chí');
});

