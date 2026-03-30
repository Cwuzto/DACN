# PROJECT_STATE.md

## Trạng thái hiện tại

**Cập nhật lần cuối:** 2026-03-29

Dự án đang ở trạng thái đã ổn định được phần kiến trúc cốt lõi theo mô hình `TopicRegistration`, và đã xử lý xong phần lớn các lệch pha FE/BE quan trọng.

---

## Những gì đã xong

- Giữ `TopicRegistration` là mô hình chính của nghiệp vụ.
- Xóa legacy backend:
  - `backend/src/controllers/groupController.js`
  - `backend/src/routes/groupRoutes.js`
- Chuẩn hóa `GET /api/dashboard/student` về contract mới:
  - `hasRegistration`
  - `registrationDetails`
  - `taskStatus`
  - `upcomingDeadlines`
- Refactor các page từng bám logic `group` cũ:
  - `frontend/src/pages/student/StudentDashboardPage.jsx`
  - `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
  - `frontend/src/pages/student/GradeViewPage.jsx`
  - `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
  - `frontend/src/pages/lecturer/TopicManagementPage.jsx`
  - `frontend/src/pages/admin/TopicManagementPage.jsx`
- Đồng bộ field FE/BE:
  - `maxGroups -> maxStudents`
  - `_count.groups -> _count.registrations`
- Chạy smoke test end-to-end đã pass:
  - Student đăng ký đề tài
  - Lecturer duyệt đăng ký
  - Lecturer giao task
  - Student nộp bài
  - Admin chấm bảo vệ
  - Student đọc được điểm
- Đã dọn sạch dữ liệu smoke khỏi DB.
- Gom rule quota giảng viên về một nguồn chung:
  - `backend/src/constants/mentorCapacity.js`
- Frontend lint hiện đã sạch:
  - `npm --prefix frontend run lint` pass
- `UserManagementPage` đã tách thành 3 nhóm rõ ràng trong cùng một trang:
  - Giảng viên
  - Quản trị viên
  - Sinh viên

---

## Các fix quan trọng đã phát hiện

- `backend/src/controllers/taskController.js`
  - thêm `registrationId` khi tạo `Submission`
  - sửa người nhận notification từ `submission.studentId` sang `submission.submittedBy`

---

## Những gì còn lại

### 1. Admin pages còn mock/hardcode

Ưu tiên rà tiếp:

- `frontend/src/pages/admin/DashboardPage.jsx`
- `frontend/src/pages/admin/NotificationCenterPage.jsx`
- `frontend/src/pages/admin/ProjectOversightPage.jsx`
- một phần `frontend/src/pages/admin/ProjectPeriodPage.jsx`

### 2. Service layer frontend chưa rà hết

- Cần kiểm tra toàn bộ `frontend/src/services/`
- Mục tiêu là đảm bảo toàn bộ service bám đúng contract của `api.js`

### 3. User management mới dừng ở mức section

- Đã tách theo 3 nhóm trong cùng 1 trang
- Chưa tách thành 3 route/menu riêng nếu muốn URL rõ ràng hơn

### 4. Encoding tiếng Việt

- Vẫn còn một số chuỗi hiển thị/log/message bị lỗi encoding
- Nên có một phiên riêng để dọn dứt điểm

---

## Mức độ sẵn sàng hiện tại

### Đã ổn

- Auth cơ bản
- Routing theo role
- Flow chính theo `TopicRegistration`
- Dashboard student contract mới
- Task / submission / grading chạy được
- Frontend lint sạch

### Chưa coi là hoàn thiện

- Admin dashboard và các màn quản trị nâng cao
- Chuẩn hóa toàn bộ mock data sang API thật
- Chuẩn hóa toàn bộ service layer
- Test tự động
- Dọn encoding toàn repo

---

## Khi quay lại làm tiếp nên đọc

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `NEXT_STEPS.md`
4. `DECISIONS.md`
5. `TOMORROW_PLAN.md`
6. `README.md`
