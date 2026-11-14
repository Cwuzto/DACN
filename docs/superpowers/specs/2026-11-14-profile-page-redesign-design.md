# Tài Liệu Thiết Kế: Tái Thiết Kế Trang Hồ Sơ Cá Nhân (Profile Page Redesign)

- **Mã thiết kế**: `SPEC-2026-11-14-PROFILE-REDESIGN`
- **Tác giả**: AI Agent & UI/UX Pro Max Intelligence
- **Ngày lập**: 14/11/2026
- **Trạng thái**: Draft / Chờ duyệt (Pending User Approval)
- **Tài liệu tham chiếu**: [CLAUDE.md](file:///d:/DACN/CLAUDE.md), [AGENTS.md](file:///d:/DACN/AGENTS.md), [ui-ux-pro-max](file:///d:/DACN/.agents/skills/ui-ux-pro-max/SKILL.md)

---

## 1. Bối Cảnh & Mục Tiêu

### 1.1. Hiện trạng
Trang Hồ sơ cá nhân (`frontend/src/pages/common/ProfilePage.jsx`) hiện tại có cấu trúc 2 cột cũ, tồn tại một số điểm hạn chế về mặt trải nghiệm:
- Bị lồng viền (`border border-slate-200` kép ở cột trái).
- Thiếu phân cấp thị giác: Không có ảnh bìa định danh (Hero Identity Banner), thiếu huy hiệu xác thực tài khoản chính thức.
- Thông tin học vụ nghèo nàn: Chưa nêu bật Lớp, Ngành, Đơn vị, các quyền hạn học vụ và phân công hội đồng của người dùng.
- Khu vực đổi mật khẩu bị dồn xuống đáy trang, thiếu thước đo độ mạnh mật khẩu (Password Strength Meter) và chỉ báo phiên làm việc.
- Trải nghiệm chuyển đổi chế độ chỉnh sửa gây xáo trộn bố cục.

### 1.2. Mục tiêu thiết kế
- Áp dụng triệt để phong cách **Minimalism & Swiss Style** kết hợp **Academic Enterprise** từ skill `/ui-ux-pro-max`.
- Xây dựng **Modern Academic Hero Banner** làm nổi bật danh tính học thuật của Sinh viên / Giảng viên / Quản trị viên Viện Công nghệ Số.
- Tích hợp thanh 4 thông số nhanh (Quick Metrics / KPI Bar): Trạng thái tài khoản, Định danh học vụ, Nhóm quyền hạn, Mức độ hoàn thiện hồ sơ.
- Tổ chức nội dung khoa học bằng **3 Tabs chuyển đổi mượt mà**:
  1. `personal_academic`: Thông tin cá nhân & Học vụ (Tách bạch giữa Dữ liệu học vụ cố định do CSDL Nhà trường quản lý và Dữ liệu liên lạc cá nhân được phép chỉnh sửa).
  2. `security_password`: Trung tâm bảo mật tài khoản & Đổi mật khẩu (Thước đo độ mạnh mật khẩu, quản lý phiên làm việc JWT, hướng dẫn an toàn).
  3. `roles_permissions`: Vai trò, Quyền hạn & Phân công học vụ (Hiển thị các nhóm quyền, phân công Hội đồng BM01/BM05, ủy quyền học vụ).
- Đảm bảo 100% tuân thủ quy chuẩn `AGENTS.md` (Rule 2.6 không emoji/ký tự thô trong nút bấm, Rule 2.4 UTF-8 no BOM, Rule 2.1 TopicRegistration, không mock data).
- Duy trì 100% tương thích ngược với các contract tests hiện có (`profilePage.test.js`, `queryMigrationAudit.test.js`).

---

## 2. Hệ Thống Design Tokens & Visual Hierarchy

| Thành phần | Mã màu / Token | Ý nghĩa / Ứng dụng |
| :--- | :--- | :--- |
| **Primary Brand** | `#2563EB` (`blue-600`) | Màu xanh tin cậy học thuật (Trust Blue), chủ đạo cho Header & Nút hành động |
| **Accent / Focus** | `#1D4ED8` (`blue-700`) | Trạng thái hover, active và điểm nhấn |
| **Academic Slate** | `#1E293B` (`slate-800`) | Tiêu đề chính, văn bản có trọng số cao |
| **Card Background**| `#FFFFFF` | Nền thẻ nổi khối, đổ bóng nhẹ `shadow-sm` |
| **Page Canvas** | `#F8FAFC` (`slate-50`) | Nền tổng thể trang web |
| **Subtle Border** | `#E2E8F0` (`slate-200`) | Đường kẻ phân tách viền mỏng tinh tế |
| **Success Status** | `#10B981` (`emerald-500`)| Trạng thái tài khoản hoạt động, điểm số đạt, mật khẩu mạnh |
| **Warning / Attention** | `#F59E0B` (`amber-500`)| Cảnh báo bảo mật, thông báo cập nhật |
| **Role Badges** | `purple` (Viện trưởng), `red` (Admin), `blue` (GVHD), `green` (Sinh viên) | Nhận diện vai trò người dùng chuẩn hóa |

---

## 3. Kiến Trúc Chi Tiết Giao Diện Trang Hồ Sơ

### 3.1. Hero Profile Banner (Thẻ Định Danh Học Thuật)
- **Dải nền bìa (Cover Banner)**: Dải gradient màu xanh học thuật thanh lịch (`from-blue-600 via-indigo-600 to-slate-800`) kết hợp hoa văn hình học vi mô.
- **Khu vực Avatar**:
  - Avatar tròn lớn (đường kính 112px - 128px), có viền trắng 4px tạo hiệu ứng nổi khối.
  - Chỉ báo trạng thái hoạt động trực tuyến (Badge status "success" màu xanh ngọc).
  - Khi bật chế độ chỉnh sửa: Hiển thị nút tròn chụp ảnh / tải ảnh (`<CameraOutlined />`) với tooltip trực quan.
- **Khối thông tin danh tính chính**:
  - Họ và tên dạng tiêu đề lớn (`text-2xl font-bold text-slate-900`).
  - Huy hiệu vai trò chính quy (`<Tag color={roleColor}>`) kèm thẻ định danh chính thức: `<Tag color="blue" icon={<CheckCircleOutlined />}>Định danh chính thức Viện CNS</Tag>`.
  - Các chip thông tin nhanh: Mã định danh (MSSV/CBGV), Email trường, Số điện thoại.
- **Hàng Thống Số Nhanh (Quick Metrics Bar - 4 KPI Cards)**:
  1. *Trạng thái tài khoản*: Kích hoạt / Đang hoạt động (`Active`).
  2. *Định danh học vụ*: Lớp & Ngành (cho SV); Đơn vị / Học hàm (cho GV/Admin).
  3. *Quyền hạn & Nhiệm vụ*: Số lượng nhóm quyền & phân công Hội đồng.
  4. *Mức độ hoàn thiện hồ sơ*: Tiến trình 100% với thanh màu sinh động.

---

### 3.2. Bố Cục 3 Tabs Chuyên Sâu

#### Tab 1: 📋 Thông tin cá nhân & Học vụ (`personal_academic`)
- **Khối A: Thông tin học vụ & Định danh (Read-Only - Nhà trường quản lý)**:
  - Trình bày dạng bảng mô tả thông tin thẻ (`Descriptions` / `Card` thanh lịch).
  - Các trường:
    * Họ và tên đầy đủ
    * Mã số định danh (MSSV đối với Sinh viên, Mã cán bộ đối với Giảng viên/Admin)
    * Vai trò hệ thống
    * Lớp sinh hoạt (đối với Sinh viên - `className`)
    * Chuyên ngành đào tạo (đối với Sinh viên - `major`)
    * Khoa / Viện trực thuộc (`Viện Công nghệ Số`)
  - Chú thích học vụ: Hộp thông báo màu lam nhạt (`<Alert type="info" />`) nêu rõ: *"Thông tin học vụ được đồng bộ trực tiếp từ Cơ sở dữ liệu Quản lý Đào tạo của Nhà trường. Nếu cần điều chỉnh, vui lòng liên hệ Ban Đào tạo & Khảo thí."*
- **Khối B: Thông tin liên lạc & Cá nhân (Cho phép cập nhật)**:
  - Số điện thoại liên lạc: Khi xem hiển thị văn bản rõ ràng; khi chỉnh sửa hiển thị ô Input kích thước lớn kèm icon điện thoại.
  - Email công vụ: Hiển thị email đã đăng ký.
  - Đơn vị / Bộ môn (chỉ Giảng viên/Admin mới được phép sửa; Sinh viên không có quyền sửa đơn vị).
  - Nút bấm cập nhật:
    * Nút *"Chỉnh sửa hồ sơ"* (`<EditOutlined />`).
    * Nút *"Lưu thay đổi"* (`<SaveOutlined />`), tự động vô hiệu hóa nếu không có thay đổi hoặc đang lưu.
    * Nút *"Hủy"* (`<CloseOutlined />`).

#### Tab 2: 🔐 Bảo mật & Quản lý phiên (`security_password`)
- **Khối Đổi mật khẩu**:
  - Ô nhập: Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới (Input.Password).
  - **Password Strength Meter (Thước đo độ mạnh mật khẩu)**:
    * Kiểm tra tự động: Tối thiểu 6 ký tự, có ký tự chữ và số, có ký tự đặc biệt/chữ hoa.
    * Thanh trạng thái 3 cấp độ: Yếu (Đỏ), Trung bình (Vàng cam), Mạnh (Xanh lục).
  - Nút *"Cập nhật mật khẩu"* (`<KeyOutlined />`) với loading spinner khi đang xử lý.
- **Khối Quản lý phiên làm việc & An toàn tài khoản**:
  - Thẻ thông tin phiên đăng nhập JWT (Thời gian hiệu lực, cơ chế ghi nhớ 30 ngày).
  - Hướng dẫn nguyên tắc bảo mật đồ án (Không tiết lộ tài khoản cho người khác; luôn đăng xuất khi sử dụng máy tính phòng Lab/thư viện).

#### Tab 3: 🛡️ Vai trò & Quyền hạn hệ thống (`roles_permissions`)
- Danh sách các nhóm quyền học vụ đang sở hữu (`permissionGroups`, e.g. `GVHD`, `QUAN_TRI_VIEN`, `SYSTEM_STUDENT_BASE`).
- Phân công tham gia Hội đồng học vụ (nếu có):
  * Hội đồng xét duyệt đề cương BM01 (`hasOutlineCouncilAssignment`).
  * Hội đồng chấm bảo vệ khóa luận BM05 (`hasDefenseCouncilAssignment`).
- Danh sách các quyền năng cụ thể (Capabilities / Permissions) được hiển thị dạng thẻ tag chuyên nghiệp.

---

## 4. Ràng Buộc Kỹ Thuật & Tính Toàn Vẹn Hệ Thống

1. **Tuân thủ quy chuẩn `AGENTS.md`**:
   - Rule 2.6: 100% nút bấm sử dụng prop `icon={<Icon />}` từ `@ant-design/icons`, không có emoji hoặc ký tự thô trong chuỗi nhãn.
   - Rule 2.4: 100% tệp tin lưu chuẩn UTF-8 without BOM.
   - Rule 2.3: 100% dữ liệu thực từ `useCurrentUser(scope)` và `authStore`, tuyệt đối không dùng mock data.
   - Rule 2.1: Không có bất kỳ logic nào dựa trên kiến trúc cũ `group/groupMember`.
2. **Bảo tồn API Backend**:
   - `authService.updateProfile({ avatarUrl, phone, department })`: Sinh viên chỉ gửi `avatarUrl` và `phone`; Giảng viên có thể gửi thêm `department`.
   - `authService.changePassword(currentPassword, newPassword)`.
   - `uploadService.uploadFile(file, 'avatars')`.
3. **Bộ test hồi quy đảm bảo**:
   - Duy trì pass 100% `frontend/tests/profilePage.test.js`.
   - Duy trì pass 100% `frontend/tests/queryMigrationAudit.test.js`.
   - Bổ sung bộ test hợp đồng UI/UX mới `frontend/tests/profilePageUiUx.test.js`.

---

## 5. Kế Hoạch Triển Khai Tiếp Theo

Sau khi tài liệu thiết kế này được duyệt:
1. Chuyển sang kỹ năng `writing-plans` để lập Kế hoạch triển khai chi tiết từng bước (TDD).
2. Viết kiểm thử hợp đồng UI/UX mới.
3. Tái cấu trúc và nâng cấp `ProfilePage.jsx`.
4. Chạy kiểm thử tự động, build kiểm tra và báo cáo kết quả.

