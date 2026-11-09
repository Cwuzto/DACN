import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('ProjectEnrollmentPage integrates unified 3-tab hub with deep linking and RBAC', () => {
    const pageSource = read('src/pages/admin/ProjectEnrollmentPage.jsx');

    // Checks for deep-linking hooks: useParams and useSearchParams
    assert.match(pageSource, /useParams/);
    assert.match(pageSource, /useSearchParams/);
    assert.match(pageSource, /roundId/);

    // Checks for tab keys: overview, students, lecturers
    assert.match(pageSource, /key:\s*['"]overview['"]/);
    assert.match(pageSource, /key:\s*['"]students['"]/);
    assert.match(pageSource, /key:\s*['"]lecturers['"]/);

    // Embeds CoordinationOverviewTab and LecturerAssignmentTab
    assert.match(pageSource, /<CoordinationOverviewTab/);
    assert.match(pageSource, /<LecturerAssignmentTab/);

    // Tab-level RBAC capabilities
    assert.match(pageSource, /PERMISSION_ASSIGN_ACADEMIC/);
    assert.match(pageSource, /MENTOR_ASSIGN/);
    assert.match(pageSource, /ENROLLMENT_MANAGE/);
});

test('CoordinationOverviewTab renders period metadata, 3 metric cards, and overload alerts', () => {
    const overviewSource = read('src/components/coordination/CoordinationOverviewTab.jsx');

    // Period metadata
    assert.match(overviewSource, /ĐỢT ĐỒ ÁN ĐƯỢC CHỌN|activeSemester/);
    assert.match(overviewSource, /CalendarOutlined/);

    // 3 Key Metrics
    assert.match(overviewSource, /Sinh viên đợt này/);
    assert.match(overviewSource, /Giảng viên & Chỉ tiêu/);
    assert.match(overviewSource, /Tỷ lệ Lấp đầy Tải/);
    assert.match(overviewSource, /capacityUtilization/);
    assert.match(overviewSource, /Progress/);

    // Overload Warning alerts
    assert.match(overviewSource, /Cảnh báo quá tải tải đỉnh/);
    assert.match(overviewSource, /peakConcurrentLoad/);
    assert.match(overviewSource, /CRITICAL|chạm trần 10\/10/i);
});

test('LecturerAssignmentTab renders assignment table, editable quota, and toolbars', () => {
    const tabSource = read('src/components/coordination/LecturerAssignmentTab.jsx');

    // Table Columns
    assert.match(tabSource, /plannedQuota/);
    assert.match(tabSource, /currentRoundLoad/);
    assert.match(tabSource, /activeTodayLoad/);
    assert.match(tabSource, /peakConcurrentLoad/);
    assert.match(tabSource, /peakInterval/);

    // Overload thresholds (8 and 10)
    assert.match(tabSource, />=\s*10/);
    assert.match(tabSource, />=\s*8/);

    // Buttons & Modals
    assert.match(tabSource, /Phân công Giảng viên/);
    assert.match(tabSource, /Import Excel GVHD/);
    assert.match(tabSource, /Sao chép phân công/);

    // Delete / Close logic
    assert.match(tabSource, /closeIfActive/);
});
