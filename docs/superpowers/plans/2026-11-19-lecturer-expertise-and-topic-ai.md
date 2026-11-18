# Lecturer Expertise and Topic AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin lưu chuyên môn thật của giảng viên qua form/Excel và nhận gợi ý ghép chuyên môn đề tài có chứng cứ, với duyệt thủ công khi chưa chắc chắn.

**Architecture:** `User.expertiseAreas` lưu danh sách cụm chuyên môn; `TopicExpertiseAssessment` lưu kết quả ghép theo fingerprint của tên đề tài hiệu lực, mô tả và tập chuyên môn. Dịch vụ AI dùng Ollama hiện có, chỉ chọn chuyên môn đã lưu; đối chiếu trực tiếp mới tự chấp nhận, còn lại Admin duyệt. Kế hoạch phân hội đồng dùng các ghép đã được chấp nhận ở kế hoạch kế tiếp.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5/Jest, Ollama provider hiện có, React 19/Ant Design 6/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-defense-council-assignment-preview-and-expertise-design.md`, mục 1–3 và 8.

## Global Constraints

- Chỉ Admin (`USER_MANAGE`/`USER_IMPORT` cùng role `ADMIN`) thêm/sửa/import chuyên môn giảng viên; không mở quyền này cho `GIAO_VU`.
- Chuyên môn là một hoặc nhiều cụm ngắn, Excel tách bằng dấu `;`; bắt buộc cho giảng viên mới, giữ dữ liệu lịch sử nhưng không dùng giảng viên thiếu chuyên môn để phân hội đồng.
- AI chỉ dùng tên đề tài hiệu lực, mô tả thực chất và chuyên môn thật; không tạo nhãn mới, không dùng nhãn hồ sơ giả. Kết quả suy luận/thiếu chứng cứ/lỗi là `NEEDS_REVIEW`.
- Giữ `TopicRegistration`, `maxStudents = 1`, tối đa 10 sinh viên/GVHD. File `.md`, `.js`, `.jsx`, `.json`, `.prisma` UTF-8 không BOM; nút có icon dùng prop `icon` từ `@ant-design/icons`.

## Review Focus

1. Excel có nhãn lặp, khoảng trắng thừa hoặc ô chuyên môn rỗng: chuẩn hóa hoặc báo lỗi từng dòng, không lưu `[]` cho giảng viên mới (Task 1–2).
2. Import trùng mã/email ở chế độ cập nhật và dòng role `ADMIN`: không hạ cấp tài khoản hoặc đổi chuyên môn của Admin (Task 2).
3. Đề tài đổi tên hiệu lực sau BM02-A hoặc giảng viên đổi chuyên môn: fingerprint cũ không được dùng để phân (Task 4).
4. Ollama trả nhãn ngoài danh sách, JSON lỗi, timeout hoặc chứng cứ không có trong đề tài: cần duyệt thủ công, không tự chấp nhận (Task 4).
5. Giảng viên lịch sử thiếu chuyên môn: hiển thị yêu cầu bổ sung và loại khỏi tập ứng viên hội đồng mà không xóa tài khoản (Task 3, 5).

---

## File map

- `backend/prisma/schema.prisma` và migration: `User.expertiseAreas`, `TopicExpertiseAssessment`.
- `backend/src/services/lecturerExpertiseService.js` (mới): chuẩn hóa danh sách và kiểm tra bắt buộc.
- `backend/src/controllers/userController.js`, `backend/src/utils/excelHelper.js`: CRUD, import/export, mẫu Excel.
- `backend/src/services/topicExpertiseService.js` (mới): tính fingerprint, gọi `chatWithOllama`, kiểm chứng nhãn/chứng cứ, lưu/duyệt.
- `backend/src/controllers/topicExpertiseController.js` và `backend/src/routes/topicExpertiseRoutes.js` (mới), `backend/src/routes/index.js`: chỉ Admin yêu cầu gợi ý/duyệt; Giáo vụ chỉ xem kết quả.
- `frontend/src/pages/admin/UserManagementPage.jsx`, `frontend/src/components/common/ExcelImportModal.jsx`, `frontend/src/pages/admin/CouncilAssignmentPage.jsx`: nhập chuyên môn và duyệt đề tài chưa chắc chắn.

### Task 1: Lưu và chuẩn hóa chuyên môn giảng viên

**Files:** Modify `backend/prisma/schema.prisma`; create `backend/prisma/migrations/20261119130000_lecturer_expertise/migration.sql`, `backend/src/services/lecturerExpertiseService.js`, `backend/tests/services/lecturerExpertiseService.test.js`.

**Interfaces:** Produce `normalizeExpertiseAreas(input) -> string[]` (accept array or semicolon-separated string; trim, collapse spaces, case-insensitive dedupe, retain display spelling), `assertLecturerExpertise(areas) -> string[]` (throw if empty). `User.expertiseAreas Json` defaults to `[]` for historical rows; only `LECTURER` creation/update requires nonempty values.

- [ ] **Step 1: Write failing tests.** Assert `"AI ; Xử lý ảnh; ai"` yields `['AI','Xử lý ảnh']`, empty/whitespace rejects, a historical `[]` remains readable, and no rule changes 10 SV/GVHD.
- [ ] **Step 2: Run focused Jest; expect FAIL on missing module.** `npm --prefix backend test -- --runTestsByPath tests/services/lecturerExpertiseService.test.js`
- [ ] **Step 3: Implement service, schema and additive migration.** Backfill existing users with `[]`; do not overwrite any existing profile data or change `User.role`.
- [ ] **Step 4: Verify focused test and schema.** Same Jest command PASS; `npm --prefix backend exec prisma validate` PASS.
- [ ] **Step 5: Commit only Task 1 files.** `git add` the four paths; `git commit -m "feat: store lecturer expertise areas"`.

### Task 2: Đồng bộ form người dùng và Excel ở backend

**Files:** Modify `backend/src/controllers/userController.js`, `backend/src/utils/excelHelper.js`, `backend/src/routes/userRoutes.js`; test `backend/tests/integration/userImportSecurity.test.js`, `backend/tests/utils/excelHelper.test.js`; create `backend/tests/integration/lecturerExpertiseUsers.test.js`.

**Interfaces:** Existing user create/update/detail/list/template/import/export payloads carry `expertiseAreas: string[]` for lecturers. Excel column `Chuyên môn` accepts semicolon-separated phrases. `USER_MANAGE`/`USER_IMPORT` endpoints reject a non-`ADMIN` actor for lecturer create/update/import even if a lecturer account holds those broad permissions.

- [ ] **Step 1: Write failing route/Excel tests.** Assert manual create/update requires expertise; lecturer template contains `Chuyên môn`; import parses valid rows and reports missing expertise per row; duplicate update preserves role protection; export round-trips phrases; student import remains unchanged; `GIAO_VU` cannot write lecturer profiles.
- [ ] **Step 2: Run three focused Jest files; expect FAIL on absent column/field.** `npm --prefix backend test -- --runTestsByPath tests/integration/lecturerExpertiseUsers.test.js tests/integration/userImportSecurity.test.js tests/utils/excelHelper.test.js`
- [ ] **Step 3: Pass Task 1 normalization through create/update/import and all lecturer read/export paths.** Preserve existing duplicate and security behavior. Correct the lecturer Excel example quota to `10` and do not introduce 15/20 quota behavior.
- [ ] **Step 4: Run the same tests; expect PASS.**
- [ ] **Step 5: Commit only Task 2 files.** `git add` named controller/route/helper/tests; `git commit -m "feat: capture lecturer expertise in user workflows"`.

### Task 3: Nhập chuyên môn trên giao diện Admin

**Files:** Modify `frontend/src/pages/admin/UserManagementPage.jsx`, `frontend/src/components/common/ExcelImportModal.jsx`, `frontend/src/pages/common/ProfilePage.jsx`; create `frontend/runtime-tests/lecturerExpertiseEntry.spec.jsx`.

**Interfaces:** Manual editor converts chips to `expertiseAreas`; Excel preview parses cột `Chuyên môn` into the same array before existing import action. Existing lecturer details show stored areas; historical empty areas show `Cần bổ sung chuyên môn`, never hardcoded fallback tags.

- [ ] **Step 1: Write failing runtime tests.** Create/edit submits normalized phrases, empty lecturer expertise blocks submit, Excel preview displays row errors, imported values reach payload, legacy lecturer displays missing state, `GIAO_VU` has no edit control.
- [ ] **Step 2: Run focused Vitest; expect FAIL.** `npm --prefix frontend run test:runtime -- runtime-tests/lecturerExpertiseEntry.spec.jsx`
- [ ] **Step 3: Implement form/Excel preview and remove placeholder interests.** Reuse existing user service/query actions; do not alter student fields or add mock expertise.
- [ ] **Step 4: Run focused Vitest; expect PASS.**
- [ ] **Step 5: Commit only Task 3 files.** `git add` named UI/test; `git commit -m "feat: edit lecturer expertise in admin UI"`.

### Task 4: AI ghép đề tài với chuyên môn có duyệt

**Files:** Modify `backend/prisma/schema.prisma`, `backend/src/routes/index.js`; create `backend/prisma/migrations/20261119140000_topic_expertise_assessment/migration.sql`, `backend/src/services/topicExpertiseService.js`, `backend/src/controllers/topicExpertiseController.js`, `backend/src/routes/topicExpertiseRoutes.js`, `backend/tests/services/topicExpertiseService.test.js`, `backend/tests/integration/topicExpertiseRoutes.test.js`.

**Interfaces:** `assessTopicExpertise({registrationId,actorId}, {db}) -> assessment`, `approveTopicExpertise({topicId,expertiseAreas,actorId}, {db}) -> assessment`, `getAcceptedExpertise(topicId, {db}) -> string[] | null`. Persist `TopicExpertiseAssessment` keyed by `topicId`: effective-title/description/expertise fingerprint, candidate/accepted areas, exact evidence, `AUTO_ACCEPTED | NEEDS_REVIEW | APPROVED`, `reviewedById/At`, model identifier and timestamps. A direct normalized phrase match with exact evidence in topic text may auto-accept; semantic inference or malformed/failed Ollama response requires review. `getAcceptedExpertise` returns `null` when fingerprint is stale.

- [ ] **Step 1: Write failing service/route tests.** Exact evidence auto-accepts; semantic-only candidate, missing description/evidence, unknown label, bad JSON, timeout and no lecturer areas require review; title adjustment or expertise edit invalidates assessment; only Admin approves, Giáo vụ reads.
- [ ] **Step 2: Run focused Jest; expect FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/topicExpertiseService.test.js tests/integration/topicExpertiseRoutes.test.js`
- [ ] **Step 3: Implement migration and service using `resolveEffectiveTopicTitle` and `chatWithOllama`.** Validate AI output against stored lecturer expertise, persist source evidence and fingerprint, never silently accept on provider failure. Register the route under existing authenticated router structure; retain decision history through updated timestamps/reviewer.
- [ ] **Step 4: Run focused tests plus existing Ollama workflow tests; expect PASS.** `npm --prefix backend test -- --runTestsByPath tests/services/topicExpertiseService.test.js tests/integration/topicExpertiseRoutes.test.js tests/integration/ollamaRagWorkflow.test.js`
- [ ] **Step 5: Commit only Task 4 files.** `git add` named schema/migration/service/controller/route/tests; `git commit -m "feat: assess topic expertise with review"`.

