# Standardized Loading, Error Handling, and TanStack Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize server-state loading, error recovery, empty states, and route failures across the Admin, Lecturer, and Student workspaces while fixing the broken result approval, result publication, and archival dossier flows.

**Architecture:** Preserve the React Router application shell and place location-aware Suspense/error boundaries around the main Outlet. Keep Axios service modules as the HTTP boundary, add TanStack Query domain hooks and key factories above them, and migrate workflows incrementally so each page has one owner for each server resource.

**Tech Stack:** React 19, React Router 7, Vite 7, Ant Design 6, Axios, Zustand, TanStack Query 5, Vitest, Testing Library, jsdom, Playwright, Node test runner, Express, Jest/Supertest.

**Spec:** `docs/superpowers/specs/2026-11-13-standardized-loading-error-query-design.md`

## Global Constraints

- Keep `TopicRegistration` as the only thesis-registration architecture; never restore `group/groupMember`.
- Keep authentication and client-only UI state in Zustand; TanStack Query owns server state only.
- Keep existing service modules as the HTTP boundary; do not introduce a second HTTP client.
- Default query policy: `staleTime: 30000`, `gcTime: 300000`, `refetchOnWindowFocus: false`, mutations `retry: false`.
- Retry a query once only for network failures and HTTP `5xx`; never retry `401`, `403`, `404`, `409`, or `422`.
- Preserve the application shell during ordinary route navigation; full document reload is reserved for unrecoverable chunk-load failures.
- A migrated page must not retain an effect-based request for a resource now owned by a query hook.
- Preserve successful cached data during background refresh and background failure.
- Important errors require an inline recovery path; a toast alone is insufficient.
- Use `@ant-design/icons` through component props; never place raw symbols or emoji in button labels.
- Save all changed text/code files as UTF-8 without BOM.
- Do not expose student gender or date of birth through workflow, grading, council, or archive responses.

## Review Focus

- An API wrapper that rejects `{ success: false }` without Axios metadata must still preserve status/classification; Task 1 pins this with network, `403`, `409`, and `500` tests.
- Logging out and signing in as another user must not reveal the previous user's cached data; Task 2 pins identity-scoped keys and cache clearing.
- A route render crash followed by navigation must recover without reloading the document; Task 3 pins location reset and shell identity.
- A view-only publication user must read preview/history but never receive an enabled publish action; Tasks 4 and 5 pin backend and runtime authorization.
- An archive response containing keyed files and unsigned BM03/BM04 records must render the real state rather than unconditional success; Task 6 pins the canonical mapping.

---

### Task 1: Preserve HTTP Error Metadata

**Files:**
- Create: `frontend/src/utils/apiError.js`
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/services/archiveService.js`
- Modify: `frontend/src/services/evaluationService.js`
- Test: `frontend/tests/apiError.test.js`
- Test: `frontend/tests/sessionSyncAndReplay.test.js`

**Interfaces:**
- Produces: `normalizeApiError(error) -> { success:false, message, status?, code?, details?, errors?, requiresUserConfirmation? }`.
- Produces: `getErrorStatus(error) -> number | undefined`.
- Produces: `shouldRetryQuery(failureCount, error) -> boolean`.
- Preserves: stale-session replay, unsafe-mutation confirmation, `401` logout, and `403` session retention.

- [ ] **Step 1: Write failing metadata and retry tests**

Add Node tests asserting `403`, `409`, and `500` retain status; a network error retains transport code; `{success:false}` remains rejected; retry returns true only once for network/`5xx` and false for cancellation and `4xx`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test frontend/tests/apiError.test.js frontend/tests/sessionSyncAndReplay.test.js`

Expected: FAIL because the interceptor drops status and `apiError.js` does not exist.

- [ ] **Step 3: Implement compatible error normalization**

Normalize every rejection branch in the Axios response interceptor. Update service wrappers to pass normalized metadata through without changing successful response contracts.

- [ ] **Step 4: Run focused tests**

Run: `node --test frontend/tests/apiError.test.js frontend/tests/sessionSyncAndReplay.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/utils/apiError.js frontend/src/services/api.js frontend/src/services/archiveService.js frontend/src/services/evaluationService.js frontend/tests/apiError.test.js frontend/tests/sessionSyncAndReplay.test.js
git commit -m "fix(api): preserve error metadata for query recovery"
```

