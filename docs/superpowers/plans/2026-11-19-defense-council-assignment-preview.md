# Defense Council Assignment Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin lập, chỉnh và xác nhận một phương án phân toàn bộ sinh viên đủ điều kiện vào hội đồng bảo vệ có ngày, phòng, chuyên môn và hai ca hợp lệ.

**Architecture:** `Semester` lưu mức mục tiêu, một dịch vụ eligibility dùng chung cho phân tay/tự động/công bố. Bộ lập phương án đọc snapshot hiện tại, tìm nghiệm thỏa các điều kiện cứng rồi tối ưu tải và chuyên môn; xem trước không ghi DB. Xác nhận kiểm tra fingerprint và toàn bộ điều kiện trong transaction, sau đó mới tạo hội đồng/gán sinh viên. Đường tự động ghi trực tiếp hiện có bị vô hiệu cho hội đồng bảo vệ.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5/Jest, React 19/Ant Design 6/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-defense-council-assignment-preview-and-expertise-design.md`, mục 1–2 và 4–8.

**Prerequisite:** Hoàn thành `docs/superpowers/plans/2026-11-19-lecturer-expertise-and-topic-ai.md`; dùng `User.expertiseAreas` và `getAcceptedExpertise(topicId, {db})` đã được kiểm chứng.

## Global Constraints

- Chỉ Admin cấu hình/xác nhận; Giáo vụ chỉ xem. `TopicRegistration`, một sinh viên/một đề tài, GVHD tối đa 10 sinh viên.
- Mức mục tiêu theo đợt từ 1–30, mặc định 22; trần cứng 30 sinh viên/hội đồng. Hội đồng mặc định ba vai trò chấm; giữ cấu hình người chấm thứ tư khi có.
- Một giảng viên ở tối đa một hội đồng bảo vệ trong đợt; không chấm sinh viên do mình hướng dẫn. Mỗi đề tài có ít nhất một thành viên khớp chuyên môn đã được chấp nhận.
- Ngày lấy từ `Semester.defenseDate` hoặc Admin phải chọn; mỗi hội đồng một phòng riêng trọn ngày. Ca sáng 07:00–11:00, chiều 13:00–17:00; số lẻ ca sáng thêm một sinh viên; không ghi giờ riêng từng người.
- Không xác nhận khi thiếu bất kỳ sinh viên đủ điều kiện nào. Hội đồng/lịch đã công bố bất biến, ngoại trừ đường điều chỉnh có lý do/audit hiện có.
- File `.md`, `.js`, `.jsx`, `.json`, `.prisma` UTF-8 không BOM; icon nút qua prop `icon` của `@ant-design/icons`; không dùng dữ liệu giả thay dữ liệu API.

## Review Focus

1. BM04 task `COMPLETED` nhưng chưa có kết luận/ký hợp lệ: không được đưa vào tập đủ điều kiện hoặc tự đổi `DEFENSE_READY` (Task 2).
2. Phương án khả thi nhưng cách gán lần lượt thất bại: solver vẫn tìm được nghiệm, không báo nhầm bất khả thi (Task 3).
3. Tập sinh viên/giảng viên thay đổi giữa preview và confirm, hoặc hai Admin xác nhận đồng thời: không ghi một phần hay gán trùng (Task 4).
4. Hội đồng đã công bố, phòng đã được dùng, người chấm thứ tư hoặc giảng viên thiếu chuyên môn: giữ bất biến và tính đúng nguồn lực (Task 3–4).
5. Lệnh auto job cũ hoặc đường công bố lịch cũ: không thể lách qua preview/confirm và các điều kiện ngày, phòng, danh sách (Task 2, 4, 6).

---

## File map

- `backend/prisma/schema.prisma`, migration, `semesterController.js`: mức mục tiêu theo đợt.
- `backend/src/services/defenseCouncilEligibilityService.js` (mới): điều kiện chung cho sinh viên/hội đồng/thành viên.
- `backend/src/services/defenseCouncilPlanningService.js` (mới): snapshot, tìm phương án, fingerprint, giải thích lỗi.
- `backend/src/services/defenseCouncilConfirmationService.js` (mới): kiểm tra lại và ghi toàn bộ trong transaction.
- `backend/src/controllers/councilController.js`, `backend/src/routes/councilRoutes.js`, `backend/src/services/councilAutoSetupService.js`, `backend/src/jobs/autoCouncilSetupJob.js`: preview/confirm, phân tay, ngừng ghi tự động.
- `frontend/src/pages/admin/ProjectPeriodPage.jsx`, `frontend/src/pages/admin/CouncilAssignmentPage.jsx`, `frontend/src/pages/admin/CouncilDetailPage.jsx`, `frontend/src/services/councilService.js`, `frontend/src/queries/councilQueries.js`: cấu hình mục tiêu, xem/chỉnh/xác nhận, công bố lịch.

### Task 1: Mức mục tiêu theo đợt

**Files:** Modify `backend/prisma/schema.prisma`, `backend/src/controllers/semesterController.js`, `frontend/src/pages/admin/ProjectPeriodPage.jsx`; create `backend/prisma/migrations/20261119150000_defense_council_target/migration.sql`, `backend/tests/integration/defenseCouncilTarget.test.js`, `frontend/runtime-tests/defenseCouncilTarget.spec.jsx`.

**Interfaces:** `Semester.defenseCouncilTargetSize Int @default(22)`; semester create/update/read accepts/returns integer 1–30. Existing semester rows get 22. UI shows eligible-count-based council estimate `ceil(remainingEligible / target)` as an estimate, not a guarantee of feasibility.

- [ ] **Step 1: Write failing backend and UI tests.** Assert default 22, save/read target 1 and 30, reject 0/31/noninteger, and retain target on reload; 100 remaining students at target 22 suggest 5 councils.
- [ ] **Step 2: Run focused tests; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/defenseCouncilTarget.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/defenseCouncilTarget.spec.jsx`.
- [ ] **Step 3: Add migration, controller validation/response and Admin period form.** Keep `Semester.defenseDate` behavior and do not modify GVHD quota.
- [ ] **Step 4: Re-run focused tests and `npm --prefix backend exec prisma validate`; expect PASS.**
- [ ] **Step 5: Commit only Task 1 files.** `git add` named paths; `git commit -m "feat: configure defense council target per semester"`.

