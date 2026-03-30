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
            throw wrapServiceError(error, 'Da xay ra loi khi tai thong tin dang ky');
        }
    },

    getAllRegistrations: async (params = {}) => {
        try {
            return await api.get('/registrations', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tai danh sach dang ky');
        }
    },

    registerTopic: async (topicId, semesterId) => {
        try {
            return await api.post('/registrations', { topicId, semesterId });
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi dang ky de tai');
        }
    },

    handleRegistration: async (id, action, rejectReason = '') => {
        try {
            return await api.patch(`/registrations/${id}/approve`, { action, rejectReason });
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi xu ly dang ky');
        }
    },

    cancelRegistration: async (id) => {
        try {
            return await api.delete(`/registrations/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi huy dang ky');
        }
    },
};

export default registrationService;
