# Lecturer Project Assignment and Workload Coordination Hub Design

**Date:** 2026-11-09  
**Status:** Approved with revisions (Ready for Implementation Planning)

## Intent

Establish an authoritative, period-bound lecturer assignment model (`LecturerProjectAssignment`) and unified academic coordination hub ("Phương án 1+") that eliminates untracked global faculty availability. Ensure strict academic capacity enforcement across overlapping project periods using an interval sweep algorithm to guarantee that a mentor's peak concurrent workload never exceeds 10 students at any point in time.

## Goals

1. **Explicit Period Assignment**: Require lecturers to have an active `LecturerProjectAssignment` in a period before proposing topics or receiving student supervision assignments for that period.
2. **Planned Quota Hard-Reservation via Sweep-Line**: Ensure that a lecturer's planned quota (`plannedQuota`) in any round reserves capacity such that total planned capacity across concurrent periods never exceeds 10 at any point, validated via timeline sweep.
3. **Peak Overlap Workload Enforcement**: Calculate real-time peak concurrent student workload across intersecting periods using a precise interval sweep algorithm on half-open intervals $[startAt, endExclusive)$ (preventing false transitive summation errors like $A \cap B \neq \emptyset$ and $B \cap C \neq \emptyset$ causing false rejection in $A \cap C = \emptyset$).
4. **Dedicated Mentor Assignment Status**: Decouple slot occupancy from academic progress statuses (BM01–BM05, COMPLETED, DEFENDED). Maintain dedicated assignment lifecycle status (`ACTIVE | TRANSFERRED | CANCELLED`), where completed/defended students still occupy slots until `semester.endDate`.
5. **Exact Occupancy Formula**: Compute student occupancy interval as $[startAt, endExclusive)$ where:
   $$startAt = \max(semester.startDate, assignment.effectiveAt)$$
   $$endExclusive = semester.endDate$$
   Only valid transfer (`TRANSFERRED` ending at `transfer.effectiveAt`) or cancellation (`CANCELLED` ending at `cancelledAt`) releases capacity early.
6. **Concurrency & Race Condition Safety**: Execute workload checks and assignment creations inside database transactions with pessimistic locking (`SELECT ... FOR UPDATE`) to prevent concurrent race conditions (e.g. two concurrent requests seeing 9/10 and both committing to 11/10).
7. **Unified Coordination Hub ("Phương án 1+")**: Extend project coordination with deep-linked, tab-level RBAC tabs (`?tab=overview`, `?tab=students`, `?tab=lecturers`) allowing registrars and department chairs to operate in a shared context without cross-role interference.
8. **Descriptive Overload Diagnostics**: Return detailed, actionable error messages and UI indicators specifying exact conflicting periods and peak date windows when capacity limits are hit.

## Non-goals

- Do not alter student profile fields or student graduation restriction rules.
- Do not remove existing topic evaluation or defense grading workflows (BM01–BM05).
- Do not automate cross-department lecturer reassignments without administrator/dean authorization.

## Anti-goals

- **No simple-summing of all intersecting periods**: Summing total students or planned quotas of all periods having any intersection with a target period causes false capacity rejections and must not be used.
- **No unassigned topic floating**: Lecturers must not be able to create or publish topics in periods where they lack an active assignment.
- **No progress-based quota release**: Defending early or submitting BM04 must not free up slots before the period officially closes.
- **No millisecond offsets for boundary handling**: Do not use $+1\text{ms}$ hack; use clean half-open intervals $[startAt, endExclusive)$ with exit events processed before entry events at identical timestamps.

## Constraints

- **Quy tắc nghiệp vụ cốt lõi của hệ thống (Core Business Rule)**: Mỗi giảng viên hướng dẫn tối đa **10 sinh viên** tại bất kỳ thời điểm nào trên toàn hệ thống.
- Đúng 1 sinh viên / 1 đề tài (`maxStudents = 1`).
- Tất cả các file mã nguồn, di chuyển CSDL, và tài liệu phải tuân thủ chuẩn UTF-8 (no BOM).
- Prisma migration phải bảo toàn dữ liệu hiện có trong CSDL.

## Approaches Considered

### Approach 1: Integrated Dual-Tab in `ProjectEnrollmentPage`
Embed lecturer assignment as a second tab inside existing `ProjectEnrollmentPage.jsx`.
- *Trade-off*: Easy to add, but lacks period-level deep links, detailed overview dashboard, and granular tab-level RBAC.

