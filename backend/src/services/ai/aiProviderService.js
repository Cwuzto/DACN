/**
 * AI Provider Service (Facade Router)
 * Orchestrates calls between Gemini 2.0 Flash API and Local Fallback Provider.
 * Enforces Zero Crash Guarantee: gracefully falls back to local heuristic intelligence
 * and local MiniLM embeddings when offline, unkeyed, or upon any network/timeout/quota failure.
 */

const geminiProvider = require('./geminiProvider');
const localFallbackProvider = require('./localFallbackProvider');
const localEmbeddingService = require('./localEmbeddingService');
const ollamaProvider = require('./ollamaProvider');
const ragService = require('./ragService');
const { buildAcademicSystemInstruction, wrapUserMessage } = require('./academicPromptBuilder');
const liveContextService = require('./liveContextService');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 15000;

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
  return isGeminiConfigured()
    ? (process.env.GEMINI_MODEL || geminiProvider.DEFAULT_MODEL || 'gemini-3.8-flash')
    : 'local_fallback';
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
 * Normalize a single history message item to { role: 'user' | 'model', text: string }
 * Supports:
 * - { role: 'user' | 'model' | 'assistant', text | content | message }
 * - { sender: 'user' | 'bot' | 'model', text | content | message }
 * - raw string
 */
function normalizeHistoryItem(item) {
  if (!item) return { role: 'user', text: '' };
  if (typeof item === 'string') {
    return { role: 'user', text: item };
  }
  let role = 'user';
  if (item.role === 'model' || item.role === 'assistant' || item.role === 'bot') {
    role = 'model';
  } else if (item.sender === 'bot' || item.sender === 'model' || item.sender === 'assistant') {
    role = 'model';
  }
  const text =
    item.text !== undefined
      ? item.text
      : item.content !== undefined
      ? item.content
      : item.message !== undefined
      ? item.message
      : '';
  return { role, text: String(text || '') };
}

/**
 * Fallback quick questions according to user's knowledge tier
 */
function getSuggestedQuickQuestionsForUser(user) {
  const isSuperOrAcademic =
    user?.role === 'ADMIN' ||
    (Array.isArray(user?.permissionGroups) &&
      (user.permissionGroups.includes('GIAO_VU') || user.permissionGroups.includes('PROJECT_OVERSIGHT_MANAGE')));

  if (isSuperOrAcademic) {
    return [
      'Quy trình ban hành quyết định giao đề tài?',
      'Xử lý hồ sơ quá hạn SLA 168 giờ và gia hạn 72 giờ thế nào?',
      'Cơ chế hoạt động của 5 Sweep Jobs tự động hóa?',
      'Quy trình thẩm định phụ lục điều chỉnh tên đề tài (TitleAdjustmentAppendix)?',
    ];
  }

  if (user?.role === 'LECTURER') {
    return [
      'Tiêu chí chấm 4 nhóm chuẩn đầu ra BM04?',
      'Quy trình thẩm định đề xuất dừng đề tài BM03?',
      'Cơ cấu điểm Hội đồng bảo vệ và nguyên tắc độc lập?',
      'Gợi ý bộ câu hỏi phản biện 3 cấp độ cho đồ án?',
    ];
  }

  return [
    'Hạn nộp BM01 khi nào?',
    'Điều kiện để được ra bảo vệ đồ án?',
    'Khi nào bị dừng đề tài?',
    'Quy định đổi tên đề tài (BM02-A)?',
  ];
}

/**
 * Fallback regulations according to user's knowledge tier
 */
