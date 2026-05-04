import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

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
            return await api.patch(`/registrations/${id}/drop`, { reason });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi hủy đăng ký đồ án');
        }
    },
    withdrawRegistration: async (id, reason) => {
        try {
            return await api.post(`/registrations/${id}/withdraw`, { reason });
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
            return await api.delete(`/registrations/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi hủy đăng ký');
        }
    },
};

export default registrationService;
