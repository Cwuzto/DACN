const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const DEFAULT_DB_POOL_MAX = 2;

function readPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const dbPoolMax = readPositiveInt(process.env.DB_POOL_MAX, DEFAULT_DB_POOL_MAX);
const dbPoolIdleTimeout = readPositiveInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 30000);
const dbPoolConnectionTimeout = readPositiveInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS, 10000);

// Keep pool small by default for Supabase Session Pooler to avoid "max clients reached".
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: dbPoolMax,
    idleTimeoutMillis: dbPoolIdleTimeout,
    connectionTimeoutMillis: dbPoolConnectionTimeout,
});

const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
