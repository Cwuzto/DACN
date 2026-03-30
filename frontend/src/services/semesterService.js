import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

export const semesterService = {
    getAll: async () => {
        try {
            return await api.get('/semesters');
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tai danh sach hoc ky');
        }
    },

    getById: async (id) => {
        try {
            return await api.get(`/semesters/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tai chi tiet hoc ky');
        }
    },

    create: async (data) => {
        try {
            return await api.post('/semesters', data);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi tao hoc ky');
        }
    },

    update: async (id, data) => {
        try {
            return await api.put(`/semesters/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi cap nhat hoc ky');
        }
    },

    delete: async (id) => {
        try {
            return await api.delete(`/semesters/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Da xay ra loi khi xoa hoc ky');
        }
    },
};
