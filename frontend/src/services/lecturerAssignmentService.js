import api, { apiClient } from './api.js';

const client = apiClient || api;

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.message) return error;
    if (error?.response?.data?.message) {
        return new Error(error.response.data.message);
    }
    return new Error(fallbackMessage);
};

export const lecturerAssignmentService = {
    /**
     * Lấy danh sách phân công giảng viên trong đợt đồ án
     * @param {Object} params { semesterId, projectCatalogId, lecturerId, status }
     */
    getAll: async (params = {}) => {
        try {
            const queryParams = {};
            if (params.semesterId) queryParams.semesterId = params.semesterId;
            if (params.projectCatalogId) queryParams.projectCatalogId = params.projectCatalogId;
            if (params.lecturerId) queryParams.lecturerId = params.lecturerId;
            if (params.status) queryParams.status = params.status;

            return await client.get('/lecturer-assignments', { params: queryParams });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách phân công giảng viên');
        }
    },

    /**
     * Lấy danh sách giảng viên khả dụng cho đợt đồ án (chưa được phân công & chưa đạt đỉnh tải)
     * @param {Object} params { semesterId, projectCatalogId }
     */
    getAvailableLecturers: async (params = {}) => {
        try {
            const queryParams = {};
            if (params.semesterId) queryParams.semesterId = params.semesterId;
            if (params.projectCatalogId) queryParams.projectCatalogId = params.projectCatalogId;

            return await client.get('/lecturer-assignments/available-lecturers', { params: queryParams });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách giảng viên khả dụng');
        }
    },

    /**
     * Lấy thông tin tổng quan điều phối đợt đồ án
     * @param {Object} params { semesterId, projectCatalogId }
     */
    getOverview: async (params = {}) => {
        try {
            const queryParams = {};
            if (params.semesterId) queryParams.semesterId = params.semesterId;
            if (params.projectCatalogId) queryParams.projectCatalogId = params.projectCatalogId;

            return await client.get('/lecturer-assignments/overview', { params: queryParams });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải tổng quan điều phối đợt đồ án');
        }
    },

    /**
     * Tạo phân công giảng viên mới với kiểm tra sweep capacity
     * @param {Object} data { lecturerId, semesterId, projectCatalogId, plannedQuota, status }
     */
    create: async (data) => {
        try {
            return await client.post('/lecturer-assignments', data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tạo phân công giảng viên');
        }
    },

    /**
     * Cập nhật chỉ tiêu hoặc trạng thái phân công giảng viên
     * @param {number|string} id 
     * @param {Object} data { plannedQuota, status }
     */
    update: async (id, data) => {
        try {
            return await client.put(`/lecturer-assignments/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật phân công giảng viên');
        }
    },

    /**
     * Xóa hoặc đóng phân công giảng viên
     * @param {number|string} id 
     * @param {Object} options { closeIfActive: boolean }
     */
    deleteAssignment: async (id, options = {}) => {
        try {
            const params = {};
            if (options.closeIfActive !== undefined) {
                params.closeIfActive = options.closeIfActive;
            }
            return await client.delete(`/lecturer-assignments/${id}`, { params });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa phân công giảng viên');
        }
    },

    /**
     * Gán / cập nhật hàng loạt phân công giảng viên (từ Excel hoặc sao chép)
     * @param {Array|Object} data mảng items hoặc { items: [...] }
     */
    bulkUpsert: async (data) => {
        try {
            const payload = Array.isArray(data) ? { items: data } : data;
            return await client.post('/lecturer-assignments/bulk-upsert', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật phân công hàng loạt');
        }
    },
};

export default lecturerAssignmentService;
