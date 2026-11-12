# Academic AI Assistant Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Academic AI Assistant Suite featuring an Academic Regulation Chatbot Widget, AI Feedback Generator for BM01/BM03/BM04/Defense, AI Defense Questions Generator for Council Examiners, and enhanced Semantic Topic Similarity across active and historical semesters, all powered by a Zero-Crash Hybrid Provider Adapter.

**Architecture:** Extend `aiProviderService.js` and its adapters (`geminiProvider.js` and `localFallbackProvider.js`) to support 3 new academic capabilities. Expose cached REST endpoints in `aiRoutes.js`, and provide a floating Ant Design Chatbot Widget (`AcademicChatWidget.jsx`) alongside one-click AI assistance buttons in grading and review interfaces.

**Tech Stack:** Node.js, Express 5, Prisma 7, Google Gemini 2.0 Flash API (native `fetch`), React 19, Ant Design 6, Tailwind CSS, Jest, Supertest, Node test runner (`node:test`).

**Spec:** [docs/superpowers/specs/2026-11-12-academic-ai-assistant-suite-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-12-academic-ai-assistant-suite-design.md)

## Global Constraints

- **Single Registration Model (`1 SV / 1 Đề tài`):** AI context queries must strictly anchor to `TopicRegistration.id` and `Topic.id`; never introduce group structures.
- **Graceful Offline Fallback (Zero Crash Guarantee):** When `GEMINI_API_KEY` is missing or the external network is unreachable, all AI endpoints MUST fallback to local heuristic intelligence and return valid, schema-compliant JSON with `provider: 'local_fallback'` without throwing 500 errors.
- **In-Memory Cache TTL (5 minutes):** Identical request payloads hashed via SHA-256 must return cached data without re-calling the external Gemini API.
- **Rule 2.6 UI/UX Button Standards:** Never insert raw graphic characters or emojis (`🤖`, `📋`, `✓`, `💬`, `💡`, `❓`, `←`, `→`, etc.) directly into `<Button>` text labels. Always use `@ant-design/icons` via `icon={<IconComponent />}`.
- **UTF-8 (no BOM) Standard:** All files MUST be saved with **UTF-8 (no BOM)** encoding.

## Review Focus

1. **Chatbot Offline Resiliency:** Sending a query to `POST /api/ai/regulation-chat` without `GEMINI_API_KEY` must return a coherent fallback answer from embedded regulatory knowledge with `provider: 'local_fallback'` (tested in Task 1 & 2).
2. **Feedback Generation Without Scores:** Calling `POST /api/ai/generate-feedback` with empty scores must still generate sensible, constructive academic feedback based on available context (tested in Task 2).
3. **Defense Questions 3-Tier Categorization:** Calling `POST /api/ai/generate-defense-questions` must always return exactly 3 tiered levels (`FOUNDATION`, `TECHNICAL_CHALLENGE`, `FUTURE_EXPANSION`) with explicit question text and rationale (tested in Task 1 & 2).
4. **Chatbot Widget Viewport Responsiveness:** The floating chat widget must render cleanly on mobile and desktop without obstructing essential page actions (tested in Task 3).
5. **Strict Button Typography Compliance:** All buttons triggering AI features across `AppLayout.jsx`, `OutlineReviewModal.jsx`, and `LecturerGradingSheetPage.jsx` must use Ant Design icon components with pure Vietnamese labels (tested in Task 3 & 4).

---

### Task 1: Backend AI Adapter Extensions, Local Mini Embeddings & Fallback Providers

**Files:**
- Create: `backend/src/services/ai/localEmbeddingService.js`
- Modify: `backend/src/services/ai/geminiProvider.js`
- Modify: `backend/src/services/ai/localFallbackProvider.js`
- Modify: `backend/src/services/ai/aiProviderService.js`
- Test: `backend/tests/unit/aiAssistantSuiteAdapter.test.js`

**Interfaces:**
- Produces:
  - `localEmbeddingService.computeSimilarity(textA, textB)`: Returns Cosine similarity float $[0.0 - 1.0]$ using `@xenova/transformers` with fallback.
  - `aiProviderService.generateFeedback(payload, options)`: Returns `{ feedback: string, strengths: string[], improvements: string[], provider: string }`.
  - `aiProviderService.generateDefenseQuestions(payload, options)`: Returns `{ questions: Array<{ level: string, levelLabel: string, question: string, purpose: string }>, provider: string }`.
  - `aiProviderService.answerRegulationChat(payload, options)`: Returns `{ reply: string, relatedRegulations: string[], suggestedQuickQuestions: string[], provider: string }`.

