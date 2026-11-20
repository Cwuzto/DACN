# Thiết Kế Lộ Trình 6 Mốc Quy Trình Dùng Chung (Academic Roadmap Stepper)

## 1. Mục Đích & Bối Cảnh (Intent & Why)
- **Bối cảnh**: Trên giao diện Tổng quan Sinh viên (`StudentDashboardPage.jsx`), thành phần lộ trình 6 mốc quy trình đồ án tốt nghiệp được thiết kế với phong cách hiện đại (thanh ray kết nối, quả cầu màu chuyển sắc phát sáng, hoạt ảnh mượt mà và trực quan).
- **Vấn đề**:
  - Giao diện Tổng quan Quản trị viên (`DashboardPage.jsx`) đã có dữ liệu 6 mốc từ máy chủ nhưng đang hiển thị ở dạng lưới các thẻ phẳng rời rạc, chưa có thanh ray tiến độ kết nối và chưa đồng bộ ngôn ngữ thị giác.
  - Giao diện Tổng quan Giảng viên (`LecturerDashboardPage.jsx`) hiện chưa có khối lộ trình quy trình nào, khiến giảng viên khó nắm bắt được toàn cảnh tiến độ của nhóm sinh viên mình đang hướng dẫn theo từng giai đoạn học kỳ.
- **Mục tiêu**: Tách và chuẩn hóa thành một thành phần dùng chung `AcademicRoadmapStepper` với thiết kế giao diện bắt mắt (`ui-ux-pro-max`), phục vụ thống nhất cả 3 phân hệ: Sinh viên, Giảng viên và Quản trị viên.

---

## 2. Mục Tiêu Cụ Thể, Phi Mục Tiêu & Cấm Kỵ (Goals, Non-Goals, Anti-Goals)

### Mục tiêu (Goals)
- Tạo thành phần `AcademicRoadmapStepper.jsx` và tệp kiểu dáng `academic-roadmap.css` tái sử dụng linh hoạt.
- Tự động thích ứng ngữ cảnh theo vai trò (`role: 'STUDENT' | 'LECTURER' | 'ADMIN'`):
  - **Sinh viên**: Giữ nguyên luồng theo dõi hành trình cá nhân (tính phần trăm hoàn tất, trạng thái từng hồ sơ nộp, liên kết tới màn hình nộp bài).
  - **Giảng viên**: Hiển thị phân bổ số lượng sinh viên hướng dẫn đang ở từng mốc (trong tổng số tối đa 10 sinh viên), hiển thị thời hạn học kỳ và điều hướng thẳng đến màn hình công việc chuyên trách tương ứng.
  - **Quản trị viên**: Nâng cấp lưới thẻ hiện tại thành khối lộ trình có thanh ray kết nối, quả cầu gradient phát sáng, hiển thị quy mô toàn đợt (`stage.count`), bảo lưu đường dẫn `stage.target` từ API máy chủ để giữ nguyên ngữ cảnh học kỳ.
- Hiệu ứng thị giác đỉnh cao: Thanh ray kết nối tiến độ (`roadmap-rail`), bóng đổ phát sáng (`glow aura`), hoạt ảnh chuyển động (`fadeSlideIn`, hover lift), hỗ trợ tùy chọn giảm chuyển động (`prefers-reduced-motion`).

### Phi mục tiêu (Non-Goals)
- Không thay đổi nghiệp vụ logic chấm điểm hoặc quy trình kiểm duyệt hiện có ở tầng CSDL/máy chủ backend.
- Không thay đổi bảng biểu chi tiết hoặc các hàng đợi công việc đặc thù bên dưới bảng điều khiển.

### Cấm kỵ (Anti-Goals / Strict Rules)
- **Quy tắc 2.1**: Tuyệt đối tuân thủ mô hình `TopicRegistration` (1 sinh viên / 1 đề tài, 1 giảng viên tối đa 10 sinh viên).
- **Quy tắc 2.3**: Dữ liệu thực tế bám sát ngữ cảnh và máy chủ, không sử dụng dữ liệu giả (mock data).
- **Quy tắc 2.4**: Định dạng tệp UTF-8 không BOM.
- **Quy tắc 2.6**: Chuẩn thiết kế nút bấm: Tuyệt đối không chèn ký tự đồ họa thô hoặc biểu cảm (`←`, `→`, `+`, `🤖`, `✓`, v.v.) vào nhãn nút; luôn dùng thuộc tính `icon={<IconComponent />}` từ `@ant-design/icons`. Sử dụng tiếng Việt học vụ chuẩn mực, không dùng từ lóng hay chú thích ngoặc đơn không cần thiết.

---

## 3. Các Phương Án Đã Cân Nhắc (Approaches)

