# TOMORROW_PLAN.md

## Mục tiêu buổi làm việc tiếp theo

Đưa phần admin từ trạng thái "đã có khung" sang trạng thái "bám dữ liệu thật và dùng được ổn định".

---

## Thứ tự nên làm

1. Thay mock data bằng API thật ở admin pages
2. Rà toàn bộ `frontend/src/services/` để chốt contract
3. Cân nhắc tách `UserManagementPage` thành 3 route riêng
4. Dọn encoding tiếng Việt

---

## Điểm vào nhanh nhất

- `AGENTS.md`
- `PROJECT_STATE.md`
- `NEXT_STEPS.md`
- `DECISIONS.md`
- `frontend/src/pages/admin/UserManagementPage.jsx`
- `frontend/src/pages/admin/DashboardPage.jsx`
- `frontend/src/pages/admin/NotificationCenterPage.jsx`

---

## Ghi nhớ quan trọng

- Không quay lại mô hình `group/groupMember/evaluation`
- Quota giảng viên đã chốt:
  - ThS = 10
  - TS = 15
  - PGS = 20
- Luồng chính E2E đã pass, nên không cần quay lại sửa phần nền nếu không có bug mới
- Repo là nguồn nhớ chính cho các phiên tiếp theo
