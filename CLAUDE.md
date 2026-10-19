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
1. **Chuẩn hóa Quy trình Đồ án Tốt nghiệp Mới (BM01 - BM04 & Hội đồng Bảo vệ)**:
   - CSDL: 11 trạng thái `RegistrationStatus`, model `TopicTitleAdjustment`, model `BM04Evaluation` (khóa bất biến `isLocked = true`).
   - Backend API: Nộp lại BM01 (`resubmitBM01`), GVHD duyệt lại BM01, nộp BM02 có guard, Ban hành Quyết định giao đề tài (`issuePeriodDecision`), cửa sổ 7 ngày đổi tên đề tài, cơ chế dừng đề tài tức thì khi trượt Checkpoint BM03 (`TERMINATED_FAILED_PROGRESS`), phiếu nhận xét BM04 4 tiêu chí.
   - Frontend UI/UX: Thanh tiến trình 6 bước, modal đổi tên 7 ngày, modal BM04, triệt tiêu 100% các nút và cơ chế Bypass.
2. **Tính Năng Ghi Nhớ Đăng Nhập & Sửa Lỗi Trắng Trang `/admin/oversight`**:
   - Ghi nhớ đăng nhập (Remember Me): Cấp JWT 30 ngày (nếu tick nhớ) hoặc 1 ngày (nếu không); lưu trữ hybrid giữa `localStorage` và `sessionStorage`; tự động điền email.
   - Sửa lỗi trắng trang `/admin/oversight`: Khắc phục `ReferenceError: pickNearestLatestSemesterId is not defined` bằng hàm chuẩn `computeSemesterClosestToNow`, bổ sung fallback học kỳ.
3. **Phân Hệ Quản Trị Tiêu Chí Rubric Chấm Điểm Bảo Vệ (Admin Defense Rubric Customization)**:
   - **Giai đoạn 1 (Database & Prisma Schema)**: Tạo Enum `RubricStatus`, Models `RubricVersion`, `RubricCategory`, `RubricCriterion`. Push schema lên Supabase và seed bản `v1` chuẩn hóa (4 nhóm mục, 14 tiêu chí con, tổng 10.0đ, `isActive: true`) bảo toàn lịch sử.
   - **Giai đoạn 2 (Backend Services, API Controllers & Integration)**: Xây dựng `rubricService.js` với business guard `checkCanEditRubric()` khóa khi học kỳ diễn ra; `validateRubricStructure()` kiểm tra tổng điểm = 10.0; route `/api/rubrics` 8 endpoints; tích hợp vào `evaluationController.js`. Test suite `rubricRoutes.test.js` PASS 100% (20/20 test suites / 95 tests).
   - **Giai đoạn 3 (Frontend Admin Rubric Management)**: Service `rubricService.js`, route `/admin/rubric-management`, menu item "Tiêu chí chấm (Rubric)". Trang [RubricManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/RubricManagementPage.jsx) với Banner trạng thái khóa/mở, bảng phiên bản, Clone modal, và Drawer soạn thảo với bộ đếm điểm thời gian thực.
   - **Giai đoạn 4 (Frontend Chấm điểm động Giảng viên & Admin)**: Nâng cấp [LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx) render bảng barem động theo nhóm mục, tính tổng điểm thời gian thực, in chuẩn A4 và xuất PDF; nâng cấp [GradingDefensePage.jsx](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx) gắn thẻ Nhóm mục.
   - **Giai đoạn 5 (Kiểm thử, Nghiệm thu & Tài liệu)**: `npm run build` thành công 100% (0 lỗi); `npm test` PASS 20/20 test suites; cập nhật quy chuẩn Mục 4 trong `.agents/rules/01-business-workflow.md`.

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


