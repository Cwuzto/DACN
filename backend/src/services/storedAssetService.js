const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prismaClient = require('../config/database');
const { storageAdapter: defaultStorageAdapter } = require('../storage/supabaseStorageAdapter');
const { getAssetPolicy, STORED_DOCUMENT_TYPES } = require('../storage/assetPolicyCatalog');
const { buildObjectPath } = require('../storage/objectPathBuilder');
const { inspectFile } = require('../storage/fileInspector');
const { createTempFilePath, cleanupTempFile } = require('../storage/tempFileManager');
const {
    MAX_UPLOAD_BYTES,
    TUS_THRESHOLD_BYTES,
    TUS_CHUNK_BYTES,
    getStorageTusEndpoint,
} = require('../config/storageConfig');
const { auditLog } = require('./auditLogService');

class StoredAssetServiceError extends Error {
    constructor(message, code = 'STORED_ASSET_ERROR', statusCode = 400) {
        super(message);
        this.name = 'StoredAssetServiceError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

const mapBucketToEnum = (bucket) => {
    switch (bucket) {
        case 'cong-khai': return 'CONG_KHAI';
        case 'hoc-vu': return 'HOC_VU';
        case 'ca-nhan': return 'CA_NHAN';
        case 'tam': return 'TAM';
        default: return 'HOC_VU';
    }
};

const mapEnumToBucket = (bucketEnum) => {
    switch (bucketEnum) {
        case 'CONG_KHAI': return 'cong-khai';
        case 'HOC_VU': return 'hoc-vu';
        case 'CA_NHAN': return 'ca-nhan';
        case 'TAM': return 'tam';
        default: return 'hoc-vu';
    }
};

class StoredAssetService {
    constructor({ prisma, storageAdapter } = {}) {
        this.prisma = prisma || prismaClient;
        this.storageAdapter = storageAdapter || defaultStorageAdapter;
    }

    _formatAssetDTO(asset) {
        if (!asset) return null;
        return {
            id: asset.id,
            bucket: asset.bucket,
            objectKey: asset.objectKey,
            originalName: asset.originalName,
            normalizedName: asset.normalizedName,
            extension: asset.extension,
            declaredMime: asset.declaredMime,
            detectedMime: asset.detectedMime,
            sizeBytes: asset.sizeBytes != null ? String(asset.sizeBytes) : '0',
            sha256: asset.sha256,
            ownerUserId: asset.ownerUserId,
            uploadedById: asset.uploadedById,
            registrationId: asset.registrationId,
            semesterId: asset.semesterId,
            projectCatalogId: asset.projectCatalogId,
            documentType: asset.documentType,
            version: asset.version,
            visibility: asset.visibility,
            scanStatus: asset.scanStatus,
            status: asset.status,
            createdAt: asset.createdAt,
            updatedAt: asset.updatedAt,
        };
    }

    /**
     * Ingest an asset via multipart upload (files <= 6MB).
     */
    async ingestAsset({ tempFile, documentType, resourceContext = {}, actor, uploadSessionId }) {
        if (!tempFile || !tempFile.path) {
            throw new StoredAssetServiceError('No valid file provided for ingestion', 'ASSET_FILE_MISSING', 400);
        }

        // Check 6MB multipart threshold
        const fileSize = tempFile.size != null ? tempFile.size : fs.statSync(tempFile.path).size;
        if (fileSize > TUS_THRESHOLD_BYTES) {
            throw new StoredAssetServiceError(
                'File exceeds 6MB threshold; please use TUS resumable upload.',
                'ASSET_TUS_REQUIRED',
                422
            );
        }

        const policy = getAssetPolicy(documentType);

        // Inspect file
        const inspected = await inspectFile({
            path: tempFile.path,
            originalName: tempFile.originalname,
            declaredMime: tempFile.mimetype,
            policy,
        });

        const assetId = crypto.randomUUID();
        const sessionId = uploadSessionId || assetId;

        // 1. Build staging path in bucket 'tam'
        const staging = buildObjectPath({
            documentType: STORED_DOCUMENT_TYPES.TEMP_STAGING,
            uuid: assetId,
            extension: inspected.extension,
            context: {
                stage: 'cho-kiem-tra',
                uploadSessionId: sessionId,
            },
        });

        // 2. Upload file to bucket 'tam'
        const fileBuffer = fs.readFileSync(tempFile.path);
        await this.storageAdapter.upload({
            bucket: 'tam',
            objectKey: staging.objectKey,
            data: fileBuffer,
            contentType: inspected.detectedMime,
            upsert: false,
        });

        // 3. Build target path in destination bucket
        const target = buildObjectPath({
            documentType,
            uuid: assetId,
            extension: inspected.extension,
            context: resourceContext,
        });

        // 4. Move object from 'tam' to target bucket
        await this.storageAdapter.move({
            fromBucket: 'tam',
            fromKey: staging.objectKey,
            toBucket: target.bucket,
            toKey: target.objectKey,
            contentType: inspected.detectedMime,
        });

        // 5. Store canonical record in database
        try {
            const asset = await this.prisma.storedAsset.create({
                data: {
                    id: assetId,
                    bucket: mapBucketToEnum(target.bucket),
                    objectKey: target.objectKey,
                    originalName: tempFile.originalname,
                    normalizedName: path.basename(target.objectKey),
                    extension: inspected.extension,
                    declaredMime: tempFile.mimetype,
                    detectedMime: inspected.detectedMime,
                    sizeBytes: inspected.sizeBytes,
                    sha256: inspected.sha256,
                    ownerUserId: actor?.id || null,
                    uploadedById: actor?.id || null,
                    registrationId: resourceContext.registrationId ? Number(resourceContext.registrationId) : null,
                    semesterId: resourceContext.semesterId ? Number(resourceContext.semesterId) : null,
                    projectCatalogId: resourceContext.projectCatalogId ? Number(resourceContext.projectCatalogId) : null,
                    documentType,
                    version: resourceContext.version ? Number(resourceContext.version) : 1,
                    visibility: policy.visibility,
                    scanStatus: 'PASSED',
                    verifiedAt: new Date(),
                    status: 'ACTIVE',
                    uploadSessionId: uploadSessionId || null,
                },
            });

            const numericActorId = actor?.id && Number.isInteger(Number(actor.id)) ? Number(actor.id) : null;
            if (numericActorId) {
                auditLog(numericActorId, 'ASSET_INGEST', 'StoredAsset', asset.id, {
                    documentType,
                    objectKey: target.objectKey,
                });
            }

            return this._formatAssetDTO(asset);
        } catch (dbErr) {
            // DB failed after Storage move: enqueue cleanup job
            await this.prisma.storedAssetCleanupJob.create({
                data: {
                    targetBucket: mapBucketToEnum(target.bucket),
                    targetObjectKey: target.objectKey,
                    reason: `Ingest DB failure: ${dbErr.message}`,
                    status: 'PENDING',
                },
            }).catch(() => {});

            throw dbErr;
        }
    }

    /**
     * Creates a TUS upload session for files > 6MB up to 50MB.
     */
    async createUploadSession({
        documentType,
        resourceContext = {},
        actor,
        originalName,
        declaredMime,
        sizeBytes,
        idempotencyKey,
    }) {
        const policy = getAssetPolicy(documentType);

        // Check ceiling limits
        const size = Number(sizeBytes);
        if (size > MAX_UPLOAD_BYTES) {
            throw new StoredAssetServiceError(
                `File size (${size} bytes) exceeds maximum ceiling of 50 MB`,
                'ASSET_CEILING_EXCEEDED',
                413
            );
        }

        if (policy.maxBytes && size > policy.maxBytes) {
            throw new StoredAssetServiceError(
                `File size (${size} bytes) exceeds policy maxBytes (${policy.maxBytes} bytes)`,
                'ASSET_FILE_TOO_LARGE',
                413
            );
        }

        // Idempotency check
        if (idempotencyKey) {
            const existing = await this.prisma.storedAssetUploadSession.findFirst({
                where: {
                    idempotencyKey,
                    actorId: actor?.id || undefined,
                },
            });

            if (existing && existing.status !== 'FAILED' && existing.status !== 'ABORTED' && new Date() < new Date(existing.expiresAt)) {
                const tusEndpoint = getStorageTusEndpoint(process.env.SUPABASE_URL || 'https://project.supabase.co');
                return {
                    sessionId: existing.id,
                    uploadEndpoint: tusEndpoint,
                    tusEndpoint,
                    chunkSizeBytes: TUS_CHUNK_BYTES,
                    stagingBucket: 'tam',
                    stagingObjectKey: existing.stagingObjectKey,
                    expiresAt: existing.expiresAt,
                };
            }
        }

        const sessionId = crypto.randomUUID();
        const ext = path.extname(originalName || '').replace(/^\.+/, '') || 'bin';

        // Staging path in tam
        const staging = buildObjectPath({
            documentType: STORED_DOCUMENT_TYPES.TEMP_STAGING,
            uuid: crypto.randomUUID(),
            extension: ext,
            context: {
                stage: 'cho-kiem-tra',
                uploadSessionId: sessionId,
            },
        });

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create upload session in DB
        const session = await this.prisma.storedAssetUploadSession.create({
            data: {
                id: sessionId,
                actorId: actor?.id || null,
                documentType,
                resourceContext: resourceContext || {},
                stagingBucket: 'TAM',
                stagingObjectKey: staging.objectKey,
                transport: 'TUS',
                declaredSizeBytes: BigInt(size),
                declaredMime: declaredMime || 'application/octet-stream',
                originalName: originalName || 'file',
                idempotencyKey: idempotencyKey || null,
                status: 'CREATED',
                expiresAt,
            },
        });

        // Generate signed upload token bound strictly to stagingObjectKey
        const signedData = await this.storageAdapter.createSignedUploadUrl({
            bucket: 'tam',
            objectKey: staging.objectKey,
        });

        const tusEndpoint = getStorageTusEndpoint(process.env.SUPABASE_URL || 'https://project.supabase.co');

        return {
            sessionId: session.id,
            uploadEndpoint: tusEndpoint,
            tusEndpoint,
            chunkSizeBytes: TUS_CHUNK_BYTES,
            stagingBucket: 'tam',
            stagingObjectKey: staging.objectKey,
            token: signedData.token,
            url: signedData.url,
            expiresAt: session.expiresAt,
        };
    }

    /**
     * Finalizes a completed TUS upload session.
     */
    async finalizeUploadSession({ sessionId, actor }) {
        const session = await this.prisma.storedAssetUploadSession.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new StoredAssetServiceError('Upload session not found', 'ASSET_SESSION_NOT_FOUND', 404);
        }

        // Idempotency: if already completed, return existing StoredAsset
        if (session.status === 'COMPLETED') {
            const existingAsset = await this.prisma.storedAsset.findUnique({
                where: { id: session.finalizedAssetId },
            });
            return this._formatAssetDTO(existingAsset);
        }

        // Ownership authorization
        if (session.actorId && actor && session.actorId !== actor.id && actor.role !== 'ADMIN') {
            throw new StoredAssetServiceError('You do not have permission to finalize this session', 'ASSET_SESSION_FORBIDDEN', 403);
        }

        if (session.status === 'ABORTED' || session.status === 'FAILED') {
            throw new StoredAssetServiceError(`Session is in invalid state: ${session.status}`, 'ASSET_SESSION_INVALID', 400);
        }

        if (new Date() > new Date(session.expiresAt)) {
            await this.prisma.storedAssetUploadSession.update({
                where: { id: sessionId },
                data: { status: 'EXPIRED' },
            });
            throw new StoredAssetServiceError('Upload session has expired', 'ASSET_SESSION_EXPIRED', 400);
        }

        // Verify staged object exists in storage
        const stat = await this.storageAdapter.stat({
            bucket: 'tam',
            objectKey: session.stagingObjectKey,
        });

        if (!stat) {
            throw new StoredAssetServiceError('Staged upload object not found in temporary storage', 'ASSET_STAGING_OBJECT_INVALID', 400);
        }

        await this.prisma.storedAssetUploadSession.update({
            where: { id: sessionId },
            data: { status: 'FINALIZING' },
        });

        // Download staged file from storage to inspect
        const tempPath = createTempFilePath(session.originalName ? path.extname(session.originalName) : 'tmp');
        try {
            const fileData = await this.storageAdapter.download({
                bucket: 'tam',
                objectKey: session.stagingObjectKey,
            });

            let bufferData = fileData;
            if (typeof fileData.arrayBuffer === 'function') {
                const ab = await fileData.arrayBuffer();
                bufferData = Buffer.from(ab);
            }
            fs.writeFileSync(tempPath, bufferData);

            const policy = getAssetPolicy(session.documentType);
            const inspected = await inspectFile({
                path: tempPath,
                originalName: session.originalName,
                declaredMime: session.declaredMime,
                policy,
            });

            const assetId = crypto.randomUUID();
            const target = buildObjectPath({
                documentType: session.documentType,
                uuid: assetId,
                extension: inspected.extension,
                context: session.resourceContext || {},
            });

            // Move object to target bucket
            await this.storageAdapter.move({
                fromBucket: 'tam',
                fromKey: session.stagingObjectKey,
                toBucket: target.bucket,
                toKey: target.objectKey,
                contentType: inspected.detectedMime,
            });

            // Create StoredAsset and complete session in transaction
            const asset = await this.prisma.$transaction(async (tx) => {
                const created = await tx.storedAsset.create({
                    data: {
                        id: assetId,
                        bucket: mapBucketToEnum(target.bucket),
                        objectKey: target.objectKey,
                        originalName: session.originalName,
                        normalizedName: path.basename(target.objectKey),
                        extension: inspected.extension,
                        declaredMime: session.declaredMime,
                        detectedMime: inspected.detectedMime,
                        sizeBytes: inspected.sizeBytes,
                        sha256: inspected.sha256,
                        ownerUserId: session.actorId,
                        uploadedById: actor?.id || session.actorId,
                        registrationId: session.resourceContext?.registrationId ? Number(session.resourceContext.registrationId) : null,
                        semesterId: session.resourceContext?.semesterId ? Number(session.resourceContext.semesterId) : null,
                        projectCatalogId: session.resourceContext?.projectCatalogId ? Number(session.resourceContext.projectCatalogId) : null,
                        documentType: session.documentType,
                        version: session.resourceContext?.version ? Number(session.resourceContext.version) : 1,
                        visibility: policy.visibility,
                        scanStatus: 'PASSED',
                        verifiedAt: new Date(),
                        status: 'ACTIVE',
                        uploadSessionId: session.id,
                    },
                });

                await tx.storedAssetUploadSession.update({
                    where: { id: sessionId },
                    data: {
                        status: 'COMPLETED',
                        finalizedAssetId: created.id,
                    },
                });

                return created;
            });

            const numericActorId = actor?.id && Number.isInteger(Number(actor.id)) ? Number(actor.id) : null;
            if (numericActorId) {
                auditLog(numericActorId, 'ASSET_FINALIZE', 'StoredAsset', asset.id, {
                    sessionId,
                    documentType: session.documentType,
                });
            }

            return this._formatAssetDTO(asset);
        } finally {
            cleanupTempFile(tempPath);
        }
    }

    /**
     * Aborts an active upload session.
     */
    async abortUploadSession({ sessionId, actor }) {
        const session = await this.prisma.storedAssetUploadSession.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new StoredAssetServiceError('Upload session not found', 'ASSET_SESSION_NOT_FOUND', 404);
        }

        if (session.actorId && actor && session.actorId !== actor.id && actor.role !== 'ADMIN') {
            throw new StoredAssetServiceError('You do not have permission to abort this session', 'ASSET_SESSION_FORBIDDEN', 403);
        }

        await this.prisma.storedAssetUploadSession.update({
            where: { id: sessionId },
            data: { status: 'ABORTED' },
        });

        // Enqueue cleanup job for staged object
        await this.prisma.storedAssetCleanupJob.create({
            data: {
                targetBucket: 'TAM',
                targetObjectKey: session.stagingObjectKey,
                reason: `Upload session aborted: ${sessionId}`,
                status: 'PENDING',
            },
        }).catch(() => {});
    }

