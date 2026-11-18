# Audit Remediation Academic Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khôi phục luồng BM01–BM04 và thao tác học vụ từ cấu hình đợt đến nộp, thẩm định, đánh giá, in và phân quyền.

**Architecture:** Dùng trạng thái/command ở backend làm nguồn duy nhất; frontend gửi đúng payload và đọc đúng dữ liệu thật. Các trường BM01 đã có trong Prisma nên nối API/UI, không tạo migration trùng. Mỗi vòng BM01/BM02/BM03/BM04 có test chuyển trạng thái và test màn hình tương ứng.

**Tech Stack:** Express 5, Prisma 7/PostgreSQL, Jest, React 19/Ant Design 6/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-full-workflow-audit-remediation-design.md`; tracking `docs/superpowers/plans/2026-11-19-audit-remediation-index.md`.

**Prerequisite:** Hoàn thành nền actor/PDF, policy, quota trong `2026-11-19-audit-remediation-foundation.md` hoặc kiểm chứng phần tương ứng đã có.

## Global Constraints

- `TopicRegistration` là nguồn hồ sơ; không tạo lại `group/groupMember`. BM01 mới chỉ nhận PDF governed asset và giữ v1/v2.
- Lỗi thiếu quyền/trạng thái/asset trả `4xx` có lý do; không dùng `500` do Prisma enum, key sai hoặc null actor. Các test ghi dữ liệu chạy trên DB cách ly.
- Form có nhãn/lỗi tại trường; nhiều lỗi có tóm tắt nhận focus và liên kết đến trường. Phiếu ký/khóa chỉ đọc; không hiển thị dữ liệu in giả.
- UTF-8 không BOM; icon nút qua prop `icon` từ `@ant-design/icons`, nhãn tiếng Việt thuần.

## Review Focus

1. BM01 upload `/assets` trả `{id}`: modal dùng asset đó, không báo thất bại hoặc gọi legacy fallback (Task 1).
2. BM01 v2 `BM01_RESUBMITTED`: GVHD/hội đồng duyệt đúng version, không route cũ 409 (Task 2).
3. BM02-A phụ lục tạo/ban hành: đúng key và ngày ký, không mất request IDs (Task 3).
4. BM03 FINAL `PROPOSE_STOP` rồi `REJECT_STOP`: GVHD đánh giá lại/ký được, quyết định cũ vẫn xem được (Task 4).
5. BM04 đã dừng/đã khóa: không tạo nháp mới, không in kết luận giả hoặc cho sửa form (Task 5).

---

### Task 1: Cấu hình BM01 và upload có hợp đồng nhất quán

**Files:** Modify `backend/src/controllers/semesterController.js`, `backend/src/routes/outlineRoutes.js`, `backend/src/services/outlineReviewService.js`, `backend/src/controllers/uploadController.js`, `frontend/src/pages/admin/ProjectPeriodPage.jsx`, `frontend/src/components/forms/HybridBMFormModal.jsx`; test `backend/tests/integration/semesters.routes.test.js`, `backend/tests/integration/bm01.routes.test.js`, `frontend/runtime-tests/assetUploadTransport.spec.jsx`; create `frontend/runtime-tests/bm01PeriodConfig.spec.jsx`.

**Interfaces:** `Semester` create/update/read round-trips existing `outlineSubmissionOpenAt`, `outlineSubmissionDeadline`, template asset. BM01 submit requires owned governed PDF `assetId` and form content; UI consumes `{id}` from `/assets`. Legacy `/upload` never dereferences absent `req.file.buffer`: unsupported input returns a controlled `4xx` or storage-compatible handling.

- [ ] **Step 1: Viết test thất bại.** Config dates/template reload; missing/foreign/Word asset rejected; `/assets {id}` succeeds without fallback; request `/upload` with diskStorage file never 500.
- [ ] **Step 2: Chạy focused backend/frontend; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/semesters.routes.test.js tests/integration/bm01.routes.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/assetUploadTransport.spec.jsx runtime-tests/bm01PeriodConfig.spec.jsx`.
- [ ] **Step 3: Nối các trường có sẵn từ backend sang form và sửa response parsing.** Không tạo migration BM01 mới. Backend giữ header/MIME/magic PDF và ownership check.
- [ ] **Step 4: Chạy lại hai lệnh; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "fix: configure and upload BM01 assets consistently"`.

### Task 2: Một command duyệt BM01 v1/v2

**Files:** Modify `backend/src/services/outlineReviewService.js`, `backend/src/routes/outlineRoutes.js`, `frontend/src/pages/lecturer/TopicApprovalPage.jsx`, `frontend/src/components/lecturer/OutlineReviewModal.jsx`; test `backend/tests/services/outlineReviewService.test.js`, `backend/tests/integration/outlineRoutes.test.js`; create `frontend/runtime-tests/bm01ResubmissionReview.spec.jsx`.

**Interfaces:** Cả hai entry point UI duyệt đúng `Submission` version bằng cùng route/command; `BM01_RESUBMITTED` được xem và đánh giá v2, v1 giữ lịch sử. `FAIL` giữ kết luận FAIL theo domain, không tự thành `BM01_NEEDS_REVISION`.

- [ ] **Step 1: Viết test thất bại.** V1 FAIL, nộp lại v2 và duyệt qua cả hai lối mở; không 409 sai; quyền hội đồng/GVHD và phiên bản bị khóa được kiểm.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/outlineReviewService.test.js tests/integration/outlineRoutes.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/bm01ResubmissionReview.spec.jsx`.
- [ ] **Step 3: Hợp nhất route/command và sửa điều hướng/modal.** Không tạo hai trạng thái duyệt khác nhau cho cùng version.
- [ ] **Step 4: Chạy lại; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "fix: review BM01 resubmission consistently"`.

### Task 3: BM02 và phụ lục BM02-A đúng payload

**Files:** Modify `backend/src/controllers/registrationController.js`, `backend/src/services/bm02ReviewService.js`, `backend/src/controllers/bm02aController.js`, `frontend/src/components/admin/BM02ReviewDrawer.jsx`, `frontend/src/components/institute/DecisionQueue.jsx`, `frontend/src/components/institute/ReviewQueue.jsx`, `frontend/src/pages/lecturer/TitleAdjustmentPage.jsx`, `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`, `frontend/src/components/prints/BM02APrintSheet.jsx`; test `backend/tests/services/bm02ReviewService.test.js`, `backend/tests/integration/bm02aAndAppendixWorkflow.test.js`, `frontend/tests/bm02ReviewUiContracts.test.js`; create `frontend/runtime-tests/bm02aAppendixContract.spec.jsx`.

**Interfaces:** Backend quyết định `BM02_APPROVED` từ hành động review hợp lệ; UI không cần `targetStatus` bí mật. Phụ lục gửi/nhận `{decisionId,appendixNumber,bm02aRequestIds,signedDate}` và đúng enum BM02-A. Bản in dùng request/version thật; ReviewQueue lấy registration detail từ service có thật.

- [ ] **Step 1: Viết test thất bại.** BM02 approved đi qua DecisionQueue; BM02-A tạo/ký phụ lục bằng UI payload; ReviewQueue có chi tiết SV/nút ký; enum và prop bản in đúng.
- [ ] **Step 2: Chạy focused backend/frontend; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/bm02ReviewService.test.js tests/integration/bm02aAndAppendixWorkflow.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/bm02aAppendixContract.spec.jsx`.
- [ ] **Step 3: Sửa backend command trước, sau đó payload và đọc dữ liệu ở các UI.** Giữ history BM02-A và chỉ cho đúng vai trò ký.
- [ ] **Step 4: Chạy lại và `npm --prefix frontend test -- tests/bm02ReviewUiContracts.test.js`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "fix: align BM02 and BM02-A review contracts"`.

### Task 4: BM03 enum, bác dừng và nhật ký chính xác

**Files:** Modify `backend/src/services/bm03WorkflowService.js`, `backend/src/controllers/bm03Controller.js`, `backend/src/controllers/meetingLogController.js`, `backend/src/controllers/registrationController.js`, `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`; test `backend/tests/integration/bm03Workflow.test.js`, `backend/tests/integration/meetingLogs.routes.test.js`, `frontend/runtime-tests/bm03Timeline.spec.jsx`; create `backend/tests/services/bm03RejectedStopRecovery.test.js`.

**Interfaces:** Online meeting serializes `MICROSOFT_TEAMS`; invalid ID gets `400`; meeting count excludes `supersededById != null`. On FINAL `REJECT_STOP`, clear current `finalStageEvaluationId` link while retaining evaluation/decision history, then allow a new valid final evaluation and signing.

- [ ] **Step 1: Viết test thất bại.** ONLINE UI saves as supported enum; invalid ID 400; superseded meeting not counted; FINAL stop rejection reopens review/signing without erasing audit.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/bm03RejectedStopRecovery.test.js tests/integration/bm03Workflow.test.js tests/integration/meetingLogs.routes.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/bm03Timeline.spec.jsx`.
- [ ] **Step 3: Sửa trạng thái backend, enum/form và bộ đếm.** Không tự chuyển hồ sơ sang `BM03_PASSED` bằng checkpoint cũ.
- [ ] **Step 4: Chạy lại; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 4.** `git commit -m "fix: recover BM03 after rejected stop"`.

