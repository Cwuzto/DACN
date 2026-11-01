const mockPrisma = {
    user: { findUnique: jest.fn() },
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

jest.mock('../../src/controllers/announcementController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        getAnnouncements: ok,
        getAnnouncementById: ok,
        createAnnouncement: ok,
        updateAnnouncement: ok,
        deleteAnnouncement: ok,
    };
});
jest.mock('../../src/controllers/userController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        getPublicLecturers: ok,
        downloadUserTemplate: ok,
        importUsersExcel: ok,
        exportUsersExcel: ok,
        getAllUsers: ok,
        createUser: ok,
        updateUser: ok,
        deleteUser: ok,
        getUserPermissions: ok,
        updateUserPermissionGroups: ok,
        toggleActive: ok,
        resetPassword: ok,
    };
});
jest.mock('../../src/controllers/semesterController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        getAllSemesters: ok,
        getSemesterById: ok,
        createSemester: ok,
        updateSemester: ok,
        toggleSemesterRegistration: ok,
        issuePeriodDecision: ok,
        amendAssignmentDecision: ok,
        deleteSemester: ok,
    };
});
jest.mock('../../src/controllers/projectEnrollmentController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        listProjectCatalogs: ok,
        listStudentProjectEnrollments: ok,
        bulkUpsertStudentProjectEnrollments: ok,
        deleteStudentProjectEnrollment: ok,
        downloadEnrollmentTemplate: ok,
        importEnrollmentsExcel: ok,
        exportEnrollmentsExcel: ok,
    };
});
jest.mock('../../src/controllers/dashboardController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        getLecturerDashboard: ok,
        getStudentDashboard: ok,
        getGeneralStats: ok,
        getSemesterOverview: ok,
        getSemesterStats: ok,
        getScoreDistribution: ok,
        getRecentActivities: ok,
    };
});
jest.mock('../../src/controllers/notificationController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        getMyNotifications: ok,
        markNotificationRead: ok,
        markAllNotificationsRead: ok,
        deleteMyNotification: ok,
        getNotificationHistory: ok,
        getNotificationTemplates: ok,
        updateNotificationTemplate: ok,
        sendBroadcastNotification: ok,
    };
});
jest.mock('../../src/controllers/rubricController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        getActiveRubric: ok,
        checkEditStatus: ok,
        getRubrics: ok,
        getRubricById: ok,
        createRubric: ok,
        updateRubric: ok,
        activateRubric: ok,
        deleteRubric: ok,
    };
});
jest.mock('../../src/controllers/manualReviewController', () => {
    const ok = jest.fn((_req, res) => res.json({ success: true }));
    return {
        listManualReviewCases: ok,
        getManualReviewCaseDetail: ok,
        resolveManualReviewCase: ok,
    };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const { PERMISSIONS } = require('../../src/constants/permissions');

let allowedPermissions = [];

const buildAdmin = (id, permissions) => ({
    id,
    role: 'ADMIN',
    email: `admin${id}@test.vn`,
    fullName: `Admin ${id}`,
    code: `ADMIN${id}`,
    isActive: true,
    permissionGroups: permissions.length === 0 ? [] : [{
        permissionGroup: {
            code: 'TEST_GROUP',
            permissions: permissions.map((code) => ({ permission: { code } })),
        },
    }],
});

describe('Integration - platform capability authorization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        allowedPermissions = [];
        process.env.JWT_SECRET = 'platform-rbac-secret';
        jwt.verify.mockImplementation((token) => {
            if (token === 'no-permission-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'allowed-token') return { userId: 2, role: 'ADMIN' };
            throw new Error('invalid token');
        });
        mockPrisma.user.findUnique.mockImplementation(async ({ where }) => (
            where.id === 2 ? buildAdmin(2, allowedPermissions) : buildAdmin(1, [])
        ));
    });

    const cases = [
        ['post', '/api/announcements', PERMISSIONS.PUBLIC_ANNOUNCEMENT_MANAGE, { title: 'Thông báo', content: 'Nội dung' }],
        ['get', '/api/users', PERMISSIONS.USER_MANAGE, null],
        ['get', '/api/users/template', PERMISSIONS.USER_IMPORT, null],
        ['get', '/api/users/1/permissions', PERMISSIONS.PERMISSION_GROUP_MANAGE, null],
        ['post', '/api/semesters', PERMISSIONS.SEMESTER_MANAGE, { name: 'HK1' }],
        ['post', '/api/semesters/1/issue-decision', PERMISSIONS.PROJECT_ASSIGNMENT_PUBLISH, null],
        ['get', '/api/project-enrollments/catalogs', PERMISSIONS.PROJECT_CATALOG_MANAGE, null],
        ['get', '/api/project-enrollments', PERMISSIONS.ENROLLMENT_MANAGE, null],
        ['get', '/api/dashboard/stats', PERMISSIONS.REPORT_VIEW, null],
        ['get', '/api/notifications/history', PERMISSIONS.NOTIFICATION_MANAGE, null],
        ['get', '/api/rubrics/check-editable', PERMISSIONS.RUBRIC_MANAGE, null],
        ['get', '/api/manual-review-cases', PERMISSIONS.LEGACY_REVIEW_MANAGE, null],
    ];

    test.each(cases)('%s %s denies ADMIN without %s and allows the capability', async (method, path, permission, body) => {
        const deniedRequest = request(app)[method](path)
            .set('Authorization', 'Bearer no-permission-token');
        if (body) deniedRequest.send(body);
        const denied = await deniedRequest;
        expect(denied.status).toBe(403);

        allowedPermissions = [permission];
        const allowedRequest = request(app)[method](path)
            .set('Authorization', 'Bearer allowed-token');
        if (body) allowedRequest.send(body);
        const allowed = await allowedRequest;
        expect(allowed.status).toBe(200);
    });

    test('platform endpoint returns 401 without authentication', async () => {
        const response = await request(app).get('/api/dashboard/stats');
        expect(response.status).toBe(401);
    });
});
