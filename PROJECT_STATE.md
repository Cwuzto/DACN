# PROJECT_STATE.md

## Trạng thái hiện tại

**Cập nhật lần cuối:** 2026-04-01

Dự án đã ổn định workflow nghiệp vụ chính theo mô hình `TopicRegistration`.
Trọng tâm hiện tại là UAT hồi quy và mở rộng test tích hợp cho các endpoint mới.

---

## Đã hoàn thành

### 1. Kiến trúc và nghiệp vụ

- Chốt mô hình `TopicRegistration` làm nguồn sự thật chính.
- Không phát triển tính năng mới dựa trên `group/groupMember/evaluation`.
- Hoàn thiện luồng nghiệp vụ E2E:
  - đăng ký đề tài -> duyệt -> giao task -> nộp bài -> phân hội đồng -> chấm -> xem điểm.

### 2. Backend

- Bổ sung/tối ưu các endpoint dashboard, notifications, registrations, semesters.
- Rule đăng ký theo `Semester.registrationOpen` và cửa sổ thời gian đã được enforce.
- Có nền tảng test backend (unit + integration route-level cho nhóm auth/semesters/registrations).

### 3. Frontend

- Các trang chính đã dùng API thật, dọn phần lớn mock/hardcode trọng yếu.
- `ProjectPeriodPage` đã sync toggle đăng ký với backend.
- `ProjectOversightPage` đã có lọc theo học kỳ.
- `GradingDefensePage` đã chuẩn hóa text tiếng Việt UTF-8 có dấu.

### 4. Dữ liệu seed thật

- Đã cập nhật `backend/prisma/seed.js` theo chiến lược:
  - giữ `users`,
  - xóa dữ liệu nghiệp vụ,
  - tạo lại bộ dữ liệu logic.
- Bộ dữ liệu mới gồm:
  - 15 users (2 admin, 5 lecturer, 8 student),
  - 3 semesters,
  - 5 topics,
  - 5 registrations,
  - task/submission/milestone,
  - council + council members,
  - defense result,
  - notifications.
- Nội dung seed đã Việt hóa (học kỳ, học vị, bộ môn, đề tài, thông báo...).

---

## Chất lượng và gate

- `node scripts/check-utf8.js`: pass
- `node scripts/regression-check.js`: pass
- `npm run db:seed`: pass

---

## Còn lại

1. UAT hồi quy nhanh với dữ liệu seed mới trên các màn trọng tâm:
   - `admin/ProjectOversightPage`
   - `admin/GradingDefensePage`
   - `student/TopicListPage`
2. Mở rộng integration test cho `GET /api/topics/mentors` (nếu chưa có).
3. Tiếp tục rà soát text UI tiếng Việt theo batch nhỏ để tránh tái phát mojibake.
