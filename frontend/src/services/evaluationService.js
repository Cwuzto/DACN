import api from './api.js';
import { normalizeApiError } from '../utils/apiError.js';

const wrapServiceError = (error, fallbackMessage) => {
    const normalized = normalizeApiError(error);
    return { ...normalized, message: error?.response?.data?.message || error?.message || fallbackMessage };
};

const idempotencyConfig = (idempotencyKey) => ({
    headers: {
        'Idempotency-Key': idempotencyKey || globalThis.crypto?.randomUUID?.()
            || `bm01-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
});

const evaluationService = {
    getGradingStudents: async (params = {}) => {
        try {
            return await api.get('/evaluations/grading-students', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy danh sách chấm điểm');
        }
    },

    getMyGrades: async () => {
        try {
            return await api.get('/evaluations/my-grades');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy điểm');
        }
    },

    getAdminDefenseCenter: async (params = {}, { signal } = {}) => {
        try {
            return await api.get('/evaluations/admin-defense-center', { params, signal });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải dữ liệu trung tâm hội đồng');
        }
    },

    remindDefenseGrading: async (registrationIds) => {
        try {
            return await api.post('/evaluations/admin-defense-center/remind-grading', { registrationIds });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi gửi nhắc chấm điểm');
        }
    },

    setDefenseScoreLock: async (id, action) => {
        try {
            return await api.patch(`/evaluations/admin-defense-center/${id}/score-lock`, { action });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi khóa/mở khóa điểm');
        }
    },

    approveDefenseResult: async (id, data) => {
        try {
            return await api.post(`/evaluations/admin-defense-center/${id}/result-approval`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Không thể phê duyệt kết quả bảo vệ');
        }
    },

    correctDefenseResult: async (id, data) => {
        try {
            return await api.post(`/evaluations/admin-defense-center/${id}/result-approval/correction`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Không thể điều chỉnh kết quả bảo vệ');
        }
    },

    previewResultPublication: async (semesterId, { signal } = {}) => {
        try {
            return await api.get(`/evaluations/semesters/${semesterId}/result-publications/preview`, { signal });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể xem trước dữ liệu công bố');
        }
    },

    publishDefenseResults: async (semesterId, data, idempotencyKey) => {
        try {
            return await api.post(`/evaluations/semesters/${semesterId}/result-publications`, data, idempotencyConfig(idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Không thể công bố kết quả');
        }
    },

    getResultPublicationHistory: async (semesterId, { signal } = {}) => {
        try {
            return await api.get(`/evaluations/semesters/${semesterId}/result-publications`, { signal });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải lịch sử công bố');
        }
    },

    getMyPublishedResult: async () => {
        try {
            return await api.get('/evaluations/my-published-result');
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải kết quả chính thức');
        }
    },

    exportScoreSheetPdf: async (registrationId, data = {}) => {
        try {
            return await api.post(`/evaluations/${registrationId}/score-sheet/export-pdf`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xuất PDF bảng điểm');
        }
    },

    getScoreSheet: async (registrationId, params = {}) => {
        try {
            return await api.get(`/evaluations/${registrationId}/score-sheet`, { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải bảng điểm chi tiết');
        }
    },

    saveScoreSheet: async (registrationId, data) => {
        try {
            return await api.put(`/evaluations/${registrationId}/score-sheet`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lưu bảng điểm chi tiết');
        }
    },

    lockMemberScoreSheet: async (payload) => {
        try {
            return await api.post('/evaluations/member-score/lock', payload, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp và khóa phiếu điểm cá nhân');
        }
    },

    submitBM01: async (registrationId, data) => {
        try {
            return await api.post(`/evaluations/bm01-submit/${registrationId}`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp đề cương BM01');
        }
    },

    resubmitBM01: async (registrationId, data) => {
        try {
            return await api.post(`/evaluations/bm01-resubmit/${registrationId}`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp lại đề cương BM01');
        }
    },

    approveResubmittedBM01: async (registrationId, data = {}) => {
        try {
            return await api.post(`/evaluations/bm01-gvhd-approve/${registrationId}`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định đề cương BM01');
        }
    },

    submitBM04Evaluation: async (data) => {
        try {
            return await api.post('/evaluations/bm04-submit', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp phiếu BM04');
        }
    },

    getBM04Evaluation: async (registrationId) => {
        try {
            return await api.get(`/evaluations/bm04/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy phiếu đánh giá BM04');
        }
    },

    issueCheckpoint: async (data) => {
        try {
            return await api.post('/evaluations/checkpoint-issue', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi phát hành biên bản BM03 Checkpoint');
        }
    },

    signCheckpoint: async (data) => {
        try {
            return await api.post('/evaluations/checkpoint-sign', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ký xác nhận biên bản BM03 Checkpoint');
        }
    },

    handleCheckpointOverdue: async (data) => {
        try {
            return await api.post('/evaluations/checkpoint-overdue', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xử lý quá hạn ký Checkpoint');
        }
    },

    submitCheckpointAppeal: async (data) => {
        try {
            return await api.post('/evaluations/checkpoint-appeal-submit', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp đơn khiếu nại chữ ký Checkpoint');
        }
    },

    reviewCheckpointAppeal: async (data) => {
        try {
            return await api.post('/evaluations/checkpoint-appeal-review', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định khiếu nại chữ ký Checkpoint');
        }
    },

    getCheckpointEvaluations: async (registrationId) => {
        try {
            return await api.get(`/evaluations/checkpoint/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải thông tin Checkpoint');
        }
    },

    getCheckpointAppeals: async (params = {}) => {
        try {
            return await api.get('/evaluations/checkpoint-appeals', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách khiếu nại chữ ký Checkpoint');
        }
    },

    // ==========================================
    // BM03 Workflows (Task 5 & Task 7)
    // ==========================================
    getBM03Record: async (registrationId) => {
        try {
            return await api.get(`/bm03/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải phiếu BM03');
        }
    },

    createMeetingEntry: async (registrationId, data) => {
        try {
            return await api.post(`/bm03/${registrationId}/meetings`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo nhật ký buổi gặp');
        }
    },

    signMeetingEntry: async (meetingId, data = {}) => {
        try {
            return await api.post(`/bm03/meetings/${meetingId}/sign`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ký khóa buổi gặp');
        }
    },

    submitStageEvaluation: async (registrationId, data = {}) => {
        try {
            const endpoint = data.stage === 'MIDTERM' ? 'midterm-evaluation' : 'final-evaluation';
            return await api.post(`/bm03/${registrationId}/${endpoint}`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi gửi đánh giá giai đoạn');
        }
    },

    advisorSignWholeBM03: async (bm03RecordId, data = {}) => {
        try {
            return await api.post(`/bm03/${bm03RecordId}/advisor-sign`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi GVHD ký toàn phiếu BM03');
        }
    },

    studentAcknowledgeBM03: async (bm03RecordId, data = {}) => {
        try {
            const endpoint = data.action === 'DECLINED_TO_ACKNOWLEDGE' ? 'student-decline' : 'student-acknowledge';
            return await api.post(`/bm03/${bm03RecordId}/${endpoint}`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi sinh viên xác nhận BM03');
        }
    },

    requestMoreInfoForStopReview: async (stopReviewId, data = {}) => {
        try {
            return await api.post(`/bm03/stop-reviews/${stopReviewId}/request-more-info`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi yêu cầu bổ sung thông tin');
        }
    },

    decideStopReview: async (stopReviewId, data = {}) => {
        try {
            return await api.post(`/bm03/stop-reviews/${stopReviewId}/decision`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định đề nghị dừng BM03');
        }
    },

    listStopReviews: async (params = {}) => {
        try {
            return await api.get('/bm03/stop-reviews', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách đề nghị dừng BM03');
        }
    },

    // ==========================================
    // BM04 Workflows (Task 6 & Task 7)
    // ==========================================
    getBM04Record: async (registrationId) => {
        try {
            return await api.get(`/bm04/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải phiếu BM04');
        }
    },

    saveBM04Draft: async (registrationId, data = {}) => {
        try {
            return await api.post(`/bm04/${registrationId}/save-draft`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lưu nháp phiếu BM04');
        }
    },

    signAndSubmitBM04: async (registrationId, data = {}) => {
        try {
            return await api.post(`/bm04/${registrationId}/sign-submit`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ký và nộp phiếu BM04');
        }
    },

    requestMoreInfoForDefenseReview: async (reviewId, data = {}) => {
        try {
            return await api.post(`/bm04/defense-reviews/${reviewId}/request-more-info`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi yêu cầu bổ sung thông tin BM04');
        }
    },

    decideDefenseReview: async (reviewId, data = {}) => {
        try {
            return await api.post(`/bm04/defense-reviews/${reviewId}/decision`, data, idempotencyConfig(data.idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định đề nghị không cho bảo vệ BM04');
        }
    },

    listDefenseReviews: async (params = {}) => {
        try {
            return await api.get('/bm04/defense-reviews', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách thẩm định BM04');
        }
    },

    runBm02ToBm04SweepJobs: async (data = {}) => {
        try {
            return await api.post('/bm04/sweep-overdue', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi chạy quét quá hạn');
        }
    },

    getMyCouncilDefenses: async (params = {}) => {
        try {
            return await api.get('/councils', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách hội đồng');
        }
    },

    // ==========================================
    // Defense Scorebook & Absenteeism Methods
    // ==========================================
    markStudentAbsent: async (registrationId, data = {}) => {
        try {
            return await api.post(`/evaluations/${registrationId}/mark-absent`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lập biên bản vắng mặt');
        }
    },

    lockScoreBookByChairman: async (registrationId, data = {}) => {
        try {
            return await api.post(`/evaluations/${registrationId}/lock-scorebook`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi khóa sổ điểm Hội đồng');
        }
    },

    returnScoreBook: async (registrationId, data = {}) => {
        try {
            return await api.post(`/evaluations/${registrationId}/return-scorebook`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi trả sổ điểm về Hội đồng');
        }
    },

    getScoreBookReturnLogs: async (councilId) => {
        try {
            return await api.get(`/evaluations/councils/${councilId}/return-logs`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải nhật ký hoàn trả sổ điểm');
        }
    },
};

export default evaluationService;