### Approach 2: Separate Standalone Subsystem (`/admin/lecturer-assignments`)
Create a completely separate page and route for lecturer assignment.
- *Trade-off*: Clear role separation, but forces academic staff to switch between disjointed screens for students and lecturers in the same period, duplicating period selectors and filters.

### Approach 1+ (Chosen): Unified Project Round Coordination Hub
Upgrade `ProjectEnrollmentPage` into a unified Coordination Hub accessible both at `/admin/project-enrollments` and `/admin/project-rounds/:roundId/coordination`, featuring 3 deep-linked tabs (`overview`, `students`, `lecturers`) with tab-level RBAC guards.
- *Rationale*: Students and mentors belong to the same central entity (the project round). Placing them together provides immediate visibility into faculty-student supply and demand, shares Excel import workflows, maintains deep links for direct bookmarking, and enforces role boundaries via capability checks without UX fragmentation.

---

## Detailed Design & Architecture

### 1. Data Model Changes

#### A. Model `LecturerProjectAssignment`
Add the model and status enum to `backend/prisma/schema.prisma`:

```prisma
enum LecturerAssignmentStatus {
  DRAFT
  ACTIVE
  CLOSED
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

Update `User` and `Semester` relations:
- `User.lecturerProjectAssignments`: `LecturerProjectAssignment[]` (relation `"LecturerAssignments"`)
- `User.createdLecturerAssignments`: `LecturerProjectAssignment[]` (relation `"AssignedByLecturerAssignments"`)
- `Semester.lecturerAssignments`: `LecturerProjectAssignment[]`

#### B. Dedicated Mentor Assignment Status on `TopicRegistration`
To decouple slot occupancy from academic progress states (BM01–BM05, COMPLETED, DEFENDED), add dedicated assignment tracking fields to `TopicRegistration`:

```prisma
enum MentorAssignmentStatus {
  ACTIVE
  TRANSFERRED
  CANCELLED
}

