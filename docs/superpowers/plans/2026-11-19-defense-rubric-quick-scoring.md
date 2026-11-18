# Defense Rubric Quick Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho thành viên hội đồng chấm nhanh từng mục hoặc các mục trống trong một nhóm bằng bốn mức, chỉnh điểm thủ công, và khóa sổ đúng khi đủ phiếu hợp lệ.

**Architecture:** `RubricVersion` giữ chính sách ngưỡng và điểm gợi ý; phiếu chỉ lưu điểm số và phiên bản rubric. Backend là nguồn xác thực điểm, quyền và trạng thái khóa; hai giao diện chấm dùng chung logic chọn mức, tính điểm và điền mục trống. Tổng điểm hội đồng chỉ được ghi khi đủ phiếu đã khóa.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5/Jest, React 19/Ant Design 6/Vitest, Playwright khi cần kiểm chứng trình duyệt.

**Spec:** `docs/superpowers/specs/2026-11-19-defense-rubric-quick-scoring-design.md`

## Global Constraints

- Luồng hồ sơ dùng `TopicRegistration`; một sinh viên/một đề tài, tối đa 10 sinh viên/GVHD.
- Bốn mức: Tốt 85–100% gợi ý 90%; Khá 70–<85% gợi ý 75%; Trung bình 50–<70% gợi ý 60%; Kém 0–<50% gợi ý 30%.
- Điểm mỗi mục có độ phân giải 0,01, thuộc `[0, maxScore]`; mục trống khác điểm `0`; không có điểm ngẫu nhiên hay điểm tự điền khi mở phiếu.
- Chọn mức theo nhóm chỉ điền mục trống. Lưu nháp có thể thiếu mục; khóa phiếu đòi đủ mục. Phiếu đã khóa chỉ đọc.
- Phiên bản rubric đã có phiếu không được đổi chính sách. Tổng điểm hội đồng chỉ ghi khi đủ 3 hoặc 4 phiếu khóa của thành viên chấm có hiệu lực; vắng mặt theo nhánh riêng.
- Nút có icon dùng `icon={<IconComponent />}` từ `@ant-design/icons`, nhãn thuần tiếng Việt. File `.md`, `.js`, `.jsx`, `.json`, `.prisma` UTF-8 không BOM.
- Workspace hiện có sửa đổi chưa commit ở `councilController.js`, `GradingPage.jsx`, `evaluationService.js` và hai bài test liên quan; giữ nguyên, không gom vào commit của kế hoạch này.

## Review Focus

1. Rubric đã gắn với hồ sơ nhưng bị xóa/không tải được: trả lỗi rõ, không âm thầm lấy rubric active khác (Task 2).
2. Điểm `0`, chuỗi rỗng và số có hơn hai chữ số thập phân: phân biệt mục đã chấm, mục trống và giá trị không hợp lệ (Task 3, 5).
3. Điểm gợi ý của tiêu chí `maxScore` nhỏ sau làm tròn 0,01 vượt khỏi khoảng mức: từ chối rubric trước khi khóa (Task 1, 2).
4. Hai người lưu hoặc khóa phiếu gần nhau: không ghi điểm trung bình tạm thời thành điểm hội đồng chính thức (Task 3).
5. Hội đồng có người chấm thứ tư hoặc thành viên không có hiệu lực: đếm đúng người cần khóa phiếu và hiển thị đúng mẫu số (Task 3, 6).

---

## File map

- `backend/prisma/schema.prisma` và migration mới: lưu chính sách trên `RubricVersion`, backfill phiên bản cũ.
- `backend/src/services/rubricLevelPolicy.js` (mới): chuẩn hóa/kiểm tra policy, suy mức và tính điểm gợi ý; nguồn quy tắc cho rubric API.
- `backend/src/services/rubricService.js`, `backend/src/controllers/rubricController.js`: tạo, nhân bản, sửa, khóa và trả policy theo phiên bản.
- `backend/src/controllers/evaluationController.js`, `backend/src/services/defenseScoringService.js`: lấy rubric đã chốt, lưu nháp, khóa phiếu và khóa sổ qua cùng kiểm tra nghiệp vụ.
- `frontend/src/utils/rubricLevelPolicy.js` (mới), `frontend/src/components/grading/RubricQuickScore.jsx` (mới): tính mức từ policy API và điều khiển chấm từng mục/theo nhóm.
- `frontend/src/pages/admin/RubricManagementPage.jsx`, `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`, `frontend/src/pages/admin/GradingDefensePage.jsx`: quản lý chính sách và tích hợp chấm nhanh.

