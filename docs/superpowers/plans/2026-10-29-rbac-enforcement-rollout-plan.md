# Kế hoạch triển khai P1: Thực thi RBAC Matrix

- **Ngày lập:** 29/10/2026
- **Thiết kế đã duyệt:** `docs/superpowers/specs/2026-10-29-rbac-enforcement-rollout-design.md`
- **Nguyên tắc:** CSDL/catalog → middleware/backend route → resource/ownership guard → frontend → verification.
- **Phương pháp:** TDD, rollout theo capability; không thay toàn bộ role guard trong một lần.

## Điều kiện đầu vào

- P0 đã hoàn tất và migration `20261029090000_harden_permission_matrix` đã được áp dụng.
- Backend hiện đạt 31 suites/209 tests; frontend đạt 9 tests và production build PASS.
- Live DB có 2/2 Admin thuộc `QUAN_TRI_VIEN`, 12/12 Lecturer thuộc `GVHD`, một Lecturer có thêm `VIEN_TRUONG`.
- Worktree có nhiều thay đổi ngoài P1; tuyệt đối không reset hoặc stage file ngoài phạm vi.

## Task 1 — Chuẩn hóa permission constants và mở rộng catalog

### File

- Tạo `backend/src/constants/permissions.js`.
- Sửa `backend/src/services/permissionService.js` để import catalog/constants.
- Tạo migration `backend/prisma/migrations/20261029110000_add_rbac_enforcement_permissions/migration.sql`.
- Tạo `backend/tests/services/permissionCatalog.test.js`.

### RED

Viết test trước để khóa các invariant:

1. Permission code không trùng.
2. Mọi code trong default groups tồn tại trong catalog.
3. Catalog có `RUBRIC_MANAGE`, `NOTIFICATION_MANAGE`, `LEGACY_REVIEW_MANAGE`, `FINAL_DOCUMENT_REVIEW`.
4. Mapping mặc định:
   - `QUAN_TRI_VIEN`: rubric, notification, legacy;
   - `GVHD`: final document review;
   - `VIEN_TRUONG`: rubric và final document review.

Chạy:

```powershell
cd backend
npm test -- --runTestsByPath tests/services/permissionCatalog.test.js --silent
```

### GREEN

- Di chuyển `PERMISSION_CATALOG` sang module không phụ thuộc Prisma.
- Export hằng `PERMISSIONS` để route không dùng string rời rạc.
- Giữ `DEFAULT_GROUPS` là nguồn mapping mặc định duy nhất.
- Migration dùng upsert và `ON CONFLICT DO NOTHING`; không xóa mapping hiện có.

### REFACTOR/VERIFY

- Không tạo catalog thứ hai ở frontend.
- Chạy focused test và `npx prisma validate`.

## Task 2 — Capability middleware và metadata kiểm thử

### File

- Sửa `backend/src/middlewares/auth.js`.
- Sửa `backend/tests/middlewares/auth.test.js`.
- Tạo `backend/src/security/permissionPolicy.js` nếu logic assert resource cần tách riêng.

### RED

Thêm unit test:

1. `authorizePermission(A, B)` cho phép khi user có ít nhất một code.
2. `authorizeAllPermissions(A, B)` chỉ cho phép khi có đủ cả hai.
3. Admin thiếu permission nhận `403`.
4. Middleware trả `401` khi thiếu `req.user`.
5. Permission không có trong catalog làm test integrity thất bại.
6. Middleware gắn metadata policy để coverage test nhận diện route đã bảo vệ.

### GREEN

- Giữ `authorizePermission` với ngữ nghĩa any-of để không phá BM02/P0.
- Bổ sung `authorizeAllPermissions`.
- Bổ sung helper `assertPermission(user, code)` cho resource-aware controller/service; helper ném lỗi `403` nhất quán.
- Không thêm role `ADMIN` bypass.

### VERIFY

```powershell
npm test -- --runTestsByPath tests/middlewares/auth.test.js --silent
```

## Task 3 — Route authorization coverage

### File

- Tạo `backend/tests/security/routeAuthorizationCoverage.test.js`.
- Tạo `backend/src/security/authorizationExemptions.js`.

### RED

Coverage test phải phát hiện:

- staff endpoint chỉ có `authenticate` nhưng không capability guard;
- endpoint dùng `authorize('ADMIN')` làm lớp cho phép duy nhất;
- policy tham chiếu permission không tồn tại;
- exemption không khai báo method + path cụ thể.

### GREEN

- Khai báo whitelist tối thiểu đã duyệt: health, auth self-service, public reads, student self-service, notification cá nhân và upload authenticated.
- Dùng metadata từ capability middleware để test route stack.
- Exemption phải có lý do ngắn và loại `PUBLIC`, `SELF_SERVICE` hoặc `OWNERSHIP_GUARDED`.

### VERIFY

Test coverage ban đầu được phép liệt kê các route chưa chuyển như failure có kiểm soát theo từng lát; không được tắt test bằng wildcard exemption.

