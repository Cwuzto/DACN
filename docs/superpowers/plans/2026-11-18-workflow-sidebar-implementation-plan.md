# Workflow Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menu bên trái của Sinh viên, GVHD và Quản trị/Giáo vụ phản ánh đúng công việc, theo giai đoạn đồ án, với một nguồn policy và route/quyền nhất quán.

**Architecture:** `FEATURE_POLICIES` là nguồn chuẩn cho mục menu; `NAVIGATION_REGISTRY` được dẫn xuất hoặc loại bỏ. Route, active state và trang đích được kiểm tra theo cùng feature policy, trong khi backend giữ quyền quyết định và scope. Trang “Sinh viên đang hướng dẫn” dùng API `TopicRegistration` GVHD đã có, không tạo dữ liệu giả.

**Tech Stack:** React 19, React Router 7, TanStack Query, Ant Design, Tailwind, Node test runner, Vitest, Playwright; Express/Prisma cho kiểm tra scope backend.

**Spec:** `docs/superpowers/specs/2026-11-18-role-sidebar-workflow-and-institute-hub-design.md` (mục 1–4, 6–7). Hub Viện trưởng triển khai trong plan kế tiếp `2026-11-18-institute-operations-hub-implementation-plan.md`.

## Global Constraints

- `TopicRegistration` là mô hình đăng ký duy nhất; `maxStudents = 1`, GVHD tối đa 10 sinh viên. Không khôi phục `group/groupMember`.
- CSDL/Prisma → backend guard/scope → frontend. Dùng API thật, không mock/fallback dữ liệu nghiệp vụ.
- Không thêm role bypass. Menu chỉ gợi chức năng; backend kiểm tra capability và phạm vi resource, view không cấp mutation.
- `REPORT_VIEW` là quyền báo cáo học vụ của `VIEN_TRUONG`, `GIAO_VU`, `QUAN_TRI_VIEN` theo scope; nhóm `GVHD` mặc định không giữ quyền này. Dashboard GVHD dùng quyền xem đề tài/sinh viên của mình. Không mở `/api/reports/*` theo `REPORT_VIEW` trước khi xử lý grant DB cũ và scope của mọi API thống kê dùng quyền này.
- Nút có icon dùng `@ant-design/icons` qua prop `icon`, label tiếng Việt thuần; file text/code UTF-8 không BOM.
- Giữ các thay đổi đang có ngoài phạm vi menu trong working tree. Mỗi task commit riêng sau review. Chỉ cập nhật `CLAUDE.md` khi người dùng nói `end phiên`.

## Review Focus

1. GVHD mặc định sau migration: `/api/dashboard/lecturer` vẫn hoạt động bằng quyền mentor, còn `/admin/reports`, `/api/reports/*` và API dashboard tổng hợp toàn viện trả 403 (Task 0–2).
2. Actor có quyền xem hội đồng nhưng không có quyền quản lý: route mở được, nút quản lý ẩn/disable, POST/PUT/DELETE trả 403 (Task 1–2).
3. `/lecturer/students` với actor kiêm Viện trưởng: chỉ có sinh viên do chính actor hướng dẫn, không có hồ sơ toàn viện (Task 1, 3).
4. Hai mục cùng pathname nhưng khác `?tab=`: active state đúng khi query có thêm tham số hoặc thứ tự tham số thay đổi; Back/Forward khôi phục tab (Task 4).
5. Thu hồi quyền khi đang mở hai tab trình duyệt: menu và dữ liệu cũ mất sau refresh permission version; direct URL không mở lại (Task 4–5).
6. Actor được cấp `REPORT_VIEW` trực tiếp/qua nhóm khác/ủy quyền: báo cáo và dashboard tổng hợp chỉ trả phạm vi grant hợp lệ; grant thiếu scope fail-closed, không vì có mã quyền mà xem toàn viện (Task 0–1).

---

### Task 0: Tách `REPORT_VIEW` khỏi quyền GVHD mặc định và đồng bộ DB

**Files:**
- Modify: `backend/src/constants/permissions.js`, `backend/src/routes/dashboardRoutes.js`
- Create: `backend/prisma/migrations/20261118120000_remove_gvhd_report_view/migration.sql`
- Modify: `backend/tests/integration/permissionCatalogMigration.test.js`, `backend/tests/integration/permissionGrantRevokeLifecycle.test.js`
- Test: `backend/tests/integration/dashboard.routes.test.js`

