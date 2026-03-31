import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const registrationService = {
    getMyRegistration: async () => {
        try {
            return await api.get('/registrations/my');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải thông tin đăng ký');
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

    cancelRegistration: async (id) => {
        try {
            return await api.delete(`/registrations/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi hủy đăng ký');
        }
    },
};

export default registrationService;
