import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Contextual Print Buttons: Strictly adhere to Rule 2.6 (no raw emoji in button labels)', () => {
    const files = [
        'frontend/src/pages/student/SubmissionPage.jsx',
        'frontend/src/components/student/TitleAdjustmentModal.jsx',
        'frontend/src/components/lecturer/BM04EvaluationModal.jsx'
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

test('Contextual Print Buttons: Integrates A4 print modals into SubmissionPage, TitleAdjustmentModal, and BM04EvaluationModal', () => {
    const subSrc = read('frontend/src/pages/student/SubmissionPage.jsx');
    const titleSrc = read('frontend/src/components/student/TitleAdjustmentModal.jsx');
    const bm04Src = read('frontend/src/components/lecturer/BM04EvaluationModal.jsx');

    assert.match(subSrc, /AcademicFormPrintModal/, 'SubmissionPage must import AcademicFormPrintModal');
    assert.match(titleSrc, /AcademicFormPrintModal|BM02APrintSheet/, 'TitleAdjustmentModal must import print component');
    assert.match(bm04Src, /AcademicFormPrintModal|BM04PrintSheet/, 'BM04EvaluationModal must import print component');
});