- [ ] **Step 1: Write unit tests in `backend/tests/unit/aiAssistantSuiteAdapter.test.js`**
  - Verify `localEmbeddingService` computes cosine similarity with vector math and fallback.
  - Verify `geminiProvider` formats prompt and parses JSON responses for feedback generation, defense questions, and regulation chat.
  - Verify `localFallbackProvider` provides offline rule-based responses for all 3 capabilities.
  - Verify `aiProviderService` gracefully routes to local fallback when `GEMINI_API_KEY` is unset or on fetch error.

- [ ] **Step 2: Run test to verify failure**
  - Command: `npm --prefix backend test -- backend/tests/unit/aiAssistantSuiteAdapter.test.js`
  - Expected: FAIL (methods not defined).

- [ ] **Step 3: Implement methods in `localEmbeddingService.js`, `geminiProvider.js`, `localFallbackProvider.js`, and `aiProviderService.js`**
  - In `localEmbeddingService.js`: load `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`) via dynamic import with Jaccard cosine similarity fallback.
  - In `geminiProvider.js`: add `generateAcademicFeedback`, `generateDefenseQuestions`, and `answerRegulationChat` with structured JSON prompts.
  - In `localFallbackProvider.js`: add offline template generation based on score thresholds, technology keywords, and embedded 6-stage regulation rules.
  - In `aiProviderService.js`: wire facade routing, timeout handling (8 seconds), and fallback catching.

- [ ] **Step 4: Run test to verify pass**
  - Command: `npm --prefix backend test -- backend/tests/unit/aiAssistantSuiteAdapter.test.js`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit**
  - Command: `git add backend/src/services/ai/ backend/tests/unit/aiAssistantSuiteAdapter.test.js && git commit -m "feat(ai): implement local mini embeddings, feedback generator, defense questions, and regulation chat"`

---

### Task 2: Backend AI Endpoints & Controller Integration

**Files:**
- Modify: `backend/src/controllers/aiController.js`
- Modify: `backend/src/routes/aiRoutes.js`
- Test: `backend/tests/integration/aiAssistantSuiteWorkflow.test.js`

**Interfaces:**
- Produces:
  - `POST /api/ai/generate-feedback`: Accepts `{ contextType, topicTitle, studentName?, scores?, notes? }`. Guarded by `authenticateToken`.
  - `POST /api/ai/generate-defense-questions`: Accepts `{ topicTitle, description?, technologies?, major? }`. Guarded by `authenticateToken`.
  - `POST /api/ai/regulation-chat`: Accepts `{ message, history? }`. Guarded by `authenticateToken`.

- [ ] **Step 1: Write integration tests in `backend/tests/integration/aiAssistantSuiteWorkflow.test.js`**
  - Test 1: `POST /api/ai/generate-feedback` returns academic feedback with strengths and improvements.
  - Test 2: `POST /api/ai/generate-defense-questions` returns 3-level defense questions with purposes.
  - Test 3: `POST /api/ai/regulation-chat` returns regulation answers with quick follow-up questions.
  - Test 4: Cache returns cached response for duplicate requests within TTL.
  - Test 5: Rejection of unauthenticated requests (`401 UNAUTHORIZED`).

- [ ] **Step 2: Run test to verify failure**
  - Command: `npm --prefix backend test -- backend/tests/integration/aiAssistantSuiteWorkflow.test.js`
  - Expected: FAIL (routes not defined).

- [ ] **Step 3: Implement controller functions and mount routes in `aiRoutes.js`**
  - Implement `generateFeedback`, `generateDefenseQuestions`, and `regulationChat` in `aiController.js`.
  - Integrate `aiCache.get` / `aiCache.set` with 5-minute TTL.
  - Register POST routes in `aiRoutes.js`.

- [ ] **Step 4: Run test to verify pass**
  - Command: `npm --prefix backend test -- backend/tests/integration/aiAssistantSuiteWorkflow.test.js`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit**
  - Command: `git add backend/src/controllers/aiController.js backend/src/routes/aiRoutes.js backend/tests/integration/aiAssistantSuiteWorkflow.test.js && git commit -m "feat(ai): expose endpoints for academic feedback, defense questions, and regulation chat"`

---

### Task 3: Frontend Client Service & Floating Chatbot Widget

**Files:**
- Modify: `frontend/src/services/aiService.js`
- Create: `frontend/src/components/common/AcademicChatWidget.jsx`
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Test: `frontend/src/pages/__tests__/academicChatWidgetUi.test.js`