function getSuggestedRegulationsForUser(user) {
  const isSuperOrAcademic =
    user?.role === 'ADMIN' ||
    (Array.isArray(user?.permissionGroups) &&
      (user.permissionGroups.includes('GIAO_VU') || user.permissionGroups.includes('PROJECT_OVERSIGHT_MANAGE')));

  if (isSuperOrAcademic) {
    return [
      'Quy chuẩn ban hành Quyết định giao đề tài và Phụ lục',
      'Cơ chế 5 Sweep Jobs tự động hóa (bm02ToBm04SweepService)',
      'Quy chế giải quyết khiếu nại học vụ và SLA quá hạn (168h + 72h)',
    ];
  }

  if (user?.role === 'LECTURER') {
    return [
      'Quy chế chấm điểm bảo vệ 3 thành viên độc lập',
      'Thang điểm 4 nhóm chuẩn đầu ra BM04',
      'Quy trình thẩm định đề xuất dừng đề tài BM03 (PROPOSE_STOP)',
      'Bộ câu hỏi phản biện 3 cấp độ (FOUNDATION, TECHNICAL, FUTURE)',
    ];
  }

  return [
    'BM01: Đề cương chi tiết đồ án tốt nghiệp & quy tắc nộp lại v2',
    'BM03: Phiếu đánh giá tiến độ thực hiện định kỳ (4-6 buổi)',
    'BM04: Điều kiện điểm tối thiểu (>= 5.0) để được bảo vệ',
    'Giai đoạn 6: Nộp hồ sơ lưu chiểu trong 14 ngày làm việc sau bảo vệ',
  ];
}

