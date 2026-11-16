# Canonical RBAC Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa phân quyền DACN để một capability được cấp hoặc thu hồi tạo ra hành vi nhất quán tại backend API, frontend route, menu và action trong đúng phạm vi học kỳ/tài nguyên.

**Architecture:** Giữ ba role cơ sở và các permission group hiện có, nhưng đưa tất cả quyết định quyền về catalog canonical, capability resolver dùng chung và resource-scope authorization. Frontend đọc một feature policy manifest thống nhất cho menu, route và action; backend vẫn là security boundary cuối cùng.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, JWT, React 19, React Router 7, Zustand, TanStack Query 5, Vitest, Node test runner, Jest/Supertest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-canonical-rbac-capability-design.md`

## Global Constraints

- Giữ `ADMIN`, `LECTURER`, `STUDENT` là ba role cơ sở; `GVHD`, `GIAO_VU`, `VIEN_TRUONG` là permission group/chức vụ.
- Giữ `TopicRegistration` là kiến trúc đăng ký duy nhất; không khôi phục `group/groupMember`.
- Giữ quy tắc một sinh viên/một đề tài và một GVHD tối đa 10 sinh viên.
- Backend là nguồn quyết định cuối cùng; frontend không phải security boundary.
- Mỗi permission có đúng một mã canonical; alias chỉ tồn tại trong giai đoạn migration và không được dùng cho code mới.
- Tách độc lập `VIEW`, `ACTION` và resource scope; có quyền xem không mặc nhiên có quyền mutation.
- Không tin `semesterId`, `department`, `registrationId` hoặc `councilId` từ client để mở rộng quyền; phải đối chiếu resource trong CSDL.
- Admin kỹ thuật không mặc định có quyền học thuật chỉ vì `role === 'ADMIN'`.
- Mọi thay đổi quyền phải có transaction, audit, cache invalidation và `permissionVersion` lifecycle.
- Frontend không tự bơm permission theo group và không bypass theo role.
- Tất cả file text/code phải là UTF-8 không BOM.
- Nút bấm sử dụng `@ant-design/icons` qua prop `icon`; không đưa emoji hoặc ký tự đồ họa thô vào label.
- Mỗi task thực hiện TDD và có commit riêng; không gộp các task chưa review vào cùng commit.

## Review Focus

- Client gửi `semesterId` của kỳ được ủy quyền nhưng resource thuộc kỳ khác: authorization phải dùng kỳ của resource và trả `403 RESOURCE_SCOPE_FORBIDDEN`.
- User chỉ có quyền view mở một trang quản trị: dữ liệu đọc được nhưng mọi mutation control bị ẩn/disable và POST/PUT/DELETE trả `403 CAPABILITY_REQUIRED`.
- Thu hồi group/delegation khi user còn token cũ và đang mở hai tab: request kế tiếp trả `409 PERMISSION_VERSION_STALE`, cả hai tab refresh session và menu bị gỡ.
- Permission alias hoặc string không thuộc catalog xuất hiện trong route/controller/frontend: contract test phải fail trước khi deploy.
- Actor có quyền `PERMISSION_ASSIGN_ACADEMIC` nhưng không có `department`: list/create/revoke delegation theo đơn vị phải fail-closed, không mở phạm vi toàn viện.

---

### Task 1: Canonical Permission Catalog and Source Scan

**Files:**
- Modify: `backend/src/constants/permissions.js`
- Modify: `frontend/src/config/permissionsConfig.js`
- Create: `backend/src/auth/permissionCatalog.js`
- Create: `backend/tests/contracts/permissionUsage.contract.test.js`
- Modify: `backend/tests/services/permissionCatalog.test.js`
- Modify: `frontend/tests/permissionMatrixP1Optimization.test.js`

**Interfaces:**
- Produces: `PERMISSION_DEFINITIONS: ReadonlyArray<PermissionDefinition>` with `{ code, label, module, kind, protectedDomain, eligibleRoles, scopeTypes }`.
- Produces: `normalizePermissionCode(code: string): string | null`.
- Produces: `isCanonicalPermissionCode(code: string): boolean`.
- Preserves: `PERMISSIONS`, `DEFAULT_GROUPS`, `STUDENT_BASE_PERMISSIONS` exports during migration.

- [x] **Step 1: Write failing catalog metadata and source-scan tests**

  Assert every definition has valid `kind` (`VIEW|ACTION`), protected domain, eligible roles and at least one scope type. Scan backend/frontend authorization consumers and fail on unknown strings including the current `VIEW_TOPICS`, `TOPIC_APPROVE`, `PROJECT_PERIOD_MANAGE`, and `DEFENSE_COUNCIL_ASSIGN` references.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/services/permissionCatalog.test.js tests/contracts/permissionUsage.contract.test.js
  node --test frontend/tests/permissionMatrixP1Optimization.test.js
  ```

  Expected: FAIL because catalog metadata/normalizer do not exist and unknown permission strings are found.

