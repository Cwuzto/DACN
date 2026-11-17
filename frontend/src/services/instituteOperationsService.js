import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    if (error?.response?.data) return error.response.data;
    return { success: false, message: error?.message || fallbackMessage };
};

export const instituteOperationsService = {
    getOperations: async ({ tab = 'review', semesterId, status, page = 1, pageSize = 20 } = {}, { signal } = {}) => {
        try {
            const params = { tab, page, pageSize };
            if (semesterId !== undefined && semesterId !== null && semesterId !== '') {
                params.semesterId = semesterId;
            }
            if (status !== undefined && status !== null && status !== '' && status !== 'ALL') {
                params.status = status;
            }
            return await api.get('/institute/operations', { params, signal });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải dữ liệu hàng đợi điều hành học vụ');
        }
    },
};

export default instituteOperationsService;