### Phương án 1: Chỉ hiển thị mốc thời gian học vụ tĩnh và liên kết điều hướng
- **Đặc điểm**: Màn hình giảng viên chỉ hiển thị ngày mở/đóng của 6 mốc học kỳ và các nút bấm chuyển trang chung.
- **Ưu điểm**: Đơn giản, không phụ thuộc vào trạng thái sinh viên.
- **Nhược điểm**: Giảng viên không nhìn thấy được bức tranh tổng thể về tiến độ của nhóm sinh viên mình đang hướng dẫn.

### Phương án 2: Thống kê nhóm sinh viên hướng dẫn theo 6 mốc kèm thời hạn học vụ (ĐÃ CHỌN)
- **Đặc điểm**:
  - Tính toán trực tiếp từ danh sách sinh viên hướng dẫn của giảng viên trong học kỳ hiện tại (`students`).
  - Mỗi mốc hiển thị rõ: Tên giai đoạn, số lượng sinh viên đang dừng tại mốc đó, trạng thái đánh giá, thời hạn học vụ.
  - Khi bấm vào mốc: Chuyển hướng thông minh đến trang chức năng tương ứng của giảng viên.
- **Lý do chọn**: Giúp giảng viên nắm bắt ngay lập tức các sinh viên bị chậm tiến độ ở từng mốc để đôn đốc kịp thời.

---

## 4. Chi Tiết Kiến Trúc & Thiết Kế Kỹ Thuật (Technical Design)

### 4.1. Cấu Trúc 6 Mốc Quy Trình Chuẩn Viện Công Nghệ Số
1. **Mốc 1 - Đăng ký đề tài**:
   - Biểu tượng: `<FormOutlined />`
   - Màu chủ đạo: `#0F766E` (Xanh mòng két)
   - Điều hướng Giảng viên: `/lecturer/approvals`
   - Điều hướng Quản trị viên: `stage.target` từ API máy chủ (`/admin/project-enrollments?semesterId=...`)
2. **Mốc 2 - Đề cương chi tiết**:
   - Biểu tượng: `<FileTextOutlined />`
   - Màu chủ đạo: `#0284C7` (Xanh da trời)
   - Điều hướng Giảng viên: `/lecturer/outline-evaluations`
   - Điều hướng Quản trị viên: `stage.target` từ API máy chủ (`/admin/outline-councils?semesterId=...`)
3. **Mốc 3 - Đơn ĐK chính thức**:
   - Biểu tượng: `<AuditOutlined />`
   - Màu chủ đạo: `#4F46E5` (Xanh chàm)
   - Điều hướng Giảng viên: Cuộn mượt đến bảng danh sách sinh viên hướng dẫn / vùng xác nhận đơn BM02
   - Điều hướng Quản trị viên: `stage.target` từ API máy chủ (`/admin/project-enrollments?semesterId=...`)
4. **Mốc 4 - Nhật ký tiến độ**:
   - Biểu tượng: `<ScheduleOutlined />`
   - Màu chủ đạo: `#7C3AED` (Tím phong lữ)
   - Điều hướng Giảng viên: `/lecturer/progress?tab=meeting-logs`
   - Điều hướng Quản trị viên: `stage.target` từ API máy chủ (`/admin/oversight?semesterId=...`)
5. **Mốc 5 - Nhận xét GVHD**:
   - Biểu tượng: `<CommentOutlined />`
   - Màu chủ đạo: `#D97706` (Hổ phách)
   - Điều hướng Giảng viên: `/lecturer/progress?tab=bm04`
   - Điều hướng Quản trị viên: `stage.target` từ API máy chủ (`/admin/defense-councils?semesterId=...`)
6. **Mốc 6 - Hội đồng bảo vệ**:
   - Biểu tượng: `<TrophyOutlined />`
   - Màu chủ đạo: `#059669` (Xanh lục bảo)
   - Điều hướng Giảng viên: `/lecturer/grading` (chuẩn hóa đúng theo `App.jsx`)
   - Điều hướng Quản trị viên: `stage.target` từ API máy chủ (`/admin/grading?semesterId=...`)

