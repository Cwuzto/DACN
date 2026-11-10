import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('councilService defines all required outline review methods with proper endpoints', () => {
    const serviceSource = read('src/services/councilService.js');

    const expectedMethods = [
        'previewAutoOutlineCouncils',
        'autoAssignOutlineCouncils',
        'publishSchedule',
        'saveDraftResult',
        'completeSecretary',
        'returnResults',
        'publishResults',
        'setRevisionDeadline',
        'reviewResubmission',
        'reopenResults',
        'finalizeOverdue',
    ];

    expectedMethods.forEach((method) => {
        assert.match(
            serviceSource,
            new RegExp(`${method}\\s*:\\s*async`),
            `councilService must export method ${method}`
        );
    });

    // Check endpoint bindings
    assert.match(serviceSource, /\/councils\/auto-assign-outline\/preview/);
    assert.match(serviceSource, /\/councils\/auto-assign-outline/);
    assert.match(serviceSource, /autoAssignOutlineCouncils:\s*async\s*\(\s*semesterId,\s*proposedCouncils\s*\)/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/schedule/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/results\/\$\{registrationId\}/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/results\/secretary-complete/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/results\/return/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/results\/publish/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/revision-deadline/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/resubmissions\/\$\{registrationId\}\/review/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/results\/reopen/);
    assert.match(serviceSource, /\/councils\/\$\{councilId\}\/finalize-resubmissions/);

    // Publish results must use Idempotency-Key
    assert.match(serviceSource, /Idempotency-Key/i);
});

test('CouncilAssignmentPage connects auto-assign outline button, preview modal, dynamic conflict warning and safe reopen modal with 409 BM02 error handling', () => {
    const pageSource = read('src/pages/admin/CouncilAssignmentPage.jsx');
    const cssSource = read('src/index.css');

    // Auto assign outline hook & preview modal
    assert.match(pageSource, /previewAutoOutlineCouncils/);
    assert.match(pageSource, /autoAssignOutlineCouncils/);
    assert.match(pageSource, /Tự động phân công HĐ Đề cương/);
    assert.match(pageSource, /Xem trước Phân công Tự động HĐ Đề cương/);
    assert.match(pageSource, /handleConfirmAutoAssignOutline/);

    // Reopen modal and trigger
    assert.match(pageSource, /handleOpenReopenModal/);
    assert.match(pageSource, /reopenResults/);
    assert.match(pageSource, /Mở khóa kết quả/);

    // 409 BM02 dependency error handling
    assert.match(pageSource, /BM02_DEPENDENCY_EXISTS|blockingRegistrations/);
    assert.match(pageSource, /reopenBlockingList/);
    assert.match(pageSource, /reopenReason/);

    // Council navigation, dynamic conflict warning, and renamed buttons
    assert.match(pageSource, /\/admin\/outline-councils\//);
    assert.match(pageSource, /Đổi thành viên HĐ/);
    assert.match(pageSource, /là GVHD của sinh viên HĐ này/);

    // .council-jury-grid must be 3 columns
    assert.match(cssSource, /\.council-jury-grid[\s\S]*?grid-template-columns:\s*repeat\(3,\s*1fr\)/);
});

test('GradingPage and OutlineCouncilGradingCard provide complete Chairman and Secretary workflows with zero mock data', () => {
    const gradingPageSource = read('src/pages/lecturer/GradingPage.jsx');
    const outlineCardPath = 'src/pages/lecturer/components/OutlineCouncilGradingCard.jsx';

    assert.ok(fs.existsSync(path.join(root, outlineCardPath)), 'OutlineCouncilGradingCard.jsx must exist');
    const outlineCardSource = read(outlineCardPath);

    // GradingPage embeds OutlineCouncilGradingCard on outline tab
    assert.match(gradingPageSource, /OutlineCouncilGradingCard/);
    assert.match(gradingPageSource, /activeStage === 'outline'/);

    // Zero mock data rule: ensure fake hardcoded names are eliminated
    assert.doesNotMatch(gradingPageSource, /PGS\.TS Lê Quang Dũng/);
    assert.doesNotMatch(gradingPageSource, /TS\. Hoàng Văn Tuấn/);
    assert.doesNotMatch(gradingPageSource, /TS\. Trần Minh Khoa/);
    assert.doesNotMatch(outlineCardSource, /PGS\.TS Lê Quang Dũng/);

    // Batch status badges
    assert.match(outlineCardSource, /DRAFT/);
    assert.match(outlineCardSource, /PENDING_CHAIR/);
    assert.match(outlineCardSource, /PUBLISHED/);
    assert.match(outlineCardSource, /REOPENED/);

    // Chairman controls
    assert.match(outlineCardSource, /publishSchedule/);
    assert.match(outlineCardSource, /setRevisionDeadline/);
    assert.match(outlineCardSource, /publishResults/);
    assert.match(outlineCardSource, /returnResults/);
    assert.match(outlineCardSource, /finalizeOverdue/);
    assert.match(outlineCardSource, /reviewResubmission/);

    // Secretary controls and evaluation matrix
    assert.match(outlineCardSource, /saveDraftResult/);
    assert.match(outlineCardSource, /completeSecretary/);
    assert.match(outlineCardSource, /initialOutcome/);
    assert.match(outlineCardSource, /attendanceStatus/);
    assert.match(outlineCardSource, /revisionRequirements/);
    assert.match(outlineCardSource, /REVISION_REQUIRED/);

    // Matrix instant validation: REVISION_REQUIRED requires revisionRequirements, FAIL requires comment
    assert.match(outlineCardSource, /isMissingRevisionReq|Bắt buộc.*yêu cầu sửa đổi/i);
    assert.match(outlineCardSource, /isMissingFailComment|Bắt buộc.*nhận xét/i);
});
