import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const userService = {
    getPublicLecturers: async (params = {}) => {
        try {
            return await api.get('/users/public-lecturers', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách giảng viên công khai');
        }
    },

    getUsers: async (params = {}) => {
        try {
            return await api.get('/users', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách người dùng');
        }
    },

    createUser: async (userData) => {
        try {
            return await api.post('/users', userData);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tạo người dùng');
        }
    },

    updateUser: async (id, userData) => {
        try {
            return await api.put(`/users/${id}`, userData);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật người dùng');
        }
    },

    deleteUser: async (id) => {
        try {
            return await api.delete(`/users/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa người dùng');
        }
    },

    toggleActive: async (id) => {
        try {
            return await api.patch(`/users/${id}/toggle-active`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi thay đổi trạng thái');
        }
    },

    resetPassword: async (id) => {
        try {
            return await api.post(`/users/${id}/reset-password`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi reset mật khẩu');
        }
    },

    getUserPermissions: async (id) => {
        try {
            return await api.get(`/users/${id}/permissions`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải quyền người dùng');
        }
    },

    updateUserPermissionGroups: async (id, groupIds) => {
        try {
            return await api.post(`/users/${id}/permission-groups`, { groupIds });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật nhóm quyền');
        }
    },

    downloadTemplate: async (role = 'STUDENT') => {
        try {
            const blobData = await api.get('/users/template', {
                params: { role },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([blobData]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', role === 'LECTURER' ? 'Mau_Import_Giang_Vien.xlsx' : 'Mau_Import_Sinh_Vien.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            return { success: true };
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải file mẫu Excel');
        }
    },

    importUsersExcel: async (payload) => {
        try {
            return await api.post('/users/import-excel', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi import danh sách người dùng');
        }
    },

    exportUsersExcel: async (params = {}) => {
        try {
            const blobData = await api.get('/users/export-excel', {
                params,
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([blobData]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Danh_sach_nguoi_dung_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            return { success: true };
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xuất danh sách người dùng ra Excel');
        }
    },
};

export default userService;
