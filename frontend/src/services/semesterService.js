import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

export const semesterService = {
    getAll: async () => {
        try {
            return await api.get('/semesters');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách học kỳ');
        }
    },

    getById: async (id) => {
        try {
            return await api.get(`/semesters/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải chi tiết học kỳ');
        }
    },

    create: async (data) => {
        try {
            return await api.post('/semesters', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo học kỳ');
        }
    },

    update: async (id, data) => {
        try {
            return await api.put(`/semesters/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật học kỳ');
        }
    },

    toggleRegistration: async (id, registrationOpen) => {
        try {
            return await api.patch(`/semesters/${id}/registration-toggle`, { registrationOpen });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật trạng thái đăng ký');
        }
    },

    delete: async (id) => {
        try {
            return await api.delete(`/semesters/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xóa học kỳ');
        }
    },
};
