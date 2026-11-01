const multer = require('multer');

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

const createPortalUpload = (kind) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: kind === 'image' ? 5 * 1024 * 1024 : 20 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (isAllowedPortalMime(kind, file.mimetype)) return callback(null, true);
    return callback(new Error('Định dạng file Portal không được hỗ trợ.'), false);
  },
});

module.exports = {
  PORTAL_IMAGE_MIME_TYPES,
  PORTAL_DOCUMENT_MIME_TYPES,
  isAllowedPortalMime,
  createPortalUpload,
};