### Task 2: Add TanStack Query Foundation and Runtime Test Harness

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/src/query/queryClient.js`
- Create: `frontend/src/query/queryKeys.js`
- Create: `frontend/src/providers/AppQueryProvider.jsx`
- Create: `frontend/vitest.config.js`
- Create: `frontend/runtime-tests/setup.js`
- Test: `frontend/tests/queryClient.test.js`
- Test: `frontend/tests/queryKeys.test.js`
- Test: `frontend/runtime-tests/AppQueryProvider.spec.jsx`
- Test: `frontend/runtime-tests/AuthQueryIsolation.spec.jsx`

**Interfaces:**
- Consumes: `shouldRetryQuery(failureCount, error)` from Task 1.
- Produces: `createAppQueryClient() -> QueryClient`.
- Produces: `AppQueryProvider({ children, client? })`.
- Produces: `queryKeys` factories for `grading`, `archives`, `registrations`, `semesters`, `users`, `permissions`, `councils`, `topics`, `notifications`, and authenticated `scope`.
- Produces: `test:runtime` script using Vitest/jsdom without collecting legacy Node tests.

- [ ] **Step 1: Install dependencies and add the runtime script**

Run:

```powershell
npm --prefix frontend install @tanstack/react-query
npm --prefix frontend install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add `"test:runtime": "vitest run --config vitest.config.js"` and retain the existing `node --test` script.

- [ ] **Step 2: Write failing client, key, provider, and identity-isolation tests**

Assert exact defaults, one client per mounted provider, filter-sensitive keys, user/scope separation, query cancellation/cache removal on logout or identity change, and no stale data rendered for the next account.

- [ ] **Step 3: Run tests and confirm failure**

Run:

```powershell
node --test frontend/tests/queryClient.test.js frontend/tests/queryKeys.test.js
npm --prefix frontend run test:runtime -- runtime-tests/AppQueryProvider.spec.jsx runtime-tests/AuthQueryIsolation.spec.jsx
```

Expected: FAIL because provider, client, and factories do not exist.

- [ ] **Step 4: Implement provider, defaults, keys, and auth cache lifecycle**

Wrap router content with `AppQueryProvider`. Subscribe at the provider boundary to authenticated identity/permission-version changes; cancel active queries and remove prior identity-scoped cache without moving auth ownership out of Zustand.

- [ ] **Step 5: Run foundation and session regression tests**

Run:

```powershell
node --test frontend/tests/queryClient.test.js frontend/tests/queryKeys.test.js frontend/tests/sessionSyncAndReplay.test.js
npm --prefix frontend run test:runtime -- runtime-tests/AppQueryProvider.spec.jsx runtime-tests/AuthQueryIsolation.spec.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/App.jsx frontend/src/query frontend/src/providers frontend/vitest.config.js frontend/runtime-tests frontend/tests/queryClient.test.js frontend/tests/queryKeys.test.js
git commit -m "feat(frontend): add TanStack Query foundation"
```

### Task 3: Keep the Shell Stable and Standardize Content States

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Modify: `frontend/src/components/common/ErrorBoundary.jsx`
- Modify: `frontend/src/pages/__tests__/errorBoundaryUi.test.js`
- Create: `frontend/src/components/common/RouteContentBoundary.jsx`
- Create: `frontend/src/components/common/ContentSkeleton.jsx`
- Create: `frontend/src/components/common/QueryErrorState.jsx`
- Create: `frontend/src/components/common/EmptyState.jsx`
- Create: `frontend/src/components/common/ContentRefreshIndicator.jsx`
- Create: `frontend/src/utils/chunkError.js`
- Test: `frontend/runtime-tests/RouteContentBoundary.spec.jsx`
- Test: `frontend/runtime-tests/SharedQueryStates.spec.jsx`
- Test: `frontend/runtime-tests/PersistentShell.spec.jsx`

**Interfaces:**
- Produces: `RouteContentBoundary({ children })`, reset by `location.key`, pathname, and search.
- Produces: `ContentSkeleton({ variant='detail', rows=5 })` with `dashboard|table|detail|form` variants.
- Produces: `QueryErrorState({ error, onRetry, onBack, retrying=false })`.
- Produces: `EmptyState({ title, description, action })`.
- Produces: `ContentRefreshIndicator({ refreshing })`.
- Produces: `isChunkLoadError(error) -> boolean`.

- [ ] **Step 1: Write failing boundary and shared-state runtime tests**

Cover render error/retry, location reset, production stack hiding, chunk-only reload, loading vs empty vs error, `aria-busy`, alert/live semantics, keyboard retry, cached content during refresh, and persistent sidebar/header DOM identity.

- [ ] **Step 2: Run runtime tests and confirm failure**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/RouteContentBoundary.spec.jsx runtime-tests/SharedQueryStates.spec.jsx runtime-tests/PersistentShell.spec.jsx`

Expected: FAIL because shared components and local boundaries do not exist.

- [ ] **Step 3: Implement the content boundary and states**

Place `RouteContentBoundary > Suspense(ContentSkeleton) > Outlet` inside `AppLayout` main content. Keep a root fallback only for public/standalone routes. Replace hard reload/home actions in recoverable route errors with in-app retry/back behavior.

- [ ] **Step 4: Run boundary, navigation, and build verification**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/RouteContentBoundary.spec.jsx runtime-tests/SharedQueryStates.spec.jsx runtime-tests/PersistentShell.spec.jsx
node --test frontend/src/pages/__tests__/errorBoundaryUi.test.js frontend/tests/appLayoutNavigationActive.test.js
npm --prefix frontend run build
```

