# NEXT_STEPS.md

## Mục tiêu phiên tiếp theo

Hoàn thiện workflow nghiệp vụ trước, sau đó mới mở rộng chức năng và polish giao diện.

---

## Execution Order (workflow-first)

### Phase 1 - Chốt workflow core

1. Semester -> Topic -> TopicRegistration:
   - Xác nhận contract API và status flow ở từng bước.
2. TopicRegistration -> Task/Submission/Milestone:
   - Xác nhận điều kiện tạo task, nộp bài, cập nhật trạng thái.
3. TopicRegistration -> Council -> DefenseResult:
   - Xác nhận phân hội đồng, gỡ hội đồng, chấm điểm kết thúc.
4. Notification:
   - Xác nhận trigger thông báo theo các hành động workflow chính.

### Phase 2 - Hoàn thiện chức năng theo role

- STUDENT:
  - đăng ký đề tài
  - theo dõi task/milestone
  - nộp bài
  - xem kết quả bảo vệ
- LECTURER:
  - duyệt đăng ký
  - giao task
  - feedback/chấm
- ADMIN:
  - quản lý đợt
  - giám sát
  - phân hội đồng
  - điều phối thông báo

### Phase 3 - Giao diện/UX

- Chạy polish UI sau khi Phase 1 + Phase 2 ổn định.
- Ưu tiên loading/error/empty state và sự rõ ràng thao tác.

---

## Việc cần làm ngay

1. [Done] Map toàn bộ màn hình chính vào workflow canonical.
2. [Done] Chốt danh sách endpoint/field trạng thái cho từng bước workflow.
3. [Done] Dọn nốt hardcode/mock còn lại trên các màn admin/student/lecturer đang tiếp xúc trực tiếp workflow.
4. [Done] Cập nhật `PROJECT_STATE.md` sau mỗi batch hoàn thành theo phase.

---

## Workflow Contract Matrix (locked)

### Step 1 - Semester

- Endpoints:
  - `GET /api/semesters`
  - `GET /api/semesters/:id`
  - `POST /api/semesters` (ADMIN)
  - `PUT /api/semesters/:id` (ADMIN)
  - `DELETE /api/semesters/:id` (ADMIN)
- Core fields:
  - `id`, `name`, `startDate`, `registrationDeadline`, `defenseDate`, `endDate`, `status`
- Status enum:
  - `UPCOMING`, `REGISTRATION`, `ONGOING`, `DEFENSE`, `COMPLETED`
- Screens:
  - `ProjectPeriodPage`, `DashboardPage`, `CouncilAssignmentPage` (filter semester)

### Step 2 - Topic

- Endpoints:
  - `GET /api/topics`
  - `GET /api/topics/:id`
  - `POST /api/topics`
  - `PUT /api/topics/:id`
  - `DELETE /api/topics/:id`
  - `GET /api/topics/approvals`
  - `PATCH /api/topics/:id/status`
  - `GET /api/topics/mentor-capacity/:mentorId`
- Core fields:
  - `id`, `semesterId`, `title`, `description`, `proposedById`, `mentorId`, `maxStudents`, `status`, `rejectReason`
- Status enum:
  - `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`
- Screens:
  - `TopicListPage`, `TopicManagementPage` (admin/lecturer), `TopicApprovalPage`, `ProjectOversightPage`

### Step 3 - TopicRegistration

- Endpoints:
  - `GET /api/registrations/my` (STUDENT)
  - `GET /api/registrations` (ADMIN/LECTURER)
  - `POST /api/registrations` (STUDENT)
  - `PATCH /api/registrations/:id/approve` (ADMIN/LECTURER)
  - `DELETE /api/registrations/:id` (STUDENT)
- Core fields:
  - `id`, `topicId`, `studentId`, `semesterId`, `status`, `rejectReason`, `councilId`
- Status enum:
  - `PENDING`, `APPROVED`, `REJECTED`, `IN_PROGRESS`, `SUBMITTED`, `DEFENDED`, `COMPLETED`
- Screens:
  - `StudentDashboardPage`, `ProgressTrackingPage`, `ProjectOversightPage`, `CouncilAssignmentPage`

### Step 4 - Task / Submission / Milestone

- Endpoints:
  - `POST /api/tasks` (LECTURER/ADMIN)
  - `GET /api/tasks/registration/:id`
  - `POST /api/tasks/:id/submit` (STUDENT)
  - `POST /api/tasks/submission/:id/grade` (LECTURER/ADMIN)
- Core fields:
  - Task: `id`, `registrationId`, `title`, `content`, `dueDate`, `status`
  - Submission: `id`, `taskId`, `registrationId`, `submittedBy`, `fileUrl`, `fileName`, `feedback`, `submittedAt`
  - Milestone: `id`, `registrationId`, `title`, `dueDate`, `status`
