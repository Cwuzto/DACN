import api from './api.js';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const dashboardService = {
    getStats: async (semesterId = null) => {
        try {
            const config = semesterId ? { params: { semesterId } } : undefined;
            return await api.get('/dashboard/stats', config);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải thống kê tổng quan');
        }
    },

    getAdminActions: async (semesterId) => {
        try {
            return await api.get('/dashboard/admin-actions', { params: { semesterId } });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải danh sách việc cần xử lý');
        }
    },

    getSemesterStats: async () => {
        try {
            return await api.get('/dashboard/semesters');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải biểu đồ học kỳ');
        }
    },

    getSemesterOverview: async (params = {}) => {
        try {
            return await api.get('/dashboard/semester-overview', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải tổng quan học kỳ');
        }
    },

    getScores: async (semesterId = null) => {
        try {
            const config = semesterId ? { params: { semesterId } } : undefined;
            return await api.get('/dashboard/scores', config);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải phân bố điểm');
        }
    },

    getActivities: async (semesterId = null) => {
        try {
            const config = semesterId ? { params: { semesterId } } : undefined;
            return await api.get('/dashboard/activities', config);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải hoạt động gần đây');
        }
    },

    getLecturerStats: async () => {
        try {
            return await api.get('/dashboard/lecturer');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải thống kê giảng viên');
        }
    },

    getLecturerOverview: async ({ semesterId } = {}) => {
        try {
            const params = semesterId ? { semesterId } : undefined;
            return await api.get('/dashboard/lecturer', params ? { params } : undefined);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải tổng quan giảng viên');
        }
    },

    getStudentStats: async () => {
        try {
            return await api.get('/dashboard/student');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải thống kê sinh viên');
        }
    },
};

export default dashboardService;