## Task 4 — Lát 1 backend: quản trị nền tảng

### File chính

- `backend/src/routes/announcementRoutes.js`
- `backend/src/routes/userRoutes.js`
- `backend/src/routes/semesterRoutes.js`
- `backend/src/routes/projectEnrollmentRoutes.js`
- `backend/src/routes/dashboardRoutes.js`
- `backend/src/routes/notificationRoutes.js`
- `backend/src/routes/rubricRoutes.js`
- `backend/src/routes/manualReviewRoutes.js`
- `backend/src/routes/permissionRoutes.js`
- Các integration test tương ứng và test mới `backend/tests/integration/platformAuthorization.routes.test.js`.

### RED

Tạo ma trận `401/403/200` cho từng capability:

- `PUBLIC_ANNOUNCEMENT_MANAGE`
- `USER_MANAGE`
- `USER_IMPORT`
- `PERMISSION_GROUP_MANAGE`
- `SEMESTER_MANAGE`
- `PROJECT_ASSIGNMENT_PUBLISH`
- `PROJECT_CATALOG_MANAGE`
- `ENROLLMENT_MANAGE`
- `REPORT_VIEW`
- `NOTIFICATION_MANAGE`
- `RUBRIC_MANAGE`
- `LEGACY_REVIEW_MANAGE`

Ít nhất một test phải chứng minh Admin đúng role nhưng thiếu capability nhận `403`.

### GREEN

- Thay role guard bằng capability guard theo bảng trong spec.
- `GET/PUT user/:id/permissions` và gán group yêu cầu `PERMISSION_GROUP_MANAGE`, không chỉ `USER_MANAGE`.
- Route ban hành quyết định không còn `authorizeRoleOrPermission(['ADMIN'], ...)`; chỉ dùng `PROJECT_ASSIGNMENT_PUBLISH`.
- Dashboard báo cáo dùng `REPORT_VIEW`; audit log vẫn dùng `AUDIT_LOG_VIEW`.

### VERIFY CHECKPOINT 1

```powershell
npm test -- --runTestsByPath tests/integration/platformAuthorization.routes.test.js tests/integration/permissionMatrix.routes.test.js tests/integration/semesters.routes.test.js tests/integration/rubricRoutes.test.js tests/integration/manualReview.routes.test.js --silent
npm test -- --silent
```

Không chuyển Task 5 nếu slice 1 chưa xanh.

## Task 5 — Lát 1 frontend alignment

### File

- `frontend/src/components/common/ProtectedRoute.jsx`
- `frontend/src/components/layout/AppLayout.jsx`
- Các trang Admin liên quan user, semester, enrollment, notification, rubric, legacy.
- `frontend/tests/rbacUiContracts.test.js`.

### RED/GREEN

- Test Admin không có capability không thấy menu/nút tương ứng.
- Không dùng `role === 'ADMIN'` như điều kiện đủ.
- Route frontend dùng permission phù hợp với backend.
- Không redirect toàn cục cho `403` ownership.

### VERIFY

```powershell
cd frontend
npm test
npm run build
```

## Task 6 — Lát 2 backend: học vụ và hướng dẫn

### File chính

- `backend/src/routes/topicRoutes.js`
- `backend/src/routes/registrationRoutes.js`
- `backend/src/routes/evaluationRoutes.js`
- `backend/src/routes/taskRoutes.js`
- `backend/src/routes/meetingLogRoutes.js`
- Controller/service ownership liên quan, chỉ khi route guard không đủ.
- Tạo `backend/tests/integration/academicAuthorization.routes.test.js` và cập nhật test hiện hữu.

### RED

Test các cặp capability/ownership:

- `TOPIC_CREATE`, `TOPIC_UPDATE_OWN`, `TOPIC_REVIEW`;
- `MENTOR_REQUEST_REVIEW`, `MENTOR_ASSIGN`, `MENTOR_ASSIGNMENT_ADJUST`;
- `OUTLINE_REVIEW`, `OUTLINE_APPROVE`;
- `BM02_REVIEW`;
- `BM03_SUBMIT`, `BM03_REVIEW`, `BM03_CHECKPOINT_DECIDE`;
- `BM04_SUBMIT`, `BM04_REVIEW`.

Phải có test “có capability nhưng sai mentor/registration → `403`”.

### GREEN

- Thay role guard nhân sự bằng capability guard.
- Giữ route sinh viên dùng role + ownership.
- Generic task suy ra capability từ `taskType` trước mutation.
- Registration list cho GVHD vẫn scope theo mentor; `REPORT_VIEW` mới cho phép giám sát toàn hệ thống.
- BM04 read cho sinh viên giữ role + ownership, staff cần `BM04_REVIEW`.

### VERIFY CHECKPOINT 2

