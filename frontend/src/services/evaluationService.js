import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const evaluationService = {
    getGradingStudents: async (params = {}) => {
        try {
            return await api.get('/evaluations/grading-students', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy danh sách chấm điểm');
        }
    },

    submitDefenseResult: async (data) => {
        try {
            return await api.post('/evaluations/defense-result', data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lưu kết quả bảo vệ');
        }
    },

    getMyGrades: async () => {
        try {
            return await api.get('/evaluations/my-grades');
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy điểm');
        }
    },
};

export default evaluationService;

