import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

export const topicService = {
    getAll: async (params = {}) => {
        try {
            return await api.get('/topics', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách đề tài');
        }
    },

    getById: async (id) => {
        try {
            return await api.get(`/topics/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải chi tiết đề tài');
        }
    },

    create: async (data) => {
        try {
            return await api.post('/topics', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo đề tài');
        }
    },

    update: async (id, data) => {
        try {
            return await api.put(`/topics/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật đề tài');
        }
    },

    delete: async (id) => {
        try {
            return await api.delete(`/topics/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xóa đề tài');
        }
    },

    propose: async (data) => {
        try {
            return await api.post('/topics', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi gửi đề xuất đề tài');
        }
    },

    getMentors: async (params = {}) => {
        try {
            return await api.get('/topics/mentors', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách giảng viên');
        }
    },

    changeStatus: async (id, data) => {
        try {
            return await api.patch(`/topics/${id}/status`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật trạng thái đề tài');
        }
    },

    getRegistrationHistory: async (id) => {
        try {
            return await api.get(`/registrations/${id}/history`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải lịch sử tiến trình');
        }
    },

    getCloneableTopics: async (params = {}) => {
        try {
            return await api.get('/topics/cloneable', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách đề tài có thể sao chép');
        }
    },

    cloneTopics: async (payload) => {
        try {
            return await api.post('/topics/clone', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi sao chép đề tài');
        }
    },
};

export const getCloneableTopics = topicService.getCloneableTopics;
export const cloneTopics = topicService.cloneTopics;
export default topicService;
