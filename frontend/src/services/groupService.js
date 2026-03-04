import api from './api';

const groupService = {
    // Lấy thông tin nhóm của bản thân (nếu có)
    getMyGroup: async () => {
        try {
            const response = await api.get('/groups/my-group');
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi tải thông tin nhóm.' };
        }
    },

    // Tạo nhóm mới
    createGroup: async (groupData) => {
        try {
            const response = await api.post('/groups', groupData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi tạo nhóm.' };
        }
    },

    // Mời thành viên bằng email
    inviteMember: async (groupId, studentEmail) => {
        try {
            const response = await api.post(`/groups/${groupId}/invite`, { studentEmail });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi mời thành viên.' };
        }
    },

    // Xử lý lời mời (ACCEPT/REJECT)
    handleInvitation: async (groupId, action) => {
        try {
            const response = await api.post(`/groups/${groupId}/accept`, { action });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi nhận lời mời.' };
        }
    },

    // Đăng ký đề tài
    registerTopic: async (groupId, topicId) => {
        try {
            const response = await api.post(`/groups/${groupId}/register-topic`, { topicId });
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi đăng ký đề tài.' };
        }
    },

    // Xóa thành viên / Rời nhóm
    removeMember: async (groupId, studentId) => {
        try {
            const response = await api.delete(`/groups/${groupId}/members/${studentId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { success: false, message: 'Đã xảy ra lỗi khi xóa thành viên.' };
        }
    }
};

export default groupService;
