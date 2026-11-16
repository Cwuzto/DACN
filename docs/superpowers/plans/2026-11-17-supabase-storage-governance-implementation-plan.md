# Supabase Storage Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay cơ chế lưu URL công khai rời rạc bằng bốn bucket Supabase được quy hoạch, registry `StoredAsset`, upload tối đa 50 MB có kiểm tra, private signed download và lifecycle/migration có kiểm soát.

**Architecture:** Backend quyết định bucket và object path từ `documentType` cùng resource đã authorize; frontend không gửi folder hoặc URL tùy ý. Mọi object được đăng ký trong `StoredAsset`, tài liệu học vụ/cá nhân ở bucket private và chỉ tải qua signed URL 10 phút; file legacy bị xóa có manifest, chỉ giữ logo/background và external URL hợp lệ.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, Supabase Storage, Multer, Node `crypto`/streams, React 19, Ant Design, TanStack Query 5, Jest/Supertest, Node test runner, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-supabase-storage-governance-design.md`

## Global Constraints

- Bucket names are exactly `cong-khai`, `hoc-vu`, `ca-nhan`, and `tam`; do not prefix them with `dacn`.
- Object path segments use lowercase Vietnamese without diacritics in `kebab-case`; never include names, email, birth dates, tokens, or other PII.
- Keep `TopicRegistration` as the only thesis registration architecture; never restore `group/groupMember`.
- Keep one student/one topic and maximum 10 active students per mentor.
- `cong-khai` is the only public bucket; `hoc-vu`, `ca-nhan`, and `tam` remain private.
- Private download URLs expire after exactly 600 seconds.
- End users never receive a URL for objects in `tam`.
- Uploads up to and including 6 MB use backend multipart; uploads above 6 MB through 50 MB use TUS resumable upload with an exact 6 MB chunk size.
- Backend creates and authorizes every TUS upload session, staging path, and signed upload token; frontend cannot choose bucket or object name.
- Video demo is an HTTPS external URL, never a Storage object.
- Source code is ZIP only, maximum 50 MB; RAR, executables, macro-enabled Office files, and unsafe archives are rejected.
- Academic documents are immutable per version; `upsert` is always false.
- Avatar, logo, and background may be replaced; the previous asset is retained for 7 days.
- Frontend sends file, `documentType`, resource identifiers, and idempotency key only; never accepts bucket/folder/object key from the user.
- Never persist signed URLs or return a fake fallback URL when Storage fails.
- Hash SHA-256 from actual bytes, not from URL/name/time.
- Keep GitHub/YouTube HTTPS links during migration; delete/null other legacy file objects and URL fields except logo/background.
- All changed text/code files must be UTF-8 without BOM.
- Ant Design buttons use `@ant-design/icons` via `icon`; no raw symbol or emoji in labels.
- Each task follows TDD and ends in an independent commit.

## Review Focus

- Filename supplied as NFD Vietnamese, path traversal, reserved Windows name, or 300-character segment: normalize to one safe deterministic slug and never escape the server-chosen prefix; Task 3 pins this.
- A valid ZIP MIME containing an executable, macro-enabled Office content, zip bomb, or wrong document container: reject before promotion and retain only the rejected staging object for the configured TTL; Task 4 pins this.
- A TUS upload is paused, token/session expires, two clients resume the same upload, or finalize is called twice: resume only the authorized session, return stable conflict/expiry errors, and create at most one active asset; Task 5 pins this.
- Storage upload/move succeeds but Prisma transaction or audit fails: do not return success, leave a resumable cleanup job, and never bind an active asset to the workflow; Tasks 4 and 5 pin this.
- Legacy cleanup sees an unknown URL, missing branding object, duplicate checksum, or is interrupted halfway: dry-run/apply must be resumable, fail closed on unresolved rows, and never delete outside the manifest; Task 10 pins this.

---

### Task 1: Storage Configuration, Secret Preflight, and Bucket Provisioning

**Files:**
- Create: `backend/src/config/storageConfig.js`
- Create: `backend/src/services/storageProvisioningService.js`
- Create: `backend/scripts/storage/provisionBuckets.js`
- Modify: `backend/.env.example`
- Modify: `backend/src/config/supabase.js`
- Create: `backend/tests/unit/storageConfig.test.js`
- Create: `backend/tests/services/storageProvisioningService.test.js`
- Create: `docs/operations/supabase-storage-rollout.md`

**Interfaces:**
- Produces: `STORAGE_BUCKETS = { PUBLIC:'cong-khai', ACADEMIC:'hoc-vu', PERSONAL:'ca-nhan', TEMP:'tam' }`.
- Produces: `SIGNED_URL_TTL_SECONDS = 600`, `MAX_UPLOAD_BYTES = 52_428_800`, `TUS_THRESHOLD_BYTES = 6_291_456`, `TUS_CHUNK_BYTES = 6_291_456`.
- Produces: direct Storage TUS endpoint derived from the configured Supabase project host, never from request input.
- Produces: `assertStorageEnvironment(env): void` and `provisionStorageBuckets({ storage, dryRun }): Promise<ProvisionReport>`.
- Preserves: lazy Supabase client creation; never exposes service-role credentials to frontend.

- [ ] **Step 1: Write failing config and provisioning tests**

  Assert exact bucket names/privacy, 600-second TTL, 6 MB threshold/chunk, 50 MB ceiling, direct Storage TUS endpoint, no fallback bucket name, idempotent provisioning, and rejection when the service-role key or project URL is missing. Assert provisioning reports privacy drift but does not silently change it in `dryRun`.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/unit/storageConfig.test.js tests/services/storageProvisioningService.test.js
  ```

  Expected: FAIL because central storage config/provisioning does not exist and current upload helper forces one bucket public.

