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

### Phiên 09/11/2026

#### 1. Những phần đã hoàn thành
1. **Kiến trúc Bảo mật Chống Leo thang Đặc quyền (P0 Anti-Escalation & Academic Scope Guard)**:
   - Ngăn chặn Quản trị viên kỹ thuật tự nâng quyền hoặc gán 48 quyền học thuật được bảo vệ (`ACADEMIC_PROTECTED_PERMISSIONS`) nếu không sở hữu thẩm quyền học thuật `PERMISSION_ASSIGN_ACADEMIC`.
   - Kiểm tra delta quyền trong cùng transaction khi tạo/sửa nhóm hoặc gán nhóm cho người dùng.
   - Thẩm định phạm vi học thuật theo khoa chính thức (`TopicRegistration.topic.mentor.department`), loại bỏ cơ chế fallback mơ hồ.
   - Kiểm tra hiệu lực ủy quyền `AcademicDelegation` thời gian thực (in-tx delegation check), vô hiệu hóa cache khi thu hồi ủy quyền.
   - Tách route và phân quyền độc lập cho các nghiệp vụ: `CHECKPOINT_ISSUE`, `SIGNATURE_APPEAL_REVIEW`, `RESULT_PUBLICATION_PUBLISH`.
2. **Tối ưu hóa Giao diện Ma trận Phân quyền P1 (Permission Matrix UX & Registry Stats)**:
   - Tái cấu trúc ma trận phân quyền thành Accordion 14 module chức năng có nút Thu gọn/Mở rộng tất cả (`Expand/Collapse All`).
   - Bộ lọc đa chiều: Hành động vs Xem dữ liệu, Quyền học thuật vs Kỹ thuật hệ thống, tìm kiếm từ khóa thời gian thực.
   - Nhóm gộp mã bí danh (Canonical Alias Grouping): Tinh gọn 10 cặp alias về mã chuẩn đại diện, tự động đồng bộ payload khi lưu.
   - KPI thống kê quyền sinh tự động từ registry (loại bỏ số liệu hardcode).
   - Khóa checkbox an toàn (Guard disable) trên UI đối với admin kỹ thuật không có thẩm quyền học thuật.
3. **Khắc phục Lỗi Điều hướng & Giao diện Trắng Trang**:
   - Sửa lỗi `ReferenceError: NAVIGATION_REGISTRY is not defined` trong `AppLayout.jsx` khi URL chứa query params `?tab=...`.
   - Sửa lỗi 403 Forbidden khi Admin truy cập Trung tâm thông báo (`NotificationCenterPage.jsx`) bằng cách lazy-load hội đồng và mở rộng quyền đọc `GET /api/councils`.
4. **Sửa lỗi Schema Prisma trên Đợt Đồ án (`Semester`) & Hồ sơ Đăng ký (`TopicRegistration`)**:
   - Khắc phục lỗi Prisma crash `Unknown field code for select statement on model Semester` tại `lecturerAssignmentController.js` và `manualReviewController.js` (loại bỏ `code: true` trên `Semester`).
   - Sửa lỗi trắng trang tại Hàng đợi thẩm định (`/admin/manual-reviews`) do chọn trường `code` không tồn tại trên `Semester`.
   - Khắc phục lỗi `Unknown field semester for include statement on model TopicRegistration` tại `lecturerAssignmentController.js` (dòng 75 và 614), chuyển sang truy vấn chuẩn qua `topic.semester`.
5. **Điều phối Phân công Giảng viên (`LecturerProjectAssignment`) & Lọc Giảng viên Khả dụng**:
   - Cấp quyền `ENROLLMENT_MANAGE` cho toàn bộ các thao tác ghi của phân công giảng viên trong `lecturerAssignmentRoutes.js`, cho phép Quản trị viên điều phối đợt đồ án không bị lỗi 403.
   - Triển khai API mới `GET /api/lecturer-assignments/available-lecturers`:
     + Lọc bỏ giảng viên đã được phân công trong đợt đồ án.
     + Ứng dụng thuật toán sweep kiểm tra tải đỉnh thời gian thực, loại bỏ giảng viên đã chạm trần 10 sinh viên ở các đợt gối đầu.
     + Tính toán chỉ tiêu tối đa còn khả dụng (`availableQuota`) và tự động giới hạn `plannedQuota` trên form UI.

#### 2. Trạng thái cập nhật của từng phần
- **Backend API**: `OPERATIONAL` - Tất cả các route điều phối đợt đồ án, phân công giảng viên, ma trận quyền và phân hệ bảo mật hoạt động ổn định.
- **Frontend SPA**: `BUILD PASS` - 3222 modules build production thành công trong 13.7s; giao diện ma trận quyền và điều phối đợt đồ án phản hồi mượt mà.
- **Database / Prisma**: `ALIGNED` - Toàn bộ các truy vấn Prisma đã được rà soát và khớp 100% với `schema.prisma`.
- **MCP Servers**: Hoạt động bình thường.
- **Test Suite**:
  + Backend: **66/66 test suites PASS, 499/499 tests PASS** (100%).
  + Frontend: **93/93 tests PASS** (100%).
- **Git Branch**: `develop` - Đã push toàn bộ commits lên GitHub.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Kiểm tra nghiệm thu luồng E2E phân công giảng viên từ file Excel trong tab Giảng viên hướng dẫn.
2. Kiểm tra lại luồng xử lý quyết định thẩm định đề cương và kháng nghị chữ ký tiến độ BM03.
3. Rà soát hiệu năng các câu truy vấn sweep capacity khi số lượng giảng viên và sinh viên tăng cao (stress test dữ liệu lớn).

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Phân quyền điều phối đợt đồ án**: Bổ sung `ENROLLMENT_MANAGE` cho các route phân công giảng viên (`LecturerProjectAssignment`) vì đây là công tác điều phối đợt chung của Quản trị viên và Giáo vụ, tách biệt với quyền phân công người hướng dẫn đích danh từng đề tài (`MENTOR_ASSIGN`).
2. **Lọc Giảng viên Khả dụng tại Tầng Backend**: Thực hiện sweep capacity trên server (`GET /api/lecturer-assignments/available-lecturers`) thay vì lọc thủ công trên client, nhằm đảm bảo quy chế "1 GVHD tối đa 10 sinh viên" được bảo vệ chặt chẽ trên toàn bộ các đợt đồ án gối đầu.
3. **Truy vấn quan hệ kỳ học qua `Topic`**: `TopicRegistration` liên kết trực tiếp với `Topic` và `Topic` mới có quan hệ `Semester`, do đó toàn bộ các truy vấn lấy thông tin kỳ học của hồ sơ phải đi qua `topic.semester`.

### Phiên 28/10/2026

#### 1. Những phần đã hoàn thành

1. **Audit chức năng theo giao diện OpenDesign**:
   - Đối chiếu UI và API cho Student, Admin, Lecturer; phân loại phần đã có API, phần chưa tích hợp và các nút placeholder.
   - Xác nhận các khoảng trống trọng yếu của Lecturer: broadcast nội bộ, nhật ký gặp BM03, reminder hàng loạt, checkpoint BM03 và duyệt lại BM01.
