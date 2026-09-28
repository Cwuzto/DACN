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
};

export default meetingLogService;