Expected: PASS; build completes without undefined imports.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/App.jsx frontend/src/components/layout/AppLayout.jsx frontend/src/components/common/ErrorBoundary.jsx frontend/src/components/common/RouteContentBoundary.jsx frontend/src/components/common/ContentSkeleton.jsx frontend/src/components/common/QueryErrorState.jsx frontend/src/components/common/EmptyState.jsx frontend/src/components/common/ContentRefreshIndicator.jsx frontend/src/utils/chunkError.js frontend/src/pages/__tests__/errorBoundaryUi.test.js frontend/runtime-tests/RouteContentBoundary.spec.jsx frontend/runtime-tests/SharedQueryStates.spec.jsx frontend/runtime-tests/PersistentShell.spec.jsx
git commit -m "feat(ui): standardize route loading and error recovery"
```

### Task 4: Align Result Read and Publication Permissions

**Files:**
- Modify: `backend/src/routes/evaluationRoutes.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/config/navigationRegistry.js`
- Test: `backend/tests/integration/resultReadPermissions.test.js`
- Test: `backend/tests/integration/defenseAuthorization.routes.test.js`
- Test: `frontend/tests/rbacUiContracts.test.js`

**Interfaces:**
- Produces: approval viewers/approvers may GET defense-center approval data.
- Produces: `VIEW_RESULT_PUBLICATIONS` may GET publication preview/history.
- Preserves: only `DEFENSE_RESULT_APPROVE` may approve; only `RESULT_PUBLICATION_PUBLISH` may publish.
- Removes: frontend dependence on nonexistent `RESULT_PUBLICATION_MANAGE` and legacy `RESULT_PUBLISH`.

- [ ] **Step 1: Write failing authorization tests**

Cover approval viewer GET success/POST failure, publication viewer preview/history success/POST failure, canonical publisher success, unrelated permission failure, and response projections without `gender`/`dateOfBirth`.

- [ ] **Step 2: Run tests and confirm current permission failures**

Run: `npm --prefix backend test -- --runTestsByPath tests/integration/resultReadPermissions.test.js tests/integration/defenseAuthorization.routes.test.js`

Expected: FAIL for read-only approval/publication users.

- [ ] **Step 3: Change read guards and frontend permission aliases**

Expand only the necessary GET guards. Do not broaden council-management permissions or mutation guards.

- [ ] **Step 4: Run backend and frontend permission tests**

Run:

```powershell
npm --prefix backend test -- --runTestsByPath tests/integration/resultReadPermissions.test.js tests/integration/defenseAuthorization.routes.test.js
node --test frontend/tests/rbacUiContracts.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/routes/evaluationRoutes.js backend/tests/integration/resultReadPermissions.test.js backend/tests/integration/defenseAuthorization.routes.test.js frontend/src/App.jsx frontend/src/config/navigationRegistry.js frontend/tests/rbacUiContracts.test.js
git commit -m "fix(rbac): align result read and publication permissions"
```

### Task 5: Migrate Result Approval and Publication

**Files:**
- Modify: `frontend/src/pages/admin/GradingDefensePage.jsx`
- Modify: `frontend/src/components/admin/DefenseResultPublicationModal.jsx`
- Modify: `frontend/src/components/admin/PublicationHistoryModal.jsx`
- Modify: `frontend/src/services/evaluationService.js`
- Modify: `frontend/src/query/queryKeys.js`
- Create: `frontend/src/queries/gradingQueries.js`
- Test: `frontend/runtime-tests/resultApprovals.spec.jsx`
- Test: `frontend/runtime-tests/resultPublications.spec.jsx`
- Test: `frontend/src/pages/__tests__/councilAndGradingDeepLinking.test.js`
- Test: `frontend/src/pages/__tests__/defenseToCompletionUI.test.js`

**Interfaces:**
- Produces: `useDefenseResults(scope, filters)` and `useResultApprovals(scope, filters)`.
- Produces: `usePublicationHistory(scope, semesterId)` and `usePublicationPreview(scope, semesterId)`.
- Produces: approval/publish mutation hooks that invalidate exact ledger, approval, history, and preview keys.
- Removes: undefined `handleExportExcel`; no export control remains unless backed by an implemented service contract.

- [ ] **Step 1: Write failing runtime tests for both deep links**

Mount actual `?tab=approvals` and `?tab=publish` routes. Assert no undefined handler, cached rows survive refresh failure, approval viewer lacks mutation controls, publication viewer sees history/preview but cannot publish, publisher can submit, and failed publish preserves form input.

- [ ] **Step 2: Run tests and confirm render/permission failures**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/resultApprovals.spec.jsx runtime-tests/resultPublications.spec.jsx`

