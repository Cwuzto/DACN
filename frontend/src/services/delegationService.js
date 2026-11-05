import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

export const delegationService = {
    /**
     * Lấy danh sách ủy quyền chuyên môn theo bộ lọc
     */
    getDelegations: async (params = {}) => {
        try {
            return await api.get('/delegations', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải danh sách ủy quyền chuyên môn');
        }
    },

    /**
     * Tạo ủy quyền chuyên môn mới kèm Idempotency-Key
     */
    createDelegation: async (payload, idempotencyKey) => {
        try {
            const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `delegation-${Date.now()}-${Math.random()}`);
            return await api.post('/delegations', payload, {
                headers: {
                    'Idempotency-Key': key,
                },
            });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tạo ủy quyền chuyên môn');
        }
    },

    /**
     * Thu hồi ủy quyền chuyên môn
     */
    revokeDelegation: async (id) => {
        try {
            return await api.delete(`/delegations/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể thu hồi ủy quyền chuyên môn');
        }
    },
};

export default delegationService;
