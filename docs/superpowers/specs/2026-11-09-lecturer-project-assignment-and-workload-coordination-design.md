# Lecturer Project Assignment and Workload Coordination Hub Design

**Date:** 2026-11-09

## Intent

Establish an authoritative, period-bound lecturer assignment model (`LecturerProjectAssignment`) and unified academic coordination hub ("Phương án 1+") that eliminates untracked global faculty availability. Ensure strict academic capacity enforcement across overlapping project periods using an interval sweep algorithm to guarantee that a mentor's peak concurrent workload never exceeds 10 students at any point in time.

## Goals

1. **Explicit Period Assignment**: Require lecturers to have an active `LecturerProjectAssignment` in a period before proposing topics or receiving student supervision assignments for that period.
2. **Planned Quota Hard-Reservation**: Ensure that a lecturer's planned quota (`plannedQuota`) in any round reserves capacity such that total planned capacity across concurrent periods never exceeds 10.
3. **Peak Overlap Workload Enforcement**: Calculate real-time peak concurrent student workload across intersecting periods using a precise interval sweep algorithm (preventing false transitive summation errors like $A \cap B \neq \emptyset$ and $B \cap C \neq \emptyset$ causing false rejection in $A \cap C = \emptyset$).
4. **Strict Student Slot Occupancy**: Treat student slots as occupied from formal assignment until the period's official end date (`semester.endDate`); early thesis completion or defense does not free up mentor capacity early.
5. **Unified Coordination Hub ("Phương án 1+")**: Extend project coordination with deep-linked, tab-level RBAC tabs (`?tab=overview`, `?tab=students`, `?tab=lecturers`) allowing registrars and department chairs to operate in a shared context without cross-role interference.
6. **Descriptive Overload Diagnostics**: Return detailed, actionable error messages and UI indicators specifying exact conflicting periods and peak date windows when capacity limits are hit.

## Non-goals

- Do not alter student profile fields or student graduation restriction rules.
- Do not remove existing topic evaluation or defense grading workflows (BM01–BM05).
- Do not automate cross-department lecturer reassignments without administrator/dean authorization.

## Anti-goals

- **No simple-summing of all intersecting periods**: Summing total students of all periods having any intersection with a target period causes false capacity rejections and must not be used.
- **No unassigned topic floating**: Lecturers must not be able to create or publish topics in periods where they lack an active assignment.
- **No early quota release**: Defending early or submitting BM04 must not free up slots before the period officially closes.

## Constraints

- Maximum concurrent supervision per mentor: 10 students across all active/overlapping periods (Rule 1 of `AGENTS.md`).
- Exactly 1 student per topic (`maxStudents = 1`).
- All code, migrations, and documentation must adhere to UTF-8 (no BOM).
- Prisma schema migrations must preserve existing production data integrity.

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

### 1. Data Model (`LecturerProjectAssignment`)

Add the `LecturerProjectAssignment` model and status enum to `backend/prisma/schema.prisma`:

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

Update `User` and `Semester` relations accordingly:
- `User.lecturerProjectAssignments`: `LecturerProjectAssignment[]` (relation `"LecturerAssignments"`)
- `User.createdLecturerAssignments`: `LecturerProjectAssignment[]` (relation `"AssignedByLecturerAssignments"`)
- `Semester.lecturerAssignments`: `LecturerProjectAssignment[]`

---

### 2. Workload & Interval Sweep Algorithm

#### Workload Occupancy Interval
For each active student under mentor $L$ in round $S$:
- Start timestamp: $t_{start} = \text{registration.createdAt}$ (or $S.startDate$ if earlier).
- End timestamp: $t_{end} = S.endDate$.
- Active statuses: All non-terminal statuses (`PENDING`, `APPROVED`, `IN_PROGRESS`, `BM01_*`, `BM02_*`, `BM03_*`, `BM04_*`, `DEFENSE_*`, `AWAITING_*`, `COMPLETED`, `DEFENDED`).
- Inactive/Released statuses: Only `REJECTED`, `DROPPED`, `WITHDRAWN`, `TERMINATED_*`.