Expected: FAIL with the current undefined handler and manual permission/fetch behavior.

- [ ] **Step 3: Implement focused grading queries and migrate the page/modals**

Derive approval rows from the shared defense-center query. Gate or derive optional council filters instead of fetching unauthorized council lists. Use actual publish permission only for mutations.

- [ ] **Step 4: Run runtime, legacy, backend immutability, and build tests**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/resultApprovals.spec.jsx runtime-tests/resultPublications.spec.jsx
node --test frontend/src/pages/__tests__/councilAndGradingDeepLinking.test.js frontend/src/pages/__tests__/defenseToCompletionUI.test.js
npm --prefix backend test -- --runTestsByPath tests/integration/defensePublicationImmutability.test.js tests/services/defenseResultPublicationService.test.js
npm --prefix frontend run build
```

Expected: PASS; publication correction remains rejected.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/admin/GradingDefensePage.jsx frontend/src/components/admin/DefenseResultPublicationModal.jsx frontend/src/components/admin/PublicationHistoryModal.jsx frontend/src/services/evaluationService.js frontend/src/query/queryKeys.js frontend/src/queries/gradingQueries.js frontend/runtime-tests/resultApprovals.spec.jsx frontend/runtime-tests/resultPublications.spec.jsx frontend/src/pages/__tests__/councilAndGradingDeepLinking.test.js frontend/src/pages/__tests__/defenseToCompletionUI.test.js
git commit -m "fix(grading): repair approval and publication workflows"
```

### Task 6: Normalize and Migrate the Student Archival Dossier

**Files:**
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/components/forms/ArchiveSubmissionModal.jsx`
- Modify: `frontend/src/services/archiveService.js`
- Modify: `frontend/src/query/queryKeys.js`
- Create: `frontend/src/queries/archiveQueries.js`
- Create: `frontend/src/queries/registrationQueries.js`
- Test: `frontend/runtime-tests/archiveDossier.spec.jsx`
- Test: `frontend/src/pages/student/__tests__/SubmissionPage.test.js`
- Test: `frontend/src/pages/__tests__/archivalCrossCheckUi.test.js`

**Interfaces:**
- Produces: `normalizeDefenseDossier(data)` mapping `windows -> timeWindows`, keyed `currentFiles -> documents[]`, `linkedBm03 -> bm03Record`, and `linkedBm04 -> bm04Record`.
- Produces: `useStudentArchive(scope, registrationId)` and `useDefenseDossier(scope, registrationId)` enabled only with an ID.
- Produces: archive upload mutation invalidating exact archive, dossier, and registration keys.
- Preserves: `currentFiles` four-type semantics and actual signature/download state.

- [ ] **Step 1: Write failing normalization and runtime tests**

Cover deterministic `tab=archive`, missing icon detection through actual render, existing keyed files, null files, unsigned/signed BM03 and BM04, closed window, ineligible status, API failure/retry, shared modal/page cache, and upload invalidation.

- [ ] **Step 2: Run tests and confirm current failures**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/archiveDossier.spec.jsx`

Expected: FAIL on query-tab selection, response shape, and missing `UploadOutlined`.

- [ ] **Step 3: Normalize the service contract and migrate archive UI**

Read `useSearchParams`, import the Ant Design icon, remove unconditional success labels, and replace duplicate archive-summary/dossier effects with focused queries.

- [ ] **Step 4: Run archive regression and build tests**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/archiveDossier.spec.jsx
node --test frontend/src/pages/student/__tests__/SubmissionPage.test.js frontend/src/pages/__tests__/archivalCrossCheckUi.test.js
npm --prefix backend test -- --runTestsByPath tests/integration/defenseDossierAndSnapshots.test.js tests/integration/archivalTwoStageAndDirectorSignature.test.js
npm --prefix frontend run build
```

Expected: PASS; workflow projections contain no sensitive student fields.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/student/SubmissionPage.jsx frontend/src/components/forms/ArchiveSubmissionModal.jsx frontend/src/services/archiveService.js frontend/src/query/queryKeys.js frontend/src/queries/archiveQueries.js frontend/src/queries/registrationQueries.js frontend/runtime-tests/archiveDossier.spec.jsx frontend/src/pages/student/__tests__/SubmissionPage.test.js frontend/src/pages/__tests__/archivalCrossCheckUi.test.js
git commit -m "fix(archive): normalize and migrate student dossier"
```

### Task 7: Migrate Admin Dashboard, Reports, Users, and Permissions

