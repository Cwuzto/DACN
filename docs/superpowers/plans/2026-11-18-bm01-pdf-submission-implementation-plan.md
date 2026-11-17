# BM01 PDF Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sinh viên nộp BM01 v1/v2 trực tuyến bằng PDF duy nhất, lưu cả trường form và tệp, xem/in đúng PDF đã nộp.

**Architecture:** Giữ `Submission`/`TopicRegistration` và quota nộp lại hiện có. Chính sách asset và API chỉ nhận PDF cho lượt mới; transaction nộp lưu `content` + `assetId`. Viewer dùng URL tài sản có kiểm tra quyền, không dùng bản văn bản mô phỏng.

**Tech Stack:** Prisma/PostgreSQL, Express, Jest, React 19, Ant Design, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-academic-forms-print-and-online-submission-design.md` (§2–3, §6–8).

**Dependency:** Hoàn tất `2026-11-18-academic-print-foundation-implementation-plan.md` trước Task 3; backend Task 1–2 có thể triển khai trước đó.

## Global Constraints

- `TopicRegistration` là nguồn đăng ký duy nhất; 1 sinh viên/đề tài, tối đa 10 sinh viên/GVHD.
- BM01 mới chỉ nhận PDF tối đa 20 MB; Word lịch sử không bị xóa hoặc gán lại thành PDF.
- V1 nộp một lần; v2 chỉ khi `BM01_NEEDS_REVISION` và chỉ một lần. Không nộp/khóa từ frontend nếu backend chưa xác nhận.
- Lưu `content` và asset thuộc actor cùng phiên bản; không tin URL, tên tệp hoặc MIME do client tự khai.
- UTF-8 không BOM; icon nút qua `@ant-design/icons` prop `icon`; không mock dữ liệu khi API đã có.

## Review Focus

1. Tệp `.pdf` có bytes DOCX hoặc MIME sai: backend từ chối trước khi tạo submission (Task 1).
2. Tệp PDF của user khác hoặc sai registration: backend từ chối, không tạo record mồ côi (Task 2).
3. Client điền trường BM01 nhưng upload thành công rồi API lỗi: không đánh dấu v1/v2 đã nộp, retry cùng idempotency key không nhân bản (Task 2).
4. V1 và v2 cùng tồn tại: viewer mở đúng tệp/fields của phiên bản được chọn, không lấy nhầm bản mới nhất (Task 3).
5. Word lịch sử: còn tải được theo quyền, nhưng không có preview PDF giả và không thể nộp Word mới (Task 1, 3).

---

### Task 1: PDF policy thống nhất từ lưu trữ đến học kỳ

**Files:**
- Modify: `backend/src/storage/assetPolicyCatalog.js`, `backend/prisma/schema.prisma`, `backend/src/services/outlineReviewService.js`, `backend/src/controllers/semesterController.js`
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx`, `frontend/src/components/forms/HybridBMFormModal.jsx`
- Create: migration `backend/prisma/migrations/20261118150000_bm01_pdf_only/migration.sql`
- Test: `backend/tests/services/outlineReviewService.test.js`, `backend/tests/integration/outlineRoutes.test.js`; create `frontend/runtime-tests/bm01PdfPolicy.spec.jsx`

**Interfaces:**
- Produces: `getAssetPolicy('BM01')` chỉ `extensions:['pdf']`, `mimeTypes:['application/pdf']`, `maxBytes:20971520`; upload inspection xác minh bytes.
- Preserves: file `.docx` nộp trước migration chỉ đọc/tải theo quyền, không được dùng làm lượt nộp mới.

- [ ] **Step 1: Viết test fail.** Test asset BM01 `.docx`, PDF giả và PDF >20 MB bị từ chối; PDF thật được nhận. Test kỳ có `outlineAllowedExtensions` cũ vẫn không cho nộp Word mới; giao diện form chỉ gợi/nhận PDF và quản trị không thể cấu hình lại Word cho BM01.
- [ ] **Step 2: Chạy test fail.** `npm --prefix backend test -- --runTestsByPath tests/services/outlineReviewService.test.js tests/integration/outlineRoutes.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/bm01PdfPolicy.spec.jsx` → FAIL ở chính sách cũ.
- [ ] **Step 3: Sửa chính sách gốc.** Đổi asset policy và default/cấu hình kỳ về PDF; migration đồng bộ cấu hình kỳ hiện có cho lượt nộp mới, không đụng tệp lịch sử. Ở API nộp xác nhận asset BM01 thật và PDF đã qua inspection, không chỉ kiểm tra đuôi tên; frontend `accept=".pdf,application/pdf"` và thông báo đúng loại tệp.
- [ ] **Step 4: Chạy lại test, Prisma validate và commit.** Test bước 2 PASS; `npm --prefix backend exec prisma validate` PASS; commit `fix(bm01): require inspected PDF submissions`.