- [x] **Step 3: Implement canonical catalog metadata and scanner allowlist**

  Create `permissionCatalog.js` as the only normalization interface. Replace unknown strings with existing canonical permissions chosen from the approved catalog; do not add new synonyms merely to satisfy the scan. Keep `CANONICAL_ALIAS_MAP` read-compatible for later migration tasks.

- [x] **Step 4: Run focused tests**

  Run the commands from Step 2.

  Expected: PASS; every authorization permission string resolves to a catalog entry and no new code consumes an alias.

- [x] **Step 5: Commit**

  ```powershell
  git add backend/src/constants/permissions.js backend/src/auth/permissionCatalog.js backend/tests/contracts/permissionUsage.contract.test.js backend/tests/services/permissionCatalog.test.js frontend/src/config/permissionsConfig.js frontend/tests/permissionMatrixP1Optimization.test.js
  git commit -m "refactor(rbac): establish canonical permission catalog"
  ```

### Task 2: Protect System Groups and Canonicalize Stored Permissions

**Files:**
- Modify: `backend/src/constants/permissions.js`
- Modify: `backend/src/services/permissionService.js`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261116234000_canonicalize_rbac_permissions/migration.sql`
- Create: `backend/tests/integration/permissionCatalogMigration.test.js`
- Modify: `backend/tests/integration/permissionMatrix.routes.test.js`

**Interfaces:**
- Consumes: `normalizePermissionCode` from Task 1.
- Produces: canonical permission/group associations with no duplicate alias grants.
- Produces: `DEFAULT_GROUPS[*].isSystem` and seed behavior that preserve system-group protection.

- [x] **Step 1: Write failing migration and seed tests**

  Assert `SYSTEM_STUDENT_BASE`, `GVHD`, `GIAO_VU`, `VIEN_TRUONG`, and `QUAN_TRI_VIEN` retain their declared `isSystem` value after repeated seed. Assert alias associations migrate to canonical IDs without losing user-group assignments and protected system groups cannot be deleted.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/permissionCatalogMigration.test.js tests/integration/permissionMatrix.routes.test.js
  ```

  Expected: FAIL because seed currently writes default groups as non-system and stored alias associations are not canonicalized.

- [x] **Step 3: Add the idempotent migration and correct seed semantics**

  Migration order: create/verify canonical permission rows, move `permission_group_permissions` to canonical IDs with conflict-safe inserts, delete obsolete alias associations, then remove obsolete alias permission rows only when no consumer remains. Do not modify user roles or `TopicRegistration` data.

- [x] **Step 4: Verify migration and tests**

  Run:

  ```powershell
  npm --prefix backend exec prisma validate
  npm --prefix backend test -- --runTestsByPath tests/integration/permissionCatalogMigration.test.js tests/integration/permissionMatrix.routes.test.js
  ```

  Expected: Prisma schema valid; tests PASS; migration is safe to run twice in a disposable test database.