**Files:**
- Modify: `frontend/src/pages/admin/DashboardPage.jsx`
- Modify: `frontend/src/pages/admin/AcademicReportsPage.jsx`
- Modify: `frontend/src/pages/admin/UserManagementPage.jsx`
- Modify: `frontend/src/pages/admin/PermissionGroupPage.jsx`
- Create: `frontend/src/queries/dashboardQueries.js`
- Create: `frontend/src/queries/reportQueries.js`
- Create: `frontend/src/queries/userQueries.js`
- Create: `frontend/src/queries/permissionQueries.js`
- Create: `frontend/src/queries/semesterQueries.js`
- Test: `frontend/runtime-tests/adminCoreQueries.spec.jsx`
- Test: `frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`
- Test: `frontend/src/pages/__tests__/academicReportsPage.test.js`
- Test: `frontend/tests/permissionGroupPageLazyLoad.test.js`

**Interfaces:**
- Produces: typed-by-contract query hooks for dashboard panels, report overview/workload, users/role counts, permission groups/matrix, and semesters.
- Produces: mutation hooks invalidating the smallest owning list/detail/count keys.

- [ ] **Step 1: Write failing runtime tests for independent panel states**

Assert one failed dashboard/report panel does not erase successful panels; user/permission mutations invalidate lists; failed requests are not cached as empty; returning to a page shows cached content during refresh.

- [ ] **Step 2: Run runtime tests and confirm failure**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/adminCoreQueries.spec.jsx`

Expected: FAIL because pages use effect-level loading and fallback empty values.

- [ ] **Step 3: Implement domain queries and migrate the four pages**

Keep table filters, form drafts, selection, and export progress local. Split independent dashboard/report panels into independent queries instead of one catch-to-empty `Promise.all`.

- [ ] **Step 4: Run targeted tests**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/adminCoreQueries.spec.jsx
node --test frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js frontend/src/pages/__tests__/academicReportsPage.test.js frontend/tests/permissionGroupPageLazyLoad.test.js frontend/tests/permissionMatrixP1Optimization.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/admin/DashboardPage.jsx frontend/src/pages/admin/AcademicReportsPage.jsx frontend/src/pages/admin/UserManagementPage.jsx frontend/src/pages/admin/PermissionGroupPage.jsx frontend/src/queries/dashboardQueries.js frontend/src/queries/reportQueries.js frontend/src/queries/userQueries.js frontend/src/queries/permissionQueries.js frontend/src/queries/semesterQueries.js frontend/runtime-tests/adminCoreQueries.spec.jsx frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js frontend/src/pages/__tests__/academicReportsPage.test.js frontend/tests/permissionGroupPageLazyLoad.test.js frontend/tests/permissionMatrixP1Optimization.test.js
git commit -m "refactor(admin): migrate core data pages to queries"
```

### Task 8: Migrate Admin Periods, Councils, and Enrollment

**Files:**
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx`
- Modify: `frontend/src/pages/admin/CouncilAssignmentPage.jsx`
- Modify: `frontend/src/pages/admin/CouncilDetailPage.jsx`
- Modify: `frontend/src/components/admin/CouncilAuditLogModal.jsx`
- Modify: `frontend/src/pages/admin/ProjectEnrollmentPage.jsx`
- Modify: `frontend/src/components/coordination/CoordinationOverviewTab.jsx`
- Modify: `frontend/src/components/coordination/LecturerAssignmentTab.jsx`
- Create: `frontend/src/queries/periodQueries.js`
- Create: `frontend/src/queries/delegationQueries.js`
- Create: `frontend/src/queries/bm02aQueries.js`
- Create: `frontend/src/queries/councilQueries.js`
- Create: `frontend/src/queries/enrollmentQueries.js`
- Create: `frontend/src/queries/lecturerAssignmentQueries.js`
- Test: `frontend/runtime-tests/adminCoordinationQueries.spec.jsx`

**Interfaces:**
- Produces: period/delegation/decision/BM02A, council list/detail/log, enrollment, and lecturer-assignment hooks with all round/semester/catalog/status/search/pagination filters in their keys.
- Uses: semester, registration, user, and grading keys from earlier tasks.

- [ ] **Step 1: Write failing runtime tests by resource boundary**

Cover URL tab retention, enabled-only detail queries, list/detail invalidation, child modal request deduplication, pagination key separation, mutation error input retention, and no duplicate page/child request for the same resource.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/adminCoordinationQueries.spec.jsx`

Expected: FAIL with manual page/component fetching.

- [ ] **Step 3: Migrate one resource group at a time inside the task**

Do not restructure the large page layouts. Replace period resources first, councils second, and enrollment/assignment third; after each resource moves, remove only its matching effect.