#### Algorithm: `calculateMentorPeakWorkload(lecturerId, candidateInterval, options)`
1. Retrieve candidate round date interval: $[T_{start}^{new}, T_{end}^{new}]$.
2. Find all semesters overlapping with $[T_{start}^{new}, T_{end}^{new}]$:
   $$\{ S \mid S.startDate \le T_{end}^{new} \land S.endDate \ge T_{start}^{new} \}$$
3. Fetch all active student registrations under $L$ across those overlapping semesters.
4. Construct event points on the timeline:
   - For each student $i$ in interval $[t_{start}^i, t_{end}^i]$:
     - Event $+1$ at $t_{start}^i$
     - Event $-1$ at $t_{end}^i + 1\text{ms}$
   - If evaluating a new candidate student: Event $+1$ at $T_{start}^{new}$, Event $-1$ at $T_{end}^{new} + 1\text{ms}$.
5. Sort event points chronologically (if timestamps match, positive events occur before negative events).
6. Sweep through timeline: maintain `currentLoad`, record `peakLoad`, and track the critical date window $[T_{peak\_start}, T_{peak\_end}]$ and the names of conflicting periods.
7. Return:
   - `peakLoad`: Highest concurrent student count.
   - `currentLoad`: Active load at `Date.now()`.
   - `peakInterval`: `{ start: Date, end: Date, semesterNames: string[] }`.
   - `isExceeded`: `peakLoad > 10`.

#### Hard Reservation on Planned Quota
When an administrator creates or updates a `LecturerProjectAssignment`:
- Sum of `plannedQuota` for active assignments of lecturer $L$ across any overlapping time slice must not exceed 10.
- If $\sum \text{plannedQuota} > 10$, reject assignment creation with an informative message indicating conflicting rounds.

#### Dual Assignment Validation Rule
When assigning a student to mentor $L$ in round $S$:
1. **Round Quota Check**: Mentor's student count in $S$ must be strictly less than $L$'s `plannedQuota` for round $S$.
2. **Concurrent Peak Check**: Adding the student must not cause the peak concurrent workload across all overlapping rounds to exceed 10.
3. If violated, return HTTP 400 with format:
   > `"Không thể phân công sinh viên cho {lecturerName}. Trong khoảng {DD/MM}–{DD/MM}, giảng viên đã đạt tải tối đa {peakLoad}/10 sinh viên từ các đợt {Round 1} và {Round 2}."`

---

### 3. Hard-Gate Workflow Integration

1. **Lecturer Topic Creation ([`topicController.js`](file:///d:/DACN/backend/src/controllers/topicController.js))**:
   - When a lecturer proposes/creates a topic for `semesterId`, query `LecturerProjectAssignment`:
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
   - When registering for a topic or proposing a custom topic with `mentorId` in `semesterId`:
   - Validate that `mentorId` has an `ACTIVE` assignment in that `semesterId` and matching `projectCatalogId`.
   - Execute `calculateMentorPeakWorkload` in the transaction before creating `TopicRegistration`.
3. **Public Faculty Directory & Dropdowns**:
   - `GET /api/topics/mentors?semesterId=...&projectCatalogId=...`: Filter to only return lecturers who hold an `ACTIVE` `LecturerProjectAssignment` for that semester.

---

### 4. UI Architecture ("Phương án 1+")

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

### 5. What's Left to the Builder

- Exact Prisma migration script generation and index tuning.
- Excel column normalization utility for the lecturer import template.
- Frontend Ant Design table column rendering and color threshold logic for load bars ($<70\%$ green, $70-90\%$ amber, $100\%$ red).
- Unit and integration tests covering the sweep-line algorithm edge cases (matching endpoints, disjoint periods, adjacent periods).
