import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('CouncilAssignmentPage connects auto-assign outline API and safe reopen modal', () => {
    const pageSource = read('src/pages/admin/CouncilAssignmentPage.jsx');

    // Auto assignment for outline councils
    assert.match(pageSource, /autoAssignOutlineCouncils/);
    assert.match(pageSource, /Tự động phân công HĐ Đề cương/);

    // Reopen modal and action triggers
    assert.match(pageSource, /handleOpenReopenModal/);
    assert.match(pageSource, /reopenResults/);
    assert.match(pageSource, /Mở khóa kết quả/);

    // Conflict 409 BM02 dependency error handling
    assert.match(pageSource, /BM02_DEPENDENCY_EXISTS|blockingRegistrations/);
    assert.match(pageSource, /reopenBlockingList/);
    assert.match(pageSource, /reopenReason/);
});

test('CouncilAssignmentPage renders root without wrapping disabled queries and handles empty semester state', () => {
    const pageSource = read('src/pages/admin/CouncilAssignmentPage.jsx');

    // Must not wrap root in registrationsQuery or councilsQuery QueryPanel (which return null when enabled: false)
    assert.doesNotMatch(pageSource, /return\s*\(\s*<QueryPanel query=\{registrationsQuery\}/);
    assert.doesNotMatch(pageSource, /return\s*\(\s*<QueryPanel query=\{semestersQuery\}><QueryPanel query=\{councilsQuery\}/);

    // Must handle empty semesters gracefully with informative alert
    assert.match(pageSource, /semesters\.length === 0 && !semestersQuery\.isPending/);
    assert.match(pageSource, /Chưa có đợt đồ án nào/);
    assert.match(pageSource, /\/admin\/project-periods/);
});

test('CouncilAssignmentPage supports configurable target size for both Outline and Defense councils, and ProjectPeriodPage removes target size setup', () => {
    const pageSource = read('src/pages/admin/CouncilAssignmentPage.jsx');
    const periodPageSource = read('src/pages/admin/ProjectPeriodPage.jsx');

    // CouncilAssignmentPage has target size controls
    assert.match(pageSource, /outlineTargetSize/);
    assert.match(pageSource, /defenseTargetSize/);
    assert.match(pageSource, /Quy mô mục tiêu:/);
    assert.match(pageSource, /estimatedCouncilsForPhase/);
    assert.match(pageSource, /previewAutoOutlineCouncils/);

    // Outline preview modal supports inline target size adjustment
    assert.match(pageSource, /Đổi quy mô:/);

    // Defense preview modal supports target size with estimate
    assert.match(pageSource, /name="targetSize"/);
    assert.match(pageSource, /Ước tính cần lập/);

    // ProjectPeriodPage must not contain target size form item
    assert.doesNotMatch(periodPageSource, /name="defenseCouncilTargetSize"/);
    assert.doesNotMatch(periodPageSource, /Quy mô mục tiêu HĐ bảo vệ/);
});
