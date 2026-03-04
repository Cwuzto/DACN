import api from './api';

// ============================
// AUTH SERVICE
// Tất cả API liên quan đến Đăng nhập/Xác thực
// ============================

export const authService = {
    /**
     * Đăng nhập
     * @param {string} email
     * @param {string} password
     * @returns {Promise} { token, user }
     */
    login: (email, password) => {
        return api.post('/auth/login', { email, password });
    },

    /**
     * Lấy thông tin user hiện tại
     */
    getMe: () => {
        return api.get('/auth/me');
    },

    /**
     * Đổi mật khẩu
     */
    changePassword: (currentPassword, newPassword) => {
        return api.put('/auth/change-password', { currentPassword, newPassword });
    },

    /**
     * Cập nhật thông tin cá nhân
     */
    updateProfile: (data) => {
        return api.put('/auth/profile', data);
    },
};
