# Lecturer Student Guidance Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay nút “Hồ sơ” của GVHD bằng trang quá trình hướng dẫn, nơi thấy việc cần làm và quản lý BM theo trạng thái dữ liệu thật.

**Architecture:** `TopicRegistration` là trục. Sửa dữ liệu hồ sơ sinh viên và bảo vệ `GET /api/registrations/:id` trước, sau đó bổ sung bản tóm tắt BM từ các bản ghi nghiệp vụ. Trang React mới lấy chi tiết theo ID trên URL; các thao tác đưa tới luồng sẵn có, còn bản A4 chỉ mở theo yêu cầu.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5/Jest, React 19/React Router 7/TanStack Query/Ant Design 6, Node test/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-lecturer-student-guidance-workspace-design.md`

## Global Constraints

- `TopicRegistration` là trục; 1 SV/1 đề tài, tối đa 10 SV/GVHD; không dùng `group/groupMember`.
- Thứ tự sửa: CSDL/Prisma → backend → frontend. Không lấy thông tin từ mock khi API thật có dữ liệu.
- `academicYear` (“Khóa đào tạo”) và `placeOfBirth` là nullable; bản ghi cũ giữ null, không suy từ học kỳ hoặc năm hiện tại.
- Backend kiểm capability và quyền trên **đúng registration**; không để lộ điểm/nhận xét BM05 trước công bố.
- Giữ `AcademicDossierDrawer` tại các màn quản trị/hội đồng; không sửa nội dung các mẫu in A4.
- File `.md`, `.js`, `.jsx`, `.json`, `.prisma`, `.yml` là UTF-8 không BOM. Button dùng `@ant-design/icons` qua prop `icon`, nhãn tiếng Việt không có ký tự icon thô.
- Chỉ chạy migration trên DB thử nghiệm; workspace đang có thay đổi khác, mỗi commit chỉ stage tệp thuộc task của mình.

## Review Focus

1. `GET /api/registrations/:id` với ID của GVHD khác phải trả 403 dù actor có `VIEW_MENTORED_STUDENTS` (Task 2).
2. `StudentProfile` cũ không có khóa/nơi sinh vẫn đọc, sửa và in được với giá trị trống (Task 1).
3. Một registration chưa có BM02/BM03/BM04/BM05 không sinh bản in trắng hoặc trạng thái “đã xong” (Task 3 và 4).
4. BM02-A vắng khi chưa từng có yêu cầu; khi có nhiều yêu cầu, trạng thái mới nhất và lối xem lịch sử phải đúng (Task 3 và 4).
5. BM05 chưa công bố không xuất hiện điểm, nhận xét hoặc bản in qua API và trang GVHD (Task 2 và 4).

---

## File map

| Unit | Tệp chính | Trách nhiệm |
|---|---|---|
| Student profile | `backend/prisma/schema.prisma`, migration mới, `backend/src/services/studentProfileService.js`, `backend/src/controllers/userController.js`, `frontend/src/pages/admin/UserManagementPage.jsx` | Lưu/nhập/sửa khóa và nơi sinh |
| Registration detail | `backend/src/controllers/registrationController.js`, `backend/src/routes/registrationRoutes.js` | Kiểm quyền theo bản ghi; trả chi tiết không rò BM05 |
| BM overview | `backend/src/services/guidanceWorkspaceService.js` | Chuẩn hóa trạng thái, thời điểm và hành động của từng BM từ nguồn thật |
| Lecturer page | `frontend/src/pages/lecturer/LecturerStudentGuidancePage.jsx`, `frontend/src/components/lecturer/GuidanceFormList.jsx`, `frontend/src/queries/registrationQueries.js`, `frontend/src/App.jsx` | Hiển thị quá trình, việc cần làm, biểu mẫu |
| Entry points | `frontend/src/components/lecturer/SupervisedStudentList.jsx`, `frontend/src/pages/lecturer/LecturerStudentsPage.jsx`, `frontend/src/pages/lecturer/LecturerDashboardPage.jsx` | Điều hướng tới trang mới |

### Task 1: Bổ sung dữ liệu khóa đào tạo và nơi sinh

**Files:** Modify `backend/prisma/schema.prisma`, `backend/src/services/studentProfileService.js`, `backend/src/controllers/userController.js`, `frontend/src/pages/admin/UserManagementPage.jsx`; create `backend/prisma/migrations/20261119223000_student_profile_cohort_birthplace/migration.sql`; test `backend/tests/controllers/userController.test.js`, `backend/tests/controllers/userExcel.test.js`; create `frontend/tests/studentProfileFields.test.js`.

**Interfaces:** `StudentProfile.academicYear String?`, `StudentProfile.placeOfBirth String?`; `normalizeStudentPayload(input).studentProfile` trả hai trường `string | null`. API create/update/import user giữ giá trị tùy chọn, response trả lại hai trường.

- [ ] **Step 1: Viết test thất bại.** Trong `userController.test.js` và `userExcel.test.js`, tạo/cập nhật/import SV có khóa và nơi sinh phải lưu đúng; SV cũ hoặc ô Excel trống giữ null, import không xóa giá trị có sẵn khi cột không được cung cấp. Test form Admin nạp và gửi lại hai trường, không coi chúng là bắt buộc.
- [ ] **Step 2: Chạy focused tests để xác nhận FAIL.** `npm --prefix backend test -- --runTestsByPath tests/controllers/userController.test.js tests/controllers/userExcel.test.js`; `npm --prefix frontend test -- tests/studentProfileFields.test.js`. Kỳ vọng fail ở hai trường chưa được map.
- [ ] **Step 3: Thực hiện.** Thêm hai cột nullable bằng migration; chuẩn hóa chuỗi rỗng thành null trong `normalizeStudentPayload(input)`; cập nhật create/update/import, select, Excel template/map và hai trường tùy chọn trong form Admin. Không thay đổi validation các trường sinh viên bắt buộc hiện có.
- [ ] **Step 4: Xác thực.** Chạy lại focused tests; `npm --prefix backend exec prisma validate`; chạy migration trên DB thử nghiệm rồi kiểm bản ghi cũ có hai giá trị null; kiểm UTF-8/BOM tệp mới.
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "feat: store student cohort and birthplace"`.