// In model TopicRegistration:
model TopicRegistration {
  // ... existing fields ...
  assignmentStatus        MentorAssignmentStatus @default(ACTIVE) @map("assignment_status")
  effectiveAt             DateTime               @default(now()) @map("effective_at")
  cancelledAt             DateTime?              @map("cancelled_at")

  @@index([topicId, assignmentStatus])
  @@index([semesterId, assignmentStatus])
}
```

---

### 2. Workload & Interval Sweep Algorithms

All calculations operate strictly on half-open intervals:
$$[startAt, endExclusive)$$

#### A. Half-Open Interval Definition & Event Sorting Rules
1. For any interval $[T_{start}, T_{endExclusive})$, it includes all points $t$ such that $T_{start} \le t < T_{endExclusive}$.
2. In sweep-line algorithms on half-open intervals:
   - When timeline events have identical timestamps $t$:
     - **Exit events ($-W$) MUST be processed BEFORE entry events ($+W$)**.
   - **Advantage**: For adjacent periods $[T_1, T_2)$ and $[T_2, T_3)$, the previous period exits at $T_2$ and the new period enters at $T_2$. Because exit occurs first, at $t = T_2$ the running sum does not count both periods, eliminating false overlap without arbitrary millisecond offsets.

#### B. Student Slot Occupancy Interval
For each student assignment to mentor $L$ in round $S$:
- **Status `ACTIVE`**:
  $$startAt = \max(S.startDate, assignment.effectiveAt)$$
  $$endExclusive = S.endDate$$
  *(Note: Even if the student defends early or completes BM01-BM05, status remains `ACTIVE` and occupies capacity until $S.endDate$.)*
- **Status `TRANSFERRED`**:
  $$startAt = \max(S.startDate, assignment.effectiveAt)$$
  $$endExclusive = transfer.effectiveAt$$
  *(Capacity is released for the old mentor at the moment transfer becomes effective; new mentor picks up occupancy from $\max(S.startDate, transfer.effectiveAt)$ to $S.endDate$.)*
- **Status `CANCELLED`**:
  $$startAt = \max(S.startDate, assignment.effectiveAt)$$
  $$endExclusive = assignment.cancelledAt \text{ (or } assignment.updatedAt \text{)}$$

#### C. Algorithm 1: `validatePlannedQuotaCapacity(lecturerId, newAssignment)`
Validates that assigning a `plannedQuota` does not violate capacity at any point:
1. Fetch all `ACTIVE` and `DRAFT` `LecturerProjectAssignment` records for `lecturerId`.
2. Construct timeline events for each assignment $k$:
   - Interval: $[S_k.startDate, S_k.endDate)$ with weight $+k.plannedQuota$.
   - Event: `(time: Sk.startDate, type: 'ENTER', weight: +k.plannedQuota, round: Sk.name)`
   - Event: `(time: Sk.endDate, type: 'EXIT', weight: -k.plannedQuota, round: Sk.name)`
3. Add events for candidate `newAssignment`:
   - Event: `(time: Snew.startDate, type: 'ENTER', weight: +newPlannedQuota, round: Snew.name)`
   - Event: `(time: Snew.endDate, type: 'EXIT', weight: -newPlannedQuota, round: Snew.name)`
4. Sort events chronologically:
   - Primary: `time` ascending.
   - Secondary: if `time` matches, `EXIT` (type: -1) precedes `ENTER` (type: +1).
5. Sweep through timeline:
   - `runningPlannedQuota += event.weight`
   - If `runningPlannedQuota > 10`:
     - Calculate peak period and conflicting round names.
     - Return `{ valid: false, error: "Tổng chỉ tiêu dự kiến vượt mức tối đa 10...", peakQuota: runningPlannedQuota, interval: [start, end] }`.
6. Return `{ valid: true }`.

#### D. Algorithm 2: `calculateMentorPeakWorkload(lecturerId, candidateInterval, options)`
Calculates active and peak student load for mentor $L$:
1. Retrieve candidate round date interval: $[T_{start}^{new}, T_{endExclusive}^{new})$ where $T_{start}^{new} = \max(S_{new}.startDate, \text{now})$ and $T_{endExclusive}^{new} = S_{new}.endDate$.
2. Query overlapping semesters:
   $$\{ S \mid S.startDate < T_{endExclusive}^{new} \land S.endDate > T_{start}^{new} \}$$
3. Fetch all registrations under mentor $L$ with `assignmentStatus IN ['ACTIVE', 'TRANSFERRED', 'CANCELLED']` whose interval overlaps with the window.
4. Construct event points on half-open timeline:
   - For each existing student $i$:
     - Event: `(time: startAt_i, type: 'ENTER', weight: +1, round: S_i.name)`
     - Event: `(time: endExclusive_i, type: 'EXIT', weight: -1, round: S_i.name)`
   - If testing a new candidate assignment:
     - Event: `(time: T_start_new, type: 'ENTER', weight: +1, round: S_new.name)`
     - Event: `(time: T_endExclusive_new, type: 'EXIT', weight: -1, round: S_new.name)`
5. Sort event points:
   - Primary: `time` ascending.
   - Secondary: `EXIT` before `ENTER`.
6. Sweep through timeline:
   - Maintain `currentLoad`, update `peakLoad`.
   - Track interval $[T_{peak\_start}, T_{peak\_end})$ and distinct semester names involved during peak.
7. Return:
   - `peakLoad`: Highest concurrent student count.
   - `currentLoad`: Load at current timestamp.
   - `peakInterval`: `{ start: Date, end: Date, semesterNames: string[] }`.
   - `isExceeded`: `peakLoad > 10`.

#### E. Dual Assignment Validation & Specific Overload Diagnostic Message
When assigning student $i$ to mentor $L$ in round $S$:
1. **Round Quota Check**:
   $$\text{Current students in } S < L.\text{plannedQuota for round } S$$
2. **Concurrent Peak Check**:
   $$\text{Peak concurrent load across all overlapping intervals} \le 10$$
3. **Diagnostic Error Message Format (When 11th student is added)**:
   > `"Việc phân công này sẽ làm tải của giảng viên tăng từ 10 lên 11 sinh viên trong khoảng {DD/MM}–{DD/MM} ({Đợt 1}, {Đợt 2}) nên không thể thực hiện."`
   *(Or in batch cases: `"Việc phân công này sẽ làm tải của giảng viên tăng từ {currentPeak} lên {projectedPeak} sinh viên (vượt quá giới hạn tối đa 10) trong khoảng {DD/MM}–{DD/MM} ({danh sách các đợt}) nên không thể thực hiện."`)*

---

### 3. Concurrency Control & Race Condition Prevention

To prevent race conditions where two concurrent requests both observe current load 9/10 and simultaneously assign students, leading to an invalid 11/10 peak:

1. **Transactional Serialization**:
   - Workload verification and registration/assignment creation MUST run inside a single interactive Prisma transaction: `prisma.$transaction(async (tx) => { ... })`.
2. **Pessimistic Row-Level Lock**:
   - Before executing the sweep-line algorithm inside `tx`, acquire a row-level write lock (`FOR UPDATE`) on the lecturer's assignment record or lecturer user record:
     ```javascript
     await tx.$queryRaw`
       SELECT id FROM lecturer_project_assignments 
       WHERE lecturer_id = ${lecturerId} AND semester_id = ${semesterId} 
       FOR UPDATE
     `;
     ```
   - This ensures concurrent assignments for the same lecturer wait in queue, forcing the second transaction to read the freshly committed 10/10 state and immediately abort with the overload error message.

---

### 4. Hard-Gate Workflow Integration

1. **Lecturer Topic Creation ([`topicController.js`](file:///d:/DACN/backend/src/controllers/topicController.js))**:
   - Query `LecturerProjectAssignment`:
     ```javascript
     const assignment = await prisma.lecturerProjectAssignment.findFirst({
       where: { lecturerId: userId, semesterId: semesterIdInt, status: 'ACTIVE' }
     });
     if (!assignment) {
       return res.status(403).json({
         success: false,
         message: 'Bạn chưa được phân công nhiệm vụ hướng dẫn trong đợt đồ án này.'
       });
     }
     ```
2. **Student Topic Registration & Proposal ([`registrationController.js`](file:///d:/DACN/backend/src/controllers/registrationController.js))**:
   - Validate mentor assignment status is `ACTIVE` in that `semesterId` and `projectCatalogId`.
   - Acquire pessimistic lock and execute `calculateMentorPeakWorkload(mentorId, candidateInterval)` inside transaction.
3. **Public Faculty Directory & Dropdowns**:
   - `GET /api/topics/mentors?semesterId=...&projectCatalogId=...`: Filter to only return lecturers who hold an `ACTIVE` `LecturerProjectAssignment` for that semester.

---

### 5. UI Architecture ("Phương án 1+")

#### Route & Deep-Linking
- Primary Hub Route: `/admin/project-enrollments` (alias `/admin/project-rounds/:roundId/coordination`).
- Query parameters: `?tab=overview | students | lecturers`, `&semesterId=...`, `&projectCatalogId=...`.

#### Tab 1: Tổng quan đợt (Overview)
- Period metadata card: Start/End date, Academic year, Project Catalog badge, Enrollment window status.
- Key Metrics Grid:
  - Total Enrolled Students vs Assigned Students.
  - Total Assigned Lecturers vs Total Planned Slots.
  - Overall Period Capacity Utilization (e.g., 42/50 students, 84%).
  - Overload Alerts banner (flagging any lecturer approaching or at 10/10 peak concurrent load).

#### Tab 2: Sinh viên (Students)
- Conserves existing `StudentProjectEnrollment` features:
  - Excel Import & Batch Assignment.
  - Filter by enrollment status & topic registration state.
  - Quick modal to assign/transfer mentor.
- Guarded by capability `ENROLLMENT_MANAGE` / `VIEW_PROJECT_ENROLLMENTS`.

#### Tab 3: Giảng viên (Lecturers)
- Table of `LecturerProjectAssignment` in selected period:
  - Lecturer Name & Code, Academic Title, Department.
  - Planned Quota (`plannedQuota`, inline editable if authorized).
  - Current Round Load: `current / plannedQuota` (e.g. `6/6`).
  - Concurrent Active Load: `activeToday / 10` (e.g. `8/10`).
  - Concurrent Peak Load: `peakLoad / 10` (e.g. `10/10`).
  - Critical Peak Window badge (e.g. `15/05 – 30/06` in amber tag if peak $\ge 8$).
  - Actions: Edit Quota, Close Assignment, Remove.
- Toolbar actions:
  - Button "+ Phân công Giảng viên": Single lecturer assignment modal.
  - Button "Import Excel GVHD": Upload Excel with columns: `Mã GV (*)`, `Họ và tên`, `Email`, `Chỉ tiêu (*)`, `Trạng thái`.
  - Button "Sao chép phân công từ kỳ trước": Fast replication of faculty assignments.
- Guarded by capability `PERMISSION_ASSIGN_ACADEMIC` or `PROJECT_PERIOD_MANAGE` (accessible to Deans, Academic Directors, and Admin).

---

### 6. What's Left to the Builder

- Exact Prisma migration script generation and index tuning.
- Excel column normalization utility for the lecturer import template.
- Frontend Ant Design table column rendering and color threshold logic for load bars ($<70\%$ green, $70-90\%$ amber, $100\%$ red).
- Unit and integration tests covering the sweep-line algorithm edge cases (matching endpoints, disjoint periods, adjacent half-open periods, concurrency lock simulation).