- [x] **Step 5: Commit**

  ```powershell
  git add backend/src/constants/permissions.js backend/src/services/permissionService.js backend/prisma/schema.prisma backend/prisma/migrations backend/tests/integration/permissionCatalogMigration.test.js backend/tests/integration/permissionMatrix.routes.test.js
  git commit -m "fix(rbac): canonicalize permissions and protect system groups"
  ```

### Task 3: Unified Capability Resolver

**Files:**
- Create: `backend/src/auth/capabilityResolver.js`
- Modify: `backend/src/middlewares/auth.js`
- Modify: `backend/src/controllers/authController.js`
- Modify: `backend/tests/middlewares/authCapabilityAndStaleVersion.test.js`
- Modify: `backend/tests/middlewares/authCacheAndDeduplication.test.js`
- Create: `backend/tests/unit/capabilityResolver.test.js`

**Interfaces:**
- Consumes: canonical helpers from Task 1.
- Produces: `resolveUserCapabilities({ userId, at?, db? }) -> Promise<ResolvedIdentity | null>`.
- Produces: `ResolvedIdentity` containing canonical `basePermissions`, compatibility `permissions`, `permissionGroups`, scoped `activeDelegations`, `permissionVersion`, and council-assignment flags.
- Produces: `getEffectivePermissions(identity, { semesterId?, department? }) -> Set<string>`; only this scope-aware set may authorize a request.
- Preserves: `clearAuthCache(userId?)`, stale-token `409`, JWT refresh and current `/auth/me` response shape.

- [x] **Step 1: Write failing resolver parity tests**

  Assert login, `/auth/me`, and authenticated requests resolve the same permission set for the same user/scope; expired/revoked delegation is excluded; aliases normalize to canonical; student/GVHD fallback is explicit and identical across entry points.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/unit/capabilityResolver.test.js tests/middlewares/authCapabilityAndStaleVersion.test.js tests/middlewares/authCacheAndDeduplication.test.js
  ```

  Expected: FAIL because auth controller and middleware currently use different delegation resolution paths.

- [x] **Step 3: Implement and adopt `resolveUserCapabilities`**

  Move group/delegation/council resolution out of both consumers. Cache the full resolved identity by user; never flatten a semester/department delegation into globally effective backend permissions. Retain single-flight lookup and TTL behavior.

- [x] **Step 4: Run focused auth tests**

  Run the command from Step 2.

  Expected: PASS; login/me/request permission arrays are equal for the same authoritative scope.

- [x] **Step 5: Commit**

  ```powershell
  git add backend/src/auth/capabilityResolver.js backend/src/middlewares/auth.js backend/src/controllers/authController.js backend/tests/unit/capabilityResolver.test.js backend/tests/middlewares/authCapabilityAndStaleVersion.test.js backend/tests/middlewares/authCacheAndDeduplication.test.js
  git commit -m "refactor(auth): unify capability resolution"
  ```

### Task 4: Authoritative Resource Scope and Delegation Hardening

**Files:**
- Create: `backend/src/auth/resourceScopeResolver.js`
- Create: `backend/src/middlewares/authorizeScopedPermission.js`
- Modify: `backend/src/controllers/delegationController.js`
- Modify: `backend/src/routes/delegationRoutes.js`
- Modify: `backend/tests/integration/academicDelegation.test.js`
- Create: `backend/tests/integration/delegationResourceScope.test.js`

**Interfaces:**
- Consumes: `resolveUserCapabilities` from Task 3.
- Produces: `resolveResourceScope({ resourceType, resourceId, db }) -> Promise<{ semesterId?, department?, ownerId?, mentorId?, councilMemberIds? }>`.
- Produces: `authorizeScopedPermission({ anyOf, resourceType, idFromRequest })` Express middleware.
- Produces stable errors: `CAPABILITY_REQUIRED`, `RESOURCE_SCOPE_FORBIDDEN`, `DELEGATION_SCOPE_FORBIDDEN`.

- [x] **Step 1: Write failing scope-attack tests**

  Cover the five Review Focus inputs: forged query/header/body semester, resource in another semester, actor with null department, cross-department list/revoke, and global delegation. Assert the resource-derived semester wins over every client hint.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/academicDelegation.test.js tests/integration/delegationResourceScope.test.js
  ```

  Expected: FAIL on forged semester and null-department fail-closed cases.

