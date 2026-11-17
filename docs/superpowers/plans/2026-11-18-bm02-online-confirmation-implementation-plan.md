# BM02 Online Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BM02 được điền và nộp trực tuyến, ba người xác nhận đúng phiên bản, bản xem/in hiển thị trạng thái xác thực nội bộ thật.

**Architecture:** `BM02Submission` tiếp tục là bản ghi phiên bản duy nhất. Sự kiện sinh viên/GVHD/phụ trách bộ môn liên kết với hash nội dung bất biến theo mẫu BM02-A; thẩm định học vụ hiện có chỉ mở khi đủ ba xác nhận. Không yêu cầu PDF scan ký tay cho lượt BM02 mới.

**Tech Stack:** Prisma/PostgreSQL, Express, Jest, React 19, Ant Design, React Query.

**Spec:** `docs/superpowers/specs/2026-11-18-academic-forms-print-and-online-submission-design.md` (§2, §4, §6–8).

**Dependency:** Hoàn tất `2026-11-18-academic-print-foundation-implementation-plan.md` trước Task 3; backend Task 1–2 triển khai độc lập.

## Global Constraints

- `TopicRegistration` là trục hồ sơ; 1 sinh viên/đề tài, tối đa 10 sinh viên/GVHD. CSDL → backend → frontend.
- Ba xác nhận theo thứ tự sinh viên → GVHD của đề tài → phụ trách bộ môn được cấp quyền theo scope. `BM02_REVIEW` học vụ là bước riêng, không là chữ ký bộ môn.
- Nhãn “Đã xác thực nội bộ” chỉ hiện khi event người/vai trò/phiên bản/hash hợp lệ; không nhận là chữ ký số có chứng thư.
- V2 giữ lịch sử v1 và ký lại từ đầu; không auto-grant quyền bộ môn cho mọi GVHD/Viện trưởng.
- UTF-8 không BOM; icon nút dùng `@ant-design/icons` qua prop `icon`; không dùng mock nghiệp vụ.

## Review Focus

1. GVHD khác hoặc actor bộ môn ngoài scope: POST ký trả 403, GET không lộ hồ sơ (Task 2).
2. Ký lặp, ký sai thứ tự hoặc stale `expectedPayloadHash`: từ chối/idempotent đúng, không thêm event giả (Task 2).
3. BM02 v2 sau trả sửa: v1 giữ nguyên lịch sử, v2 không thừa kế dấu hợp lệ (Task 1–2).
4. Actor chỉ có `BM02_REVIEW` không thể duyệt trước khi ba xác nhận hoàn tất (Task 2).
5. Print/view với bản thiếu event hoặc dữ liệu tên/nhiệm vụ: hiện “Chờ xác nhận”/lỗi dữ liệu, không hiện dấu hay mẫu giả (Task 3).

---

