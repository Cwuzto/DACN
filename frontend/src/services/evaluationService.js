import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
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

    getAdminDefenseCenter: async (params = {}) => {
        try {
            return await api.get('/evaluations/admin-defense-center', { params });
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

    previewResultPublication: async (semesterId) => {
        try {
            return await api.get(`/evaluations/semesters/${semesterId}/result-publications/preview`);
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

    getResultPublicationHistory: async (semesterId) => {
        try {
            return await api.get(`/evaluations/semesters/${semesterId}/result-publications`);
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

    getMyCouncilDefenses: async (params = {}) => {
        try {
            return await api.get('/councils', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách hội đồng');
        }
    },
};

export default evaluationService;
