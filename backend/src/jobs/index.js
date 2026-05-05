const { startPendingRegistrationReminderScheduler } = require('./pendingRegistrationReminderJob');
const { startAutoCouncilSetupScheduler } = require('./autoCouncilSetupJob');
const { startTaskDeadlineNotificationScheduler } = require('./taskDeadlineNotificationJob');

const startScheduledJobs = () => {
    const stopPendingReminder = startPendingRegistrationReminderScheduler();
    const stopAutoCouncilSetup = startAutoCouncilSetupScheduler();
    const stopTaskDeadline = startTaskDeadlineNotificationScheduler();

    return () => {
        stopPendingReminder();
        stopAutoCouncilSetup();
        stopTaskDeadline();
    };
};

module.exports = {
    startScheduledJobs,
};
