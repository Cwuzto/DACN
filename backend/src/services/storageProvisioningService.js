const { STORAGE_BUCKETS, BUCKET_PRIVACY } = require('../config/storageConfig');

/**
 * Provision and audit the 4 canonical Supabase Storage buckets.
 * @param {Object} params
 * @param {Object} params.storage - Supabase storage client
 * @param {boolean} [params.dryRun=true] - If true, only reports changes without writing
 * @returns {Promise<Object>} Provisioning report
 */
const provisionStorageBuckets = async ({ storage, dryRun = true } = {}) => {
    if (!storage || typeof storage.listBuckets !== 'function') {
        throw new Error('A valid Supabase storage client is required to provision storage buckets.');
    }

    const { data: buckets, error: listError } = await storage.listBuckets();
    if (listError) {
        throw listError;
    }

    const existingBuckets = buckets || [];
    const existingMap = new Map(existingBuckets.map((bucket) => [bucket.name, bucket]));

    const actions = [];
    const expectedBucketNames = Object.values(STORAGE_BUCKETS);

    for (const bucketName of expectedBucketNames) {
        const expectedPublic = BUCKET_PRIVACY[bucketName];
        const existingBucket = existingMap.get(bucketName);

        if (!existingBucket) {
            if (dryRun) {
                actions.push({
                    bucket: bucketName,
                    action: 'create',
                    public: expectedPublic,
                    status: 'plan',
                });
            } else {
                const { error: createError } = await storage.createBucket(bucketName, {
                    public: expectedPublic,
                });
                if (createError) {
                    throw createError;
                }
                actions.push({
                    bucket: bucketName,
                    action: 'create',
                    public: expectedPublic,
                    status: 'created',
                });
            }
        } else {
            const currentPublic = Boolean(existingBucket.public);
            if (currentPublic !== expectedPublic) {
                if (dryRun) {
                    actions.push({
                        bucket: bucketName,
                        action: 'update',
                        drift: true,
                        currentPublic,
                        expectedPublic,
                        status: 'drift_detected',
                    });
                } else {
                    const { error: updateError } = await storage.updateBucket(bucketName, {
                        public: expectedPublic,
                    });
                    if (updateError) {
                        throw updateError;
                    }
                    actions.push({
                        bucket: bucketName,
                        action: 'update',
                        drift: true,
                        currentPublic,
                        expectedPublic,
                        status: 'updated',
                    });
                }
            } else {
                actions.push({
                    bucket: bucketName,
                    action: 'match',
                    public: expectedPublic,
                    status: 'synced',
                });
            }
        }
    }

    return {
        dryRun,
        actions,
        buckets: expectedBucketNames,
        summary: {
            total: actions.length,
            created: actions.filter((a) => a.action === 'create').length,
            updated: actions.filter((a) => a.action === 'update').length,
            matched: actions.filter((a) => a.action === 'match').length,
        },
    };
};

module.exports = {
    provisionStorageBuckets,
};
