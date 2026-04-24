# DECISIONS.md

## Decision Log

Tài liệu lưu các quyết định kỹ thuật/nghiệp vụ quan trọng để tránh lệch hướng giữa các phiên.

---

## 2026-03-28 - Repo là bộ nhớ chính

**Quyết định**

- Dùng file trong repo làm nguồn trạng thái chính thức.
- NotebookLM chỉ là công cụ hỗ trợ tra cứu/tóm tắt.

**Ảnh hưởng**

- Luôn đồng bộ các file trong `.docs/`.

---

## 2026-03-28 - Chốt mô hình `TopicRegistration`

**Quyết định**

- `TopicRegistration` là mô hình nghiệp vụ chính.
- Không đưa `group/groupMember/evaluation` trở lại kiến trúc chính.

**Ảnh hưởng**

- Mọi phát triển mới phải bám workflow hiện tại.

---

## 2026-03-29 - Quota giảng viên theo học vị

**Quyết định**

- `THAC_SI = 10`
- `TIEN_SI = 15`
- `PHO_GIAO_SU = 20`

**Ảnh hưởng**

- Rule tập trung tại `backend/src/constants/mentorCapacity.js`.

---

## 2026-04-01 - Toggle đăng ký theo từng học kỳ

**Quyết định**

- Trạng thái mở/đóng đăng ký được lưu theo `Semester.registrationOpen`.
- Không tạo bảng `SystemConfig` cho bài toán này.

**Ảnh hưởng**

- Dùng endpoint `PATCH /api/semesters/:id/registration-toggle`.

---

## 2026-04-15 - Seed dữ liệu demo lớn và thực tế

**Quyết định**

- Xóa dữ liệu cũ và seed lại bộ dữ liệu demo đầy đủ theo nhiều giai đoạn học kỳ.
- Giữ rule: mỗi đề tài chỉ 1 sinh viên (`maxStudents = 1`).

---

## 2026-04-15 - Siết logic toggle đăng ký theo thời gian thực tế

**Quyết định**

- Chỉ cho bật đăng ký khi đang trong cửa sổ hợp lệ: `startDate` -> `registrationDeadline`.

---

## 2026-04-15 - Bổ sung gate chất lượng Markdown

**Quyết định**

- Thêm script `node scripts/check-md-quality.js` vào quy trình gate.

---

## 2026-04-22 - Chốt phạm vi batch nghiệp vụ mới

**Quyết định**

- Tự động `REJECT` đăng ký đề tài `PENDING` sau 5 ngày nếu giảng viên không phản hồi.
- Tự động `REJECT` các đăng ký `PENDING` khi kết thúc hạn đăng ký của đợt.
- Trang "Đề tài của tôi" của giảng viên hiển thị tên sinh viên đăng ký, hỗ trợ search theo tên sinh viên, và bỏ filter "Bản nháp".
- Quy tắc filter mặc định ưu tiên đợt hiện tại; nếu chưa có thì lấy đợt gần nhất vừa kết thúc.
- Triển khai bảng chấm điểm hội đồng online theo barem, hỗ trợ xuất PDF.
- Bổ sung cơ chế nhận diện và giới hạn quyền tài khoản sinh viên đã hoàn thành đồ án tốt nghiệp.

---

## 2026-04-22 - Hợp nhất API quản trị bảo vệ/chấm điểm cho Admin

**Quyết định**

- Bổ sung nhóm endpoint `Admin Defense Center` dưới `/api/evaluations/admin-defense-center`.
- Dùng mô hình tab theo workflow thực tế: `PENDING_ASSIGNMENT`, `ASSIGNED_COUNCIL`, `AWAITING_GRADING`, `COMPLETED`.
- Bổ sung action nghiệp vụ cho admin: nhắc chấm điểm hàng loạt và khóa/mở khóa trạng thái điểm.

**Ảnh hưởng**

- UI Admin có thể gom điều phối hội đồng + theo dõi chấm điểm trên một màn hình thống nhất.
- Giảm thao tác qua lại giữa trang hội đồng và trang chấm điểm.
- Cần frontend cập nhật theo contract API mới.