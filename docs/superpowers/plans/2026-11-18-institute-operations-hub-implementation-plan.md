# Institute Operations Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Viện trưởng có một mục “Điều hành học vụ” mở trang ba tab Thẩm định, Quyết định, Công bố, thao tác trực tiếp trên hàng đợi đúng quyền và phạm vi.

**Architecture:** Giữ `/lecturer/institute` nhưng thay `ProjectPeriodPage` bằng `InstituteOperationsPage`; `/admin/project-periods` vẫn dùng trang quản lý đợt. Backend thêm API đọc hàng đợi có lọc capability/resource scope và phân trang, dùng các service mutation hiện có. Frontend tách/tái dùng form nghiệp vụ từ các trang cũ, không sao chép logic phê duyệt hoặc công bố.

**Tech Stack:** PostgreSQL/Prisma, Express/CommonJS/Jest, React 19/React Router 7/TanStack Query, Ant Design, Vitest/Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-role-sidebar-workflow-and-institute-hub-design.md` (mục 4–7). Thực hiện sau `2026-11-18-workflow-sidebar-implementation-plan.md` để menu/policy/route guard đã thống nhất.

## Global Constraints

- `TopicRegistration` là mô hình đăng ký duy nhất; `maxStudents = 1`, GVHD tối đa 10 sinh viên. Không tạo lại `group/groupMember`.
- Thứ tự CSDL/Prisma → backend read/action guard → frontend. Không dùng dữ liệu giả hoặc số đếm lấy từ preview giới hạn.
- Mỗi tab/item/action kiểm tra capability và resource scope trên backend. `role === 'ADMIN'`, tên group hoặc điều kiện frontend không cấp quyền học vụ.
- Điểm BM05 và nhận xét chưa công bố không lộ qua hàng đợi, preview hoặc thông báo; giữ transaction/audit/permissionVersion của mutation hiện có.
- Nút dùng `@ant-design/icons` qua prop `icon`, label tiếng Việt thuần; file text/code UTF-8 không BOM.
- Giữ mọi thay đổi ngoài phạm vi đang có trong working tree. Mỗi task có test và commit riêng sau review; chỉ cập nhật `CLAUDE.md` khi người dùng nói `end phiên`.

## Review Focus

1. Viện trưởng có BM03/BM04 capability nhưng thiếu `VIEW_PROJECT_OVERSIGHT`: hub vẫn đọc/xử lý hồ sơ được cấp quyền, không dựa vào trang `/admin/oversight` rộng quyền (Task 1, 3).
2. Actor chỉ có quyền xem của một tab: tab và hồ sơ đọc được nhưng không có mutation; POST/PUT/DELETE bị backend từ chối (Task 1–2, 3–5).
3. `semesterId`/`registrationId`/`councilId` client trỏ kỳ hoặc đơn vị khác: API trả 403 hoặc bỏ item ngoài scope; không dùng filter client để cấp quyền (Task 1–2).
4. Bản công bố chưa có hoặc chưa phê duyệt: tab Công bố không làm lộ điểm BM05 và không cho publish; idempotent replay không tạo bản công bố đôi (Task 2, 5).
5. Deep link cũ, query param thêm và Back/Forward: mở đúng tab/hồ sơ, không mở modal sai hoặc lặp mutation; tab không có quyền không thể truy cập bằng URL (Task 3, 6).

---

### Task 1: Schema và API đọc hàng đợi Thẩm định có scope

**Files:**
- Read/validate: `backend/prisma/schema.prisma` (`BM02Submission`, `TopicRegistration`, `InstituteStopReview`, `InstituteDefenseReview`, `Semester`)
- Create: `backend/src/services/instituteOperationsService.js`
- Create: `backend/src/controllers/instituteOperationsController.js`
- Create: `backend/src/routes/instituteOperationsRoutes.js`
- Modify: `backend/src/routes/index.js`
- Create: `backend/tests/services/instituteOperationsService.test.js`
- Create: `backend/tests/integration/instituteOperations.routes.test.js`

**Interfaces:**
- Produces: `getInstituteOperations({ actor, tab, semesterId, status?, page=1, pageSize=20, db, now }) -> { tab, semester, items, pagination, counts, generatedAt }`.
- Produces: `GET /api/institute/operations?tab=review|decisions|publish&semesterId=<id>&status=<code>&page=<n>`; `items[]` có `id, kind, resourceId, registrationId?, title, status, dueAt?, allowedActions[], detailTarget`.
- Preserves: các API mutation BM02/BM03/BM04 hiện có; API mới chỉ đọc và không cấp quyền qua dữ liệu client.

- [x] **Step 1: Kiểm tra schema trước khi code.** `npm --prefix backend exec prisma validate`; xác nhận relation/index phục vụ actor + semester + trạng thái. Chỉ thêm migration nếu thiếu ràng buộc thực sự cho query, không đổi workflow hoặc `TopicRegistration`.
- [x] **Step 2: Viết test fail cho `review`.** Fixtures có BM02 nộp lần 1/nộp lại, BM03 stop review, BM04 defense review và appeal; hai kỳ/hai đơn vị; actor có một quyền view, actor có action quyền, actor thiếu cả hai. Assert chỉ item trong scope, `allowedActions` rỗng cho view-only, tổng `counts.review` tính trước phân trang, `pageSize` tối đa 50, query sai tab/page trả 400, không có quyền tab trả 403.
- [x] **Step 3: Chạy test để xác nhận fail.** `npm --prefix backend test -- --runTestsByPath tests/services/instituteOperationsService.test.js tests/integration/instituteOperations.routes.test.js`.
- [x] **Step 4: Implement query/guard Thẩm định.** Tạo các source nhỏ trong service, dùng capability đúng (`BM02_REVIEW`, `BM03_STOP_REVIEW`, `BM04_REJECTION_REVIEW`, `SIGNATURE_APPEAL_REVIEW` và quyền view tương ứng) và `resolveResourceScope`/`validateAcademicScope` theo resource. Không gọi `/api/manual-review-cases` mặc định vì router hiện cần `PROJECT_OVERSIGHT_MANAGE`. Tái dùng predicate trạng thái ở service nghiệp vụ; không tự suy ra deadline khi DB không có.
- [x] **Step 5: Chạy lại test và commit.** Test bước 3 và Prisma validate PASS; commit `feat(institute): add scoped review queue`.

### Task 2: Hàng đợi Quyết định/Công bố và kiểm tra hành động backend

**Files:**
- Modify: `backend/src/services/instituteOperationsService.js`, `backend/tests/services/instituteOperationsService.test.js`, `backend/tests/integration/instituteOperations.routes.test.js`
- Modify only if tests reveal mismatch: `backend/src/routes/bm02WorkflowRoutes.js`, `backend/src/routes/bm04Routes.js`, `backend/src/routes/evaluationRoutes.js`, `backend/src/routes/councilRoutes.js`, `backend/src/routes/archiveRoutes.js`
- Test: `backend/tests/integration/bm02AndDecisionWorkflow.test.js`, `backend/tests/integration/bm02aAndAppendixWorkflow.test.js`, `backend/tests/services/defenseResultPublicationService.test.js`

**Interfaces:**
- Extends: `getInstituteOperations` for `decisions` and `publish`, with `counts` from authorized full query and `items` paginated.
- Preserves: POST action APIs và lifecycle phê duyệt, ký, công bố hiện có; `allowedActions[]` chỉ chứa action mà API mutation chấp nhận tại trạng thái/resource đó.

- [x] **Step 1: Viết test fail.** `decisions`: quyết định giao đề tài, phụ lục BM02-A, giấy xác nhận, phê duyệt kết quả; `publish`: danh sách đủ điều kiện và kết quả chính thức. Kiểm tra capability view/action tách biệt, khác kỳ/đơn vị, resource state chưa đủ điều kiện, điểm BM05 chưa công bố, và nhiều item hơn một trang. Assert actor chỉ có quyền một action không nhận các item/action khác.
- [x] **Step 2: Chạy test để xác nhận fail.** `npm --prefix backend test -- --runTestsByPath tests/services/instituteOperationsService.test.js tests/integration/instituteOperations.routes.test.js tests/integration/bm02AndDecisionWorkflow.test.js tests/integration/bm02aAndAppendixWorkflow.test.js tests/services/defenseResultPublicationService.test.js`.
- [x] **Step 3: Implement sources Quyết định/Công bố.** Dùng `AssignmentDecision`, BM02-A appendix, archive/clearance, `DefenseResultApproval`, `ResultPublication`, council eligible-list state; kiểm tra quyền từng resource. Không dùng `VIEW_PROJECT_OVERSIGHT` làm điều kiện thay thế cho `BM03_STOP_REVIEW`/`BM04_REJECTION_REVIEW`. Giữ action routes hiện có; chỉ sửa guard sai nếu test chứng minh mismatch, không nới quyền hàng loạt.
- [x] **Step 4: Chạy lại test và commit.** Test bước 2 PASS; commit `feat(institute): expose scoped decision and publication queues`.

### Task 3: Trang hub và tab Thẩm định

**Files:**
- Create: `frontend/src/pages/lecturer/InstituteOperationsPage.jsx`
- Create: `frontend/src/services/instituteOperationsService.js`
- Create: `frontend/src/queries/instituteOperationsQueries.js`
- Create: `frontend/src/components/institute/ReviewQueue.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/auth/featurePolicies.js`
- Extract/reuse: `frontend/src/pages/admin/ProjectPeriodPage.jsx` (`BM02ReviewDrawer`), `frontend/src/pages/admin/ProjectOversightPage.jsx` (BM03/BM04 review action components)
- Create: `frontend/runtime-tests/instituteReviewHub.spec.jsx`

**Interfaces:**
- Produces: `useInstituteOperations(scope, { tab, semesterId, status, page })` với query key identity + permission version + filter.
- Produces: `/lecturer/institute?tab=review` là tab thao tác Thẩm định; menu chỉ có một feature `lecturer-institute` nhãn “Điều hành học vụ”.

- [x] **Step 1: Viết runtime test fail.** Actor view-only thấy hàng đợi BM02/BM03/BM04 được phép nhưng không có nút mutation; actor đủ quyền mở form và gửi một mutation; actor thiếu quyền không thấy tab. Loading/empty/error riêng, đổi kỳ xóa dữ liệu kỳ cũ, không gọi API nguồn không có quyền.
- [x] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/instituteReviewHub.spec.jsx`.
- [x] **Step 3: Dựng route/hub với tab Thẩm định.** Lấy `allowedActions` từ API, tái dùng service/form BM02 và BM03/BM04 thay vì chép business logic; khi mutation thành công invalidate query hub và query màn cũ. Route guard cho phép view capability của ít nhất một tab, không dựa vào role label. Chưa bật mục menu mới cho người dùng cho đến khi cả ba tab hoàn tất ở Task 5; các URL cũ vẫn dùng được trong giai đoạn này.
- [x] **Step 4: Chạy test và commit.** Test bước 2 và `npm --prefix frontend run build` PASS; commit `feat(institute): add review hub tab`.

