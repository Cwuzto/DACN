import api from './api';

const idempotencyConfig = (customKey) => ({
    headers: {
        'Idempotency-Key': customKey
            || globalThis.crypto?.randomUUID?.()
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
     * @param {Object} payload { registrationId, fileData: { assetId, fileUrl, fileName }, content, idempotencyKey }
     */
    submitInitialOutline: async (param1, param2, param3) => {
        try {
            let registrationId;
            let fileData;
            let content;
            let idempotencyKey;
            if (typeof param1 === 'object' && param1 !== null && ('registrationId' in param1 || 'fileData' in param1)) {
                registrationId = param1.registrationId;
                fileData = param1.fileData;
                content = param1.content;
                idempotencyKey = param1.idempotencyKey;
            } else {
                registrationId = param1;
                fileData = param2;
                content = param3;
            }
            const body = { registrationId, fileData };
            if (content !== undefined) {
                body.content = content;
            }
            return await api.post(
                '/outline/submissions',
                body,
                idempotencyConfig(idempotencyKey)
            );
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi nộp đề cương v1');
        }
    },

    /**
     * Nộp lại đề cương v2
     * POST /api/outline/resubmissions
     * @param {Object} payload { registrationId, fileData: { assetId, fileUrl, fileName }, content, idempotencyKey }
     */
    submitResubmission: async (param1, param2, param3) => {
        try {
            let registrationId;
            let fileData;
            let content;
            let idempotencyKey;
            if (typeof param1 === 'object' && param1 !== null && ('registrationId' in param1 || 'fileData' in param1)) {
                registrationId = param1.registrationId;
                fileData = param1.fileData;
                content = param1.content;
                idempotencyKey = param1.idempotencyKey;
            } else {
                registrationId = param1;
                fileData = param2;
                content = param3;
            }
            const body = { registrationId, fileData };
            if (content !== undefined) {
                body.content = content;
            }
            return await api.post(
                '/outline/resubmissions',
                body,
                idempotencyConfig(idempotencyKey)
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

    /**
     * Thẩm định đề cương (v1 hoặc v2)
     * POST /api/outline/reviews/:registrationId
     */
    reviewOutline: async (registrationId, data, idempotencyKey) => {
        try {
            return await api.post(
                `/outline/reviews/${registrationId}`,
                data,
                idempotencyConfig(idempotencyKey)
            );
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định đề cương');
        }
    },
};

export default outlineService;
