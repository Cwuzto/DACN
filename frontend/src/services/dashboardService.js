import api from './api';

const dashboardService = {
    getStats: async () => {
        try {
            const response = await api.get('/dashboard/stats');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi tải thống kê tổng quan' };
        }
    },

    getSemesterStats: async () => {
        try {
            const response = await api.get('/dashboard/semesters');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi tải biểu đồ học kỳ' };
        }
    },

    getScores: async () => {
        try {
            const response = await api.get('/dashboard/scores');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi tải phân bổ điểm' };
        }
    },

    getActivities: async () => {
        try {
            const response = await api.get('/dashboard/activities');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi tải hoạt động gần đây' };
        }
    },

    getLecturerStats: async () => {
        try {
            const response = await api.get('/dashboard/lecturer');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi tải thống kê giảng viên' };
        }
    },

    getStudentStats: async () => {
        try {
            const response = await api.get('/dashboard/student');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Lỗi tải thống kê sinh viên' };
        }
    }
};

export default dashboardService;
