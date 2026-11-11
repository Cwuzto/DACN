# BM02 to BM04 Thesis Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end thesis academic workflow from after `BM01_PASSED` through `BM02` (formal application), `TopicAssignmentDecision` (published assignment decision), `BM02-A` (3-signature 7-day title adjustment), `TitleAdjustmentAppendix` (batch appendices), `BM03` (advisor-signed meeting entries, midterm/final stage evaluations, Institute 7+3d stop review, 48h student acknowledgement), and `BM04` (4 criteria + 2 conclusions, immediate `DEFENSE_ELIGIBLE`/`DEFENSE_READY` or Institute 7+3d defense rejection review), plus 5 idempotent scheduled sweep jobs.

**Architecture:** Additive Prisma schema evolution extending existing models (`BM02Submission`, `BM04Evaluation`, `Semester`, `TopicRegistration`) while adding dedicated tables for multi-version 3-party signatures (`ElectronicSignatureEvent`, `BM02AAdjustmentRequest`, `BM02AFormVersion`), batch appendices (`TitleAdjustmentAppendix`, `TitleAdjustmentAppendixItem`), and structured progress/review records (`BM03ProgressRecord`, `BM03MeetingEntry`, `BM03StageEvaluation`, `InstituteStopReview`, `InstituteDefenseReview`). Implemented in 4 phased vertical slices with atomic transactions, optimistic locking, idempotency receipts, and zero side-effects on `GET` endpoints.

**Tech Stack:** Node.js, Express 5, Prisma 7 (`@prisma/adapter-pg`, PostgreSQL), `crypto` (SHA-256 `payloadHash`), `pdfkit` (immutable PDF generation), React 19, Vite, Ant Design, Zustand, Jest / Supertest, Vitest.

**Spec:** `d:\DACN\docs\superpowers\specs\2026-11-11-bm02-to-bm04-workflow-design.md` (and source business specification `d:\DACN\dac-ta-thiet-ke-bm02-den-bm04.md`)

## Global Constraints

- **TopicRegistration Model (`1 SV / 1 Đề tài`):** Every workflow entity anchors to `TopicRegistration.id` (`maxStudents = 1`, max 10 students/mentor); never use legacy `group`/`groupMember`.
- **Immutability & Append-Only History:** Signed records, issued decisions/appendices, and generated PDFs are immutable (`onDelete: Restrict`); modifications create a new version or amendment record.
- **No Forged Signatures on Timeouts:** System deadline sweeps (`SYSTEM_TIMEOUT`, `ACKNOWLEDGEMENT_TIMEOUT`, `AUTO_TERMINATED`, `AUTO_NOT_ELIGIBLE`) must never insert fake `ElectronicSignatureEvent` records for students or admins.
- **No Lazy Side-Effects on `GET`:** Read endpoints must never mutate database state; overdue state transitions happen strictly via scheduled sweep jobs or explicit POST commands.
- **Timezone & Exact Windows:** All deadlines use `Asia/Ho_Chi_Minh` calendar hours: BM02-A window = `decisionPublishedAt + 168h` (7 days); Institute Stop/Defense Review = `submittedAt + 168h` (7 days) + at most 1 extension of `+ 72h` (`currentDeadline + 72h`, max 240h = 10 days); Student BM03 acknowledgement = `advisorSignedAt + 48h` (2 days).
- **UI & Encoding Standards:** All files saved in **UTF-8 (no BOM)**; all Frontend `<Button>` components must use `@ant-design/icons` via `icon={<Icon />}` with zero raw emojis/symbols in button text labels (Rule 2.6 in `AGENTS.md`).

## Review Focus

1. **Concurrent BM02-A v2 revision race condition:** Two simultaneous `POST /api/bm02a/requests/:id/revise` requests on a returned v1 form must result in exactly one `versionNumber = 2` (`revisionCount: 0 -> 1` via conditional `updateMany` inside transaction) and `409 REVISION_LIMIT_EXCEEDED` for the second request (tested in Task 3).
2. **Stale `payloadHash` when signing BM02-A after content revision:** If an Advisor or Department Head attempts to sign using a `payloadHash` from `versionNumber = 1` after `versionNumber = 2` was created, or if the payload changed, the signature service must reject with `409 PAYLOAD_HASH_MISMATCH` (tested in Task 1 & Task 3).
3. **Duplicate BM02-A assignment across active Appendices:** Attempting to add a `BM02AAdjustmentRequest` (`APPROVED_PENDING_APPENDIX`) to a second `DRAFT` or `ISSUED` `TitleAdjustmentAppendix` must fail with `409 BM02A_ALREADY_IN_ACTIVE_APPENDIX` (tested in Task 3).
4. **Institute double-extension or post-deadline extension on BM03/BM04 review:** Attempting `POST /api/bm03/stop-reviews/:id/request-more-info` (or BM04 defense review) a second time (`extensionCount >= 1`) must fail with `409 EXTENSION_QUOTA_EXHAUSTED`, and the first extension must add `72h` to `stopReviewDeadline` (not `now + 72h`) (tested in Task 5 & Task 6).
5. **Invalid BM04 conclusion combination:** Submitting BM04 with `programOutcome = 'DOES_NOT_MEET_PROGRAM_OUTCOMES'` and `defenseRecommendation = 'APPROVE_FOR_DEFENSE'`, or `MEETS_PROGRAM_OUTCOMES` + `NOT_APPROVE_FOR_DEFENSE` without `mismatchReason`, must fail with `400 INVALID_BM04_CONCLUSION_COMBINATION` (tested in Task 6).

---

