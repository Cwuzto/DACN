const { getAssetPolicy, STORED_DOCUMENT_TYPES } = require('./assetPolicyCatalog');
const { toVietnameseSlug } = require('./vietnameseSlug');

const padVersion = (v) => {
    if (v === null || v === undefined) return '01';
    const num = Number(v);
    if (!Number.isNaN(num)) {
        return String(num).padStart(2, '0');
    }
    return toVietnameseSlug(v);
};

const buildAcademicPrefix = (context) => {
    const academicYear = context.academicYear || (context.year ? String(context.year) : '2025-2026');
    const semester = context.semester ?? context.semesterNumber ?? (context.semesterId ? String(context.semesterId) : 1);
    const projectType = toVietnameseSlug(context.projectType || 'datn');
    const round = context.round
        ? padVersion(context.round)
        : (context.roundCode ? toVietnameseSlug(context.roundCode) : '01');

    return `nam-hoc-${academicYear}/hoc-ky-${semester}/${projectType}/dot-${round}`;
};

/**
 * Builds the canonical object storage path according to the governed architecture.
 *
 * @param {Object} params
 * @param {string} params.documentType - One of STORED_DOCUMENT_TYPES
 * @param {string} params.uuid - UUID v4 identifying the stored asset
 * @param {string} params.extension - File extension (e.g. 'pdf', 'docx')
 * @param {Object} [params.context={}] - Context metadata for the path
 * @returns {{ bucket: string, objectKey: string }}
 */
