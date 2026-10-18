# Kế Hoạch Triển Khai Chi Tiết: Chuẩn Hóa Quy Trình Đồ Án Tốt Nghiệp (BM01 - BM04 & Bảo Vệ)

- **Ngày lập**: 19/10/2026
- **Tài liệu tham chiếu thiết kế**: [2026-10-19-thesis-workflow-redesign-design.md](file:///d:/DACN/docs/superpowers/specs/2026-10-19-thesis-workflow-redesign-design.md)
- **Nguyên tắc kỹ thuật**: Sửa từ gốc CSDL/Prisma ➔ Backend API/Controller/Route ➔ Frontend UI/UX. Chuẩn UTF-8 (no BOM).

---

## Giai Đoạn 1: Cơ Sở Dữ Liệu & Prisma Schema (CSDL)

### 1.1 Cập nhật Enum và Models trong `prisma/schema.prisma`
- [ ] Cập nhật Enum `RegistrationStatus` với đầy đủ 11 trạng thái chuẩn:
  - `REGISTERED`, `BM01_SUBMITTED`, `BM01_NEEDS_REVISION`, `BM01_PASSED`, `BM02_SUBMITTED`, `DECISION_ISSUED`, `IN_PROGRESS_BM03`, `BM03_PASSED`, `DEFENSE_READY`, `DEFENDED`, `TERMINATED_FAILED_PROGRESS`, `REJECTED`.
- [ ] Bổ sung Model `TopicTitleAdjustment`:
  - Quan hệ với `TopicRegistration`, các trường `originalTitle`, `newTitle`, `reason`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `reviewedById`, `reviewedAt`, `deadline`.
- [ ] Bổ sung / Cập nhật Model `BM04Evaluation`:
  - Khóa chặt vào `periodId`, `studentId`, `lecturerId`, `registrationId`.
  - 4 tiêu chí JSON/String: `thesisFormatScore`, `researchContentScore`, `applicabilityScore`, `attitudeScore`.
  - Kết luận `BM04Conclusion` (`AGREED_FOR_DEFENSE`, `NOT_AGREED`), `lecturerSignature`, `signedAt`, `isLocked = true`.

### 1.2 Đồng bộ Schema và Prisma Client
- [ ] Chạy `npx prisma db push` (hoặc migrate tương thích với Supabase).
- [ ] Chạy `npx prisma generate` trong thư mục `backend/` và kiểm tra kết nối CSDL.

---

## Giai Đoạn 2: Backend API, Controllers & Services (Backend)

### 2.1 Xử lý Pha Đề cương BM01 & Duyệt lại (BM01 Re-review)
- [ ] `backend/src/controllers/evaluationController.js`:
  - Cập nhật hàm đánh giá của Chủ tịch HĐ Đề cương: Nếu Đạt ➔ `BM01_PASSED`; Nếu Chưa đạt/Vắng ➔ `BM01_NEEDS_REVISION`.
  - Viết API `POST /api/evaluations/bm01-resubmit/:registrationId`: Sinh viên nộp lại đề cương đã chỉnh sửa.
  - Viết API `POST /api/evaluations/bm01-gvhd-approve/:registrationId`: GVHD xác nhận đề cương nộp lại đạt yêu cầu ➔ Chuyển sang `BM01_PASSED`.

### 2.2 Xử lý Pha BM02 & Quyết định Giao đề tài của Viện
- [ ] `backend/src/controllers/registrationController.js`:
  - Ràng buộc: Chỉ cho phép nộp BM02 khi trạng thái là `BM01_PASSED`. Nộp xong ➔ `BM02_SUBMITTED`.
- [ ] `backend/src/controllers/periodController.js`:
  - Viết API `POST /api/admin/periods/:periodId/issue-decision`: Trưởng Viện ban hành Quyết định giao đề tài kèm danh sách sinh viên nộp BM02.
  - Tự động gán mã quyết định, ngày ban hành và chuyển trạng thái các đề tài sang `DECISION_ISSUED`.
  - Kích hoạt thời hạn 7 ngày điều chỉnh tên đề tài.

### 2.3 Xử lý Pha Điều chỉnh Tên đề tài (Cửa sổ 7 ngày)
- [ ] `backend/src/controllers/registrationController.js`:
  - Viết API `POST /api/registrations/adjust-title`: Sinh viên gửi đơn xin đổi tên đề tài. Kiểm tra điều kiện thời gian <= 7 ngày tính từ ngày Quyết định.
  - Viết API `PUT /api/registrations/adjust-title/:id/review`: GVHD phê duyệt / từ chối đơn.
  - Khi GVHD duyệt: Cập nhật tên đề tài mới cho đợt học vụ, đồng thời lưu vết vào `TopicTitleAdjustment`.

### 2.4 Xử lý Pha Thực hiện BM03 (2 Checkpoint Bắt buộc)
- [ ] `backend/src/controllers/taskController.js`:
  - Viết/cập nhật API đánh giá Checkpoint 1 & Checkpoint 2: Chỉ nhận 2 giá trị `PASSED` hoặc `FAILED`.
  - Nếu bất kỳ Checkpoint nào `FAILED`: Chuyển ngay trạng thái đề tài sang `TERMINATED_FAILED_PROGRESS` (Dừng làm đề tài).
  - Nếu cả 2 Checkpoint `PASSED`: Chuyển trạng thái sang `BM03_PASSED`.

### 2.5 Xử lý Pha BM04 & Tự động Mở Bảo vệ
- [ ] `backend/src/controllers/evaluationController.js`:
  - Viết API `POST /api/evaluations/bm04-submit`: GVHD nộp phiếu BM04 với 4 tiêu chí + kết luận + chữ ký.
  - Kiểm tra điều kiện tiên quyết: Bắt buộc `BM03_PASSED` mới được nộp BM04.
  - Sau khi lưu: Khóa vĩnh viễn (`isLocked = true`), cấm sửa đổi.
  - Nếu kết luận là `AGREED_FOR_DEFENSE`: Tự động cập nhật trạng thái đề tài sang `DEFENSE_READY`.
  - Viết API `GET /api/evaluations/bm04/:registrationId`: Xem phiếu BM04 ở chế độ chỉ đọc.
- [ ] `backend/src/controllers/councilController.js`:
  - Cập nhật API lấy danh sách sinh viên đủ điều kiện xếp Hội đồng bảo vệ: Chỉ trả về sinh viên có trạng thái `DEFENSE_READY`.

---

## Giai Đoạn 3: Giao Diện Người Dùng & Tích Hợp Frontend (Frontend UI/UX)

### 3.1 Portal Sinh Viên (Student UI)
- [ ] `frontend/src/pages/student/StudentDashboardPage.jsx`:
  - Cập nhật thanh tiến trình 5 chặng theo đúng máy trạng thái mới.
  - Bổ sung Banner đếm ngược 7 ngày điều chỉnh tên đề tài sau khi có Quyết định.
- [ ] `frontend/src/components/student/BMSubmissionViewer.jsx`:
  - Bổ sung nút & form "Nộp lại đề cương BM01 đã chỉnh sửa" khi trạng thái là `BM01_NEEDS_REVISION`.
  - Khóa nộp BM02 nếu BM01 chưa `BM01_PASSED`.
  - Xem phiếu BM04 đã được GVHD ký duyệt (Read-only view).
- [ ] Tạo mới Component `frontend/src/components/student/TitleAdjustmentModal.jsx`: Modal gửi đơn xin điều chỉnh tên đề tài.

### 3.2 Portal Giảng Viên Hướng Dẫn (Lecturer UI)
- [ ] `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`:
  - Bổ sung Tab / Danh sách: "Đề cương BM01 cần thẩm định lại" (cho phép GVHD bấm duyệt đạt).
  - Bổ sung Danh sách đơn xin đổi tên đề tài cần duyệt (duyệt/từ chối).
- [ ] `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`:
  - Cập nhật modal chấm Checkpoint 1 & 2: 2 nút bấm Đạt / Không đạt (kèm thông báo cảnh báo dừng đồ án nếu không đạt).
- [ ] Tạo mới Component `frontend/src/components/lecturer/BM04EvaluationModal.jsx`:
  - Form chuyên biệt 4 tiêu chí: Hình thức, Nội dung, Tính ứng dụng, Thái độ.
  - Tick chọn: "ĐỒNG Ý cho ra bảo vệ" / "KHÔNG ĐỒNG Ý".
  - Chữ ký xác nhận và nút nộp khóa phiếu vĩnh viễn.

### 3.3 Portal Quản Trị Viên & Trưởng Viện (Admin/Dean UI)
- [ ] `frontend/src/pages/admin/ProjectPeriodPage.jsx` & `ProjectOversightPage.jsx`:
  - Bổ sung nút bấm "Ký duyệt & Ban hành Quyết định giao đề tài" cho Trưởng Viện.
  - Loại bỏ hoàn toàn các nút/nhãn liên quan đến "Bypass".
- [ ] `frontend/src/pages/admin/CouncilAssignmentPage.jsx`:
  - Tách bạch 2 Tab: Tab 1 "HĐ Xét duyệt đề cương", Tab 2 "HĐ Chấm bảo vệ".
  - Tab 2 tự động chỉ hiển thị các sinh viên có trạng thái `DEFENSE_READY` để xếp vào Hội đồng chấm.

---

## Giai Đoạn 4: Kiểm Thử, Nghiệm Thu & Cập Nhật Tài Liệu (Verification)

- [x] Chạy `npm run build` trên thư mục `frontend/` để bảo đảm zero lint/build error.
- [x] Kiểm thử Backend API luồng tích hợp:
  - [x] Thử nộp BM02 khi chưa đạt BM01 (bị từ chối 400).
  - [x] Thử nộp đơn đổi tên đề tài sau ngày thứ 8 (bị từ chối 400).
  - [x] Thử đánh giá Checkpoint Không đạt (đề tài dừng ngay lập tức `TERMINATED_FAILED_PROGRESS`).
  - [x] Thử sửa BM04 sau khi đã ký (bị chặn 400).
  - [x] Đánh giá BM04 ĐỒNG Ý (tự động chuyển `DEFENSE_READY` và khóa vĩnh viễn `isLocked: true`).
- [x] Cập nhật tài liệu quy tắc [01-business-workflow.md](file:///d:/DACN/.agents/rules/01-business-workflow.md) và [CLAUDE.md](file:///d:/DACN/CLAUDE.md).
