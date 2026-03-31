# PROJECT_STATE.md

## Trạng thái hiện tại

**Cập nhật lần cuối:** 2026-04-01

Dự án đã hoàn thành workflow E2E chính, đã dọn sạch mock data khỏi toàn bộ admin pages, service layer FE đã bám đúng contract BE. Hiện còn lại encoding cleanup, một số UX gap nhỏ, và chưa có test.

---

## Những gì đã xong

- Giữ `TopicRegistration` là mô hình chính của nghiệp vụ.
- Xóa legacy backend (`groupController`, `groupRoutes`).
- Chuẩn hóa toàn bộ dashboard contract mới (admin/lecturer/student).
- Refactor toàn bộ pages bám logic `TopicRegistration`.
- Đồng bộ field FE/BE: `maxGroups -> maxStudents`, `_count.groups -> _count.registrations`.
- Smoke test E2E pass: đăng ký → duyệt → giao task → nộp bài → chấm bảo vệ → xem điểm.
- Frontend lint sạch (`npm --prefix frontend run lint` pass).
- `UserManagementPage` tách thành 3 nhóm (GV, Admin, SV).
- Gom rule quota giảng viên về `backend/src/constants/mentorCapacity.js`.
- Admin grading export: CSV UTF-8 + PDF print flow.
- Notification template module: list/update qua API backend.
- Regression gate + UTF-8 pre-close check pass.

### Update 2026-04-01 — Audit kết quả

- **Admin pages**: Cả 4 trang (`DashboardPage`, `ProjectOversightPage`, `ProjectPeriodPage`, `NotificationCenterPage`) đều đã dùng API thật. Không còn mock data.
- **Service layer FE**: Toàn bộ 12 services (`api`, `auth`, `council`, `dashboard`, `evaluation`, `notification`, `registration`, `semester`, `task`, `topic`, `upload`, `user`) đã bám đúng interceptor pattern, không còn lỗi `response.data`.
- **Backend dashboard controller**: 6 endpoints đầy đủ (`stats`, `semesters`, `scores`, `activities`, `lecturer`, `student`).

---

## Những gì còn lại

### 1. Encoding tiếng Việt (Ưu tiên cao)

12+ chuỗi thiếu dấu rải rác trong:
- `frontend/src/services/notificationService.js` (8 chuỗi)
- `frontend/src/services/registrationService.js` (2 chuỗi)
- `frontend/src/services/topicService.js` (1 chuỗi)
- `backend/src/controllers/notificationController.js` (1 chuỗi)
- `frontend/src/pages/admin/ProjectPeriodPage.jsx` (2 chuỗi + 1 typo)

### 2. Switch "Cho phép đăng ký" không kết nối backend (Ưu tiên cao)

- `ProjectPeriodPage.jsx` line 145: `topicRegistrationOpen` là local state, chưa kết nối API nào.
- Cần quyết định: lưu vào `Semester` table hay tạo `SystemConfig` riêng.

### 3. UX gaps nhỏ (Ưu tiên trung bình)

- `ProjectPeriodPage`: thiếu field `status` khi tạo/edit semester.
- `ProjectOversightPage`: thiếu filter theo semester.

### 4. Test (Ưu tiên trung bình)

- Backend và frontend đều chưa có unit/integration test.

### 5. Tài liệu (Ưu tiên thấp)

- Chưa có hướng dẫn `.env` chi tiết và deploy.

---

## Mức độ sẵn sàng hiện tại

### Đã ổn

- Auth cơ bản + routing theo role
- Workflow E2E chính theo `TopicRegistration`
- Dashboard admin/lecturer/student dùng API thật
- Task / submission / grading chạy được
- Council / defense result chạy được
- Notification user-flow + admin-flow dùng API thật
- Service layer FE đồng bộ đúng contract
- Frontend lint sạch
- Regression gate pass

### Chưa coi là hoàn thiện

- Encoding tiếng Việt
- Switch đăng ký chưa kết nối BE
- Test tự động
- Tài liệu triển khai

---

## Khi quay lại làm tiếp nên đọc

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `NEXT_STEPS.md`
4. `DECISIONS.md`
5. `TOMORROW_PLAN.md`
6. `README.md`

---

## Update 2026-04-01 - Encoding batch + ProjectOversight semester filter

- Hoan tat encoding cleanup cho cac file uu tien trong TOMORROW_PLAN:
  - `frontend/src/services/notificationService.js`
  - `frontend/src/services/registrationService.js`
  - `frontend/src/services/topicService.js`
  - `backend/src/controllers/notificationController.js`
  - `frontend/src/pages/admin/ProjectPeriodPage.jsx` (fix typo "bao cao" + normalize whitespace)
- `ProjectPeriodPage` da bo sung field `status` trong form tao/sua dot.
- `ProjectOversightPage` da bo sung dropdown filter theo hoc ky (semester).
- Da chay gate xac nhan:
  - `npm --prefix frontend run lint` pass
  - `node scripts/regression-check.js` pass (co UTF-8 check)

---

## Update 2026-04-01 - Semester registration toggle implemented

- Da trien khai xong phuong an 1:
  - Prisma: `Semester.registrationOpen`
  - Migration: `20260401103000_add_semester_registration_open`
  - API: `PATCH /api/semesters/:id/registration-toggle`
  - UI: switch trong `ProjectPeriodPage` da luu backend theo hoc ky dang chon.
- Regression gate pass + UTF-8 check pass.

---

## 2026-04-01 - Toggle registrationOpen runtime issue resolved

**Su co**
- Khi toggle dang ky tren `ProjectPeriodPage`, backend throw loi Prisma:
  - `Unknown argument registrationOpen` tai `prisma.semester.update()`.

**Nguyen nhan**
- Prisma Client runtime chua dong bo voi schema moi (`Semester.registrationOpen`).

**Xu ly da thuc hien**
1. Chay `npx prisma generate` trong `backend/`.
2. Chay `npx prisma migrate deploy` trong `backend/`.
3. Migration `20260401103000_add_semester_registration_open` da apply thanh cong.

**Ket qua**
- DB schema da co cot `registration_open`.
- Toggle API co the hoat dong sau khi restart backend process.
