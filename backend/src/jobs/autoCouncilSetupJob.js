const { runAutoCouncilSetupForDueSemesters } = require('../services/councilAutoSetupService');

const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_LOOKAHEAD_DAYS = 14;

const startAutoCouncilSetupScheduler = () => {
    const enabled = process.env.ENABLE_AUTO_COUNCIL_SETUP_JOB !== 'false';
    if (!enabled) {
        console.log('[jobs] Auto council setup job is disabled via ENABLE_AUTO_COUNCIL_SETUP_JOB=false');
        return () => {};
    }

    const intervalMinutes = Number.parseInt(
        process.env.AUTO_COUNCIL_SETUP_INTERVAL_MINUTES || `${DEFAULT_INTERVAL_MINUTES}`,
        10,
    );
    const intervalMs = Number.isInteger(intervalMinutes) && intervalMinutes > 0
        ? intervalMinutes * 60 * 1000
        : DEFAULT_INTERVAL_MINUTES * 60 * 1000;
    const lookaheadDays = Number.parseInt(
        process.env.AUTO_COUNCIL_SETUP_LOOKAHEAD_DAYS || `${DEFAULT_LOOKAHEAD_DAYS}`,
        10,
    );
    const actualLookaheadDays = Number.isInteger(lookaheadDays) && lookaheadDays > 0
        ? lookaheadDays
        : DEFAULT_LOOKAHEAD_DAYS;

    let isRunning = false;

    const tick = async () => {
        if (isRunning) return;
        isRunning = true;
        try {
            const result = await runAutoCouncilSetupForDueSemesters(actualLookaheadDays);
            if (result.semesterCount > 0) {
                const assigned = result.results.reduce((sum, item) => sum + item.assigned, 0);
                const total = result.results.reduce((sum, item) => sum + item.totalUnassigned, 0);
                const created = result.results.reduce((sum, item) => sum + item.createdCouncils, 0);
                console.log(
                    `[jobs] Auto council setup tick: semesters=${result.semesterCount}, created=${created}, assigned=${assigned}/${total}`,
                );
            }
        } catch (error) {
            console.error('[jobs] Auto council setup scheduler failed:', error?.message || error);
        } finally {
            isRunning = false;
        }
    };

    setTimeout(tick, 15 * 1000);
    const timer = setInterval(tick, intervalMs);
    console.log(
        `[jobs] Auto council setup scheduler started (every ${Math.round(intervalMs / 60000)} minutes, lookahead=${actualLookaheadDays} days)`,
    );

    return () => clearInterval(timer);
};

module.exports = {
    startAutoCouncilSetupScheduler,
};