### Task 1: Phiên bản BM02 có hash và ba sự kiện xác nhận

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/constants/permissions.js`
- Create: migration `backend/prisma/migrations/20261118160000_bm02_confirmation_events/migration.sql`
- Test: `backend/tests/integration/bm02AndDecisionWorkflow.test.js`, `backend/tests/integration/permissionCatalogMigration.test.js`

**Interfaces:**
- Produces: `BM02Submission.payloadHash`, `studentSignatureEventId`, `advisorSignatureEventId`, `departmentSignatureEventId` (nullable; event cùng `entityType='BM02_SUBMISSION'`, `entityId`, `versionNumber`).
- Produces: `BM02_ADVISOR_SIGN` cho nhóm GVHD mặc định nhưng backend chỉ cho ký đề tài mình hướng dẫn; `BM02_DEPARTMENT_SIGN` scoped `SEMESTER/DEPARTMENT/RESOURCE` chỉ cấp qua nhóm/ủy quyền bộ môn được chỉ định, không tự cấp cho mọi GVHD/Viện trưởng.

- [x] **Step 1: Viết test fail.** Test Prisma tạo v1/v2 với cột hash/event nullable, có thể query từng phiên bản; catalog có hai capability mới, GVHD mặc định chỉ có quyền ký GVHD chứ không có quyền ký bộ môn. Lịch sử BM02 cũ vẫn đọc được dù chưa có ba event.
- [x] **Step 2: Chạy test fail.** `npm --prefix backend test -- --runTestsByPath tests/integration/bm02AndDecisionWorkflow.test.js tests/integration/permissionCatalogMigration.test.js` → FAIL vì schema/capability chưa có.
- [x] **Step 3: Thêm schema/catalog.** Migration nullable để không giả ký BM02 cũ; thêm permission catalog và seed idempotent. Migration đồng bộ grant `BM02_ADVISOR_SIGN` cho nhóm GVHD đã lưu, tăng `permissionVersion` của thành viên và làm mới cache khi triển khai; không tự gán `BM02_DEPARTMENT_SIGN`. Task 2 sẽ tính `payloadHash` từ snapshot BM02 chính thức (tên BM01/BM02, lý do, nội dung nhiệm vụ, phiên bản, registration), không gồm các trạng thái có thể đổi sau ký.
- [x] **Step 4: Chạy test, Prisma validate, commit.** Test bước 2 PASS; `npm --prefix backend exec prisma validate` PASS; commit `feat(bm02): store version-bound confirmation events`.

### Task 2: Command nộp và ký có guard ở backend

**Files:**
- Modify: `backend/src/services/academicDocumentService.js`, `backend/src/services/bm02ReviewService.js`, `backend/src/routes/bm02WorkflowRoutes.js`, `backend/src/controllers/bm02WorkflowController.js`
- Modify if needed: `backend/src/routes/registrationRoutes.js`, `backend/src/controllers/registrationController.js`
- Create: `backend/src/services/bm02SignatureService.js`, `backend/tests/services/bm02SignatureService.test.js`, `backend/tests/integration/bm02Signature.routes.test.js`; extend `backend/tests/integration/bm02AndDecisionWorkflow.test.js`

**Interfaces:**
- Produces: `signBM02Advisor({ submissionId, actorId, expectedPayloadHash, idempotencyKey })`; `signBM02Department({ ... })`; `getBM02Verification({ submissionId, actorId }) -> { versionNo, payloadHash, student, advisor, department }`.
- Produces: `POST /api/bm02/applications/:id/advisor-sign`, `POST /api/bm02/applications/:id/department-sign`, `GET /api/bm02/applications/:id/verification`; `:id` là **BM02Submission id** cho ba route mới.
- Preserves: endpoint nộp `/bm02/applications/:registrationId/submit` và `/registrations/bm02-submit` cùng command, v1/v2 quota và review/decision hiện có.

- [x] **Step 1: Viết test fail.** Nộp BM02 tạo student event trong transaction; GVHD đúng đề tài ký sau sinh viên; actor bộ môn có grant đúng scope ký sau GVHD. Assert sai người/scope/thứ tự/hash/trạng thái đều 403/409 và không đổi dữ liệu; ký lại cùng idempotency key không nhân bản. Review/ban hành BM02 mới trước ba event trả lỗi; hồ sơ đã duyệt trước rollout vẫn đọc/ban hành theo trạng thái lịch sử mà không được gán dấu ký hồi tố. V2 reset chuỗi.
- [x] **Step 2: Chạy test fail.** `npm --prefix backend test -- --runTestsByPath tests/services/bm02SignatureService.test.js tests/integration/bm02Signature.routes.test.js tests/integration/bm02AndDecisionWorkflow.test.js tests/integration/bm02ToBm04FullE2E.test.js` → FAIL ở điều kiện ký/gate mới.
- [x] **Step 3: Implement command.** Dùng `ElectronicSignatureEvent`/hash như BM02-A; backend tự kiểm tra actor và scope grant, không tin role label hoặc dữ liệu signature do client gửi. Route nộp mới không yêu cầu/nhận bản scan BM02; endpoint legacy chỉ giữ đọc/tương thích theo cùng service. `getBM02Verification` chỉ trả trạng thái hợp lệ khi event khớp current hash; không lộ hồ sơ của người ngoài.
- [x] **Step 4: Chạy lại test và commit.** Test bước 2 PASS; commit `feat(bm02): enforce online confirmation chain`.

### Task 3: Form, hàng việc và bản in BM02

**Files:**
- Modify: `frontend/src/components/forms/HybridBMFormModal.jsx`, `frontend/src/pages/student/SubmissionPage.jsx`, `frontend/src/services/registrationService.js`
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`, `frontend/src/pages/lecturer/InstituteOperationsPage.jsx`, `frontend/src/components/admin/BM02ReviewDrawer.jsx`, `frontend/src/components/prints/BM02PrintSheet.jsx`
- Create: `frontend/src/queries/bm02VerificationQueries.js`, `frontend/runtime-tests/bm02Confirmation.spec.jsx`, `frontend/e2e/bm02Confirmation.spec.js`

**Interfaces:**
- Consumes: Task 2 routes/DTO; print surface từ `2026-11-18-academic-print-foundation-implementation-plan.md`.
- Produces: sinh viên thấy “Xác nhận và nộp BM02”, không có upload scan; GVHD/phụ trách bộ môn thấy action theo grant; `BM02PrintSheet({ registration, submission, verification })` render `verification.student|advisor|department` với tên, thời điểm, phiên bản hoặc “Chờ xác nhận”.

- [x] **Step 1: Viết test fail.** Sinh viên điền và nộp không thấy upload BM02; GVHD và bộ môn chỉ thấy nút của mình khi được quyền; viewer/in A4 chưa đủ ký hiện “Chờ xác nhận”, đủ ký hiện “Đã xác thực nội bộ”, v2 không hiện dấu v1; loading/error riêng.
- [x] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/bm02Confirmation.spec.jsx`; `npm --prefix frontend run test:e2e -- e2e/bm02Confirmation.spec.js` → FAIL với form scan và ô ký trống hiện tại.
- [x] **Step 3: Nối UI vào API thật.** Bỏ `fileRequired`/upload section riêng của BM02, giữ field validation; thêm hàng việc ký cho đúng actor và invalidate query sau mutation. `BM02PrintSheet` lấy `BM02Submission` + verified DTO, không dùng fallback nhân thân hay chữ ký ảnh tự chế.
- [x] **Step 4: Regression và commit.** Test bước 2 PASS; `npm --prefix frontend run lint` và `npm --prefix frontend run build` PASS; commit `feat(bm02): show online confirmation and verified print`.
