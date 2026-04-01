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

    getApprovals: async (params = {}) => {
        try {
            return await api.get('/topics/approvals', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải đề tài chờ duyệt');
        }
    },

    getMentors: async () => {
        try {
            return await api.get('/topics/mentors');
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
};
