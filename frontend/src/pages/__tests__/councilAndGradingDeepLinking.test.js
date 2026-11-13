import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readBuffer = (rel) => fs.readFileSync(path.join(root, rel));

test('CouncilAssignmentPage: Implements fallback to getPublicLecturers when getUsers fails or returns 403', () => {
    const src = read('frontend/src/pages/admin/CouncilAssignmentPage.jsx');

    assert.match(src, /userService\.getUsers/, 'fetchLecturers must call userService.getUsers');
    assert.match(src, /userService\.getPublicLecturers/, 'fetchLecturers must fallback to userService.getPublicLecturers');

    // Extract fetchLecturers function body
    const fetchLecturersMatch = src.match(/const fetchLecturers = useCallback\(async \(\) => \{([\s\S]*?)\}, \[\]\);/);
    assert.ok(fetchLecturersMatch, 'Must define fetchLecturers with useCallback');
    const fetchLecturersBody = fetchLecturersMatch[1];

    assert.match(fetchLecturersBody, /userService\.getUsers/, 'Body must call getUsers');
    assert.match(fetchLecturersBody, /getPublicLecturers/, 'Body must contain fallback to getPublicLecturers');

    // Ensure error toast is only triggered when fallback also fails
    const catchBlocks = fetchLecturersBody.match(/catch/g);
    assert.ok(catchBlocks && catchBlocks.length >= 2, 'fetchLecturers must have nested try/catch for fallback');
    assert.match(fetchLecturersBody, /message\.error\(['"]Lỗi khi tải danh sách giảng viên['"]\)/, 'Must display generic error only if both calls fail');
});

test('CouncilAssignmentPage: Uses Promise.allSettled instead of Promise.all in fetchCouncils', () => {
    const src = read('frontend/src/pages/admin/CouncilAssignmentPage.jsx');

    assert.match(src, /Promise\.allSettled/, 'fetchCouncils must use Promise.allSettled');
    assert.doesNotMatch(src, /Promise\.all\(\[\s*councilService\.getCouncils/, 'Must not use fragile Promise.all');

    // Extract fetchCouncils body
    const fetchCouncilsMatch = src.match(/const fetchCouncils = useCallback\(async \(\) => \{([\s\S]*?)\}, \[selectedSemester\]\);/);
    assert.ok(fetchCouncilsMatch, 'Must define fetchCouncils with useCallback');
    const fetchCouncilsBody = fetchCouncilsMatch[1];

    assert.match(fetchCouncilsBody, /Promise\.allSettled\(\[/, 'Must execute Promise.allSettled');
    assert.match(fetchCouncilsBody, /councilsResult\.status === ['"]fulfilled['"]/, 'Must inspect councilsResult fulfilled status');
    assert.match(fetchCouncilsBody, /regsResult\.status === ['"]fulfilled['"]/, 'Must inspect regsResult fulfilled status');
    assert.match(fetchCouncilsBody, /councilsResult\.status === ['"]rejected['"]/, 'Must handle councilsResult rejection gracefully');
    assert.match(fetchCouncilsBody, /regsResult\.status === ['"]rejected['"]/, 'Must handle regsResult rejection gracefully');
});

test('GradingDefensePage: Imports and initializes useSearchParams for deep linking', () => {
    const src = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    assert.match(src, /import\s*\{[^}]*useSearchParams[^}]*\}\s*from\s*['"]react-router-dom['"]/, 'Must import useSearchParams from react-router-dom');
    assert.match(src, /const\s*\[\s*searchParams\s*,\s*setSearchParams\s*\]\s*=\s*useSearchParams\(\)/, 'Must initialize useSearchParams hook');
});

test('GradingDefensePage: Handles tab=approvals by switching to activeTab("all") and filtering AWAITING_FINAL_APPROVAL', () => {
    const src = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    // Sync tab logic in useEffect
    assert.match(src, /searchParams\.get\(['"]tab['"]\)/, 'Must inspect searchParams.get("tab")');
    assert.match(src, /tab === ['"]approvals['"][\s\S]*?setActiveTab\(['"]all['"]\)/, 'When tab=approvals, must setActiveTab to "all"');

    // Filtering is exercised by resultApprovals.spec.jsx against the real route.
    assert.match(src, /useResultApprovals/, 'Must use the shared approval projection');

    // Tab button for approvals
    assert.match(src, /Chờ phê duyệt/, 'Must have a "Chờ phê duyệt" tab pill in UI');
    assert.match(src, /handleTabChange\(['"]approvals['"]\)/, 'Clicking approvals pill must invoke handleTabChange("approvals")');
});

test('GradingDefensePage: Handles tab=publish for publication readers and canonical publishers', () => {
    const src = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    assert.match(src, /tab === ['"]publish['"]/, 'Must check for tab=publish in URL');
    assert.match(src, /canViewPublications[\s\S]*?setIsPublicationModalOpen\(true\)/, 'Publication viewers must be able to open the preview');
    assert.match(src, /RESULT_PUBLICATION_PUBLISH/, 'Publish controls must use the canonical permission');
    assert.doesNotMatch(src, /['"]RESULT_PUBLISH['"]/, 'Legacy publisher permission must not enable controls');

    // Open & close modal helpers
    assert.match(src, /handleOpenPublicationModal/, 'Must define handleOpenPublicationModal');
    assert.match(src, /handleClosePublicationModal/, 'Must define handleClosePublicationModal');
    assert.match(src, /setIsPublicationModalOpen/, 'Must expose setIsPublicationModalOpen');
});

test('GradingDefensePage: Synchronizes tab and filter changes with setSearchParams', () => {
    const src = read('frontend/src/pages/admin/GradingDefensePage.jsx');

    assert.match(src, /const handleTabChange = useCallback\(/, 'Must define handleTabChange for synchronized tab switches');
    assert.match(src, /next\.set\(['"]tab['"], targetTab\)|next\.set\(['"]tab['"], ['"]approvals['"]\)/, 'Must set tab query param in setSearchParams');
    assert.match(src, /next\.delete\(['"]tab['"]\)/, 'Must clear tab query param when switching back to "all"');
});

test('Compliance with AGENTS.md Rule 2.6: No raw emoji or graphic symbols in button labels', () => {
    const files = [
        'frontend/src/pages/admin/CouncilAssignmentPage.jsx',
        'frontend/src/pages/admin/GradingDefensePage.jsx',
    ];

    const forbiddenCharsRegex = /[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/;
    const buttonRegex = /<(?:Button|button)[\s\S]*?<\/(?:Button|button)>/g;

    files.forEach((file) => {
        const src = read(file);
        let match;
        const violations = [];

        while ((match = buttonRegex.exec(src)) !== null) {
            const buttonHtml = match[0];
            // Remove JSX components and attributes to inspect visible button text
            const textContent = buttonHtml
                .replace(/<[^>]+>/g, ' ')
                .replace(/\{[^}]+\}/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (forbiddenCharsRegex.test(textContent)) {
                violations.push({ file, buttonHtml: buttonHtml.slice(0, 100), textContent });
            }
        }

        assert.equal(violations.length, 0, `Violations of Rule 2.6 in ${file}: ${JSON.stringify(violations, null, 2)}`);
    });
});

test('UTF-8 without BOM verification (Rule 2.4)', () => {
    const files = [
        'frontend/src/pages/admin/CouncilAssignmentPage.jsx',
        'frontend/src/pages/admin/GradingDefensePage.jsx',
        'frontend/src/pages/__tests__/councilAndGradingDeepLinking.test.js',
    ];

    files.forEach((file) => {
        const buffer = readBuffer(file);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${file} must not contain UTF-8 BOM`);
    });
});
