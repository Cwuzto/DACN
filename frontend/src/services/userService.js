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
            throw wrapServiceError(error, 'Lỗi khi tải danh sách người dùng');
        }
    },

    createUser: async (userData) => {
        try {
            return await api.post('/users', userData);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tạo người dùng');
        }
    },

    updateUser: async (id, userData) => {
        try {
            return await api.put(`/users/${id}`, userData);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật người dùng');
        }
    },

    deleteUser: async (id) => {
        try {
            return await api.delete(`/users/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa người dùng');
        }
    },

    toggleActive: async (id) => {
        try {
            return await api.patch(`/users/${id}/toggle-active`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi thay đổi trạng thái');
        }
    },

    resetPassword: async (id) => {
        try {
            return await api.post(`/users/${id}/reset-password`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi reset mật khẩu');
        }
    },
};

export default userService;


