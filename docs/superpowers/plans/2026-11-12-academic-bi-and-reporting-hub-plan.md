# Academic BI & Reporting Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a comprehensive Academic Business Intelligence (BI) and Reporting Hub (`/admin/reports`) providing multi-dimensional grade distribution analysis, academic progress funnel analytics, faculty mentorship load vs score variance comparisons, and official Excel (.xlsx) summary report exports.

**Architecture:** Dedicated Express reporting endpoints aggregating Prisma models (`TopicRegistration`, `CouncilDefenseResult`, `BM04Evaluation`, `Topic`, `User`); SheetJS workbook generator for administrative Excel exports; React 19 SPA analytics dashboard with Ant Design 5 interactive tabs, KPI cards, and conversion funnels.

**Tech Stack:** Node.js, Express, Prisma ORM, SheetJS (`xlsx`), React 19, Ant Design 5, Tailwind CSS, Vite, Jest, Node test runner (`node:test`).

**Spec:** [docs/superpowers/specs/2026-11-12-academic-bi-and-reporting-hub-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-12-academic-bi-and-reporting-hub-design.md)

## Global Constraints
- Maximum 1 student per topic registration (`maxStudents = 1`), maximum 10 students per mentor.
- All files MUST be saved with **UTF-8 (no BOM)** encoding.
- Rule 2.6 UI/UX Button Standards: Never insert raw graphic characters or emoji directly into button text labels. Always use the `icon={<IconComponent />}` prop from `@ant-design/icons`.
- Zero Mock Data Policy: Prohibit any `setTimeout` simulations or fake fallback metrics.

## Review Focus
1. Non-admin and unauthenticated users cannot access reporting endpoints (`401`/`403`).
2. Grade distribution accurately groups official defense scores into 5 academic bands (A, B, C, D, F).
3. Progress funnel accurately reflects real student counts across all 6 sequential academic phases.
4. Faculty workload report calculates correct completion rates and variance between mentor scores and council defense scores.
5. Excel export stream returns valid `.xlsx` content with correct attachment headers.

---

### Task 1: Backend Reporting Controller, Routes & Excel Export Service

**Files:**
- Create: `backend/src/controllers/reportController.js`
- Create: `backend/src/routes/reportRoutes.js`
- Modify: `backend/src/routes/index.js`
- Modify: `backend/src/security/authorizationExemptions.js`
- Test: `backend/tests/integration/academicReports.test.js`

**Interfaces:**
- Produces:
  - `GET /api/reports/overview`: Returns KPI metrics, grade distributions, funnel rates, and major comparisons for a semester.
  - `GET /api/reports/lecturer-workload`: Returns lecturer mentorship counts, completion rates, BM04 scores, council scores, and score variance.
  - `GET /api/reports/export-excel`: Returns binary buffer of `.xlsx` summary file with `Content-Disposition` header.

- [x] **Step 1: Write failing integration tests in `backend/tests/integration/academicReports.test.js`**

Cover:
1. `GET /api/reports/overview` returns aggregated KPIs, 5-band grade distribution, and funnel stats.
2. `GET /api/reports/lecturer-workload` returns lecturer metrics and variance.
3. `GET /api/reports/export-excel` returns binary buffer with `.xlsx` attachment headers.
4. Unauthenticated users are rejected with `401`, students without reporting permissions are rejected with `403`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- backend/tests/integration/academicReports.test.js`
Expected: FAIL

- [x] **Step 3: Implement `reportController.js`, `reportRoutes.js`, and mount in `routes/index.js`**

- [x] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- backend/tests/integration/academicReports.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/reportController.js backend/src/routes/reportRoutes.js backend/src/routes/index.js backend/src/security/authorizationExemptions.js backend/tests/integration/academicReports.test.js
git commit -m "feat(report): implement academic BI aggregation and Excel export endpoints"
```

---

### Task 2: Frontend Report Service, Navigation & Route Registration

**Files:**
- Create: `frontend/src/services/reportService.js`
- Modify: `frontend/src/routes/index.jsx`
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Modify: `frontend/src/config/navigationRegistry.js` (or `frontend/src/components/layout/AppLayout.jsx` menu items)
- Test: `frontend/src/pages/__tests__/academicReportsRouting.test.js`

