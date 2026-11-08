# Student Profile and Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store complete, mandatory student identities, import them atomically from Excel, and reset the demo database to an empty academic state while preserving its one working administrator.

**Architecture:** Keep shared account identity in `User` and place student-only fields in a required one-to-one `StudentProfile`. Server-side validation produces an all-or-nothing import transaction; the browser only previews the same contract. A dedicated reset command snapshots and recreates the approved admin after a full application-table truncate, then restores only the authorization catalog required for administration.

**Tech Stack:** Node.js, Express, Prisma/PostgreSQL, Jest/Supertest, React 19, Ant Design, SheetJS/XLSX.

**Spec:** `docs/superpowers/specs/2026-11-09-student-profile-excel-import-design.md`

## Global Constraints

- Follow `TopicRegistration`; do not introduce or restore `group`/`groupMember` architecture.
- Persist every modified text/code file as UTF-8 without BOM.
- Student fields are required: MSSV, full name, gender, date of birth, phone, class, email, major.
- `department` remains lecturer faculty/department; student major is `StudentProfile.major`.
- Do not expose student date of birth or gender in general workflow/public DTOs.
- Student Excel import is all-or-nothing; any invalid row causes zero user/profile writes.
- The reset is authorized only with `SEED_RESET_CONFIRM=RESET_DACN_DEMO` against host `aws-1-ap-southeast-1.pooler.supabase.com`, port `6543`, database `postgres`; it must not execute `prisma/seed.js` or create fixtures.

## Review Focus

- Excel serial dates, malformed dates, and future dates must be rejected or normalized to the required `DD/MM/YYYY` input contract — Task 3.
- An `UPDATE` import must not retain an old academic value when the supplied row omits or invalidates one of the eight required fields — Task 3.
- A `STUDENT` created/edited through the non-Excel admin form cannot commit a `User` without its `StudentProfile` — Task 2.
- Registration, council, score-sheet, and public DTOs must not leak `dateOfBirth` or `gender` when adding class/major projections — Task 5.
- Reset must abort before truncate if the admin identity or expected demo target does not match, and leave the database unchanged — Task 6.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `backend/prisma/schema.prisma` | `StudentGender`, `StudentProfile`, and `User.studentProfile` relation. |
| `backend/prisma/migrations/20261109090000_add_student_profile/migration.sql` | Applies the new enum/table/foreign key. |
| `backend/src/services/studentProfileService.js` | Normalizes and validates complete student payloads; contains no HTTP concern. |
| `backend/src/controllers/userController.js` | Creates/updates users and imports/exports users through student-profile service transactions. |
| `backend/src/utils/excelHelper.js` | Generates canonical five-row student workbook. |
| `frontend/src/components/common/ExcelImportModal.jsx` | Parses, previews, edits, and submits the eight student columns. |
| `frontend/src/pages/admin/UserManagementPage.jsx` | Admin create/edit inputs for student profile fields. |
| `frontend/src/pages/common/ProfilePage.jsx` | Displays student class/major and restricts self-edit to avatar/phone. |
| `backend/scripts/resetDemoKeepAdmin.js` | Explicit no-fixture demo reset command. |
| `backend/scripts/seed/resetApplicationData.js` | Reset allow-list and reusable guarded reset helpers. |

### Task 1: Prisma Student Profile Model and Migration

**Files:**
- Modify: `backend/prisma/schema.prisma:56-116`
- Create: `backend/prisma/migrations/20261109090000_add_student_profile/migration.sql`
- Test: `backend/tests/services/studentProfileService.test.js`

**Interfaces:**
- Produces: `StudentGender` enum (`MALE`, `FEMALE`, `OTHER`) and `prisma.studentProfile` with `studentId`, `gender`, `dateOfBirth`, `className`, `major`.
- Consumed by: Tasks 2–6.

- [ ] **Step 1: Write the failing Prisma/service contract tests**

```js
expect(StudentGender).toEqual(expect.objectContaining({ MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' }));
expect(profile).toMatchObject({ studentId: 7, gender: 'FEMALE', className: 'D20CNTT01', major: 'Kỹ thuật Phần mềm' });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --runTestsByPath tests/services/studentProfileService.test.js`

Expected: FAIL because the model/service does not exist.

- [ ] **Step 3: Add the schema and migration**

Add `StudentGender`; add `StudentProfile` with `studentId Int @id`, `@relation(fields: [studentId], references: [id], onDelete: Cascade)`, `dateOfBirth DateTime @db.Date`, required class/major fields, timestamps, and the reciprocal optional `User.studentProfile` relation. Generate a Prisma migration; do not add student-only columns to `User`.

