import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const manualReviewService = {
    listCases: async (params = {}) => {
        try {
            return await api.get('/manual-review-cases', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách hồ sơ thẩm định');
        }
    },

    getCaseDetail: async (id) => {
        try {
            return await api.get(`/manual-review-cases/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải chi tiết hồ sơ thẩm định');
        }
    },

    resolveCase: async (id, data) => {
        try {
            return await api.post(`/manual-review-cases/${id}/resolve`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi giải quyết hồ sơ thẩm định');
        }
    },
};

export default manualReviewService;
