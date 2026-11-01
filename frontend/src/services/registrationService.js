import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const idempotencyConfig = () => ({
    headers: {
        'Idempotency-Key': globalThis.crypto?.randomUUID?.()
            || `workflow-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
});

const registrationService = {
    getMyRegistration: async (params = {}) => {
        try {
            return await api.get('/registrations/my', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải thông tin đăng ký');
        }
    },

    getMyProjectEnrollments: async (params = {}) => {
        try {
            return await api.get('/registrations/my-project-enrollments', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tai danh sach mon do an da dang ky');
        }
    },

    getAllRegistrations: async (params = {}) => {
        try {
            return await api.get('/registrations', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách đăng ký');
        }
    },

    registerTopic: async (topicId, semesterId) => {
        try {
            return await api.post('/registrations', { topicId, semesterId });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi đăng ký đề tài');
        }
    },

    handleRegistration: async (id, action, rejectReason = '') => {
        try {
            return await api.patch(`/registrations/${id}/approve`, { action, rejectReason });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xử lý đăng ký');
        }
    },
    dropRegistration: async (id, reason) => {
        try {
            return await api.patch(`/registrations/${id}/drop`, { reason }, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi hủy đăng ký đồ án');
        }
    },
    withdrawRegistration: async (id, reason) => {
        try {
            return await api.post(`/registrations/${id}/withdraw`, { reason }, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi rút đăng ký');
        }
    },
    forceDecisionRegistration: async (id, action, rejectReason = '') => {
        try {
            return await api.patch(`/registrations/${id}/force-decision`, { action, rejectReason });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xử lý force decision');
        }
    },

    cancelRegistration: async (id) => {
        try {
            return await api.delete(`/registrations/${id}`, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi hủy đăng ký');
        }
    },

    updateOutlineReview: async (id, payload) => {
        try {
            return await api.patch(`/registrations/${id}/outline-review`, payload, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật kết quả thẩm định đề cương');
        }
    },

    submitBM02: async (data) => {
        try {
            return await api.post('/registrations/bm02-submit', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp BM02');
        }
    },

    reviewBM02: async (registrationId, data) => {
        try {
            return await api.post(`/registrations/bm02/${registrationId}/review`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định BM02');
        }
    },

    requestTitleAdjustment: async (data) => {
        try {
            return await api.post('/registrations/adjust-title', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xin đổi tên đề tài');
        }
    },

    reviewTitleAdjustment: async (id, data) => {
        try {
            return await api.put(`/registrations/adjust-title/${id}/review`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xét duyệt đổi tên đề tài');
        }
    },

    getMyTitleAdjustments: async () => {
        try {
            return await api.get('/registrations/adjust-title/my');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách đổi tên đề tài');
        }
    },

    getPendingTitleAdjustments: async () => {
        try {
            return await api.get('/registrations/adjust-title/pending');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách chờ duyệt đổi tên');
        }
    },

    transferTopicMentor: async (registrationId, data) => {
        try {
            return await api.post(`/registrations/${registrationId}/transfer-mentor`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi điều chuyển GVHD');
        }
    },

    getAllowedActions: async (registrationId) => {
        try {
            return await api.get(`/registrations/${registrationId}/allowed-actions`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi kiểm tra quyền thao tác');
        }
    },
};

export default registrationService;
