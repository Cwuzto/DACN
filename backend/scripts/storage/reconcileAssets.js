#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = require('../../src/config/database');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');
const { reconcileStoredAssets } = require('../../src/services/storageReconciliationService');

const run = async () => {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const dryRun = !isApply;

    let limit = 100;
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        limit = parseInt(args[limitIndex + 1], 10) || 100;
    }

    console.log('='.repeat(60));
    console.log('  Storage Asset Reconciliation CLI');
    console.log(`  Mode: ${dryRun ? 'DRY-RUN (audit only, no DB writes)' : 'APPLY (registering orphan assets)'}`);
    console.log(`  Limit: ${limit}`);
    console.log('='.repeat(60));

    try {
        console.log('[INFO] Auditing consistency between DB registry and Supabase Storage...');
        const report = await reconcileStoredAssets({
            db: prisma,
            storage: storageAdapter,
            limit,
            dryRun,
        });

        console.table([
            {
                Mode: report.dryRun ? 'DRY-RUN' : 'APPLY',
                'Scanned DB Assets': report.scannedDbCount,
                'Scanned Storage Files': report.scannedStorageCount,
                'Synced Assets': report.syncedCount,
                'Missing in Storage': report.missingObjects.length,
                'Orphans in Storage': report.orphanObjects.length,
            },
        ]);

        if (report.missingObjects.length > 0) {
            console.warn(`\n[WARNING] Found ${report.missingObjects.length} active database records with missing objects in Storage:`);
            console.table(report.missingObjects.slice(0, 10));
        }

        if (report.orphanObjects.length > 0) {
            console.warn(`\n[WARNING] Found ${report.orphanObjects.length} stray objects in Storage without active DB record:`);
            console.table(report.orphanObjects.slice(0, 10));
        }

        if (dryRun) {
            console.log('\n[NOTE] Dry-run completed. Zero changes were made.');
            console.log('To register orphan files as ORPHANED with 30-day retention:');
            console.log('  npm --prefix backend run storage:reconcile -- --apply\n');
        } else {
            console.log('\n[SUCCESS] Storage reconciliation completed successfully.\n');
        }
    } catch (err) {
        console.error(`\n[FATAL] Reconciliation failed: ${err.message}`);
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
