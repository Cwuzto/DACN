# Thiết Kế Kỹ Thuật: Sửa Lỗi Trắng Trang & Tối Ưu Hóa Trải Nghiệm Phân Hệ Giảng Viên (Lecturer Workspace)

- **Mã thiết kế**: SPEC-2026-11-13-LECTURER-UI-UX-FIX
- **Ngày lập**: 13/11/2026
- **Trạng thái**: Đã phê duyệt & Hoàn thành (Approved & Completed)
- **Tác giả**: AI Agent & Người dùng
- **Phạm vi**: Frontend SPA (`frontend/src/pages/lecturer/`, `frontend/src/config/navigationRegistry.js`, `frontend/src/components/layout/AppLayout.jsx`, `frontend/src/components/common/ErrorBoundary.jsx`)

---

## 1. Bối Cảnh & Vấn Đề (Context & Problem Statement)

### 1.1. Hiện tượng lỗi trắng trang (White Screen Crash)
1. **Lỗi Temporal Dead Zone (TDZ) trong `ProgressTrackingPage.jsx` (dòng 437-438)**:
   - Biến `sPassed` được dùng tại dòng 437 (`const sProgress = s.progressPercent ?? (sPassed ? 100 : 0);`) nhưng chỉ được khai báo ở dòng 438 bằng `const`.
   - Khi giảng viên có sinh viên trong danh sách và tiến độ chưa được tính toán sẵn, JavaScript ném ngay lỗi:
     $$\text{ReferenceError: Cannot access 'sPassed' before initialization}$$
   - Cả hai mục menu **`Theo dõi tiến độ`** (`/lecturer/progress`) và **`Phiếu nhận xét hướng dẫn`** (`/lecturer/progress?tab=bm04`) đều trỏ vào trang này, khiến màn hình lập tức bị **trắng băng (crash unmount 100%)**.
2. **Lỗi sai Route điều hướng trong `GradingPage.jsx` (dòng 326)**:
   - Nút "Vào chấm điểm" / "Xem phiếu chấm" gọi `navigate('/lecturer/grading/' + cand.id)`.
   - Trong `App.jsx`, route đăng ký chính quy là `/lecturer/grading/sheet/:registrationId`. Lệch đường dẫn khiến `RouteFallbackHandler` tự động đá người dùng về Dashboard.
3. **Lỗi "Mù Query Params" (Broken Tab Deep-Linking)**:
   - Các trang `TopicApprovalPage`, `ProgressTrackingPage`, `ProjectPeriodPage`, `GradingDefensePage` không đọc hoặc xử lý thiếu các tham số `?tab=bm01`, `?tab=bm04`, `?tab=decisions`, `?tab=approvals`, `?tab=publish`, khiến click vào menu nhưng tab bên trong không chuyển.
4. **Thiếu Error Boundary toàn cục**:
   - Toàn bộ ứng dụng React SPA chưa có cơ chế bắt lỗi render ở mức layout/route. Bất kỳ lỗi runtime nào cũng đánh sập toàn bộ giao diện thay vì hiển thị màn hình thông báo lỗi thân thiện kèm nút thử lại.

### 1.2. Vấn đề trải nghiệm người dùng & Kiến trúc thông tin (UI/UX & IA)
1. **Hiện tượng thừa mứa (Cognitive Overload)**:
   - Giảng viên kiêm nhiệm (như Viện trưởng `lecturer01`) bị nhồi nhét tới **18 mục menu** trải dài 6 nhóm.
   - Nhập nhằng giữa tư cách **Giảng viên hướng dẫn** (chăm sóc 10 SV cá nhân) và tư cách **Điều hành Viện/Hội đồng**.
2. **Nhảy không gian làm việc (Route Disorientation)**:
   - Click menu giảng viên nhưng URL nhảy sang `/admin/*` làm mất tính nhất quán.

---

## 2. Mục Tiêu Thiết Kế (Goals & Non-Goals)

