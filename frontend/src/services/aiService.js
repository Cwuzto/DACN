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

    /**
     * 4. Gợi ý nhận xét học thuật & rubric tự động
     * @param {{ contextType?: string, topicTitle?: string, studentName?: string, scores?: object, notes?: string }} payload
     */
    generateFeedback: async (payload) => {
        try {
            return await api.post('/ai/generate-feedback', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tạo gợi ý nhận xét với AI');
        }
    },

    /**
     * 5. Gợi ý bộ câu hỏi phản biện & chất vấn hội đồng
     * @param {{ topicTitle: string, description?: string, technologies?: string, major?: string }} payload
     */
    generateDefenseQuestions: async (payload) => {
        try {
            return await api.post('/ai/generate-defense-questions', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tạo câu hỏi phản biện với AI');
        }
    },

    /**
     * 6. Trợ lý hỏi đáp quy chế học vụ & tra cứu sổ tay đồ án
     * @param {{ message: string, history?: Array<{ role: string, content: string }> }} payload
     */
    chatRegulation: async (payload) => {
        try {
            return await api.post('/ai/regulation-chat', payload, { timeout: 120000 });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tra cứu quy chế học vụ với AI');
        }
    },
};

export default aiService;

