# Hướng Dẫn Phát Triển Dự Án DACN (CLAUDE.md)

Đây là tài liệu chỉ dẫn trung tâm cho Claude Code và các AI Agent khi làm việc trên repository `DACN`.

---

## 1. Giới Thiệu Dự Án

Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp – Viện Công nghệ Số.
- **Frontend SPA**: React 19 + Vite + Ant Design + Tailwind + Zustand (`frontend/`).
- **Backend API**: Node.js + Express + Prisma + PostgreSQL (Supabase) + JWT (`backend/`).
- **Lưu trữ File**: Supabase Storage Bucket.

---

## 2. Hệ Thống Tài Liệu Quy Tắc (Rules)

Tài liệu chi tiết được tổ chức dạng module tại thư mục `.agents/rules/`:

1. **[Quy trình Nghiệp vụ Thực tế & Số hóa](file:///d:/DACN/.agents/rules/01-business-workflow.md)**: Chi tiết toàn bộ 6 giai đoạn (Đăng ký, BM01 -> BM04, Hội đồng xét duyệt & Hội đồng chấm bảo vệ, nộp lưu chiểu).
2. **[Kiến trúc Dữ liệu & Mô hình CSDL](file:///d:/DACN/.agents/rules/02-data-architecture.md)**: Mô hình `TopicRegistration`, `TaskType`, `CouncilType`, cơ chế Hybrid Form + Upload file đính kèm.
3. **[Phân Quyền & Quản trị Người Dùng (RBAC)](file:///d:/DACN/.agents/rules/03-roles-and-permissions.md)**: 3 vai trò cơ sở (`ADMIN`, `LECTURER`, `STUDENT`) và các nhóm quyền chức vụ (`VIEN_TRUONG`, `GVHD`, `QUAN_TRI_VIEN`).
4. **[Quy Chuẩn Phát Triển & Lệnh Thao Tác](file:///d:/DACN/.agents/rules/04-development-guidelines.md)**: Hướng dẫn lệnh chạy dev, build, test và các nguyên tắc code.

---

## 3. Tóm Tắt Quy Trình Nghiệp Vụ Chuẩn

```text
1. Chuẩn bị (Homepage: Công bố DS SV, GVHD & Hướng nghiên cứu)
   └── Sinh viên đăng ký đề tài với GVHD (Tối đa 10 SV/GVHD, 1 SV/đề tài)
2. Đề cương & Xét duyệt
   ├── Nộp Đề cương BM01 -> Hội đồng xét duyệt đề cương (OUTLINE_REVIEW)
   └── Tinh chỉnh & Nộp Đơn đăng ký đề tài chính thức BM02 -> Hiệu trưởng ký duyệt
3. Thực hiện đề tài (~3 tháng)
   └── GVHD theo dõi tiến độ BM03 (Nhiều buổi định kỳ + 2 đợt Checkpoint chính)
4. Đánh giá trước bảo vệ
   └── GVHD lập Phiếu nhận xét BM04 (Bắt buộc duyệt BM04 mới được xếp vào Hội đồng bảo vệ)
5. Hội đồng chấm bảo vệ (DEFENSE_COUNCIL)
   └── 3 thành viên (Chủ tịch, Thư ký, Phản biện) chấm độc lập -> Điểm trung bình cộng
6. Hoàn thiện sau bảo vệ
   └── Chỉnh sửa theo góp ý & nộp quyển, file mềm, source code lưu chiểu
```

---

## 4. Nguyên Tắc Kỹ Thuật Quan Trọng

- **Biểu mẫu Hybrid**: Kết hợp lưu dữ liệu JSON có cấu trúc (`content`) để phục vụ thống kê, kiểm tra business rule tự động, đồng thời lưu file đính kèm (`fileUrl`) cho bản in có chữ ký scan/PDF.
- **Biểu mẫu động theo đợt**: Công bố linh hoạt qua bài đăng `PublicAnnouncement` trên Homepage kèm link tải file mẫu và link nộp.
- **Tài khoản nội bộ**: Do Admin tạo thủ công hoặc import từ file Excel danh sách SV/GV.
- **Cổng kết nối Supabase**: Sử dụng Session Pooler (port `6543`) trong `DATABASE_URL`.
- **Định dạng file**: Tất cả các file text/code phải lưu ở chuẩn **UTF-8 (no BOM)**.

---

## 5. Kế Hoạch Triển Khai Quy Trình Chuẩn Hóa Mới (Implementation Roadmap)

Chi tiết thiết kế và kế hoạch đã được phê duyệt tại:
- **Tài liệu thiết kế kiến trúc**: [2026-10-19-thesis-workflow-redesign-design.md](file:///d:/DACN/docs/superpowers/specs/2026-10-19-thesis-workflow-redesign-design.md)
- **Kế hoạch triển khai chi tiết**: [2026-10-19-thesis-workflow-implementation-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-10-19-thesis-workflow-implementation-plan.md)

### Thứ tự thực hiện (Theo nguyên tắc "Sửa gốc vấn đề trước"):
1. **Giai đoạn 1 (CSDL)**: Cập nhật Enum `RegistrationStatus` (11 trạng thái), tạo bảng `TopicTitleAdjustment`, hoàn thiện bảng `BM04Evaluation` (khóa chặt theo `periodId`, lưu 4 tiêu chí và khóa vĩnh viễn sau khi ký).
2. **Giai đoạn 2 (Backend API)**: API xét duyệt lại đề cương BM01 (Chủ tịch HĐ chấm Chưa đạt -> SV sửa -> GVHD duyệt đạt); API nộp BM02 & Trưởng Viện ra QĐ; API đổi tên đề tài trong 7 ngày (GVHD duyệt); API BM03 Checkpoint 1 & 2 (Đạt / Không đạt dừng đồ án); API BM04 GVHD ký khóa & tự động mở `DEFENSE_READY`.
3. **Giai đoạn 3 (Frontend UI/UX)**: Nâng cấp Student Dashboard, Lecturer Dashboard, Progress Tracking, Modal nộp BM04 chuyên biệt 4 tiêu chí và Council Assignment (lọc theo `DEFENSE_READY`).
4. **Giai đoạn 4 (Verification & Build)**: Chạy test API, kiểm thử build frontend `npm run build` không lỗi.

---

## 6. Cập Nhật Phiên Làm Việc (Session Update)

### 1. Những phần đã hoàn thành
- **Hoàn thành trọn vẹn 4 Giai đoạn Chuẩn hóa Quy trình Đồ án tốt nghiệp (Thesis Workflow Redesign)**:
  1. **Giai đoạn 1 (CSDL & Prisma Schema)**:
     - Mở rộng enum `RegistrationStatus` lên 11 trạng thái chuẩn hóa, phản ánh đúng chu kỳ đời sống đồ án.
     - Tạo model mới `TopicTitleAdjustment` lưu vết lịch sử đổi tên đề tài trong khung thời gian 7 ngày.
     - Nâng cấp model `BM04Evaluation` gắn chặt theo đợt (`semesterId`), lưu trữ 4 tiêu chí đánh giá bắt buộc và cờ bất biến `isLocked = true`.
     - Bổ sung `decisionNumber`, `decisionDate`, `adjustedTitle` vào `TopicRegistration`. Đã đồng bộ schema và sinh Prisma Client thành công.
  2. **Giai đoạn 2 (Backend API & Controllers)**:
     - `evaluationController.js`: Viết API nộp lại đề cương BM01 (`resubmitBM01`), GVHD thẩm định lại đề cương (`approveResubmittedBM01`), và nộp phiếu BM04 đánh giá 4 tiêu chí kèm khóa bất biến (`submitBM04Evaluation`).
     - `registrationController.js`: Thêm API nộp BM02 với guard chặn nộp nếu BM01 chưa Đạt (`submitBM02`); API nộp đơn đổi tên trong 7 ngày (`requestTitleAdjustment`) và GVHD duyệt đổi tên (`reviewTitleAdjustment`).
     - `semesterController.js`: Viết API ban hành Quyết định giao đề tài kèm danh sách (`issuePeriodDecision`), tự động sinh mốc Checkpoint BM03.
     - `taskController.js`: Triển khai cơ chế dừng đề tài tức thì (`TERMINATED_FAILED_PROGRESS`) khi Checkpoint BM03 bị chấm Không đạt (`FAILED`).
     - `councilController.js`: Chặn xếp Hội đồng bảo vệ nếu sinh viên chưa có trạng thái `DEFENSE_READY` (BM04 Đồng ý).
  3. **Giai đoạn 3 (Frontend UI/UX & Triệt tiêu Bypass)**:
     - Tạo mới `TitleAdjustmentModal.jsx` (đếm ngược 7 ngày) và `BM04EvaluationModal.jsx` (form 4 tiêu chuẩn, tính điểm, ký số, khóa vĩnh viễn).
     - Nâng cấp `StudentDashboardPage.jsx` và `SubmissionPage.jsx`: Thể hiện quy trình 6 bước khóa tuần tự, card BM04, banner đổi tên 7 ngày, cảnh báo BM01 cần sửa và alert dừng đề tài.
     - Nâng cấp `LecturerDashboardPage.jsx`, `ProgressTrackingPage.jsx`, `StudentProgressDetailPanel.jsx`, `BMReviewDrawer.jsx`: Tích hợp modal duyệt đổi tên đề tài, modal chấm BM04, chấm 2 Checkpoint Đạt / Không đạt.
### 1. Những phần đã hoàn thành
1. **Phân hệ Quản trị Tiêu chí Rubric Chấm điểm Bảo vệ (Admin Defense Rubric Customization)**:
   - **Giai đoạn 1 (Database & Prisma Schema)**:
     - Tạo Enum `RubricStatus`: `DRAFT`, `ACTIVE`, `ARCHIVED`.
     - Tạo Model `RubricVersion` (phiên bản, tiêu đề, trạng thái, `isActive`, `totalMaxScore`), `RubricCategory` (nhóm mục lớn, `maxScore`, `orderIndex`), `RubricCriterion` (tiêu chí con, `maxScore`, `orderIndex`, mô tả tiêu chuẩn cấp độ).
     - Đồng bộ CSDL với `npx prisma db push` và `npx prisma generate`.
     - Khởi tạo seed data phiên bản `v1` chuẩn hóa (4 nhóm mục, 14 tiêu chí con, tổng 10.0đ, `isActive: true`) bảo toàn 100% dữ liệu lịch sử các khóa trước.
   - **Giai đoạn 2 (Backend Services, API Controllers & Integration)**:
     - Xây dựng `rubricService.js` với business guard `checkCanEditRubric()`: tự động phát hiện học kỳ đang diễn ra hoặc đã qua ngày bắt đầu để khóa chỉnh sửa Rubric bảo vệ tính công bằng.
     - Hàm `validateRubricStructure()`: kiểm tra tổng điểm tiêu chí con = điểm mục; tổng điểm các mục = chính xác 10.0đ.
     - Xây dựng `rubricController.js` và route `/api/rubrics` đầy đủ 8 endpoints CRUD, phân quyền chặt chẽ.
     - Tích hợp Rubric động vào `evaluationController.js`: nạp barem động và xác thực điểm theo phiên bản Rubric thực tế của đề tài.
     - Tạo test suite `backend/tests/integration/rubricRoutes.test.js` (4/4 test PASS). Toàn bộ 20/20 test suites (95/95 tests) đều PASS 100%.
   - **Giai đoạn 3 (Frontend Admin Rubric Management)**:
     - Xây dựng `frontend/src/services/rubricService.js` kết nối toàn bộ API Rubric.
     - Thêm route `/admin/rubric-management` và menu item "Tiêu chí chấm (Rubric)" trên Sidebar Admin.
     - Xây dựng trang [RubricManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/RubricManagementPage.jsx) với Banner trạng thái khóa/mở, bảng danh sách phiên bản, modal Nhân bản (Clone), và Drawer soạn thảo Barem với bộ đếm điểm thời gian thực.
   - **Giai đoạn 4 (Frontend Chấm điểm động Giảng viên & Admin)**:
     - Nâng cấp [LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx): loại bỏ mảng cứng 14 mã và HTML regex tĩnh; render bảng chấm điểm động theo nhóm mục, tính tổng điểm thời gian thực, hỗ trợ in A4 chuẩn hành chính và xuất PDF.
     - Nâng cấp [GradingDefensePage.jsx](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx): bảng xem điểm của Admin hiển thị gắn thẻ Nhóm mục lớn (Category Tag) trực quan.
   - **Giai đoạn 5 (Kiểm thử, Nghiệm thu & Tài liệu)**:
     - `npm run build` trên Frontend thành công 100% (0 lỗi biên dịch).
     - `npm test` trên Backend PASS 20/20 test suites (95/95 tests).
     - Cập nhật quy chuẩn Mục 4 trong `.agents/rules/01-business-workflow.md`.

### 2. Trạng thái cập nhật của từng phần
- **Database**: `PASS` (Supabase PostgreSQL hoạt động ổn định, schema đã có bảng `rubric_versions`, `rubric_categories`, `rubric_criteria`).
- **Backend API**: `PASS` (20/20 test suites / 95 tests đều PASS, dev server port 5000 chạy ổn định).
- **Frontend SPA**: `PASS` (`npm run build` thành công trong 15.73s, dev server port 5173 chạy mượt mà).
- **Kiểm thử nghiệm thu (E2E Integration)**: `PASS` (100% test cases rubric và workflow đều được xác thực tự động).
- **Tài liệu quy tắc**: `PASS` (Đã cập nhật chuẩn hóa trong `.agents/rules/01-business-workflow.md` và `CLAUDE.md`).

### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm tra trải nghiệm người dùng thực tế trên trình duyệt**:
   - Dùng tài khoản Admin truy cập `http://localhost:5173/admin/rubric-management` để kiểm tra giao diện quản lý phiên bản và trình soạn thảo Rubric.
   - Dùng tài khoản Giảng viên truy cập phiếu chấm điểm để trải nghiệm giao diện chấm điểm động theo nhóm mục và in phiếu A4.
2. **Xuất báo cáo & In ấn**:
   - Hoàn thiện template in ấn PDF chuẩn hành chính của trường có mã QR xác thực kết quả chấm.

### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Quản lý toàn hệ thống theo Phiên bản (Global Versioning)**: Sử dụng các phiên bản `v1`, `v2`, `v3`... với 1 phiên bản `ACTIVE`. Điều này giúp hệ thống lưu trữ lịch sử chấm điểm bất biến (các khóa trước đã chấm theo `v1` vĩnh viễn không bị sai lệch điểm khi áp dụng barem mới).
2. **Cấu trúc phân cấp 2 tầng (Hierarchical Categories & Criteria)**: Nhóm các tiêu chí con vào các Nhóm mục lớn (vd: Hình thức, Nội dung & kết quả, Thuyết trình & phản biện), phản ánh đúng thực tế barem đánh giá của Hội đồng chấm khóa luận tốt nghiệp.
3. **Ràng buộc điểm học thuật nghiêm ngặt**: Tổng điểm các tiêu chí trong mục = điểm mục; tổng điểm các mục = chính xác 10.0đ. Giao diện có bộ đếm thời gian thực và khóa nút Lưu nếu chưa đúng 10.0đ.
4. **Business Guard (Khóa an toàn)**: Chỉ cho phép chỉnh sửa hoặc kích hoạt Rubric khi **chưa vào đợt đồ án** (học kỳ `UPCOMING` hoặc trước ngày `startDate`). Khi học kỳ chuyển sang `ONGOING`, `DEFENSE` hoặc sau `startDate`, hệ thống tự động khóa sang chế độ Chỉ đọc (Read-only) nhằm đảm bảo tính công bằng học vụ.