const buildObjectPath = ({ documentType, uuid, extension, context = {} }) => {
    if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
        throw new Error('Valid UUID is required to build object path.');
    }

    if (!extension || typeof extension !== 'string' || !extension.trim()) {
        throw new Error('File extension is required to build object path.');
    }

    const cleanExt = extension.trim().replace(/^\.+/, '').toLowerCase();
    const policy = getAssetPolicy(documentType);
    const bucket = policy.bucket;

    const customSlug = context.slug || context.description;

    let folderPath = '';
    let defaultSlug = 'tai-lieu';

    switch (documentType) {
        case STORED_DOCUMENT_TYPES.BM01: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for BM01');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/bm01/phien-ban-${ver}`;
            defaultSlug = 'de-cuong-do-an';
            break;
        }

        case STORED_DOCUMENT_TYPES.BM02: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for BM02');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/bm02/phien-ban-${ver}`;
            defaultSlug = 'don-dang-ky-de-tai';
            break;
        }

        case STORED_DOCUMENT_TYPES.BM02_A: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for BM02_A');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/bm02a/phien-ban-${ver}`;
            defaultSlug = 'don-dieu-chinh-ten-de-tai';
            break;
        }

        case STORED_DOCUMENT_TYPES.BM03: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for BM03');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/bm03/phien-ban-${ver}`;
            defaultSlug = 'so-theo-doi-tien-do';
            break;
        }

        case STORED_DOCUMENT_TYPES.CHECKPOINT_EVIDENCE: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for CHECKPOINT_EVIDENCE');
            }
            const prefix = buildAcademicPrefix(context);
            const checkpointNum = context.checkpointNumber || context.checkpoint || 1;
            folderPath = `${prefix}/dang-ky-${context.registrationId}/checkpoint-${checkpointNum}/minh-chung`;
            defaultSlug = 'minh-chung';
            break;
        }

        case STORED_DOCUMENT_TYPES.BM04: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for BM04');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/bm04/phien-ban-${ver}`;
            defaultSlug = 'phieu-nhan-xet';
            break;
        }

        case STORED_DOCUMENT_TYPES.BM05: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for BM05');
            }
            if (!context.councilId) {
                throw new Error('councilId is required in context for BM05');
            }
            if (!context.memberId) {
                throw new Error('memberId is required in context for BM05');
            }
            const prefix = buildAcademicPrefix(context);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/bm05/hoi-dong-${context.councilId}/thanh-vien-${context.memberId}`;
            defaultSlug = 'phieu-cham-diem';
            break;
        }

        case STORED_DOCUMENT_TYPES.REPORT_WORD: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for REPORT_WORD');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/luu-chieu/bao-cao-word/phien-ban-${ver}`;
            defaultSlug = 'bao-cao-hoan-chinh';
            break;
        }

        case STORED_DOCUMENT_TYPES.REPORT_PDF: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for REPORT_PDF');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/luu-chieu/bao-cao-pdf/phien-ban-${ver}`;
            defaultSlug = 'bao-cao-hoan-chinh';
            break;
        }

        case STORED_DOCUMENT_TYPES.SLIDE_PPTX: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for SLIDE_PPTX');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/luu-chieu/slide/phien-ban-${ver}`;
            defaultSlug = 'slide-bao-ve';
            break;
        }

        case STORED_DOCUMENT_TYPES.SOURCE_ZIP: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for SOURCE_ZIP');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/luu-chieu/source-code/phien-ban-${ver}`;
            defaultSlug = 'ma-nguon';
            break;
        }

        case STORED_DOCUMENT_TYPES.CLEARANCE_CERTIFICATE: {
            if (!context.registrationId) {
                throw new Error('registrationId is required in context for CLEARANCE_CERTIFICATE');
            }
            const prefix = buildAcademicPrefix(context);
            folderPath = `${prefix}/dang-ky-${context.registrationId}/chung-nhan`;
            defaultSlug = 'xac-nhan-hoan-thanh';
            break;
        }

        case STORED_DOCUMENT_TYPES.ASSIGNMENT_DECISION: {
            if (!context.decisionId) {
                throw new Error('decisionId is required in context for ASSIGNMENT_DECISION');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/quyet-dinh/quyet-dinh-${context.decisionId}/phien-ban-${ver}`;
            defaultSlug = 'quyet-dinh-giao-de-tai';
            break;
        }

        case STORED_DOCUMENT_TYPES.ADJUSTMENT_APPENDIX: {
            if (!context.appendixId) {
                throw new Error('appendixId is required in context for ADJUSTMENT_APPENDIX');
            }
            const prefix = buildAcademicPrefix(context);
            const ver = padVersion(context.version);
            folderPath = `${prefix}/phu-luc/phu-luc-${context.appendixId}/phien-ban-${ver}`;
            defaultSlug = 'phu-luc-dieu-chinh';
            break;
        }

        case STORED_DOCUMENT_TYPES.COUNCIL_DOCUMENT: {
            if (!context.councilId) {
                throw new Error('councilId is required in context for COUNCIL_DOCUMENT');
            }
            const prefix = buildAcademicPrefix(context);
            const subType = toVietnameseSlug(context.subType || 'tai-lieu');
            const ver = padVersion(context.version);
            folderPath = `${prefix}/hoi-dong/hoi-dong-${context.councilId}/${subType}/phien-ban-${ver}`;
            defaultSlug = 'tai-lieu';
            break;
        }

        case STORED_DOCUMENT_TYPES.USER_AVATAR: {
            if (!context.userId) {
                throw new Error('userId is required in context for USER_AVATAR');
            }
            const statusFolder =
                context.isReplaced || context.status === 'replaced' ? 'da-thay-the' : 'hien-tai';
            folderPath = `nguoi-dung-${context.userId}/anh-dai-dien/${statusFolder}`;
            defaultSlug = 'anh-dai-dien';
            break;
        }

        case STORED_DOCUMENT_TYPES.PORTAL_TEMPLATE: {
            if (!context.formCode) {
                throw new Error('formCode is required in context for PORTAL_TEMPLATE');
            }
            const formCode = toVietnameseSlug(context.formCode);
            const ver = padVersion(context.version);
            folderPath = `bieu-mau-da-cong-bo/${formCode}/phien-ban-${ver}`;
            defaultSlug = 'bieu-mau';
            break;
        }

        case STORED_DOCUMENT_TYPES.PORTAL_DOCUMENT: {
            if (!context.announcementId) {
                throw new Error('announcementId is required in context for PORTAL_DOCUMENT');
            }
            const year = context.year || new Date().getFullYear();
            folderPath = `thong-bao-da-cong-bo/nam-${year}/thong-bao-${context.announcementId}`;
            defaultSlug = 'tai-lieu-thong-bao';
            break;
        }

        case STORED_DOCUMENT_TYPES.PORTAL_IMAGE: {
            if (context.subType === 'logo') {
                folderPath = 'thuong-hieu/logo';
                defaultSlug = 'logo-vien-cong-nghe-so';
            } else if (context.subType === 'background') {
                folderPath = 'thuong-hieu/background';
                defaultSlug = 'anh-nen-cong-thong-tin';
            } else {
                const year = context.year || new Date().getFullYear();
                folderPath = `hinh-anh-cong-thong-tin/nam-${year}`;
                defaultSlug = 'hinh-anh';
            }
            break;
        }

        case STORED_DOCUMENT_TYPES.TEMP_STAGING: {
            const stage = context.stage || 'cho-kiem-tra';
            const dateStr = context.date || new Date().toISOString().slice(0, 10);
            if (stage === 'mo-coi') {
                folderPath = `mo-coi/ngay-${dateStr}`;
            } else {
                if (!context.uploadSessionId) {
                    throw new Error('uploadSessionId is required in context for TEMP_STAGING');
                }
                folderPath = `${stage}/ngay-${dateStr}/phien-${context.uploadSessionId}`;
            }
            defaultSlug = 'tai-lieu-tam';
            break;
        }

        default: {
            const error = new Error(`Unsupported document type for path building: ${documentType}`);
            error.code = 'ASSET_POLICY_NOT_FOUND';
            throw error;
        }
    }

    const finalSlug = customSlug ? toVietnameseSlug(customSlug) : defaultSlug;
    const fileName = `${uuid}-${finalSlug}.${cleanExt}`;
    const objectKey = `${folderPath}/${fileName}`;

    return {
        bucket,
        objectKey,
    };
};

module.exports = {
    buildObjectPath,
};
