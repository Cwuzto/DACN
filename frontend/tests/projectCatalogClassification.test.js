import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('UTF-8 without BOM verification (Rule 2.4)', () => {
    const files = [
        'src/pages/admin/TopicManagementPage.jsx',
        'src/pages/lecturer/TopicManagementPage.jsx',
        'src/pages/student/TopicListPage.jsx',
        'src/pages/lecturer/ProgressTrackingPage.jsx',
        'src/pages/admin/ProjectOversightPage.jsx',
        'src/pages/admin/ProjectEnrollmentPage.jsx',
        'src/components/coordination/LecturerAssignmentTab.jsx',
        'src/components/common/ExcelImportModal.jsx',
    ];
    for (const rel of files) {
        const full = path.join(root, rel);
        const buf = fs.readFileSync(full);
        assert.ok(
            buf.length < 3 || buf[0] !== 0xef || buf[1] !== 0xbb || buf[2] !== 0xbf,
            `${rel} must not contain UTF-8 BOM`
        );
    }
});

test('Frontend pages implement "Loại đồ án - Đợt đồ án" dynamic classification', () => {
    // 1. TopicManagementPage (Admin)
    const adminTopicMgmt = read('src/pages/admin/TopicManagementPage.jsx');
    assert.ok(adminTopicMgmt.includes('useProjectCatalogs'), 'Admin TopicManagementPage must use useProjectCatalogs');
    assert.ok(adminTopicMgmt.includes('catalogFilter'), 'Admin TopicManagementPage must have catalogFilter');
    assert.ok(adminTopicMgmt.includes('Loại đồ án'), 'Admin TopicManagementPage must display Loại đồ án');

    // 2. TopicManagementPage (Lecturer)
    const lecturerTopicMgmt = read('src/pages/lecturer/TopicManagementPage.jsx');
    assert.ok(lecturerTopicMgmt.includes('useProjectCatalogs'), 'Lecturer TopicManagementPage must use useProjectCatalogs');
    assert.ok(lecturerTopicMgmt.includes('filterCatalog'), 'Lecturer TopicManagementPage must have filterCatalog');
    assert.ok(lecturerTopicMgmt.includes('Loại đồ án:'), 'Lecturer TopicManagementPage must display Loại đồ án label');
    assert.ok(lecturerTopicMgmt.includes('projectCatalogId'), 'Lecturer TopicManagementPage must include projectCatalogId');

    // 3. TopicListPage (Student)
    const studentTopicList = read('src/pages/student/TopicListPage.jsx');
    assert.ok(studentTopicList.includes('useProjectCatalogs'), 'Student TopicListPage must use useProjectCatalogs');
    assert.ok(studentTopicList.includes('selectedProjectCatalogId'), 'Student TopicListPage must have selectedProjectCatalogId');
    assert.ok(studentTopicList.includes('Tất cả loại đồ án'), 'Student TopicListPage must have Tất cả loại đồ án option');
    assert.ok(studentTopicList.includes('Đợt đồ án (Học kỳ)'), 'Student TopicListPage must have Đợt đồ án (Học kỳ)');

    // 4. ProgressTrackingPage (Lecturer)
    const progressTracking = read('src/pages/lecturer/ProgressTrackingPage.jsx');
    assert.ok(progressTracking.includes('useProjectCatalogs'), 'ProgressTrackingPage must use useProjectCatalogs');
    assert.ok(progressTracking.includes('filterCatalog'), 'ProgressTrackingPage must have filterCatalog');
    assert.ok(progressTracking.includes('filterSemesterId'), 'ProgressTrackingPage must have filterSemesterId');
    assert.ok(progressTracking.includes('Tất cả loại'), 'ProgressTrackingPage must have Tất cả loại');
    assert.ok(progressTracking.includes('Tất cả đợt'), 'ProgressTrackingPage must have Tất cả đợt');

    // 5. ProjectEnrollmentPage & LecturerAssignmentTab should not use misleading 'Tên đồ án'
    const projectEnrollment = read('src/pages/admin/ProjectEnrollmentPage.jsx');
    assert.ok(!projectEnrollment.includes("title: 'Tên đồ án'"), 'ProjectEnrollmentPage must not have title: Tên đồ án');
    assert.ok(projectEnrollment.includes("title: 'Loại đồ án'"), 'ProjectEnrollmentPage must have title: Loại đồ án');

    const lecturerAssignment = read('src/components/coordination/LecturerAssignmentTab.jsx');
    assert.ok(!lecturerAssignment.includes('label="Tên đồ án"'), 'LecturerAssignmentTab must not have label="Tên đồ án"');
    assert.ok(lecturerAssignment.includes('label="Loại đồ án"'), 'LecturerAssignmentTab must have label="Loại đồ án"');
});
