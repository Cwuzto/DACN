import api from './api';

export const semesterService = {
    getAll: () => {
        return api.get('/semesters');
    },

    getById: (id) => {
        return api.get(`/semesters/${id}`);
    },

    create: (data) => {
        return api.post('/semesters', data);
    },

    update: (id, data) => {
        return api.put(`/semesters/${id}`, data);
    },

    delete: (id) => {
        return api.delete(`/semesters/${id}`);
    }
};
