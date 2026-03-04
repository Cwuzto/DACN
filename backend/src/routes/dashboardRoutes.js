const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// Yêu cầu xác thực chung cho tất cả route
router.use(authenticate);

// API dành riêng cho Giảng viên (và Admin)
router.get('/lecturer', authorize('LECTURER', 'ADMIN'), dashboardController.getLecturerDashboard);

// API dành riêng cho Sinh viên
router.get('/student', authorize('STUDENT', 'ADMIN'), dashboardController.getStudentDashboard);

// Các API bên dưới yêu cầu quyền ADMIN
router.use(authorize('ADMIN'));

router.get('/stats', dashboardController.getGeneralStats);
router.get('/semesters', dashboardController.getSemesterStats);
router.get('/scores', dashboardController.getScoreDistribution);
router.get('/activities', dashboardController.getRecentActivities);

module.exports = router;
