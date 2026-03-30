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
            throw wrapServiceError(error, 'Dang nhap khong thanh cong');
        }
    },

    getMe: async () => {
        try {
            return await api.get('/auth/me');
        } catch (error) {
            throw wrapServiceError(error, 'Khong the tai thong tin nguoi dung');
        }
    },

    changePassword: async (currentPassword, newPassword) => {
        try {
            return await api.put('/auth/change-password', { currentPassword, newPassword });
        } catch (error) {
            throw wrapServiceError(error, 'Khong the doi mat khau');
        }
    },

    updateProfile: async (data) => {
        try {
            return await api.put('/auth/profile', data);
        } catch (error) {
            throw wrapServiceError(error, 'Khong the cap nhat thong tin');
        }
    },
};
