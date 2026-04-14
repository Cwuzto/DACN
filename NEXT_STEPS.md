# NEXT_STEPS.md

## Trọng tâm hiện tại

Khóa chất lượng cho buổi demo và tránh hồi quy sau các batch đã hoàn thành.

## Việc cần làm tiếp

### Ưu tiên cao

- [ ] UAT nhanh toàn luồng theo 3 vai trò:
  - Admin: quản lý đợt đồ án, dashboard, duyệt vận hành
  - Lecturer: duyệt đăng ký, giao task, theo dõi tiến độ
  - Student: đăng ký, làm task, nộp bài, xem điểm
- [ ] Kiểm tra lại dữ liệu hiển thị ở các trang chính bằng bộ seed mới.
- [ ] Chụp 8-10 ảnh màn hình backup cho demo.

### Ưu tiên trung bình

- [ ] Bổ sung integration test cho:
  - `PATCH /api/tasks/:id/status`
  - `POST /api/tasks`
  - `GET /api/dashboard/semester-overview`
- [ ] Rà soát text/UX các trang admin còn lại.

### Ưu tiên thấp

- [ ] Dọn dead code legacy sau các quyết định kiến trúc mới.

---

## Gate bắt buộc trước khi chốt batch

```bash
node scripts/check-utf8.js
node scripts/check-md-quality.js
node scripts/regression-check.js
npm --prefix backend test -- --runInBand
npm --prefix frontend run build
```

## Ghi chú

- Luồng duyệt hiện tại tập trung vào **đăng ký đề tài chờ duyệt** (`TopicRegistration`).
- Không dùng luồng “đề tài sinh viên đề xuất” trong phạm vi dự án hiện tại.
