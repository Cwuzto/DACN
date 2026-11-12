# Academic AI Suite (BM01 Copilot, Topic Similarity & Archival Cross-Check) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Academic AI Suite providing BM01 Copilot (5-dimensional outline logic analysis), Topic Semantic Similarity Detection (historical topic comparison and novel title suggestions), and Archival Dossier Cross-Check (verifying file metadata against official BM02/BM02-A titles) via a robust Hybrid Provider Adapter (Google Gemini Flash API + Local Fallback Provider).

**Architecture:** A unified backend AI Adapter (`aiProviderService.js`) dynamically delegates requests to `geminiProvider.js` when `GEMINI_API_KEY` is available and network is active, or gracefully falls back to `localFallbackProvider.js` when offline or unconfigured. Guarded REST endpoints in `aiRoutes.js` are backed by in-memory deduplication caching, while Ant Design modular drawers/modals in the frontend provide seamless, Rule 2.6-compliant user workflows for Students, Lecturers, and Academic Affairs.

**Tech Stack:** Node.js, Express 5, Prisma 7 (`@prisma/adapter-pg`, PostgreSQL), Google Gemini 2.0/1.5 Flash API (REST / `@google/genai`), React 19, Vite, Ant Design, Zustand, Jest / Supertest, Node test runner (`node:test`).

**Spec:** [docs/superpowers/specs/2026-11-12-academic-ai-suite-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-12-academic-ai-suite-design.md)

## Global Constraints

- **Single Registration Model (`1 SV / 1 Đề tài`):** Anchor all AI interactions to `TopicRegistration.id` and `Topic.id`; never introduce legacy group entities.
- **Effective Title Legal Precedence:** Always resolve official topic titles for archival cross-checking via `resolveEffectiveTopicTitle` (BM02-A `ISSUED` appendix $\rightarrow$ BM02 `PUBLISHED` decision $\rightarrow$ initial topic title).
- **Graceful Offline Fallback (Zero Crash Guarantee):** When `GEMINI_API_KEY` is missing or the external network is unreachable, all AI endpoints MUST fallback to local heuristic intelligence and return valid, schema-compliant JSON with `provider: 'local_fallback'` without throwing 500 errors.
- **Rule 2.6 UI/UX Button Standards:** Never insert raw graphic characters or emojis (`🤖`, `📋`, `✓`, `🔍`, `←`, `→`, etc.) directly into `<Button>` text labels. Always use `@ant-design/icons` via `icon={<IconComponent />}`.
- **UTF-8 (no BOM) Standard:** All files MUST be saved with **UTF-8 (no BOM)** encoding.

## Review Focus

1. **AI Endpoint Execution Without `GEMINI_API_KEY`:** Calling `POST /api/ai/bm01-copilot`, `POST /api/ai/topic-similarity`, or `POST /api/ai/cross-check-archive` in an offline or unkeyed environment must return `200 OK` with valid fallback analysis and `provider: 'local_fallback'`, never throwing `500 INTERNAL_SERVER_ERROR` (tested in Task 1 & Task 2).
2. **Archival Title Mismatch Detection:** In `POST /api/ai/cross-check-archive`, if the student's report file reflects an outdated title while an `ISSUED` BM02-A appendix has changed the official topic title, the AI checklist must flag `status: 'MISMATCH'` and list the discrepancy for Academic Affairs (tested in Task 2).
3. **In-Memory Cache Debouncing:** Sending identical payloads to `POST /api/ai/topic-similarity` or `POST /api/ai/bm01-copilot` within 5 minutes must return the cached response without re-invoking the external Gemini API (tested in Task 2).
4. **BM01 Incomplete Sections Flagging:** Submitting an outline missing methodology or scope must yield `status: 'NEEDS_IMPROVEMENT'` with explicit `actionableSuggestions` highlighting the missing section (tested in Task 2).
5. **Strict Button Typography Compliance:** All buttons triggering AI features across `SubmissionPage.jsx`, `TopicManagementPage.jsx`, and `ProjectOversightPage.jsx` must use Ant Design icon components with pure Vietnamese labels (tested in Tasks 3, 4, 5).

---

