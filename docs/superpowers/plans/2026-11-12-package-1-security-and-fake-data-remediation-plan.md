# Package 1: Security & Fake Data Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all P0 security and fake action vulnerabilities and core P1 fabricated metrics by realigning RBAC group definitions, locking role escalation in `updateUser`, building a real lecturer broadcast notification API, connecting real BM05 PDF export, and replacing fake/fallback student dashboard metrics with real data.

**Architecture:** Refine permission groupings in `permissions.js` by disassociating technical council coordination from `ACADEMIC_PROTECTED_PERMISSIONS` and removing academic permissions from `QUAN_TRI_VIEN` while preserving them in `GIAO_VU`; harden `updateUser` with self-role alteration and academic authority guards plus active workload validation; add `POST /api/notifications/lecturer-broadcast` in backend with semester-scoped mentor ownership; expand `dashboardController.getStudentDashboard` to return real tasks, meeting log counts, and mentor evaluation scores; update frontend pages to eliminate `setTimeout` mocks, fake toasts, and fabricated fallback numbers.

**Tech Stack:** Node.js, Express 5, Prisma 7 (`@prisma/adapter-pg`, PostgreSQL), React 19, Vite, Ant Design, Zustand, Jest / Supertest, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-package-1-security-and-fake-data-remediation-design.md`

## Global Constraints

- **TopicRegistration Model (`1 SV / 1 Đề tài`):** Always maintain single-student registration constraints; do not reintroduce group entities.
- **Academic Protection Integrity:** Only actors possessing `PERMISSION_ASSIGN_ACADEMIC` or belonging to `VIEN_TRUONG` can grant `ADMIN` roles or assign groups with `ACADEMIC_PROTECTED_PERMISSIONS`.
- **Zero Mock Data Policy:** Every button click must invoke real backend APIs or download real generated assets; zero `setTimeout` fake success handlers; zero fabricated fallback metrics (`?? 75%`, `?? 65%`, `(sPassed ? 8 : 4)`, `?? 14`, `18 / 20h`, `8.8 / 10`, `'PGS.TS Lê Quang Dũng'`).
- **UTF-8 (no BOM) Standard:** All files saved in **UTF-8 (no BOM)**.
- **Rule 2.6 UI Button Standards:** Zero raw emojis or ASCII arrow/symbols in `<Button>` text labels; always use `@ant-design/icons` via `icon={<Icon />}`.

## Review Focus

1. **Technical Admin Group Assignment Non-Escalation Check:** A technical Admin (without academic delegation) assigning `QUAN_TRI_VIEN` to another user must succeed with `200 OK` without triggering a `403` anti-escalation error (tested in Task 1).
2. **Privilege Escalation and Self-Role Change Prevention:** Calling `PUT /api/users/:id` to change one's own role or to upgrade a user to `ADMIN` without `PERMISSION_ASSIGN_ACADEMIC` must fail with `403 FORBIDDEN`; attempting to change the role of a student or lecturer with an active topic registration/mentorship must fail with `400 CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD` (tested in Task 1).
3. **Lecturer Broadcast Scope & Semester Isolation:** Calling `POST /api/notifications/lecturer-broadcast` must create notifications exclusively for active students mentored by the caller in the active semester, rejecting calls from lecturers with zero active mentees with `400 NO_ACTIVE_STUDENTS` (tested in Task 2).
4. **Triage Metrics Stage Accuracy (`unassignedRegistrations`):** Registrations in `DEFENSE_READY` with `defenseCouncilId: null` must be counted even if they already have `councilId != null` from the outline stage (tested in Task 3).
5. **Real PDF Export on BM05 Button Click:** Clicking "In Biên Bản BM05" on `GradingDefensePage` must invoke `evaluationService.exportScoreSheetPdf` and open the generated PDF URL, never just displaying a superficial toast (tested in Task 4).

---

### Task 1: RBAC Group Re-alignment & Anti-Escalation in `updateUser`

**Files:**
- Modify: `backend/src/constants/permissions.js`
- Modify: `backend/src/controllers/userController.js`
- Test: `backend/tests/integration/rbacRealignmentAndUserUpdateSecurity.test.js`

**Interfaces:**
- Consumes: `backend/src/config/database.js` (`prisma`), `backend/src/constants/permissions.js`
- Produces:
  - `DEFAULT_GROUPS.QUAN_TRI_VIEN`: technical permissions only; excludes `RUBRIC_LOCK`, `DEFENSE_SCOREBOOK_RETURN`, `ARCHIVE_ACADEMIC_AFFAIRS_REVIEW`.
  - `DEFAULT_GROUPS.GIAO_VU`: preserves academic workflow review permissions.
  - Hardened `updateUser`: blocks self-role modification (`403`), blocks upgrade to `ADMIN` without `PERMISSION_ASSIGN_ACADEMIC` (`403`), blocks role change if target user has active workload (`400 CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD`), and synchronizes default groups atomically on role change.

- [ ] **Step 1: Write the failing integration tests in `backend/tests/integration/rbacRealignmentAndUserUpdateSecurity.test.js`**

Test cases:
1. Technical admin assigns `QUAN_TRI_VIEN` group to a technician user; verifies operation succeeds with `200 OK` (no 403 deadlock).
2. Admin attempts to change their own role via `PUT /api/users/:id`; fails with `403 FORBIDDEN` (`Không thể tự thay đổi vai trò của chính mình`).
3. User manager without `PERMISSION_ASSIGN_ACADEMIC` attempts to promote a user to `role: 'ADMIN'`; fails with `403 FORBIDDEN`.
4. Attempting to change the role of a student with an active `TopicRegistration` (`IN_PROGRESS` or `DEFENSE_READY`) or a lecturer actively mentoring topics; fails with `400 CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD`.
5. Authorized role change from `LECTURER` to `STUDENT` removes old `GVHD` group and assigns default student group atomically with an `AuditLog` entry.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- tests/integration/rbacRealignmentAndUserUpdateSecurity.test.js`
Expected: FAIL

