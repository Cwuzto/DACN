import api from './api';

/**
 * Service cho PublicAnnouncement API
 * Backend routes: GET/POST/PUT/DELETE /api/announcements
 */
export const announcementService = {
    /**
     * Lấy danh sách thông báo (public hoặc admin)
     * @param {Object} params - Query params
     * @param {number} [params.page=1]
     * @param {number} [params.limit=10]
     * @param {string} [params.category] - 'ANNOUNCEMENT' | 'NEWS' | 'ALL'
     * @param {string} [params.search]
     * @param {boolean} [params.all] - true để Admin xem cả bài chưa publish
     */
    getAnnouncements(params = {}) {
        return api.get('/announcements', { params });
    },

    /**
     * Lấy chi tiết một thông báo
     * @param {number} id
     */
    getAnnouncementById(id) {
        return api.get(`/announcements/${id}`);
    },

    /**
     * Tạo thông báo mới (Admin only)
     * @param {Object} data
     * @param {string} data.title - Bắt buộc
     * @param {string} [data.content]
     * @param {string} [data.category]
     * @param {string} [data.fileUrl]
     * @param {string} [data.fileName]
     * @param {boolean} [data.isPinned]
     * @param {boolean} [data.isPublished]
     */
    createAnnouncement(data) {
        return api.post('/announcements', data);
    },

    /**
     * Cập nhật thông báo (Admin only)
     * @param {number} id
     * @param {Object} data - Partial fields to update
     */
    updateAnnouncement(id, data) {
        return api.put(`/announcements/${id}`, data);
    },

    /**
     * Xóa thông báo (Admin only)
     * @param {number} id
     */
    deleteAnnouncement(id) {
        return api.delete(`/announcements/${id}`);
    },
};

export default announcementService;