**Interfaces:**
- Consumes: `reportService.getOverview`, `reportService.getLecturerWorkload`, `reportService.exportExcel`
- Produces:
  - `reportService.js`: API client methods for all 3 reporting endpoints with blob response for Excel download.
  - Navigation: Adds "Báo Cáo & Thống Kê" to Admin / Institute Leadership sidebar with icon `<BarChartOutlined />`.
  - Route: Guards `/admin/reports` with `PROJECT_OVERSIGHT_MANAGE` / `VIEW_PROJECT_OVERSIGHT` / `ADMIN`.

- [ ] **Step 1: Write failing test in `frontend/src/pages/__tests__/academicReportsRouting.test.js`**

Cover:
1. `reportService.js` exports `getOverview`, `getLecturerWorkload`, and `exportExcel`.
2. Navigation menu contains `/admin/reports` with pure Vietnamese text and icon.
3. Route `/admin/reports` is registered and guarded.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/academicReportsRouting.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `reportService.js`, register route in `routes/index.jsx`, and update navigation**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/academicReportsRouting.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/reportService.js frontend/src/routes/index.jsx frontend/src/components/layout/AppLayout.jsx frontend/src/pages/__tests__/academicReportsRouting.test.js
git commit -m "feat(ui): add reportService and register academic reports navigation and route"
```

---

### Task 3: Frontend Academic Reports Page UI & Excel Download

**Files:**
- Create: `frontend/src/pages/admin/AcademicReportsPage.jsx`
- Test: `frontend/src/pages/__tests__/academicReportsPage.test.js`

**Interfaces:**
- Consumes: `reportService.getOverview`, `reportService.getLecturerWorkload`, `reportService.exportExcel`, `semesterService.getAll`
- Produces:
  - Top toolbar: Semester selector, Major filter, and "Xuất Báo Cáo Excel" button.
  - 4 KPI cards: Total Students, Completion Rate, Average Score, Excellence Rate.
  - 4 interactive Tabs:
    * Tab 1: Phổ điểm & Xếp loại (Visual distribution bars + detailed classification table).
    * Tab 2: Phễu tiến độ học vụ (Sequential 6-phase funnel with drop-off percentages).
    * Tab 3: So sánh Chuyên ngành (Major metrics table with students, completion rate, avg score).
    * Tab 4: Tải GVHD & Độ lệch điểm (Faculty table with assigned, completed, BM04 score, council score, variance badge).
  - Strict Rule 2.6 Button compliance.

- [ ] **Step 1: Write failing test in `frontend/src/pages/__tests__/academicReportsPage.test.js`**

Cover:
1. `AcademicReportsPage.jsx` renders toolbar with semester select and export button.
2. Renders 4 KPI cards and 4 Tabs.
3. Rule 2.6 compliance (no raw emoji or symbols in button labels).
4. Handles Excel download triggering blob link click.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/academicReportsPage.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `frontend/src/pages/admin/AcademicReportsPage.jsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/academicReportsPage.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/AcademicReportsPage.jsx frontend/src/pages/__tests__/academicReportsPage.test.js
git commit -m "feat(ui): implement AcademicReportsPage with 4 BI tabs and Excel export"
```

---

### Task 4: Full Regression Verification & Build Validation

**Files:**
- Validate: Full backend test suite
- Validate: Full frontend test suite
- Validate: Frontend production build

- [ ] **Step 1: Run full backend test suite**

Run: `npm --prefix backend test`
Expected: 100% test suites pass.

- [ ] **Step 2: Run full frontend test suite**

Run: `npm --prefix frontend test`
Expected: 100% tests pass.

- [ ] **Step 3: Run production frontend build**

Run: `npm --prefix frontend run build`
Expected: Vite build succeeds with 0 errors.

- [ ] **Step 4: Update `CLAUDE.md` and commit**

```bash
git commit -m "docs(claude): record Session Update for Academic BI & Reporting Hub"
```