**Interfaces:**
- Produces: system group `GVHD` không có `REPORT_VIEW`; `VIEN_TRUONG`, `GIAO_VU`, `QUAN_TRI_VIEN` giữ grant theo catalog.
- Preserves: `GET /api/dashboard/lecturer` qua `VIEW_MY_TOPICS`/`VIEW_MENTOR_STUDENTS`/`VIEW_MENTORED_STUDENTS`, luôn lọc `topic.mentorId = actor.id`.

- [ ] **Step 1: Viết test fail.** Kiểm tra default group và grant đã lưu: migration loại đúng liên kết `GVHD`–`REPORT_VIEW`, idempotent, không xóa grant cấp riêng có chủ đích; tăng `permissionVersion` cho thành viên bị ảnh hưởng. Kiểm tra GVHD sau thu hồi vẫn dùng `/dashboard/lecturer`, không vào được `/dashboard/stats`/`semester-overview`/`scores`/`activities`; token cũ nhận `PERMISSION_VERSION_STALE` và cache được làm mới.
- [ ] **Step 2: Chạy test fail.** `npm --prefix backend test -- --runTestsByPath tests/integration/permissionCatalogMigration.test.js tests/integration/permissionGrantRevokeLifecycle.test.js tests/integration/dashboard.routes.test.js`.
- [ ] **Step 3: Sửa catalog và migration.** Bỏ `REPORT_VIEW` khỏi `DEFAULT_GROUPS.GVHD`; migration xóa association tương ứng trong `permission_group_permissions` và tăng version cho thành viên nhóm trong cùng transaction DB. Giữ `seedPermissionCatalog` đồng bộ idempotent; xử lý cache đa process bằng cơ chế invalidation/restart triển khai. Bỏ `REPORT_VIEW` khỏi guard `/dashboard/lecturer` vì ba quyền mentor đã đủ.
- [ ] **Step 4: Chạy lại test, Prisma validate và commit.** Test bước 2 PASS; `npm --prefix backend exec prisma validate` PASS; commit `fix(rbac): reserve report view for academic reporting`.

### Task 1: Kiểm tra dữ liệu và khóa chặt route/API dùng bởi menu

**Files:**
- Read/validate: `backend/prisma/schema.prisma` (`TopicRegistration`, `Topic`, `Semester`)
- Modify: `backend/src/routes/reportRoutes.js`, `backend/src/controllers/reportController.js`, `backend/src/routes/dashboardRoutes.js`, `backend/src/controllers/dashboardController.js`
- Modify if failing: `backend/src/controllers/registrationController.js`
- Create: `backend/src/auth/reportReadScope.js`
- Modify: `frontend/src/App.jsx`, `frontend/src/components/common/ProtectedRoute.jsx`
- Modify if failing: `frontend/src/pages/admin/CouncilAssignmentPage.jsx`
- Test: `backend/tests/integration/permissionMatrix.routes.test.js`, `backend/tests/integration/fivePersonaAuthorizationMatrix.test.js`, `backend/tests/integration/academicReports.test.js`
- Create: `backend/tests/integration/reportViewScope.routes.test.js`
- Create: `frontend/runtime-tests/sidebarRouteAuthorization.spec.jsx`

**Interfaces:**
- Preserves: `GET /api/dashboard/lecturer` trả `students[]` theo `topic.mentorId = actor.id` và kỳ được phép; không dùng list `scope=institute` cho trang GVHD.
- Produces: `resolveReportReadScope({ actor, db }) -> { global, departments } | null` từ grant hiệu lực; thiếu scope xác định được trả null/fail-closed.
- Produces: route guard cho report, dashboard tổng hợp, outline/defense council, lecturer students và approvals theo capability đúng; `featureKey` không che mất điều kiện bổ sung một cách âm thầm.