- Status enum:
  - Task: `OPEN`, `IN_PROGRESS`, `SUBMITTED`, `COMPLETED`, `OVERDUE`
  - Milestone: `PENDING`, `PASSED`, `FAILED`
- Screens:
  - `SubmissionPage`, `ProgressTrackingPage`, `LecturerDashboardPage`, `StudentDashboardPage`

### Step 5 - Council

- Endpoints:
  - `GET /api/councils`
  - `GET /api/councils/:id`
  - `POST /api/councils`
  - `PUT /api/councils/:id`
  - `DELETE /api/councils/:id`
  - `POST /api/councils/:id/assign`
  - `POST /api/councils/:id/remove-registration`
- Core fields:
  - Council: `id`, `semesterId`, `name`, `location`, `defenseDate`
  - Council member: `lecturerId`, `roleInCouncil`
  - Assignment key: `TopicRegistration.councilId`
- Role enum:
  - `CHAIRMAN`, `SECRETARY`, `REVIEWER`, `MEMBER`
- Screens:
  - `CouncilAssignmentPage`, `GradingDefensePage` (council tab)

### Step 6 - DefenseResult

- Endpoints:
  - `GET /api/evaluations/grading-students`
  - `POST /api/evaluations/defense-result`
  - `GET /api/evaluations/my-grades`
- Core fields:
  - `registrationId`, `finalScore`, `comments`, `scoresheetUrl`, `evaluatorId`
- Status dependency:
  - Ghi điểm/kết quả phải map ngược về `TopicRegistration.status` theo luồng bảo vệ.
- Screens:
  - `GradingPage`, `GradingDefensePage`, `GradeViewPage`

### Step 7 - Notification

- Endpoints:
  - `GET /api/notifications/history` (ADMIN)
  - `POST /api/notifications/broadcast` (ADMIN)
  - `GET /api/dashboard/activities` (dashboard-derived activity feed)
- Core fields:
  - `title`, `content`, `type`, `userId`, `isRead`, `createdAt`
  - Broadcast payload: `audience`, optional `councilId`
- Type enum:
  - `SYSTEM`, `TASK_REMINDER`, `APPROVAL`, `REGISTRATION`, `SUBMISSION`, `DEFENSE`
- Screens:
  - `NotificationCenterPage`, `NotificationsPage`, dashboard activity widgets

---

## Screen-to-Workflow Map (locked)

### Step 1: Semester

- `/admin/project-periods` -> `ProjectPeriodPage.jsx`
- `/admin/dashboard` (view metrics by semester) -> `DashboardPage.jsx`

### Step 2: Topic

- `/student/topics` -> `TopicListPage.jsx`
- `/lecturer/topics` -> `TopicManagementPage.jsx`
- `/lecturer/approvals` -> `TopicApprovalPage.jsx`
- `/admin/topics` -> `TopicManagementPage.jsx`
- `/admin/oversight` (topic-level intervention) -> `ProjectOversightPage.jsx`

### Step 3: TopicRegistration

- `/student/dashboard` (registration status) -> `StudentDashboardPage.jsx`
- `/lecturer/progress` (registrations list/progress) -> `ProgressTrackingPage.jsx`
- `/admin/oversight` (registration-linked topic supervision) -> `ProjectOversightPage.jsx`

### Step 4: Task / Submission / Milestone

- `/student/submissions` -> `SubmissionPage.jsx`
- `/lecturer/progress` -> `ProgressTrackingPage.jsx`
- `/lecturer/dashboard` (pending submissions, upcoming tasks) -> `LecturerDashboardPage.jsx`
- `/student/dashboard` (task progress + upcoming deadlines) -> `StudentDashboardPage.jsx`

### Step 5: Council

- `/admin/councils` -> `CouncilAssignmentPage.jsx`
- `/admin/grading` (council management tab) -> `GradingDefensePage.jsx`

### Step 6: DefenseResult

- `/lecturer/grading` -> `GradingPage.jsx`
- `/admin/grading` -> `GradingDefensePage.jsx`
- `/student/grades` -> `GradeViewPage.jsx`

### Step 7: Notification

- `/admin/notifications` -> `NotificationCenterPage.jsx`
- `/lecturer/notifications` -> `NotificationsPage.jsx`
- `/student/notifications` -> `NotificationsPage.jsx`

### Cross-cutting (not a workflow step)

- `/admin/users` -> `UserManagementPage.jsx`
- `/admin/dashboard` -> system overview (multiple workflow steps)
- `/lecturer/dashboard` -> role overview (multiple workflow steps)
- `/student/dashboard` -> role overview (multiple workflow steps)
- `/admin|lecturer|student/profile` -> `ProfilePage.jsx`

---

## Không ưu tiên lúc này

- Mở feature mới lớn ngoài workflow canonical.
- Polish UI nặng khi contract/data flow chưa ổn định.
- Re-introduce `group/groupMember/evaluation` vào nghiệp vụ chính.

