# Standardized Loading, Error Handling, and TanStack Query Design

**Date:** 2026-11-13

## Intent

Standardize data loading, error recovery, empty states, and route failures across the Admin, Lecturer, and Student workspaces. Navigation must preserve the application shell and update only the main content region. TanStack Query becomes the shared server-state layer while existing service modules remain the HTTP boundary.

The first rollout also fixes the confirmed failures in lecturer result approval/publication and the student archival dossier flow.

## Current Problems

### Lecturer result approval and publication

- Both navigation entries render `GradingDefensePage`.
- The component references an undefined `handleExportExcel`, so both routes can crash during render before their API effects complete.
- Publication permissions are inconsistent: the menu recognizes view permissions, while parts of the page and backend history/preview routes require publish permissions.
- Existing tests mostly inspect source contracts and therefore miss runtime render failures.

### Student archival dossier

- Navigation links to `/student/submissions?tab=archive`, but `SubmissionPage` does not read the tab query parameter.
- `SubmissionPage` references `UploadOutlined` without importing it, which can crash actionable submission states.
- The frontend expects `documents`, `bm03Record`, and `bm04Record`, while the backend dossier contract returns `currentFiles`, `linkedBm03`, and `linkedBm04`.
- Some missing or failed responses are rendered as valid empty content.

### Application-wide loading and error behavior

- Workspace navigation already uses React Router SPA navigation, but pages commonly remount and refetch with page-level `useEffect` code.
- Several pages replace the entire main content with a spinner on every mount, creating the impression of a full-page reload.
- The root Suspense boundary is broader than the persistent application shell.
- The Outlet error boundary does not reset when the location changes, so a render failure can remain visible after navigating elsewhere.
- Loading, empty, failed, and background-refresh states are implemented inconsistently. Some request failures are swallowed and shown as legitimate zero counts or empty lists.
- Error recovery currently includes hard document reloads where an in-app retry would be sufficient.

## Goals

- Keep the sidebar, header, and workspace chrome mounted during normal route navigation.
- Lazy-load and update only the main content region.
- Introduce TanStack Query as the standard server-state mechanism.
- Distinguish initial loading, background refresh, empty data, request failure, and render failure.
- Preserve usable cached data while refreshing or when a background refresh fails.
- Give every recoverable error a clear recovery action.
- Reset route-level render errors when the URL changes.
- Centralize query-key conventions, retry rules, and invalidation behavior.
- Fix the three confirmed broken user flows as the first adoption slice.
- Add runtime rendering and browser-level coverage so undefined identifiers and response-contract mismatches cannot pass unnoticed.

## Non-goals

- Do not rewrite the existing Axios/service layer.
- Do not move authentication state from Zustand into TanStack Query.
- Do not redesign the visual identity or navigation information architecture.
- Do not change academic workflow rules or restore the legacy `group/groupMember` model.
- Do not convert all pages in one unreviewable change.
- Do not add offline-first mutation queues or persistent browser caches.
- Do not use toast notifications as the only presentation of important errors.

## Approaches Considered

### 1. Foundation first, then migrate by workflow — chosen

Add the shared query/error/loading foundation, repair the three broken flows, then migrate Admin, Lecturer, and Student pages in controlled slices. Pages not yet migrated continue to work with their existing effects until their slice begins.

This gives the best balance of consistency, testability, and rollback safety. Each workflow can be verified before the next one changes.

### 2. Convert every page in one release

This reaches consistency sooner but creates a large regression surface across permissions, query keys, mutations, and loading states. It is rejected because failures would be difficult to isolate.

### 3. Wrap every service with one generic query hook

This is quick initially but obscures domain-specific query keys, invalidation rules, permissions, and result types. It is rejected in favor of focused hooks per business domain.

## Architecture

### Provider placement

Add an `AppQueryProvider` near the application root. It owns one `QueryClient` and wraps router content without owning authentication or presentation state.

Default policy:

- Queries use a short default stale interval of 30 seconds and a five-minute garbage-collection interval.
- Domain hooks may override freshness when the data changes more or less frequently.
- Retry once for transient network errors and server `5xx` responses.
- Do not retry `401`, `403`, `404`, `409`, or `422` responses.
- Mutations do not retry automatically.
- Window-focus refetch is disabled by default to avoid disruptive refreshes in administrative forms; specific read-only screens may opt in.

### Persistent shell and route content

`AppLayout` remains mounted for normal workspace navigation. The sidebar, header, notifications, and role-specific shell stay visible while the Outlet changes.

Move lazy-route loading behavior into the main content region. A route chunk that is loading renders a stable content skeleton, not a replacement for the entire application shell.

Wrap the Outlet with a location-aware `RouteContentBoundary`:

- Catch render failures in the active route.
- Reset when `location.key` or the pathname/search target changes.
- Offer in-app **Thử lại** and **Quay lại** actions.
- Reserve `location.reload()` for unrecoverable chunk-loading failures.

### Server-state ownership

Existing services remain responsible for HTTP requests and response normalization. Domain query hooks own caching and invalidation, for example:

- `useDefenseResults`
- `useResultApprovals`
- `usePublicationHistory`
- `useStudentArchive`

Query keys are created by domain factories rather than handwritten arrays in pages. A representative hierarchy is:

```text
grading.all
grading.list(filters)
grading.approvals(filters)
grading.publications(filters)
archives.all
archives.detail(registrationId)
registrations.detail(registrationId)
```

Keys include every server-visible filter that can change a response, including period, semester, role scope, tab, and registration ID where relevant.

