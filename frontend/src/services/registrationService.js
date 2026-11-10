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
            const payload = { action };
            if (action === 'REJECT' && rejectReason) {
                payload.rejectReason = rejectReason.trim();
            }
            return await api.patch(`/registrations/${id}/approve`, payload);
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

    reviewOutlineTopic: async (registrationId, data) => {
        try {
            return await api.put('/registrations/' + registrationId + '/outline-review', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định đề cương');
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
            const regId = data.registrationId;
            if (regId) {
                return await api.post(`/bm02/applications/${regId}/submit`, data, idempotencyConfig());
            }
            return await api.post('/registrations/bm02-submit', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp BM02');
        }
    },

    submitBM02Application: async (registrationId, data) => {
        try {
            return await api.post(`/bm02/applications/${registrationId}/submit`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp đơn BM02');
        }
    },

    resubmitBM02Application: async (id, data) => {
        try {
            return await api.post(`/bm02/applications/${id}/resubmit`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp lại đơn BM02');
        }
    },

    requestBM02Revision: async (id, data) => {
        try {
            return await api.post(`/bm02/applications/${id}/request-revision`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi yêu cầu chỉnh sửa BM02');
        }
    },

    approveBM02Application: async (id) => {
        try {
            return await api.post(`/bm02/applications/${id}/approve`, {}, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi phê duyệt đơn BM02');
        }
    },

    createTopicDecision: async (data) => {
        try {
            return await api.post('/topic-decisions', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lập Quyết định giao đề tài');
        }
    },

    publishTopicDecision: async (id, data = {}) => {
        try {
            return await api.post(`/topic-decisions/${id}/publish`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ban hành Quyết định giao đề tài');
        }
    },

    reviewBM02: async (registrationId, data) => {
        try {
            return await api.post(`/registrations/bm02/${registrationId}/review`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định BM02');
        }
    },

    reviewBM02Submission: async (registrationId, data) => {
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

export const {
    getMyRegistration,
    getMyProjectEnrollments,
    getAllRegistrations,
    registerTopic,
    handleRegistration,
    dropRegistration,
    withdrawRegistration,
    forceDecisionRegistration,
    cancelRegistration,
    reviewOutlineTopic,
    updateOutlineReview,
    submitBM02,
    submitBM02Application,
    resubmitBM02Application,
    requestBM02Revision,
    approveBM02Application,
    createTopicDecision,
    publishTopicDecision,
    reviewBM02,
    reviewBM02Submission,
    requestTitleAdjustment,
    reviewTitleAdjustment,
    getMyTitleAdjustments,
    getPendingTitleAdjustments,
    transferTopicMentor,
    getAllowedActions,
} = registrationService;

export default registrationService;
