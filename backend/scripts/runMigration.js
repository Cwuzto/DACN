require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/database');

async function run() {
    const sqlPath = path.join(__dirname, '../prisma/migrations/20260919040000_add_project_archive/migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Reading migration SQL...');
    
    // Split SQL by statements or run as a block
    console.log('Executing migration...');
    await prisma.$executeRawUnsafe(sql);
    console.log('Migration SQL executed successfully!');

    // Check if _prisma_migrations exists
    try {
        const migrationName = '20260919040000_add_project_archive';
        await prisma.$executeRawUnsafe(`
            INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
            VALUES (gen_random_uuid(), 'manual', now(), '${migrationName}', NULL, NULL, now(), 1)
            ON CONFLICT ("migration_name") DO NOTHING;
        `);
        console.log('Recorded in _prisma_migrations.');
    } catch (e) {
        console.log('Notice on _prisma_migrations record:', e.message);
    }

    console.log('Checking project_archives table:');
    const testCount = await prisma.$queryRawUnsafe('SELECT count(*) FROM project_archives');
    console.log('project_archives row count:', testCount);

    await prisma.$disconnect();
}

run().catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
});