### Task 1: Chính sách mức điểm trong Prisma và service

**Files:** Create `backend/prisma/migrations/20261119120000_rubric_level_policy/migration.sql`, `backend/src/services/rubricLevelPolicy.js`, `backend/tests/services/rubricLevelPolicy.test.js`; modify `backend/prisma/schema.prisma`.

**Interfaces:** Produce `DEFAULT_RUBRIC_LEVEL_POLICY`, `normalizeRubricLevelPolicy(input) -> policy`, `validateRubricLevelPolicy(policy, criteria) -> {ok, message}`, `suggestCriterionScore(maxScore, levelCode, policy) -> number`, `getCriterionLevel(score, maxScore, policy) -> levelCode`. Policy JSON shape: `{good:{minPercent:85,maxPercent:100,suggestedPercent:90},fair:{minPercent:70,maxPercent:85,suggestedPercent:75},average:{minPercent:50,maxPercent:70,suggestedPercent:60},poor:{minPercent:0,maxPercent:50,suggestedPercent:30}}`; lower inclusive, upper exclusive except `good` includes 100.

- [ ] **Step 1: Write failing tests.** In `rubricLevelPolicy.test.js`, assert default values, boundaries `0/50/70/85/100`, suggestions for `maxScore=1` (`0.30/0.60/0.75/0.90`), two-decimal rounding, invalid gap/overlap/suggestion, and unrepresentable small `maxScore`.
- [ ] **Step 2: Run the test; expect FAIL because module/API is absent.** `npm --prefix backend test -- --runTestsByPath tests/services/rubricLevelPolicy.test.js`
- [ ] **Step 3: Implement the five exports.** Reject nonfinite/zero `maxScore` and invalid percentages; use integer hundredths when deriving/suggesting points to avoid binary-float boundary drift. Add `scoreLevelPolicy Json` to `RubricVersion`; migration sets the default JSON for all existing rows without changing scores or locks. Add `@map("score_level_policy")`.
- [ ] **Step 4: Verify.** Same Jest command must PASS; `npm --prefix backend exec prisma validate` must PASS against the local schema.
- [ ] **Step 5: Commit only Task 1 files.** `git add` the four named paths, then `git commit -m "feat: version rubric scoring levels"`.

### Task 2: Rubric API và phiên bản gắn với hồ sơ

**Files:** Modify `backend/src/services/rubricService.js`, `backend/src/controllers/rubricController.js`, `backend/src/controllers/evaluationController.js`; test `backend/tests/integration/rubricRoutes.test.js`, `backend/tests/integration/defenseRubricAndCouncilSchedule.test.js`.

**Interfaces:** Consume Task 1 policy functions. `POST /api/v1/rubrics` and `PUT /api/v1/rubrics/:id` accept `scoreLevelPolicy`; rubric detail/list and `GET /api/v1/evaluations/:registrationId/score-sheet` return it. `formatRubricPayload` also returns all four criterion descriptions. `resolveRubricForRegistration` resolves the pinned version and reports a missing pinned version as error, never substitutes active rubric.

- [ ] **Step 1: Write failing route tests.** Assert create/default, clone/copy, update policy on unused draft, reject policy update on used/locked rubric, reject lock when a criterion cannot represent a suggested score, and return historical pinned policy/descriptions even when another rubric is active. Add missing pinned rubric case.
- [ ] **Step 2: Run affected Jest files; expect FAIL on missing policy/incorrect fallback.** `npm --prefix backend test -- --runTestsByPath tests/integration/rubricRoutes.test.js tests/integration/defenseRubricAndCouncilSchedule.test.js`
- [ ] **Step 3: Implement service/controller changes.** Preserve existing edit restrictions; validate the policy against criteria on create/update/lock; clone source policy unless caller explicitly supplies a new one. Return policy in score-sheet response and fallback `RUBRIC_V1` payload; avoid changing historical scores.
- [ ] **Step 4: Run the same tests; expect PASS.**
- [ ] **Step 5: Commit only Task 2 files.** `git add` named service/controller/tests, then `git commit -m "feat: serve versioned rubric level policy"`.

