# Kế Hoạch Triển Khai: Tái Thiết Kế Trang Hồ Sơ Cá Nhân (Profile Page Redesign)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tái thiết kế toàn diện trang Hồ sơ cá nhân (`ProfilePage.jsx`) theo tiêu chuẩn UI/UX Pro Max (phong cách Minimalism & Swiss Style kết hợp Academic Enterprise), trang bị Hero Banner định danh học thuật, thanh thông số KPI nhanh, bố cục 3 Tabs chuyên biệt và thước đo độ mạnh mật khẩu.

**Architecture:** Giữ nguyên kiến trúc client-state máy chủ bền vững (TanStack Query v5 `useCurrentUser`, `useAuthStore`, `queryKeys.scope(user)`), chia nhỏ các component phụ trợ chuyên trách (`PasswordStrengthMeter`, `ProfileQuickMetrics`) và tối ưu hóa luồng hiển thị 3 Tabs (`personal_academic`, `security_password`, `roles_permissions`) tuân thủ nghiêm ngặt quy định bảo vệ dữ liệu học vụ của sinh viên.

**Tech Stack:** React 19, Ant Design v6, `@ant-design/icons`, Tailwind CSS, TanStack Query v5, Zustand, Node.js test runner.

**Spec:** [docs/superpowers/specs/2026-11-14-profile-page-redesign-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-14-profile-page-redesign-design.md)

---

## Global Constraints

- **Rule 2.6 trong AGENTS.md**: Tuyệt đối không chèn ký tự thô / emoji vào nhãn nút bấm (`<Button>`). Sử dụng prop `icon={<IconComponent />}` từ `@ant-design/icons`.
- **Rule 2.4 trong AGENTS.md**: 100% tệp tin định dạng UTF-8 without BOM.
- **Rule 2.1 trong AGENTS.md**: Tuân thủ mô hình `TopicRegistration`, không dùng `group/groupMember`.
- **Rule 2.3 trong AGENTS.md**: Không sử dụng mock data, 100% lấy dữ liệu thực từ `user` và backend API.
- **Bảo toàn dữ liệu học vụ sinh viên**: Sinh viên chỉ được phép chỉnh sửa `avatarUrl` và `phone`; các trường `code`, `fullName`, `className`, `major`, `department` là dữ liệu chỉ đọc (read-only) do Nhà trường đồng bộ.
- **Query Architecture Audit**: Tuyệt đối không gọi service fetch trực tiếp trong `useEffect` gây vi phạm `queryMigrationAudit.test.js`.

---

## Review Focus

1. **Student Self-Edit Boundary**: Sinh viên không thể thay đổi mã số, họ tên, lớp, ngành hoặc phòng ban.
2. **Password Strength & Accessibility**: Thước đo mật khẩu phản hồi tức thì với bàn phím, không chặn dán mật khẩu (WCAG 2.2 AA).
3. **Responsive Hero & Layout**: Đảm bảo hiển thị hoàn hảo trên các độ phân giải màn hình từ mobile (375px), tablet (768px) đến desktop (1280px+).
4. **Backward Compatibility**: 100% tương thích với các bài test hiện có trong `frontend/tests/profilePage.test.js`.
5. **Zero Mock & Error Resilience**: Khi thông tin chưa kịp tải hoặc thiếu trường tùy chọn (như `department` hoặc `className`), hiển thị fallback thanh lịch thay vì gây crash UI.

---

## Danh Sách Tệp Thay Đổi & Tạo Mới

| Thao tác | Đường dẫn tệp | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Tạo mới** | `frontend/src/components/profile/PasswordStrengthMeter.jsx` | Component thước đo độ mạnh mật khẩu (yếu, trung bình, mạnh) kèm gợi ý an toàn |
| **Tạo mới** | `frontend/src/components/profile/ProfileQuickMetrics.jsx` | Hàng 4 thẻ KPI nhanh: Trạng thái tài khoản, Định danh học vụ, Quyền hạn, Mức độ hoàn thiện |
| **Tạo mới** | `frontend/tests/profilePageUiUx.test.js` | Bộ kiểm thử hợp đồng UI/UX mới cho trang Hồ sơ cá nhân |
| **Chỉnh sửa** | `frontend/src/pages/common/ProfilePage.jsx` | Tái cấu trúc toàn diện trang Hồ sơ với Hero Banner, Quick Metrics và 3 Tabs |

