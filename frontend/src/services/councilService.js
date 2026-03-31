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
            throw wrapServiceError(error, 'Lỗi khi tải danh sách hội đồng');
        }
    },

    getCouncilById: async (id) => {
        try {
            return await api.get(`/councils/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải chi tiết hội đồng');
        }
    },

    createCouncil: async (data) => {
        try {
            return await api.post('/councils', data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tạo hội đồng');
        }
    },

    updateCouncil: async (id, data) => {
        try {
            return await api.put(`/councils/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật hội đồng');
        }
    },

    deleteCouncil: async (id) => {
        try {
            return await api.delete(`/councils/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa hội đồng');
        }
    },

    assignRegistrations: async (id, registrationIds) => {
        try {
            return await api.post(`/councils/${id}/assign`, { registrationIds });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi phân công sinh viên');
        }
    },

    removeRegistration: async (id, registrationId) => {
        try {
            return await api.post(`/councils/${id}/remove-registration`, { registrationId });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi gỡ sinh viên khỏi hội đồng');
        }
    },
};

export default councilService;


