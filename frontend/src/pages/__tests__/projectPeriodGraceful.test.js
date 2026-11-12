import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('ProjectPeriodPage: Imports and uses useSearchParams for bidirectional tab sync', () => {
    const src = read('frontend/src/pages/admin/ProjectPeriodPage.jsx');
    assert.match(src, /import\s*\{[^}]*useSearchParams[^}]*\}\s*from\s*['"]react-router-dom['"]/, 'Must import useSearchParams from react-router-dom');
    assert.match(src, /const\s*\[\s*searchParams\s*,\s*setSearchParams\s*\]\s*=\s*useSearchParams\(\)/, 'Must initialize useSearchParams');
    assert.match(src, /searchParams\.get\(['"]tab['"]\)/, 'Must read tab parameter from searchParams');
    assert.match(src, /setSearchParams\(\{\s*tab:\s*['"]delegations['"]\s*\}\)/, 'Must set delegations tab via setSearchParams');
    assert.match(src, /setSearchParams\(\{\s*tab:\s*['"]bm02['"]\s*\}\)/, 'Must set bm02 tab via setSearchParams');
    assert.match(src, /setSearchParams\(\{\s*\}\)/, 'Must reset tab parameter via setSearchParams');
    assert.doesNotMatch(src, /window\.history\.replaceState/, 'Must not use raw window.history.replaceState for tab navigation');
});

test('ProjectPeriodPage: Uses Promise.allSettled and graceful fallback in fetchSemesters & fetchDelegations', () => {
    const src = read('frontend/src/pages/admin/ProjectPeriodPage.jsx');
    assert.match(src, /Promise\.allSettled/, 'fetchSemesters must use Promise.allSettled instead of Promise.all');
    assert.doesNotMatch(src, /const\s*\[semesterRes,\s*topicRes,\s*registrationRes\]\s*=\s*await\s*Promise\.all/, 'Must not use fragile Promise.all');
    assert.match(src, /registrationResult\.status === ['"]fulfilled['"]/, 'Must safely check registrationResult status');
    assert.match(src, /topicResult\.status === ['"]fulfilled['"]/, 'Must safely check topicResult status');
    assert.match(src, /const fetchDelegations = useCallback\(async \((?:showError = false)?\)/, 'fetchDelegations must handle errors gracefully without automatic toast on initial load');
});

test('ProjectPeriodPage: Standardizes BM02 tab label and action button', () => {
    const src = read('frontend/src/pages/admin/ProjectPeriodPage.jsx');
    assert.match(src, /Hàng đợi Thẩm định Đơn đăng ký \(BM02\)/, 'Tab 2 must be labeled "Hàng đợi Thẩm định Đơn đăng ký (BM02)"');
    assert.match(src, />\s*Thẩm định đơn BM02\s*<\/Button>/, 'Action button must be "Thẩm định đơn BM02"');
    assert.doesNotMatch(src, /<span>Hàng đợi Thẩm định Đề cương<\/span>/, 'Must not use outdated "Hàng đợi Thẩm định Đề cương" label');
    assert.doesNotMatch(src, />\s*Thẩm định đề cương\s*<\/Button>/, 'BM02 review button must not be labeled "Thẩm định đề cương"');
});

test('ProjectPeriodPage: Complies with AGENTS.md Rule 2.6 (no raw emojis / graphic characters in button labels)', () => {
    const src = read('frontend/src/pages/admin/ProjectPeriodPage.jsx');
    const buttonRegex = /<Button[\s\S]*?<\/Button>/g;
    const forbiddenCharsRegex = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/;

    let match;
    const violations = [];
    while ((match = buttonRegex.exec(src)) !== null) {
        const buttonText = match[0];
        const textContent = buttonText
            .replace(/<[^>]+>/g, ' ')
            .replace(/\{[^}]+\}/g, ' ')
            .trim();

        if (forbiddenCharsRegex.test(textContent)) {
            violations.push({ button: buttonText.replace(/\s+/g, ' '), textContent });
        }
    }

    assert.equal(violations.length, 0, `Found Rule 2.6 violations in buttons: ${JSON.stringify(violations)}`);
});

test('ProjectPeriodPage: UTF-8 no BOM validation', () => {
    const filePath = path.join(root, 'frontend/src/pages/admin/ProjectPeriodPage.jsx');
    const buf = fs.readFileSync(filePath);
    const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
    assert.equal(hasBom, false, 'ProjectPeriodPage.jsx must be encoded in UTF-8 without BOM');
});
