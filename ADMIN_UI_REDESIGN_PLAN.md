# KẾ HOẠCH REDESIGN TOÀN DIỆN GIAO DIỆN VÀ TRẢI NGHIỆM (UI/UX) ROLE ADMIN
**Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp – Viện Công nghệ Số (DACN)**  
**Định hướng Visual:** *Nordic Institute (Bắc Âu / ETH Zurich)*  
**Mục tiêu cốt lõi:** Thoát khỏi giới hạn "reskinning màu sắc", tái cấu trúc sâu về **Bố cục (Layout Structure)**, **Phân cấp thông tin (Information Architecture)**, **Luồng tương tác (Interaction Flows)** và **Công thái học quản trị (Administrative Usability)**.

---

## 1. ĐẶT VẤN ĐỀ & NGUYÊN TẮC KIẾN TRÚC UI/UX MỚI

### 1.1. Bất Cập Của Giao Diện Hiện Tại
1. **Thiếu phân cấp ưu tiên tác vụ (Flat Information Hierarchy)**: Admin truy cập hệ thống không biết hôm nay cần xử lý việc gì gấp; các số liệu thống kê chỉ là số đếm tĩnh mà không liên kết tới hành động (actionable items).
2. **Bảng phẳng đơn điệu và mất ngữ cảnh (Context Loss)**: Muốn xem chi tiết một đề tài hay hồ sơ giảng viên phải mở Modal che khuất toàn bộ bảng hoặc chuyển trang, làm gián đoạn luồng làm việc.
3. **Thao tác thủ công, phân mảnh**: Phân công hội đồng hay phân bổ sinh viên cho GVHD bị phân tán qua nhiều dropdown chọn lẻ tẻ, không có góc nhìn đối chiếu hai chiều (Master-Detail).
4. **Thao tác hàng loạt (Batch Actions) yếu**: Khi cần duyệt 50 đề tài hay gửi cảnh báo chậm tiến độ, admin phải click từng dòng.

### 1.2. 5 Nguyên Tắc Thiết Kế UI Mới Cho Role Admin
1. **Command Center First (Mô hình Trung tâm Chỉ huy)**: Dashboard không chỉ trưng bày số liệu mà có ngay **Triage Queue (Hàng đợi khẩn cấp)** gồm các đề tài chờ duyệt, sinh viên nguy cơ quá hạn BM03, hội đồng chưa đủ thành viên.
2. **Context Preservation with Side Drawers**: Giữ vững vị trí cuộn trang của người dùng; mở chi tiết nội dung, lịch sử duyệt, hoặc form chỉnh sửa trong **Side Drawer (Ngăn kéo bên phải)** thay vì modal che khuất tầm nhìn.
3. **Master-Detail Two-Column Matcher**: Ở các màn hình ghép cặp (Phân công Hội đồng bảo vệ, Gán sinh viên cho GVHD), chia giao diện làm 2 cột: Cột nguồn (Chưa gán) và Cột đích (Đã gán kèm tải trọng), cho phép gán 1-click trực quan.
4. **Faceted Filter & Batch Action Bar**: Bổ sung thanh công cụ thao tác hàng loạt nổi (Floating Toolbar) khi chọn checkbox; bộ lọc phân loại theo Segmented Tabs (Tất cả / Chờ duyệt / Đã duyệt / Cần sửa).
5. **Ergonomic Data Density & Nordic Clarity**: Tối ưu mật độ hiển thị bảng biểu, sticky table header, màu trạng thái semantic rõ rệt trên nền canvas xám sương (`#F8FAFC`) và Alpine Teal (`#0F766E`).

---

## 2. QUY HOẠCH CHI TIẾT TỪNG MÀN HÌNH ROLE ADMIN

### Màn hình 1: Admin Dashboard (Trung tâm Điều hành & Tác chiến Học vụ)
- **Top Control Strip**:
  - Chọn đợt làm đồ án hiện hành (kèm badge: "Đang mở đợt" / "Giai đoạn: Nộp BM03").
  - Nút chuyển nhanh: "Xuất Báo Cáo Học Vụ", "Quét Cảnh Báo Trễ Hạn".
- **Triage Queue (Khối Hàng Đợi Khẩn Cấp - Xử lý ngay đầu ngày)**:
  - Thẻ 1 (Đỏ/Hồng Nordic): `14` Đề tài chờ Ban Chủ nhiệm duyệt gấp trước hạn chót.
  - Thẻ 2 (Vàng Hổ Phách): `28` Sinh viên có nguy cơ chậm nộp báo cáo tuần/BM03.
  - Thẻ 3 (Xanh Dương): `5` Hội đồng bảo vệ chưa đủ 3 thành viên theo quy chế.