- [ ] **Step 3: Implement config, provisioning, and operations checklist**

  `provisionBuckets.js` defaults to `--dry-run`; `--apply` creates missing buckets and corrects only the four expected bucket configurations. Document manual rotation of Supabase service-role/database credentials as a required rollout prerequisite without printing or committing secret values.

- [ ] **Step 4: Run focused tests and dry-run CLI**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/unit/storageConfig.test.js tests/services/storageProvisioningService.test.js
  node backend/scripts/storage/provisionBuckets.js --dry-run
  ```

  Expected: tests PASS; CLI prints a redacted plan and performs no write.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/src/config/storageConfig.js backend/src/services/storageProvisioningService.js backend/scripts/storage/provisionBuckets.js backend/.env.example backend/src/config/supabase.js backend/tests/unit/storageConfig.test.js backend/tests/services/storageProvisioningService.test.js
  git add -f docs/operations/supabase-storage-rollout.md
  git commit -m "feat(storage): define governed bucket configuration"
  ```

### Task 2: StoredAsset Schema and Lifecycle Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261117090000_add_stored_asset_registry/migration.sql`
- Create: `backend/tests/integration/storedAssetSchema.test.js`

**Interfaces:**
- Produces Prisma enums: `StorageBucket`, `AssetVisibility`, `AssetScanStatus`, `AssetStatus`, `StoredDocumentType`, `AssetUploadTransport`, `AssetUploadSessionStatus`.
- Produces models: `StoredAsset`, `StoredAssetUploadSession`, `StoredAssetCleanupJob`.
- Produces unique constraints on `(bucket, objectKey)` and `uploadSessionId`; indexes on owner, registration, document type/status, retention, and checksum.
- Preserves legacy URL columns as nullable compatibility fields until Task 10.

- [ ] **Step 1: Write failing schema contract tests**

  Assert required metadata fields, exact enum values, 64-character checksum contract, immutable version fields, self-relation `replacedById`, owner/uploader/registration/semester/catalog relations, cleanup-job retry fields, upload-session transport/state/expiry/resource-context/finalized-asset fields, and deletion behavior that never cascades from a user/registration into physical object deletion.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend exec prisma validate
  npm --prefix backend test -- --runTestsByPath tests/integration/storedAssetSchema.test.js
  ```

  Expected: test FAIL because registry models do not exist.

- [ ] **Step 3: Add Prisma models and SQL migration**

  Use `BigInt` for `sizeBytes`; use JSON only for scanner/provider diagnostics, not core metadata. Migration creates empty registry tables and does not backfill/delete legacy data.

- [ ] **Step 4: Validate schema and migration contract**

  Run:

  ```powershell
  npm --prefix backend exec prisma generate
  npm --prefix backend exec prisma validate
  npm --prefix backend test -- --runTestsByPath tests/integration/storedAssetSchema.test.js
  ```

  Expected: Prisma validates and test PASS.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/prisma/schema.prisma backend/prisma/migrations/20261117090000_add_stored_asset_registry/migration.sql backend/tests/integration/storedAssetSchema.test.js
  git commit -m "feat(storage): add canonical asset registry"
  ```

### Task 3: Vietnamese Naming, Object Paths, and Document Policy Catalog

**Files:**
- Create: `backend/src/storage/vietnameseSlug.js`
- Create: `backend/src/storage/objectPathBuilder.js`
- Create: `backend/src/storage/assetPolicyCatalog.js`
- Create: `backend/tests/unit/vietnameseSlug.test.js`
- Create: `backend/tests/unit/objectPathBuilder.test.js`
- Create: `backend/tests/unit/assetPolicyCatalog.test.js`

**Interfaces:**
- Produces: `toVietnameseSlug(input, { maxLength=80 }): string`.
- Produces: `buildObjectPath({ documentType, uuid, extension, context }): { bucket, objectKey }`.
- Produces: `getAssetPolicy(documentType): { bucket, maxBytes, extensions, mimeTypes, visibility, retentionDays?, requireArchiveInspection }`.
- Consumes: exact buckets/limits from Task 1 and `StoredDocumentType` semantics from Task 2.

