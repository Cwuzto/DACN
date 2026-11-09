const router = require('express').Router();

// Import các route modules
const authRoutes = require('./authRoutes');
const topicRoutes = require('./topicRoutes');
const semesterRoutes = require('./semesterRoutes');
const uploadRoutes = require('./uploadRoutes');
const portalUploadRoutes = require('./portalUploadRoutes');
const portalContentRoutes = require('./portalContentRoutes');
const registrationRoutes = require('./registrationRoutes');
const taskRoutes = require('./taskRoutes');
const userRoutes = require('./userRoutes');
const councilRoutes = require('./councilRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const evaluationRoutes = require('./evaluationRoutes');
const notificationRoutes = require('./notificationRoutes');
const projectEnrollmentRoutes = require('./projectEnrollmentRoutes');
const permissionRoutes = require('./permissionRoutes');
const announcementRoutes = require('./announcementRoutes');
const meetingLogRoutes = require('./meetingLogRoutes');
const archiveRoutes = require('./archiveRoutes');
const rubricRoutes = require('./rubricRoutes');
const manualReviewRoutes = require('./manualReviewRoutes');
const delegationRoutes = require('./delegationRoutes');
const lecturerAssignmentRoutes = require('./lecturerAssignmentRoutes');

// Đăng ký routes
router.use('/auth', authRoutes);
router.use('/topics', topicRoutes);
router.use('/semesters', semesterRoutes);
router.use('/upload', uploadRoutes);
router.use('/portal/uploads', portalUploadRoutes);
router.use('/portal', portalContentRoutes);
router.use('/registrations', registrationRoutes);
router.use('/tasks', taskRoutes);
router.use('/users', userRoutes);
router.use('/councils', councilRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/evaluations', evaluationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/project-enrollments', projectEnrollmentRoutes);
router.use('/permissions', permissionRoutes);
router.use('/announcements', announcementRoutes);
router.use('/archives', archiveRoutes);
router.use('/rubrics', rubricRoutes);
router.use('/manual-review-cases', manualReviewRoutes);
router.use('/delegations', delegationRoutes);
router.use('/lecturer-assignments', lecturerAssignmentRoutes);
router.use('/', meetingLogRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'DACN API is running!',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
