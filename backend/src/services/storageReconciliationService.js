const { STORAGE_BUCKETS } = require('../config/storageConfig');

const mapBucketToEnum = (bucket) => {
    if (!bucket) return 'TAM';
    const val = String(bucket).toLowerCase();
    if (val === 'cong-khai') return 'CONG_KHAI';
    if (val === 'hoc-vu') return 'HOC_VU';
    if (val === 'ca-nhan') return 'CA_NHAN';
    if (val === 'tam') return 'TAM';
    return String(bucket).toUpperCase();
};

const mapEnumToBucket = (bucketEnum) => {
    if (!bucketEnum) return 'tam';
    const val = String(bucketEnum).toUpperCase();
    if (val === 'CONG_KHAI') return 'cong-khai';
    if (val === 'HOC_VU') return 'hoc-vu';
    if (val === 'CA_NHAN') return 'ca-nhan';
    if (val === 'TAM') return 'tam';
    return String(bucketEnum).toLowerCase();
};

const reconcileStoredAssets = async ({
    db,
    storage,
    buckets = ['hoc-vu', 'ca-nhan', 'cong-khai', 'tam'],
    limit = 100,
    dryRun = true,
    now = new Date(),
} = {}) => {
    const missingObjects = [];
    const orphanObjects = [];
    let syncedCount = 0;

    // 1. Check DB Active Assets -> Storage
    const activeAssets = await db.storedAsset.findMany({
        where: { status: 'ACTIVE' },
        take: limit,
    });

    const scannedDbCount = activeAssets.length;

    for (const asset of activeAssets) {
        const targetBucket = mapEnumToBucket(asset.bucket);
        const exists = await storage.exists({ bucket: targetBucket, objectKey: asset.objectKey });
        if (!exists) {
            missingObjects.push({
                assetId: asset.id,
                bucket: asset.bucket,
                objectKey: asset.objectKey,
            });
        } else {
            syncedCount++;
        }
    }

    // 2. Check Storage -> DB (Orphan Detection)
    let scannedStorageCount = 0;

    for (const bucket of buckets) {
        let items = [];
        try {
            if (typeof storage.list === 'function') {
                const res = await storage.list('', { bucket });
                items = Array.isArray(res) ? res : res?.data || [];
            }
        } catch {
            items = [];
        }

        scannedStorageCount += items.length;

        for (const item of items) {
            if (!item.name || item.name.endsWith('/')) continue; // Skip folders

            const enumBucket = mapBucketToEnum(bucket);
            const existsInDb =
                (await db.storedAsset.findUnique?.({
                    where: { bucket_objectKey: { bucket: enumBucket, objectKey: item.name } },
                })) ||
                (await db.storedAsset.findFirst?.({
                    where: { bucket: enumBucket, objectKey: item.name },
                }));

            if (!existsInDb) {
                orphanObjects.push({
                    name: item.name,
                    bucket,
                    size: item.metadata?.size,
                });

                if (!dryRun) {
                    const retentionUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
                    let uploaderId = 1;
                    if (db.user?.findFirst) {
                        const firstUser = await db.user.findFirst({ select: { id: true } });
                        if (firstUser) uploaderId = firstUser.id;
                    }

                    await db.storedAsset.create({
                        data: {
                            bucket: enumBucket,
                            objectKey: item.name,
                            originalName: item.name,
                            normalizedName: item.name,
                            extension: item.name.split('.').pop() || '',
                            declaredMime: item.metadata?.mimetype || 'application/octet-stream',
                            detectedMime: item.metadata?.mimetype || 'application/octet-stream',
                            sizeBytes: BigInt(item.metadata?.size || 0),
                            sha256: '0'.repeat(64),
                            uploadedById: uploaderId,
                            documentType: 'PORTAL_DOCUMENT',
                            status: 'ORPHANED',
                            retentionUntil,
                        },
                    });
                }
            }
        }
    }

    return {
        dryRun: Boolean(dryRun),
        scannedDbCount,
        scannedStorageCount,
        missingObjects,
        orphanObjects,
        syncedCount,
    };
};

module.exports = {
    mapBucketToEnum,
    mapEnumToBucket,
    reconcileStoredAssets,
};