**Interfaces:**
- Produces:
  - `aiService.generateFeedback(payload)`: Calls `POST /api/ai/generate-feedback`.
  - `aiService.generateDefenseQuestions(payload)`: Calls `POST /api/ai/generate-defense-questions`.
  - `aiService.chatRegulation(payload)`: Calls `POST /api/ai/regulation-chat`.
  - `<AcademicChatWidget />`: Floating chat assistant mounted globally in `AppLayout.jsx`.

- [ ] **Step 1: Write frontend unit tests in `frontend/src/pages/__tests__/academicChatWidgetUi.test.js`**
  - Verify `aiService` exports all 3 new methods.
  - Verify `AcademicChatWidget` adheres to Rule 2.6 (no raw emojis in buttons).
  - Verify `AppLayout.jsx` renders `AcademicChatWidget`.

- [ ] **Step 2: Run test to verify failure**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/academicChatWidgetUi.test.js`
  - Expected: FAIL.

- [ ] **Step 3: Implement `AcademicChatWidget.jsx`, update `aiService.js`, and mount in `AppLayout.jsx`**
  - Build `AcademicChatWidget` with floating trigger button (`MessageOutlined`), collapsible chat card, scrollable message list, suggested quick question chips, and text input.
  - Mount `<AcademicChatWidget />` inside `AppLayout.jsx`.

- [ ] **Step 4: Run test to verify pass**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/academicChatWidgetUi.test.js`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit**
  - Command: `git add frontend/src/services/aiService.js frontend/src/components/common/AcademicChatWidget.jsx frontend/src/components/layout/AppLayout.jsx frontend/src/pages/__tests__/academicChatWidgetUi.test.js && git commit -m "feat(ui): implement AcademicChatWidget and mount in AppLayout"`

---

### Task 4: Frontend AI Feedback & Defense Questions Integration

**Files:**
- Modify: `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`
- Modify: `frontend/src/components/lecturer/OutlineReviewModal.jsx`
- Test: `frontend/src/pages/__tests__/aiFeedbackAndDefenseQuestionsUi.test.js`

**Interfaces:**
- Produces:
  - One-click `"AI Gợi ý nhận xét"` button filling feedback input fields.
  - Defense questions preview panel with copy question buttons for council examiners.

- [ ] **Step 1: Write frontend unit tests in `frontend/src/pages/__tests__/aiFeedbackAndDefenseQuestionsUi.test.js`**
  - Verify `LecturerGradingSheetPage.jsx` has AI feedback trigger and defense question generator buttons conforming to Rule 2.6.
  - Verify `OutlineReviewModal.jsx` has AI feedback trigger button conforming to Rule 2.6.

- [ ] **Step 2: Run test to verify failure**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/aiFeedbackAndDefenseQuestionsUi.test.js`
  - Expected: FAIL.

- [ ] **Step 3: Integrate AI feedback and defense questions into pages**
  - In `OutlineReviewModal.jsx`: Add `<Button icon={<BulbOutlined />} onClick={handleAIFeedback}>AI Gợi ý nhận xét</Button>` next to feedback comment field.
  - In `LecturerGradingSheetPage.jsx`: Add AI feedback button in remarks section, and render a collapsible `"Gợi ý câu hỏi phản biện AI"` card with 3 question tiers.

- [ ] **Step 4: Run test to verify pass**
  - Command: `npm --prefix frontend test -- src/pages/__tests__/aiFeedbackAndDefenseQuestionsUi.test.js`
  - Expected: PASS (100%).

- [ ] **Step 5: Commit**
  - Command: `git add frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx frontend/src/components/lecturer/OutlineReviewModal.jsx frontend/src/pages/__tests__/aiFeedbackAndDefenseQuestionsUi.test.js && git commit -m "feat(ui): integrate AI feedback and defense question generator into lecturer review and grading"`

---

### Task 5: Full Regression, Zero-Mock Verification & Production Build

**Files:**
- Test: `backend/tests/`
- Test: `frontend/src/pages/__tests__/`

- [ ] **Step 1: Run complete backend test suite**
  - Command: `npm --prefix backend test`
  - Expected: 97+ test suites PASS (100%).

- [ ] **Step 2: Run complete frontend test suite**
  - Command: `npm --prefix frontend test`
  - Expected: 179+ tests PASS (100%).

- [ ] **Step 3: Run production frontend build**
  - Command: `npm --prefix frontend run build`
  - Expected: Build succeeds with 0 errors.

- [ ] **Step 4: Verify UTF-8 (no BOM) on all created and modified files**
  - Command: Verify with node script.

- [ ] **Step 5: Record Session Update in `CLAUDE.md` and commit**
  - Update `CLAUDE.md` with full 4-section Session Summary for Academic AI Assistant Suite.
  - Command: `git commit -m "docs(claude): record Session Update for Academic AI Assistant Suite implementation"`

