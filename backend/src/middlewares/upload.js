const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { MAX_UPLOAD_BYTES } = require('../config/storageConfig');
const { getTempUploadDir, cleanupRequestTempFiles, cleanupTempFile } = require('../storage/tempFileManager');

// Disk storage configuration saving to dedicated temp directory
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, getTempUploadDir());
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeName = `upload-${Date.now()}-${crypto.randomUUID()}${ext}`;
        cb(null, safeName);
    },
});

// Allowed declared MIME types (RAR is strictly prohibited)
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/jpg', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.rar' || file.mimetype === 'application/x-rar-compressed') {
        const err = new Error('Định dạng RAR không được hỗ trợ. Vui lòng sử dụng định dạng ZIP tiêu chuẩn.');
        err.statusCode = 400;
        return cb(err, false);
    }

    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const err = new Error(`Định dạng tệp '${file.mimetype}' không được hỗ trợ.`);
        err.statusCode = 400;
        cb(err, false);
    }
};

/**
 * Validates magic bytes directly from a disk file path.
 */
const validateFileMagicBytesOnDisk = (filePath, declaredMime) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return { valid: false, error: 'Tệp tải lên không tồn tại trên đĩa.' };
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
        return { valid: false, error: 'Tệp tải lên rỗng (0 bytes).' };
    }

    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(Math.min(stat.size, 16));
    fs.readSync(fd, header, 0, header.length, 0);
    fs.closeSync(fd);

    const normalizedMime = (declaredMime || '').toLowerCase().trim();

    // Check executable
    if (header.length >= 2 && header[0] === 0x4D && header[1] === 0x5A) {
        return { valid: false, error: 'Tệp thực thi nhị phân bị nghiêm cấm tải lên.' };
    }

    // Check RAR
    if (header.length >= 4 && header[0] === 0x52 && header[1] === 0x61 && header[2] === 0x72 && header[3] === 0x21) {
        return { valid: false, error: 'Định dạng RAR không được hỗ trợ.' };
    }

    switch (normalizedMime) {
        case 'application/pdf': {
            if (header.length < 5 || header.subarray(0, 5).toString('ascii') !== '%PDF-') {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng PDF.' };
            }
            return { valid: true };
        }
        case 'image/png': {
            const isPng = header.length >= 8 &&
                          header[0] === 0x89 && header[1] === 0x50 &&
                          header[2] === 0x4e && header[3] === 0x47;
            if (!isPng) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng PNG.' };
            }
            return { valid: true };
        }
        case 'image/jpeg':
        case 'image/jpg': {
            const isJpeg = header.length >= 3 &&
                           header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
            if (!isJpeg) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng JPEG.' };
            }
            return { valid: true };
        }
        case 'image/webp': {
            if (header.length < 12) {
                return { valid: false, error: 'Tệp WEBP không đủ độ dài tối thiểu.' };
            }
            const isRiff = header.subarray(0, 4).toString('ascii') === 'RIFF';
            const isWebp = header.subarray(8, 12).toString('ascii') === 'WEBP';
            if (!isRiff || !isWebp) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng WEBP.' };
            }
            return { valid: true };
        }
        case 'application/zip':
        case 'application/x-zip-compressed':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
            const isZip = header.length >= 4 &&
                          header[0] === 0x50 && header[1] === 0x4b &&
                          ((header[2] === 0x03 && header[3] === 0x04) ||
                           (header[2] === 0x05 && header[3] === 0x06) ||
                           (header[2] === 0x07 && header[3] === 0x08));
            if (!isZip) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng ZIP/Office XML.' };
            }
            return { valid: true };
        }
        case 'application/msword':
        case 'application/vnd.ms-excel': {
            const isDoc = header.length >= 8 &&
                          header[0] === 0xd0 && header[1] === 0xcf &&
                          header[2] === 0x11 && header[3] === 0xe0;
            if (!isDoc) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng tài liệu Microsoft Office cũ.' };
            }
            return { valid: true };
        }
        default:
            return { valid: true };
    }
};

const rawUpload = multer({
    storage: diskStorage,
    limits: {
        fileSize: MAX_UPLOAD_BYTES, // 50 MB
    },
    fileFilter: fileFilter,
});

/**
 * Validates uploaded files after Multer writes to disk.
 */
const validateUploadedFiles = (req) => {
    const files = [];
    if (req.file) files.push(req.file);
    if (Array.isArray(req.files)) files.push(...req.files);
    if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
        for (const k of Object.keys(req.files)) {
            if (Array.isArray(req.files[k])) files.push(...req.files[k]);
        }
    }

    for (const f of files) {
        if (f.path) {
            const check = validateFileMagicBytesOnDisk(f.path, f.mimetype);
            if (!check.valid) {
                const error = new Error(check.error || 'Nội dung tệp không khớp với định dạng khai báo.');
                error.statusCode = 400;
                return error;
            }
        }
    }
    return null;
};

const wrapMiddleware = (multerHandler) => (req, res, next) => {
    // Ensure cleanup hook on request completion or abort
    const cleanupHook = () => {
        // If route handler set keepTempFile = true, skip automatic request-finish cleanup
        if (!req.keepTempFiles) {
            cleanupRequestTempFiles(req);
        }
    };

    res.once('finish', cleanupHook);
    res.once('close', cleanupHook);

    multerHandler(req, res, (err) => {
        if (err) {
            cleanupRequestTempFiles(req);
            return next(err);
        }
        const validationErr = validateUploadedFiles(req);
        if (validationErr) {
            cleanupRequestTempFiles(req);
            return next(validationErr);
        }
        next();
    });
};

const upload = {
    single: (field) => wrapMiddleware(rawUpload.single(field)),
    array: (field, maxCount) => wrapMiddleware(rawUpload.array(field, maxCount)),
    fields: (fields) => wrapMiddleware(rawUpload.fields(fields)),
    none: () => rawUpload.none(),
    any: () => wrapMiddleware(rawUpload.any()),
};

module.exports = upload;
module.exports.upload = upload;
module.exports.validateFileMagicBytesOnDisk = validateFileMagicBytesOnDisk;
module.exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
