const {
    processCleanupBatch,
    enqueueExpiredRetentionAssets,
    enqueueExpiredUploadSessions,
} = require('../../src/services/storedAssetCleanupService');

describe('storedAssetCleanupService', () => {
    let mockPrisma;
    let mockStorage;

    beforeEach(() => {
        mockPrisma = {
            storedAsset: {
                findMany: jest.fn().mockResolvedValue([]),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            storedAssetUploadSession: {
                findMany: jest.fn().mockResolvedValue([]),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            storedAssetCleanupJob: {
                findMany: jest.fn().mockResolvedValue([]),
                create: jest.fn().mockResolvedValue({}),
                update: jest.fn().mockResolvedValue({}),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            $transaction: jest.fn((callback) => callback(mockPrisma)),
        };

        mockStorage = {
            remove: jest.fn().mockResolvedValue({ data: [] }),
            exists: jest.fn().mockResolvedValue(true),
        };
    });

    describe('Retention & Enqueue Rules', () => {
        it('never enqueues active or reference assets for cleanup', async () => {
            const now = new Date('2026-11-17T10:00:00Z');
            // Mock returning active assets
            mockPrisma.storedAsset.findMany.mockResolvedValue([]);

            const count = await enqueueExpiredRetentionAssets({ db: mockPrisma, now });

            expect(count).toBe(0);
            expect(mockPrisma.storedAssetCleanupJob.create).not.toHaveBeenCalled();
        });

        it('enqueues expired soft-deleted and replaced assets when retentionUntil <= now', async () => {
            const now = new Date('2026-11-17T10:00:00Z');
            const pastDate = new Date('2026-11-10T09:00:00Z');

            mockPrisma.storedAsset.findMany.mockResolvedValue([
                {
                    id: 'asset-replaced-1',
                    bucket: 'CA_NHAN',
                    objectKey: 'avatars/old-avatar.jpg',
                    status: 'REPLACED',
                    retentionUntil: pastDate,
                },
                {
                    id: 'asset-soft-deleted-2',
                    bucket: 'HOC_VU',
                    objectKey: 'bm02/draft.pdf',
                    status: 'SOFT_DELETED',
                    retentionUntil: pastDate,
                },
            ]);

            const count = await enqueueExpiredRetentionAssets({ db: mockPrisma, now });

            expect(count).toBe(2);
            expect(mockPrisma.storedAssetCleanupJob.create).toHaveBeenCalledTimes(2);
            expect(mockPrisma.storedAssetCleanupJob.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        assetId: 'asset-replaced-1',
                        bucket: 'CA_NHAN',
                        objectKey: 'avatars/old-avatar.jpg',
                        reason: 'EXPIRED_RETENTION_REPLACED',
                    }),
                })
            );
        });

        it('enqueues expired incomplete TUS / upload sessions older than 24h', async () => {
            const now = new Date('2026-11-17T10:00:00Z');
            const expiredAt = new Date('2026-11-16T08:00:00Z');

            mockPrisma.storedAssetUploadSession.findMany.mockResolvedValue([
                {
                    id: 'session-incomplete-1',
                    stagingBucket: 'TAM',
                    stagingPath: 'cho-kiem-tra/session-1/upload.bin',
                    status: 'UPLOADING',
                    expiresAt: expiredAt,
                },
            ]);

            const count = await enqueueExpiredUploadSessions({ db: mockPrisma, now });

            expect(count).toBe(1);
            expect(mockPrisma.storedAssetUploadSession.update).toHaveBeenCalledWith({
                where: { id: 'session-incomplete-1' },
                data: { status: 'EXPIRED' },
            });
            expect(mockPrisma.storedAssetCleanupJob.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        bucket: 'TAM',
                        objectKey: 'cho-kiem-tra/session-1/upload.bin',
                        reason: 'EXPIRED_UPLOAD_SESSION',
                    }),
                })
            );
        });
    });

    describe('Worker Locking and Bounded Retry', () => {
        it('prevents double-processing by locking claimed jobs with workerId', async () => {
            const now = new Date('2026-11-17T10:00:00Z');
            const job = {
                id: 'job-1',
                bucket: 'TAM',
                objectKey: 'temp/file.bin',
                assetId: 'asset-temp-1',
                attempts: 0,
                maxAttempts: 5,
                lockedAt: null,
                completedAt: null,
            };

            mockPrisma.storedAssetCleanupJob.findMany.mockResolvedValue([job]);
            mockPrisma.storedAssetCleanupJob.update.mockResolvedValue({
                ...job,
                lockedAt: now,
                lockedBy: 'worker-unit-1',
            });

            const report = await processCleanupBatch({
                db: mockPrisma,
                storage: mockStorage,
                limit: 10,
                now,
                workerId: 'worker-unit-1',
            });

            expect(report.processedCount).toBe(1);
            expect(report.succeededCount).toBe(1);
            expect(mockStorage.remove).toHaveBeenCalledWith({
                bucket: 'tam',
                objectKey: 'temp/file.bin',
            });
            // Marks job completed
            expect(mockPrisma.storedAssetCleanupJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        completedAt: expect.any(Date),
                    }),
                })
            );
        });

        it('retries with bounded backoff and records lastError when storage.remove fails', async () => {
            const now = new Date('2026-11-17T10:00:00Z');
            const job = {
                id: 'job-fail-1',
                bucket: 'HOC_VU',
                objectKey: 'docs/test.pdf',
                assetId: 'asset-doc-1',
                attempts: 1,
                maxAttempts: 5,
                lockedAt: null,
                completedAt: null,
            };

            mockPrisma.storedAssetCleanupJob.findMany.mockResolvedValue([job]);
            mockStorage.remove.mockRejectedValue(new Error('Storage service 503 unavailable'));

            const report = await processCleanupBatch({
                db: mockPrisma,
                storage: mockStorage,
                limit: 10,
                now,
                workerId: 'worker-retry',
            });

            expect(report.failedCount).toBe(1);
            // Job unlocked for retry and lastError recorded
            expect(mockPrisma.storedAssetCleanupJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-fail-1' },
                    data: expect.objectContaining({
                        lockedAt: null,
                        lockedBy: null,
                        lastError: 'Storage service 503 unavailable',
                    }),
                })
            );
        });
    });
});
