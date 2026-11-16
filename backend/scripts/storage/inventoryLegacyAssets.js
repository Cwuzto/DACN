#!/usr/bin/env node
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = require('../../src/config/database');
const { storageAdapter } = require('../../src/storage/supabaseStorageAdapter');
const { buildLegacyManifest } = require('../../src/services/legacyStorageMigrationService');

const run = async () => {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--apply'); // Default dry-run
    let outputPath = null;

    const outIndex = args.indexOf('--output');
    if (outIndex !== -1 && args[outIndex + 1]) {
        outputPath = path.resolve(args[outIndex + 1]);
    } else {
        outputPath = path.join(os.tmpdir(), `legacy-storage-manifest-${Date.now()}.json`);
    }

    console.log('='.repeat(60));
    console.log('  Legacy Storage Assets Inventory CLI');
    console.log(`  Mode: ${dryRun ? 'DRY-RUN (scan & export manifest only)' : 'LIVE'}`);
    console.log(`  Output Path: ${outputPath}`);
    console.log('='.repeat(60));

    try {
        console.log('[INFO] Scanning database and storage for legacy assets...');
        const manifest = await buildLegacyManifest({
            db: prisma,
            storage: storageAdapter,
            manifestPath: outputPath,
        });

        console.log('\nInventory Summary:');
        console.table([
            {
                Total: manifest.summary.total,
                'Keep Branding': manifest.summary.keepBranding,
                'Keep External': manifest.summary.keepExternal,
                'Null & Delete': manifest.summary.nullAndDelete,
                Unresolved: manifest.summary.unresolved,
            },
        ]);

        if (manifest.summary.unresolved > 0) {
            console.warn(
                `\n[WARNING] Found ${manifest.summary.unresolved} unresolved items. Review manifest before proceeding!`
            );
        }

        console.log(`\n[SUCCESS] Manifest saved to: ${outputPath}`);
        console.log('To review planned cleanup actions:');
        console.log(`  node backend/scripts/storage/cleanupLegacyAssets.js --dry-run --manifest "${outputPath}"\n`);
    } catch (err) {
        console.error(`\n[FATAL] Inventory failed: ${err.message}`);
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
