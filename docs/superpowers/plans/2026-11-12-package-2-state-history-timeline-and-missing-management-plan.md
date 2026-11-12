# Package 2: State History Timeline, Audit Log Access, Real Template Connection & Rule 2.6 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide secure read APIs and interactive UI for previously write-only database history tables (`RegistrationStateHistory`, `DefenseScheduleAdjustmentLog`, `DefenseScoreBookReturnLog`), deliver real topic cloning for lecturers, connect real portal document templates from Supabase Storage, and eliminate 100% of remaining Rule 2.6 UI button violations.

**Architecture:** Dedicated REST read endpoints guarded by strict role/ownership checks; shared Ant Design `<Timeline>` drawer for multi-role registration tracking; real clone endpoint and modal for lecturers; dynamic portal template fetching from `portalContentService`; full button typography compliance with `@ant-design/icons`.

**Tech Stack:** Node.js, Express, Prisma ORM, React 19, Ant Design 5, Tailwind CSS, Vite, Node test runner (`node:test`), Jest.

**Spec:** [docs/superpowers/specs/2026-11-12-package-2-state-history-timeline-and-missing-management-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-12-package-2-state-history-timeline-and-missing-management-design.md)

## Global Constraints
- Maximum 1 student per topic registration (`maxStudents = 1`), maximum 10 students per mentor.
- No restoration or usage of legacy `group` or `groupMember` tables.
- All files MUST be saved with **UTF-8 (no BOM)** encoding.
- Rule 2.6 UI/UX Button Standards: Never insert raw graphic characters or emoji (`←`, `→`, `+`, `🤖`, `✓`, `⚠️`, `⚙`, etc.) directly into button text labels. Always use the `icon={<IconComponent />}` prop from `@ant-design/icons`.
- Zero Mock Data Policy: Prohibit any `setTimeout` simulations or mock toast notifications on action buttons.

## Review Focus
1. Student cannot inspect the registration state history of another student (`403 FORBIDDEN`).
2. Lecturer can only view registration history for students they currently mentor (`403 FORBIDDEN` for other students).
3. Council schedule adjustments and scorebook return logs are scoped to the exact council and ordered chronologically.
4. Topic cloning only duplicates topics from non-active semesters owned by the requesting lecturer (or all for admin), assigns `DRAFT` status, sets enrollment to 0, and avoids code collision.
5. `RubricManagementPage` downloads real template documents from Supabase Storage or disables the button when unreleased.

---

### Task 1: Backend History, Schedule Adjustment & ScoreBook Return Log Read APIs

**Files:**
- Modify: `backend/src/controllers/topicController.js`
- Modify: `backend/src/routes/topicRoutes.js`
- Modify: `backend/src/controllers/councilController.js`
- Modify: `backend/src/routes/councilRoutes.js`
- Modify: `backend/src/controllers/defenseScoringController.js`
- Modify: `backend/src/routes/defenseScoringRoutes.js`
- Modify: `backend/src/security/authorizationExemptions.js`
- Modify: `backend/src/constants/authorizationExemptions.js`
- Test: `backend/tests/integration/package2ReadLogApis.test.js`

**Interfaces:**
- Produces:
  - `GET /api/topics/registrations/:id/history`: Returns `RegistrationStateHistory[]` with `actor: { id, fullName, email, role }`, sorted `asc`. Guarded: Student owns registration, Lecturer mentors topic, Admin has `VIEW_TOPICS` / `TOPIC_APPROVE` / `PROJECT_OVERSIGHT_MANAGE`.
  - `GET /api/councils/:id/schedule-adjustments`: Returns `DefenseScheduleAdjustmentLog[]` with `adjustedBy` and `registration: { student, topic }`. Guarded: Council member or `VIEW_COUNCIL_ASSIGNMENTS` / `DEFENSE_COUNCIL_MANAGE`.
  - `GET /api/evaluations/councils/:id/return-logs`: Returns `DefenseScoreBookReturnLog[]` with `returnedByAdmin` and `registration: { student }`. Guarded: Council member or `VIEW_DEFENSE_ASSIGNMENTS` / `DEFENSE_COUNCIL_MANAGE`.

- [x] **Step 1: Write failing integration tests in `backend/tests/integration/package2ReadLogApis.test.js`**

