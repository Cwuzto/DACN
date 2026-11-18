const fs = require('fs');
const path = require('path');
const { StoredAssetService } = require('../../src/services/storedAssetService');
const { getTempUploadDir, cleanupTempFile } = require('../../src/storage/tempFileManager');
const { STORED_DOCUMENT_TYPES } = require('../../src/storage/assetPolicyCatalog');

describe('Task 5: StoredAssetService Unit and Service Tests', () => {
    let mockPrisma;
    let mockStorageAdapter;
    let service;
    const createdFiles = [];

    const createTempPdf = () => {
        const tempDir = getTempUploadDir();
        const filePath = path.join(tempDir, `test-service-${Date.now()}.pdf`);
        fs.writeFileSync(filePath, Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'));
        createdFiles.push(filePath);
        return filePath;
    };

    beforeEach(() => {
        mockPrisma = {
            storedAsset: {
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
                    id: data.id || 'uuid-asset-1',
                    ...data,
                    sizeBytes: data.sizeBytes,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })),
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            storedAssetUploadSession: {
                create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
                    id: data.id || 'session-uuid-1',
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })),
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            storedAssetCleanupJob: {
                create: jest.fn().mockResolvedValue({ id: 'job-1' }),
            },
            $transaction: jest.fn().mockImplementation((fn) => {
                if (typeof fn === 'function') {
                    return fn(mockPrisma);
                }
                return Promise.all(fn);
            }),
        };

        mockStorageAdapter = {
            upload: jest.fn().mockResolvedValue({ path: 'uploaded-path' }),
            move: jest.fn().mockResolvedValue({ message: 'moved' }),
            stat: jest.fn().mockResolvedValue({
                size: 2048,
                mimetype: 'application/pdf',
            }),
            download: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF')),
            remove: jest.fn().mockResolvedValue({}),
            createSignedUrl: jest.fn().mockResolvedValue({
                signedUrl: 'https://example.com/signed-download-url',
            }),
            createSignedUploadUrl: jest.fn().mockResolvedValue({
                url: 'https://example.com/signed-upload-url',
                token: 'mock-signed-token',
            }),
            getPublicUrl: jest.fn().mockReturnValue('https://example.com/public-logo.png'),
        };

        service = new StoredAssetService({
            prisma: mockPrisma,
            storageAdapter: mockStorageAdapter,
        });
    });

    afterEach(() => {
        for (const f of createdFiles) {
            cleanupTempFile(f);
        }
        createdFiles.length = 0;
    });

    describe('ingestAsset (Multipart <= 6MB)', () => {
        test('successfully ingests a valid multipart file and promotes it to target bucket', async () => {
            const filePath = createTempPdf();
            const tempFile = {
                path: filePath,
                originalname: 'De_Cuong.pdf',
                mimetype: 'application/pdf',
                size: 1024,
            };

            const actor = { id: 'user-1', role: 'STUDENT' };
            const resourceContext = {
                registrationId: 101,
                academicYear: '2025-2026',
                semester: 1,
                projectType: 'datn',
                round: 1,
                version: 1,
            };

            const result = await service.ingestAsset({
                tempFile,
                documentType: STORED_DOCUMENT_TYPES.BM01,
                resourceContext,
                actor,
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.documentType).toBe(STORED_DOCUMENT_TYPES.BM01);
            expect(result.status).toBe('ACTIVE');
            expect(result.visibility).toBe('PRIVATE');

            // Must upload to tam, then move to hoc-vu
            expect(mockStorageAdapter.upload).toHaveBeenCalledWith(
                expect.objectContaining({ bucket: 'tam' })
            );
            expect(mockStorageAdapter.move).toHaveBeenCalledWith(
                expect.objectContaining({
                    fromBucket: 'tam',
                    toBucket: 'hoc-vu',
                })
            );
            expect(mockPrisma.storedAsset.create).toHaveBeenCalled();
        });

        test('rejects multipart file exceeding 6MB with ASSET_TUS_REQUIRED', async () => {
            const tempFile = {
                path: '/dummy/large.pdf',
                originalname: 'large.pdf',
                mimetype: 'application/pdf',
                size: 6291456 + 1, // 6 MB + 1 byte
            };

            await expect(
                service.ingestAsset({
                    tempFile,
                    documentType: STORED_DOCUMENT_TYPES.BM01,
                    resourceContext: { registrationId: 101 },
                    actor: { id: 'user-1' },
                })
            ).rejects.toThrow(/TUS/i);
        });

        test('enqueues cleanup job and throws when Prisma database insert fails', async () => {
            const filePath = createTempPdf();
            const tempFile = {
                path: filePath,
                originalname: 'De_Cuong.pdf',
                mimetype: 'application/pdf',
                size: 1024,
            };

            mockPrisma.storedAsset.create.mockRejectedValueOnce(new Error('DB connection lost'));

            await expect(
                service.ingestAsset({
                    tempFile,
                    documentType: STORED_DOCUMENT_TYPES.BM01,
                    resourceContext: { registrationId: 101 },
                    actor: { id: 'user-1' },
                })
            ).rejects.toThrow(/DB connection lost/);

            // Cleanup job must be enqueued
            expect(mockPrisma.storedAssetCleanupJob.create).toHaveBeenCalled();
        });
    });

    describe('createUploadSession (TUS > 6MB to 50MB)', () => {
        test('creates TUS upload session and returns signed upload token and 6MB chunk config', async () => {
            const session = await service.createUploadSession({
                documentType: STORED_DOCUMENT_TYPES.REPORT_PDF,
                resourceContext: { registrationId: 101 },
                actor: { id: 'user-1' },
                originalName: 'BaoCao.pdf',
                declaredMime: 'application/pdf',
                sizeBytes: 15 * 1024 * 1024, // 15 MB
                idempotencyKey: 'idemp-key-1',
            });

            expect(session.sessionId).toBeDefined();
            expect(session.chunkSizeBytes).toBe(6291456); // 6 MB
            expect(session.tusEndpoint).toBeDefined();
            expect(session.token).toBe('mock-signed-token');
            expect(session.stagingBucket).toBe('tam');
            expect(mockPrisma.storedAssetUploadSession.create).toHaveBeenCalled();
        });

        test('idempotently returns existing active session for same idempotencyKey', async () => {
            mockPrisma.storedAssetUploadSession.findFirst.mockResolvedValueOnce({
                id: 'existing-session-1',
                actorId: 'user-1',
                stagingBucket: 'TAM',
                stagingObjectKey: 'cho-kiem-tra/existing.pdf',
                transport: 'TUS',
                declaredSizeBytes: BigInt(15000000),
                declaredMime: 'application/pdf',
                originalName: 'BaoCao.pdf',
                status: 'CREATED',
                expiresAt: new Date(Date.now() + 3600000),
            });

            const session = await service.createUploadSession({
                documentType: STORED_DOCUMENT_TYPES.REPORT_PDF,
                resourceContext: { registrationId: 101 },
                actor: { id: 'user-1' },
                originalName: 'BaoCao.pdf',
                declaredMime: 'application/pdf',
                sizeBytes: 15 * 1024 * 1024,
                idempotencyKey: 'idemp-key-1',
            });

            expect(session.sessionId).toBe('existing-session-1');
            expect(mockPrisma.storedAssetUploadSession.create).not.toHaveBeenCalled();
        });

        test('rejects size exceeding policy maxBytes or 50MB ceiling', async () => {
            await expect(
                service.createUploadSession({
                    documentType: STORED_DOCUMENT_TYPES.REPORT_PDF,
                    resourceContext: { registrationId: 101 },
                    actor: { id: 'user-1' },
                    originalName: 'TooLarge.pdf',
                    declaredMime: 'application/pdf',
                    sizeBytes: 55 * 1024 * 1024, // 55 MB > 50 MB
                })
            ).rejects.toThrow(/ceiling|exceeds/i);
        });
    });

    describe('finalizeUploadSession', () => {
        test('verifies staged object, inspects bytes, moves to target bucket, and completes session', async () => {
            mockPrisma.storedAssetUploadSession.findUnique.mockResolvedValueOnce({
                id: 'session-1',
                actorId: 'user-1',
                documentType: STORED_DOCUMENT_TYPES.REPORT_PDF,
                resourceContext: { registrationId: 101 },
                stagingBucket: 'TAM',
                stagingObjectKey: 'cho-kiem-tra/ngay-2026-11-17/phien-session-1/uuid-report.pdf',
                transport: 'TUS',
                declaredSizeBytes: BigInt(2048),
                declaredMime: 'application/pdf',
                originalName: 'BaoCao.pdf',
                status: 'UPLOADING',
                expiresAt: new Date(Date.now() + 3600000),
            });

            const asset = await service.finalizeUploadSession({
                sessionId: 'session-1',
                actor: { id: 'user-1' },
            });

            expect(asset).toBeDefined();
            expect(mockStorageAdapter.stat).toHaveBeenCalledWith(
                expect.objectContaining({ bucket: 'tam' })
            );
            expect(mockStorageAdapter.move).toHaveBeenCalledWith(
                expect.objectContaining({
                    fromBucket: 'tam',
                    toBucket: 'hoc-vu',
                })
            );
            expect(mockPrisma.storedAssetUploadSession.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ status: 'COMPLETED' }),
                })
            );
        });

        test('is idempotent when finalize is called twice', async () => {
            mockPrisma.storedAssetUploadSession.findUnique.mockResolvedValueOnce({
                id: 'session-1',
                actorId: 'user-1',
                status: 'COMPLETED',
                finalizedAssetId: 'already-created-asset-id',
            });
            mockPrisma.storedAsset.findUnique.mockResolvedValueOnce({
                id: 'already-created-asset-id',
                status: 'ACTIVE',
                originalName: 'BaoCao.pdf',
                sizeBytes: 2048n,
            });

            const asset = await service.finalizeUploadSession({
                sessionId: 'session-1',
                actor: { id: 'user-1' },
            });

            expect(asset.id).toBe('already-created-asset-id');
            expect(mockStorageAdapter.move).not.toHaveBeenCalled();
        });

        test('rejects finalize if actor is not the owner', async () => {
            mockPrisma.storedAssetUploadSession.findUnique.mockResolvedValueOnce({
                id: 'session-1',
                actorId: 'user-1',
                status: 'UPLOADING',
                expiresAt: new Date(Date.now() + 3600000),
            });

            await expect(
                service.finalizeUploadSession({
                    sessionId: 'session-1',
                    actor: { id: 'attacker-user', role: 'STUDENT' },
                })
            ).rejects.toThrow(/forbidden|permission/i);
        });
    });

    describe('getAssetDownload', () => {
        test('returns 600-second signed URL for authorized private asset', async () => {
            mockPrisma.storedAsset.findUnique.mockResolvedValueOnce({
                id: 'asset-private-1',
                bucket: 'HOC_VU',
                objectKey: 'bm01/file.pdf',
                status: 'ACTIVE',
                visibility: 'PRIVATE',
                originalName: 'DeCuong.pdf',
                ownerUserId: 'user-1',
            });

            const result = await service.getAssetDownload({
                assetId: 'asset-private-1',
                actor: { id: 'user-1', role: 'STUDENT' },
            });

            expect(result.url).toBe('https://example.com/signed-download-url');
            expect(result.visibility).toBe('PRIVATE');
            expect(result.fileName).toBe('DeCuong.pdf');
            expect(mockStorageAdapter.createSignedUrl).toHaveBeenCalledWith(
                expect.objectContaining({
                    bucket: 'hoc-vu',
                    objectKey: 'bm01/file.pdf',
                    expiresInSeconds: 600,
                })
            );
        });

        test('returns public URL for public asset in cong-khai', async () => {
            mockPrisma.storedAsset.findUnique.mockResolvedValueOnce({
                id: 'asset-public-1',
                bucket: 'CONG_KHAI',
                objectKey: 'thuong-hieu/logo.png',
                status: 'ACTIVE',
                visibility: 'PUBLIC',
                originalName: 'logo.png',
            });

            const result = await service.getAssetDownload({
                assetId: 'asset-public-1',
                actor: null,
            });

            expect(result.url).toBe('https://example.com/public-logo.png');
            expect(result.visibility).toBe('PUBLIC');
            expect(mockStorageAdapter.createSignedUrl).not.toHaveBeenCalled();
        });

        test('strictly refuses to generate download URL for objects in tam bucket', async () => {
            mockPrisma.storedAsset.findUnique.mockResolvedValueOnce({
                id: 'asset-temp-1',
                bucket: 'TAM',
                objectKey: 'cho-kiem-tra/file.pdf',
                status: 'STAGED',
                visibility: 'PRIVATE',
            });

            await expect(
                service.getAssetDownload({
                    assetId: 'asset-temp-1',
                    actor: { id: 'user-1', role: 'ADMIN' },
                })
            ).rejects.toThrow(/tam|temporary/i);
        });

        test('rejects download for SOFT_DELETED or PURGED asset', async () => {
            mockPrisma.storedAsset.findUnique.mockResolvedValueOnce({
                id: 'deleted-asset',
                status: 'SOFT_DELETED',
            });

            await expect(
                service.getAssetDownload({
                    assetId: 'deleted-asset',
                    actor: { id: 'user-1', role: 'ADMIN' },
                })
            ).rejects.toThrow(/not active|deleted/i);
        });
    });
});
