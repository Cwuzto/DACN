import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

export const semesterService = {
    getPublic: async () => {
        try {
            return await api.get('/semesters/public');
        } catch (error) {
            return { success: false, data: [] };
        }
    },

    getAll: async () => {
        try {
            return await api.get('/semesters');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách học kỳ');
        }
    },

    getById: async (id) => {
        try {
            return await api.get(`/semesters/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải chi tiết học kỳ');
        }
    },

    create: async (data) => {
        try {
            return await api.post('/semesters', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo học kỳ');
        }
    },

    update: async (id, data) => {
        try {
            return await api.put(`/semesters/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật học kỳ');
        }
    },

    toggleRegistration: async (id, registrationOpen) => {
        try {
            return await api.patch(`/semesters/${id}/registration-toggle`, { registrationOpen });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật trạng thái đăng ký');
        }
    },

    delete: async (id) => {
        try {
            return await api.delete(`/semesters/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xóa học kỳ');
        }
    },

    issuePeriodDecision: async (id, data = {}) => {
        try {
            const key = globalThis.crypto?.randomUUID?.()
                || `decision-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return await api.post(`/semesters/${id}/issue-decision`, data, {
                headers: { 'Idempotency-Key': key },
            });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ban hành Quyết định giao đề tài');
        }
    },

    createDecisionAmendment: async (decisionId, data) => {
        try {
            const key = globalThis.crypto?.randomUUID?.()
                || `amendment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            return await api.post(`/semesters/decisions/${decisionId}/amendments`, data, {
                headers: { 'Idempotency-Key': key },
            });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo Quyết định điều chỉnh');
        }
    },
};