- [ ] **Step 4: Apply migration to the approved demo DB only after reviewing the generated SQL**

Run: `npx prisma migrate deploy`

Expected: migration applies successfully; no seed command runs.

- [ ] **Step 5: Re-run focused contract test and Prisma validation**

Run: `npm test -- --runTestsByPath tests/services/studentProfileService.test.js && npx prisma validate`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/tests/services/studentProfileService.test.js
git commit -m "feat: add student profile schema"
```

### Task 2: Server-Side Student Payload and Admin CRUD Transactions

**Files:**
- Create: `backend/src/services/studentProfileService.js`
- Modify: `backend/src/controllers/userController.js:160-285`
- Modify: `backend/src/controllers/authController.js:7-240`
- Modify: `backend/src/middlewares/auth.js:37-60,258-280`
- Test: `backend/tests/controllers/userController.test.js`
- Test: `backend/tests/services/studentProfileService.test.js`

**Interfaces:**
- Consumes: `prisma.studentProfile` from Task 1.
- Produces: `normalizeStudentPayload(input)`, `validateStudentPayload(input)`, and transaction-safe student create/update behavior.

- [ ] **Step 1: Write failing validation and rollback tests**

```js
expect(() => validateStudentPayload({ code: 'SV01', fullName: 'A' })).toThrow('Số điện thoại là bắt buộc');
await expect(createStudentWithProfile(tx, validStudent)).resolves.toMatchObject({ user: { code: 'SV01' }, studentProfile: { major: 'Kỹ thuật Phần mềm' } });
```

Add a test proving a profile-create failure leaves no `User` committed.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- --runTestsByPath tests/services/studentProfileService.test.js tests/controllers/userController.test.js`

Expected: FAIL because the helper and transactional paths do not exist.

- [ ] **Step 3: Implement `studentProfileService`**

Implement canonical gender mapping (`Nam` → `MALE`, `Nữ` → `FEMALE`, `Khác` → `OTHER`), strict `DD/MM/YYYY` date parsing, past-date validation, normalized required phone/class/major, email and MSSV normalization. Return normalized `{ user, studentProfile }`; reject unknown gender and every missing/invalid field.

- [ ] **Step 4: Update create/edit/auth flows**

For `role === 'STUDENT'`, require code, full name, email, phone, gender, dateOfBirth, className, and major; create/upsert User plus StudentProfile in one Prisma transaction. Honor the supplied code instead of generating a different one. Include profile data only in authorized self/admin DTOs. `PUT /auth/profile` continues to accept only avatar URL and phone for a student.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --runTestsByPath tests/services/studentProfileService.test.js tests/controllers/userController.test.js tests/middlewares/auth.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/studentProfileService.js backend/src/controllers/userController.js backend/src/controllers/authController.js backend/src/middlewares/auth.js backend/tests
git commit -m "feat: require complete student profiles"
```

### Task 3: Atomic Excel Template, Import, Export, and Error Contract

**Files:**
- Modify: `backend/src/utils/excelHelper.js:39-81`
- Modify: `backend/src/controllers/userController.js:469-644,647-710`
- Modify: `backend/tests/utils/excelHelper.test.js`
- Modify: `backend/tests/controllers/userExcel.test.js`
- Test: `backend/tests/controllers/userExcel.test.js`

**Interfaces:**
- Consumes: `normalizeStudentPayload` and `validateStudentPayload` from Task 2.
- Produces: a five-row student template and all-or-nothing `POST /api/users/import-excel` for `STUDENT`.

- [ ] **Step 1: Write failing workbook and import tests**

```js
expect(parseExcelBuffer(generateStudentTemplateBuffer())).toHaveLength(5);
expect(parsed[0]).toEqual(expect.objectContaining({ 'Giới tính (*)': 'Nam', 'Ngày sinh (*)': '15/08/2004', 'Lớp (*)': 'D20CNTT01', 'Ngành (*)': 'Kỹ thuật Phần mềm' }));
expect(prisma.user.create).not.toHaveBeenCalled(); // when any submitted row is invalid
```

Cover Excel serial date, invalid/future date, invalid gender, blank phone/class/major, duplicate MSSV/email in-file and in DB, and `UPDATE` missing a required value.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- --runTestsByPath tests/utils/excelHelper.test.js tests/controllers/userExcel.test.js`

Expected: FAIL because the old template has two rows and import allows partial success.

- [ ] **Step 3: Implement canonical student workbook and server import**

