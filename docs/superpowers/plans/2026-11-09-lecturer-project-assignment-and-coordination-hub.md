# Lecturer Project Assignment and Coordination Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authoritative period-bound faculty assignments (`LecturerProjectAssignment`), peak concurrent workload validation using half-open interval sweep algorithms with transactional concurrency locking, and a unified 3-tab Project Coordination Hub ("Phương án 1+").

**Architecture:** The backend introduces `LecturerProjectAssignment` and explicit `MentorAssignmentStatus` tracking on `TopicRegistration` with interval sweep algorithms on $[startAt, endExclusive)$ half-open intervals. Capacity validation executes inside serialized Prisma transactions using row-level pessimistic locking (`FOR UPDATE`) to prevent race conditions. The frontend upgrades `ProjectEnrollmentPage.jsx` into a unified Coordination Hub (`/admin/project-enrollments` and `/admin/project-rounds/:roundId/coordination`) featuring tab-level RBAC for Overview, Students, and Lecturers.

**Tech Stack:** Node.js (Express), PostgreSQL, Prisma ORM, Jest, React, React Router, Vite, Ant Design.

**Spec:** `docs/superpowers/specs/2026-11-09-lecturer-project-assignment-and-workload-coordination-design.md`

## Global Constraints

- Quy tắc nghiệp vụ cốt lõi của hệ thống: Mỗi giảng viên hướng dẫn tối đa 10 sinh viên tại bất kỳ thời điểm nào trên toàn hệ thống.
- Đúng 1 sinh viên / 1 đề tài (`maxStudents = 1`).
- Tất cả các file mã nguồn, migration, và tài liệu phải tuân thủ UTF-8 (no BOM).
- Prisma migration phải bảo toàn dữ liệu hiện có trong CSDL (zero-downtime / non-destructive schema update).
- Mọi khoảng thời gian tính tải phải là khoảng nửa mở $[startAt, endExclusive)$ với sự kiện rời đi (`EXIT`) được xử lý trước sự kiện tham gia (`ENTER`) tại các mốc thời gian trùng nhau.
- Thông báo lỗi quá tải khi vượt quá 10 sinh viên phải tuân thủ định dạng chuẩn:
  `"Việc phân công này sẽ làm tải của giảng viên tăng từ 10 lên 11 sinh viên trong khoảng {DD/MM}–{DD/MM} ({Đợt 1}, {Đợt 2}) nên không thể thực hiện."`

## Review Focus

1. **Adjacent Periods Boundary:** When Round 1 ends at $T_2$ and Round 2 starts at $T_2$, sweep algorithm must process the EXIT event from Round 1 before the ENTER event from Round 2 so that a mentor with 10 students in each round does not falsely trigger overload at $T_2$.
2. **Mentor Transfer Mid-Round:** When a student is transferred from Mentor A to Mentor B at $T_{transfer}$, Mentor A's slot is released at $T_{transfer}$ while Mentor B's slot begins occupancy at $\max(S.startDate, T_{transfer})$ through $S.endDate$.
3. **Mid-Round Cancellation:** When a student registration is cancelled/withdrawn at $T_{cancel}$, the slot is released at $T_{cancel}$, retaining occupancy only for $[startAt, T_{cancel})$.
4. **Concurrent Assignment Serialization:** Two concurrent requests attempting to assign an 11th student to the same mentor must be serialized by database row locks so that one transaction succeeds (10/10) and the other fails with HTTP 400 and the exact diagnostic message.
5. **Topic Proposal Hard-Gate:** A lecturer attempting to create or propose a topic in a period where they do not possess an `ACTIVE` `LecturerProjectAssignment` must be blocked with HTTP 403.

---

### Task 1: Prisma Schema Migration & Domain Models

**Files:**
- Modify: `backend/prisma/schema.prisma:80-95,206-255,800-830`
- Test: `backend/tests/integration/schemaModels.test.js`

**Interfaces:**
- Consumes: Existing `Semester`, `User`, `ProjectCatalog`, `TopicRegistration` models.
- Produces: `LecturerProjectAssignment` model, `LecturerAssignmentStatus` (`DRAFT`, `ACTIVE`, `CLOSED`), `MentorAssignmentStatus` (`ACTIVE`, `TRANSFERRED`, `CANCELLED`), updated `TopicRegistration` fields (`assignmentStatus`, `effectiveAt`, `cancelledAt`).

- [ ] **Step 1: Write integration test verifying model definitions and query capabilities**

