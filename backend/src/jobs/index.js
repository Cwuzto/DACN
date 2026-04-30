const { startPendingRegistrationReminderScheduler } = require('./pendingRegistrationReminderJob');
const { startAutoCouncilSetupScheduler } = require('./autoCouncilSetupJob');

const startScheduledJobs = () => {
    const stopPendingReminder = startPendingRegistrationReminderScheduler();
    const stopAutoCouncilSetup = startAutoCouncilSetupScheduler();

    return () => {
        stopPendingReminder();
        stopAutoCouncilSetup();
    };
};

module.exports = {
    startScheduledJobs,
};
