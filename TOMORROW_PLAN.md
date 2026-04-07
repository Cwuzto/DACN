# TOMORROW_PLAN.md

## Mục tiêu buổi tiếp theo

Chuyển trọng tâm sang **hardening**: tăng test coverage cho phần mới và chạy UAT trên môi trường clone sạch.

---

## Kế hoạch thực thi

### Batch 1 - Test integration (ưu tiên cao)

1. `PATCH /api/tasks/:id/status`
2. `POST /api/tasks` với kiểm tra trạng thái registration
3. `GET /api/dashboard/semester-overview`

Tiêu chí pass:

- Endpoint trả đúng quyền truy cập theo role.
- Business rule chính không bị bypass.
- Case lỗi trả message/status code đúng mong đợi.

### Batch 2 - UAT clone sạch (ưu tiên cao)

1. Dùng `SETUP_CLONE.md` để dựng môi trường mới.
2. Test nhanh theo role:
   - Admin: dashboard + project period + oversight.
   - Lecturer: approve/reject registration + assign/update task.
   - Student: đăng ký đề tài + nộp bài + nộp lại.

Tiêu chí pass:

- Login và kết nối DB ổn định từ bản clone mới.
- Không lỗi contract giữa frontend/backend ở các luồng chính.

### Batch 3 - Dọn text/UI còn lại (ưu tiên trung bình)

1. Rà soát các màn admin chưa đụng gần đây để xử lý nốt UTF-8/mojibake.
2. Chuẩn hóa wording thông báo/cảnh báo để đồng nhất trải nghiệm.

---

## Gate trước khi chốt

```bash
node scripts/check-utf8.js
node scripts/regression-check.js
```

---

## Ghi nhớ

- Không quay lại kiến trúc `group/groupMember/evaluation`.
- Mọi cập nhật tiến độ phải phản ánh vào 4 file trạng thái:
  - `PROJECT_STATE.md`
  - `NEXT_STEPS.md`
  - `DECISIONS.md`
  - `TOMORROW_PLAN.md`
- Không push từ agent; thao tác git do người dùng thực hiện.