### Task 1: Backend AI Adapter Core & Local Fallback Provider

**Files:**
- Create: `backend/src/services/ai/geminiProvider.js`
- Create: `backend/src/services/ai/localFallbackProvider.js`
- Create: `backend/src/services/ai/aiProviderService.js`
- Test: `backend/tests/unit/aiProviderAdapter.test.js`

**Interfaces:**
- Produces:
  - `aiProviderService.analyzeBM01Outline(outlineContent, options)`: Returns 5-dimensional logic assessment, overall score, dimensions array, and suggestions.
  - `aiProviderService.checkTopicSimilarity(newTopic, existingTopics, options)`: Returns max similarity percentage, risk level (`NOVEL` / `MODERATE_SIMILARITY` / `HIGH_DUPLICATE_RISK`), matched topics, and 3 refined title suggestions.
  - `aiProviderService.crossCheckArchivalDossier(registrationData, dossierFiles, options)`: Returns checklist matching effective topic title, MSSV, Student Name, Mentor Name, and consistency notes.

- [x] **Step 1: Write unit tests in `backend/tests/unit/aiProviderAdapter.test.js`**
  - Verify `geminiProvider` formats prompt and parses JSON responses correctly.
  - Verify `localFallbackProvider` executes rule-based outline analysis, Jaccard keyword similarity for topics, and title matching without external APIs.
  - Verify `aiProviderService` gracefully routes to local fallback when `GEMINI_API_KEY` is unset or on fetch error.

- [x] **Step 2: Run test to verify failure**
  - Command: `npm --prefix backend test -- backend/tests/unit/aiProviderAdapter.test.js`
  - Expected: FAIL (modules not found).

- [x] **Step 3: Implement `geminiProvider.js`, `localFallbackProvider.js`, and `aiProviderService.js`**
  - In `geminiProvider.js`: implement standard HTTP POST to Google Generative Language API (`gemini-2.0-flash` endpoint) with system instructions requesting strict JSON output.
  - In `localFallbackProvider.js`: implement rule-based scoring (checking word count, keyword overlaps, methodology presence, title Jaccard distance, and exact substring matching).
  - In `aiProviderService.js`: orchestrate provider selection, timeout handling (8 seconds), and automatic fallback.

- [x] **Step 4: Run test to verify pass**
  - Command: `npm --prefix backend test -- backend/tests/unit/aiProviderAdapter.test.js`
  - Expected: PASS (100%).

- [x] **Step 5: Commit**
  - Command: `git add backend/src/services/ai/ backend/tests/unit/aiProviderAdapter.test.js && git commit -m "feat(ai): implement core AI provider adapter and local fallback service"`

---

### Task 2: Backend AI Endpoints, In-Memory Cache & Controller

**Files:**
- Create: `backend/src/services/ai/aiCache.js`
- Create: `backend/src/controllers/aiController.js`
- Create: `backend/src/routes/aiRoutes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/integration/aiSuiteWorkflow.test.js`

**Interfaces:**
- Produces:
  - `POST /api/ai/bm01-copilot`: Accepts `{ registrationId, outlineContent }`. Guarded by `authenticateToken`.
  - `POST /api/ai/topic-similarity`: Accepts `{ title, summary?, semesterId? }`. Guarded by `authenticateToken`.
  - `POST /api/ai/cross-check-archive`: Accepts `{ registrationId }`. Guarded by `authenticateToken`.

- [ ] **Step 1: Write integration tests in `backend/tests/integration/aiSuiteWorkflow.test.js`**
  - Test 1: `POST /api/ai/bm01-copilot` evaluates outline and returns 5 dimensions and score.
  - Test 2: `POST /api/ai/bm01-copilot` missing required sections returns actionable improvement warnings.
  - Test 3: `POST /api/ai/topic-similarity` queries existing topics and calculates similarity score and suggestions.
  - Test 4: `POST /api/ai/topic-similarity` returns cached result on duplicate call within TTL.
  - Test 5: `POST /api/ai/cross-check-archive` resolves effective topic title and validates student credentials against dossier files.
  - Test 6: Unauthorized actors are rejected with `403 FORBIDDEN`.

