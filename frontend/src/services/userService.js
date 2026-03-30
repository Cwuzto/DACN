import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const userService = {
    getUsers: async (params = {}) => {
        try {
            return await api.get('/users', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi tai danh sach nguoi dung');
        }
    },

    createUser: async (userData) => {
        try {
            return await api.post('/users', userData);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi tao nguoi dung');
        }
    },

    updateUser: async (id, userData) => {
        try {
            return await api.put(`/users/${id}`, userData);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi cap nhat nguoi dung');
        }
    },

    deleteUser: async (id) => {
        try {
            return await api.delete(`/users/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi xoa nguoi dung');
        }
    },

    toggleActive: async (id) => {
        try {
            return await api.patch(`/users/${id}/toggle-active`);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi thay doi trang thai');
        }
    },

    resetPassword: async (id) => {
        try {
            return await api.post(`/users/${id}/reset-password`);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi reset mat khau');
        }
    },
};

export default userService;