```javascript
// backend/tests/integration/schemaModels.test.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

describe('LecturerProjectAssignment Schema Models', () => {
  it('should support LecturerProjectAssignment CRUD and relations', async () => {
    expect(prisma.lecturerProjectAssignment).toBeDefined();
    expect(prisma.topicRegistration).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- backend/tests/integration/schemaModels.test.js`
Expected: FAIL with `prisma.lecturerProjectAssignment is undefined` or schema validation error.

- [ ] **Step 3: Update `backend/prisma/schema.prisma` and run migration**

Add `LecturerAssignmentStatus`, `LecturerProjectAssignment`, `MentorAssignmentStatus`, and relation fields to `User`, `Semester`, and `TopicRegistration`.

```prisma
enum LecturerAssignmentStatus {
  DRAFT
  ACTIVE
  CLOSED
}

enum MentorAssignmentStatus {
  ACTIVE
  TRANSFERRED
  CANCELLED
}

model LecturerProjectAssignment {
  id               Int                      @id @default(autoincrement())
  lecturerId       Int                      @map("lecturer_id")
  semesterId       Int                      @map("semester_id")
  projectCatalogId Int                      @map("project_catalog_id")
  plannedQuota     Int                      @default(10) @map("planned_quota")
  status           LecturerAssignmentStatus @default(ACTIVE)
  assignedAt       DateTime                 @default(now()) @map("assigned_at")
  assignedById     Int                      @map("assigned_by_id")
  createdAt        DateTime                 @default(now()) @map("created_at")
  updatedAt        DateTime                 @updatedAt @map("updated_at")

  lecturer         User                     @relation("LecturerAssignments", fields: [lecturerId], references: [id])
  semester         Semester                 @relation(fields: [semesterId], references: [id])
  projectCatalog   ProjectCatalog           @relation(fields: [projectCatalogId], references: [id])
  assignedBy       User                     @relation("AssignedByLecturerAssignments", fields: [assignedById], references: [id])

  @@unique([lecturerId, semesterId, projectCatalogId])
  @@index([semesterId, projectCatalogId, status])
  @@index([lecturerId, status])
  @@map("lecturer_project_assignments")
}
```

In `TopicRegistration`:
```prisma
  assignmentStatus        MentorAssignmentStatus @default(ACTIVE) @map("assignment_status")
  effectiveAt             DateTime               @default(now()) @map("effective_at")
  cancelledAt             DateTime?              @map("cancelled_at")
```

Execute: `npx prisma db push` inside `backend/` and re-generate Prisma Client: `npx prisma generate`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- backend/tests/integration/schemaModels.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/tests/integration/schemaModels.test.js
git commit -m "feat(db): add LecturerProjectAssignment model and MentorAssignmentStatus enum"
```

---

### Task 2: Workload Interval Sweep Algorithm & Unit Tests

**Files:**
- Create: `backend/src/utils/workloadSweep.js`
- Test: `backend/tests/utils/workloadSweep.test.js`

**Interfaces:**
- Consumes: Date intervals, planned quotas, student registration objects with `assignmentStatus`, `effectiveAt`, `cancelledAt`, and `semester.endDate`.
- Produces:
  - `validatePlannedQuotaSweep({ existingAssignments, newAssignment })`: returns `{ valid: boolean, peakQuota: number, conflictingRounds: string[], peakInterval: { start, end } }`
  - `calculateMentorPeakWorkload({ existingRegistrations, candidateInterval, now })`: returns `{ peakLoad: number, currentLoad: number, isExceeded: boolean, peakInterval: { start, end, semesterNames: string[] } }`
  - `formatWorkloadExceededMessage({ lecturerName, currentPeak, newPeak, peakStart, peakEnd, conflictingRounds })`: returns formatted Vietnamese diagnostic string.

- [ ] **Step 1: Write comprehensive failing unit tests for sweep-line logic and review focus edge cases**

Cover:
- Non-overlapping rounds (Round A Jan-Apr, Round C May-Aug: no false overlap).
- True overlapping rounds (Round A Jan-Jun 6 students, Round B May-Aug 4 students $\rightarrow$ peak in May-Jun is 10, 11th rejected).
- Adjacent periods $[T_1, T_2)$ and $[T_2, T_3)$ with matching boundary timestamps (EXIT processed before ENTER).
- Mid-round transfer and cancellation releasing slot at `effectiveAt`/`cancelledAt`.
- Diagnostic error message formatting matching spec copy.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- backend/tests/utils/workloadSweep.test.js`
Expected: FAIL with `Cannot find module '../src/utils/workloadSweep'`.

- [ ] **Step 3: Implement `backend/src/utils/workloadSweep.js`**