- [ ] **Step 1: Write failing slug/path/policy tests**

  Include NFC/NFD forms of `Đồ án tốt nghiệp`, repeated separators, `../`, slashes, control characters, empty names, reserved names, very long input, mixed case and duplicate descriptions. Assert exact path examples from the spec for BM01, BM05, archive source, public template, avatar and temp staging. Assert every `StoredDocumentType` has exactly one policy and no policy exceeds 50 MB.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/unit/vietnameseSlug.test.js tests/unit/objectPathBuilder.test.js tests/unit/assetPolicyCatalog.test.js
  ```

  Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement pure naming/path/policy modules**

  Use `crypto.randomUUID()` supplied by the caller/test; do not use timestamp or `Math.random()` for identity. Path builder accepts only typed server-loaded context and never concatenates raw request folder/name.

- [ ] **Step 4: Run unit tests**

  Run the command from Step 2.

  Expected: PASS with deterministic paths for fixed UUID/context.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/src/storage/vietnameseSlug.js backend/src/storage/objectPathBuilder.js backend/src/storage/assetPolicyCatalog.js backend/tests/unit/vietnameseSlug.test.js backend/tests/unit/objectPathBuilder.test.js backend/tests/unit/assetPolicyCatalog.test.js
  git commit -m "feat(storage): add Vietnamese paths and asset policies"
  ```

### Task 4: File Inspection and Private Storage Adapter

**Files:**
- Create: `backend/src/storage/fileInspector.js`
- Create: `backend/src/storage/supabaseStorageAdapter.js`
- Create: `backend/src/storage/tempFileManager.js`
- Modify: `backend/src/middlewares/upload.js`
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Create: `backend/tests/unit/fileInspector.test.js`
- Create: `backend/tests/services/supabaseStorageAdapter.test.js`
- Modify: `backend/tests/integration/uploadSecurity.test.js`

**Interfaces:**
- Produces: `inspectFile({ path, originalName, declaredMime, policy }): Promise<InspectedFile>` with detected MIME, extension, size and SHA-256.
- Produces: `StorageAdapter` methods `upload`, `move`, `copy`, `remove`, `exists`, `createSignedUrl`, `createSignedUploadUrl`, `download`, `stat` using explicit bucket/object key.
- Produces: disk-backed Multer temp files capped at 50 MB and guaranteed request-finally cleanup.
- Consumes: policies/path config from Tasks 1 and 3.

- [ ] **Step 1: Write failing inspection and adapter tests**

  Test valid PDF/JPG/PNG/WEBP/DOC/DOCX/XLS/XLSX/PPTX/ZIP fixtures; declared MIME mismatch; disguised executable; macro-enabled Office; ZIP traversal; excessive entry count/uncompressed ratio; empty/truncated file; 50 MB boundary. Assert adapter never calls bucket creation/privacy update, always uses `upsert:false`, binds signed upload URLs to an explicit bucket/path, and can stat the staged TUS object before finalize.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/unit/fileInspector.test.js tests/services/supabaseStorageAdapter.test.js tests/integration/uploadSecurity.test.js
  ```

  Expected: FAIL because inspection/storage abstractions do not exist and current upload uses memory/public URL.

- [ ] **Step 3: Implement disk-backed parsing, inspection, and adapter**

  Add only the ZIP-container inspection dependency required by tests; use Node `crypto` stream hashing. `tempFileManager` creates files inside a dedicated application temp directory with randomized names and rejects paths outside it.

- [ ] **Step 4: Run security tests**

  Run the command from Step 2.

  Expected: PASS; rejected files never reach a final bucket and request temp files are removed.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/src/storage/fileInspector.js backend/src/storage/supabaseStorageAdapter.js backend/src/storage/tempFileManager.js backend/src/middlewares/upload.js backend/package.json backend/package-lock.json backend/tests/unit/fileInspector.test.js backend/tests/services/supabaseStorageAdapter.test.js backend/tests/integration/uploadSecurity.test.js
  git commit -m "feat(storage): inspect files and isolate storage access"
  ```

### Task 5: Asset Ingestion, TUS Sessions, Lifecycle, and Private Download API

