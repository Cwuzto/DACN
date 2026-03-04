import api from './api';

const evaluationService = {
    // Lấy danh sách nhóm do GVHD này hướng dẫn để chấm điểm
    getGradingGroups: async () => {
        try {
            const response = await api.get('/evaluations/grading-groups');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi lấy danh sách chấm điểm.' };
        }
    },

    // Thêm / Cập nhật điểm cho sinh viên
    submitEvaluations: async (groupId, evaluationType, evaluations) => {
        try {
            const response = await api.post('/evaluations', {
                groupId,
                evaluationType,
                evaluations
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi lưu điểm.' };
        }
    },

    // Lấy điểm của sinh viên hiện tại
    getMyGrades: async () => {
        try {
            const response = await api.get('/evaluations/my-grades');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi lấy điểm.' };
        }
    }
};

export default evaluationService;