- [ ] **Step 1: Xác nhận schema và test fail.** Chạy `npm --prefix backend exec prisma validate`. Viết fixture GVHD kiêm Viện trưởng có hồ sơ của mình và hồ sơ người khác; assert `/dashboard/lecturer` chỉ trả hồ sơ của mình. Test `REPORT_VIEW` global, department-scoped, grant riêng/ủy quyền và không có scope trên cả ba `/api/reports/*` và `/api/dashboard/stats|semester-overview|semesters|scores|activities`. Với endpoint không thể lọc department (ví dụ activity chung), chỉ grant `GLOBAL` hợp lệ mới được xem. Test ADMIN không có `REPORT_VIEW` không được role-bypass. Test actor chỉ có quyền xem hội đồng không có quyền quản lý.
- [ ] **Step 2: Chạy test để thấy sai lệch.** `npm --prefix backend test -- --runTestsByPath tests/integration/reportViewScope.routes.test.js tests/integration/academicReports.test.js tests/integration/permissionMatrix.routes.test.js tests/integration/fivePersonaAuthorizationMatrix.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/sidebarRouteAuthorization.spec.jsx`.
- [ ] **Step 3: Sửa từ backend rồi route frontend.** `reportRoutes` dùng `REPORT_VIEW` nhưng controller lọc tất cả overview/workload/Excel theo scope server, không tin `semesterId`/`major` để cấp quyền. Áp cùng scope cho các API dashboard tổng hợp đang dùng `REPORT_VIEW`; endpoint không lọc được thì fail-closed với grant không GLOBAL. Kiểm tra `/api/registrations` không vì `REPORT_VIEW` mà mở phạm vi toàn viện; sửa `registrationController` nếu test chứng minh lỗi. Không dùng `role === 'ADMIN'` hoặc group label làm bypass. Sau đó trong `App.jsx`, tách guard hội đồng xét duyệt và bảo vệ; route báo cáo dùng policy `REPORT_VIEW` độc lập. `ProtectedRoute` phải kết hợp `featureKey` với ràng buộc route có chủ đích, không bỏ qua `requiredAnyPermissions`.
- [ ] **Step 4: Kiểm tra và commit.** Test bước 2 và Prisma validate PASS; commit `fix(nav): align route and resource permissions`.

### Task 2: Một nguồn policy, tên và nhóm menu theo quy trình

**Files:**
- Modify: `frontend/src/auth/featurePolicies.js`, `frontend/src/auth/policyEvaluator.js`, `frontend/src/config/navigationRegistry.js`
- Modify: `frontend/tests/navigationRegistry.test.js`, `frontend/tests/featurePolicyParity.test.js`
- Modify: `frontend/src/pages/__tests__/lecturerNavigationStructure.test.js`, `frontend/src/pages/__tests__/academicReportsRouting.test.js`

**Interfaces:**
- Produces: `FEATURE_POLICIES` chứa `key, workspace, route, menu.label/group/order/requiredPermission`; `NAVIGATION_REGISTRY` là projection từ policy, không có 25 entry viết tay.
- Preserves: `getVisibleNavigation(user, context)` lọc theo effective capabilities và nhóm có mục, không inject quyền theo role.

- [ ] **Step 1: Viết test fail về hợp đồng menu.** Test các nhãn/nhóm/đích trong bảng spec: Sinh viên “Tìm & đăng ký đề tài”, “Nộp hồ sơ lưu chiểu”; GVHD “Duyệt nguyện vọng”, “Sinh viên đang hướng dẫn”; Quản trị/Giáo vụ “Bản tin công khai”, “Thông báo tài khoản”, “Báo cáo học vụ” tách “Giám sát tiến độ”. Assert không có `NAVIGATION_REGISTRY` thủ công và mọi feature menu có route tồn tại.
- [ ] **Step 2: Chạy test fail.** `node --test frontend/tests/navigationRegistry.test.js frontend/tests/featurePolicyParity.test.js frontend/src/pages/__tests__/lecturerNavigationStructure.test.js frontend/src/pages/__tests__/academicReportsRouting.test.js`.
- [ ] **Step 3: Cập nhật policy và projection.** Dùng thứ tự nhóm trong spec, chỉ hiện nhóm có mục. Giữ route cũ của Sinh viên/Quản trị khi nhãn mới diễn tả đúng hành động; `academic-reports` dùng `REPORT_VIEW` cho menu/route tương ứng, còn `project-oversight` dùng quyền giám sát riêng. Derive registry từ `FEATURE_POLICY_LIST` hoặc xóa consumer registry; không duy trì hai bộ nhãn. Chưa hiển thị mục “Điều hành học vụ” cho đến khi cả ba tab của plan hub hoạt động.
- [ ] **Step 4: Chạy test và commit.** Test bước 2 PASS; commit `refactor(nav): organize sidebar by thesis workflow`.

### Task 3: Trang “Sinh viên đang hướng dẫn” và đích duyệt nguyện vọng

