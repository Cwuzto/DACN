# Local Ollama RAG Chatbot (Qwen3:4b & EmbeddingGemma-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

This plan implements a 100% on-device, offline-capable Academic Regulation Assistant using **Ollama**, **Qwen3:4b**, and **EmbeddingGemma-2:270m** with a full RAG (Retrieval-Augmented Generation) pipeline, installed and operating directly from `D:\ollama`.

---

## Proposed Changes & File Structure

```
D:\ollama\
  ├── OllamaSetup.exe           # Official Windows installer
  └── models\                   # OLLAMA_MODELS target directory for model weights

backend/
  ├── .env                      # Add AI_PROVIDER=ollama, OLLAMA_BASE_URL, OLLAMA_CHAT_MODEL, OLLAMA_EMBED_MODEL
  ├── src/
  │   ├── services/ai/
  │   │   ├── ollamaProvider.js                 # NEW: Native fetch adapter for Ollama REST API (/api/chat, /api/embed)
  │   │   ├── ragService.js                     # NEW: Document chunking, RBAC filtering, cosine similarity ranking
  │   │   ├── aiProviderService.js              # MODIFY: Route to Ollama RAG with Zero-Crash Fallback to Gemini/Local
  │   │   └── knowledge/
  │   │       └── knowledgeVectorIndex.json     # NEW: Pre-indexed vector cache for 6-stage regulations
  │   └── scripts/
  │       └── seedRagVectors.js                 # NEW: CLI script to chunk & embed knowledge base with EmbeddingGemma-2
  └── tests/
      ├── unit/
      │   ├── ollamaProvider.test.js            # NEW: Unit tests for Ollama REST communication
      │   └── ragService.test.js                # NEW: Unit tests for chunking, RBAC isolation & vector retrieval
      └── integration/
          └── ollamaRagWorkflow.test.js         # NEW: End-to-end integration test for Ollama RAG answering & fallback
```

---

## Tasks

### Task 1: Environment & Ollama Installation on `D:\ollama`

**Files:**
- Directory: `D:\ollama`
- File: `backend/.env`

- [ ] **Step 1: Install Ollama into `D:\ollama`**
  - Run `D:\ollama\OllamaSetup.exe /DIR="D:\ollama" /SILENT` once download finishes.
  - Set User environment variable: `OLLAMA_MODELS = D:\ollama\models`.
  - Add `D:\ollama` to User `PATH`.
  - Verify installation: `ollama --version`.

- [ ] **Step 2: Pull models to `D:\ollama\models`**
  - Command: `ollama pull qwen3:4b`
  - Command: `ollama pull embeddinggemma-2:270m`
  - Verify models are stored on D: drive: `ollama list`.

- [ ] **Step 3: Update `backend/.env` with Ollama configuration**
  - Add:
    ```env
    AI_PROVIDER=ollama
    OLLAMA_BASE_URL=http://localhost:11434
    OLLAMA_CHAT_MODEL=qwen3:4b
    OLLAMA_EMBED_MODEL=embeddinggemma-2:270m
    OLLAMA_TIMEOUT_MS=30000
    ```

---

### Task 2: Build `ollamaProvider.js` Adapter

**Files:**
- Create: `backend/src/services/ai/ollamaProvider.js`
- Test: `backend/tests/unit/ollamaProvider.test.js`

**Interfaces:**
- Produces:
  - `ollamaProvider.isOllamaAvailable(options)`: Boolean indicating whether Ollama server is responding at `http://localhost:11434/api/version`.
  - `ollamaProvider.chatWithOllama({ messages, systemInstruction, model, temperature, timeoutMs })`: Sends chat request to `/api/chat` and returns `{ reply, provider, model }`.
  - `ollamaProvider.generateEmbedding({ text, model, timeoutMs })`: Sends text to `/api/embed` or `/api/embeddings` and returns `Array<number>`.

- [x] **Step 1: Write unit tests in `backend/tests/unit/ollamaProvider.test.js`**
  - Test 1: `isOllamaAvailable` returns true when endpoint responds with 200, false on connection failure.
  - Test 2: `chatWithOllama` formats messages with system instruction and parses JSON response.
  - Test 3: `generateEmbedding` returns embedding float array.
  - Test 4: Handles timeouts and non-200 responses gracefully without throwing unhandled exceptions.

- [x] **Step 2: Run test to verify failure**
  - Command: `npm --prefix backend test -- backend/tests/unit/ollamaProvider.test.js`
  - Expected: FAIL.

- [x] **Step 3: Implement `ollamaProvider.js`**
  - Write pure JS native `fetch` client (Zero external npm dependencies).
  - Ensure UTF-8 (no BOM).

- [x] **Step 4: Run test to verify pass**
  - Command: `npm --prefix backend test -- backend/tests/unit/ollamaProvider.test.js`
  - Expected: PASS (100%).

- [x] **Step 5: Commit**
  - Command: `git add backend/src/services/ai/ollamaProvider.js backend/tests/unit/ollamaProvider.test.js && git commit -m "feat(ai): implement ollamaProvider for local chat and embeddings"`

