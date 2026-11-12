/**
 * Local Embedding Service
 * Extracts dense vector embeddings (384-dim) using Xenova/all-MiniLM-L6-v2 via @xenova/transformers (WASM/Node.js).
 * Provides fast local cosine similarity with zero external API calls or GPU requirements.
 * Enforces Zero-Crash Guarantee with automatic heuristic fallback (Jaccard & character n-grams).
 */

let pipelinePromise = null;
let pipelineInstance = null;
let modelLoadFailed = false;

/**
 * Compute Euclidean norm (magnitude) of a numeric vector.
 * @param {Array<number>|Float32Array} vec
 * @returns {number}
 */
function euclideanNorm(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  return Math.sqrt(sumSq);
}

/**
 * Compute Cosine Similarity between two numeric vectors.
 * Returns a value in [-1.0, 1.0] (or 0.0 if either vector has zero magnitude).
 * @param {Array<number>|Float32Array} vecA
 * @param {Array<number>|Float32Array} vecB
 * @returns {number}
 */
function computeCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || !vecA.length || !vecB.length) return 0.0;
  if (vecA.length !== vecB.length) return 0.0;

  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normASq += a * a;
    normBSq += b * b;
  }

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (denominator === 0) return 0.0;

  const cos = dotProduct / denominator;
  // Numerical clamp to [-1.0, 1.0]
  return Math.max(-1.0, Math.min(1.0, cos));
}

/**
 * Retrieve or initialize the Transformers pipeline.
 * @param {object} options
 * @returns {Promise<Function|null>}
 */
async function getPipeline(options = {}) {
  if (options.pipeline) return options.pipeline;
  if (pipelineInstance) return pipelineInstance;
  if (modelLoadFailed && !options.forceReload) return null;

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@xenova/transformers');
        // Configure transformers environment if needed
        if (env) {
          env.allowLocalModels = true;
        }
        const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          quantized: true,
        });
        pipelineInstance = pipe;
        return pipe;
      } catch (err) {
        modelLoadFailed = true;
        console.warn(
          `[LocalEmbeddingService] Model 'Xenova/all-MiniLM-L6-v2' failed to load (${err.message}). Falling back to heuristic similarity.`
        );
        return null;
      }
    })();
  }

  return pipelinePromise;
}

/**
 * Extract feature vector embedding for a given text.
 * @param {string} text
 * @param {object} options
 * @returns {Promise<Float32Array|null>}
 */
async function getEmbedding(text, options = {}) {
  if (!text || typeof text !== 'string') return null;
  const cleanText = text.trim();
  if (!cleanText) return null;

  try {
    const pipe = await getPipeline(options);
    if (!pipe) return null;

    const output = await pipe(cleanText, { pooling: 'mean', normalize: true });
    if (output && output.data) {
      return output.data;
    }
  } catch (err) {
    console.warn(`[LocalEmbeddingService] getEmbedding execution error: ${err.message}`);
  }

  return null;
}

/**
 * Simple tokenization for fallback similarity.
 * @param {string} str
 * @returns {Array<string>}
 */
function tokenizeText(str = '') {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Extract character 3-grams for fine-grained morphological similarity.
 * @param {string} str
 * @returns {Set<string>}
 */
function extractCharNGrams(str = '', n = 3) {
  const clean = str.toLowerCase().replace(/\s+/g, ' ').trim();
  const ngrams = new Set();
  if (clean.length < n) {
    if (clean.length > 0) ngrams.add(clean);
    return ngrams;
  }
  for (let i = 0; i <= clean.length - n; i++) {
    ngrams.add(clean.slice(i, i + n));
  }
  return ngrams;
}

/**
 * Fallback similarity using token Jaccard and character n-gram overlap.
 * @param {string} textA
 * @param {string} textB
 * @returns {number} Float in [0.0, 1.0]
 */
function computeFallbackSimilarity(textA, textB) {
  const tokensA = tokenizeText(textA);
  const tokensB = tokenizeText(textB);

  if (!tokensA.length || !tokensB.length) return 0.0;

  // 1. Word-level Jaccard
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersectionWords = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionWords++;
  }
  const unionWords = new Set([...tokensA, ...tokensB]).size;
  const wordJaccard = unionWords > 0 ? intersectionWords / unionWords : 0.0;

  // 2. Character 3-gram Jaccard
  const ngramsA = extractCharNGrams(textA, 3);
  const ngramsB = extractCharNGrams(textB, 3);
  let intersectionGrams = 0;
  for (const g of ngramsA) {
    if (ngramsB.has(g)) intersectionGrams++;
  }
  const unionGrams = new Set([...ngramsA, ...ngramsB]).size;
  const gramJaccard = unionGrams > 0 ? intersectionGrams / unionGrams : 0.0;

  // Weighted combination
  const combined = wordJaccard * 0.6 + gramJaccard * 0.4;
  return Math.round(Math.max(0.0, Math.min(1.0, combined)) * 1000) / 1000;
}

/**
 * Compute semantic similarity between two text strings.
 * Returns float in range [0.0, 1.0].
 * Uses dense vector embeddings if available; otherwise falls back gracefully.
 * @param {string} textA
 * @param {string} textB
 * @param {object} options
 * @returns {Promise<number>}
 */
async function computeSimilarity(textA, textB, options = {}) {
  if (!textA || !textB) return 0.0;
  const cleanA = String(textA).trim();
  const cleanB = String(textB).trim();
  if (!cleanA || !cleanB) return 0.0;

  if (cleanA.toLowerCase() === cleanB.toLowerCase()) {
    return 1.0;
  }

  try {
    const [vecA, vecB] = await Promise.all([
      getEmbedding(cleanA, options),
      getEmbedding(cleanB, options),
    ]);

    if (vecA && vecB) {
      const cos = computeCosineSimilarity(vecA, vecB);
      // Normalized embeddings mean cosine is between -1 and 1, usually > 0 for positive semantic match
      const clamped = Math.max(0.0, Math.min(1.0, cos));
      return Math.round(clamped * 1000) / 1000;
    }
  } catch (err) {
    // Model error, continue to fallback
  }

  return computeFallbackSimilarity(cleanA, cleanB);
}

module.exports = {
  computeCosineSimilarity,
  getEmbedding,
  computeSimilarity,
  computeFallbackSimilarity,
};
