# Audit Remediation Archive, Reports and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện lưu chiểu, chứng nhận, thông báo công bố, PDF/báo cáo và xác minh lại toàn bộ 36 mã audit qua sáu giai đoạn.

**Architecture:** Backend xác thực trạng thái hồ sơ và kiểu dữ liệu lưu chiểu; frontend nộp đúng HTTPS URL và hiển thị DTO thật. Thông báo dùng schema hợp lệ, PDF/báo cáo xuất đúng metadata. Lượt cuối chạy test tập trung và mô phỏng có ghi trên CSDL cách ly, cập nhật bảng đối chiếu từng mã.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5/Jest, React 19/Ant Design 6/Vitest/Playwright, PDFKit.

**Spec:** `docs/superpowers/specs/2026-11-19-full-workflow-audit-remediation-design.md`; tracking `docs/superpowers/plans/2026-11-19-audit-remediation-index.md`.

**Prerequisite:** Hoàn thành hoặc xác minh các kế hoạch foundation, academic workflow và council/results trước khi xác nhận toàn trình.

## Global Constraints

- Mọi test có ghi dữ liệu dùng DB cách ly và dọn fixture theo ID; không chạy mô phỏng trên dữ liệu người dùng. `TopicRegistration`, 1 SV/đề tài, 10 SV/GVHD.
- Chứng nhận/PDF giữ actor có thật theo kế hoạch foundation; không ghi chữ ký giả hoặc URL PDF rỗng khi báo thành công.
- Video demo là URL HTTPS, không upload file. Lỗi trạng thái/quyền được kiểm ở backend và giải thích ở UI.
- UTF-8 không BOM; icon nút qua `@ant-design/icons` prop `icon`; không dùng mock thay API thực.

## Review Focus

1. Video demo là `http:`, URL sai hoặc file upload: bị từ chối có lý do, HTTPS hợp lệ được lưu (Task 1).
2. Hồ sơ trượt/không đủ điều kiện/tự dừng: không thể nộp lưu chiểu bằng gọi API trực tiếp (Task 1).
3. Giấy chứng nhận xem/ký theo đúng actor và scope; Giáo vụ không bị chặn nhầm quyền thẩm định (Task 2).
4. Công bố điểm thành công dù thông báo tạm lỗi; lỗi thông báo có retry/log, không truyền field Prisma lạ (Task 3).
5. Báo cáo rỗng vẫn có header, tên file UTF-8 và trạng thái đúng; không xuất PDF mang tên trường cũ (Task 4).

---

### Task 1: Video demo và điều kiện nộp lưu chiểu

**Files:** Modify `backend/src/controllers/archiveController.js`, `backend/src/services/archivalWorkflowService.js`, `frontend/src/components/forms/ArchiveSubmissionModal.jsx`; test `backend/tests/integration/archive.routes.test.js`, `backend/tests/integration/archiveAssetBinding.test.js`, `frontend/runtime-tests/archiveDossier.spec.jsx`; create `backend/tests/integration/archiveSubmissionEligibility.test.js`.

**Interfaces:** `DEMO_VIDEO` nhận `demoVideoExternalUrl` HTTPS, không file asset; backend reject `http:`/invalid URL. `POST /archives/registrations/:id/files` reject `DEFENSE_FAILED`, `NOT_ELIGIBLE_FOR_DEFENSE`, `AUTO_TERMINATED` và hồ sơ không thuộc actor với 4xx; các file lưu chiểu khác giữ policy hiện có.

- [ ] **Step 1: Viết test thất bại.** URL HTTPS thành công; file video/http URL bị từ chối; ba trạng thái cấm không lưu file kể cả gọi API trực tiếp; UI hiển thị ô URL và lỗi cạnh trường.
- [ ] **Step 2: Chạy focused backend/frontend; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/archiveSubmissionEligibility.test.js tests/integration/archive.routes.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/archiveDossier.spec.jsx`.
- [ ] **Step 3: Sửa backend policy rồi modal.** Giữ upload governed asset cho các loại file thật; không tạo đường lưu video song song.
- [ ] **Step 4: Chạy lại và `tests/integration/archiveAssetBinding.test.js`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "fix: validate archive video and eligibility"`.

### Task 2: Chứng nhận, dữ liệu lưu chiểu và scope

**Files:** Modify `backend/src/controllers/archiveController.js`, `backend/src/services/archivalWorkflowService.js`, `frontend/src/pages/student/GradeViewPage.jsx`, `frontend/src/components/forms/ClearanceCertificateModal.jsx`; test `backend/tests/services/archivalWorkflowService.test.js`, `backend/tests/integration/archiveReviewAndScoreMasking.test.js`, `frontend/src/pages/__tests__/defenseToCompletionUI.test.js`; create `frontend/runtime-tests/clearanceCertificateContract.spec.jsx`.

**Interfaces:** Response hồ sơ lưu chiểu có danh sách file theo một key backend được GradeView dùng nhất quán. Chứng nhận dùng tên đề tài hiệu lực, actor ký/điều kiện/scope thật; Giáo vụ được quyền thẩm định khi có permission, không tự ký thay Viện trưởng. PDF asset có actor hợp lệ từ foundation Task 2.

- [ ] **Step 1: Viết test thất bại.** GradeView hiển thị file thật; modal/endpoint cùng tên trường; Giáo vụ xem/thẩm định đúng quyền; Viện trưởng ký và lưu PDF; người không có scope nhận 403.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/archivalWorkflowService.test.js tests/integration/archiveReviewAndScoreMasking.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/clearanceCertificateContract.spec.jsx`.
- [ ] **Step 3: Sửa DTO/scope và modal theo backend.** Không mở quyền toàn cục hoặc tạo chữ ký mặc định trong bản in.
- [ ] **Step 4: Chạy lại và `npm --prefix frontend test -- src/pages/__tests__/defenseToCompletionUI.test.js`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "fix: align archival dossier and certificate"`.