Implement:
1. `validatePlannedQuotaSweep` using chronological timeline events with weights `+plannedQuota` / `-plannedQuota` on half-open $[startDate, endDate)$.
2. `calculateMentorPeakWorkload` using student occupancy $[startAt, endExclusive)$ where:
   - $startAt = \max(semester.startDate, assignment.effectiveAt)$
   - $endExclusive = assignment.assignmentStatus === 'TRANSFERRED' ? transfer.effectiveAt : (assignment.assignmentStatus === 'CANCELLED' ? assignment.cancelledAt : semester.endDate)$.
   - Sort rule: `EXIT` (type -1) before `ENTER` (type +1) when timestamps match.
3. `formatWorkloadExceededMessage` formatting:
   `"Việc phân công này sẽ làm tải của giảng viên tăng từ ${currentPeak} lên ${newPeak} sinh viên trong khoảng ${dateStr} (${roundsStr}) nên không thể thực hiện."`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- backend/tests/utils/workloadSweep.test.js`
Expected: PASS with 100% assertions passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/workloadSweep.js backend/tests/utils/workloadSweep.test.js
git commit -m "feat(workload): implement half-open interval sweep algorithms and capacity validation"
```

---

### Task 3: Backend API for Lecturer Project Assignments

**Files:**
- Create: `backend/src/controllers/lecturerAssignmentController.js`
- Create: `backend/src/routes/lecturerAssignmentRoutes.js`
- Modify: `backend/src/routes/index.js:15-48`
- Test: `backend/tests/controllers/lecturerAssignmentController.test.js`

**Interfaces:**
- Consumes: `validatePlannedQuotaSweep`, `calculateMentorPeakWorkload`, Prisma `lecturerProjectAssignment` model.
- Produces:
  - `GET /api/lecturer-assignments?semesterId=...&projectCatalogId=...`
  - `POST /api/lecturer-assignments`
  - `PUT /api/lecturer-assignments/:id`
  - `DELETE /api/lecturer-assignments/:id`
  - `POST /api/lecturer-assignments/bulk-upsert`
  - `GET /api/lecturer-assignments/overview?semesterId=...&projectCatalogId=...`

- [ ] **Step 1: Write integration tests for lecturer assignment endpoints**

Verify:
- Listing assignments calculates `currentRoundLoad`, `activeTodayLoad`, `peakConcurrentLoad`, and `peakInterval`.
- Creating assignment exceeding 10 planned quota across overlapping rounds returns HTTP 400.
- Creating valid assignment returns HTTP 201.
- Updating assignment quota re-validates sweep-line capacity.
- Overview returns accurate capacity utilization and overload warning flags.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- backend/tests/controllers/lecturerAssignmentController.test.js`
Expected: FAIL with 404 Route Not Found.

- [ ] **Step 3: Implement controller, routes, and mount in router**

Implement `backend/src/controllers/lecturerAssignmentController.js`, `backend/src/routes/lecturerAssignmentRoutes.js`, and mount `router.use('/lecturer-assignments', lecturerAssignmentRoutes)` in `backend/src/routes/index.js`.
Authorize with `authorizePermission(PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC)` or `PERMISSIONS.MENTOR_ASSIGN`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- backend/tests/controllers/lecturerAssignmentController.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/lecturerAssignmentController.js backend/src/routes/lecturerAssignmentRoutes.js backend/src/routes/index.js backend/tests/controllers/lecturerAssignmentController.test.js
git commit -m "feat(api): add lecturer project assignment endpoints and round coordination overview"
```

---

### Task 4: Concurrency-Safe Student Assignment & Hard-Gate Guards

**Files:**
- Modify: `backend/src/controllers/topicController.js:80-140,250-280`
- Modify: `backend/src/controllers/registrationController.js:120-190,440-520`
- Test: `backend/tests/integration/workloadCapacityGuard.test.js`

**Interfaces:**
- Consumes: `calculateMentorPeakWorkload`, `formatWorkloadExceededMessage`, Prisma interactive transaction (`prisma.$transaction`), raw pessimistic lock (`FOR UPDATE`).
- Produces: Protected topic creation, protected mentor selection dropdown, serialized concurrent student registration/assignment with capacity check.

- [ ] **Step 1: Write concurrency and hard-gate integration tests**