### Task 2: Điều kiện chung và dừng đường tự gán cũ

**Files:** Create `backend/src/services/defenseCouncilEligibilityService.js`, `backend/tests/services/defenseCouncilEligibilityService.test.js`; modify `backend/src/controllers/councilController.js`, `backend/src/services/councilAutoSetupService.js`, `backend/src/jobs/autoCouncilSetupJob.js`, `backend/src/routes/councilRoutes.js`; test `backend/tests/integration/councilIntegrityGuards.test.js`, `backend/tests/integration/bm04AndSweepJobsWorkflow.test.js`.

**Interfaces:** `getEligibleDefenseRegistrations(semesterId, {db}) -> TopicRegistration[]`; `validateDefenseAssignment({registration,council,members,semester}, {db}) -> {ok,reasons[]}`. Manual `POST /:id/assign` uses the same service. Old `POST /auto-assign` returns a migration error such as `USE_ASSIGNMENT_PREVIEW`; due-date job no longer creates/assigns defense councils. Outline council automation is unchanged.

- [ ] **Step 1: Write failing tests.** BM04 `COMPLETED` alone fails; locked approved BM04 or Institute-equivalent passes; wrong semester/inactive council/member/mentor conflict fails; manual and auto source agree; old endpoint and scheduler perform zero defense writes.
- [ ] **Step 2: Run focused Jest; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/defenseCouncilEligibilityService.test.js tests/integration/councilIntegrityGuards.test.js tests/integration/bm04AndSweepJobsWorkflow.test.js`
- [ ] **Step 3: Implement shared eligibility and remove defense mutations from old auto service/job/route.** Never promote status to `DEFENSE_READY` as a side effect of assignment. Preserve existing published-schedule adjustment and outline automation.
- [ ] **Step 4: Run focused tests; expect PASS.**
- [ ] **Step 5: Commit only Task 2 files.** `git add` named files; `git commit -m "fix: unify defense assignment eligibility"`.

### Task 3: Bộ lập phương án chỉ đọc

**Files:** Create `backend/src/services/defenseCouncilPlanningService.js`, `backend/tests/services/defenseCouncilPlanningService.test.js`.

**Interfaces:** `buildDefenseCouncilPlan({semesterId,date,rooms,targetSize,orderedRegistrationIds}, {db}) -> {status:'FEASIBLE',fingerprint,councils,coverage,explanations} | {status:'INFEASIBLE'|'SEARCH_LIMIT',reasons}`. Inputs come from Task 2 eligibility and previous-plan `getAcceptedExpertise`; existing published councils are fixed. `fingerprint` is SHA-256 of canonical eligible IDs/status/BM04, effective titles and accepted matches, active members/expertise, fixed councils, date/rooms and target.

- [ ] **Step 1: Write failing solver tests.** 100 eligible/target 22 suggests five 3-member councils when resources permit; every eligible ID appears once; no mentor conflict, repeated lecturer, room collision, >30 load or missing expertise match. Include a fixture where greedy assignment fails but a complete arrangement exists; verify deterministic output, preserved published council, distinct `INFEASIBLE` and `SEARCH_LIMIT`.
- [ ] **Step 2: Run focused Jest; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/defenseCouncilPlanningService.test.js`
- [ ] **Step 3: Implement deterministic constrained search.** Enumerate disjoint valid member sets, assign students by constrained matching/flow, then rank feasible arrangements by target deviation, load balance and expertise. If a bounded search stops before proving infeasibility, return `SEARCH_LIMIT`, never `INFEASIBLE`. Build preview entirely in memory; do not call Prisma mutations.
- [ ] **Step 4: Run focused tests; expect PASS.**
- [ ] **Step 5: Commit only Task 3 files.** `git add` service/test; `git commit -m "feat: preview constrained defense council plans"`.

