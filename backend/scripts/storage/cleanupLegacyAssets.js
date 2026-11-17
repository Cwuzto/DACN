#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = require('../../src/config/database');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');
const { applyLegacyManifest } = require('../../src/services/legacyStorageMigrationService');

const run = async (
    argv = process.argv.slice(2),
    {
        db = prisma,
        storage = storageAdapter,
        applyManifest = applyLegacyManifest,
        exit = (code) => process.exit(code),
    } = {}
) => {
    const args = argv;
    const isApply = args.includes('--apply');
    const dryRun = !isApply;
    const snapshotConfirmed = args.includes('--confirm-snapshot');

    const manifestIndex = args.indexOf('--manifest');
    if (manifestIndex === -1 || !args[manifestIndex + 1]) {
        console.error('[ERROR] Missing required --manifest <path> argument.');
        console.error('Usage: node backend/scripts/storage/cleanupLegacyAssets.js --dry-run --manifest <path>');
        console.error('       node backend/scripts/storage/cleanupLegacyAssets.js --apply --confirm-snapshot --manifest <path>');
        return exit(1);
    }

    if (isApply && !snapshotConfirmed) {
        console.error('[ERROR] --apply requires explicit --confirm-snapshot flag. Aborting before any writes.');
        console.error('Usage: node backend/scripts/storage/cleanupLegacyAssets.js --apply --confirm-snapshot --manifest <path>');
        return exit(1);
    }

    const manifestPath = path.resolve(args[manifestIndex + 1]);

    console.log('='.repeat(60));
    console.log('  Legacy Storage Cleanup CLI');
    console.log(`  Mode: ${dryRun ? 'DRY-RUN (planning only, no writes)' : 'APPLY (executing cleanup)'}`);
    console.log(`  Manifest: ${manifestPath}`);
    console.log(`  Snapshot Confirmed: ${snapshotConfirmed ? 'YES' : 'NO'}`);
    console.log('='.repeat(60));

    let exitCode = 0;
    let report = null;

    try {
        report = await applyManifest({
            manifestPath,
            db,
            storage,
            dryRun,
            snapshotConfirmed,
            actor: 'CLI_OPERATOR',
        });

        console.log('\nCleanup Execution Report:');
        console.table([
            {
                DryRun: report.dryRun ? 'YES' : 'NO',
                Total: report.summary.total,
                Processed: report.summary.processed,
                Succeeded: report.summary.succeeded,
                Failed: report.summary.failed,
                Skipped: report.summary.skipped,
            },
        ]);

        if (dryRun) {
            console.log('\n[NOTE] Dry-run completed. Zero changes were made.');
            console.log('To apply these changes after confirming a DB snapshot:');
            console.log(`  node backend/scripts/storage/cleanupLegacyAssets.js --apply --confirm-snapshot --manifest "${manifestPath}"\n`);
        } else if (report.summary.failed > 0) {
            console.error(`\n[ERROR] Cleanup finished with ${report.summary.failed} failed item(s). Exiting with non-zero status.\n`);
            exitCode = 1;
        } else {
            console.log('\n[SUCCESS] Cleanup completed successfully.\n');
        }
    } catch (err) {
        console.error(`\n[FATAL] Cleanup failed: ${err.message}`);
        if (err.stack) console.error(err.stack);
        exitCode = 1;
    } finally {
        if (db && typeof db.$disconnect === 'function') {
            await db.$disconnect();
        }
    }

    if (exitCode !== 0) {
        exit(exitCode);
    }

    return report;
};

if (require.main === module) {
    run();
}

module.exports = { run };