### Task 3: Một luồng lưu nháp, khóa phiếu và tổng hợp backend

**Files:** Modify `backend/src/controllers/evaluationController.js`, `backend/src/services/defenseScoringService.js`, `backend/src/routes/evaluationRoutes.js`; test `backend/tests/services/defenseScoringService.test.js`, `backend/tests/services/twoStepDefenseScoreLock.test.js`, `backend/tests/integration/defenseScoringAndScorebookReturn.test.js`.

**Interfaces:** Preserve `saveMemberScoreSheet({registrationId,evaluatorId,actorId,evaluatorRole,scores,generalComment,targetRubricVersion}, options)` and `lockMemberScoreSheet(...)`. Route aliases `PUT /evaluations/:registrationId/score-sheet` and `POST /evaluations/councils/:id/score-sheet` call the same save command. Draft accepts `scores: []` or a subset; lock requires exactly all rubric criterion codes and valid scores with at most two decimals. `GET score-sheet` returns `activeScorerCount` and `lockedScorerCount` from `resolveActiveScoringMembers`; scorebook lock calculates from that active set only.

- [ ] **Step 1: Write failing tests.** Assert empty/partial draft persists without fabricating zeroes; zero is a scored value; reject excess decimals, wrong criterion/version/max, outsider, mentor conflict and post-lock edit; reject incomplete lock. Verify two save aliases produce the same data. Assert no official `DefenseResult.finalScore` until all 3/4 effective members have locked; absent branch remains separate; PRESENT scorebook lock does not throw `ReferenceError`.
- [ ] **Step 2: Run the three focused Jest files; expect FAIL on partial draft, aggregate and scorebook cases.** `npm --prefix backend test -- --runTestsByPath tests/services/defenseScoringService.test.js tests/services/twoStepDefenseScoreLock.test.js tests/integration/defenseScoringAndScorebookReturn.test.js`
- [ ] **Step 3: Consolidate route/controller validation in the service.** Reuse Task 2 rubric resolution; remove controller-only duplicate save transaction and its partial-mean calculation. Validate score sheet on the server for draft vs lock; preserve ownership, admin delegation audit, idempotency and existing return/reopen rules. Do not use `Number(value || 0)` for blanks. Scope `validScores` so discrepancy calculation works for PRESENT and ABSENT.
- [ ] **Step 4: Run the focused tests; expect PASS.**
- [ ] **Step 5: Commit only Task 3 files.** `git add` named route/controller/service/tests, then `git commit -m "fix: validate member sheets before defense scorebook lock"`.

### Task 4: Quản lý chính sách mức điểm trên giao diện

**Files:** Modify `frontend/src/pages/admin/RubricManagementPage.jsx`; create `frontend/runtime-tests/rubricLevelManagement.spec.jsx`.

**Interfaces:** Consume `scoreLevelPolicy` from Task 2 via existing `frontend/src/services/rubricService.js`. Submit it in existing create/update payloads. Show four range boundaries and suggested percentages on rubric detail; only unused draft allows editing. Keep default values from Task 1 for a new rubric and copied values when cloning.

- [ ] **Step 1: Write failing runtime tests.** Assert default policy in create flow, clone inherits policy, invalid range gets an error, and used rubric shows read-only values.
- [ ] **Step 2: Run focused Vitest; expect FAIL.** `npm --prefix frontend run test:runtime -- runtime-tests/rubricLevelManagement.spec.jsx`
- [ ] **Step 3: Add the policy form and read-only summary.** Keep existing rubric create/update actions; display backend validation messages and use no local hardcoded range as the source for scorer pages.
- [ ] **Step 4: Run the test; expect PASS.**
- [ ] **Step 5: Commit only Task 4 files.** `git add` the page/test, then `git commit -m "feat: manage versioned rubric score levels"`.

### Task 5: Chấm nhanh trong phiếu giảng viên

