# Student Profile, Excel Import, and Demo Reset Design

**Date:** 2026-11-09

## Intent

Standardize the required academic identity of every student and make Excel import the authoritative way to create complete student records. The demo database will be cleared of all seeded academic data without reseeding it; exactly one existing administrator remains able to manage the empty system.

## Goals

- Require these eight fields for every student: MSSV, full name, gender, date of birth, phone number, class, email, and major.
- Store student-only data separately from shared user and lecturer data.
- Make the downloaded student Excel template contain five example rows and all required headers.
- Reject an entire Excel import when any row is invalid.
- Reset the approved Supabase demo database to an empty academic state while preserving one working admin account and its minimal authorization setup.

## Non-goals

- Do not seed students, lecturers, semesters, topics, registrations, scores, CMS records, or other demo fixtures after the reset.
- Do not change the lecturer `department`/faculty data model.
- Do not expose student gender or date of birth in general workflow, council, topic, grading, or public endpoints.

## Chosen Approach

Add a one-to-one `StudentProfile` record for each student instead of adding student-only columns to `User`.

`User` remains the shared account identity: `code`, `fullName`, `email`, `phone`, role, account status, and avatar. `StudentProfile` is required by every student create/update/import transaction and owns the fields that do not apply to lecturers. This avoids overloading `User.department`, which remains the lecturer's faculty/department value.

## Data Model

Add a `StudentGender` enum with `MALE`, `FEMALE`, and `OTHER`.

Add `StudentProfile` with a one-to-one primary-key relation to `User`:

| Field | Type | Rule |
| --- | --- | --- |
| `studentId` | integer PK/FK to `User.id` | one profile per student; cascade on user deletion |
| `gender` | `StudentGender` | required |
| `dateOfBirth` | date | required; valid past calendar date |
| `className` | string | required |
| `major` | string | required |
| timestamps | datetime | standard audit timestamps |

For a `STUDENT`, `User.phone` is required at every create, update, and import boundary. The application creates or updates `User` and `StudentProfile` in a single transaction, so it never commits an incomplete student account.

## API and UI Contract

- Admin user creation and editing must collect and validate all eight student fields when role is `STUDENT`.
- `GET` user and student-facing profile DTOs include the student's profile where authorization permits it.
- A student can update only avatar and phone on their self-service profile. Academic identity fields are admin-managed.
- General workflow DTOs use a narrow nested projection with only `className` and `major` where required. They do not return date of birth or gender.
- Existing screens and score-sheet PDF generation that currently read nonexistent `student.class`, `student.course`, or `student.cohort` must read `student.studentProfile.className` and `student.studentProfile.major` instead.

## Excel Contract

The student template has exactly these canonical columns, in this order:

1. `MSSV (*)`
2. `Họ và tên (*)`
3. `Giới tính (*)`
4. `Ngày sinh (*)`
5. `Số điện thoại (*)`
6. `Lớp (*)`
7. `Email (*)`
8. `Ngành (*)`

The downloadable template has five illustrative rows. The rows are examples only; they contain fictional data and do not create records by themselves.

Rules:

- Date of birth is entered as `DD/MM/YYYY` and is normalized by the backend.
- Gender accepts the display values `Nam`, `Nữ`, or `Khác`, then normalizes to the enum.
- Phone, class, and major are mandatory non-blank strings with server-side length/format validation.
- MSSV and email are normalized, validated, and must be unique both inside the file and against the database.
- The browser may pre-validate and show row errors, but the server is the source of truth.
- Import is all-or-nothing: a file containing any missing, malformed, duplicate, or otherwise invalid row produces no database writes. The response identifies every faulty row.
- Duplicate mode `UPDATE` still requires all eight fields and updates the user/profile atomically; it does not silently retain omitted academic fields.
- Export and the error-row spreadsheet use the same explicit student fields.

## Demo Reset

The reset is a dedicated command, not `prisma/seed.js`; the current seed entrypoint must not be called because it always recreates demo fixtures.

The command executes one transaction:

1. Require `SEED_RESET_CONFIRM=RESET_DACN_DEMO`, verify the approved demo database target, and preflight external foreign-key dependents.
2. Find exactly one active admin: `admin@university.edu.vn` / `ADMIN001`; abort on absence, inactivity, or ambiguity.
3. Snapshot its scalar identity and password hash in memory.
4. Truncate every application table, including the new `student_profiles` table, with identity restart and cascade.
5. Restore only the permission catalog and `QUAN_TRI_VIEN` group.
6. Recreate the snapshot admin and one group membership for `QUAN_TRI_VIEN`.
7. Commit with no fixture or academic seed call.

Afterward, there is exactly one active admin, no student profiles, no other users, and no academic/CMS/audit/demo records.

## Error Handling and Verification

- Validate all requested fields before the import transaction begins and return structured row errors with row number, MSSV when available, and message.
- Roll back user/profile creation or update if either side fails.
- Reject invalid date, future date, unrecognized gender, missing field, duplicate MSSV/email, malformed email, and invalid phone/class/major input.
- Test the generated workbook's headers and exactly five example rows.
- Test that valid import creates matching `User`/`StudentProfile` records and any invalid row causes no persistence.
- Test profile update permissions and ensure workflow DTOs do not leak date of birth or gender.
- Test reset preconditions, admin snapshot/recreation, required permissions (`USER_MANAGE`, `USER_IMPORT`, `PERMISSION_GROUP_MANAGE`), zero remaining application data, and zero reseeded fixtures.

## Files Expected to Change

- Prisma schema and a migration for `StudentGender` and `StudentProfile`.
- User/auth controllers and authorization DTO projections.
- Excel helper, Excel import/export controller logic, and import modal.
- Admin user-management form, personal profile page, student workflow displays, and score-sheet PDF projection.
- Dedicated demo-reset command, reset-table allow-list, package script, and tests.
- Demo account/fixture generation only as needed to remove the assumption that a seed is run; no new data is generated.