### Task 5: BM04 guard, form khóa và dữ liệu phiếu in

**Files:** Modify `backend/src/services/bm04WorkflowService.js`, `backend/src/controllers/registrationController.js`, `frontend/src/components/lecturer/BM04EvaluationModal.jsx`, `frontend/src/pages/student/SubmissionPage.jsx`, `frontend/src/components/prints/AcademicDossierDrawer.jsx`, `frontend/src/components/prints/BM02PrintSheet.jsx`, `frontend/src/components/prints/BM03PrintSheet.jsx`, `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`; test `backend/tests/integration/bm04AtomicWorkflow.test.js`, `frontend/runtime-tests/academicPrintData.spec.jsx`; create `frontend/runtime-tests/bm04LockedAndPrint.spec.jsx`.

**Interfaces:** `saveBM04Draft` rejects terminated/ineligible registration; locked BM04 form is read-only. BM03/BM04 print requires real signed/eligible state; `GET /registrations/my` returns studentProfile, BM03 record, BM04 evaluation and outlineCouncil scoped to actor. Required BM03 work/next-task fields show inline validation.

- [ ] **Step 1: Viết test thất bại.** Terminated BM04 draft rejected; locked modal cannot edit; unsigned BM03/draft BM04 cannot print as final; `/my` supplies real print data; required fields keep input and focus error summary.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/bm04AtomicWorkflow.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/bm04LockedAndPrint.spec.jsx runtime-tests/academicPrintData.spec.jsx`.
- [ ] **Step 3: Sửa guard/API trước rồi form và print callsites.** Không dùng placeholder/chữ ký hoặc kết luận giả.
- [ ] **Step 4: Chạy lại; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 5.** `git commit -m "fix: guard BM04 and print signed academic forms"`.

### Task 6: Scope và quyền học vụ khớp UI

**Files:** Modify `backend/src/services/academicScopeService.js`, `backend/src/controllers/semesterController.js`, `backend/src/controllers/announcementController.js`, `backend/src/controllers/lecturerAssignmentController.js`, `backend/src/routes/lecturerAssignmentRoutes.js`, `frontend/src/pages/admin/ProjectPeriodPage.jsx`, `frontend/src/components/coordination/LecturerAssignmentTab.jsx`, `frontend/src/pages/admin/AnnouncementManagementPage.jsx`; test `backend/tests/integration/permissionMatrix.routes.test.js`, `backend/tests/integration/reportViewScope.routes.test.js`; create `frontend/runtime-tests/academicActionPermissions.spec.jsx`.

**Interfaces:** Viện trưởng scope gồm các bộ môn trực thuộc Viện; route/menu/`allowedActions` dùng quyền backend cho registration toggle, mentor assignment publish và announcement draft/fileAssetId. Không thêm bypass toàn cục hoặc quyền `USER_MANAGE` cho Giáo vụ.

- [ ] **Step 1: Viết test thất bại theo vai trò.** Viện trưởng xem/duyệt đúng phạm vi Viện; Giáo vụ chỉ hành động được khi có quyền tương ứng; publish assignment có route thật; announcement draft giữ file asset; UI ẩn/hiện action theo API.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/permissionMatrix.routes.test.js tests/integration/reportViewScope.routes.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/academicActionPermissions.spec.jsx`.
- [ ] **Step 3: Sửa policy/backend action trước rồi UI.** Dùng điều kiện bộ môn thuộc Viện, không so chuỗi tên Viện với tên bộ môn của đề tài.
- [ ] **Step 4: Chạy lại; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 6.** `git commit -m "fix: align academic scope and actions"`.

## Handoff

Đánh dấu P0.3/P0.5–P0.7/P0.9/P0.10/P0.12–P0.14, P1.2/P1.3/P1.5/P1.6/P1.8, P2.5/P2.6 trong index. Các lỗi PDF actor dùng kế hoạch nền; mọi test có ghi DB chạy ở môi trường cách ly. Tiếp tục kế hoạch hội đồng/kết quả.
