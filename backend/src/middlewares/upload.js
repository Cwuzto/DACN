const multer = require('multer');

// Cấu hình storage lưu vào RAM (Buffer)
const storage = multer.memoryStorage();

// Cấu hình filter loại file (chỉ cho phép ảnh, pdf, doc, docx, zip, rar)
const fileFilter = (req, file, cb) => {
    // Các định dạng an toàn
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/jpg', 'image/webp', // Ảnh
        'application/pdf', // PDF
        'application/msword', // DOC
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/zip', // ZIP
        'application/x-rar-compressed' // RAR
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Định dạng file không được hỗ trợ. Chỉ cho phép Ảnh, PDF, Word, ZIP, RAR.'), false);
    }
};

// Khởi tạo multer (tối đa 20MB)
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20 MB
    },
    fileFilter: fileFilter
});

module.exports = upload;