---

## Update 2026-03-31 - mock/hardcode cleanup batch

- `admin/GradingDefensePage` moved from mock table to real evaluation API:
  - read: `GET /api/evaluations/grading-students`
  - write: `POST /api/evaluations/defense-result`
  - scoresheet upload now uses real upload API.
- `common/NotificationsPage` moved from local static data to real notification API:
  - `GET /api/notifications/my`
  - `PATCH /api/notifications/:id/read`
  - `PATCH /api/notifications/read-all`
  - `DELETE /api/notifications/:id`
- `lecturer/GradingPage` scoresheet upload moved from mock upload to `uploadService`.

---

## Review checkpoint (final pass)

- Regression gate: pass (`node scripts/regression-check.js`).
- Runtime finding fixed:
  - `backend/src/controllers/taskController.js` notification type updated from invalid `EVALUATION` -> valid `SUBMISSION`.

### Next executable batch

1. Align `TOMORROW_PLAN.md` to workflow-first + contract-first baseline.
2. Start Phase 2 role-completion gaps:
   - admin grading export actions (Excel/PDF) still placeholder UI
   - notification templates still local/static (no backend template module)
3. Dedicated encoding-cleanup session (do not mix with feature scope).

---

## Update 2026-03-31 - post placeholder cleanup

### Da hoan thanh trong batch nay

1. Admin grading export action khong con placeholder:
   - Excel (CSV UTF-8) + PDF print flow.
2. Notification template module da dua ve backend contract:
   - list/update template qua API thay vi local static seed.
3. Regression gate da co UTF-8 pre-close check.

### Next executable batch

1. Rat soat toan bo text hien thi tieng Viet de khong mat dau (dedicated encoding/content polish session).
2. Can nhac bo sung backend export endpoint neu can file `.xlsx/.pdf` server-side thay vi client export.
3. Tiep tuc role-gap con lai khong thuoc placeholder (neu phat sinh tu UAT).

---

## Update 2026-04-01 — Full codebase audit

### Đã xác nhận hoàn thành

- **Admin pages mock data**: cả 4 trang (Dashboard, ProjectOversight, ProjectPeriod, NotificationCenter) đều dùng API thật. Không còn mock.
- **Service layer FE**: 12/12 services bám đúng `api.js` interceptor pattern, không còn lỗi `response.data`.
- **Backend dashboard**: 6 endpoints đầy đủ, không còn reference tới legacy model.

### Vấn đề phát hiện mới

1. **Encoding** (12+ chuỗi mất dấu): `notificationService.js`, `registrationService.js`, `topicService.js`, `notificationController.js`, `ProjectPeriodPage.jsx`.
2. **Switch đăng ký** trong `ProjectPeriodPage` không kết nối backend — cần thêm API endpoint.
3. **`ProjectPeriodPage`** thiếu field chọn status khi tạo/edit semester.
4. **`ProjectOversightPage`** thiếu filter theo semester.

### Next executable batch

1. Encoding cleanup (dedicated session).
2. Kết nối switch đăng ký với backend (cần quyết định schema: `Semester.registrationOpen` hay `SystemConfig`).
3. UX improvements cho ProjectPeriod + ProjectOversight.
4. Thiết lập test foundation.

---

## Update 2026-04-01 - executed batch

### Da xong

1. Encoding cleanup batch da hoan thanh cho nhom file uu tien.
2. `ProjectPeriodPage` da co field `status` khi tao/edit semester.
3. `ProjectOversightPage` da co filter theo semester.
4. Regression gate pass.

### Viec tiep theo

1. Quyet dinh schema cho switch "Cho phep dang ky" (semester field vs system config), sau do moi implement API toggle.
2. Bo sung test foundation (backend + frontend).
3. Tiep tuc cleanup encoding cac file con lai neu UAT phat hien chuoi moji.

---

## Update 2026-04-01 - after implementing option 1

### Da xong

1. Registration toggle da ket noi backend theo model `Semester.registrationOpen`.
2. Switch trong `ProjectPeriodPage` persist dung sau reload.

### Viec tiep theo

1. Chay migration tren moi truong dev/prod va seed/check du lieu cu.
2. Bo sung test cho endpoint toggle + UI interaction.

---

## Update 2026-04-01 - after toggle runtime incident

### Da xong
1. Fix su co `Unknown argument registrationOpen` bang generate + migrate.
2. Migration `20260401103000_add_semester_registration_open` da deploy thanh cong.

### Viec tiep theo ngay
1. Restart backend tren moi dev machine dang chay process cu.
2. Smoke test toggle tren `/admin/project-periods`:
   - bat/tat
   - refresh page
   - doi hoc ky va toggle lai
3. Bo sung checklist release cho Prisma schema changes.