## Shared UI States

### Initial loading

When no cached data exists, show a structural skeleton matching the page type:

- dashboard metrics and cards;
- table header and rows;
- detail sections;
- form fields.

Skeletons reserve layout space and use `aria-busy` on the affected content region. Avoid a flashing spinner for near-instant requests.

### Background refresh

When cached data exists, keep it visible. Show a small `ContentRefreshIndicator` near the page toolbar or affected section. Do not blank the page.

### Empty state

Render an `EmptyState` only after a successful response with a valid empty result. The message and action are specific to the workflow.

### Request failure

Render `QueryErrorState` inside the failed content region. It contains:

- a plain-language summary;
- the next safe action;
- a **Thử lại** button wired to the query refetch;
- an optional collapsed technical reference for support.

Use `role="alert"` or an appropriate live region when the failure appears after an interaction. A toast may supplement the inline error but cannot replace it.

### Render failure

Render `RouteContentBoundary` inside the shell. The failure view must not expose stack traces in production. Development may log the component stack.

## Error Classification

- `401`: clear the invalid session and redirect to the sign-in flow.
- `403`: explain that the account lacks access; do not retry automatically.
- `404`: show that the requested record no longer exists and offer navigation back to the owning list.
- `409`: explain the current workflow-state conflict and refresh the affected query.
- `422`: keep field-level errors near their inputs and focus an accessible error summary when multiple fields fail.
- Network/`5xx`: show retry and preserve cached data when available.
- Chunk-load failure: offer one controlled full reload because the deployed asset may have changed.

## Read and Mutation Flows

### Read

1. The route loads inside the persistent shell.
2. A domain hook calls the existing service.
3. TanStack Query returns fresh cache immediately when available.
4. Stale data remains visible during background refresh.
5. Successful empty data renders an empty state; failed data renders an error state.

### Mutation

1. A focused mutation hook calls the existing service.
2. Validation and workflow errors stay in the initiating form or modal.
3. On success, update exact cached records when the response is authoritative; otherwise invalidate the smallest related key set.
4. Disable only the action being submitted, not the whole page.
5. Preserve form input when the mutation fails.

## First Adoption Slice

### Lecturer result approval

- Remove the undefined export-handler render failure by implementing or removing the unsupported action according to the actual export contract.
- Load approval data through a focused query hook.
- Align route, menu, page, and backend read permissions.
- Add runtime rendering tests for the approvals deep link.

### Lecturer result publication

- Separate view-history permission from publish mutation permission.
- Users with view permission can see publication history and preview data but cannot execute publish actions.
- Load publication data through focused queries and invalidate it after a successful publication.
- Add runtime rendering tests for the publication deep link.

### Student archival dossier

- Make `tab=archive` select the archive view deterministically.
- Correct missing icon imports under the repository's Ant Design icon standard.
- Normalize the dossier response once in the service or domain hook so UI components consume one documented shape.
- Render BM03/BM04 and uploaded-file status from actual response fields; never show unconditional success.
- Add runtime tests with existing files, no files, API failure, and statuses that cannot yet archive.

## Migration Order

1. Shared foundation: package, provider, query defaults, keys, route boundary, state components, and tests.
2. Current broken flows: result approval, result publication, and student archival dossier.
3. Admin reads and mutations: dashboard, users, periods, councils, and reports.
4. Lecturer reads and mutations: dashboard, topics, supervised students, progress, and grading.
5. Student reads and mutations: dashboard, registration, submissions, grades, and archive.
6. Remove migrated page-level request state and audit remaining `useEffect` fetches.

During migration, old and new mechanisms may exist on different pages, but a single page must not run duplicate effect-based and TanStack Query requests for the same resource.

## Testing and Verification

### Unit and component tests

- Query-client retry classification and default options.
- Query-key factories include all response-changing parameters.
- Loading, success, empty, failure, retry, and background-refresh states.
- Error boundary resets after navigation.
- Mutation invalidation updates only related data.
- Field errors persist and remain accessible after failed mutations.

### Runtime route tests

- Render the approvals and publication deep links, not only source-match them.
- Render the archive tab across eligible and ineligible workflow statuses.
- Fail tests on missing identifiers, bad imports, and response-shape mismatches.

### Browser tests

- Delay lazy chunks and APIs; confirm the sidebar and header stay mounted.
- Count document navigations and confirm ordinary menu clicks do not reload the HTML document.
- Navigate away from a route render error and confirm the next route recovers.
- Revisit a cached route and confirm data is shown during background refresh.
- Simulate `401`, `403`, `404`, `409`, `422`, offline, and `5xx` behavior.
- Verify keyboard navigation, focus placement, accessible error announcements, and retry actions.

### Repository verification

- Run targeted frontend and backend tests after each adoption slice.
- Run the complete frontend and backend test suites.
- Run the frontend production build.
- Verify Ant Design icons, button-label standards, and UTF-8 without BOM.
- Confirm no workflow endpoint leaks student gender or date of birth as a side effect of query migration.

## Success Criteria

- Ordinary navigation never performs a full document reload.
- The application shell remains stable while route code or route data loads.
- Recoverable failures stay within the affected content region and provide a working retry action.
- Empty results are never used to conceal failed requests.
- A render failure cannot remain stuck after navigating to another route.
- Returning to a recently visited page shows cached content immediately and refreshes without blanking it.
- The approvals, publication, and archival dossier routes render successfully with permissions and response contracts aligned end to end.
- Runtime and browser tests cover the failures that previous source-contract tests missed.
