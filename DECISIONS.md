# DECISIONS.md

## Decision Log

Tài liệu lưu các quyết định kỹ thuật/nghiệp vụ quan trọng để tránh lệch hướng giữa các phiên.

---

## 2026-03-28 - Repo là bộ nhớ chính

**Quyết định**

- Dùng file trong repo làm nguồn trạng thái chính thức.
- NotebookLM chỉ là công cụ hỗ trợ tra cứu/tóm tắt.

**Ảnh hưởng**

- Luôn đồng bộ các file: `AGENTS.md`, `PROJECT_STATE.md`, `NEXT_STEPS.md`, `DECISIONS.md`.

---

## 2026-03-28 - Chốt mô hình `TopicRegistration`

**Quyết định**

- `TopicRegistration` là mô hình nghiệp vụ chính.
- Không đưa `group/groupMember/evaluation` trở lại kiến trúc chính.

**Ảnh hưởng**

- Mọi phát triển mới phải bám workflow hiện tại, legacy chỉ xử lý theo hướng dọn dần.

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

**Ảnh hưởng**

- Dữ liệu demo ổn định, dễ trình diễn các màn hình theo nghiệp vụ thật.
- Giảm rủi ro demo bị “trống dữ liệu” hoặc sai logic.

---

## 2026-04-15 - Siết logic toggle đăng ký theo thời gian thực tế

**Quyết định**

- Chỉ cho bật đăng ký khi đang trong cửa sổ hợp lệ: `startDate` -> `registrationDeadline`.
- Không cho bật đăng ký ở giữa kỳ/bảo vệ/hoàn thành.

**Ảnh hưởng**

- Backend chặn bật sai thời điểm.
- Frontend disable toggle ngoài trạng thái `REGISTRATION`.
- Trạng thái hiển thị nhất quán hơn với nghiệp vụ.

---

## 2026-04-15 - Bổ sung gate chất lượng Markdown

**Quyết định**

- Thêm script `node scripts/check-md-quality.js` vào quy trình gate.
- Script phát hiện:
  - dấu hiệu `mojibake` trong `.md`
  - nhiều cụm tiếng Việt không dấu bất thường trong `.md`

**Ảnh hưởng**

- Giảm rủi ro tài liệu bị lỗi encoding hoặc xuống chất lượng hiển thị tiếng Việt qua từng batch.
- Tăng độ tin cậy khi dùng tài liệu repo làm nguồn sự thật.
