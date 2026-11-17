# BM03 Continuous Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BM03 là nhật ký hướng dẫn liên tục, chỉ mở đánh giá giữa/cuối kỳ theo ngày học vụ cấu hình và chỉ hoàn tất gần cuối kỳ.

**Architecture:** `BM03ProgressRecord`/`BM03StageEvaluation` là nguồn đánh giá giai đoạn; `BM03MeetingEntry` là nhật ký GVHD xác nhận, sinh viên chỉ xem. Mốc mở được lưu theo đợt và kiểm tra tại service; checkpoint cũ giữ chứng cứ nhưng không tự chuyển `BM03_PASSED`. GVHD ký toàn BM03 cuối kỳ, sinh viên xác nhận toàn phiếu theo cửa sổ hiện có, rồi PDF bất biến được xuất.

**Tech Stack:** Prisma/PostgreSQL, Express, Jest, React 19, Ant Design, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-academic-forms-print-and-online-submission-design.md` (§2, §5–8).

**Dependency:** Hoàn tất `2026-11-18-academic-print-foundation-implementation-plan.md` trước Task 3; backend Task 1–2 triển khai độc lập.

## Global Constraints

- `TopicRegistration` là trục hồ sơ; 1 sinh viên/đề tài, tối đa 10 sinh viên/GVHD. Sửa DB → backend → UI.
- Sinh viên **không ký từng buổi gặp**; GVHD ghi/ký buổi, sinh viên xác nhận hoặc nêu lý do không đồng ý với **toàn BM03** cuối kỳ.
- `Semester.midtermReportDate` là hạn nộp báo cáo giữa kỳ, không phải ngày mở đánh giá. Mốc mới được học vụ cấu hình theo đợt và lưu snapshot chính sách áp dụng.
- Không tự chuyển hồ sơ lịch sử đã đóng, không tạo chữ ký hồi tố, không có nút xuất/nộp BM03 hoàn tất trước mốc cuối.
- UTF-8 không BOM; nút có icon qua `@ant-design/icons` prop `icon`; không dùng dữ liệu giả hoặc role bypass.

## Review Focus

1. Gọi API đánh giá giữa kỳ sớm hơn mốc hoặc thiếu cấu hình: từ chối ở backend, UI nêu ngày/lý do (Task 1).
2. Đánh giá giữa kỳ “đề nghị dừng”: phải qua Viện; nhật ký chỉ đọc khi chờ, mở tiếp nếu Viện bác dừng (Task 1–2).
3. Checkpoint 2 ký sau cập nhật: không chuyển `BM03_PASSED` sớm; hồ sơ legacy `BM03_PASSED` giữ nguyên (Task 2).
4. GVHD ký toàn phiếu trước ngày chốt, thiếu đánh giá giữa/cuối hoặc có đề nghị dừng đang chờ: từ chối (Task 1).
5. Sinh viên không thấy nút ký từng nhật ký; trước chốt không có bản BM03 hoàn tất; sau chốt PDF chỉ dùng buổi hiện hành, không dùng bản đã supersede hay pass mặc định (Task 3).

---

### Task 1: Mốc học vụ và backend gate đánh giá BM03

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/routes/semesterRoutes.js`, `backend/src/controllers/semesterController.js`, `backend/src/services/bm03WorkflowService.js`, `backend/src/controllers/bm03Controller.js`
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx`
- Create: migration `backend/prisma/migrations/20261118170000_bm03_stage_windows/migration.sql`, `backend/tests/integration/bm03StageWindows.routes.test.js`
- Test: `backend/tests/integration/bm03Workflow.test.js`

**Interfaces:**
- Produces: `Semester.bm03MidtermEvaluationOpenAt`, `Semester.bm03FinalizationOpenAt` (nullable cho legacy); `PeriodWorkflowPolicyVersion.policy.bm03MidtermEvaluationOpenAt` và `.bm03FinalizationOpenAt` giữ hai ngày cho registration khi khóa đợt.
- Produces: `assertBM03StageWindow({ registration, stage, now })` dùng trong `submitStageEvaluation` và `advisorSignWholeBM03`; thiếu mốc/sớm hơn mốc trả mã lỗi rõ, không mutation.

- [x] **Step 1: Viết test fail.** Học vụ cấu hình hai ngày theo thứ tự, snapshot cho registration; đổi lịch sau khi khóa không âm thầm đổi mốc hồ sơ cũ. MIDTERM trước ngày mở hoặc thiếu ngày → 409, đúng ngày → thành công; FINAL trước ngày chốt/thiếu MIDTERM/có stop review đang chờ → 409; ký toàn phiếu trước FINAL hợp lệ → 409.
- [x] **Step 2: Chạy test fail.** `npm --prefix backend test -- --runTestsByPath tests/integration/bm03StageWindows.routes.test.js tests/integration/bm03Workflow.test.js` → FAIL ở time gate.
- [x] **Step 3: Implement từ DB đến API rồi form học vụ.** Thêm field/migration và validation `midterm < final`; chụp policy version hoặc snapshot tương đương khi đợt khóa. Service kiểm tra mốc/quan hệ mentor/trạng thái, không dùng `midtermReportDate` làm openAt. Form `ProjectPeriodPage` có hai nhãn ngày tách khỏi hạn nộp giữa kỳ.
- [x] **Step 4: Chạy lại test, Prisma validate và commit.** Test bước 2 PASS; `npm --prefix backend exec prisma validate` PASS; commit `feat(bm03): gate stage decisions by configured dates`.

### Task 2: Một nguồn kết luận, giữ lịch sử checkpoint

**Files:**
- Modify: `backend/src/services/checkpointWorkflowService.js`, `backend/src/services/bm03WorkflowService.js`, `backend/src/services/registrationTransitionService.js` nếu transition cũ buộc chốt sớm
- Test: `backend/tests/services/checkpointWorkflowService.test.js`, `backend/tests/services/checkpointDeadlineAndAppealResolution.test.js`, `backend/tests/integration/bm03Workflow.test.js`, `backend/tests/integration/bm02ToBm04FullE2E.test.js`

**Interfaces:**
- Produces: kết luận giữa/cuối kỳ mới chỉ đọc `BM03StageEvaluation`; checkpoint 1/2 là chứng cứ đọc lịch sử, không ghi `BM03_PASSED` cho lượt mới.
- Preserves: hồ sơ đã `BM03_PASSED` trước rollout và event chữ ký checkpoint cũ không bị sửa/xóa.

- [x] **Step 1: Viết test fail.** Ký checkpoint 2 ở hồ sơ đang mở không tạo `BM03_PASSED`; hồ sơ legacy đã pass không bị đổi bởi migration/đọc; checkpoint cũ hiển thị như chứng cứ nhưng không tự tạo `BM03StageEvaluation`. Đề nghị dừng giữa kỳ được Viện bác thì tiếp tục nhật ký, chấp thuận thì dừng theo quy tắc hiện có.
- [x] **Step 2: Chạy test fail.** `npm --prefix backend test -- --runTestsByPath tests/services/checkpointWorkflowService.test.js tests/services/checkpointDeadlineAndAppealResolution.test.js tests/integration/bm03Workflow.test.js tests/integration/bm02ToBm04FullE2E.test.js` → FAIL ở transition sớm hiện tại.
- [x] **Step 3: Bỏ transition chốt sớm.** Giữ checkpoint đã phát hành/ký làm lịch sử; khi sinh viên ký checkpoint 2 của hồ sơ đang mở, chuyển về `IN_PROGRESS_BM03` thay vì `BM03_PASSED`. MIDTERM/FINAL và ký toàn BM03 là đường duy nhất chốt lượt mới; không tự gán chữ ký/đánh giá cho hồ sơ cũ.
- [x] **Step 4: Chạy lại test và commit.** Test bước 2 PASS; commit `fix(bm03): prevent checkpoint from closing form early`.

### Task 3: Dòng thời gian GVHD, sinh viên xem và PDF cuối kỳ

**Files:**
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`, `frontend/src/pages/student/SubmissionPage.jsx`, `frontend/src/components/prints/BM03PrintSheet.jsx`, `frontend/src/components/prints/AcademicDossierDrawer.jsx`
- Modify if needed: `frontend/src/queries/meetingQueries.js`, `frontend/src/services/evaluationService.js`
- Create: `frontend/runtime-tests/bm03Timeline.spec.jsx`, `frontend/e2e/bm03FinalPrint.spec.js`

