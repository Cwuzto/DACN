# NEXT_STEPS.md

## Việc nên làm ngay ở phiên tiếp theo

### Ưu tiên 1 - Hoàn thiện các màn admin còn mock

- Thay mock data bằng API thật ở `frontend/src/pages/admin/DashboardPage.jsx`
- Thay mock data bằng API thật ở `frontend/src/pages/admin/NotificationCenterPage.jsx`
- Rà `frontend/src/pages/admin/ProjectOversightPage.jsx`
- Rà phần hardcode còn lại trong `frontend/src/pages/admin/ProjectPeriodPage.jsx`

### Ưu tiên 2 - Chuẩn hóa frontend service layer

- Rà toàn bộ `frontend/src/services/`
- Xác nhận service nào còn lệch contract so với `api.js`
- Đồng bộ cách xử lý lỗi giữa các service

### Ưu tiên 3 - Hoàn thiện UX quản trị

- Cân nhắc tách `UserManagementPage` thành 3 route riêng:
  - `/admin/users/lecturers`
  - `/admin/users/admins`
  - `/admin/users/students`
- Hiển thị quota giảng viên rõ hơn trên UI:
  - ThS = 10
  - TS = 15
  - PGS = 20

### Ưu tiên 4 - Dọn kỹ thuật

- Sửa lỗi encoding tiếng Việt trong UI/message/log
- Biến smoke test thành checklist hoặc script tái chạy nhanh

---

## File nên mở đầu tiên khi bắt đầu lại

- `backend/src/constants/mentorCapacity.js`
- `backend/src/controllers/dashboardController.js`
- `backend/src/controllers/registrationController.js`
- `backend/src/controllers/topicController.js`
- `backend/src/controllers/taskController.js`
- `frontend/src/pages/admin/UserManagementPage.jsx`
- `frontend/src/pages/admin/DashboardPage.jsx`
- `frontend/src/pages/admin/NotificationCenterPage.jsx`
- `frontend/src/pages/admin/ProjectPeriodPage.jsx`
- `frontend/src/services/`

---

## Điều chưa cần làm ngay

- Chưa ưu tiên polish UI thêm nếu chưa thay mock bằng API thật
- Chưa mở rộng tính năng mới lớn
- Chưa làm tối ưu nâng cao nếu admin pages còn chưa bám dữ liệu thật

---

## Trạng thái checkpoint hiện tại

- Backend legacy `group` đã bị loại bỏ khỏi source
- Luồng chính E2E đã chạy pass
- Frontend lint đã sạch
- Có thể chuyển sang pha hoàn thiện admin features và chất lượng vận hành
