# Kế Hoạch Triển Khai Lộ Trình 6 Mốc Quy Trình Dùng Chung (Academic Roadmap Stepper)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách và chuẩn hóa thành phần Lộ trình 6 mốc quy trình đồ án tốt nghiệp (`AcademicRoadmapStepper`) dùng chung cho cả 3 phân hệ Sinh viên, Giảng viên và Quản trị viên với phong cách thiết kế Bento hiện đại, hiệu ứng thị giác chuyển sắc phát sáng và điều hướng chuyên trách.

**Architecture:** Tạo component dùng chung `AcademicRoadmapStepper.jsx` và kiểu dáng `academic-roadmap.css` tại `frontend/src/components/common/`. Sau đó tích hợp vào `StudentDashboardPage.jsx` (giữ nguyên luồng cá nhân), `LecturerDashboardPage.jsx` (tính toán phân bổ sinh viên theo 6 mốc và điều hướng công tác GVHD), và `DashboardPage.jsx` (chuyển đổi lưới thẻ rời rạc sang lộ trình gắn kết, bảo lưu `stage.target` từ máy chủ).

**Tech Stack:** React (Vite), Ant Design (`@ant-design/icons`), Tailwind CSS, Vitest / React Testing Library.

**Spec:** [docs/superpowers/specs/2026-11-20-academic-roadmap-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-20-academic-roadmap-design.md)

## Global Constraints
- Tuân thủ mô hình `TopicRegistration`: 1 sinh viên / 1 đề tài (`maxStudents = 1`), 1 GVHD tối đa 10 sinh viên.
- Tất cả các tệp phải lưu định dạng UTF-8 không BOM.
- Chuẩn nút bấm & nhãn (Quy tắc 2.6): Tuyệt đối không chèn emoji hoặc ký tự thô (`←`, `→`, `+`, `🤖`, `✓`, v.v.) vào nhãn nút/thẻ; luôn dùng thuộc tính `icon={<IconComponent />}` từ `@ant-design/icons`. Sử dụng tiếng Việt học vụ chuẩn mực.
- Dữ liệu thực tế bám sát máy chủ backend, không dùng mock data.

## Review Focus
- Trường hợp giảng viên chưa có sinh viên nào hướng dẫn (`students.length === 0`): Stepper hiển thị `0/10 Sinh viên`, các mốc không bị lỗi NaN và các thẻ hiển thị trạng thái `0 sinh viên`.
- Trường hợp học kỳ không có đủ ngày tháng cấu hình: Hàm format ngày hiển thị nhãn mặc định chuyên nghiệp (ví dụ: `Theo lịch Viện`, `Chờ ban hành`) thay vì `Invalid Date`.
- Trường hợp quản trị viên chọn học kỳ đang tải dữ liệu hoặc lỗi: Component không bị crash khi `roadmapStages` rỗng hoặc null.
- Hỗ trợ trợ năng và giảm chuyển động (`@media (prefers-reduced-motion: reduce)`): Vô hiệu hóa hoạt ảnh rung lắc/trượt khi người dùng bật chế độ giảm chuyển động.
- Kiểm tra tính nhất quán chuyển trang: Bấm mốc 6 của Giảng viên chuyển đến `/lecturer/grading` (khớp route trong `App.jsx`).

---

### Task 1: Xây dựng thành phần dùng chung `AcademicRoadmapStepper.jsx` và CSS
**Files:**
- Create: `frontend/src/components/common/AcademicRoadmapStepper.jsx`
- Create: `frontend/src/components/common/academic-roadmap.css`
- Create: `frontend/tests/academicRoadmapStepper.test.jsx`

**Interfaces:**
- Produces: `<AcademicRoadmapStepper role={role} title={title} subtitle={subtitle} badgeLabel={badgeLabel} progressPercent={progressPercent} milestones={milestones} />`
- Mảng `milestones`: mỗi phần tử chứa `{ key, stepNumber, title, subText, dateText, state, icon, onClick, styleVars }`

- [ ] **Step 1: Viết test kiểm thử đơn vị cho `AcademicRoadmapStepper`**
  - Viết file `frontend/tests/academicRoadmapStepper.test.jsx` kiểm tra kết xuất 6 mốc, thanh tiến độ `style.width`, nhãn badge và sự kiện `onClick`.
- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  - Chạy `npx vitest run frontend/tests/academicRoadmapStepper.test.jsx`
  - Kỳ vọng: Thất bại do chưa có file component.
