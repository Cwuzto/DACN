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
- **Sửa Lỗi Backend Controller (`archiveController.js`)**:
  - Khắc phục lỗi Prisma truy vấn `academicYear: true` trên model `Semester` (trường này không tồn tại trong schema Prisma).
  - Tự động tính toán năm học động dựa vào `startDate`/`endDate` hoặc fallback từ `semester.name`. Backend nodemon chạy ổn định không còn lỗi runtime.
- **Redesign Toàn Diện Giao Diện Quản Trị Viên (Role Admin) - Phong Cách Nordic Institute**:
  - Lập tài liệu kiến trúc giao diện [ADMIN_UI_REDESIGN_PLAN.md](file:///d:/DACN/ADMIN_UI_REDESIGN_PLAN.md) định hình 5 không gian làm việc chuẩn học thuật hiện đại, loại bỏ tư duy form thô cứng.
  - Xây dựng bản mẫu tương tác hoàn chỉnh tại [prototype_dacn_redesign.html](file:///d:/DACN/prototype_dacn_redesign.html) và đồng bộ sang OpenDesign:
    1. **Bảng Điều Khiển Tổng Quan (Dashboard)**: Tích hợp 3 thẻ công việc ưu tiên phân biệt màu rõ nét (Rose - Quá hạn / Amber - Cần thẩm định / Indigo - Thiếu thành viên HĐ), dùng từ ngữ học thuật hiện đại; tiến trình 5 chặng (0% bypass).
    2. **Cơ Chế Phê Duyệt Của Trưởng Viện (Dean Stage Approval)**: Bổ sung Banner và Modal duyệt đóng/mở giai đoạn học vụ dành riêng cho Trưởng Viện; loại bỏ hoàn toàn cơ chế bypass đề cương theo yêu cầu người dùng.
    3. **Tối Giản Điều Hướng**: Loại bỏ thanh chọn nhanh (quick-select pills), quy về 1 thanh điều hướng bên trái (Sidebar Navigation) đồng nhất và trực quan.
- **Phân Quyền Người Dùng Cá Nhân & Kiêm Nhiệm**:
  - Tại màn hình **Phân quyền vai trò**, phân chia thành 2 tab:
    - **Tab 1: Phân Quyền Người Dùng (Gán Theo Cá Nhân)**: Bảng danh bạ giảng viên/cán bộ hiển thị vai trò chính và tất cả nhóm quyền kiêm nhiệm (*Trưởng Bộ Môn*, *HĐ Thẩm Định*, *Chủ Tịch HĐ*).
    - **Side Drawer Phân Quyền Cá Nhân (`drawer-user-permission`)**: Cho phép chọn vai trò gốc hệ thống, gán nhiều nhóm quyền kiêm nhiệm và cấp quyền tùy biến (custom permission overrides).
    - **Tab 2: Ma Trận Quyền Của Các Nhóm Vai Trò**: Bảng ma trận quyền hạn hệ thống chuẩn.
- **Điều Phối Hội Đồng Tách Biệt 2 Giai Đoạn Độc Lập**:
  - Tại màn hình **Điều phối hội đồng**, phân tách thành 2 tab quy trình:
    - **Tab 1: HĐ Xét Duyệt Đề Cương (Pha 2 - BM01/02)**: Phân công 2 giảng viên thẩm định độc lập (không tính GVHD) thẩm định đề cương BM01, giao diện Master-Detail 2 cột (Đề tài chờ phân công bên trái, các tổ thẩm định bên phải).
    - **Tab 2: HĐ Chấm Bảo Vệ Khóa Luận (Pha 5)**: Phân bổ sinh viên đã đạt BM04 vào Hội đồng bảo vệ gồm 3 thành viên (Chủ tịch, Thư ký, UV Phản biện - loại trừ GVHD), kiểm soát tải trọng hội đồng và phòng chấm.

### 2. Trạng thái cập nhật của từng phần
- **Database**: `PASS` (Supabase PostgreSQL hoạt động ổn định).
- **Backend API**: `PASS` (Đã sửa lỗi `archiveController.js`, server chạy mượt mà trên port 5000).
- **Frontend SPA**: `PASS` (Vite dev server đang chạy trên port 5173).
- **Prototype Interactive**: `PASS` ([prototype_dacn_redesign.html](file:///d:/DACN/prototype_dacn_redesign.html) và OpenDesign đã đồng bộ, kiểm thử luồng Side Drawer và 2 loại Hội đồng thành công qua browser).
- **MCP Server**: `READY` (`supabase-postgres`).

### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Chuyển giao (Porting) từ Prototype sang React Codebase**:
   - Cập nhật [CouncilAssignmentPage.jsx](file:///d:/DACN/frontend/src/pages/admin/CouncilAssignmentPage.jsx): Bổ sung 2 tab HĐ Xét duyệt đề cương và HĐ Chấm bảo vệ, áp dụng bộ lọc sinh viên đạt BM04.
   - Cập nhật [PermissionGroupPage.jsx](file:///d:/DACN/frontend/src/pages/admin/PermissionGroupPage.jsx): Bổ sung tab Phân quyền cá nhân và Drawer gán quyền/kiêm nhiệm.
   - Cập nhật [DashboardPage.jsx](file:///d:/DACN/frontend/src/pages/admin/DashboardPage.jsx) và [ProjectOversightPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectOversightPage.jsx): Tích hợp Modal duyệt chuyển giai đoạn của Trưởng Viện, loại bỏ hoàn toàn các nút và nhãn Bypass.
2. **Kiểm thử và xác thực Build Frontend**:
   - Chạy `npm run build` trên thư mục `frontend/` để đảm bảo không có lỗi TypeScript/JSX/Linting.

### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Loại Bỏ Hoàn Toàn Cơ Chế Bypass**: Tuân thủ chỉ đạo của người dùng (*"về các giai đoạn của làm đồ án sẽ ko có việc by pass nữa"*), toàn bộ quy trình đi tuần tự BM01 -> BM02 -> BM03 -> BM04 -> Bảo vệ.
2. **Phân Quyền Độc Quyền Cho Trưởng Viện (Dean)**: Chỉ riêng Trưởng Viện có thẩm quyền bấm nút duyệt thông qua từng giai đoạn học vụ thông qua Modal xác nhận chuyên biệt.
3. **Mô Hình Hội Đồng 2 Giai Đoạn Độc Lập**: Tách biệt rõ HĐ Thẩm định đề cương (2 giảng viên thẩm định) và HĐ Chấm bảo vệ (3 thành viên, loại trừ GVHD) để phản ánh chính xác nghiệp vụ thực tế của Viện.
4. **Phân Quyền Cá Nhân Bằng Side Drawer**: Giúp thao tác gán vai trò kiêm nhiệm cho giảng viên diễn ra nhanh chóng, không bị mất ngữ cảnh danh sách và trực quan hơn so với việc cấu hình trong bảng ma trận thuần túy.