    /**
     * Creates a StoredAsset directly from an in-memory buffer (e.g. system-generated PDFs).
     */
    async createStoredAssetFromBuffer({ buffer, originalName, documentType, resourceContext = {}, actor }) {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new StoredAssetServiceError('Buffer is required', 'ASSET_BUFFER_REQUIRED', 400);
        }

        const policy = getAssetPolicy(documentType);
        const tempPath = createTempFilePath(path.extname(originalName) || 'pdf');

        try {
            fs.writeFileSync(tempPath, buffer);

            const inspected = await inspectFile({
                path: tempPath,
                originalName,
                declaredMime: 'application/pdf',
                policy,
            });

            const assetId = crypto.randomUUID();
            const target = buildObjectPath({
                documentType,
                uuid: assetId,
                extension: inspected.extension,
                context: resourceContext,
            });

            // Upload directly to destination bucket
            await this.storageAdapter.upload({
                bucket: target.bucket,
                objectKey: target.objectKey,
                data: buffer,
                contentType: inspected.detectedMime,
                upsert: false,
            });

            const asset = await this.prisma.storedAsset.create({
                data: {
                    id: assetId,
                    bucket: mapBucketToEnum(target.bucket),
                    objectKey: target.objectKey,
                    originalName,
                    normalizedName: path.basename(target.objectKey),
                    extension: inspected.extension,
                    declaredMime: 'application/pdf',
                    detectedMime: inspected.detectedMime,
                    sizeBytes: inspected.sizeBytes,
                    sha256: inspected.sha256,
                    ownerUserId: actor?.id || null,
                    uploadedById: actor?.id || null,
                    registrationId: resourceContext.registrationId ? Number(resourceContext.registrationId) : null,
                    semesterId: resourceContext.semesterId ? Number(resourceContext.semesterId) : null,
                    projectCatalogId: resourceContext.projectCatalogId ? Number(resourceContext.projectCatalogId) : null,
                    documentType,
                    version: resourceContext.version ? Number(resourceContext.version) : 1,
                    visibility: policy.visibility,
                    scanStatus: 'PASSED',
                    verifiedAt: new Date(),
                    status: 'ACTIVE',
                },
            });

            return this._formatAssetDTO(asset);
        } finally {
            cleanupTempFile(tempPath);
        }
    }

    /**
     * Authorizes and generates download URL for an asset.
     */
    async getAssetDownload({ assetId, actor }) {
        const asset = await this.prisma.storedAsset.findUnique({
            where: { id: assetId },
        });

        if (!asset) {
            throw new StoredAssetServiceError('Asset not found', 'ASSET_NOT_FOUND', 404);
        }

        if (asset.bucket === 'TAM') {
            throw new StoredAssetServiceError('Access to temporary staging objects is strictly prohibited', 'ASSET_ACCESS_DENIED', 403);
        }

        if (asset.status === 'SOFT_DELETED' || asset.status === 'PURGED') {
            throw new StoredAssetServiceError('Asset has been deleted or purged', 'ASSET_GONE', 410);
        }

        if (asset.status !== 'ACTIVE') {
            throw new StoredAssetServiceError('Asset is not active', 'ASSET_NOT_ACTIVE', 400);
        }

        // Public visibility: return public URL
        if (asset.visibility === 'PUBLIC') {
            const publicUrl = this.storageAdapter.getPublicUrl({
                bucket: 'cong-khai',
                objectKey: asset.objectKey,
            });

            return {
                url: publicUrl,
                expiresAt: null,
                fileName: asset.originalName,
                visibility: 'PUBLIC',
            };
        }

        // Private visibility: requires authentication and authorization
        if (!actor) {
            throw new StoredAssetServiceError('Authentication required to access private asset', 'AUTH_REQUIRED', 401);
        }

        const bucketName = mapEnumToBucket(asset.bucket);
        const signed = await this.storageAdapter.createSignedUrl({
            bucket: bucketName,
            objectKey: asset.objectKey,
            expiresInSeconds: 600,
        });

        const numericActorId = actor?.id && Number.isInteger(Number(actor.id)) ? Number(actor.id) : null;
        if (numericActorId) {
            auditLog(numericActorId, 'ASSET_DOWNLOAD', 'StoredAsset', asset.id, {
                documentType: asset.documentType,
                objectKey: asset.objectKey,
            });
        }

        const expiresAt = new Date(Date.now() + 600 * 1000).toISOString();

        return {
            url: signed.signedUrl,
            expiresAt,
            fileName: asset.originalName,
            visibility: 'PRIVATE',
        };
    }

    /**
     * Replaces an asset with a new version, retaining the old asset for 7 days.
     */
    async replaceAsset({ oldAssetId, newAssetId, actor }) {
        const oldAsset = await this.prisma.storedAsset.findUnique({ where: { id: oldAssetId } });
        if (!oldAsset) {
            throw new StoredAssetServiceError('Old asset not found', 'ASSET_NOT_FOUND', 404);
        }

        const retentionUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await this.prisma.storedAsset.update({
            where: { id: oldAssetId },
            data: {
                status: 'REPLACED',
                retentionUntil,
                replacedById: newAssetId,
            },
        });
    }

    /**
     * Soft deletes an asset.
     */
    async softDeleteAsset({ assetId, actor }) {
        await this.prisma.storedAsset.update({
            where: { id: assetId },
            data: {
                status: 'SOFT_DELETED',
                deletedAt: new Date(),
            },
        });
    }

    /**
     * Verifies that an asset exists, is active, belongs to the actor, and matches expected policy.
     */
    async assertAssetAccess({ assetId, actorId, expectedDocumentTypes = null, expectedBucket = null }) {
        if (!assetId) {
            throw new StoredAssetServiceError('Asset ID is required', 'ASSET_ID_REQUIRED', 400);
        }

        const asset = await this.prisma.storedAsset.findUnique({
            where: { id: assetId },
        });

        if (!asset) {
            throw new StoredAssetServiceError('Asset not found', 'ASSET_NOT_FOUND', 404);
        }

        if (asset.status !== 'ACTIVE') {
            throw new StoredAssetServiceError('Asset is not active', 'ASSET_NOT_ACTIVE', 400);
        }

        if (expectedBucket && asset.bucket !== expectedBucket) {
            throw new StoredAssetServiceError('Invalid asset bucket', 'INVALID_ASSET_BUCKET', 400);
        }

        if (actorId && asset.ownerUserId !== actorId && asset.uploadedById !== actorId) {
            throw new StoredAssetServiceError('Unauthorized asset access', 'FORBIDDEN', 403);
        }

        if (expectedDocumentTypes) {
            const types = Array.isArray(expectedDocumentTypes) ? expectedDocumentTypes : [expectedDocumentTypes];
            if (!types.includes(asset.documentType)) {
                throw new StoredAssetServiceError('Invalid document type for this submission', 'INVALID_DOCUMENT_TYPE', 400);
            }
        }

        return asset;
    }
}

const defaultStoredAssetService = new StoredAssetService();

module.exports = {
    StoredAssetService,
    storedAssetService: defaultStoredAssetService,
    StoredAssetServiceError,
};