/**
 * Answer academic questions with role-based knowledge isolation using Ollama, Gemini, or Local Heuristic
 * @param {object} payload
 * @param {string} payload.message
 * @param {Array<object>} [payload.history]
 * @param {object} [payload.user]
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function answerAcademicChat({ message = '', history = [], user = null } = {}, options = {}) {
  const cleanMessage = String(message || '').trim();
  const safeRole = user?.role || 'STUDENT';
  const defaultGeminiModel = process.env.GEMINI_MODEL || geminiProvider.DEFAULT_MODEL || 'gemini-3.8-flash';
  const defaultOllamaModel = process.env.OLLAMA_CHAT_MODEL || 'qwen3:4b';
  const aiProviderMode = (process.env.AI_PROVIDER || 'hybrid').toLowerCase();

  let liveContextText = '';
  try {
    const liveContext = await liveContextService.getLiveContext(user);
    liveContextText = liveContext?.formattedText || '';
  } catch (err) {
    console.warn(
      `[AIProviderService] Failed to load live database context (${err.message}). Proceeding with standard static regulations.`
    );
    liveContextText = '';
  }

  const formattedHistory = (Array.isArray(history) ? history : [])
    .map(normalizeHistoryItem)
    .filter((h) => h.text.trim().length > 0);

  const wrappedUserMessage = wrapUserMessage(cleanMessage);

  const messages = [
    ...formattedHistory,
    { role: 'user', text: wrappedUserMessage },
  ];

  // Helper to build system instruction with live database context and RAG context
  const buildSystemInstructionWithRag = (ragContextText = '') => {
    let combinedContext = liveContextText;
    if (ragContextText) {
      combinedContext = liveContextText
        ? `${liveContextText}\n\n${ragContextText}`
        : ragContextText;
    }
    const { systemInstruction } = buildAcademicSystemInstruction({ user, liveContextText: combinedContext });
    return systemInstruction;
  };

  // Determine whether to invoke local Ollama engine first
  let shouldTryOllama = false;

  const isTestEnvironment = process.env.NODE_ENV === 'test';
  const isOllamaMockedInTest = Boolean(
    ollamaProvider.chatWithOllama && ollamaProvider.chatWithOllama._isMockFunction
  );

  // In test environment:
  // - If Ollama is mocked (e.g. ollamaRagWorkflow.test.js), allow Ollama testing.
  // - If Ollama is not mocked (e.g. general regression & legacy AI unit tests),
  //   do NOT invoke live unmocked Ollama daemon to avoid long timeouts and test flakiness.
  const allowOllama = !isTestEnvironment || isOllamaMockedInTest;

  if (allowOllama && !options.forceGemini) {
    if (aiProviderMode === 'ollama') {
      shouldTryOllama = true;
    } else if (aiProviderMode === 'hybrid') {
      try {
        shouldTryOllama = await ollamaProvider.isOllamaAvailable({ timeoutMs: 1000 });
      } catch (_e) {
        shouldTryOllama = false;
      }
    }
  }

  // 1. Ollama RAG Flow
  if (shouldTryOllama) {
    try {
      let ragChunks = [];
      try {
        ragChunks = await ragService.retrieveRelevantChunks({
          query: cleanMessage,
          userRole: safeRole,
          topK: 3,
        });
      } catch (ragErr) {
        console.warn(`[AIProviderService] RAG retrieval error (${ragErr.message}). Continuing without RAG chunks.`);
        ragChunks = [];
      }

      const ragContextText = ragService.formatRagContext(ragChunks);
      const systemInstruction = buildSystemInstructionWithRag(ragContextText);

      const timeoutMs =
        options.timeoutMs || parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 30000;

      const result = await ollamaProvider.chatWithOllama({
        messages,
        systemInstruction,
        model: defaultOllamaModel,
        timeoutMs,
        ...options,
      });

      const relatedRegulations =
        Array.isArray(ragChunks) && ragChunks.length > 0
          ? ragChunks.map((c) => c.title)
          : getSuggestedRegulationsForUser(user);

      return {
        reply: result.reply || '',
        role: safeRole,
        provider: 'ollama',
        model: result.model || defaultOllamaModel,
        relatedRegulations,
        suggestedQuickQuestions: getSuggestedQuickQuestionsForUser(user),
      };
    } catch (ollamaErr) {
      console.warn(
        `[AIProviderService] Ollama chat failed (${ollamaErr.message}). Engaging Dual-Engine Fallback.`
      );
    }
  }

  // 2. Gemini Flow (Primary or Fallback from Ollama)
  if (isGeminiConfigured() || options.forceGemini) {
    try {
      const { systemInstruction } = buildAcademicSystemInstruction({ user, liveContextText });
      const result = await geminiProvider.chatWithGemini({
        messages,
        systemInstruction,
        model: defaultGeminiModel,
        ...options,
      });

      return {
        reply: result.reply || result.text || '',
        role: safeRole,
        provider: result.provider || defaultGeminiModel,
        relatedRegulations:
          Array.isArray(result.relatedRegulations) && result.relatedRegulations.length > 0
            ? result.relatedRegulations
            : getSuggestedRegulationsForUser(user),
        suggestedQuickQuestions:
          Array.isArray(result.suggestedQuickQuestions) && result.suggestedQuickQuestions.length > 0
            ? result.suggestedQuickQuestions
            : getSuggestedQuickQuestionsForUser(user),
      };
    } catch (err) {
      console.warn(
        `[AIProviderService] Gemini academic chat failed (${err.message}). Engaging Zero-Crash Local Fallback.`
      );
    }
  }

  // 3. Local Heuristic Provider Fallback (Zero Crash Guarantee)
  const fallback = localFallbackProvider.answerRegulationChat({ message: cleanMessage, history });
  return {
    ...fallback,
    role: safeRole,
    provider: fallback.provider || 'local_fallback',
    relatedRegulations:
      Array.isArray(fallback.relatedRegulations) && fallback.relatedRegulations.length > 0
        ? fallback.relatedRegulations
        : getSuggestedRegulationsForUser(user),
    suggestedQuickQuestions:
      Array.isArray(fallback.suggestedQuickQuestions) && fallback.suggestedQuickQuestions.length > 0
        ? fallback.suggestedQuickQuestions
        : getSuggestedQuickQuestionsForUser(user),
  };
}

/**
 * Academic regulation chatbot Q&A assistant (facade delegating to role-based answerAcademicChat)
 * @param {object} payload
 * @param {object} options
 * @returns {Promise<object>}
 */
async function answerRegulationChat(payload = {}, options = {}) {
  return answerAcademicChat(payload, options);
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
  answerAcademicChat,
  answerRegulationChat,
  chatWithGemini,
};