---

## Kế Hoạch Triển Khai Từng Bước (Tasks)

### Task 1: Xây Dựng Bộ Kiểm Thử Hợp Đồng UI/UX Mới (`profilePageUiUx.test.js`)
**Goal:** Viết các kiểm thử tĩnh và kiểm tra hợp đồng giao diện mới cho trang Hồ sơ cá nhân để dẫn hướng phát triển theo TDD.

- [ ] **Step 1.1**: Tạo tệp `frontend/tests/profilePageUiUx.test.js` kiểm tra:
  * File tồn tại và đạt chuẩn UTF-8 without BOM (Rule 2.4).
  * Tuân thủ 100% Rule 2.6 (không có emoji thô trong chuỗi nhãn `<Button>`).
  * Chứa Hero Banner định danh học thuật với Avatar viền tròn, online badge và tag định danh chính thức.
  * Tích hợp thanh 4 thông số KPI nhanh (`ProfileQuickMetrics`).
  * Khai báo 3 Tabs rõ ràng: `personal_academic`, `security_password`, `roles_permissions`.
  * Tách bạch dữ liệu học vụ chỉ đọc (`className`, `major`, `code`) và dữ liệu liên lạc cho phép sửa (`phone`, `avatarUrl`).
  * Tích hợp thước đo độ mạnh mật khẩu (`PasswordStrengthMeter`).
- [ ] **Step 1.2**: Chạy kiểm thử: `node --test frontend/tests/profilePageUiUx.test.js` để xác nhận test chạy và thất bại chính xác (Red).
- [ ] **Step 1.3**: Commit: `test(profile): add UI/UX contract test suite for redesigned profile page`.

---

### Task 2: Phát Triển Các Component Phụ Trợ (`PasswordStrengthMeter`, `ProfileQuickMetrics`)
**Goal:** Xây dựng 2 component độc lập phục vụ bảo mật mật khẩu và thống kê nhanh thông số học vụ.

- [ ] **Step 2.1**: Tạo thư mục `frontend/src/components/profile/`.
- [ ] **Step 2.2**: Cài đặt `frontend/src/components/profile/PasswordStrengthMeter.jsx`:
  * Nhận prop `password`.
  * Tính toán điểm an toàn: độ dài $\ge 6$, có chữ cái (hoa/thường), có số, có ký tự đặc biệt.
  * Hiển thị thanh `Progress` với 3 màu: Đỏ (Yếu), Cam (Trung bình), Xanh lục (Mạnh).
  * Danh sách checklist yêu cầu nhỏ gọn, tinh tế.
- [ ] **Step 2.3**: Cài đặt `frontend/src/components/profile/ProfileQuickMetrics.jsx`:
  * Nhận props: `user`, `roleName`, `roleColor`, `isStudent`.
  * Hiển thị grid 4 thẻ:
    1. Trạng thái tài khoản: "Đang hoạt động" (`<CheckCircleOutlined className="text-emerald-500" />`).
    2. Định danh học vụ: Lớp & Ngành (SV) hoặc Đơn vị / Bộ môn (GV/Admin).
    3. Nhóm quyền & Vai trò: Số lượng permissions hoặc nhóm quyền học vụ.
    4. Mức độ hoàn thiện hồ sơ: Điểm hoàn thiện (Avatar, SĐT, Email xác thực).
- [ ] **Step 2.4**: Kiểm tra UTF-8 và cú pháp.
- [ ] **Step 2.5**: Commit: `feat(profile): implement PasswordStrengthMeter and ProfileQuickMetrics components`.