- [ ] **Step 4: Run targeted regressions**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/adminCoordinationQueries.spec.jsx
node --test frontend/src/pages/__tests__/projectPeriodGraceful.test.js frontend/tests/projectEnrollmentCoordinationHub.test.js frontend/tests/projectEnrollmentService.test.js frontend/src/pages/admin/__tests__/CouncilAssignmentPage.test.js frontend/src/pages/__tests__/councilLogsAndScorebookReturns.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/admin/ProjectPeriodPage.jsx frontend/src/pages/admin/CouncilAssignmentPage.jsx frontend/src/pages/admin/CouncilDetailPage.jsx frontend/src/components/admin/CouncilAuditLogModal.jsx frontend/src/pages/admin/ProjectEnrollmentPage.jsx frontend/src/components/coordination/CoordinationOverviewTab.jsx frontend/src/components/coordination/LecturerAssignmentTab.jsx frontend/src/queries/periodQueries.js frontend/src/queries/delegationQueries.js frontend/src/queries/bm02aQueries.js frontend/src/queries/councilQueries.js frontend/src/queries/enrollmentQueries.js frontend/src/queries/lecturerAssignmentQueries.js frontend/runtime-tests/adminCoordinationQueries.spec.jsx
git commit -m "refactor(admin): migrate coordination workflows to queries"
```

### Task 9: Migrate Remaining Admin Workflows

**Files:**
- Modify: `frontend/src/pages/admin/TopicManagementPage.jsx`
- Modify: `frontend/src/pages/admin/RubricManagementPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectOversightPage.jsx`
- Modify: `frontend/src/pages/admin/AnnouncementManagementPage.jsx`
- Modify: `frontend/src/pages/admin/PortalContentManagementPage.jsx`
- Modify: `frontend/src/pages/admin/NotificationCenterPage.jsx`
- Create: `frontend/src/queries/topicQueries.js`
- Create: `frontend/src/queries/rubricQueries.js`
- Create: `frontend/src/queries/oversightQueries.js`
- Create: `frontend/src/queries/manualReviewQueries.js`
- Create: `frontend/src/queries/announcementQueries.js`
- Create: `frontend/src/queries/portalQueries.js`
- Create: `frontend/src/queries/notificationQueries.js`
- Test: `frontend/runtime-tests/adminRemainingQueries.spec.jsx`

**Interfaces:**
- Produces: focused queries for topics, rubric versions, oversight tabs, manual review, archive/certificate, announcements, portal content, and notifications.
- Preserves: form drafts and editor state outside query cache.

- [ ] **Step 1: Write failing per-tab and per-panel runtime tests**

Assert lazy enabled queries, independent failures, stable drafts during background refresh, precise invalidation, and distinct empty/error states for notifications and portal content.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/adminRemainingQueries.spec.jsx`

Expected: FAIL before query modules exist.

- [ ] **Step 3: Migrate without large-page visual refactors**

For `ProjectOversightPage`, migrate overview, BM03/BM04/manual review, then archive/certificate resources separately and remove each matching effect immediately.

- [ ] **Step 4: Run runtime, legacy, and build tests**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/adminRemainingQueries.spec.jsx
node --test frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js frontend/src/pages/__tests__/notificationBadgeAndPostDefenseCountdown.test.js
npm --prefix frontend run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/admin/TopicManagementPage.jsx frontend/src/pages/admin/RubricManagementPage.jsx frontend/src/pages/admin/ProjectOversightPage.jsx frontend/src/pages/admin/AnnouncementManagementPage.jsx frontend/src/pages/admin/PortalContentManagementPage.jsx frontend/src/pages/admin/NotificationCenterPage.jsx frontend/src/queries/topicQueries.js frontend/src/queries/rubricQueries.js frontend/src/queries/oversightQueries.js frontend/src/queries/manualReviewQueries.js frontend/src/queries/announcementQueries.js frontend/src/queries/portalQueries.js frontend/src/queries/notificationQueries.js frontend/runtime-tests/adminRemainingQueries.spec.jsx
git commit -m "refactor(admin): migrate remaining workflows to queries"
```

### Task 10: Migrate Lecturer Workflows

**Files:**
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Modify: `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
- Modify: `frontend/src/pages/lecturer/TopicManagementPage.jsx`
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
- Modify: `frontend/src/pages/lecturer/GradingPage.jsx`
- Modify: `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`
- Modify: `frontend/src/pages/lecturer/components/OutlineCouncilGradingCard.jsx`
- Create: `frontend/src/queries/taskQueries.js`
- Create: `frontend/src/queries/meetingQueries.js`
- Create: `frontend/src/queries/checkpointQueries.js`
- Test: `frontend/runtime-tests/lecturerQueries.spec.jsx`

**Interfaces:**
- Reuses: registration, topic, grading, council, archive, and BM02A query modules.
- Produces: task, meeting-log, checkpoint, title-adjustment, and lecturer-dashboard hooks.
- Preserves: score drafts, AI generation, selected registration, URL tabs, and upload progress as local state.

- [ ] **Step 1: Write failing lecturer runtime tests**

