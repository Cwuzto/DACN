# Kế Hoạch Triển Khai: Tùy Chỉnh Tiêu Chí Rubric Chấm Điểm Bảo Vệ Cho Quản Trị Viên (Admin)

- **Ngày lập**: 19/10/2026
- **Tài liệu tham chiếu thiết kế**: [2026-10-19-admin-rubric-customization-design.md](file:///d:/DACN/docs/superpowers/specs/2026-10-19-admin-rubric-customization-design.md)
- **Nguyên tắc kỹ thuật**: Sửa từ gốc CSDL/Prisma ➔ Backend Service & Controller ➔ Frontend UI/UX. Chuẩn UTF-8 (no BOM).

---

## Giai Đoạn 1: Cơ Sở Dữ Liệu & Prisma Schema (CSDL)

### 1.1 Cập nhật Enum và Models trong `backend/prisma/schema.prisma`
- [ ] Thêm Enum `RubricStatus`: `DRAFT`, `ACTIVE`, `ARCHIVED`.
- [ ] Thêm Model `RubricVersion`:
  - `id`, `version` (unique, e.g. "v1", "v2"), `title`, `description`, `totalMaxScore` (Float @default(10.0)), `status` (RubricStatus @default(DRAFT)), `isActive` (Boolean @default(false)), `createdById`, `createdAt`, `updatedAt`.
  - Quan hệ: `categories RubricCategory[]`, `createdByUser User?`.
- [ ] Thêm Model `RubricCategory`:
  - `id`, `rubricVersionId`, `code`, `name`, `description`, `maxScore` (Float), `orderIndex` (Int @default(0)), `createdAt`, `updatedAt`.
  - Quan hệ: `rubricVersion RubricVersion`, `criteria RubricCriterion[]`.
  - Ràng buộc: `@@unique([rubricVersionId, code])`, `@@index([rubricVersionId, orderIndex])`.
- [ ] Thêm Model `RubricCriterion`:
  - `id`, `categoryId`, `code`, `label`, `description` (Text), `maxScore` (Float), `orderIndex` (Int @default(0)), `createdAt`, `updatedAt`.
  - Quan hệ: `category RubricCategory`.
  - Ràng buộc: `@@index([categoryId, orderIndex])`.

### 1.2 Migration & Seed Data Khởi Tạo Phiên Bản `v1`
- [ ] Chạy `npx prisma db push` hoặc tạo migration cập nhật CSDL.
- [ ] Viết script seed data chuẩn hóa toàn bộ 14 tiêu chí của `RUBRIC_V1` hiện tại vào 4 danh mục với `version = 'v1'` và `isActive = true`:
  - Mục 1: Hình thức và kỹ năng trình bày báo cáo (1.0đ - STRUCTURE 0.5, CITATION_FORMAT 0.25, LANGUAGE 0.25).
  - Mục 2: Nội dung và kết quả nghiên cứu (5.0đ - PROBLEM_STATEMENT 1.0, RESEARCH_METHOD 0.5, RESEARCH_CONTENT 2.5, RESEARCH_RESULT 1.0).
  - Mục 3: Tính thời sự, ứng dụng và công bố (1.0đ - NOVELTY 0.25, APPLICABILITY 0.5, PUBLICATION 0.25).
  - Mục 4: Thuyết trình và trả lời câu hỏi Hội đồng (3.0đ - PRESENTATION_SKILL 0.5, ATTITUDE 0.5, PRESENTATION_CONTENT 1.0, QA_RESPONSE 1.0).
- [ ] Chạy `npx prisma generate` trong `backend/` và kiểm tra kết nối CSDL.

---

## Giai Đoạn 2: Backend Services, API Controllers & Tích Hợp (Backend)

### 2.1 Xây Dựng `backend/src/services/rubricService.js`
- [ ] Hàm `checkCanEditRubric()`:
  - Kiểm tra nếu có học kỳ nào ở trạng thái `ONGOING` hoặc `DEFENSE`, hoặc học kỳ hiện tại đã qua ngày `startDate` $\rightarrow$ trả về `canEdit: false` kèm thông báo lý do.
- [ ] Hàm `validateRubricStructure(categories)`:
  - Kiểm tra mỗi danh mục có ít nhất 1 tiêu chí.
  - Tổng điểm các tiêu chí trong mỗi mục phải đúng bằng điểm tối đa của mục.
  - Tổng điểm tất cả các mục phải chính xác bằng 10.0 điểm.
- [ ] Hàm CRUD cho Rubric:
  - `getRubricVersions()`: Lấy danh sách phiên bản kèm số mục, số tiêu chí, trạng thái và cờ `isEditable`.
  - `getActiveRubric()`: Lấy chi tiết phiên bản `ACTIVE` kèm danh mục và tiêu chí con (sắp xếp theo `orderIndex`).
  - `getRubricById(id)`: Lấy chi tiết phiên bản.
  - `createRubricVersion({ version, title, description, categories, cloneFromId, userId })`: Tạo mới hoặc clone từ phiên bản cũ.
  - `updateRubricVersion(id, { title, description, categories })`: Cập nhật cấu trúc (chặn nếu `canEdit` false hoặc đã kích hoạt trong đợt).
  - `activateRubricVersion(id)`: Kiểm tra ràng buộc điểm 10.0, kiểm tra `canEdit`, chuyển bản hiện tại sang `ACTIVE`, chuyển bản cũ sang `ARCHIVED`.
  - `deleteRubricVersion(id)`: Chỉ cho phép xóa bản `DRAFT`.

### 2.2 Xây Dựng `backend/src/controllers/rubricController.js` & Routes
- [ ] Tạo router `/api/v1/rubrics`:
  - `GET /api/v1/rubrics` (Admin, Lecturer)
  - `GET /api/v1/rubrics/active` (All Auth)
  - `GET /api/v1/rubrics/:id` (Admin)
  - `POST /api/v1/rubrics` (Admin)
  - `PUT /api/v1/rubrics/:id` (Admin)
  - `POST /api/v1/rubrics/:id/activate` (Admin)
  - `DELETE /api/v1/rubrics/:id` (Admin)
- [ ] Đăng ký router vào `backend/src/routes/api.js` hoặc `backend/src/app.js`.

### 2.3 Tích Hợp Vào `backend/src/controllers/evaluationController.js`
- [ ] `getScoreSheet(registrationId)`:
  - Lấy `scoreRubricVersion` đã ghi nhận trong hồ sơ hoặc phiên bản `ACTIVE`.
  - Nạp đầy đủ cấu trúc Mục và Tiêu chí con từ CSDL trả về cho Frontend thay vì biến cứng `RUBRIC_V1`.
- [ ] `saveScoreSheet(registrationId)`:
  - Xác thực điểm từng tiêu chí dựa trên `maxScore` thực tế trong CSDL của phiên bản tương ứng.
  - Lưu phiên bản vào `DefenseMemberScore.scoreRubricVersion`.

---

## Giai Đoạn 3: Frontend Admin Rubric Management (Admin UI)

### 3.1 Xây Dựng Service & Route Frontend
- [ ] Tạo `frontend/src/services/rubricService.js`:
  - Gọi các API `/api/v1/rubrics` (getVersions, getActive, getById, create, update, activate, delete).
- [ ] Thêm Route `/admin/rubric-management` trong `frontend/src/App.jsx`.
- [ ] Bổ sung Menu item **"Tiêu chí chấm điểm (Rubric)"** trong `frontend/src/layouts/AdminLayout.jsx`.

### 3.2 Xây Dựng Trang `frontend/src/pages/admin/RubricManagementPage.jsx`
- [ ] **Tab/View Danh Sách Phiên Bản (Version List)**:
  - Bảng danh sách các phiên bản: Mã (`v1`, `v2`), Tên, Trạng thái (Tag `ACTIVE` xanh lá, `DRAFT` cam, `ARCHIVED` xám), Tổng số mục, Tổng số tiêu chí, Ngày cập nhật.
  - Nút bấm: "Tạo phiên bản mới", "Nhân bản (Clone)", "Xem / Chỉnh sửa", "Kích hoạt", "Xóa nháp".
- [ ] **Modal / Form Trình Soạn Thảo Rubric (Rubric Editor)**:
  - Banner cảnh báo Khóa an toàn: Nếu `isEditable === false`, hiển thị Alert vàng thông báo hệ thống đang trong đợt đồ án và khóa toàn bộ input ở chế độ Read-only.
  - Thanh tổng hợp điểm thời gian thực (Real-time Score Counter):
    - Đếm tổng điểm các mục: `Tổng điểm hiện tại: X / 10.0`.
    - Cảnh báo màu đỏ nếu $X \ne 10.0$ và disable nút Lưu/Kích hoạt.
  - Khối danh mục (Categories):
    - Thêm/Xóa/Sắp xếp danh mục.
    - Sửa Tên danh mục, Điểm tối đa của danh mục.
    - Hiển thị tiến độ điểm: $\text{Tổng điểm tiêu chí con} / \text{Điểm tối đa mục}$.
  - Khối tiêu chí con (Criteria):
    - Thêm/Xóa tiêu chí trong từng danh mục.
    - Nhập Tên tiêu chí, Mã tiêu chí, Điểm tối đa.
    - Khung nhập Mô tả / Hướng dẫn đánh giá các mức độ (Xuất sắc, Tốt, Khá, TB...).

---

## Giai Đoạn 4: Frontend Chấm Điểm Động Cho Giảng Viên & Admin (Lecturer & Admin UI)

### 4.1 Cập Nhật `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`
- [ ] Loại bỏ mảng cứng `RUBRIC_CODES` và việc parse regex trên file `phieu_cham.html` tĩnh.
- [ ] Render bảng chấm điểm động:
  - Gom nhóm các tiêu chí theo từng Mục lớn (Category header row).
  - Từng dòng tiêu chí con hiển thị: STT, Tên tiêu chí & Mô tả đánh giá, Điểm tối đa, Ô nhập điểm `[0 - maxScore]`, Ghi chú.
  - Tự động cộng tổng điểm thời gian thực và kiểm tra tính hợp lệ trước khi lưu.
- [ ] Cập nhật chế độ In phiếu chấm / Xuất PDF:
  - Sinh template HTML in động theo đúng cấu trúc Mục và Tiêu chí của phiên bản Rubric được chấm.

### 4.2 Cập Nhật `frontend/src/pages/admin/GradingDefensePage.jsx`
- [ ] Cập nhật modal xem phiếu điểm (Score Sheet Rubric Modal):
  - Hiển thị theo nhóm Mục lớn $\rightarrow$ Tiêu chí con thay vì danh sách phẳng 14 dòng cứng.

---

## Giai Đoạn 5: Kiểm Thử Toàn Diện, Nghiệm Thu & Cập Nhật Tài Liệu (Verification)

### 5.1 Kiểm Thử Tích Hợp Backend (Integration Tests)
- [ ] Tạo file test `backend/tests/integration/rubricManagement.test.js`:
  - Test lấy danh sách và xem chi tiết Rubric `v1`.
  - Test tạo bản nháp `v2`, thêm mục, thêm tiêu chí con.
  - Test validation chặn khi tổng điểm $\ne 10.0$.
  - Test validation chặn chỉnh sửa khi học kỳ đang ở trạng thái `ONGOING` hoặc sau ngày `startDate`.
  - Test kích hoạt phiên bản thành `ACTIVE`.
  - Test chấm điểm bảo vệ đề tài với phiên bản Rubric mới thành công.

### 5.2 Kiểm Thử Biên Dịch & Chạy Thử
- [ ] Chạy `npm run build` trên thư mục `frontend/`, đảm bảo 0 lỗi biên dịch.
- [ ] Kiểm tra trực quan thao tác trên trình duyệt.

### 5.3 Cập Nhật Tài Liệu Quy Chuẩn
- [ ] Cập nhật quy tắc Rubric vào `.agents/rules/01-business-workflow.md`.
- [ ] Cập nhật mục `Session Update` trong [CLAUDE.md](file:///d:/DACN/CLAUDE.md).
