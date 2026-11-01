const UploadService = require('../services/uploadService');

const uploadPortalAsset = (folder) => async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn file.' });
    }
    const result = await UploadService.uploadBuffer(req.file.buffer, folder, req.file.mimetype, req.file.originalname);
    return res.json({
      success: true,
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
        bytes: result.bytes,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  uploadPortalImage: uploadPortalAsset('portal/images'),
  uploadPortalDocument: uploadPortalAsset('portal/documents'),
};