### Task 2: Lưu trường BM01 cùng asset trong một lần nộp

**Files:**
- Modify: `backend/src/routes/outlineRoutes.js`, `backend/src/controllers/outlineController.js`, `backend/src/services/outlineReviewService.js`
- Modify: `frontend/src/services/outlineService.js`, `frontend/src/pages/student/SubmissionPage.jsx`, `frontend/src/components/forms/HybridBMFormModal.jsx`
- Test: `backend/tests/integration/bm01.routes.test.js`, `backend/tests/services/outlineReviewService.test.js`; create `frontend/runtime-tests/bm01SubmitContent.spec.jsx`

**Interfaces:**
- Produces: `submitInitialOutline({ registrationId, fileData:{ assetId, fileUrl, fileName }, content })` và `submitResubmission({ ... })`; `content` là JSON string `{ formCode:'BM01', taskType, fields }` với `topicTitle`, `objectives`, `technologies`, `deliverables`, hoặc `revisionSummary` của v2. Backend parse/validate rồi chuẩn hóa trước khi lưu, không tin `submittedAt` do client gửi.
- Produces: `Submission.content`, `assetId`, `fileName`, `submittedAt` cùng một row v1/v2; backend gán thời điểm, kiểm tra actor/registration.

- [ ] **Step 1: Viết test fail.** Gửi v1 với PDF thuộc actor và 4 trường bắt buộc: assert row `Submission` lưu cả `content`/`assetId`, trạng thái `BM01_SUBMITTED`; thiếu trường/asset sai quyền không tạo row hoặc chuyển trạng thái. Gửi v2 chỉ khi `BM01_NEEDS_REVISION`; trùng idempotency key không nhân bản.
- [ ] **Step 2: Chạy test fail.** `npm --prefix backend test -- --runTestsByPath tests/integration/bm01.routes.test.js tests/services/outlineReviewService.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/bm01SubmitContent.spec.jsx` → FAIL vì `content` và `assetId` hiện bị bỏ khi gửi.
- [ ] **Step 3: Nối payload end-to-end.** Validate JSON fields tại route/service, chuyển `content`/`assetId` qua `outlineService`, controller và transaction hiện có; không tạo một submission task thứ hai. Giữ v1/v2, quyền và deadline hiện hành.
- [ ] **Step 4: Chạy lại test và commit.** Test bước 2 PASS; commit `fix(bm01): persist form fields with PDF asset`.

### Task 3: Xem và in đúng PDF BM01 đã nộp

**Files:**
- Modify: `frontend/src/components/forms/BMSubmissionViewer.jsx`, `frontend/src/pages/student/SubmissionPage.jsx`, `frontend/src/components/prints/AcademicDossierDrawer.jsx`
- Modify if needed: `frontend/src/components/lecturer/OutlineReviewModal.jsx`, `frontend/src/components/common/SimulatedDocumentViewer.jsx`
- Create: `frontend/runtime-tests/bm01PdfPreview.spec.jsx`, `frontend/e2e/bm01PdfPreview.spec.js`

**Interfaces:**
- Produces: `BMSubmissionViewer({ submission })` mở PDF của `submission.assetId`/URL truy cập có quyền; v1/v2 được chọn rõ. `SimulatedDocumentViewer` không là preview BM01.
- Consumes: API BM01 của Task 2 và print surface từ kế hoạch `2026-11-18-academic-print-foundation-implementation-plan.md`.

- [ ] **Step 1: Viết test fail.** Trước nộp, tệp PDF vừa chọn xem trước được và tệp khác không được nhận. Sau nộp, sinh viên/GVHD mở “Xem BM01” thấy PDF thật của phiên bản đã chọn; nút in in chính PDF đó. PDF lỗi/missing hiện trạng thái lỗi và tải xuống khi được phép. Word lịch sử chỉ có tải xuống; actor khác không mở được URL.
- [ ] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/bm01PdfPreview.spec.jsx`; `npm --prefix frontend run test:e2e -- e2e/bm01PdfPreview.spec.js` → FAIL khi viewer còn dựng văn bản mô phỏng.
- [ ] **Step 3: Thay viewer và điểm in.** Preview tệp PDF qua URL có quyền, chọn rõ v1/v2, cleanup object URL/iframe khi đóng; hồ sơ học vụ chỉ dẫn tải/in BM01 riêng, không chèn `BM01PrintSheet` vào bundle HTML.
- [ ] **Step 4: Chạy regression và commit.** Test bước 2 PASS; `npm --prefix frontend run lint` và `npm --prefix frontend run build` PASS; commit `feat(bm01): preview submitted PDF by version`.
