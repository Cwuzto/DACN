import api from './api';

const councilService = {
    // Lấy danh sách hội đồng
    getCouncils: async (params = {}) => {
        try {
            const response = await api.get('/councils', { params });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi tải danh sách hội đồng.' };
        }
    },

    // Lấy chi tiết một hội đồng
    getCouncilById: async (id) => {
        try {
            const response = await api.get(`/councils/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi tải chi tiết hội đồng.' };
        }
    },

    // Tạo hội đồng mới
    createCouncil: async (data) => {
        try {
            const response = await api.post('/councils', data);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi tạo hội đồng.' };
        }
    },

    // Cập nhật hội đồng
    updateCouncil: async (id, data) => {
        try {
            const response = await api.put(`/councils/${id}`, data);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi cập nhật hội đồng.' };
        }
    },

    // Xóa hội đồng
    deleteCouncil: async (id) => {
        try {
            const response = await api.delete(`/councils/${id}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi xóa hội đồng.' };
        }
    },

    // Phân công nhóm vào hội đồng
    assignGroups: async (id, groupIds) => {
        try {
            const response = await api.post(`/councils/${id}/assign`, { groupIds });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi phân công nhóm.' };
        }
    },

    // Gỡ nhóm khỏi hội đồng
    removeGroup: async (id, groupId) => {
        try {
            const response = await api.post(`/councils/${id}/remove-group`, { groupId });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi khi gỡ nhóm khỏi hội đồng.' };
        }
    }
};

export default councilService;