**Interfaces:**
- Consumes: Task 1 mốc/policy và Task 2 canonical status; print surface từ `2026-11-18-academic-print-foundation-implementation-plan.md`.
- Produces: một timeline gồm nhật ký liên tục, thẻ MIDTERM khi mở, thẻ FINAL khi mở; không có action ký từng buổi cho sinh viên. Bản in BM03 hoàn tất chỉ khi GVHD ký và sinh viên đã xử lý xác nhận toàn phiếu.

- [x] **Step 1: Viết test fail.** Trước giữa kỳ: chỉ nhật ký; đến mốc: card “Cho làm tiếp/Đề nghị dừng”; sau CONTINUE: tiếp tục thêm buổi; trước cuối kỳ: không có “Nộp/Xuất BM03 hoàn tất”; cuối kỳ: FINAL → GVHD ký → sinh viên xác nhận hoặc nêu lý do; PDF chứa các buổi hiện hành và trạng thái thật, không mặc định checkpoint đạt.
- [x] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/bm03Timeline.spec.jsx`; `npm --prefix frontend run test:e2e -- e2e/bm03FinalPrint.spec.js` → FAIL vì tab rời/mốc chưa được dùng và print mặc định.
- [x] **Step 3: Nối timeline vào API.** Tách component nhỏ cho meeting list, stage card và final sign nếu `ProgressTrackingPage` quá lớn; dùng query hiện có và server capability. Student page chỉ đọc nhật ký, giữ xác nhận toàn phiếu 48 giờ hiện có; ẩn/nêu lý do khóa nút in hoàn tất trước mốc.
- [x] **Step 4: Regression và commit.** Test bước 2 PASS; `npm --prefix frontend run lint`, `npm --prefix frontend run build` PASS; kiểm tra PDF thực tế nhiều trang. Commit `feat(bm03): show continuous timeline and final form`.