**Files:**
- Create: `backend/src/services/storedAssetService.js`
- Create: `backend/src/controllers/storedAssetController.js`
- Create: `backend/src/routes/storedAssetRoutes.js`
- Modify: `backend/src/routes/index.js`
- Modify: `backend/src/services/auditLogService.js`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/services/resumableUploadService.js`
- Create: `frontend/src/queries/assetQueries.js`
- Create: `backend/tests/services/storedAssetService.test.js`
- Create: `backend/tests/integration/storedAsset.routes.test.js`
- Create: `frontend/runtime-tests/assetUploadTransport.spec.jsx`

**Interfaces:**
- Produces: `ingestAsset({ tempFile, documentType, resourceContext, actor, uploadSessionId }): Promise<StoredAssetDTO>`.
- Produces: `createUploadSession({ documentType, resourceContext, actor, originalName, declaredMime, sizeBytes, idempotencyKey }): Promise<TusUploadSessionDTO>`.
- Produces: `finalizeUploadSession({ sessionId, actor }): Promise<StoredAssetDTO>` and `abortUploadSession({ sessionId, actor }): Promise<void>`.
- Produces: `createStoredAssetFromBuffer({ buffer, originalName, documentType, resourceContext, actor }): Promise<StoredAssetDTO>` for system-generated PDFs capped by policy.
- Produces: `getAssetDownload({ assetId, actor }): Promise<{ url, expiresAt, fileName }>` with 600-second signed URL.
- Produces: `replaceAsset`, `softDeleteAsset`, `enqueueCleanup`, and stable asset error codes from the spec.
- Produces frontend `selectAssetUploadTransport(sizeBytes): 'multipart' | 'tus'`, `uploadAssetResumable({ file, session, onProgress, signal })`, `useAssetUpload()`, and `useAssetDownload()`.

- [ ] **Step 1: Write failing lifecycle and route tests**

  Cover exact 6 MB multipart boundary, 6 MB + 1 byte TUS selection, 50 MB maximum, signed token bound to the server-generated `tam` path, 6 MB TUS chunk, pause/resume, expired/aborted/incomplete session, concurrent/double finalize, idempotent duplicate session, wrong owner/resource, successful temp→final promotion, upload succeeds/DB fails, DB succeeds/move fails, audit failure, signed download valid/forbidden/deleted/replaced, public asset response, 600-second expiry, no end-user URL for `tam`, and no fake fallback URL.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/services/storedAssetService.test.js tests/integration/storedAsset.routes.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/assetUploadTransport.spec.jsx
  ```

  Expected: FAIL because service/routes/TUS transport do not exist.

- [ ] **Step 3: Implement asset state machine and APIs**

  Route contract:

  - `POST /api/assets` multipart for files up to and including 6 MB; larger content returns `422 ASSET_TUS_REQUIRED`.
  - `POST /api/assets/upload-sessions`: authorize metadata/resource, allocate exact `tam` path and return signed TUS configuration without persisting the token.
  - `POST /api/assets/upload-sessions/:id/finalize`: verify staged object and session, inspect/hash/promote once.
  - `DELETE /api/assets/upload-sessions/:id`: abort owned session and enqueue staging cleanup.
  - `GET /api/assets/:id/download`: authorize and return public URL metadata or a private signed URL.
  - No generic delete endpoint for end users; domain services call lifecycle methods.

  Install `tus-js-client`; configure `uploadDataDuringCreation`, `removeFingerprintOnSuccess`, retry delays, exact 6 MB chunk size and backend-provided signed token/path. Persist cleanup jobs for cross-system partial failures and record audit after each successful state transition.

- [ ] **Step 4: Run lifecycle tests**

  Run the command from Step 2.

  Expected: PASS; partial failures are recoverable and no inactive asset is downloadable.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/src/services/storedAssetService.js backend/src/controllers/storedAssetController.js backend/src/routes/storedAssetRoutes.js backend/src/routes/index.js backend/src/services/auditLogService.js backend/tests/services/storedAssetService.test.js backend/tests/integration/storedAsset.routes.test.js frontend/package.json frontend/package-lock.json frontend/src/services/resumableUploadService.js frontend/src/queries/assetQueries.js frontend/runtime-tests/assetUploadTransport.spec.jsx
  git commit -m "feat(storage): add governed multipart and TUS uploads"
  ```

### Task 6: Migrate BM01, BM02, Task, and Checkpoint Attachments

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261117100000_link_submission_assets/migration.sql`
- Modify: `backend/src/routes/outlineRoutes.js`
- Modify: `backend/src/controllers/outlineController.js`
- Modify: `backend/src/controllers/registrationController.js`
- Modify: `backend/src/controllers/taskController.js`
- Modify: `backend/src/controllers/checkpointController.js`
- Modify: `frontend/src/components/forms/HybridBMFormModal.jsx`
- Modify: `frontend/src/components/student/CheckpointSignModal.jsx`
- Modify: `frontend/src/services/uploadService.js`
- Modify: `frontend/src/queries/assetQueries.js`
- Create: `backend/tests/integration/submissionAssetBinding.test.js`
- Create: `frontend/runtime-tests/submissionAssets.spec.jsx`

**Interfaces:**
- Consumes: asset API/DTO from Task 5.
- Produces: nullable `assetId` relations for `Submission`, `BM02Submission`, task submissions and checkpoint evidence while legacy URL columns remain read-only fallback.
- Reuses: `useAssetUpload()` and `useAssetDownload()` from Task 5 in academic submission UI.