- [ ] **Step 3: Update `backend/src/constants/permissions.js` and `backend/src/controllers/userController.js`**

Implement group permissions update and role alteration guards in `userController.updateUser`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- tests/integration/rbacRealignmentAndUserUpdateSecurity.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/constants/permissions.js backend/src/controllers/userController.js backend/tests/integration/rbacRealignmentAndUserUpdateSecurity.test.js
git commit -m "fix(security): realign QUAN_TRI_VIEN permissions and harden updateUser against role escalation"
```

---

### Task 2: Lecturer Broadcast Endpoint & Ownership Exemption

**Files:**
- Modify: `backend/src/controllers/notificationController.js`
- Modify: `backend/src/routes/notificationRoutes.js`
- Modify: `backend/src/constants/authorizationExemptions.js`
- Test: `backend/tests/integration/lecturerBroadcastNotification.test.js`

**Interfaces:**
- Consumes: `backend/src/config/database.js` (`prisma`)
- Produces:
  - `POST /api/notifications/lecturer-broadcast`: `notificationController.sendLecturerBroadcast`
  - Body: `{ subject?: string, content: string }`
  - Scoped to active semester active mentees (`TopicRegistration.topic.mentorId === req.user.id`); creates `Notification` rows atomically; returns `{ success: true, message: string, sentCount: number }`.

- [ ] **Step 1: Write the failing integration tests in `backend/tests/integration/lecturerBroadcastNotification.test.js`**

Test cases:
1. Lecturer calls `POST /api/notifications/lecturer-broadcast` with valid content; notifications are created for all active mentees in the active semester.
2. Lecturer with 0 active mentees calling the endpoint receives `400 NO_ACTIVE_STUDENTS`.
3. Unauthenticated request receives `401 UNAUTHORIZED`.
4. Route authorization coverage passes with `OWNERSHIP_GUARDED` exemption in `authorizationExemptions.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- tests/integration/lecturerBroadcastNotification.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `sendLecturerBroadcast` in `notificationController.js`, add route in `notificationRoutes.js`, and register exemption**

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- tests/integration/lecturerBroadcastNotification.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/notificationController.js backend/src/routes/notificationRoutes.js backend/src/constants/authorizationExemptions.js backend/tests/integration/lecturerBroadcastNotification.test.js
git commit -m "feat(notification): implement real semester-scoped lecturer broadcast endpoint"
```

---

### Task 3: Backend Student Dashboard Data Contract & Triage Metric Query Fix

**Files:**
- Modify: `backend/src/controllers/dashboardController.js`
- Test: `backend/tests/integration/dashboardTriageAndStudentData.test.js`

**Interfaces:**
- Consumes: `backend/src/config/database.js` (`prisma`)
- Produces:
  - `dashboardController.getStudentDashboard`: returns `{ registration, topic, tasks: Task[], meetingLogsCount: number, mentorScore: number | null, ... }`
  - `dashboardController.getAdminDashboard` / `getGeneralStats`: fixes `unassignedRegistrations` using `OR: [ { status: { in: ['APPROVED', 'BM01_PASSED', 'BM01_SUBMITTED'] }, councilId: null }, { status: { in: ['DEFENSE_READY', 'ELIGIBLE_BY_INSTITUTE'] }, defenseCouncilId: null } ]`.

- [ ] **Step 1: Write the failing integration tests in `backend/tests/integration/dashboardTriageAndStudentData.test.js`**

Test cases:
1. `getStudentDashboard` includes real `tasks` array, accurate `meetingLogsCount`, and `mentorScore` from `BM04Evaluation` (or null if unrated).
2. `getGeneralStats` correctly calculates `unassignedRegistrations` for students in `DEFENSE_READY` with `defenseCouncilId: null` even if they have an existing `councilId`.
3. `getSemesterOverview` reports zero triage fallback numbers when counts are legitimately 0.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- tests/integration/dashboardTriageAndStudentData.test.js`
Expected: FAIL