### Task 4: Xác nhận toàn bộ phương án trong một giao dịch

**Files:** Create `backend/prisma/migrations/20261119160000_council_assignment_confirmation/migration.sql`, `backend/src/services/defenseCouncilConfirmationService.js`, `backend/tests/integration/defenseCouncilAssignmentPreview.test.js`; modify `backend/prisma/schema.prisma`, `backend/src/controllers/councilController.js`, `backend/src/routes/councilRoutes.js`.

**Interfaces:** Admin-only `POST /councils/defense-assignment/preview` receives `{semesterId,date?,rooms,targetSize?,orderedRegistrationIds?}` and returns Task 3 output; `POST /councils/defense-assignment/confirm` receives `{semesterId,fingerprint,councils}` and returns created/assigned IDs. Routes precede `/:id`. Add nullable `Council.assignmentConfirmedAt`/`assignmentConfirmedById`; existing published councils backfill as confirmed, existing unpublished manual assignments require new confirmation before publication. `confirmDefenseCouncilPlan(input,{db})` checks a fresh canonical snapshot, all hard constraints and exact coverage inside a serializable transaction, then creates proposed councils/members and conditionally updates unassigned `TopicRegistration` rows.

- [ ] **Step 1: Write failing integration tests.** Preview makes zero writes; Admin can confirm a full valid plan; Giáo vụ cannot confirm; missing student/date/room or changed BM04/member/expertise/published council returns conflict with zero writes; two concurrent confirms cannot double-assign; an invalid manual edit of preview cannot bypass server validation.
- [ ] **Step 2: Run focused Jest; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/integration/defenseCouncilAssignmentPreview.test.js`
- [ ] **Step 3: Add routes/controller and confirmation service.** Recompute fingerprint and validate inside transaction; use conditional `updateMany` for unassigned rows and verify affected row count. Preserve `councilId` compatibility only where existing read paths require it; primary relation is `defenseCouncilId`.
- [ ] **Step 4: Run focused integration tests; expect PASS.**
- [ ] **Step 5: Commit only Task 4 files.** `git add` named files; `git commit -m "feat: confirm complete defense council plans"`.

### Task 5: Admin xem, chỉnh và xác nhận phương án

**Files:** Modify `frontend/src/pages/admin/CouncilAssignmentPage.jsx`, `frontend/src/services/councilService.js`, `frontend/src/queries/councilQueries.js`; create `frontend/src/components/admin/DefenseAssignmentPreview.jsx`, `frontend/runtime-tests/defenseAssignmentPreview.spec.jsx`.

**Interfaces:** Existing Admin council page sends date (semester default or Admin choice), room list, target and optional manual edits to preview; only a `FEASIBLE` plan with no unresolved expertise review enables Confirm. Display each proposed/fixed council, members/roles, room, load, morning/afternoon ordered lists, expertise evidence and infeasibility reasons. Giáo vụ sees read-only status. After edits, request a new preview/fingerprint before confirm.

- [ ] **Step 1: Write failing runtime tests.** Date default, missing date/room, target reload, 22/23 shift preview, existing published council read-only, manual swap revalidates, infeasible/search-limit blocks confirm, stale 409 refreshes preview, Admin-only action.
- [ ] **Step 2: Run focused Vitest; expect FAIL.** `npm --prefix frontend run test:runtime -- runtime-tests/defenseAssignmentPreview.spec.jsx`
- [ ] **Step 3: Replace old one-click auto-assign with preview/edit/confirm workflow.** Keep data from real API and current query invalidation; loading/error states and keyboard behavior must work at 375px.
- [ ] **Step 4: Run focused test and build; expect PASS.** `npm --prefix frontend run test:runtime -- runtime-tests/defenseAssignmentPreview.spec.jsx`; `npm --prefix frontend run build`.
- [ ] **Step 5: Commit only Task 5 files.** `git add` named files; `git commit -m "feat: review defense council assignments before confirm"`.

### Task 6: Công bố lịch an toàn và kiểm chứng cuối

**Files:** Modify `backend/src/controllers/councilController.js`, `frontend/src/pages/admin/CouncilDetailPage.jsx`; test `backend/tests/integration/defenseRubricAndCouncilSchedule.test.js`, `backend/tests/integration/defensePublicationImmutability.test.js`, `frontend/tests/councilReadOnlyMode.test.js`.

**Interfaces:** Existing `confirm-and-publish-schedule` performs publication only after assignment confirmation, eligibility/publication prerequisites and complete ordered council roster. Reuse `splitConfirmedStudentsIntoShifts`: `N=22 -> 11/11`, `N=23 -> 12/11`. Reject missing room/date, duplicate room or lecturer, incomplete/foreign IDs, and changes to already published councils except audited adjustment route.

- [ ] **Step 1: Write failing backend/contract tests.** Publication without confirmed assignment/room/date fails; ordered IDs must equal exact council roster; 22/23 split preserves order; published schedule remains immutable except reasoned adjustment with audit/notification.
- [ ] **Step 2: Run focused tests; expect FAIL on missing guards.** `npm --prefix backend test -- --runTestsByPath tests/integration/defenseRubricAndCouncilSchedule.test.js tests/integration/defensePublicationImmutability.test.js`; `npm --prefix frontend test -- tests/councilReadOnlyMode.test.js`.
- [ ] **Step 3: Guard publication and update CouncilDetail UI to distinguish confirmed assignment from published schedule.** Do not create per-student appointment times. Keep the existing reason/audit path for post-publication changes.
- [ ] **Step 4: Run focused tests, final assignment integration tests and frontend build; expect PASS.** `npm --prefix backend test -- --runTestsByPath tests/integration/defenseCouncilAssignmentPreview.test.js tests/integration/defenseRubricAndCouncilSchedule.test.js tests/integration/defensePublicationImmutability.test.js`; `npm --prefix frontend test -- tests/councilReadOnlyMode.test.js`; `npm --prefix frontend run build`.
- [ ] **Step 5: Commit only Task 6 files.** `git add` named files; `git commit -m "fix: validate defense schedule publication"`.

## Execution notes

Read this plan together with the approved spec and prerequisite expertise plan. Check `git status` before each task; keep unrelated work untouched. Apply migrations to a local/test database before any real environment. Review final diff for `TopicRegistration`, Admin/Giáo vụ permissions, all-or-nothing confirm, no mock data, UTF-8 no BOM and button icon rules. Production deployment is a separate release step.
