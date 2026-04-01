# TOMORROW_PLAN.md

## Mục tiêu buổi tiếp theo

Xác nhận bộ dữ liệu thật mới hoạt động ổn định trên các màn trọng tâm và khóa chất lượng trước khi mở batch mới.

---

## Kế hoạch thực thi

### Batch 1 - UAT nhanh theo role (ưu tiên cao)

1. Admin:
   - `ProjectOversightPage`
   - `GradingDefensePage`
2. Student:
   - `TopicListPage`

Tiêu chí pass:

- Dữ liệu hiển thị logic theo học kỳ active.
- Trạng thái đăng ký/chấm điểm phản ánh đúng dữ liệu backend.
- Text tiếng Việt hiển thị đúng UTF-8 có dấu.

### Batch 2 - Test mở rộng (ưu tiên cao)

1. Bổ sung/hoàn thiện integration test cho:
   - `GET /api/topics/mentors`

### Batch 3 - Ổn định chất lượng hiển thị (ưu tiên trung bình)

1. Rà soát thêm các trang admin về tiếng Việt/UTF-8 để phát hiện sớm mojibake.

---

## Gate trước khi chốt

```bash
node scripts/check-utf8.js
node scripts/regression-check.js
```

---

## Ghi nhớ

- Sau thay đổi Prisma schema: migrate -> generate -> restart backend.
- Không quay lại kiến trúc `group/groupMember/evaluation`.
- Cập nhật lại 4 file trạng thái sau khi UAT xong:
  - `PROJECT_STATE.md`
  - `NEXT_STEPS.md`
  - `DECISIONS.md`
  - `TOMORROW_PLAN.md`