Generate only the eight headers in the specified order with five fictional examples. Parse every submitted row into the Task 2 payload, accumulate structured errors, and return 400 with all errors before beginning a write transaction if one error exists. On success, create/update each User and StudentProfile atomically in one transaction. Update export to include the same eight student fields.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --runTestsByPath tests/utils/excelHelper.test.js tests/controllers/userExcel.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/excelHelper.js backend/src/controllers/userController.js backend/tests/utils/excelHelper.test.js backend/tests/controllers/userExcel.test.js
git commit -m "feat: enforce complete student excel imports"
```

### Task 4: Admin and Self-Service Student Interfaces

**Files:**
- Modify: `frontend/src/components/common/ExcelImportModal.jsx:51-560,780-850`
- Modify: `frontend/src/pages/admin/UserManagementPage.jsx:760-1070`
- Modify: `frontend/src/pages/common/ProfilePage.jsx:28-317`
- Test: `frontend/tests/studentProfileImport.test.js`
- Test: `frontend/tests/profilePage.test.js`

**Interfaces:**
- Consumes: the Task 3 eight-column request/response contract.
- Produces: admin forms and Excel preview payload containing `gender`, `dateOfBirth`, `className`, and `major`.

- [ ] **Step 1: Write failing UI contract tests**

```js
assert.match(templateHeaders.join('|'), /Giới tính \(\*\).*Ngày sinh \(\*\).*Lớp \(\*\).*Ngành \(\*\)/);
assert.equal(importButton.disabled, true); // a blank required field exists
assert.doesNotMatch(studentSelfProfileEditableFields, /gender|dateOfBirth|className|major/);
```

- [ ] **Step 2: Run focused frontend tests to verify they fail**

Run: `node --test tests/studentProfileImport.test.js tests/profilePage.test.js`

Expected: FAIL because the modal/form has only the old fields.

- [ ] **Step 3: Implement input and preview changes**

Use exactly the Task 3 header labels. Add required student fields to the admin create/edit form and quick-fix modal. Parse dates/gender consistently for preview and submit all eight fields. Display student class/major on ProfilePage as read-only; retain self-edit only for avatar and phone.

- [ ] **Step 4: Run focused frontend tests**

Run: `node --test tests/studentProfileImport.test.js tests/profilePage.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/common/ExcelImportModal.jsx frontend/src/pages/admin/UserManagementPage.jsx frontend/src/pages/common/ProfilePage.jsx frontend/tests
git commit -m "feat: collect complete student details in admin UI"
```

### Task 5: Downstream Student Projections and Privacy

**Files:**
- Modify: `backend/src/controllers/registrationController.js`
- Modify: `backend/src/controllers/topicController.js`
- Modify: `backend/src/controllers/councilController.js`
- Modify: `backend/src/controllers/evaluationController.js`
- Modify: `backend/src/controllers/archiveController.js`
- Modify: `backend/src/services/scoreSheetPdfService.js:30-32`
- Modify: `frontend/src/components/lecturer/OutlineReviewModal.jsx`
- Modify: `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx`
- Test: `backend/tests/controllers/studentProjectionPrivacy.test.js`
- Test: `backend/tests/services/scoreSheetPdfService.test.js`

**Interfaces:**
- Consumes: nested `studentProfile: { className, major }` relation from Task 1.
- Produces: workflow/PDF displays with accurate class/major and no date-of-birth/gender leakage.

- [ ] **Step 1: Write failing projection and privacy tests**

```js
expect(dto.student.studentProfile).toEqual({ className: 'D20CNTT01', major: 'Kỹ thuật Phần mềm' });
expect(JSON.stringify(dto)).not.toMatch(/dateOfBirth|gender/);
expect(pdfTokens.STUDENT_CLASS).toBe('D20CNTT01');
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- --runTestsByPath tests/controllers/studentProjectionPrivacy.test.js tests/services/scoreSheetPdfService.test.js`

Expected: FAIL because projections read nonexistent `student.class`/`student.cohort`.

- [ ] **Step 3: Implement minimal nested projections and UI reads**

Select only `className` and `major` in the listed workflow paths. Replace stale property/fallback accesses with `student.studentProfile` values. Map score-sheet class and major from that relation; never add birth date or gender to these projections.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --runTestsByPath tests/controllers/studentProjectionPrivacy.test.js tests/services/scoreSheetPdfService.test.js && npm run build`

