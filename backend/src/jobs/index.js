const { startPendingRegistrationReminderScheduler } = require('./pendingRegistrationReminderJob');
const { startAutoCouncilSetupScheduler } = require('./autoCouncilSetupJob');
const { startTaskDeadlineNotificationScheduler } = require('./taskDeadlineNotificationJob');
const { startCheckpointDeadlineOverdueScheduler } = require('./checkpointDeadlineOverdueJob');
const { startBm02ToBm04SweepScheduler } = require('../services/bm02ToBm04SweepService');

const startScheduledJobs = () => {
    const stopPendingReminder = startPendingRegistrationReminderScheduler();
    const stopAutoCouncilSetup = startAutoCouncilSetupScheduler();
    const stopTaskDeadline = startTaskDeadlineNotificationScheduler();
    const stopCheckpointOverdue = startCheckpointDeadlineOverdueScheduler();
    const stopSweepJobs = startBm02ToBm04SweepScheduler();

    return () => {
        stopPendingReminder();
        stopAutoCouncilSetup();
        stopTaskDeadline();
        stopCheckpointOverdue();
        stopSweepJobs();
    };
};

module.exports = {
    startScheduledJobs,
};