- [ ] **Step 2: Run test to verify failure**
  - Command: `npm --prefix backend test -- backend/tests/integration/aiSuiteWorkflow.test.js`
  - Expected: FAIL (routes not mounted).

- [ ] **Step 3: Implement `aiCache.js`, `aiController.js`, `aiRoutes.js`, and mount in `app.js`**
  - Implement SHA-256 payload hashing in `aiCache.js` with TTL expiration.
  - Implement controller handlers with database lookups for existing topics and registrations.
  - Register `/api/ai` routes in `backend/src/app.js`.

- [ ] **Step 4: Run test to verify pass**
  - Command: `npm --prefix backend test -- backend/tests/integration/aiSuiteWorkflow.test.js`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit**
  - Command: `git add backend/src/services/ai/aiCache.js backend/src/controllers/aiController.js backend/src/routes/aiRoutes.js backend/src/app.js backend/tests/integration/aiSuiteWorkflow.test.js && git commit -m "feat(ai): expose authenticated AI copilot, topic similarity, and archival cross-check endpoints"`

---

### Task 3: Frontend Client Service & BM01 Copilot Drawer Integration

**Files:**
- Create: `frontend/src/services/aiService.js`
- Create: `frontend/src/components/student/BM01CopilotDrawer.jsx`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/components/forms/HybridBMFormModal.jsx`
- Test: `frontend/src/pages/__tests__/bm01CopilotUi.test.js`

**Interfaces:**
- Produces:
  - `aiService.analyzeBM01(payload)`: Calls `POST /api/ai/bm01-copilot`.
  - `<BM01CopilotDrawer />`: Displays overall score badge, 5 logic dimension cards, warning alert list, and actionable suggestions.
  - Rule 2.6 trigger button in `SubmissionPage.jsx` and `HybridBMFormModal.jsx`.

- [x] **Step 1: Write frontend unit tests in `frontend/src/pages/__tests__/bm01CopilotUi.test.js`**
  - Verify `aiService.analyzeBM01` is exported and invokes correct endpoint.
  - Verify `BM01CopilotDrawer` component renders score, dimensions, and advice cleanly.
  - Verify zero raw emojis in button labels across modified components.

- [x] **Step 2: Run test to verify failure**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/bm01CopilotUi.test.js`
  - Expected: FAIL.

- [x] **Step 3: Implement `aiService.js`, `BM01CopilotDrawer.jsx`, and integrate into pages**
  - Build `BM01CopilotDrawer` with Ant Design `Drawer`, `Progress`, `Tag`, `Alert`, and `List`.
  - Wire button `<Button icon={<RobotOutlined />} onClick={openCopilot}>Đánh giá đề cương với AI</Button>` into outline submission flow.

- [x] **Step 4: Run test to verify pass**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/bm01CopilotUi.test.js`
  - Expected: PASS (100%).

- [x] **Step 5: Commit**
  - Command: `git add frontend/src/services/aiService.js frontend/src/components/student/BM01CopilotDrawer.jsx frontend/src/pages/student/SubmissionPage.jsx frontend/src/components/forms/HybridBMFormModal.jsx frontend/src/pages/__tests__/bm01CopilotUi.test.js && git commit -m "feat(ui): implement BM01 Copilot drawer and integrate into outline submission flow"`

---

### Task 4: Frontend Topic Similarity Checker Modal Integration

**Files:**
- Create: `frontend/src/components/topics/TopicSimilarityModal.jsx`
- Modify: `frontend/src/pages/lecturer/TopicManagementPage.jsx`
- Modify: `frontend/src/pages/admin/TopicManagementPage.jsx`
- Test: `frontend/src/pages/__tests__/topicSimilarityUi.test.js`

**Interfaces:**
- Produces:
  - `aiService.checkTopicSimilarity(payload)`: Calls `POST /api/ai/topic-similarity`.
  - `<TopicSimilarityModal />`: Shows similarity progress gauge, risk badge, comparison table, and 3 title suggestions with one-click selection.

- [x] **Step 1: Write frontend unit tests in `frontend/src/pages/__tests__/topicSimilarityUi.test.js`**
  - Verify `TopicSimilarityModal` renders similarity percentage and suggested titles.
  - Verify one-click title selection applies suggestion to topic form.
  - Verify strict Rule 2.6 compliance.

- [x] **Step 2: Run test to verify failure**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/topicSimilarityUi.test.js`
  - Expected: FAIL.

