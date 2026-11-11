// src/services/meetingLogService.js
import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

export const meetingLogService = {
    getMeetingLogs: async (registrationId) => {
        try {
            return await api.get(`/registrations/${registrationId}/meeting-logs`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy danh sách nhật ký gặp gỡ');
        }
    },

    getMeetingStats: async (registrationId) => {
        try {
            return await api.get(`/registrations/${registrationId}/meeting-stats`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi lấy thống kê nhật ký gặp gỡ');
        }
    },

    createMeetingLog: async (registrationId, data) => {
        try {
            return await api.post(`/registrations/${registrationId}/meeting-logs`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ghi nhận nhật ký buổi gặp');
        }
    },

    updateMeetingLog: async (logId, data) => {
        try {
            return await api.put(`/meeting-logs/${logId}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi cập nhật nhật ký');
        }
    },

    deleteMeetingLog: async (logId) => {
        try {
            return await api.delete(`/meeting-logs/${logId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi xóa nhật ký');
        }
    },

    // ==========================================
    // BM03 Core Methods (Task 5 & Task 7)
    // ==========================================
    getBM03Record: async (registrationId) => {
        try {
            return await api.get(`/bm03/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tải phiếu BM03');
        }
    },

    createMeetingEntry: async (registrationId, data) => {
        try {
            return await api.post(`/bm03/${registrationId}/meetings`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi tạo nhật ký buổi hướng dẫn');
        }
    },

    signMeetingEntry: async (meetingId, data = {}) => {
        try {
            return await api.post(`/bm03/meetings/${meetingId}/sign`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi ký khóa buổi hướng dẫn');
        }
    },

    submitStageEvaluation: async (registrationId, data = {}) => {
        try {
            const endpoint = data.stage === 'MIDTERM' ? 'midterm-evaluation' : 'final-evaluation';
            return await api.post(`/bm03/${registrationId}/${endpoint}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi gửi đánh giá giai đoạn');
        }
    },

    advisorSignWholeBM03: async (bm03RecordId, data = {}) => {
        try {
            return await api.post(`/bm03/${bm03RecordId}/advisor-sign`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi GVHD ký toàn phiếu BM03');
        }
    },

    studentAcknowledgeBM03: async (bm03RecordId, data = {}) => {
        try {
            const endpoint = data?.action === 'DECLINED_TO_ACKNOWLEDGE' ? 'student-decline' : 'student-acknowledge';
            return await api.post(`/bm03/${bm03RecordId}/${endpoint}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi sinh viên xác nhận BM03');
        }
    },

    requestMoreInfoForStopReview: async (stopReviewId, data = {}) => {
        try {
            return await api.post(`/bm03/stop-reviews/${stopReviewId}/request-more-info`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi yêu cầu bổ sung thông tin');
        }
    },

    decideStopReview: async (stopReviewId, data = {}) => {
        try {
            return await api.post(`/bm03/stop-reviews/${stopReviewId}/decision`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Đã xảy ra lỗi khi thẩm định đề nghị dừng BM03');
        }
    },
};

export default meetingLogService;