Workdir: `frontend`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers backend/src/services/scoreSheetPdfService.js frontend/src/components/lecturer frontend/src/pages/lecturer frontend/src/pages/admin backend/tests
git commit -m "fix: use student profile projections"
```

### Task 6: Dedicated Demo Reset that Preserves Admin

**Files:**
- Modify: `backend/scripts/seed/resetApplicationData.js`
- Create: `backend/scripts/resetDemoKeepAdmin.js`
- Modify: `backend/package.json`
- Create: `backend/tests/scripts/resetDemoKeepAdmin.test.js`
- Test: `backend/tests/scripts/resetDemoKeepAdmin.test.js`

**Interfaces:**
- Consumes: Task 1 `student_profiles` table and existing `seedPermissionCatalog(tx)`.
- Produces: `npm run db:reset-demo-keep-admin`, which requires `SEED_RESET_CONFIRM=RESET_DACN_DEMO` and never seeds fixtures.

- [ ] **Step 1: Write failing reset-safety tests**

```js
await expect(resetDemoKeepAdmin({ env: {} })).rejects.toThrow('SEED_RESET_CONFIRM');
await expect(resetDemoKeepAdmin({ env: approvedEnv, admin: null })).rejects.toThrow('admin');
expect(seedAcademicFixtures).not.toHaveBeenCalled();
expect(recreatedAdmin.permissionGroupCode).toBe('QUAN_TRI_VIEN');
```

Include a test that `student_profiles` is present in the truncation allow-list and one that verifies reset aborts before truncate for target/admin mismatch.

- [ ] **Step 2: Run focused test to verify it fails**

Run: `npm test -- --runTestsByPath tests/scripts/resetDemoKeepAdmin.test.js`

Expected: FAIL because no dedicated command exists.

- [ ] **Step 3: Implement guarded snapshot/truncate/recreate command**

Extend the allow-list with `student_profiles`. Implement a reusable reset flow that checks confirmation, parsed target host/port/database against the three global-constraint values, external dependents, and exactly one active `admin@university.edu.vn`/`ADMIN001`; snapshots scalar identity and hash; truncates; invokes only `seedPermissionCatalog`; recreates that admin and exactly one `QUAN_TRI_VIEN` membership in one transaction. Add the clearly named package script. Do not modify or invoke `prisma/seed.js`.

- [ ] **Step 4: Run focused test and DB preflight**

Run: `npm test -- --runTestsByPath tests/scripts/resetDemoKeepAdmin.test.js`

Run: `SEED_RESET_CONFIRM=RESET_DACN_DEMO npm run db:reset-demo-keep-admin`

Expected: test PASS; command reports one retained admin, no fixture creation, and successful post-reset checks.

- [ ] **Step 5: Verify post-reset database state read-only**

Run a script/query that verifies: one active admin with `ADMIN001`; one `QUAN_TRI_VIEN` membership; required admin permissions; zero `StudentProfile`, non-admin user, academic, CMS, notification, and audit records.

Expected: all assertions PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/seed/resetApplicationData.js backend/scripts/resetDemoKeepAdmin.js backend/package.json backend/tests/scripts/resetDemoKeepAdmin.test.js
git commit -m "feat: reset demo while retaining admin"
```

### Task 7: Full Verification and Operator Handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-11-09-student-profile-excel-import-design.md` only if behavior changed during implementation
- Test: existing backend and frontend suites

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: recorded evidence that the empty demo database and the import contract work end-to-end.

- [ ] **Step 1: Run backend suite**

Run: `npm test`

Workdir: `backend`

Expected: PASS.

- [ ] **Step 2: Run frontend unit tests and production build**

Run: `npm test && npm run build`

Workdir: `frontend`

Expected: PASS.

- [ ] **Step 3: Perform manual admin UAT without leaving test data**

First verify the reset database contains no student records. Log in as retained admin, download the five-row template, verify a deliberately invalid file creates no records, then import a valid file and confirm the student profile, class/major displays, and privacy boundaries. Remove the designated UAT student through the approved admin UI or controlled test cleanup, then verify the database again contains zero student records.

Expected: all eight fields persist; profile self-edit cannot alter academic identity; general workflow views omit gender/date of birth.

- [ ] **Step 4: Check UTF-8/no-BOM and worktree state**

Run a repository encoding check for changed text files, then `git diff --check` and `git status --short`.

Expected: no BOM, no whitespace errors, and only intentional changes.

- [ ] **Step 5: Confirm no unintended post-verification edits remain**

Run: `git status --short`

Expected: no uncommitted changes from verification; any behavior change discovered during UAT must return to design review before implementation resumes.
