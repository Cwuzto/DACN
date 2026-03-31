# TOMORROW_PLAN.md

## Mục tiêu buổi tiếp theo

Dọn encoding tiếng Việt dứt điểm (dedicated session), sau đó kết nối Switch đăng ký với backend.

---

## Thứ tự nên làm

### Batch 1 — Encoding Cleanup (30 phút)

1. Sửa 8 chuỗi mất dấu trong `notificationService.js`.
2. Sửa 2 chuỗi mất dấu trong `registrationService.js`.
3. Sửa 1 chuỗi mất dấu trong `topicService.js`.
4. Sửa 1 chuỗi mất dấu trong `notificationController.js`.
5. Sửa 2 chuỗi mất dấu + 1 typo trong `ProjectPeriodPage.jsx`.
6. Chạy `node scripts/regression-check.js` và `node scripts/check-utf8.js`.

### Batch 2 — Switch "Cho phép đăng ký" (1-2 giờ)

1. Quyết định: thêm field `registrationOpen` vào `Semester` hay tạo bảng `SystemConfig`.
2. Tạo migration Prisma.
3. Thêm API endpoint `PATCH /api/semesters/settings/registration-toggle`.
4. Kết nối Switch UI trong `ProjectPeriodPage` với API.
5. Test toggle persist qua page refresh.

### Batch 3 — UX Improvements (tùy thời gian)

1. `ProjectPeriodPage`: thêm field chọn status khi tạo/edit semester.
2. `ProjectOversightPage`: thêm dropdown filter theo semester.
3. Chạy regression gate.

### Batch 4 — Cập nhật tài liệu

1. Cập nhật `PROJECT_STATE.md`, `NEXT_STEPS.md`.
2. Bổ sung hướng dẫn `.env` và deploy vào `README.md`.

---

## Điểm vào nhanh nhất

- `frontend/src/services/notificationService.js` (encoding fix)
- `frontend/src/pages/admin/ProjectPeriodPage.jsx` (switch + encoding)
- `backend/src/controllers/notificationController.js` (encoding fix)
- `scripts/regression-check.js` (verify)

---

## Ghi nhớ quan trọng

- Encoding cleanup phải là batch riêng, không trộn với feature.
- Chỉnh backend contract trước, sau đó mới polish UI.
- Không quay lại `group/groupMember/evaluation` architecture.
- Chạy regression gate trước khi kết thúc batch.

---

## Progress note 2026-04-01

- Batch 1 (encoding) da xong va regression pass.
- Batch 3 da lam truoc 2 muc nho:
  - them status field cho ProjectPeriod form
  - them semester filter cho ProjectOversight
- Batch tiep theo con lai: switch registration toggle can quyet dinh mo hinh du lieu truoc khi code.

---

## Hotfix note 2026-04-01

- Da gap loi runtime toggle: `Unknown argument registrationOpen`.
- Da khac phuc bang:
  - `npx prisma generate`
  - `npx prisma migrate deploy`
- Batch tiep theo van giu uu tien: test + release checklist cho Prisma changes.
