const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const migrations = [
    '20261117090000_add_stored_asset_registry',
    '20261117100000_link_submission_assets',
    '20261117110000_link_generated_academic_assets',
    '20261117120000_link_archive_assets',
    '20261117130000_link_public_and_personal_assets',
];

async function applyMigrations() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DIRECT_URL or DATABASE_URL environment variable is required.');
    }
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('Connected to PostgreSQL...');

    try {
        // Fix incomplete migration if present
        await client.query(`
            UPDATE _prisma_migrations 
            SET finished_at = NOW(), applied_steps_count = 1 
            WHERE migration_name = '20260501113000_add_defense_scoresheet_schema' AND finished_at IS NULL;
        `);

        for (const mig of migrations) {
            const sqlPath = path.resolve(__dirname, `../../prisma/migrations/${mig}/migration.sql`);
            if (!fs.existsSync(sqlPath)) {
                console.error(`Migration file not found: ${sqlPath}`);
                continue;
            }

            const sql = fs.readFileSync(sqlPath, 'utf8');
            const checksum = crypto.createHash('sha256').update(sql).digest('hex');

            // Check if already applied
            const checkRes = await client.query('SELECT id, finished_at FROM _prisma_migrations WHERE migration_name = $1', [mig]);
            if (checkRes.rows.length > 0 && checkRes.rows[0].finished_at) {
                console.log(`Migration already applied: ${mig}`);
                continue;
            }

            console.log(`Applying migration: ${mig}...`);
            const migrationId = crypto.randomUUID();
            const startedAt = new Date();

            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query(`
                    INSERT INTO _prisma_migrations (
                        id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
                    ) VALUES ($1, $2, NOW(), $3, NULL, NULL, $4, 1)
                    ON CONFLICT (id) DO UPDATE SET finished_at = NOW();
                `, [migrationId, checksum, mig, startedAt]);
                await client.query('COMMIT');
                console.log(`Successfully applied: ${mig}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`Failed to apply migration ${mig}:`, err.message);
                throw err;
            }
        }
        console.log('All migrations applied successfully!');
    } finally {
        await client.end();
    }
}

applyMigrations().catch((err) => {
    console.error('Migration runner error:', err);
    process.exit(1);
});

