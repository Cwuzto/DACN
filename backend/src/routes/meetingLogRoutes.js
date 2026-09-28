// src/routes/meetingLogRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const {
    getMeetingLogs,
    getMeetingStats,
    createMeetingLog,
    updateMeetingLog,
    deleteMeetingLog,
} = require('../controllers/meetingLogController');

router.use(authenticate);

// Routes scoped under registration
router.get('/registrations/:registrationId/meeting-logs', getMeetingLogs);
router.get('/registrations/:registrationId/meeting-stats', getMeetingStats);
router.post('/registrations/:registrationId/meeting-logs', createMeetingLog);

// Routes for individual meeting log
router.put('/meeting-logs/:id', updateMeetingLog);
router.delete('/meeting-logs/:id', deleteMeetingLog);

module.exports = router;