- [x] **Step 3: Implement authoritative scope resolution**

  `idFromRequest(req)` may identify the resource, but scope values must be loaded from Prisma relations. Delegation list/create/revoke must require a department whenever the capability scope is departmental; global capabilities must be explicitly declared by catalog metadata.

- [x] **Step 4: Run delegation and scope tests**

  Run the command from Step 2.

  Expected: PASS; no client-controlled scope expands permissions.

- [x] **Step 5: Commit**

  ```powershell
  git add backend/src/auth/resourceScopeResolver.js backend/src/middlewares/authorizeScopedPermission.js backend/src/controllers/delegationController.js backend/src/routes/delegationRoutes.js backend/tests/integration/academicDelegation.test.js backend/tests/integration/delegationResourceScope.test.js
  git commit -m "fix(auth): enforce authoritative delegation scope"
  ```

### Task 5: Remove Role Bypasses and Align Backend Read/Action Guards

**Files:**
- Modify: `backend/src/middlewares/auth.js`
- Modify: `backend/src/routes/outlineRoutes.js`
- Modify: `backend/src/routes/reportRoutes.js`
- Modify: `backend/src/routes/permissionRoutes.js`
- Modify: `backend/src/routes/portalContentRoutes.js`
- Modify: `backend/src/routes/councilRoutes.js`
- Modify: `backend/src/routes/userRoutes.js`
- Modify: `backend/src/routes/evaluationRoutes.js`
- Modify: `backend/src/controllers/topicController.js`
- Modify: `backend/src/controllers/registrationController.js`
- Modify: `backend/src/controllers/councilController.js`
- Modify: `backend/src/controllers/archiveController.js`
- Create: `backend/tests/integration/canonicalAuthorization.routes.test.js`
- Modify: `backend/tests/integration/platformAuthorization.routes.test.js`

**Interfaces:**
- Consumes: `authorizeScopedPermission` and canonical catalog.
- Produces: GET routes guarded by view capability; mutation routes guarded by action capability plus scope.
- Produces: no implicit Admin/Student/Lecturer mutation bypass outside declared base capabilities.

- [x] **Step 1: Write failing route matrix tests**

  For reports, permission groups, portal content, outline submission, councils, users and grading, assert: no token `401`; view-only GET `2xx`; view-only mutation `403`; action with wrong scope `403`; action with correct scope `2xx`. Include `REPORT_VIEW`, `VIEW_PERMISSIONS`, `VIEW_PERMISSION_GROUPS`, and `VIEW_PORTAL_CONTENT` cases currently returning incorrect results.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/canonicalAuthorization.routes.test.js tests/integration/platformAuthorization.routes.test.js
  ```

  Expected: FAIL on read/write mismatches and role bypass cases.

- [x] **Step 3: Replace route/controller bypasses with canonical guards**

  Declare any truly mandatory student base action in the catalog/default group instead of checking `role === 'STUDENT'`. Split router-wide management guards so permitted GET endpoints accept their view permission without broadening mutations.

- [x] **Step 4: Run authorization and sensitive-resource regressions**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/canonicalAuthorization.routes.test.js tests/integration/platformAuthorization.routes.test.js tests/integration/studentDefenseResultPrivacy.test.js tests/integration/mentorOwnershipAndGradingScope.test.js tests/integration/decisionIssuanceAndArchiveIntegrity.test.js
  ```

  Expected: PASS; privacy and IDOR protections remain intact.