- [ ] **Step 1: Write failing binding and UI tests**

  Assert asset must match actor, registration/task/checkpoint, document type and active status; another student's asset ID is rejected; legacy external URL cannot be submitted as an academic attachment. Runtime tests assert actual accept/size policy, multipart/TUS selection around 6 MB, resumable progress/error preservation, and download via asset endpoint rather than direct `href` URL.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/submissionAssetBinding.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/submissionAssets.spec.jsx
  ```

  Expected: FAIL because workflows still accept/store arbitrary `fileUrl`.

- [ ] **Step 3: Add relations and migrate workflows end-to-end**

  New writes require `assetId`; reads prefer asset DTO and use legacy URL only during compatibility. Remove client `folder:'submissions'` and any direct bucket/path knowledge.

- [ ] **Step 4: Run workflow regressions**

  Run:

  ```powershell
  npm --prefix backend exec prisma validate
  npm --prefix backend test -- --runTestsByPath tests/integration/submissionAssetBinding.test.js tests/integration/studentDefenseResultPrivacy.test.js tests/integration/mentorOwnershipAndGradingScope.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/submissionAssets.spec.jsx
  ```

  Expected: PASS; TopicRegistration ownership remains enforced.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/prisma/schema.prisma backend/prisma/migrations/20261117100000_link_submission_assets backend/src/routes/outlineRoutes.js backend/src/controllers/outlineController.js backend/src/controllers/registrationController.js backend/src/controllers/taskController.js backend/src/controllers/checkpointController.js backend/tests/integration/submissionAssetBinding.test.js frontend/src/components/forms/HybridBMFormModal.jsx frontend/src/components/student/CheckpointSignModal.jsx frontend/src/services/uploadService.js frontend/src/queries/assetQueries.js frontend/runtime-tests/submissionAssets.spec.jsx
  git commit -m "refactor(storage): bind submission files to governed assets"
  ```

### Task 7: Migrate Generated Academic PDFs and Council Documents

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261117110000_link_generated_academic_assets/migration.sql`
- Modify: `backend/src/services/academicPdfService.js`
- Modify: `backend/src/controllers/bm03Controller.js`
- Modify: `backend/src/controllers/bm04Controller.js`
- Modify: `backend/src/controllers/evaluationController.js`
- Modify: `backend/src/services/defenseScoringService.js`
- Modify: `backend/src/controllers/semesterController.js`
- Modify: `backend/src/services/archivalWorkflowService.js`
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
- Modify: `frontend/src/pages/lecturer/GradingPage.jsx`
- Create: `backend/tests/integration/generatedAcademicAssets.test.js`
- Create: `frontend/runtime-tests/generatedAcademicDownloads.spec.jsx`

**Interfaces:**
- Consumes: `createStoredAssetFromBuffer` and private download from Task 5.
- Produces asset relations for BM02-A/BM03/BM04/BM05 score sheets, assignment decisions, appendices and completion certificates.
- Removes: `https://storage.local/...` success fallback.

- [ ] **Step 1: Write failing generated-document tests**

  Assert each generated document creates the correct path/version/checksum and remains private; upload failure leaves workflow unsigned/unlocked; BM05 member assets are scoped independently; another council member cannot download an unassigned score sheet.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/generatedAcademicAssets.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/generatedAcademicDownloads.spec.jsx
  ```

  Expected: FAIL because generated services return URL strings and may swallow upload failure.

- [ ] **Step 3: Bind generated documents to StoredAsset**

  Workflow state transition and asset creation must fail together from the caller's perspective; use cleanup jobs for Storage/DB partial failure. Frontend requests downloads by asset ID.

- [ ] **Step 4: Run grading/document regressions**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/generatedAcademicAssets.test.js tests/integration/defensePublicationImmutability.test.js tests/integration/defenseDossierAndSnapshots.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/generatedAcademicDownloads.spec.jsx
  ```

  Expected: PASS; score privacy/publication rules remain intact.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/prisma/schema.prisma backend/prisma/migrations/20261117110000_link_generated_academic_assets backend/src/services/academicPdfService.js backend/src/controllers/bm03Controller.js backend/src/controllers/bm04Controller.js backend/src/controllers/evaluationController.js backend/src/services/defenseScoringService.js backend/src/controllers/semesterController.js backend/src/services/archivalWorkflowService.js backend/tests/integration/generatedAcademicAssets.test.js frontend/src/pages/lecturer/ProgressTrackingPage.jsx frontend/src/pages/lecturer/GradingPage.jsx frontend/runtime-tests/generatedAcademicDownloads.spec.jsx
  git commit -m "refactor(storage): govern generated academic documents"
  ```

### Task 8: Migrate the Archival Dossier

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261117120000_link_archive_assets/migration.sql`
- Modify: `backend/src/routes/archiveRoutes.js`
- Modify: `backend/src/controllers/archiveController.js`
- Modify: `backend/src/services/defenseDossierService.js`
- Modify: `backend/src/services/archivalWorkflowService.js`
- Modify: `frontend/src/components/forms/ArchiveSubmissionModal.jsx`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/queries/archiveQueries.js`
- Create: `backend/tests/integration/archiveAssetBinding.test.js`
- Modify: `frontend/runtime-tests/archiveDossier.spec.jsx`

**Interfaces:**
- Consumes: governed asset upload/download.
- Produces `assetId` on `DefenseDocumentVersion` and typed slots `REPORT_WORD`, `REPORT_PDF`, `SLIDE_PPTX`, `SOURCE_ZIP`.
- Produces validated `demoVideoExternalUrl` HTTPS field; no video asset.

- [ ] **Step 1: Write failing archive ownership/policy tests**

  Cover the existing dossier IDOR: student A cannot bind an asset to student B registration. Assert Word/PDF max 50 MB, slide max 50 MB, source ZIP max 50 MB, RAR/video rejected, external video only HTTPS, SHA-256 from bytes, and version rows immutable.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/archiveAssetBinding.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/archiveDossier.spec.jsx
  ```

  Expected: FAIL because route accepts arbitrary URL/string and generic upload lacks archive policy.

