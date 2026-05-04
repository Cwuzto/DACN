import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const projectEnrollmentService = {
    getCatalogs: async () => {
        try {
            return await api.get('/project-enrollments/catalogs');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh mục tên đồ án');
        }
    },

    getEnrollments: async (params = {}) => {
        try {
            return await api.get('/project-enrollments', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách gán môn đồ án');
        }
    },

    bulkUpsert: async (items) => {
        try {
            return await api.post('/project-enrollments/bulk-upsert', { items });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi lưu gán môn đồ án');
        }
    },

    deleteEnrollment: async (id) => {
        try {
            return await api.delete(`/project-enrollments/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa gán môn đồ án');
        }
    },
};

export default projectEnrollmentService;

