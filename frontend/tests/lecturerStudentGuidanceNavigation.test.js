import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 5 files adhere to UTF-8 without BOM (Rule 2.4) and no raw emoji in Button labels (Rule 2.6)', () => {
    const files = [
        'src/components/lecturer/SupervisedStudentList.jsx',
        'src/pages/lecturer/LecturerStudentsPage.jsx',
        'src/pages/lecturer/LecturerDashboardPage.jsx',
        'src/pages/lecturer/LecturerStudentGuidancePage.jsx',
        'src/pages/lecturer/TopicApprovalPage.jsx',
    ];
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕🤖]/;

    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${f} must NOT have UTF-8 BOM`);

        const src = buffer.toString('utf8');
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = btnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} button "${label}" contains forbidden raw symbol`);
        }
    }
});

test('SupervisedStudentList replaces onOpenDossier/"Hồ sơ" with onOpenGuidance/"Xem quá trình" in both table and card views', () => {
    const src = read('src/components/lecturer/SupervisedStudentList.jsx');

    assert.equal(src.includes('onOpenDossier'), false, 'SupervisedStudentList must not reference onOpenDossier');
    assert.match(src, /onOpenGuidance/, 'SupervisedStudentList must accept and call onOpenGuidance');

    const matches = src.match(/Xem quá trình/g) || [];
    assert.ok(matches.length >= 2, 'SupervisedStudentList must render "Xem quá trình" in both table and card views');

    const guidanceCallMatches = src.match(/onOpenGuidance\?\.\(student\)/g) || [];
    assert.ok(guidanceCallMatches.length >= 2, 'Both table and card buttons must call onOpenGuidance?.(student)');
});

test('LecturerStudentsPage and LecturerDashboardPage navigate to /lecturer/students/:registrationId via onOpenGuidance and preserve context', () => {
    const studentsSrc = read('src/pages/lecturer/LecturerStudentsPage.jsx');
    const dashboardSrc = read('src/pages/lecturer/LecturerDashboardPage.jsx');

    for (const [name, src] of [
        ['LecturerStudentsPage', studentsSrc],
        ['LecturerDashboardPage', dashboardSrc],
    ]) {
        assert.equal(src.includes('AcademicDossierDrawer'), false, `${name} must not use AcademicDossierDrawer`);
        assert.equal(src.includes('onOpenDossier'), false, `${name} must not pass onOpenDossier`);
        assert.match(src, /onOpenGuidance=\{handleOpenGuidance\}/, `${name} must pass onOpenGuidance={handleOpenGuidance}`);
        assert.match(src, /navigate\(`\/lecturer\/students\/\$\{student\.registrationId\}`/, `${name} must navigate to /lecturer/students/\${student.registrationId}`);
        assert.match(src, /semesterId/, `${name} must preserve semesterId context`);
        assert.match(src, /from:/, `${name} must pass origin route in location state`);
    }
});

test('LecturerStudentGuidancePage Back button restores list and semester context', () => {
    const src = read('src/pages/lecturer/LecturerStudentGuidancePage.jsx');
    assert.match(src, /location\.state\?\.from/, 'handleBack must check location.state?.from');
    assert.match(src, /semesterId:\s*location\.state\?\.semesterId/, 'handleBack must restore semesterId in navigation state');
});

test('LecturerStudentGuidancePage wires BM actions to exact routes and guards VIEW_PRINT with real data', () => {
    const src = read('src/pages/lecturer/LecturerStudentGuidancePage.jsx');

    // BM01 REVIEW / VIEW -> /lecturer/approvals?tab=outline&registrationId=...
    assert.match(
        src,
        /\/lecturer\/approvals\?tab=outline&registrationId=\$\{regId\}/,
        'BM01 REVIEW/VIEW must navigate to /lecturer/approvals?tab=outline&registrationId=${regId}'
    );

    // BM02-A REVIEW / VIEW -> /lecturer/title-adjustments?requestId=...
    assert.match(
        src,
        /\/lecturer\/title-adjustments\?requestId=\$\{requestId\}/,
        'BM02-A REVIEW/VIEW must navigate to /lecturer/title-adjustments?requestId=${requestId}'
    );

    // BM03 / BM04 OPEN_PROGRESS / REVIEW -> /lecturer/progress?registrationId=...
    assert.match(
        src,
        /\/lecturer\/progress\?registrationId=\$\{regId\}/,
        'BM03/BM04 OPEN_PROGRESS/REVIEW must navigate to /lecturer/progress?registrationId=${regId}'
    );

    // BM02 VIEW stays on detail page (opens BM02 print/view modal)
    assert.match(src, /formCode === 'BM02'/, 'Must handle BM02 view/print on detail page');

    // VIEW_PRINT checks real data before opening modal
    assert.match(src, /hasPrintableData/, 'VIEW_PRINT must verify form has real data before opening print modal');

    // "In toàn bộ" only shown in Biểu mẫu section when eligible forms exist
    assert.match(src, /eligiblePrintCodes\.length > 0/, '"In toàn bộ" must only render when eligiblePrintCodes.length > 0');
    assert.match(src, /In toàn bộ/, 'Must provide "In toàn bộ" button in document section when eligible forms exist');
});

test('TopicApprovalPage supports ?registrationId= query param to highlight target registration', () => {
    const src = read('src/pages/lecturer/TopicApprovalPage.jsx');
    assert.match(src, /searchParams\.get\(['"]registrationId['"]\)/, 'TopicApprovalPage must read registrationId from searchParams');
    assert.match(src, /isTargetRegistration/, 'TopicApprovalPage must highlight target registration when registrationId is provided');
});
