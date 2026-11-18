/**
 * Auto Council Setup Job
 * 
 * LƯU Ý: Tự động tạo/gán hội đồng bảo vệ (DEFENSE_COUNCIL) ngầm trong scheduler đã bị DỪNG.
 * Việc phân hội đồng bảo vệ yêu cầu Admin chủ động xem trước và xác nhận qua giao diện Preview.
 */
const startAutoCouncilSetupScheduler = () => {
    const enabled = process.env.ENABLE_AUTO_COUNCIL_SETUP_JOB !== 'false';
    if (!enabled) {
        console.log('[jobs] Auto council setup job is disabled via ENABLE_AUTO_COUNCIL_SETUP_JOB=false');
        return () => {};
    }

    console.log('[jobs] Defense council automatic creation/assignment in scheduler is disabled in favor of assignment preview.');
    return () => {};
};

module.exports = {
    startAutoCouncilSetupScheduler,
};
