# Kế Hoạch Triển Khai: Hồ Sơ Đồ Án & Phân Hệ Xét Duyệt Đề Cương (BM01)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng phân hệ Quản lý hồ sơ đồ án và Xét duyệt đề cương (BM01) chuẩn hóa, khép kín với cơ chế khóa nộp file nguyên tử (chỉ nộp 1 lần), thuật toán tự động phân công hội đồng gom cụm theo GVHD, quản lý batch kết quả append-only, và bảo vệ toàn vẹn dữ liệu chống cascading corruption khi Reopen.

**Architecture:** Mở rộng additive trên CSDL hiện hữu (`Semester`, `Council`, `BM01Evaluation`, `TopicRegistration`, `Task`, `Submission`) và bổ sung `CouncilResultBatch`. Tách bạch trạng thái nghiệp vụ khỏi `RegistrationStatus`, khóa nguyên tử lượt nộp qua Conditional Update trong transaction, và xử lý quá hạn nộp lại độc lập không gây side-effect trên GET.

**Tech Stack:** Node.js, Express, Prisma ORM, PostgreSQL (Supabase), React 19, Vite, Ant Design, Tailwind CSS, Jest.

**Spec:** [docs/superpowers/specs/2026-11-10-outline-review-dossier-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-10-outline-review-dossier-design.md)

---

## Global Constraints

- Tuân thủ quy chế 1 Sinh viên / 1 Đề tài (`TopicRegistration`, `maxStudents = 1`).
- Migration phải 100% additive: không xóa cột, không đổi tên trường cũ, `onDelete: Restrict` cho các quan hệ học vụ.
- Tuyệt đối Zero Mock Data: dữ liệu hiển thị trên toàn bộ UI phải liên kết với backend API thật.
- Chuẩn mã hóa: Tất cả các file (`.js`, `.jsx`, `.json`, `.prisma`, `.md`) phải lưu ở định dạng UTF-8 (no BOM).
- Triệt tiêu Side-Effect trên Read: Các endpoint GET tuyệt đối không làm thay đổi trạng thái trong CSDL.
- Khóa cứng số lần nộp: Đề cương v1 nộp đúng 1 lần; nộp lại sau xét duyệt nộp đúng 1 lần (`maxSubmissions = 1`) bằng Conditional Update (`WHERE ... IS NULL`) trong transaction.
- Thuật toán Reopen Append-Only: Batch cũ chuyển `SUPERSEDED`, batch mới có `versionNumber = prev + 1`, sao chép snapshot `BM01Evaluation` với `attemptNo = prev + 1`. Chặn mở khóa nếu đã có dữ liệu đơn BM02 (`409 BM02_DEPENDENCY_EXISTS`).
- Phân công tự động gom cụm theo GVHD: Sắp xếp sinh viên theo `mentorId` trước khi chia lô $\le 10$ SV/HĐ để triệt tiêu xung đột lợi ích.

---

## Review Focus

1. **Cạnh tranh nộp bài đồng thời (Race Condition)**: Hai request nộp file v1 hoặc nộp lại v2 gửi song song cho cùng một hồ sơ $\rightarrow$ chỉ duy nhất 1 request thành công, request còn lại bị rollback và nhận `409 INITIAL_SUBMISSION_ALREADY_USED` hoặc `409 RESUBMISSION_ALREADY_USED`.
2. **Công bố kết quả thiếu dữ liệu hoặc vi phạm validation**: Thư ký hoàn tất hoặc Chủ tịch công bố khi có sinh viên chưa đánh giá, hoặc `REVISION_REQUIRED` để trống `revisionRequirements` $\rightarrow$ bị chặn với lỗi `400 RESULT_LIST_INCOMPLETE` hoặc `400 REVISION_REQUIREMENTS_REQUIRED`.
3. **Mở khóa kết quả khi đã có dữ liệu BM02**: Admin gửi yêu cầu reopen cho hội đồng có sinh viên đã nộp/duyệt đơn BM02 $\rightarrow$ bị chặn ngay với `409 BM02_DEPENDENCY_EXISTS` kèm danh sách sinh viên gây chặn.
4. **Xung đột lợi ích khi tự động phân công**: GVHD hướng dẫn sinh viên trong lô được phân công $\rightarrow$ thuật toán tự động loại trừ GVHD khỏi hội đồng, chỉ chọn 3 giảng viên độc lập và cân bằng tải số lần tham gia hội đồng.
5. **Replay Idempotency Key**: Gửi lại request công bố hoặc nộp bài với cùng `Idempotency-Key` và cùng body $\rightarrow$ trả về kết quả đã lưu kèm `X-Cache-Lookup: HIT-IDEMPOTENT` mà không chạy lại transaction; nếu gửi cùng key nhưng payload khác $\rightarrow$ từ chối với `422 IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.

---

## Task Decomposition

### Task 1: CSDL & Prisma Migration Additive
**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261110050000_outline_review_dossier_foundation/migration.sql`
- Test: `backend/tests/integration/schemaPrismaValidate.test.js`

