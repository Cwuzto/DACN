import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const dashboardService = {
    getStats: async () => {
        try {
            return await api.get('/dashboard/stats');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải thống kê tổng quan');
        }
    },

    getSemesterStats: async () => {
        try {
            return await api.get('/dashboard/semesters');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải biểu đồ học kỳ');
        }
    },

    getScores: async () => {
        try {
            return await api.get('/dashboard/scores');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải phân bổ điểm');
        }
    },

    getActivities: async () => {
        try {
            return await api.get('/dashboard/activities');
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

    getStudentStats: async () => {
        try {
            return await api.get('/dashboard/student');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi tải thống kê sinh viên');
        }
    },
};

export default dashboardService;