### Mục tiêu (Goals):
1. **Triệt tiêu 100% lỗi trắng trang**: Sửa triệt để TDZ `sPassed`, bổ sung `ErrorBoundary` chuẩn React, xử lý fallback an toàn cho tất cả các trang.
2. **Khớp 100% Route & Tab Deep-linking**: Bấm mục nào mở chính xác tab con tương ứng (`bm01`, `bm04`, `decisions`, `approvals`, `publish`), nút "Vào chấm điểm" vào thẳng `/lecturer/grading/sheet/:registrationId`.
3. **Quy hoạch lại Menu chuẩn UI/UX Pro Max**:
   - Gom gọn không gian GVHD thuần túy thành **5 mục cốt lõi**.
   - Nhóm riêng các tác vụ quản lý cấp Viện/Hội đồng thành phân khu riêng biệt hoặc chỉ hiển thị khi cần.
4. **Tuân thủ nghiêm ngặt Quy tắc 2.6 trong AGENTS.md**: 100% nút bấm dùng component icon `@ant-design/icons`, không có emoji hay ký tự thô trong label.

### Không thuộc phạm vi (Non-Goals):
- Không thay đổi schema CSDL Prisma hoặc logic nghiệp vụ Backend (đã hoạt động ổn định).
- Không làm thay đổi quyền hạn RBAC của người dùng trong hệ thống.

---

## 3. Các Phương Án Đã Xem Xét & Quyết Định (Approaches & Decision)

- **Phương án 1**: Chỉ vá lỗi code (sửa TDZ và route), giữ nguyên menu 18 mục cồng kềnh. (Bị loại vì không giải quyết gốc rễ trải nghiệm người dùng).
- **Phương án 2**: Chỉ tái cấu trúc menu, không sửa sâu các lỗi tab deep-linking. (Bị loại vì trang vẫn sẽ bị lỗi).
- **Phương án 3 (Được chọn)**: **Khắc phục toàn diện lỗi trắng trang + Chuẩn hóa Tab Deep-linking + Tinh gọn Menu theo chuẩn UI/UX Pro Max**.

---

## 4. Chi Tiết Kỹ Thuật (Detailed Technical Design)

### 4.1. Sửa lỗi TDZ trong `ProgressTrackingPage.jsx`
Đảo thứ tự khai báo `sPassed` lên trước `sProgress`:
```javascript
// TRƯỚC (Lỗi TDZ):
const sProgress = s.progressPercent ?? (sPassed ? 100 : 0);
const sPassed = s.status === 'COMPLETED' || s.status === 'DEFENDED' || s.status === 'DEFENSE_READY';

// SAU (Chuẩn xác):
const sPassed = s.status === 'COMPLETED' || s.status === 'DEFENDED' || s.status === 'DEFENSE_READY';
const sProgress = s.progressPercent ?? (sPassed ? 100 : 0);
```

### 4.2. Xây dựng component `ErrorBoundary.jsx`
Tạo `frontend/src/components/common/ErrorBoundary.jsx`:
- Bắt mọi lỗi render runtime (`componentDidCatch`, `getDerivedStateFromError`).
- Hiển thị giao diện báo lỗi học thuật chuyên nghiệp (Logo Viện, thông báo lỗi, nút "Thử lại", nút "Quay về Trang chủ").
- Tích hợp bọc quanh `<Outlet />` trong `AppLayout.jsx` và bọc toàn bộ `Routes` trong `App.jsx`. Đảm bảo hệ thống không bao giờ bị trắng màn hình.

### 4.3. Sửa Route chấm điểm trong `GradingPage.jsx`
Tại dòng 326:
```javascript
// TRƯỚC (Lỗi 404):
onClick={() => navigate(`/lecturer/grading/${cand.id}`)}

// SAU:
onClick={() => navigate(`/lecturer/grading/sheet/${cand.id}`)}
```