---

### Task 3: Tái Cấu Trúc Toàn Diện `ProfilePage.jsx` Theo Phong Cách Swiss & Academic Hero
**Goal:** Tái thiết kế trang `ProfilePage.jsx` với Hero Banner, Quick Metrics và 3 Tabs chuyên biệt.

- [ ] **Step 3.1**: Cập nhật `frontend/src/pages/common/ProfilePage.jsx`:
  * **Hero Profile Banner**:
    - Dải bìa gradient xanh học thuật (`from-blue-600 via-indigo-600 to-slate-900`) với hoa văn tinh tế.
    - Avatar 112px viền trắng dày `ring-4 ring-white`, badge online, nút camera tải ảnh đại diện tinh tế.
    - Tiêu đề họ tên lớn, Tag vai trò chính quy và Tag *"Định danh chính thức Viện CNS"*.
    - Nhóm nút thao tác ở góc phải: *"Chỉnh sửa hồ sơ"*, *"Lưu thay đổi"*, *"Hủy"* với icon chuẩn Rule 2.6.
  * **Quick Metrics Row**: Render component `<ProfileQuickMetrics />`.
  * **3 Tabs Chuyên Biệt**:
    - `Tab 1: 📋 Thông tin cá nhân & Học vụ`:
      + Khối học vụ cố định: Thẻ thông báo `<Alert />` giải thích dữ liệu đồng bộ từ CSDL Nhà trường; bảng `Descriptions` hiển thị Mã số, Họ tên, Lớp, Ngành, Khoa/Viện.
      + Khối liên lạc cập nhật: Ô nhập SĐT, Email công vụ, Đơn vị (chỉ GV/Admin sửa được; SV chỉ sửa Avatar và SĐT).
    - `Tab 2: 🔐 Bảo mật & Quản lý phiên`:
      + Form đổi mật khẩu với `<PasswordStrengthMeter />`, các ô nhập mật khẩu an toàn.
      + Thẻ thông tin phiên đăng nhập JWT (Thời hạn 30 ngày / 24h, ghi nhớ).
      + Card mẹo bảo mật học vụ.
    - `Tab 3: 🛡️ Vai trò & Quyền hạn`:
      + Danh sách nhóm quyền học vụ (`permissionGroups`).
      + Huy hiệu tham gia Hội đồng BM01/BM05 và các capabilities chi tiết.
- [ ] **Step 3.2**: Chạy kiểm thử:
  * `node --test frontend/tests/profilePageUiUx.test.js`
  * `node --test frontend/tests/profilePage.test.js`
  * `node --test frontend/tests/queryMigrationAudit.test.js`
- [ ] **Step 3.3**: Xác nhận toàn bộ kiểm thử chuyển sang trạng thái Green (Pass 100%).
- [ ] **Step 3.4**: Commit: `feat(profile): redesign ProfilePage with academic hero banner, tabbed layout and password strength meter`.

---

### Task 4: Kiểm Thử Toàn Diện Hệ Thống & Production Build
**Goal:** Chạy toàn bộ bộ kiểm thử tự động, vitest runtime và build production để đảm bảo zero regression.

- [ ] **Step 4.1**: Chạy toàn bộ frontend contract tests: `npm --prefix frontend test`.
- [ ] **Step 4.2**: Chạy toàn bộ vitest runtime tests: `npm --prefix frontend run test:runtime`.
- [ ] **Step 4.3**: Chạy production build: `npm --prefix frontend run build`.
- [ ] **Step 4.4**: Kiểm tra định dạng 100% tệp tin đạt chuẩn UTF-8 without BOM.
- [ ] **Step 4.5**: Commit hoàn thiện: `chore(release): finalize ProfilePage redesign with 100% test coverage`.
- [ ] **Step 4.6**: Cập nhật mục `Session Update` trong [CLAUDE.md](file:///d:/DACN/CLAUDE.md).