Cover dashboard partial failure, council-assignment gating, selected-registration enabled queries, score-draft preservation, mutation invalidation, background refresh, and no dossier `403` regression.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/lecturerQueries.spec.jsx`

Expected: FAIL with current full-content loaders and duplicate effects.

- [ ] **Step 3: Implement lecturer query modules and migrate pages**

Move one server resource at a time; never store editable grading drafts in query data.

- [ ] **Step 4: Run lecturer regressions**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/lecturerQueries.spec.jsx
node --test frontend/src/pages/lecturer/__tests__/progressTrackingTdz.test.js frontend/src/pages/__tests__/gradingPageRouteAlignment.test.js frontend/src/pages/lecturer/__tests__/bm03AndBm04Ui.test.js
npm --prefix frontend run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/lecturer/LecturerDashboardPage.jsx frontend/src/pages/lecturer/TopicApprovalPage.jsx frontend/src/pages/lecturer/TopicManagementPage.jsx frontend/src/pages/lecturer/ProgressTrackingPage.jsx frontend/src/pages/lecturer/GradingPage.jsx frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx frontend/src/pages/lecturer/components/OutlineCouncilGradingCard.jsx frontend/src/queries/taskQueries.js frontend/src/queries/meetingQueries.js frontend/src/queries/checkpointQueries.js frontend/runtime-tests/lecturerQueries.spec.jsx
git commit -m "refactor(lecturer): migrate workflows to queries"
```

### Task 11: Migrate Remaining Student Workflows

**Files:**
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx`
- Modify: `frontend/src/pages/student/TopicListPage.jsx`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/pages/student/GradeViewPage.jsx`
- Create: `frontend/src/queries/studentDashboardQueries.js`
- Create: `frontend/src/queries/outlineQueries.js`
- Test: `frontend/runtime-tests/studentQueries.spec.jsx`

**Interfaces:**
- Reuses: topic, registration, archive, grading, task, meeting, and checkpoint queries.
- Produces: `useStudentStats`, `useMyOutline`, `useAllowedActions`, `useMyGrades`, `useMyPublishedResult`, and clearance-certificate queries.
- Preserves: form drafts, selected topic, filters, and upload state locally.

- [ ] **Step 1: Write failing student runtime tests**

Cover dashboard panel failures, topic availability invalidation after registration/proposal, tab-specific submission queries, grade publication states, archive reuse without duplicate requests, and cached refresh behavior.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm --prefix frontend run test:runtime -- runtime-tests/studentQueries.spec.jsx`

Expected: FAIL with manual effects and swallowed failures.

- [ ] **Step 3: Migrate student resources and remove matching effects**

Reuse the archive cache from Task 6 and shared registration cache; do not fetch the same dossier separately in dashboard, submission page, and grade page.

- [ ] **Step 4: Run student regressions**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/studentQueries.spec.jsx
node --test frontend/tests/gradeViewCrashFix.test.js frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js frontend/src/pages/student/__tests__/SubmissionPage.test.js
npm --prefix frontend run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/student/StudentDashboardPage.jsx frontend/src/pages/student/TopicListPage.jsx frontend/src/pages/student/SubmissionPage.jsx frontend/src/pages/student/GradeViewPage.jsx frontend/src/queries/studentDashboardQueries.js frontend/src/queries/outlineQueries.js frontend/runtime-tests/studentQueries.spec.jsx
git commit -m "refactor(student): migrate workflows to queries"
```

### Task 12: Migrate Shared Pages and Complete the Request Audit

**Files:**
- Modify: `frontend/src/pages/common/NotificationsPage.jsx`
- Modify: `frontend/src/pages/common/ProfilePage.jsx`
- Modify: `frontend/src/pages/common/HomePage.jsx`
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Modify: `frontend/src/components/admin/BM02ReviewDrawer.jsx`
- Modify: `frontend/src/components/admin/CheckpointAppealReviewModal.jsx`
- Modify: `frontend/src/components/admin/CorrectDefenseResultModal.jsx`
- Modify: `frontend/src/components/admin/ManualReviewModal.jsx`
- Modify: `frontend/src/components/admin/MentorTransferModal.jsx`
- Modify: `frontend/src/components/common/AcademicChatWidget.jsx`
- Modify: `frontend/src/components/common/RegistrationTimelineDrawer.jsx`
- Modify: `frontend/src/components/forms/BMReviewDrawer.jsx`
- Modify: `frontend/src/components/forms/HybridBMFormModal.jsx`
- Modify: `frontend/src/components/lecturer/BM04EvaluationModal.jsx`
- Modify: `frontend/src/components/lecturer/CheckpointIssueModal.jsx`
- Modify: `frontend/src/components/lecturer/OutlineReviewModal.jsx`
- Modify: `frontend/src/components/student/CheckpointSignModal.jsx`
- Modify: `frontend/src/components/student/TitleAdjustmentModal.jsx`
- Test: `frontend/runtime-tests/sharedQueries.spec.jsx`
- Test: `frontend/tests/queryMigrationAudit.test.js`

