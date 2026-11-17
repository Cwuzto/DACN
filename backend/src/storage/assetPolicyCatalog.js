const { STORAGE_BUCKETS, MAX_UPLOAD_BYTES } = require('../config/storageConfig');

const STORED_DOCUMENT_TYPES = Object.freeze({
    BM01: 'BM01',
    BM02: 'BM02',
    BM02_A: 'BM02_A',
    BM03: 'BM03',
    CHECKPOINT_EVIDENCE: 'CHECKPOINT_EVIDENCE',
    BM04: 'BM04',
    BM05: 'BM05',
    ASSIGNMENT_DECISION: 'ASSIGNMENT_DECISION',
    ADJUSTMENT_APPENDIX: 'ADJUSTMENT_APPENDIX',
    COUNCIL_DOCUMENT: 'COUNCIL_DOCUMENT',
    REPORT_WORD: 'REPORT_WORD',
    REPORT_PDF: 'REPORT_PDF',
    SLIDE_PPTX: 'SLIDE_PPTX',
    SOURCE_ZIP: 'SOURCE_ZIP',
    CLEARANCE_CERTIFICATE: 'CLEARANCE_CERTIFICATE',
    USER_AVATAR: 'USER_AVATAR',
    PORTAL_IMAGE: 'PORTAL_IMAGE',
    PORTAL_DOCUMENT: 'PORTAL_DOCUMENT',
    PORTAL_TEMPLATE: 'PORTAL_TEMPLATE',
    TEMP_STAGING: 'TEMP_STAGING',
});

const MIMES = Object.freeze({
    PDF: 'application/pdf',
    DOC: 'application/msword',
    DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    XLS: 'application/vnd.ms-excel',
    XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ZIP: ['application/zip', 'application/x-zip-compressed'],
    IMAGES: ['image/jpeg', 'image/png', 'image/webp'],
    OFFICE_AND_PDF: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
});

const MB = 1024 * 1024;

const POLICIES = Object.freeze({
    [STORED_DOCUMENT_TYPES.BM01]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.BM02]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.BM02_A]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.BM03]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.CHECKPOINT_EVIDENCE]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf', 'jpg', 'jpeg', 'png'],
        mimeTypes: [MIMES.PDF, 'image/jpeg', 'image/png'],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.BM04]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.BM05]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.ASSIGNMENT_DECISION]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.ADJUSTMENT_APPENDIX]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.COUNCIL_DOCUMENT]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.REPORT_WORD]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: MAX_UPLOAD_BYTES, // 50 MB
        extensions: ['docx'],
        mimeTypes: [MIMES.DOCX],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.REPORT_PDF]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: MAX_UPLOAD_BYTES, // 50 MB
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.SLIDE_PPTX]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: MAX_UPLOAD_BYTES, // 50 MB
        extensions: ['pptx', 'pdf'],
        mimeTypes: [MIMES.PPTX, MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.SOURCE_ZIP]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: MAX_UPLOAD_BYTES, // 50 MB
        extensions: ['zip'],
        mimeTypes: [...MIMES.ZIP],
        visibility: 'PRIVATE',
        requireArchiveInspection: true,
    },
    [STORED_DOCUMENT_TYPES.CLEARANCE_CERTIFICATE]: {
        bucket: STORAGE_BUCKETS.ACADEMIC,
        maxBytes: 20 * MB,
        extensions: ['pdf'],
        mimeTypes: [MIMES.PDF],
        visibility: 'PRIVATE',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.USER_AVATAR]: {
        bucket: STORAGE_BUCKETS.PERSONAL,
        maxBytes: 5 * MB,
        extensions: ['jpg', 'jpeg', 'png', 'webp'],
        mimeTypes: [...MIMES.IMAGES],
        visibility: 'PRIVATE',
        retentionDays: 7,
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.PORTAL_IMAGE]: {
        bucket: STORAGE_BUCKETS.PUBLIC,
        maxBytes: 10 * MB,
        extensions: ['jpg', 'jpeg', 'png', 'webp'],
        mimeTypes: [...MIMES.IMAGES],
        visibility: 'PUBLIC',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.PORTAL_DOCUMENT]: {
        bucket: STORAGE_BUCKETS.PUBLIC,
        maxBytes: 20 * MB,
        extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
        mimeTypes: MIMES.OFFICE_AND_PDF,
        visibility: 'PUBLIC',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.PORTAL_TEMPLATE]: {
        bucket: STORAGE_BUCKETS.PUBLIC,
        maxBytes: 20 * MB,
        extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
        mimeTypes: MIMES.OFFICE_AND_PDF,
        visibility: 'PUBLIC',
        requireArchiveInspection: false,
    },
    [STORED_DOCUMENT_TYPES.TEMP_STAGING]: {
        bucket: STORAGE_BUCKETS.TEMP,
        maxBytes: MAX_UPLOAD_BYTES, // 50 MB
        extensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'pptx', 'zip', 'jpg', 'jpeg', 'png', 'webp'],
        mimeTypes: [
            MIMES.PDF,
            MIMES.DOC,
            MIMES.DOCX,
            MIMES.XLS,
            MIMES.XLSX,
            MIMES.PPTX,
            ...MIMES.ZIP,
            ...MIMES.IMAGES,
        ],
        visibility: 'PRIVATE',
        retentionDays: 1,
        requireArchiveInspection: false,
    },
});

/**
 * Retrieve asset policy by stored document type.
 * @param {string} documentType
 * @returns {Object} Policy definition
 */
const getAssetPolicy = (documentType) => {
    if (documentType === 'VIDEO_DEMO') {
        const error = new Error('Video demo is not allowed as a storage asset; use an external HTTPS URL.');
        error.code = 'ASSET_TYPE_NOT_ALLOWED';
        throw error;
    }

    const policy = POLICIES[documentType];
    if (!policy) {
        const error = new Error(`Asset policy not found for document type: ${documentType}`);
        error.code = 'ASSET_POLICY_NOT_FOUND';
        throw error;
    }

    return policy;
};

module.exports = {
    STORED_DOCUMENT_TYPES,
    getAssetPolicy,
};
