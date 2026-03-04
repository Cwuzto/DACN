import api from './api';

const userService = {
    // Lấy danh sách người dùng (Admin)
    getUsers: async (params = {}) => {
        try {
            const response = await api.get('/users', { params });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi tải danh sách người dùng.' };
        }
    },

    // Tạo người dùng mới
    createUser: async (userData) => {
        try {
            const response = await api.post('/users', userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi tạo người dùng.' };
        }
    },

    // Cập nhật người dùng
    updateUser: async (id, userData) => {
        try {
            const response = await api.put(`/users/${id}`, userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi cập nhật người dùng.' };
        }
    },

    // Xóa người dùng
    deleteUser: async (id) => {
        try {
            const response = await api.delete(`/users/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi xóa người dùng.' };
        }
    },

    // Khóa / Mở khóa
    toggleActive: async (id) => {
        try {
            const response = await api.patch(`/users/${id}/toggle-active`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi thay đổi trạng thái.' };
        }
    },

    // Reset mật khẩu
    resetPassword: async (id) => {
        try {
            const response = await api.post(`/users/${id}/reset-password`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi reset mật khẩu.' };
        }
    },
};

export default userService;