**Interfaces:**
- Reuses: notification, user, portal, announcement, and council query modules.
- Produces: an audit allowlist containing only intentional non-query effects such as subscriptions, timers, DOM synchronization, and one-off non-server actions.

- [ ] **Step 1: Write failing shared-page and migration-audit tests**

Assert loading/error/empty behavior for common pages; scan routed pages and fetching child components for unapproved service calls in mount effects; fail on duplicate query/effect ownership.

- [ ] **Step 2: Run tests and confirm remaining violations**

Run:

```powershell
npm --prefix frontend run test:runtime -- runtime-tests/sharedQueries.spec.jsx
node --test frontend/tests/queryMigrationAudit.test.js
```

Expected: FAIL listing remaining manual fetch sites.

- [ ] **Step 3: Migrate shared pages and documented child components**

Keep realtime subscriptions and non-server synchronization effects. Remove only request effects covered by domain queries and document each audit exception.

- [ ] **Step 4: Run the audit and complete frontend suites**

Run:

```powershell
npm --prefix frontend run test:runtime
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

Expected: PASS; audit reports no unapproved manual server-state fetches.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/common/NotificationsPage.jsx frontend/src/pages/common/ProfilePage.jsx frontend/src/pages/common/HomePage.jsx frontend/src/components/layout/AppLayout.jsx frontend/src/components/admin/BM02ReviewDrawer.jsx frontend/src/components/admin/CheckpointAppealReviewModal.jsx frontend/src/components/admin/CorrectDefenseResultModal.jsx frontend/src/components/admin/ManualReviewModal.jsx frontend/src/components/admin/MentorTransferModal.jsx frontend/src/components/common/AcademicChatWidget.jsx frontend/src/components/common/RegistrationTimelineDrawer.jsx frontend/src/components/forms/BMReviewDrawer.jsx frontend/src/components/forms/HybridBMFormModal.jsx frontend/src/components/lecturer/BM04EvaluationModal.jsx frontend/src/components/lecturer/CheckpointIssueModal.jsx frontend/src/components/lecturer/OutlineReviewModal.jsx frontend/src/components/student/CheckpointSignModal.jsx frontend/src/components/student/TitleAdjustmentModal.jsx frontend/tests/queryMigrationAudit.test.js frontend/runtime-tests/sharedQueries.spec.jsx
git commit -m "refactor(frontend): complete query migration audit"
```

### Task 13: Add Browser Regression Coverage

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/playwright.config.js`
- Create: `frontend/e2e/loading-error-navigation.spec.js`
- Create: `frontend/e2e/result-and-archive-flows.spec.js`

**Interfaces:**
- Produces: `test:e2e` script and deterministic API interception helpers.
- Verifies: document navigation count, persistent shell, slow/failed API states, route-error recovery, cache revisit, and keyboard-accessible retry.

- [ ] **Step 1: Install Playwright test support and write failing browser tests**

Run: `npm --prefix frontend install -D @playwright/test`

Configure the test server and create tests that intercept APIs rather than requiring live Supabase data.

- [ ] **Step 2: Run tests and confirm uncovered behavior**

Run: `npm --prefix frontend run test:e2e`

Expected: FAIL until fixtures/selectors and all standardized states are wired.

- [ ] **Step 3: Add only missing testability hooks or accessibility selectors**

Use semantic roles and labels first; add stable `data-testid` only where no user-facing selector is available.

- [ ] **Step 4: Run browser tests**

Run: `npm --prefix frontend run test:e2e`

Expected: PASS with no full document reload during ordinary menu navigation.

- [ ] **Step 5: Commit**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/playwright.config.js frontend/e2e/loading-error-navigation.spec.js frontend/e2e/result-and-archive-flows.spec.js
git commit -m "test(e2e): cover loading error and navigation recovery"
```

### Task 14: Final Verification and Documentation

**Files:**
- Modify: `CLAUDE.md` only when ending the session under the repository session rules.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified full application with no required work remaining for this plan.

- [ ] **Step 1: Run complete backend tests**

Run: `npm --prefix backend test`

Expected: all suites PASS.

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

- [ ] **Step 3: Verify repository rules**

Run focused scans for legacy `group/groupMember`, unapproved mock data, raw icon characters in button labels, UTF-8 BOM, duplicate server-state effects, and sensitive student fields in workflow DTOs.

Expected: no violations in changed scope.

- [ ] **Step 4: Perform final cross-review**

Review query key completeness, invalidation precision, permissions, error recovery, accessibility, cached-data isolation, and the three original failure reproductions.

- [ ] **Step 5: Commit session documentation if requested**

```powershell
git add CLAUDE.md
git commit -m "docs: record loading and error standardization"
```