```powershell
cd backend
npm test -- --runTestsByPath tests/integration/academicAuthorization.routes.test.js tests/integration/bm01.routes.test.js tests/integration/meetingLogs.routes.test.js tests/integration/registrations.routes.test.js tests/integration/topics.routes.test.js --silent
npm test -- --silent
```

## Task 7 — Lát 2 frontend alignment

### File

- Lecturer route/menu/dashboard/progress/topic pages.
- Các action BM01–BM04 và task/meeting log.
- Mở rộng `frontend/tests/rbacUiContracts.test.js`.

### Yêu cầu

- Button/action chỉ hiển thị khi có capability và workflow `allowedActions[]` cho phép.
- UI không tự thay ownership guard.
- Sinh viên không cần permission group để dùng self-service.

### VERIFY

Chạy frontend test và build trước checkpoint 3.

## Task 8 — Lát 3 backend: hội đồng, điểm và lưu chiểu

### File chính

- `backend/src/routes/councilRoutes.js`
- `backend/src/routes/evaluationRoutes.js`
- `backend/src/routes/archiveRoutes.js`
- `backend/src/controllers/councilController.js`
- Các service scoring/archive hiện hữu.
- Tạo `backend/tests/integration/defenseAuthorization.routes.test.js` và mở rộng archive tests.

### RED

Test:

1. `OUTLINE_COUNCIL_MANAGE` không mutate Hội đồng bảo vệ.
2. `DEFENSE_COUNCIL_MANAGE` không mutate Hội đồng đề cương.
3. `DEFENSE_SCORE_VIEW` không ghi score sheet.
4. `DEFENSE_SCORE_SUBMIT` còn yêu cầu membership.
5. `RESULT_LOCK` không tự cấp `RESULT_PUBLISH`.
6. `FINAL_DOCUMENT_REVIEW` còn yêu cầu phạm vi mentor/viện.

### GREEN

- Bỏ global `authorize('ADMIN')` ở council routes.
- Create suy ra permission từ `councilType` đã validate.
- Read/update/delete/assign đọc council trước rồi assert permission theo loại.
- Score routes tách rõ view, submit, lock và publish.
- Archive self-service giữ `STUDENT` + ownership; staff review dùng `FINAL_DOCUMENT_REVIEW`.

### VERIFY CHECKPOINT 3

```powershell
cd backend
npm test -- --runTestsByPath tests/integration/defenseAuthorization.routes.test.js tests/integration/archive.routes.test.js --silent
npm test -- --silent
```

## Task 9 — Lát 3 frontend alignment

### File

- `frontend/src/pages/admin/CouncilAssignmentPage.jsx`
- `frontend/src/pages/admin/GradingDefensePage.jsx`
- `frontend/src/pages/admin/ProjectOversightPage.jsx`
- Lecturer grading/archive actions và route/menu liên quan.
- Mở rộng frontend contract tests.

### Yêu cầu

- Tách capability xem/chấm/khóa/công bố.
- UI Hội đồng đề cương và Hội đồng bảo vệ dùng đúng capability.
- Ẩn action lưu chiểu khi thiếu `FINAL_DOCUMENT_REVIEW`.

## Task 10 — Nghiệm thu toàn hệ thống và deploy migration

### Kiểm tra tĩnh

```powershell
cd D:\DACN\backend
npx prisma validate
npm test -- --silent
npm run db:status

cd D:\DACN\frontend
npm test
npm run build
```

### Database

1. Chỉ deploy migration additive sau khi mọi test xanh.
2. Chạy `npm run db:deploy`.
3. Query read-only xác minh bốn permission mới và mapping mặc định.
4. Chạy lại `npm run db:status`; kết quả phải `up to date`.

### Smoke test bắt buộc

- Admin `QUAN_TRI_VIEN`: truy cập đúng lát 1, không tự có quyền học thuật ngoài matrix.
- Lecturer `GVHD`: chỉ thao tác sinh viên mình hướng dẫn.
- Lecturer `VIEN_TRUONG`: BM02, quyết định, rubric và quyền Viện đúng mapping.
- Student: self-service không bị mất quyền và không xem dữ liệu người khác.
- Thay đổi một permission trong matrix; request kế tiếp phải phản ánh thay đổi.

### Hoàn tất

- Chạy `git diff --check` trên file P1.
- Xác minh UTF-8 no BOM.
- Không commit file ngoài phạm vi hoặc thay đổi sẵn có của người dùng.
- Cập nhật `CLAUDE.md` chỉ khi người dùng nói `end phiên`.

## Thứ tự commit đề xuất

1. `test: define RBAC catalog and middleware invariants`
2. `feat: add capability policy primitives`
3. `feat: enforce platform administration capabilities`
4. `feat: enforce academic workflow capabilities`
5. `feat: enforce defense and archive capabilities`
6. `feat: align frontend navigation with RBAC capabilities`
7. `test: complete RBAC enforcement regression coverage`

Không bắt buộc commit theo từng bước nếu người dùng không yêu cầu; danh sách này chỉ xác định ranh giới thay đổi để review.
