# DECISIONS.md

## Decision Log

Tài liệu lưu các quyết định kỹ thuật/nghiệp vụ quan trọng để tránh lệch hướng giữa các phiên.

---

## 2026-03-28 - Repo là bộ nhớ chính, NotebookLM là bộ nhớ phụ

**Quyết định**

- Dùng file trong repo làm nguồn trạng thái chính thức.
- Dùng NotebookLM như công cụ hỗ trợ tra cứu/tóm tắt.

**Ảnh hưởng**

- Duy trì đồng bộ: `AGENTS.md`, `PROJECT_STATE.md`, `NEXT_STEPS.md`, `DECISIONS.md`, `TOMORROW_PLAN.md`.

---

## 2026-03-28 - Chốt mô hình `TopicRegistration`

**Quyết định**

- `TopicRegistration` là mô hình nghiệp vụ chính.
- Không đưa `group/groupMember/evaluation` trở lại làm kiến trúc chính nếu chưa có quyết định mới.

**Ảnh hưởng**

- Mọi phần còn tư duy `group` được coi là legacy và phải dọn dần.

---

## 2026-03-29 - Chốt quota giảng viên theo học vị

**Quyết định**

- `THAC_SI = 10`
- `TIEN_SI = 15`
- `PHO_GIAO_SU = 20`

**Ảnh hưởng**

- Rule tập trung tại `backend/src/constants/mentorCapacity.js`.

---

## 2026-03-31 - Workflow-first implementation

**Quyết định**

Ưu tiên hoàn thiện workflow nghiệp vụ end-to-end trước khi mở rộng feature:

1. `Semester`
2. `Topic`
3. `TopicRegistration`
4. `Task` / `Submission` / `Milestone`
5. `Council`
6. `DefenseResult`
7. `Notification`

**Ảnh hưởng**

- Backend contract/business rule là nguồn sự thật đầu tiên.
- Frontend/service phải bám API thật, không duy trì mock khi API đã có.

---

## 2026-03-31 - Gate bắt buộc trước khi chốt batch

**Quyết định**

- Bắt buộc chạy:
  - `node scripts/check-utf8.js`
  - `node scripts/regression-check.js`

**Ảnh hưởng**

- Giảm rủi ro tái phát lỗi encoding và lỗi hồi quy luồng chính.

---

## 2026-04-01 - Chốt registration toggle theo `Semester`

**Quyết định**

- Lưu trạng thái “Cho phép đăng ký” theo từng học kỳ (`Semester.registrationOpen`).
- Không tạo bảng `SystemConfig` cho bài toán này.

**Ảnh hưởng**

- Có endpoint `PATCH /api/semesters/:id/registration-toggle`.
- Frontend `ProjectPeriodPage` đã persist đúng qua API.

---

## 2026-04-01 - Real-data seeding strategy

**Quyết định**

- Chiến lược seed cho demo/UAT:
  - giữ `users`,
  - xóa dữ liệu nghiệp vụ,
  - tạo lại bộ dữ liệu nghiệp vụ logic theo workflow canonical.

**Ảnh hưởng**

- Giảm nhiễu từ dữ liệu cũ qua nhiều batch.
- `backend/prisma/seed.js` là điểm reset dữ liệu chuẩn của dự án.

---

## 2026-04-01 - Việt hóa dữ liệu seed và chuẩn hóa UTF-8 màn chấm điểm

**Quyết định**

- Seed dữ liệu dùng tiếng Việt có dấu (học kỳ, học vị, bộ môn, đề tài, thông báo...).
- Chuẩn hóa toàn bộ text UI ở `frontend/src/pages/admin/GradingDefensePage.jsx` về UTF-8.

**Ảnh hưởng**

- Trải nghiệm hiển thị nhất quán tiếng Việt giữa các màn admin.
- Giảm nguy cơ tái phát ASCII/mojibake ở luồng chấm điểm bảo vệ.
