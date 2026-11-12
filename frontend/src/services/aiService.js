import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const aiService = {
    /**
     * 1. BM01 Copilot: Đánh giá đề cương 5 chiều logic và đưa ra gợi ý hoàn thiện
     * @param {{ registrationId?: number, outlineContent: object }} payload
     */
    analyzeBM01: async (payload) => {
        try {
            return await api.post('/ai/bm01-copilot', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể đánh giá đề cương với AI');
        }
    },

    /**
     * 2. Phát hiện tương đồng đề tài & gợi ý tên đề tài khoa học
     * @param {{ title: string, summary?: string, semesterId?: number }} payload
     */
    checkTopicSimilarity: async (payload) => {
        try {
            return await api.post('/ai/topic-similarity', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể kiểm tra tính mới đề tài với AI');
        }
    },

    /**
     * 3. Đối soát hồ sơ lưu chiểu tự động (Tên pháp lý BM02/BM02-A, MSSV, GVHD, Tính đồng bộ)
     * @param {number} registrationId
     */
    crossCheckArchive: async (registrationId) => {
        try {
            return await api.post('/ai/cross-check-archive', { registrationId });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể đối soát hồ sơ lưu chiểu với AI');
        }
    },
};

export default aiService;

