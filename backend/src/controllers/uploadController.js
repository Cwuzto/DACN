const UploadService = require('../services/uploadService');
const path = require('path');

const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn một file để upload.',
            });
        }

        // Determine the folder based on request (optional)
        const folder = req.body.folder || 'general';

        // Auto detect resource type to allow both images and documents (pdf, doc, zip)
        let resourceType = 'auto'; // Cloudinary will guess

        // Upload buffer to Cloudinary
        const result = await UploadService.uploadBuffer(req.file.buffer, folder, resourceType);

        res.json({
            success: true,
            message: 'Tải file lên thành công.',
            data: {
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                bytes: result.bytes,
                originalName: req.file.originalname,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadFile,
};