- [x] **Step 5: Commit**

  ```powershell
  git add backend/src/middlewares/auth.js backend/src/routes backend/src/controllers backend/src/services backend/tests/integration/canonicalAuthorization.routes.test.js backend/tests/integration/platformAuthorization.routes.test.js backend/tests/integration/studentDefenseResultPrivacy.test.js backend/tests/integration/mentorOwnershipAndGradingScope.test.js backend/tests/integration/decisionIssuanceAndArchiveIntegrity.test.js
  git commit -m "fix(rbac): align backend view action and scope guards"
  ```

### Task 6: Permission Mutation Lifecycle and Protected Matrix Authority

**Files:**
- Create: `backend/src/services/permissionInvalidationService.js`
- Modify: `backend/src/services/permissionService.js`
- Modify: `backend/src/controllers/userController.js`
- Modify: `backend/src/controllers/delegationController.js`
- Modify: `backend/src/controllers/permissionController.js`
- Modify: `backend/tests/integration/permissionMatrix.routes.test.js`
- Modify: `backend/tests/middlewares/authCapabilityAndStaleVersion.test.js`
- Create: `backend/tests/integration/permissionGrantRevokeLifecycle.test.js`

**Interfaces:**
- Produces: `invalidatePermissions({ userIds, actor, reason, tx }) -> Promise<void>`; increments versions inside transaction and clears/publishes cache invalidation after commit.
- Produces: `assertPermissionMutationAuthority({ actor, addedCodes, removedCodes, targetGroups })`.
- Preserves: audit log and last-manager protection.

- [x] **Step 1: Write failing protected-matrix and grant/revoke tests**

  Assert technical manager can modify only technical permissions; academic assigner can modify protected academic permissions within allowed group/scope; unauthorized actor receives `403 PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN`. Assert group/matrix changes increment every affected user's `permissionVersion`, while unrelated users are unchanged.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/permissionMatrix.routes.test.js tests/integration/permissionGrantRevokeLifecycle.test.js tests/middlewares/authCapabilityAndStaleVersion.test.js
  ```

  Expected: FAIL because bulk matrix rejects all protected deltas and group/matrix mutations do not bump affected users.

- [x] **Step 3: Implement transactional invalidation and shared authority checks**

  Compute permission deltas before writing. Resolve affected users through `UserPermissionGroup`; increment versions in the same transaction. Publish/clear cache only after a successful commit so rollback cannot advertise a change.

- [x] **Step 4: Run lifecycle tests**

  Run the command from Step 2.

  Expected: PASS; stale token receives `409`, refresh removes revoked permission, and audit failure rolls back the change.

- [x] **Step 5: Commit**

  ```powershell
  git add backend/src/services/permissionInvalidationService.js backend/src/services/permissionService.js backend/src/controllers/userController.js backend/src/controllers/delegationController.js backend/src/controllers/permissionController.js backend/tests/integration/permissionMatrix.routes.test.js backend/tests/integration/permissionGrantRevokeLifecycle.test.js backend/tests/middlewares/authCapabilityAndStaleVersion.test.js
  git commit -m "fix(rbac): make permission changes atomic and revocable"
  ```

### Task 7: Frontend Feature Policy Manifest

**Files:**
- Create: `frontend/src/auth/featurePolicies.js`
- Create: `frontend/src/auth/policyEvaluator.js`
- Modify: `frontend/src/config/navigationRegistry.js`
- Modify: `frontend/src/components/common/ProtectedRoute.jsx`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/tests/featurePolicyParity.test.js`
- Modify: `frontend/tests/navigationRegistry.test.js`
- Modify: `frontend/tests/crossRoleDashboardRedirect.test.js`

**Interfaces:**
- Produces: `FEATURE_POLICIES` entries with `{ key, workspace, route, menu, viewAnyOf?, viewAllOf?, actions?, assignment? }`.
- Produces: `canViewFeature(user, featureKey, context?): boolean`; `context` carries the selected semester/department used only for UI filtering.
- Produces: `canPerformFeatureAction(user, featureKey, actionKey, context?): boolean`.
- Produces: `getVisibleNavigation(user)` derived from the same manifest.

