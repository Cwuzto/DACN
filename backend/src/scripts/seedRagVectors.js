/**
 * RAG Knowledge Base Vector Seeder (seedRagVectors.js)
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án Tốt nghiệp
 *
 * Chunks all academic knowledge documents, computes dense embedding vectors
 * via local Ollama (or deterministic fallback if Ollama daemon is offline),
 * and persists the index to knowledgeVectorIndex.json for sub-10ms retrieval.
 *
 * UTF-8 (no BOM)
 */

const path = require('path');
const ragService = require('../services/ai/ragService');
const ollamaProvider = require('../services/ai/ollamaProvider');

const DEFAULT_TARGET_PATH = path.resolve(__dirname, '../services/ai/knowledge/knowledgeVectorIndex.json');
const TARGET_DIMENSIONS = 768;

/**
 * Generate a deterministic normalized 768-dimensional fallback embedding vector
 * when the local Ollama daemon is unreachable.
 *
 * @param {string} text
 * @param {number} [dimensions=768]
 * @returns {Array<number>}
 */
function generateDeterministicFallbackVector(text, dimensions = TARGET_DIMENSIONS) {
  const vec = new Float64Array(dimensions);
  const clean = String(text || '').toLowerCase();

  // Character 3-gram hashing for subword representation
  for (let i = 0; i < clean.length - 2; i++) {
    const code = clean.charCodeAt(i) * 961 + clean.charCodeAt(i + 1) * 31 + clean.charCodeAt(i + 2);
    const index = Math.abs(code) % dimensions;
    const sign = (code % 2 === 0) ? 1.0 : -1.0;
    vec[index] += sign;
  }

  // Token hashing for lexical semantics
  const words = clean.split(/\s+/);
  for (const word of words) {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += 2.0;
  }

  // L2 unit normalization
  let normSq = 0;
  for (let i = 0; i < dimensions; i++) {
    normSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(normSq);
  const result = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    result[i] = norm > 0 ? parseFloat((vec[i] / norm).toFixed(6)) : 0;
  }
  return result;
}

/**
 * Seed all academic knowledge chunks into a precomputed vector index.
 *
 * @param {object} [options]
 * @param {string} [options.outputPath]
 * @param {boolean} [options.silent=false]
 * @returns {Promise<{ count: number, dimensions: number, provider: string, outputPath: string }>}
 */
async function seedRagVectors(options = {}) {
  const outputPath = options.outputPath || DEFAULT_TARGET_PATH;
  const silent = Boolean(options.silent);

  const chunks = ragService.chunkKnowledgeBase();
  const isOllamaUp = await ollamaProvider.isOllamaAvailable();

  const providerName = isOllamaUp ? 'ollama' : 'deterministic-fallback';

  if (!silent) {
    console.log(`[SEED-RAG] Starting vector indexing for ${chunks.length} academic chunks...`);
    console.log(`[SEED-RAG] Target output: ${outputPath}`);
    console.log(`[SEED-RAG] Embedding provider: ${providerName.toUpperCase()} (Ollama status: ${isOllamaUp ? 'ONLINE' : 'OFFLINE'})`);
  }

  const embeddedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let embedding = null;

    if (isOllamaUp) {
      try {
        embedding = await ollamaProvider.generateEmbedding({ text: chunk.text });
      } catch (err) {
        if (!silent) {
          console.warn(`[SEED-RAG] Ollama embed error for chunk ${chunk.id}: ${err.message}. Using fallback vector.`);
        }
        embedding = generateDeterministicFallbackVector(chunk.text, TARGET_DIMENSIONS);
      }
    } else {
      embedding = generateDeterministicFallbackVector(chunk.text, TARGET_DIMENSIONS);
    }

    embeddedChunks.push({
      ...chunk,
      embedding,
    });
  }

  ragService.savePrecomputedIndex(embeddedChunks, outputPath);

  const sampleDim = embeddedChunks[0]?.embedding?.length || 0;

  if (!silent) {
    console.log(`[SEED-RAG] Successfully indexed ${embeddedChunks.length} chunks with ${sampleDim}-dimensional vectors.`);
    console.log(`[SEED-RAG] Saved to: ${outputPath}`);
  }

  return {
    count: embeddedChunks.length,
    dimensions: sampleDim,
    provider: providerName,
    outputPath,
  };
}

if (require.main === module) {
  seedRagVectors()
    .then(() => {
      console.log('[SEED-RAG] Seeding completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SEED-RAG] Fatal error during vector seeding:', err);
      process.exit(1);
    });
}

module.exports = {
  seedRagVectors,
  generateDeterministicFallbackVector,
};