### Task 3: Thông báo công bố điểm và metadata PDF

**Files:** Modify `backend/src/services/defenseResultPublicationService.js`, `backend/src/services/notificationService.js`, `backend/src/services/academicPdfService.js`; test `backend/tests/services/defenseResultPublicationService.test.js`, `backend/tests/integration/eventDrivenNotifications.test.js`, `frontend/runtime-tests/resultPublications.spec.jsx`, `frontend/runtime-tests/generatedAcademicDownloads.spec.jsx`.

**Interfaces:** Giữ `isPromulgated` như tín hiệu nội bộ chỉ ở đường công bố đã xác thực, nhưng `notificationService` loại nó khỏi `data` trước `prisma.notification.createMany`; không vô hiệu bộ chặn lộ điểm trước công bố. Kết quả tạo thông báo được kiểm: nếu lỗi, log có `publicationId` và người nhận để người vận hành thử lại idempotent, không hoàn tác kết quả đã công bố. Header PDF hiển thị đúng `TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT`.

- [ ] **Step 1: Viết test thất bại.** Publish kết quả tạo notification hợp schema và không lộ điểm trước công bố; giả lập notification failure không báo công bố thất bại sau commit, log đủ ID để retry; PDF/text không còn tên trường cũ.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/defenseResultPublicationService.test.js tests/integration/eventDrivenNotifications.test.js`
- [ ] **Step 3: Tách metadata kiểm soát khỏi dữ liệu ghi Prisma trong `notificationService`, kiểm kết quả và log retry theo publication ID; sửa PDF header.** Không bỏ quy tắc chống lộ điểm.
- [ ] **Step 4: Chạy lại backend tests và frontend runtime downloads/publications; PASS.** `npm --prefix frontend run test:runtime -- runtime-tests/resultPublications.spec.jsx runtime-tests/generatedAcademicDownloads.spec.jsx`
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "fix: publish results and academic PDF metadata"`.

### Task 4: Báo cáo rỗng, tên tệp và enum trạng thái

**Files:** Modify `backend/src/controllers/reportController.js`, `frontend/src/components/coordination/CoordinationOverviewTab.jsx`, `frontend/src/pages/admin/AcademicReportsPage.jsx`; test `backend/tests/integration/academicReports.test.js`, `backend/tests/integration/reportViewScope.routes.test.js`, `frontend/src/pages/__tests__/academicReportsPage.test.js`.

**Interfaces:** Export báo cáo không có dòng vẫn có các cột header chuẩn; `Content-Disposition` có `filename*=UTF-8''...` đúng; UI dùng status enum backend thay vì `FINISHED`/`ACTIVE` tưởng tượng.

- [ ] **Step 1: Viết test thất bại.** Export 0 dòng có header; tên tiếng Việt tải đúng; trạng thái thật hiển thị đúng; scope báo cáo không mở rộng.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/academicReports.test.js tests/integration/reportViewScope.routes.test.js`; `npm --prefix frontend test -- src/pages/__tests__/academicReportsPage.test.js`.
- [ ] **Step 3: Sửa serializer/export backend trước, rồi map trạng thái UI.** Không biến báo cáo rỗng thành lỗi.
- [ ] **Step 4: Chạy lại; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 4.** `git commit -m "fix: export complete academic reports"`.

### Task 5: Hồi quy sáu giai đoạn và bảng đối chiếu 36 mã

**Files:** Modify `docs/superpowers/plans/2026-11-19-audit-remediation-index.md`; create `backend/tests/integration/fullWorkflowAuditRegression.test.js` only for behaviors not already covered by focused tests; add/update focused frontend runtime tests only when the journey exposes a gap.

**Interfaces:** Index records each P0.1–P0.21, P1.1–P1.9, P2.1–P2.6 as `FIXED`, `REPORT_CORRECTION`, or `NOT_REPRODUCIBLE` with test/commit evidence. Six-stage isolated fixture covers Admin → Giáo vụ/Viện trưởng → GVHD/Hội đồng → Sinh viên, success and denial paths. No write test uses user DB.

- [ ] **Step 1: Audit the index for every code and attach the focused test/commit that proves it; write one failing journey test only for an uncovered cross-stage failure.** P0.3/P0.5/P1.5 report corrections retain their corrected explanation.
- [ ] **Step 2: Run the focused journey test; expect FAIL only for the uncovered behavior.** `npm --prefix backend test -- --runTestsByPath tests/integration/fullWorkflowAuditRegression.test.js`
- [ ] **Step 3: Apply the smallest owning-layer fix if that test finds a real gap; otherwise record a verified no-gap result.** Avoid duplicating tests that mirror implementation.
- [ ] **Step 4: Run focused backend suites, frontend runtime suites, build and browser E2E; expect PASS.** `npm --prefix backend test -- --runInBand`; `npm --prefix frontend run test:runtime`; `npm --prefix frontend run build`; `npm --prefix frontend run test:e2e -- e2e/bm01PdfPreview.spec.js e2e/bm02Confirmation.spec.js e2e/bm03FinalPrint.spec.js e2e/result-and-archive-flows.spec.js e2e/rbac-five-persona.spec.js`. Browser tests use the isolated fixture; record commands/results in index.
- [ ] **Step 5: Commit index and any test/fix from this task only.** `git commit -m "test: verify six-stage audit remediation"`.

## Handoff

Sau Task 5, mọi mã trong index phải có bằng chứng cụ thể. Báo cáo lại các mục không tái hiện/được sửa chẩn đoán và rủi ro còn lại. Bản vá code không được coi là đã triển khai production; migration/cron và môi trường thật cần release step riêng.
