/**
 * workflowActionService.js
 * 
 * Tính toán danh sách allowedActions[] dựa trên:
 * - Trạng thái TopicRegistration và stateVersion
 * - Vai trò người dùng (STUDENT, LECTURER, ADMIN, VIEN_TRUONG)
 * - Ràng buộc quyền hạn và xung đột lợi ích (INV-11, INV-20, INV-26, etc.)
 */

function computeAllowedActions(registration, user) {
    if (!registration || !user) return [];

    const actions = new Set();
    const status = registration.status;
    const isStudent = user.role === 'STUDENT' && user.id === registration.studentId;
    const isMentor = (user.role === 'LECTURER' || user.role === 'ADMIN') && registration.topic?.mentorId === user.id;
    const isAdmin = user.role === 'ADMIN';
    const isDean = user.role === 'LECTURER' && (user.permissions || []).includes('PROJECT_ASSIGNMENT_PUBLISH');

    // 1. STUDENT ACTIONS
    if (isStudent) {
        // Hủy đăng ký trước khi ban hành Quyết định
        if (['PENDING', 'APPROVED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_PASSED', 'BM02_SUBMITTED'].includes(status)) {
            actions.add('CANCEL_REGISTRATION');
        }

        // Nộp đề cương BM01
        if (['REGISTERED', 'APPROVED'].includes(status)) {
            actions.add('SUBMIT_BM01');
        } else if (status === 'BM01_NEEDS_REVISION') {
            actions.add('RESUBMIT_BM01');
        }

        // Nộp đơn BM02
        if (status === 'BM01_PASSED') {
            actions.add('SUBMIT_BM02');
        }

        // Xin đổi tên đề tài trong 7 ngày
        if (status === 'DECISION_ISSUED') {
            actions.add('REQUEST_TITLE_CHANGE');
        }

        // Ký xác nhận Checkpoint BM03
        if (status === 'BM03_SIGNATURE_PENDING') {
            actions.add('SIGN_CHECKPOINT');
        }

        // Khiếu nại khi quá hạn ký Checkpoint
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_OPEN') {
            actions.add('SUBMIT_CHECKPOINT_APPEAL');
        }

        // Nộp lưu chiểu số (khi đã bảo vệ đạt điểm >= 5.0)
        if (status === 'DEFENDED' && (registration.defenseResult?.finalScore === null || Number(registration.defenseResult?.finalScore) >= 5.0)) {
            actions.add('SUBMIT_ARCHIVE');
        }

        // Xem Giấy xác nhận hoàn thành
        if (status === 'COMPLETED' || registration.archive?.status === 'APPROVED') {
            actions.add('VIEW_CLEARANCE_CERTIFICATE');
        }
    }

    // 2. LECTURER / MENTOR ACTIONS
    if (isMentor) {
        // Duyệt đăng ký ban đầu
        if (status === 'PENDING') {
            actions.add('APPROVE_REGISTRATION');
            actions.add('REJECT_REGISTRATION');
        }

        // Duyệt lại đề cương BM01 sau khi SV sửa
        if (status === 'BM01_NEEDS_REVISION') {
            actions.add('APPROVE_BM01_REVISION');
        }

        // Phát hành Checkpoint 1
        if (['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03'].includes(status)) {
            actions.add('ISSUE_CHECKPOINT_1');
        }

        // Phát hành Checkpoint 2 (khi CP1 đã đạt)
        if (status === 'IN_PROGRESS_BM03') {
            actions.add('ISSUE_CHECKPOINT_2');
        }

        // Nhận xét & Đề xuất bảo vệ BM04 (khi đã qua BM03)
        if (status === 'BM03_PASSED') {
            actions.add('SUBMIT_BM04');
        }

        // Nghiệm thu lưu chiểu
        if (['DEFENDED', 'COMPLETED'].includes(status) && registration.archive) {
            actions.add('REVIEW_ARCHIVE');
        }
    }

    // 3. DEFENSE COUNCIL MEMBER ACTIONS
    // Chấm điểm bảo vệ: Người chấm phải thuộc Hội đồng và TUYỆT ĐỐI KHÔNG ĐƯỢC LÀ GVHD (INV-11, INV-20)
    const councilMembers = registration.defenseCouncil?.members || [];
    const isCouncilMember = councilMembers.some((m) => m.lecturerId === user.id);
    if (isCouncilMember && registration.topic?.mentorId !== user.id && ['DEFENSE_READY', 'DEFENDED'].includes(status)) {
        actions.add('GRADE_DEFENSE');
    }

    // 4. ADMIN & DEAN (VIỆN TRƯỞNG) ACTIONS
    if (isAdmin || isDean) {
        // Ban hành Quyết định giao đề tài
        if (status === 'BM02_SUBMITTED') {
            actions.add('ISSUE_DECISION');
        }

        // Thẩm định khiếu nại chữ ký Checkpoint (Cấm GVHD thẩm định đơn SV mình)
        if (status === 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED' && registration.topic?.mentorId !== user.id) {
            actions.add('REVIEW_CHECKPOINT_APPEAL');
        }
    }

    if (isAdmin) {
        // Điều chuyển GVHD (chỉ cho phép trước khi BM04 khóa)
        if (!['TERMINATED_BM01', 'TERMINATED_FAILED_PROGRESS', 'TERMINATED_BM04', 'COMPLETED', 'WITHDRAWN', 'DROPPED', 'REJECTED'].includes(status)) {
            actions.add('TRANSFER_MENTOR');
        }

        // Xếp Hội đồng bảo vệ
        if (['DEFENSE_READY', 'DEFENDED'].includes(status)) {
            actions.add('ASSIGN_DEFENSE_COUNCIL');
        }

        // Khóa / Mở khóa điểm Hội đồng
        if (status === 'DEFENSE_READY') {
            actions.add('LOCK_DEFENSE_SCORES');
        } else if (status === 'DEFENDED') {
            actions.add('UNLOCK_DEFENSE_SCORES');
        }

        // Nghiệm thu lưu chiểu cấp Admin
        if (['DEFENDED', 'COMPLETED'].includes(status) && registration.archive) {
            actions.add('REVIEW_ARCHIVE');
        }

        // Thẩm định hồ sơ legacy
        if (registration.manualReviewCases?.some((c) => c.status === 'OPEN')) {
            actions.add('RESOLVE_MANUAL_REVIEW');
        }
    }

    return Array.from(actions);
}

module.exports = {
    computeAllowedActions,
};
