import api from './api.js';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const projectEnrollmentService = {
    getCatalogs: async () => {
        try {
            return await api.get('/project-enrollments/catalogs');
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh mục tên đồ án');
        }
    },

    getEnrollments: async (params = {}) => {
        try {
            return await api.get('/project-enrollments', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải danh sách gán môn đồ án');
        }
    },

    bulkUpsert: async (items) => {
        try {
            return await api.post('/project-enrollments/bulk-upsert', { items });
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi lưu gán môn đồ án');
        }
    },

    /** Gán môn đồ án cho 1 sinh viên */
    createEnrollment: async ({ semesterId, projectCatalogId, studentId, note, status = 'ACTIVE', source = 'MANUAL' }) => {
        try {
            return await projectEnrollmentService.bulkUpsert([
                { semesterId, projectCatalogId, studentId, note, status, source },
            ]);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi gán môn đồ án');
        }
    },

    /** Gán môn đồ án hàng loạt cho danh sách sinh viên */
    bulkAssign: async ({ semesterId, projectCatalogId, studentIds = [], note, status = 'ACTIVE', source = 'MANUAL' }) => {
        try {
            const items = (studentIds || []).map((studentId) => ({
                semesterId,
                projectCatalogId,
                studentId,
                note,
                status,
                source,
            }));
            return await projectEnrollmentService.bulkUpsert(items);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi gán môn đồ án hàng loạt');
        }
    },

    deleteEnrollment: async (id) => {
        try {
            return await api.delete(`/project-enrollments/${id}`);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xóa gán môn đồ án');
        }
    },

    downloadTemplate: async () => {
        try {
            const blobData = await api.get('/project-enrollments/template', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([blobData]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Mau_Gan_Mon_Do_An.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            return { success: true };
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi tải file mẫu gán đồ án');
        }
    },

    importEnrollmentsExcel: async (payload) => {
        try {
            return await api.post('/project-enrollments/import-excel', payload);
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi import danh sách gán đồ án');
        }
    },

    exportEnrollmentsExcel: async (params = {}) => {
        try {
            const blobData = await api.get('/project-enrollments/export-excel', {
                params,
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([blobData]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Danh_sach_gan_do_an_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            return { success: true };
        } catch (error) {
            throw wrapServiceError(error, 'Lỗi khi xuất danh sách gán đồ án ra Excel');
        }
    },
};

export default projectEnrollmentService;