- [ ] **Step 3: Migrate archive API and UI**

  The archive command accepts asset IDs only for stored documents and validates binding scope before version creation. Keep GitHub/video external URLs in separate validated fields.

- [ ] **Step 4: Run archive regressions**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/archiveAssetBinding.test.js tests/integration/archivalTwoStageAndDirectorSignature.test.js tests/integration/decisionIssuanceAndArchiveIntegrity.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/archiveDossier.spec.jsx
  ```

  Expected: PASS; archive ownership and two-stage approval remain correct.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/prisma/schema.prisma backend/prisma/migrations/20261117120000_link_archive_assets backend/src/routes/archiveRoutes.js backend/src/controllers/archiveController.js backend/src/services/defenseDossierService.js backend/src/services/archivalWorkflowService.js backend/tests/integration/archiveAssetBinding.test.js frontend/src/components/forms/ArchiveSubmissionModal.jsx frontend/src/pages/student/SubmissionPage.jsx frontend/src/queries/archiveQueries.js frontend/runtime-tests/archiveDossier.spec.jsx
  git commit -m "refactor(storage): govern archival dossier assets"
  ```

### Task 9: Migrate Portal, Announcements, Branding, and Avatars

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261117130000_link_public_and_personal_assets/migration.sql`
- Modify: `backend/src/routes/portalUploadRoutes.js`
- Modify: `backend/src/controllers/portalUploadController.js`
- Modify: `backend/src/services/portalContentService.js`
- Modify: `backend/src/controllers/announcementController.js`
- Modify: `backend/src/controllers/authController.js`
- Modify: `frontend/src/pages/admin/portal/TemplateManager.jsx`
- Modify: `frontend/src/pages/admin/AnnouncementManagementPage.jsx`
- Modify: `frontend/src/pages/common/ProfilePage.jsx`
- Modify: `frontend/src/components/profile/ProfileIdentityCard.jsx`
- Modify: `frontend/src/pages/common/HomePage.jsx`
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Modify: `frontend/src/index.css`
- Create: `backend/tests/integration/publicAndPersonalAssets.test.js`
- Create: `frontend/runtime-tests/publicAndPersonalAssets.spec.jsx`

**Interfaces:**
- Consumes: asset lifecycle APIs.
- Produces draft→publish promotion for announcements/templates/branding.
- Produces avatar replacement with 7-day retention.
- Produces `fileAssetId` relations for `PublicAnnouncement`, `User.avatarAssetId`, `Semester.outlineTemplateAssetId`, and a typed `PortalContentRevisionAsset` join model for revision slots.
- Removes hard-coded Supabase project/bucket logo/background URLs.

- [ ] **Step 1: Write failing public/private transition tests**

  Assert Portal draft is not publicly readable; publish copies/promotes to `cong-khai`; unpublish/replace maintains audit; only verified PDF is previewed; avatar stays private and old avatar is retained 7 days; no hard-coded project URL remains in frontend source.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/publicAndPersonalAssets.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/publicAndPersonalAssets.spec.jsx
  ```

  Expected: FAIL with direct public upload/hard-coded URLs/current avatar upload.

- [ ] **Step 3: Migrate public/personal workflows**

  Portal content stores asset IDs in typed relations or validated revision references, never arbitrary public URLs. Public visitor responses expose only active published public asset URLs; authenticated avatar responses use the governed download contract.