- [x] **Step 3: Implement `TopicSimilarityModal.jsx` and integrate into topic creation/editing forms**
  - Add button `<Button icon={<AuditOutlined />} onClick={handleCheckSimilarity}>Kiểm tra tính mới AI</Button>` next to topic title input.

- [x] **Step 4: Run test to verify pass**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/topicSimilarityUi.test.js`
  - Expected: PASS (100%).

- [x] **Step 5: Commit**
  - Command: `git add frontend/src/components/topics/TopicSimilarityModal.jsx frontend/src/pages/lecturer/TopicManagementPage.jsx frontend/src/pages/admin/TopicManagementPage.jsx frontend/src/pages/__tests__/topicSimilarityUi.test.js && git commit -m "feat(ui): implement Topic Similarity modal and integrate into topic management"`

---

### Task 5: Frontend Archival Dossier Cross-Check Modal Integration

**Files:**
- Create: `frontend/src/components/admin/ArchivalCrossCheckModal.jsx`
- Modify: `frontend/src/pages/admin/ProjectOversightPage.jsx`
- Modify: `frontend/src/components/forms/ArchiveSubmissionModal.jsx`
- Test: `frontend/src/pages/__tests__/archivalCrossCheckUi.test.js`

**Interfaces:**
- Produces:
  - `aiService.crossCheckArchive(registrationId)`: Calls `POST /api/ai/cross-check-archive`.
  - `<ArchivalCrossCheckModal />`: Displays checklist comparing official system data with extracted document cover metadata, discrepancies alert, and Academic Affairs approval guidance.

- [x] **Step 1: Write frontend unit tests in `frontend/src/pages/__tests__/archivalCrossCheckUi.test.js`**
  - Verify modal renders 2-column comparison and discrepancy tags.
  - Verify quick-action button in `ProjectOversightPage` archive table.
  - Verify strict Rule 2.6 compliance.

- [x] **Step 2: Run test to verify failure**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/archivalCrossCheckUi.test.js`
  - Expected: FAIL.

- [x] **Step 3: Implement `ArchivalCrossCheckModal.jsx` and integrate into Project Oversight & Archive Submission**
  - Add `<Button size="small" icon={<ScanOutlined />} onClick={() => openCrossCheck(record.registrationId)}>AI Đối soát</Button>` into archive table.

- [x] **Step 4: Run test to verify pass**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/archivalCrossCheckUi.test.js`
  - Expected: PASS (100%).

- [x] **Step 5: Commit**
  - Command: `git add frontend/src/components/admin/ArchivalCrossCheckModal.jsx frontend/src/pages/admin/ProjectOversightPage.jsx frontend/src/components/forms/ArchiveSubmissionModal.jsx frontend/src/pages/__tests__/archivalCrossCheckUi.test.js && git commit -m "feat(ui): implement Archival Cross-Check modal for academic affairs review"`

---

### Task 6: Full Regression, Zero-Mock Verification & Production Build

**Files:**
- Test: `backend/tests/integration/`
- Test: `frontend/src/pages/__tests__/`

- [x] **Step 1: Run complete backend test suite**
  - Command: `npm --prefix backend test`
  - Expected: 95+ test suites PASS (100%).

- [x] **Step 2: Run complete frontend test suite**
  - Command: `npm --prefix frontend test`
  - Expected: 168+ tests PASS (100%).

- [x] **Step 3: Run production frontend build**
  - Command: `npm --prefix frontend run build`
  - Expected: Build succeeds with 0 errors.

- [x] **Step 4: Verify UTF-8 (no BOM) on all created and modified files**
  - Command: Verify with node script.

- [x] **Step 5: Record Session Update in `CLAUDE.md` and commit**
  - Update `CLAUDE.md` with full 4-section Session Summary for Academic AI Suite.
  - Command: `git commit -m "docs(claude): record Session Update for Academic AI Suite implementation"`