**Interfaces:**
- Produces:
  - `Semester`: `outlineSubmissionOpenAt DateTime?`, `outlineSubmissionDeadline DateTime?`, `outlineTemplateFileUrl String?`, `outlineTemplateFileId Int?`, `outlineAllowedExtensions Json`, `outlineMaxFileSizeBytes Int`.
  - `Council`: `meetingMode CouncilMeetingMode?`, `meetingUrl String?`, `schedulePublishedAt DateTime?`, `revisionSubmissionDeadline DateTime?`, `isActive Boolean`, `deletedAt DateTime?`, `rowVersion Int`.
  - `CouncilResultBatch`: Model mới lưu lô kết quả với quan hệ `onDelete: Restrict`.
  - `BM01Evaluation`: Thêm `councilId`, `batchId`, `initialOutcome`, `comment`, `revisionRequirements`, `revisionSubmissionId` (unique), `revisionApprovalStatus`, `revisionReviewedAt`, `revisionReviewedById`, `revisionFeedback`, và `@@unique([batchId, registrationId])`.
  - Enums: `CouncilMeetingMode`, `CouncilBatchStatus`, `OutlineInitialOutcome`, `OutlineRevisionApprovalStatus`, `TaskType.BM01_INITIAL_SUBMISSION`, `TaskType.BM01_RESUBMISSION`, `RegistrationStatus.BM01_RESUBMITTED`.

- [ ] **Step 1: Viết test kiểm tra hợp lệ Prisma Schema**
  Tạo test xác thực file schema và định nghĩa các model/enum mới mà không gây lỗi cú pháp.
- [ ] **Step 2: Chạy test để xác nhận fail**
  Chạy: `cd backend; npm test -- schemaPrismaValidate`
  Kỳ vọng: FAIL vì các model và enum mới chưa được khai báo.
- [ ] **Step 3: Cập nhật `schema.prisma` và tạo file migration SQL**
  Bổ sung các trường additive vào `schema.prisma` theo Mục 5.1 của bản đặc tả thiết kế, chạy `npx prisma generate`.
- [ ] **Step 4: Chạy lại test schema validation**
  Chạy: `cd backend; npx prisma validate; npm test -- schemaPrismaValidate`
  Kỳ vọng: PASS 100%.
