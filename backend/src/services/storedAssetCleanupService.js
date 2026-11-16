const { STORAGE_BUCKETS } = require('../config/storageConfig');

const mapEnumToBucket = (bucketEnum) => {
    if (!bucketEnum) return 'tam';
    const val = String(bucketEnum).toUpperCase();
    if (val === 'CONG_KHAI') return 'cong-khai';
    if (val === 'HOC_VU') return 'hoc-vu';
    if (val === 'CA_NHAN') return 'ca-nhan';
    if (val === 'TAM') return 'tam';
    return String(bucketEnum).toLowerCase();
};

const enqueueExpiredRetentionAssets = async ({ db, now = new Date() } = {}) => {
    const expiredAssets = await db.storedAsset.findMany({
        where: {
            status: { in: ['REPLACED', 'SOFT_DELETED', 'ORPHANED'] },
            retentionUntil: { lte: now, not: null },
            deletedAt: null,
        },
    });

    let count = 0;
    for (const asset of expiredAssets) {
        await db.storedAssetCleanupJob.create({
            data: {
                assetId: asset.id,
                bucket: asset.bucket,
                objectKey: asset.objectKey,
                reason: `EXPIRED_RETENTION_${asset.status}`,
                scheduledAt: now,
            },
        });
        await db.storedAsset.update({
            where: { id: asset.id },
            data: { deletedAt: now },
        });
        count++;
    }

    return count;
};

const enqueueExpiredUploadSessions = async ({ db, now = new Date() } = {}) => {
    const expiredSessions = await db.storedAssetUploadSession.findMany({
        where: {
            status: { in: ['CREATED', 'UPLOADING', 'UPLOADED', 'FINALIZING'] },
            expiresAt: { lte: now },
        },
    });

    let count = 0;
    for (const session of expiredSessions) {
        await db.storedAssetUploadSession.update({
            where: { id: session.id },
            data: { status: 'EXPIRED' },
        });

        await db.storedAssetCleanupJob.create({
            data: {
                bucket: session.stagingBucket,
                objectKey: session.stagingPath,
                reason: 'EXPIRED_UPLOAD_SESSION',
                scheduledAt: now,
            },
        });
        count++;
    }

    return count;
};

const processCleanupBatch = async ({
    db,
    storage,
    limit = 50,
    now = new Date(),
    workerId = 'worker-1',
    lockTimeoutMs = 5 * 60 * 1000,
} = {}) => {
    const startedAt = now.toISOString();

    const enqueuedRetention = await enqueueExpiredRetentionAssets({ db, now });
    const enqueuedSessions = await enqueueExpiredUploadSessions({ db, now });
    const enqueuedCount = enqueuedRetention + enqueuedSessions;

    const lockThreshold = new Date(now.getTime() - lockTimeoutMs);

    // Find due cleanup jobs
    const dueJobs = await db.storedAssetCleanupJob.findMany({
        where: {
            completedAt: null,
            scheduledAt: { lte: now },
            OR: [{ lockedAt: null }, { lockedAt: { lte: lockThreshold } }],
        },
        take: limit,
        orderBy: { scheduledAt: 'asc' },
    });

    let processedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;
    const jobsReport = [];

    for (const job of dueJobs) {
        if (job.attempts >= job.maxAttempts) {
            continue; // Skip exhausted attempts
        }

        processedCount++;

        // Lock job
        await db.storedAssetCleanupJob.update({
            where: { id: job.id },
            data: {
                lockedAt: now,
                lockedBy: workerId,
                attempts: { increment: 1 },
            },
        });

        const targetBucket = mapEnumToBucket(job.bucket);

        try {
            await storage.remove({ bucket: targetBucket, objectKey: job.objectKey });

            if (job.assetId) {
                await db.storedAsset.update({
                    where: { id: job.assetId },
                    data: {
                        status: 'PURGED',
                        deletedAt: now,
                    },
                });
            }

            await db.storedAssetCleanupJob.update({
                where: { id: job.id },
                data: {
                    completedAt: now,
                    lockedAt: null,
                    lockedBy: null,
                },
            });

            succeededCount++;
            jobsReport.push({ id: job.id, status: 'COMPLETED', objectKey: job.objectKey });
        } catch (err) {
            failedCount++;
            await db.storedAssetCleanupJob.update({
                where: { id: job.id },
                data: {
                    lockedAt: null,
                    lockedBy: null,
                    lastError: err.message,
                },
            });
            jobsReport.push({ id: job.id, status: 'FAILED', error: err.message });
        }
    }

    return {
        workerId,
        startedAt,
        completedAt: new Date().toISOString(),
        enqueuedCount,
        processedCount,
        succeededCount,
        failedCount,
        jobs: jobsReport,
    };
};

module.exports = {
    mapEnumToBucket,
    enqueueExpiredRetentionAssets,
    enqueueExpiredUploadSessions,
    processCleanupBatch,
};
