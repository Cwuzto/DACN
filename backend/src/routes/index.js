const router = require('express').Router();

// Import các route modules
const authRoutes = require('./authRoutes');
const topicRoutes = require('./topicRoutes');
const semesterRoutes = require('./semesterRoutes');
const uploadRoutes = require('./uploadRoutes');
const registrationRoutes = require('./registrationRoutes');
const taskRoutes = require('./taskRoutes');
const userRoutes = require('./userRoutes');
const councilRoutes = require('./councilRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const evaluationRoutes = require('./evaluationRoutes');
const notificationRoutes = require('./notificationRoutes');

// Đăng ký routes
router.use('/auth', authRoutes);
router.use('/topics', topicRoutes);
router.use('/semesters', semesterRoutes);
router.use('/upload', uploadRoutes);
router.use('/registrations', registrationRoutes);
router.use('/tasks', taskRoutes);
router.use('/users', userRoutes);
router.use('/councils', councilRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/evaluations', evaluationRoutes);
router.use('/notifications', notificationRoutes);

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'DACN API is running!',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