### Task 4: Tab Quyết định và công cụ ủy quyền

**Files:**
- Create: `frontend/src/components/institute/DecisionQueue.jsx`
- Modify: `frontend/src/pages/lecturer/InstituteOperationsPage.jsx`, `frontend/src/queries/instituteOperationsQueries.js`
- Extract/reuse: `frontend/src/pages/admin/ProjectPeriodPage.jsx` (issue decision, appendix, delegation), `frontend/src/pages/admin/ProjectOversightPage.jsx` (clearance sign), `frontend/src/pages/admin/GradingDefensePage.jsx` (result approval)
- Create: `frontend/runtime-tests/instituteDecisionHub.spec.jsx`

**Interfaces:**
- Produces: `?tab=decisions`, `?tab=delegations` mở công cụ ủy quyền theo ngữ cảnh; không thêm tab thứ tư/menu thứ hai.
- Preserves: transaction/audit và xác nhận của các mutation hiện có.

- [x] **Step 1: Viết runtime test fail.** View-only thấy hồ sơ nhưng không có nút ban hành/ký/phê duyệt; actor đủ quyền thực hiện một mutation rồi item/count cập nhật; `?tab=decisions` và deep link cũ `?tab=periods` mở tab Quyết định; `?tab=delegations` mở công cụ ủy quyền chỉ khi có quyền.
- [x] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/instituteDecisionHub.spec.jsx`.
- [x] **Step 3: Implement tab.** Tách component/hook nghiệp vụ dùng chung, gọi mutation hiện có đúng payload/idempotency; không dựng bản sao logic quyết định. Ủy quyền là drawer/secondary tool và tuân `PERMISSION_ASSIGN_ACADEMIC` + scope.
- [x] **Step 4: Chạy test và commit.** Test bước 2 và build PASS; commit `feat(institute): add decision actions and delegation tool`.

### Task 5: Tab Công bố và deep link tương thích

**Files:**
- Create: `frontend/src/components/institute/PublicationQueue.jsx`
- Modify: `frontend/src/pages/lecturer/InstituteOperationsPage.jsx`, `frontend/src/queries/instituteOperationsQueries.js`
- Extract/reuse: `frontend/src/pages/admin/GradingDefensePage.jsx` (publication preview/history/modal), `frontend/src/pages/admin/CouncilAssignmentPage.jsx` (publish eligible list)
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx` only to preserve legacy admin behavior after route split
- Create: `frontend/runtime-tests/institutePublicationHub.spec.jsx`
- Modify: `frontend/src/pages/__tests__/councilAndGradingDeepLinking.test.js`

