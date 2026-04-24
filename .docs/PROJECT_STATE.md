# PROJECT_STATE.md

## Trạng thái hiện tại

**Cập nhật lần cuối:** 2026-04-22

Dự án đang ở trạng thái **ổn định luồng chính cho 3 vai trò** (`ADMIN`, `LECTURER`, `STUDENT`) theo workflow `TopicRegistration`.

---

## Tiến độ mới nhất

### 1. Demo data đã làm mới hoàn toàn

- Reset dữ liệu cũ và seed lại dữ liệu lớn, thực tế để phục vụ demo.
- Dữ liệu hiện có:
  - `users`: 86
  - `semesters`: 4
  - `topics`: 166
  - `registrations`: 122
  - `tasks`: 610
  - `submissions`: 366
  - `milestones`: 366
  - `councils`: 7
  - `defenseResults`: 58
  - `notifications`: 220
- Rule đã đồng bộ: mỗi đề tài chỉ 1 sinh viên (`maxStudents = 1`).

### 2. Đã sửa logic toggle mở/đóng đăng ký theo nghiệp vụ

- Backend chỉ cho bật đăng ký trong cửa sổ hợp lệ (`startDate` -> `registrationDeadline`).
- UI admin chỉ cho bật toggle khi học kỳ ở trạng thái `REGISTRATION`.
- API trả thêm trạng thái rõ ràng để UI hiển thị đúng theo hiệu lực thực tế.

### 3. Đã bổ sung backend "Admin Defense Center"

- Thêm endpoint tổng hợp cho Admin để điều phối bảo vệ/chấm điểm theo 4 tab trạng thái:
  - `PENDING_ASSIGNMENT`
  - `ASSIGNED_COUNCIL`
  - `AWAITING_GRADING`
  - `COMPLETED`
- Hỗ trợ filter/search trong cùng endpoint và mặc định chọn đợt theo rule:
  - đợt hiện tại,
  - nếu chưa có thì lấy đợt gần nhất vừa kết thúc.
- Bổ sung action nhắc chấm điểm hàng loạt cho hội đồng và khóa/mở khóa trạng thái điểm.

### 4. Chuẩn hóa tiếng Việt và encoding

- Đã chuẩn hóa rule kiểm tra UTF-8 + chất lượng markdown.

---

## Chất lượng và gate

- `node scripts/check-utf8.js`: **PASS**
- `node scripts/check-md-quality.js`: **PASS**
- `npm --prefix frontend run build`: **PASS**

---

## Yêu cầu mới đã chốt (chưa triển khai)

1. Auto-reject đăng ký `PENDING` sau 5 ngày không phản hồi.
2. Auto-reject `PENDING` khi qua `registrationDeadline`.
3. Trang "Đề tài của tôi" của lecturer hiển thị tên sinh viên, tìm kiếm theo sinh viên, bỏ filter bản nháp.
4. Filter mặc định theo đợt hiện tại hoặc đợt gần nhất vừa kết thúc.
5. Bảng chấm điểm hội đồng online theo barem + xuất PDF.
6. Nhận diện và giới hạn quyền tài khoản sinh viên đã hoàn thành đồ án.