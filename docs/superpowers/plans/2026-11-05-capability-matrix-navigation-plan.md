# Ma Trận Phân Quyền Hai Tầng & Điều Hướng Động 7 Khối Nghiệp Vụ - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện hệ thống phân quyền từ RBAC cứng sang mô hình Năng lực hai tầng (2-Tier Capability Model): mỗi mục menu tương ứng đúng 1 quyền xem `VIEW_*`, các hành vi mutation được bảo vệ độc lập bởi action capability kèm phòng thủ 3 lớp, gộp 27 menu vào 7 khối nghiệp vụ hiển thị động qua Navigation Registry cố định, bảo tồn các route hiện hữu và các dashboard alias cũ.

**Architecture:**
- *Tầng CSDL & Server*: Quản lý `permissionVersion` trên `User`, tạo nhóm quyền bất biến `SYSTEM_STUDENT_BASE` (`isSystem: true`) với 14 capability cơ sở, tách biệt quản trị kỹ thuật (`PERMISSION_GROUP_MANAGE`) khỏi ủy quyền học thuật (`PERMISSION_ASSIGN_ACADEMIC`), kiểm tra quyền tối hậu ở server (không tin JWT thô), trả mã `409 Conflict` khi version bị stale.
- *Tầng Frontend*: Định nghĩa `navigationRegistry.js` cố định 27 mục thuộc 7 khối nghiệp vụ, hợp nhất thành một `AppLayout` duy nhất lọc động theo `effectivePermissions`, giữ nguyên các alias route cũ (`/admin/dashboard`, `/lecturer/dashboard`, `/student/dashboard`), dùng Axios interceptor hỗ trợ replay an toàn (chỉ replay mutation có `Idempotency-Key`), và đồng bộ tức thì qua `BroadcastChannel`.

**Tech Stack:** Node.js (Express), PostgreSQL (Supabase), Prisma ORM, React (Vite, Ant Design, Tailwind CSS), Jest, Supertest.