- [ ] **Step 5: Commit Git**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations/ backend/tests/integration/schemaPrismaValidate.test.js
  git commit -m "feat(db): add additive schema models and enums for outline review dossier"
  ```

---

### Task 2: Thuật Toán Tự Động Phân Công Hội Đồng Gom Cụm Theo GVHD
**Files:**
- Create: `backend/src/services/outlineAutoSetupService.js`
- Test: `backend/tests/services/outlineAutoSetupService.test.js`

**Interfaces:**
- Produces:
  - `runAutoOutlineCouncilSetupForSemester(semesterId: number) -> Promise<{ createdCouncils: number, assignedStudents: number, skippedStudents: any[], warnings: string[] }>`
- Consumes:
  - `prisma.topicRegistration`, `prisma.council`, `prisma.councilMember`, `prisma.user`, `prisma.semester`.

- [ ] **Step 1: Viết failing test cho `outlineAutoSetupService`**
  Viết unit test kiểm thử:
  - Gom cụm sinh viên theo `topic.mentorId` trước khi chia lô $\le 10$ SV/HĐ.
  - Tự động tạo `Council` loại `OUTLINE_REVIEW`.
  - Loại trừ `excludedMentorIds` của lô và chọn 3 giảng viên độc lập (`CHAIRMAN`, `SECRETARY`, `MEMBER`).
  - Cân bằng tải giảng viên theo số hội đồng tham gia.
- [ ] **Step 2: Chạy test để xác nhận fail**
  Chạy: `cd backend; npm test -- outlineAutoSetupService.test.js`
  Kỳ vọng: FAIL with "Cannot find module outlineAutoSetupService".
- [ ] **Step 3: Triển khai thuật toán trong `backend/src/services/outlineAutoSetupService.js`**
  Thực hiện logic gom cụm, cắt lô 10 sinh viên, loại trừ GVHD và phân bổ vai trò giảng viên trong Prisma transaction.
- [ ] **Step 4: Chạy test kiểm thử dịch vụ**
  Chạy: `cd backend; npm test -- outlineAutoSetupService.test.js`
  Kỳ vọng: PASS.
- [ ] **Step 5: Commit Git**
  ```bash
  git add backend/src/services/outlineAutoSetupService.js backend/tests/services/outlineAutoSetupService.test.js
  git commit -m "feat(council): implement mentor-clustered auto-assignment service for outline review"
  ```

---

### Task 3: Dịch Vụ Nghiệp Vụ Xét Duyệt Đề Cương & Giao Dịch Nguyên Tử
**Files:**
- Create: `backend/src/services/outlineReviewService.js`
- Create: `backend/src/services/outlineSweepService.js`
- Test: `backend/tests/services/outlineReviewService.test.js`

**Interfaces:**
- Produces:
  - `submitInitialOutline(registrationId, fileData, userId) -> Promise<Submission>`
  - `publishCouncilSchedule(councilId, scheduleData, chairId) -> Promise<Council>`
  - `saveDraftResults(councilId, registrationId, resultData, actorId) -> Promise<BM01Evaluation>`
  - `completeSecretaryReview(councilId, actorId) -> Promise<CouncilResultBatch>`
  - `returnResultsToSecretary(councilId, returnReason, chairId) -> Promise<CouncilResultBatch>`
  - `publishCouncilResults(councilId, chairId, idempotencyKey) -> Promise<CouncilResultBatch>`
  - `setRevisionDeadline(councilId, deadline, chairId) -> Promise<Council>`
  - `submitResubmissionOutline(registrationId, fileData, userId) -> Promise<Submission>`
  - `reviewResubmission(councilId, registrationId, decision, revisionFeedback, chairId) -> Promise<TopicRegistration>`
  - `reopenCouncilResults(councilId, reason, adminId) -> Promise<CouncilResultBatch>`
  - `finalizeOverdueResubmissions(councilId, actorId) -> Promise<{ terminatedCount: number }>`
- Consumes:
  - `idempotencyService`, `registrationTransitionService`, `auditLogService`.

- [ ] **Step 1: Viết test cho các giao dịch nguyên tử trong `outlineReviewService`**
  Test các tình huống:
  - Conditional update nộp v1 và v2 (chặn nộp lần 2).
  - Validation matrix khi thư ký nhập điểm.
  - Chủ tịch công bố kết quả $\rightarrow$ sinh đơn BM02 cho `PASS`, chuyển `BM01_NEEDS_REVISION` cho `REVISION_REQUIRED/FAIL/ABSENT`.
  - Reopen: Chặn khi có đơn BM02 (`BM02_DEPENDENCY_EXISTS`), tạo batch mới version + 1 khi không có BM02.
  - Sweep quá hạn nộp lại $\rightarrow$ `TERMINATED_BM01`.
- [ ] **Step 2: Chạy test để xác nhận fail**
  Chạy: `cd backend; npm test -- outlineReviewService.test.js`
  Kỳ vọng: FAIL with "Cannot find module outlineReviewService".
- [ ] **Step 3: Triển khai `outlineReviewService.js` và `outlineSweepService.js`**
  Triển khai đầy đủ 10 hàm nghiệp vụ với conditional update, transaction và ma trận validation.
- [ ] **Step 4: Chạy lại test suite để xác nhận pass**
  Chạy: `cd backend; npm test -- outlineReviewService.test.js`
  Kỳ vọng: PASS 100%.
- [ ] **Step 5: Commit Git**
  ```bash
  git add backend/src/services/outlineReviewService.js backend/src/services/outlineSweepService.js backend/tests/services/outlineReviewService.test.js
  git commit -m "feat(outline): implement core review service with atomic updates and reopen guards"
  ```

---

### Task 4: API Controllers, Routes & Middleware Phân Quyền Resource
**Files:**
- Create: `backend/src/controllers/outlineController.js`
- Create: `backend/src/routes/outlineRoutes.js`
- Modify: `backend/src/routes/councilRoutes.js`
- Modify: `backend/src/controllers/councilController.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/integration/outlineRoutes.test.js`

**Interfaces:**
- Produces:
  - `POST /api/outline/submissions`
  - `POST /api/outline/resubmissions`
  - `GET /api/outline/my-outline`
  - `POST /api/councils/auto-assign-outline`
  - `PUT /api/councils/:id/results/:registrationId`
  - `POST /api/councils/:id/results/secretary-complete`
  - `POST /api/councils/:id/results/return`
  - `POST /api/councils/:id/results/publish`
  - `PUT /api/councils/:id/revision-deadline`
  - `POST /api/councils/:id/resubmissions/:registrationId/review`
  - `POST /api/councils/:id/results/reopen`
  - `POST /api/councils/:id/finalize-resubmissions`
- Consumes:
  - `outlineReviewService`, `outlineAutoSetupService`, `authMiddleware`, `requireCouncilRole`.

- [ ] **Step 1: Viết integration test cho các endpoint API đề cương**
  Viết test xác thực request payload, kiểm tra mã HTTP status (200, 400, 403, 409, 422), và phân quyền resource (chỉ `CHAIR` của hội đồng mới được công bố, chỉ sinh viên sở hữu mới được nộp bài).
- [ ] **Step 2: Chạy test để xác nhận fail**
  Chạy: `cd backend; npm test -- outlineRoutes.test.js`
  Kỳ vọng: FAIL với 404 Route Not Found.
- [ ] **Step 3: Triển khai controller, router và tích hợp vào `app.js`**
  Viết `outlineController.js`, `outlineRoutes.js`, kết nối vào router hội đồng `councilRoutes.js` và `app.js`.
- [ ] **Step 4: Chạy test integration xác nhận pass**
  Chạy: `cd backend; npm test -- outlineRoutes.test.js`
  Kỳ vọng: PASS 100%.
- [ ] **Step 5: Commit Git**
  ```bash
  git add backend/src/controllers/outlineController.js backend/src/routes/outlineRoutes.js backend/src/routes/councilRoutes.js backend/src/controllers/councilController.js backend/src/app.js backend/tests/integration/outlineRoutes.test.js
  git commit -m "feat(api): expose outline review and council auto-assignment endpoints"
  ```

---

### Task 5: Cổng Sinh Viên - Giao Diện Nộp & Theo Dõi Đề Cương
**Files:**
- Create: `frontend/src/services/outlineService.js`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx`
- Test: `frontend/src/pages/student/__tests__/SubmissionPage.test.jsx`