- [x] **Step 3: Update `backend/src/controllers/dashboardController.js`**

Implement real task/meeting inclusion in `getStudentDashboard` and correct the `unassignedRegistrations` OR-query.

- [x] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- tests/integration/dashboardTriageAndStudentData.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add backend/src/controllers/dashboardController.js backend/tests/integration/dashboardTriageAndStudentData.test.js
git commit -m "fix(dashboard): enrich student dashboard contract with real tasks and fix triage council count query"
```

---

### Task 4: Frontend Grading Defense BM05 PDF Connection & Broadcast Modal Integration

**Files:**
- Modify: `frontend/src/services/notificationService.js`
- Modify: `frontend/src/pages/admin/GradingDefensePage.jsx`
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Test: `frontend/src/pages/__tests__/fakeActionsRemediation.test.js`

**Interfaces:**
- Consumes: `notificationService.sendLecturerBroadcast`, `evaluationService.exportScoreSheetPdf`
- Produces:
  - `GradingDefensePage.jsx`: "In Biên Bản BM05" button calls `evaluationService.exportScoreSheetPdf` and triggers real PDF opening/download; removes mock toast at line 1167.
  - `LecturerDashboardPage.jsx`: Broadcast modal calls `notificationService.sendLecturerBroadcast`; eliminates `setTimeout`.

- [x] **Step 1: Write the failing frontend unit tests in `frontend/src/pages/__tests__/fakeActionsRemediation.test.js`**

Test cases:
1. Clicking "In Biên Bản BM05" invokes `evaluationService.exportScoreSheetPdf(registrationId)` and opens the returned `fileUrl`.
2. Submitting lecturer broadcast calls `notificationService.sendLecturerBroadcast` with payload `{ subject, content }` and updates UI with the response.
3. No `setTimeout` mocks exist in `LecturerDashboardPage.jsx` or `GradingDefensePage.jsx`.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/fakeActionsRemediation.test.js`
Expected: FAIL

- [x] **Step 3: Update `frontend/src/services/notificationService.js`, `GradingDefensePage.jsx`, and `LecturerDashboardPage.jsx`**

- [x] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/fakeActionsRemediation.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/services/notificationService.js frontend/src/pages/admin/GradingDefensePage.jsx frontend/src/pages/lecturer/LecturerDashboardPage.jsx frontend/src/pages/__tests__/fakeActionsRemediation.test.js
git commit -m "fix(ui): connect real BM05 PDF export and real lecturer broadcast API"
```

---

### Task 5: Frontend Real Tasks & Full Fallback Metric Cleanup

**Files:**
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx`
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
- Modify: `frontend/src/pages/admin/DashboardPage.jsx`
- Modify: `frontend/src/pages/common/HomePage.jsx`
- Test: `frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`

