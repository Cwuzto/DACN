import api from './api';

// ============================
// TOPIC SERVICE
// Tất cả API liên quan đến Quản lý Đề tài
// ============================

export const topicService = {
    /**
     * Lấy danh sách đề tài
     * @param {Object} params - { status, semesterId, mentorId, search }
     */
    getAll: (params = {}) => {
        return api.get('/topics', { params });
    },

    /**
     * Xem chi tiết 1 đề tài
     */
    getById: (id) => {
        return api.get(`/topics/${id}`);
    },

    /**
     * Tạo đề tài mới
     * @param {Object} data - { title, description, semesterId, mentorId, maxGroups, status }
     */
    create: (data) => {
        return api.post('/topics', data);
    },

    /**
     * Cập nhật đề tài
     */
    update: (id, data) => {
        return api.put(`/topics/${id}`, data);
    },

    /**
     * Xóa đề tài
     */
    delete: (id) => {
        return api.delete(`/topics/${id}`);
    },

    /**
     * Lấy danh sách đề tài sinh viên đề xuất chờ duyệt (Lecturer / Admin)
     */
    getApprovals: (params = {}) => {
        return api.get('/topics/approvals', { params });
    },

    /**
     * Duyệt / Từ chối đề tài (Admin/Lecturer)
     * @param {number} id
     * @param {Object} data - { status: 'APPROVED'|'REJECTED', rejectReason?: string }
     */
    changeStatus: (id, data) => {
        return api.patch(`/topics/${id}/status`, data);
    },
};
