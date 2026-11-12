/**
 * AI Provider Service (Facade Router)
 * Orchestrates calls between Gemini 2.0 Flash API and Local Fallback Provider.
 * Enforces Zero Crash Guarantee: gracefully falls back to local heuristic intelligence
 * when offline, unkeyed, or upon any network/timeout/quota failure.
 */

const geminiProvider = require('./geminiProvider');
const localFallbackProvider = require('./localFallbackProvider');

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Check whether Gemini API is configured with an active key.
 * @returns {boolean}
 */
function isGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Get the current operating provider mode.
 * @returns {'gemini-2.0-flash' | 'local_fallback'}
 */
function getProviderMode() {
  return isGeminiConfigured() ? 'gemini-2.0-flash' : 'local_fallback';
}

/**
 * Helper to execute with Gemini and automatically fall back on failure.
 * @param {string} methodName
 * @param {Array<any>} args
 * @param {object} options
 * @returns {Promise<object>}
 */
async function executeWithFallback(methodName, args, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (isGeminiConfigured()) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timeoutId;

      const callOptions = {
        ...options,
        timeoutMs,
        signal: controller ? controller.signal : options.signal,
      };

      if (controller) {
        timeoutId = setTimeout(() => {
          controller.abort(new Error(`AI Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      try {
        const result = await geminiProvider[methodName](...args, callOptions);
        return result;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    } catch (err) {
      console.warn(
        `[AIProviderService] Gemini ${methodName} failed (${err.message}). Engaging Zero-Crash Local Fallback.`
      );
    }
  }

  // Fallback to local heuristic provider
  return localFallbackProvider[methodName](...args);
}

/**
 * Analyze BM01 outline (5-dimensional logic check)
 * @param {object} outlineContent
 * @param {object} options
 * @returns {Promise<object>}
 */
async function analyzeBM01Outline(outlineContent, options = {}) {
  return executeWithFallback('analyzeBM01Outline', [outlineContent], options);
}

/**
 * Check semantic topic similarity against historical database
 * @param {object|string} newTopic
 * @param {Array<object>} existingTopics
 * @param {object} options
 * @returns {Promise<object>}
 */
async function checkTopicSimilarity(newTopic, existingTopics = [], options = {}) {
  return executeWithFallback('checkTopicSimilarity', [newTopic, existingTopics], options);
}

/**
 * Cross-check archival dossier metadata against legal official records
 * @param {object} registrationData
 * @param {Array<object>} dossierFiles
 * @param {object} options
 * @returns {Promise<object>}
 */
async function crossCheckArchivalDossier(registrationData, dossierFiles = [], options = {}) {
  return executeWithFallback('crossCheckArchivalDossier', [registrationData, dossierFiles], options);
}

module.exports = {
  isGeminiConfigured,
  getProviderMode,
  analyzeBM01Outline,
  checkTopicSimilarity,
  crossCheckArchivalDossier,
};
