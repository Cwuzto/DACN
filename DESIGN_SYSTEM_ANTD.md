# TÀI LIỆU THIẾT KẾ HỆ THỐNG: ACADEMIC ENTERPRISE SAAS (ANT DESIGN)
## Cổng Quản Lý Khóa Luận & Đồ Án Tốt Nghiệp — Viện Công Nghệ Số (TDMU)

> **Phiên bản**: 2.0.0  
> **Nền tảng kỹ thuật**: React 19 + Ant Design 5/6 + Tailwind CSS (tiện ích phụ trợ) + Day.js (`vi_VN`)  
> **Nguyên tắc cốt lõi**: Chuẩn mực Doanh nghiệp (Enterprise SaaS), Tiết chế thị giác (No flashy gradients/glassmorphism), Trọng tâm học vụ và khả năng đọc tối đa.

---

## 1. DESIGN PRINCIPLES (Nguyên Tắc Thiết Kế)

1. **Academic Clarity (Tính Rõ Ràng Học Vụ)**:
   - Thông tin học vụ (mã đề tài, giảng viên, hạn nộp, biểu mẫu BM, điểm số) là trọng tâm hàng đầu.
   - Phân cấp thị giác rõ nét: H1 (Tiêu đề trang) → Card/Panel (Phân khu dữ liệu) → Table/List (Dữ liệu chi tiết) → Status Badges (Trạng thái tức thời).
   - Tuyệt đối không dùng dashboard nhồi nhét biểu đồ tròn/vòng vô nghĩa nếu không phục vụ việc ra quyết định học vụ của sinh viên hoặc quản trị viên.

2. **Enterprise Reliability & Restraint (Điềm Tĩnh & Tiết Chế Chuẩn Doanh Nghiệp)**:
   - Loại bỏ hoàn toàn: Hiệu ứng kính mờ (glassmorphism), nền gradient đa sắc cầu kỳ, hiệu ứng bay lượn (floating animation) trang trí không cần thiết.
   - Bề mặt phẳng (flat surface), sạch sẽ, tương phản cao, bóng đổ phân lớp siêu mịn (Ant Design layered micro-shadows).

3. **Role Balance (Cân Bằng Trải Nghiệm Ba Vai Trò)**:
   - **Sinh viên**: Giao diện hướng dẫn tuần tự (guided workflow) theo tiến trình 6 giai đoạn (Timeline/Steps), rõ việc cần làm tiếp theo, thông báo rõ ràng về deadline.
   - **Giảng viên**: Tối ưu tốc độ duyệt hàng loạt (bulk review), xem danh sách sinh viên hướng dẫn (chặn trần $\le 10$ SV), nhập điểm theo rubric không sai sót.
   - **Quản trị viên**: Bảng dữ liệu mật độ cao (high-density table), lọc đa tiêu chí, theo dõi tiến độ toàn khóa, gán hội đồng an toàn.

4. **Accessibility & Vietnamese Localization (Khả Năng Tiếp Cận & Chuẩn Tiếng Việt)**:
   - Tuân thủ chuẩn **WCAG 2.1 AA** (độ tương phản văn bản tối thiểu `4.5:1`).
   - Hỗ trợ tiếng Việt trọn vẹn: Font chữ hỗ trợ Unicode đầy đủ (Inter / Roboto), không bị lỗi vỡ dấu; ngày tháng hiển thị chuẩn `DD/MM/YYYY`, giờ `HH:mm`.

---

## 2. DESIGN TOKENS (Hệ Thống Token Thiết Kế)

### 2.1. Color Tokens (Bảng Màu Semantic)

