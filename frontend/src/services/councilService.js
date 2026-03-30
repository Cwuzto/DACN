import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const councilService = {
    getCouncils: async (params = {}) => {
        try {
            return await api.get('/councils', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi tai danh sach hoi dong');
        }
    },

    getCouncilById: async (id) => {
        try {
            return await api.get(`/councils/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi tai chi tiet hoi dong');
        }
    },

    createCouncil: async (data) => {
        try {
            return await api.post('/councils', data);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi tao hoi dong');
        }
    },

    updateCouncil: async (id, data) => {
        try {
            return await api.put(`/councils/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi cap nhat hoi dong');
        }
    },

    deleteCouncil: async (id) => {
        try {
            return await api.delete(`/councils/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi xoa hoi dong');
        }
    },

    assignRegistrations: async (id, registrationIds) => {
        try {
            return await api.post(`/councils/${id}/assign`, { registrationIds });
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi phan cong sinh vien');
        }
    },

    removeRegistration: async (id, registrationId) => {
        try {
            return await api.post(`/councils/${id}/remove-registration`, { registrationId });
        } catch (error) {
            throw wrapServiceError(error, 'Loi khi go sinh vien khoi hoi dong');
        }
    },
};

export default councilService;
