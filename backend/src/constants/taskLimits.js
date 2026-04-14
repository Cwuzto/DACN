const MAX_SUBMISSIONS_PER_TASK = Number.parseInt(process.env.MAX_SUBMISSIONS_PER_TASK || '3', 10);

module.exports = {
    MAX_SUBMISSIONS_PER_TASK: Number.isInteger(MAX_SUBMISSIONS_PER_TASK) && MAX_SUBMISSIONS_PER_TASK > 0
        ? MAX_SUBMISSIONS_PER_TASK
        : 3,
};