```typescript
export const colorTokens = {
  // Brand & Primary (Xanh Dương Doanh Nghiệp & Học Thuật)
  colorPrimary: '#1677FF',       // Ant Design Blue - Tương tác chính, CTA, link
  colorPrimaryHover: '#4096FF',  // Hover state
  colorPrimaryActive: '#0958D9', // Active / Pressed state
  colorPrimaryBg: '#E6F4FF',     // Nền phụ trợ, Tag active, Row selection
  colorInstitutional: '#003366', // Xanh Navy Viện/Trường - Header brand, huy hiệu

  // Neutral (Nền & Bề mặt trung tính)
  colorBgLayout: '#F5F7FA',      // Nền tổng thể trang (sáng trung tính, dịu mắt)
  colorBgContainer: '#FFFFFF',   // Nền Card, Bảng, Modal, Sidebar
  colorBgElevated: '#FFFFFF',    // Nền Dropdown, Popover, Tooltip (nếu nền sáng)
  colorBorder: '#E5E7EB',        // Viền thẻ Card, divider chuẩn
  colorBorderSecondary: '#F0F0F0',// Viền phân cách hàng trong bảng

  // Typography Contrast (Độ tương phản chữ)
  colorText: '#1F2937',          // Văn bản chính (Slate-800, contrast 12.5:1 trên nền trắng)
  colorTextSecondary: '#4B5563', // Nhãn phụ, tiêu đề cột bảng, breadcrumb
  colorTextTertiary: '#6B7280',  // Thời gian, số hiệu, text ghi chú
  colorTextQuaternary: '#9CA3AF',// Placeholder, icon vô hiệu hóa

  // Semantic Status (Trạng thái nghiệp vụ)
  colorSuccess: '#52C41A',       // Đã duyệt, Hoàn thành, Đạt chuẩn
  colorSuccessBg: '#F6FFED',
  colorSuccessBorder: '#B7EB8F',

  colorWarning: '#FAAD14',       // Chờ duyệt, Cần bổ sung, Cảnh báo deadline
  colorWarningBg: '#FFFBE6',
  colorWarningBorder: '#FFE58F',

  colorError: '#FF4D4F',         // Từ chối, Quá hạn, Không đạt, Xóa
  colorErrorBg: '#FFF2F0',
  colorErrorBorder: '#FFCCC7',

  colorInfo: '#1677FF',          // Thông tin giai đoạn, Đang diễn ra
  colorInfoBg: '#E6F4FF',
  colorInfoBorder: '#91CAFF',
};
```

### 2.2. Typography Tokens

| Cấp bậc | Cỡ chữ (`fontSize`) | Độ cao dòng (`lineHeight`) | Độ đậm (`fontWeight`) | Áp dụng |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title (H1)** | `20px` (`1.25rem`) | `28px` | `700` (Bold) | Tiêu đề đầu trang (Page Header) |
| **Section Title (H2)** | `16px` (`1.0rem`) | `24px` | `600` (SemiBold) | Tiêu đề Card, tiêu đề Modal, Tab |
| **Card Subtitle (H3)**| `14px` (`0.875rem`)| `22px` | `600` (SemiBold) | Tiêu đề nhóm thông tin, nhãn Form |
| **Body Base** | `14px` (`0.875rem`)| `22px` | `400` (Regular) | Nội dung bảng, đoạn văn bản, input |
| **Body Secondary** | `13px` (`0.8125rem`)| `20px`| `400` / `500` | Thông tin phụ, meta tag, ghi chú |
| **Caption / Badge** | `12px` (`0.75rem`) | `18px` | `500` / `600` | Tag trạng thái, đếm số lượng, timestamp |
| **Font Family** | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` |

### 2.3. Spacing & Radius Tokens

```typescript
export const layoutTokens = {
  // Spacing Scale (Hệ số nhân 4px)
  spaceXS: 4,    // Khoảng cách giữa icon và label
  spaceSM: 8,    // Padding bên trong button, tag, table cell compact
  spaceMD: 16,   // Padding thẻ Card, khoảng cách giữa các Form.Item
  spaceLG: 24,   // Margin giữa các Section, Content container padding
  spaceXL: 32,   // Khoảng cách các khối lớn trên trang Dashboard

  // Radius Tokens (Góc bo tiêu chuẩn Enterprise)
  borderRadiusXS: 2, // Checkbox, Radio, Tooltip
  borderRadiusSM: 4, // Tag, Badge, nút nhỏ
  borderRadius: 6,   // Button, Input, Select, DatePicker chuẩn AntD
  borderRadiusLG: 8, // Card container, Modal dialog
  borderRadiusXL: 12,// Drawer, Hero status banner

  // Elevation / Shadow (Bóng đổ phân cấp nhẹ)
  boxShadowCard: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
  boxShadowDropdown: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  boxShadowModal: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
};
```

---

## 3. ANT DESIGN THEME CONFIGURATION (`ConfigProvider`)

Cấu hình mẫu chuẩn áp dụng trong file `frontend/src/App.jsx`:

```jsx
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

