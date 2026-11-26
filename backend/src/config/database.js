const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool, Client } = require('pg');

const DEFAULT_DB_POOL_MAX = 8;
const DEFAULT_DB_POOL_IDLE_TIMEOUT = 10000;
const DEFAULT_DB_POOL_CONNECTION_TIMEOUT = 15000;
const DEFAULT_DB_STATEMENT_TIMEOUT = 30000;
const DEFAULT_DB_QUERY_TIMEOUT = 35000;

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
const dbPoolIdleTimeout = readPositiveInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, DEFAULT_DB_POOL_IDLE_TIMEOUT);
const dbPoolConnectionTimeout = readPositiveInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS, DEFAULT_DB_POOL_CONNECTION_TIMEOUT);
const dbStatementTimeout = readPositiveInt(process.env.DB_STATEMENT_TIMEOUT_MS, DEFAULT_DB_STATEMENT_TIMEOUT);
const dbQueryTimeout = readPositiveInt(process.env.DB_QUERY_TIMEOUT_MS, DEFAULT_DB_QUERY_TIMEOUT);
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

function isTransientDisconnect(err) {
    if (!err) return false;
    const msg = String(err.message || err);
    const code = String(err.code || '');
    return (
        msg.includes('Connection terminated') ||
        msg.includes('connection terminated') ||
        msg.includes('terminating connection') ||
        msg.includes('timeout') ||
        code === 'ECONNRESET' ||
        code === 'EPIPE' ||
        code === 'ETIMEDOUT' ||
        code === '57P01' ||
        code === '57P02' ||
        code === '57P03'
    );
}

/**
 * ResilientPgClient:
 * 1. Ensures that unhandled socket errors emitted on a client (e.g. idle timeout termination)
 *    do not crash the Node process as an uncaught exception.
 * 2. Serializes query execution per client connection so that client.query() is never invoked
 *    while a previous query is still active. This completely eliminates node-postgres:
 *    "DeprecationWarning: Calling client.query() when the client is already executing a query"
 *    and prevents fatal runtime exceptions in upcoming pg@9.0.
 */
class ResilientPgClient extends Client {
    constructor(...args) {
        super(...args);
        this._queryTailPromise = Promise.resolve();
        this.on('error', (err) => {
            if (isTransientDisconnect(err)) {
                // Benign: cloud pooler or server terminated an idle connection; pg-pool handles recycling
                return;
            }
            console.warn('Postgres client background warning:', err?.message || err);
        });
    }

    query(...args) {
        const hasCallback = typeof args[args.length - 1] === 'function';
        if (hasCallback) {
            const cb = args[args.length - 1];
            const queryArgs = args.slice(0, -1);
            const executeCallbackQuery = () => new Promise((resolve) => {
                super.query(...queryArgs, (err, res) => {
                    try {
                        cb(err, res);
                    } finally {
                        resolve();
                    }
                });
            });
            this._queryTailPromise = this._queryTailPromise.then(executeCallbackQuery, executeCallbackQuery);
            return;
        }

        const executePromiseQuery = () => {
            try {
                return super.query(...args);
            } catch (err) {
                return Promise.reject(err);
            }
        };

        const next = this._queryTailPromise.then(executePromiseQuery, executePromiseQuery);
        this._queryTailPromise = next.catch(() => {});
        return next;
    }
}

// Keep pool small by default for Supabase Session/Transaction Pooler to avoid "max clients reached".
const pool = new Pool({
    Client: ResilientPgClient,
    connectionString,
    max: dbPoolMax,
    idleTimeoutMillis: dbPoolIdleTimeout,
    connectionTimeoutMillis: dbPoolConnectionTimeout,
    statement_timeout: dbStatementTimeout,
    query_timeout: dbQueryTimeout,
    ssl: dbUseSsl
        ? { rejectUnauthorized: dbSslRejectUnauthorized }
        : false,
    keepAlive: true,
    keepAliveInitialDelayMillis: 3000,
});

pool.on('error', (err) => {
    if (isTransientDisconnect(err)) {
        return;
    }
    console.error('Postgres pool background client error:', err.message);
});

const adapter = new PrismaPg(pool, {
    onPoolError: (err) => {
        if (isTransientDisconnect(err)) {
            return;
        }
        console.warn('Prisma adapter background pool error:', err?.message || err);
    },
});

const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
module.exports.DEFAULT_DB_POOL_MAX = DEFAULT_DB_POOL_MAX;
module.exports.DEFAULT_DB_POOL_CONNECTION_TIMEOUT = DEFAULT_DB_POOL_CONNECTION_TIMEOUT;
module.exports.readPositiveInt = readPositiveInt;
module.exports.isTransientDisconnect = isTransientDisconnect;
module.exports.ResilientPgClient = ResilientPgClient;
module.exports.prisma = prisma;