### Task 2: Bảo vệ và sửa API chi tiết registration

**Files:** Modify `backend/src/controllers/registrationController.js`, `backend/src/routes/registrationRoutes.js`; test `backend/tests/controllers/registrationController.test.js`, `backend/tests/integration/registrations.routes.test.js`.

**Interfaces:** Giữ `GET /api/registrations/:id` và shape `{ success: true, data: registration }`. Trước khi trả dữ liệu, xác định actor có quyền theo `studentId`, `topic.mentorId`/GVHD thực tế của registration hoặc scope chức vụ hiện hành; trả 403 ngoài scope, 404 khi không có ID. Hai field profile mới được select hợp lệ. Với người không có quyền xem kết quả chưa công bố, loại/ẩn `defenseResult`, `memberScores`, `finalScore`, `comments` và mọi trường lồng tương đương trước response.

- [ ] **Step 1: Viết test thất bại.** Test ID không tồn tại → 404; GVHD sở hữu → 200; GVHD khác dù cùng capability → 403; SV khác → 403; actor chức vụ hợp lệ/ngoài scope; BM05 chưa công bố không có điểm/nhận xét trong JSON, đã công bố có dữ liệu theo quyền. Dùng registration thật trong fixture của test thay vì chỉ giả lập role.
- [ ] **Step 2: Chạy focused tests để xác nhận FAIL.** `npm --prefix backend test -- --runTestsByPath tests/controllers/registrationController.test.js tests/integration/registrations.routes.test.js`.
- [ ] **Step 3: Thực hiện.** Sửa Prisma select, thêm kiểm quyền đối tượng và lọc response ở controller/service hiện có; kiểm scope của chức vụ theo cơ chế RBAC đang dùng, không mặc định mọi lecturer được đọc mọi registration. Giữ route capability check làm lớp đầu.
- [ ] **Step 4: Chạy lại focused tests; xác nhận PASS** và response JSON không có điểm BM05 trước công bố.
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "fix: scope registration detail to authorized actor"`.

### Task 3: Tạo tóm tắt biểu mẫu từ dữ liệu nghiệp vụ

**Files:** Create `backend/src/services/guidanceWorkspaceService.js`, `backend/tests/services/guidanceWorkspaceService.test.js`; modify `backend/src/controllers/registrationController.js` và focused test của Task 2.

**Interfaces:** `buildGuidanceWorkspace(registration, actor): { nextAction: { code, label, params } | null, forms: Array<{ code, title, status, updatedAt, nextActor, actions: Array<{ code, params }> }> }`. `forms` có BM01, BM02, BM03, BM04, BM05 theo thứ tự; chèn BM02-A sau BM02 chỉ khi có yêu cầu. Mã action ổn định gồm `VIEW`, `VIEW_PRINT`, `REVIEW`, `OPEN_PROGRESS`; `params` mang `registrationId` và `requestId` khi cần. Server chỉ cấp mutation khi actor có quyền nghiệp vụ. Controller thêm `data.guidanceWorkspace`; không thay response field cũ.

- [ ] **Step 1: Viết test thất bại.** Ma trận từng BM ở trạng thái chưa có/đang xử lý/đã ký hoặc công bố; BM02-A không có và nhiều phiên bản; `updatedAt` chỉ từ record thật; `nextAction` null khi không có việc; BM05 chưa công bố không có `VIEW_PRINT` hoặc dữ liệu điểm. Mỗi trạng thái được kiểm bằng text/code, không dùng màu làm nguồn sự thật.
- [ ] **Step 2: Chạy test để xác nhận FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/guidanceWorkspaceService.test.js`.
- [ ] **Step 3: Thực hiện.** Query các quan hệ cần cho BM overview trong `GET /api/registrations/:id` bằng select giới hạn; tính summary trong service từ task/submission, BM02, BM02-A, nhật ký/checkpoint/BM03, BM04 và kết quả bảo vệ. Dùng `allowedActions` hiện có khi cấp action. Không suy diễn hoàn thành từ khả năng render `PrintSheet`.
- [ ] **Step 4: Chạy lại focused tests và Task 2 tests; xác nhận PASS** cho cả quyền/scope và dữ liệu BM.
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "feat: summarize guidance forms from real records"`.

### Task 4: Trang quá trình hướng dẫn

**Files:** Create `frontend/src/pages/lecturer/LecturerStudentGuidancePage.jsx`, `frontend/src/components/lecturer/GuidanceFormList.jsx`, `frontend/tests/lecturerStudentGuidance.test.js`; modify `frontend/src/queries/registrationQueries.js`, `frontend/src/App.jsx`.

**Interfaces:** `useRegistrationDetail(scope, registrationId, enabled = true)` dùng `queryKeys.registrations.detail(scope, registrationId)` và `registrationService.getRegistrationById(id)`, trả `response.data`. Route `/lecturer/students/:registrationId` dùng cùng guard của `/lecturer/students`. `GuidanceFormList({ forms, onAction })` chỉ render summary và nút được cấp từ `guidanceWorkspace.forms`.

- [ ] **Step 1: Viết test thất bại.** ID hợp lệ hiển thị header SV/đề tài/trạng thái, việc cần làm và thứ tự BM; thiếu trường profile hiển thị “Chưa cập nhật”; BM02-A vắng; BM chưa phát sinh không có sheet A4; BM05 trước công bố không thấy điểm; loading/403/404/lỗi mạng có thông báo và retry. Test phím Tab, nhãn nút và mobile 375px ở mức component/browser phù hợp.
- [ ] **Step 2: Chạy focused frontend tests để xác nhận FAIL.** `npm --prefix frontend test -- tests/lecturerStudentGuidance.test.js` (tạo đúng tệp này trong Step 1).
- [ ] **Step 3: Thực hiện.** Tạo query và trang với header, việc cần làm, quá trình hướng dẫn, danh mục BM, thông tin SV; phần A4 chỉ mount khi chọn `VIEW_PRINT`. Dùng Ant Design/Tailwind hiện có, trạng thái chữ và active rõ; không có dữ liệu giả hoặc nút nghiệp vụ tự suy theo role.
- [ ] **Step 4: Chạy lại focused test và `npm --prefix frontend run build`; xác nhận PASS.** Kiểm 375px và desktop, thao tác bàn phím, focus và lỗi mạng.
- [ ] **Step 5: Commit đúng tệp Task 4.** `git commit -m "feat: add lecturer student guidance page"`.

### Task 5: Kết nối entry points và hành động BM

**Files:** Modify `frontend/src/components/lecturer/SupervisedStudentList.jsx`, `frontend/src/pages/lecturer/LecturerStudentsPage.jsx`, `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`, `frontend/src/pages/lecturer/LecturerStudentGuidancePage.jsx`, `frontend/src/pages/__tests__/academicDossierDrawer.test.js`; create `frontend/tests/lecturerStudentGuidanceNavigation.test.js`.

**Interfaces:** `onOpenDossier(student)` được thay bằng `onOpenGuidance(student)` tại cả danh sách và dashboard, điều hướng `/lecturer/students/${registrationId}`. `onAction` của BM map `{ code, params }` được server cấp tới route sẵn có: BM01 `/lecturer/approvals?registrationId=...`, BM02-A `/lecturer/title-adjustments?requestId=...`, BM03/BM04 `/lecturer/progress?registrationId=...`; BM02 chỉ xem/in ở trang chi tiết trừ khi backend có action duyệt GVHD hợp lệ. Xem/in dùng sheet/PDF hiện có và điều kiện backend. Route đích nào chưa nhận ID phải được bổ sung chọn đúng registration, không đưa GVHD tới một danh sách không lọc mà mất ngữ cảnh.

- [ ] **Step 1: Viết test thất bại.** Nút “Xem quá trình” từ bảng, thẻ và dashboard mở đúng ID; quay lại giữ đợt/danh sách; mỗi action BM dẫn đúng SV/yêu cầu; `VIEW_PRINT` chỉ mở BM đã có dữ liệu; test drawer cũ vẫn hiện ở màn admin/hội đồng nhưng không còn là điều kiện cho dashboard GVHD.
- [ ] **Step 2: Chạy focused tests để xác nhận FAIL.** `npm --prefix frontend test -- tests/lecturerStudentGuidanceNavigation.test.js src/pages/__tests__/academicDossierDrawer.test.js`.
- [ ] **Step 3: Thực hiện.** Thay entry points, nối action từng BM, giữ khả năng in lẻ và lối in toàn bộ trong vùng tài liệu khi đủ điều kiện. Cập nhật test cũ để phản ánh luồng mới, không xóa kiểm tra drawer còn dùng ở nơi khác.
- [ ] **Step 4: Chạy lại focused tests và `npm --prefix frontend run build`; xác nhận PASS.** Kiểm chức năng thực trên một registration có BM và một registration mới chưa có BM.
- [ ] **Step 5: Commit đúng tệp Task 5.** `git commit -m "feat: connect lecturer guidance navigation and form actions"`.

## Final verification

- [ ] Chạy focused backend tests của Tasks 1–3, focused frontend tests của Tasks 4–5, Prisma validate và frontend build. Chỉ mở rộng test suite khi có lỗi/rủi ro cụ thể.
- [ ] Rà quyền theo registration, BM05 chưa công bố, dữ liệu trống, chuẩn UTF-8, nút/icon và các thay đổi đang có trong workspace trước khi kết luận hoàn thành.
- [ ] Kiểm tra `git status` để chắc chắn các commit của tính năng không gom thay đổi ngoài phạm vi.
