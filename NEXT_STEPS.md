# NEXT_STEPS.md

## Mục tiêu phiên tiếp theo

Khóa chất lượng sau đợt hoàn thiện tính năng bằng test + UAT có checklist rõ ràng, trước khi mở feature mới.

---

## Ưu tiên thực thi

### 1. Test backend cho phần mới (ưu tiên cao)

- Bổ sung integration test cho:
  - `PATCH /api/tasks/:id/status`
  - `POST /api/tasks` với rule chặn registration không hợp lệ
  - `GET /api/dashboard/semester-overview`

Mục tiêu:

- Chặn hồi quy business rule sau các batch Student/Lecturer/Admin.

### 2. UAT clone sạch (ưu tiên cao)

- Chạy theo tài liệu `SETUP_CLONE.md` trên máy clone mới.
- Xác nhận các luồng tối thiểu:
  - login theo role,
  - student đăng ký + nộp bài,
  - lecturer duyệt + giao việc,
  - admin xem dashboard/oversight + toggle registration.

### 3. Dọn nốt text/UX admin (ưu tiên trung bình)

- Rà soát các trang admin chưa chạm trong đợt này để xử lý UTF-8/mojibake nếu còn.
- Chuẩn hóa các label/câu cảnh báo theo cùng wording.

---

## Gate bắt buộc trước khi chốt batch

```bash
node scripts/check-utf8.js
node scripts/regression-check.js
```

---

## Không ưu tiên lúc này

- Refactor lan rộng không phục vụ trực tiếp ổn định vận hành.
- Quay lại kiến trúc `group/groupMember/evaluation`.
- Mở tính năng mới lớn khi chưa khóa test hồi quy cho endpoint mới.
