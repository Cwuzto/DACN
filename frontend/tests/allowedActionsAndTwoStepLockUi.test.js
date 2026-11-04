import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('evaluationService cleanly integrates lockMemberScoreSheet with idempotency header', () => {
    const serviceSource = read('src/services/evaluationService.js');
    assert.match(serviceSource, /lockMemberScoreSheet\s*:\s*async/);
    assert.match(serviceSource, /\/evaluations\/member-score\/lock/);
    assert.match(serviceSource, /idempotencyConfig/);
});

test('LecturerGradingSheetPage integrates Step 1 lock with confirmation, rubric completion check, and score sheet lock UI', () => {
    const pageSource = read('src/pages/lecturer/LecturerGradingSheetPage.jsx');

    // Button label
    assert.match(pageSource, /Nộp & Khóa phiếu cá nhân/);

    // Confirmation dialog or Popconfirm
    assert.match(pageSource, /Popconfirm|Modal\.confirm/);

    // Disabled condition: already locked or rubric incomplete
    assert.match(pageSource, /scoreLocked/);
    assert.match(pageSource, /isCompleted/);

    // Connected to service call
    assert.match(pageSource, /lockMemberScoreSheet/);

    // Locked status feedback
    assert.match(pageSource, /Đã nộp và khóa phiếu chấm cá nhân/);
});

test('GradingDefensePage integrates Step 2 council score lock with examiner badges and 3-member requirement', () => {
    const pageSource = read('src/pages/admin/GradingDefensePage.jsx');

    // Examiner lock status badge
    assert.match(pageSource, /Đã khóa/);
    assert.match(pageSource, /Chưa khóa/);
    assert.match(pageSource, /scoreLocked/);

    // Summary badge X/3 phiếu đã khóa
    assert.match(pageSource, /\/3 phiếu đã khóa/);

    // Council score lock button label
    assert.match(pageSource, /Khóa sổ điểm hội đồng/);

    // Permission guard
    assert.match(pageSource, /canLockResult/);

    // Requires all 3 member score sheets locked before enabling council lock
    assert.match(pageSource, /Cần đủ 3 thành viên hội đồng nộp & khóa phiếu chấm trước khi khóa sổ điểm hội đồng/);
});

test('StudentDashboardPage connects allowedActions[] contract to withdrawal and title adjustment actions', () => {
    const pageSource = read('src/pages/student/StudentDashboardPage.jsx');

    // Loads allowedActions via registrationService.getAllowedActions
    assert.match(pageSource, /getAllowedActions/);
    assert.match(pageSource, /allowedActions/);

    // Checks CANCEL_REGISTRATION for withdrawal
    assert.match(pageSource, /CANCEL_REGISTRATION/);

    // Checks REQUEST_TITLE_CHANGE for title adjustment
    assert.match(pageSource, /REQUEST_TITLE_CHANGE/);
});

test('LecturerDashboardPage integrates allowedActions contract before activating workflow actions', () => {
    const pageSource = read('src/pages/lecturer/LecturerDashboardPage.jsx');

    // Verifies allowedActions or action capability check is present
    assert.match(pageSource, /allowedActions/);
});
