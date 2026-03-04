import api from './api';

const taskService = {
    // Lấy danh sách nhiệm vụ của một nhóm
    getTasksByGroup: async (groupId) => {
        try {
            const response = await api.get(`/tasks/group/${groupId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi lấy danh sách Task.' };
        }
    },

    // Giảng viên tạo task mới
    createTask: async (taskData) => {
        try {
            const response = await api.post('/tasks', taskData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi tạo task.' };
        }
    },

    // Sinh viên nộp báo cáo
    submitTask: async (taskId, submissionData) => {
        try {
            const response = await api.post(`/tasks/${taskId}/submit`, submissionData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi nộp bài.' };
        }
    },

    // Giảng viên nhận xét và chấm điểm
    gradeSubmission: async (submissionId, gradeData) => {
        try {
            const response = await api.post(`/tasks/submission/${submissionId}/grade`, gradeData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi chấm điểm.' };
        }
    }
};

export default taskService;
