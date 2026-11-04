const multer = require('multer');
const { validateFileMagicBytes } = require('./upload');

const PORTAL_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PORTAL_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const isAllowedPortalMime = (kind, mimeType) => {
  const allowed = kind === 'image' ? PORTAL_IMAGE_MIME_TYPES : PORTAL_DOCUMENT_MIME_TYPES;
  return allowed.includes(mimeType);
};

const createPortalUpload = (kind) => {
  const raw = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: kind === 'image' ? 5 * 1024 * 1024 : 20 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
      if (isAllowedPortalMime(kind, file.mimetype)) return callback(null, true);
      return callback(new Error('Định dạng file Portal không được hỗ trợ.'), false);
    },
  });

  const wrap = (multerFn) => (req, res, next) => {
    multerFn(req, res, (err) => {
      if (err) return next(err);
      const filesToValidate = [];
      if (req.file) filesToValidate.push(req.file);
      if (Array.isArray(req.files)) filesToValidate.push(...req.files);
      if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
        Object.values(req.files).forEach((arr) => {
          if (Array.isArray(arr)) filesToValidate.push(...arr);
        });
      }
      for (const file of filesToValidate) {
        const check = validateFileMagicBytes(file.buffer, file.mimetype);
        if (!check.valid) {
          const error = new Error(check.error || 'Nội dung tệp không khớp với định dạng khai báo.');
          error.statusCode = 400;
          return next(error);
        }
      }
      next();
    });
  };

  return {
    single: (field) => wrap(raw.single(field)),
    array: (field, maxCount) => wrap(raw.array(field, maxCount)),
    fields: (fields) => wrap(raw.fields(fields)),
    none: () => raw.none(),
    any: () => wrap(raw.any()),
  };
};

module.exports = {
  PORTAL_IMAGE_MIME_TYPES,
  PORTAL_DOCUMENT_MIME_TYPES,
  isAllowedPortalMime,
  createPortalUpload,
};
