const { startPendingRegistrationReminderScheduler } = require('./pendingRegistrationReminderJob');
const { startAutoCouncilSetupScheduler } = require('./autoCouncilSetupJob');
const { startTaskDeadlineNotificationScheduler } = require('./taskDeadlineNotificationJob');
const { startCheckpointDeadlineOverdueScheduler } = require('./checkpointDeadlineOverdueJob');

const startScheduledJobs = () => {
    const stopPendingReminder = startPendingRegistrationReminderScheduler();
    const stopAutoCouncilSetup = startAutoCouncilSetupScheduler();
    const stopTaskDeadline = startTaskDeadlineNotificationScheduler();
    const stopCheckpointOverdue = startCheckpointDeadlineOverdueScheduler();

    return () => {
        stopPendingReminder();
        stopAutoCouncilSetup();
        stopTaskDeadline();
        stopCheckpointOverdue();
    };
};

module.exports = {
    startScheduledJobs,
};
