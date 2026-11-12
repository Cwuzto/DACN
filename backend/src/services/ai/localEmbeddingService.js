/**
 * Local Embedding Service
 * Pure JavaScript semantic similarity and n-gram heuristic matching.
 * Zero external heavy dependencies (no @xenova/transformers or WASM requirements).
 * Enforces Zero-Crash Guarantee with high-performance word Jaccard and character 3-gram Cosine Similarity.
 */

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
  return Math.max(-1.0, Math.min(1.0, cos));
}

/**
 * Extract feature vector embedding for a given text.
 * Allows passing an optional external pipeline or returns null for fallback computation.
 * @param {string} text
 * @param {object} options
 * @returns {Promise<Float32Array|null>}
 */
async function getEmbedding(text, options = {}) {
  if (!text || typeof text !== 'string') return null;
  const cleanText = text.trim();
  if (!cleanText) return null;

  if (options.pipeline && typeof options.pipeline === 'function') {
    try {
      const output = await options.pipeline(cleanText, { pooling: 'mean', normalize: true });
      if (output && output.data) {
        return output.data;
      }
    } catch {
      // Pipeline error handled gracefully
    }
  }

  return null;
}

/**
 * Simple tokenization for word-level analysis.
 * @param {string} str
 * @returns {Array<string>}
 */
function tokenizeText(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Extract character 3-grams for fine-grained morphological similarity.
 * @param {string} str
 * @param {number} n
 * @returns {Set<string>}
 */
function extractCharNGrams(str = '', n = 3) {
  const clean = String(str).toLowerCase().replace(/\s+/g, ' ').trim();
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
 * Extract term frequency map of character n-grams.
 * @param {string} str
 * @param {number} n
 * @returns {Map<string, number>}
 */
function extractCharNGramFreq(str = '', n = 3) {
  const clean = String(str).toLowerCase().replace(/\s+/g, ' ').trim();
  const freq = new Map();
  if (clean.length < n) {
    if (clean.length > 0) freq.set(clean, 1);
    return freq;
  }
  for (let i = 0; i <= clean.length - n; i++) {
    const gram = clean.slice(i, i + n);
    freq.set(gram, (freq.get(gram) || 0) + 1);
  }
  return freq;
}

/**
 * Compute Cosine Similarity between character n-gram frequency distributions.
 * @param {string} textA
 * @param {string} textB
 * @param {number} n
 * @returns {number} Float in [0.0, 1.0]
 */
function computeCharNGramCosine(textA, textB, n = 3) {
  const freqA = extractCharNGramFreq(textA, n);
  const freqB = extractCharNGramFreq(textB, n);
  if (freqA.size === 0 || freqB.size === 0) return 0.0;

  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (const count of freqA.values()) {
    normASq += count * count;
  }
  for (const count of freqB.values()) {
    normBSq += count * count;
  }
  for (const [gram, countA] of freqA.entries()) {
    const countB = freqB.get(gram);
    if (countB) {
      dotProduct += countA * countB;
    }
  }

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (denominator === 0) return 0.0;
  return Math.max(0.0, Math.min(1.0, dotProduct / denominator));
}

/**
 * Fallback similarity using token Jaccard and character 3-gram Cosine Similarity.
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

  // 2. Character 3-gram Cosine Similarity
  const charCosine = computeCharNGramCosine(textA, textB, 3);

  // Weighted blend: 50% Word Jaccard + 50% Character 3-gram Cosine
  const combined = wordJaccard * 0.5 + charCosine * 0.5;
  return Math.round(Math.max(0.0, Math.min(1.0, combined)) * 1000) / 1000;
}

/**
 * Compute semantic similarity between two text strings.
 * Returns float in range [0.0, 1.0].
 * Uses dense vector embeddings if pipeline option provided; otherwise computes pure JS similarity.
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

  if (options.pipeline) {
    try {
      const [vecA, vecB] = await Promise.all([
        getEmbedding(cleanA, options),
        getEmbedding(cleanB, options),
      ]);

      if (vecA && vecB) {
        const cos = computeCosineSimilarity(vecA, vecB);
        const clamped = Math.max(0.0, Math.min(1.0, cos));
        return Math.round(clamped * 1000) / 1000;
      }
    } catch {
      // Continue to fallback
    }
  }

  return computeFallbackSimilarity(cleanA, cleanB);
}

module.exports = {
  euclideanNorm,
  computeCosineSimilarity,
  getEmbedding,
  tokenizeText,
  extractCharNGrams,
  extractCharNGramFreq,
  computeCharNGramCosine,
  computeFallbackSimilarity,
  computeSimilarity,
};
