/**
 * Ollama AI Provider
 * Communicates with local Ollama daemon REST API (/api/chat, /api/embed, /api/version)
 * using native fetch with zero external npm dependencies.
 */

const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'qwen3:4b';
const DEFAULT_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma-2:270m';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 30000;

/**
 * Execute a fetch call with AbortController timeout handling.
 * @param {string} url
 * @param {object} options
 * @param {number} timeoutMs
 * @param {Function} fetchFn
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetchFn(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check if local Ollama service is reachable and responding.
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 * @param {number} [options.timeoutMs]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<boolean>}
 */
async function isOllamaAvailable(options = {}) {
  const baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 5000;
  const fetchFn = options.fetchFn || fetch;

  try {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${normalizedBaseUrl}/api/version`;
    const res = await fetchWithTimeout(url, { method: 'GET' }, timeoutMs, fetchFn);
    return Boolean(res && res.ok);
  } catch (_err) {
    return false;
  }
}

/**
 * Chat with Ollama using /api/chat.
 * @param {object} options
 * @param {Array<object>} options.messages
 * @param {string} [options.systemInstruction]
 * @param {string} [options.model]
 * @param {number} [options.temperature]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.baseUrl]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<{ reply: string, provider: string, model: string }>}
 */
async function chatWithOllama(options = {}) {
  const {
    messages = [],
    systemInstruction = '',
    model = process.env.OLLAMA_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    temperature = 0.7,
    timeoutMs = options.timeoutMs !== undefined
      ? options.timeoutMs
      : (parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS),
    baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL,
    fetchFn = options.fetchFn || fetch,
  } = options;

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const url = `${normalizedBaseUrl}/api/chat`;

  const formattedMessages = [];

  if (systemInstruction && typeof systemInstruction === 'string' && systemInstruction.trim()) {
    formattedMessages.push({
      role: 'system',
      content: systemInstruction.trim(),
    });
  }

  for (const msg of messages) {
    if (!msg) continue;
    let role = msg.role || 'user';
    if (role === 'model') {
      role = 'assistant';
    }
    const content = msg.content !== undefined ? msg.content : (msg.text || '');
    formattedMessages.push({
      role,
      content,
    });
  }

  const payload = {
    model,
    messages: formattedMessages,
    stream: false,
    options: {
      temperature,
      ...(options.numCtx ? { num_ctx: options.numCtx } : {}),
      ...(options.numPredict ? { num_predict: options.numPredict } : {}),
      ...(options.options || {}),
    },
  };

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    timeoutMs,
    fetchFn
  );

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`Failed to parse Ollama chat JSON response: ${err.message}`);
  }

  if (!res.ok) {
    const errorMsg = data?.error || `Ollama chat request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

/**
 * Strip reasoning chain (<think>...</think>) from Qwen / reasoning models
 * @param {string} text
 * @returns {string}
 */
function stripThinking(text = '') {
  if (typeof text !== 'string') return '';
  if (text.includes('</think>')) {
    const parts = text.split('</think>');
    const candidate = parts[parts.length - 1].trim();
    if (candidate.length > 0) return candidate;
  }
  return text.trim();
}

  const rawReply = data?.message?.content !== undefined && data?.message?.content !== null
    ? data.message.content
    : (data?.response || '');
  if (rawReply === undefined || rawReply === null) {
    throw new Error('Ollama response did not contain message content');
  }
  const reply = stripThinking(rawReply) || rawReply;

  return {
    reply,
    provider: 'ollama',
    model: data.model || model,
  };
}

/**
 * Generate embedding vector using /api/embed (with fallback to legacy /api/embeddings).
 * @param {object} options
 * @param {string} options.text
 * @param {string} [options.model]
 * @param {number} [options.timeoutMs]
 * @param {string} [options.baseUrl]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<Array<number>>}
 */
async function generateEmbedding(options = {}) {
  const {
    text,
    model = process.env.OLLAMA_EMBED_MODEL || DEFAULT_EMBED_MODEL,
    timeoutMs = options.timeoutMs !== undefined
      ? options.timeoutMs
      : (parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS),
    baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL,
    fetchFn = options.fetchFn || fetch,
  } = options;

  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Embedding input text is required and cannot be empty');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const embedUrl = `${normalizedBaseUrl}/api/embed`;

  const res = await fetchWithTimeout(
    embedUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
    },
    timeoutMs,
    fetchFn
  );

  // If /api/embed is not supported (404), fallback to legacy /api/embeddings
  if (res.status === 404) {
    const legacyUrl = `${normalizedBaseUrl}/api/embeddings`;
    const legacyRes = await fetchWithTimeout(
      legacyUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: text,
        }),
      },
      timeoutMs,
      fetchFn
    );

    let legacyData;
    try {
      legacyData = await legacyRes.json();
    } catch (err) {
      throw new Error(`Failed to parse Ollama legacy embeddings JSON response: ${err.message}`);
    }

    if (!legacyRes.ok) {
      const errorMsg = legacyData?.error || `Ollama embeddings request failed with status ${legacyRes.status}`;
      throw new Error(errorMsg);
    }

    if (Array.isArray(legacyData?.embedding)) {
      return legacyData.embedding;
    }
    throw new Error('Ollama legacy embeddings response did not contain embedding vector array');
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`Failed to parse Ollama embed JSON response: ${err.message}`);
  }

  if (!res.ok) {
    const errorMsg = data?.error || `Ollama embed request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  if (Array.isArray(data?.embeddings) && Array.isArray(data.embeddings[0])) {
    return data.embeddings[0];
  }

  throw new Error('Ollama embed response did not contain valid embeddings array');
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_EMBED_MODEL,
  DEFAULT_TIMEOUT_MS,
  fetchWithTimeout,
  isOllamaAvailable,
  chatWithOllama,
  generateEmbedding,
};
