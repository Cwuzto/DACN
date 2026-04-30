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

    getAdminDefenseCenter: async (params = {}) => {
        try {
            return await api.get('/evaluations/admin-defense-center', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải dữ liệu trung tâm hội đồng');
        }
    },

    remindDefenseGrading: async (registrationIds) => {
        try {
            return await api.post('/evaluations/admin-defense-center/remind-grading', { registrationIds });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi gửi nhắc chấm điểm');
        }
    },

    setDefenseScoreLock: async (id, action) => {
        try {
            return await api.patch(`/evaluations/admin-defense-center/${id}/score-lock`, { action });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi khóa/mở khóa điểm');
        }
    },

    exportScoreSheetPdf: async (registrationId) => {
        try {
            return await api.post(`/evaluations/${registrationId}/score-sheet/export-pdf`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xuất PDF bảng điểm');
        }
    },

    getScoreSheet: async (registrationId) => {
        try {
            return await api.get(`/evaluations/${registrationId}/score-sheet`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải bảng điểm chi tiết');
        }
    },

    saveScoreSheet: async (registrationId, data) => {
        try {
            return await api.put(`/evaluations/${registrationId}/score-sheet`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lưu bảng điểm chi tiết');
        }
    },
};

export default evaluationService;