**Files:** Create `frontend/src/utils/rubricLevelPolicy.js`, `frontend/src/components/grading/RubricQuickScore.jsx`, `frontend/runtime-tests/rubricQuickScore.spec.jsx`; modify `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`.

**Interfaces:** `getLevelForScore(score,maxScore,policy) -> code|null`, `getSuggestedScore(maxScore,levelCode,policy) -> number`, `fillEmptyCriteria(criteria,scoresMap,levelCode,policy) -> scoresMap`. `RubricQuickScore` receives rubric categories/policy, current scores, `disabled`, and `onScoresChange`; it renders per-item radio controls, numeric input, group fill and progress/subtotals. `null`/missing means empty; `0` means scored.

- [ ] **Step 1: Write failing utility/component tests.** Check `0` is preserved by group fill, existing manual scores stay, 1-point Tốt = `0.90`, edited `0.75` selects Khá, blank clears the level, group subtotal/progress update, and controls are disabled after lock. Test keyboard selection and 375px layout with a focused browser check if runtime DOM cannot cover layout.
- [ ] **Step 2: Run focused Vitest; expect FAIL on missing module/component.** `npm --prefix frontend run test:runtime -- runtime-tests/rubricQuickScore.spec.jsx`
- [ ] **Step 3: Implement utility/component and integrate lecturer page.** Use policy from `scoreSheet.rubric`; map existing `levelGoodDesc/levelFairDesc/levelAverageDesc/levelPoorDesc` to the visible descriptions (the page currently reads mismatched `descGood/...` names). Remove slider/empty-as-zero serialization. Save sends scored subset or `[]`; lock sends every criterion and is disabled until complete. Preserve comments and display accurate save/lock feedback.
- [ ] **Step 4: Run focused Vitest; expect PASS.**
- [ ] **Step 5: Commit only Task 5 files.** `git add` the four paths, then `git commit -m "feat: score defense rubric by level"`.

### Task 6: Trang quản trị, số người chấm và xác thực cuối

**Files:** Modify `frontend/src/pages/admin/GradingDefensePage.jsx`; create `frontend/runtime-tests/adminRubricQuickScore.spec.jsx`; test `frontend/tests/allowedActionsAndTwoStepLockUi.test.js` if its contracts change.

**Interfaces:** Reuse Task 5 `RubricQuickScore` and policy returned by Task 2. Admin scoring honors the same empty/zero/locked rules; member counter uses Task 3 `activeScorerCount` and `lockedScorerCount`, including the fourth scorer.

- [ ] **Step 1: Write failing UI tests.** Opening a new sheet leaves all criteria empty; group fill does not overwrite a manually edited item; policy comes from the pinned rubric; member counter displays `/4` when four effective scorers exist and excludes inactive/non-scoring members; incomplete sheet cannot lock.
- [ ] **Step 2: Run focused Vitest and contract test; expect FAIL on 85% prefill and `/3`.** `npm --prefix frontend run test:runtime -- runtime-tests/adminRubricQuickScore.spec.jsx` and `npm --prefix frontend test -- tests/allowedActionsAndTwoStepLockUi.test.js`.
- [ ] **Step 3: Integrate the shared control and remove the 85% prefill/fixed denominator.** Keep admin delegation permissions and existing result publication actions; do not alter unrelated grading-list files currently dirty in the workspace.
- [ ] **Step 4: Verify focused tests and production build.** Both commands above PASS; `npm --prefix frontend run build` PASS.
- [ ] **Step 5: Run final backend tests.** `npm --prefix backend test -- --runTestsByPath tests/integration/rubricRoutes.test.js tests/integration/defenseScoringAndScorebookReturn.test.js tests/services/twoStepDefenseScoreLock.test.js` must PASS; inspect any failure before widening test scope.
- [ ] **Step 6: Commit only Task 6 files.** `git add` the named admin page/tests, then `git commit -m "feat: use quick rubric scoring in defense administration"`.

## Execution notes

Before implementation, recheck `git status` because other work is present. Do not reset, stage or commit unrelated modifications. Keep the approved spec and this plan together when dispatching each task. Apply migration to a local/test database first; production deployment remains a separate authorized step. After Task 6, review the diff for `TopicRegistration`, no mock scores, UTF-8 no BOM and button icon rules, then report test evidence and any remaining risks.
