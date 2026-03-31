# DECISIONS.md

## Decision Log

File này lưu các quyết định kỹ thuật/nghiệp vụ quan trọng để tránh lệch hướng giữa các phiên.

---

## 2026-03-28 - Repo là bộ nhớ chính, NotebookLM là bộ nhớ phụ

**Quyết định**

- Dùng các file trong repo để lưu trạng thái dự án lâu dài.
- Dùng NotebookLM như công cụ hỗ trợ tra cứu/tóm tắt.

**Ảnh hưởng**

- Cần duy trì đều các file:
  - `AGENTS.md`
  - `PROJECT_STATE.md`
  - `NEXT_STEPS.md`
  - `DECISIONS.md`
  - `TOMORROW_PLAN.md`

---

## 2026-03-28 - Chốt mô hình `TopicRegistration`

**Quyết định**

- `TopicRegistration` là mô hình nghiệp vụ chính hiện tại.
- Không quay lại phát triển theo `group/groupMember/evaluation` nếu chưa có quyết định mới.

**Ảnh hưởng**

- Mọi controller/page/service còn tư duy theo `group` được xem là legacy cần dọn.

---

## 2026-03-29 - Chốt quota giảng viên theo học vị

**Quyết định**

- `THAC_SI = 10`
- `TIEN_SI = 15`
- `PHO_GIAO_SU = 20`

**Ảnh hưởng**

- Rule được gom về `backend/src/constants/mentorCapacity.js`.

---

## 2026-03-31 - Workflow-first implementation

**Quyết định**

- Ưu tiên hoàn thiện workflow nghiệp vụ end-to-end trước.
- Sau khi workflow ổn định mới làm mở rộng chức năng và polish giao diện.

**Workflow canonical**

1. `Semester`
2. `Topic`
3. `TopicRegistration`
4. `Task` / `Submission` / `Milestone`
5. `Council`
6. `DefenseResult`
7. `Notification`

**Nguyên tắc thực thi**

- Backend contract và business rule là nguồn sự thật đầu tiên.
- Frontend/service bắt buộc bám đúng contract thật, không duy trì mock nếu API đã có.
- Không mở feature mới khi workflow chính còn điểm đứt.

**Ảnh hưởng**

- Mọi backlog tiếp theo phải được map vào 1 bước cụ thể trong workflow canonical.
- PR/sửa đổi không map được vào workflow canonical sẽ không được ưu tiên.

---

## 2026-03-31 - Notification user-flow and regression gate

**Quyết định**

- Notification không chỉ dùng cho admin center:
  - bổ sung user-flow endpoint (`my/read/read-all/delete`)
  - giữ admin-flow endpoint (`history/broadcast`)
- Đặt script regression gate trước merge:
  - `node scripts/regression-check.js`

**Lý do**

- Loại bỏ mock ở `NotificationsPage` và đồng bộ FE/BE theo dữ liệu thật.
- Giảm rủi ro tái phát legacy pattern trong luồng council/registration.

**Ảnh hưởng**

- Workflow step 7 (`Notification`) đã có đủ luồng user + admin.
- Trước khi merge batch lớn, cần chạy regression gate để check lint + route load + legacy guard.

---

## 2026-03-31 - UTF-8 pre-close gate + context-window warning

**Quyet dinh**

- Truc bat buoc truoc khi chot batch: phai check UTF-8.
- Trong phien chat dai, canh bao som khi ngu canh sap day de chuyen cua so chat.

**Anh huong**

- Regression gate bo sung buoc `node scripts/check-utf8.js`.
- Cac phien tiep theo can co nhac nho chu dong truoc khi ngu canh qua day, tranh lang phi token/quota.

---

## 2026-04-01 - Full codebase audit + encoding-first batch

**Quyết định**

- Admin pages (Dashboard, ProjectOversight, ProjectPeriod, NotificationCenter) đã xác nhận dùng API thật — xóa khỏi danh sách "còn mock/hardcode".
- Service layer FE (12/12 services) đã xác nhận bám đúng contract — xóa khỏi danh sách "cần rà".
- Encoding cleanup là batch đầu tiên cần làm (12+ chuỗi mất dấu tiếng Việt).
- Switch "Cho phép đăng ký" trong `ProjectPeriodPage` cần kết nối backend — **chờ quyết định**: thêm field vào `Semester` hay tạo bảng `SystemConfig`.

**Ảnh hưởng**

- `PROJECT_STATE.md` đã được cập nhật lại phản ánh đúng thực trạng.
- Backlog giảm đáng kể so với trước — các batch tiếp theo nên tập trung vào encoding, switch API, và UX polish.

---

## 2026-04-01 - Chot va trien khai registration toggle theo Semester

**Quyet dinh**

- Chon phuong an 1: luu switch "Cho phep dang ky" theo tung hoc ky (`Semester.registrationOpen`).
- Khong tao bang `SystemConfig` cho nhu cau nay.

**Anh huong**

- Prisma schema bo sung field `registrationOpen` + migration DB.
- Backend bo sung endpoint: `PATCH /api/semesters/:id/registration-toggle`.
- Frontend `ProjectPeriodPage` switch da ket noi API va persist sau refresh.

---

## 2026-04-01 - Post-fix note for registration toggle

**Quyet dinh van hanh**
- Sau moi thay doi Prisma schema, bat buoc chay:
  1. `npx prisma generate`
  2. `npx prisma migrate deploy` (hoac `migrate dev` tren local)
  3. Restart backend process

**Ly do**
- Tranh runtime mismatch giua Prisma Client va DB schema (loi `Unknown argument ...`).
