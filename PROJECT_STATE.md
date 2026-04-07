# PROJECT_STATE.md

## Trạng thái hiện tại

**Cập nhật lần cuối:** 2026-04-08

Dự án đã đi qua một đợt hoàn thiện lớn cho 3 vai trò theo workflow `TopicRegistration`.
Trạng thái hiện tại: **đã ổn định luồng chính cho STUDENT + LECTURER + ADMIN ở mức vận hành nội bộ**, sẵn sàng chuyển sang hardening test/UAT mở rộng.

---

## Đã hoàn thành (đợt gần nhất)

### 1. Chuẩn hóa cấu trúc repo và tài liệu clone

- Dọn file dư thừa, log tạm, artifact không cần thiết.
- Loại bỏ phần `notebooklm` khỏi repo làm việc.
- Cập nhật `.gitignore` để tránh tái sinh file rác.
- Bổ sung tài liệu setup clone:
  - `SETUP_CLONE.md`
- Cập nhật `README.md` để link đúng tài liệu setup.

### 2. Ổn định UTF-8 và service/frontend contract

- Chuẩn hóa nhiều file service/frontend bị lỗi mã hóa tiếng Việt.
- Cố định một số mapping response sai (đặc biệt luồng profile update).
- Duy trì gate UTF-8 trước khi chốt mỗi batch.

### 3. STUDENT (S1 + S2)

- Topic registration:
  - Đồng bộ chọn học kỳ theo ngữ cảnh đăng ký.
  - Chặn đăng ký/nộp khi ngoài cửa sổ hoặc trạng thái không hợp lệ.
- Submission:
  - Bổ sung nhập nội dung + upload file rõ ràng.
  - Hỗ trợ **nộp lại (resubmit)** khi task chưa `COMPLETED`.
  - Phân nhóm nhiệm vụ theo trạng thái: chưa nộp / quá hạn / đã nộp / đã chấm.
- Student dashboard + grade view:
  - KPI nhiệm vụ có overdue/upcoming.
  - Hiển thị kết quả bảo vệ và scoresheet tốt hơn.
- Notifications:
  - Tự refresh định kỳ để cập nhật thông báo mới.

### 4. LECTURER (L1 + L2)

- Topic management/approval:
  - Sửa text UTF-8 và thống nhất hành vi phát hành đề tài.
- Progress tracking:
  - Bổ sung duyệt/từ chối đăng ký ngay trên màn giảng viên.
  - Thêm giao task đúng điều kiện đăng ký.
  - Cảnh báo có nhiệm vụ quá hạn theo registration.
- Task management:
  - Thêm API cập nhật trạng thái task (`PATCH /api/tasks/:id/status`).
  - Chỉ cho phép tạo task khi registration ở trạng thái hợp lệ (`APPROVED`/`IN_PROGRESS`).

### 5. ADMIN (A1 + A2)

- Dashboard admin:
  - Thêm tổng quan theo học kỳ (`semester overview`):
    - số đề tài, số đăng ký,
    - tỷ lệ duyệt,
    - tỷ lệ hoàn thành,
    - trạng thái mở/đóng đăng ký.
- Project period:
  - Làm rõ trạng thái mở/đóng đăng ký ngay cạnh toggle để giảm thao tác nhầm.
- Project oversight:
  - Nâng cấp thành trung tâm cảnh báo vận hành:
    - đăng ký chờ duyệt,
    - chưa phân hội đồng,
    - sinh viên có nhiệm vụ quá hạn,
    - học kỳ sắp đóng đăng ký,
    - học kỳ quá hạn nhưng vẫn mở đăng ký.

---

## Chất lượng và gate

Các batch gần nhất đều pass:

- `npm run lint` (frontend)
- `node scripts/check-utf8.js`
- `node scripts/regression-check.js`

---

## Còn lại (ưu tiên hiện tại)

1. Hardening test backend cho các endpoint mới:
   - `PATCH /api/tasks/:id/status`
   - Rule create task theo trạng thái registration
   - `GET /api/dashboard/semester-overview`
2. UAT theo role trên môi trường clone sạch:
   - luồng đăng nhập + kết nối DB + role permissions
3. Rà soát nốt text UTF-8 ở các trang admin còn lại (nếu còn mojibake cục bộ).
