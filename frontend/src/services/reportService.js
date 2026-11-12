import api from './api.js';

/**
 * Service kết nối các API Academic BI & Reporting Hub
 */
export const reportService = {
    /**
     * Lấy báo cáo tổng quan học vụ (KPI, phổ điểm, phễu tiến độ, so sánh chuyên ngành)
     * @param {Object} params - { semesterId }
     */
    getOverview: async (params = {}) => {
        const response = await api.get('/reports/overview', { params });
        return response?.data !== undefined ? response.data : response;
    },

    /**
     * Lấy danh sách thống kê khối lượng giảng dạy & độ lệch điểm của Giảng viên
     * @param {Object} params - { semesterId }
     */
    getLecturerWorkload: async (params = {}) => {
        const response = await api.get('/reports/lecturer-workload', { params });
        return response?.data !== undefined ? response.data : response;
    },

    /**
     * Xuất toàn bộ báo cáo tổng hợp & chi tiết ra file Excel đa sheet
     * @param {Object} params - { semesterId }
     */
    exportExcel: async (params = {}) => {
        const response = await api.get('/reports/export-excel', {
            params,
            responseType: 'blob',
        });
        return response?.data !== undefined ? response.data : response;
    },
};

export default reportService;
