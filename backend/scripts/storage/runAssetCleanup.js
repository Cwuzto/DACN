#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = require('../../src/config/database');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');
const { processCleanupBatch } = require('../../src/services/storedAssetCleanupService');

const run = async () => {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const dryRun = !isApply;

    let limit = 50;
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        limit = parseInt(args[limitIndex + 1], 10) || 50;
    }

    console.log('='.repeat(60));
    console.log('  Stored Asset Retention & Cleanup CLI');
    console.log(`  Mode: ${dryRun ? 'DRY-RUN (planning/check only)' : 'APPLY (executing purges)'}`);
    console.log(`  Batch Limit: ${limit}`);
    console.log('='.repeat(60));

    try {
        if (dryRun) {
            console.log('[INFO] Dry-run check: counting pending cleanup jobs and expired sessions...');
            const pendingJobsCount = await prisma.storedAssetCleanupJob.count({
                where: { completedAt: null },
            });
            const expiredSessionsCount = await prisma.storedAssetUploadSession.count({
                where: {
                    status: { in: ['CREATED', 'UPLOADING', 'UPLOADED', 'FINALIZING'] },
                    expiresAt: { lte: new Date() },
                },
            });
            const expiredRetentionCount = await prisma.storedAsset.count({
                where: {
                    status: { in: ['REPLACED', 'SOFT_DELETED', 'ORPHANED'] },
                    retentionUntil: { lte: new Date(), not: null },
                    deletedAt: null,
                },
            });

            console.table([
                {
                    'Pending Cleanup Jobs': pendingJobsCount,
                    'Expired Upload Sessions': expiredSessionsCount,
                    'Expired Retention Assets': expiredRetentionCount,
                },
            ]);

            console.log('\n[NOTE] Dry-run completed. Zero objects were deleted.');
            console.log('To execute cleanup, re-run with:');
            console.log('  npm --prefix backend run storage:cleanup -- --apply\n');
        } else {
            console.log('[INFO] Executing cleanup batch...');
            const report = await processCleanupBatch({
                db: prisma,
                storage: storageAdapter,
                limit,
                workerId: `CLI_CLEANUP_${process.pid}`,
            });

            console.table([
                {
                    Worker: report.workerId,
                    Enqueued: report.enqueuedCount,
                    Processed: report.processedCount,
                    Succeeded: report.succeededCount,
                    Failed: report.failedCount,
                },
            ]);

            console.log('\n[SUCCESS] Cleanup batch finished successfully.\n');
        }
    } catch (err) {
        console.error(`\n[FATAL] Cleanup failed: ${err.message}`);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
};

if (require.main === module) {
    run();
}

module.exports = { run };
