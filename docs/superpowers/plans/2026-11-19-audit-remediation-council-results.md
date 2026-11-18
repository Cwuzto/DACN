# Audit Remediation Council and Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chấm dứt crash/phân hội đồng sai điều kiện và khôi phục lịch bảo vệ, trả sổ, khóa điểm, duyệt kết quả qua đúng dữ liệu.

**Architecture:** Backend chỉ chọn trường Prisma có thật, kiểm hội đồng/thành viên hiệu lực và dùng một phiên bản rubric ghim từ hồ sơ tới sổ điểm. Lịch và điểm cập nhật transaction với trạng thái hội đồng nhất quán; response cho UI đủ ID/trạng thái. Đường auto phân hội đồng rủi ro được chặn an toàn trước khi kế hoạch xem trước/xác nhận mới thay thế.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5/Jest, React 19/Ant Design 6/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-full-workflow-audit-remediation-design.md`; tracking `docs/superpowers/plans/2026-11-19-audit-remediation-index.md`.

**Related plans:** `2026-11-19-defense-rubric-quick-scoring.md` đã có một phần commit; `2026-11-19-defense-council-assignment-preview.md` là tính năng kế tiếp, không thay thế bản vá an toàn P0 hiện tại.

## Global Constraints

- `TopicRegistration` là trục hồ sơ; 1 SV/đề tài, 10 SV/GVHD. Chỉ hội đồng bảo vệ cùng đợt, thành viên `isActive` và BM04 hợp lệ được phân.
- Không tự công bố kết quả từ phiếu chưa đủ; điểm hội đồng dùng đúng 3 hoặc 4 người chấm hiệu lực. Giữ lịch/phiếu đã công bố và audit điều chỉnh.
- Các test ghi DB chạy trên môi trường cách ly. File UTF-8 không BOM; icon nút bằng `@ant-design/icons` qua prop `icon`.

## Review Focus

1. `GET /councils?forGrading=true` với đề tài thật: trả 200, không select `Topic.code` (Task 1).
2. Auto job gặp thành viên `isActive=false` hoặc BM04 chưa khóa: không xóa thành viên/gán sai sinh viên (Task 1).
3. Thay ca sau công bố: thông báo hợp lệ, lịch và log được ghi một lần, không 500 (Task 2).
4. Trả sổ rồi chấm/khóa lại: rubric không thành `v1` giả, Hội đồng/Viện thấy trạng thái đúng (Task 3).
5. Hàng kết quả thiếu ID/vắng mặt/điểm thô: UI trả sổ/khóa sổ dùng đúng record và không gửi `undefined` (Task 4).

---

### Task 1: Truy vấn hội đồng và an toàn phân tự động

**Files:** Modify `backend/src/controllers/councilController.js`, `backend/src/services/councilAutoSetupService.js`, `backend/src/jobs/autoCouncilSetupJob.js`, `frontend/src/pages/admin/CouncilAssignmentPage.jsx`; test `backend/tests/unit/getAllCouncilsForGrading.test.js`, `backend/tests/integration/councilIntegrityGuards.test.js`; create `backend/tests/services/defenseAutoAssignmentSafety.test.js`.

**Interfaces:** For-grading list chỉ select trường Topic có thật. Đường auto/job defense không ghi nếu thiếu BM04 khóa, thành viên không hoạt động, sai đợt hoặc xung đột GVHD. Cho đến khi kế hoạch preview/confirm được triển khai, lệnh auto defense trả lỗi nghiệp vụ `DEFENSE_ASSIGNMENT_REQUIRES_REVIEW`; phân tay hợp lệ vẫn hoạt động và dùng cùng eligibility helper khi có.

- [ ] **Step 1: Viết test thất bại.** Query grading 200; inactive member không được đếm; BM04 task `COMPLETED` đơn lẻ không đủ; job/endpoint không thay đổi hội đồng hoặc status hồ sơ khi không có xác nhận Admin.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/unit/getAllCouncilsForGrading.test.js tests/services/defenseAutoAssignmentSafety.test.js tests/integration/councilIntegrityGuards.test.js`
- [ ] **Step 3: Sửa select và chặn đường ghi defense auto rủi ro.** Không đổi tự động hội đồng đề cương; UI nêu rõ cần xem trước/xác nhận thay vì nút một chạm ghi DB.
- [ ] **Step 4: Chạy lại backend tests và `npm --prefix frontend run build`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "fix: guard defense council assignment"`.

### Task 2: Lịch bảo vệ và thông báo có enum hợp lệ

**Files:** Modify `backend/prisma/schema.prisma`, `backend/src/controllers/councilController.js`, `frontend/src/pages/admin/CouncilDetailPage.jsx`; create `backend/prisma/migrations/20261119210000_defense_schedule_notification_types/migration.sql`; test `backend/tests/integration/defenseRubricAndCouncilSchedule.test.js`; create `backend/tests/integration/defenseScheduleNotifications.test.js`.

**Interfaces:** Bổ sung `DEFENSE_SCHEDULE_PUBLISHED` và `DEFENSE_SCHEDULE_ADJUSTED` vào `NotificationType` bằng migration; publish/adjust dùng hai tên hợp lệ này. Danh sách thành viên bỏ `isActive=false`; UI đọc `defenseSessionShift`, không `defenseShift`. Lịch sau công bố chỉ sửa qua route có reason/audit/notify.

- [ ] **Step 1: Viết test thất bại.** Publish/adjust ca không 500; notification đúng người; điều chỉnh không có reason bị chặn; 22/23 SV chia 11/11 và 12/11, inactive member không nhận lịch.
- [ ] **Step 2: Chạy focused Jest; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/defenseScheduleNotifications.test.js tests/integration/defenseRubricAndCouncilSchedule.test.js`
- [ ] **Step 3: Thêm hai giá trị enum qua schema/migration và sửa controller/UI.** Kiểm tra migration enum trên DB thử nghiệm trước khi chạy luồng publish.
- [ ] **Step 4: Chạy test trên, `npm --prefix backend exec prisma validate` và `npm --prefix frontend test -- tests/councilReadOnlyMode.test.js`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "fix: publish and adjust defense schedule safely"`.

### Task 3: Ghim rubric và khóa sổ đồng bộ

**Files:** Modify `backend/src/services/defenseScoringService.js`, `backend/src/services/instituteOperationsService.js`; test `backend/tests/services/twoStepDefenseScoreLock.test.js`, `backend/tests/integration/defenseScoringAndScorebookReturn.test.js`; create `backend/tests/integration/scoreBookRubricPinRecovery.test.js`.

**Interfaces:** Tạo/khóa/trả sổ dùng `scoreRubricVersion` đã gắn với hội đồng/phiếu, không default `v1` nếu rubric đó không có. Cùng transaction khóa sổ cập nhật `DefenseResult` và `Council.scoreBookLocked`; trả sổ mở lại trạng thái tương ứng, giữ history/actor. `InstituteOperations` dựa trên trạng thái thật và trả `allowedActions` khi đủ điều kiện.

- [ ] **Step 1: Viết test thất bại.** Hội đồng dùng rubric v2 trả sổ và chấm lại không 404; khóa sổ bật Council flag; Viện trưởng thấy duyệt; trả sổ tắt/điều chỉnh trạng thái đúng; vắng mặt không tạo điểm giả.
- [ ] **Step 2: Chạy focused Jest; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/scoreBookRubricPinRecovery.test.js tests/integration/defenseScoringAndScorebookReturn.test.js tests/services/twoStepDefenseScoreLock.test.js`
- [ ] **Step 3: Sửa luồng phiên bản/transaction/response.** Giữ quy tắc chỉ đủ 3 hoặc 4 phiếu khóa mới có điểm hội đồng từ kế hoạch rubric đã thực hiện; không phục hồi đường tính trung bình tạm.
- [ ] **Step 4: Chạy lại; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "fix: pin rubric and synchronize scorebook state"`.

### Task 4: Dữ liệu trung tâm chấm điểm và UI trả sổ

**Files:** Modify `backend/src/controllers/evaluationController.js`, `frontend/src/pages/admin/GradingDefensePage.jsx`, `frontend/src/pages/lecturer/GradingPage.jsx`; test `backend/tests/integration/defenseToCompletionFullE2E.test.js`, `frontend/tests/allowedActionsAndTwoStepLockUi.test.js`; create `frontend/runtime-tests/scoreBookReturnContract.spec.jsx`.

**Interfaces:** `getAdminDefenseCenter` trả `memberScores[].id`, `DefenseResult.id`, `rawAverageScore`, `roundedFinalScore`, `attendanceStatus`, `absentMinutesText`, `scoreLocked` từ nguồn thật. UI trả sổ gửi ID hợp lệ; nút khóa sổ vắng mặt đọc `candidate.defenseResult.absentMinutesText`; không nhân bản điểm hoặc làm lộ kết quả chưa duyệt.

- [ ] **Step 1: Viết test thất bại.** Response có ID/điểm/trạng thái; UI chọn phiếu trả sổ gửi ID số; vắng mặt có biên bản khóa được; thiếu biên bản bị chặn; loading/error rõ.
- [ ] **Step 2: Chạy focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/defenseToCompletionFullE2E.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/scoreBookReturnContract.spec.jsx`.
- [ ] **Step 3: Sửa serializer backend trước, rồi hai trang chấm điểm.** Giữ phân quyền Admin/Chủ tịch/Viện trưởng và trạng thái công bố.
- [ ] **Step 4: Chạy lại và `npm --prefix frontend test -- tests/allowedActionsAndTwoStepLockUi.test.js`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 4.** `git commit -m "fix: return complete defense scoring records"`.

## Handoff

Đánh dấu P0.4/P0.15–P0.19 và phần hội đồng/chấm điểm P1.9 trong index. Trước khi thực hiện Task 1/3, đối chiếu các commit rubric và schema hội đồng mới nhất để không sửa đè tính năng đang phát triển. Tiếp tục kế hoạch lưu chiểu/báo cáo và lượt hồi quy cuối.