**Interfaces:**
- Produces:
  - Form nộp đề cương v1 (không phụ thuộc vào việc đã xếp hội đồng hay chưa).
  - Khóa vĩnh viễn nút nộp sau lần upload thành công đầu tiên.
  - Card thông tin lịch bảo vệ đề cương (địa điểm trực tiếp / liên kết Teams).
  - Card hiển thị kết quả ban đầu, nhận xét của Hội đồng và yêu cầu chỉnh sửa.
  - Form nộp lại duy nhất với cờ cảnh báo trễ hạn `isOverdue` và khóa sau khi nộp.
- Consumes:
  - `outlineService.submitInitialOutline`, `outlineService.submitResubmission`, `outlineService.getMyOutline`.

- [ ] **Step 1: Viết component test cho `SubmissionPage`**
  Viết test kiểm tra:
  - Render giao diện nộp v1 khi `status === 'APPROVED'`.
  - Hiển thị thông báo kết quả và form nộp lại khi `status === 'BM01_NEEDS_REVISION'`.
  - Nút nộp bị vô hiệu hóa ngay sau khi upload thành công (`BM01_SUBMITTED` hoặc `BM01_RESUBMITTED`).
- [ ] **Step 2: Chạy test để xác nhận fail**
  Chạy: `cd frontend; npm test -- SubmissionPage.test.jsx`
  Kỳ vọng: FAIL.
- [ ] **Step 3: Tạo `outlineService.js` và nâng cấp `SubmissionPage.jsx`, `StudentDashboardPage.jsx`**
  Nối API thật, loại bỏ placeholder, bổ sung cảnh báo bản nộp chính thức không thể thay thế.
- [ ] **Step 4: Chạy test frontend**
  Chạy: `cd frontend; npm test -- SubmissionPage.test.jsx`
  Kỳ vọng: PASS.
- [ ] **Step 5: Commit Git**
  ```bash
  git add frontend/src/services/outlineService.js frontend/src/pages/student/SubmissionPage.jsx frontend/src/pages/student/StudentDashboardPage.jsx frontend/src/pages/student/__tests__/SubmissionPage.test.jsx
  git commit -m "feat(student): integrate outline submission and revision tracking in student portal"
  ```

---

### Task 6: Cổng Giảng Viên & Quản Trị Viên - Đánh Giá & Phân Công Hội Đồng
**Files:**
- Create: `frontend/src/pages/lecturer/CouncilOutlinePage.jsx`
- Modify: `frontend/src/pages/admin/CouncilAssignmentPage.jsx`
- Modify: `frontend/src/services/councilService.js`
- Test: `frontend/src/pages/admin/__tests__/CouncilAssignmentPage.test.jsx`

