/**
 * Council Auto Setup Service
 * 
 * LƯU Ý HỌC VỤ & KIẾN TRÚC:
 * - Tự động tạo và gán trực tiếp hội đồng bảo vệ (DEFENSE_COUNCIL) ngầm đã bị ngừng hoạt động
 *   để đảm bảo không ghi DB ngầm, không tự ý chuyển trạng thái sang DEFENSE_READY và không bỏ sót
 *   các ràng buộc chuyên môn / trần 30 sinh viên.
 * - Thay vào đó, việc phân hội đồng bảo vệ phải thông qua quy trình:
 *   1. Xem trước phương án (Assignment Preview)
 *   2. Tinh chỉnh phương án
 *   3. Admin xác nhận (Confirmation) trong giao dịch.
 * - Quy trình tự động phân hội đồng đề cương (OUTLINE_COUNCIL) vẫn duy trì độc lập tại outlineAutoSetupService.js.
 */

const DEFAULT_LOOKAHEAD_DAYS = 14;

/**
 * Ngừng thực thi tạo/gán tự động ngầm DEFENSE_COUNCIL cho 1 học kỳ.
 * Trả về báo cáo an toàn (0 writes).
 */
const runAutoCouncilSetupForSemester = async (semesterId) => {
    return {
        semesterId,
        createdCouncils: 0,
        updatedCouncils: 0,
        totalUnassigned: 0,
        assigned: 0,
        skipped: [],
        warnings: [
            'Tự động tạo/gán hội đồng bảo vệ (DEFENSE_COUNCIL) ngầm đã bị vô hiệu hóa. Vui lòng sử dụng tính năng Xem trước và xác nhận phương án bảo vệ (Assignment Preview).',
        ],
    };
};

/**
 * Ngừng thực thi tạo/gán tự động ngầm DEFENSE_COUNCIL trong cron/scheduler.
 * Trả về báo cáo an toàn (0 writes).
 */
const runAutoCouncilSetupForDueSemesters = async (lookaheadDays = DEFAULT_LOOKAHEAD_DAYS) => {
    return {
        lookedAheadDays: lookaheadDays,
        semesterCount: 0,
        results: [],
        warnings: [
            'Tác vụ tự động gán hội đồng bảo vệ ngầm đã ngừng hoạt động để bảo đảm tính toàn vẹn học vụ.',
        ],
    };
};

module.exports = {
    runAutoCouncilSetupForSemester,
    runAutoCouncilSetupForDueSemesters,
};