**Files:**
- Create: `frontend/src/pages/lecturer/LecturerStudentsPage.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/auth/featurePolicies.js`, `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
- Reuse: `frontend/src/queries/dashboardQueries.js`, `frontend/src/components/lecturer/SupervisedStudentList.jsx`
- Create: `frontend/runtime-tests/lecturerStudentsNavigation.spec.jsx`

**Interfaces:**
- Produces: `/lecturer/students` là danh sách đọc theo mentor, dùng `useLecturerOverview(scope, semesterId)` và bộ lọc kỳ có thực.
- Produces: “Duyệt nguyện vọng” đi `/lecturer/approvals?tab=mentor`; BM01 đi `?tab=bm01`; BM02-A còn deep link `?tab=bm02a` và action theo hồ sơ, không biến mất.

- [ ] **Step 1: Viết runtime test fail.** GVHD có 2 sinh viên ở kỳ chọn và 1 sinh viên người khác: trang chỉ hiện 2; Viện trưởng cũng chỉ hiện sinh viên mình hướng dẫn; loading/empty/error có nội dung riêng; click “Duyệt nguyện vọng” vào đúng tab mentor, BM01 vào đúng tab outline.
- [ ] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/lecturerStudentsNavigation.spec.jsx`.
- [ ] **Step 3: Dựng trang bằng dữ liệu API hiện có.** Không fetch `registrations?asInstituteDirector=true`. Chỉ mở route khi có quyền xem sinh viên hướng dẫn; giữ thông tin đăng ký/đề tài theo `TopicRegistration`. Trang duyệt dùng query param như nguồn trạng thái, thao tác đổi tab ghi history có thể Back/Forward.
- [ ] **Step 4: Chạy test và commit.** Test bước 2, `npm --prefix frontend run lint`, `npm --prefix frontend run build` PASS; commit `feat(lecturer): separate supervised students from approvals`.

### Task 4: Active state, điều hướng bàn phím và mobile

**Files:**
- Modify: `frontend/src/components/layout/AppLayout.jsx`, `frontend/src/auth/policyEvaluator.js`
- Modify: `frontend/tests/appLayoutNavigationActive.test.js`, `frontend/tests/rbacUiContracts.test.js`
- Create: `frontend/runtime-tests/sidebarAccessibility.spec.jsx`

**Interfaces:**
- Produces: active item từ `pathname + normalized tab`, bỏ qua tham số không liên quan; `aria-current="page"` cho mục hiện tại.
- Preserves: menu/collapse/drawer của `AppLayout`, identity-scoped permission refresh.

- [ ] **Step 1: Viết test fail.** `/admin/grading?semesterId=2&tab=approvals` và `?tab=approvals&semesterId=2` chọn cùng mục; tab publish chọn mục khác. Back/Forward đổi active đúng; keyboard đi qua nhóm/mục theo thứ tự, focus nhìn thấy, drawer mobile đóng bằng Escape và trả focus; quyền bị thu hồi làm mục mất.
- [ ] **Step 2: Chạy test fail.** `node --test frontend/tests/appLayoutNavigationActive.test.js frontend/tests/rbacUiContracts.test.js`; `npm --prefix frontend run test:runtime -- runtime-tests/sidebarAccessibility.spec.jsx`.
- [ ] **Step 3: Implement.** Dùng policy menu để tìm sibling tab, không dò registry thủ công. Thêm tên nhóm đọc được, `aria-current`, focus/keyboard của nút thu gọn và drawer. Giữ label rõ khi sidebar collapse qua accessible name/tooltip; không dùng emoji thô.
- [ ] **Step 4: Chạy test và commit.** Test bước 2 PASS; commit `fix(nav): keep sidebar state and focus consistent`.

### Task 5: Hồi quy năm persona và bàn giao menu

**Files:**
- Modify: `frontend/e2e/rbac-five-persona.spec.js`, `frontend/e2e/loading-error-navigation.spec.js`
- Modify: `frontend/runtime-tests/fivePersonaPolicies.spec.jsx`
- Modify: `docs/superpowers/plans/2026-11-18-workflow-sidebar-implementation-plan.md` để tick task có bằng chứng PASS

- [ ] **Step 1: Cập nhật E2E theo nhãn/đích mới.** Assert Sinh viên, GVHD, Viện trưởng, Giáo vụ, Quản trị thấy đúng menu; menu chỉ mở route có quyền; BM02-A deep link cũ còn chạy; menu report và oversight độc lập.
- [ ] **Step 2: Chạy regression.** Các test Task 1–4, `npm --prefix frontend run test:runtime -- runtime-tests/fivePersonaPolicies.spec.jsx`, `npm --prefix frontend run test:e2e -- e2e/rbac-five-persona.spec.js e2e/loading-error-navigation.spec.js`, lint/build. Kiểm tra 375/768/1024/1440px và keyboard.
- [ ] **Step 3: Rà soát quy tắc.** `git diff --check`, UTF-8 không BOM, không route chết, mock, `group/groupMember`, icon thô trong label hoặc bypass quyền. Không tick task chưa đạt.
- [ ] **Step 4: Commit marker và báo cáo.** Commit riêng tài liệu checklist; báo tệp/test/commit/rủi ro. Không cập nhật `CLAUDE.md` trước `end phiên`.