- [ ] **Step 4: Run portal/profile regressions**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/publicAndPersonalAssets.test.js
  npm --prefix frontend run test:runtime -- runtime-tests/publicAndPersonalAssets.spec.jsx
  node --test frontend/src/pages/__tests__/topicCloningAndPortalTemplates.test.js frontend/src/pages/__tests__/notificationBadgeAndPostDefenseCountdown.test.js
  ```

  Expected: PASS; homepage public content still renders without authentication.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/prisma/schema.prisma backend/prisma/migrations/20261117130000_link_public_and_personal_assets backend/src/routes/portalUploadRoutes.js backend/src/controllers/portalUploadController.js backend/src/services/portalContentService.js backend/src/controllers/announcementController.js backend/src/controllers/authController.js backend/tests/integration/publicAndPersonalAssets.test.js frontend/src/pages/admin/portal/TemplateManager.jsx frontend/src/pages/admin/AnnouncementManagementPage.jsx frontend/src/pages/common/ProfilePage.jsx frontend/src/components/profile/ProfileIdentityCard.jsx frontend/src/pages/common/HomePage.jsx frontend/src/components/layout/AppLayout.jsx frontend/src/index.css frontend/runtime-tests/publicAndPersonalAssets.spec.jsx
  git commit -m "refactor(storage): govern public branding and personal assets"
  ```

### Task 10: Legacy Storage Cleanup and Branding Preservation

**Files:**
- Create: `backend/scripts/storage/inventoryLegacyAssets.js`
- Create: `backend/scripts/storage/cleanupLegacyAssets.js`
- Create: `backend/src/services/legacyStorageMigrationService.js`
- Create: `backend/tests/services/legacyStorageMigrationService.test.js`
- Create: `backend/tests/integration/legacyStorageCleanup.test.js`
- Modify: `docs/operations/supabase-storage-rollout.md`

**Interfaces:**
- Produces: `buildLegacyManifest({ db, storage }): Promise<LegacyManifest>`.
- Produces: `applyLegacyManifest({ manifestPath, resumeFrom?, actor }): Promise<ApplyReport>`.
- Manifest classes: `KEEP_BRANDING`, `KEEP_EXTERNAL`, `NULL_AND_DELETE`, `UNRESOLVED`.
- Defaults: inventory and cleanup scripts are dry-run; apply requires explicit `--apply` plus a manifest file argument.

- [ ] **Step 1: Write failing migration safety tests**

  Assert dry-run performs zero writes; logo/background are copied, hashed and verified before old deletion; GitHub/YouTube HTTPS remain; Supabase and `/uploads/` legacy fields are nulled/deleted; unknown URL blocks apply; duplicate checksum does not delete the kept object; interrupted apply resumes idempotently; no object outside manifest is removed.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/services/legacyStorageMigrationService.test.js tests/integration/legacyStorageCleanup.test.js
  ```

  Expected: FAIL because migration service/scripts do not exist.

- [ ] **Step 3: Implement inventory, manifest, and resumable apply**

  Write manifests outside Git-tracked directories by default and redact secrets/signed query strings. Apply requires database snapshot confirmation recorded in the report; unresolved rows abort before deletion begins.

- [ ] **Step 4: Run tests and real-environment dry-run only**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/services/legacyStorageMigrationService.test.js tests/integration/legacyStorageCleanup.test.js
  node backend/scripts/storage/inventoryLegacyAssets.js --dry-run --output "$env:TEMP\legacy-storage-manifest.json"
  node backend/scripts/storage/cleanupLegacyAssets.js --dry-run --manifest "$env:TEMP\legacy-storage-manifest.json"
  ```

  Expected: tests PASS; dry-run reports keep/delete/null/unresolved counts and makes no changes. Do not run `--apply` without the operator's deployment-window confirmation.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/scripts/storage/inventoryLegacyAssets.js backend/scripts/storage/cleanupLegacyAssets.js backend/src/services/legacyStorageMigrationService.js backend/tests/services/legacyStorageMigrationService.test.js backend/tests/integration/legacyStorageCleanup.test.js
  git add -f docs/operations/supabase-storage-rollout.md
  git commit -m "feat(storage): add safe legacy cleanup migration"
  ```

### Task 11: Retention, Cleanup, and Reconciliation Workers

**Files:**
- Create: `backend/src/services/storedAssetCleanupService.js`
- Create: `backend/src/services/storageReconciliationService.js`
- Create: `backend/scripts/storage/runAssetCleanup.js`
- Create: `backend/scripts/storage/reconcileAssets.js`
- Modify: `backend/package.json`
- Create: `backend/tests/services/storedAssetCleanupService.test.js`
- Create: `backend/tests/services/storageReconciliationService.test.js`

**Interfaces:**
- Produces: `processCleanupBatch({ limit, now, workerId }): Promise<CleanupReport>`.
- Produces: `reconcileStoredAssets({ cursor?, limit, dryRun }): Promise<ReconciliationReport>`.
- Enforces TTL: pending/checking 24h, rejected 7d, unbound 24h, orphaned 30d, replaced avatar/branding 7d.

- [ ] **Step 1: Write failing retention/reconciliation tests**

  Assert active/reference assets are never deleted; expired soft-deleted/replaced assets are removed once; expired/incomplete TUS sessions enqueue staging cleanup; locked jobs are not double-processed; transient Storage errors retry with bounded backoff; DB row/object missing cases are reported; unknown Storage object becomes ORPHANED before 30-day purge.

- [ ] **Step 2: Run tests and confirm failure**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/services/storedAssetCleanupService.test.js tests/services/storageReconciliationService.test.js
  ```

  Expected: FAIL because workers do not exist.

