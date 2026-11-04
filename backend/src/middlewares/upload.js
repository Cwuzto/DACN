const multer = require('multer');

// Cấu hình storage lưu vào RAM (Buffer)
const storage = multer.memoryStorage();

// Các định dạng an toàn được phép khai báo
const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/jpg', 'image/webp', // Ảnh
    'application/pdf', // PDF
    'application/msword', // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
    'application/zip', // ZIP
    'application/x-rar-compressed', // RAR
];

/**
 * Cấu hình filter loại file theo declared MIME type
 */
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Định dạng file không được hỗ trợ. Chỉ cho phép Ảnh, PDF, Word, ZIP, RAR.'), false);
    }
};

/**
 * Xác thực nhị phân magic bytes của buffer tải lên so với declared MIME type.
 * Trả về { valid: boolean, error?: string }
 */
const validateFileMagicBytes = (buffer, mimeType) => {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        return { valid: false, error: 'Dữ liệu tệp không hợp lệ hoặc rỗng.' };
    }

    if (!mimeType || typeof mimeType !== 'string') {
        return { valid: false, error: 'MIME type không hợp lệ.' };
    }

    const normalizedMime = mimeType.toLowerCase().trim();

    switch (normalizedMime) {
        case 'application/pdf': {
            if (buffer.length < 5) {
                return { valid: false, error: 'Tệp PDF không đủ độ dài tối thiểu.' };
            }
            const header = buffer.subarray(0, 5).toString('ascii');
            if (header !== '%PDF-') {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng PDF (magic bytes mismatch).' };
            }
            return { valid: true };
        }
        case 'image/png': {
            if (buffer.length < 8) {
                return { valid: false, error: 'Tệp PNG không đủ độ dài tối thiểu.' };
            }
            const isPng = buffer[0] === 0x89 &&
                          buffer[1] === 0x50 && // P
                          buffer[2] === 0x4e && // N
                          buffer[3] === 0x47 && // G
                          buffer[4] === 0x0d && // \r
                          buffer[5] === 0x0a && // \n
                          buffer[6] === 0x1a &&
                          buffer[7] === 0x0a;
            if (!isPng) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng PNG (magic bytes mismatch).' };
            }
            return { valid: true };
        }
        case 'image/jpeg':
        case 'image/jpg': {
            if (buffer.length < 3) {
                return { valid: false, error: 'Tệp JPEG không đủ độ dài tối thiểu.' };
            }
            const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
            if (!isJpeg) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng JPEG (magic bytes mismatch).' };
            }
            return { valid: true };
        }
        case 'image/webp': {
            if (buffer.length < 12) {
                return { valid: false, error: 'Tệp WEBP không đủ độ dài tối thiểu.' };
            }
            const isRiff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
            const isWebp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
            if (!isRiff || !isWebp) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng WEBP (magic bytes mismatch).' };
            }
            return { valid: true };
        }
        case 'application/zip':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
            if (buffer.length < 4) {
                return { valid: false, error: 'Tệp ZIP/DOCX không đủ độ dài tối thiểu.' };
            }
            const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b &&
                ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
                 (buffer[2] === 0x05 && buffer[3] === 0x06) ||
                 (buffer[2] === 0x07 && buffer[3] === 0x08));
            if (!isZip) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng ZIP/DOCX (magic bytes mismatch).' };
            }
            return { valid: true };
        }
        case 'application/msword': {
            if (buffer.length < 8) {
                return { valid: false, error: 'Tệp DOC không đủ độ dài tối thiểu.' };
            }
            const isDoc = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
            if (!isDoc) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng DOC (magic bytes mismatch).' };
            }
            return { valid: true };
        }
        case 'application/x-rar-compressed': {
            if (buffer.length < 4) {
                return { valid: false, error: 'Tệp RAR không đủ độ dài tối thiểu.' };
            }
            const isRar = buffer[0] === 0x52 && buffer[1] === 0x61 && buffer[2] === 0x72 && buffer[3] === 0x21;
            if (!isRar) {
                return { valid: false, error: 'Nội dung tệp không khớp với định dạng RAR (magic bytes mismatch).' };
            }
            return { valid: true };
        }
        default:
            return { valid: false, error: `Định dạng MIME '${mimeType}' không được hỗ trợ.` };
    }
};

// Khởi tạo multer cơ bản (tối đa 20MB)
const rawUpload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB
    },
    fileFilter: fileFilter,
});

/**
 * Kiểm tra tính hợp lệ nhị phân của tất cả các file đã parse
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
        const check = validateFileMagicBytes(f.buffer, f.mimetype);
        if (!check.valid) {
            const error = new Error(check.error || 'Nội dung tệp không khớp với định dạng khai báo.');
            error.statusCode = 400;
            return error;
        }
    }
    return null;
};

const wrapMiddleware = (multerHandler) => (req, res, next) => {
    multerHandler(req, res, (err) => {
        if (err) return next(err);
        const validationErr = validateUploadedFiles(req);
        if (validationErr) return next(validationErr);
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
module.exports.validateFileMagicBytes = validateFileMagicBytes;
module.exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
