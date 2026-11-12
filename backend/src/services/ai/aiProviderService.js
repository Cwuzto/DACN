/**
 * AI Provider Service (Facade Router)
 * Orchestrates calls between Gemini 2.0 Flash API and Local Fallback Provider.
 * Enforces Zero Crash Guarantee: gracefully falls back to local heuristic intelligence
 * and local MiniLM embeddings when offline, unkeyed, or upon any network/timeout/quota failure.
 */

const geminiProvider = require('./geminiProvider');
const localFallbackProvider = require('./localFallbackProvider');
const localEmbeddingService = require('./localEmbeddingService');

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
 * @returns {string}
 */
function getProviderMode() {
  return isGeminiConfigured() ? (process.env.GEMINI_MODEL || geminiProvider.DEFAULT_MODEL || 'gemini-3.8-flash') : 'local_fallback';
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
 * Calculate topic similarity using local embeddings and heuristics
 * @param {object|string} newTopic
 * @param {Array<object>} existingTopics
 * @param {object} options
 * @returns {Promise<object>}
 */
async function calculateTopicSimilarityWithEmbeddings(newTopic, existingTopics = [], options = {}) {
  const newTitle = typeof newTopic === 'string' ? newTopic : newTopic?.title || '';

  // Get base heuristic result from localFallbackProvider first
  const fallbackResult = localFallbackProvider.checkTopicSimilarity(newTopic, existingTopics);

  try {
    const scoredTopics = [];
    let maxEmbPercentage = fallbackResult.maxSimilarityPercentage || 0;

    for (const ex of existingTopics) {
      const exTitle = ex.title || '';
      if (!newTitle || !exTitle) continue;

      const vectorSim = await localEmbeddingService.computeSimilarity(newTitle, exTitle, options);
      const vectorPercentage = Math.round(vectorSim * 100);

      const existingMatch = (fallbackResult.matchedTopics || []).find((m) => m.topicId === ex.id);
      const blendedPercentage = existingMatch
        ? Math.max(existingMatch.similarityPercentage, vectorPercentage)
        : vectorPercentage;

      if (blendedPercentage > maxEmbPercentage) {
        maxEmbPercentage = blendedPercentage;
      }

      if (blendedPercentage >= 25) {
        scoredTopics.push({
          topicId: ex.id || null,
          title: exTitle,
          mentorName: ex.mentorName || 'N/A',
          semester: ex.semester || 'Lịch sử',
          similarityPercentage: blendedPercentage,
          similarities:
            existingMatch?.similarities ||
            `Tương đồng ngữ nghĩa vector (${blendedPercentage}%) với đề tài trước đây.`,
          differences:
            existingMatch?.differences || 'Đề tài mới có cách tiếp cận và công nghệ riêng biệt.',
        });
      }
    }

    if (scoredTopics.length > 0) {
      scoredTopics.sort((a, b) => b.similarityPercentage - a.similarityPercentage);
    }

    let riskLevel = 'NOVEL';
    let verdict = 'Đề tài có tính mới cao, không phát hiện sự trùng lặp đáng kể với kho đề tài lịch sử.';
    if (maxEmbPercentage >= 70) {
      riskLevel = 'HIGH_DUPLICATE_RISK';
      verdict = `Đề tài có mức độ trùng lặp cao (${maxEmbPercentage}%) với đề tài đã thực hiện. Cần điều chỉnh phạm vi hoặc cách tiếp cận để tạo tính mới.`;
    } else if (maxEmbPercentage >= 40) {
      riskLevel = 'MODERATE_SIMILARITY';
      verdict = `Đề tài có sự tương đồng đáng kể (${maxEmbPercentage}%) với đề tài trước đây. Cần làm rõ điểm cải tiến hoặc công nghệ khác biệt.`;
    }

    return {
      maxSimilarityPercentage: maxEmbPercentage,
      riskLevel,
      verdict,
      matchedTopics: scoredTopics.length > 0 ? scoredTopics : fallbackResult.matchedTopics || [],
      refinedTitleSuggestions: fallbackResult.refinedTitleSuggestions || [],
      provider: 'local_embedding',
    };
  } catch (err) {
    console.warn(
      '[AIProviderService] Local embedding topic similarity error, falling back to rule-based:',
      err.message
    );
    return fallbackResult;
  }
}

/**
 * Check semantic topic similarity against historical database.
 * Prioritizes local dense vector embeddings via localEmbeddingService or Gemini.
 * @param {object|string} newTopic
 * @param {Array<object>} existingTopics
 * @param {object} options
 * @returns {Promise<object>}
 */
async function checkTopicSimilarity(newTopic, existingTopics = [], options = {}) {
  if (isGeminiConfigured() && !options.preferLocalEmbedding) {
    try {
      const result = await executeWithFallback('checkTopicSimilarity', [newTopic, existingTopics], options);
      return result;
    } catch (err) {
      console.warn('[AIProviderService] Gemini checkTopicSimilarity failed, using local embeddings.');
    }
  }

  return calculateTopicSimilarityWithEmbeddings(newTopic, existingTopics, options);
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

/**
 * Generate academic feedback for BM01, BM03, BM04, or DEFENSE
 * @param {object} payload
 * @param {object} options
 * @returns {Promise<object>}
 */
async function generateFeedback(payload, options = {}) {
  return executeWithFallback('generateAcademicFeedback', [payload], options);
}

/**
 * Generate 3-tiered defense questions for council examiners
 * @param {object} payload
 * @param {object} options
 * @returns {Promise<object>}
 */
async function generateDefenseQuestions(payload, options = {}) {
  return executeWithFallback('generateDefenseQuestions', [payload], options);
}

/**
 * Academic regulation chatbot Q&A assistant
 * @param {object} payload
 * @param {object} options
 * @returns {Promise<object>}
 */
async function answerRegulationChat(payload, options = {}) {
  return executeWithFallback('answerRegulationChat', [payload], options);
}

/**
 * Compute semantic similarity between two texts using pure JS token/n-gram heuristics.
 * @param {string} textA
 * @param {string} textB
 * @param {object} options
 * @returns {Promise<number>}
 */
async function computeTopicSimilarity(textA, textB, options = {}) {
  return localEmbeddingService.computeSimilarity(textA, textB, options);
}

/**
 * Multi-turn chat with Gemini 3.8 Flash
 * @param {object} options
 * @returns {Promise<object>}
 */
async function chatWithGemini(options = {}) {
  return geminiProvider.chatWithGemini(options);
}

module.exports = {
  isGeminiConfigured,
  getProviderMode,
  analyzeBM01Outline,
  checkTopicSimilarity,
  computeTopicSimilarity,
  crossCheckArchivalDossier,
  generateFeedback,
  generateDefenseQuestions,
  answerRegulationChat,
  chatWithGemini,
};