- [ ] **Step 3: Implement idempotent workers and CLI wrappers**

  Use database locking/claim fields on cleanup jobs; scripts default to bounded batches and reconciliation `--dry-run`. Emit structured metrics/logs without object signed URLs or secrets.

- [ ] **Step 4: Run worker tests and dry-run commands**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/services/storedAssetCleanupService.test.js tests/services/storageReconciliationService.test.js
  npm --prefix backend run storage:cleanup -- --dry-run
  npm --prefix backend run storage:reconcile -- --dry-run
  ```

  Expected: PASS; CLI reports no writes in dry-run.

- [ ] **Step 5: Commit**

  ```powershell
  git add backend/src/services/storedAssetCleanupService.js backend/src/services/storageReconciliationService.js backend/scripts/storage/runAssetCleanup.js backend/scripts/storage/reconcileAssets.js backend/package.json backend/tests/services/storedAssetCleanupService.test.js backend/tests/services/storageReconciliationService.test.js
  git commit -m "feat(storage): add retention and reconciliation workers"
  ```

### Task 12: End-to-End Verification and Rollout Handoff

**Files:**
- Create: `frontend/e2e/governed-storage.spec.js`
- Create: `backend/tests/integration/storageActorMatrix.test.js`
- Modify: `docs/operations/supabase-storage-rollout.md`
- Modify: `docs/superpowers/plans/2026-11-17-supabase-storage-governance-implementation-plan.md` to check completed tasks
- Modify: `CLAUDE.md` only when the user explicitly says `end phiên`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified four-bucket rollout with no required work remaining for this plan.

- [ ] **Step 1: Write actor-matrix and browser E2E tests**

  Cover student own/other registration, assigned/unassigned GVHD, assigned/unassigned council member, Giáo vụ, Viện trưởng, public visitor, draft/published Portal asset, avatar replacement, multipart at exactly 6 MB, TUS at 6 MB + 1 byte, pause/resume and finalize, source ZIP 50 MB boundary, upload validation, signed download, video external URL and stale/deleted asset.

- [ ] **Step 2: Run focused E2E and matrix tests**

  Run:

  ```powershell
  npm --prefix backend test -- --runTestsByPath tests/integration/storageActorMatrix.test.js
  npm --prefix frontend run test:e2e -- e2e/governed-storage.spec.js
  ```

  Expected: PASS; private objects are never fetched anonymously and public published objects remain reachable.

- [ ] **Step 3: Run complete backend verification**

  Run:

  ```powershell
  npm --prefix backend exec prisma validate
  npm --prefix backend test
  ```

  Expected: all suites PASS.

- [ ] **Step 4: Run complete frontend verification**

  Run:

  ```powershell
  npm --prefix frontend test
  npm --prefix frontend run test:runtime
  npm --prefix frontend run test:e2e
  npm --prefix frontend run lint
  npm --prefix frontend run build
  ```

  Expected: all tests/lint PASS and production build succeeds.

- [ ] **Step 5: Run repository and live-policy checks**

  Verify no runtime bucket creation/privacy mutation, generic client folder, new academic `fileUrl` writes, fake Storage URL, hard-coded Supabase project URL, public academic bucket, raw icon labels, UTF-8 BOM, legacy `group/groupMember`, or unapproved mock workflow data remains in changed scope. Run bucket provisioning and reconciliation in dry-run; confirm live privacy matches the four-bucket contract.

- [ ] **Step 6: Execute controlled rollout checklist**

  In a deployment window: confirm secret rotation, DB snapshot and Storage manifest; run Prisma migration; provision buckets; deploy backend/frontend; smoke-test upload/download; run legacy cleanup `--apply` only after dry-run review; enable scheduled cleanup/reconciliation. Record commit, operator, timestamp and redacted reports.

- [ ] **Step 7: Commit final tests and completion markers**

  ```powershell
  git add backend/tests/integration/storageActorMatrix.test.js frontend/e2e/governed-storage.spec.js
  git add -f docs/operations/supabase-storage-rollout.md docs/superpowers/plans/2026-11-17-supabase-storage-governance-implementation-plan.md
  git commit -m "test(storage): verify governed storage rollout"
  ```

  Do not update `CLAUDE.md` unless the user says `end phiên`.