export const antdAcademicTheme = {
  token: {
    // Colors
    colorPrimary: '#1677FF',
    colorInfo: '#1677FF',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorBgLayout: '#F5F7FA',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E5E7EB',
    colorBorderSecondary: '#F0F0F0',
    colorText: '#1F2937',
    colorTextSecondary: '#4B5563',
    
    // Typography & Geometry
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    
    // Controls
    controlHeight: 36, // Chuẩn bấm chuột thoải mái
    controlHeightSM: 28,
    controlHeightLG: 42,
  },
  components: {
    Layout: {
      headerBg: '#FFFFFF',
      headerHeight: 56,
      headerPadding: '0 24px',
      siderBg: '#FFFFFF',
      bodyBg: '#F5F7FA',
    },
    Card: {
      paddingLG: 20,
      headerHeight: 48,
      boxShadowTertiary: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
    },
    Table: {
      headerBg: '#FAFAFA',
      headerColor: '#374151',
      headerSplitColor: '#F0F0F0',
      rowHoverBg: '#F8FAFC',
      borderColor: '#F0F0F0',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Button: {
      fontWeight: 500,
      primaryShadow: '0 1px 2px 0 rgba(22, 119, 255, 0.2)',
    },
    Menu: {
      itemBorderRadius: 6,
      itemSelectedBg: '#E6F4FF',
      itemSelectedColor: '#1677FF',
      itemActiveBg: '#F5F7FA',
      itemMarginInline: 8,
    },
    Modal: {
      borderRadiusLG: 8,
      headerBg: '#FFFFFF',
    },
  },
};
```

---

## 4. COMPONENT GUIDELINES CHO ANT DESIGN

### 4.1. Button (Nút Bấm)
* **`type="primary"`**: Chỉ dùng **1 nút duy nhất** cho hành động chính trên mỗi phân vùng màn hình (VD: *"Nộp bài báo cáo"*, *"Lưu thông tin"*, *"Duyệt đề tài"*).
* **`type="default"`**: Dùng cho hành động phụ (*"Hủy"*, *"Đóng"*, *"Bộ lọc"*).
* **`danger`**: Bắt buộc khi có nguy cơ mất dữ liệu (*"Xóa đề tài"*, *"Từ chối đăng ký"*, *"Rút đề tài"*). Luôn đi kèm xác nhận Popconfirm hoặc Modal.
* **`type="link"`**: Dùng cho điều hướng chi tiết trong dòng bảng dữ liệu (*"Chi tiết"*, *"Tải về"*).
* **Trạng thái**: Luôn gán `loading={isLoading}` khi xử lý async, `disabled` khi chưa đủ điều kiện nghiệp vụ (VD: SV chưa nộp BM04 thì nút phân hội đồng bị disabled).

### 4.2. Form & Validation (Biểu Mẫu Nhập Liệu)
* **Bố cục**: Dùng `layout="vertical"` làm mặc định để đảm bảo nhãn tiếng Việt dài không bị cắt xén và hoạt động hoàn hảo trên thiết bị di động.
* **Quy tắc kiểm tra (Rules)**:
  * Không dùng câu thông báo chung chung `"Bắt buộc"`. Ghi rõ: `"Vui lòng nhập tên đề tài tiếng Việt"`, `"Số lượng sinh viên phải từ 1 đến 1"`.
  * Hiển thị dấu sao đỏ `required` rõ ràng ở các trường bắt buộc.
* **Feedback trực quan**: Sử dụng `hasFeedback` để hiển thị biểu tượng tick xanh / dấu chéo đỏ ngay trong input khi người dùng nhập dữ liệu.

### 4.3. Table (Bảng Dữ Liệu Học Vụ)
* **Cấu trúc phân cột**:
  * Cột 1: Mã số (Mã đề tài / MSSV / Mã GV) — In đậm nhẹ, font monospace hoặc Inter 500.
  * Cột 2: Tên / Nội dung chính — Chiếm độ rộng lớn nhất (`ellipsis: true` có tooltip).
  * Cột trạng thái: Bắt buộc dùng `Badge` hoặc `Tag` có màu sắc chuẩn hóa.
  * Cột thao tác: Cố định bên phải `fixed: 'right'`, chiều rộng cố định (100px - 140px).
* **Scroll & Density**: Thiết lập `scroll={{ x: 'max-content' }}` để bảng không bị vỡ cột trên màn hình nhỏ. Mặc định `size="middle"`.
* **Phân trang (Pagination)**: Luôn bật `showSizeChanger: true`, `pageSizeOptions: ['10', '20', '50']`, hiển thị tổng số bản ghi: `showTotal: (total) => `Tổng cộng ${total} đề tài``.

### 4.4. Modal & Drawer
* **Modal**: Dùng cho các tác vụ ngắn, thao tác nhanh ($\le 5$ trường input), xác nhận hoặc duyệt đề tài. Tiêu đề rõ ràng: `title="Duyệt Đăng Ký Đề Tài"`.
* **Drawer**: Dùng khi cần xem chi tiết hồ sơ đề tài, lịch sử trao đổi BM01-BM06, hoặc nhật ký hướng dẫn tuần mà không muốn người dùng bị rời khỏi ngữ cảnh của bảng danh sách.

### 4.5. Select & DatePicker
* **Select**:
  * Luôn bật `showSearch: true` và `filterOption` với các danh sách dài (danh sách Giảng viên, danh sách Ngành, Hội đồng).
  * Placeholder tiếng Việt lịch sự: `"Chọn giảng viên hướng dẫn..."`.
* **DatePicker / RangePicker**:
  * Định dạng bắt buộc: `format="DD/MM/YYYY"`.
  * RangePicker cho đợt đăng ký: `placeholder={['Ngày bắt đầu', 'Ngày kết thúc']}`.

### 4.6. Badge & Tag (Nhãn Trạng Thái Học Vụ)
Bảng đối chiếu màu sắc Tag/Badge chuẩn cho nghiệp vụ Đồ Án:

| Trạng Thái Nghiệp Vụ | Component Ant Design | Ý Nghĩa Thực Tế |
| :--- | :--- | :--- |
| `DRAFT` / `NHAP` | `<Tag color="default">Bản nháp</Tag>` | GV mới tạo đề tài, chưa gửi khoa |
| `PENDING_FACULTY` | `<Tag color="processing">Chờ khoa duyệt</Tag>` | Đề tài đang chờ thẩm định |
| `OPEN_FOR_REGISTER` | `<Tag color="success">Đang mở đăng ký</Tag>` | SV có thể vào đăng ký |
| `ASSIGNED` / `DA_DUYET` | `<Tag color="blue">Đã chấp nhận SV</Tag>` | GVHD đã duyệt nhận sinh viên |
| `IN_PROGRESS` | `<Tag color="cyan">Đang thực hiện</Tag>` | Đang thực hiện các đợt nộp BM |
| `REJECTED` | `<Tag color="error">Đã từ chối</Tag>` | Khoa hoặc GV từ chối đăng ký |
| `ELIGIBLE_DEFENSE` | `<Tag color="purple">Đủ ĐK Bảo vệ</Tag>` | Đã hoàn thành BM04 và đánh giá đạt |

### 4.7. Alert & Notification
* **Alert**: Dùng nhúng trực tiếp trong trang (in-page banner) để nhắc nhở tiến độ hoặc thời hạn quan trọng.
  * Ví dụ: `<Alert type="warning" showIcon message="Hạn chót nộp Báo cáo Giữa kỳ (BM03)" description="Hệ thống sẽ khóa cổng nộp vào 17:00 ngày 25/11/2026." />`
* **Notification**: Dùng thông báo kết quả hành động hệ thống qua `notification.success()` hoặc `notification.error()`. Đặt thời gian tự đóng 4.5 giây.

### 4.8. Timeline & Steps (Tiến Trình 6 Giai Đoạn Đồ Án)
* Dùng `Steps` (dạng thanh ngang trên Desktop, dạng dọc trên Mobile) để sinh viên nắm được vị trí của mình trong toàn bộ kỳ làm đồ án:
  1. *Đăng ký & Chọn đề tài* (BM01)
  2. *Nộp Đề cương chi tiết* (BM02)
  3. *Báo cáo tiến độ Giữa kỳ* (BM03)
  4. *Đánh giá Hướng dẫn* (BM04 - Cổng quyết định đủ ĐK bảo vệ)
  5. *Chấm Phản biện* (BM05)
  6. *Bảo vệ Hội đồng & Điểm số* (BM06)

---

## 5. CÁC TRẠNG THÁI HỆ THỐNG CHUẨN MỰC

1. **Trạng thái Loading (Tải Dữ Liệu)**:
   * Danh sách/Bảng: Dùng `<Skeleton active paragraph={{ rows: 5 }} />` hoặc thuộc tính `loading={true}` của chính component Table để tránh giật khung hình.
   * Hành động nút: Dùng `loading={isSubmitting}` ngay trên `<Button>`.

2. **Trạng thái Empty (Không Có Dữ Liệu)**:
   * Dùng `<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đề tài nào được phân công" />`.
   * Luôn kèm theo nút hành động khắc phục nếu người dùng có quyền (VD: Nút *"Đăng ký đề tài mới"* cho sinh viên, hoặc *"Tạo đề tài"* cho giảng viên).

3. **Trạng thái Error (Lỗi Hệ Thống / Không Thể Tải)**:
   * Dùng `<Result status="500" title="Không thể tải dữ liệu học vụ" subTitle="Vui lòng kiểm tra kết nối mạng hoặc liên hệ quản trị viên." extra={<Button type="primary" onClick={retry}>Tải lại trang</Button>} />`.

4. **Trạng thái Disabled & Validation (Bảo Toàn Nghiệp Vụ)**:
   * Nếu GV đã đạt chỉ tiêu 10 sinh viên: Nút *"Duyệt nhận"* tự động `disabled={true}`, kèm `<Tooltip title="Giảng viên đã đủ chỉ tiêu tối đa 10 sinh viên">`.
   * Nếu SV chưa có điểm BM04: Nút *"Đăng ký lịch bảo vệ"* hiển thị khóa màu xám và cảnh báo rõ lý do.

---

## 6. LAYOUT TỔNG THỂ & RESPONSIVE BEHAVIOR

```
+-------------------------------------------------------------------------+
| [TDMU Logo] CỔNG ĐỒ ÁN TỐT NGHIỆP      [Học kỳ 1 2026] [Chuông] [User]  | (Header 56px)
+----------------+--------------------------------------------------------+
| ☰ MENU CHÍNH   | Breadcrumb: Trang chủ / Khóa luận & Đồ án / Đề tài      |
|                | ------------------------------------------------------ |
| 📊 Tổng quan    | PAGE HEADER: Danh Sách Đề Tài Tốt Nghiệp   [+ Tạo mới]  |
| 📋 Đề tài của tôi| (Thẻ KPI / Tiến độ / Bộ lọc tìm kiếm nhanh)            |
| 📈 Tiến độ BM  +--------------------------------------------------------+
| 🎓 Hội đồng    | CARD / TABLE CONTAINER                                 |
| ⚙️ Tài khoản    |                                                        |
|                |                                                        |
+----------------+--------------------------------------------------------+
| (Sider 240px)  | (Content Area padding: 24px - Responsive Fluid)        |
+----------------+--------------------------------------------------------+
```

* **Desktop ($\ge 1200px$)**: Sidebar cố định 240px, Content tràn viền có lề 24px, hiển thị đầy đủ các cột bảng.
* **Tablet ($768px - 1199px$)**: Sidebar có thể thu nhỏ (collapse 64px chỉ hiển thị icon), các bảng dữ liệu cho phép scroll ngang mượt mà.
* **Mobile ($< 768px$)**:
  * Sidebar chuyển thành **Ant Design Drawer** trượt từ cạnh trái ra khi bấm nút Hamburger.
  * Header tối giản hiển thị Title và Avatar.
  * Table hiển thị dạng thẻ danh sách (Card list) hoặc bảng compact có scroll ngang.
