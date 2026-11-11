import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.message) return error;
    if (error?.response?.data?.message) return new Error(error.response.data.message);
    return new Error(fallbackMessage);
};

const rubricService = {
    getRubricVersions: async () => {
        try {
            return await api.get('/rubrics');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy danh sách phiên bản Rubric');
        }
    },

    getActiveRubric: async () => {
        try {
            return await api.get('/rubrics/active');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy barem điểm active');
        }
    },

    getRubricById: async (id) => {
        try {
            return await api.get(`/rubrics/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy chi tiết Rubric');
        }
    },

    createRubric: async (payload) => {
        try {
            return await api.post('/rubrics', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo phiên bản Rubric mới');
        }
    },

    updateRubric: async (id, payload) => {
        try {
            return await api.put(`/rubrics/${id}`, payload);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật phiên bản Rubric');
        }
    },

    activateRubric: async (id) => {
        try {
            return await api.post(`/rubrics/${id}/activate`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi kích hoạt phiên bản Rubric');
        }
    },

    deleteRubric: async (id) => {
        try {
            return await api.delete(`/rubrics/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xóa phiên bản Rubric');
        }
    },

    checkEditStatus: async () => {
        try {
            return await api.get('/rubrics/check-editable');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi kiểm tra trạng thái chỉnh sửa');
        }
    },

    lockRubric: async (id) => {
        try {
            return await api.post(`/rubrics/${id}/lock`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi khóa phiên bản Rubric');
        }
    },

    restoreDefault: async (id) => {
        try {
            return await api.post(`/rubrics/${id}/restore-default`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi khôi phục barem mẫu chuẩn');
        }
    },
};

export default rubricService;
