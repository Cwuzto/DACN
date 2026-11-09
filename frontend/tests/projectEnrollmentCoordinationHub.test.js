import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import lecturerAssignmentService from '../src/services/lecturerAssignmentService.js';
import api from '../src/services/api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

// ==========================================
// 1. SERVICE CONTRACTS & API CALLS
// ==========================================
test('lecturerAssignmentService defines all required methods for coordination hub', () => {
    assert.equal(typeof lecturerAssignmentService.getAll, 'function');
    assert.equal(typeof lecturerAssignmentService.getOverview, 'function');
    assert.equal(typeof lecturerAssignmentService.create, 'function');
    assert.equal(typeof lecturerAssignmentService.update, 'function');
    assert.equal(typeof lecturerAssignmentService.deleteAssignment, 'function');
    assert.equal(typeof lecturerAssignmentService.bulkUpsert, 'function');
});

test('lecturerAssignmentService.getAll calls GET /lecturer-assignments with query params', async () => {
    let capturedUrl = null;
    let capturedConfig = null;
    const originalGet = api.get;

    api.get = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return { success: true, data: [] };
    };

    try {
        const res = await lecturerAssignmentService.getAll({
            semesterId: 101,
            projectCatalogId: 5,
        });

        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/lecturer-assignments');
        assert.deepEqual(capturedConfig.params, {
            semesterId: 101,
            projectCatalogId: 5,
        });
    } finally {
        api.get = originalGet;
    }
});

test('lecturerAssignmentService.getOverview calls GET /lecturer-assignments/overview', async () => {
    let capturedUrl = null;
    let capturedConfig = null;
    const originalGet = api.get;

    api.get = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return { success: true, data: { totalEnrolledStudents: 50 } };
    };

    try {
        const res = await lecturerAssignmentService.getOverview({
            semesterId: 202,
        });

        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/lecturer-assignments/overview');
        assert.deepEqual(capturedConfig.params, { semesterId: 202 });
    } finally {
        api.get = originalGet;
    }
});

test('lecturerAssignmentService.create calls POST /lecturer-assignments', async () => {
    let capturedUrl = null;
    let capturedPayload = null;
    const originalPost = api.post;

    api.post = async (url, data) => {
        capturedUrl = url;
        capturedPayload = data;
        return { success: true, data: { id: 1 } };
    };

    try {
        const payload = {
            lecturerId: 12,
            semesterId: 202,
            projectCatalogId: 3,
            plannedQuota: 8,
        };
        const res = await lecturerAssignmentService.create(payload);

        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/lecturer-assignments');
        assert.deepEqual(capturedPayload, payload);
    } finally {
        api.post = originalPost;
    }
});

test('lecturerAssignmentService.update calls PUT /lecturer-assignments/:id', async () => {
    let capturedUrl = null;
    let capturedPayload = null;
    const originalPut = api.put;

    api.put = async (url, data) => {
        capturedUrl = url;
        capturedPayload = data;
        return { success: true, data: { id: 99, plannedQuota: 7 } };
    };

    try {
        const res = await lecturerAssignmentService.update(99, {
            plannedQuota: 7,
            status: 'ACTIVE',
        });

        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/lecturer-assignments/99');
        assert.deepEqual(capturedPayload, { plannedQuota: 7, status: 'ACTIVE' });
    } finally {
        api.put = originalPut;
    }
});

test('lecturerAssignmentService.deleteAssignment passes closeIfActive query parameter', async () => {
    let capturedUrl = null;
    let capturedConfig = null;
    const originalDelete = api.delete;

    api.delete = async (url, config) => {
        capturedUrl = url;
        capturedConfig = config;
        return { success: true, message: 'Đã đóng phân công' };
    };

    try {
        const res = await lecturerAssignmentService.deleteAssignment(45, {
            closeIfActive: true,
        });

        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/lecturer-assignments/45');
        assert.deepEqual(capturedConfig.params, { closeIfActive: true });
    } finally {
        api.delete = originalDelete;
    }
});

test('lecturerAssignmentService.bulkUpsert formats items into payload object', async () => {
    let capturedUrl = null;
    let capturedPayload = null;
    const originalPost = api.post;

    api.post = async (url, data) => {
        capturedUrl = url;
        capturedPayload = data;
        return { success: true, data: { created: 2, updated: 1 } };
    };

    try {
        const rows = [
            { lecturerId: 1, semesterId: 10, projectCatalogId: 1, plannedQuota: 10 },
            { lecturerId: 2, semesterId: 10, projectCatalogId: 1, plannedQuota: 6 },
        ];
        const res = await lecturerAssignmentService.bulkUpsert(rows);

        assert.equal(res.success, true);
        assert.equal(capturedUrl, '/lecturer-assignments/bulk-upsert');
        assert.deepEqual(capturedPayload, { items: rows });
    } finally {
        api.post = originalPost;
    }
});

// ==========================================
// 2. ROUTE CONTRACTS & DEEP-LINKING
// ==========================================
test('ROUTES and buildRoundCoordinationUrl contract in src/routes/index.jsx', () => {
    const routeSource = read('src/routes/index.jsx');

    assert.match(routeSource, /PROJECT_ENROLLMENTS:\s*['"]\/admin\/project-enrollments['"]/);
    assert.match(routeSource, /PROJECT_ROUND_COORDINATION:\s*['"]\/admin\/project-rounds\/:roundId\/coordination['"]/);
    assert.match(routeSource, /buildRoundCoordinationUrl/);
    assert.match(routeSource, /tab/);
    assert.match(routeSource, /projectCatalogId/);
});

// ==========================================
// 3. PAGE & COMPONENT CONTRACTS (Phương án 1+)
// ==========================================
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
