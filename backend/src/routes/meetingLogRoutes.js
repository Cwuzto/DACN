// src/routes/meetingLogRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorizePermission, authorizeRoleOrPermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
    getMeetingLogs,
    getMeetingStats,
    createMeetingLog,
    updateMeetingLog,
    deleteMeetingLog,
} = require('../controllers/meetingLogController');

router.use(authenticate);

// Routes scoped under registration
router.get('/registrations/:registrationId/meeting-logs', authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.BM03_REVIEW]), getMeetingLogs);
router.get('/registrations/:registrationId/meeting-stats', authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.BM03_REVIEW]), getMeetingStats);
router.post('/registrations/:registrationId/meeting-logs', authorizePermission(PERMISSIONS.BM03_SUBMIT), createMeetingLog);

// Routes for individual meeting log
router.put('/meeting-logs/:id', authorizePermission(PERMISSIONS.BM03_SUBMIT), updateMeetingLog);
router.delete('/meeting-logs/:id', authorizePermission(PERMISSIONS.BM03_SUBMIT), deleteMeetingLog);

module.exports = router;