Cover:
1. `GET /api/topics/registrations/:id/history` allows student to view their own history.
2. `GET /api/topics/registrations/:id/history` rejects student viewing another student's history (`403`).
3. `GET /api/topics/registrations/:id/history` allows mentor to view their mentee's history, rejects other lecturers.
4. `GET /api/councils/:id/schedule-adjustments` returns adjustments with student info.
5. `GET /api/evaluations/councils/:id/return-logs` returns return logs with admin info and reason.

- [x] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- backend/tests/integration/package2ReadLogApis.test.js`
Expected: FAIL

- [x] **Step 3: Implement controller methods and routes**

Implement:
1. `getRegistrationHistory` in `topicController.js` and mount in `topicRoutes.js`.
2. `getScheduleAdjustments` in `councilController.js` and mount in `councilRoutes.js`.
3. `getScoreBookReturnLogs` in `defenseScoringController.js` and mount in `defenseScoringRoutes.js`.
4. Register route exemptions in `authorizationExemptions.js`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- backend/tests/integration/package2ReadLogApis.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/controllers/topicController.js backend/src/routes/topicRoutes.js backend/src/controllers/councilController.js backend/src/routes/councilRoutes.js backend/src/controllers/defenseScoringController.js backend/src/routes/defenseScoringRoutes.js backend/src/security/authorizationExemptions.js backend/src/constants/authorizationExemptions.js backend/tests/integration/package2ReadLogApis.test.js
git commit -m "feat(api): expose read endpoints for registration history, schedule adjustments and scorebook return logs"
```

---

### Task 2: Backend Topic Cloning API

**Files:**
- Modify: `backend/src/controllers/topicController.js`
- Modify: `backend/src/routes/topicRoutes.js`
- Modify: `backend/src/security/authorizationExemptions.js`
- Modify: `backend/src/constants/authorizationExemptions.js`
- Test: `backend/tests/integration/package2TopicCloning.test.js`

**Interfaces:**
- Produces:
  - `GET /api/topics/cloneable`: Returns lecturer's approved topics from prior semesters.
  - `POST /api/topics/clone`: Clones selected topics into the active semester with `DRAFT` status, `currentEnrollmentCount = 0`, unique code. Guarded: Lecturer role or Admin.

- [x] **Step 1: Write failing integration tests in `backend/tests/integration/package2TopicCloning.test.js`**

Cover:
1. `GET /api/topics/cloneable` returns approved topics from non-active semesters for the authenticated lecturer.
2. `GET /api/topics/cloneable` rejects unauthenticated users (`401`) and students (`403`).
3. `POST /api/topics/clone` creates new topics in active semester with status `DRAFT`, resetting enrollments.
4. `POST /api/topics/clone` rejects cloning topics that do not belong to the lecturer (unless admin).

- [x] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- backend/tests/integration/package2TopicCloning.test.js`
Expected: FAIL

- [x] **Step 3: Implement `getCloneableTopics` and `cloneTopics` in `topicController.js` and mount in `topicRoutes.js`**

- [x] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- backend/tests/integration/package2TopicCloning.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/controllers/topicController.js backend/src/routes/topicRoutes.js backend/src/security/authorizationExemptions.js backend/src/constants/authorizationExemptions.js backend/tests/integration/package2TopicCloning.test.js
git commit -m "feat(topic): implement real semester topic cloning endpoints for lecturers"
```

---

### Task 3: Frontend Registration Timeline Drawer Component & Multi-Role Integration

**Files:**
- Create: `frontend/src/components/common/RegistrationTimelineDrawer.jsx`
- Modify: `frontend/src/services/topicService.js`
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx`
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
- Modify: `frontend/src/pages/admin/TopicApprovalPage.jsx`
- Test: `frontend/src/pages/__tests__/registrationTimelineDrawer.test.js`

**Interfaces:**
- Consumes: `topicService.getRegistrationHistory(registrationId)`
- Produces:
  - `RegistrationTimelineDrawer.jsx`: Ant Design `<Drawer>` with `<Timeline>`, color coding per `statusMap.js`, displaying actor info, date, and reason.
  - Student Dashboard: Button "Lịch sử đề tài" opening timeline for current registration.
  - Lecturer Progress Tracking: Button "Lịch sử" in student detail panel opening timeline.
  - Admin Topic Approval: Button "Xem lịch sử" in review drawer.

- [x] **Step 1: Write failing test in `frontend/src/pages/__tests__/registrationTimelineDrawer.test.js`**

Cover:
1. `topicService.js` exports `getRegistrationHistory`.
2. `RegistrationTimelineDrawer.jsx` exports functional component using Ant Design `<Timeline>`.
3. `StudentDashboardPage.jsx`, `ProgressTrackingPage.jsx`, and `TopicApprovalPage.jsx` integrate `RegistrationTimelineDrawer`.
4. Buttons follow Rule 2.6 without raw symbols or emoji.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/registrationTimelineDrawer.test.js`
Expected: FAIL

