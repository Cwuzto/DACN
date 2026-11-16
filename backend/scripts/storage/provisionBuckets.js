#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { assertStorageEnvironment } = require('../../src/config/storageConfig');
const { getSupabaseClient } = require('../../src/config/supabase');
const { provisionStorageBuckets } = require('../../src/services/storageProvisioningService');

const maskUrl = (rawUrl) => {
    try {
        const parsed = new URL(rawUrl);
        const hostParts = parsed.hostname.split('.');
        if (hostParts.length > 2) {
            hostParts[0] = hostParts[0].slice(0, 3) + '***';
        }
        return `${parsed.protocol}//${hostParts.join('.')}`;
    } catch {
        return 'https://***.supabase.co';
    }
};

const run = async () => {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const dryRun = !isApply;

    console.log('='.repeat(60));
    console.log('  Supabase Storage Bucket Provisioning CLI');
    console.log(`  Mode: ${dryRun ? 'DRY-RUN (planning only, no writes)' : 'APPLY (modifying storage)'}`);
    console.log('='.repeat(60));

    try {
        assertStorageEnvironment(process.env);
    } catch (err) {
        console.error(`[ERROR] Environment validation failed: ${err.message}`);
        process.exit(1);
    }

    const maskedUrl = maskUrl(process.env.SUPABASE_URL);
    console.log(`[INFO] Connected to Supabase project: ${maskedUrl}`);
    console.log('[INFO] Service role key: [REDACTED]');

    try {
        const supabase = getSupabaseClient();
        const report = await provisionStorageBuckets({
            storage: supabase.storage,
            dryRun,
        });

        console.log('\nProvisioning Actions Summary:');
        console.table(
            report.actions.map((act) => ({
                Bucket: act.bucket,
                Action: act.action.toUpperCase(),
                Public: act.public ?? act.expectedPublic,
                Status: act.status,
                Drift: act.drift ? 'YES' : 'NO',
            }))
        );

        console.log(`Total: ${report.summary.total} | Created: ${report.summary.created} | Updated: ${report.summary.updated} | Matched: ${report.summary.matched}`);

        if (dryRun) {
            console.log('\n[NOTE] This was a dry-run. To apply these changes, re-run with:');
            console.log('       node backend/scripts/storage/provisionBuckets.js --apply\n');
        } else {
            console.log('\n[SUCCESS] Storage bucket provisioning completed successfully.\n');
        }
    } catch (err) {
        console.error(`\n[FATAL] Provisioning failed: ${err.message}`);
        if (err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    }
};

if (require.main === module) {
    run();
}

module.exports = { run };