- **Bố cục chính 2 Cột (68% / 32%)**:
  - **Cột Trái (68%)**:
    + *Interactive Milestone Stepper*: Chuỗi 5 giai đoạn đồ án (Đăng ký $\rightarrow$ Đề cương BM01/02 $\rightarrow$ Báo cáo BM03 $\rightarrow$ Thẩm định BM04 $\rightarrow$ Bảo vệ). Click từng mốc lọc ngay dữ liệu phía dưới.
    + *Biểu đồ/Thanh phân bổ Đề tài theo Bộ môn*: Đồ họa thanh ngang trực quan (CNTT, KTPM, HTTT, MMT).
    + *Bảng Đề tài Cần Giám Sát Trọng Điểm*: Danh sách rút gọn các đề tài có vấn đề về tiến độ.
  - **Cột Phải (32%)**:
    + *Live Activity Stream*: Dòng sự kiện thời gian thực (GV nộp điểm, SV nộp báo cáo, Admin phê duyệt).
    + *Quick Access Dock*: Phím tắt tới các biểu mẫu BM, import Excel, cấu hình phân quyền.

---

### Màn hình 2: Topic Management (Ngân hàng Đề tài & Thẩm định)
- **Segmented Status Bar**: Tab chuyển nhanh: *Tất cả (248) | Chờ duyệt (14) | Đã phê duyệt (210) | Yêu cầu sửa (18) | Đã đủ SV (196)*.
- **Faceted Filter Bar**: Ô tìm kiếm real-time + Lọc theo Bộ môn + Lọc theo GVHD + Lọc loại đề tài (Nghiên cứu / Ứng dụng).
- **Floating Batch Action Bar** (Xuất hiện khi tick $\ge 1$ checkbox):
  - "Duyệt hàng loạt (N đề tài)" | "Yêu cầu chỉnh sửa hàng loạt" | "Xuất danh sách Excel".
- **Enhanced Data Table**:
  - Cột Tên đề tài kèm Tag lĩnh vực.
  - Cột Giảng viên hướng dẫn kèm **chỉ số tải trọng** (ví dụ: `8/10 SV` kèm thanh tiến độ mini, cảnh báo đỏ nếu chạm mốc 10).
  - Cột Sinh viên thực hiện (Tuân thủ rule 1 SV / 1 đề tài, hiển thị mã SV + Họ tên).
  - Cột Trạng thái chuẩn Nordic semantic badge.
- **Side Drawer (Xem & Thẩm định chi tiết)**:
  - Khi click vào bất kỳ dòng nào: Trượt ngăn kéo 600px từ phải sang.
  - Hiển thị đầy đủ: Mục tiêu nghiên cứu, sản phẩm dự kiến, phạm vi công nghệ, tài liệu đính kèm.
  - Form thao tác của Admin ngay trong Drawer: Nút Duyệt, nút Từ chối kèm ô nhập lý do từ chối. Không cần rời khỏi bảng dữ liệu!

---

### Màn hình 3: Council Assignment (Phân công Hội đồng Bảo vệ)
- **Header & Rule Gatekeeper**:
  - Cảnh báo quy chế: Chỉ sinh viên **đạt BM04** mới được đưa vào phân công; GVHD **không được làm thành viên** hội đồng của sinh viên mình.
- **Bố cục Master-Detail Two-Column Matcher (40% / 60%)**:
  - **Cột Trái (40% - Nguồn sinh viên chưa gán)**:
    + Tìm kiếm SV theo tên, mã SV, chuyên ngành.
    + Danh sách thẻ SV: Họ tên, Tên đề tài, GVHD, Điểm BM04.
    + Trạng thái: "Sẵn sàng gán" hoặc "Chưa đủ điều kiện (Thiếu BM04)".
  - **Cột Phải (60% - Danh sách Hội đồng Bảo vệ)**:
    + Danh sách các thẻ Hội đồng (Ví dụ: Hội đồng 01 - KTPM; Hội đồng 02 - HTTT).
    + Thành phần: Chủ tịch, Thư ký, Ủy viên phản biện.
    + Thanh đo tải trọng: Ví dụ `4 / 5 Sinh viên`.
    + Danh sách các SV đã xếp vào hội đồng đó.
    + Thao tác: Nút "Gán nhanh" từ cột trái sang hoặc kéo-thả trực tiếp; nút "Xuất quyết định thành lập HĐ".

---

### Màn hình 4: User Management (Quản trị Nhân sự & Tài khoản)
- **Segmented Tabs**: *Tất cả (1,240) | Sinh viên (1,050) | Giảng viên (160) | Quản trị viên (30)*.
- **Workflow Import Excel Thông Minh (Multi-step Wizard Modal)**:
  - *Bước 1: Tải file & Chọn cấu hình* (Tải file mẫu, chọn xử lý trùng: Bỏ qua / Cập nhật).
  - *Bước 2: Phân tích & Validation Matrix* (Bảng preview client-side, đánh dấu đỏ dòng lỗi: sai email, trùng mã SV, thiếu chuyên ngành).
  - *Bước 3: Xác nhận & Lưu CSDL* (Hiển thị thống kê: Hợp lệ 148 dòng, Lỗi 2 dòng, cho phép commit dòng hợp lệ).
