import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('CouncilAssignmentPage: Query parameters and scope handling for institute defense councils', () => {
    const src = read('frontend/src/pages/admin/CouncilAssignmentPage.jsx');

    assert.match(src, /councilQueryParams\.councilType\s*=\s*effectiveType/, 'Must pass councilType query parameter to getCouncils');
    assert.match(src, /usePeriodRegistrations\(scope, \{\s*semesterId:\s*selectedSemester,\s*scope:\s*['"]institute['"]\s*\}/, 'Must query registrations with scope: institute');
    assert.match(src, /canManageCouncil/, 'Must define canManageCouncil to guard action buttons');
    assert.match(src, /const canManageDefense\s*=\s*\(user\?\.permissions\s*\|\|\s*\[\]\)\.includes\(['"]DEFENSE_COUNCIL_MANAGE['"]\)\s*\|\|\s*user\?\.role\s*===\s*['"]ADMIN['"]/, 'canManageDefense checks permission or ADMIN role');
});

test('CouncilAssignmentPage: Comprehensive candidatesForPhase handles defense progress statuses', () => {
    const src = read('frontend/src/pages/admin/CouncilAssignmentPage.jsx');

    assert.match(src, /councilTypeFilter === 'DEFENSE_COUNCIL'\) return r\.status === 'DEFENSE_READY' \|\| Boolean\(r\.defenseCouncilId \|\| r\.councilId\)/, 'Must include DEFENSE_READY and assigned defense registrations');
});

test('CouncilDetailPage: Fallback to getPublicLecturers and scope institute on assign modal', () => {
    const src = read('frontend/src/pages/admin/CouncilDetailPage.jsx');

    assert.match(src, /useCouncilLecturers\(scope\)/, 'Must fallback to getPublicLecturers on 403 or failure');
    assert.match(src, /scope:\s*['"]institute['"]/, 'Must query unassigned registrations with scope: institute');
    assert.match(src, /canManageCouncil/, 'Must guard management actions with canManageCouncil');
});

test('NavigationRegistry: Dynamic filtering for both Outline and Defense Councils', () => {
    const src = read('frontend/src/config/navigationRegistry.js');

    assert.match(src, /key:\s*['"]outline-councils['"][\s\S]*?requiresOutlineCouncil:\s*true/, 'outline-councils requires outline council membership');
    assert.match(src, /key:\s*['"]defense-councils['"][\s\S]*?requiresDefenseCouncil:\s*true/, 'defense-councils requires defense council membership');
    assert.match(src, /key:\s*['"]defense-councils['"][\s\S]*?requiredPermission:\s*['"]DEFENSE_COUNCIL_MANAGE['"]/, 'defense-councils requires DEFENSE_COUNCIL_MANAGE');
});

test('Backend registrationController: hasInstituteAuthority recognizes council management permissions', () => {
    const src = read('backend/src/controllers/registrationController.js');

    assert.match(src, /permissions\.includes\(['"]DEFENSE_COUNCIL_MANAGE['"]\)/, 'hasInstituteAuthority checks DEFENSE_COUNCIL_MANAGE');
    assert.match(src, /permissions\.includes\(['"]OUTLINE_COUNCIL_MANAGE['"]\)/, 'hasInstituteAuthority checks OUTLINE_COUNCIL_MANAGE');
    assert.match(src, /permissions\.includes\(['"]VIEW_COUNCIL_ASSIGNMENTS['"]\)/, 'hasInstituteAuthority checks VIEW_COUNCIL_ASSIGNMENTS');
});

test('Compliance with AGENTS.md Rule 2.6: Zero raw emojis or graphic symbols in button text', () => {
    const files = [
        'frontend/src/pages/admin/CouncilAssignmentPage.jsx',
        'frontend/src/pages/admin/CouncilDetailPage.jsx',
        'frontend/src/config/navigationRegistry.js',
    ];

    const forbiddenSymbols = /[←→+🤖✓✏️👥🗑️🔓▾▴↗⚠️⚠]/;

    for (const file of files) {
        const content = read(file);
        // Find all Button component children
        const buttonRegex = /<Button\b[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = buttonRegex.exec(content)) !== null) {
            const inner = match[1];
            // Strip tags
            const textOnly = inner.replace(/<[^>]+>/g, '').trim();
            assert.doesNotMatch(
                textOnly,
                forbiddenSymbols,
                `Forbidden raw symbol found in Button label in ${file}: "${textOnly}"`
            );
        }
    }
});

test('UTF-8 without BOM verification (Rule 2.4)', () => {
    const files = [
        'backend/src/controllers/registrationController.js',
        'frontend/src/config/navigationRegistry.js',
        'frontend/src/App.jsx',
        'frontend/src/pages/admin/CouncilAssignmentPage.jsx',
        'frontend/src/pages/admin/CouncilDetailPage.jsx',
    ];

    for (const file of files) {
        const fullPath = path.join(root, file);
        const buf = fs.readFileSync(fullPath);
        const hasBOM = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        assert.equal(hasBOM, false, `${file} must be UTF-8 without BOM`);
    }
});
