import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const notificationService = {
    getHistory: async () => {
        try {
            return await api.get('/notifications/history');
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tai lich su thong bao');
        }
    },

    sendBroadcast: async (data) => {
        try {
            return await api.post('/notifications/broadcast', data);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi gui thong bao');
        }
    },
};

export default notificationService;