- [ ] **Step 3: Hiện thực `AcademicRoadmapStepper.jsx` và `academic-roadmap.css`**
  - Xây dựng component nhận diện các thuộc tính theo đặc tả.
  - Áp dụng các biến màu CSS gradient (`--step-color`, `--step-soft`, `--step-border`, `--step-glow`, `--step-gradient`).
  - Tích hợp thanh ray kết nối `sd-roadmap-rail` và `sd-roadmap-fill`.
  - Hỗ trợ `@media (prefers-reduced-motion: reduce)`.
- [ ] **Step 4: Chạy test xác nhận vượt qua**
  - Chạy `npx vitest run frontend/tests/academicRoadmapStepper.test.jsx`
  - Kỳ vọng: PASS 100%.
- [ ] **Step 5: Commit**
  - `git add frontend/src/components/common/AcademicRoadmapStepper.jsx frontend/src/components/common/academic-roadmap.css frontend/tests/academicRoadmapStepper.test.jsx`
  - `git commit -m "feat: create shared AcademicRoadmapStepper component and styles"`

---

### Task 2: Tái cấu trúc Tổng quan Sinh viên (`StudentDashboardPage.jsx`)
**Files:**
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx:987-1055`
- Test: `frontend/tests/academicRoadmapStepper.test.jsx`

**Interfaces:**
- Consumes: `<AcademicRoadmapStepper />` từ `frontend/src/components/common/AcademicRoadmapStepper`

- [ ] **Step 1: Viết test kiểm thử tích hợp cho Student Dashboard**
  - Bổ sung ca kiểm thử trong `frontend/tests/academicRoadmapStepper.test.jsx` mô phỏng hiển thị mốc sinh viên.
- [ ] **Step 2: Tích hợp `AcademicRoadmapStepper` vào `StudentDashboardPage.jsx`**
  - Import `AcademicRoadmapStepper`.
  - Thay thế khối JSX `sd-roadmap-card` hiện tại bằng `<AcademicRoadmapStepper role="STUDENT" title="Lộ trình 6 Mốc Quy Trình Đồ Án Tốt Nghiệp (Theo Chuẩn Viện Công nghệ Số)" subtitle="Theo dõi trạng thái từng giai đoạn và mốc thời gian quan trọng của học kỳ" badgeLabel={`${progressPercent}% Hoàn tất`} progressPercent={progressPercent} milestones={milestones} />`.
- [ ] **Step 3: Chạy test và xác nhận giao diện hoạt động đồng bộ**
  - Chạy `npx vitest run frontend/tests/academicRoadmapStepper.test.jsx`
  - Kỳ vọng: PASS 100%.
- [ ] **Step 4: Commit**
  - `git add frontend/src/pages/student/StudentDashboardPage.jsx frontend/tests/academicRoadmapStepper.test.jsx`
  - `git commit -m "refactor: integrate shared AcademicRoadmapStepper in StudentDashboardPage"`

---

### Task 3: Tích hợp Lộ trình 6 mốc vào Tổng quan Giảng viên (`LecturerDashboardPage.jsx`)
**Files:**
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Create: `frontend/tests/lecturerRoadmapIntegration.test.jsx`

**Interfaces:**
- Consumes: `<AcademicRoadmapStepper />`, dữ liệu `students` và `activeSemester`
- Logic phân bổ 6 mốc:
  - Mốc 1: `PENDING`, `REGISTERED` -> Click `/lecturer/approvals`
  - Mốc 2: `APPROVED`, `BM01_SUBMITTED`, `BM01_NEEDS_REVISION`, `BM01_RESUBMITTED`, `TERMINATED_BM01` -> Click `/lecturer/outline-evaluations`
  - Mốc 3: `BM01_PASSED`, `BM02_OPEN`, `BM02_SUBMITTED`, `BM02_NEEDS_REVISION`, `BM02_RESUBMITTED`, `BM02_APPROVED`, `TERMINATED_BM02` -> Click cuộn mượt xuống khu vực sinh viên/BM02
  - Mốc 4: `DECISION_ISSUED`, `IN_PROGRESS`, `IN_PROGRESS_BM03`, `BM03_SIGNATURE_PENDING`, `TERMINATED_FAILED_PROGRESS` -> Click `/lecturer/progress?tab=meeting-logs`
  - Mốc 5: `BM03_PASSED`, `BM04_REVIEW`, `TERMINATED_BM04` -> Click `/lecturer/progress?tab=bm04`
  - Mốc 6: `DEFENSE_READY`, `DEFENSE_ELIGIBLE`, `DEFENDED`, `DEFENSE_PASSED`, `COMPLETED` -> Click `/lecturer/grading`
- `progressPercent`: Trung bình cộng tiến độ sinh viên được hướng dẫn

- [ ] **Step 1: Viết test kiểm thử cho logic phân bổ 6 mốc của Giảng viên**
  - Tạo `frontend/tests/lecturerRoadmapIntegration.test.jsx` kiểm tra hàm tính `milestones`, số lượng từng mốc, và thanh tiến độ.
- [ ] **Step 2: Chạy test xác nhận thất bại trước khi cài đặt**
  - Chạy `npx vitest run frontend/tests/lecturerRoadmapIntegration.test.jsx`
  - Kỳ vọng: FAIL.
- [ ] **Step 3: Hiện thực hook `useMemo` tính `milestones` và gắn `AcademicRoadmapStepper` vào `LecturerDashboardPage.jsx`**
  - Thêm tính toán 6 mốc của GVHD kèm biến màu sắc gradient chuẩn mực.
  - Đặt component ngay dưới `OverviewKpis` và phía trên lưới hàng đợi `AttentionQueue`.
- [ ] **Step 4: Chạy test xác nhận vượt qua**
  - Chạy `npx vitest run frontend/tests/lecturerRoadmapIntegration.test.jsx`
  - Kỳ vọng: PASS 100%.
- [ ] **Step 5: Commit**
  - `git add frontend/src/pages/lecturer/LecturerDashboardPage.jsx frontend/tests/lecturerRoadmapIntegration.test.jsx`
  - `git commit -m "feat: integrate AcademicRoadmapStepper in LecturerDashboardPage"`

---

### Task 4: Nâng cấp khối Lộ trình trên Tổng quan Quản trị viên (`DashboardPage.jsx`)
**Files:**
- Modify: `frontend/src/pages/admin/DashboardPage.jsx:317-372`
- Create: `frontend/tests/adminRoadmapIntegration.test.jsx`

**Interfaces:**
- Consumes: `<AcademicRoadmapStepper />`, dữ liệu `adminActionsQuery.data?.roadmap`, `activeSemester`
- Điều hướng: Gọi `handleNavigateTarget(stage.target)` để giữ nguyên tham số `semesterId` từ API máy chủ.
- `progressPercent`: `Math.round((completedStagesCount / 6) * 100)`

- [ ] **Step 1: Viết test kiểm thử nâng cấp Lộ trình Quản trị viên**
  - Tạo `frontend/tests/adminRoadmapIntegration.test.jsx` kiểm tra ánh xạ 6 giai đoạn từ `roadmapStages` sang các mốc có màu sắc và click handler.
- [ ] **Step 2: Chạy test xác nhận thất bại**
  - Chạy `npx vitest run frontend/tests/adminRoadmapIntegration.test.jsx`
  - Kỳ vọng: FAIL.
- [ ] **Step 3: Thay thế lưới thẻ cũ bằng `AcademicRoadmapStepper` trong `DashboardPage.jsx`**
  - Ánh xạ các mốc từ `roadmapStages` với các styleVars chuẩn hóa tương ứng.
  - Tính `progressPercent` của quản trị viên và nhãn badge (`${stats?.totalStudents || 0} Sinh viên`).
- [ ] **Step 4: Chạy test xác nhận vượt qua**
  - Chạy `npx vitest run frontend/tests/adminRoadmapIntegration.test.jsx`
  - Kỳ vọng: PASS 100%.
- [ ] **Step 5: Commit**
  - `git add frontend/src/pages/admin/DashboardPage.jsx frontend/tests/adminRoadmapIntegration.test.jsx`
  - `git commit -m "feat: modernize admin semester roadmap with AcademicRoadmapStepper"`

---

### Task 5: Kiểm thử toàn diện & Đóng gói hệ thống
**Files:**
- Toàn bộ codebase frontend

- [ ] **Step 1: Chạy toàn bộ test suite frontend**
  - Lệnh: `npm --prefix frontend test`
  - Kỳ vọng: 100% tests PASS, không có lỗi suy thoái nào.
- [ ] **Step 2: Chạy đóng gói hệ thống Vite build**
  - Lệnh: `npm --prefix frontend run build`
  - Kỳ vọng: Build hoàn tất thành công.
- [ ] **Step 3: Rà soát Quy tắc 2.6 và UTF-8**
  - Kiểm tra không có ký tự thô / emoji trong nhãn nút bấm; tất cả file đều là UTF-8 không BOM.
- [ ] **Step 4: Commit hoàn tất**
  - `git commit --allow-empty -m "chore: verify academic roadmap stepper across all dashboards"`