### 4.2. Quy Tắc Tính Toán Chỉ Số Của Giảng Viên (Quyết Định Kỹ Thuật)
- **Số lượng sinh viên (`count`)**: Đếm số sinh viên đang dừng tại chính mốc đó (phân bổ rời rạc, tổng 6 mốc = tổng số sinh viên giảng viên hướng dẫn):
  - Mốc 1: Sinh viên trạng thái `PENDING`, `REGISTERED`.
  - Mốc 2: Sinh viên trạng thái `APPROVED`, `BM01_SUBMITTED`, `BM01_NEEDS_REVISION`, `BM01_RESUBMITTED`, `TERMINATED_BM01`.
  - Mốc 3: Sinh viên trạng thái `BM01_PASSED`, `BM02_OPEN`, `BM02_SUBMITTED`, `BM02_NEEDS_REVISION`, `BM02_RESUBMITTED`, `BM02_APPROVED`, `TERMINATED_BM02`.
  - Mốc 4: Sinh viên trạng thái `DECISION_ISSUED`, `IN_PROGRESS`, `IN_PROGRESS_BM03`, `BM03_SIGNATURE_PENDING`, `TERMINATED_FAILED_PROGRESS`.
  - Mốc 5: Sinh viên trạng thái `BM03_PASSED`, `BM04_REVIEW`, `TERMINATED_BM04`.
  - Mốc 6: Sinh viên trạng thái `DEFENSE_READY`, `DEFENSE_ELIGIBLE`, `DEFENDED`, `DEFENSE_PASSED`, `COMPLETED`, v.v.
- **Trạng thái mốc (`state`) của Giảng viên**:
  - `completed`: Khi không còn sinh viên nào ở mốc này VÀ toàn bộ sinh viên đã tiến sang các mốc sau (hoặc học kỳ đã qua hạn chót của mốc).
  - `active`: Khi có ít nhất 1 sinh viên đang dừng tại mốc này HOẶC thời gian học kỳ hiện tại đang nằm trong khung thời hạn của mốc.
  - `pending`: Khi chưa có sinh viên nào đến mốc này và mốc học kỳ chưa mở.
- **Thanh tiến độ (`progressPercent`)**:
  - Giảng viên: Tính bằng trung bình cộng tỷ lệ hoàn thành tiến độ của tất cả các sinh viên được hướng dẫn (`Math.round(totalPercent / students.length)`), giúp phản ánh chân thực tiến độ thực tế của nhóm sinh viên.
  - Quản trị viên: Tính bằng tỷ lệ mốc đã qua `Math.round((completedStagesCount / 6) * 100)`.

### 4.3. Đặc Tả Thành Phần `AcademicRoadmapStepper.jsx`
- **Props**:
  - `role`: `'STUDENT' | 'LECTURER' | 'ADMIN'`
  - `title`: Tiêu đề khối (chuẩn tiếng Việt học vụ, chuyên nghiệp).
  - `subtitle`: Phụ đề giải thích.
  - `badgeLabel`: Nhãn nổi bật góc phải (ví dụ: `8/10 Sinh viên`, `100% Hoàn tất`, `124 Hồ sơ`).
  - `progressPercent`: Tỷ lệ từ 0 đến 100 để vẽ thanh ray tiến độ (`roadmap-fill`).
  - `milestones`: Mảng 6 đối tượng mốc quy trình:
    ```ts
    interface RoadmapStageItem {
      key: string;
      stepNumber: number;
      title: string;
      subText: string;
      dateText: string;
      state: 'completed' | 'active' | 'pending';
      icon: React.ReactNode;
      count?: number;
      onClick?: () => void;
      styleVars: Record<string, string>;
    }
    ```

### 4.4. Tích Hợp Vào Các Màn Hình
1. **`StudentDashboardPage.jsx`**: Thay thế đoạn mã render nội tuyến bằng `AcademicRoadmapStepper`, truyền dữ liệu sinh viên như hiện hành.
2. **`LecturerDashboardPage.jsx`**:
   - Khai báo hook tính toán `milestones` theo danh sách `students` và `activeSemester`.
   - Chèn component `AcademicRoadmapStepper` vào vị trí ngay dưới `OverviewKpis` và phía trên `AttentionQueue`.
3. **`DashboardPage.jsx` (Admin)**:
   - Thay thế thẻ `<section aria-labelledby="admin-roadmap-heading">` bằng `AcademicRoadmapStepper`.
   - Kết nối dữ liệu `adminActionsQuery.data?.roadmap`, bảo lưu điều hướng `stage.target` từ API.

---

## 5. Chiến Lược Kiểm Thử & Xác Nhận (Testing & Verification)
- **Kiểm thử đơn vị**:
  - Tạo tệp `frontend/tests/academicRoadmapStepper.test.jsx`.
  - Kiểm tra hiển thị đầy đủ 6 mốc, thanh ray tiến độ và nhãn góc phải cho cả 3 vai trò (Sinh viên, Giảng viên, Quản trị viên).
  - Kiểm tra tương tác nhấp chuột kích hoạt callback `onClick`.
- **Kiểm thử hồi quy**:
  - Chạy toàn bộ test suite frontend: `npm --prefix frontend test`.
  - Đóng gói ứng dụng: `npm --prefix frontend run build`.
