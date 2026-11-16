const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { authenticateToken, optionalAuthenticate } = require('../middlewares/auth');
const storedAssetController = require('../controllers/storedAssetController');

// 1. Multipart upload (files <= 6MB)
router.post(
    '/',
    authenticateToken,
    upload.single('file'),
    storedAssetController.uploadMultipart
);

// 2. Create TUS upload session (files > 6MB to 50MB)
router.post(
    '/upload-sessions',
    authenticateToken,
    storedAssetController.createUploadSession
);

// 3. Finalize TUS upload session
router.post(
    '/upload-sessions/:id/finalize',
    authenticateToken,
    storedAssetController.finalizeUploadSession
);

// 4. Abort TUS upload session
router.delete(
    '/upload-sessions/:id',
    authenticateToken,
    storedAssetController.abortUploadSession
);

// 5. Download asset (supports public assets without token, or private with signed URL)
router.get(
    '/:id/download',
    optionalAuthenticate,
    storedAssetController.getDownload
);

module.exports = router;