### 4.4. Chuẩn hóa Tab Deep-Linking
1. **`TopicApprovalPage.jsx`**:
   - Sử dụng `useSearchParams()`:
   ```javascript
   const [searchParams, setSearchParams] = useSearchParams();
   const tabParam = searchParams.get('tab');
   // Đồng bộ activeTab: 'bm01' -> 'outline', 'bm02a' -> 'bm02a', default -> 'mentor'
   ```
2. **`ProgressTrackingPage.jsx`**:
   - Đồng bộ `searchParams.get('tab')`: nếu `tab === 'bm04'`, tự động chuyển `activeTab = 'archive'` (nơi chứa chức năng BM04 & Nghiệm thu lưu chiểu) hoặc mở trực tiếp BM04 Modal.
3. **`ProjectPeriodPage.jsx`**:
   - Xử lý `tab === 'decisions'`: Tự động kích hoạt hiển thị danh sách quyết định hoặc highlight đợt hiện tại.

### 4.5. Tái cấu trúc Menu Phân Hệ Giảng Viên (`navigationRegistry.js`)
Quy hoạch lại các nhóm menu cho Giảng viên:
1. **TỔNG QUAN**: Dashboard cá nhân (`/lecturer/dashboard`).
2. **HƯỚNG DẪN ĐỒ ÁN (5 mục tinh gọn cốt lõi cho GVHD)**:
   - *Đề tài phụ trách* (`/lecturer/topics`) - Đề xuất và quản lý kho đề tài của mình.
   - *Tiếp nhận hướng dẫn* (`/lecturer/approvals`) - Duyệt nguyện vọng SV & thẩm định đề cương BM01 (hỗ trợ sub-tabs mượt mà).
   - *Theo dõi tiến độ & BM03* (`/lecturer/progress`) - Giao việc tuần, ghi meeting log, đánh giá checkpoint.
   - *Phiếu nhận xét BM04* (`/lecturer/progress?tab=bm04`) - Chấm 4 tiêu chí cho phép ra bảo vệ.
   - *Phiếu chấm Hội đồng* (`/lecturer/grading`) - Chấm điểm hội đồng đề cương & bảo vệ.
3. **ĐIỀU HÀNH & HỘI ĐỒNG (Chỉ hiển thị cho Giảng viên có quyền Quản trị/Viện trưởng/Chủ tịch HĐ)**:
   - Nhóm riêng biệt có header phân định rõ: **"ĐIỀU HÀNH HỌC VỤ & HỘI ĐỒNG"**.
   - *Quản lý Hội đồng bảo vệ* (`/admin/defense-councils`).
   - *Quản lý Hội đồng đề cương* (`/admin/outline-councils`).
   - *Khóa & Phê duyệt điểm* (`/admin/grading`).
   - *Đợt đồ án & Quyết định* (`/admin/project-periods`).
   - *Tiêu chí Rubric* (`/admin/rubric-management`).

---

## 5. Kế Hoạch Xác Minh & Kiểm Thử (Verification Plan)

1. **Unit & Component Testing**:
   - Viết test kiểm tra `ErrorBoundary` bắt lỗi và render UI fallback đúng chuẩn Rule 2.6.
   - Viết test kiểm tra `ProgressTrackingPage` không còn lỗi TDZ và render an toàn với danh sách sinh viên rỗng/chưa có progress.
   - Viết test kiểm tra `TopicApprovalPage` và `ProgressTrackingPage` phản hồi chính xác query param `?tab=...`.
   - Viết test kiểm tra `GradingPage` điều hướng đúng `/lecturer/grading/sheet/:registrationId`.
2. **Hồi quy toàn hệ thống**:
   - Chạy `npm --prefix frontend test` (188+ tests).
   - Chạy `npm --prefix backend test` (108 suites).
   - Build production `npm --prefix frontend run build` không lỗi.
3. **Zero-BOM Check**: Xác nhận 100% tệp tin đạt chuẩn UTF-8 no BOM.

