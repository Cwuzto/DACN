import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

export const authService = {
    login: async (email, password) => {
        try {
            return await api.post('/auth/login', { email, password });
        } catch (error) {
            throw wrapServiceError(error, 'Đăng nhập không thành công');
        }
    },

    getMe: async () => {
        try {
            return await api.get('/auth/me');
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải thông tin người dùng');
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        try {
            return await api.put('/auth/change-password', { currentPassword, newPassword });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể đổi mật khẩu');
        }
    },

    updateProfile: async (data) => {
        try {
            return await api.put('/auth/profile', data);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể cập nhật thông tin');
        }
    },
};


