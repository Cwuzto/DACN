import api from './api';

const wrapServiceError = (error, fallbackMessage) => {
    if (error?.success === false) return error;
    return { success: false, message: fallbackMessage };
};

const archiveService = {
    // 1. Lay ho so luu chieu cua 1 de tai
    getArchiveByRegistration: async (registrationId) => {
        try {
            return await api.get(`/archives/registrations/${registrationId}`);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải hồ sơ lưu chiểu');
        }
    },

    // 2. Sinh vien nop hoac cap nhat ho so luu chieu
    submitArchive: async (registrationId, payload) => {
        try {
            return await api.post(`/archives/registrations/${registrationId}`, payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể nộp hồ sơ lưu chiểu');
        }
    },

    // 3. GVHD / Admin nghiem thu ho so luu chieu
    reviewArchive: async (registrationId, payload) => {
        try {
            return await api.post(`/archives/registrations/${registrationId}/review`, payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể nghiệm thu hồ sơ lưu chiểu');
        }
    },

    // 4. Danh sach Kho luu chieu toan khoa
    getAllArchives: async (params = {}) => {
        try {
            return await api.get('/archives', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải kho hồ sơ lưu chiểu');
        }
    },

    // 5. Trich xuat Giay Xac Nhan Hoan Thanh Do An (Clearance Certificate)
    getClearanceCertificate: async (registrationId) => {
        try {
            return await api.get(`/archives/registrations/${registrationId}/clearance-certificate`);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể lấy thông tin Giấy xác nhận hoàn thành');
        }
    },

    // 6. Health Radar: Thong ke canh bao som
    getHealthRadarStats: async (params = {}) => {
        try {
            return await api.get('/archives/health-radar', { params });
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải dữ liệu cảnh báo tiến độ');
        }
    },
};

export default archiveService;
