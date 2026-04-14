const { startPendingRegistrationReminderScheduler } = require('./pendingRegistrationReminderJob');

const startScheduledJobs = () => {
    const stopPendingReminder = startPendingRegistrationReminderScheduler();

    return () => {
        stopPendingReminder();
    };
};

module.exports = {
    startScheduledJobs,
};
