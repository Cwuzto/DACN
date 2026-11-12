/**
 * In-Memory Cache for Academic AI Suite
 * Uses SHA-256 hash of payloads to key cached AI evaluation and similarity results.
 * Default TTL: 5 minutes.
 */

const crypto = require('crypto');

class AICache {
  /**
   * @param {number} defaultTtlMs Default TTL in milliseconds (default: 5 minutes)
   */
  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Generate SHA-256 hash key for given prefix and payload
   * @param {string} prefix
   * @param {any} payload
   * @returns {string}
   */
  generateKey(prefix, payload) {
    const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const hash = crypto.createHash('sha256').update(rawString).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Retrieve cached data if not expired
   * @param {string} prefix
   * @param {any} payload
   * @returns {any | null}
   */
  get(prefix, payload) {
    const key = this.generateKey(prefix, payload);
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache with an expiration time
   * @param {string} prefix
   * @param {any} payload
   * @param {any} data
   * @param {number} [ttlMs] Custom TTL in milliseconds
   */
  set(prefix, payload, data, ttlMs) {
    const key = this.generateKey(prefix, payload);
    const ttl = typeof ttlMs === 'number' && ttlMs > 0 ? ttlMs : this.defaultTtlMs;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Clear all cached items (useful for testing or cache resets)
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get current number of items in cache
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

const aiCache = new AICache();
aiCache.AICache = AICache;

module.exports = aiCache;