- [x] **Step 1: Write failing parity and five-persona navigation tests**

  Assert every protected application route maps to one feature policy; every menu item uses that policy; `GIAO_VU` does not receive synthetic permissions; archive menu/route agree; `REPORT_VIEW`, action-only and view-only cases behave consistently for all five personas.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  node --test frontend/tests/featurePolicyParity.test.js frontend/tests/navigationRegistry.test.js frontend/tests/crossRoleDashboardRedirect.test.js
  ```

  Expected: FAIL because route and navigation currently duplicate different permission lists and frontend injects a Giáo vụ permission.

- [x] **Step 3: Implement manifest and migrate routing/navigation**

  Preserve current URLs. Remove group-based permission injection and Admin role bypass from navigation evaluation. Scoped delegations are effective in UI only when their semester/department matches the current context. `ProtectedRoute` accepts `featureKey` and evaluates the same policy; temporary legacy props may remain only for public/standalone routes and must be covered by an explicit test allowlist.

- [x] **Step 4: Run policy tests**

  Run the command from Step 2.

  Expected: PASS; no visible menu leads to a permission redirect for the same user state.

- [x] **Step 5: Commit**

  ```powershell
  git add frontend/src/auth/featurePolicies.js frontend/src/auth/policyEvaluator.js frontend/src/config/navigationRegistry.js frontend/src/components/common/ProtectedRoute.jsx frontend/src/App.jsx frontend/tests/featurePolicyParity.test.js frontend/tests/navigationRegistry.test.js frontend/tests/crossRoleDashboardRedirect.test.js
  git commit -m "refactor(frontend): derive routes and menus from feature policies"
  ```

### Task 8: Action-Level UI Authorization

**Files:**
- Create: `frontend/src/components/common/AuthorizedAction.jsx`
- Modify: `frontend/src/pages/admin/UserManagementPage.jsx`
- Modify: `frontend/src/pages/admin/AnnouncementManagementPage.jsx`
- Modify: `frontend/src/pages/admin/RubricManagementPage.jsx`
- Modify: `frontend/src/pages/admin/PermissionGroupPage.jsx`
- Modify: `frontend/src/pages/admin/CouncilAssignmentPage.jsx`
- Modify: `frontend/src/pages/admin/CouncilDetailPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectEnrollmentPage.jsx`
- Modify: `frontend/src/components/coordination/LecturerAssignmentTab.jsx`
- Modify: `frontend/src/pages/lecturer/TopicManagementPage.jsx`
- Create: `frontend/runtime-tests/actionAuthorization.spec.jsx`

**Interfaces:**
- Consumes: `canPerformFeatureAction` from Task 7.
- Produces: `AuthorizedAction({ feature, action, context?, mode='hide', children, reason? })`.
- Preserves: existing page read-only data/query behavior.

- [x] **Step 1: Write failing view-only/action tests**

  Mount the real pages for view-only and action-capable users. Assert create/import/edit/delete/assign/publish controls are absent or disabled according to policy; Admin role alone does not enable actions; allowed action remains keyboard accessible and calls the mutation once.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix frontend run test:runtime -- runtime-tests/actionAuthorization.spec.jsx
  ```

  Expected: FAIL because several pages currently render mutations whenever the page itself is visible or when role is `ADMIN`.

- [x] **Step 3: Implement `AuthorizedAction` and migrate listed pages**

  Use `mode='hide'` for unavailable primary mutations and `mode='disable'` only where seeing the locked action teaches the workflow; disabled controls must expose a Vietnamese reason via accessible tooltip/help text. Remove page-local `role === 'ADMIN'` action bypasses.

- [x] **Step 4: Run runtime and legacy UI tests**

  Run:

  ```powershell
  npm --prefix frontend run test:runtime -- runtime-tests/actionAuthorization.spec.jsx
  node --test frontend/tests/rbacUiContracts.test.js frontend/tests/permissionMatrixP1Optimization.test.js
  ```

  Expected: PASS; view-only pages remain usable and no unauthorized mutation control is enabled.

