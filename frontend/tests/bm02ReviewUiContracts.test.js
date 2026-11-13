import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('registrationService cleanly exports both reviewBM02 and reviewBM02Submission', () => {
    const serviceSource = read('src/services/registrationService.js');
    assert.match(serviceSource, /reviewBM02\s*:\s*async/);
    assert.match(serviceSource, /reviewBM02Submission\s*:\s*async/);
});

test('BM02ReviewDrawer strictly renders ONLY APPROVE and RETURN_FOR_REVISION without EXCEPTION_REVIEW', () => {
    const drawerPath = 'src/components/admin/BM02ReviewDrawer.jsx';
    assert.ok(fs.existsSync(path.join(root, drawerPath)), 'BM02ReviewDrawer.jsx must exist');
    const drawerSource = read(drawerPath);

    // Must support APPROVE and RETURN_FOR_REVISION
    assert.match(drawerSource, /APPROVE/);
    assert.match(drawerSource, /RETURN_FOR_REVISION/);

    // Zero bypass: EXCEPTION_REVIEW must NOT exist in the drawer under any circumstances
    assert.doesNotMatch(drawerSource, /EXCEPTION_REVIEW/, 'EXCEPTION_REVIEW must be removed and never rendered');

    // Validation: RETURN_FOR_REVISION requires issues / feedback notes
    assert.match(drawerSource, /issues|feedback|reason/i);
    assert.match(drawerSource, /required/);

    // Natural Vietnamese copy: ensure English technical brackets are removed from visible labels
    assert.doesNotMatch(drawerSource, /Phê duyệt\s*\(APPROVE\)/);
    assert.doesNotMatch(drawerSource, /Yêu cầu chỉnh sửa\s*\(RETURN_FOR_REVISION\)/);

    // Must connect to registrationService review method
    assert.match(drawerSource, /reviewBM02|reviewBM02Submission/);
});

test('ProjectPeriodPage embeds BM02 review queue with student, topic, mentor, attempt details and review action', () => {
    const pageSource = read('src/pages/admin/ProjectPeriodPage.jsx');

    // Drawer must be imported and rendered
    assert.match(pageSource, /BM02ReviewDrawer/);

    // Queue must handle BM02_SUBMITTED and BM02_RESUBMITTED
    assert.match(pageSource, /BM02_SUBMITTED/);
    assert.match(pageSource, /BM02_RESUBMITTED/);

    // Queue displays student, topic, mentor, attempt info
    assert.match(pageSource, /fullName|student/);
    assert.match(pageSource, /topic/);
    assert.match(pageSource, /mentor/);
    assert.match(pageSource, /attemptNo|Lần nộp|Lần/i);

    // Review trigger button / action exists
    assert.match(pageSource, /Thẩm định BM02|Thẩm định đơn BM02|Thẩm định đề cương/);

    // Zero bypass in queue: EXCEPTION_REVIEW must not be a review action
    assert.doesNotMatch(pageSource, /action:\s*['"]EXCEPTION_REVIEW['"]/);

    // Regression check: Status column must specify dataIndex: 'status' to prevent object render crashes
    assert.match(pageSource, /dataIndex:\s*['"]status['"]/);

    // Must fetch institute-wide registrations so Viện Trưởng and Admin both see the BM02 queue
    assert.match(pageSource, /usePeriodRegistrations\(scope, \s*\{\s*asInstituteDirector:\s*['"]true['"]\s*\}\s*\)/);
});

test('ProjectPeriodPage provides decision amendment creation modal calling semesterService', () => {
    const pageSource = read('src/pages/admin/ProjectPeriodPage.jsx');

    // Must connect to createDecisionAmendment
    assert.match(pageSource, /createDecisionAmendment/);

    // Must provide inputs for amendmentNumber, reason, and changes
    assert.match(pageSource, /amendmentNumber/);
    assert.match(pageSource, /reason/);
    assert.match(pageSource, /changes|adjustedTitle|note/);

    // Action button to open amendment modal
    assert.match(pageSource, /Điều chỉnh QĐ|Ban hành QĐ Điều chỉnh|Quyết định Điều chỉnh/i);
});