- [x] **Step 3: Implement `RegistrationTimelineDrawer.jsx` and wire into Student, Lecturer, and Admin pages**

- [x] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/registrationTimelineDrawer.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/common/RegistrationTimelineDrawer.jsx frontend/src/services/topicService.js frontend/src/pages/student/StudentDashboardPage.jsx frontend/src/pages/lecturer/ProgressTrackingPage.jsx frontend/src/pages/admin/TopicApprovalPage.jsx frontend/src/pages/__tests__/registrationTimelineDrawer.test.js
git commit -m "feat(ui): build visual RegistrationTimelineDrawer and integrate across Student, Lecturer and Admin dashboards"
```

---

### Task 4: Frontend Council Schedule Adjustments & ScoreBook Return Logs Integration

**Files:**
- Modify: `frontend/src/services/councilService.js`
- Modify: `frontend/src/services/evaluationService.js`
- Modify: `frontend/src/pages/admin/CouncilDetailPage.jsx`
- Modify: `frontend/src/pages/admin/GradingDefensePage.jsx`
- Test: `frontend/src/pages/__tests__/councilLogsAndScorebookReturns.test.js`

**Interfaces:**
- Consumes: `councilService.getScheduleAdjustments(councilId)`, `evaluationService.getScoreBookReturnLogs(councilId)`
- Produces:
  - `CouncilDetailPage.jsx`: "Nhật ký đổi ca" button & Modal/Drawer displaying schedule adjustments.
  - `GradingDefensePage.jsx`: Return alert banner & modal displaying return history when `returnLogs.length > 0`.

- [x] **Step 1: Write failing test in `frontend/src/pages/__tests__/councilLogsAndScorebookReturns.test.js`**

Cover:
1. `councilService.getScheduleAdjustments` and `evaluationService.getScoreBookReturnLogs` are exported.
2. `CouncilDetailPage.jsx` connects schedule adjustment logs.
3. `GradingDefensePage.jsx` connects return logs and displays reason banner.
4. Rule 2.6 button standards are respected.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/councilLogsAndScorebookReturns.test.js`
Expected: FAIL

- [x] **Step 3: Update `councilService.js`, `evaluationService.js`, `CouncilDetailPage.jsx`, and `GradingDefensePage.jsx`**

- [x] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/councilLogsAndScorebookReturns.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/services/councilService.js frontend/src/services/evaluationService.js frontend/src/pages/admin/CouncilDetailPage.jsx frontend/src/pages/admin/GradingDefensePage.jsx frontend/src/pages/__tests__/councilLogsAndScorebookReturns.test.js
git commit -m "feat(ui): display real schedule adjustment logs in CouncilDetailPage and return logs in GradingDefensePage"
```

---

### Task 5: Frontend Real Topic Cloning & Portal Template Download Integration

**Files:**
- Modify: `frontend/src/services/topicService.js`
- Modify: `frontend/src/pages/lecturer/TopicManagementPage.jsx`
- Modify: `frontend/src/pages/admin/RubricManagementPage.jsx`
- Test: `frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js`

**Interfaces:**
- Consumes: `topicService.getCloneableTopics`, `topicService.cloneTopics`, `portalContentService.getPublicContent`
- Produces:
  - `TopicManagementPage.jsx`: Real clone modal loading previous topics from API, eliminating hardcoded `DT-2025-042`/`DT-2025-055` and fake toast.
  - `RubricManagementPage.jsx`: Tab "Biểu mẫu quy chuẩn" fetches templates dynamically from `portalContentService`, downloads real `.docx`/`.pdf` from Supabase Storage, eliminates fake static array & fake download toasts.

- [x] **Step 1: Write failing test in `frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js`**

Cover:
1. `topicService.getCloneableTopics` and `topicService.cloneTopics` are exported.
2. `TopicManagementPage.jsx` does not contain `DT-2025-042` or `DT-2025-055` and calls `topicService.cloneTopics`.
3. `RubricManagementPage.jsx` does not contain hardcoded static files list and connects real template download.
4. Rule 2.6 compliance.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js`
Expected: FAIL