### Task 5: Duyệt đề tài chưa chắc chắn trên giao diện

**Files:** Create `frontend/src/components/admin/TopicExpertiseReviewPanel.jsx`, `frontend/runtime-tests/topicExpertiseReview.spec.jsx`; modify `frontend/src/pages/admin/CouncilAssignmentPage.jsx`, `frontend/src/services/councilService.js` or a focused new topic-expertise service, `frontend/src/queries/councilQueries.js` if query invalidation is needed.

**Interfaces:** Panel shows effective title, suggested existing area, exact evidence/status and Admin approval control for `NEEDS_REVIEW`; auto-accepted items are read-only. Empty/stale/provider-error states are visible. Giáo vụ can read without approval controls. Output is the accepted assessment consumed by the next plan.

- [ ] **Step 1: Write failing runtime tests.** Only uncertain items request approval; chosen area must exist in lecturer expertise; stale item returns to review; provider failure offers manual choice; role controls match Admin/Giáo vụ.
- [ ] **Step 2: Run focused Vitest; expect FAIL.** `npm --prefix frontend run test:runtime -- runtime-tests/topicExpertiseReview.spec.jsx`
- [ ] **Step 3: Implement panel and connect real API/query invalidation.** Use current user permissions, loading/error states and Ant Design icon props; no hardcoded expertise fallback.
- [ ] **Step 4: Run focused Vitest and build; expect PASS.** `npm --prefix frontend run test:runtime -- runtime-tests/topicExpertiseReview.spec.jsx`; `npm --prefix frontend run build`.
- [ ] **Step 5: Commit only Task 5 files.** `git add` named UI/service/query/tests; `git commit -m "feat: review uncertain topic expertise"`.

## Handoff to assignment plan

The next plan consumes `User.expertiseAreas` and `getAcceptedExpertise(topicId, {db})`; it must reject missing/stale assessments and legacy lecturers without expertise. The expertise feature is independently reviewable through user management and the topic review panel. Do not apply migrations to production or deploy without the appropriate release step.
