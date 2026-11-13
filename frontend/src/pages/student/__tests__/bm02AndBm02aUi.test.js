import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Task 4: bm02aService exports all required methods for BM02-A and Appendices', () => {
    const serviceSource = read('frontend/src/services/bm02aService.js');

    // BM02-A Methods
    assert.match(serviceSource, /createRequest\s*:\s*async/);
    assert.match(serviceSource, /\/bm02a\/requests/);
    assert.match(serviceSource, /studentSignSubmit\s*:\s*async/);
    assert.match(serviceSource, /\/student-sign-submit/);
    assert.match(serviceSource, /advisorSign\s*:\s*async/);
    assert.match(serviceSource, /\/advisor-sign/);
    assert.match(serviceSource, /departmentSign\s*:\s*async/);
    assert.match(serviceSource, /\/department-sign/);
    assert.match(serviceSource, /returnRequest\s*:\s*async/);
    assert.match(serviceSource, /\/return/);
    assert.match(serviceSource, /reviseRequest\s*:\s*async/);
    assert.match(serviceSource, /\/revise/);
    assert.match(serviceSource, /getRequestsByRegistration\s*:\s*async/);
    assert.match(serviceSource, /\/bm02a\/registrations/);
    assert.match(serviceSource, /getPendingQueue\s*:\s*async/);
    assert.match(serviceSource, /\/bm02a\/pending/);

    // Appendix Methods
    assert.match(serviceSource, /createAppendix\s*:\s*async/);
    assert.match(serviceSource, /\/title-adjustment-appendices/);
    assert.match(serviceSource, /updateAppendixItems\s*:\s*async/);
    assert.match(serviceSource, /\/items/);
    assert.match(serviceSource, /issueAppendix\s*:\s*async/);
    assert.match(serviceSource, /\/issue/);
    assert.match(serviceSource, /getAppendices\s*:\s*async/);
    assert.match(serviceSource, /\/title-adjustment-appendices\/decisions/);
});

test('Task 4: HybridBMFormModal handles BM02 title refinement and conditional titleChangeReason', () => {
    const formSource = read('frontend/src/components/forms/HybridBMFormModal.jsx');

    // Read-only approved title snapshot
    assert.match(formSource, /bm01ApprovedTitle/);

    // Editable proposed title
    assert.match(formSource, /bm02ProposedTitle/);

    // Conditional reason for title change
    assert.match(formSource, /titleChangeReason/);

    // File upload requirement
    assert.match(formSource, /fileRequired/);
    assert.match(formSource, /fileHint/);
});

test('Task 4: TitleAdjustmentModal renders BM02-A 3-signature stepper, personal snapshot, 168h countdown and version v1/v2', () => {
    const modalSource = read('frontend/src/components/student/TitleAdjustmentModal.jsx');

    // Title and Form Header
    assert.match(modalSource, /Phiếu đề nghị điều chỉnh tên đề tài \(BM02-A\)|BM02-A/);

    // 3-signature stepper
    assert.match(modalSource, /Sinh viên|Chữ ký Sinh viên/);
    assert.match(modalSource, /GVHD|Chữ ký GVHD/);
    assert.match(modalSource, /Phụ trách bộ môn|Chữ ký Phụ trách bộ môn/);

    // Student personal snapshot fields
    assert.match(modalSource, /fullName|Họ và tên/);
    assert.match(modalSource, /studentCode|Mã sinh viên|MSSV/);
    assert.match(modalSource, /className|Lớp/);

    // 168h window calculation from decisionPublishedAt
    assert.match(modalSource, /decisionPublishedAt/);
    assert.match(modalSource, /168|7\s*,\s*['"]day['"]/);

    // v1/v2 badge and RETURNED_FOR_CORRECTION single-revision handling
    assert.match(modalSource, /versionNumber|Phiên bản|v1|v2/);
    assert.match(modalSource, /RETURNED_FOR_CORRECTION/);
    assert.match(modalSource, /bm02aService/);
});

test('Task 4: TopicApprovalPage integrates Tab "Duyệt phiếu đổi tên BM02-A" with advisor and department head actions', () => {
    const pageSource = read('frontend/src/pages/lecturer/TopicApprovalPage.jsx');

    // Tab for BM02-A
    assert.match(pageSource, /Duyệt phiếu đổi tên BM02-A/);

    // Connected to bm02aService
    assert.match(pageSource, /bm02aService/);
    assert.match(pageSource, /advisorSign|departmentSign|returnRequest/);

    // Zero raw emoji/symbol in button labels (Rule 2.6)
    assert.doesNotMatch(pageSource, /<Button[^>]*>[^<]*[←→+🤖📋✓✏️👥🗑️🔓▾▴↗✕]/);
    assert.doesNotMatch(pageSource, /<button[^>]*>[^<]*[←→+🤖📋✓✏️👥🗑️🔓▾▴↗✕]/);
});

test('Task 4: ProjectPeriodPage integrates Decision Publish control and batch Title Adjustment Appendix manager', () => {
    const pageSource = read('frontend/src/pages/admin/ProjectPeriodPage.jsx');

    // Decision Publish control
    assert.match(pageSource, /decisionPublishedAt/);
    assert.match(pageSource, /publishTopicDecision|publishDecision/);

    // Appendix manager
    assert.match(pageSource, /Phụ lục điều chỉnh tên đề tài|Phụ lục điều chỉnh/);
    assert.match(pageSource, /createAppendix|issueAppendix|updateAppendixItems/);
    assert.match(pageSource, /useBm02aMutation/);
});

test('Task 4: BM02ReviewDrawer displays bm01ApprovedTitle, bm02ProposedTitle, and titleChangeReason', () => {
    const drawerSource = read('frontend/src/components/admin/BM02ReviewDrawer.jsx');

    assert.match(drawerSource, /bm01ApprovedTitle/);
    assert.match(drawerSource, /bm02ProposedTitle/);
    assert.match(drawerSource, /titleChangeReason/);
});

test('Task 4: Strict Button standards (Rule 2.6) in all modified frontend components', () => {
    const files = [
        'frontend/src/components/forms/HybridBMFormModal.jsx',
        'frontend/src/components/student/TitleAdjustmentModal.jsx',
        'frontend/src/pages/student/SubmissionPage.jsx',
        'frontend/src/pages/student/StudentDashboardPage.jsx',
        'frontend/src/pages/lecturer/TopicApprovalPage.jsx',
        'frontend/src/pages/admin/ProjectPeriodPage.jsx',
        'frontend/src/components/admin/BM02ReviewDrawer.jsx',
    ];

    for (const file of files) {
        const content = read(file);
        // Match button opening and closing tag pairs
        const buttonRegex = /<(?:Button|button)\b[\s\S]*?>([\s\S]*?)<\/(?:Button|button)>/g;
        let match;
        while ((match = buttonRegex.exec(content)) !== null) {
            // Strip nested JSX tags to extract text label
            const textOnly = match[1].replace(/<[^>]+>/g, '').trim();
            if (textOnly) {
                assert.ok(
                    !/[←→🤖📋✓✏️👥🗑️🔓▾▴↗✕]/.test(textOnly) && !/^\s*\+\s*/.test(textOnly),
                    `File ${file} has button with raw symbol/emoji in text: "${textOnly}"`
                );
            }
        }
    }
});