**Spec:** [`docs/superpowers/specs/2026-11-05-capability-matrix-navigation-redesign.md`](file:///d:/DACN/docs/superpowers/specs/2026-11-05-capability-matrix-navigation-redesign.md)

## Global Constraints

- **Mã hóa**: 100% file `.js`, `.jsx`, `.json`, `.md` lưu ở định dạng **UTF-8 (no BOM)**.
- **Toàn vẹn nghiệp vụ đồ án**: 1 sinh viên / 1 đề tài (`maxStudents = 1`), 1 GVHD $\le 10$ sinh viên, cấm bypass `EXCEPTION_REVIEW`.
- **Cấm dùng `VIEW_*` bảo vệ mutation**: Mọi API mutation (POST/PUT/PATCH/DELETE) bắt buộc phải kiểm tra action capability riêng.
- **Không có đặc quyền Admin học thuật (Zero-Trust Admin)**: Admin kỹ thuật không được cấp quyền học thuật chuyên môn và không được tự ý gán nhóm `VIEN_TRUONG`, `GVHD`.
- **Nguyên tắc In-page CTA**: Nút hành động trên từng hồ sơ bắt buộc kiểm tra mảng `allowedActions[]` từ backend.
- **Tương thích ngược**: Bảo toàn 100% 378 unit/integration test (343 backend + 35 frontend).

## Review Focus

1. **Stale Permission Deadlock**: Gọi `/api/auth/me` khi token mang `permissionVersion` cũ phải luôn thành công (bỏ qua stale check) và trả về token mới, không bị văng `409` hay lặp vô tận.
2. **Unsafe Mutation Replay**: Khi gặp `409 PERMISSION_VERSION_STALE`, chỉ tự động retry mutation nếu request có `Idempotency-Key`; nếu không có, phải refetch session và yêu cầu người dùng xác nhận để tránh ghi đúp dữ liệu.
3. **Session Preservation on 403**: Khi gặp lỗi 403 (COI, sai hạn chót, ngoài thẩm quyền hội đồng), frontend tuyệt đối không xóa session hay logout người dùng.
4. **Historical Graduate Access**: Sinh viên đã tốt nghiệp hoặc không còn enrollment ACTIVE trong kỳ vẫn phải truy cập được `VIEW_MY_GRADES` và `VIEW_MY_ARCHIVE` để xem lại kết quả cũ của chính mình.
5. **Anti-Self-Escalation**: Quản trị viên kỹ thuật không thể tự gán thêm quyền cho chính tài khoản của mình (`targetUserId !== req.user.id`).

---

### Task 1: CSDL & Backend Constants - Permission Catalog, `permissionVersion` & `SYSTEM_STUDENT_BASE`

**Files:**
- Modify: `backend/prisma/schema.prisma:56-115`
- Modify: `backend/src/constants/permissions.js:1-136`
- Create: `backend/prisma/migrations/20261105080000_add_permission_version_and_system_groups/migration.sql`
- Modify: `backend/prisma/seed.js`
- Test: `backend/tests/services/permissionCatalog.test.js`

**Interfaces:**
- Produces: `PERMISSIONS` object chứa đầy đủ 27 `VIEW_*` và các action capabilities mới (`PROJECT_OVERSIGHT_MANAGE`, `PERMISSION_ASSIGN_ACADEMIC`, `VIEW_ACADEMIC_DELEGATIONS`).
- Produces: Trường `permissionVersion Int @default(1) @map("permission_version")` trên model `User`.
- Produces: Nhóm quyền hệ thống `SYSTEM_STUDENT_BASE` (`isSystem: true`) chứa trọn vẹn 14 capability cơ sở của sinh viên.

- [ ] **Step 1: Viết test kiểm tra tính toàn vẹn của Permission Catalog và `SYSTEM_STUDENT_BASE`**

File: `backend/tests/services/permissionCatalog.test.js`
Test cases:
- Danh mục `PERMISSION_CATALOG` phải chứa đầy đủ 27 mã `VIEW_*`.
- `SYSTEM_STUDENT_BASE` phải chứa chính xác 14 capability: `VIEW_MY_REGISTRATION`, `VIEW_MY_SUBMISSIONS`, `VIEW_MY_ARCHIVE`, `VIEW_MY_GRADES`, `REGISTER_TOPIC`, `RENAME_TOPIC`, `REGISTRATION_CANCEL`, `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK`, `CHECKPOINT_SIGN`, `SIGNATURE_APPEAL_SUBMIT`, `SUBMIT_PRE_DEFENSE_ARCHIVE`, `SUBMIT_FINAL_ARCHIVE`.
- Không còn mã quyền cũ `LEGACY_REVIEW_MANAGE`; thay bằng `PROJECT_OVERSIGHT_MANAGE`.

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy: `npm --prefix backend test -- permissionCatalog.test.js`
Expected: FAIL do thiếu các quyền `VIEW_*` mới và `SYSTEM_STUDENT_BASE`.

- [ ] **Step 3: Cập nhật Schema Prisma và Constants Permissions**

- Thêm `permissionVersion Int @default(1) @map("permission_version")` vào model `User` trong `backend/prisma/schema.prisma`.
- Thêm `isSystem Boolean @default(false) @map("is_system")` vào model `PermissionGroup` trong `backend/prisma/schema.prisma`.
- Cập nhật `backend/src/constants/permissions.js`: Bổ sung 27 mã `VIEW_*`, `PROJECT_OVERSIGHT_MANAGE`, `PERMISSION_ASSIGN_ACADEMIC`, định nghĩa `SYSTEM_STUDENT_BASE` và `grantablePermissionCodes`.
- Cập nhật `backend/prisma/seed.js` để seed nhóm `SYSTEM_STUDENT_BASE` và gán cho các tài khoản sinh viên.
- Chạy `npm --prefix backend run db:deploy` (hoặc `npx prisma db push` trong môi trường dev).

- [ ] **Step 4: Chạy test để xác nhận test pass**

Chạy: `npm --prefix backend test -- permissionCatalog.test.js`
Expected: PASS 100%.

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/prisma/schema.prisma backend/src/constants/permissions.js backend/prisma/seed.js backend/tests/services/permissionCatalog.test.js
git commit -m "feat(auth): define 2-tier permissions, permissionVersion, and SYSTEM_STUDENT_BASE group"
```

---

### Task 2: Backend Auth Middleware - Server-Authoritative Permissions, Stale Version Guard & Anti-Escalation

**Files:**
- Modify: `backend/src/middlewares/auth.js:1-277`
- Modify: `backend/src/controllers/authController.js:1-120`
- Modify: `backend/src/controllers/userController.js:1-250`
- Modify: `backend/src/services/permissionService.js:1-200`
- Create: `backend/tests/middlewares/authCapabilityAndStaleVersion.test.js`

**Interfaces:**
- Consumes: `permissionVersion` từ model `User`, `PERMISSIONS` từ `constants/permissions.js`.
- Produces: `authenticate` middleware kiểm tra `permissionVersion` đối với mutation/sensitive read, trả `409 Conflict` (`PERMISSION_VERSION_STALE`), bỏ qua stale check cho `GET /api/auth/me`.
- Produces: `getMe` trả về `{ success: true, data: user, token: refreshedAccessToken }`.
- Produces: Rào chắn anti-self-escalation (`targetUserId !== req.user.id`) và cấm gán nhóm học thuật cho Quản trị viên kỹ thuật trong `userController.updateUserPermissionGroups`.

- [ ] **Step 1: Viết test kiểm tra stale version, getMe token refresh và anti-self-escalation**

File: `backend/tests/middlewares/authCapabilityAndStaleVersion.test.js`
Test cases:
- Request mang token có `permissionVersion < user.permissionVersion` trả về HTTP `409` kèm body `{ error: 'PERMISSION_VERSION_STALE' }`.
- Request `GET /api/auth/me` với token cũ vẫn trả về `200` kèm `token` mới và thông tin user cập nhật.
- Admin không thể tự gán quyền cho chính mình (`targetUserId === req.user.id`) -> trả `403`.
- Admin không thể sửa nhóm `SYSTEM_STUDENT_BASE` (`isSystem === true`) -> trả `403`.
- Admin kỹ thuật (`PERMISSION_GROUP_MANAGE`) không thể gán nhóm `VIEN_TRUONG` hoặc `GVHD` -> trả `403`.

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy: `npm --prefix backend test -- authCapabilityAndStaleVersion.test.js`
Expected: FAIL.

- [ ] **Step 3: Triển khai Middleware và Controller Logic**

- Trong `backend/src/middlewares/auth.js`:
  - Trong `authenticate`: Đọc `user` từ DB kèm `permissionVersion`.
  - Nếu `req.path !== '/me'` và token có `permissionVersion < user.permissionVersion`: Trả `409` với `{ error: 'PERMISSION_VERSION_STALE', message: 'Phiên bản quyền đã được cập nhật.' }`.
  - Load permissions từ quan hệ `userPermissionGroups` vào `req.user.permissions`.
- Trong `backend/src/controllers/authController.js`:
  - Trong `getMe`: Sinh access token mới chứa `permissionVersion` hiện hành và trả về trong response.
- Trong `backend/src/controllers/userController.js` & `backend/src/services/permissionService.js`:
  - Thêm guard cấm `targetUserId === req.user.id`.
  - Thêm guard cấm chỉnh sửa nhóm có `isSystem: true`.
  - Thêm guard cấm gán nhóm chứa quyền học thuật nếu actor chỉ có `PERMISSION_GROUP_MANAGE`.
  - Tăng `permissionVersion: { increment: 1 }` cho người dùng mục tiêu khi cập nhật nhóm quyền thành công.

- [ ] **Step 4: Chạy test để xác nhận test pass**

Chạy: `npm --prefix backend test -- authCapabilityAndStaleVersion.test.js`
Expected: PASS 100%.

- [ ] **Step 5: Commit Task 2**

```bash
git add backend/src/middlewares/auth.js backend/src/controllers/authController.js backend/src/controllers/userController.js backend/src/services/permissionService.js backend/tests/middlewares/authCapabilityAndStaleVersion.test.js
git commit -m "feat(auth): enforce server-authoritative permissionVersion, 409 stale handling, and anti-escalation guards"
```

---

### Task 3: Backend Academic Delegation Subsystem (`/api/delegations`)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/controllers/delegationController.js`
- Create: `backend/src/routes/delegationRoutes.js`
- Modify: `backend/src/app.js`
- Create: `backend/tests/integration/academicDelegation.test.js`

**Interfaces:**
- Produces: Model `AcademicDelegation` lưu: `id`, `delegatorId`, `delegateeId`, `capabilityCode`, `departmentId`, `semesterId`, `effectiveFrom`, `effectiveTo`, `reason`, `idempotencyKey`, `createdAt`.
- Produces: API `GET /api/delegations`, `POST /api/delegations`, `DELETE /api/delegations/:id`.
- Guards: Đòi hỏi `PERMISSION_ASSIGN_ACADEMIC`, ràng buộc cùng khoa/viện (`department`), cấm tự ủy quyền (`delegateeId !== req.user.id`), capability nằm trong `grantablePermissionCodes`.

- [ ] **Step 1: Viết test tích hợp cho Academic Delegation API**

File: `backend/tests/integration/academicDelegation.test.js`
Test cases:
- Lãnh đạo viện có `PERMISSION_ASSIGN_ACADEMIC` ủy quyền `OUTLINE_REVIEW` cho giảng viên cùng khoa thành công.
- Từ chối tự ủy quyền cho chính mình với HTTP 400.
- Từ chối ủy quyền cho giảng viên khác khoa với HTTP 403.
- Từ chối ủy quyền capability không thuộc `grantablePermissionCodes` với HTTP 400.
- Bắt buộc `Idempotency-Key` khi tạo ủy quyền.
- Hủy ủy quyền thành công và tăng `permissionVersion` của người được ủy quyền.

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy: `npm --prefix backend test -- academicDelegation.test.js`
Expected: FAIL.

- [ ] **Step 3: Triển khai Model, Controller và Routes Delegation**

- Thêm model `AcademicDelegation` vào `schema.prisma`.
- Tạo `backend/src/controllers/delegationController.js` với các phương thức `getDelegations`, `createDelegation`, `revokeDelegation`.
- Đăng ký route `backend/src/routes/delegationRoutes.js` vào `app.js` tại `/api/delegations`.
- Trong `auth.js`: Khi resolve permissions, nạp thêm các capability còn hiệu lực từ `AcademicDelegation`.

- [ ] **Step 4: Chạy test để xác nhận test pass**

Chạy: `npm --prefix backend test -- academicDelegation.test.js`
Expected: PASS 100%.

- [ ] **Step 5: Commit Task 3**

```bash
git add backend/prisma/schema.prisma backend/src/controllers/delegationController.js backend/src/routes/delegationRoutes.js backend/src/app.js backend/tests/integration/academicDelegation.test.js
git commit -m "feat(delegation): implement academic delegation subsystem with department scope and audit"
```

---

### Task 4: Backend Route Refactoring - Kiểm Kê Toàn Bộ 100% Endpoint

**Files:**
- Modify: `backend/src/routes/registrationRoutes.js`
- Modify: `backend/src/routes/evaluationRoutes.js`
- Modify: `backend/src/routes/archiveRoutes.js`
- Modify: `backend/src/routes/dashboardRoutes.js`
- Modify: `backend/src/routes/taskRoutes.js`
- Modify: `backend/src/routes/topicRoutes.js`
- Modify: `backend/src/routes/councilRoutes.js`
- Modify: `backend/src/routes/semesterRoutes.js`
- Modify: `backend/tests/integration/*.test.js`

**Interfaces:**
- Consumes: Bảng kiểm kê Endpoint Mục 6.1 trong spec.
- Replaces: Toàn bộ `authorize('STUDENT')` và `authorize('LECTURER')` bằng capability tương ứng (`REGISTER_TOPIC`, `VIEW_MY_GRADES`, `VIEW_MY_REGISTRATION`, `MENTOR_REQUEST_REVIEW`,...).
- Enforces: Ràng buộc enrollment `ACTIVE` chỉ áp dụng cho mutation hiện hành; các truy vấn lịch sử (`VIEW_MY_GRADES`, `VIEW_MY_ARCHIVE`) cho phép sinh viên cũ tra cứu nếu đúng `studentId`.

- [ ] **Step 1: Viết test kiểm tra chuyển đổi capability trên các route trọng yếu**

File: `backend/tests/security/routeCapabilityInventory.test.js`
Test cases:
- Sinh viên có `SYSTEM_STUDENT_BASE` gọi `GET /api/evaluations/my-grades` thành công qua `VIEW_MY_GRADES`.
- Sinh viên gọi `POST /api/registrations/register` qua `REGISTER_TOPIC` (đòi hỏi enrollment ACTIVE).
- Giảng viên gọi `PATCH /api/registrations/:id/status` qua `MENTOR_REQUEST_REVIEW` (đòi hỏi `topic.mentorId === req.user.id`).
- Lãnh đạo viện gọi `POST /api/evaluations/councils/:id/lock-scores` qua `RESULT_LOCK` (đòi hỏi 3 phiếu chấm đã khóa).
- Thay thế hoàn toàn `LEGACY_REVIEW_MANAGE` bằng `PROJECT_OVERSIGHT_MANAGE`.

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy: `npm --prefix backend test -- routeCapabilityInventory.test.js`
Expected: FAIL.

- [ ] **Step 3: Cập nhật Middleware trên toàn bộ Route Files**

- Thay thế `authorize('STUDENT')` tại:
  - `evaluationRoutes.js`: `my-grades` $\to$ `authorizePermission(PERMISSIONS.VIEW_MY_GRADES)`.
  - `registrationRoutes.js`: `register` $\to$ `authorizePermission(PERMISSIONS.REGISTER_TOPIC)`, `my-registration` $\to$ `authorizePermission(PERMISSIONS.VIEW_MY_REGISTRATION)`.
  - `archiveRoutes.js`: `pre-defense` $\to$ `authorizePermission(PERMISSIONS.SUBMIT_PRE_DEFENSE_ARCHIVE)`.
  - `taskRoutes.js`: `submit` $\to$ `authorizePermission(PERMISSIONS.SUBMIT_TASK)`.
- Thay thế `authorize('LECTURER')` tại `dashboardRoutes.js`, `registrationRoutes.js`.
- Cập nhật test fixtures trong các integration test hiện hữu để gắn capability thay vì phụ thuộc role.

- [ ] **Step 4: Chạy toàn bộ backend test suite để đảm bảo không hồi quy**

Chạy: `npm --prefix backend test`
Expected: PASS 54/54 test suites, 343+ tests.

- [ ] **Step 5: Commit Task 4**

```bash
git add backend/src/routes/ backend/tests/
git commit -m "refactor(routes): enforce complete capability-based route inventory and decouple from role guards"
```

---

### Task 5: Frontend Navigation Registry Cố Định 27 Mục & Dynamic AppLayout

**Files:**
- Create: `frontend/src/config/navigationRegistry.js`
- Modify: `frontend/src/components/layout/AppLayout.jsx:1-451`
- Test: `frontend/tests/navigationRegistry.test.js`

**Interfaces:**
- Produces: `NAVIGATION_REGISTRY` chứa đủ 27 mục theo Bảng 5.1 và Mục 7.1 của spec.
- Produces: `AppLayout.jsx` lọc các mục thỏa mãn `item.requiredPermission ? effectivePermissions.has(item.requiredPermission) : true`, gom thành 7 khối nghiệp vụ; tự động ẩn nhóm rỗng.
- Preserves: Menu "Tổng quan" ở đầu; `QuotaMeter` chỉ hiển thị nếu có `TOPIC_CREATE` hoặc `MENTOR_REQUEST_REVIEW`.

- [ ] **Step 1: Viết test cho Navigation Registry và logic gom nhóm**

File: `frontend/tests/navigationRegistry.test.js`
Test cases:
- `NAVIGATION_REGISTRY` có đúng 27 mục, mỗi mục có `key`, `label`, `group`, `requiredPermission`, `route`.
- Sinh viên có tập quyền cơ bản: Chỉ thấy nhóm "Hồ sơ của tôi" (các mục của sinh viên) và "Tổng quan".
- Giảng viên hướng dẫn: Thấy "Hồ sơ của tôi" (mục đề tài phụ trách), "Hướng dẫn & tiến độ".
- Viện trưởng: Thấy thêm "Thẩm định & quyết định", tab "Ủy quyền chuyên môn".
- Quản trị viên: Thấy "Quản trị học vụ", "Quản trị hệ thống".
- Nhóm không có mục nào được cấp quyền sẽ bị ẩn hoàn toàn khỏi danh sách hiển thị.

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy: `npm --prefix frontend test -- navigationRegistry.test.js`
Expected: FAIL do chưa tạo file registry.

- [ ] **Step 3: Tạo `navigationRegistry.js` và Refactor `AppLayout.jsx`**

- Tạo `frontend/src/config/navigationRegistry.js` với 27 mục đầy đủ như Mục 7.1 của spec.
- Cập nhật `AppLayout.jsx`:
  - Thay thế `NAV_CONFIG[role]` bằng việc đọc trực tiếp `NAVIGATION_REGISTRY`.
  - Tính toán `visibleSections` theo `user?.permissions` qua `useMemo`.
  - Hiển thị quota widget dựa trên `effectivePermissions.has('TOPIC_CREATE') || effectivePermissions.has('MENTOR_REQUEST_REVIEW')`.

- [ ] **Step 4: Chạy test để xác nhận test pass**

Chạy: `npm --prefix frontend test -- navigationRegistry.test.js`
Expected: PASS 100%.

- [ ] **Step 5: Commit Task 5**

```bash
git add frontend/src/config/navigationRegistry.js frontend/src/components/layout/AppLayout.jsx frontend/tests/navigationRegistry.test.js
git commit -m "feat(nav): implement 27-item navigation registry and dynamic 7-group sidebar filtering"
```

---

### Task 6: Frontend Route Guards, Layout Unification & Dashboard Aliases

**Files:**
- Modify: `frontend/src/App.jsx:80-248`
- Modify: `frontend/src/components/common/ProtectedRoute.jsx`
- Modify: `frontend/src/pages/lecturer/ProjectPeriodPage.jsx` (hoặc `/lecturer/institute`)
- Test: `frontend/tests/rbacUiContracts.test.js`

**Interfaces:**
- Consumes: `requiredPermission: VIEW_*` trên `ProtectedRoute`.
- Preserves: Các route alias `/admin/dashboard`, `/lecturer/dashboard`, `/student/dashboard` dẫn về cùng Dashboard chung được lọc widget động.
- Produces: Tab "Ủy quyền chuyên môn" (`?tab=delegations`) trên giao diện Quản lý Viện gọi API `/api/delegations`.

- [ ] **Step 1: Viết test kiểm tra Route Capability Guard và Dashboard Aliases**

File: `frontend/tests/rbacUiContracts.test.js`
Test cases:
- Người dùng chỉ cần có `VIEW_*` là truy cập được route mà không phụ thuộc `role`.
- Các URL alias `/admin/dashboard`, `/lecturer/dashboard`, `/student/dashboard` vẫn hợp lệ dưới `AppLayout`.
- Màn hình `/lecturer/institute` hiển thị tab "Ủy quyền chuyên môn" khi có `PERMISSION_ASSIGN_ACADEMIC`.
- Các nút hành động CTA trong từng trang sử dụng mảng `allowedActions[]` do backend trả về.

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy: `npm --prefix frontend test -- rbacUiContracts.test.js`
Expected: FAIL.

- [ ] **Step 3: Cập nhật Route Tree trong `App.jsx` và tích hợp Tab Ủy Quyền**

- Hợp nhất các nhánh route dưới `<AppLayout />`.
- Loại bỏ `allowedRoles` khỏi các `ProtectedRoute`, thay bằng `requiredPermission={item.requiredPermission}`.
- Giữ các route alias `/admin/dashboard`, `/lecturer/dashboard`, `/student/dashboard`.
- Bổ sung tab "Ủy quyền chuyên môn" vào `ProjectPeriodPage.jsx` (tại route `/lecturer/institute`) với form phân quyền (người nhận cùng khoa, capability, thời hạn, lý do).

- [ ] **Step 4: Chạy test để xác nhận test pass**

Chạy: `npm --prefix frontend test`
Expected: PASS 35/35 test suites.

- [ ] **Step 5: Commit Task 6**

```bash
git add frontend/src/App.jsx frontend/src/components/common/ProtectedRoute.jsx frontend/src/pages/lecturer/ProjectPeriodPage.jsx frontend/tests/rbacUiContracts.test.js
git commit -m "feat(router): unify AppLayout, protect routes with VIEW_* capabilities, and preserve dashboard aliases"
```

---

### Task 7: Frontend Session Sync, BroadcastChannel & Safe Replay Interceptor

**Files:**
- Modify: `frontend/src/services/api.js:1-120`
- Modify: `frontend/src/stores/authStore.js:1-100`
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Create: `frontend/tests/sessionSyncAndReplay.test.js`

**Interfaces:**
- Produces: Axios interceptor bắt mã `409 Conflict` (`PERMISSION_VERSION_STALE`).
- Enforces: Tự động replay request `GET` 1 lần; chỉ replay mutation khi có `Idempotency-Key`; nếu không có `Idempotency-Key` thì hiển thị thông báo yêu cầu người dùng xác nhận gửi lại.
- Enforces: Không logout khi gặp lỗi 403; chỉ logout khi gặp 401 hoặc `ACCOUNT_DISABLED`.
- Produces: Kênh `BroadcastChannel('dacn_auth_sync')` đồng bộ thay đổi quyền giữa các tab trong cùng trình duyệt.

- [ ] **Step 1: Viết test cho Axios Interceptor, Safe Replay và BroadcastChannel**

File: `frontend/tests/sessionSyncAndReplay.test.js`
Test cases:
- Khi API trả về 409 `PERMISSION_VERSION_STALE`, interceptor gọi `authService.getMe()`, cập nhật token và replay request `GET`.
- Khi mutation không có `Idempotency-Key` gặp 409, interceptor refetch session nhưng không tự ý gửi lại mutation, trả về rejected error yêu cầu user xác nhận.
- Khi API trả về 403, session không bị xóa, token giữ nguyên.
- Nhận thông điệp từ `BroadcastChannel` kích hoạt gọi `authService.getMe()`.

- [ ] **Step 2: Chạy test để xác nhận test fail**

Chạy: `npm --prefix frontend test -- sessionSyncAndReplay.test.js`
Expected: FAIL.

- [ ] **Step 3: Triển khai Safe Replay Interceptor và BroadcastChannel**

- Trong `frontend/src/services/api.js`:
  - Thêm single-flight promise mutex `let refreshingPromise = null;`.
  - Bắt lỗi `error.response?.status === 409 && error.response?.data?.error === 'PERMISSION_VERSION_STALE'`.
  - Thực hiện gọi `getMe()` qua mutex; cập nhật token mới.
  - Kiểm tra nếu method là `GET` hoặc request có `headers['Idempotency-Key']`: Replay request với token mới. Ngược lại, reject kèm cờ `REQUIRES_USER_CONFIRMATION`.
  - Nếu gặp `401`: Xóa session, điều hướng về `/`. Nếu gặp `403`: Giữ nguyên session.
- Trong `AppLayout.jsx`:
  - Lắng nghe sự kiện `visibilitychange`, `window.focus`, và `authChannel.onmessage` để refetch `getMe()`.

- [ ] **Step 4: Chạy test để xác nhận test pass**

Chạy: `npm --prefix frontend test -- sessionSyncAndReplay.test.js`
Expected: PASS 100%.

- [ ] **Step 5: Commit Task 7**

```bash
git add frontend/src/services/api.js frontend/src/stores/authStore.js frontend/src/components/layout/AppLayout.jsx frontend/tests/sessionSyncAndReplay.test.js
git commit -m "feat(sync): safe 409 stale replay, broadcast channel multi-tab sync, and 403 session preservation"
```

---

### Task 8: Kiểm Thử Toàn Diện, Production Build & E2E Verification

**Files:**
- All modified files across backend & frontend.

- [ ] **Step 1: Chạy toàn bộ Backend Test Suite**

Chạy: `npm --prefix backend test`
Expected: PASS 54/54 test suites, 343+ tests.

- [ ] **Step 2: Chạy toàn bộ Frontend Test Suite**

Chạy: `npm --prefix frontend test`
Expected: PASS 38+ tests.

- [ ] **Step 3: Chạy Production Build Frontend**

Chạy: `npm --prefix frontend run build`
Expected: Vite build thành công 100%, 0 lỗi cú pháp hoặc đóng gói.

- [ ] **Step 4: Commit toàn bộ branch và ghi nhận hoàn tất**

```bash
git commit --allow-empty -m "chore(release): complete 2-tier capability matrix and dynamic navigation redesign"
```