---

### Task 3: Build RAG Engine & Pre-computed Vector Seeder (`ragService.js`)

**Files:**
- Create: `backend/src/services/ai/ragService.js`
- Create: `backend/src/scripts/seedRagVectors.js`
- Test: `backend/tests/unit/ragService.test.js`

**Interfaces:**
- Produces:
  - `ragService.chunkKnowledgeBase()`: Splits `studentKnowledge`, `lecturerKnowledge`, `adminKnowledge` into semantically tagged chunks with metadata (`id`, `title`, `stage`, `roleScope`, `text`).
  - `ragService.cosineSimilarity(vecA, vecB)`: Fast pure JS cosine vector math.
  - `ragService.retrieveRelevantChunks({ query, userRole, topK, minScore })`: Generates query vector via `ollamaProvider.generateEmbedding`, filters by user role, ranks by cosine similarity, returns top-K relevant chunks.
  - `ragService.formatRagContext(chunks)`: Assembles chunks into clean markdown for prompt injection.

- [x] **Step 1: Write unit tests in `backend/tests/unit/ragService.test.js`**
  - Test 1: Chunking splits knowledge into structured chunks with valid `roleScope`.
  - Test 2: Role filtering: `STUDENT` never receives `LECTURER` or `ADMIN` chunks.
  - Test 3: Cosine similarity calculation is mathematically accurate.
  - Test 4: `retrieveRelevantChunks` correctly ranks and retrieves top matching chunks.

- [x] **Step 2: Run test to verify failure**
  - Command: `npm --prefix backend test -- backend/tests/unit/ragService.test.js`
  - Expected: FAIL.

- [x] **Step 3: Implement `ragService.js` and `seedRagVectors.js`**
  - Implement chunking, vector indexing and retrieval.
  - Add npm script: `"seed:rag": "node src/scripts/seedRagVectors.js"` in `backend/package.json`.

- [x] **Step 4: Run test to verify pass**
  - Command: `npm --prefix backend test -- backend/tests/unit/ragService.test.js`
  - Expected: PASS (100%).

- [x] **Step 5: Commit**
  - Command: `git add backend/src/services/ai/ragService.js backend/src/scripts/seedRagVectors.js backend/tests/unit/ragService.test.js backend/package.json docs/superpowers/plans/2026-11-13-local-ollama-rag-chatbot-plan.md && git commit -m "feat(ai): build ragService with document chunking, RBAC isolation and vector retrieval"`

---

### Task 4: Integrate Controller & Dual-Engine Router in `aiProviderService.js`

**Files:**
- Modify: `backend/src/services/ai/aiProviderService.js`
- Test: `backend/tests/integration/ollamaRagWorkflow.test.js`

- [x] **Step 1: Write integration tests in `backend/tests/integration/ollamaRagWorkflow.test.js`**
  - Test 1: When `AI_PROVIDER=ollama` and Ollama is active, queries RAG context, calls `qwen3:4b` and returns local AI reply.
  - Test 2: Zero Crash Guarantee: When Ollama is offline/unreachable, gracefully falls back to Gemini or Local Heuristic without crashing.
  - Test 3: Grounding integration: RAG context + Live context (topic/advisor/semester) + XML `<user_query>` boundary are seamlessly combined.

- [x] **Step 2: Run test to verify failure**
  - Command: `npm --prefix backend test -- backend/tests/integration/ollamaRagWorkflow.test.js`
  - Expected: FAIL.

- [x] **Step 3: Update `aiProviderService.js`**
  - Integrate `ollamaProvider` and `ragService`.
  - Route dynamically based on `process.env.AI_PROVIDER || 'hybrid'`.

- [x] **Step 4: Run test to verify pass**
  - Command: `npm --prefix backend test -- backend/tests/integration/ollamaRagWorkflow.test.js`
  - Expected: PASS (100%).

- [x] **Step 5: Commit**
  - Command: `git add backend/src/services/ai/aiProviderService.js backend/tests/integration/ollamaRagWorkflow.test.js docs/superpowers/plans/2026-11-13-local-ollama-rag-chatbot-plan.md && git commit -m "feat(ai): integrate Ollama RAG router and dual-engine fallback in aiProviderService"`

---

### Task 5: Full Regression, Zero-BOM Verification & Session Update

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run complete backend test suite**
  - Command: `npm --prefix backend test`
  - Expected: All test suites PASS (100%).

- [ ] **Step 2: Run complete frontend test suite**
  - Command: `npm --prefix frontend test`
  - Expected: All test suites PASS (100%).

- [ ] **Step 3: Run production frontend build**
  - Command: `npm --prefix frontend run build`
  - Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Verify UTF-8 (no BOM) on all created and modified files**

- [ ] **Step 5: Record Session Update in `CLAUDE.md` and commit**
  - Command: `git commit -m "docs(claude): record Session Update for Local Ollama RAG Chatbot"`

