const router = require('express').Router();
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { createPortalUpload } = require('../middlewares/portalUpload');
const { uploadPortalImage, uploadPortalDocument } = require('../controllers/portalUploadController');

router.post('/image', authenticate, authorizePermission(PERMISSIONS.PORTAL_CONTENT_MANAGE), createPortalUpload('image').single('file'), uploadPortalImage);
router.post('/document', authenticate, authorizePermission(PERMISSIONS.PORTAL_CONTENT_MANAGE), createPortalUpload('document').single('file'), uploadPortalDocument);

module.exports = router;
