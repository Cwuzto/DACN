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
            throw wrapServiceError(error, 'Da xay ra loi khi lay danh sach cham diem');
        }
    },

    submitDefenseResult: async (data) => {
        try {
            return await api.post('/evaluations/defense-result', data);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi luu ket qua bao ve');
        }
    },

    getMyGrades: async () => {
        try {
            return await api.get('/evaluations/my-grades');
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi lay diem');
        }
    },
};

export default evaluationService;
