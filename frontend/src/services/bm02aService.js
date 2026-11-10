import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    if (error?.response?.data) return error.response.data;
    return { success: false, message: error?.message || fallbackMessage };
};

const idempotencyConfig = () => ({
    headers: {
        'Idempotency-Key': globalThis.crypto?.randomUUID?.()
            || `bm02a-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
});

const bm02aService = {
    /**
     * POST /api/bm02a/requests
     * Create initial BM02-A request (v1, revisionCount=0, status=STUDENT_PREPARING)
     */
    createRequest: async (data) => {
        try {
            return await api.post('/bm02a/requests', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo đơn điều chỉnh tên đề tài BM02-A');
        }
    },

    /**
     * POST /api/bm02a/requests/:id/student-sign-submit
     * Student electronic signature and submit
     */
    studentSignSubmit: async (id, data) => {
        try {
            return await api.post(`/bm02a/requests/${id}/student-sign-submit`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi sinh viên ký nộp BM02-A');
        }
    },

    /**
     * POST /api/bm02a/requests/:id/advisor-sign
     * Advisor electronic signature
     */
    advisorSign: async (id, data) => {
        try {
            return await api.post(`/bm02a/requests/${id}/advisor-sign`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi GVHD ký duyệt BM02-A');
        }
    },

    /**
     * POST /api/bm02a/requests/:id/department-sign
     * Department Head electronic signature and final approval
     */
    departmentSign: async (id, data) => {
        try {
            return await api.post(`/bm02a/requests/${id}/department-sign`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi Phụ trách bộ môn ký duyệt BM02-A');
        }
    },

    /**
     * POST /api/bm02a/requests/:id/return
     * Return for correction (v1 within 168h) or final rejection
     */
    returnRequest: async (id, data) => {
        try {
            return await api.post(`/bm02a/requests/${id}/return`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi trả lại yêu cầu BM02-A');
        }
    },

    /**
     * POST /api/bm02a/requests/:id/revise
     * Revise request and create v2 version (strictly when revisionCount === 0 and within 168h)
     */
    reviseRequest: async (id, data) => {
        try {
            return await api.post(`/bm02a/requests/${id}/revise`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp lại bản sửa đổi v2 BM02-A');
        }
    },

    /**
     * GET /api/bm02a/requests/:id
     */
    getRequestById: async (id) => {
        try {
            return await api.get(`/bm02a/requests/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải chi tiết yêu cầu BM02-A');
        }
    },

    /**
     * GET /api/bm02a/registrations/:registrationId
     */
    getRequestsByRegistration: async (registrationId) => {
        try {
            return await api.get(`/bm02a/registrations/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách yêu cầu BM02-A');
        }
    },

    /**
     * GET /api/bm02a/pending
     */
    getPendingQueue: async (params = {}) => {
        try {
            return await api.get('/bm02a/pending', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải hàng đợi duyệt BM02-A');
        }
    },

    /**
     * POST /api/title-adjustment-appendices
     * Create appendix draft
     */
    createAppendix: async (data) => {
        try {
            return await api.post('/title-adjustment-appendices', data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo dự thảo phụ lục điều chỉnh');
        }
    },

    /**
     * PUT /api/title-adjustment-appendices/:id/items
     * Update appendix items
     */
    updateAppendixItems: async (id, data) => {
        try {
            return await api.put(`/title-adjustment-appendices/${id}/items`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật danh sách đề tài phụ lục');
        }
    },

    /**
     * POST /api/title-adjustment-appendices/:id/issue
     * Issue appendix
     */
    issueAppendix: async (id, data = {}) => {
        try {
            return await api.post(`/title-adjustment-appendices/${id}/issue`, data, idempotencyConfig());
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ban hành phụ lục điều chỉnh');
        }
    },

    /**
     * GET /api/title-adjustment-appendices/:id
     */
    getAppendixById: async (id) => {
        try {
            return await api.get(`/title-adjustment-appendices/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải chi tiết phụ lục');
        }
    },

    /**
     * GET /api/title-adjustment-appendices/decisions/:decisionId
     */
    getAppendices: async (decisionId) => {
        try {
            return await api.get(`/title-adjustment-appendices/decisions/${decisionId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải danh sách phụ lục theo quyết định');
        }
    },
};

export const {
    createRequest,
    studentSignSubmit,
    advisorSign,
    departmentSign,
    returnRequest,
    reviseRequest,
    getRequestById,
    getRequestsByRegistration,
    getPendingQueue,
    createAppendix,
    updateAppendixItems,
    issueAppendix,
    getAppendixById,
    getAppendices,
} = bm02aService;

export default bm02aService;