- [x] **Step 5: Commit**

  ```powershell
  git add frontend/src/components/common/AuthorizedAction.jsx frontend/src/pages/admin/UserManagementPage.jsx frontend/src/pages/admin/AnnouncementManagementPage.jsx frontend/src/pages/admin/RubricManagementPage.jsx frontend/src/pages/admin/PermissionGroupPage.jsx frontend/src/pages/admin/CouncilAssignmentPage.jsx frontend/src/pages/admin/CouncilDetailPage.jsx frontend/src/pages/admin/ProjectEnrollmentPage.jsx frontend/src/components/coordination/LecturerAssignmentTab.jsx frontend/src/pages/lecturer/TopicManagementPage.jsx frontend/runtime-tests/actionAuthorization.spec.jsx
  git commit -m "fix(frontend): enforce action-level authorization"
  ```

### Task 9: Immediate Permission Refresh and Cross-Tab Consistency

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/stores/authStore.js`
- Modify: `frontend/src/providers/AppQueryProvider.jsx`
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Modify: `frontend/src/queries/permissionQueries.js`
- Modify: `frontend/src/queries/userQueries.js`
- Modify: `frontend/tests/sessionSyncAndReplay.test.js`
- Modify: `frontend/runtime-tests/AuthQueryIsolation.spec.jsx`
- Create: `frontend/runtime-tests/permissionRefresh.spec.jsx`

**Interfaces:**
- Produces: `refreshPermissions({ reason, expectedVersion? }) -> Promise<User>` in auth store with single-flight behavior.
- Produces: one `PERMISSIONS_UPDATED` broadcast payload `{ userId, permissionVersion?, reason }`.
- Consumes: identity-scoped query keys and `PERMISSION_VERSION_STALE` backend contract.

- [x] **Step 1: Write failing grant/revoke cross-tab tests**

  Simulate two tabs, a successful permission mutation and a stale `409`. Assert one refresh per tab, old identity-scoped queries are canceled/removed, new menu is rendered, and unsafe mutations are not automatically replayed after permission loss.

- [x] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  node --test frontend/tests/sessionSyncAndReplay.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/AuthQueryIsolation.spec.jsx runtime-tests/permissionRefresh.spec.jsx
  ```

  Expected: FAIL because successful matrix/group mutations do not proactively broadcast and refresh.

- [x] **Step 3: Implement single-flight refresh and proactive broadcast**

  Mutation success emits the event after backend commit. Receiving tabs refresh `/auth/me`, replace token/user atomically, then clear prior permission-version query scope. Keep existing unsafe-mutation confirmation semantics.

- [x] **Step 4: Run session tests**

  Run the command from Step 2.

  Expected: PASS; grant and revoke are reflected without waiting for focus or an unrelated failed request.

- [x] **Step 5: Commit**

  ```powershell
  git add frontend/src/services/api.js frontend/src/stores/authStore.js frontend/src/providers/AppQueryProvider.jsx frontend/src/components/layout/AppLayout.jsx frontend/src/queries/permissionQueries.js frontend/src/queries/userQueries.js frontend/tests/sessionSyncAndReplay.test.js frontend/runtime-tests/AuthQueryIsolation.spec.jsx frontend/runtime-tests/permissionRefresh.spec.jsx
  git commit -m "fix(auth): synchronize permission changes across tabs"
  ```

### Task 10: Five-Persona Authorization Matrix and Browser E2E

**Files:**
- Create: `backend/tests/integration/fivePersonaAuthorizationMatrix.test.js`
- Create: `frontend/runtime-tests/fivePersonaPolicies.spec.jsx`
- Create: `frontend/e2e/rbac-five-persona.spec.js`
- Modify: `frontend/playwright.config.js` if deterministic persona fixtures require configuration
- Create: `docs/rbac/authorization-matrix.md`

