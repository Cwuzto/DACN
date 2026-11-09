import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('outlineService connects to the /api/outline endpoints', () => {
    const serviceSource = read('frontend/src/services/outlineService.js');

    // submitInitialOutline -> POST /outline/submissions
    assert.match(serviceSource, /submitInitialOutline\s*:\s*async/);
    assert.match(serviceSource, /\/outline\/submissions/);

    // submitResubmission -> POST /outline/resubmissions
    assert.match(serviceSource, /submitResubmission\s*:\s*async/);
    assert.match(serviceSource, /\/outline\/resubmissions/);

    // getMyOutline -> GET /outline/my-outline
    assert.match(serviceSource, /getMyOutline\s*:\s*async/);
    assert.match(serviceSource, /\/outline\/my-outline/);
    assert.match(serviceSource, /idempotencyConfig/);
});

test('StudentDashboardPage connects outline statuses, withdrawable list, and council defense', () => {
    const dashboardSource = read('frontend/src/pages/student/StudentDashboardPage.jsx');

    // outlineService import & consumption
    assert.match(dashboardSource, /import\s+outlineService\s+from\s+['"]\.\.\/\.\.\/services\/outlineService['"]/);
    assert.match(dashboardSource, /outlineService\.getMyOutline/);

    // WITHDRAWABLE_STATUSES includes BM01_RESUBMITTED
    assert.match(dashboardSource, /WITHDRAWABLE_STATUSES[\s\S]*?'BM01_RESUBMITTED'/);

    // Tag for BM01_RESUBMITTED
    assert.match(dashboardSource, /status\s*===\s*['"]BM01_RESUBMITTED['"]/);
    assert.match(dashboardSource, /Đã nộp bản sửa \(Chờ Chủ tịch duyệt\)/);

    // Stepper 6 steps handles BM01_SUBMITTED, BM01_NEEDS_REVISION, BM01_RESUBMITTED
    assert.match(dashboardSource, /Chờ duyệt đề cương|Chờ duyệt/);
    assert.match(dashboardSource, /Cần chỉnh sửa/);
    assert.match(dashboardSource, /Đã nộp bản sửa/);

    // Council defense details (defenseDate, Microsoft Teams, Tham gia Teams, Trực tiếp, location)
    assert.match(dashboardSource, /outlineCouncil/);
    assert.match(dashboardSource, /Phiên Bảo Vệ &amp; Xét Duyệt Đề Cương|Lịch bảo vệ/);
    assert.match(dashboardSource, /Tham gia Teams/);
    assert.match(dashboardSource, /MICROSOFT_TEAMS/);
    assert.match(dashboardSource, /Trực tiếp/);
});

test('SubmissionPage handles task types, single-attempt upload lock, revision feedback, and 409 errors', () => {
    const pageSource = read('frontend/src/pages/student/SubmissionPage.jsx');

    // outlineService import & getMyOutline call
    assert.match(pageSource, /import\s+outlineService\s+from\s+['"]\.\.\/\.\.\/services\/outlineService['"]/);
    assert.match(pageSource, /outlineService\.getMyOutline/);

    // Recognizes task types BM01, BM01_INITIAL_SUBMISSION, BM01_RESUBMISSION
    assert.match(pageSource, /BM01_INITIAL_SUBMISSION/);
    assert.match(pageSource, /BM01_RESUBMISSION/);

    // Single-attempt warning on initial submission
    assert.match(pageSource, /Bản nộp đầu tiên là bản chính thức và không thể thay thế/);

    // BM01_SUBMITTED locks upload & submit button, displays badge
    assert.match(pageSource, /Đã nộp đề cương v1 \(Đang chờ Hội đồng xét duyệt\)/);

    // BM01_NEEDS_REVISION displays outcome, comment, revisionRequirements, and revisionSubmissionDeadline
    assert.match(pageSource, /BM01_NEEDS_REVISION/);
    assert.match(pageSource, /revisionRequirements/);
    assert.match(pageSource, /revisionSubmissionDeadline/);
    assert.match(pageSource, /Nộp lại đề cương v2/);
    assert.match(pageSource, /Chỉ được nộp lại đúng 01 lần duy nhất|duy nhất 01 lần/);

    // BM01_RESUBMITTED locks submission, displays waiting for chair approval badge
    assert.match(pageSource, /BM01_RESUBMITTED/);
    assert.match(pageSource, /Đã nộp bản chỉnh sửa \(Đang chờ Chủ tịch Hội đồng phê duyệt\)/);

    // TERMINATED_BM01 displays red termination alert
    assert.match(pageSource, /TERMINATED_BM01/);
    assert.match(pageSource, /Đề tài đã dừng thực hiện trong đợt này/);

    // 409 Conflict handling for INITIAL_SUBMISSION_ALREADY_USED & RESUBMISSION_ALREADY_USED
    assert.match(pageSource, /INITIAL_SUBMISSION_ALREADY_USED/);
    assert.match(pageSource, /RESUBMISSION_ALREADY_USED/);
    assert.match(pageSource, /outlineService\.submitInitialOutline/);
    assert.match(pageSource, /outlineService\.submitResubmission/);
});