**Interfaces:**
- Consumes: `dashboardData.tasks`, `dashboardData.meetingLogsCount`, `dashboardData.mentorScore`
- Produces:
  - `StudentDashboardPage.jsx`: renders real tasks from backend contract; shows `<Empty />` when 0 tasks; removes hardcoded HTML tasks; removes `'18 / 20h'` and displays actual meeting count; removes fallback `'8.8 / 10'`; removes fallback `'PGS.TS Lê Quang Dũng'`; removes fallback `65%` progress.
  - `ProgressTrackingPage.jsx`: removes `?? 75%` and `(sPassed ? 8 : 4)`; displays actual count or 0.
  - `DashboardPage.jsx`: removes fake score distribution fallback percentages and fake triage numbers (`14`, `4`, `2`).
  - `HomePage.jsx`: removes `?? 4` mentored topics fallback.

- [x] **Step 1: Write the failing tests in `frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`**

Test cases:
1. `StudentDashboardPage` renders real tasks from `tasks` prop, showing empty state when tasks array is empty, and contains zero occurrences of `"18 / 20h"`, `"8.8 / 10"`, or `"PGS.TS Lê Quang Dũng"`.
2. `ProgressTrackingPage` does not fallback progress percent to 75% or lab meetings to 8/4.
3. `DashboardPage` does not render fake distribution bars when `scoreDistribution` is empty.
4. `HomePage` does not fallback lecturer topics count to 4.

- [x] **Step 2: Run test to verify it fails**

Run: `node --test frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`
Expected: FAIL

- [x] **Step 3: Update `StudentDashboardPage.jsx`, `ProgressTrackingPage.jsx`, `DashboardPage.jsx`, and `HomePage.jsx`**

- [x] **Step 4: Run test to verify it passes**

Run: `node --test frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add frontend/src/pages/student/StudentDashboardPage.jsx frontend/src/pages/lecturer/ProgressTrackingPage.jsx frontend/src/pages/admin/DashboardPage.jsx frontend/src/pages/common/HomePage.jsx frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js
git commit -m "fix(ui): eliminate all fabricated metrics, hardcoded strings, and wire real student tasks"
```

---

### Task 6: Package 1 Full Regression Verification & Build Validation

**Files:**
- Create: `backend/tests/integration/package1FullRegression.test.js`
- Test: Full backend and frontend test suites

**Interfaces:**
- Consumes: All updated endpoints and components across Tasks 1–5
- Produces:
  - Comprehensive integration regression suite verifying RBAC non-escalation, role alteration locks, lecturer broadcast delivery, dashboard triage calculations, and frontend clean contracts.

- [x] **Step 1: Write `backend/tests/integration/package1FullRegression.test.js`**

Executes complete end-to-end verification covering all 5 Review Focus items:
1. Technical admin assigns `QUAN_TRI_VIEN` without 403 error.
2. Self-role change and unauthorized upgrade to `ADMIN` are blocked with 403.
3. Active student/mentor role change is blocked with 400.
4. Lecturer broadcast delivers in-app notifications only to active mentees of the active semester.
5. Admin triage metric `unassignedRegistrations` accurately counts `DEFENSE_READY` students lacking `defenseCouncilId`.

- [x] **Step 2: Run the full regression test suite**

Run: `npm --prefix backend test -- tests/integration/package1FullRegression.test.js`
Expected: PASS (100%)

- [x] **Step 3: Run full backend tests, frontend tests, and production build**

Run:
- `npm --prefix backend test`
- `npm --prefix frontend test -- --run`
- `npm --prefix frontend run build`

Expected: 100% test pass rate across all suites, 0 build errors.

- [x] **Step 4: Commit**

```bash
git add backend/tests/integration/package1FullRegression.test.js
git commit -m "test(regression): add full Package 1 security and fake data regression suite"
```

