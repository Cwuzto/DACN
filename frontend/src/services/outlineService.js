import api from './api';

const idempotencyConfig = () => ({
    headers: {
        'Idempotency-Key': globalThis.crypto?.randomUUID?.()
            || `outline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
});

const wrapServiceError = (error, fallbackMessage) => {
    if (error && typeof error === 'object') {
        return {
            success: false,
            message: error.message || fallbackMessage,
            error: error.error || error.code || null,
            ...error,
        };
    }
    return { success: false, message: fallbackMessage };
};

export const outlineService = {
    /**
     * Nộp đề cương đợt 1 (v1)
     * POST /api/outline/submissions
     * @param {Object} payload { registrationId, fileData: { fileUrl, fileName } }
     */
    submitInitialOutline: async (param1, param2) => {
        try {
            let registrationId;
            let fileData;
            if (typeof param1 === 'object' && param1 !== null && ('registrationId' in param1 || 'fileData' in param1)) {
                registrationId = param1.registrationId;
                fileData = param1.fileData;
            } else {
                registrationId = param1;
                fileData = param2;
            }
            return await api.post(
                '/outline/submissions',
                { registrationId, fileData },
                idempotencyConfig()
            );
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp đề cương v1');
        }
    },

    /**
     * Nộp lại đề cương v2
     * POST /api/outline/resubmissions
     * @param {Object} payload { registrationId, fileData: { fileUrl, fileName } }
     */
    submitResubmission: async (param1, param2) => {
        try {
            let registrationId;
            let fileData;
            if (typeof param1 === 'object' && param1 !== null && ('registrationId' in param1 || 'fileData' in param1)) {
                registrationId = param1.registrationId;
                fileData = param1.fileData;
            } else {
                registrationId = param1;
                fileData = param2;
            }
            return await api.post(
                '/outline/resubmissions',
                { registrationId, fileData },
                idempotencyConfig()
            );
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp lại đề cương v2');
        }
    },

    /**
     * Lấy thông tin đề cương của sinh viên hiện tại
     * GET /api/outline/my-outline
     * @param {number|Object} [semesterIdOrParams]
     */
    getMyOutline: async (param) => {
        try {
            let params = {};
            if (typeof param === 'object' && param !== null) {
                params = param;
            } else if (param !== undefined && param !== null) {
                params = { semesterId: param };
            }
            return await api.get('/outline/my-outline', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải thông tin đề cương');
        }
    },
};

export default outlineService;