**Interfaces:**
- Produces:
  - Nút "Tự động phân công HĐ Đề cương" trên `CouncilAssignmentPage.jsx` gọi `councilService.autoAssignOutlineCouncils(semesterId)`.
  - Giao diện Hội đồng cho Thư ký nhập kết quả có validation ma trận tức thời.
  - Giao diện Chủ tịch: Công bố lịch, đặt hạn nộp lại, trả lại hồ sơ, duyệt/từ chối file nộp lại kèm nhận xét bắt buộc, và nút "Chốt danh sách quá hạn".
  - Modal Reopen của Admin hiển thị thông báo chặn chi tiết khi vướng đơn BM02 (`BM02_DEPENDENCY_EXISTS`).
- Consumes:
  - `councilService`, `outlineService`.

- [ ] **Step 1: Viết test cho nút tự động phân công và modal Reopen trên Admin Council Assignment**
  Viết test kiểm tra kích hoạt nút tự động phân công và bắt lỗi 409 khi mở khóa hội đồng có sinh viên dính BM02.
- [ ] **Step 2: Chạy test để xác nhận fail**
  Chạy: `cd frontend; npm test -- CouncilAssignmentPage.test.jsx`
  Kỳ vọng: FAIL.
- [ ] **Step 3: Triển khai `CouncilOutlinePage.jsx` và nâng cấp `CouncilAssignmentPage.jsx`**
  Thêm tab/giao diện xét duyệt đề cương cho giảng viên và tích hợp nút tự động phân công kèm modal Reopen an toàn cho admin.
- [ ] **Step 4: Chạy test frontend**
  Chạy: `cd frontend; npm test -- CouncilAssignmentPage.test.jsx`
  Kỳ vọng: PASS.
- [ ] **Step 5: Commit Git**
  ```bash
  git add frontend/src/pages/lecturer/CouncilOutlinePage.jsx frontend/src/pages/admin/CouncilAssignmentPage.jsx frontend/src/services/councilService.js frontend/src/pages/admin/__tests__/CouncilAssignmentPage.test.jsx
  git commit -m "feat(admin-lecturer): implement outline council grading, auto-assignment button and safe reopen UI"
  ```

---

### Task 7: Kiểm Thử Toàn Diện E2E, Xác Thực Build & Đóng Gói
**Files:**
- Create: `backend/tests/integration/outlineWorkflowFullE2E.test.js`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Viết test E2E kiểm thử toàn bộ vòng đời xét duyệt đề cương**
  Kiểm thử một kịch bản khép kín:
  - Sinh viên nộp đề cương v1 (`BM01_SUBMITTED`).
  - Admin kích hoạt tự động phân công $\rightarrow$ sinh hội đồng gom cụm theo GVHD và gán 3 giảng viên.
  - Chủ tịch công bố lịch bảo vệ.
  - Thư ký nhập kết quả (`REVISION_REQUIRED`), chuyển Chủ tịch.
  - Chủ tịch ký công bố $\rightarrow$ sinh viên chuyển sang `BM01_NEEDS_REVISION`.
  - Chủ tịch đặt hạn nộp lại $\rightarrow$ kích hoạt task `BM01_RESUBMISSION`.
  - Sinh viên nộp lại file v2 $\rightarrow$ chuyển `BM01_RESUBMITTED` (chặn nộp tiếp).
  - Chủ tịch duyệt file $\rightarrow$ chuyển `BM01_PASSED` và mở quyền nộp đơn BM02.
  - Thử nghiệm Admin Reopen sau khi sinh viên đã nộp đơn BM02 $\rightarrow$ hệ thống chặn với `409 BM02_DEPENDENCY_EXISTS`.
- [ ] **Step 2: Chạy test suite backend**
  Chạy: `cd backend; npm test`
  Kỳ vọng: Toàn bộ test suites đều PASS (67/67 test suites PASS 100%).
- [ ] **Step 3: Kiểm thử build production frontend**
  Chạy: `cd frontend; npm run build`
  Kỳ vọng: 0 errors, build thành công toàn bộ bundle modules.
- [ ] **Step 4: Cập nhật nhật ký phiên làm việc trong `CLAUDE.md`**
  Ghi nhận hoàn thành kế hoạch triển khai phân hệ xét duyệt đề cương BM01 và cập nhật danh sách các module.
- [ ] **Step 5: Commit Git**
  ```bash
  git add backend/tests/integration/outlineWorkflowFullE2E.test.js CLAUDE.md
  git commit -m "test(e2e): verify complete outline review lifecycle and record plan in CLAUDE.md"
  ```