### Task 1: Additive Prisma Schema, RBAC Permissions, Canonical Title Resolver & Electronic Signature/PDF Engine

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/constants/permissions.js`
- Create: `backend/src/services/topicTitleResolverService.js`
- Create: `backend/src/services/electronicSignatureService.js`
- Create: `backend/src/services/academicPdfService.js`
- Test: `backend/tests/unit/topicTitleResolverAndSignature.test.js`

**Interfaces:**
- Consumes: `backend/src/config/database.js` (`prisma`), `pdfkit`, `crypto`
- Produces:
  - `resolveEffectiveTopicTitle(registrationId: number, atTime?: Date, options?: { tx?: object }) -> Promise<{ title: string, source: 'APPENDIX' | 'DECISION' | 'BM02_APPROVED' | 'TOPIC_INITIAL', effectiveDate: Date | null, referenceNumber: string | null }>`
  - `computeCanonicalPayloadHash(payload: object) -> string` (SHA-256 hex of key-sorted JSON)
  - `recordSignatureEvent(input: { registrationId: number, entityType: string, entityId: number, versionNumber?: number, signerId: number, signerRole: string, action: string, expectedPayloadHash: string, actualPayload: object, signatureImageId?: string, ipAddress?: string, userAgent?: string, rejectionOrReturnReason?: string }, options?: { tx?: object }) -> Promise<ElectronicSignatureEvent>`
  - `generateImmutableAcademicPdf(input: { docType: 'BM02A' | 'BM03' | 'BM04' | 'DECISION' | 'APPENDIX', registrationId?: number, entityId: number, versionNumber?: number, title: string, sections: Array<{ heading: string, lines: string[] }>, signatures: Array<{ roleLabel: string, signerName?: string, signedAt?: Date, payloadHash?: string, systemNote?: string }> }) -> Promise<{ fileUrl: string, fileName: string, pdfHash: string }>`
  - New permission constants in `backend/src/constants/permissions.js`: `BM02_REVIEW`, `TOPIC_ASSIGNMENT_DECISION_ISSUE`, `BM02A_ADVISOR_SIGN`, `BM02A_FINAL_APPROVE`, `TITLE_ADJUSTMENT_APPENDIX_ISSUE`, `BM03_MEETING_RECORD`, `BM03_STAGE_EVALUATE`, `BM03_STOP_REVIEW`, `BM04_CREATE_AND_SIGN`, `BM04_REJECTION_REVIEW`.

- [ ] **Step 1: Write the failing unit tests in `backend/tests/unit/topicTitleResolverAndSignature.test.js`**

```javascript
const { computeCanonicalPayloadHash, recordSignatureEvent } = require('../../src/services/electronicSignatureService');
const { resolveEffectiveTopicTitle } = require('../../src/services/topicTitleResolverService');
const { generateImmutableAcademicPdf } = require('../../src/services/academicPdfService');
const { PERMISSIONS } = require('../../src/constants/permissions');

