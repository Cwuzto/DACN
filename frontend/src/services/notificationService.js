import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const notificationService = {
    getMyNotifications: async (params = {}) => {
        try {
            return await api.get('/notifications/my', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải thông báo');
        }
    },

    markRead: async (id) => {
        try {
            return await api.patch(`/notifications/${id}/read`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi đánh dấu đã đọc');
        }
    },

    markAllRead: async () => {
        try {
            return await api.patch('/notifications/read-all');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi đánh dấu tất cả đã đọc');
        }
    },

    deleteNotification: async (id) => {
        try {
            return await api.delete(`/notifications/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xóa thông báo');
        }
    },

    getHistory: async () => {
        try {
            return await api.get('/notifications/history');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải lịch sử thông báo');
        }
    },

    getTemplates: async () => {
        try {
            return await api.get('/notifications/templates');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải template thông báo');
        }
    },

    updateTemplate: async (key, data) => {
        try {
            return await api.put(`/notifications/templates/${key}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật template');
        }
    },

    sendBroadcast: async (data) => {
        try {
            return await api.post('/notifications/broadcast', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi gửi thông báo');
        }
    },
};

export default notificationService;