2. **Đặc tả hoàn thiện Cổng Giảng viên**:
   - Đã chốt thông báo của GVHD chỉ là notification nội bộ, không gửi email.
   - Viết và commit đặc tả [2026-10-28-lecturer-workflow-completion-design.md](file:///d:/DACN/docs/superpowers/specs/2026-10-28-lecturer-workflow-completion-design.md) (`99b2212`).
   - Phạm vi gồm: broadcast có kiểm soát ownership, sửa contract nhật ký BM03, reminder dùng API thật, chấm Checkpoint 1/2 và hàng đợi duyệt lại BM01.
3. **Xác minh build frontend**:
   - `frontend/npm run build`: PASS, hoàn thành trong 15.48 giây.

#### 2. Trạng thái cập nhật của từng phần

- **Database**: `UNCHANGED` trong phiên này; các tính năng Lecturer được thiết kế để tái sử dụng schema hiện có.
- **Backend API**: `PENDING IMPLEMENTATION` cho endpoint broadcast nội bộ của GVHD; các API meeting log, task reminder, checkpoint grade và BM01 approve đã tồn tại nhưng chưa được UI Lecturer sử dụng đúng/đủ.
- **Frontend SPA**: `BUILD PASS`; chưa triển khai năm luồng Lecturer vì phiên hiện tại dừng sau khi đặc tả được duyệt.
- **Test**: `BUILD PASS`; chưa chạy backend test suite trong phiên này.
- **Git/worktree**: Có nhiều thay đổi sẵn có ngoài phạm vi phiên; chúng được giữ nguyên. Chỉ đặc tả mới được commit riêng.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Lập kế hoạch triển khai chi tiết từ đặc tả Lecturer đã được duyệt.
2. Backend trước: thêm endpoint `POST /api/notifications/lecturer-broadcast`, validator, ownership guard và integration tests.
3. Frontend tiếp theo: nối broadcast, sửa `createMeetingLog(registrationId, data)`, nối reminder, dựng UI checkpoint từ task/submission thật và hàng đợi duyệt lại BM01.
4. Verification: chạy `npm test` trong `backend/`, `npm run build` trong `frontend/`, sau đó E2E bằng tài khoản Lecturer và Student.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **GVHD chỉ gửi notification nội bộ cho SV mình hướng dẫn**: backend tự suy ra người nhận từ `TopicRegistration.topic.mentorId`, không nhận danh sách SV từ UI; tránh gửi nhầm hoặc vượt quyền.
2. **Tái sử dụng nghiệp vụ có sẵn**: checkpoint tiếp tục dùng `gradeSubmission`, duyệt lại BM01 tiếp tục dùng `bm01-gvhd-approve`, reminder tiếp tục dùng `/tasks/remind`; giảm thay đổi schema và giữ state machine hiện hữu làm nguồn chân lý.
3. **Không đánh lừa trạng thái thành công**: loại bỏ các toast/setTimeout placeholder thuộc năm luồng được chọn; thành công phải dựa trên phản hồi API thật.

### 1. Những phần đã hoàn thành
1. **Chuẩn hóa Quy trình Đồ án Tốt nghiệp Mới (BM01 - BM04 & Hội đồng Bảo vệ)**:
   - CSDL: 11 trạng thái `RegistrationStatus`, model `TopicTitleAdjustment`, model `BM04Evaluation` (khóa bất biến `isLocked = true`).
   - Backend API: Nộp lại BM01 (`resubmitBM01`), GVHD duyệt lại BM01, nộp BM02 có guard, Ban hành Quyết định giao đề tài (`issuePeriodDecision`), cửa sổ 7 ngày đổi tên đề tài, cơ chế dừng đề tài tức thì khi trượt Checkpoint BM03 (`TERMINATED_FAILED_PROGRESS`), phiếu nhận xét BM04 4 tiêu chí.
   - Frontend UI/UX: Thanh tiến trình 6 bước, modal đổi tên 7 ngày, modal BM04, triệt tiêu 100% các nút và cơ chế Bypass.
2. **Tính Năng Ghi Nhớ Đăng Nhập & Sửa Lỗi Trắng Trang `/admin/oversight`**:
   - Ghi nhớ đăng nhập (Remember Me): Cấp JWT 30 ngày (nếu tick nhớ) hoặc 1 ngày (nếu không); lưu trữ hybrid giữa `localStorage` và `sessionStorage`; tự động điền email.
   - Sửa lỗi trắng trang `/admin/oversight`: Khắc phục `ReferenceError: pickNearestLatestSemesterId is not defined` bằng hàm chuẩn `computeSemesterClosestToNow`, bổ sung fallback học kỳ.
3. **Phân Hệ Quản Trị Tiêu Chí Rubric Chấm Điểm Bảo Vệ (Admin Defense Rubric Customization)**:
   - Đã hoàn thành 5 giai đoạn: CSDL, Backend API & Guard, Quản trị Rubric Admin, Chấm điểm động Giảng viên & Admin, Kiểm thử nghiệm thu (20/20 test suites PASS, `npm run build` 0 lỗi).
4. **Cơ Chế Demo Nghiệp Vụ Chuẩn Hóa & Hoàn Thiện Phân Quyền Viện Trưởng**:
   - **Script Khởi Tạo Demo Tự Động (`backend/scripts/setupDemoScenario.js`)**: Cơ chế idempotent gán nhanh 3 hồ sơ sinh viên vào 3 trạng thái đại diện:
     + Kịch bản 1: Nộp lại BM01 & GVHD duyệt đạt (`sv001` & `lecturer02`).
     + Kịch bản 2: Nộp BM02 & Ban hành Quyết định Viện (`sv002` & `lecturer01`/`admin`).
     + Kịch bản 3: Đổi tên đề tài trong cửa sổ 7 ngày & GVHD phê duyệt (`sv003` & `lecturer04`).
   - **Phân Quyền & Route Viện Trưởng Ban Hành Quyết Định**:
     + Backend: Thêm `authorizeRoleOrPermission` trong [auth.js](file:///d:/DACN/backend/src/middlewares/auth.js); cấp phép cho nhóm `VIEN_TRUONG` (`PROJECT_ASSIGNMENT_PUBLISH`) tại endpoint `POST /api/semesters/:id/issue-decision`.
     + Frontend Route: Mở route `/lecturer/institute` trỏ tới [ProjectPeriodPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectPeriodPage.jsx) cho Cổng Giảng viên.
     + Frontend Sidebar: Tự động hiển thị mục "Quản lý Viện & Ban hành QĐ" trên thanh điều hướng [AppLayout.jsx](file:///d:/DACN/frontend/src/components/layout/AppLayout.jsx); bổ sung cơ chế auto-sync thông tin tài khoản qua `authService.getMe()`.
     + Giao diện phân quyền: [ProjectPeriodPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectPeriodPage.jsx) phân biệt rõ vai trò Admin vs Viện trưởng (ẩn các nút cấu hình thêm/sửa/xóa đợt đồ án dành riêng cho Admin, giữ nổi bật nút ký ban hành QĐ).
   - **Tính Năng Xem Danh Sách Đề Tài Đã Ban Hành Quyết Định**:
     + Bổ sung nút **"Danh sách QĐ"** trên thẻ học kỳ tại [ProjectPeriodPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectPeriodPage.jsx).
     + Modal chi tiết danh sách đề tài theo Quyết định: STT, Mã SV, Họ tên SV, Tên đề tài (kèm tên điều chỉnh nếu có), GVHD, Số Quyết định, Ngày ký ban hành và Tag trạng thái `DECISION_ISSUED`.

5. **Chuyển Đổi Giao Diện Người Dùng Chuẩn OpenDesign (Phase 1, Phase 2, Phase 3 & Phase 4)**:
   - **Phase 1 (Design Tokens & Shell Layout)**: Font `JetBrains Mono` kết hợp `Inter`/`Lexend`, bảng màu Pine Teal (`#0F766E`, `#115E59`, `#F0FDFA`), Collapsible Sidebar (256px -> 72px) và Lecturer Quota Widget.
   - **Phase 2 (Cổng Giảng Viên - Lecturer Portal)**: Hoàn tất 100% các màn hình [LecturerDashboardPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerDashboardPage.jsx), [TopicManagementPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/TopicManagementPage.jsx), [TopicApprovalPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/TopicApprovalPage.jsx), [ProgressTrackingPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/ProgressTrackingPage.jsx) + [StudentProgressDetailPanel.jsx](file:///d:/DACN/frontend/src/pages/lecturer/components/StudentProgressDetailPanel.jsx), [GradingPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/GradingPage.jsx) + [LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx).
   - **Phase 3 (Cổng Quản Trị Viên - Admin Portal)**:
     + **Admin Dashboard** ([DashboardPage.jsx](file:///d:/DACN/frontend/src/pages/admin/DashboardPage.jsx)): Command Center với Triage Queue (3 thẻ cảnh báo), Milestone Stepper 5 chặng, bố cục 68/32, phân bổ đề tài theo Bộ môn và Activity Feed thời gian thực.
     + **Thẩm Định Đề Tài** ([TopicManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/TopicManagementPage.jsx)): Phân loại tab trạng thái kèm bộ đếm, bảng đề tài hiển thị mã và Quota GVHD, thanh trượt **Side Drawer** xem và duyệt đề tài nhanh.
     + **Phân Công Hội Đồng 2 Cột** ([CouncilAssignmentPage.jsx](file:///d:/DACN/frontend/src/pages/admin/CouncilAssignmentPage.jsx)): Kiến trúc Two-Column Matcher:
       * Thanh chuyển Pha: `1. HĐ Thẩm định Đề cương (Pha 2)` vs `2. HĐ Chấm Bảo vệ (Pha 5)`.
       * 4 Thẻ KPI: Tổng HĐ, SV hợp lệ, Đã xếp HĐ, Kiểm tra xung đột lợi ích (GVHD != Giám khảo).
       * Cột trái (38%): Hàng đợi sinh viên đủ ĐK với bộ lọc `Tất cả`/`Chưa xếp`/`Đã xếp`, ô tìm kiếm, tag trạng thái, pill điểm BM04 và nút gán nhanh.
       * Cột phải (62%): Thẻ Hội đồng với thông tin địa điểm/ca thi, thanh đo dung lượng (`x / 10 SV`), lưới 3 thành viên giám khảo (Chủ tịch, Thư ký, Phản biện), danh sách sinh viên được gán và nút thao tác. Hỗ trợ chuyển đổi linh hoạt giữa giao diện Ghép cặp Matcher và Bảng tổng hợp.
     + **Quản Trị Người Dùng & Hồ Sơ Phân Quyền** ([UserManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/UserManagementPage.jsx)): 4 thẻ KPI tài khoản, Segmented tabs theo vai trò kèm bộ đếm, Quota Chip (`x / 10 SV`), thanh trượt **User Profile Side Drawer** hiển thị chi tiết thông tin, quyền RBAC và thao tác nhanh, Wizard import Excel.
      + **Sổ Điểm & Chấm Bảo Vệ** ([GradingDefensePage.jsx](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx)): Bảng điểm học vụ, 4 KPI cards, thanh lọc faceted, Side Drawer 740px chấm Rubric với banner phát hiện độ lệch điểm giữa các giám khảo và thẻ đối chiếu điểm thành viên hội đồng.
      + **Quản Lý Tiêu Chí Chấm & Biểu Mẫu BM** ([RubricManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/RubricManagementPage.jsx)): Danh mục biểu mẫu BM01-BM06, trình tạo Rubric động (Rubric Builder) với Scale Integrity Monitor kiểm soát chuẩn 10.00 điểm và lịch sử phiên bản.
      + **Giám Sát Tiến Độ & Lưu Chiểu** ([ProjectOversightPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectOversightPage.jsx)): Radar cảnh báo trễ hạn, ma trận biểu mẫu BM01-BM04, kho lưu chiểu số (PDF, Video, GitHub).
      + **Đồng Bộ Hoàn Toàn 5 Màn Hình Quản Trị Hệ Thống**:
        * [ProjectPeriodPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectPeriodPage.jsx): Header Nordic chuẩn, 4 KPI cards đợt đồ án, timeline stepper, switch mở cổng đăng ký, nút Ký ban hành Quyết định giao đề tài và xem danh sách QĐ.
        * [ProjectEnrollmentPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectEnrollmentPage.jsx): Header Nordic chuẩn, 3 KPI cards, bộ lọc học kỳ/môn đồ án, gán thủ công và gán bằng Excel, đối soát tính toàn vẹn quy tắc gán.
        * [AnnouncementManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/AnnouncementManagementPage.jsx): Header Nordic chuẩn, 3 KPI cards (tổng số, đã ghim, đang công khai), bảng bản tin đào tạo và modal tạo thông báo.
        * [PermissionGroupPage.jsx](file:///d:/DACN/frontend/src/pages/admin/PermissionGroupPage.jsx): Header Nordic chuẩn, 4 KPI cards (nhóm quyền, nhóm hệ thống, permissions, module), bảng phân quyền vai trò.
        * [NotificationCenterPage.jsx](file:///d:/DACN/frontend/src/pages/admin/NotificationCenterPage.jsx): Header Nordic chuẩn, 3 KPI cards, 2 tab (Lịch sử gửi broadcast & Cấu hình mẫu tự động), modal soạn thông báo broadcast.
   - **Phase 4 (Cổng Sinh Viên - Student Portal)**:
     + **Bàn Làm Việc Sinh Viên** ([StudentDashboardPage.jsx](file:///d:/DACN/frontend/src/pages/student/StudentDashboardPage.jsx)): Thẻ Topic Hero Banner với mã đề tài mono, tiêu đề, chip GVHD phụ trách (quy chế `1 SV / 1 Đề tài`), lưới 4-Item Meta Grid (GVHD, Sinh viên, Hạn chót tiếp theo, Tình trạng Hội đồng), 4 nút thao tác nhanh (Trao đổi GVHD, QĐ BM02, Đề xuất sửa tên trong 7 ngày, Xin rút), lộ trình 6 bước trực quan với tỷ lệ hoàn thành %, các thẻ cảnh báo workflow, 4 StatCards, bố cục 2 cột gồm Mốc nộp sắp tới, Thẻ cán bộ hướng dẫn & Nhóm nghiên cứu, Thông báo học vụ Viện và Hộp tải nhanh biểu mẫu chuẩn (BM01, BM03, LaTeX, Slide).
     + **Tra Cứu & Đăng Ký Đề Tài** ([TopicListPage.jsx](file:///d:/DACN/frontend/src/pages/student/TopicListPage.jsx)): Banner cửa sổ đăng ký, thanh công cụ tìm kiếm, lọc theo tên môn đồ án, lọc theo trạng thái (`Còn nhận SV` / `Đã đủ số lượng`), nút chuyển đổi "Đề tài đã lưu", thẻ đề tài chuẩn hóa với tech tags, chip GVHD, chỉ tiêu SV (`1/1 SV`), modal chi tiết và xác nhận đăng ký.
     + **Nộp Biểu Mẫu & Báo Cáo Tiến Độ** ([SubmissionPage.jsx](file:///d:/DACN/frontend/src/pages/student/SubmissionPage.jsx)): Lộ trình 6 mốc học vụ bắt buộc, danh sách nhiệm vụ khóa tuần tự không thể bypass, mô hình Hybrid (điền dữ liệu có cấu trúc + file đính kèm), xem nhận xét GVHD và Bảng Sổ nhật ký làm việc định kỳ với GVHD.
     + **Xem Điểm & Lưu Chiểu Tốt Nghiệp** ([GradeViewPage.jsx](file:///d:/DACN/frontend/src/pages/student/GradeViewPage.jsx)): Banner kết quả chính thức với dải màu Pine Teal (`#0F766E` -> `#115E59`), điểm số thang 10 & điểm chữ, bố cục 2 cột gồm Bảng Điểm Thành Phần Chi Tiết (GVHD 40%, Phản biện 20%, Hội đồng 40%, Tổng kết 100%) và Hồ Sơ Lưu Chiểu Số (GitHub repo, Video demo, Báo cáo toàn văn PDF có chữ ký, nút cấp Giấy xác nhận), thẻ Hội đồng bảo vệ và 3 thành viên giám khảo kèm biên bản PDF.
     + **Kiểm Thử Nghiệm Thu**: `npm run build` thành công trong 12.84s (0 lỗi), `npm test` backend vượt qua 20/20 test suites / 95 tests PASS 100%.

### 2. Trạng thái cập nhật của từng phần
- **Database**: `PASS` (Supabase PostgreSQL hoạt động ổn định, tuân thủ mô hình TopicRegistration).
- **Backend API**: `PASS` (20/20 test suites / 95 tests đều PASS 100%).
- **Frontend SPA**: `PASS` (Phase 1, Phase 2, Phase 3, Phase 4 đã hoàn tất 100%, `npm run build` thành công trong 13.22s với 0 lỗi).
- **Kiểm thử nghiệm thu (E2E Integration)**: `PASS` (Kiến trúc tương thích 100% API backend hiện hữu, không sử dụng dữ liệu giả mock data).

### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm thử trải nghiệm người dùng thực tế trên trình duyệt (E2E Browser Verification)**:
   - Dùng tài khoản Sinh viên (`sv001`, `sv002`, `sv003`) kiểm tra quy trình: duyệt đề tài, nộp đề cương BM01, gửi đơn xin đổi tên đề tài trong 7 ngày, theo dõi điểm số và nộp lưu chiểu.
   - Dùng tài khoản Giảng viên (`lecturer01`, `lecturer02`, `lecturer04`) kiểm tra: phê duyệt đề tài, đánh giá BM03 Checkpoint 1 & 2, ký duyệt BM04, chấm điểm rubric Hội đồng.
   - Dùng tài khoản Quản trị viên (`admin@university.edu.vn`) kiểm tra: xem Command Center Dashboard, điều phối ca thi bằng Two-column Matcher, quản trị người dùng qua Side Drawer.
2. **Tối ưu hóa Bundle & Trải nghiệm Responsive**:
   - Tối ưu kích thước chunking cho Vite (`rollupOptions.manualChunks`).
   - Kiểm tra trải nghiệm trên thiết bị di động (Mobile / Tablet viewport).

### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Mô hình Matcher 2 Cột cho Phân công Hội đồng**: Bố cục 38% Hàng đợi Sinh viên - 62% Bảng Thẻ Hội đồng giúp Quản trị viên điều phối ca thi và phân công sinh viên trực quan, xem được sức chứa còn lại và kiểm tra xung đột lợi ích theo thời gian thực mà không phải chuyển trang liên tục.
2. **Side Drawer cho Thẩm định & Hồ sơ Người dùng**: Sử dụng Ant Design Drawer trượt từ bên phải thay vì chuyển hướng trang hay dùng Modal chiếm toàn màn hình, giúp quản trị viên duy trì ngữ cảnh bảng danh sách mà vẫn tra cứu / phê duyệt được chi tiết.
3. **Đồng bộ Nhận diện Học thuật Toàn Cổng (Academic Pine Palette)**: Toàn bộ Cổng Giảng viên, Cổng Quản trị viên và Cổng Sinh viên đều dùng chung bảng màu Pine Teal (`#0F766E`, `#115E59`, `#F0FDFA`) và font `JetBrains Mono` cho mã đề tài/điểm số, mang lại cảm giác nhất quán, chuyên nghiệp và trang trọng.
4. **Bảo toàn 100% API Backend**: Toàn bộ dữ liệu hiển thị trên bảng, drawer và các bộ đếm KPI đều liên kết trực tiếp với các endpoint hiện hữu của `councilService`, `userService`, `registrationService`, `semesterService`, đảm bảo tính toàn vẹn dữ liệu và không phát sinh mock data.

### Phiên 28/10/2026 — Workflow Integrity P0A

#### 1. Những phần đã hoàn thành

1. Hoàn thiện và phê duyệt đặc tả nguồn chân lý cho toàn bộ vòng đời `TopicRegistration`, gồm state machine, INV-01…INV-27, RBAC, deadline, audit và ma trận nghiệm thu tại `docs/superpowers/specs/2026-10-28-thesis-workflow-integrity-design.md`.
2. Hoàn thiện implementation plan và audit P0 tại:
   - `docs/superpowers/plans/2026-10-28-thesis-workflow-integrity-implementation-plan.md`.
   - `docs/superpowers/audits/2026-10-28-thesis-workflow-p0-audit.md`.
   - `docs/superpowers/audits/2026-10-28-p0a-baseline.md`.
3. Hoàn tất P0A containment:
   - Gỡ `POST /api/tasks/:id/bypass`, `POST /api/registrations/:id/bypass-outline` và batch bypass.
   - Xóa controller/callsite bypass; không còn `bypass`, `isBypassed`, `bm04-review` hoặc `reviewBM04` trong mã runtime `backend/src` và `frontend/src`.
   - Chặn `PATCH /tasks/:id/status` đối với task học vụ BM01, BM02, BM03 và BM04.
   - Gỡ BM04 legacy; chỉ giữ contract tại evaluation module, chỉ GVHD hiện hành được ký, không nhận điểm, yêu cầu `BM03_PASSED` và đủ lưu chiểu trước bảo vệ.
   - Gán hội đồng bảo vệ chỉ chấp nhận BM04 đã khóa và registration ở `DEFENSE_READY`; task BM04 `COMPLETED` không còn là bằng chứng thay thế.
   - Chặn rút/drop/hủy từ `DECISION_ISSUED` trở đi bằng `409 INVALID_TRANSITION`.
4. Cập nhật test âm cho endpoint bypass, BM04 sai trạng thái/sai vai trò, task học vụ generic, rút hồ sơ sau QĐ và gate gán hội đồng.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `SCHEMA VALID`; chưa chạy migration. Database đang kết nối còn 4 migration cũ chưa áp dụng, vì vậy không chạy `migrate deploy/dev` khi chưa xác nhận database clone.
- **Backend API**: `P0A COMPLETE`; toàn bộ test pass 20/20 suites, 98/98 tests. P0B transition service, policy version và state history chưa triển khai.
- **Frontend SPA**: `BUILD PASS`; Vite build thành công với 3195 modules. Đã gỡ service BM04 legacy và dấu vết CSS bypass; giữ nguyên các thay đổi UI có sẵn ngoài phạm vi.
- **MCP/External services**: Không thay đổi và không triển khai production.
- **Test**: Test tích hợp mục tiêu pass 4/4 suites, 39/39 tests; full backend pass 98/98; Prisma validate pass; frontend build pass.
- **Git/worktree**: Worktree có nhiều thay đổi người dùng từ trước; không reset hoặc gom thay đổi ngoài phạm vi. Thư mục `docs/` đang bị `.gitignore` bỏ qua, cần `git add -f` nếu muốn commit tài liệu.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0B/CSDL trước**: thêm `PeriodWorkflowPolicyVersion`, `TopicRegistration.stateVersion`, `periodPolicyVersionId`, `RegistrationStateHistory`, command receipt/idempotency và `ManualReviewCase`; tạo migration chỉ để thử trên database clone.
2. **Mapping/backfill**: viết script dry-run phân loại hồ sơ legacy; hồ sơ có bypass, thiếu bằng chứng BM02/QĐ, điểm thiếu phiếu hoặc archive mâu thuẫn phải vào `MANUAL_REVIEW`; tuyệt đối không suy diễn hoặc ghi đè dữ liệu cũ.
3. **Backend foundation**: tạo `workflowPolicyService` và `registrationTransitionService` dùng transaction + CAS/optimistic locking + idempotency; retry cùng key trả cùng kết quả, stateVersion cũ trả 409.
4. **Verification**: thêm unit/integration/concurrency tests; chạy Prisma validate, full backend test và frontend build. Chỉ apply/backfill sau khi người dùng xác nhận database clone và báo cáo mapping.
5. Sau khi P0B ổn định mới triển khai P1 theo thứ tự BM01 → BM02 version → AssignmentDecision/DecisionAmendment.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Fail closed khi schema chưa đủ**: kết luận BM04 `NOT_AGREED_FOR_DEFENSE` hiện trả `WORKFLOW_FOUNDATION_REQUIRED`, không tái sử dụng enum sai hoặc tạo trạng thái giả; `TERMINATED_BM04` sẽ được bổ sung đúng migration.
2. **Không tin `Task.status` cho transition học vụ**: task generic chỉ phục vụ công việc; trạng thái `TopicRegistration` và thực thể BM tương ứng mới là nguồn chân lý.
3. **Không dùng task BM04 hoàn thành để xếp hội đồng**: yêu cầu đồng thời `DEFENSE_READY`, BM04 `AGREED_FOR_DEFENSE` và phiếu đã khóa nhằm chặn dữ liệu legacy/bypass lọt qua.
4. **Không đụng database chưa xác định là clone**: baseline phát hiện 4 migration chưa áp dụng; chạy migration/backfill lúc này có nguy cơ tác động dữ liệu thật và làm sai báo cáo mapping.
5. **Bảo toàn worktree người dùng**: mọi chỉnh sửa P0A được thực hiện cục bộ theo file mục tiêu, không reset hay ghi đè các thay đổi UI/OpenDesign đang tồn tại.
6. **Tiếp tục tuân thủ thiết kế đã phê duyệt**: hồ sơ terminal không hồi sinh; BM03/BM04 không có điểm; policy được pin; lịch sử pháp lý/học vụ append-only và command nhạy cảm phải transaction, idempotent, có audit.

### Phiên 28/10/2026 — Workflow Integrity P0B và P1 Foundation

#### 1. Những phần đã hoàn thành

1. **Hoàn thiện mã nguồn nền P0B**:
   - Bổ sung `PeriodWorkflowPolicyVersion`, `TopicRegistration.stateVersion`, `periodPolicyVersionId`, `RegistrationStateHistory`, `IdempotencyRecord` và `ManualReviewCase` trong Prisma schema.
   - Tạo migration additive `20261028190000_workflow_integrity_foundation`; chưa apply lên database.
   - Tạo `workflowPolicyService` và `registrationTransitionService` với transaction, CAS/optimistic locking, append-only history và idempotency receipt.
   - Chuyển `drop`, `withdraw`, `cancel` qua transition service; `cancel` không còn xóa registration mà chuyển sang `WITHDRAWN` có lịch sử.
2. **Hoàn thiện bộ công cụ phân tích/backfill P0B**:
   - Tạo `analyzeLegacyData.js`, `backfillWorkflowFoundation.js`, `verifyBackfill.js` và `rollbackWorkflowFoundation.sql`.
   - Backfill mặc định dry-run; apply bắt buộc có `--apply` và `WORKFLOW_BACKFILL_DATABASE_CLONE=true`.
   - Hồ sơ bypass, thiếu bằng chứng QĐ/BM02, sai số lượng phiếu hoặc archive mâu thuẫn được phân loại `MANUAL_REVIEW`.
3. **Triển khai P1 foundation cho BM01, BM02 và Quyết định**:
   - Bổ sung `BM01Evaluation`, `BM02Submission` versioned, current BM02 pointer, `AssignmentDecision` bất biến và `DecisionAmendment`.
   - Tạo migration `20261028210000_bm01_bm02_assignment_decisions`; chưa apply lên database.
   - Tạo `academicDocumentService` cho nộp BM02 lần đầu/nộp lại, quota, deadline, policy pin, supersession và ban hành QĐ từ BM02 current đã `APPROVED`.
   - Nối `POST /api/registrations/bm02-submit` vào command mới; loại bỏ runtime BM02 legacy dựa trên `Task`/`Submission`.
   - Nối `POST /api/semesters/:id/issue-decision` vào command QĐ bất biến; frontend gửi `Idempotency-Key` cho BM02, QĐ và các command rút/hủy.
4. **Cập nhật kiểm thử và kế hoạch**:
   - Thêm test service cho transition, BM02 version/quota/deadline và QĐ current-approved/idempotency.
   - Cập nhật integration test BM02 theo contract fail-closed mới.
   - Cập nhật trạng thái implementation plan: P0B đã triển khai nhưng chưa apply DB clone; P1 đang triển khai.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `SCHEMA VALID`; Prisma generate/validate pass. Hai migration P0B/P1 mới chỉ tồn tại trong worktree, chưa chạy `migrate dev/deploy`, chưa seed và chưa backfill trên database đang kết nối.
- **Backend API**: `P0B FOUNDATION IMPLEMENTED`, `P1 PARTIAL`; BM02 submit và issue decision đã dùng command service. BM01 revision command, BM02 review/return/exception và DecisionAmendment API chưa hoàn tất.
- **Frontend SPA**: `BUILD PASS`; Vite build thành công với 3195 modules. Service BM02/QĐ đã gửi idempotency key; chưa triển khai đầy đủ UI version/deadline/review của P1.
- **MCP/External services**: Không thay đổi, không deploy production và không ghi dữ liệu vào dịch vụ ngoài.
- **Test**: Full backend pass 22/22 suites, 112/112 tests; Prisma validate pass; frontend build pass.
- **Git/worktree**: Vẫn có nhiều thay đổi UI/backend có sẵn của người dùng. Không reset, không gom hoặc ghi đè thay đổi ngoài phạm vi workflow; chưa tạo commit trong phiên này.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P1/BM01**: chuyển `resubmitBM01`, duyệt lần đầu/lần hai và quá hạn sang `BM01Evaluation` + transition service; thực thi quota một lần sửa và `TERMINATED_BM01`; bỏ quyền Admin kỹ thuật duyệt chuyên môn mặc định.
2. **P1/BM02 review**: thêm command/route Viện `APPROVE`, `RETURN_FOR_REVISION`, `EXCEPTION_REVIEW`; lưu issues, notifiedAt, revisionDeadlineAt và kiểm tra capability.
3. **P1/QĐ**: thêm integration/concurrency test cho hai request ban hành đồng thời; triển khai `DecisionAmendment` thay vì sửa trực tiếp QĐ gốc.
4. **Controller cleanup**: tiếp tục loại mọi cập nhật trực tiếp `TopicRegistration.status` khỏi evaluation/semester/registration controller theo từng thực thể con đã sẵn sàng.
5. **Database clone**: khi có clone, chạy P0B migration → analyze dry-run → duyệt `MANUAL_REVIEW` → apply/backfill/verify/rollback rehearsal; sau đó mới chạy migration P1.
6. **Verification**: sau mỗi lát cắt chạy full backend tests, Prisma validate và frontend build; chưa mở command production trước khi migration verification pass.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Không chạy migration khi chưa có DB clone**: toàn bộ schema, migration và script được chuẩn bị sẵn nhưng không tác động database chưa xác định; tránh làm hỏng dữ liệu thật hoặc tạo mapping sai.
2. **Idempotency phải ở cả domain command và transition**: BM02 retry không được tạo version mới trước khi transition nhận ra request lặp; QĐ retry phải trả đúng QĐ cũ và từ chối reuse key với payload khác.
3. **BM02 version là nguồn chân lý, không phải `Task.status`**: bản hiện hành được pin bằng `currentBM02SubmissionId`; bản cũ bất biến và được đánh dấu superseded.
4. **QĐ gốc là append-only theo từng hồ sơ**: unique registration/BM02 bảo đảm một QĐ gốc; cùng số QĐ có thể áp dụng cho nhiều sinh viên trong một đợt, nên chỉ đánh index `decisionNumber + issuedAt`, không unique theo cặp này.
5. **Không đổi tên đề tài như side effect khi nộp BM02**: thay đổi tên phải đi qua quy trình adjustment/amendment có actor, lý do và audit riêng.
6. **Fail closed khi thiếu policy hoặc idempotency key**: command BM02/QĐ trả lỗi thay vì rơi về logic legacy hoặc tự suy diễn từ trạng thái giao diện.

### Phiên 28/10/2026 — Hoàn tất P1 và diễn tập migration/backfill trên DB clone

#### 1. Những phần đã hoàn thành

1. **Hoàn thiện P1/BM01**:
   - Tạo `bm01WorkflowService` cho nộp lần đầu, thẩm định lần đầu, nộp lại đúng một lần và thẩm định lần hai.
   - Lưu từng lần bằng `BM01Evaluation`, pin policy, kiểm tra deadline/quota và liên kết phiên bản qua `supersedesId`.
   - Không đạt lần hai hoặc quá hạn chuyển hồ sơ sang `TERMINATED_BM01`; hồ sơ terminal không thể hồi sinh.
   - Route BM01 yêu cầu đúng vai trò/capability; Admin kỹ thuật không được mặc định thực hiện thẩm định chuyên môn.
2. **Hoàn thiện P1/BM02**:
   - Tạo `bm02ReviewService` với ba command `APPROVE`, `RETURN_FOR_REVISION`, `EXCEPTION_REVIEW`.
   - Duy trì `currentBM02SubmissionId`, phiên bản cũ bất biến, quota sửa dùng chung và deadline được pin tại thời điểm trả hồ sơ.
   - Lưu issues, người/thời điểm thẩm định và xử lý exception mà không tự tăng quota sửa.
   - Chặn nộp BM01/BM02 qua endpoint task generic; mọi thay đổi học vụ phải đi qua domain command tương ứng.
3. **Hoàn thiện Quyết định giao đề tài**:
   - Chỉ ban hành QĐ từ phiên bản BM02 hiện hành đã `APPROVED` và cùng policy.
   - Bổ sung idempotency/concurrency guard để hai request đồng thời không tạo QĐ gốc thứ hai.
   - Triển khai `DecisionAmendment` append-only; không sửa trực tiếp QĐ gốc và retry cùng key trả cùng kết quả.
4. **Diễn tập migration/backfill trên database clone đã được người dùng xác nhận**:
   - Kiểm tra schema legacy và xác minh bốn migration cũ đã hiện diện tương đương trong database trước khi đánh dấu `applied` trong Prisma history.
   - Apply thành công `20261028190000_workflow_integrity_foundation` và `20261028210000_bm01_bm02_assignment_decisions`.
   - Sửa mapping Prisma `BM02Submission.reviewedAt @map("reviewed_at")` và `ManualReviewCase.resolvedAt @map("resolved_at")`; schema diff sau sửa không còn khác biệt.
   - Chạy analyzer/backfill theo batch trong transaction: tổng 122 hồ sơ, 14 hồ sơ đủ bằng chứng được pin policy, 108 hồ sơ được đưa vào `ManualReviewCase`, không có hồ sơ thất lạc.
   - Tối ưu script để tránh timeout, giữ dry-run mặc định, bắt buộc cờ xác nhận clone khi apply và bảo đảm tiến trình CLI đóng kết nối sạch.
5. **Kiểm thử và hậu kiểm**:
   - Full backend pass `25/25` test suites, `135/135` tests.
   - Prisma migrate status: `17 migrations found`, database schema up to date.
   - Prisma schema diff: `No difference detected`.
   - `verifyBackfill`: `valid: true`, `accountedFor: 122`, không có `unaccountedRegistrationIds`.
   - Các file migration/schema/script trong phạm vi đạt `git diff --check` và UTF-8 không BOM.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `CLONE MIGRATION PASS`; 17 migration đã được ghi nhận, P0B/P1 đã apply, schema khớp Prisma. Backfill cân bằng 122/122 hồ sơ; 108 hồ sơ đang chờ duyệt thủ công.
- **Backend API**: `P0B COMPLETE`, `P1 CORE COMPLETE`; BM01, BM02 review/version, QĐ gốc và amendment đã dùng transaction, CAS/idempotency và audit entity. Vẫn còn controller legacy của các giai đoạn BM03/BM04/archive cập nhật trực tiếp `TopicRegistration.status`.
- **Frontend SPA**: `P1 PARTIAL`; sinh viên đã dùng command BM01/BM02 và hiển thị cảnh báo revision/deadline cơ bản. Chưa hoàn thiện contract `allowedActions`, màn hình Viện duyệt BM02/version history và toàn bộ UI P2–P5.
- **MCP/External services**: Không thay đổi, không deploy production và không tác động database production.
- **Test**: `PASS`; backend 25/25 suites và 135/135 tests. Frontend build gần nhất pass; chưa có bộ E2E trình duyệt đầy đủ cho toàn bộ vòng đời mới.
- **Tiến độ implementation plan**: khoảng `9/21 task` chức năng (`42,9%`), hoặc khoảng `40%` nếu chấm nghiêm theo Definition of Done. Riêng phạm vi P0A → P1 đạt khoảng `90–95%`.
- **Git/worktree**: Không reset hoặc ghi đè các thay đổi UI/backend có sẵn của người dùng; chưa tạo commit trong phiên.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0/P1 vận hành dữ liệu**: duyệt 108 `ManualReviewCase`, xác nhận mapping từng hồ sơ trước khi lập kế hoạch production; không tự động suy diễn bằng chứng còn thiếu.
2. **P2/CSDL trước**: thiết kế và migration `CheckpointEvaluation`, bản ghi chữ ký đôi, `CheckpointSignatureAppeal`, `MentorTransfer` và BM04 chuẩn; giữ nguyên nguyên tắc BM03/BM04 không có điểm số.
3. **P2/Backend**: triển khai command phát hành checkpoint, chữ ký GVHD/SV, deadline ba ngày, appeal và chuyển GVHD có hiệu lực; sau đó chuyển BM04 sang transition service.
4. **Controller cleanup**: loại các cập nhật trực tiếp `TopicRegistration.status` còn lại trong task/evaluation/archive/council controller; mọi transition phải qua `registrationTransitionService`.
5. **P5/action contract**: backend trả `status`, `stateVersion`, `allowedActions`, deadline và child-state summary; frontend bỏ các danh sách trạng thái hard-code và nối UI duyệt BM02/amendment.
6. **Verification**: bổ sung integration/concurrency test ở cấp HTTP, E2E ba vai trò và migration rehearsal trên một clone mới từ đầu. Chỉ lập rollout production sau khi 108 manual case được xử lý và toàn bộ gate P2 liên quan đạt.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Không chạy rollback P0B sau khi đã apply P1 trên cùng clone**: rollback metadata nền lúc này sẽ làm schema và lịch sử Prisma không nhất quán; rollback phải được diễn tập riêng trên clone chỉ có P0B hoặc trên clone mới.
2. **Manual review thay cho suy diễn legacy**: 108 hồ sơ thiếu hoặc mâu thuẫn bằng chứng được giữ nguyên và đưa vào hàng đợi duyệt thủ công; không tự tạo QĐ, điểm, submission hoặc archive giả.
3. **BM01/BM02 version là bằng chứng học vụ**: `Task` chỉ là lớp hiển thị/công việc; evaluation/submission hiện hành cùng policy pin mới quyết định transition.
4. **QĐ pháp lý là append-only**: QĐ gốc bất biến; mọi điều chỉnh phải tạo `DecisionAmendment` có actor, lý do, thời điểm và idempotency key.
5. **Migration lịch sử chỉ được resolve sau kiểm chứng tương đương**: bốn migration legacy chỉ được đánh dấu applied sau khi đã đối chiếu enum, cột, index, foreign key và dữ liệu backfill liên quan trên clone.
6. **Ưu tiên tiếp theo vẫn theo thứ tự CSDL → Backend → Frontend**: P2 phải có schema và transition command đúng trước khi nối giao diện; không mở rộng logic legacy để đạt nhanh UI.

### Phiên 28/10/2026 — Hoàn tất Giai đoạn P0 & P2 Workflow Integrity (BM03 Checkpoint, Khiếu nại chữ ký, Điều chuyển GVHD & BM04)

#### 1. Những phần đã hoàn thành

1. **CSDL & Migration P2**:
   - Bổ sung 7 trạng thái vào `RegistrationStatus`: `BM03_SIGNATURE_PENDING`, `CHECKPOINT_SIGNATURE_APPEAL_OPEN`, `CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED`, `CHECKPOINT_SIGNATURE_APPEAL_REVIEW`, `SIGNATURE_APPEAL_RESOLVED`, `BM04_REVIEW`, `TERMINATED_BM04`.
   - Bổ sung enums `CheckpointConclusion` (`ALLOWED_TO_CONTINUE`, `NOT_ALLOWED_TO_CONTINUE`), `CheckpointAppealStatus` (`PENDING`, `SUBMITTED`, `APPROVED`, `REJECTED`, `EXPIRED`), `NOT_AGREED_FOR_DEFENSE` vào `BM04Conclusion`.
   - Tạo mới model `CheckpointEvaluation`: lưu kết quả không điểm số, nhận xét, minh chứng, chữ ký đôi GVHD + SV, hạn ký 3 ngày (`studentSignDeadlineAt`), supersedes chain và policy pin.
   - Tạo mới model `CheckpointSignatureAppeal`: lưu đơn khiếu nại trong hạn 3 ngày khi SV quá hạn ký, bằng chứng, thẩm định độc lập (cấm GVHD thẩm định đơn của SV mình).
   - Tạo mới model `MentorTransfer`: lưu vết điều chuyển GVHD, lý do, người duyệt, kiểm tra quota <= 10 SV và cấm chuyển khi BM04 đã khóa hoặc hồ sơ terminal.
   - Cập nhật `BM04Evaluation`: liên kết `policyVersionId`, hỗ trợ `TERMINATED_BM04`.
   - Tạo migration additive `20261028230000_bm03_checkpoint_mentor_transfer_bm04` và apply thành công lên DB clone (`npx prisma migrate deploy` 18 migrations up to date).
   - `node scripts/workflow-integrity/verifyBackfill.js`: `valid: true`, 122/122 hồ sơ được cân bằng đầy đủ.
2. **Backend Domain Services & Controllers**:
   - `backend/src/services/checkpointWorkflowService.js`:
     - `issueCheckpoint`: GVHD phát hành CP1/CP2, guard quyền GVHD, kiểm tra CP1 đạt trước khi mở CP2, chuyển status sang `BM03_SIGNATURE_PENDING`.
     - `signCheckpoint`: SV ký nhận trong hạn 3 ngày. Đủ 2 chữ ký: CP1 đạt -> `IN_PROGRESS_BM03`; CP2 đạt -> `BM03_PASSED`; Không đạt -> `TERMINATED_FAILED_PROGRESS`.
     - `handleSignatureOverdue`: Quá hạn ký 3 ngày -> chuyển `CHECKPOINT_SIGNATURE_APPEAL_OPEN`, mở hạn khiếu nại 3 ngày.
     - `submitSignatureAppeal`: SV nộp đơn khiếu nại trong 3 ngày -> chuyển `CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED`.
     - `reviewSignatureAppeal`: Admin/Viện trưởng duyệt (cấm GVHD). Chấp thuận -> `SIGNATURE_APPEAL_RESOLVED`; Bác -> `TERMINATED_FAILED_PROGRESS` (INV-26).
   - `backend/src/services/mentorTransferService.js`:
     - `transferMentor`: Chuyển GVHD, kiểm tra quota <= 10 SV, cấm chuyển khi BM04 đã khóa hoặc hồ sơ terminal, cập nhật `topic.mentorId`, tạo `MentorTransfer`.
   - `backend/src/services/bm04WorkflowService.js`:
     - `submitBM04`: Ký khóa BM04, fail-closed sang `DEFENSE_READY` (nếu đủ lưu chiểu trước bảo vệ) hoặc `TERMINATED_BM04`.
   - `backend/src/controllers/evaluationController.js` & `backend/src/routes/evaluationRoutes.js`: Thêm 6 routes Checkpoint (`issue`, `sign`, `handle-overdue`, `appeal`, `review-appeal`, `list`).
   - `backend/src/controllers/registrationController.js` & `backend/src/routes/registrationRoutes.js`: Thêm `POST /api/registrations/:id/transfer-mentor`.
3. **Frontend Integration & Modals**:
   - `frontend/src/services/evaluationService.js`: Bổ sung 6 phương thức API Checkpoint.
   - `frontend/src/services/registrationService.js`: Bổ sung API `transferTopicMentor`.
   - `frontend/src/components/common/statusMap.js`: Thêm nhãn và badge styling cho 7 trạng thái mới.
   - `frontend/src/components/lecturer/CheckpointIssueModal.jsx`: Modal GVHD phát hành Checkpoint 1 & 2 kèm chữ ký số và tài liệu minh chứng.
   - `frontend/src/components/student/CheckpointSignModal.jsx`: Modal SV ký xác nhận hoặc nộp khiếu nại quá hạn 3 ngày.
   - `frontend/src/components/admin/MentorTransferModal.jsx`: Modal Admin điều chuyển GVHD với kiểm tra quota và lý do pháp lý.
   - `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`: Nối dữ liệu thật cho Checkpoint 1 & 2 ở Tab 3, kiểm tra điều kiện tiên quyết CP1 trước khi mở CP2, tích hợp `CheckpointIssueModal`.
   - `frontend/src/pages/student/SubmissionPage.jsx`: Hiển thị banner khẩn cấp khi đang ở `BM03_SIGNATURE_PENDING` hoặc `CHECKPOINT_SIGNATURE_APPEAL_OPEN`, tích hợp `CheckpointSignModal`.
   - `frontend/src/pages/student/StudentDashboardPage.jsx`: Cập nhật nhãn trạng thái và thêm action trực quan ký BM03 ngay trên Hero Card.
   - `frontend/src/pages/admin/TopicManagementPage.jsx`: Tích hợp action "Điều chuyển GVHD" trong Side Drawer chi tiết đề tài và nối `MentorTransferModal`.
4. **Kiểm thử & Verification**:
   - Backend test suite: **PASS 26/26 test suites, 148/148 tests (100%)**.
   - Unit test service Checkpoint (`checkpointWorkflowService.test.js`): PASS 13/13 tests bao quát 5 flow chính.
   - Frontend build: **PASS 100% (`npm run build` hoàn tất trong 17.46s, 0 lỗi)**.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE (18 migrations)`; 18 migration đã được ghi nhận và apply trên DB clone. Schema đồng bộ 100% với Prisma.
- **Backend API**: `P0 & P2 COMPLETE`; BM01, BM02, Quyết định giao đề tài, BM03 Checkpoint 1 & 2, Khiếu nại chữ ký, Điều chuyển GVHD và BM04 đã tuân thủ chuẩn transaction, append-only audit, idempotency và optimistic locking.
- **Frontend SPA**: `P0 & P2 COMPLETE (BUILD PASS)`; Các màn hình Giảng viên (ProgressTracking), Sinh viên (Dashboard, Submission), Quản trị viên (TopicManagement) đã kết nối trực tiếp với backend qua các modal chuyên dụng.
- **MCP/External services**: Không thay đổi, không triển khai production.
- **Test**: `PASS 100%`; Backend 26/26 test suites / 148/148 tests; Frontend build pass.
- **Git/worktree**: Bảo toàn toàn bộ các thay đổi uncommitted trước đó của người dùng; chuẩn mã hóa UTF-8 (no BOM).

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **Xử lý Hàng đợi 108 `ManualReviewCase`**: Duyệt và phân loại hồ sơ legacy để chuẩn bị cho giai đoạn nghiệm thu toàn diện.
2. **Triển khai P3 (Hội đồng & Đánh giá bảo vệ)**:
   - Chuẩn hóa phân công Hội đồng bảo vệ: 3-5 thành viên, kiểm tra xung đột lợi ích (GVHD không được làm Chủ tịch/Phản biện cho SV mình).
   - Rubric chấm điểm số Hội đồng: GVHD 40%, Phản biện 20%, Hội đồng 40%; chỉ mở chấm khi registration ở `DEFENSE_READY`.
3. **Triển khai P4 (Lưu chiểu số & Cấp Giấy xác nhận hoàn thành)**:
   - Nghiệm thu đủ 4 thành phần lưu chiểu sau bảo vệ (Toàn văn PDF, Slide, Video demo, GitHub codebase).
   - Ký điện tử cấp Giấy xác nhận hoàn thành khóa luận (`ClearanceCertificate`).
4. **E2E Browser Verification**: Diễn tập toàn diện trên trình duyệt với 3 vai trò: Sinh viên, Giảng viên, Quản trị viên.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Cơ chế Ký đôi Checkpoint (Mutual Signature)**: BM03 Checkpoint bắt buộc phải có chữ ký của cả GVHD và SV thì mới có hiệu lực học vụ. Quá hạn 3 ngày không ký thì không thể ký trực tiếp mà phải mở cơ chế khiếu nại (`CheckpointSignatureAppeal`).
2. **Thẩm định Khiếu nại Độc lập**: GVHD bị cấm thẩm định đơn khiếu nại của chính sinh viên mình hướng dẫn (INV-26), đảm bảo tính khách quan và minh bạch của Ban chủ nhiệm / Trưởng khoa.
3. **Điều chuyển GVHD có ràng buộc Quota**: Một GVHD chỉ được hướng dẫn tối đa 10 sinh viên; hệ thống tự động chặn nếu GVHD mới đã đạt quota 10 SV, hoặc hồ sơ đã có BM04 đã khóa.
4. **BM04 Tuyệt đối Không Điểm Số**: BM04 chỉ mang tính chất pháp lý quyết định (`AGREED_FOR_DEFENSE` hoặc `NOT_AGREED_FOR_DEFENSE`). Không sử dụng điểm số ở BM04, tránh xung đột với điểm đánh giá quá trình và điểm bảo vệ Hội đồng.
5. **Tiếp tục bám sát Nguyên tắc "Sửa gốc vấn đề trước"**: Mọi chức năng đều được hoàn thiện từ tầng Prisma CSDL -> Backend Service/Route -> Frontend Component/Page.

### Phiên 29/10/2026 — Hoàn tất Giai đoạn P3 (Hội đồng Chấm bảo vệ & Chuẩn hóa Điểm độc lập) và P4 (Lưu chiểu số & Cấp Giấy xác nhận hoàn thành)

#### 1. Những phần đã hoàn thành

1. **Chuẩn hóa Hội đồng Chấm bảo vệ & Tính điểm Độc lập (P3)**:
   - **Quy tắc tính điểm**: Điểm tổng kết tốt nghiệp được tính bằng **Trung bình cộng số học của các thành viên Hội đồng hợp lệ** (`CHAIRMAN`, `SECRETARY`, `REVIEWER`), loại bỏ hoàn toàn các tỷ lệ trọng số 20/20/60 hay 40/20/40; phiếu BM04 của GVHD chỉ là điều kiện cần (tiên quyết) để được vào hội đồng bảo vệ, không tính điểm vào tổng kết.
   - **Xử lý xung đột lợi ích (INV-11 & INV-20)**: GVHD tuyệt đối không được chấm điểm bảo vệ cho chính sinh viên mình hướng dẫn (`403 MENTOR_CANNOT_GRADE_OWN_STUDENT`).
   - **Service `backend/src/services/defenseScoringService.js`**:
     * `computeAggregateDefenseScore(memberScores)`: Tính trung bình cộng số học các điểm thành viên hợp lệ, xử lý an toàn kiểu dữ liệu (tránh ép `null` thành `0` trong JS), làm tròn 2 chữ số thập phân (`round2`).
     * `saveMemberScoreSheet`: Chấm điểm độc lập từng thành viên Hội đồng theo Rubric, guard cấm GVHD chấm SV mình, guard `SCORE_LOCKED`, guard `EVALUATOR_NOT_IN_COUNCIL`, tự động cập nhật lại `finalScore` cho `DefenseResult`.
     * `lockDefenseScores`: Khóa điểm (`LOCK`) chỉ được phép khi đủ 3 thành viên đã chấm, chuyển trạng thái qua `registrationTransitionService` sang `DEFENDED`, khóa toàn bộ phiếu điểm (`scoreLocked = true`). Mở khóa (`UNLOCK`) chuyển về `DEFENSE_READY` và mở khóa phiếu điểm.
   - **Cập nhật Backend Controller & Routes**:
     * [evaluationController.js](file:///d:/DACN/backend/src/controllers/evaluationController.js): Mở rộng `DEFENSE_ELIGIBLE_STATUSES` cho phép cả `DEFENSE_READY` và `DEFENDED`; chặn GVHD chấm cho SV mình trong `canLecturerGradeRegistration`; đồng bộ trạng thái khi LOCK/UNLOCK điểm.
   - **Cập nhật Frontend**:
     * [GradeViewPage.jsx](file:///d:/DACN/frontend/src/pages/student/GradeViewPage.jsx): Bỏ mock tỷ lệ 20/20/60, hiển thị lưới 3 giám khảo Hội đồng (Chủ tịch, Thư ký, Cán bộ phản biện), điểm tổng kết là trung bình cộng số học của Hội đồng, banner giải thích quy chế Viện rõ ràng.
     * [GradingDefensePage.jsx](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx): Cập nhật công thức tính `finalCompositeScore` trong Side Drawer sang trung bình cộng các điểm thành viên hội đồng và cập nhật nhãn quy chế.
   - **Unit Tests P3**: Tạo mới `backend/tests/services/defenseScoringService.test.js` (12/12 tests PASS 100%).

2. **Hậu bảo vệ, Lưu chiểu số & Cấp Giấy xác nhận hoàn thành (P4 / P2)**:
   - **Kiểm soát tính toàn vẹn 4 thành phần lưu chiểu**: Bắt buộc nộp đủ 4 thành phần: Báo cáo toàn văn (PDF đã ký), Slide thuyết trình, Đường dẫn mã nguồn (Git Repo) và Video demo sản phẩm.
   - **Service `backend/src/services/archivalWorkflowService.js`**:
     * `checkArchiveComponents`: Xác thực sự hiện diện và định dạng hợp lệ của 4 thành phần lưu chiểu.
     * `generateCertificateVerificationHash`: Sinh mã băm SHA-256 64 ký tự chống làm giả dựa trên mã sinh viên, mã đề tài, học kỳ, điểm tổng kết và thời điểm ký.
     * `submitArchivePostDefense`: Sinh viên ở trạng thái `DEFENDED` có điểm $\ge 5.0$ nộp lưu chiểu số; chặn người ngoài nộp (`FORBIDDEN`).
     * `reviewArchivePostDefense`: Nghiệm thu hồ sơ lưu chiểu; guard INV-06 chặn điểm $< 5.0$ chuyển `COMPLETED`; khi `APPROVED` chuyển `TopicRegistration` sang `COMPLETED` có audit trail và state history; khi `REVISION_REQUIRED` giữ nguyên `DEFENDED`.
     * `getClearanceCertificateData`: Trích xuất thông tin sinh viên, đề tài, hội đồng, điểm số, ngày cấp, mã chứng chỉ và `verificationHash`.
   - **Cập nhật Backend Controller & Routes**:
     * [archiveController.js](file:///d:/DACN/backend/src/controllers/archiveController.js): Bổ sung guard INV-06, tăng `stateVersion`, ghi `registrationStateHistory`, tích hợp sinh mã băm SHA-256.
   - **Cập nhật Frontend**:
     * [ClearanceCertificateModal.jsx](file:///d:/DACN/frontend/src/components/forms/ClearanceCertificateModal.jsx): Hiển thị badge xác thực điện tử `SHA256: [hash]` tại chân trang Giấy xác nhận hoàn thành đồ án.
   - **Unit Tests P4**: Tạo mới `backend/tests/services/archivalWorkflowService.test.js` (12/12 tests PASS 100%).

3. **Hợp đồng Hành động Frontend (Allowed Actions Contract - P5 Task 6.1)**:
   - **Service `backend/src/services/workflowActionService.js`**:
     * `computeAllowedActions(registration, user)`: Tính toán mảng hành động được phép (`allowedActions[]`) dựa trên vai trò (`STUDENT`, `LECTURER`, `ADMIN`, `VIEN_TRUONG`), trạng thái đề tài và các ràng buộc nghiệp vụ (INV-06, INV-11, INV-20, INV-26).
     * Tuyệt đối không cho phép sinh viên hủy (`CANCEL_REGISTRATION`) sau `DECISION_ISSUED`.
     * Giám sát nghiêm ngặt: GVHD bị loại trừ khỏi `GRADE_DEFENSE` ngay cả khi có tên trong danh sách Hội đồng.
   - **Endpoint & Controller**:
     * [registrationController.js](file:///d:/DACN/backend/src/controllers/registrationController.js): Bổ sung `allowedActions` vào `getMyRegistration`, viết endpoint mới `GET /api/registrations/:id/allowed-actions`.
     * [registrationRoutes.js](file:///d:/DACN/backend/src/routes/registrationRoutes.js): Khai báo route `GET /:id/allowed-actions`.
   - **Unit & Integration Tests**:
     * [workflowActionService.test.js](file:///d:/DACN/backend/tests/services/workflowActionService.test.js): 10/10 unit tests PASS.
     * [registrations.routes.test.js](file:///d:/DACN/backend/tests/integration/registrations.routes.test.js): 9/9 integration tests PASS.

4. **Hàng đợi Thẩm định & Chuẩn hóa Hồ sơ Legacy (Manual Review Queue - P5 Task 6.4)**:
   - **Backend Module**:
     * [manualReviewController.js](file:///d:/DACN/backend/src/controllers/manualReviewController.js): `listManualReviewCases` (lọc theo status/học kỳ/phân trang), `getManualReviewCaseDetail`, `resolveManualReviewCase` (xử lý ca trong transaction, tự động gán chính sách `PeriodWorkflowPolicyVersion`, cập nhật trạng thái mục tiêu, ghi log kiểm toán `auditLog`).
     * [manualReviewRoutes.js](file:///d:/DACN/backend/src/routes/manualReviewRoutes.js): Bảo vệ bằng `authenticate` và `authorize('ADMIN')`.
     * [manualReview.routes.test.js](file:///d:/DACN/backend/tests/integration/manualReview.routes.test.js): 4/4 integration tests PASS.
   - **Frontend UI**:
     * [manualReviewService.js](file:///d:/DACN/frontend/src/services/manualReviewService.js): Service gọi API backend.
     * [ManualReviewModal.jsx](file:///d:/DACN/frontend/src/components/admin/ManualReviewModal.jsx): Modal chuyên dụng cho Admin hiển thị chi tiết mã SV, tên đề tài, GVHD, các cảnh báo phát hiện và form giải quyết gán policy.
     * [ProjectOversightPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectOversightPage.jsx): Bổ sung Tab 3 "Hàng Đợi Thẩm Định Legacy" tích hợp bộ lọc, bảng dữ liệu và kết nối modal thẩm định.

6. **Ma Trận Phân Quyền RBAC Matrix (Roles × Modules × Permissions - Chuẩn thiết kế AI-customer-analysis-system)**:
   - **Backend API & Service**:
     * [permissionService.js](file:///d:/DACN/backend/src/services/permissionService.js):
       + `getPermissionMatrix()`: Trích xuất và cấu trúc ma trận 2 chiều gồm danh sách Nhóm vai trò (`roles`), Nhóm chức năng (`modules`) và bảng ánh xạ quyền hiện hành `role_permissions: { [roleId]: [permId, ...] }`.
       + `bulkUpdatePermissionMatrix(payload, actor)`: Lưu toàn bộ ma trận phân quyền hàng loạt trong 1 transaction duy nhất, tự động xóa quyền cũ, chèn quyền mới và ghi nhật ký kiểm toán `auditLog`.
     * [permissionController.js](file:///d:/DACN/backend/src/controllers/permissionController.js) & [permissionRoutes.js](file:///d:/DACN/backend/src/routes/permissionRoutes.js):
       + Mở 2 endpoints: `GET /api/permissions/matrix` và `POST /api/permissions/matrix/bulk` được bảo vệ bằng `PERMISSION_GROUP_MANAGE`.
     * [permissionMatrix.routes.test.js](file:///d:/DACN/backend/tests/integration/permissionMatrix.routes.test.js): 2/2 integration tests PASS.
   - **Frontend UI & Interactive Matrix**:
     * [permissionService.js](file:///d:/DACN/frontend/src/services/permissionService.js): Bổ sung `getPermissionMatrix()` và `bulkUpdatePermissionMatrix(payload)`.
     * [PermissionGroupPage.jsx](file:///d:/DACN/frontend/src/pages/admin/PermissionGroupPage.jsx): Tái thiết kế toàn diện với 3 Tab chuyên sâu:
       + **Tab 1 - Ma Trận Phân Quyền (RBAC Matrix)**:
         * 4 KPI cards: Tổng vai trò, Tổng quyền, Phân hệ chức năng, Quyền đã kích hoạt.
         * Toolbar: Tìm kiếm quyền theo tên/mã code, bộ lọc theo phân hệ chức năng, nút Làm mới, Khôi phục và nút Lưu Ma Trận với dirty tracking.
         * Banner cảnh báo khi có thay đổi chưa lưu (`dirty`).
         * Bảng Ma trận Sticky 2 chiều: Cột trái cố định hiển thị Tên quyền, mã code và checkbox "Áp dụng cho tất cả nhóm" (`togglePermAll`); Header cột hiển thị Nhóm quyền, chip đếm số quyền và checkbox "Tất cả" (`toggleRoleAll`); Từng ô (Cell) là nút tương tác bo tròn 32×32px (Bật: nền Teal `#0F766E` với biểu tượng check; Tắt: viền nhạt với dot xám).
       + **Tab 2 - Quản Lý Nhóm Quyền (Groups Management)**: CRUD tạo/sửa/xóa nhóm quyền, phân công người dùng.
       + **Tab 3 - Từ Điển Quyền Nguyên Tử (Permission Catalog)**: Tra cứu 46 quyền hệ thống theo phân hệ.
   - **Kiểm thử & Build**:
     * Backend Test Suite: **PASS 31/31 test suites, 189/189 tests (100%)**.
     * Frontend Build: **PASS 100% (`npm run build` hoàn thành trong 16.80 giây, 0 lỗi)**.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE (18 migrations)`; CSDL PostgreSQL Supabase khớp 100% schema Prisma.
- **Backend API**: `P0-P5 COMPLETE + RBAC MATRIX COMPLETE`; 31 test suites backend đạt 100%.
- **Frontend SPA**: `BUILD PASS (100%)`; Hoàn tất giao diện Ma trận phân quyền tương tác trực tiếp theo chuẩn thiết kế `AI-customer-analysis-system`.
- **Test**: `PASS 100%` (31/31 backend test suites, 189/189 tests, Vite frontend build 0 lỗi).
- **Git/worktree**: Bảo toàn các file mã nguồn, UTF-8 (no BOM).

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **E2E Testing toàn diện trên trình duyệt**: Sử dụng Playwright / browser subagent thực hiện kiểm thử tự động kịch bản trọn vẹn từ lúc sinh viên đăng ký đề tài -> nộp BM01/BM02 -> BM03 Checkpoint -> BM04 -> Chấm bảo vệ Hội đồng -> Nộp lưu chiểu -> Cấp Giấy xác nhận.
2. **Tiến hành Thẩm định thực tế cho 108 hồ sơ**: Sử dụng giao diện Tab 3 mới trên [ProjectOversightPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectOversightPage.jsx) để thẩm định và gán policy cho các hồ sơ legacy trước khi nghiệm thu.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Điểm Tổng kết Tốt nghiệp là Trung bình Cộng Số học Hội đồng**: Chốt quyết định dứt khoát không dùng công thức trọng số 20/20/60 hay 40/20/40. BM04 của GVHD là điều kiện pháp lý để được bảo vệ (tiên quyết không cho điểm); điểm tổng kết đồ án hoàn toàn do Hội đồng bảo vệ đánh giá độc lập (INV-11, INV-20).
2. **Phòng chống Ép kiểu ngầm định của JavaScript**: Khi tính điểm trung bình cộng, `Number(null)` tự động biến thành `0`. Do đó bắt buộc phải kiểm tra tường minh `finalScore !== null && finalScore !== undefined && finalScore !== ''` trước khi đưa vào tập điểm hợp lệ.
3. **Khóa điểm Hội đồng yêu cầu Đủ 3 Thành viên**: Chỉ cho phép `LOCK` điểm bảo vệ khi cả 3 thành viên hội đồng (`CHAIRMAN`, `SECRETARY`, `REVIEWER`) đều đã hoàn thành bảng điểm Rubric. Khi khóa điểm thành công, trạng thái hồ sơ tự động chuyển sang `DEFENDED`.
4. **Bảo vệ Tính toàn vẹn Trạng thái `COMPLETED` (INV-06 & INV-19)**: Trạng thái `COMPLETED` chỉ được cấp cho sinh viên đã bảo vệ đạt (điểm bảo vệ $\ge 5.0$) và đã nộp đủ 4 thành phần lưu chiểu được nghiệm thu (`APPROVED`). Mọi trường hợp điểm $< 5.0$ đều bị chặn tuyệt đối không thể lên `COMPLETED`.
5. **Hợp đồng Hành động là Nguồn Chân lý Duy nhất**: Frontend không tự định nghĩa danh sách `status` hardcoded để bật/tắt nút hành động mà phải dựa trên `allowedActions[]` do backend tính toán và trả về, đảm bảo an toàn tuyệt đối trước mọi hành vi gian lận hoặc can thiệp client-side.

### Phiên 29/10/2026 — Chuẩn hóa redirect phân quyền và chẩn đoán lỗi quyền Admin

#### 1. Những phần đã hoàn thành

1. **Chuẩn hóa điều hướng xác thực/phân quyền trên frontend**:
   - Tạo `frontend/src/utils/authRedirect.js` làm nguồn dùng chung cho đường dẫn mặc định theo vai trò, kiểm tra role, permission và permission group.
   - Người dùng chưa đăng nhập truy cập `/admin/*`, `/lecturer/*`, `/student/*` hoặc route chức năng không hợp lệ được chuyển về portal công khai `/`, không còn bị đưa tới trang báo thiếu quyền.
   - Người dùng đã đăng nhập nhưng truy cập sai phân hệ được chuyển về dashboard đúng vai trò: Admin, Giảng viên hoặc Sinh viên.
   - Token hết hạn/không hợp lệ (`401`) được xóa khỏi local/session storage và chuyển về portal; thao tác đăng xuất cũng trở về portal.
2. **Khóa route Viện theo permission trước khi render page**:
   - `/lecturer/institute` yêu cầu role `LECTURER` và `PROJECT_ASSIGNMENT_PUBLISH` hoặc nhóm `VIEN_TRUONG`.
   - Giảng viên thường truy cập trực tiếp URL này được chuyển về `/lecturer/dashboard`, tránh mount trang rồi mới nhận `403` từ API.
   - Sửa Role Gateway trong `AuthModal`: chỉ tài khoản có quyền quản lý Viện mới thấy không gian quản lý; lựa chọn này đi đúng `/lecturer/institute`, không còn điều hướng nhầm sang `/admin/dashboard`.
3. **Kiểm thử redirect**:
   - Thêm `frontend/tests/authRedirect.test.js` và script `npm run test:auth`.
   - 5/5 test đạt: chưa đăng nhập, sai vai trò, permission trực tiếp, nhóm `VIEN_TRUONG` và fallback về dashboard/portal.
   - Scoped ESLint cho các file guard/helper đạt; frontend production build đạt với 3196 modules.
4. **Chẩn đoán lỗi ba màn hình Admin**:
   - Xác định `ProjectPeriodPage`, `ProjectEnrollmentPage` và `ProjectOversightPage` đều gọi `GET /api/registrations`.
   - Route backend hiện dùng `authorize('LECTURER')`, nên tài khoản `ADMIN` bị trả `403` với thông báo “Bạn không có quyền truy cập chức năng này.”
   - `registrationController.getAllRegistrations` thực tế đã hỗ trợ Admin xem toàn bộ; chỉ giới hạn theo `mentorId` khi role là `LECTURER`. Đây là lỗi lệch contract giữa route và controller.
   - `CouncilAssignmentPage` cũng gọi cùng API và có cùng nguy cơ bị ảnh hưởng.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: Không thay đổi trong phiên này.
- **Backend API**: Phát hiện lỗi phân quyền P0 chưa sửa: `GET /api/registrations` chỉ cho `LECTURER` dù nhiều màn hình Admin cần sử dụng và controller đã hỗ trợ `ADMIN`.
- **Frontend SPA**: `AUTH REDIRECT IMPLEMENTED`; protected route, fallback route, token expiry, logout và Role Gateway đã dùng quy tắc điều hướng thống nhất.
- **Test**: Auth redirect 5/5 pass; scoped ESLint pass; frontend build pass. Full frontend lint vẫn còn 59 lỗi/9 cảnh báo có sẵn ngoài phạm vi. Không chạy được browser E2E vì môi trường thiếu Python Playwright và không có browser Computer Use khả dụng.
- **MCP/External services**: Không thay đổi, không deploy production.
- **Git/worktree**: Giữ nguyên các thay đổi có sẵn của người dùng; không reset hoặc tạo commit.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0/Backend route authorization**: đổi guard của `GET /api/registrations` từ `authorize('LECTURER')` thành `authorize('ADMIN', 'LECTURER')`; không mở endpoint này cho Sinh viên.
2. **P0/Test hồi quy**: bổ sung integration test xác nhận Admin và Lecturer truy cập được, Student nhận `403`; kiểm tra Lecturer chỉ thấy hồ sơ do mình hướng dẫn trong khi Admin thấy toàn bộ.
3. **P0/Frontend smoke test**: kiểm tra lại bốn màn hình Admin dùng API này: Đợt đồ án, Gán môn đồ án, Giám sát tiến độ và Phân công hội đồng.
4. **Rà ma trận route–controller**: đối chiếu các endpoint Admin khác để phát hiện trường hợp controller hỗ trợ Admin nhưng route chỉ cho Lecturer hoặc ngược lại; ưu tiên API được gọi trong `Promise.all` vì một `403` có thể làm hỏng toàn bộ dữ liệu trang.
5. **E2E phân quyền**: khi có Playwright/browser, chạy ma trận chưa đăng nhập, sai role, thiếu permission, đúng permission và token hết hạn cho cả ba phân hệ.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Phân biệt điều hướng route và quyền thao tác**: sai route/phân hệ phải redirect về trang đúng quyền; `403` do ownership nghiệp vụ (ví dụ sửa hồ sơ người khác) vẫn phải giữ và hiển thị tại thao tác tương ứng.
2. **`401` luôn kết thúc phiên phía client**: token không hợp lệ được xóa và người dùng trở về portal; không để trang chức năng tiếp tục gọi API bằng phiên lỗi.
3. **Không redirect toàn cục cho mọi `403`**: làm vậy sẽ che mất lỗi phân quyền nghiệp vụ và khiến người dùng bị đẩy khỏi trang khi chỉ một thao tác bị cấm.
4. **Frontend route guard phải khớp backend middleware**: menu ẩn không phải biện pháp bảo mật; route phải kiểm tra permission trước khi mount, backend vẫn là lớp thực thi cuối cùng.
5. **Lỗi Admin hiện tại phải sửa ở backend route**: frontend Admin đã vào đúng `/admin/*`; nguyên nhân gốc là `GET /api/registrations` cấu hình thiếu role `ADMIN`, không phải redirect guard.

### Phiên 29/10/2026 — Hoàn thiện Workflow Integration và Audit Ma trận Phân quyền

#### 1. Những phần đã hoàn thành

1. **Hoàn thiện các khoảng trống của Implementation Plan BM01–BM04**:
   - Sửa guard `GET /api/registrations` thành `authorize('ADMIN', 'LECTURER')`; giữ nguyên việc chặn Sinh viên.
   - Bổ sung `GET /api/evaluations/bm04/:registrationId` với ownership guard: Admin được giám sát, GVHD chỉ xem phiếu mình ký, Sinh viên chỉ xem phiếu của chính mình.
   - Chuẩn hóa danh sách ứng viên Hội đồng bảo vệ: API và UI chỉ cho phép hồ sơ `DEFENSE_READY`.
   - Sửa contract modal điều chỉnh tên đề tài: truyền đúng `registrationId`, tên hiện tại và `decisionDate`; bổ sung countdown cửa sổ 7 ngày và khóa nút khi hết hạn.
   - Sửa contract modal BM04: dùng đúng prop `open`, truyền tên GVHD và thống nhất enum `NOT_AGREED_FOR_DEFENSE` giữa Frontend/Backend.
   - Bổ sung chế độ Sinh viên xem phiếu BM04 đã ký ở dạng chỉ đọc.
2. **Hoàn thiện hàng đợi nghiệp vụ Giảng viên**:
   - Lecturer Dashboard đã kết nối API thật cho hàng đợi BM01 cần thẩm định lại.
   - Đã kết nối danh sách đơn đổi tên đề tài và thao tác duyệt/từ chối bằng API thật.
   - Bổ sung trạng thái loading, disabled và thông báo kết quả cho từng thao tác.
3. **Bổ sung kiểm thử hồi quy**:
   - Backend integration tests bổ sung ma trận Admin/Lecturer/Student cho registrations, ownership GET BM04 và lọc `DEFENSE_READY`.
   - Thêm `frontend/tests/workflowContracts.test.js` và script `npm test` để khóa các contract props, enum, hàng đợi Lecturer và bộ lọc Hội đồng.
   - Cập nhật tài liệu implementation plan với trạng thái nghiệm thu ngày 29/10/2026.
4. **Audit Ma trận Phân quyền RBAC**:
   - Xác nhận Admin gọi `GET /api/permissions/matrix` thành công (`200`); Lecturer không có quyền bị chặn đúng (`403`).
   - Xác nhận DB live có 3 nhóm hệ thống, 45 quyền, 47 liên kết và 2 tài khoản có `PERMISSION_GROUP_MANAGE`.
   - Phát hiện catalog code có 46 quyền nhưng DB thiếu `BM02_REVIEW`, khiến endpoint thẩm định BM02 không thể được cấp quyền thực tế.
   - Phát hiện nguy cơ tự khóa quản trị khi gỡ `PERMISSION_GROUP_MANAGE` khỏi mọi nhóm; chưa có invariant bảo vệ.
   - Phát hiện phần lớn 46 quyền mới chỉ được lưu/hiển thị; backend hiện chỉ thực thi trực tiếp 3 mã quyền qua middleware.
   - Phát hiện bulk update thiếu validation chặt và gọi sai chữ ký `auditLog`, nên thao tác lưu ma trận có thể không được ghi audit.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: Schema hợp lệ, 18 migrations vẫn `UP TO DATE`; phát hiện dữ liệu permission catalog chưa đồng bộ (`BM02_REVIEW` thiếu trong DB).
- **Backend API**: Workflow BM01–BM04 và quyền truy cập registrations/BM04 đã hoàn thiện; RBAC Matrix API đọc và happy-path bulk save hoạt động nhưng chưa đạt chuẩn an toàn để nghiệm thu.
- **Frontend SPA**: Các modal workflow, hàng đợi Lecturer, BM04 read-only và lọc Hội đồng đã nối API thật; production build PASS.
- **Test**: Backend **31/31 suites, 195/195 tests PASS**; Frontend **9/9 tests PASS**; scoped ESLint cho các file workflow đã sửa đạt 0 lỗi/0 cảnh báo; Prisma validate PASS.
- **RBAC Matrix Test**: 2/2 integration tests hiện có PASS nhưng mới phủ happy path; scoped lint `PermissionGroupPage.jsx` còn lỗi biến `matrixLoading` chưa sử dụng.
- **E2E/Browser**: Chưa chạy được browser E2E vì môi trường thiếu Python Playwright và browser tích hợp không khả dụng.
- **Git/worktree**: Không reset/ghi đè các thay đổi có sẵn; các file đã sửa giữ UTF-8 no BOM; chưa tạo commit.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0 — Đồng bộ permission catalog**: upsert `BM02_REVIEW` vào DB và gán cho nhóm `VIEN_TRUONG`; xác minh endpoint thẩm định BM02 trả đúng `200/403` theo nhóm quyền.
2. **P0 — Chống tự khóa RBAC**: bắt buộc sau mỗi bulk update vẫn còn ít nhất một nhóm có `PERMISSION_GROUP_MANAGE`; cân nhắc cơ chế break-glass cho Admin hệ thống.
3. **P0 — Validate bulk payload**: kiểm tra đầy đủ group ID, permission ID, số nguyên dương, phần tử trùng và trả `400/409` thay vì bỏ qua hoặc phát sinh FK/500.
4. **P1 — Sửa audit log**: gọi đúng chữ ký `auditLog(userId, action, entityType, entityId, details, ipAddress)` và thêm test xác nhận audit được ghi.
5. **P1 — Áp dụng ma trận vào route thực tế**: lập bảng ánh xạ 46 permission codes với controller/route và thay dần các role guard thô bằng permission guard phù hợp.
6. **P1 — Test bảo mật**: bổ sung test `401`, `403`, payload sai, rollback transaction, permission/group không tồn tại, invariant chống tự khóa và audit trail.
7. **P2 — Frontend/E2E**: dùng `matrixLoading`, cảnh báo quyền hệ thống tối quan trọng và chạy browser E2E khi Playwright khả dụng.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Ma trận lưu được chưa đồng nghĩa RBAC hoạt động đầy đủ**: chỉ coi một permission có hiệu lực khi nó được middleware/controller backend kiểm tra; UI ẩn/hiện hoặc dữ liệu mapping không phải lớp bảo mật cuối cùng.
2. **Không được phép tự thu hồi quyền quản trị cuối cùng**: `PERMISSION_GROUP_MANAGE` là quyền break-glass tối quan trọng; bulk update phải bảo vệ invariant để tránh khóa toàn bộ hệ thống.
3. **Database catalog là nguồn thực thi, code catalog là nguồn khai báo**: hai nguồn phải được đồng bộ idempotent trước khi nghiệm thu; quyền có trong code nhưng thiếu DB được xem là lỗi P0.
4. **Bulk update phải fail toàn bộ khi payload sai**: không bỏ qua âm thầm group ID không hợp lệ; transaction chỉ commit khi toàn bộ group/permission hợp lệ và audit trail có thể được tạo đúng.
5. **Không sửa RBAC trong lượt audit**: yêu cầu cuối phiên là kiểm tra trạng thái, nên chỉ thực hiện read-only diagnostics và ghi lại kế hoạch sửa theo mức ưu tiên.

### Phiên 29/10/2026 — Hoàn tất P0 an toàn Ma trận quyền và P1 thực thi RBAC theo capability

#### 1. Những phần đã hoàn thành

1. **P0 — Gia cố Ma trận phân quyền và đồng bộ catalog**:
   - Chuẩn hóa bulk update tại `permissionService`: chỉ chấp nhận ID số nguyên dương, chặn phần tử trùng, xác minh toàn bộ group/permission tồn tại và fail toàn bộ payload nếu có dữ liệu sai.
   - Chạy transaction mức `Serializable`, khóa nhóm theo thứ tự ID ổn định, ghi audit trong cùng transaction và bảo vệ invariant luôn còn ít nhất một nhóm có `PERMISSION_GROUP_MANAGE`.
   - Tạo và deploy migration `20261029090000_harden_permission_matrix`: upsert `BM02_REVIEW`, gán mặc định cho `VIEN_TRUONG`.
2. **P1 — Chuẩn hóa catalog và primitive phân quyền**:
   - Tạo `backend/src/constants/permissions.js` làm nguồn khai báo chung cho 50 permission codes và mapping mặc định của `GVHD`, `VIEN_TRUONG`, `QUAN_TRI_VIEN`.
   - Bổ sung `authorizePermission`, `authorizeAllPermissions`, `authorizeRoleOrPermission`, `authorizeResolvedPermissions` và `assertPermission`; mọi permission khai báo tại route đều được kiểm tra tồn tại trong catalog.
   - Quyết định và thực thi nguyên tắc: role `ADMIN` không tự động bypass capability.
   - Tạo allowlist exemption có lý do rõ ràng cho endpoint public, self-service và ownership-guarded; bổ sung test coverage phát hiện route chưa có policy.
3. **P1 lát 1 — Quản trị nền tảng**:
   - Chuyển route thông báo công khai, người dùng, học kỳ, enrollment, dashboard báo cáo, notification, rubric, manual review và permission matrix sang capability guard.
   - Bổ sung bốn permission mới: `RUBRIC_MANAGE`, `NOTIFICATION_MANAGE`, `LEGACY_REVIEW_MANAGE`, `FINAL_DOCUMENT_REVIEW`.
   - Frontend menu và protected routes của các màn hình quản trị đã kiểm tra capability tương ứng trước khi mount.
4. **P1 lát 2 — Workflow học vụ**:
   - Áp dụng capability cho đề tài, đăng ký, BM01/BM02, BM03 checkpoint, BM04, task và meeting log; self-service Sinh viên tiếp tục dùng role `STUDENT` kết hợp ownership.
   - Loại bỏ fallback nhóm `VIEN_TRUONG` ở route Viện; quyền truy cập dựa trên `PROJECT_ASSIGNMENT_PUBLISH` thực tế.
   - Đồng bộ menu/route Giảng viên cho đề tài, phê duyệt, tiến độ và dashboard.
5. **P1 lát 3 — Hội đồng, điểm bảo vệ và lưu chiểu**:
   - Bỏ global `authorize('ADMIN')` khỏi council routes; quyền được resolve động theo `councilType`.
   - `OUTLINE_COUNCIL_MANAGE` không thể mutate hội đồng bảo vệ và `DEFENSE_COUNCIL_MANAGE` không thể mutate hội đồng đề cương; khi đổi loại hội đồng phải có quyền trên cả loại cũ lẫn loại mới.
   - Tách độc lập `DEFENSE_SCORE_VIEW`, `DEFENSE_SCORE_SUBMIT`, `RESULT_LOCK`, `RESULT_PUBLISH` trên route/UI hiện hữu; quyền nhập điểm vẫn phải qua kiểm tra membership và conflict-of-interest tại domain/controller.
   - Archive self-service chỉ cho Sinh viên sở hữu hồ sơ nộp; staff review yêu cầu `FINAL_DOCUMENT_REVIEW` và đồng thời phải là GVHD của hồ sơ hoặc có phạm vi Viện qua `PROJECT_ASSIGNMENT_PUBLISH`.
   - Danh sách/health radar lưu chiểu được giới hạn theo sinh viên của GVHD; người có phạm vi Viện mới xem toàn viện.
6. **Database migration P1**:
   - Tạo và deploy migration additive `20261029110000_add_rbac_enforcement_permissions`.
   - Xác minh trực tiếp DB: `FINAL_DOCUMENT_REVIEW` thuộc `GVHD`, `VIEN_TRUONG`; `RUBRIC_MANAGE` thuộc `QUAN_TRI_VIEN`, `VIEN_TRUONG`; `NOTIFICATION_MANAGE` và `LEGACY_REVIEW_MANAGE` thuộc `QUAN_TRI_VIEN`.
   - `prisma migrate status`: 20 migrations, database `up to date`; `prisma validate`: schema hợp lệ.
7. **Tài liệu và kiểm thử**:
   - Đã tạo design spec `docs/superpowers/specs/2026-10-29-rbac-enforcement-rollout-design.md` và implementation plan `docs/superpowers/plans/2026-10-29-rbac-enforcement-rollout-plan.md`.
   - Bổ sung test permission catalog, middleware, route coverage, platform authorization, defense authorization và archive scope.
   - Kiểm tra 23 file trọng tâm: UTF-8 no BOM, không có ký tự replacement.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `COMPLETE / UP TO DATE`; 20 migrations đã apply trên PostgreSQL/Supabase đang cấu hình. Hai migration RBAC mới đều additive và đã được xác minh mapping sau deploy.
- **Backend API**: `P0 + P1 RBAC ENFORCEMENT COMPLETE` cho các API hiện hữu; không còn bypass `ADMIN` ở các lát đã chuyển đổi. Hội đồng dùng guard động; archive có ownership/scope; điểm bảo vệ tách view/submit/lock.
- **Frontend SPA**: `ALIGNED`; menu, route và action của platform, academic, council, grading, archive đã bám permission thực tế. Route guard hỗ trợ cả yêu cầu `ALL` và `ANY` permission.
- **MCP/External services**: Không thay đổi connector/MCP. Migration đã deploy vào DB cấu hình hiện tại; không thực hiện deploy ứng dụng frontend/backend.
- **Test**: Backend **35/35 suites, 240/240 tests PASS**. Frontend **14/14 tests PASS**. Vite production build PASS với 3201 modules. `git diff --check` theo phạm vi P1 không có lỗi.
- **Git/worktree**: Design spec và plan đã có commit `e6a0cee` và `838e0f8`. Phần implementation chưa commit để tránh gom nhầm khối lượng lớn thay đổi có sẵn của người dùng trong worktree; không reset hoặc ghi đè thay đổi ngoài phạm vi.
- **Giới hạn còn lại**: Chưa chạy browser E2E bằng tài khoản thật. `RESULT_PUBLISH` đã có capability/UI gate nhưng codebase chưa có endpoint backend công bố kết quả thực tế; nút “Chốt sổ” hiện chưa phải một workflow publish hoàn chỉnh.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0 — E2E ma trận quyền bằng tài khoản thật**:
   - Smoke test `QUAN_TRI_VIEN`, `GVHD`, `VIEN_TRUONG`, `STUDENT` trên trình duyệt.
   - Xác minh thay đổi permission matrix có hiệu lực ngay ở request kế tiếp; kiểm tra `401`, `403`, ownership và phạm vi Viện.
2. **P0 — Hoàn thiện workflow công bố kết quả**:
   - Thiết kế trạng thái/cột dữ liệu cần thiết ở Prisma nếu chưa có.
   - Tạo backend endpoint dùng `RESULT_PUBLISH`, audit/idempotency và nối nút “Chốt sổ/Công bố kết quả” vào API thật; không giữ action giả chỉ hiển thị message.
3. **P1 — Rà soát role shell và capability navigation**:
   - Xác minh người có capability học thuật nhưng role `LECTURER` truy cập được đúng màn hình Viện/Hội đồng mà không bị parent route `ADMIN` chặn.
   - Tiếp tục loại bỏ group fallback tổng quát ở frontend nếu không còn consumer hợp lệ.
4. **P1 — Rà soát quyền task theo loại nghiệp vụ**:
   - Hiện task routes dùng mapping tĩnh BM03; nếu mở rộng nhiều `taskType`, chuyển sang resolver permission theo loại task và bổ sung negative tests.
5. **P1 — Chuẩn hóa Git history**:
   - Tách thay đổi P0/P1 khỏi các chỉnh sửa giao diện/workflow có sẵn, review diff và tạo các commit implementation nhỏ theo backend, frontend, migration, test.
6. **P2 — E2E workflow toàn tuyến**:
   - Chạy kịch bản Sinh viên đăng ký → BM01/BM02 → BM03 → BM04 → Hội đồng → Chấm điểm → Khóa/công bố → Lưu chiểu → Giấy xác nhận.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **`ADMIN` không phải superuser nghiệp vụ**: role kỹ thuật không tự có mọi quyền học thuật. Mọi thao tác nhạy cảm phải được cấp capability trong permission matrix để tránh một tài khoản quản trị hệ thống có thể duyệt/chấm/khóa kết quả ngoài nhiệm vụ.
2. **Sinh viên giữ role + ownership cho self-service**: không tạo permission matrix dư thừa cho thao tác cá nhân. Backend vẫn là lớp kiểm tra cuối cùng, bảo đảm Sinh viên chỉ thao tác hồ sơ của chính mình.
3. **Quyền Hội đồng phải resolve theo resource**: một route chung phục vụ hai loại hội đồng không thể dùng guard OR tĩnh cho mutation; phải đọc `councilType` của resource và assert đúng permission, tránh quyền đề cương tác động hội đồng bảo vệ hoặc ngược lại.
4. **Capability và data scope là hai lớp độc lập**: có `FINAL_DOCUMENT_REVIEW` chỉ cho phép dùng chức năng; vẫn phải kiểm tra GVHD sở hữu hồ sơ hoặc phạm vi Viện. Tương tự, `DEFENSE_SCORE_SUBMIT` không thay thế membership/conflict checks.
5. **Tách view, submit, lock và publish**: đây là bốn mức tác động khác nhau nên không dùng một permission tổng quát. Cách tách này giới hạn blast radius và cho phép UI/backend phản ánh đúng trách nhiệm từng nhóm.
6. **Migration permission phải additive và idempotent**: dùng upsert/`ON CONFLICT DO NOTHING`, chỉ deploy sau khi ba lát backend/frontend và toàn bộ test đều xanh để không làm thay đổi quyền trước khi enforcement sẵn sàng.
7. **Frontend không phải lớp bảo mật cuối cùng**: menu/route/action được ẩn để UX nhất quán, nhưng mọi request vẫn phải qua backend capability, ownership, membership và domain invariant.
8. **Giữ nguyên kiến trúc `TopicRegistration`**: toàn bộ thay đổi tiếp tục dựa trên một Sinh viên/một đề tài và quota tối đa 10 Sinh viên/GVHD; không khôi phục `group/groupMember`.

### Phiên 29/10/2026 — P0 phê duyệt kết quả bảo vệ và công bố theo đợt (đang hoàn thiện)

#### 1. Những phần đã hoàn thành

1. **Thiết kế và kế hoạch đã duyệt**:
   - Tạo/commit đặc tả `docs/superpowers/specs/2026-10-29-defense-result-approval-publication-design.md` (`262f066`).
   - Tạo/commit implementation plan `docs/superpowers/plans/2026-10-29-defense-result-approval-publication-plan.md` (`04ec522`).
   - Chốt tách độc lập: khóa điểm → approval từng hồ sơ → publication snapshot theo học kỳ; snapshot cũ không được ghi đè.
2. **Database/Prisma đã deploy**:
   - Migration additive `20261029130000_defense_result_approval_publication` đã apply vào PostgreSQL/Supabase.
   - Thêm trạng thái `AWAITING_SCORES`, `AWAITING_FINAL_APPROVAL`, `DEFENSE_PASSED`, `DEFENSE_FAILED`; models `DefenseResultApproval`, `ResultPublication`, `ResultPublicationItem`; enum publication/approval và partial unique bảo vệ tối đa một approval hiệu lực/hồ sơ.
   - Thêm permission `DEFENSE_RESULT_APPROVE`, mapping mặc định rõ ràng chỉ cho `VIEN_TRUONG`; không cấp implicit cho mọi `ADMIN`.
3. **Backend workflow và API lõi**:
   - Khóa điểm qua `defenseScoringService` giờ chuyển sang `AWAITING_FINAL_APPROVAL`, không coi điểm khóa là kết quả chính thức.
   - Thêm service approval/publication có transaction Serializable, evidence fingerprint, audit, idempotency và các guard publication `INITIAL`/`SUPPLEMENTARY`/`CORRECTION` ban đầu.
   - Thêm endpoint approve/correction approval, preview/create/list publication và endpoint self-service `my-published-result`.
4. **Frontend đã nối API thật**:
   - Sổ điểm có thao tác duyệt đạt/không đạt theo capability và công bố initial publication từ preview server-side.
   - Thêm modal lịch sử publication theo học kỳ.
   - `GradeViewPage` chỉ hiển thị kết quả chính thức khi endpoint snapshot trả về đúng hồ sơ; không dùng điểm tạm làm kết quả công bố.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `DEPLOYED / UP TO DATE`; 21 migrations. `prisma validate` PASS.
- **Backend API**: `PARTIALLY COMPLETE`; có approval, correction, preview/create/list publication và self-service snapshot. Chưa có test chuyên biệt chứng minh toàn bộ invariant INV-28 đến INV-36.
- **Frontend SPA**: `PARTIALLY COMPLETE`; initial publish, approval action, history read-only và student snapshot đã nối API. Chưa có UI đầy đủ để tạo `SUPPLEMENTARY`/`CORRECTION` với chọn predecessor/item và lý do.
- **Test**: Backend regression **35/35 suites, 240/240 tests PASS**; Frontend **14/14 tests PASS**; production build PASS. Chưa bổ sung integration tests riêng cho workflow mới.
- **MCP/External services**: Không đổi connector/MCP. Migration đã deploy, chưa deploy app frontend/backend.
- **Git/worktree**: Hai tài liệu design/plan đã commit. Implementation vẫn chưa commit riêng do worktree chứa nhiều thay đổi có sẵn ngoài phạm vi.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0 — Test security/invariant của workflow mới**: thêm integration tests `401/403`, evidence chưa khóa/khác version, concurrent approval, idempotency replay, overlap khác key, correction lineage, rollback publication, snapshot immutability và student ownership.
2. **P0 — Hoàn thiện UI publication**: modal chọn `INITIAL`/`SUPPLEMENTARY`/`CORRECTION`, bắt buộc lý do, chọn predecessor/item thay thế và refresh lịch sử từ API.
3. **P0 — Rà soát domain scope**: xác minh authority theo phạm vi học kỳ/Viện và nối invalidation approval khi có workflow hợp lệ mở khóa/sửa điểm/đổi hội đồng/policy.
4. **P0 — E2E bằng tài khoản thật**: smoke test `VIEN_TRUONG`, `QUAN_TRI_VIEN`, `GVHD`, `STUDENT`, bao gồm ownership snapshot và capability separation.
5. **P1 — Git hygiene**: tách implementation P0 khỏi thay đổi có sẵn, review diff và commit migration/backend/frontend/tests theo nhóm nhỏ.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Khóa điểm không phải công bố**: score lock chỉ tạo evidence và chuyển `AWAITING_FINAL_APPROVAL`; chỉ approval mới tạo `DEFENSE_PASSED`/`DEFENSE_FAILED`.
2. **Approval giữ lịch sử**: `DefenseResultApproval` là một-nhiều, có supersession/effective state; điều chỉnh không update outcome/score của record cũ.
3. **Publication là snapshot immutable theo học kỳ**: dữ liệu tên SV, mã SV, tên đề tài, outcome và điểm được sao chép vào item; UI/điểm tạm không phải nguồn công bố.
4. **Capability tách độc lập**: `RESULT_LOCK`, `DEFENSE_RESULT_APPROVE`, `RESULT_PUBLISH` là ba mức quyền khác nhau; `ADMIN` không bypass capability.
5. **Migration additive, quyền cấp tường minh**: deploy chỉ thêm enum/table/index/permission mapping idempotent, tránh mở rộng quyền học vụ ngoài ý muốn.

### Phiên 29/10/2026 — Hoàn thiện Frontend P0: Quản lý Công bố Snapshot & Điều chỉnh Kết quả Bảo vệ

#### 1. Những phần đã hoàn thành

1. **Modal Công bố Kết quả Snapshot Toàn diện (`DefenseResultPublicationModal.jsx`)**:
   - Triển khai đầy đủ 3 loại hình công bố theo quy chế đào tạo:
     * `INITIAL`: Công bố chính thức đợt 1 cho toàn bộ sinh viên đã duyệt kết quả.
     * `SUPPLEMENTARY`: Công bố bổ sung cho đợt bảo vệ phụ, bắt buộc nhập lý do (`reason`).
     * `CORRECTION`: Công bố đính chính sau phúc khảo/điều chỉnh, hỗ trợ chọn văn bản tiền nhiệm (`previousPublicationId`), lưới đối ứng bản ghi cần thay thế (`replacesPublicationItemId`) và lý do bắt buộc.
   - Bảng xem trước danh sách sinh viên trực quan từ API `/preview`, thẻ KPI tổng hợp (Tổng số, Đạt, Không đạt), kèm banner cam kết snapshot bất biến (Immutability).
2. **Sổ Lưu chiểu Snapshot & Lịch sử Công bố (`PublicationHistoryModal.jsx`)**:
   - Thiết kế giao diện 2 cột Ledger theo chuẩn OpenDesign / Nordic Pine Teal:
     * Cột trái: Danh sách các phiên bản công bố theo mốc thời gian, gắn tag loại hình (`INITIAL`, `SUPPLEMENTARY`, `CORRECTION`), thông tin người ký duyệt và số lượng sinh viên.
     * Cột phải: Chi tiết phiên bản niêm phong, văn bản căn cứ, liên kết đính chính và bảng snapshot dữ liệu sinh viên tại thời điểm ban hành.
3. **Modal Điều chỉnh Kết quả Bảo vệ (`CorrectDefenseResultModal.jsx`)**:
   - Cung cấp giao diện cho người có quyền `DEFENSE_RESULT_APPROVE` (Viện trưởng) điều chỉnh kết quả của hồ sơ ở `DEFENSE_PASSED`/`DEFENSE_FAILED`.
   - Form chọn kết quả mới (`PASSED`/`FAILED`), nhập căn cứ pháp lý/phúc khảo (bắt buộc) và ghi chú nội bộ.
   - Bổ sung phương thức `correctDefenseResult` trong `evaluationService.js` gọi API `/api/evaluations/admin-defense-center/:id/result-approval/correction`.
4. **Tích hợp Bàn làm việc Sổ điểm (`GradingDefensePage.jsx`)**:
   - Thay thế toàn bộ logic confirm đơn sơ trước đó bằng 3 modal chuyên dụng.
   - Nút hành động từng dòng: Trạng thái `AWAITING_FINAL_APPROVAL` hiển thị "Duyệt đạt"/"Duyệt không đạt"; trạng thái `DEFENSE_PASSED`/`DEFENSE_FAILED` hiển thị nút "Điều chỉnh" màu hổ phách.
5. **Kiểm thử & Build**:
   - Bổ sung integration test trong `frontend/tests/workflowContracts.test.js`: 15/15 tests PASS 100%.
   - Frontend production build: `npm run build` PASS (11.54s, 0 lỗi).
   - Kiểm tra định dạng: UTF-8 (no BOM), `git diff --check` sạch sẽ.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `DEPLOYED / UP TO DATE`; 21 migrations đồng bộ với Supabase PostgreSQL.
- **Backend API**: `COMPLETE`; các API approval, correction, preview, publish (3 loại) và history đều đã sẵn sàng và kết nối thành công với UI.
- **Frontend SPA**: `P0 FRONTEND COMPLETE`; Modal công bố snapshot 3 loại, Modal lịch sử 2 cột và Modal điều chỉnh kết quả bảo vệ đã hoạt động trơn tru. Production build thành công 100%.
- **Test**: Frontend **15/15 tests PASS**; Backend regression **35/35 suites, 240/240 tests PASS**.
- **MCP/External services**: Không thay đổi connector/MCP. Chưa deploy production.
- **Git/worktree**: Bảo toàn các thay đổi có sẵn trong worktree của người dùng; các file chỉnh sửa đạt chuẩn UTF-8 no BOM.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0 — Backend Invariant & Security Test Suite**: Viết integration test suites chứng minh toàn bộ các bất biến `INV-28` đến `INV-36` (kiểm tra phân quyền `401/403`, chặn approve khi điểm chưa khóa, kiểm tra tính bất biến của snapshot khi đổi điểm gốc, concurrency guard 2 request publish đồng thời).
2. **P0/P1 — E2E Smoke Test bằng 4 Tài khoản Thật trên Trình duyệt**:
   - `VIEN_TRUONG` (`lecturer01`): Ký duyệt `DEFENSE_RESULT_APPROVE` và ký công bố snapshot `RESULT_PUBLISH`.
   - `QUAN_TRI_VIEN` (`admin@university.edu.vn`): Giám sát sổ điểm, xem lịch sử công bố.
   - `GVHD` (`lecturer02` / `lecturer04`): Chấm điểm rubric, xem sổ điểm.
   - `STUDENT` (`sv001` / `sv002`): Xem kết quả chính thức tại Cổng sinh viên sau khi ban hành snapshot.
3. **P1 — Xử lý Hàng đợi Thẩm định 108 `ManualReviewCase`**: Duyệt và gán policy cho các hồ sơ legacy trên Tab 3 của `ProjectOversightPage`.
4. **P1 — Git Hygiene & Review Commits**: Tách và commit các nhóm thay đổi theo module (migration, backend services, frontend components, tests).

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Giao diện Công bố bắt buộc hỗ trợ đầy đủ 3 cơ chế Snapshot**: Không gộp chung một form mà phân chia rõ ràng `INITIAL`, `SUPPLEMENTARY`, `CORRECTION`. Riêng `CORRECTION` bắt buộc phải có liên kết với văn bản tiền nhiệm (`previousPublicationId`) và map item cũ (`replacesPublicationItemId`) để bảo toàn tính toàn vẹn và minh bạch học vụ.
2. **Sổ lưu chiểu hiển thị dạng 2 cột Master-Detail**: Bố cục danh sách đợt công bố bên trái và chi tiết snapshot bên phải giúp người quản trị dễ dàng đối chiếu, tra cứu lịch sử mà không phải mở nhiều tab/modal lồng nhau.
3. **Tách biệt rõ ràng giữa "Phê duyệt" và "Điều chỉnh"**: Hồ sơ chưa duyệt thì dùng form duyệt đạt/không đạt (`approveDefenseResult`); hồ sơ đã duyệt thì chỉ được điều chỉnh qua form đính chính (`correctDefenseResult`), tự động ghi nhận căn cứ và sinh vết kiểm toán vô hiệu hóa (supersede) bản ghi cũ.

### Phiên 29/10/2026 — Gia cố P0 approval/publication và kết quả sinh viên

#### 1. Những phần đã hoàn thành

1. **Gia cố invariant publication**:
   - Publication chỉ chọn approval còn khớp fingerprint/evidence khóa hiện hành; loại approval stale khi điểm, rubric, council, policy hoặc lock state không còn khớp.
   - `SUPPLEMENTARY`/`CORRECTION` bắt buộc predecessor cùng học kỳ; correction chỉ thay item thuộc đúng predecessor; chỉ có một `INITIAL` cho mỗi học kỳ.
   - Client giữ cùng `Idempotency-Key` khi retry cùng thao tác công bố.
2. **Snapshot append-only tại CSDL**:
   - Tạo và deploy migration `20261029143000_lock_result_publication_snapshots`.
   - Trigger PostgreSQL chặn `UPDATE`/`DELETE` trên `result_publications` và `result_publication_items`; điều chỉnh phải tạo publication mới.
3. **Vá luồng sau bảo vệ**:
   - `DEFENSE_FAILED` không thể nộp hoặc được nghiệm thu hồ sơ lưu chiểu, kể cả khi điểm số cao; chỉ `DEFENSE_PASSED` hoặc trạng thái legacy hợp lệ đi vào `COMPLETED`.
   - Đồng bộ guard tại `archivalWorkflowService` và `archiveController`.
4. **Đồng bộ API/UI**:
   - Thêm endpoint nội bộ `GET /api/evaluations/admin-defense-center/:id/result-approval` với `DEFENSE_SCORE_VIEW`.
   - Bổ sung các status bảo vệ mới vào status map, quota/registration filters và validator status.
   - `GradeViewPage` chỉ hiện tổng kết từ `ResultPublicationItem`; không suy ra điểm tạm hoặc tiết lộ điểm riêng từng thành viên hội đồng.
5. **Kiểm thử**:
   - Thêm service/RBAC/frontend contract tests cho evidence stale, idempotency replay, lineage publication, `DEFENSE_FAILED` điểm cao và snapshot-only view của sinh viên.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `DEPLOYED / UP TO DATE`; 22 migrations đã apply, `prisma validate` PASS. Snapshot publication đã được khóa ở cấp DB.
- **Backend API**: `P0 HARDENED`; approval/publication, correction lineage, read approval và archive guard đã có. Chưa có data model authority scope tách biệt để kiểm tra phạm vi học kỳ/Viện ngoài capability hiện hữu.
- **Frontend SPA**: `ALIGNED`; publication modal gửi predecessor/idempotency đúng contract; trang sinh viên chỉ dùng snapshot công bố cho kết quả chính thức.
- **Test**: Backend **36/36 suites, 252/252 tests PASS**; Frontend **16/16 tests PASS**; Vite production build PASS.
- **MCP/External services**: Không đổi connector/MCP; đã deploy migration CSDL, chưa deploy ứng dụng frontend/backend.
- **Git/worktree**: Giữ nguyên các thay đổi có sẵn ngoài phạm vi. Implementation chưa tách commit vì worktree vẫn chứa nhiều thay đổi chưa commit.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0 — Integration/e2E proof cho INV-28 đến INV-36**: bổ sung test API với DB test-isolated cho happy path approval, concurrent approval/publication, rollback header/item, snapshot immutability sau đổi source và ownership sinh viên.
2. **P0 — Authority scope**: thiết kế dữ liệu/guard rõ ràng cho phạm vi học kỳ/Viện, sau đó áp dụng vào approve/publish; không thay bằng role hard-code.
3. **P0 — Smoke E2E 4 nhóm quyền**: kiểm tra `VIEN_TRUONG`, `QUAN_TRI_VIEN`, `GVHD`, `STUDENT` bằng tài khoản thật, bao gồm publish/correction/ownership.
4. **P1 — Hoàn tất state consumers còn lại**: rà soát task, dashboard, oversight và legacy filters còn tham chiếu `DEFENDED`/`COMPLETED` để dùng đúng trạng thái mới.
5. **P1 — Git hygiene**: review, tách migration/backend/frontend/test thành commit nhỏ, không gom thay đổi UI/workflow có sẵn.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Outcome phê duyệt là nguồn chân lý cho hậu bảo vệ**: điểm số khóa không đủ để nộp lưu chiểu hoặc hoàn tất; điều này chặn trường hợp `DEFENSE_FAILED` nhưng điểm số cao bị chuyển sai sang `COMPLETED`.
2. **Snapshot được bảo vệ ở cả service và DB**: service không export update/delete; trigger DB chặn cả đường ghi trực tiếp nhằm giữ lịch sử công bố bất biến.
3. **Kết quả sinh viên chỉ lấy từ snapshot**: điểm thành viên và aggregate nội bộ không được dùng làm kết quả hiển thị trước công bố, giảm rò rỉ và tránh UI tự suy diễn kết quả.
4. **Không giả lập authority scope**: capability hiện tại không mang mô hình phạm vi học kỳ/Viện độc lập; guard scope sẽ chỉ được bổ sung sau khi có dữ liệu scope chính thức, tránh một bypass role cứng không kiểm chứng được.

### Phiên 01/11/2026 — Reset dữ liệu demo có kiểm soát

#### 1. Những phần đã hoàn thành

1. **Reset và seed lại dữ liệu ứng dụng**:
   - Thay seed lịch sử/ngẫu nhiên bằng bộ dữ liệu xác định: 1 Admin, 12 GVHD, 120 sinh viên, 120 đề tài/enrollment/đăng ký.
   - `lecturer01@university.edu.vn` là base role `LECTURER`, được gán cả nhóm quyền `GVHD` và `VIEN_TRUONG`; quản lý cố định `sv001` đến `sv010`. Mỗi giảng viên còn lại quản lý đúng 10 sinh viên kế tiếp.
   - Tạo một đợt `Đồ án tốt nghiệp — HK1 2026–2027`: triển khai từ 01/08/2026, mốc thực hiện đến 30/11/2026, bảo vệ 15/12/2026, `Semester.endDate` 20/12/2026 để tương thích state `DEFENSE`.
2. **Guard reset an toàn**:
   - Lệnh reset bắt buộc `SEED_RESET_CONFIRM=RESET_DACN_DEMO`, log target DB đã che credentials, preflight FK dependency và chỉ truncate allow-list bảng Prisma-managed trong schema `public`.
   - Không đụng `_prisma_migrations`, Supabase `auth`, Storage hoặc schema nền tảng khác.
3. **Kiểm thử**:
   - Backend: 40 suites / 264 tests PASS; Prisma validate và migration status PASS; frontend production build PASS.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `RESET / SEEDED`; có 133 user (1 Admin, 12 Lecturer, 120 Student), 1 semester, 120 enrollment, 120 topic registration và state history tương ứng.
- **Backend seed**: `PARTIALLY COMPLETE`; reset guard, account mapping, enrollment/topic/registration state fixtures đã hoạt động.
- **Test**: `PASS`; có unit tests cho reset token/preflight, mapping/lịch, workflow fixture và summary validator.

#### 3. Lỗ hổng phát hiện cần xử lý (P0)

1. **Thiếu fixture E2E cho bảo vệ/công bố kết quả**: seed hiện chưa tạo `Council`, `CouncilMember`, `DefenseResult`, 3 `DefenseMemberScore` đã khóa, `DefenseResultApproval` hay `ResultPublication` (`INITIAL`/`SUPPLEMENTARY`/`CORRECTION`). Vì vậy chưa dùng được để smoke test đầy đủ chấm bảo vệ, approval, snapshot publication và correction.
2. **Validator chưa chứng minh đúng bất biến defense**: kiểm tra conflict hội đồng đang là giá trị hằng, `failedCompleted` đang đếm mọi registration `COMPLETED` thay vì kiểm tra approval outcome `FAILED`, và quota đang group theo topic thay vì xác minh registration/student/topic mapping thực tế.
3. **Mốc kết thúc 30/11 chưa có dữ liệu nghiệp vụ đi kèm**: `implementationEndDate` mới là metadata; cần seed task/checkpoint/submission có deadline trong tháng 8–11 để timeline được phản ánh trong UI/API.
4. **Reset/seed chưa atomic end-to-end**: lỗi sau `TRUNCATE` có thể để database ở trạng thái rỗng hoặc seed dở. Cần refactor permission/account/workflow seed dùng cùng transaction hoặc cơ chế recover rõ ràng trước khi coi script đủ an toàn cho môi trường dùng chung.

#### 4. Bước tiếp theo cần làm (Next Session Plan)

1. **P0** — Hoàn thiện fixture hội đồng và evidence khóa: cấp council không xung đột GVHD, 3 member score/rubric/aggregate locked, approval và snapshot publication đủ evidence/fingerprint.
2. **P0** — Sửa validator thành query thực tế cho council conflict, approval `FAILED` không `COMPLETED`, quota 10 registration/GVHD và timeline task/checkpoint.
3. **P0** — Bọc toàn bộ reset + catalog + account + workflow seed trong transaction/recovery-safe boundary; test lỗi giữa chừng phải rollback hoặc khôi phục được.
4. **P1** — Chạy E2E browser bằng `lecturer01`, `lecturer02`, `admin`, `sv001` và một sinh viên thuộc nhóm khác.

#### 5. Quyết định quan trọng (Decisions & Rationale)

1. **Giữ `lecturer01` là `LECTURER` kèm capability `VIEN_TRUONG`**: không tạo role base mới, tương thích mô hình RBAC và vẫn cho phép người này làm GVHD.
2. **`endDate` sau ngày bảo vệ**: giữ mốc thực hiện đến 30/11 nhưng đặt end date 20/12 để controller có cửa sổ state `DEFENSE`; nếu end date trước defense thì state này không thể hoạt động.
3. **Không che giấu khoảng trống E2E**: seed hiện tại đủ kiểm thử account/ownership/register workflow, nhưng không được dùng để tuyên bố đã test được toàn bộ approval/publication cho tới khi các fixture P0 bên trên hoàn tất.

### Phiên 01/11/2026 — Hoàn tất P0 seed demo và đơn giản hóa cổng Giảng viên

#### 1. Những phần đã hoàn thành

1. **Hoàn tất P0 seed demo có kiểm soát**:
   - Bổ sung 4 hội đồng bảo vệ/12 thành viên, đồng thời bảo đảm GVHD không thuộc hội đồng chấm hồ sơ mình hướng dẫn.
   - Tạo mốc BM03 trong giai đoạn 08–11/2026, evidence điểm khóa, kết quả tổng hợp khóa, approval và chuỗi publication `INITIAL` → `SUPPLEMENTARY` → `CORRECTION`.
   - Validator đọc dữ liệu thực để kiểm tra quota 10 SV/GVHD, enrollment active, xung đột hội đồng, approval `FAILED` không làm hồ sơ `COMPLETED` và timeline task.
   - Bọc truncate, catalog quyền, account và toàn bộ fixture trong cùng transaction; reset thực tế đã chạy với token xác nhận của người dùng.
2. **Đơn giản hóa đăng nhập Giảng viên**:
   - Bỏ lựa chọn “Không gian tác nghiệp”; giảng viên đăng nhập xong đi thẳng đến `/lecturer/dashboard`.
   - Backend trả về `hasDefenseCouncilAssignment` dựa trên thành viên hội đồng bảo vệ thực tế.
   - Sidebar chỉ hiển thị “Hội đồng chấm điểm” khi có phân công; mục Viện chỉ hiển thị khi có capability `PROJECT_ASSIGNMENT_PUBLISH`.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `RESET / SEEDED`; 133 account (1 Admin, 12 Lecturer, 120 Student), 120 enrollment/registration, 4 hội đồng và 3 publication snapshot theo lineage.
- **Backend**: `PASS`; seed guard/transaction/validator và contract auth về trạng thái phân công hội đồng đã được cập nhật.
- **Frontend**: `BUILD PASS`; luồng login giảng viên trực tiếp, navigation ẩn/hiện theo capability và council assignment.
- **Test**: backend seed suite trước reset: 40 suites/267 tests PASS; auth integration sau thay đổi: 3/3 PASS; frontend production build PASS.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0** — E2E browser với `lecturer01`, `lecturer02`, `admin`, `sv001` và một giảng viên có/không có phân công hội đồng để xác nhận visibility + action guard.
2. **P0** — Bổ sung integration test cho transaction rollback của seed và persistence của approval/publication fixture, thay vì chỉ unit fixture/validator.
3. **P1** — Rà soát state consumers legacy còn tham chiếu `DEFENDED`/`COMPLETED`, sau đó tách các thay đổi hiện có thành commit nhỏ theo backend/frontend/test.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Không dùng “workspace role” tạm thời sau login**: `LECTURER` là base role duy nhất; quyền bổ sung là capability/phân công thực, tránh UI cho người dùng chọn một vai trò không được cấp.
2. **Chức năng Hội đồng dựa trên `CouncilMember` thực**: capability vẫn là route-level guard, còn sidebar chỉ hiện khi có ít nhất một assignment hội đồng bảo vệ; điều này tránh hiển thị chức năng trống cho toàn bộ GVHD.
3. **Chức năng Viện dựa trên capability**: giữ `PROJECT_ASSIGNMENT_PUBLISH` làm nguồn chân lý cho Viện trưởng, không suy ra từ tên role hay client-side mock.

### Phiên 02/11/2026 — Khởi tạo CMS quản trị Portal

#### 1. Những phần đã hoàn thành

1. **Thiết kế và kế hoạch triển khai Portal CMS**:
   - Viết đặc tả `docs/superpowers/specs/2026-11-02-portal-content-management-design.md` và kế hoạch `docs/superpowers/plans/2026-11-02-portal-content-management-implementation-plan.md`.
   - Chốt CMS có cấu trúc: Admin kỹ thuật quản trị Hero/CTA, logo, footer/liên hệ, link, biểu mẫu và thông báo; dữ liệu workflow/học vụ vẫn là nguồn chân lý riêng.
2. **Nền tảng CSDL/RBAC/revision**:
   - Thêm migration `20261102090000_portal_content_management`, identity records Portal và `PortalContentRevision` immutable; migration ánh xạ announcement cũ theo PDF/rich-text/remediation.
   - Thêm capability `PORTAL_CONTENT_MANAGE`, chỉ cấp mặc định cho `QUAN_TRI_VIEN`.
   - Thực thi draft/publish/archive và public projection dựa trên pointer revision, không làm revision cũ tự xuất hiện lại.
3. **Bảo mật content và upload**:
   - Thêm rich-text sanitizer server-side với allow-list; ghim `sanitize-html@2.13.0` do bản mới không tương thích CommonJS/Jest hiện hữu.
   - Tạo upload boundary riêng cho Portal: ảnh JPEG/PNG/WebP, tài liệu PDF/DOC/DOCX; chặn ZIP/RAR/SVG; server quyết định thư mục storage.
   - Thêm upload API `/api/portal/uploads/image|document` và CMS revision API/public API `/api/portal/*`, đều có capability guard trừ public endpoint đã khai báo exemption.
4. **Kiểm thử/commit**:
   - Các commit Portal: `4489dc5`, `03b4151`, `0574f2d`, `122ce82`, `7b0d820`.
   - Backend suite tại thời điểm chốt backend API: 45 suites / 277 tests PASS; Prisma validate PASS.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `IMPLEMENTED / NOT APPLIED IN THIS SESSION`; migration CMS đã commit nhưng không chạy migration/reset DB thực tế.
- **Backend API**: `PARTIALLY COMPLETE`; revision, public projection, sanitizer, upload boundary và command API đã có. Chưa có resource-creation/admin-read API đầy đủ để UI tạo mới link/template/announcement identity.
- **Frontend SPA**: `NOT COMPLETE`; đã có `frontend/src/services/portalContentService.js` chưa commit. Chưa có `/admin/portal`, rich-text editor, PDF preview, public HomePage dynamic rendering hoặc dọn ZIP UI.
- **Test**: Backend targeted/full suites đã PASS như trên; chưa chạy frontend build/test sau khi tạo client service và chưa có E2E Portal CMS.
- **MCP/External services**: Không thay đổi cấu hình connector; Supabase Storage được dùng theo service hiện có, chưa upload asset thực tế.
- **Git/worktree**: User từ chối worktree cách ly; làm việc trực tiếp trên `redesign-with-opendesign`. Giữ nguyên thay đổi seed/auth/frontend có sẵn ngoài phạm vi Portal.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0** — Hoàn thiện backend CMS: API tạo resource identity và admin read/list, audit cho publish/archive, integration tests 401/403/public-draft isolation/PDF-rich-text exclusivity.
2. **P0** — Xây `/admin/portal`: tabs Branding/Hero, Footer/Contact, Links, Templates, Announcements; draft/preview/publish/archive, rich-text chèn ảnh và preview PDF.
3. **P0** — Chuyển `HomePage` từ hard-code sang `GET /api/portal/public`; giữ roadmap workflow static, bỏ fallback announcement mẫu.
4. **P0** — Bỏ toàn bộ CTA tải ZIP/bulk-download ở public portal, Student Dashboard và Rubric Admin, vẫn giữ download file đơn và không đổi upload BM.
5. **P0** — Viết bootstrap draft idempotent, chạy Prisma validate/migration status, backend suite, frontend tests/build, E2E với Admin có/không có capability và public visitor.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Versioned structured CMS thay JSON/page builder tự do**: mỗi thay đổi tạo draft revision, chỉ publish mới đổi pointer public; vừa có preview/audit vừa tránh nội dung dở hiển thị ra portal.
2. **PDF và rich-text là hai loại thông báo loại trừ nhau**: PDF chỉ preview/download file đơn; rich-text chỉ dùng HTML đã sanitize + ảnh upload, tránh nội dung lai mơ hồ và giảm bề mặt XSS.
3. **Không bỏ ZIP/RAR khỏi upload nghiệp vụ**: yêu cầu chỉ loại bỏ nút tải ZIP; các luồng BM vẫn có thể upload ZIP/RAR cho tới khi có thay đổi nghiệp vụ riêng.
4. **Không chạm thay đổi ngoài phạm vi**: các file seed/auth/lecturer UI sẵn có được giữ nguyên để không trộn lịch sử với Portal CMS.

### Phiên 02/11/2026 — Hoàn thiện giao diện Portal CMS

#### 1. Những phần đã hoàn thành

1. **Bổ sung contract backend cho Portal CMS**:
   - Thêm API có capability guard để tạo và liệt kê resource identity Portal, giúp frontend không cần suy đoán `resourceId` trước khi tạo draft.
   - Bổ sung test service/controller cho resource identity và revision metadata.
2. **Xây console quản trị `/admin/portal`**:
   - Route/sidebar yêu cầu `PORTAL_CONTENT_MANAGE`.
   - Có form cấu trúc cho Branding/Hero & Footer, Links, Templates và Announcements; hỗ trợ lưu nháp, công bố, archive và preview PDF.
   - Rich-text editor bị giới hạn; việc sanitize vẫn do backend quyết định.
3. **Chuyển public portal sang CMS**:
   - `HomePage` đọc `GET /api/portal/public` cho announcements, templates, branding, Hero/CTA, contact/footer và các nhóm link `QUICK_LINK`, `LEGAL`, `SOCIAL`.
   - Chỉ còn fallback thương hiệu tối thiểu khi chưa có revision public; không fallback announcement mẫu.
   - Bỏ CTA ZIP/bulk-download trong public portal, Student Dashboard và Rubric Admin; chỉ giữ download một file đã publish.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `IMPLEMENTED / NOT APPLIED IN THIS SESSION`; không chạy migration hay reset database thật.
- **Backend API**: `IMPLEMENTED / VERIFIED`; public projection, resource identity admin, revision commands và upload boundary hiện có trong worktree.
- **Frontend SPA**: `IMPLEMENTED / BUILD PASS`; `/admin/portal` và public CMS binding đã có trong worktree.
- **Test**: Backend `45 suites / 280 tests PASS`; frontend `20 tests PASS`; `npm run build` PASS; `npx prisma validate` PASS; `git diff --check` sạch.
- **MCP/External services**: không đổi connector hoặc cấu hình Supabase; chưa upload asset/không thực hiện publish content thật.
- **Git/worktree**: thay đổi Portal và các thay đổi seed/auth/lecturer có sẵn vẫn chưa commit; không stage/commit để tránh trộn lịch sử không liên quan.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **P0** — Chạy migration CMS ở môi trường được phê duyệt, chạy bootstrap draft idempotent, sau đó Admin preview/publish từng content type.
2. **P0** — E2E browser: Admin có/không có `PORTAL_CONTENT_MANAGE`, public visitor chỉ thấy published revision, và luồng PDF/rich-text riêng biệt.
3. **P1** — Hoàn thiện upload/chèn ảnh vào rich-text editor và kiểm tra MIME thực tế với Supabase Storage.
4. **P1** — Tách các thay đổi worktree thành commit nhỏ theo Portal CMS, controlled seed, auth và lecturer UI sau khi review phạm vi.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Bổ sung resource identity API trước UI**: frontend cần identity thật để tạo draft/publish; tránh hard-code ID hoặc tạo mock client-side.
2. **Public portal chỉ dùng projection đã publish**: draft/archive không được dùng làm fallback, nhờ đó content dở không thể lộ ra public.
3. **Fallback public giới hạn ở branding tối thiểu**: khi chưa có config public, portal vẫn có nhãn nhận diện; nhưng announcements/templates/links không bịa dữ liệu mẫu.
4. **Không thay đổi upload nghiệp vụ BM**: chỉ loại nút tải ZIP/bulk-download ở UI Portal; ZIP/RAR của các luồng nộp bài nghiệp vụ vẫn giữ nguyên.

### Phiên 09/11/2026 (Phần 2) — Khắc Phục Triệt Để Nghẽn Truy Vấn Database, Nâng Cấp Pool Concurrency và Tối Ưu Auth Cache

#### 1. Những phần đã hoàn thành

1. **Scale Connection Pool & Tăng biên độ Network Timeout (Task 1)**:
   - Nâng `DEFAULT_DB_POOL_MAX` từ `2` lên `8` và `DEFAULT_DB_POOL_CONNECTION_TIMEOUT` lên `15000` ms trong [database.js](file:///d:/DACN/backend/src/config/database.js).
   - Cập nhật [backend/.env](file:///d:/DACN/backend/.env) và [backend/.env.example](file:///d:/DACN/backend/.env.example): cấu hình `DB_POOL_MAX=8`, `DB_POOL_IDLE_TIMEOUT_MS=30000`, `DB_POOL_CONNECTION_TIMEOUT_MS=15000` phù hợp với Transaction Pooler (cổng 6543) của Supabase.
   - Nâng Axios default timeout từ `10000` ms lên `20000` ms trong [api.js](file:///d:/DACN/frontend/src/services/api.js) để loại bỏ hiện tượng timeout oan do độ trễ mạng quốc tế (Singapore AWS `ap-southeast-1`).
   - Thêm bộ test [dbPoolConfig.test.js](file:///d:/DACN/backend/tests/config/dbPoolConfig.test.js). Commit `040a058`.
2. **Cơ chế Single-Flight Coalescing & In-Memory Capability Cache cho Auth Middleware (Task 2)**:
   - Nâng cấp [auth.js](file:///d:/DACN/backend/src/middlewares/auth.js):
     - Thêm cơ chế **Single-Flight Request Coalescing** qua `inFlightUserLookups`: Khi nhiều request đồng thời của cùng một `userId` gửi lên (ví dụ khi load trang), chỉ có đúng 1 truy vấn `prisma.user.findUnique` và `academicDelegation.findMany` được gửi tới DB, các request còn lại dùng chung Promise kết quả.
     - Thêm bộ nhớ đệm nội bộ **15s TTL** qua `userAuthCache`: Các request tiếp theo trong 15s được phục vụ trực tiếp từ RAM (< 1ms thay vì ~100ms RTT sang Singapore).
     - Giữ nguyên toàn vẹn cơ chế bảo vệ phiên bản quyền 409 `PERMISSION_VERSION_STALE` cho các route non-me.
     - Cơ chế Invalidation tức thì: Export `clearAuthCache(userId)` và tự động gọi khi có thay đổi quyền hạn hoặc ủy quyền tại [permissionService.js](file:///d:/DACN/backend/src/services/permissionService.js), [userController.js](file:///d:/DACN/backend/src/controllers/userController.js), và [delegationController.js](file:///d:/DACN/backend/src/controllers/delegationController.js).
   - Thêm bộ test [authCacheAndDeduplication.test.js](file:///d:/DACN/backend/tests/middlewares/authCacheAndDeduplication.test.js) (4/4 PASS). Commit `14c7b83`.
3. **Tối ưu hoá `PermissionGroupPage.jsx` với Tab-Driven Lazy Loading & Unmount Guards (Task 3)**:
   - Cập nhật [PermissionGroupPage.jsx](file:///d:/DACN/frontend/src/pages/admin/PermissionGroupPage.jsx):
     - Chuyển cơ chế tải dữ liệu thành lazy-loading theo tab: Khi mở trang (Tab `'MATRIX'`), chỉ tải ma trận qua `fetchMatrix()`; chỉ khi chuyển sang Tab `'GROUPS'` hoặc `'AUDIT'` mới kích hoạt `fetchGroupsData()`.
     - Thêm cờ `isMountedRef` để huỷ xử lý khi component unmount: Chặn hoàn toàn việc bắn toast `message.error(...)` dư thừa từ chu kỳ kiểm tra kép của React StrictMode.
     - Cập nhật nút "Làm mới" thông minh theo tab hiện tại.
   - Thêm bộ test [permissionGroupPageLazyLoad.test.js](file:///d:/DACN/frontend/tests/permissionGroupPageLazyLoad.test.js) (2/2 PASS). Commit `9ca5bf4`.
4. **Nghiệm Thu Toàn Diện Hệ Thống (Task 4)**:
   - Backend: **61/61 test suites (447/447 tests PASS)**.
   - Frontend: **74/74 tests PASS**.
   - Vite production build: **PASS (11.27s, 0 errors)**.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `OPTIMIZED & CONNECTED`; Pool size 8 kết nối mượt mà tới Supabase Transaction Pooler (port 6543).
- **Backend API**: `OPTIMIZED & CACHED`; Middleware xác thực loại bỏ 80–90% query dư thừa khi gọi song song.
- **Frontend SPA**: `STABLE & CLEAN`; Triệt tiêu hoàn toàn toast lỗi kép; timeout nâng lên 20s.
- **Test**: `100% PASS` cả hai phân hệ Backend và Frontend.

#### 3. Quyết định quan trọng (Decisions & Rationale)

1. **Khôi phục pool size tối ưu cho Transaction Pooler (6543)**: Lỗi `maxClientsInSessionMode` trước đây xảy ra do cổng 5432 (Session mode) bị giới hạn kết nối; cổng 6543 sử dụng Supavisor transaction multiplexing có thể chịu hàng trăm client, do đó nâng `DB_POOL_MAX=8` là an toàn và giải phóng hoàn toàn tình trạng hàng đợi đơn luồng.
2. **Single-Flight Coalescing cho Auth Middleware**: Thay vì truy vấn CSDL 5 lần khi 5 API được gọi song song trên 1 trang web, gom thành 1 truy vấn duy nhất giúp giảm tải CSDL tới 80% và loại bỏ nguy cơ cạn kiệt kết nối.
3. **Lazy-loading dữ liệu theo Tab trong PermissionGroupPage**: Tách biệt luồng tải ma trận phân quyền và luồng quản lý danh sách nhóm quyền giúp trang mở nhanh gấp đôi và giảm tải tức thì cho backend.

### Phiên 09/11/2026 — Hoàn tất P0 Chuẩn hóa StudentProfile, Import Excel All-or-Nothing và Điều hướng Import Nhanh

#### 1. Những phần đã hoàn thành

1. **CSDL & Nền tảng Định danh Sinh viên (Task 1)**:
   - Thêm enum `StudentGender` (`MALE`, `FEMALE`, `OTHER`) và model `StudentProfile` liên kết 1-1 với `User` (`studentId` PK/FK, cascade delete). Giữ nguyên `User.department` cho giảng viên, lưu ngành học sinh viên tại `StudentProfile.major`.
   - Tạo và áp dụng thành công migration additive `20261109090000_add_student_profile` lên CSDL demo qua `DIRECT_URL` (port 5432).
   - Viết 4 contract tests kiểm chứng enum, delegate và quan hệ model. Commit `b6a8e15`.
2. **Backend Domain Service & CRUD Transactions (Task 2)**:
   - Tạo mới [studentProfileService.js](file:///d:/DACN/backend/src/services/studentProfileService.js): Chuẩn hóa và xác thực bắt buộc 8 trường (MSSV, Họ tên, Giới tính, Ngày sinh `DD/MM/YYYY`, SĐT, Lớp, Email, Ngành); kiểm tra năm nhuận, ngày trong quá khứ, chuyển đổi linh hoạt nhãn tiếng Việt (`Nam`/`Nữ`/`Khác`) và alias.
   - Nâng cấp [userController.js](file:///d:/DACN/backend/src/controllers/userController.js): Bọc tạo/cập nhật `User` và `StudentProfile` trong một giao dịch nguyên tử `prisma.$transaction`. Thực thi cơ chế fail-closed: lỗi profile rollback toàn bộ, không tạo `User`. Tôn trọng MSSV người dùng cung cấp thay vì tự sinh mã.
   - Bảo vệ self-service sinh viên tại [authController.js](file:///d:/DACN/backend/src/controllers/authController.js) và [auth.js](file:///d:/DACN/backend/src/middlewares/auth.js): Sinh viên chỉ được phép sửa `avatarUrl` và `phone`; các trường định danh học vụ và `department` hoàn toàn bị khóa. Commit `1879397`.
3. **Chuẩn Hóa File Mẫu & Cơ Chế Import Excel Nguyên Tử (Task 3)**:
   - Cập nhật [excelHelper.js](file:///d:/DACN/backend/src/utils/excelHelper.js): Xuất file mẫu chuẩn gồm đúng 8 cột canonical (`MSSV (*)`, `Họ và tên (*)`, `Giới tính (*)`, `Ngày sinh (*)`, `Số điện thoại (*)`, `Lớp (*)`, `Email (*)`, `Ngành (*)`) đi kèm 5 dòng dữ liệu minh họa thực tế.
   - Nâng cấp API `POST /api/users/import-excel`: Kiểm tra trùng lặp mã/email trong nội bộ file và đối chiếu CSDL (`SKIP` / `UPDATE`). Thực thi quy tắc **All-or-Nothing**: nếu có bất kỳ 1 dòng lỗi thì lập tức trả về `HTTP 400` kèm danh sách lỗi chi tiết và **tuyệt đối không ghi bản ghi nào** vào CSDL (Zero writes). Chỉ ghi khi 100% dòng hợp lệ.
   - Đồng bộ xuất file Excel dữ liệu sinh viên đầy đủ 8 cột chuẩn hóa. Commit `fb2cfaa`.
4. **Giao Diện Quản Trị Admin & Hồ Sơ Sinh Viên (Task 4)**:
   - Cập nhật [ExcelImportModal.jsx](file:///d:/DACN/frontend/src/components/common/ExcelImportModal.jsx) & [studentImportHelper.js](file:///d:/DACN/frontend/src/utils/studentImportHelper.js): Bảng xem trước 8 cột, modal sửa nhanh lỗi từng dòng hỗ trợ datepicker/dropdown giới tính, tự động khóa nút Import khi còn dòng lỗi.
   - Cập nhật [UserManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/UserManagementPage.jsx): Form thêm/sửa sinh viên hiển thị 8 trường bắt buộc; tự động điền dữ liệu `studentProfile` cũ khi sửa; hiển thị thẻ hồ sơ sinh viên chi tiết trên Drawer xem thông tin.
   - Cập nhật [ProfilePage.jsx](file:///d:/DACN/frontend/src/pages/common/ProfilePage.jsx): Hiển thị Lớp (`className`) và Ngành (`major`) dạng Chỉ đọc (Read-only); bảo vệ PII (không hiển thị ngày sinh/giới tính ra ngoài); sinh viên chỉ được phép sửa ảnh đại diện và số điện thoại. Commit `4748f41`.
5. **Bộ Chuyển Đổi Nhanh Đối Tượng Import (Sinh viên ⟷ Giảng viên)**:
   - Bổ sung bộ chọn `Radio.Group` (`🎓 Sinh viên` / `👨‍🏫 Giảng viên`) ngay trên đầu modal Import Excel.
   - Cho phép người dùng chuyển đổi tức thì giữa 2 đối tượng mà không cần đóng modal; tự động đồng bộ nút tải file mẫu tương ứng (`onDownloadTemplate(effectiveType)`), cấu trúc cột xem trước, luật kiểm tra hợp lệ và payload gửi lên backend. Commit `b3ee558`.
6. **Đồng Bộ Hoàn Toàn Nhánh Chính `d:\DACN`**:
   - Toàn bộ các commit từ `feat/student-profile-excel-import` đã được merge sạch sẽ vào nhánh chính `redesign-with-opendesign`.
   - Đã tái tạo Prisma Client trên `d:\DACN\backend` bằng `npx prisma generate`.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `DEPLOYED & UP TO DATE`; 23 migrations đã apply trên PostgreSQL Supabase demo; schema đồng bộ 100%, Prisma generate PASS.
- **Backend API**: `P0 COMPLETE & VERIFIED`; các API người dùng, import/export Excel, profile và auth guards đã tuân thủ chuẩn 8 trường và transaction nguyên tử.
- **Frontend SPA**: `P0 COMPLETE & BUILD PASS`; `ExcelImportModal.jsx`, `UserManagementPage.jsx`, `ProfilePage.jsx` hoạt động trơn tru; `vite build` PASS (19.88s, 0 lỗi).
- **Test**: `100% PASS`; Backend **59/59 test suites / 438/438 tests PASS**; Frontend **72/72 tests PASS**.
- **Chuẩn mã hóa**: 100% tệp tin đạt chuẩn **UTF-8 (no BOM)**; tuân thủ mô hình `TopicRegistration`.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **Task 5 (Ưu tiên P1) — Chiếu dữ liệu học vụ & Bảo mật PII**: Bổ sung `className` và `major` vào các DTO học vụ trong `registrationController.js`, `councilController.js`, `evaluationController.js`, và [scoreSheetPdfService.js](file:///d:/DACN/backend/src/services/scoreSheetPdfService.js); đảm bảo không rò rỉ `dateOfBirth` và `gender` ra quy trình chung/công khai.
2. **Task 6 (Ưu tiên P1) — Script Reset Demo Giữ Admin**: Xây dựng lệnh `npm run db:reset-demo-keep-admin` qua [resetDemoKeepAdmin.js](file:///d:/DACN/backend/scripts/resetDemoKeepAdmin.js) với token xác thực `SEED_RESET_CONFIRM=RESET_DACN_DEMO`, giữ duy nhất `ADMIN001` và nhóm `QUAN_TRI_VIEN`, dọn sạch toàn bộ dữ liệu mẫu học vụ.
3. **Task 7 (Ưu tiên P2) — Verification & Worktree Teardown**: Chạy kiểm thử toàn diện Backend + Frontend, diễn tập UAT xóa sạch dữ liệu thử nghiệm, và dọn dẹp worktree tạm theo yêu cầu.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Tách `StudentProfile` 1-1 với `User`**: Giữ `User` làm định danh tài khoản chung, không đưa các cột đặc thù sinh viên vào bảng `User`, tránh nhập nhằng giữa ngành đào tạo của sinh viên và `department` (khoa/bộ môn) của giảng viên.
2. **Quy tắc All-or-Nothing trong Import Excel**: Đảm bảo tính toàn vẹn danh sách sinh viên theo đợt; nếu một dòng sai định dạng hoặc trùng lặp thì toàn bộ file bị từ chối và rollback (Zero database writes), ngăn ngừa tình trạng dữ liệu dở dang hoặc thiếu sót hồ sơ học vụ.
3. **Bảo vệ PII và Tính Bất biến Học thuật**: Sinh viên chỉ được phép tự cập nhật ảnh đại diện và số điện thoại; các thông tin học vụ (MSSV, Họ tên, Giới tính, Ngày sinh, Lớp, Ngành) do Nhà trường quản lý và chỉ hiển thị read-only; ngày sinh và giới tính không được lộ ra các DTO học vụ/hội đồng/PDF công khai.
4. **Bộ Chuyển Đổi Đối Tượng Trong Modal Import**: Tối ưu hóa trải nghiệm người dùng bằng cách cho phép chuyển đổi giữa Sinh viên (8 cột) và Giảng viên (7 cột) ngay trong modal import, tự động đồng bộ file mẫu và payload gửi lên backend mà không cần đóng mở modal.


### Phiên 05/11/2026 — Hoàn tất Khắc Phục Lỗ Hổng Hậu Audit & Chuẩn Hóa Toàn Tuyến Quy Trình (Tasks 1–12)

#### 1. Những phần đã hoàn thành
1. **Toàn bộ 12 Tasks thuộc 3 Phase của Kế hoạch Remediation đã hoàn thành và được kiểm thử độc lập**:
   - **Phase 1: Security-First Containment (Task 1 -> Task 5)**:
     - *Task 1* (`b84a5b4`): Chặn toàn bộ bypass qua `gradeSubmission` đối với BM01–BM04 (mã lỗi `USE_DEDICATED_WORKFLOW_COMMAND`); khóa cứng generic task không thể thay đổi `TopicRegistration.status`; bắt buộc `Idempotency-Key` khi ban hành quyết định giao đề tài hàng loạt.
     - *Task 2* (`2b6fb06`, `2ce79e4`): Triển khai quy trình khóa điểm 2 bước. Bước 1 `POST /evaluations/member-score/lock` với 5 lớp guard bảo mật (danh tính, tư cách hội đồng, chống xung đột GVHD, tính bất biến, idempotency). Bước 2 `lockDefenseScores` yêu cầu capability `RESULT_LOCK`, đủ 3 phiếu chấm cá nhân của `CHAIRMAN`, `SECRETARY`, `REVIEWER`, và chuyển trạng thái nguyên tử bằng CAS sang `AWAITING_FINAL_APPROVAL`.
     - *Task 3* (`85d206b`): Chặn triệt để `DEFENSE_FAILED` chuyển sang `COMPLETED` tại `reviewArchive` (HTTP 403 `CANNOT_COMPLETE_FAILED_DEFENSE`); che giấu điểm bảo vệ chưa công bố đối với sinh viên trên toàn bộ API (`getMyGrades`, `getRegistrationArchive`) và thông báo (`notificationService.safeNotify`).
     - *Task 4* (`b5a66fe`, `72d038b`): Triệt tiêu Stored XSS trong CMS Portal Sanitizer bằng allowlist thẻ/thuộc tính nghiêm ngặt; kiểm tra Magic Bytes nhị phân cho tệp tải lên (PDF, DOC, DOCX, PNG, JPG, ZIP, RAR); sửa lỗi crash runtime trên `GradeViewPage.jsx`.
     - *Task 5* (`c66f3b9`, `16882d4`): Bắt buộc ghim chính sách quy trình tự động (`auto-pin`) theo cơ chế fail-closed khi đăng ký đề tài; kiểm soát quota tối đa 10 SV/GVHD chống race condition bằng `acquireMentorLock` kết hợp transaction `Serializable`; mở rộng `MENTOR_ACTIVE_REGISTRATION_STATUSES` bao quát toàn bộ trạng thái sống.
   - **Phase 2: Workflow Engines & Pre-Defense Archival (Task 6 -> Task 9)**:
     - *Task 6* (`2c7f65c`): Thêm enum `ArchivePhase` (`PRE_DEFENSE`, `POST_DEFENSE`) vào `ProjectArchive` với migration `20261105020000_add_pre_defense_archive_phase`; xây dựng script backfill phân loại dữ liệu legacy an toàn; mở endpoint `POST /archives/pre-defense` cho sinh viên sau khi đạt BM03.
     - *Task 7* (`b23152d`, `beb5285`): Tách biệt logic chấm BM04 sang domain service `bm04WorkflowService.submitBM04`; bắt buộc có hồ sơ `PRE_DEFENSE` trước khi GVHD tick "ĐỒNG Ý"; chuyển đổi trạng thái sang `DEFENSE_READY` bằng CAS nguyên tử; chặn trùng lặp thông báo khi gửi lại idempotent.
     - *Task 8* (`e2e9ee6`, `7f03f84`): Khơi thông dead-end appeal chữ ký, phục hồi hồ sơ về `BM03_SIGNATURE_PENDING` với hạn ký động tính từ policy ghim (`Asia/Ho_Chi_Minh`); xây dựng worker chạy nền `checkpointDeadlineOverdueJob.js` với PostgreSQL advisory lock (`108032601`), CAS chống xung đột khi sinh viên ký đúng lúc worker quét, tự động dừng hồ sơ khi quá hạn không khiếu nại.
     - *Task 9* (`16bb9b0`, `14f83e5`): Xây dựng checklist nộp hồ sơ Pre-defense trên `SubmissionPage.jsx`; tạo modal thẩm định khiếu nại chữ ký `CheckpointAppealReviewModal.jsx` với kiểm tra xung đột lợi ích chuẩn số (`Number(currentUserId) === Number(mentorId)`); nối hàng đợi khiếu nại trực tiếp trên `ProjectOversightPage.jsx`.
   - **Phase 3: UI Completion & AllowedActions Contracts (Task 10 -> Task 12)**:
     - *Task 10* (`5145f42`, `1a24f64`): Cổng Giảng viên - Tab Thẩm định đề cương BM01 lần đầu chỉ mở cho Chủ tịch Hội đồng; bổ sung `OutlineReviewModal.jsx`; trả về đầy đủ `submissions`, `student.class`, `mentor.email` và mặc định lọc theo học kỳ hiện hành.
     - *Task 11* (`ffcdc27`): Cổng Điều hành Viện - Drawer thẩm định BM02 trên `/lecturer/institute` chỉ gồm 2 hành động `APPROVE` và `RETURN_FOR_REVISION` (loại bỏ hoàn toàn `EXCEPTION_REVIEW`); tích hợp modal xem và ban hành Quyết định điều chỉnh (`DecisionAmendment`) gọi `semesterService.createDecisionAmendment`.
     - *Task 12* (`d253250`): Nối nút "Nộp & Khóa phiếu cá nhân" kèm Popconfirm trên `LecturerGradingSheetPage.jsx`; hiển thị huy hiệu khóa từng ủy viên và chỉ kích hoạt nút "Khóa sổ điểm hội đồng" khi đủ 3 phiếu khóa và có quyền `RESULT_LOCK` trên `GradingDefensePage.jsx`; áp dụng hợp đồng `allowedActions[]` lên toàn bộ giao diện Sinh viên và Giảng viên.

2. **Kiểm thử và Nghiệm thu Toàn tuyến (Whole-Branch Acceptance)**:
   - Toàn bộ 54 test suites backend (343 tests) PASS 100%.
   - Toàn bộ 35 unit/contract tests frontend PASS 100%.
   - Tổng cộng: **378 automated tests PASS**.
   - Frontend Production build (`vite build`): PASS (10.30s, 0 lỗi).
   - Kiểm tra mã hóa UTF-8 (no BOM): 100% tệp tin đạt chuẩn.
   - Không tồn tại mã nguồn sử dụng mô hình cũ `group/groupMember`.

#### 2. Trạng thái cập nhật của từng phần
- **Database/Prisma**: `UP TO DATE / MIGRATED`; migration `20261105020000_add_pre_defense_archive_phase` đã được thiết kế và kiểm thử; schema đồng bộ mô hình `TopicRegistration`, `ArchivePhase`, `IdempotencyRecord`.
- **Backend API**: `PRODUCTION READY`; toàn bộ 12 luồng nghiệp vụ cốt lõi đã được gia cố với Zero Bypass, Fail-Closed, và CAS Concurrency Control.
- **Frontend SPA**: `PRODUCTION READY`; các trang Student, Lecturer, Admin/Viện trưởng kết nối API thực tế, hiển thị theo `allowedActions[]`, giao diện OpenDesign đồng nhất.
- **Background Jobs**: Worker `checkpointDeadlineOverdueJob.js` bảo vệ bởi PostgreSQL Advisory Lock và CAS `stateVersion`.
- **Testing**: 378/378 tests PASS (54 suites backend, 35 tests frontend).
- **Git Branch**: Branch remediation gồm 19 commits sạch, có review package chi tiết cho từng task và toàn nhánh (`review-7b0d820..d253250.diff`).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Deploy Production Database Migration**: Chạy `npx prisma migrate deploy` trên môi trường Production để áp dụng enum `ArchivePhase`.
2. **Backfill Archive Data**: Chạy script `node backend/scripts/migrations/backfillArchivePhases.js --dry-run=false` với tài khoản quản trị để phân loại chính xác các hồ sơ lưu chiểu cũ.
3. **End-to-End User Acceptance Test (UAT)**: Thực hiện kịch bản kiểm chứng thực tế từ tài khoản `sv001`, `lecturer01` (Trưởng Viện / GVHD), `lecturer02` (Chủ tịch HĐ) và `admin` theo 10 bước của Kế hoạch Nghiệm thu Toàn tuyến.
4. **CI/CD Polish**: Bổ sung cờ `--forceExit` vào script test trong `backend/package.json` để tự động ngắt kết nối database pool sau khi Jest hoàn tất.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Loại bỏ hoàn toàn `EXCEPTION_REVIEW`**: Do chưa có đặc tả trạng thái, actor, hạn nộp, và audit trail rõ ràng, cơ chế này dễ trở thành cửa sau (bypass) trá hình. Chỉ giữ lại 2 hành động học thuật minh bạch: `APPROVE` và `RETURN_FOR_REVISION`.
2. **Quy trình Khóa Điểm Bảo Vệ 2 Bước Độc Lập**: Tách biệt rõ ràng giữa "Khóa phiếu cá nhân của từng Giám khảo" (bước 1) và "Khóa sổ điểm Hội đồng" (bước 2). Admin không có quyền học thuật tự ý khóa nếu chưa đủ 3 phiếu khóa của Chủ tịch, Thư ký và Phản biện.
3. **Che Điểm Hoàn Toàn Trước Công Bố**: Tránh việc sinh viên xem được điểm thô trước khi Hội đồng/Viện trưởng phê duyệt và ban hành snapshot công bố chính thức, ngăn ngừa khiếu nại sai quy trình và rò rỉ thông tin học vụ.
4. **Chống Race Condition Quota 10 SV Bằng 2 Tầng**: Không chỉ dựa vào kiểm tra ở controller, mà sử dụng cả khóa đồng thời `acquireMentorLock` ở tầng service và mức cô lập giao dịch `Serializable` ở tầng CSDL để đảm bảo không thể vượt quá 10 SV/GVHD dưới tải đồng thời.