describe('Task 1: Title Resolver, Canonical Signature & Academic PDF Engine', () => {
    test('defines all 10 required BM02-BM04 permissions', () => {
        const required = [
            'BM02_REVIEW', 'TOPIC_ASSIGNMENT_DECISION_ISSUE', 'BM02A_ADVISOR_SIGN',
            'BM02A_FINAL_APPROVE', 'TITLE_ADJUSTMENT_APPENDIX_ISSUE', 'BM03_MEETING_RECORD',
            'BM03_STAGE_EVALUATE', 'BM03_STOP_REVIEW', 'BM04_CREATE_AND_SIGN', 'BM04_REJECTION_REVIEW',
        ];
        required.forEach((perm) => expect(PERMISSIONS[perm]).toBe(perm));
    });

    test('computeCanonicalPayloadHash is key-order invariant and detects mutations', () => {
        const h1 = computeCanonicalPayloadHash({ b: 2, a: 'hello', nested: { y: 1, x: 2 } });
        const h2 = computeCanonicalPayloadHash({ nested: { x: 2, y: 1 }, a: 'hello', b: 2 });
        const h3 = computeCanonicalPayloadHash({ b: 2, a: 'changed', nested: { y: 1, x: 2 } });
        expect(h1).toBe(h2);
        expect(h1).not.toBe(h3);
    });

    test('recordSignatureEvent throws 409 PAYLOAD_HASH_MISMATCH when payload differs from expectedPayloadHash', async () => {
        const actualPayload = { proposedTitle: 'Tên mới v2' };
        await expect(
            recordSignatureEvent({
                registrationId: 10,
                entityType: 'BM02A_VERSION',
                entityId: 1,
                versionNumber: 2,
                signerId: 5,
                signerRole: 'ADVISOR',
                action: 'SIGN',
                expectedPayloadHash: 'stale_hash_from_v1',
                actualPayload,
            }, { tx: {} })
        ).rejects.toMatchObject({ code: 'PAYLOAD_HASH_MISMATCH', statusCode: 409 });
    });

    test('resolveEffectiveTopicTitle prioritizes latest ISSUED appendix with signedDate <= atTime, then published decision, never pending BM02-A', async () => {
        const mockTx = {
            titleAdjustmentAppendixItem: {
                findFirst: jest.fn()
                    .mockResolvedValueOnce({
                        newTitle: 'Tên theo Phụ lục 02',
                        appendix: { appendixNumber: 'PL-02', signedDate: new Date('2026-11-10T00:00:00Z') },
                    })
                    .mockResolvedValueOnce(null),
            },
            topicAssignmentDecisionItem: {
                findFirst: jest.fn().mockResolvedValue({
                    approvedTitleSnapshot: 'Tên theo Quyết định gốc',
                    decision: { decisionNumber: 'QD-01', decisionPublishedAt: new Date('2026-11-01T00:00:00Z') },
                }),
            },
        };

        const fromAppendix = await resolveEffectiveTopicTitle(101, new Date('2026-11-11T00:00:00Z'), { tx: mockTx });
        expect(fromAppendix).toEqual({
            title: 'Tên theo Phụ lục 02',
            source: 'APPENDIX',
            effectiveDate: new Date('2026-11-10T00:00:00Z'),
            referenceNumber: 'PL-02',
        });

        const beforeAppendix = await resolveEffectiveTopicTitle(101, new Date('2026-11-05T00:00:00Z'), { tx: mockTx });
        expect(beforeAppendix).toEqual({
            title: 'Tên theo Quyết định gốc',
            source: 'DECISION',
            effectiveDate: new Date('2026-11-01T00:00:00Z'),
            referenceNumber: 'QD-01',
        });
    });

    test('generateImmutableAcademicPdf renders PDF buffer with system timeout note without fake signature', async () => {
        const res = await generateImmutableAcademicPdf({
            docType: 'BM03',
            registrationId: 101,
            entityId: 55,
            versionNumber: 1,
            title: 'Phiếu theo dõi tiến độ BM03',
            sections: [{ heading: 'Kết luận', lines: ['Tiếp tục sang BM04'] }],
            signatures: [
                { roleLabel: 'Giảng viên hướng dẫn', signerName: 'TS. Nguyễn Văn A', signedAt: new Date(), payloadHash: 'abc12345' },
                { roleLabel: 'Sinh viên xác nhận', systemNote: 'Sinh viên không xác nhận trong thời hạn 48 giờ (ACKNOWLEDGEMENT_TIMEOUT)' },
            ],
        });
        expect(res.fileUrl).toMatch(/\.pdf$/);
        expect(res.pdfHash).toHaveLength(64);
    });
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `cd backend && npx jest tests/unit/topicTitleResolverAndSignature.test.js`
Expected: FAIL with `Cannot find module '../../src/services/electronicSignatureService'`

- [ ] **Step 3: Add additive models & enums to `backend/prisma/schema.prisma`, update `backend/src/constants/permissions.js`, and implement the 3 core services**

In `backend/prisma/schema.prisma`, add the models and enums specified in Section 5.2 of `docs/superpowers/specs/2026-11-11-bm02-to-bm04-workflow-design.md` (`ElectronicSignatureEvent`, `TopicAssignmentDecision`, `TopicAssignmentDecisionItem`, `BM02AAdjustmentRequest`, `BM02AFormVersion`, `TitleAdjustmentAppendix`, `TitleAdjustmentAppendixItem`, `BM03ProgressRecord`, `BM03MeetingEntry`, `BM03StageEvaluation`, `InstituteStopReview`, `InstituteDefenseReview`, plus additive fields on `Semester`, `TopicRegistration`, `BM02Submission`, `BM04Evaluation` and enum values on `RegistrationStatus`). Run `npx prisma db push` (or `npx prisma migrate dev --name add_bm02_to_bm04_workflow`) and `npx prisma generate`.
Implement `backend/src/constants/permissions.js`, `backend/src/services/topicTitleResolverService.js`, `backend/src/services/electronicSignatureService.js`, and `backend/src/services/academicPdfService.js`.

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `cd backend && npx jest tests/unit/topicTitleResolverAndSignature.test.js`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/constants/permissions.js backend/src/services/topicTitleResolverService.js backend/src/services/electronicSignatureService.js backend/src/services/academicPdfService.js backend/tests/unit/topicTitleResolverAndSignature.test.js
git commit -m "feat(core): add BM02-BM04 additive schema, permissions, title resolver, and signature/PDF engine"
```

---

### Task 2: Chặng 1A Backend — BM02 Application Lifecycle, Controlled Title Update & Topic Assignment Decision Publication

**Files:**
- Modify: `backend/src/services/outlineReviewService.js`
- Modify: `backend/src/services/academicDocumentService.js`
- Modify: `backend/src/services/bm02ReviewService.js`
- Create: `backend/src/controllers/bm02WorkflowController.js`
- Create: `backend/src/routes/bm02WorkflowRoutes.js`
- Modify: `backend/src/controllers/registrationController.js`
- Modify: `backend/src/controllers/semesterController.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/integration/bm02AndDecisionWorkflow.test.js`

**Interfaces:**
- Consumes: `resolveEffectiveTopicTitle`, `generateImmutableAcademicPdf` from Task 1
- Produces:
  - `submitBM02({ registrationId, studentId, bm02ProposedTitle, titleChangeReason, content, fileUrl, fileName, idempotencyKey }, options)` -> saves `bm01ApprovedTitle` snapshot & `bm02ProposedTitle`, syncs `Task(BM02)` to `SUBMITTED`, transitions registration to `BM02_SUBMITTED`
  - `reviewBM02({ registrationId, reviewerId, action: 'APPROVE' | 'RETURN_FOR_REVISION' | 'EXCEPTION_REVIEW', issues, idempotencyKey }, options)` -> max 1 revision (`attemptNo = 1 -> BM02_NEEDS_REVISION` + `Task(BM02) = REVISION`; `APPROVE` -> `BM02_APPROVED`/`BM02Submission.outcome = APPROVED` + `Task(BM02) = COMPLETED`)
  - `createTopicDecision({ semesterId, decisionNumber, decisionDate, fileUrl, fileName, registrationIds, issuedById, idempotencyKey }, options)` -> creates `TopicAssignmentDecision` (`DRAFT`) + `TopicAssignmentDecisionItem` snapshots
  - `publishTopicDecision({ decisionId, publishedById, publishedAt, idempotencyKey }, options)` -> sets `status = 'PUBLISHED'`, `decisionPublishedAt = publishedAt`, transitions items' registrations to `DECISION_ISSUED`, sets `titleAdjustmentDeadline = decisionPublishedAt + 168h`
  - Routes mounted in `backend/src/app.js`:
    - `POST /api/bm02/applications/:registrationId/submit`
    - `POST /api/bm02/applications/:id/request-revision`
    - `POST /api/bm02/applications/:id/resubmit`
    - `POST /api/bm02/applications/:id/approve`
    - `POST /api/topic-decisions`
    - `POST /api/topic-decisions/:id/publish`

- [ ] **Step 1: Write the failing integration test in `backend/tests/integration/bm02AndDecisionWorkflow.test.js`**

```javascript
const { submitBM02, createTopicDecision, publishTopicDecision } = require('../../src/services/academicDocumentService');
const { reviewBM02 } = require('../../src/services/bm02ReviewService');

describe('Task 2: Chặng 1A — BM02 & Topic Assignment Decision', () => {
    test('inherits locked semester policy when registration.periodPolicyVersionId is null, preserves bm01ApprovedTitle, allows bm02ProposedTitle, and syncs BM02 task status', async () => {
        // Verifies:
        // 1. Student in BM01_PASSED submits BM02 with bm02ProposedTitle + titleChangeReason
        // 2. bm01ApprovedTitle remains unchanged; bm02ProposedTitle is stored on BM02Submission
        // 3. Task(taskType='BM02') transitions OPEN -> SUBMITTED -> REVISION -> SUBMITTED -> COMPLETED
        // 4. Institute requests revision once (attempt 1 -> BM02_NEEDS_REVISION), student resubmits (attempt 2 -> BM02_RESUBMITTED), Institute approves
        // 5. createTopicDecision + publishTopicDecision records decisionPublishedAt and computes 168h window from decisionPublishedAt (not decisionDate)
    });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `cd backend && npx jest tests/integration/bm02AndDecisionWorkflow.test.js`
Expected: FAIL with `createTopicDecision is not a function` (and `TITLE_AMENDMENT_REQUIRED` on proposed title)

- [ ] **Step 3: Implement Chặng 1A services, controller, routes, and backward-compatible adapters**

1. Update `backend/src/services/outlineReviewService.js` so transitioning to `BM01_PASSED` populates `bm01ApprovedTitleSnapshot: registration.topic.title` and inherits `semester.lockedPolicyVersionId` (or active semester policy) if `registration.periodPolicyVersionId` is null.
2. Update `backend/src/services/academicDocumentService.js` and `backend/src/controllers/registrationController.js`: remove the 409 block on `officialTitle`/`bm02ProposedTitle`; instead record `bm01ApprovedTitle` and `bm02ProposedTitle` (requiring `titleChangeReason` when `bm02ProposedTitle !== bm01ApprovedTitle`) and forbid changing mentor/major/scope; sync `Task` (`taskType: 'BM02'`) status inside the same transaction.
3. Implement `createTopicDecision` and `publishTopicDecision` in `backend/src/services/academicDocumentService.js`, and wire `backend/src/controllers/bm02WorkflowController.js` + `backend/src/routes/bm02WorkflowRoutes.js` in `backend/src/app.js`.

- [ ] **Step 4: Run tests to verify Task 2 and existing BM01/BM02 tests pass**

Run: `cd backend && npx jest tests/integration/bm02AndDecisionWorkflow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/outlineReviewService.js backend/src/services/academicDocumentService.js backend/src/services/bm02ReviewService.js backend/src/controllers/bm02WorkflowController.js backend/src/routes/bm02WorkflowRoutes.js backend/src/controllers/registrationController.js backend/src/controllers/semesterController.js backend/src/app.js backend/tests/integration/bm02AndDecisionWorkflow.test.js
git commit -m "feat(bm02): implement BM02 title refinement, task sync, and published topic assignment decisions"
```

---

### Task 3: Chặng 1B Backend — BM02-A Three-Signature Workflow & Batch Title Adjustment Appendices

**Files:**
- Create: `backend/src/services/bm02aWorkflowService.js`
- Create: `backend/src/services/titleAdjustmentAppendixService.js`
- Create: `backend/src/controllers/bm02aController.js`
- Create: `backend/src/routes/bm02aRoutes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/integration/bm02aAndAppendixWorkflow.test.js`

**Interfaces:**
- Consumes: `computeCanonicalPayloadHash`, `recordSignatureEvent`, `generateImmutableAcademicPdf`, `resolveEffectiveTopicTitle` from Task 1; `validateAcademicScope` from `backend/src/services/academicScopeService.js`
- Produces:
  - `createBM02ARequest({ registrationId, studentId, proposedTitle, reason }, options)` -> validates `now <= decisionPublishedAt + 168h`, snapshots student personal info (`fullName`, `studentCode`, `dateOfBirth`, `placeOfBirth`, `className`, `cohort`, `major`) + `registeredTitleSnapshot`, creates `BM02AAdjustmentRequest` (`STUDENT_PREPARING`) and `BM02AFormVersion` (`versionNumber = 1`)
  - `studentSignAndSubmitBM02A({ requestId, studentId, payloadHash, signatureImageId, ipAddress, userAgent, idempotencyKey }, options)` -> checks `now <= titleAdjustmentDeadline`, records student signature, transitions to `PENDING_ADVISOR`
  - `advisorSignBM02A({ requestId, advisorId, payloadHash, signatureImageId, ipAddress, userAgent, idempotencyKey }, options)` -> verifies `registration.topic.mentorId === advisorId` and matching `payloadHash`, records advisor signature, transitions to `PENDING_DEPARTMENT_APPROVAL`
  - `departmentSignBM02A({ requestId, departmentHeadId, payloadHash, signatureImageId, ipAddress, userAgent, idempotencyKey }, options)` -> verifies `validateAcademicScope(tx, { actorId: departmentHeadId, registrationId, capabilityCode: 'BM02A_FINAL_APPROVE' })` and matching `payloadHash`, records 3rd signature, generates immutable PDF, locks version, transitions to `APPROVED_PENDING_APPENDIX`
  - `returnBM02A({ requestId, actorId, actorRole: 'ADVISOR' | 'DEPARTMENT_HEAD', reason, idempotencyKey }, options)` -> if `versionNumber === 1` and `now <= titleAdjustmentDeadline`, transitions to `RETURNED_FOR_CORRECTION`; if `versionNumber >= 2` or `now > titleAdjustmentDeadline`, transitions to `REJECTED_FINAL`
  - `reviseBM02A({ requestId, studentId, proposedTitle, reason, idempotencyKey }, options)` -> atomic conditional update `WHERE id = requestId AND revisionCount = 0 AND status = 'RETURNED_FOR_CORRECTION' AND titleAdjustmentDeadline >= now`, creates `versionNumber = 2` with new `payloadHash` requiring fresh student + advisor + department signatures
  - `createAppendixDraft({ decisionId, appendixNumber, signedDate, fileUrl, fileName, bm02aRequestIds, issuedById, idempotencyKey }, options)`, `updateAppendixItems({ appendixId, bm02aRequestIds, actorId }, options)`, `issueAppendix({ appendixId, issuedById, signedDate, idempotencyKey }, options)` -> issues appendix (`ISSUED`), transitions items' requests to `ADJUSTMENT_ISSUED`, makes `newTitle` effective from `signedDate`
  - Routes mounted in `backend/src/app.js`:
    - `POST /api/bm02a/requests`
    - `POST /api/bm02a/requests/:id/student-sign-submit`
    - `POST /api/bm02a/requests/:id/advisor-sign`
    - `POST /api/bm02a/requests/:id/return`
    - `POST /api/bm02a/requests/:id/department-sign`
    - `POST /api/bm02a/requests/:id/revise`
    - `POST /api/title-adjustment-appendices`
    - `PUT /api/title-adjustment-appendices/:id/items`
    - `POST /api/title-adjustment-appendices/:id/issue`

- [ ] **Step 1: Write the failing integration test in `backend/tests/integration/bm02aAndAppendixWorkflow.test.js`**

```javascript
describe('Task 3: Chặng 1B — BM02-A 3-Signature Workflow & Batch Appendices', () => {
    test('enforces 168h window from decisionPublishedAt, 3 signatures on identical payloadHash, single revision v2 atomic guard, and batch appendix effective title', async () => {
        // Exercises:
        // 1. Student creates & signs v1 within 168h -> PENDING_ADVISOR
        // 2. Advisor returns v1 within 168h -> RETURNED_FOR_CORRECTION
        // 3. Concurrent reviseBM02A calls: only one creates v2 (revisionCount=1), second fails with 409 REVISION_LIMIT_EXCEEDED
        // 4. Stale v1 payloadHash rejected with 409 PAYLOAD_HASH_MISMATCH
        // 5. Student signs v2 -> Advisor signs v2 -> Department Head signs v2 (after 168h is allowed because student submitted on time) -> APPROVED_PENDING_APPENDIX + PDF locked
        // 6. Adding same BM02-A to two active appendices fails with 409 BM02A_ALREADY_IN_ACTIVE_APPENDIX
        // 7. Issuing appendix transitions BM02-A to ADJUSTMENT_ISSUED and resolveEffectiveTopicTitle returns newTitle from signedDate
    });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `cd backend && npx jest tests/integration/bm02aAndAppendixWorkflow.test.js`
Expected: FAIL with `Cannot find module '../../src/services/bm02aWorkflowService'`

- [ ] **Step 3: Implement `bm02aWorkflowService.js`, `titleAdjustmentAppendixService.js`, `bm02aController.js`, and `bm02aRoutes.js`**

Implement all functions and routes specified in Interfaces, ensuring atomic conditional updates for `revisionCount = 0` and active appendix item uniqueness.

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `cd backend && npx jest tests/integration/bm02aAndAppendixWorkflow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/bm02aWorkflowService.js backend/src/services/titleAdjustmentAppendixService.js backend/src/controllers/bm02aController.js backend/src/routes/bm02aRoutes.js backend/src/app.js backend/tests/integration/bm02aAndAppendixWorkflow.test.js
git commit -m "feat(bm02a): implement 3-party signature BM02-A workflow and batch title adjustment appendices"
```

---

### Task 4: Chặng 1A & 1B Frontend — Student, Advisor, Department Head & Admin UI for BM02, Decisions, BM02-A & Appendices

**Files:**
- Create: `frontend/src/services/bm02aService.js`
- Modify: `frontend/src/services/registrationService.js`
- Modify: `frontend/src/components/forms/HybridBMFormModal.jsx`
- Modify: `frontend/src/components/student/TitleAdjustmentModal.jsx`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx`
- Modify: `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx`
- Modify: `frontend/src/components/admin/BM02ReviewDrawer.jsx`
- Test: `frontend/src/pages/student/__tests__/bm02AndBm02aUi.test.jsx`

**Interfaces:**
- Consumes: Task 2 & Task 3 REST endpoints (`/api/bm02/*`, `/api/topic-decisions/*`, `/api/bm02a/*`, `/api/title-adjustment-appendices/*`)
- Produces:
  - `frontend/src/services/bm02aService.js`: `createRequest`, `studentSignSubmit`, `advisorSign`, `departmentSign`, `returnRequest`, `reviseRequest`, `getRequestsByRegistration`, `getPendingQueue`, `createAppendix`, `updateAppendixItems`, `issueAppendix`, `getAppendices`
  - Updated `HybridBMFormModal.jsx` (`BM02` config): displays read-only `bm01ApprovedTitle`, editable `bm02ProposedTitle`, conditional `titleChangeReason` (required when title differs), and file upload.
  - Updated `TitleAdjustmentModal.jsx`: full BM02-A form showing snapshot personal info, 168h countdown from `decisionPublishedAt`, 3-signature stepper (`Sinh viên` -> `GVHD` -> `Phụ trách bộ môn`), v1/v2 version badge, and single-revision form when `RETURNED_FOR_CORRECTION`.
  - Updated `TopicApprovalPage.jsx`: adds tab **"Duyệt phiếu đổi tên BM02-A"** for GVHD (`advisor-sign` / `return`) and Department Head (`department-sign` / `return`).
  - Updated `ProjectPeriodPage.jsx`: adds Decision Publish control (`decisionPublishedAt`) and **"Phụ lục điều chỉnh tên đề tài"** manager (`DRAFT` item selector -> `ISSUED`).

- [ ] **Step 1: Write the failing frontend component test in `frontend/src/pages/student/__tests__/bm02AndBm02aUi.test.jsx`**

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TitleAdjustmentModal from '../../../components/student/TitleAdjustmentModal';

describe('Task 4: BM02 & BM02-A UI', () => {
    it('renders 3-signature stepper, student snapshot fields, and 168h deadline from decisionPublishedAt', async () => {
        render(
            <TitleAdjustmentModal
                open={true}
                onClose={vi.fn()}
                registration={{
                    id: 10,
                    decisionPublishedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
                    topic: { title: 'Đề tài gốc trong quyết định' },
                    student: { fullName: 'Nguyễn Văn SV', code: '220001' },
                }}
                onSuccess={vi.fn()}
            />
        );
        expect(await screen.findByText(/Phiếu đề nghị điều chỉnh tên đề tài \(BM02-A\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Chữ ký Sinh viên/i)).toBeInTheDocument();
        expect(screen.getByText(/Chữ ký GVHD/i)).toBeInTheDocument();
        expect(screen.getByText(/Chữ ký Phụ trách bộ môn/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the frontend test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/student/__tests__/bm02AndBm02aUi.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `bm02aService.js` and update the Student, Lecturer, Department Head, and Admin components**

Ensure 100% of `<Button>` elements use `@ant-design/icons` via `icon={...}` with zero raw emojis/symbols in labels.

- [ ] **Step 4: Run the frontend test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/student/__tests__/bm02AndBm02aUi.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/bm02aService.js frontend/src/services/registrationService.js frontend/src/components/forms/HybridBMFormModal.jsx frontend/src/components/student/TitleAdjustmentModal.jsx frontend/src/pages/student/SubmissionPage.jsx frontend/src/pages/student/StudentDashboardPage.jsx frontend/src/pages/lecturer/TopicApprovalPage.jsx frontend/src/pages/admin/ProjectPeriodPage.jsx frontend/src/components/admin/BM02ReviewDrawer.jsx frontend/src/pages/student/__tests__/bm02AndBm02aUi.test.jsx
git commit -m "feat(ui): add BM02 title refinement, BM02-A 3-signature modal, and batch appendix management UI"
```

---

### Task 5: Chặng 2 Backend — BM03 Guidance Meetings, Midterm/Final Evaluations, Institute Stop Review (7+3d SLA) & 48h Student Acknowledgement

**Files:**
- Create: `backend/src/services/bm03WorkflowService.js`
- Create: `backend/src/controllers/bm03Controller.js`
- Create: `backend/src/routes/bm03Routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/integration/bm03Workflow.test.js`

**Interfaces:**
- Consumes: `resolveEffectiveTopicTitle`, `computeCanonicalPayloadHash`, `recordSignatureEvent`, `generateImmutableAcademicPdf` from Task 1
- Produces:
  - `createBM03Meeting({ registrationId, advisorId, meetingDate, meetingMode, locationOrLink, discussionContent, studentCompletedWork, remainingIssues, nextTasks, expectedDeadline, progressRating, evidenceFileUrl, evidenceFileName, supersedesEntryId }, options)`
  - `signBM03Meeting({ meetingId, advisorId, signatureImageId, ipAddress, userAgent, idempotencyKey }, options)` -> Advisor-only signature (`isLocked = true`), no student signature required per meeting
  - `submitStageEvaluation({ registrationId, advisorId, stage: 'MIDTERM' | 'FINAL', comments, decision: 'CONTINUE' | 'CONTINUE_TO_BM04' | 'PROPOSE_STOP', idempotencyKey }, options)` -> if `PROPOSE_STOP`, creates `InstituteStopReview` with `status = 'STOP_REVIEW_PENDING'` and `stopReviewDeadline = submittedAt + 168h` (student keeps working while pending)
  - `requestMoreInfoForStopReview({ stopReviewId, reviewerId, note, idempotencyKey }, options)` -> atomic conditional update `WHERE id = stopReviewId AND extensionCount = 0 AND status = 'STOP_REVIEW_PENDING' AND stopReviewDeadline >= now`, sets `extensionCount = 1`, `status = 'MORE_INFO_REQUIRED'`, `stopReviewDeadline = currentDeadline + 72h` (total 240h)
  - `decideStopReview({ stopReviewId, reviewerId, decision: 'APPROVE_STOP' | 'REJECT_STOP', reason, idempotencyKey }, options)` -> `APPROVE_STOP` sets `STOP_APPROVED`, closes BM03 early (`isClosedEarly = true`, `finalConclusion = 'STOPPED'`), transitions registration to `TERMINATED_FAILED_PROGRESS`; `REJECT_STOP` sets `STOP_REJECTED` and student continues
  - `advisorSignWholeBM03({ bm03RecordId, advisorId, signatureImageId, ipAddress, userAgent, idempotencyKey }, options)` -> requires final stage conclusion (`CONTINUE_TO_BM04` or `STOPPED`), records advisor whole-form signature, sets `studentAckStatus = 'PENDING_STUDENT_ACKNOWLEDGEMENT'`, `studentAckDeadlineAt = now + 48h`
  - `studentAcknowledgeBM03({ bm03RecordId, studentId, action: 'ACKNOWLEDGED' | 'ACKNOWLEDGED_WITH_COMMENT' | 'DECLINED_TO_ACKNOWLEDGE', comment, ipAddress, userAgent, idempotencyKey }, options)` -> if `DECLINED_TO_ACKNOWLEDGE`, requires `comment`; generates immutable BM03 PDF; if `finalConclusion === 'CONTINUE_TO_BM04'`, transitions registration to `BM03_PASSED` and opens `Task(BM04)`
  - Routes mounted in `backend/src/app.js`:
    - `GET /api/bm03/:registrationId`
    - `POST /api/bm03/:registrationId/meetings`
    - `POST /api/bm03/meetings/:id/sign`
    - `POST /api/bm03/:registrationId/midterm-evaluation`
    - `POST /api/bm03/:registrationId/final-evaluation`
    - `POST /api/bm03/stop-reviews/:id/decision`
    - `POST /api/bm03/stop-reviews/:id/request-more-info`
    - `POST /api/bm03/:id/advisor-sign`
    - `POST /api/bm03/:id/student-acknowledge`
    - `POST /api/bm03/:id/student-decline`

- [ ] **Step 1: Write the failing integration test in `backend/tests/integration/bm03Workflow.test.js`**

```javascript
describe('Task 5: Chặng 2 — BM03 Meetings, Stage Evaluations, 7+3d Stop Review & 48h Student Ack', () => {
    test('locks individual meetings with advisor signature only, keeps student active during PROPOSE_STOP review, enforces 168h + single 72h extension, and completes whole-form 48h acknowledgement', async () => {
        // Exercises:
        // 1. Advisor records & signs meeting -> locked immediately without student signature; editing creates v2
        // 2. Midterm PROPOSE_STOP -> creates InstituteStopReview (deadline = submittedAt + 168h); student can still have meetings recorded while STOP_REVIEW_PENDING
        // 3. Institute requests more info -> deadline becomes original + 168h + 72h; second requestMoreInfo fails with 409 EXTENSION_QUOTA_EXHAUSTED
        // 4. Institute REJECT_STOP -> student continues to Final evaluation (CONTINUE_TO_BM04)
        // 5. Advisor signs whole BM03 -> student declines or acknowledges within 48h -> BM03_PASSED & Task(BM04) opened
    });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `cd backend && npx jest tests/integration/bm03Workflow.test.js`
Expected: FAIL with `Cannot find module '../../src/services/bm03WorkflowService'`

- [ ] **Step 3: Implement `bm03WorkflowService.js`, `bm03Controller.js`, and `bm03Routes.js`**

Implement all functions and routes specified in Interfaces, ensuring atomic conditional updates on `extensionCount = 0` and snapshot of `effectiveTitleSnapshot` via `resolveEffectiveTopicTitle`.

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `cd backend && npx jest tests/integration/bm03Workflow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/bm03WorkflowService.js backend/src/controllers/bm03Controller.js backend/src/routes/bm03Routes.js backend/src/app.js backend/tests/integration/bm03Workflow.test.js
git commit -m "feat(bm03): implement advisor-signed meetings, stage evaluations, 7+3d stop review, and 48h student ack"
```

---

### Task 6: Chặng 3 Backend — BM04 Advisor Evaluation (Draft/Sign 4 Criteria + 2 Conclusions), Institute Rejection Review (7+3d SLA) & 5 Scheduled Sweep Jobs

**Files:**
- Modify: `backend/src/services/bm04WorkflowService.js`
- Create: `backend/src/services/bm02ToBm04SweepService.js`
- Create: `backend/src/controllers/bm04Controller.js`
- Create: `backend/src/routes/bm04Routes.js`
- Modify: `backend/src/controllers/councilController.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/integration/bm04AndSweepJobsWorkflow.test.js`

**Interfaces:**
- Consumes: `resolveEffectiveTopicTitle`, `computeCanonicalPayloadHash`, `recordSignatureEvent`, `generateImmutableAcademicPdf` from Task 1
- Produces:
  - `saveBM04Draft({ registrationId, advisorId, thesisFormatScore, researchContentScore, applicabilityScore, attitudeScore, programOutcome, defenseRecommendation, mismatchReason, generalNotes }, options)` -> saves unlocked draft (`status = 'DRAFT'`, `isLocked = false`) with `effectiveTitleSnapshot`
  - `signAndSubmitBM04({ registrationId, advisorId, thesisFormatScore, researchContentScore, applicabilityScore, attitudeScore, programOutcome, defenseRecommendation, mismatchReason, generalNotes, lecturerSignature, signatureImageId, ipAddress, userAgent, idempotencyKey }, options)`:
    - Validates 4 criteria + 2 conclusions (`DOES_NOT_MEET_PROGRAM_OUTCOMES` must pair with `NOT_APPROVE_FOR_DEFENSE`; `MEETS_PROGRAM_OUTCOMES` + `NOT_APPROVE_FOR_DEFENSE` requires `mismatchReason`).
    - Locks BM04 (`isLocked = true`), generates immutable PDF, records `ElectronicSignatureEvent`.
    - Branch A (`MEETS_PROGRAM_OUTCOMES` + `APPROVE_FOR_DEFENSE`): transitions BM04 to `SIGNED_APPROVED`, registration to `DEFENSE_READY` (and sets `DEFENSE_ELIGIBLE` compatibility), `Task(BM04)` to `COMPLETED`.
    - Branch B (`NOT_APPROVE_FOR_DEFENSE`): transitions BM04 to `PENDING_INSTITUTE_REVIEW`, creates `InstituteDefenseReview` (`reviewDeadlineAt = now + 168h`).
  - `requestMoreInfoForDefenseReview({ reviewId, reviewerId, note, idempotencyKey }, options)` -> single `+72h` extension (`extensionCount: 0 -> 1`)
  - `decideDefenseReview({ reviewId, reviewerId, decision: 'APPROVE_NOT_ELIGIBLE' | 'OVERRIDE_ELIGIBLE', reason, idempotencyKey }, options)` -> records `NOT_ELIGIBLE_FOR_DEFENSE` (registration -> `NOT_ELIGIBLE_FOR_DEFENSE`) or `ELIGIBLE_BY_INSTITUTE` (registration -> `DEFENSE_READY`) without modifying Advisor's signed BM04.
  - `runBm02ToBm04SweepJobs({ now = new Date() }, options)` -> executes all 5 idempotent jobs using conditional updates:
    1. Close BM02-A creation window after 168h.
    2. Expire unsubmitted/returned BM02-A requests past `titleAdjustmentDeadline` (`EXPIRED`).
    3. Auto-terminate overdue `InstituteStopReview` (`status = 'AUTO_TERMINATED'`, `decisionSource = 'SYSTEM_TIMEOUT'`, registration -> `AUTO_TERMINATED`, no fake admin signature).
    4. Auto-complete overdue 48h student BM03 acknowledgements (`studentAckStatus = 'ACKNOWLEDGEMENT_TIMEOUT'`, generates PDF with timeout note, no fake student signature; if `finalConclusion === 'CONTINUE_TO_BM04'`, transitions registration to `BM03_PASSED` and opens `BM04`).
    5. Auto-finalize overdue `InstituteDefenseReview` (`status = 'AUTO_NOT_ELIGIBLE'`, `decisionSource = 'SYSTEM_TIMEOUT'`, registration -> `AUTO_NOT_ELIGIBLE`, no fake admin signature).
  - Routes mounted in `backend/src/app.js`:
    - `GET /api/bm04/:registrationId`
    - `POST /api/bm04/:registrationId/save-draft`
    - `POST /api/bm04/:registrationId/sign-submit`
    - `POST /api/bm04/defense-reviews/:id/decision`
    - `POST /api/bm04/defense-reviews/:id/request-more-info`
    - `POST /api/bm04/sweep-overdue`

- [ ] **Step 1: Write the failing integration test in `backend/tests/integration/bm04AndSweepJobsWorkflow.test.js`**

```javascript
describe('Task 6: Chặng 3 — BM04 Evaluation, 7+3d Institute Defense Review & 5 Sweep Jobs', () => {
    test('rejects invalid programOutcome/defenseRecommendation pairs, immediately marks DEFENSE_READY on approval, routes rejection to 7+3d Institute review, and executes all 5 timeout sweeps without forged signatures', async () => {
        // Exercises:
        // 1. 48h BM03 student ack sweep -> ACKNOWLEDGEMENT_TIMEOUT (0 student ElectronicSignatureEvents) -> opens BM04 (BM03_PASSED)
        // 2. DOES_NOT_MEET_PROGRAM_OUTCOMES + APPROVE_FOR_DEFENSE -> 400 INVALID_BM04_CONCLUSION_COMBINATION
        // 3. MEETS_PROGRAM_OUTCOMES + APPROVE_FOR_DEFENSE -> SIGNED_APPROVED + registration DEFENSE_READY immediately
        // 4. NOT_APPROVE_FOR_DEFENSE -> InstituteDefenseReview (168h + single 72h extension)
        // 5. Overdue InstituteStopReview & InstituteDefenseReview sweeps -> SYSTEM_TIMEOUT (0 admin ElectronicSignatureEvents)
    });
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `cd backend && npx jest tests/integration/bm04AndSweepJobsWorkflow.test.js`
Expected: FAIL with `Cannot find module '../../src/services/bm02ToBm04SweepService'`

- [ ] **Step 3: Implement `bm04WorkflowService.js`, `bm02ToBm04SweepService.js`, `bm04Controller.js`, and `bm04Routes.js`**

Implement all functions and routes specified in Interfaces, and ensure `councilController.js` includes `['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE']` when querying eligible students for Defense Councils.

- [ ] **Step 4: Run the integration test to verify it passes**

Run: `cd backend && npx jest tests/integration/bm04AndSweepJobsWorkflow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/bm04WorkflowService.js backend/src/services/bm02ToBm04SweepService.js backend/src/controllers/bm04Controller.js backend/src/routes/bm04Routes.js backend/src/controllers/councilController.js backend/src/app.js backend/tests/integration/bm04AndSweepJobsWorkflow.test.js
git commit -m "feat(bm04): implement BM04 2-conclusion evaluation, 7+3d defense review, and 5 idempotent sweep jobs"
```

---

### Task 7: Chặng 2 & 3 Frontend — Lecturer, Student & Institute UI for BM03 and BM04

**Files:**
- Modify: `frontend/src/services/evaluationService.js`
- Modify: `frontend/src/services/meetingLogService.js`
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
- Modify: `frontend/src/pages/lecturer/components/StudentProgressDetailPanel.jsx`
- Modify: `frontend/src/components/lecturer/BM04EvaluationModal.jsx`
- Modify: `frontend/src/components/lecturer/CheckpointIssueModal.jsx`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectOversightPage.jsx`
- Test: `frontend/src/pages/lecturer/__tests__/bm03AndBm04Ui.test.jsx`

**Interfaces:**
- Consumes: Task 5 & Task 6 REST endpoints (`/api/bm03/*`, `/api/bm04/*`)
- Produces:
  - Updated `ProgressTrackingPage.jsx` & `StudentProgressDetailPanel.jsx`:
    - Meeting Entry form & list with `progressRating` badge (`ON_TRACK`, `AT_RISK`, `BEHIND`, `NO_PROGRESS`) and **"Ký khóa buổi hướng dẫn"** button (Advisor-only signature).
    - Midterm (`CONTINUE` / `PROPOSE_STOP`) & Final (`CONTINUE_TO_BM04` / `PROPOSE_STOP`) Stage Evaluation cards, plus **"Ký toàn phiếu BM03"** button.
  - Updated `BM04EvaluationModal.jsx`:
    - Displays effective topic title from `resolveEffectiveTopicTitle`.
    - 4 criteria textareas + `programOutcome` (`MEETS_PROGRAM_OUTCOMES` / `DOES_NOT_MEET_PROGRAM_OUTCOMES`) + `defenseRecommendation` (`APPROVE_FOR_DEFENSE` / `NOT_APPROVE_FOR_DEFENSE`) + conditional `mismatchReason` + **"Lưu nháp"** and **"Ký và nộp"** buttons.
  - Updated `SubmissionPage.jsx` & `StudentDashboardPage.jsx`:
    - 48-hour BM03 Student Acknowledgement banner & modal (`Ký xác nhận đã biết`, `Xác nhận kèm ý kiến`, `Từ chối ký` with required reason) and immutable PDF download link for BM02-A, BM03, and BM04.
  - Updated `ProjectOversightPage.jsx`:
    - Institute review queue for **Đề nghị dừng BM03** and **Đề nghị không cho bảo vệ BM04** with SLA countdown (`168h`), **"Yêu cầu bổ sung (+72h)"** button, and final decision buttons.

- [ ] **Step 1: Write the failing frontend component test in `frontend/src/pages/lecturer/__tests__/bm03AndBm04Ui.test.jsx`**

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BM04EvaluationModal from '../../../components/lecturer/BM04EvaluationModal';

describe('Task 7: BM03 & BM04 UI', () => {
    it('enforces programOutcome and defenseRecommendation rules and provides Save Draft + Sign Submit buttons', async () => {
        render(
            <BM04EvaluationModal
                open={true}
                onClose={vi.fn()}
                registration={{
                    id: 20,
                    status: 'BM03_PASSED',
                    effectiveTitle: 'Tên đề tài hiệu lực từ Phụ lục',
                    student: { fullName: 'Trần Thị B', code: '220002' },
                    topic: { title: 'Tên đề tài gốc' },
                }}
                onSuccess={vi.fn()}
            />
        );
        expect(await screen.findByText(/Đáp ứng chuẩn đầu ra học phần/i)).toBeInTheDocument();
        expect(screen.getByText(/Lưu nháp/i)).toBeInTheDocument();
        expect(screen.getByText(/Ký và nộp/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run the frontend test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/lecturer/__tests__/bm03AndBm04Ui.test.jsx`
Expected: FAIL

- [ ] **Step 3: Update `evaluationService.js`, `meetingLogService.js`, and the Lecturer, Student, and Admin UI components**

Follow Rule 2.6 in `AGENTS.md` strictly (use `@ant-design/icons` on all buttons, zero raw emojis/symbols in button labels).

- [ ] **Step 4: Run the frontend test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/lecturer/__tests__/bm03AndBm04Ui.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/evaluationService.js frontend/src/services/meetingLogService.js frontend/src/pages/lecturer/ProgressTrackingPage.jsx frontend/src/pages/lecturer/components/StudentProgressDetailPanel.jsx frontend/src/components/lecturer/BM04EvaluationModal.jsx frontend/src/components/lecturer/CheckpointIssueModal.jsx frontend/src/pages/student/SubmissionPage.jsx frontend/src/pages/student/StudentDashboardPage.jsx frontend/src/pages/admin/ProjectOversightPage.jsx frontend/src/pages/lecturer/__tests__/bm03AndBm04Ui.test.jsx
git commit -m "feat(ui): implement BM03 meeting lock, stage evaluations, 48h student ack, BM04 2-conclusion modal, and Institute SLA queues"
```

---

### Task 8: End-to-End Lifecycle Integration Test & Full Build Verification

**Files:**
- Create: `backend/tests/integration/bm02ToBm04FullE2E.test.js`

**Interfaces:**
- Consumes: All services and routes from Tasks 1–7
- Produces: End-to-end verification of all 15 acceptance criteria in Section 13 of `dac-ta-thiet-ke-bm02-den-bm04.md`

- [ ] **Step 1: Write the full E2E integration test in `backend/tests/integration/bm02ToBm04FullE2E.test.js`**

```javascript
describe('Task 8: Full E2E Lifecycle — BM01_PASSED -> BM02 -> Decision -> BM02-A -> Appendix -> BM03 -> BM04 -> Defense Eligible', () => {
    test('completes full happy path and exception branches across all 15 acceptance criteria', async () => {
        // Verifies all 15 acceptance criteria end-to-end:
        // 1. BM01_PASSED opens BM02 with locked semester policy
        // 2. Student submits BM02 with refined title -> Institute approves -> Decision published (decisionPublishedAt)
        // 3. Student submits BM02-A within 168h -> returned once -> revised to v2 -> signed by Student, Advisor, Department Head
        // 4. Institute issues TitleAdjustmentAppendix -> resolveEffectiveTopicTitle returns new title from signedDate
        // 5. Advisor records & signs BM03 meetings, Midterm CONTINUE, Final CONTINUE_TO_BM04, signs whole BM03 -> Student acknowledges within 48h
        // 6. Advisor saves draft then signs BM04 (MEETS_PROGRAM_OUTCOMES + APPROVE_FOR_DEFENSE) -> registration immediately eligible for Defense Council with effective appendix title snapshot
    });
});
```

- [ ] **Step 2: Run the E2E test and full backend + frontend test suites and production build**

Run:
- `cd backend && npx jest tests/integration/bm02ToBm04FullE2E.test.js`
- `cd backend && npm test`
- `cd frontend && npm test -- --run && npm run build`
Expected: 100% test suites PASS, Vite production build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/bm02ToBm04FullE2E.test.js
git commit -m "test(e2e): add comprehensive E2E test for BM02 to BM04 workflow"
```

