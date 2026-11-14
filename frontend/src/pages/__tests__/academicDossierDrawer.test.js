import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('AcademicDossierDrawer: Files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    const files = [
        'frontend/src/components/prints/AcademicDossierDrawer.jsx',
        'frontend/src/pages/admin/GradingDefensePage.jsx',
        'frontend/src/pages/admin/ProjectOversightPage.jsx',
        'frontend/src/pages/lecturer/LecturerDashboardPage.jsx',
    ];

    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${f} must NOT have UTF-8 BOM`);
    }
});

test('AcademicDossierDrawer: Adheres strictly to Rule 2.6 (no raw emoji in button labels)', () => {
    const files = [
        'frontend/src/components/prints/AcademicDossierDrawer.jsx',
    ];
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕]/;
    for (const f of files) {
        const src = read(f);
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = btnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} button "${label}" has forbidden symbol`);
        }
    }
});

test('AcademicDossierDrawer: Composes all 6 print sheets and provides tabbed dossier navigation', () => {
    const src = read('frontend/src/components/prints/AcademicDossierDrawer.jsx');

    assert.match(src, /BM01PrintSheet/, 'Must import BM01PrintSheet');
    assert.match(src, /BM02PrintSheet/, 'Must import BM02PrintSheet');
    assert.match(src, /BM02APrintSheet/, 'Must import BM02APrintSheet');
    assert.match(src, /BM03PrintSheet/, 'Must import BM03PrintSheet');
    assert.match(src, /BM04PrintSheet/, 'Must import BM04PrintSheet');
    assert.match(src, /BM05PrintSheet/, 'Must import BM05PrintSheet');

    assert.match(src, /In biểu mẫu này/, 'Must have button to print current form');
    assert.match(src, /In toàn bộ hồ sơ/, 'Must have button to print all forms');
});

test('AcademicDossierDrawer: Integration into GradingDefensePage, ProjectOversightPage, and LecturerDashboardPage', () => {
    const gradingSrc = read('frontend/src/pages/admin/GradingDefensePage.jsx');
    const oversightSrc = read('frontend/src/pages/admin/ProjectOversightPage.jsx');
    const lecturerSrc = read('frontend/src/pages/lecturer/LecturerDashboardPage.jsx');

    assert.match(gradingSrc, /AcademicDossierDrawer/, 'GradingDefensePage must import AcademicDossierDrawer');
    assert.match(oversightSrc, /AcademicDossierDrawer/, 'ProjectOversightPage must import AcademicDossierDrawer');
    assert.match(lecturerSrc, /AcademicDossierDrawer/, 'LecturerDashboardPage must import AcademicDossierDrawer');
});

