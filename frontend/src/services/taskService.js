import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const taskService = {
    getTasksByRegistration: async (registrationId) => {
        try {
            return await api.get(`/tasks/registration/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi lay danh sach task');
        }
    },

    createTask: async (taskData) => {
        try {
            return await api.post('/tasks', taskData);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tao task');
        }
    },

    submitTask: async (taskId, submissionData) => {
        try {
            return await api.post(`/tasks/${taskId}/submit`, submissionData);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi nop bai');
        }
    },

    gradeSubmission: async (submissionId, gradeData) => {
        try {
            return await api.post(`/tasks/submission/${submissionId}/grade`, gradeData);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi cham diem');
        }
    },
};

export default taskService;
