const { storedAssetService } = require('../services/storedAssetService');

const parseResourceContext = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
};

const uploadMultipart = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'Vui lòng chọn tệp tải lên.',
                code: 'ASSET_FILE_MISSING',
            });
        }

        const { documentType } = req.body;
        if (!documentType) {
            return res.status(400).json({
                error: 'documentType là bắt buộc.',
                code: 'ASSET_DOCUMENT_TYPE_REQUIRED',
            });
        }

        const resourceContext = parseResourceContext(req.body.resourceContext);

        const asset = await storedAssetService.ingestAsset({
            tempFile: req.file,
            documentType,
            resourceContext,
            actor: req.user,
        });

        res.status(201).json(asset);
    } catch (err) {
        next(err);
    }
};

const createUploadSession = async (req, res, next) => {
    try {
        const {
            documentType,
            resourceContext,
            originalName,
            declaredMime,
            sizeBytes,
            idempotencyKey,
        } = req.body;

        if (!documentType || !originalName || sizeBytes == null) {
            return res.status(400).json({
                error: 'documentType, originalName, và sizeBytes là các trường bắt buộc.',
                code: 'ASSET_SESSION_PARAMS_MISSING',
            });
        }

        const parsedContext = parseResourceContext(resourceContext);

        const session = await storedAssetService.createUploadSession({
            documentType,
            resourceContext: parsedContext,
            actor: req.user,
            originalName,
            declaredMime,
            sizeBytes,
            idempotencyKey,
        });

        res.status(201).json(session);
    } catch (err) {
        next(err);
    }
};

const finalizeUploadSession = async (req, res, next) => {
    try {
        const { id: sessionId } = req.params;
        const asset = await storedAssetService.finalizeUploadSession({
            sessionId,
            actor: req.user,
        });

        res.status(200).json(asset);
    } catch (err) {
        next(err);
    }
};

const abortUploadSession = async (req, res, next) => {
    try {
        const { id: sessionId } = req.params;
        await storedAssetService.abortUploadSession({
            sessionId,
            actor: req.user,
        });

        res.status(200).json({
            success: true,
            message: 'Đã hủy phiên tải lên thành công.',
        });
    } catch (err) {
        next(err);
    }
};

const getDownload = async (req, res, next) => {
    try {
        const { id: assetId } = req.params;
        const downloadInfo = await storedAssetService.getAssetDownload({
            assetId,
            actor: req.user,
        });

        res.status(200).json(downloadInfo);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    uploadMultipart,
    createUploadSession,
    finalizeUploadSession,
    abortUploadSession,
    getDownload,
};