**Interfaces:**
- Consumes: canonical catalog, scoped backend guards, frontend feature policies and refresh lifecycle.
- Produces: executable matrix for `STUDENT`, `GVHD`, `GIAO_VU`, `VIEN_TRUONG`, `QUAN_TRI_VIEN`.
- Produces: human-readable authorization matrix generated from or checked against test fixtures.

- [ ] **Step 1: Write the complete persona fixtures and failing matrix tests**

  Cover menu, direct URL, view/action API, own/other student, assigned/unassigned mentor, council membership, same/different department, same/different semester, grant and revoke. Include BM02-A, BM03, BM04, BM05, defense result publication and archive dossier.

- [ ] **Step 2: Run tests and confirm any remaining gaps**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/fivePersonaAuthorizationMatrix.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/fivePersonaPolicies.spec.jsx
  npm --prefix frontend run test:e2e -- e2e/rbac-five-persona.spec.js
  ```

  Expected: initial FAIL must identify only unconverted policy consumers; do not weaken expected permissions to make tests pass.

- [ ] **Step 3: Fix remaining policy consumers in their owning module**

  Use canonical guard/manifest interfaces from prior tasks. Add no new role bypass or frontend-only permission injection. Generate/check `authorization-matrix.md` from the same fixture data so documentation cannot silently diverge.

- [ ] **Step 4: Run the complete matrix**

  Run the commands from Step 2.

  Expected: PASS for all five personas; every forbidden case returns/redirects consistently and every allowed case is reachable from navigation.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/tests/integration/fivePersonaAuthorizationMatrix.test.js frontend/runtime-tests/fivePersonaPolicies.spec.jsx frontend/e2e/rbac-five-persona.spec.js frontend/playwright.config.js
  git add -f docs/rbac/authorization-matrix.md
  git commit -m "test(rbac): verify five-persona authorization matrix"
  ```

### Task 11: Final Regression, Security Audit, and Handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-11-16-canonical-rbac-capability-implementation-plan.md` to check completed tasks
- Modify: `CLAUDE.md` only when the user explicitly ends the session

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified implementation with no remaining required work from this plan.

- [ ] **Step 1: Run complete backend verification**

  Run:

  ```powershell
  npm --prefix backend test
  npm --prefix backend exec prisma validate
  ```

  Expected: all suites PASS and Prisma validates.

- [ ] **Step 2: Run complete frontend verification**

  Run:

  ```powershell
  npm --prefix frontend test
  npm --prefix frontend run test:runtime
  npm --prefix frontend run test:e2e
  npm --prefix frontend run lint
  npm --prefix frontend run build
  ```

  Expected: all tests/lint PASS and production build succeeds.

- [ ] **Step 3: Run repository-rule and authorization scans**

  Verify no legacy `group/groupMember`, mock workflow data, raw icon characters in button labels, UTF-8 BOM, unknown permission strings, new alias consumers, client-controlled scope authorization, page-local role bypasses, or unguarded mutation controls exist in changed scope.

- [ ] **Step 4: Perform manual five-persona smoke test**

  Sign in with one real account per persona against a disposable/staging database. Confirm dashboard/menu, one allowed action, one forbidden direct URL, one cross-resource denial, grant, revoke and cross-tab refresh. Record evidence without storing credentials in the repository.

- [ ] **Step 5: Cross-review security invariants**

  Review permission delta authority, transaction boundaries, audit rollback, resource-derived semester/department, publication privacy, independent BM05 grading, archive ownership, cache invalidation and frontend/backend policy parity.

- [ ] **Step 6: Commit completion markers**

  ```powershell
  git add -f docs/superpowers/plans/2026-11-16-canonical-rbac-capability-implementation-plan.md
  git commit -m "docs: complete canonical RBAC capability plan"
  ```

  Do not update `CLAUDE.md` here unless the user says `end phiên`.
