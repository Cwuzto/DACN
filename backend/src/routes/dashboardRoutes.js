const express = require('express');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// Yêu cầu xác thực chung cho tất cả route
router.use(authenticate);

router.get(
    '/lecturer',
    authorizePermission(
        PERMISSIONS.VIEW_MY_TOPICS,
        PERMISSIONS.VIEW_MENTOR_STUDENTS,
        PERMISSIONS.VIEW_MENTORED_STUDENTS,
        PERMISSIONS.REPORT_VIEW,
    ),
    dashboardController.getLecturerDashboard,
);

// API dành riêng cho Sinh viên
router.get(
    '/student',
    authorizePermission(
        PERMISSIONS.VIEW_MY_REGISTRATION,
        PERMISSIONS.VIEW_MY_SUBMISSIONS,
        PERMISSIONS.VIEW_MY_GRADES,
    ),
    dashboardController.getStudentDashboard,
);

router.use(authorizePermission(PERMISSIONS.REPORT_VIEW));

router.get(['/stats', '/summary'], dashboardController.getGeneralStats);
router.get('/semester-overview', dashboardController.getSemesterOverview);
router.get('/semesters', dashboardController.getSemesterStats);
router.get('/scores', dashboardController.getScoreDistribution);
router.get('/activities', dashboardController.getRecentActivities);

module.exports = router;