- [x] **Step 3: Update `topicService.js`, `TopicManagementPage.jsx`, and `RubricManagementPage.jsx`**

- [x] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/services/topicService.js frontend/src/pages/lecturer/TopicManagementPage.jsx frontend/src/pages/admin/RubricManagementPage.jsx frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js
git commit -m "fix(ui): connect real topic cloning API and real portal template downloads from Supabase Storage"
```

---

### Task 6: Rule 2.6 Full Sweep & Button Standards Clean-up

**Files:**
- Modify: `frontend/src/components/lecturer/OutlineReviewModal.jsx`
- Modify: `frontend/src/pages/admin/TopicManagementPage.jsx`
- Modify: `frontend/src/pages/admin/GradingDefensePage.jsx`
- Modify: `frontend/src/pages/admin/RubricManagementPage.jsx`
- Test: `frontend/src/pages/__tests__/rule26ButtonCompliancePackage2.test.js`

**Interfaces:**
- Produces:
  - Strict compliance with AGENTS.md Rule 2.6 across all target files:
    * `OutlineReviewModal.jsx`: Replace `✓ Xác Nhận Duyệt ĐẠT` and `⚠️ Gửi Yêu Cầu Chỉnh Sửa` with `icon={<CheckOutlined />}` and `icon={<ExclamationCircleOutlined />}`.
    * `TopicManagementPage.jsx`: Replace `+ Thêm đề tài mới` with `Thêm đề tài mới` (prop `icon={<PlusOutlined />}` already present).
    * `GradingDefensePage.jsx`: Replace raw `<button>` at lines 1050/1076 with Ant Design `<Button>`.
    * `RubricManagementPage.jsx`: Replace raw `<button>` at lines 1027/1121 with Ant Design `<Button>`.

- [x] **Step 1: Write test in `frontend/src/pages/__tests__/rule26ButtonCompliancePackage2.test.js`**

Cover:
1. No raw emoji or graphic symbols in `<Button>` children across modified files.
2. No duplicate `+` when `PlusOutlined` icon prop is used.
3. No raw `<button className="btn...">` with graphic symbols in admin pages.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/rule26ButtonCompliancePackage2.test.js`
Expected: FAIL

- [x] **Step 3: Update `OutlineReviewModal.jsx`, `TopicManagementPage.jsx`, `GradingDefensePage.jsx`, and `RubricManagementPage.jsx`**

- [x] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/rule26ButtonCompliancePackage2.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/lecturer/OutlineReviewModal.jsx frontend/src/pages/admin/TopicManagementPage.jsx frontend/src/pages/admin/GradingDefensePage.jsx frontend/src/pages/admin/RubricManagementPage.jsx frontend/src/pages/__tests__/rule26ButtonCompliancePackage2.test.js
git commit -m "fix(ui): eliminate all remaining Rule 2.6 button violations and standardize on Ant Design icon components"
```

---

### Task 7: Package 2 Full Regression Verification & Build Validation

**Files:**
- Create: `backend/tests/integration/package2FullRegression.test.js`
- Validate: Full backend test suite
- Validate: Full frontend test suite
- Validate: Frontend production build

**Interfaces:**
- Consumes: All endpoints and components across Tasks 1–6
- Produces:
  - Comprehensive integration regression suite verifying all 5 Review Focus items:
    1. Cross-student registration history access is blocked with 403.
    2. Cross-lecturer registration history access is blocked with 403.
    3. Council schedule adjustments and scorebook return logs are scoped and sorted chronologically.
    4. Topic cloning preserves ownership, assigns `DRAFT`, resets enrollment count, and ensures unique codes.
    5. Template downloads route to real Supabase URLs.

- [x] **Step 1: Write `backend/tests/integration/package2FullRegression.test.js`**

- [x] **Step 2: Run the full regression test suite**

Run: `npm --prefix backend test -- backend/tests/integration/package2FullRegression.test.js`
Expected: PASS (100%)

- [x] **Step 3: Run full backend tests, frontend tests, and production build**

Run:
- `npm --prefix backend test`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`

Expected: 100% test pass rate across all suites, 0 build errors.

- [x] **Step 4: Commit**

```bash
git add backend/tests/integration/package2FullRegression.test.js
git commit -m "test(regression): add full Package 2 state history and management regression suite"
```

