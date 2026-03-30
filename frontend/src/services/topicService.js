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
            throw wrapServiceError(error, 'Da xay ra loi khi tai danh sach de tai');
        }
    },

    getById: async (id) => {
        try {
            return await api.get(`/topics/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tai chi tiet de tai');
        }
    },

    create: async (data) => {
        try {
            return await api.post('/topics', data);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tao de tai');
        }
    },

    update: async (id, data) => {
        try {
            return await api.put(`/topics/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi cap nhat de tai');
        }
    },

    delete: async (id) => {
        try {
            return await api.delete(`/topics/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi xoa de tai');
        }
    },

    getApprovals: async (params = {}) => {
        try {
            return await api.get('/topics/approvals', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tai de tai cho duyet');
        }
    },

    changeStatus: async (id, data) => {
        try {
            return await api.patch(`/topics/${id}/status`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi cap nhat trang thai de tai');
        }
    },
};
