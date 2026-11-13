import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readBuffer = (rel) => fs.readFileSync(path.join(root, rel));

test('CouncilAssignmentPage: shares the permission-aware lecturer directory query', () => {
    const src = read('frontend/src/pages/admin/CouncilAssignmentPage.jsx');
    const queries = read('frontend/src/queries/councilQueries.js');
    assert.match(src, /useCouncilLecturers\(scope\)/);
    assert.match(queries, /useUsers\(scope,/);
    assert.match(queries, /usePublicLecturers\(scope, \{\}, primary.isError\)/);
});

test('CouncilAssignmentPage: council and registration resources have independent queries', () => {
    const src = read('frontend/src/pages/admin/CouncilAssignmentPage.jsx');
    assert.match(src, /useCouncils\(scope, councilQueryParams\)/);
    assert.match(src, /usePeriodRegistrations\(scope,/);
    assert.doesNotMatch(src, /setCouncils|setAllRegistrations/);
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
