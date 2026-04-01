# NEXT_STEPS.md

## Mục tiêu phiên tiếp theo

Chốt UAT với bộ dữ liệu thật mới, sau đó mở rộng test để khóa chất lượng trước khi mở batch tính năng mới.

---

## Ưu tiên thực thi

### 1. UAT với dữ liệu seed mới (ưu tiên cao)

- Admin:
  - `ProjectOversightPage`
  - `GradingDefensePage`
- Student:
  - `TopicListPage`

Checklist:

- Dữ liệu hiển thị theo học kỳ active đúng logic.
- Luồng đăng ký/chấm điểm hiển thị đúng trạng thái.
- Text tiếng Việt có dấu hiển thị chuẩn UTF-8.

### 2. Test backend (ưu tiên cao)

- Bổ sung/kiểm tra integration test cho:
  - `GET /api/topics/mentors`

### 3. Ổn định UI text (ưu tiên trung bình)

- Rà soát tiếp các trang admin còn lại để phát hiện sớm chuỗi tiếng Việt bị lỗi mã hóa.

---

## Gate bắt buộc trước khi chốt batch

```bash
node scripts/check-utf8.js
node scripts/regression-check.js
```

---

## Không ưu tiên lúc này

- Mở feature lớn mới ngoài workflow canonical.
- Refactor lan rộng khi chưa có nhu cầu nghiệp vụ rõ ràng.
- Quay lại kiến trúc `group/groupMember/evaluation`.