- **Profile Context Drawer**:
  - Click vào giảng viên: Drawer hiển thị thông tin liên hệ, học hàm/học vị, danh sách 8 sinh viên đang hướng dẫn đợt này kèm tiến độ từng bạn.
  - Click vào sinh viên: Drawer hiển thị đề tài đã đăng ký, GVHD, lịch sử nộp các biểu mẫu BM01 $\rightarrow$ BM04.

---

### Màn hình 5: Project Oversight & Defense (Giám sát Tiến độ & Chấm Bảo vệ)
- **Ma trận Theo dõi Biểu mẫu Toàn trường**:
  - Bảng tổng hợp trạng thái nộp biểu mẫu: BM01 (Đề cương), BM02 (Thẩm định đề cương), BM03 (Báo cáo tuần / Checkpoint 1 & 2), BM04 (Duyệt bảo vệ).
  - **Nút Duyệt Bypass Đề cương**: Cho phép Admin 1-click kích hoạt miễn BM01/02 cho các đề tài doanh nghiệp theo đúng quy chế.
- **Trung tâm Điểm & Khóa Sổ Hội đồng**:
  - Bảng điểm bảo vệ tổng hợp (Điểm Chủ tịch, Thư ký, Phản biện $\rightarrow$ Điểm trung bình cộng).
  - Nút công tắc an toàn: "Khóa Sổ Điểm Hội Đồng" (Chặn chỉnh sửa điểm sau khi công bố).
  - Xuất phiếu điểm và giấy chứng nhận hoàn thành đồ án (Clearance Certificate).

---

### Các Màn hình Bổ trợ Khác
- **Project Period (Đợt làm đồ án)**: Timeline trực quan kéo chỉnh ngày bắt đầu / kết thúc từng pha, toggle mở/đóng cổng đăng ký.
- **Project Enrollment (Gán môn đồ án)**: Giao diện đối chiếu sinh viên đủ tín chỉ và hạn mức hướng dẫn của từng giảng viên.
- **Announcement & Notification Center**: Trình soạn thảo phân loại đối tượng nhận tin (Tất cả, Giảng viên, Sinh viên) và xem trước bài viết chuẩn web học viện.
- **Permission Group**: Bảng ma trận checkbox phân quyền chức năng cho từng vai trò người dùng.

---

## 3. LỘ TRÌNH TRIỂN KHAI & CƠ CHẾ PROTOTYPE TRÊN OPENDESIGN

### Giai đoạn 1: Xây Dựng Bản Prototype Tương Tác Trên OpenDesign (Xem Trước Toàn Diện)
- **Mục tiêu**: Xây dựng phiên bản Prototype đa màn hình chuẩn HTML/CSS/JS tương tác ngay trên OpenDesign (`dacn_redesign.html` / cổng port `64222`).
- **Nội dung Prototype**:
  1. Thanh điều hướng chuyển đổi linh hoạt giữa các màn hình của Admin:
     - `Dashboard (Command Center)`
     - `Ngân hàng Đề tài (Topic Management)`
     - `Phân công Hội đồng (Council Matcher)`
     - `Quản lý Người dùng (User Management)`
     - `Giám sát & Chấm bảo vệ (Oversight & Defense)`
  2. Tích hợp đầy đủ các tương tác thực tế:
     - Click dòng trong bảng $\rightarrow$ Trượt mở **Side Drawer** xem chi tiết & thẩm định.
     - Click chuyển tab Segmented Filter $\rightarrow$ Lọc dữ liệu tức thì.
     - Bật thanh công cụ thao tác hàng loạt (Batch Action Toolbar) khi chọn checkbox.
     - Mô phỏng giao diện Master-Detail ghép cặp hội đồng 2 cột.
- **Nghiệm thu**: Người dùng mở trình duyệt kiểm tra trải nghiệm và đóng góp ý kiến.

### Giai đoạn 2: Hiện Thực Hóa Vào Codebase React
- Triển khai tuần tự theo mức độ ưu tiên từ lõi đến ngoại vi:
  - **Đợt 1 (P0)**: Admin Dashboard (`DashboardPage.jsx`) & Quản lý Đề tài (`TopicManagementPage.jsx`) với Side Drawer và Batch Action.
  - **Đợt 2 (P0)**: Phân công Hội đồng (`CouncilAssignmentPage.jsx`) với Two-Column Matcher & Quản lý Người dùng (`UserManagementPage.jsx`) với Wizard Import Excel.
  - **Đợt 3 (P1)**: Giám sát Tiến độ (`ProjectOversightPage.jsx`), Chấm Bảo vệ (`GradingDefensePage.jsx`), và Quản lý Đợt (`ProjectPeriodPage.jsx`).
  - **Đợt 4 (P2)**: Các trang tiện ích còn lại (`ProjectEnrollmentPage.jsx`, `AnnouncementManagementPage.jsx`, `NotificationCenterPage.jsx`, `PermissionGroupPage.jsx`).
- Chạy `npm run build` và kiểm thử tự động đảm bảo **0 lỗi biên dịch, giữ nguyên 100% logic API backend**.
