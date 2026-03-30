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
            throw wrapServiceError(error, 'Loi tai thong ke tong quan');
        }
    },

    getSemesterStats: async () => {
        try {
            return await api.get('/dashboard/semesters');
        } catch (error) {
            throw wrapServiceError(error, 'Loi tai bieu do hoc ky');
        }
    },

    getScores: async () => {
        try {
            return await api.get('/dashboard/scores');
        } catch (error) {
            throw wrapServiceError(error, 'Loi tai phan bo diem');
        }
    },

    getActivities: async () => {
        try {
            return await api.get('/dashboard/activities');
        } catch (error) {
            throw wrapServiceError(error, 'Loi tai hoat dong gan day');
        }
    },

    getLecturerStats: async () => {
        try {
            return await api.get('/dashboard/lecturer');
        } catch (error) {
            throw wrapServiceError(error, 'Loi tai thong ke giang vien');
        }
    },

    getStudentStats: async () => {
        try {
            return await api.get('/dashboard/student');
        } catch (error) {
            throw wrapServiceError(error, 'Loi tai thong ke sinh vien');
        }
    },
};

export default dashboardService;