Verify:
- Proposing topic without `ACTIVE` assignment in `semesterId` returns HTTP 403 Forbidden.
- `/api/topics/mentors` excludes lecturers without `ACTIVE` assignment in specified `semesterId`.
- Registering an 11th student triggers HTTP 400 with exact diagnostic error copy.
- Simulating two parallel transactions for the 10th and 11th student results in exactly 1 success and 1 rejection (serialized via `FOR UPDATE`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- backend/tests/integration/workloadCapacityGuard.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement hard-gates and pessimistic locking**

In `backend/src/controllers/topicController.js`:
- Guard `createTopic`: check `prisma.lecturerProjectAssignment.findFirst({ where: { lecturerId: userId, semesterId, status: 'ACTIVE' } })`. Return HTTP 403 if missing.
- Filter `getMentors`: filter by active assignments for the semester.

In `backend/src/controllers/registrationController.js`:
- Wrap topic registration / mentor assignment in `prisma.$transaction(async (tx) => { ... })`.
- Acquire pessimistic lock:
  ```javascript
  await tx.$queryRaw`
    SELECT id FROM lecturer_project_assignments 
    WHERE lecturer_id = ${mentorId} AND semester_id = ${semesterId} 
    FOR UPDATE
  `;
  ```
- Run `calculateMentorPeakWorkload(mentorId, candidateInterval)`.
- If peak exceeds 10 or current round exceeds `plannedQuota`, throw 400 with `formatWorkloadExceededMessage`.
- Record `assignmentStatus: 'ACTIVE'`, `effectiveAt: new Date()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- backend/tests/integration/workloadCapacityGuard.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/topicController.js backend/src/controllers/registrationController.js backend/tests/integration/workloadCapacityGuard.test.js
git commit -m "feat(guards): enforce active period assignment for topics and pessimistic locking for student capacity"
```

---

### Task 5: Frontend Unified Project Coordination Hub ("Phương án 1+")

**Files:**
- Create: `frontend/src/services/lecturerAssignmentService.js`
- Create: `frontend/src/components/coordination/LecturerAssignmentTab.jsx`
- Create: `frontend/src/components/coordination/CoordinationOverviewTab.jsx`
- Modify: `frontend/src/pages/ProjectEnrollmentPage.jsx`
- Modify: `frontend/src/routes/index.jsx`
- Test: `frontend/src/pages/__tests__/ProjectEnrollmentPage.test.jsx`

**Interfaces:**
- Consumes: Backend `/api/lecturer-assignments`, `/api/project-enrollments`, React Router `useSearchParams` / `useParams`.
- Produces: 3-tab UI (`?tab=overview | students | lecturers`) with tab-level RBAC, overload warning alerts, and lecturer planned quota management.

- [ ] **Step 1: Write frontend component tests**

Verify:
- Switching tabs updates URL search param `?tab=...` and renders appropriate tab content.
- Overview tab renders total enrolled vs assigned students, planned vs assigned lecturers, and overload alerts.
- Lecturer tab renders table with quota bars, current load, and peak load tags.
- Direct navigation to `/admin/project-rounds/:roundId/coordination?tab=lecturers` auto-selects round and lecturer tab.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- ProjectEnrollmentPage.test.jsx`
Expected: FAIL.

- [ ] **Step 3: Implement frontend components and routes**

1. Create `frontend/src/services/lecturerAssignmentService.js` with API calls: `getAll`, `create`, `update`, `deleteAssignment`, `getOverview`, `bulkUpsert`.
2. Create `CoordinationOverviewTab.jsx` and `LecturerAssignmentTab.jsx`.
3. Refactor `ProjectEnrollmentPage.jsx` into the unified Coordination Hub with Ant Design Tabs (`overview`, `students`, `lecturers`), deep-link synchronization, and tab-level permission checks.
4. Add alias route in `frontend/src/routes/index.jsx`: `/admin/project-rounds/:roundId/coordination`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- ProjectEnrollmentPage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/lecturerAssignmentService.js frontend/src/components/coordination/ frontend/src/pages/ProjectEnrollmentPage.jsx frontend/src/routes/index.jsx frontend/src/pages/__tests__/ProjectEnrollmentPage.test.jsx
git commit -m "feat(ui): upgrade ProjectEnrollmentPage to unified 3-tab Project Coordination Hub"
```

---

### Task 6: Full Regression Verification & Build Check

**Files:**
- Test: All backend and frontend test suites

**Interfaces:**
- Consumes: Whole codebase.
- Produces: Green test suites across backend and frontend, successful production build.

- [ ] **Step 1: Run full backend test suites**

Run: `npm --prefix backend test`
Expected: All 62+ test suites pass without regression.

- [ ] **Step 2: Run full frontend test suites**

Run: `npm --prefix frontend test`
Expected: All test suites pass.

- [ ] **Step 3: Run frontend production build**

Run: `npm --prefix frontend run build`
Expected: Vite build succeeds with exit code 0.

- [ ] **Step 4: Commit and finalize session documentation**

```bash
git commit --allow-empty -m "chore: verify full regression and build passes for lecturer coordination hub"
```
