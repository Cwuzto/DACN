import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 5 levels up from __tests__ is repo root (d:\DACN)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('A4 Foundation: Files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    const files = [
        'frontend/src/components/prints/A4PageContainer.jsx',
        'frontend/src/components/prints/AcademicFormPrintModal.jsx'
    ];
    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buf = fs.readFileSync(fullPath);
        const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        assert.strictEqual(hasBom, false, `${f} must not have BOM`);
    }
});

test('A4 Foundation: AcademicFormPrintModal complies with Rule 2.6 (no raw emoji in button labels)', () => {
    const src = read('frontend/src/components/prints/AcademicFormPrintModal.jsx');
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕]/;
    const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    let foundButton = false;
    while ((match = btnRegex.exec(src)) !== null) {
        foundButton = true;
        const label = match[1].replace(/<[^>]+>/g, '').trim();
        assert.ok(!forbidden.test(label), `Button label "${label}" must not contain raw symbols`);
    }
    assert.ok(foundButton, 'Must contain buttons');
    assert.match(src, /PrinterOutlined/, 'Must use PrinterOutlined icon');
});

test('A4 Foundation: A4PageContainer defines simulated-a4-sheet and print media styles', () => {
    const src = read('frontend/src/components/prints/A4PageContainer.jsx');
    assert.match(src, /210mm/, 'Must define 210mm standard A4 width');
    assert.match(src, /@media\s+print/, 'Must declare @media print rules');
    assert.match(src, /Times New Roman/, 'Must use Times New Roman academic font');
});
