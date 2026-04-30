const UploadService = require('../services/uploadService');

const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui long chon mot file de upload.',
            });
        }

        const folder = req.body.folder || 'general';

        const result = await UploadService.uploadBuffer(
            req.file.buffer,
            folder,
            req.file.mimetype,
            req.file.originalname,
        );

        res.json({
            success: true,
            message: 'Tai file len thanh cong.',
            data: {
                url: result.secure_url,
                publicId: result.public_id,
                format: result.format,
                bytes: result.bytes,
                bucket: result.bucket,
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
