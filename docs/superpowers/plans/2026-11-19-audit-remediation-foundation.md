# Audit Remediation Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa các nguyên nhân nền làm hỏng xóa đợt, tạo PDF/asset, quota, rubric và job trước khi vá từng màn hình nghiệp vụ.

**Architecture:** Giữ schema học vụ lịch sử, sửa transaction và actor tại service dùng chung. Các đường gọi PDF dùng actor có thật; quy tắc quota/rubric/chính sách nằm ở backend và được kiểm chứng ở mọi entry point. Job có actor hợp lệ, lock cùng connection và kết quả có thể thử lại.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5, Jest, React 19/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-full-workflow-audit-remediation-design.md`; tracking `docs/superpowers/plans/2026-11-19-audit-remediation-index.md`.

## Global Constraints

- Giữ `TopicRegistration`, `maxStudents = 1`, giới hạn 10 SV/GVHD; không khôi phục `group/groupMember`.
- Chỉ dùng CSDL thử nghiệm cách ly cho test có ghi dữ liệu. Không xóa cascade hồ sơ học vụ hoặc thay lịch sử để làm test pass.
- Mỗi mã audit phải có test tái hiện hoặc kết luận `REPORT_CORRECTION`/`NOT_REPRODUCIBLE` có bằng chứng trong index. `4xx` cho lỗi nghiệp vụ, `5xx` cho lỗi hệ thống có log.
- Tất cả `.md`, `.js`, `.jsx`, `.json`, `.prisma` UTF-8 không BOM; nút icon bằng prop `icon` từ `@ant-design/icons`.
- Kế hoạch rubric đã có commit `b42dbb1`–`f702839`, nhưng P0.2/P1.4 vẫn cần đối chiếu; kiểm tra code hiện tại trước khi sửa.

## Review Focus

1. Xóa đợt mới có policy version nhưng chưa có sinh viên: xóa thành công, không để FK mồ côi (Task 1).
2. Xóa đợt đã có hồ sơ: trả `409`, giữ toàn bộ dữ liệu (Task 1).
3. PDF tạo bởi job hoặc người ký: `uploadedById` luôn trỏ user hợp lệ, không làm mất `finalPdfFileUrl` (Task 2).
4. Quota đúng 10 khi hồ sơ đã đi qua BM01/BM02/BM03 và hai lượt duyệt đồng thời (Task 3).
5. Job chạy lặp/đồng thời: không tạo quyết định trùng, actor ID hợp lệ, advisory lock không rơi khỏi connection (Task 5).

---

### Task 1: Xóa đợt an toàn và một policy active

**Files:** Modify `backend/src/controllers/semesterController.js`, `backend/src/services/workflowPolicyService.js`; test `backend/tests/integration/semesters.routes.test.js`, `backend/tests/controllers/semesterController.test.js`; create `backend/tests/integration/semesterDeletionPolicyIntegrity.test.js`.

**Interfaces:** `deleteSemester` chỉ xóa policy versions và đợt trống trong cùng transaction; đợt đã có hồ sơ trả `409 PERIOD_NOT_EMPTY`. `createPolicyVersion` tắt `isActive` của phiên bản trước trong cùng phạm vi/transaction trước khi bật bản mới. Không thêm cột BM01 đã tồn tại.

- [ ] **Step 1: Viết test thất bại.** Tạo đợt trống có policy version, xóa và kiểm không còn FK; tạo đợt có `TopicRegistration`, xóa trả `409` không mất dữ liệu; tạo policy mới thì chỉ một bản active.
- [ ] **Step 2: Chạy để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/semesterDeletionPolicyIntegrity.test.js tests/integration/semesters.routes.test.js`
- [ ] **Step 3: Sửa transaction và điều kiện tại hai service/controller nêu trên.** Không dùng Prisma cascade cho hồ sơ lịch sử.
- [ ] **Step 4: Chạy lại test trên; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "fix: preserve period policy integrity"`.

### Task 2: Actor hợp lệ cho mọi PDF học vụ

**Files:** Modify `backend/.env.example`, `backend/src/services/storedAssetService.js`, `backend/src/services/academicPdfService.js`, `backend/src/services/bm02aWorkflowService.js`, `backend/src/services/bm03WorkflowService.js`, `backend/src/services/bm04WorkflowService.js`, `backend/src/services/archivalWorkflowService.js`, `backend/src/services/bm02ToBm04SweepService.js`; create `backend/src/services/systemActorService.js`, `backend/tests/integration/generatedPdfActorFlows.test.js`; test `backend/tests/services/storedAssetService.test.js`, `backend/tests/integration/generatedAcademicAssets.test.js`.

**Interfaces:** `resolveSystemActor(db) -> {id}` trong `systemActorService.js` đọc `SYSTEM_ACTOR_USER_ID` từ env, xác thực user tồn tại/đang hoạt động và trả ID; `.env.example` ghi cấu hình này không kèm giá trị nhạy cảm. Mọi lệnh tạo `StoredAsset` cho PDF nhận actor user ID hợp lệ; luồng request dùng người ký, job dùng `resolveSystemActor`. Không truyền `null`/`0`. PDF và `finalPdfFileUrl` được ghi đồng bộ hoặc lỗi có trạng thái retry rõ; không nuốt exception.

- [ ] **Step 1: Viết test thất bại cho BM02-A ký bộ môn, BM03 xác nhận/từ chối, BM04 ký/sweep và chứng nhận lưu chiểu.** Mỗi thành công có `uploadedById` hợp lệ và URL PDF; thiếu actor không tạo asset dở dang.
- [ ] **Step 2: Chạy test tái hiện; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/generatedPdfActorFlows.test.js tests/integration/generatedAcademicAssets.test.js`
- [ ] **Step 3: Truyền actor xuyên suốt và sửa lỗi bị nuốt tại các callsite.** Không nới `StoredAsset.uploadedById` thành nullable.
- [ ] **Step 4: Chạy test trên và `tests/services/storedAssetService.test.js`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "fix: attribute generated academic assets"`.

### Task 3: Quota GVHD đúng qua mọi trạng thái

**Files:** Modify `backend/src/constants/mentorCapacity.js`, `backend/src/controllers/registrationController.js`, `backend/src/controllers/topicController.js`, `backend/src/utils/excelHelper.js`, `frontend/src/pages/admin/UserManagementPage.jsx`; test `backend/tests/integration/registrationPolicyAndQuotaConcurrency.test.js`, `backend/tests/integration/mentorOwnershipAndGradingScope.test.js`, `backend/tests/utils/excelHelper.test.js`; create `frontend/runtime-tests/mentorQuotaUi.spec.jsx`.

**Interfaces:** Một helper trong `backend/src/constants/mentorCapacity.js` xác định trạng thái hồ sơ chiếm chỗ từ đăng ký qua BM01/BM02/BM03 và trạng thái bảo vệ; các đường APPROVE, gán/đổi GVHD dùng cùng helper và transaction/conditional write. Tối đa 10 SV/GVHD/đợt.

- [ ] **Step 1: Viết test thất bại.** 10 hồ sơ gồm `BM01_SUBMITTED` vẫn chiếm quota; sinh viên thứ 11 bị chặn; hai duyệt đồng thời không vượt 10; hồ sơ thật đã kết thúc được xử lý đúng quy tắc hiện hành.
- [ ] **Step 2: Chạy focused Jest; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/registrationPolicyAndQuotaConcurrency.test.js`
- [ ] **Step 3: Thống nhất bộ trạng thái và các callsite.** Bỏ quota 15/20 còn sót trong form/mẫu Excel, không nâng giới hạn backend.
- [ ] **Step 4: Chạy hai backend test file trên, `tests/utils/excelHelper.test.js` và `npm --prefix frontend run test:runtime -- runtime-tests/mentorQuotaUi.spec.jsx`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "fix: enforce mentor quota across workflow"`.

### Task 4: Mô tả rubric và khóa phiên bản đúng đợt

**Files:** Modify `frontend/src/pages/admin/RubricManagementPage.jsx`, `backend/src/services/rubricService.js`, `backend/src/controllers/rubricController.js`; test `backend/tests/integration/rubricRoutes.test.js`, `frontend/runtime-tests/rubricLevelManagement.spec.jsx`.

**Interfaces:** UI gửi `levelGoodDesc`, `levelFairDesc`, `levelAverageDesc`, `levelPoorDesc`; backend giữ các giá trị khi cập nhật. Tạo/nhân bản DRAFT tuân quyền nhưng không bị chặn chỉ vì có kỳ `ONGOING`; khóa rubric gắn đúng `semesterId`, giữ lịch sử phiên bản đã dùng.

- [ ] **Step 1: Viết test thất bại.** Lưu/sửa rubric giữ bốn mô tả; clone draft trong kỳ đang diễn ra nếu hợp lệ; lock không có/khác `semesterId` bị từ chối; rubric đã có phiếu không đổi chính sách.
- [ ] **Step 2: Chạy focused backend/frontend; expect FAIL nơi còn lệch.** `npm --prefix backend test -- --runTestsByPath tests/integration/rubricRoutes.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/rubricLevelManagement.spec.jsx`.
- [ ] **Step 3: Sửa tên trường và checkCanEditRubric/lock payload tại nguồn.** Dùng model rubric phiên bản hiện có, không tạo policy mức điểm trùng với kế hoạch chấm nhanh.
- [ ] **Step 4: Chạy lại hai lệnh; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 4.** `git commit -m "fix: preserve rubric descriptions and period lock"`.

### Task 5: Job sweep, actor hệ thống và advisory lock

**Files:** Modify `backend/src/jobs/index.js`, `backend/src/jobs/checkpointDeadlineOverdueJob.js`, `backend/src/services/bm02ToBm04SweepService.js`; test `backend/tests/integration/bm04AndSweepJobsWorkflow.test.js`; create `backend/tests/services/workflowJobLocking.test.js`.

**Interfaces:** Đăng ký sweep job thiếu trong scheduler; dùng `resolveSystemActor(db)` của Task 2 thay vì ID `0`; advisory lock và công việc được giữ trên cùng DB connection/transaction. Chạy lại idempotent, lỗi có log và retry.

- [ ] **Step 1: Viết test thất bại.** Scheduler đăng ký sweep một lần; actor không tồn tại trả lỗi cấu hình; hai worker cùng đợt chỉ một worker chạy; chạy lại không lặp BM04/PDF.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/workflowJobLocking.test.js tests/integration/bm04AndSweepJobsWorkflow.test.js`
- [ ] **Step 3: Sửa scheduler, actor resolution và transaction-scoped advisory lock.** Không dùng connection lock tách khỏi giao dịch làm việc.
- [ ] **Step 4: Chạy lại test; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 5.** `git commit -m "fix: run academic sweep jobs safely"`.

## Handoff

Task 2 giải quyết P0.8/P0.11/P0.21 cùng triệu chứng PDF BM04/sweep; các kế hoạch sau kiểm lại từng hành trình. Xem index để đánh dấu P0.1, P0.2, P0.8, P0.11, P0.21, P1.1, P1.4, P1.7, rồi tiếp tục kế hoạch BM01–BM04. Recheck `git status` trước mỗi task vì công việc chuyên môn/hội đồng đang diễn ra song song.
