const express = require('express');
const { authenticate, authorize, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// Yêu cầu xác thực chung cho tất cả route
router.use(authenticate);

router.get('/lecturer', authorize('LECTURER'), dashboardController.getLecturerDashboard);

// API dành riêng cho Sinh viên
router.get('/student', authorize('STUDENT'), dashboardController.getStudentDashboard);

router.use(authorizePermission(PERMISSIONS.REPORT_VIEW));

router.get('/stats', dashboardController.getGeneralStats);
router.get('/semester-overview', dashboardController.getSemesterOverview);
router.get('/semesters', dashboardController.getSemesterStats);
router.get('/scores', dashboardController.getScoreDistribution);
router.get('/activities', dashboardController.getRecentActivities);

module.exports = router;
