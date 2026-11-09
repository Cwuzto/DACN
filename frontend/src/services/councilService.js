import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    const errorData = error?.response?.data || error;
    if (errorData?.success === false) return errorData;
    if (errorData && typeof errorData === 'object') {
        return { success: false, message: errorData.message || fallbackMessage, ...errorData };
    }
    return { success: false, message: fallbackMessage };
};

const makeIdempotencyHeader = (key) => ({
    headers: {
        'Idempotency-Key': key || globalThis.crypto?.randomUUID?.()
            || `outline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
});

const councilService = {
    getCouncils: async (params = {}) => {
        try {
            return await api.get('/councils', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách hội đồng');
        }
    },

    getCouncilById: async (id) => {
        try {
            return await api.get(`/councils/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải chi tiết hội đồng');
        }
    },

    getCouncilLogs: async (id) => {
        try {
            return await api.get(`/councils/${id}/logs`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải lịch sử hội đồng');
        }
    },

    createCouncil: async (data) => {
        try {
            return await api.post('/councils', data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tạo hội đồng');
        }
    },

    updateCouncil: async (id, data) => {
        try {
            return await api.put(`/councils/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật hội đồng');
        }
    },

    deleteCouncil: async (id) => {
        try {
            return await api.delete(`/councils/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa hội đồng');
        }
    },

    assignRegistrations: async (id, registrationIds) => {
        try {
            return await api.post(`/councils/${id}/assign`, { registrationIds });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi phân công sinh viên');
        }
    },

    autoAssignRegistrations: async (semesterId) => {
        try {
            return await api.post('/councils/auto-assign', { semesterId });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi phân công tự động');
        }
    },

    removeRegistration: async (id, registrationId) => {
        try {
            return await api.post(`/councils/${id}/remove-registration`, { registrationId });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi gỡ sinh viên khỏi hội đồng');
        }
    },

    // Outline Review (BM01) Methods
    autoAssignOutlineCouncils: async (semesterId) => {
        try {
            return await api.post('/councils/auto-assign-outline', { semesterId });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tự động phân công hội đồng đề cương');
        }
    },

    publishSchedule: async (councilId, data) => {
        try {
            return await api.put(`/councils/${councilId}/schedule`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi công bố lịch bảo vệ');
        }
    },

    saveDraftResult: async (councilId, registrationId, data) => {
        try {
            return await api.put(`/councils/${councilId}/results/${registrationId}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi lưu nháp đánh giá');
        }
    },

    completeSecretary: async (councilId) => {
        try {
            return await api.post(`/councils/${councilId}/results/secretary-complete`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi hoàn tất đánh giá');
        }
    },

    returnResults: async (councilId, returnReason) => {
        try {
            return await api.post(`/councils/${councilId}/results/return`, { returnReason });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi trả lại kết quả');
        }
    },

    publishResults: async (councilId, idempotencyKey) => {
        try {
            return await api.post(`/councils/${councilId}/results/publish`, {}, makeIdempotencyHeader(idempotencyKey));
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi công bố kết quả hội đồng');
        }
    },

    setRevisionDeadline: async (councilId, revisionDeadline) => {
        try {
            return await api.put(`/councils/${councilId}/revision-deadline`, { revisionDeadline });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi đặt hạn nộp lại đề cương');
        }
    },

    reviewResubmission: async (councilId, registrationId, data) => {
        try {
            return await api.post(`/councils/${councilId}/resubmissions/${registrationId}/review`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi thẩm định đề cương nộp lại');
        }
    },

    reopenResults: async (councilId, reason) => {
        try {
            return await api.post(`/councils/${councilId}/results/reopen`, { reason });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi mở khóa kết quả hội đồng');
        }
    },

    finalizeOverdue: async (councilId) => {
        try {
            return await api.post(`/councils/${councilId}/finalize-resubmissions`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi chốt danh sách quá hạn');
        }
    },
};

export default councilService;
