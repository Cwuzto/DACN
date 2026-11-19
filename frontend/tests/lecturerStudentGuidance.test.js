import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 4 files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    const files = [
        'src/queries/registrationQueries.js',
        'src/components/lecturer/GuidanceFormList.jsx',
        'src/pages/lecturer/LecturerStudentGuidancePage.jsx',
        'src/App.jsx',
    ];

    for (const f of files) {
        const fullPath = path.join(root, f);
        assert.ok(fs.existsSync(fullPath), `File ${f} must exist`);
        const buffer = fs.readFileSync(fullPath);
        const hasBOM = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
        assert.equal(hasBOM, false, `File ${f} must NOT have UTF-8 BOM`);
    }
});

test('Rule 2.6: GuidanceFormList and LecturerStudentGuidancePage have no raw emoji or unicode symbols in Button labels', () => {
    const files = [
        'src/components/lecturer/GuidanceFormList.jsx',
        'src/pages/lecturer/LecturerStudentGuidancePage.jsx',
    ];
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕🤖]/;

    for (const f of files) {
        const src = read(f);
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = btnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} button "${label}" contains forbidden raw symbol`);
        }
    }
});

test('registrationQueries exports useRegistrationDetail using queryKeys.registrations.detail and getRegistrationById', () => {
    const src = read('src/queries/registrationQueries.js');
    assert.match(src, /export const useRegistrationDetail\s*=/, 'Must export useRegistrationDetail');
    assert.match(src, /queryKeys\.registrations\.detail\(scope,\s*registrationId\)/, 'Must use queryKeys.registrations.detail(scope, registrationId)');
    assert.match(src, /registrationService\.getRegistrationById\(registrationId\)/, 'Must call registrationService.getRegistrationById');
});

test('App.jsx registers /lecturer/students/:registrationId under the same ProtectedRoute guard as /lecturer/students', () => {
    const src = read('src/App.jsx');
    assert.match(src, /LecturerStudentGuidancePage/, 'App.jsx must import LecturerStudentGuidancePage');

    const guardIdx = src.indexOf('featureKey="lecturer-students"');
    assert.ok(guardIdx !== -1, 'App.jsx must have lecturer-students ProtectedRoute');
    const guardBlock = src.slice(guardIdx, guardIdx + 450);
    assert.match(guardBlock, /path="students"\s+element=\{<LecturerStudentsPage \/>\}/, 'Must keep /lecturer/students route');
    assert.match(guardBlock, /path="students\/:registrationId"\s+element=\{<LecturerStudentGuidancePage \/>\}/, 'Must register students/:registrationId inside the same ProtectedRoute');
});

test('GuidanceFormList renders forms from server without synthesizing BM02-A or role-based mutation buttons', () => {
    const src = read('src/components/lecturer/GuidanceFormList.jsx');

    assert.match(src, /forms\s*=\s*\[\]/, 'Must accept forms prop');
    assert.match(src, /onAction/, 'Must accept onAction prop');
    assert.match(src, /slice\(0,\s*2\)/, 'Must limit direct buttons to at most 2');
    assert.match(src, /slice\(2\)/, 'Must place extra actions in a dropdown menu');
    assert.match(src, /Dropdown/, 'Must use Ant Design Dropdown for overflow actions');
    assert.match(src, /Thao tác khác/, 'Overflow dropdown button must have a clear Vietnamese label');

    // Must not synthesize BM02-A or check user role to invent buttons
    assert.equal(src.includes('user?.role'), false, 'Must not check user.role to synthesize buttons');
    assert.equal(src.includes("code: 'BM02-A'"), false, 'Must not hardcode/synthesize BM02-A row');
});

test('LecturerStudentGuidancePage handles loading, 403, 404, empty, network error retry, and required sections', () => {
    const src = read('src/pages/lecturer/LecturerStudentGuidancePage.jsx');

    // URL param and query
    assert.match(src, /useParams/, 'Must read registrationId from URL via useParams');
    assert.match(src, /useRegistrationDetail/, 'Must load registration via useRegistrationDetail');

    // States: loading, 403, 404, retry
    assert.match(src, /ContentSkeleton/, 'Must render ContentSkeleton while loading');
    assert.match(src, /status="403"/, 'Must handle 403 forbidden state');
    assert.match(src, /status="404"/, 'Must handle 404 not found state');
    assert.match(src, /QueryErrorState/, 'Must render QueryErrorState with retry for network/other errors');

    // Header & back navigation
    assert.match(src, /Quay lại danh sách/, 'Must have Back button labeled Quay lại danh sách');
    assert.match(src, /adjustedTitle/, 'Must prioritize adjustedTitle for official topic title');
    assert.match(src, /Chưa cập nhật/, 'Must display Chưa cập nhật for missing optional fields');

    // Required sections
    assert.match(src, /Việc cần xử lý/, 'Must have Việc cần xử lý section');
    assert.match(src, /Hiện không có việc cần xử lý/, 'Must show empty nextAction message when null');
    assert.match(src, /Quá trình hướng dẫn/, 'Must have Quá trình hướng dẫn section');
    assert.match(src, /Chưa bắt đầu/, 'Must show Chưa bắt đầu for milestones without data');
    assert.match(src, /GuidanceFormList/, 'Must render GuidanceFormList in Biểu mẫu section');
    assert.match(src, /Thông tin sinh viên/, 'Must have Thông tin sinh viên section');
    assert.match(src, /Khóa đào tạo/, 'Must display Khóa đào tạo (academicYear)');
    assert.match(src, /Nơi sinh/, 'Must display Nơi sinh (placeOfBirth)');

    // A4 print modal only mounts on demand
    assert.match(src, /printModal\.open\s*&&/, 'A4 print modal/sheet must only mount when printModal.open is true');
    assert.match(src, /AcademicFormPrintModal/, 'Must reuse AcademicFormPrintModal for on-demand A4 print');

    // BM05 unpublished guard: must not expose defenseResult scores when not published
    assert.match(src, /isPublished/, 'Must check publication status before rendering BM05 print/scores');
});
