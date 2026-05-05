const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const DEFAULT_DB_POOL_MAX = 2;

function readPositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
    return fallback;
}

const dbPoolMax = readPositiveInt(process.env.DB_POOL_MAX, DEFAULT_DB_POOL_MAX);
const dbPoolIdleTimeout = readPositiveInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 30000);
const dbPoolConnectionTimeout = readPositiveInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS, 10000);
const dbUseSsl = readBoolean(process.env.DB_USE_SSL, true);
const dbSslRejectUnauthorized = readBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false);
const rawConnectionString = process.env.DATABASE_URL || '';

function sanitizeConnectionString(connectionString) {
    try {
        const url = new URL(connectionString);
        // Prevent URL sslmode from overriding pg ssl object options.
        url.searchParams.delete('sslmode');
        return url.toString();
    } catch {
        return connectionString;
    }
}

const connectionString = sanitizeConnectionString(rawConnectionString);

// Keep pool small by default for Supabase Session Pooler to avoid "max clients reached".
const adapter = new PrismaPg({
    connectionString,
    max: dbPoolMax,
    idleTimeoutMillis: dbPoolIdleTimeout,
    connectionTimeoutMillis: dbPoolConnectionTimeout,
    ssl: dbUseSsl
        ? { rejectUnauthorized: dbSslRejectUnauthorized }
        : false,
});

const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
