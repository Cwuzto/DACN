import api from './api.js';
import { normalizeApiError } from '../utils/apiError.js';

const wrapServiceError = (error, fallbackMessage) => {
    const normalized = normalizeApiError(error);
    return { ...normalized, message: error?.response?.data?.message || error?.message || fallbackMessage };
};

const DOCUMENT_TYPES = ['REPORT_WORD', 'REPORT_PDF', 'DEMO_VIDEO', 'SLIDE_PPTX'];
const pick = (value, fields) => Object.fromEntries(fields.filter(field => Object.hasOwn(value, field)).map(field => [field, value[field]]));

// Project only fields used by the dossier workflow; never cache the student
// object or raw linked records returned by the API in this view.
export const normalizeDefenseDossier = (data) => {
    const source = data || {};
    const currentFiles = Object.fromEntries(DOCUMENT_TYPES.map(documentType => {
        const file = source.currentFiles?.[documentType];
        return [documentType, file ? {
            ...pick(file, ['id', 'fileUrl', 'fileName', 'versionNumber', 'checksum', 'uploadedAt', 'fileSizeBytes', 'advisorFeedback', 'academicAffairsFeedback']),
            documentType,
        } : null];
    }));
    return {
        registrationId: source.registrationId,
        timeWindows: source.windows || {},
        currentFiles,
        documents: Object.values(currentFiles).filter(Boolean),
        bm03Record: source.linkedBm03 ? pick(source.linkedBm03, ['id', 'finalPdfFileUrl', 'advisorSignedAt']) : null,
        bm04Record: source.linkedBm04 ? pick(source.linkedBm04, ['id', 'finalPdfFileUrl', 'signedAt']) : null,
        isWindowClosed: Boolean(source.isWindowClosed),
        isSoftDeadlinePast: Boolean(source.isSoftDeadlinePast),
        missingTypes: DOCUMENT_TYPES.filter(type => !currentFiles[type]),
    };
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

    // 2.5. Sinh vien nop ho so luu chieu so bo truoc bao ve (Pre-Defense Archive)
    submitPreDefenseArchive: async (registrationId, payload) => {
        try {
            const data = (typeof registrationId === 'object' && !payload) ? registrationId : payload;
            const regId = (typeof registrationId === 'number' || typeof registrationId === 'string')
                ? registrationId
                : data?.registrationId;

            const url = regId
                ? `/archives/registrations/${regId}/pre-defense`
                : '/archives/pre-defense';

            return await api.post(url, data);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể nộp hồ sơ lưu chiểu sơ bộ trước bảo vệ');
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

    // 7. Ho so 6 tai lieu bao ve & cua so thoi gian
    getDefenseDossier: async (registrationId) => {
        try {
            return await api.get(`/archives/registrations/${registrationId}/dossier`);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải hồ sơ tài liệu bảo vệ');
        }
    },

    // 8. Upload tai lieu bao ve / luu chieu (1 trong 4 loai file)
    uploadDefenseDocument: async (registrationId, payload) => {
        try {
            return await api.post(`/archives/registrations/${registrationId}/files`, payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể tải lên tài liệu bảo vệ');
        }
    },

    // 9. GVHD duyet chuyen mon ho so luu chieu (Tang 1)
    reviewArchiveByMentor: async (archiveId, payload) => {
        try {
            return await api.post(`/archives/${archiveId}/mentor-review`, payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể duyệt chuyên môn hồ sơ lưu chiểu');
        }
    },

    // 10. Giao vu duyet thu tuc ho so luu chieu (Tang 2)
    reviewArchiveByAcademicAffairs: async (archiveId, payload) => {
        try {
            return await api.post(`/archives/${archiveId}/academic-affairs-review`, payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể duyệt thủ tục hồ sơ lưu chiểu');
        }
    },

    // 11. Vien truong ky Giay xac nhan hoan thanh
    signClearanceCertificate: async (archiveId, payload = {}) => {
        try {
            return await api.post(`/archives/${archiveId}/sign-certificate`, payload);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể ký Giấy xác nhận hoàn thành');
        }
    },

    // 12. Chup snapshot bat bien 00:00 ngay bao ve
    captureZeroHourSnapshot: async (registrationId, data = {}) => {
        try {
            return await api.post(`/archives/registrations/${registrationId}/snapshots/defense-zero-hour`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể chụp snapshot ngày bảo vệ');
        }
    },

    // 13. Dong cong nop luu chieu ngay 15
    closeArchiveWindow: async (registrationId, data = {}) => {
        try {
            return await api.post(`/archives/registrations/${registrationId}/close-window`, data);
        } catch (error) {
            throw wrapServiceError(error, 'Không thể đóng cổng nộp lưu chiểu');
        }
    },
};

export default archiveService;
