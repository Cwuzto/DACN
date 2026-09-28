import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

// Backend mount tại /permissions (router.use('/permissions', permissionRoutes))
// Các route bên trong:
//   GET  /permissions          → list permissions
//   GET  /permission-groups    → list groups
//   POST /permission-groups    → create group
//   etc.
// Vậy full path = /api/permissions/permissions, /api/permissions/permission-groups, ...

const permissionService = {
    /** GET /api/permissions/permissions — danh sách permission nguyên tử */
    listPermissions: async () => {
        try {
            return await api.get('/permissions/permissions');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách quyền');
        }
    },

    /** GET /api/permissions/permission-groups — danh sách nhóm quyền */
    listGroups: async () => {
        try {
            return await api.get('/permissions/permission-groups');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách nhóm quyền');
        }
    },

    /** GET /api/permissions/permission-groups/:id */
    getGroup: async (id) => {
        try {
            return await api.get(`/permissions/permission-groups/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải nhóm quyền');
        }
    },

    /** POST /api/permissions/permission-groups */
    createGroup: async (data) => {
        try {
            return await api.post('/permissions/permission-groups', data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tạo nhóm quyền');
        }
    },

    /** PUT /api/permissions/permission-groups/:id */
    updateGroup: async (id, data) => {
        try {
            return await api.put(`/permissions/permission-groups/${id}`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi cập nhật nhóm quyền');
        }
    },

    /** DELETE /api/permissions/permission-groups/:id */
    deleteGroup: async (id) => {
        try {
            return await api.delete(`/permissions/permission-groups/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa nhóm quyền');
        }
    },
};

export default permissionService;