**Interfaces:**
- Produces: `?tab=publish` with preview/history/action theo `RESULT_PUBLICATION_PUBLISH` và capability công bố danh sách đủ điều kiện.
- Maps: `?tab=bm02`/`bm02Queue` → `review`; `periods`/`decisions` → `decisions`; `delegations` → secondary tool; URL admin cũ vẫn tới chức năng cho actor có quyền.

- [x] **Step 1: Viết test fail.** Actor chỉ có view thấy preview phù hợp nhưng không publish; actor có quyền công bố thấy nút và xác nhận; không hiện điểm chưa công bố ở nơi không được phép. Deep link cũ mở đúng tab/tool; Back/Forward khôi phục tab và resource; query param thêm không làm sai active menu.
- [x] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/institutePublicationHub.spec.jsx`; `node --test frontend/src/pages/__tests__/councilAndGradingDeepLinking.test.js`.
- [x] **Step 3: Implement Công bố.** Tái dùng preview/history/mutation hiện có; sau publish invalidate đúng query và phản ánh bản công bố. Giữ `ProjectPeriodPage` cho `/admin/project-periods`; không redirect admin URL theo role một cách mù. Dùng `setSearchParams` có history đúng với tab selection, không mở modal lặp khi Back/Forward. Khi ba tab đều hoạt động, bật đúng một mục “Điều hành học vụ” trong menu workspace lecturer và loại các mục Viện trưởng trùng chức năng.
- [x] **Step 4: Chạy test và commit.** Test bước 2, lint/build PASS; commit `feat(institute): add publication tab and legacy links`.

### Task 6: Kiểm tra năm persona, bảo mật và bàn giao

**Files:**
- Create: `frontend/e2e/institute-operations-hub.spec.js`
- Modify: `frontend/runtime-tests/fivePersonaPolicies.spec.jsx`, `frontend/e2e/rbac-five-persona.spec.js`
- Modify: `docs/superpowers/plans/2026-11-18-institute-operations-hub-implementation-plan.md` để tick bước có bằng chứng PASS

- [x] **Step 1: Viết E2E/hợp đồng persona.** Sinh viên/GVHD thường không thấy hub hoặc bị chặn khi truy cập trực tiếp; Viện trưởng và actor được ủy quyền chỉ thấy tab/hành động trong capability + resource scope. Test từ menu vào ba tab, deep link, đổi kỳ, lỗi API, revoke quyền, view-only, công bố idempotent và dữ liệu BM05 chưa công bố.
- [x] **Step 2: Chạy backend regression.** `npm --prefix backend test -- --runTestsByPath tests/integration/instituteOperations.routes.test.js tests/integration/bm02AndDecisionWorkflow.test.js tests/integration/bm02aAndAppendixWorkflow.test.js tests/services/defenseResultPublicationService.test.js`; thêm test BM03/BM04/clearance/eligible publication đã chạm; `npm --prefix backend exec prisma validate`.
- [x] **Step 3: Chạy frontend regression.** Các runtime test Task 3–5, `npm --prefix frontend run test:e2e -- e2e/institute-operations-hub.spec.js e2e/rbac-five-persona.spec.js`, lint/build. Kiểm tra 375/768/1024/1440px, keyboard, deep link và trạng thái empty/error.
- [x] **Step 4: Rà soát và commit.** `git diff --check`, UTF-8 không BOM, không mock, `group/groupMember`, icon thô, role bypass, menu trùng, route chết hoặc dữ liệu BM05 chưa công bố. Chỉ tick task PASS, commit riêng checklist, báo rủi ro còn lại; không cập nhật `CLAUDE.md` trước `end phiên`.
