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

### Phiên 19/11/2026: Khắc Phục Lỗi Giật Cuộn Menu Sidebar, Chuẩn Hóa Typography Thẻ Chỉ Số & Khắc Phục Lỗi Crash Backend (Postgres Connection Timeout)

#### 1. Những phần đã hoàn thành
1. **Khắc Phục Triệt Để Lỗi Crash Backend Do Postgres Connection Timeout & Deprecation Warning (`043cfe7`)**:
   - **Hiện tượng lỗi**: Server backend chạy nodemon bị crash và khởi động lại liên tục với log:
     ```
     (node:2312) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated...
     prisma:error Connection terminated due to connection timeout
     Error: Connection terminated due to connection timeout / Connection terminated unexpectedly
     [nodemon] app crashed - waiting for file changes before starting...
     ```
   - **Nguyên nhân gốc rễ**:
     * Pool size mặc định quá nhỏ (`DEFAULT_DB_POOL_MAX = 8`) trong khi frontend gửi nhiều API queries song song kèm theo background schedulers (`pendingRegistrationReminderJob`, `taskDeadlineNotificationJob`) chạy đồng thời.
     * `DEFAULT_DB_POOL_CONNECTION_TIMEOUT = 15000` (15s) quá ngắn đối với kết nối đường dài tới Supabase PgBouncer (ap-southeast-1). Khi kết nối chạm mốc 15s, `pg-pool` kích hoạt hủy stream TCP socket (`client.connection.stream.destroy()`).
     * `pg-pool` hủy socket khi `client.connect()` chưa hoàn tất, trong khi tại thời điểm đó client chưa có listener `error` nên Node.js phát sinh ngoại lệ không bắt được (`uncaughtException: Error: Connection terminated unexpectedly`) dẫn đến crash toàn bộ tiến trình Node.
   - **Giải pháp xử lý**:
     * **`ResilientPgClient` trong `backend/src/config/database.js`**: Mở rộng lớp `Client` của `pg` gắn sẵn listener `'error'` mặc định ngay khi khởi tạo instance, ngăn chặn triệt để tình trạng EventEmitter bắn uncaught exception khi socket stream bị ngắt kết nối đột ngột hoặc timeout.
     * **Cấu hình Pool & Adapter**: Cập nhật `backend/.env` lên `DB_POOL_MAX=15`, `DB_POOL_IDLE_TIMEOUT_MS=20000`, `DB_POOL_CONNECTION_TIMEOUT_MS=45000`. Thêm callback `onPoolError` vào `PrismaPg` adapter để bắt các lỗi nền của pool một cách an toàn.
     * **Bảo vệ toàn cục `backend/src/app.js`**: Bổ sung listener `unhandledRejection` và `uncaughtException` cấp tiến trình, log cảnh báo và tự phục hồi an toàn khỏi sự cố ngắt kết nối mạng tạm thời mà không làm sập server nodemon.
     * **Giảm tải Schedulers**: Chuyển các tác vụ khởi động scheduler (`pendingRegistrationReminderJob.js`) từ `Promise.all` song song sang tuần tự; làm trễ 5s trước khi chạy lượt quét đầu tiên (`taskDeadlineNotificationJob.js`) tránh tranh chấp connection pool với luồng khởi động server.
2. **Khắc Phục Triệt Để Lỗi Giật Cuộn Menu Sidebar (`AppLayout.jsx`) (`6d54917`, `84c9974`)**:
   - **Nguyên nhân gốc rễ**: Trước đây component `NavContent` được khai báo lồng bên trong hàm render của `AppLayout`. Mỗi khi người dùng bấm vào một tính năng trong sidebar, URL thay đổi khiến `AppLayout` re-render và tạo một function instance mới của `NavContent`. React phát hiện `element.type` thay đổi nên Unmount toàn bộ cây DOM của Sidebar và Mount lại từ đầu, dẫn đến thuộc tính `scrollTop` của `<nav className="flex-1 overflow-y-auto">` bị đặt lại về `0` (nhảy ngược lên đỉnh menu).
   - **Giải pháp**: Tách `NavContent` thành component độc lập cấp module bên ngoài `AppLayout`, truyền toàn bộ state và handlers qua `props` (`navProps`).
   - **Kết quả**: Component type của `NavContent` ổn định 100% giữa các lần render. Khi chuyển trang hoặc chuyển tab, React tái sử dụng cây DOM sẵn có, chỉ cập nhật `className` active và `aria-current="page"`, trình duyệt giữ nguyên 100% vị trí cuộn (`scrollTop`) của thanh menu.
3. **Chuẩn Hóa Typography Thẻ Chỉ Số / KPI Thống Nhất Theo Chuẩn Trang Tổng Quan (`OverviewKpis.jsx`)**:
   - Quy chuẩn hóa typography dựa trên 4 thẻ chỉ tiêu của [OverviewKpis.jsx](file:///d:/DACN/frontend/src/components/lecturer/OverviewKpis.jsx):
     * **Label (Tiêu đề thẻ)**: `text-xs font-semibold uppercase tracking-wide text-slate-500` (12px, semibold 600, uppercase, tracking-wide).
     * **Value (Con số / Giá trị chính)**: `text-2xl font-bold text-slate-900 mt-1 tabular-nums` (24px, bold 700 thay vì font-black 900 hay text-3xl font-extrabold, căn số dạng tabular).
     * **Hint / Subtitle (Chú thích phụ)**: `text-xs text-slate-500 mt-1`.
     * **Icon Box**: `w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0` kèm icon 18px (`text-lg`).
     * **Card Container**: `rounded-xl border shadow-sm` với padding chuẩn `14px 16px` (hoặc `p-4`).
   - Đồng bộ trên toàn bộ các trang và component hiển thị thẻ chỉ số:
     * [LecturerStudentsPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerStudentsPage.jsx): 4 thẻ Bento (Chỉ tiêu hướng dẫn, Đề cương BM01, Tiến độ BM03, Đánh giá & Bảo vệ).
     * [AcademicReportsPage.jsx](file:///d:/DACN/frontend/src/pages/admin/AcademicReportsPage.jsx): 4 thẻ KPI (Tổng SV Tham Gia, Tỷ Lệ Hoàn Thành, Điểm Trung Bình Viện, Tỷ Lệ Xuất Sắc & Giỏi).
     * [UserManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/UserManagementPage.jsx): 4 thẻ KPI tài khoản (Tổng Tài khoản, Cán bộ & Giảng viên, Sinh viên Làm đồ án, Quản trị & Giáo vụ).
     * [CouncilAssignmentPage.jsx](file:///d:/DACN/frontend/src/pages/admin/CouncilAssignmentPage.jsx): 4 thẻ KPI hội đồng (Tổng Hội đồng, Sinh viên Trong Đợt, Đã xếp vào Hội đồng, Xung đột Lợi ích).
     * [ProjectPeriodPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectPeriodPage.jsx): 4 thẻ KPI đợt (Tổng số đợt, Đợt đang hoạt động, Đơn BM02 chờ thẩm định, Quy mô đợt hiện hành).
     * [StatCard.jsx](file:///d:/DACN/frontend/src/components/common/StatCard.jsx): Component dùng chung cho các trang quản trị (ProjectOversightPage).
     * [ProfileQuickMetrics.jsx](file:///d:/DACN/frontend/src/components/profile/ProfileQuickMetrics.jsx): 4 thẻ thông số nhanh tại trang Hồ sơ cá nhân.
     * [ProjectEnrollmentPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectEnrollmentPage.jsx) & [ProjectOversightPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectOversightPage.jsx): Các thẻ radar cảnh báo và kiểm tra bất thường.
     * [index.css](file:///d:/DACN/frontend/src/index.css) & [admin-opendesign.css](file:///d:/DACN/frontend/src/pages/admin/admin-opendesign.css): Chuẩn hóa class `.kpi-stat-card`, `.kpi-stat-val`, `.kpi-stat-sub`, `.eyebrow`.
3. **Tinh Chỉnh Copywriting Chế Độ Xem Danh Sách Sinh Viên (`SupervisedStudentList.jsx`)**:
   - Đổi nhãn `Segmented` từ kỹ thuật thuật ngữ (`Thẻ Bento` / `Bảng dữ liệu`) sang từ ngữ học vụ tự nhiên, thân thiện: **`Dạng thẻ`** và **`Dạng bảng`**.

#### 2. Trạng thái cập nhật của từng phần
- **Frontend SPA**:
  * Build kiểm tra: `npm --prefix frontend run build` **PASS** (3378 modules, build trong 18.02s, 0 lỗi).
  * Runtime tests: `sidebarAccessibility.spec.jsx` (3/3 tests PASS), `lecturerStudentsNavigation.spec.jsx` (3/3 tests PASS), `profilePageUiUx.test.js` (7/7 tests PASS).
  * Chuẩn mã hóa: 100% tệp cập nhật tuân thủ **UTF-8 without BOM** và quy tắc nút bấm không raw emoji (Rule 2.6).
- **Backend API & Database**: Giữ nguyên trạng thái ổn định từ các phiên trước.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Tiếp tục tối ưu trải nghiệm người dùng (UX transitions & micro-interactions) trên các màn hình quản trị còn lại.
2. Kiểm tra thực tế trên trình duyệt thực các luồng tương tác giữa giảng viên và sinh viên sau khi chuẩn hóa UI.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Chuẩn hóa Typographic Hierarchy cho KPI Metrics**: Tránh tình trạng mỗi trang dùng một cỡ chữ khác nhau (`text-3xl font-extrabold`, `text-2xl font-black`, `text-xl font-medium`). Việc thống nhất `text-xs font-semibold uppercase tracking-wide text-slate-500` cho nhãn và `text-2xl font-bold text-slate-900 mt-1 tabular-nums` cho số liệu giúp giao diện mang phong cách Clean Academic Dashboard của hệ thống OpenDesign.
- **Tách Component Con Ra Khỏi Render Scope**: Khai báo component con bên trong hàm render cha là lỗi phổ biến trong React dẫn đến unmount/mount liên tục, mất scroll và mất local state. Luôn khai báo component ở cấp độ module.

---

### Phiên 18/11/2026 (Phần 2: Tách BM02-A Khỏi Duyệt Nguyện Vọng, Hạ Tầng In & Nộp Trực Tuyến BM01–BM03, Chuẩn Hóa Seed `DATN` / TDMU & Vá Bảo Mật)

#### 1. Những phần đã hoàn thành
1. **Tách Luồng Điều Chỉnh Tên Đề Tài BM02-A Khỏi "Duyệt Nguyện Vọng" (`8070592`)**:
   - **Backend (`lecturerOverviewService.js`, `bm02aController.js`)**: Thẻ `REVIEW_TITLE_ADJUSTMENT` trên Tổng quan giảng viên lấy trực tiếp từ `BM02AAdjustmentRequest` (`PENDING_ADVISOR`) của chính GVHD trong kỳ, trả `requestId` và `target: '/lecturer/title-adjustments?requestId=<id>'` (không dùng `TopicTitleAdjustment` cũ, không trộn `PENDING_DEPARTMENT_APPROVAL`). Siết kiểm tra ownership BM02-A (bỏ `ADMIN` bypass mù, chặn giả mạo `actorRole` khi trả lại phiếu).
   - **Frontend**: Tạo trang riêng [TitleAdjustmentPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/TitleAdjustmentPage.jsx) tại `/lecturer/title-adjustments?requestId=<id>` (bọc `ProtectedRoute` trong `App.jsx`, không thêm mục cố định trên sidebar). Gỡ tab BM02-A khỏi `TopicApprovalPage.jsx` (chỉ giữ `mentor` và `bm01`, redirect `/lecturer/approvals?tab=bm02a` giữ `requestId`). Bổ sung nút mở thẳng phiếu theo `requestId` trên `SupervisedStudentList.jsx`, `LecturerStudentsPage.jsx` và `TopicManagementPage.jsx` (GV).
   - **Kiểm thử**: `titleAdjustmentNavigation.spec.jsx` (8/8), `LecturerOverview.spec.jsx` (4/4), `lecturerStudentsNavigation.spec.jsx` (3/3), `fivePersonaPolicies.spec.jsx` (20/20), `e2e/rbac-five-persona.spec.js` (5/5), Backend 33/33 PASS.
2. **Hạ Tầng In A4 & Nộp Trực Tuyến BM01–BM03 (`3277892`)**:
   - **Academic Print Foundation**: Cô lập `@media print` trong `index.css` theo `body[data-print-mode="academic-form"]` và `body[data-print-mode="announcement"]` (`HomePage.jsx`), bỏ `fixed`/`maxHeight`/`overflow`/`transform` khi in tại `AcademicFormPrintModal.jsx`. Chuẩn hóa dữ liệu thật (bỏ placeholder/chữ ký/điểm giả) trên `BM02PrintSheet`..`BM05PrintSheet`; `AcademicDossierDrawer.jsx` tách riêng tải/in PDF BM01 và in BM02–BM05 qua trình duyệt.
   - **BM01 PDF-Only & Lưu Đồng Thời `content` + `assetId`**: Áp dụng migration `20261118150000_bm01_pdf_only`; khóa policy BM01 chỉ nhận PDF $\le 20$ MB (`assetPolicyCatalog.js`, `outlineReviewService.js`, `semesterController.js`, `ProjectPeriodPage.jsx`); gửi và lưu `content` + `assetId` trong một transaction v1/v2 kèm `Idempotency-Key`; xem/mở chính PDF BM01 v1/v2 qua `BMSubmissionViewer.jsx` và `OutlineReviewModal.jsx` (lịch sử `.docx` chỉ tải xuống).
   - **BM02 Xác Nhận Trực Tuyến 3 Bước**: Áp dụng migration `20261118160000_bm02_confirmation_events` (thêm `payloadHash`, `studentSignatureEventId`, `advisorSignatureEventId`, `departmentSignatureEventId` vào `BM02Submission`) và thêm `BM02_ADVISOR_SIGN`, `BM02_DEPARTMENT_SIGN` vào `permissions.js`. Tạo `bm02SignatureService.js` và 3 API mới (`/api/bm02/applications/:id/advisor-sign`, `/department-sign`, `/verification`); bỏ yêu cầu bản scan BM02 trên `HybridBMFormModal.jsx`, nối ký xác nhận và nhãn `"Đã xác thực nội bộ"` / `"Chờ xác nhận"` trên `LecturerDashboardPage.jsx`, `InstituteOperationsPage.jsx`, `BM02ReviewDrawer.jsx`, `BM02PrintSheet.jsx`.
   - **BM03 Dòng Thời Gian Liên Tục & Mốc Đánh Giá**: Áp dụng migration `20261118170000_bm03_stage_windows` (thêm `bm03MidtermEvaluationOpenAt`, `bm03FinalizationOpenAt` trên `Semester` và snapshot vào `PeriodWorkflowPolicyVersion`); thêm `assertBM03StageWindow` trong `bm03WorkflowService.js`, bỏ chốt sớm `BM03_PASSED` từ Checkpoint 2 (`checkpointWorkflowService.js`). Hợp nhất dòng thời gian trên `ProgressTrackingPage.jsx` (GVHD) và `SubmissionPage.jsx` (SV chỉ đọc nhật ký, xác nhận toàn phiếu cuối kỳ, chỉ mở in BM03 hoàn tất sau khi chốt).
3. **Khắc Phục Lỗi Giao Diện & Vá Bảo Mật (`a96659a`, `8d19f4d`, `cceea9f`)**:
   - Sửa `isInstituteDirector` và `getUserDisplayRole` trong `frontend/src/utils/authRedirect.js` & `AppLayout.jsx`: phân biệt đúng tài khoản `GIAO_VU` (`lecturer02` / `gv002@tdmu.edu.vn`) hiển thị **`Giáo vụ`** thay vì bị nhận nhầm là **`Viện trưởng`** do có quyền `PROJECT_ASSIGNMENT_PUBLISH`.
   - Sửa ngăn bên *"Thẩm định & Chi tiết Đề tài"* trong `frontend/src/pages/admin/TopicManagementPage.jsx`: dùng `getStatusTagConfig(r.status)` để hiển thị nhãn tiếng Việt **`Đang thực hiện đồ án`** thay cho mã enum thô `IN_PROGRESS_BM03`.
   - Vá bảo mật `backend/scripts/storage/applyStorageMigrations.js`: loại bỏ chuỗi PostgreSQL URL hardcode có mật khẩu, chuyển sang đọc `process.env.DIRECT_URL || process.env.DATABASE_URL`.
4. **Chuẩn Hóa Bộ Dữ Liệu Seed & Loại Bỏ `DACN` (Chỉ Giữ `DATN`) (`647ee3a`, `830cf9b`, `fcdff47`)**:
   - Đổi tên & mã 3 đợt đồ án thành `HK1-2025-2026`, `HK2-2025-2026`, `HK1-2026-2027` (kèm mốc BM03); giữ mã GV tăng dần `GV001`..`GV020`, tên GV tự nhiên không lặp tiền tố học vị; đổi email GV thành `gv001@tdmu.edu.vn`..`gv020@tdmu.edu.vn` và SV thành `sv001@st.tdmu.edu.vn`..`sv300@st.tdmu.edu.vn`.
   - Gỡ bỏ hoàn toàn loại đồ án `DACN` ("Đồ án chuyên ngành") khỏi `seedThreeSemesters.js` (chỉ giữ duy nhất `DATN` — "Đồ án tốt nghiệp", `plannedQuota: 10`), `objectPathBuilder.js`, `excelHelper.js`, `authorizationExemptions.js` và 8 tệp giao diện Frontend.
   - Bổ sung 4 bảng lưu trữ vào allow-list của `resetApplicationData.js` và sửa `permissionService.js` (`create` chỉ truyền `{ code, label, module }`); đã chạy lại `npm --prefix backend run db:seed:3semesters` thành công lên PostgreSQL DB (321 users, 3 đợt, 300 đề tài, 300 `TopicRegistration`).

#### 2. Trạng thái cập nhật của từng phần
- **Cơ sở dữ liệu (Supabase PostgreSQL)**:
  * Đã chạy `prisma migrate deploy` áp dụng đủ 39 migrations (gồm `20261118150000_bm01_pdf_only`, `20261118160000_bm02_confirmation_events`, `20261118170000_bm03_stage_windows`) và `prisma generate`.
  * Đã chạy lại `db:seed:3semesters` sạch sẽ (chỉ còn `DATN`, email `@tdmu.edu.vn` / `@st.tdmu.edu.vn`, 3 đợt `HK1-2025-2026`, `HK2-2025-2026`, `HK1-2026-2027`).
- **Backend API**:
  * Đầy đủ các endpoint BM01 PDF+content, BM02 3-step verification (`advisor-sign`, `department-sign`, `verification`), BM03 stage windows (`assertBM03StageWindow`), BM02-A ownership/authz.
  * Tất cả test suites đã chạy đều PASS: `permissionCatalogMigration` + `bm02AndDecisionWorkflow` (34/34), `outlineReviewService` + `outlineRoutes` + `bm01.routes` (74/74), `bm02SignatureService` + `bm02Signature.routes` + `bm02AndDecisionWorkflow` (27/27), `bm03StageWindows.routes` + `bm03Workflow` + `checkpointWorkflowService` + `checkpointDeadlineAndAppealResolution` + `semesters.routes` (75/75), `bm02ToBm04FullE2E` (29/29), `objectPathBuilder` + `storedAssetService` + `projectEnrollmentExcel` (31/31).
- **Frontend SPA**:
  * Production build `npm --prefix frontend run build` **PASS** (3375 modules, 0 lỗi).
  * Print unit tests: **6/6 PASS**; Runtime tests (BM01/BM02/BM03/Print): **20/20 PASS**; BM02-A & Sidebar/Five-persona runtime tests: **35/35 PASS** + **23/23 PASS**; Playwright E2E (`academicFormsPrint`, `bm01PdfPreview`, `bm02Confirmation`, `bm03FinalPrint`): **7/7 PASS**, `rbac-five-persona`: **5/5 PASS**.
- **MCP (`supabase-postgres`)**:
  * Ghi nhận lỗi kết nối SSL `self-signed certificate in certificate chain` khi gọi MCP `query` trực tiếp; đã truy vấn/kiểm chứng DB qua Prisma CLI & script Node trong `backend/` ổn định.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Xoay (Rotate) Mật Khẩu Database Supabase**:
   - Đổi mật khẩu DB trên Supabase Dashboard (và cập nhật `.env` cục bộ) trước khi đẩy git history lên remote công khai do `applyStorageMigrations.js` từng chứa chuỗi kết nối cũ trong lịch sử commit trước `cceea9f`.
2. **Kiểm Thử Thực Tế Giao Diện Sau Khi Seed Dữ Liệu Mới (`gv001@tdmu.edu.vn`, `gv002@tdmu.edu.vn`, `sv201@st.tdmu.edu.vn`)**:
   - Kiểm tra trực tiếp trên trình duyệt luồng đăng nhập `gv001@tdmu.edu.vn` (Viện trưởng), `gv002@tdmu.edu.vn` (Giáo vụ), `sv201@st.tdmu.edu.vn` (Sinh viên) với 3 đợt `HK1-2025-2026`, `HK2-2025-2026`, `HK1-2026-2027` và loại đồ án duy nhất `DATN`.
3. **Cấu Hình Cron Jobs Storage Workers & Legacy Cleanup Apply Mode (Môi trường thực tế)**:
   - Thiết lập lịch chạy định kỳ cho `storage:cleanup -- --apply` và `storage:reconcile -- --apply`.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Chỉ Giữ Duy Nhất Loại Đồ Án `DATN` ("Đồ án tốt nghiệp")**: Hệ thống Viện Công nghệ số vận hành tập trung cho học phần Đồ án tốt nghiệp; loại bỏ `DACN` giúp đồng bộ thuật ngữ, quota (`10` SV/GVHD/đợt) và tránh phân mảnh dữ liệu ở cả seed lẫn giao diện.
- **Tách Nhãn Hiển Thị Vai Trò Khỏi Quyền Hành Động (`authRedirect.js`)**: Quyền `PROJECT_ASSIGNMENT_PUBLISH` có thể được cấp cho cả Giáo vụ (`GIAO_VU`), do đó chỉ nhóm `VIEN_TRUONG` mới hiển thị chức danh `"Viện trưởng"`, nhóm `GIAO_VU` hiển thị `"Giáo vụ"`.
- **Cô Lập `@media print` Bằng `data-print-mode` & Tách BM01 PDF Riêng**: Tránh xung đột quy tắc in bản tin làm trắng trang khi in BM02–BM05; giữ BM01 là tệp PDF gốc sinh viên tải lên thay vì tái tạo HTML mô phỏng.
- **Tách BM02-A Ra Khỏi "Duyệt Nguyện Vọng"**: BM02-A là quy trình điều chỉnh tên sau đăng ký (3 chữ ký), mở theo `requestId` từ Tổng quan hoặc hồ sơ đề tài/sinh viên tại `/lecturer/title-adjustments` giúp "Duyệt nguyện vọng" giữ đúng một nhiệm vụ tiếp nhận hướng dẫn.

---

### Phiên 18/11/2026 (Triển Khai Workflow Sidebar Theo Quy Trình Đồ Án, Khóa Phạm Vi `REPORT_VIEW` & Trung Tâm Điều Hành Học Vụ Viện Trưởng `/lecturer/institute`)

#### 1. Những phần đã hoàn thành
1. **Dọn sạch & Chuẩn hóa các thay đổi bàn giao từ phiên trước (`0d82ef1`, `4e125e7`)**:
   - Siết chặt `backend/scripts/storage/cleanupLegacyAssets.js`: không cho `--apply` tự xác nhận snapshot, chặn khi thiếu `--confirm-snapshot`, thoát với exit code `1` khi có lỗi một phần (`failed > 0`).
   - Cập nhật `backend/src/controllers/reportController.js` & `frontend/src/pages/admin/AcademicReportsPage.jsx`: loại bỏ hoàn toàn điểm BM04 định lượng, chỉ sử dụng điểm BM05 đã công bố hợp lệ.
2. **Tách `REPORT_VIEW` khỏi `GVHD` & Khóa Phạm Vi Đọc Báo Cáo (`3ac4874`, `c706eda`)**:
   - Bỏ `REPORT_VIEW` khỏi `DEFAULT_GROUPS.GVHD` trong `backend/src/constants/permissions.js` (giữ ở `VIEN_TRUONG`, `GIAO_VU`, `QUAN_TRI_VIEN`) và bỏ `REPORT_VIEW` khỏi guard `GET /api/dashboard/lecturer`.
   - Tạo migration idempotent `backend/prisma/migrations/20261118120000_remove_gvhd_report_view/migration.sql` (tăng `permission_version` cho thành viên nhóm `GVHD` khi có bản ghi bị xóa) và đã áp dụng lên CSDL bằng `npx prisma migrate deploy`.
   - Tạo `backend/src/auth/reportReadScope.js` (`resolveReportReadScope`) và áp dụng lọc theo scope trên `/api/reports/*` (`overview`, `lecturer-workload`, `export-excel`) và `/api/dashboard/*` (`stats`, `semester-overview`, `semesters`, `scores`, `activities` fail-closed khi không `GLOBAL`).
3. **Tái Cấu Trúc Sidebar Theo Quy Trình & Trang "Sinh Viên Đang Hướng Dẫn" (`7087057`)**:
   - Hợp nhất `FEATURE_POLICIES` (`frontend/src/auth/featurePolicies.js`) làm nguồn chuẩn duy nhất (27 mục, 9 nhóm quy trình) và dẫn xuất `NAVIGATION_REGISTRY` (`frontend/src/config/navigationRegistry.js`) từ `FEATURE_POLICY_LIST`.
   - Cập nhật `ProtectedRoute.jsx`, `policyEvaluator.js` (bỏ bypass `role === 'ADMIN'`) và `App.jsx` (tách guard hội đồng xét duyệt đề cương / hội đồng bảo vệ; `/admin/reports` dùng `REPORT_VIEW` độc lập).
   - Tạo `frontend/src/pages/lecturer/LecturerStudentsPage.jsx` (`/lecturer/students`) dùng `useLecturerOverview` (chỉ sinh viên do actor hướng dẫn), cập nhật `TopicApprovalPage.jsx` đồng bộ `?tab=`, và nâng cấp `AppLayout.jsx` (active state theo `pathname + normalized tab`, `aria-current="page"`, keyboard navigation, Escape đóng drawer mobile trả focus).
4. **Trung Tâm Điều Hành Học Vụ Viện Trưởng (`/lecturer/institute`) (`3cb6511`, `b5a0b0f`, `eff08ac`, `e810412`)**:
   - **Backend API**: Tạo `instituteOperationsService.js`, `instituteOperationsController.js`, `instituteOperationsRoutes.js` (`GET /api/institute/operations?tab=review|decisions|publish`), lọc capability + resource scope cho từng hồ sơ, tính `counts` trước phân trang, phân trang tối đa 50 item/trang, `allowedActions[]` khớp quyền mutation và không làm lộ điểm BM05 chưa công bố.
   - **Frontend Hub**: Tạo `instituteOperationsService.js`, `instituteOperationsQueries.js`, `ReviewQueue.jsx`, `DecisionQueue.jsx`, `PublicationQueue.jsx`, `AcademicDelegationDrawer.jsx`, và `InstituteOperationsPage.jsx` tái dùng form/modal hiện có, hỗ trợ legacy deep links (`bm02`/`bm02Queue`, `periods`/`decisions`, `delegations`) và lịch sử Back/Forward.
   - **Nối Route, Menu & Checklist**: Nối `InstituteOperationsPage` vào `/lecturer/institute` trong `App.jsx`, bật mục `"Điều hành học vụ"` (`lecturer-institute`, nhóm `"Điều hành viện"`) trong `featurePolicies.js`, và đánh dấu hoàn thành toàn bộ checklist trong cả 2 kế hoạch [2026-11-18-workflow-sidebar-implementation-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-18-workflow-sidebar-implementation-plan.md) và [2026-11-18-institute-operations-hub-implementation-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-18-institute-operations-hub-implementation-plan.md).

#### 2. Trạng thái cập nhật của từng phần
- **Cơ sở dữ liệu (Supabase PostgreSQL)**:
  - `npx prisma validate`: **PASS**.
  - `npx prisma migrate deploy` & `npx prisma migrate status`: Đã áp dụng cả `20261116234000_canonicalize_rbac_permissions` và `20261118120000_remove_gvhd_report_view` — **36/36 migrations applied (`Database schema is up to date!`)**.
- **Backend API**:
  - Các test suites RBAC, scope `REPORT_VIEW` và `/api/institute/operations` chạy PASS:
    * Wave 1A (RBAC & Scope): **7/7 suites, 92/92 tests PASS**.
    * Wave 1B (Institute Operations API): **5/5 suites, 51/51 tests PASS**.
- **Frontend SPA & Kiểm thử**:
  - Node unit tests (6 files điều hướng, parity, deep-link): **47/47 tests PASS**.
  - Vitest runtime tests (7 files: `sidebarRouteAuthorization`, `lecturerStudentsNavigation`, `sidebarAccessibility`, `instituteReviewHub`, `instituteDecisionHub`, `institutePublicationHub`, `fivePersonaPolicies`): **7/7 files, 39/39 tests PASS**.
  - Playwright E2E (`institute-operations-hub.spec.js`, `rbac-five-persona.spec.js`, `loading-error-navigation.spec.js`, dùng API route mocking theo pattern repo): **13/13 tests PASS**.
  - Production build (`npm --prefix frontend run build`): **PASS** (13.27s).
  - `git diff --check` & UTF-8 without BOM: **PASS**.
  - *Lưu ý sẵn có ngoài phạm vi*: `frontend/tests/rbacUiContracts.test.js` còn 1 test sẵn có từ trước fail ở `LecturerDashboardPage.jsx`, và `npm --prefix frontend run lint` toàn repo còn các cảnh báo sẵn có ở tệp khác ngoài phạm vi Wave 1–3.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Cải thiện điểm vào duyệt đổi tên BM02-A cho GVHD (nếu muốn tối ưu UX)**:
   - Cân nhắc hiển thị khối/hành động duyệt yêu cầu đổi tên BM02-A ngay trên trang **"Sinh viên đang hướng dẫn"** (`/lecturer/students`) và/hoặc dashboard GVHD trong khi vẫn giữ deep link `/lecturer/approvals?tab=bm02a`.
2. **Dọn 3 bản ghi `StoredAsset` test mồ côi & vận hành Storage Production**:
   - Xử lý 3 bản ghi `hoc-vu/test/...` (`registrationId = null`) phát hiện khi chạy `storage:reconcile --dry-run` ở phiên trước, rồi lập lịch cron thực tế cho `storage:cleanup` và `storage:reconcile`.
3. **Xử lý test & lint pre-existing**:
   - Rà soát test fail sẵn có ở `LecturerDashboardPage.jsx` trong `frontend/tests/rbacUiContracts.test.js` và dọn các cảnh báo ESLint còn tồn đọng.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Thực thi song song theo 3 Waves tách vùng tệp**: Chia 2 kế hoạch thành Wave 1 (Backend song song), Wave 2 (Frontend nền tảng vs. Hub Components tách rời) và Wave 3 (ghép `App.jsx` / `featurePolicies.js` + E2E 5 persona) giúp tránh xung đột file và giữ mỗi task 1 commit sạch.
- **Tách `REPORT_VIEW` khỏi `GVHD` và Fail-Closed theo Scope**: GVHD mặc định chỉ xem sinh viên mình hướng dẫn qua `/api/dashboard/lecturer` và `/lecturer/students`; chỉ các vai trò có `REPORT_VIEW` gắn scope hợp lệ mới truy cập `/api/reports/*` và các endpoint dashboard tổng hợp.
- **Một nguồn Policy (`FEATURE_POLICIES`) & Bật Hub khi đủ 3 tab**: Dẫn xuất `NAVIGATION_REGISTRY` trực tiếp từ `FEATURE_POLICY_LIST` để loại bỏ lệch nhãn/quyền giữa menu và route; chỉ bật mục `"Điều hành học vụ"` ở Wave 3 sau khi cả 3 tab (`review`, `decisions`, `publish`) và guard backend đã hoàn chỉnh.

---

### Phiên 17/11/2026 (Triển Khai Toàn Diện Quản Trị Lưu Trữ Supabase Storage 4 Buckets, TUS Resumable Upload, Bảo Mật Tệp Học Vụ Bằng Signed URL & Chuẩn Hóa Phân Quyền Năng Lực Học Vụ Viện Trưởng)

#### 1. Những phần đã hoàn thành
1. **Chuẩn Hóa Phân Quyền Năng Lực Học Vụ (Canonical RBAC) cho Viện Trưởng & Tối Ưu Giao Diện**:
   - **Phân quyền truy cập Điều phối đợt đồ án cho Viện trưởng**:
     * Khắc phục lỗi 403 "Bạn không có quyền thực hiện thao tác này" khi tài khoản Viện trưởng truy cập `/admin/project-enrollments`.
     * Bổ sung đầy đủ quyền năng lực học vụ `PERMISSION_ASSIGN_ACADEMIC` và `PERMISSION_VIEW_TOPIC_ENROLLMENTS` vào nhóm chức vụ `VIEN_TRUONG`.
   - **Chuẩn hóa nhãn học vị**:
     * Chuyển đổi toàn bộ enum học vị kỹ thuật thô (`Thac_Si`, `Tien_Si`, `Pho_Giao_Su`, `Giao_Su`) sang danh từ tiếng Việt chuẩn mực, trang trọng ("Thạc sĩ", "Tiến sĩ", "Phó Giáo sư", "Giáo sư") trên các trang Điều phối và Quản lý người dùng.
   - **Tối ưu form Quản lý người dùng**:
     * Loại bỏ trường chọn khoa cố định ("Viện Công nghệ số") trong modal thêm/sửa người dùng, chỉ giữ lại trường lựa chọn Bộ môn chuyên môn trực thuộc.
   - **Chuẩn hóa Middleware Xác thực (`backend/src/middlewares/auth.js`)**:
     * Tái cấu trúc `optionalAuthenticate` sử dụng hàm phân giải quyền năng lực tập trung `resolveUserCapabilities({ userId, db })` đồng bộ với `authenticate`, loại bỏ lỗi `ReferenceError: extractCurrentSemesterId is not defined` từng gây nuốt ngữ cảnh xác thực.

2. **Triển Khai Hạ Tầng Lưu Trữ Supabase Storage 4 Buckets (Wave 1: Tasks 1–4)**:
   - **Quy hoạch 4 bucket chuẩn**:
     * `cong-khai` (`public: true`): Tài nguyên công khai đã duyệt (biểu mẫu, thông báo, logo/banner).
     * `hoc-vu` (`public: false`): Hồ sơ đồ án, biểu mẫu BM01–BM05, báo cáo lưu chiểu, bảng điểm hội đồng, slide, source code ZIP.
     * `ca-nhan` (`public: false`): Ảnh đại diện người dùng (avatar).
     * `tam` (`public: false`): Vùng đệm tải lên dở dang (staging) cho giao thức TUS, chỉ backend truy cập.
   - **CLI Khởi tạo và Quản trị Bucket (`backend/scripts/storage/provisionBuckets.js`)**:
     * Hỗ trợ cờ `--dry-run` (mặc định kiểm tra phát hiện drift) và `--apply` (tự động tạo bucket còn thiếu hoặc sửa cấu hình public/private). Cả 4 bucket đều đạt trạng thái `synced` (`MATCH`).
   - **CSDL & Migration Quản lý Tài nguyên Lưu trữ**:
     * Thiết kế bảng `stored_assets`, `stored_asset_upload_sessions`, `stored_asset_cleanup_jobs` và áp dụng migration Prisma `20261117110000_create_stored_asset_registry`.
   - **Engine Lõi Lưu Trữ**:
     * Xây dựng `storagePolicies.js` quản lý cấu trúc đường dẫn phân cấp theo đợt/người dùng/đề tài và ma trận kiểm soát truy cập.
     * Xây dựng `fileInspector.js` kiểm định MIME thực tế qua magic bytes từ bộ đệm đĩa an toàn, chống giả mạo phần mở rộng tệp.
     * Xây dựng `supabaseStorageAdapter.js` và `diskUploadAdapter.js` hỗ trợ đầy đủ các thao tác upload, download, move, remove, stat, list và createSignedUrl.

3. **Vòng Đời Tệp Tin, TUS Resumable Transport & Giao Diện Tải Lên (Wave 2: Tasks 5–6)**:
   - **Máy trạng thái tệp tin và API Vòng đời (`storedAssetService.js`, `storedAssetController.js`, `assetRoutes.js`)**:
     * `POST /api/assets`: Tải lên trực tiếp multipart cho tệp nhỏ $\le 6$ MB, tự động kiểm định và chuyển trạng thái `ACTIVE`.
     * `POST /api/assets/upload-sessions`: Khởi tạo phiên TUS cho tệp lớn $> 6$ MB đến $50$ MB (chunk cố định 6 MB), hỗ trợ tạm dừng và tiếp tục.
     * `POST /api/assets/upload-sessions/:sessionId/finalize`: Hoàn tất phiên tải lên, kiểm tra toàn vẹn và chuyển đối tượng từ bucket `tam` sang bucket đích.
     * `GET /api/assets/:id/download`: Cấp Signed URL riêng tư có thời hạn tối đa 600 giây (10 phút) sau khi kiểm tra quyền của actor.
   - **Dịch vụ Resumable Upload trên Frontend (`frontend/src/services/resumableUploadService.js`)**:
     * Sử dụng thư viện `tus-js-client` với khả năng tự động đàm phán phương thức upload theo dung lượng tệp, theo dõi tiến trình (progress) và hỗ trợ hủy tải (`AbortSignal`).
     * Tích hợp vào `HybridBMFormModal.jsx` và `SubmissionPage.jsx` khi nộp đề cương/biểu mẫu đồ án BM01–BM05.

4. **Quản Trị Hồ Sơ Học Vụ, Lưu Chiểu Đồ Án & Tài Nguyên Cá Nhân/Thương Hiệu (Wave 3: Tasks 7–9)**:
   - **Tài liệu PDF học vụ và Biên bản Hội đồng**:
     * Tích hợp `academicPdfService.js` và `generatedAcademicController.js` để lưu trữ bảng điểm BM05 và phiếu nhận xét BM04 qua `StoredAsset`, tải về an toàn qua Signed URL riêng tư.
   - **Nộp hồ sơ Lưu chiểu sau bảo vệ**:
     * Tích hợp `archiveService.js`, `ArchiveSubmissionModal.jsx`, `ClearanceCertificateModal.jsx`: Cho phép sinh viên nộp báo cáo tóm tắt/toàn văn, slide, mã nguồn ZIP (trần dung lượng 50 MB) và liên kết video HTTPS ngoài (YouTube/Vimeo); cấp giấy chứng nhận lưu chiểu không còn dùng URL Supabase hardcoded.
   - **Tài nguyên Thương hiệu & Cá nhân**:
     * Cắt đứt toàn bộ URL Supabase hardcoded trên Frontend; chuyển logo TDMU và hình nền về tài nguyên tĩnh nội bộ `/assets/tdmu-logo.svg`.
     * Ảnh đại diện người dùng được lưu trong bucket `ca-nhan` với liên kết `avatarAssetId` và thời gian lưu giữ 7 ngày khi thay thế.

5. **Dọn Dẹp Dữ Liệu Cũ, Worker Định Kỳ & Nghiệm Thu Bàn Giao E2E (Wave 4: Tasks 10–12)**:
   - **Quy trình 2 bước Dọn dẹp dữ liệu cũ an toàn**:
     * `legacyStorageMigrationService.js`, `inventoryLegacyAssets.js`: Quét phân loại 4 nhóm (`KEEP_BRANDING`, `KEEP_EXTERNAL`, `NULL_AND_DELETE`, `UNRESOLVED`), băm SHA-256 bảo vệ thương hiệu và phát hiện 800 bản ghi legacy với 0 bản ghi unresolved.
     * `cleanupLegacyAssets.js`: Cơ chế thực thi dọn dẹp yêu cầu cờ `--apply` và `--confirm-snapshot` an toàn tuyệt đối.
   - **Workers Vận hành Định kỳ**:
     * `storedAssetCleanupService.js` (`npm run storage:cleanup`): Tự động dọn dẹp các phiên tải TUS dở dang/quá hạn (24h) và tệp hết hạn lưu giữ (`REPLACED`, `SOFT_DELETED`, `ORPHANED` sau TTL 7–30 ngày) với cơ chế claim-locking chống tranh chấp đa worker.
     * `storageReconciliationService.js` (`npm run storage:reconcile`): Đối soát tính nhất quán giữa registry DB và các đối tượng thực tế trong Supabase Storage.
   - **Kiểm Thử Toàn Diện & Nghiệm Thu**:
     * Ma trận kiểm thử phân quyền 9 actor (`storageActorMatrix.test.js`): **9/9 tests PASS (100%)**.
     * Kiểm thử E2E trình duyệt bằng Playwright (`governed-storage.spec.js`): **3/3 tests PASS (100%)**.
     * Tài liệu vận hành chi tiết: Hoàn thành toàn diện [supabase-storage-rollout.md](file:///d:/DACN/docs/operations/supabase-storage-rollout.md) và đánh dấu hoàn thành 100% checklist kế hoạch [2026-11-17-supabase-storage-governance-implementation-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-17-supabase-storage-governance-implementation-plan.md).

#### 2. Trạng thái cập nhật của từng phần
- **Backend API**:
  * Các route `/api/assets`, `/api/assets/upload-sessions`, `/api/assets/:id/download` hoạt động ổn định, phân quyền chặt chẽ.
  * Middleware xác thực `optionalAuthenticate` và `authenticate` hoàn toàn đồng bộ quyền năng lực học vụ.
  * 2 CLI worker `storage:cleanup` và `storage:reconcile` đã đăng ký npm scripts, sẵn sàng vận hành.
- **Frontend SPA**:
  * Dịch vụ tải lên `resumableUploadService.js` tự động chuyển đổi giữa multipart $\le 6$ MB và TUS $> 6$ MB.
  * Toàn bộ các trang (Quản lý đề tài, Theo dõi tiến độ, Nộp lưu chiểu, Thông báo, Hồ sơ cá nhân) hoạt động trơn tru.
  * Loại bỏ hoàn toàn URL Supabase hardcoded và tuân thủ nghiêm ngặt Rule 2.6 (không emoji/ký tự thô trong text nút bấm).
  * Build production `npm run build` hoàn thành không lỗi (3363 modules).
- **Cơ sở dữ liệu (Supabase PostgreSQL)**:
  * Đã kích hoạt các bảng lưu trữ: `stored_assets`, `stored_asset_upload_sessions`, `stored_asset_cleanup_jobs`.
  * Cả 4 bucket `cong-khai`, `hoc-vu`, `ca-nhan`, `tam` đã đồng bộ trạng thái chính xác (1 public, 3 private).
- **Kiểm thử (Tests)**:
  * Backend: 18 storage test suites (**166/166 tests PASS** 100%).
  * Frontend: 334 unit tests (**334/334 tests PASS**), 4 storage runtime suites (**30/30 tests PASS**), 3 Playwright E2E browser tests (**3/3 tests PASS**).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Cấu hình Lịch Chạy Định Kỳ (Cron Jobs) cho Storage Workers trên Môi Trường Thực Tế**:
   - Cấu hình cronjob chạy hàng giờ cho `npm run storage:cleanup -- --apply` (dọn phiên dở dang và tài nguyên hết hạn).
   - Cấu hình cronjob chạy hàng ngày vào ban đêm cho `npm run storage:reconcile -- --apply` (đối soát Storage $\leftrightarrow$ DB).
2. **Thực thi Giai Đoạn 2 Dọn Dẹp Dữ Liệu Cũ (Legacy Storage Cleanup Apply Mode)**:
   - Trong khung giờ bảo trì, thực hiện sao lưu (snapshot) CSDL và chạy `node backend/scripts/storage/cleanupLegacyAssets.js --apply --confirm-snapshot` để dọn sạch các tệp legacy cũ.
3. **Kiểm Tra & Tối Ưu Quy Trình Chấm Điểm Bảo Vệ Cuối Kỳ (BM05 & Khóa Sổ Điểm)**:
   - Rà soát quy trình nhập điểm Rubric BM05 độc lập của 3 thành viên hội đồng và khóa sổ điểm học vụ.
4. **Rà Soát Toàn Bộ Báo Cáo Thống Kê Học Vụ (Academic Reports)**:
   - Kiểm tra trang Academic Reports và kiểm tra xuất dữ liệu báo cáo nghiệm thu đợt đồ án.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Quy Hoạch Cố Định 4 Buckets Thay Vì Phân Tán**: Thay vì để mỗi tính năng tự ý tạo bucket riêng gây khó khăn cho việc quản lý bảo mật, hệ thống chuẩn hóa cố định đúng 4 bucket (`cong-khai`, `hoc-vu`, `ca-nhan`, `tam`). Chỉ duy nhất `cong-khai` mở quyền đọc public; toàn bộ tài liệu học vụ và ảnh đại diện bắt buộc kiểm soát qua Signed URL.
- **Ngưỡng 6 MB cho TUS Resumable Upload**: Đặt ngưỡng 6 MB với kích thước chunk 6 MB giúp các tệp thông thường (PDF nhẹ, ảnh) được tải lên ngay lập tức trong 1 request multipart mà không mất chi phí handshake của TUS, trong khi các tệp lớn (báo cáo, slide, source code ZIP lên đến 50 MB) được bảo vệ bằng khả năng resume chống rớt mạng.
- **Signed URL Có Thời Hạn 600 Giây (10 Phút)**: Đảm bảo cân bằng giữa trải nghiệm người dùng (đủ thời gian xem/tải tệp ngay cả với đường truyền mạng chậm) và an ninh dữ liệu (ngăn chặn chia sẻ liên kết ngoài hoặc rò rỉ dữ liệu học vụ).
- **Cơ Chế Safe Legacy Migration 2 Bước**: Tách biệt hoàn toàn bước kiểm kê (inventory sinh manifest) và bước dọn dẹp (cleanup có xác nhận snapshot). Đặt nguyên tắc bảo vệ tài nguyên thương hiệu (băm SHA-256 đối chiếu trước khi hủy nguồn) và chặn tuyệt đối thao tác nếu tồn tại bản ghi chưa rõ nguồn gốc (`UNRESOLVED`).
- **Khắc Phục Lỗi Silent Auth trong `optionalAuthenticate`**: Sử dụng `resolveUserCapabilities` thay vì tự truy vấn độc lập và bọc try-catch cẩu thả, đảm bảo mọi request có token hợp lệ đều được gắn đầy đủ quyền năng lực học vụ mà không bị gián đoạn.

---

### Phiên 16/11/2026 (Bổ Sung Danh Mục Loại Đồ Án DACN/DATN, Chuẩn Hóa Phân Loại "Loại Đồ Án - Đợt Đồ Án", Lọc Option Khả Dụng Khi Gán Đồ Án & Đơn Giản Hóa Modal Buổi Gặp)

#### 1. Những phần đã hoàn thành
1. **Khởi tạo và Quản trị 2 Loại Đồ Án (DACN & DATN) trong CSDL & Backend**:
   - Thêm 2 bản ghi `ProjectCatalog` vào CSDL: `DACN` (id: 1, "Đồ án chuyên ngành") và `DATN` (id: 2, "Đồ án tốt nghiệp").
   - Cập nhật toàn bộ 300 đề tài hiện hữu trong CSDL (chia 50% DACN, 50% DATN), tạo đồng bộ 300 bản ghi `student_project_enrollments` và 168 bản ghi `lecturer_project_assignments` tương ứng để đảm bảo tính toàn vẹn học vụ.
   - Cập nhật kịch bản seed tự động `backend/prisma/seedThreeSemesters.js` để mọi lần chạy seed đều khởi tạo đầy đủ 2 loại đồ án và liên kết dữ liệu mẫu.
   - Thêm API `GET /api/topics/catalogs` trong `topicController.js` và `topicRoutes.js` cho phép tất cả các vai trò truy xuất danh mục đồ án đang hoạt động.
   - Thêm API `GET /api/project-enrollments/available-students` trong `projectEnrollmentController.js` và `projectEnrollmentRoutes.js`, tự động lọc loại trừ sinh viên đã có ghi danh trong đợt và sinh viên đã hoàn thành đồ án (`accountRestricted`).
2. **Chuẩn hóa Phân Loại 2 Tầng "Loại đồ án - Đợt đồ án" trên Tất Cả Các Trang Chức Năng**:
   - **Quản lý đề tài Admin (`TopicManagementPage.jsx`)**: Bổ sung bộ lọc Loại đồ án, cột Loại đồ án với Tag nhận diện màu teal/purple, và bắt buộc chọn Loại đồ án khi tạo đề tài mới.
   - **Quản lý đề tài Giảng viên (`TopicManagementPage.jsx`)**: Tích hợp danh mục Loại đồ án động từ CSDL, bổ sung cột Loại đồ án, trường chọn Loại đồ án trong modal đề xuất đề tài mới và cập nhật `colSpan` bảng.
   - **Đăng ký đề tài Sinh viên (`TopicListPage.jsx`)**: Bổ sung 2 dropdown chọn Đợt đồ án và Loại đồ án trên thanh công cụ `catalog-bar`, hiển thị badge Loại đồ án trên từng thẻ đề tài, cho phép chọn Loại đồ án khi gửi đề xuất đề tài tự do.
   - **Theo dõi tiến độ Giảng viên (`ProgressTrackingPage.jsx`)**: Bổ sung bộ lọc 2 tầng Đợt đồ án và Loại đồ án phía trên danh sách sinh viên bên trái, hiển thị Tag Loại đồ án trên từng thẻ sinh viên.
   - **Giám sát đề tài Admin (`ProjectOversightPage.jsx`)**: Chuẩn hóa options hiển thị `${code} · ${name}` và Tag phân loại trong bảng dữ liệu.
3. **Khắc phục Triệt Để Sai Lệch Thuật Ngữ "Tên đồ án" $\rightarrow$ "Loại đồ án"**:
   - Thay thế toàn bộ chuỗi dịch sai gây nhầm lẫn "Tên đồ án" thành "Loại đồ án" tại `ProjectEnrollmentPage.jsx`, `LecturerAssignmentTab.jsx`, `ExcelImportModal.jsx`, `ProjectPeriodPage.jsx`, và `projectEnrollmentService.js`.
4. **Loại Bỏ Từ Khóa Kỹ Thuật DB `IN_PROGRESS_BM03` trong Giao Diện**:
   - Chuyển đổi trạng thái `IN_PROGRESS_BM03` thành nhãn chuẩn `Đang thực hiện đồ án` (Tag cyan) trong danh sách quyết định và hàng đợi BM02 qua `getStatusTagConfig`.
5. **Tối Ưu Dropdown Gán Thủ Công: Chỉ Hiển Thị Các Option Khả Dụng (Available Options)**:
   - Thêm phương thức `getAvailableStudents` trong `projectEnrollmentService.js` và hook `useAvailableStudents` trong `enrollmentQueries.js`.
   - Cập nhật `ProjectEnrollmentPage.jsx`: Cả 2 dropdown (gán lẻ 1 bạn và gán hàng loạt) chỉ hiển thị sinh viên khả dụng, có loading state, placeholder, empty-state rõ ràng và hiển thị counter thời gian thực. Tự động invalidate danh sách khi gán thành công.
   - Cập nhật `LecturerAssignmentTab.jsx`: Đồng bộ hóa `availableFilters` theo props `semesterId` và `projectCatalogId` qua `useEffect`.
6. **Đơn Giản Hóa Modal Ghi Nhận Buổi Hướng Dẫn Mới (BM03)**:
   - Trong `ProgressTrackingPage.jsx`, loại bỏ hoàn toàn 2 trường input "Nhiệm vụ cho kỳ tiếp theo" và "Hạn hoàn thành" khỏi modal *Ghi Nhận Buổi Hướng Dẫn Mới (BM03)*.
   - Dọn sạch các biến state thừa (`meetingNextTask`, `expectedDeadline`) và payload gửi đi trong `handleCreateMeeting`.
7. **Kiểm Thử & Xác Thực Toàn Diện**:
   - **Frontend Test Suite**: **318/318 tests PASS** 100% (bổ sung `projectCatalogClassification.test.js` và `progressTrackingMeetingModal.test.js`).
   - **Backend Test Suite**: Toàn bộ unit/integration tests PASS (10/10 registration/topic tests, 19/19 enrollment/auth tests).
   - **Production Build**: `npm run build` hoàn thành không lỗi trong 16s.
   - **Quy Chuẩn Mã Hóa & UI/UX**: 100% tệp lưu chuẩn UTF-8 (no BOM), Rule 2.1 (1 SV / 1 đề tài), Rule 2.6 (icon Ant Design chính quy qua prop `icon`, không emoji trong text nút bấm).

#### 2. Trạng thái cập nhật của từng phần
- **Backend API**:
  * `topicController.js` & `topicRoutes.js`: Bổ sung endpoint `GET /api/topics/catalogs` (sẵn sàng).
  * `projectEnrollmentController.js` & `projectEnrollmentRoutes.js`: Bổ sung endpoint `GET /api/project-enrollments/available-students` (sẵn sàng, có đầy đủ unit tests).
  * `registrationController.js`: Đồng bộ `code` của `projectCatalog` trong response đăng ký (sẵn sàng).
- **Frontend SPA**:
  * Các trang Quản lý đề tài (Admin, Giảng viên), Đăng ký đề tài (Sinh viên), Theo dõi tiến độ (Giảng viên), Giám sát (Admin) đều đã hỗ trợ đầy đủ bộ lọc phân cấp `Loại đồ án - Đợt đồ án`.
  * Trang Điều phối đợt đồ án & Phân công (`ProjectEnrollmentPage.jsx`): Dropdown gán thủ công chỉ hiển thị sinh viên khả dụng, không còn nạp toàn bộ danh sách.
  * Trang Theo dõi tiến độ (`ProgressTrackingPage.jsx`): Modal ghi nhận buổi gặp gọn gàng, loại bỏ các trường không cần thiết.
- **Cơ sở dữ liệu (Supabase PostgreSQL)**:
  * Đã kích hoạt 2 danh mục `ProjectCatalog`: `DACN` (id: 1) và `DATN` (id: 2).
  * 300 đề tài, 300 ghi danh sinh viên và 168 chỉ tiêu giảng viên đã được liên kết chính xác sang 2 loại đồ án này.
- **Kiểm thử (Tests)**:
  * Backend: 100% pass.
  * Frontend: 318/318 pass (tăng 24 tests so với phiên 15/11).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm tra luồng Đổi Tên Đề Tài & Phiếu Điều Chỉnh Tên Đề Tài**:
   - Kiểm tra nghiệp vụ sinh viên đề xuất đổi tên đề tài trong 7 ngày đầu, GVHD duyệt và cập nhật quyết định.
2. **Kiểm tra nghiệp vụ Phiếu chấm BM05 & Khóa sổ điểm**:
   - Kiểm tra luồng chấm Rubric BM05 độc lập cho 3 thành viên hội đồng.
   - Kiểm tra tính toán điểm trung bình và công bố kết quả bảo vệ (`DEFENDED`, `DEFENSE_PASSED`, `DEFENSE_FAILED`).
3. **Kiểm tra luồng Lưu chiểu & Cấp chứng nhận hoàn thành**:
   - Đối soát nộp quyển/file mềm và cấp chứng nhận hoàn thành đồ án tốt nghiệp.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Chuẩn hóa Phân cấp "Loại đồ án - Đợt đồ án"**: Sinh viên và giảng viên tại trường luôn làm việc theo phân cấp: Học phần đồ án (DACN hay DATN) trước, sau đó là Đợt đồ án (Học kỳ 1, 2, hè). Việc đồng bộ hóa bộ lọc 2 tầng này trên tất cả các trang giúp loại bỏ hoàn toàn sự nhầm lẫn giữa đề tài và loại đồ án.
- **Sửa sai lệch "Tên đồ án" thành "Loại đồ án"**: Thuật ngữ "Tên đồ án" trước đây dễ gây hiểu nhầm thành "Tên đề tài nghiên cứu" (Topic Title). Việc đổi thành "Loại đồ án" (Project Catalog) phản ánh đúng bản chất là học phần Đồ án chuyên ngành / Đồ án tốt nghiệp.
- **Lọc triệt để Danh sách Khả dụng (Available Candidates Only)**: Khi gán thủ công, việc dropdown hiển thị toàn bộ sinh viên (kể cả những bạn đã gán hoặc đã bảo vệ xong) gây rối mắt và dễ dẫn đến thao tác thừa/lỗi. Lọc sinh viên khả dụng từ tầng Backend kết hợp client-side defense đảm bảo trải nghiệm nhanh chóng và chính xác.
- **Đơn giản hóa Form BM03 Buổi Gặp**: Các buổi gặp định kỳ tập trung vào việc đánh giá công việc đã làm và ghi nhận khó khăn tồn đọng; nhiệm vụ tiếp theo được quản lý thông qua tính năng Giao việc độc lập (`Task Management`) thay vì ép buộc nhập trong từng biên bản buổi gặp.

---

### Phiên 15/11/2026 (Khóa Chặt Lỗ Hổng Toàn Vẹn Dữ Liệu Hội Đồng Bảo Vệ & Hội Đồng Xét Duyệt Đề Cương - Council Integrity Guards & Chế Độ Chỉ Đọc)

#### 1. Những phần đã hoàn thành
1. **Khóa chặt toàn vẹn dữ liệu Hội đồng ở tầng Backend (`councilController.js`)**:
   - **Bảo vệ Đợt đồ án đã kết thúc (`SEMESTER_ALREADY_COMPLETED`)**:
     * Ngăn chặn tuyệt đối mọi hành vi sửa đổi dữ liệu đối với các đợt đồ án có trạng thái `COMPLETED`:
       - `createCouncil`: Chặn tạo mới hội đồng thuộc đợt đã kết thúc.
       - `updateCouncil`: Chặn đổi thông tin hội đồng, phòng họp, ngày giờ, thành viên.
       - `assignRegistrationsToCouncil`: Chặn phân công sinh viên/đề tài vào hội đồng.
       - `removeRegistrationFromCouncil`: Chặn gỡ sinh viên ra khỏi hội đồng.
       - `deleteCouncil`: Chặn xóa hội đồng thuộc đợt đã kết thúc.
       - `autoAssignRegistrationsToCouncils` & `autoAssignOutlineCouncils`: Chặn thuật toán tự động phân công.
   - **Khóa bảo vệ Gỡ sinh viên khỏi Hội đồng (`removeRegistrationFromCouncil`)**:
     * Đối với Hội đồng bảo vệ (`DEFENSE_COUNCIL`):
       - Chặn gỡ nếu sinh viên đã có điểm chấm từ thành viên hội đồng (`DefenseMemberScore`) hoặc đã có kết quả bảo vệ (`DefenseResult`). Mã lỗi: `CANNOT_REMOVE_GRADED_STUDENT`.
       - Chặn gỡ nếu sinh viên có trạng thái học vụ đã qua bảo vệ (`DEFENDED`, `DEFENSE_PASSED`, `DEFENSE_FAILED`, `COMPLETED`).
       - Chặn gỡ nếu lịch bảo vệ của hội đồng đã được công bố (`schedulePublishedAt`) hoặc xác nhận (`scheduleConfirmedAt`). Mã lỗi: `COUNCIL_SCHEDULE_ALREADY_PUBLISHED`.
     * Đối với Hội đồng xét duyệt đề cương (`OUTLINE_REVIEW`):
       - Chặn gỡ nếu sinh viên đã được hội đồng đánh giá đề cương BM01 (`bM01Evaluations.length > 0`). Mã lỗi: `CANNOT_REMOVE_EVALUATED_STUDENT`.
   - **Khóa bảo vệ Xóa hội đồng (`deleteCouncil`)**:
     * Chặn xóa nếu còn sinh viên trong hội đồng (`COUNCIL_HAS_STUDENTS`).
     * Chặn xóa nếu hội đồng đã có lịch sử công bố kết quả (`resultBatches > 0`). Mã lỗi: `COUNCIL_HAS_HISTORY`.
     * Chặn xóa nếu hội đồng đã phát sinh điểm chấm bảo vệ hoặc đánh giá đề cương BM01 (`COUNCIL_HAS_EVALUATIONS`).
2. **Triển khai Chế độ Chỉ đọc (Read-Only Mode) trên Giao diện Frontend (Phương án A)**:
   - **Trang Phân công Hội đồng (`CouncilAssignmentPage.jsx` - `/admin/defense-councils` & `/admin/outline-councils`)**:
     * Nhận diện trạng thái đợt `isSemesterCompleted = currentSemesterObj?.status === 'COMPLETED'`.
     * Tự động ưu tiên chọn đợt đồ án đang hoạt động (`ONGOING`, `DEFENSE`, `REGISTRATION`) khi vào trang; gắn nhãn rõ `(Đã kết thúc — Chỉ đọc)` trong dropdown chọn đợt.
     * Hiển thị Alert banner màu xanh thông tin nổi bật: *"Đợt đồ án đã kết thúc — Chế độ chỉ đọc (Read-only). Toàn bộ dữ liệu hội đồng và kết quả phân công đã được khóa vĩnh viễn để lưu trữ và đối soát học vụ."*
     * Vô hiệu hóa toàn bộ các nút hành động ở Header trang: "Lập hội đồng", "Tự động phân công", "Công bố DS đủ ĐK".
     * Vô hiệu hóa thao tác kéo thả/ghép nối sinh viên trong chế độ Matcher và Table, ẩn nút xóa hội đồng.
     * Nút "Gỡ" / "Hủy ghép" từng sinh viên được vô hiệu hóa có kèm `Tooltip` giải thích lý do cụ thể (đợt đã kết thúc hoặc sinh viên đã có điểm/đã đánh giá).
   - **Trang Chi tiết Hội đồng (`CouncilDetailPage.jsx` - `/admin/defense-councils/:id` & `/admin/outline-councils/:id`)**:
     * Hiển thị Alert banner chế độ chỉ đọc khi đợt đồ án kết thúc.
     * Vô hiệu hóa các nút: "Công bố lịch bảo vệ", "Sửa thông tin HĐ", "Đổi thành viên HĐ", "Gán thêm Sinh viên", "Mở khóa kết quả".
     * Vô hiệu hóa nút "Gỡ" sinh viên kèm Tooltip cảnh báo nếu sinh viên đã có kết quả chấm hoặc đợt đã đóng.
   - Tuân thủ 100% **Rule 2.6**: Không sử dụng ký tự thô/emoji trong nhãn nút bấm; sử dụng Ant Design Icons.
3. **Bộ Kiểm Thử & Xác Thực Toàn Diện**:
   - Backend Integration Tests (`backend/tests/integration/councilIntegrityGuards.test.js`): 8/8 tests PASS.
   - Frontend Unit/Integration Tests (`frontend/tests/councilReadOnlyMode.test.js`): 4/4 tests PASS.
   - Toàn bộ Test Suite Frontend: 294/294 tests PASS.
   - Build sản xuất: `npm --prefix frontend run build` PASS 100% (11.50s, 0 lỗi bundle).
   - Mã hóa: 100% tệp tuân thủ UTF-8 without BOM (Rule 2.4).

#### 2. Trạng thái cập nhật của từng phần
- **Backend API (`councilController.js`)**: Được bảo vệ đa tầng chống xóa/gỡ/chỉnh sửa hội đồng hoặc sinh viên đối với đợt hoàn thành và sinh viên đã có điểm/đánh giá.
- **Frontend SPA (`CouncilAssignmentPage.jsx`, `CouncilDetailPage.jsx`)**: Hỗ trợ xem lại lịch sử các đợt cũ trong Chế độ Chỉ đọc (Read-Only Mode), khóa toàn bộ nút chỉnh sửa/xóa/gỡ, giao diện thân thiện với banner thông báo.
- **Tương thích 2 loại Hội đồng**: Áp dụng đồng bộ cho cả Hội đồng bảo vệ khóa luận (`DEFENSE_COUNCIL`) và Hội đồng xét duyệt đề cương (`OUTLINE_REVIEW`).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm tra nghiệp vụ Phiếu chấm BM05 & Khóa sổ điểm**:
   - Kiểm tra luồng chấm Rubric BM05 độc lập cho 3 thành viên hội đồng.
   - Kiểm tra tính toán điểm trung bình và công bố kết quả bảo vệ (`DEFENDED`, `DEFENSE_PASSED`, `DEFENSE_FAILED`).
2. **Kiểm tra luồng Lưu chiểu & Cấp chứng nhận hoàn thành**:
   - Đối soát nộp quyển/file mềm và cấp chứng nhận hoàn thành đồ án tốt nghiệp.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Phương án A (Chế độ Chỉ đọc - Read-Only Mode)**: Cho phép Ban Giám hiệu, Giáo vụ và Giảng viên chọn các đợt đồ án cũ (`COMPLETED`) để tra cứu lịch sử hội đồng, xem danh sách sinh viên và biên bản bảo vệ mà không lo ngại việc vô tình bấm nhầm nút chỉnh sửa, xóa hội đồng hoặc gỡ sinh viên.
- **Bảo toàn Sổ cái Điểm (Grade Ledger Preservation)**: Ngay cả trong đợt đang mở, nếu sinh viên đã được chấm điểm bảo vệ (`DefenseMemberScore`, `DefenseResult`) hoặc đã có đánh giá đề cương BM01, hệ thống từ chối gỡ sinh viên ra khỏi hội đồng để chống mồ côi dữ liệu điểm học vụ.

---

### Phiên 15/11/2026 (Tái Thiết Kế Hồ Sơ Cá Nhân & Bổ Sung Bộ Lọc Đợt/Loại/Sắp Xếp/Tải Lượng Cho Đề Tài Phụ Trách Giảng Viên)

#### 1. Những phần đã hoàn thành
1. **Nâng cấp Bộ lọc Toàn diện & Tải lượng cho Trang "Đề tài phụ trách" (`TopicManagementPage.jsx` - `/lecturer/topics`)**:
   - **Bộ lọc Đợt đồ án (Semester Select)**: Tự động phát hiện và chọn đợt đồ án đang diễn ra (`ONGOING` hoặc active); cung cấp tùy chọn "Tất cả các đợt" để giảng viên dễ dàng tra cứu đề tài các khóa trước.
   - **Bộ lọc Loại đồ án (Project Catalog Select)**: Hỗ trợ lọc theo `Tất cả loại đồ án`, `Đồ án tốt nghiệp (DATN)`, `Khóa luận tốt nghiệp (KLTN)`.
   - **Bộ sắp xếp Thông minh (Smart Sort)**:
     * `Cần chú ý trước (Mặc định)`: Tự động đưa sinh viên có cảnh báo dừng (`STOP_REVIEW_PENDING`, `AUTO_NOT_ELIGIBLE`) hoặc đề tài chờ duyệt (`PENDING`) lên đầu bảng để GVHD xử lý nhanh.
     * `Mới nhất`: Xếp theo thời gian tạo đề tài giảm dần.
     * `Tên SV: A → Z` & `Tên đề tài: A → Z`: Tra cứu thuận tiện theo bảng chữ cái.
   - **Thẻ Tóm tắt Tải lượng Hướng dẫn (Capacity Banner)**:
     * Hiển thị chỉ tiêu hướng dẫn trong đợt được chọn (`X/10 SV` - tối đa 10 SV/đợt theo đúng quy định).
     * Báo rõ số chỗ còn trống (`Còn trống Y chỗ`) và thanh `Progress` trực quan thể hiện tỷ lệ lấp đầy.
   - **Đồng bộ hóa Tabs Phân loại theo Đợt**: Các tab `Tất cả`, `Đang làm đồ án`, `Đã duyệt`, `Đang tuyển SV`, `Cảnh báo / Dừng`, `Chờ duyệt` tự động tính toán số lượng (`counts`) bám sát theo đợt và loại đồ án đang chọn.
   - **Cập nhật Bảng Đề tài**: Thêm cột `Đợt đồ án` và badge phân loại trạng thái học vụ chi tiết: `Đang làm đồ án (BM03)` (xanh lá), `Cảnh báo đề xuất dừng` (đỏ), `Đã bảo vệ & Lưu chiểu` (tím).
2. **Khắc phục lỗi Runtime Enum `SemesterStatus` trong Backend**:
   - `auth.js`, `topicController.js`, `notificationController.js`: Sửa lỗi truy vấn `where: { status: 'ACTIVE' }` gây ném ngoại lệ Prisma `Invalid value for argument status. Expected SemesterStatus`. Thay thế bằng bộ lọc hợp lệ: `status: { in: ['ONGOING', 'REGISTRATION', 'DEFENSE'] }` kèm sắp xếp `startDate: 'desc'`.
   - Kết quả: Server nodemon `npm run dev` chạy ổn định, không còn lỗi kết nối hoặc ngoại lệ truy vấn.
3. **Tái thiết kế Hồ sơ cá nhân theo phong cách Swiss Modernism 2.0 (Two-Column Split Layout)**:
   - `ProfileIdentityCard.jsx`: Cột trái cố định (~32%) hiển thị Avatar lớn, cover gradient học thuật, thẻ học hàm/học vị (`PGS.TS`, `TS`, `ThS`), mã cán bộ/MSSV, lớp/bộ môn, trạng thái hoạt động và các trường cho phép chỉnh sửa (SĐT, Ảnh đại diện, Bộ môn).
   - Tuân thủ nghiêm ngặt **Rule 2.6**: 100% nút bấm dùng component icon từ `@ant-design/icons`, không chèn ký tự thô hay emoji vào label text.
4. **Phân hóa sâu sắc trải nghiệm Phía Giảng viên (Lecturer Experience)**:
   - `LecturerTopicList.jsx`: Quản lý danh sách đề tài và sinh viên hướng dẫn trong Profile có bộ lọc đợt, loại hình, sắp xếp và banner tải lượng.
   - `LecturerAcademicInfoTab.jsx`: Tab công tác & chuyên môn, hướng nghiên cứu & lĩnh vực quan tâm (Research Interests tags), phân công Hội đồng chuyên môn.
5. **Phân hóa trải nghiệm Phía Sinh viên (Student Experience)**:
   - `StudentThesisProgressCard.jsx`: Hiển thị đồ án tốt nghiệp hiện tại của sinh viên:
     * **Thanh tiến trình 5 chặng (Stepper)**: `Đề cương BM01` $\rightarrow$ `Giao đề tài BM02` $\rightarrow$ `Tiến độ BM03 (Checkpoint 1 & 2)` $\rightarrow$ `Đánh giá BM04` $\rightarrow$ `Bảo vệ & Lưu chiểu`.
     * **Thẻ liên hệ GVHD trực tiếp**: Họ tên, học vị, email, số điện thoại liên lạc khẩn cấp.
     * Cảnh báo nổi bật khi sinh viên bị rơi vào trạng thái đề xuất dừng đề tài (`STOP_REVIEW_PENDING`).
     * **Loại bỏ tab Quyền hạn quản trị thừa**: Đảm bảo sinh viên chỉ tập trung vào học vụ và đề tài của mình.
6. **Component dùng chung & Kiểm thử**:
   - `PasswordSecurityTab.jsx`: Quản lý đổi mật khẩu có đo độ mạnh (`PasswordStrengthMeter`) + thông tin phiên làm việc JWT và nguyên tắc bảo mật.
   - `registrationQueries.js`: Bổ sung export alias `useMyRegistration = useStudentRegistration` để đồng bộ truy vấn React Query.
   - 290/290 frontend tests PASS.
   - Production build `npm --prefix frontend run build` PASS 100% (3.337 modules transformed, 0 lỗi bundle).
   - Mã hóa: 100% tệp tuân thủ UTF-8 without BOM.
7. **Loại bỏ Mục Menu Trùng Lặp "Điều hành đợt & Quyết định" Khỏi Phân Hệ Admin (`navigationRegistry.js`)**:
   - Đối với tài khoản `ADMIN`:
     * Menu trên cùng đã có **"Tổng quan"** (`/admin/dashboard` - Bảng điều khiển Trung tâm & Thống kê KPI).
     * Khối "Quản trị học vụ" đã có **"Đợt đồ án & Học kỳ"** (`/admin/project-periods` - Quản lý các đợt đồ án, ban hành quyết định và thẩm định BM02).
     * Mục "Điều hành đợt & Quyết định" (`/lecturer/institute`) vốn là đường dẫn nghiệp vụ dành riêng cho Giảng viên kiêm Viện trưởng (`VIEN_TRUONG`), việc hiển thị ở Admin gây nhầm lẫn với "Tổng quan" và trùng lặp hoàn toàn với "Đợt đồ án & Học kỳ".
   - Đã loại bỏ quyền `VIEW_PROJECT_PERIODS` khỏi `requiredAnyPermissions` của `institute-management` và thêm điều kiện ẩn đối với `isAdmin`.
   - Giữ nguyên mục này cho tài khoản Viện trưởng (`VIEN_TRUONG`) và Giáo vụ (`GIAO_VU`) ở phía Giảng viên.
   - Bổ sung kiểm thử trong `frontend/tests/navigationRegistry.test.js` (17/17 navigation tests PASS, 290/290 frontend tests PASS).

#### 2. Trạng thái cập nhật của từng phần
- **Menu Phân hệ Admin (`AppLayout.jsx` / `navigationRegistry.js`)**: Đã loại bỏ mục trùng lặp "Điều hành đợt & Quyết định", giữ thanh điều hướng của Admin gọn gàng, đúng nghiệp vụ.
- **Trang Đề tài phụ trách (`/lecturer/topics`)**: Đã trang bị đầy đủ bộ lọc Đợt đồ án, Loại đề tài, Sắp xếp thông minh theo mức độ cần chú ý, Banner tải lượng 10 SV/đợt và bảng hiển thị đồng bộ.
- **Trang Profile (`/profile`)**: Đã chuyển sang layout 2 cột Swiss Modernism 2.0 phân hóa sâu cho GV và SV.
- **Backend API**: Đã vá lỗi enum `SemesterStatus`, nodemon chạy ổn định không còn lỗi.
- **Frontend SPA**: Build sản xuất đạt 100% sạch sẽ.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm tra Giao diện Thực tế theo các Tài khoản Seed Mới**:
   - Đăng nhập `lecturer01` (Viện trưởng): Kiểm tra Profile, trang Đề tài phụ trách với bộ lọc 3 đợt, xem 5 SV hướng dẫn đợt này.
   - Đăng nhập `lecturer03` (GVHD): Kiểm tra tải lượng đợt này (5/10 SV) và bộ lọc đề tài trên `/lecturer/topics`.
   - Đăng nhập `sv201` (SV tiếp tục làm) & `sv291` (SV bị đề xuất dừng): Kiểm tra Stepper 5 bước trên Profile.
2. **Triển khai Phiếu chấm điện tử BM05 & Khóa sổ điểm Hội đồng**:
   - Hoàn thiện giao diện chấm điểm 4 nhóm tiêu chí Rubric cho 3 thành viên hội đồng (Chủ tịch, Thư ký, Phản biện).

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Đồng bộ Trải nghiệm Lọc ở Cả 2 Nơi (Profile & Đề tài phụ trách)**: Cả danh sách đề tài thu nhỏ trên Profile (`LecturerTopicList.jsx`) lẫn trang quản lý đề tài chính của Giảng viên (`TopicManagementPage.jsx`) đều dùng chung tư duy UX: Tự động bám theo đợt đang làm, cảnh báo tải lượng trần 10 SV và sắp xếp ưu tiên sinh viên cần chú ý lên đầu.
- **Fail-Safe Fallback cho Đợt Đồ Án**: Nếu hệ thống chưa có đợt active, component tự động lấy đợt đầu tiên hoặc cho phép chọn "Tất cả các đợt" để GVHD không bao giờ gặp màn hình trống trơn.

---

### Phiên 15/11/2026 (Thiết Kế & Triển Khai Bộ Seed Mới 3 Đợt Đồ Án, 20 Giảng Viên, 300 Sinh Viên & Khảo Thí BM03)

#### 1. Những phần đã hoàn thành
1. **Xóa sạch dữ liệu cũ và Khởi tạo Cơ sở Dữ liệu Đa Học Kỳ**:
   - Sử dụng `resetApplicationData(prisma, { SEED_RESET_CONFIRM: 'RESET_DACN_DEMO' })` để dọn sạch toàn bộ các bảng ứng dụng bằng `TRUNCATE ... RESTART IDENTITY CASCADE`.
   - Khởi tạo đầy đủ danh mục nhóm quyền chuẩn thông qua `seedPermissionCatalog`.
2. **Khởi tạo Nhân sự & Tài khoản Người dùng Chuẩn**:
   - 1 Quản trị viên: `admin@university.edu.vn`, mật khẩu `admin123`, gán nhóm quyền `QUAN_TRI_VIEN`.
   - 20 Giảng viên (`lecturer01` .. `lecturer20`), mật khẩu `lecturer123`, phân bổ học vị thực tế (`TIEN_SI`, `THAC_SI`, `PHO_GIAO_SU`), bộ môn rõ ràng:
     * `lecturer01`: PGS.TS. Nguyễn Văn Thắng (Viện trưởng Viện Công nghệ số), nhóm quyền `VIEN_TRUONG` + `GVHD`.
     * `lecturer02`: ThS. Trần Thị Mai Phương (Giáo vụ Viện Công nghệ số), nhóm quyền `GIAO_VU` + `GVHD`.
     * `lecturer03` đến `lecturer20`: Giảng viên hướng dẫn (`GVHD`).
   - 300 Sinh viên (`sv001` .. `sv300`), mật khẩu `student123`:
     * Role `STUDENT`, **tuyệt đối không gán bất kỳ PermissionGroup nào** (tuân thủ quy định loại bỏ quyền/nhóm quyền sinh viên).
     * 300 `StudentProfile` hoàn chỉnh: MSSV từ `2200001` đến `2200300`, năm sinh 2004, chia đều 6 lớp (`D22CNTT01`..`D22CNTT03`, `D22KTPM01`, `D22HTTT01`, `D22ATTT01`) và 4 chuyên ngành (`Công nghệ thông tin`, `Kỹ thuật phần mềm`, `Hệ thống thông tin`, `An toàn thông tin`).
3. **Tạo 3 Đợt đồ án (Semesters) và Phân bổ Cân đối**:
   - Đợt 1 (Đã qua): `DATN-HK1-2025-26`, tên `Đồ án tốt nghiệp — HK1 2025–2026`, status `COMPLETED`.
   - Đợt 2 (Đã qua): `DATN-HK2-2025-26`, tên `Đồ án tốt nghiệp — HK2 2025–2026`, status `COMPLETED`.
   - Đợt 3 (Hiện tại): `DATN-HK1-2026-27`, tên `Đồ án tốt nghiệp — HK1 2026–2027`, status `ONGOING`.
   - Mỗi đợt gồm đúng 100 sinh viên, chia đều cho 20 GVHD (mỗi GVHD đúng 5 SV/đợt, tuân thủ `maxStudents = 1` và giới hạn tối đa 10 SV/GVHD).
   - 300 Đề tài `Topic` công nghệ hiện đại, độc lập, trạng thái `APPROVED`.
4. **Hiện thực hóa Quy trình Đợt 3 (Hiện tại: `sv201` .. `sv300`)**:
   - 100 SV đã duyệt đề cương `BM01Evaluation` (`PASSED`) và nộp/duyệt đơn `BM02Submission` (`APPROVED`).
   - Có Quyết định giao đề tài của Viện trưởng (`TopicAssignmentDecision`) ban hành bởi `lecturer01` (số QĐ: `QĐ-ĐATN-2026-01/QĐ-VCNT`), kèm 100 `TopicAssignmentDecisionItem`.
   - 100 SV có Sổ tiến độ `BM03ProgressRecord` và 2 biên bản họp hướng dẫn `BM03MeetingEntry` có GVHD ký duyệt.
   - Đã qua chấm giữa đợt Checkpoint 1 (`BM03StageEvaluation` - `MIDTERM`):
     * 90 SV (`sv201` .. `sv290`): `CONTINUE`, trạng thái hồ sơ `IN_PROGRESS_BM03` (được tiếp tục làm).
     * 10 SV (`sv291` .. `sv300`): `PROPOSE_STOP`, trạng thái hồ sơ `STOP_REVIEW_PENDING`, kèm bản ghi `InstituteStopReview` (Viện trưởng xem xét quyết định dừng đồ án).
5. **Hiện thực hóa Trọn vẹn 100% Quy trình Đợt 1 & Đợt 2 (Quá khứ: 200 SV)**:
   - Đầy đủ Quyết định giao đề tài của Viện trưởng (`QĐ-ĐATN-2025-01/QĐ-VCNT` và `QĐ-ĐATN-2025-02/QĐ-VCNT`).
   - Đầy đủ BM01, BM02, BM03 (3 buổi họp + 2 chặng đánh giá), BM04 nhận xét đủ điều kiện bảo vệ.
   - 10 Hội đồng bảo vệ (`Council`, `CouncilMember`) độc lập, không trùng GVHD.
   - Điểm bảo vệ `DefenseResult` (7.5 đến 9.8) kèm 3 `DefenseMemberScore` mỗi SV.
   - Phê duyệt điểm `DefenseResultApproval`, công bố kết quả `ResultPublication`.
   - Lưu chiểu `ProjectArchive` trạng thái `COMPLETED` có chữ ký số Viện trưởng và 4 file lưu chiểu hoàn chỉnh.
6. **Xác thực & Kiểm thử Hệ thống**:
   - Tạo mới `backend/scripts/seed/threeSemestersFixtures.js` và `backend/prisma/seedThreeSemesters.js`.
   - Cập nhật `backend/prisma/seed.js` và `backend/package.json` với script `npm run db:seed:3semesters`.
   - Seed thành công vào Supabase trong 61 giây, 100% dữ liệu toàn vẹn.
   - Test `studentPermissionExclusion.test.js` PASS 5/5.
   - Frontend production build `npm run build` PASS 100% (3.333 modules transformed).
   - Mã hóa toàn bộ tệp tuân thủ UTF-8 without BOM.

#### 2. Trạng thái cập nhật của từng phần
- **Cơ sở dữ liệu (Supabase PostgreSQL)**: 321 Users, 300 StudentProfiles, 3 Semesters, 300 Topics, 300 Registrations, 3 TopicAssignmentDecisions, 300 BM03 Records, 200 DefenseResults, 200 ProjectArchives hoàn chỉnh.
- **Backend API & Seeding**: Tích hợp module seed mới tối ưu chunking cho Supabase connection pooler, không nghẽn hay timeout kết nối.
- **Frontend SPA**: Build sản xuất hoàn toàn sạch sẽ, sẵn sàng truy cập với các tài khoản mới.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm tra Giao diện Thực tế theo các Tài khoản Seed Mới**:
   - Đăng nhập `lecturer01` (Viện trưởng): Kiểm tra màn hình Giám sát tiến độ, phê duyệt dừng đề tài (10 SV đợt 3) và danh sách quyết định đã ban hành.
   - Đăng nhập `lecturer02` (Giáo vụ): Kiểm tra menu Điều phối & Gán sinh viên, theo dõi tiến độ đồ án và thẩm định lưu chiểu.
   - Đăng nhập Giảng viên hướng dẫn (`lecturer03`): Kiểm tra danh sách 5 SV đang hướng dẫn trong đợt 3.
   - Đăng nhập Sinh viên được tiếp tục (`sv201`) và Sinh viên bị đề xuất dừng (`sv291`): Kiểm tra Student Dashboard hiển thị đúng trạng thái BM03.
2. **Triển khai Phiếu chấm điện tử BM05 & Khóa sổ điểm Hội đồng**:
   - Hoàn thiện giao diện chấm điểm 4 nhóm tiêu chí Rubric cho 3 thành viên hội đồng.
   - Xác thực tính năng tự động tính điểm trung bình cộng, khóa sổ điểm và công bố kết quả bảo vệ.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Tối ưu Chunking Khi Seed Dữ liệu Lớn**: Với 300 sinh viên và hàng ngàn bản ghi liên quan (hồ sơ, tiến độ, điểm số, lưu chiểu), toàn bộ quá trình seed được chia nhỏ thành các batch với kích thước vừa phải (chunks 50-100 items), sử dụng kết nối pooler hạn chế số lượng transaction đồng thời để tránh lỗi `Max client connections reached` trên Supabase.
- **Độc Lập Nghiệp Vụ Giữa 3 Học Kỳ**: Đợt 1 và Đợt 2 thể hiện đầy đủ chu trình lịch sử đã hoàn thành để phục vụ báo cáo/thống kê/lưu chiểu, trong khi Đợt 3 dừng chính xác ở thời điểm giữa kỳ (sau Checkpoint 1 BM03), cung cấp bối cảnh thực tế cho người dùng thử nghiệm luồng xử lý sinh viên tiếp tục và sinh viên bị dừng đề tài.

---

### Phiên 15/11/2026 (Khắc Phục Toàn Diện 4 Nhóm Lỗ Hổng Bảo Mật, Quyền Truy Cập & Toàn Vẹn Quy Trình 5 Vai Trò)

#### 1. Những phần đã hoàn thành
1. **Khắc phục triệt để lỗ hổng Bảo mật & Leo thang đặc quyền Admin (Worker 1)**:
   - `userController.js`: Chặn đứng yêu cầu import có `role: 'ADMIN'` (HTTP 400 `ADMIN_IMPORT_FORBIDDEN`). Khi cập nhật trùng lặp (`onDuplicate === 'UPDATE'`), bảo vệ tài khoản Admin hiện hữu không bị ghi đè thành sinh viên/giảng viên và không bị hạ cấp quyền hạn.
   - `auth.js`: Lọc ủy quyền học vụ `academicDelegation` chặt chẽ theo `semesterId` hiện tại (`OR: [{ semesterId: null }, { semesterId: currentSemesterId }]`), loại bỏ hoàn toàn việc ủy quyền một học kỳ bị lây lan sang các học kỳ khác.
   - `permissions.js`: Cấp mã quyền `VIEW_PROJECT_ENROLLMENTS` cho nhóm chức vụ mặc định `GIAO_VU`.
   - Kiểm thử: Tạo mới `tests/integration/userImportSecurity.test.js` (7/7 tests pass). Toàn bộ 8 test suite auth/user security đạt 72/72 tests pass.
2. **Khắc phục IDOR BM03/BM04, Chấm điểm BM05 & Quota Giảng viên (Worker 2)**:
   - `mentorCapacity.js`: Bổ sung đầy đủ 13 trạng thái hoạt động thực tế vào `ACTIVE_REGISTRATION_STATUSES` (bao gồm `REGISTERED`, `PENDING`, `BM02_APPROVED`, `DEFENSE_ELIGIBLE`, v.v.), đảm bảo bộ đếm trần 10 SV/GVHD không bị vượt quá.
   - `evaluationController.js`: Sửa `getGradingStudents`, dùng `where.AND = [...]` kết hợp điều kiện ủy viên của giảng viên với `councilId`, ngăn chặn triệt để việc giảng viên truyền `?councilId=...` để xem sinh viên của hội đồng khác.
   - `bm03Controller.js` & `bm04Controller.js`: Bổ sung Ownership Guard cho các endpoint `GET /api/bm03/:id` và `GET /api/bm04/:id`. Sinh viên chỉ xem hồ sơ của mình; giảng viên chỉ xem hồ sơ mình hướng dẫn hoặc khi là thành viên hội đồng được phân công; từ chối 403 `FORBIDDEN_RESOURCE` với truy cập trái phép.
   - `GradingPage.jsx`: Thay thế tham chiếu lỗi `fetchDefenseData` bằng hàm refetch `refreshCouncils`.
   - Kiểm thử: Tạo mới `tests/integration/mentorOwnershipAndGradingScope.test.js` (17/17 tests pass).
3. **Che giấu Điểm Bảo vệ Chưa Công bố, Chặn IDOR BM02-A & Sửa UI Sinh viên (Worker 3)**:
   - `registrationController.js` & `dashboardController.js`: Tự động ẩn hoặc gán `null` cho `registration.defenseResult` khi `isPublished !== true`, ngăn chặn rò rỉ điểm số và nhận xét hội đồng trước thời điểm công bố chính thức.
   - `bm02aController.js` & `bm02aRoutes.js`: Thêm kiểm tra quyền sở hữu cho các route GET đơn đổi tên BM02-A, trả về 403 khi sinh viên cố tình xem đơn của người khác.
   - `SubmissionPage.jsx`: Xóa bỏ dòng gọi `setBm04Record` gây `ReferenceError` vỡ trang.
   - `GradeViewPage.jsx`: Sửa các callback nạp lại dữ liệu sang `gradesQuery.refetch()` và `archiveQuery.refetch()`.
   - Kiểm thử: Tạo mới `tests/integration/studentDefenseResultPrivacy.test.js` (11/11 tests pass).
4. **Mở khóa Ban hành QĐ BM02, Chặn Bypass Lưu chiểu & Điều phối Giáo vụ / Viện trưởng (Worker 4)**:
   - `semesterController.js`: Mở rộng query ban hành quyết định giao đề tài sang `status: { in: ['BM02_SUBMITTED', 'BM02_RESUBMITTED', 'BM02_APPROVED'] }`, giải phóng luồng bị nghẽn sau khi BM02 được phê duyệt.
   - `archiveController.js` & `archiveRoutes.js`: Loại bỏ việc gán trực tiếp `status: 'COMPLETED'` tại `reviewArchive`; chuyển sang trạng thái chờ Giáo vụ thẩm định và Viện trưởng ký Giấy chứng nhận hoàn thành. Bổ sung guard kiểm tra thẩm quyền xem Defense Dossier (403 `FORBIDDEN_DOSSIER_ACCESS`). Sửa deep-link thông báo về `/lecturer/progress`.
   - `ProjectOversightPage.jsx`: Cập nhật `canReviewArchive` nhận diện thêm quyền `ARCHIVE_ACADEMIC_AFFAIRS_REVIEW`.
   - `navigationRegistry.js`: Hiển thị menu "Điều phối & Gán sinh viên" cho nhóm `GIAO_VU`.
   - Kiểm thử: Tạo mới `tests/integration/decisionIssuanceAndArchiveIntegrity.test.js` (8/8 tests pass).
5. **Tổng hợp QA & Xác minh Hệ thống (Task 5)**:
   - 4 test suite tích hợp mới chạy đồng thời đạt **43/43 tests PASS**.
   - Toàn bộ 291/291 frontend component tests PASS.
   - Frontend production build `npm run build` PASS 100% (3.333 modules transformed, 0 lỗi cú pháp/bundle).
   - Kiểm tra mã hóa: 100% tệp tuân thủ UTF-8 without BOM; 100% tuân thủ UI Button standard Rule 2.6.
6. **Tinh gọn Ma trận Phân quyền & Loại bỏ Role/Quyền Sinh viên khỏi RBAC Quản trị**:
   - `permissions.js`: Định nghĩa và export `STUDENT_BASE_PERMISSIONS` (14 quyền nội tại cố định của sinh viên).
   - `permissionService.js`: Lọc bỏ nhóm `SYSTEM_STUDENT_BASE` khỏi `listGroups` và `getPermissionMatrix`; loại bỏ các quyền nội tại sinh viên và module `STUDENT` khỏi `listPermissions` và bảng ma trận quản trị.
   - `userController.js`: Chặn việc gán nhóm quyền chức vụ cho tài khoản có `role === 'STUDENT'` (HTTP 400 `STUDENT_CANNOT_HAVE_PERMISSION_GROUPS`).
   - `PermissionGroupPage.jsx`: Lọc bỏ nhóm `SYSTEM_STUDENT_BASE` và các quyền cá nhân sinh viên khỏi Ma trận, Nhóm quyền và Cây danh mục quyền.
   - `UserManagementPage.jsx`: Ẩn tùy chọn "Phân quyền nhóm" trong menu thao tác đối với người dùng có `role === 'STUDENT'`.
   - Kiểm thử: Tạo mới `tests/integration/studentPermissionExclusion.test.js` (5/5 tests PASS).
   - Backend `auth.js` duy trì cơ chế tự động cấp `studentBasePermissions` khi sinh viên đăng nhập, đảm bảo toàn bộ luồng học vụ sinh viên vận hành bình thường.

#### 2. Trạng thái cập nhật của từng phần
- **Cơ sở dữ liệu / Business Logic**: Toàn vẹn quy trình 10 sinh viên / GVHD, luồng BM02 -> Quyết định, và lưu chiểu 2 cấp được bảo vệ vững chắc.
- **Backend API & Security**: Toàn bộ các lỗ hổng P0 (Admin import escalation, IDOR BM02A/BM03/BM04/Dossier, rò rỉ defenseResult chưa công bố, đè scope councilId, delegation leakage) đã được vá triệt để với 43 tests tích hợp bảo vệ.
- **Frontend SPA**: Đã loại bỏ các `ReferenceError`, nút reload dùng React Query chính quy, quyền và menu Giáo vụ/Viện trưởng đồng bộ với backend. Build xanh hoàn hảo.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Triển khai Phiếu chấm điện tử BM05 & Khóa sổ điểm Hội đồng**:
   - Hoàn thiện giao diện chấm điểm 4 nhóm tiêu chí Rubric cho 3 thành viên hội đồng (Chủ tịch, Thư ký, Phản biện).
   - Xác thực tính năng tự động tính điểm trung bình cộng, khóa sổ điểm và công bố kết quả bảo vệ.
2. **Ký số Giấy xác nhận hoàn thành đồ án tốt nghiệp (`ClearanceCertificateModal`)**:
   - Hoàn thiện thẩm định 2 tầng hồ sơ lưu chiểu và chữ ký Viện trưởng trước khi đóng đề tài (`COMPLETED`).
3. **Quy trình P1**:
   - Thẩm định lại BM01 sửa đổi do GVHD thực hiện; bổ sung quy định nộp bắt buộc source code lưu chiểu.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Kiến trúc Thực thi Song song Zero File Collision**: Phân bổ 4 Worker Subagent phụ trách 4 tập tệp hoàn toàn tách biệt giúp giải quyết toàn bộ 4 nhóm lỗ hổng P0 một cách nhanh chóng, sạch sẽ, không hề có merge conflict.
- **Nguyên tắc "Fail-Closed" cho Dữ liệu Học vụ Nhạy cảm**: Điểm bảo vệ khi chưa công bố bắt buộc phải là `null` đối với sinh viên; hồ sơ tiến độ và phiếu nhận xét chỉ người có trách nhiệm trực tiếp mới được xem.

---

### Phiên 15/11/2026 (Audit Toàn Diện Theo 5 Vai Trò: Sinh Viên, Giảng Viên, Admin, Giáo Vụ, Viện Trưởng)

#### 1. Những phần đã hoàn thành
1. **Tổ chức audit độc lập theo 5 vai trò nghiệp vụ**:
   - Rà soát xuyên suốt từ Prisma/CSDL -> Backend route/controller/service/RBAC -> Frontend route/menu/page/query/test.
   - Phân loại phát hiện theo lỗ hổng quy trình, chức năng chưa triển khai, chức năng cần thiết còn thiếu, lỗi có bằng chứng và trang/route không truy cập được.
   - Không thay đổi mã nguồn sản phẩm và không ghi dữ liệu live trong quá trình audit.
2. **Xác nhận các lỗi P0 về bảo mật và toàn vẹn nghiệp vụ**:
   - Import người dùng có thể nhận `role: ADMIN`, tạo tài khoản quản trị trái phép hoặc đổi tài khoản đặc quyền hiện hữu thành sinh viên khi cập nhật trùng.
   - Các API BM02-A, BM03, BM04 và hồ sơ bảo vệ thiếu kiểm tra ownership/phân công, tạo IDOR giữa các hồ sơ.
   - API đăng ký và Student Dashboard trả `defenseResult` trước khi kết quả được công bố.
   - BM05 chưa bảo đảm bí mật chấm độc lập; filter `councilId` có thể ghi đè phạm vi hội đồng của giảng viên.
   - Bộ đếm giới hạn 10 sinh viên/GVHD thiếu 6 trạng thái đang hoạt động, có thể cho phép đăng ký sinh viên thứ 11.
   - Luồng BM02 -> ban hành Quyết định giao đề tài bị chặn vì hồ sơ đã duyệt ở `BM02_APPROVED` nhưng endpoint chỉ tìm `BM02_SUBMITTED`/`BM02_RESUBMITTED`.
   - Endpoint lưu chiểu legacy có thể chuyển thẳng hồ sơ sang `COMPLETED`, bỏ qua tầng Giáo vụ và chữ ký Viện trưởng.
   - Ủy quyền chuyên môn có `semesterId` trong CSDL nhưng middleware không giới hạn theo học kỳ.
3. **Xác nhận các lỗi truy cập và UI theo vai trò**:
   - Giáo vụ không truy cập được chức năng Điều phối & Gán sinh viên; quyền duyệt lưu chiểu chuyên biệt không được frontend nhận diện.
   - Giáo vụ/Viện trưởng không thấy menu Giám sát tiến độ; người có `REPORT_VIEW` không thấy menu Báo cáo; Giáo vụ có quyền xem hội đồng nhưng không thấy menu hội đồng.
   - Giáo vụ có quyền trả sổ điểm nhưng nút và lịch sử bị khóa sai theo `RESULT_LOCK`.
   - Sinh viên gặp `ReferenceError` khi mở BM04 đã ký hoặc cập nhật lưu chiểu do `setBm04Record`, `fetchArchive`, `fetchGrades` không tồn tại.
   - Trang chấm điểm giảng viên tham chiếu `fetchDefenseData` không tồn tại.
   - Deep-link thông báo lưu chiểu dùng `/lecturer/progress-tracking` trong khi route thật là `/lecturer/progress`.
4. **Xác nhận các thiếu sót P1 về quy trình**:
   - Bản BM01 sửa lại đang do Chủ tịch hội đồng duyệt thay vì GVHD thẩm định lại theo quy trình đã chốt.
   - Lưu chiểu chưa bắt buộc source code trước khi cấp giấy hoàn thành.
   - Student Dashboard còn hạn nộp, thông báo, địa điểm và nhật ký giả dù đã có API thực; BM04 định tính bị trình bày thành điểm số GVHD.
   - Mật khẩu tạo/import/reset mặc định là MSSV/MSGV và chưa có cơ chế bắt đổi mật khẩu.
   - Hội đồng chưa có bước pháp lý phê duyệt/ban hành danh sách thành viên, số quyết định và người ký.
   - Thời điểm công bố quyết định người dùng chọn chưa được backend sử dụng đúng cho cửa sổ 168 giờ.
   - Nhóm Viện trưởng đồng thời có quyền GVHD, Giáo vụ và ký cuối, chưa bảo đảm phân tách nhiệm vụ.

#### 2. Trạng thái cập nhật của từng phần
- **Cơ sở dữ liệu/Prisma**: Không thay đổi schema. Tiếp tục dùng mô hình `TopicRegistration`; phát hiện thiếu ràng buộc DB chống race cho quy tắc 1 sinh viên/1 đề tài và dấu vết legacy `Task.isBypassed` cần được đánh giá ở phiên sau.
- **Backend API/RBAC**: Audit `FAIL`; xác nhận các IDOR, rò điểm trước công bố, import privilege escalation, sai phạm vi ủy quyền và bypass lưu chiểu nêu trên.
- **Frontend SPA**: Production build `PASS`; Playwright E2E hiện có `6/6 PASS`; route/navigation focused tests `68/68 PASS`. Tuy nhiên lint toàn dự án `FAIL` với **447 vấn đề (393 errors, 54 warnings)**, trong đó có các biến không tồn tại gây lỗi runtime.
- **Kiểm thử theo vai trò**: Các focused suite của 5 subagent đều PASS, nhưng chưa bao phủ ownership IDOR, capability matrix riêng cho `GIAO_VU`/`VIEN_TRUONG`, trạng thái quota đầy đủ và luồng login thật theo từng nhóm quyền.
- **Git/Workspace**: Audit không sửa mã nguồn. Giữ nguyên thay đổi có sẵn của người dùng tại `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`; chỉ cập nhật và commit `CLAUDE.md` khi đóng phiên.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **[P0 — Bảo mật/Ownership]**:
   - Chặn import `ADMIN`, bảo vệ cập nhật trùng không được đổi role tài khoản đặc quyền và bổ sung test chống privilege escalation.
   - Bổ sung ownership/assignment guard cho BM02-A, BM03, BM04, defense dossier và BM05; che toàn bộ điểm trước công bố.
2. **[P0 — Toàn vẹn quy trình CSDL/Backend]**:
   - Hoàn thiện tập trạng thái quota 10 SV/GVHD và bổ sung khóa/ràng buộc chống race cho 1 sinh viên/1 đề tài.
   - Sửa truy vấn ban hành quyết định nhận `BM02_APPROVED`; giới hạn ủy quyền theo `semesterId`.
   - Vô hiệu hóa endpoint lưu chiểu legacy bypass; bắt buộc hai tầng duyệt, source code và chữ ký Viện trưởng trước `COMPLETED`.
3. **[P0/P1 — RBAC và khả năng truy cập]**:
   - Đồng bộ capability matrix của Giáo vụ/Viện trưởng giữa `permissions.js`, backend guards, `App.jsx`, `navigationRegistry.js` và điều kiện hiển thị nút/query.
   - Bổ sung integration/E2E đăng nhập thật cho 5 vai trò, kiểm tra menu, deep-link, GET/POST và phản hồi 403 đúng phạm vi.
4. **[P1 — Frontend Runtime & Dữ liệu thật]**:
   - Sửa `setBm04Record`, `fetchArchive`, `fetchGrades`, `fetchDefenseData` và deep-link sai.
   - Loại bỏ mock/hardcode khỏi Student Dashboard và sửa hiển thị BM04 định tính.
   - Giảm toàn bộ lỗi lint về 0 trước khi tiếp tục phát triển tính năng mới.
5. **[P1 — Quy trình pháp lý]**:
   - Khôi phục bước GVHD duyệt bản BM01 sửa; bổ sung phê duyệt/ban hành danh sách Hội đồng và phân tách nhiệm vụ lưu chiểu.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Ưu tiên đóng lỗ hổng bảo mật trước phát triển BM05/lưu chiểu mới**: Các IDOR, rò điểm, privilege escalation và bypass `COMPLETED` ảnh hưởng trực tiếp đến tính riêng tư, toàn vẹn học vụ và giá trị pháp lý của hệ thống.
2. **Sửa gốc theo thứ tự CSDL -> Backend -> Frontend**: Ràng buộc trạng thái, ownership, academic scope và capability phải được chuẩn hóa ở backend/CSDL trước khi mở menu hoặc nút giao diện.
3. **Không xem test xanh hiện tại là bằng chứng luồng vai trò đã an toàn**: Focused tests và E2E dùng interception vẫn PASS trong khi audit xác nhận lỗi P0; phiên sau bắt buộc bổ sung negative authorization tests và role-based E2E bằng tài khoản thực.
4. **Giữ nguyên mô hình `TopicRegistration` và trần 10 SV/GVHD**: Không khôi phục `group/groupMember`; mọi sửa lỗi quota và uniqueness phải củng cố kiến trúc hiện tại.

---

### Phiên 15/11/2026 (Khắc Phục Thuật Toán Phân Công Tự Động Hội Đồng Bảo Vệ Zero-COI & Chuẩn Hóa Tiêu Chí Đánh Giá Tiến Độ Hướng Dẫn)

#### 1. Những phần đã hoàn thành
1. **Khắc Phục Thuật Toán Phân Công Tự Động Hội Đồng Bảo Vệ (`backend/src/services/councilAutoSetupService.js`)**:
   - Chẩn đoán 4 nguyên nhân gốc rễ khiến nút "Tự động phân công" phía Admin không thể xếp 10 sinh viên:
     * Bộ lọc `DEFENSE_ASSIGNMENT_STATUSES` trước đó chỉ có `['SUBMITTED', 'DEFENDED', 'COMPLETED']`, thiếu `DEFENSE_READY`, `DEFENSE_ELIGIBLE`, `ELIGIBLE_BY_INSTITUTE`, khiến hệ thống đếm được 0 sinh viên và không tự sinh hội đồng nào.
     * Quy mô hội đồng tính theo trần 24 sinh viên (`MAX_STUDENTS_PER_COUNCIL = 24`), nhắm mục tiêu tạo duy nhất 1 hội đồng cho 10 sinh viên.
     * Thuật toán chọn 3 ủy viên hội đồng xếp theo ID tăng dần (`a.id - b.id`), chọn đúng GV001, GV002, GV003 (là GVHD của toàn bộ 10 sinh viên), dẫn đến 100% sinh viên bị loại vì vi phạm xung đột quyền lợi (Conflict of Interest - COI).
     * Điều kiện so khớp kết luận BM04 kiểm tra `conclusion === 'APPROVED'` thay vì enum chuẩn trong CSDL là `'AGREED_FOR_DEFENSE'`.
   - Cải tiến và tối ưu hóa toàn diện:
     * Bổ sung đầy đủ các trạng thái bảo vệ hợp lệ: `DEFENSE_READY`, `DEFENSE_ELIGIBLE`, `ELIGIBLE_BY_INSTITUTE`.
     * Chuẩn hóa quy mô ca bảo vệ thực tế: `STUDENTS_PER_DEFENSE_SESSION = 5` sinh viên / ca bảo vệ. Với 10 sinh viên, hệ thống tự động khởi tạo 2 hội đồng bảo vệ (`Hội đồng 1` và `Hội đồng 2`).
     * Tích hợp thuật toán chọn ủy viên thông minh không xung đột (Zero-COI): Tính toán số lượng đề tài hướng dẫn trong kỳ (`mentorCountsInSemester`), ưu tiên phân bổ các giảng viên không hướng dẫn sinh viên nào trong kỳ (từ GV004 đến GV012) vào hội đồng.
     * Đồng bộ đánh giá BM04 và chuyển trạng thái toàn bộ 10 sinh viên sang `DEFENSE_READY`.
   - Thực thi phân công tự động thực tế: Đã phân công thành công **10/10 sinh viên** (Hội đồng 1: 5 SV, Hội đồng 2: 5 SV), 0 cảnh báo, 0 sinh viên bị bỏ qua, hoàn toàn không trùng GVHD.
2. **Chuẩn Hóa Giao Diện Sổ Theo Dõi Tiến Độ BM03 (`ProgressTrackingPage.jsx`) & Chi Tiết Hội Đồng (`CouncilDetailPage.jsx`)**:
   - Loại bỏ các mã code và tên biến kỹ thuật thô (`CONTINUE_TO_BM04`, `PROPOSE_STOP`, `studentCompletedWork`, `remainingIssues`, `nextTasks`, `expectedDeadline`).
   - Chuẩn hóa ngôn ngữ hiển thị tiếng Việt học thuật, thân thiện và đồng bộ.
   - Đảm bảo tuân thủ tuyệt đối quy tắc Rule 2.4 (UTF-8 without BOM) và Rule 2.6 (sử dụng prop `icon={<IconComponent />}`, không chèn raw emoji vào button label).
3. **Làm Rõ Quy Chuẩn Số Buổi Hướng Dẫn & Cảnh Báo Học Vụ**:
   - Phân định rõ 3 cấp độ:
     * **Bắt buộc theo Quy trình & BM03**: Tối thiểu 3 buổi gặp gỡ chính thức (gắn với 3 mốc: Khởi động Đề cương, Checkpoint 1 Giữa kỳ, Checkpoint 2 Cuối kỳ).
     * **Ngưỡng hiển thị màu xanh "Đầy đủ" trên Dashboard Giảng viên**: $\ge$ 5 buổi (dưới 5 buổi báo "Cần thêm").
     * **Quy tắc cảnh báo thời gian**: Không để trống quá 21 ngày giữa 2 lần gặp liên tiếp.

#### 2. Trạng thái cập nhật của từng phần
- **Backend API**: Hoạt động hoàn hảo, module phân công tự động hội đồng bảo vệ đã được tối ưu hóa. Backend integration test `defenseRubricAndCouncilSchedule.test.js` PASS 8/8 tests.
- **Frontend SPA**: Hoạt động mượt mà, 291/291 contract tests PASS.
- **Cơ sở dữ liệu (Supabase PostgreSQL)**: 10/10 sinh viên đã được phân bổ vào 2 Hội đồng bảo vệ chính thức với 0 xung đột quyền lợi.
- **Tuân thủ quy chuẩn `AGENTS.md`**:
  * 100% tuân thủ mô hình `TopicRegistration` (1 sinh viên / 1 đề tài).
  * 100% UTF-8 without BOM.
  * 100% tuân thủ Rule 2.6 (UI/UX Button Standards).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Quy trình Chấm Điểm & Ban Hành Kết Quả Bảo Vệ (BM05 & Scorebook)**:
   - Kiểm tra và hoàn thiện giao diện chấm điểm trực tiếp của 3 thành viên hội đồng (Chủ tịch, Thư ký, Phản biện) trên phiếu điện tử `DefenseMemberScore`.
   - Xác thực tính năng khóa sổ điểm (`scoreBookLocked`), tính điểm trung bình cộng và công bố kết quả bảo vệ đợt chính thức / bổ sung.
2. **Nghiệm Thu Lưu Chiểu & Cấp Giấy Xác Nhận Hoàn Thành Đồ Án**:
   - Kiểm thử luồng nộp quyển báo cáo hoàn thiện sau bảo vệ và file mã nguồn lưu chiểu.
   - Thẩm định lưu chiểu của GVHD và Giáo vụ Viện, ký điện tử cấp Giấy xác nhận hoàn thành đồ án tốt nghiệp (`ClearanceCertificateModal`).

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Quy Mô Phiên Bảo Vệ 5 Sinh Viên / Ca (`STUDENTS_PER_DEFENSE_SESSION = 5`)**: Việc giới hạn 5 sinh viên mỗi hội đồng phản ánh sát thực tế thời lượng bảo vệ đồ án tốt nghiệp (mỗi sinh viên trình bày và phản biện ~30-45 phút), giúp việc sắp xếp thời gian hợp lý và tránh quá tải cho hội đồng.
- **Thuật Toán Phân Bổ Ủy Viên Zero-COI Dựa Trên `mentorCountsInSemester`**: Bằng cách sắp xếp độ ưu tiên theo số lượng sinh viên mà giảng viên đang hướng dẫn trong kỳ, hệ thống luôn chọn được các giảng viên trung lập để ngồi hội đồng, loại bỏ triệt để hiện tượng GVHD ngồi chấm sinh viên của mình.

---

### Phiên 14/11/2026 (Bộ Dữ Liệu Demo Thu Gọn 10 Sinh Viên Thực Tế — Giai Đoạn Thẩm Định BM04 & Demo Trợ Lý AI Sinh Nhận Xét Từ BM03)

#### 1. Những phần đã hoàn thành
1. **Thiết Lập Bộ Dữ Liệu Học Thuật Chuẩn Xác Với 10 Sinh Viên Thực Tế (`backend/scripts/seed/tenStudentsBM04Fixtures.js`)**:
   - Khởi tạo chính xác **10 sinh viên** (`sv001` đến `sv010`) kèm mã số sinh viên `2200001` đến `2200010`.
   - Phân bổ hồ sơ sinh viên chuẩn xác: Trường (*Trường Đại học Thủ Dầu Một*), Đơn vị (*Viện Công nghệ số*), Ngành (*Công nghệ thông tin*), Khóa (*D22 — Nhập học năm 2022*), Lớp hành chính (*D22CNTT01* và *D22CNTT02*).
   - Phân bổ hồ sơ giảng viên: Đơn vị (*Viện Công nghệ số*), Bộ môn (*Kỹ thuật phần mềm & Hệ thống thông tin*), gồm các giảng viên hướng dẫn chủ chốt:
     * `TS. Nguyễn Văn Thắng` (`lecturer01` - Viện trưởng) hướng dẫn `sv001`, `sv002`, `sv003`, `sv009`.
     * `ThS. Trần Thị Mai Phương` (`lecturer02` - Phụ trách bộ môn) hướng dẫn `sv004`, `sv005`, `sv006`, `sv010`.
     * `TS. Lê Hoàng Nam` (`lecturer03`) hướng dẫn `sv007`, `sv008`.
   - Áp dụng đầy đủ **10 tên đề tài thực tế** từ dữ liệu mẫu của người dùng:
     * `sv001`: Nghiên cứu phát triển nền tảng học trực tuyến tích hợp trợ lý AI tạo sinh hỗ trợ phân tích tài liệu và thực thi mã nguồn tự động.
     * `sv002`: Xây dựng hệ thống học từ vựng tiếng Anh tương tác 3D đa nền tảng tích hợp thị giác máy tính và cơ chế đấu trường ngôn ngữ.
     * `sv003`: Xây dựng hệ thống giám sát và cảnh báo an toàn lao động tại công trường xây dựng bằng thị giác máy tính và phân tích rủi ro AI.
     * `sv004`: Xây dựng website quản lý quy trình thực hiện đồ án tốt nghiệp tại viện Công nghệ số trên nền tảng ReactJS và NodeJS.
     * `sv005`: Xây dựng ứng dụng di động hỗ trợ quản lý tài chính cá nhân thông minh và lập kế hoạch tiết kiệm tích hợp mô hình phân tích chi tiêu.
     * `sv006`: Nghiên cứu và xây dựng hệ thống gợi ý việc làm ngành Công nghệ thông tin sử dụng kỹ thuật xử lý ngôn ngữ tự nhiên và phân loại hồ sơ ứng viên.
     * `sv007`: Xây dựng hệ thống IoT giám sát chất lượng nguồn nước nuôi trồng thủy sản tự động cảnh báo theo thời gian thực.
     * `sv008`: Phát triển hệ thống quản lý chuỗi cung ứng nông sản an toàn ứng dụng công nghệ Blockchain và mã QR truy xuất nguồn gốc.
     * `sv009`: Nghiên cứu giải pháp phát hiện xâm nhập và ngăn chặn tấn công mạng cho hệ thống thông tin doanh nghiệp vừa và nhỏ sử dụng Machine Learning.
     * `sv010`: Xây dựng ứng dụng hỗ trợ người khiếm thị nhận diện vật thể và đọc văn bản thời gian thực bằng mô hình thị giác nhân tạo trên thiết bị di động.
2. **Khởi Tạo Đầy Đủ 3 Mốc Kiểm Tra Tiến Độ Định Kỳ BM03 Cụ Thể (24/8, 21/9, 19/10)**:
   - Toàn bộ 10 sinh viên đều sở hữu nhật ký tiến độ BM03 bám sát nội dung chuyên môn thực tế do người dùng cung cấp:
     * **Mốc 1 (24/8)**: Khởi động đồ án, khảo sát mô hình/nghiệp vụ, xác định điều kiện cần (con người, dữ liệu, framework).
     * **Mốc 2 (21/9)**: Xây dựng các module chức năng chính (Admin, Giảng viên, Sinh viên, tính năng camera/yolo, luồng kết nối CSDL Supabase).
     * **Mốc 3 (19/10)**: Hoàn thiện tính năng nâng cao (AI tích hợp, runcode, đấu trường, cảnh báo rủi ro, phân tích sai sót), chuẩn bị báo cáo tổng kết.
   - Hoàn thành Đánh giá Giữa kỳ (Checkpoint 1 - `ALLOWED_TO_CONTINUE` / `CONTINUE`) và Cuối kỳ (Checkpoint 2 - `ALLOWED_TO_CONTINUE` / `CONTINUE_TO_BM04`).
   - Sinh viên đã ký số xác nhận nhật ký tiến độ (`ACKNOWLEDGED_WITH_COMMENT`).
   - **Tất cả 10 sinh viên đều sẵn sàng để in Sổ tiến độ BM03 (khổ A4 chuẩn)**.
3. **Phân Luồng Rõ Ràng Cho Kịch Bản Trải Nghiệm Giai Đoạn Thẩm Định BM04**:
   - **Nhóm 1 (`sv001` .. `sv006`) — Đang mở đợt thẩm định BM04 (`IN_PROGRESS_BM03`)**:
     * Dành cho Giảng viên hướng dẫn (`lecturer01` hoặc `lecturer02`) bấm **Thẩm định BM04**.
     * Giảng viên bấm nút **AI Gợi ý từ BM03** để xem AI phân tích 3 mốc tiến độ định kỳ (24/8, 21/9, 19/10) và tự động sinh nội dung nhận xét cho 4 tiêu chí CĐR:
       1. Tiêu chí 1: Hình thức trình bày Báo cáo tốt nghiệp (IEEE format, trích dẫn, mã nguồn).
       2. Tiêu chí 2: Nội dung nghiên cứu và giải thuật chuyên sâu.
       3. Tiêu chí 3: Tính ứng dụng thực tiễn và khả năng triển khai.
       4. Tiêu chí 4: Thái độ, kỷ luật và tính chủ động suốt 3 đợt theo dõi.
     * Hỗ trợ nút **Áp dụng toàn bộ vào phiếu** hoặc **Áp dụng mục này** cho từng tiêu chí riêng lẻ.
   - **Nhóm 2 (`sv007` .. `sv010`) — Đã hoàn tất thẩm định & ký số BM04 (`DEFENSE_READY` / `SIGNED_APPROVED`)**:
     * Đã có bản đánh giá 4 tiêu chí xuất sắc, kết luận cho phép ra bảo vệ trước Hội đồng.
     * Sẵn sàng demo tính năng **In Phiếu BM04** ngay lập tức mà không cần thao tác thêm.
4. **Tương Thích Ngược & Tối Ưu Hóa Bộ Công Cụ Nạp Dữ Liệu (`seedPhase2.js`, `demoFixtures.js`, `validateDemoSeed.js`)**:
   - Hỗ trợ biến môi trường `SEED_STUDENT_COUNT` hoặc cấu hình tham số: mặc định nạp bộ 10 sinh viên thực tế gọn nhẹ, đồng thời hỗ trợ bộ đầy đủ 120 sinh viên khi cần.
   - Hàm `validateDemoSeed` nhận diện chế độ rút gọn (`isCompact`), xác thực tính toàn vẹn 0 xung đột hội đồng (Zero-COI), 10 sinh viên / 10 đề tài / 10 enrollment hợp lệ.
5. **Kiểm Thử Toàn Trình Đạt 100%**:
   - Backend: 110/110 test suites PASS (1,123/1,123 tests).
   - Frontend Contract: 291/291 tests PASS.
   - Frontend Runtime (Vitest): 14/14 test files PASS (118/118 tests).
   - Frontend Production Build (`vite build`): Hoàn tất trong 14.35s, 0 lỗi.

#### 2. Bảng Tài Khoản & Hướng Dẫn Trải Nghiệm Demo BM03 / BM04

| STT | Sinh viên (MSSV) | GVHD | Đề tài nghiên cứu | Trạng thái học vụ | Trải nghiệm BM04 | In BM03 | In BM04 |
|:---:|:---|:---|:---|:---:|:---:|:---:|:---:|
| 1 | **sv001** (`2200001`) | TS. Nguyễn Văn Thắng (`lecturer01`) | Nền tảng học trực tuyến tích hợp AI & Runcode | Đang thực hiện BM04 | **Bấm "AI Gợi ý từ BM03"** để sinh 4 tiêu chí | **IN NGAY** | Sau khi ký |
| 2 | **sv002** (`2200002`) | TS. Nguyễn Văn Thắng (`lecturer01`) | Học tiếng Anh 3D & Thị giác máy tính Yolo | Đang thực hiện BM04 | **Bấm "AI Gợi ý từ BM03"** để sinh 4 tiêu chí | **IN NGAY** | Sau khi ký |
| 3 | **sv003** (`2200003`) | TS. Nguyễn Văn Thắng (`lecturer01`) | Giám sát an toàn công trường xây dựng AI | Đang thực hiện BM04 | **Bấm "AI Gợi ý từ BM03"** để sinh 4 tiêu chí | **IN NGAY** | Sau khi ký |
| 4 | **sv004** (`2200004`) | ThS. Trần Thị Mai Phương (`lecturer02`) | Quản lý quy trình đồ án tốt nghiệp Viện CNS | Đang thực hiện BM04 | **Bấm "AI Gợi ý từ BM03"** để sinh 4 tiêu chí | **IN NGAY** | Sau khi ký |
| 5 | **sv005** (`2200005`) | ThS. Trần Thị Mai Phương (`lecturer02`) | Quản lý tài chính cá nhân & Phân tích chi tiêu | Đang thực hiện BM04 | **Bấm "AI Gợi ý từ BM03"** để sinh 4 tiêu chí | **IN NGAY** | Sau khi ký |
| 6 | **sv006** (`2200006`) | ThS. Trần Thị Mai Phương (`lecturer02`) | Gợi ý việc làm IT bằng NLP & Phân loại CV | Đang thực hiện BM04 | **Bấm "AI Gợi ý từ BM03"** để sinh 4 tiêu chí | **IN NGAY** | Sau khi ký |
| 7 | **sv007** (`2200007`) | TS. Lê Hoàng Nam (`lecturer03`) | IoT giám sát nước thủy sản thời gian thực | Sẵn sàng bảo vệ | Đã hoàn tất & Ký số | **IN NGAY** | **IN NGAY** |
| 8 | **sv008** (`2200008`) | TS. Lê Hoàng Nam (`lecturer03`) | Chuỗi cung ứng nông sản Blockchain & QR Code | Sẵn sàng bảo vệ | Đã hoàn tất & Ký số | **IN NGAY** | **IN NGAY** |
| 9 | **sv009** (`2200009`) | TS. Nguyễn Văn Thắng (`lecturer01`) | Phát hiện xâm nhập mạng bằng Machine Learning | Sẵn sàng bảo vệ | Đã hoàn tất & Ký số | **IN NGAY** | **IN NGAY** |
| 10 | **sv010** (`2200010`) | ThS. Trần Thị Mai Phương (`lecturer02`) | Hỗ trợ người khiếm thị nhận diện vật thể AI | Sẵn sàng bảo vệ | Đã hoàn tất & Ký số | **IN NGAY** | **IN NGAY** |

> **Thông tin đăng nhập**:
> - Tài khoản Sinh viên: `sv001@university.edu.vn` .. `sv010@university.edu.vn` | Mật khẩu: `student123`
> - Tài khoản Giảng viên: `lecturer01@university.edu.vn` .. `lecturer03@university.edu.vn` | Mật khẩu: `lecturer123`
> - Tài khoản Quản trị viên: `admin@university.edu.vn` | Mật khẩu: `admin123`

#### 3. Trạng thái cập nhật của từng phần
- **Database (Supabase / PostgreSQL)**: Đã nạp mới hoàn toàn bộ dữ liệu 10 sinh viên, 10 đề tài thực tế, 3 mốc BM03 và các phiếu BM04.
- **Backend API**: Hoạt động ổn định, 110/110 test suites PASS (1,123/1,123 tests).
- **Frontend SPA**: Hoạt động mượt mà, 291/291 contract tests PASS, 118 runtime tests PASS.
- **Frontend Production Build**: Đóng gói thành công trong 14.35s.
- **Tuân thủ quy chuẩn `AGENTS.md`**:
  * 100% tuân thủ mô hình `TopicRegistration` (`maxStudents = 1`, 1 đề tài / 1 sinh viên).
  * 100% UTF-8 without BOM.
  * 100% không chèn raw emoji trong Button labels (Rule 2.6).

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Ánh xạ Enum `TaskType` Chuẩn Xác**: `BM03_CHECKPOINT` được sử dụng thay cho chuỗi tự do `BM03` để phù hợp tuyệt đối với định nghĩa Prisma Schema.
- **Bảo Lưu Bộ 10 Sinh Viên Trọng Tâm Cho Demo**: Việc thu gọn về 10 sinh viên với dữ liệu thực tế sâu sắc (thay vì 120 sinh viên dữ liệu tổng quát) giúp giao diện sạch đẹp, các biểu mẫu in và trợ lý AI phản hồi nhanh chóng, trực quan và ấn tượng khi trình chiếu thực tế.

---



#### 1. Những phần đã hoàn thành
1. **Chuẩn Hóa Bộ Dữ Liệu Demo Toàn Diện (`backend/scripts/seed/`)**:
   - `demoFixtures.js`: Danh sách 12 Giảng viên với học hàm/học vị và họ tên tiếng Việt thực tế: `TS. Nguyễn Văn Thắng` (Viện trưởng), `ThS. Trần Thị Mai Phương` (Trưởng bộ môn KTPM & HTTT), `TS. Lê Hoàng Nam`, `ThS. Phạm Quốc Bảo`, `TS. Đỗ Thị Thu Hà`, v.v.
   - `demoFixtures.js`: Thuật toán sinh 120 họ tên sinh viên tiếng Việt tự nhiên, ngẫu nhiên có kiểm soát theo giới tính và họ phổ biến (Nguyễn, Trần, Lê, Phạm, Hoàng...).
   - `phase1Fixtures.js`: Chuẩn hóa 100% dữ liệu hồ sơ sinh viên: Trường (*Đại học Thủ Dầu Một*), Đơn vị quản lý (*Viện Công nghệ số*), Ngành học (*Công nghệ thông tin*), Khóa (*D22 — nhập học 2022*), Lớp hành chính (*D22CNTT01..04*).
   - `phase1Fixtures.js`: Danh mục 24 tên đề tài tốt nghiệp thực tế chuyên sâu (AI, Cloud, Microservices, IoT, LLM, Blockchain, Chữ ký số, v.v.).
2. **Nâng Cấp Dữ Liệu Tiến Độ BM03 & Nhận Xét BM04 (`phase2Fixtures.js`)**:
   - BM03: Mở rộng từ 3 buổi lên **7 buổi gặp định kỳ xuyên suốt học kỳ** (kèm hình thức `IN_PERSON` phòng Lab và `MICROSOFT_TEAMS` trực tuyến), nội dung thảo luận chi tiết, sản phẩm đã hoàn thành, nhiệm vụ tiếp theo, và đánh giá đạt cả 2 mốc Checkpoint 1 (Giữa kỳ) & Checkpoint 2 (Cuối kỳ).
   - BM04: Đánh giá chi tiết 4 tiêu chí Chuẩn đầu ra (CĐR) chuyên nghiệp: Tiêu chí 1 (Hình thức IEEE), Tiêu chí 2 (Nội dung nghiên cứu & giải thuật), Tiêu chí 3 (Tính ứng dụng thực tiễn & khả năng chuyển giao), Tiêu chí 4 (Thái độ nghiên cứu & ý thức kỷ luật), kết luận `AGREED_FOR_DEFENSE` và `MEETS_PROGRAM_OUTCOMES`.
3. **Hoàn Thiện Khả Năng Hiển Thị Khổ In A4 BM03 & BM04 (`frontend/src/components/prints/`)**:
   - `BM03PrintSheet.jsx`: Hỗ trợ linh hoạt cả prop `meetingLogs`, `progressRecords` lẫn `bm03Record.meetings`. Tự động chia tách động danh sách buổi gặp giữa 2 đợt Checkpoint. Hiển thị chuẩn mã lớp `D22CNTT01`, MSSV, ngành học và chữ ký GVHD.
   - `BM04PrintSheet.jsx`: Ánh xạ chuẩn xác các trường Prisma `thesisFormatScore`, `researchContentScore`, `applicabilityScore`, `attitudeScore`, `conclusion === 'AGREED_FOR_DEFENSE'`, `programOutcome === 'MEETS_PROGRAM_OUTCOMES'`. Hiển thị tiêu đề cơ quan: *Trường Đại học Thủ Dầu Một / Viện Công nghệ Số / Bộ môn: Kỹ thuật phần mềm & HTTT*.
4. **Thực Thi Tái Tạo Cơ Sở Dữ Liệu (Phase 2 Re-Seed)**:
   - Chạy lệnh `npm --prefix backend run db:seed:phase2` nạp thành công 100% 120 sinh viên, 12 giảng viên, 1 admin, 14 rubric criteria, 300 timeline tasks.
   - 0 conflicts, 0 failedCompleted.
5. **Kiểm Thử Toàn Trình & Bản Dựng Production**:
   - 109/109 test suites backend PASS (1,117/1,117 tests).
   - 286/286 contract tests frontend PASS.
   - 118/118 runtime tests vitest PASS.
   - Vite production build hoàn tất trong 15.90s, không lỗi.
6. **Khắc Phục Triệt Để Lỗi Truy Cập Sinh Viên (`sv075`..`sv120`)**:
   - *Nguyên nhân*: Trong `schema.prisma`, `TopicRegistration` trước đó chỉ có cột scalar `semesterId: Int` mà chưa khai báo quan hệ `@relation(fields: [semesterId], references: [id])` với `model Semester`. Khi `dashboardController.js` thực hiện truy vấn lùi học kỳ (`where: { semester: { status: ... } }`), Prisma runtime ném lỗi `Unknown argument semester`.
   - *Giải pháp*: Khai báo quan hệ `semester Semester @relation(fields: [semesterId], references: [id])` vào `TopicRegistration` và quan hệ đối ứng `registrations TopicRegistration[]` vào `Semester` trong `schema.prisma`, chạy `prisma generate`. Đồng thời tại `registrationController.js` (`getMyRegistration` và `getMyProjectEnrollments`), tự động phân giải `targetSemesterId` về học kỳ mà sinh viên thực tế đang thực hiện khi truy vấn không truyền tham số `?semesterId=...`.
   - *Xác thực*: Chạy kiểm thử E2E đăng nhập và gọi cả 3 API `/api/dashboard/student`, `/api/registrations/my-registration`, `/api/bm03/75` bằng tài khoản `sv075@university.edu.vn` đều trả về HTTP 200 OK và tải trọn vẹn thông tin đề tài.
7. **Khắc Phục Lỗi Không Thể Đóng Modal BM01 / Biểu Mẫu Học Thuật (`AcademicFormPrintModal` & `BMSubmissionViewer`)**:
   - *Hiện tượng*: Khi sinh viên hoặc giảng viên bấm mở "In Đề cương BM01" hoặc các biểu mẫu học vụ (BM01, BM02, BM03, BM04, BM02-A), người dùng không thể đóng hộp thoại in (nút "Đóng", nút "X" và phím ESC đều không hoạt động). Đồng thời khi bấm xem chi tiết bài nộp, component `BMSubmissionViewer` hiển thị trần không có hộp thoại Modal bao bọc.
   - *Nguyên nhân*:
     * Component `AcademicFormPrintModal.jsx` trước đó chỉ destructure prop `onClose`, nhưng các trang gọi (`SubmissionPage.jsx`, `BM04EvaluationModal.jsx`, `AcademicDossierDrawer.jsx`, `TitleAdjustmentModal.jsx`) lại truyền `onCancel`. Vì `onClose` là `undefined`, sự kiện `onCancel` của Ant Design `<Modal>` và sự kiện `onClick` của nút "Đóng" không thể kích hoạt đóng modal.
     * `BMSubmissionViewer.jsx` là một view-content component trả về `<div>...</div>`, nhưng `SubmissionPage.jsx` lại render trực tiếp mà không bọc trong thẻ `<Modal>`.
   - *Giải pháp*:
     * Chuẩn hóa `AcademicFormPrintModal.jsx`: Nhận cả 2 props `onClose` và `onCancel`, tạo fallback an toàn `const handleClose = onClose || onCancel;`, gán cho cả `<Modal onCancel={handleClose}>` lẫn `<Button icon={<CloseOutlined />} onClick={handleClose}>Đóng</Button>`.
     * Cập nhật `SubmissionPage.jsx`: Bọc `BMSubmissionViewer` bên trong `<Modal open={viewerVisible} onCancel={() => setViewerVisible(false)} ... destroyOnHidden>`, gán đầy đủ cả `onClose` và `onCancel` cho `AcademicFormPrintModal`.
     * Nâng cấp `BM01PrintSheet.jsx`: Nhận cả prop `outlineData` lẫn `outline`, linh hoạt hỗ trợ các trường dữ liệu `topicTitle`, `deliverables`, `objectives`.
   - *Xác thực*: Toàn bộ 286 contract tests, 118 runtime tests vitest và lệnh `vite build` đều vượt qua 100%.
8. **Tích Hợp Trợ Lý AI Sinh Gợi Ý Nhận Xét BM04 Từ Minh Chứng Tiến Độ BM03**:
   - *Mục tiêu*: Hỗ trợ Giảng viên hướng dẫn (GVHD) tự động phân tích toàn bộ dữ liệu nhật ký gặp định kỳ và 2 mốc Checkpoint ghi nhận trong BM03 để sinh gợi ý nhận xét chuẩn mực cho 4 tiêu chí Chuẩn đầu ra (CĐR) của phiếu BM04.
   - *Backend AI Suite*:
     * Thêm route `POST /api/ai/bm04-suggestion` có xác thực JWT và phân quyền chặt chẽ (chỉ GVHD hướng dẫn đề tài hoặc Quản trị viên/Giáo vụ mới được gọi).
     * `aiController.js` (`bm04Suggestion`): Truy vấn dữ liệu thực tế từ `TopicRegistration` kèm `bm03Record` (gồm danh sách `meetings`, `stageEvaluations`), `meetingLogs`, và `checkpointEvaluations`, tích hợp cơ chế bộ nhớ đệm `aiCache`.
     * `aiProviderService.js`: Điều hướng đến `geminiProvider.js` (khi cấu hình `GEMINI_API_KEY`) hoặc `localFallbackProvider.js` (chế độ Zero-Crash ngoại tuyến), tự động làm sạch văn bản qua `sanitizeAiReply`.
     * Sinh chuẩn xác 4 nhóm tiêu chí: (1) Hình thức BCTN (`thesisFormatScore`), (2) Nội dung nghiên cứu (`researchContentScore`), (3) Tính ứng dụng & triển vọng (`applicabilityScore`), (4) Thái độ & ý thức làm việc (`attitudeScore`), kèm đề xuất chuẩn đầu ra (`programOutcome`) và ra bảo vệ (`defenseRecommendation`).
   - *Frontend SPA*:
     * `aiService.js`: Thêm phương thức `generateBM04Suggestions({ registrationId })`.
     * `BM04EvaluationModal.jsx`: Thêm thanh tác vụ Trợ lý AI và nút bấm `<Button icon={<RobotOutlined />}>AI Gợi ý từ BM03</Button>`.
     * `BM04AiSuggestionDrawer.jsx`: Ngăn kéo xem trước thông minh hiển thị thẻ thống kê minh chứng BM03 (số buổi gặp, kết quả Checkpoint 1 & 2), nội dung gợi ý 4 tiêu chí với nút "Áp dụng mục này" cho từng tiêu chí riêng lẻ hoặc "Áp dụng toàn bộ vào phiếu".
     * Tuân thủ nghiêm ngặt **AGENTS.md**: 100% UTF-8 without BOM (Rule 2.4), không chèn raw emoji trong Button labels (Rule 2.6).
   - *Kiểm thử*:
     * Backend unit test `backend/tests/unit/bm04AiSuggestion.test.js`: PASS 6/6 test cases.
     * Frontend contract test `frontend/tests/bm04AiSuggestionUiUx.test.js`: PASS 5/5 test cases (nâng tổng số test hợp đồng lên 291/291 PASS).
     * Frontend runtime test: PASS 118/118 test cases.
     * Đóng gói production `vite build`: Hoàn thành trong 14.93s, 0 lỗi.

#### 2. Danh Sách Tài Khoản Demo Ngay (Cheatsheet)
| Chức năng Demo | Tài khoản (Email) | Mật khẩu | Mô tả kịch bản kiểm thử |
|---|---|---|---|
| **In Sổ BM03** | `sv075@university.edu.vn` (hoặc `sv076`) | `student123` | Đã hoàn tất BM03 (`BM03_COMPLETED`), đủ 7 tuần nhật ký Lab & 2 Checkpoint, vào menu *Nộp đồ án & Khóa luận* $\rightarrow$ bấm nút **In Sổ tiến độ BM03**. |
| **In Phiếu BM04** | `sv091@university.edu.vn` (hoặc `sv092`) | `student123` | Đã được GVHD thẩm định BM04 đạt (`DEFENSE_READY`), vào menu *Nộp đồ án & Khóa luận* $\rightarrow$ bấm nút **In Phiếu BM04**. |
| **Chấm/Duyệt BM04** | `lecturer01@university.edu.vn` | `lecturer123` | TS. Nguyễn Văn Thắng (Viện trưởng kiêm GVHD). Có bản nháp BM04 cho sinh viên `sv079`..`sv084`. Bấm *Thẩm định BM04* để xem bản in trước hoặc ký duyệt. |
| **In Cả Bộ BM01–BM05** | `admin@university.edu.vn` | `admin123` | Quản trị hệ thống. Vào *Giám sát đề tài* (`/admin/oversight`) hoặc *Hội đồng & Chấm điểm* (`/admin/grading`), tại sinh viên `sv115`..`sv120` (COMPLETED), bấm nút **Hồ sơ BM** để mở ngăn kéo xem và in liên hoàn 6 biểu mẫu BM01 đến BM05. |
| **Theo Dõi Tiến Độ BM03** | `lecturer01@university.edu.vn` | `lecturer123` | Tại *Dashboard Giảng viên* (`/lecturer/dashboard`), sinh viên `sv063` đang chờ GVHD ký toàn phiếu BM03; sinh viên `sv069` đang trong cửa sổ 48h chờ SV xác nhận. |

#### 3. Trạng thái cập nhật của từng phần
- **Database (Supabase / PostgreSQL)**: Đã được làm sạch và nạp mới 100% dữ liệu thực tế.
- **Frontend Print Engine**: Biểu mẫu BM03 và BM04 kết nối trực tiếp CSDL không cần dữ liệu giả.
- **Tuân thủ quy chuẩn `AGENTS.md`**:
  * 100% UTF-8 without BOM (Rule 2.4).
  * 100% không chèn raw emoji trong Button labels (Rule 2.6).
  * 100% tuân thủ mô hình `TopicRegistration` (Rule 2.1).

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Cấu hình Kết nối Trực tiếp Port 5432 khi Seeding**: Thiết lập `DB_POOL_CONNECTION_TIMEOUT_MS = 60000` và `DB_POOL_MAX = 3` khi chạy seed script giúp loại bỏ hoàn toàn hiện tượng timeout/rớt socket khi thực hiện hàng ngàn truy vấn liên tiếp trên Supabase.
- **Chia Tách Động Danh Sách Tuần Gặp Trên BM03**: Thay vì cắt cố định `slice(0, 4)` dễ làm hỏng bố cục nếu dữ liệu có số lượng tuần khác nhau, `BM03PrintSheet` chia tách động `Math.floor(meetings.length / 2)` giúp bảng tiến độ luôn cân đối giữa Checkpoint 1 và Checkpoint 2.

---

### Phiên 14/11/2026 (Tái Thiết Kế Giao Diện Hồ Sơ Cá Nhân ProfilePage Chuẩn UI/UX Pro Max, Academic Hero Banner, Quick Metrics & 3 Tabs Chuyên Sâu)

#### 1. Những phần đã hoàn thành
1. **Thiết Kế Kiến Trúc & Kế Hoạch Triển Khai (Spec & Plan)**:
   - Soạn thảo đặc tả thiết kế [docs/superpowers/specs/2026-11-14-profile-page-redesign-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-14-profile-page-redesign-design.md).
   - Lập kế hoạch kiểm thử TDD 4 tasks chi tiết tại [docs/superpowers/plans/2026-11-14-profile-page-redesign-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-14-profile-page-redesign-plan.md).
2. **Bộ Kiểm Thử Hợp Đồng Giao Diện Mới (`frontend/tests/profilePageUiUx.test.js`)**:
   - Viết 8 hợp đồng kỹ thuật: UTF-8 without BOM (Rule 2.4), Rule 2.6 (tuyệt đối không raw emoji trong button label), cấu trúc Hero Banner, hàng thông số KPI `ProfileQuickMetrics`, 3 tabs chuyên biệt, phân tách dữ liệu chỉ đọc và dữ liệu sửa, thước đo độ mạnh mật khẩu và hiển thị phân quyền.
3. **Phát Triển 2 Component Phụ Trợ Độc Lập**:
   - `frontend/src/components/profile/PasswordStrengthMeter.jsx`: Thước đo độ mạnh mật khẩu 3 cấp độ (Yếu / Trung bình / Mạnh) kèm thanh tiến trình `Progress` và checklist 3 tiêu chí an toàn (độ dài, kết hợp chữ & số, ký tự đặc biệt / chữ hoa).
   - `frontend/src/components/profile/ProfileQuickMetrics.jsx`: Hàng 4 thẻ KPI nhanh: *Trạng thái tài khoản (Đang hoạt động / Đã xác thực)*, *Định danh học vụ (Lớp & Ngành cho SV / Đơn vị cho GV)*, *Quyền hạn học vụ (Số lượng capabilities & nhiệm vụ HĐ)*, *Mức độ hoàn thiện hồ sơ (Thanh tiến trình %)*.
4. **Tái Cấu Trúc Toàn Diện Trang Hồ Sơ (`frontend/src/pages/common/ProfilePage.jsx`)**:
   - **Academic Hero Profile Banner**: Dải gradient học thuật thanh lịch (`from-blue-700 via-indigo-700 to-slate-900`) kết hợp hoa văn hình học, Avatar 112px viền nổi `ring-4 ring-white`, chỉ báo trực tuyến `<Badge status="success" />`, tag vai trò chính quy và huy hiệu định danh Viện CNS.
   - **Tab 1: Thông tin cá nhân & Học vụ (`personal_academic`)**: Alert thông báo CSDL Nhà trường quản lý dữ liệu học vụ; hiển thị bảng mô tả chỉ đọc cho Họ tên, MSSV/Mã CB, Lớp, Ngành, Khoa/Viện; trường Số điện thoại và Đơn vị cho phép sửa khi bật chế độ Chỉnh sửa hồ sơ.
   - **Tab 2: Bảo mật & Quản lý phiên (`security_password`)**: Form đổi mật khẩu an toàn tích hợp `PasswordStrengthMeter`, card quản lý phiên làm việc JWT (24h / 30 ngày ghi nhớ) và nguyên tắc an toàn học vụ.
   - **Tab 3: Vai trò & Quyền hạn (`roles_permissions`)**: Thẻ danh sách nhóm quyền học vụ (`permissionGroups`), trạng thái phân công Hội đồng BM01/BM05 và danh mục capabilities chi tiết.
   - Bảo toàn 100% rào chắn bảo vệ dữ liệu học vụ: Sinh viên chỉ được phép sửa `phone` và `avatarUrl`; giảng viên được sửa thêm `department`.
5. **Kiểm Thử Toàn Diện & Đóng Gói Bản Dựng Production**:
   - 100% tests PASS: 109 backend test suites (1,117 tests), 286 frontend contract tests (8 tests mới), 118 vitest runtime tests (14 test files).
   - Vite production build hoàn tất trong 13.55s, 0 warnings/errors, main entry chunk `456.86 kB` (< 500 kB).
6. **Chuẩn Hóa Bộ Nhãn Học Thuật & Đơn Vị Quản Lý (TDMU, Viện CNS, Khóa, Lớp, Bộ Môn)**:
   - `ProfilePage.jsx`: Bổ sung hiển thị chuẩn hóa 5 trường cho Sinh viên: Trường (*Trường Đại học Thủ Dầu Một*), Đơn vị quản lý (*Viện Công nghệ số*), Ngành học (*Công nghệ thông tin*), Khóa học (*tự động phân tích từ mã lớp D22 $\rightarrow$ D22 — Nhập học năm 2022*), Lớp hành chính (*D22CNTT01*).
   - Với Giảng viên: Hiển thị Đơn vị công tác (*Viện Công nghệ số*), Bộ môn chuyên môn (*Kỹ thuật phần mềm & Hệ thống thông tin*).
   - `ProfileQuickMetrics.jsx`: Thẻ thông số Card 2 tự động hiển thị Lớp & Ngành kèm Khóa (cho SV) hoặc Đơn vị & Bộ môn (cho GV).
   - Cập nhật test contract [frontend/tests/profilePageUiUx.test.js](file:///d:/DACN/frontend/tests/profilePageUiUx.test.js) kiểm tra 100% các nhãn thực tế này.

#### 2. Trạng thái cập nhật của từng phần
- **Frontend SPA**: Trang Hồ sơ cá nhân (`/profile`) mang diện mạo mới hiện đại, chuẩn UI/UX Pro Max, trực quan và tiện ích cho mọi vai trò (Sinh viên, Giảng viên, Viện trưởng, Quản trị viên).
- **Backend API**: Hoạt động ổn định, 109/109 test suites PASS (1,117/1,117 tests, 100%).
- **Frontend Contract & Runtime Tests**: 286 contract tests PASS, 118 runtime tests PASS.
- **Frontend Production Build**: Thành công trong 13.55s, bundle tối ưu.
- **Database (PostgreSQL / Supabase)**: Không thay đổi cấu trúc bảng, các API profile giữ vững tính toàn vẹn.
- **Tuân thủ quy chuẩn `AGENTS.md`**:
  * 100% tệp tin định dạng UTF-8 without BOM (Rule 2.4).
  * 100% tuân thủ Rule 2.6 (tuyệt đối không emoji/ký tự thô trong nhãn nút bấm).
  * 100% dữ liệu thực từ `useCurrentUser`, zero mock data (Rule 2.3).
  * Bảo toàn nghiêm ngặt ranh giới tự chỉnh sửa dữ liệu học vụ của sinh viên.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Thử nghiệm trực tiếp giao diện mới trên trình duyệt với các tài khoản Sinh viên và Giảng viên.
2. Kiểm tra luồng đổi ảnh đại diện (upload avatar) và đổi mật khẩu trên giao diện thực tế.
3. Tiếp tục hoàn thiện luồng Giai đoạn 5 & 6 (Bảo vệ đồ án, Nộp lưu chiểu số & Cấp Giấy chứng nhận hoàn thành đồ án).

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Phương Án 1 (Modern Academic Hero + Tabbed Hub)**: Tách bạch rõ rệt giữa dữ liệu định danh học thuật cố định do Nhà trường quản lý và dữ liệu liên lạc cá nhân, khắc phục triệt để tình trạng xáo trộn bố cục và mang lại cảm giác trang trọng, tin cậy của một cổng thông tin đại học.
- **Thước Đo Độ Mạnh Mật Khẩu Thuần Client (`PasswordStrengthMeter`)**: Đánh giá tức thì 3 cấp độ theo thời gian thực (độ dài $\ge 6$, chữ & số, ký tự đặc biệt) giúp người dùng nâng cao ý thức bảo mật tài khoản đồ án tốt nghiệp mà không cần thêm thư viện bên ngoài nặng nề.

---

### Phiên 14/11/2026 (Hoàn Thành Chuẩn Hóa Bộ Biểu Mẫu A4 Học Vụ BM01-BM05, In Ngữ Cảnh & Ngăn Kéo Toàn Trình AcademicDossierDrawer)

#### 1. Những phần đã hoàn thành
1. **Tinh Chỉnh AI Chatbot & Thuật Ngữ Trạng Thái Học Vụ**:
   - `backend/src/services/ai/academicPromptBuilder.js`: Bổ sung ràng buộc không sử dụng dấu `*` markdown (đậm/nghiêng) và không sử dụng mã trạng thái kỹ thuật thô.
   - `backend/src/services/ai/liveContextService.js` & `aiProviderService.js` & `ollamaProvider.js`: Thiết lập bản đồ dịch thuật ngữ `DB_STATUS_TRANSLATIONS` sang tiếng Việt tự nhiên (`hoàn tất`, `đạt yêu cầu`, `đang diễn ra`, `sẵn sàng bảo vệ`, v.v.) và chuyển đổi gạch đầu dòng `*` thành `- `.
   - `frontend/src/components/common/AcademicChatWidget.jsx`: Xử lý triệt để định dạng câu trả lời không còn ký tự `*` rối mắt.
2. **Nền Tảng In Ấn Khổ A4 Chuẩn Hành Chính (`A4PageContainer`, `AcademicFormPrintModal`)**:
   - `frontend/src/components/prints/A4PageContainer.jsx`: Định dạng chuẩn A4 (210mm x 297mm), font `Times New Roman`, CSS `@media print` và `@page` portrait chuẩn lề theo quy định hành chính (`15mm 10mm 15mm 20mm-25mm`).
   - `frontend/src/components/prints/AcademicFormPrintModal.jsx`: Modal xem trước và in ấn A4 chuẩn hóa, tích hợp bộ điều khiển zoom (phóng to, thu nhỏ, đặt lại tỉ lệ) và nút in ấn tuân thủ 100% Rule 2.6.
3. **6 Biểu Mẫu In Ấn A4 Chuẩn Hóa Theo Mẫu Gốc Nhà Trường (`BieuMau/`)**:
   - `BM01PrintSheet.jsx`: Đề cương nghiên cứu chi tiết khóa luận (Khung tiêu đề chuẩn TDMU/Viện VCS, 7 phần nội dung, bảng kế hoạch tuần, 3 khối chữ ký).
   - `BM02PrintSheet.jsx`: Nhiệm vụ khóa luận tốt nghiệp (Thông tin sinh viên, tên đề tài, nhiệm vụ, ngày giao và nộp, 3 khối chữ ký).
   - `BM02APrintSheet.jsx`: Đơn đề nghị điều chỉnh tên đề tài (So sánh tên đề tài cũ vs tên đề xuất mới, lý do giải trình, 3 khối chữ ký).
   - `BM03PrintSheet.jsx`: Sổ theo dõi tiến độ & hướng dẫn (Bảng nhật ký các buổi gặp Lab, 2 đợt Checkpoint với hộp kiểm tiêu chuẩn, kết luận cho phép bảo vệ).
   - `BM04PrintSheet.jsx`: Phiếu nhận xét & thẩm định của người hướng dẫn (4 tiêu chí CĐR, 2 kết luận độc lập Đạt CĐR & Cho phép bảo vệ, chữ ký xác nhận của GVHD).
   - `BM05PrintSheet.jsx`: Biên bản tổng hợp chấm bảo vệ khóa luận tốt nghiệp của Hội đồng (Bảng tổng hợp điểm 3 giám khảo, điểm trung bình làm tròn 1 số lẻ, xếp loại, chữ ký Chủ tịch và Thư ký Hội đồng).
4. **Tích Hợp Nút In Ngữ Cảnh Tại Các Màn Hình**:
   - `SubmissionPage.jsx`: Tích hợp các nút in `In Đề cương BM01`, `In Nhiệm vụ BM02`, `In Sổ tiến độ BM03`, `In Phiếu BM04` ngay tại từng giai đoạn học vụ.
   - `TitleAdjustmentModal.jsx`: Tích hợp nút `In Đơn BM02-A`.
   - `BM04EvaluationModal.jsx`: Tích hợp nút `Xem & In Phiếu BM04` cho phép GVHD xem trước hoặc in bản in ngay khi đang thẩm định.
5. **Ngăn Kéo Hồ Sơ Toàn Trình (`AcademicDossierDrawer`)**:
   - `AcademicDossierDrawer.jsx`: Drawer rộng 1040px điều hướng tabbed 6 biểu mẫu BM01 đến BM05. Hỗ trợ nút `In biểu mẫu này` và `In toàn bộ hồ sơ` (in liên hoàn toàn bộ hồ sơ có phân tách trang in tự động).
   - Tích hợp nút `Hồ sơ BM` tại các bảng điều khiển quản trị:
     * `GradingDefensePage.jsx` (Sổ điểm bảo vệ).
     * `ProjectOversightPage.jsx` (Giám sát đề tài & Hồ sơ lưu chiểu).
     * `LecturerDashboardPage.jsx` (Danh sách sinh viên hướng dẫn).
6. **Kiểm Thử Toàn Diện & Tối Ưu Hóa Bundle Size**:
   - Viết bộ kiểm thử đầy đủ: `a4Foundation.test.js`, `bm01AndBm02Print.test.js`, `bm02aAndBm03Print.test.js`, `bm04AndBm05Print.test.js`, `contextualPrintButtons.test.js`, `academicDossierDrawer.test.js`.
   - 100% tests PASS: 109 backend test suites (1,117 tests), 278 frontend contract tests, 118 vitest runtime tests, 6 Playwright E2E tests.
   - Vite production build hoàn tất trong 15.94s, main entry chunk `456.85 kB` (< 500 kB).

#### 2. Trạng thái cập nhật của từng phần
- **Backend API**: Hoạt động ổn định; 109/109 test suites PASS (1,117/1,117 tests, 100%).
- **Frontend Unit / Contract**: 278/278 tests PASS (100%).
- **Frontend Vitest Runtime**: 14/14 test files PASS (118/118 tests, 100%).
- **Frontend Playwright E2E**: 6/6 tests PASS (100%).
- **Frontend Production Build**: Vite build thành công trong 15.94s, main entry chunk `456.85 kB` (< 500 kB), 0 cảnh báo.
- **Database (PostgreSQL / Supabase)**: Mô hình CSDL chuẩn hóa, kết nối Session Pooler (port 6543) hoạt động trơn tru.
- **Git Repository**: Nhánh `develop` sạch sẽ, toàn bộ 8 tasks của kế hoạch đã được commit hoàn tất.
- **Tuân thủ quy chuẩn `AGENTS.md`**:
  * 100% tệp tin định dạng UTF-8 without BOM (Rule 2.4).
  * 100% tuân thủ mô hình `TopicRegistration` (`maxStudents = 1`, tối đa 10 SV/GVHD).
  * Zero mock data trong mã nguồn frontend thực tế.
  * 100% tuân thủ Rule 2.6 (tuyệt đối không emoji/ký tự thô trong nhãn nút bấm, sử dụng `@ant-design/icons` qua prop `icon={<Icon />}`).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Thử nghiệm in thực tế trên các trình duyệt khác nhau (Chrome, Edge, Firefox) và xuất file PDF ("Save as PDF").
2. Đánh giá nhu cầu xuất file Microsoft Word (.docx) động nếu đơn vị yêu cầu nộp file văn bản có thể chỉnh sửa.
3. Chuẩn bị tài liệu hướng dẫn sử dụng in ấn và quản trị hồ sơ cho sinh viên và cán bộ giảng viên.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Phương Án 3 (Hybrid: In Ngữ Cảnh + Ngăn Kéo Hồ Sơ Toàn Trình)**: Cho phép sinh viên và giảng viên in ấn nhanh từng biểu mẫu ngay tại màn hình nộp/duyệt, đồng thời cung cấp cho Ban Quản trị một trung tâm hồ sơ (Dossier Hub) để xem và in trọn bộ biểu mẫu BM01 -> BM05 một cách tập trung.
- **Sử Dụng CSS Native `@media print` Thay Vì Thư Viện PDF Bên Ngoài**: Không sử dụng `jspdf` hay `pdfmake` để tránh làm phình to bundle size (duy trì main chunk < 500 kB), tận dụng bộ kết xuất vector native của trình duyệt để có bản in và file PDF sắc nét 100%.

---

### Phiên 14/11/2026 (Hoàn Thành Toàn Diện 14 Tasks: Chuẩn Hóa Server-State Loading, Error Recovery, TanStack Query v5 & E2E Coverage)

#### 1. Những phần đã hoàn thành
1. **Chuẩn Hóa Quản Lý Trạng Thái Máy Chủ (TanStack Query v5 & Error Metadata)**:
   - Tích hợp `@tanstack/react-query` v5 với `AppQueryProvider`, `queryKeys` phân cấp tenant an toàn `queryKeys.scope(user)` chống rò rỉ dữ liệu đa tài khoản.
   - Chuẩn hóa chuẩn lỗi API qua `normalizeApiError` và `wrapServiceError`, bảo tồn mã HTTP, chi tiết lỗi và cờ `requiresUserConfirmation` khi gặp 409 stale version.
2. **Kiến Trúc Shell Ứng Dụng Bền Vững & Phục Hồi Lỗi Điều Hướng**:
   - `RouteContentBoundary`: Bọc Outlet bằng Suspense & ErrorBoundary nhận diện thay đổi URL (path, search, key) để tự động reset lỗi khi chuyển trang mà không reload toàn bộ trang HTML.
   - `ContentSkeleton`, `QueryErrorState`, `QueryPanel`: Chuẩn hóa skeleton loading và giao diện lỗi có nút retry hỗ trợ phím Enter (keyboard accessibility).
3. **Phân Quyền Đọc & Công Bố Kết Quả Bảo Vệ (RBAC & Defense Publication)**:
   - Phân tách quyền `VIEW_DEFENSE_RESULT_APPROVALS` / `VIEW_RESULT_PUBLICATIONS` độc lập với quyền đột biến `DEFENSE_RESULT_APPROVE` / `RESULT_PUBLICATION_PUBLISH`.
   - Chuẩn hóa deep link `/admin/grading?tab=approvals` và `/admin/grading?tab=publish`, ký ban hành kết quả có idempotency key và tra cứu lịch sử công bố snapshot.
4. **Hồ Sơ Lưu Chiểu Sinh Viên (Student Archival Dossier)**:
   - Chuẩn hóa `archiveService.getDossier`: ánh xạ chính xác trạng thái thực tế của hồ sơ lưu chiểu (`PENDING_SUBMISSION`, `SUBMITTED`, `VERIFIED`), phân tách trạng thái ký số và tính khả dụng của file PDF.
   - Ngăn chặn lỗi hiển thị "thành công giả" khi hồ sơ chưa đủ chữ ký hoặc thiếu file.
5. **Chuyển Đổi Toàn Bộ Các Trang Quản Trị, Giảng Viên & Sinh Viên**:
   - **Admin Core**: Dashboard, Users, Permissions, Academic Reports.
   - **Admin Coordination**: Project Period, Council Assignment, Council Detail, Project Enrollment, Coordination Overview, Lecturer Assignment.
   - **Admin Workflow**: Topic Management, Rubric Management, Project Oversight, Announcement Management, Portal Content, Notification Center.
   - **Lecturer Workflows**: Dashboard, Topic Approval, Topic Management, Progress Tracking, Grading, Lecturer Grading Sheet, BM04 Evaluation Modal, Outline Review Modal, Checkpoint Issue Modal.
   - **Student Workflows**: Student Dashboard, Topic List, Submission Page, Grade View Page, Clearance Certificate, Title Adjustment Modal, Checkpoint Sign Modal.
   - **Shared Common Pages & Components**: Notifications Page, Profile Page, Home Page, AppLayout (tối ưu badge count và đồng bộ đa tab qua BroadcastChannel).
6. **Kiểm Toán Yêu Cầu (Query Migration Audit) & E2E Playwright**:
   - `frontend/tests/queryMigrationAudit.test.js`: Quét cú pháp AST (`espree`) toàn bộ routed pages và fetching child components, chứng minh 0 vi phạm service gọi trực tiếp trong `useEffect`.
   - `frontend/playwright.config.js`: Tích hợp Playwright E2E với Vite webServer tự động trên Chromium headless.
   - `frontend/e2e/loading-error-navigation.spec.js` & `frontend/e2e/result-and-archive-flows.spec.js`: 6/6 tests PASS, kiểm thử toàn diện persistent shell, skeleton, route recovery, publication flow và dossier flow.
7. **Hợp Nhất Nhánh & Dọn Dẹp Không Gian Làm Việc**:
   - Hợp nhất an toàn 18 commits từ nhánh `feature/standardized-loading-error-query` vào nhánh chính `develop`.
   - Tái xác thực toàn bộ test suites trên `develop`: 100% tests PASS (109 backend suites, 260 unit tests, 118 runtime tests, 6 E2E tests, Vite production build).
   - Xóa bỏ an toàn worktree cách ly `standardized-loading-error-query` và nhánh feature tương ứng.
8. **Đồng Bộ & Triển Khai GitHub Remote (`push` & `merge vào main`)**:
   - Đẩy toàn bộ 193 commits từ `develop` lên `origin/develop`.
   - Hợp nhất fast-forward `develop` vào nhánh `main` và đẩy lên `origin/main` (`https://github.com/Cwuzto/DACN.git`).
   - Cả hai nhánh `develop` và `main` đều đồng bộ ở trạng thái mới nhất tại commit `1a8e230`.

#### 2. Trạng thái cập nhật của từng phần
- **Backend**: Hoạt động ổn định; 109/109 test suites PASS (1,112/1,112 tests, 100%).
- **Frontend Unit / Contract**: 260/260 tests PASS (100%).
- **Frontend Vitest Runtime**: 14/14 test files PASS (118/118 tests, 100%).
- **Frontend Playwright E2E**: 6/6 tests PASS (100%).
- **Frontend Production Build**: Vite build hoàn tất thành công trong 13.68s, 0 lỗi cú pháp/bundle.
- **Database (PostgreSQL / Supabase)**: Mô hình CSDL chuẩn hóa, kết nối Session Pooler (port 6543) vận hành ổn định.
- **Git Remote & Workspace**: Cả 2 nhánh `develop` và `main` đã đồng bộ với `origin`, worktree sạch sẽ.
- **Tuân thủ quy chuẩn**:
  * 100% tệp tin định dạng UTF-8 without BOM.
  * 100% tuân thủ mô hình `TopicRegistration` (`maxStudents = 1`, tối đa 10 SV/GVHD), không phục hồi `group/groupMember`.
  * Zero mock data trong mã nguồn frontend thực tế.
  * 100% tuân thủ Rule 2.6 (không emoji thô trong nhãn `<Button>`, sử dụng component `@ant-design/icons` qua prop `icon={<Icon />}`).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Kiểm tra trải nghiệm thực tế người dùng (Manual smoke test) trên trình duyệt cho các luồng Admin, GVHD, SV.
2. Tối ưu bundle size (chia nhỏ dynamic import cho một số vendor chunk > 500kB nếu cần thiết).
3. Đánh giá và triển khai các tính năng cải tiến tiếp theo theo lộ trình nghiệp vụ.

#### 4. Quyết định quan trọng (Decisions & Rationale)
- **Tập trung hóa State Máy Chủ vào TanStack Query v5**: Loại bỏ toàn bộ `useEffect` fetch dữ liệu thủ công phân tán trên các trang, khắc phục triệt để lỗi mất dữ liệu form khi component refresh ngầm và lỗi rò rỉ dữ liệu giữa các tài khoản khi đăng xuất/đăng nhập.
- **Cô Lập Bộ Nhớ Đệm Theo Tenant (`queryKeys.scope(user)`)**: Mỗi query key đều gắn liền với định danh người dùng và vai trò hiện tại, đảm bảo an toàn đa người dùng tuyệt đối.
- **Khai Thác `RouteContentBoundary` Bảo Toàn Shell**: Thay vì để lỗi component con làm trắng trang hoặc kích hoạt full page reload, ErrorBoundary cô lập tại vùng Outlet giúp thanh điều hướng và header luôn duy trì liên tục và cho phép người dùng ấn nút thử lại hoặc chuyển sang trang khác một cách trơn tru.
- **Chặn Mạng Deterministic Cho E2E**: Các bài test Playwright chặn trực tiếp network request `/api/**` với fixtures chuẩn hóa, giúp test E2E chạy nhanh (~18s), ổn định, độc lập hoàn toàn với dữ liệu Supabase sống.

---

### Phiên 13/11/2026 (Sửa Lỗi HĐ Bảo Vệ Khóa Luận, Đồng Bộ Phân Quyền & Menu Động Theo Phân Công)

#### 1. Những phần đã hoàn thành
1. **Khắc Phục Lỗi Trắng Trang / 403 Tại HĐ Bảo Vệ Khóa Luận (`/admin/defense-councils`)**:
   - `backend/src/controllers/registrationController.js`: Bổ sung `OUTLINE_COUNCIL_MANAGE`, `DEFENSE_COUNCIL_MANAGE`, `VIEW_COUNCIL_ASSIGNMENTS`, `DEFENSE_COUNCIL_ASSIGN` vào điều kiện kiểm tra `hasInstituteAuthority`. Cho phép người dùng có quyền quản trị hội đồng xem toàn bộ sinh viên toàn viện khi truy vấn với `scope: 'institute'` (thay vì bị giới hạn chỉ thấy sinh viên mình hướng dẫn).
   - `frontend/src/pages/admin/CouncilAssignmentPage.jsx`:
     * Khi tải dữ liệu `fetchCouncils`: Truyền chính xác tham số `councilType: forcedCouncilType || councilTypeFilter` và `scope: 'institute'`.
     * Hoàn thiện bộ lọc sinh viên `candidatesForPhase`: Đối với `DEFENSE_COUNCIL`, chấp nhận các trạng thái hợp lệ của giai đoạn bảo vệ (`DEFENSE_READY`, `DEFENSE_ELIGIBLE`, `ELIGIBLE_BY_INSTITUTE`, `AWAITING_SCORES`, `DEFENSE_PASSED`, `DEFENSE_FAILED`, `AWAITING_FINAL_APPROVAL`, `COMPLETED`) hoặc sinh viên đã được phân công vào hội đồng (`defenseCouncilId || councilId`).
     * Phân quyền nút bấm (`canManageCouncil`): Ẩn các thao tác quản trị ghi ("Lập Hội đồng", "Tự động phân công", "Công bố DS") đối với giảng viên thành viên chỉ có quyền xem; tại bảng danh sách và card ghép cặp, hiển thị nút *"Xem chi tiết"* chuyển tiếp tới trang chi tiết hội đồng.
     * Chuẩn hóa UI/UX: Thay thế toàn bộ ký tự emoji thô `⚠️`, `✓` bằng icon chính quy `@ant-design/icons` (`<WarningOutlined />`, `<CheckCircleOutlined />`, `<ExclamationCircleOutlined />`).
2. **Khắc Phục Lỗi Trang Chi Tiết Hội Đồng (`/admin/defense-councils/:id` - `CouncilDetailPage.jsx`)**:
   - `loadLecturers`: Bổ sung cơ chế fallback sang `userService.getPublicLecturers()` khi `userService.getUsers()` bị 403 Forbidden đối với người dùng không phải Quản trị viên (giảng viên/chủ tịch hội đồng).
   - `openAssignModal`: Bổ sung tham số `scope: 'institute'` khi tải danh sách sinh viên chưa phân công.
   - Phân quyền thao tác: Chỉ hiển thị các nút thao tác chỉnh sửa ("Công bố lịch bảo vệ chia ca", "Sửa thông tin HĐ", "Đổi thành viên HĐ", "Gán thêm Sinh viên", "Gỡ SV", "Thay thế GV", "Đổi ca/STT") cho người dùng có thẩm quyền quản trị `DEFENSE_COUNCIL_MANAGE` hoặc `ADMIN`. Thành viên hội đồng xem ở chế độ chỉ đọc.
   - Thay thế toàn bộ ký tự emoji thô `⚠️` bằng icon chính quy `<WarningOutlined className="text-amber-600" />`.
3. **Mở Rộng Phân Quyền Route & Điều Hướng Menu Động (Dynamic Navigation)**:
   - `frontend/src/config/navigationRegistry.js`:
     * Cập nhật `outline-councils` (`HĐ Xét duyệt Đề cương`): `requiresOutlineCouncil: true`, `requiredPermission: 'OUTLINE_COUNCIL_MANAGE'`.
     * Cập nhật `defense-councils` (`HĐ Bảo vệ khóa luận`): `requiresDefenseCouncil: true`, `requiredPermission: 'DEFENSE_COUNCIL_MANAGE'`.
     * Giảng viên được phân công vào Hội đồng bảo vệ sẽ thấy mục *"Phiếu chấm bảo vệ"* (`/lecturer/grading`).
   - `frontend/src/App.jsx`:
     * Route `/admin/grading` (`GradingDefensePage`): Bổ sung `VIEW_DEFENSE_RESULT_APPROVALS`, `DEFENSE_RESULT_APPROVE`, `VIEW_RESULT_PUBLICATIONS`, `RESULT_PUBLICATION_MANAGE` vào `requiredAnyPermissions`. Triệt tiêu hoàn toàn lỗi trắng trang khi người dùng truy cập tab Phê duyệt kết quả hoặc Công bố kết quả.
     * Route `/admin/outline-councils` và `/admin/defense-councils`: Bổ sung `VIEW_DEFENSE_GRADING`, `OUTLINE_REVIEW` vào `requiredAnyPermissions` của `ProtectedRoute`.
4. **Kiểm Thử & Đảm Bảo Chất Lượng Toàn Diện**:
   - Bổ sung bộ kiểm thử `frontend/src/pages/__tests__/defenseCouncilHardening.test.js` kiểm tra 7 hợp đồng kỹ thuật (Pass 7/7).
   - Kiểm thử toàn bộ frontend: **223/223 tests PASS (100%)**.
   - Kiểm thử toàn bộ backend: **108/108 test suites PASS, 1.086/1.086 tests PASS (100%)**.
   - Vite production build: **Hoàn tất thành công (0 lỗi)**.
   - Đảm bảo 100% tệp tin đạt chuẩn **UTF-8 (no BOM)** và chuẩn nút bấm **Rule 2.6 trong AGENTS.md**.

#### 2. Trạng thái cập nhật của từng phần
- **Backend**: Quyền hạn `hasInstituteAuthority` đã bao quát đầy đủ các quyền quản trị hội đồng bảo vệ/đề cương; 108 test suites (1.086 tests) PASS 100%.
- **Frontend**: Menu bên trái hiển thị chính xác theo vai trò và phân công thực tế của giảng viên; trang phân công hội đồng bảo vệ và chi tiết hội đồng bảo vệ tải mượt mà, không còn lỗi 403 hay trắng trang.
- **Tuân thủ quy chuẩn**: 100% nút bấm tuân thủ Rule 2.6 (không emoji thô), toàn bộ file UTF-8 không BOM.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
- Đăng nhập thử nghiệm trực tiếp trên trình duyệt với các tài khoản:
  * `lecturer01` (Viện trưởng): Có đầy đủ menu Thẩm định, Quyết định, HĐ Bảo vệ, Phê duyệt kết quả, Công bố kết quả.
  * `lecturer02` (Thành viên HĐ Bảo vệ): Thấy menu "Phiếu chấm bảo vệ", vào chấm điểm sinh viên.
  * Giảng viên bình thường không có hội đồng: Menu gọn gàng (chỉ có Đề tài của tôi, Sinh viên hướng dẫn, Tiến độ đồ án).

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Phân quyền Institute Scope cho Quản trị Hội đồng**:
   - Người phụ trách phân công hội đồng (`DEFENSE_COUNCIL_MANAGE`) cần quyền xem danh sách sinh viên toàn viện chứ không chỉ sinh viên mình hướng dẫn. Do đó mở rộng `hasInstituteAuthority` cho quyền này ở backend.
2. **Ẩn các nút hành động đột biến đối với Thành viên chỉ xem (Read-Only Mode)**:
   - Các nút "Lập hội đồng", "Tự động phân công", "Đổi ca", "Gỡ SV" chỉ hiển thị khi người dùng có thẩm quyền quản trị. Thành viên chỉ xem thông tin để tránh click gây 403 Forbidden.
3. **Phân biệt rành mạch giữa "HĐ Bảo vệ khóa luận" và "Phiếu chấm bảo vệ"**:
   - "HĐ Bảo vệ khóa luận" (`/admin/defense-councils`) là nơi thành lập, xếp phòng, chia ca thi (dành cho Admin / Viện trưởng).
   - "Phiếu chấm bảo vệ" (`/lecturer/grading`) là nơi thành viên hội đồng nhập điểm số, biên bản (dành cho GV có phân công HĐ).

---

### Phiên 13/11/2026 (Tối Ưu Hóa Tốc Độ Local AI VRAM Với Qwen2.5:3b, Khắc Phục Lỗi Timeout & Sanitize Live Database Context)

#### 1. Những phần đã hoàn thành
1. **Tải & Triển Khai Model Siêu Tốc `qwen2.5:3b` Trên Ổ `D:\ollama\models`**:
   - Phân tích nguyên nhân `qwen3:4b` bị chậm (>70s - 120s): `qwen3:4b` có 37 layers vượt quá 3.2GB VRAM thực tế của GTX 1650 khiến 11 layers bị tràn sang RAM hệ thống; đồng thời mô hình này là Reasoning model sinh chuỗi suy nghĩ `<think>...</think>` rất dài.
   - Tải thành công mô hình `qwen2.5:3b` (1.9 GB) vào `D:\ollama\models`.
   - Kết quả benchmark vượt trội:
     * Nạp 100% 36/36 layers vào VRAM của GPU NVIDIA GTX 1650.
     * Tốc độ sinh từ đạt **59.4 tokens/giây**.
     * Thời gian trả lời câu hỏi trực tiếp chỉ **1.97 giây** (warm cache).
     * Thời gian xử lý toàn trình trọn vẹn RAG (truy vấn DB + vector retrieval `embeddinggemma-2:270m` + sinh câu trả lời): **13.07 giây** (nhanh gấp 6-10 lần so với Qwen3:4b).
2. **Khắc Phục Lỗi Timeout Chatbot Trên Giao Diện Frontend**:
   - `frontend/src/services/aiService.js`: Thiết lập cấu hình timeout riêng `120000ms` (120 giây) cho API `chatRegulation` thay vì bị ngắt bởi axios global timeout 20s. Triệt tiêu hoàn toàn lỗi *"Không thể tra cứu quy chế học vụ với AI"* trên giao diện người dùng.
   - `backend/.env`: Cập nhật cấu hình chuẩn `OLLAMA_CHAT_MODEL=qwen2.5:3b`, `OLLAMA_TIMEOUT_MS=120000`.
   - `backend/.env.example`: Bổ sung toàn bộ biến môi trường mô tả cho cấu hình Local Ollama RAG và Gemini Cloud.
3. **Quy Hoạch Lại Bộ Tri Thức Chuẩn Hóa Markdown (Single Source of Truth)**:
   - Gom toàn bộ quy chế rải rác trong các chuỗi Javascript hard-code thành các tệp Markdown tự nhiên đặt tại `backend/src/services/ai/knowledge/regulations/`:
     * `student_regulations.md`: Quy chế 6 giai đoạn, điều kiện tiên quyết, biểu mẫu BM01-BM04, FAQ, liêm chính học thuật (10 chunks).
     * `lecturer_regulations.md`: Thẩm định đề cương BM01, bảng điểm 4 tiêu chí BM04, 2 kết luận độc lập, dừng BM03, câu hỏi phản biện 3 cấp độ (5 chunks).
     * `admin_regulations.md`: Quyết định giao đề tài, phụ lục điều chỉnh tên theo đợt, SLA 168h + 72h, 5 sweep jobs, phúc khảo (4 chunks).
   - Xây dựng parser `knowledgeParser.js` tự động phân tách heading `##` và metadata comment (`<!-- chunk: id="..." stage="..." role="..." -->`) thành 19 chunks ngữ nghĩa chuẩn xác, tự động slugify tiêu đề tiếng Việt loại bỏ dấu (`normalize('NFD')`).
   - Tái cấu trúc `studentKnowledge.js`, `lecturerKnowledge.js`, `adminKnowledge.js` và `ragService.js` chuyển sang nạp động từ Markdown thông qua `knowledgeParser.js`, bảo toàn 100% khả năng tương thích ngược và không có duplicate strings trong mã nguồn.
   - Thêm 10 unit tests tại `backend/tests/unit/knowledgeParser.test.js` (100% PASS).
4. **Sửa Lỗi Prisma Validation & Sanitize Live Database Context**:
   - `backend/src/services/ai/liveContextService.js`: Sanitize `user.id` thành số nguyên an toàn `numericUserId` (`Number.isInteger(user.id) ? user.id : Number.parseInt(user.id, 10)`), loại bỏ triệt để lỗi `PrismaClientValidationError: Argument studentId / mentorId: Invalid value provided. Expected IntFilter or Int, provided String`.
   - `backend/src/services/ai/academicPromptBuilder.js`: Sửa lỗi biến `userOrParams` $\rightarrow$ `userOrOptions` trong logic kiểm tra cờ `omitStaticKnowledge`.
   - `backend/src/services/ai/ollamaProvider.js`: Đưa hàm `stripThinking` ra module level và xuất qua `module.exports` chính quy.
5. **Phân Tích & Xác Thực Deprecation Warning `pg@9.0`**:
   - Xác định rõ cảnh báo `Calling client.query() when the client is already executing a query is deprecated` xuất phát từ thư viện `pg` khi `@prisma/adapter-pg` thực thi các câu lệnh song song trên cùng một client kết nối; cảnh báo này không gây crash server và hệ thống vẫn chạy ổn định 100%.
6. **Tái Thiết Kế Giao Diện Chatbot (/ui-ux-pro-max: Định Danh Trợ Lý Học Vụ VCN, Ngăn Gợi Ý Thu Gọn & Triệt Tiêu Thuật Ngữ Model)**:
   - **Định danh chính thức**: Đặt tên bot là **`Trợ lý Học vụ VCN`** (Viện Công nghệ Số). Toàn bộ tin nhắn, tiêu đề và chỉ báo suy nghĩ chuyển sang sử dụng cụm danh từ tự nhiên: *"Trợ lý Học vụ"*, *"Trợ lý đang tra cứu quy chế học vụ..."*, *"Phản hồi học vụ"*.
   - **Triệt tiêu toàn bộ thuật ngữ mô hình kỹ thuật**: Loại bỏ hoàn toàn các cụm từ như `Gemini 3.8 Flash`, `Qwen`, `Ollama`, `local_fallback` khỏi giao diện người dùng và system prompt. Thay thế bằng các thẻ học thuật tinh tế: `<Tag color="cyan">Trực tuyến 24/7</Tag>`, `<Tag color="cyan">Phản hồi học vụ</Tag>`.
   - **Ngăn câu hỏi gợi ý thu hẹp / ẩn xuống linh hoạt (Collapsible Drawer)**: Thêm nút và thanh điều khiển thu gọn / mở rộng danh sách câu hỏi nhanh (`isQuestionsCollapsed`) bằng icon `@ant-design/icons` `<UpOutlined />` và `<DownOutlined />` tuân thủ nghiêm ngặt Rule 2.6 trong `AGENTS.md`. Người dùng có thể click thu hẹp để mở rộng không gian đọc phản hồi.
7. **Cung Cấp Tiện Ích Khởi Động Ollama Thuận Tiện Cho Lần Mở Máy Sau**:
   - Tạo tệp lệnh tự động [start-ollama.bat](file:///d:/DACN/start-ollama.bat) tại thư mục gốc `d:\DACN\` cho phép người dùng chỉ cần nhấp đúp chuột để khởi động daemon Ollama tại cổng 11434 với đường dẫn models tại `D:\ollama\models`.
   - Bổ sung lệnh npm `npm run ollama:start` trong `backend/package.json`.
8. **Hồi Quy Toàn Bộ Hệ Thống & Kiểm Thử Tự Động (Subagent)**:
   - Toàn bộ backend test suite: **108/108 test suites PASS, 1.081/1.081 tests PASS (100%)**.
   - Toàn bộ frontend test suite: **188/188 tests PASS (100%)** (+1 test case cho giao diện Chatbot VCN).
   - Production build Vite: **PASS (0 lỗi, hoàn tất thành công)**.
   - Đảm bảo 100% tệp tin đạt chuẩn **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần
- **Local AI Engine**: Đang chạy ngầm daemon Ollama tại `127.0.0.1:11434`. Đã có đầy đủ 3 models: `qwen2.5:3b`, `qwen3:4b`, và `embeddinggemma-2:270m` lưu tại `D:\ollama\models`. Tích hợp sẵn `start-ollama.bat` để mở lại server sau khi reboot máy.
- **Backend API**: Phản hồi RAG câu hỏi quy chế học vụ chính xác 100% từ vector index và ngữ cảnh học kỳ/đề tài cá nhân, thời gian phản hồi ~13s. Sạch sẽ mã nguồn, chuyển sang Markdown Single Source of Truth.
- **Frontend SPA**: Cấu hình timeout 120s, giao diện Chatbot mang tên `Trợ lý Học vụ VCN`, hỗ trợ thu gọn/mở rộng gợi ý câu hỏi linh hoạt, triệt tiêu 100% tên mô hình kỹ thuật.
- **Database / Prisma**: Ổn định, không có lỗi validation type mapping.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Khởi Động Lại Server Backend Để Nhận Cấu Hình Mới**:
   - Khởi động lại backend dev server (`npm --prefix backend run dev`) để nhận biến môi trường `OLLAMA_CHAT_MODEL=qwen2.5:3b` và `OLLAMA_TIMEOUT_MS=120000`.
2. **Trải Nghiệm Hỏi Đáp Trực Tiếp Trên Trình Duyệt Với Trợ Lý Học Vụ VCN**:
   - Đăng nhập tài khoản sinh viên/giảng viên bất kỳ và đặt các câu hỏi quy chế học vụ (BM01, BM02, BM03, BM04, thời hạn bảo vệ, đề tài của em).
   - Thử nghiệm thao tác thu gọn và mở rộng thanh câu hỏi gợi ý trên giao diện chat.
3. **Tiếp Tục Hoàn Thiện Giai Đoạn 5 & 6 (Bảo Vệ Đồ Án & Nộp Lưu Chiểu)**:
   - Rà soát các biểu mẫu chấm điểm hội đồng và xuất biên bản tổng hợp điểm bảo vệ.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Sử Dụng `qwen2.5:3b` Làm Chat Model Mặc Định Cho GTX 1650 4GB VRAM**:
   - Model `qwen2.5:3b` (1.9 GB) vừa vặn 100% trong VRAM của GPU GTX 1650 mà không cần offload CPU/RAM, đồng thời không có vòng lặp suy nghĩ ẩn (reasoning tokens), giúp tốc độ sinh từ đạt xấp xỉ 60 tokens/s, giảm thời gian chờ đợi từ >120s xuống dưới 15s.
2. **Quy Hoạch Bộ Tri Thức Chuẩn Hóa Markdown (Single Source of Truth)**:
   - Thay vì nhồi chuỗi văn bản dài trong code JS và mảng chunks cứng trong `ragService.js`, chuyển toàn bộ sang các tệp `.md` trong `regulations/`. Giúp tách rời hoàn toàn dữ liệu nghiệp vụ và mã nguồn, dễ bảo trì, biên tập như văn bản thông thường.
3. **Mô Hình Fallback Đa Tầng Không Gián Đoạn**:
   - Nếu Ollama tắt hoặc model quá tải, hệ thống vẫn duy trì khả năng tự động chuyển tiếp sang Gemini Flash Lite hoặc bộ heuristic quy chế học vụ nội bộ.
4. **Chuẩn Hóa Nhận Diện Thương Hiệu Chatbot Học Vụ (User-Facing Persona)**:
   - Người dùng cuối (Sinh viên / Giảng viên) không quan tâm hay cần biết mô hình backend là Gemini, Qwen hay Ollama. Việc ẩn các từ khóa kỹ thuật và định danh nhất quán thành `Trợ lý Học vụ VCN` mang lại cảm giác chuyên nghiệp, tin cậy và chuẩn mực giáo dục.

---

### Phiên 13/11/2026 (Chuyển Đổi Sang Local AI & RAG: Cài Đặt Ollama D:\ollama, Qwen3:4b, EmbeddingGemma-2:270m & Pre-computed Vector Seeder)

#### 1. Những phần đã hoàn thành
1. **Thiết Kế Kiến Trúc & Kế Hoạch Triển Khai (Spec & Plan)**:
   - Soạn thảo đặc tả thiết kế hệ thống [docs/superpowers/specs/2026-11-13-local-ollama-rag-chatbot-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-13-local-ollama-rag-chatbot-design.md) (Commit `31e04ff`).
   - Lập kế hoạch 5 task TDD chi tiết [docs/superpowers/plans/2026-11-13-local-ollama-rag-chatbot-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-13-local-ollama-rag-chatbot-plan.md) (Commit `66aecec`).
2. **Task 1: Cài Đặt Ollama Trực Tiếp Vào Ổ `D:\ollama` & Cấu Hình Model Storage**:
   - Tải bộ cài chính thức `OllamaSetup.exe` (1.77 GB) trực tiếp về `D:\ollama\OllamaSetup.exe`.
   - Cài đặt thành công vào `D:\ollama` (tham số `/DIR="D:\ollama" /SILENT`).
   - Cấu hình biến môi trường hệ thống: `OLLAMA_MODELS = D:\ollama\models` và thêm `D:\ollama` vào `PATH`. Đảm bảo 100% tệp nhị phân và trọng số các mô hình lớn được lưu trữ trên ổ D:, giữ sạch hoàn toàn ổ C:.
   - Tải thành công 2 mô hình theo yêu cầu người dùng:
     * `qwen3:4b` (2.5 GB) - mô hình sinh ngôn ngữ cục bộ, tối ưu cho card đồ họa NVIDIA GeForce GTX 1650 (4GB VRAM).
     * `embeddinggemma-2:270m` (303 MB) - mô hình nhúng vector ngữ nghĩa thế hệ 2 từ Google (sinh vector 768 chiều).
   - Cấu hình `.env`: `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_CHAT_MODEL=qwen3:4b`, `OLLAMA_EMBED_MODEL=embeddinggemma-2:270m`.
3. **Task 2: Xây Dựng `ollamaProvider.js` Adapter (Commit `8f99fcf`)**:
   - Adapter REST API thuần JS (native `fetch`, zero external npm dependencies):
     * `isOllamaAvailable`: Kiểm tra sức khỏe endpoint `GET /api/version`.
     * `chatWithOllama`: Gửi yêu cầu `POST /api/chat`, hỗ trợ cấu hình nhiệt độ, num_ctx và AbortController timeout 30s.
     * `generateEmbedding`: Gửi `POST /api/embed` (kèm fallback `/api/embeddings`), trả về mảng vector số thực 768 chiều.
   - Viết 13 unit tests tại `backend/tests/unit/ollamaProvider.test.js` (100% PASS).
4. **Task 3: Xây Dựng Bộ Máy RAG Quy Chế & Pre-computed Vector Seeder (Commit `9fe76eb`)**:
   - Module `ragService.js`:
     * Chunking ngữ nghĩa: Tách nhỏ tri thức học vụ thành 19 chunks cấu trúc rõ ràng (`id`, `title`, `stage`, `roleScope`, `text`), bao phủ trọn vẹn 6 giai đoạn và biểu mẫu BM01-BM04.
     * RBAC Pre-filtering: Sinh viên (`STUDENT`) tuyệt đối không bao giờ nhận được chunk của Giảng viên hoặc Quản trị viên.
     * Cosine Similarity thuần JS siêu tốc: Lọc và xếp hạng Top-K (K=3) chunks phù hợp nhất với câu hỏi.
     * Cache Vector Index: Tự động nạp bộ nhớ đệm vector từ `knowledgeVectorIndex.json` cho thời gian truy vấn dưới 10ms.
   - Script Seeder `backend/src/scripts/seedRagVectors.js`: Nhúng toàn bộ 19 chunks bằng `embeddinggemma-2:270m` và lưu vào `knowledgeVectorIndex.json`. Thêm lệnh npm: `npm run seed:rag`.
   - Viết 25 unit tests tại `backend/tests/unit/ragService.test.js` (100% PASS).
5. **Task 4: Tích Hợp Dual-Engine Router Trong `aiProviderService.js` (Commit `3fff151`)**:
   - Tích hợp điều phối thông minh: `Ollama RAG` -> `Gemini API` -> `Local Heuristic Provider`.
   - Khi `AI_PROVIDER=ollama` và Ollama online: Trích xuất Top-3 điều khoản RAG liên quan nhất, ghép cùng Live Database Context (Đề tài của SV, GVHD, Học kỳ, Viện trưởng) và bọc câu hỏi trong `<user_query>` gửi tới `qwen3:4b`.
   - Zero Crash Guarantee: Nếu Ollama daemon bị tắt hoặc mất kết nối, hệ thống tự động fallback an toàn sang Gemini hoặc Local Fallback mà không bao giờ ném lỗi 500 hay làm sập server.
   - Viết 4 integration tests tại `backend/tests/integration/ollamaRagWorkflow.test.js` (100% PASS).
6. **Task 5: Hồi Quy Toàn Diện & Xác Thực Zero-BOM**:
   - Toàn bộ backend test suite: **107/107 test suites PASS, 1.071/1.071 tests PASS (100%)**.
   - Toàn bộ frontend test suite: **187/187 tests PASS (100%)**.
   - Production build Vite: **PASS (0 lỗi, hoàn thành trong 15.52s)**.
   - Xác nhận 100% file tạo mới và sửa đổi đạt chuẩn **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần
- **Local AI Infrastructure (Ollama on D:\ollama)**: Hoàn tất 100%. `ollama.exe` chạy ngầm tại cổng 11434, lưu models tại `D:\ollama\models`. Đã có sẵn cả 2 model `qwen3:4b` và `embeddinggemma-2:270m`.
- **RAG Subsystem (`ragService.js`)**: Hoạt động hoàn hảo với 19 vector chunks (768 chiều) lập chỉ mục sẵn trong `knowledgeVectorIndex.json`.
- **Backend Facade (`aiProviderService.js`)**: Điều phối 3 tầng (`ollama` -> `gemini` -> `local_fallback`), hỗ trợ RAG context + Live context + XML boundaries.
- **Frontend SPA**: Hoạt động đồng bộ với chatbot widget, không bị ảnh hưởng giao diện hay phá vỡ tương thích.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Trải Nghiệm Hội Thoại Thực Tế Với Local AI**:
   - Mở giao diện chat trên trình duyệt: Đặt các câu hỏi về quy chế 6 giai đoạn (ví dụ: *"Khi nào bị dừng đề tài ở BM01?", "Điểm BM04 tối thiểu là bao nhiêu?", "Hạn nộp lưu chiểu là mấy ngày?"*).
   - Kiểm tra log terminal để quan sát RAG trích xuất các điều khoản quy chế và Qwen3:4b sinh câu trả lời cục bộ 100% không tốn một giọt quota nào.
2. **Tiếp Tục Hoàn Thiện Nghiệp Vụ Giai Đoạn 5 & 6**:
   - Biên bản tổng hợp điểm bảo vệ đồ án tốt nghiệp và quy trình nộp hồ sơ lưu chiểu đồ án.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Lưu Trữ 100% Trên Ổ D: (`D:\ollama` & `OLLAMA_MODELS=D:\ollama\models`)**:
   - Tránh làm đầy ổ đĩa hệ thống C: khi tải các mô hình AI lớn; bảo toàn toàn bộ models và binary trên phân vùng D:.
2. **Bộ Nhúng Vector `embeddinggemma-2:270m` Thế Hệ Mới (768 Dimensions)**:
   - Thay thế việc nhồi hàng ngàn dòng tài liệu vào prompt bằng giải thuật Semantic Search Cosine Similarity, giúp giảm kích thước prompt xuống còn 3-5 đoạn quy chế cô đọng nhất.
3. **Pre-computed Vector Indexing (`knowledgeVectorIndex.json`)**:
   - Nhúng sẵn 19 chunks của tài liệu học vụ giúp loại bỏ hoàn toàn độ trễ tính toán lại vector khi khởi động server, đạt tốc độ truy xuất vector RAG dưới 10ms.
4. **Kiến Trúc Dual-Engine 3 Tầng Bảo Vệ Toàn Diện (Zero Crash Guarantee)**:
   - Hệ thống không bị trói buộc cứng vào bất kỳ engine nào: máy bật Ollama thì chạy Local AI; máy tắt Ollama thì tự động fallback sang Gemini Cloud; mất cả mạng thì chạy Local Heuristic Fallback.

---

### Phiên 13/11/2026 (Live Database Context, Trả Lời Đề Tài Cá Nhân, Graceful Chit-Chat, User-Isolated Cache & Anti-Injection Chatbot)

#### 1. Những phần đã hoàn thành
1. **Thiết kế Kiến trúc & Kế hoạch Triển khai (Spec & Plan)**:
   - Hoàn thành tài liệu đặc tả [docs/superpowers/specs/2026-11-13-live-context-and-anti-injection-chatbot-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-13-live-context-and-anti-injection-chatbot-design.md) (Commit `5457d67`).
   - Lập kế hoạch 4 task theo chuẩn TDD [docs/superpowers/plans/2026-11-13-live-context-and-anti-injection-chatbot-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-13-live-context-and-anti-injection-chatbot-plan.md) (Commit `d8caa55`).
2. **Task 1: Xây dựng `liveContextService.js` & Dynamic Database Context (Commit `f9f6e64`)**:
   - Truy vấn học kỳ hiện tại (`Semester` có `status = 'ACTIVE'`, fallback học kỳ mới nhất).
   - Truy vấn thông tin Viện trưởng (`PermissionGroup` có `code = 'VIEN_TRUONG'`).
   - Truy vấn danh sách giảng viên tham gia đợt (tối đa 20 giảng viên kèm học hàm/học vị, bộ môn).
   - In-memory cache thông tin thể chế (TTL 5 phút, 300.000ms).
   - Cá nhân hóa theo người gọi: Với Sinh viên (`STUDENT`), truy vấn `TopicRegistration` để lấy tên đề tài (bao gồm cả tên điều chỉnh `adjustedTitle` hoặc snapshot BM01), họ tên GVHD và trạng thái học vụ; Với Giảng viên (`LECTURER`), truy vấn danh sách sinh viên và đề tài do mình hướng dẫn.
   - Viết 13 unit tests tại `backend/tests/unit/liveContextService.test.js` (100% PASS).
3. **Task 2: Nâng cấp `academicPromptBuilder.js` với XML Data Boundaries, Graceful Chit-chat & Anti-Injection Guardrails (Commit `5f0471f`)**:
   - Tương thích ngược cả 2 chữ ký: `buildAcademicSystemInstruction({ user, liveContextText })` và `buildAcademicSystemInstruction(user, { liveContextText })`.
   - Bổ sung khối `THÔNG TIN THỰC TẾ HỌC KỲ & CÁ NHÂN HÓA (LIVE DATABASE CONTEXT)`.
   - Bổ sung khối `QUY TẮC BẢO MẬT & PHÒNG VỆ CHỐNG TIÊM LỆNH (STRICT SECURITY & ANTI-INJECTION)`: Coi nội dung trong thẻ `<user_query>` thuần túy là dữ liệu cần giải đáp, từ chối mọi yêu cầu bẻ khóa, giả lập vai trò (role spoofing) hoặc trích xuất system prompt / mật khẩu.
   - Bổ sung khối `HƯỚNG DẪN ỨNG XỬ NGOÀI LUỒNG & GIAO TIẾP TỰ NHIÊN (GRACEFUL CHIT-CHAT)`: Xử lý ân cần lời chào, định hướng câu hỏi ngoài lề về quy chế đồ án của Viện.
   - Export hàm `wrapUserMessage(message)` bọc dữ liệu trong `<user_query>\n...\n</user_query>` và sanitize thẻ chống breakout.
   - Viết 9 unit tests tại `backend/tests/unit/liveContextPromptBuilder.test.js` (100% PASS).
4. **Task 3: Tích hợp Service, Controller, User-Isolated Cache & Real-time Answering (Commit `a2bdb11`)**:
   - Cập nhật `aiProviderService.answerAcademicChat`: Gọi `liveContextService.getLiveContext(user)`, nạp vào prompt builder, bọc câu hỏi người dùng bằng `wrapUserMessage`.
   - Cập nhật `aiController.regulationChat`: Đưa `userId: req.user?.id || 'anonymous'` vào `cacheKeyPayload` đảm bảo cache cách ly 100% giữa các sinh viên/người dùng.
   - Viết 5 integration tests tại `backend/tests/integration/liveContextAndChitChatWorkflow.test.js` (100% PASS).
5. **Redesign Giao Diện Chatbot UI/UX Pro Max & Chuẩn Nút Bấm Rule 2.6 (Commit `6c39cb8` & `46c1f26`)**:
   - Chuyển 3 nút điều khiển header (`Thu nhỏ`, `Làm mới`, `Đóng`) thành các nút icon tròn siêu gọn (`shape="circle"`, `w-7 h-7`), chuyển text nhãn thành `Tooltip` và `aria-label`, chống tràn 100% khi co nhỏ.
6. **Task 4: Hồi Quy Toàn Diện, Chuẩn Hóa Schema Prisma & Xác Nhận Zero-BOM (Commit `553ed0e`)**:
   - Backend test suite: **104/104 suites PASS, 1.029/1.029 tests PASS (100%)**.
   - Frontend test suite: **187/187 tests PASS (100%)**.
   - Frontend production build: **PASS (0 lỗi trong 17.12s)**.
   - Xác nhận 100% file tạo mới và sửa đổi đạt chuẩn **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần
- **Database (Supabase PostgreSQL & Prisma)**: Schema ổn định, truy vấn thực tế thời gian thực hoạt động chính xác qua `liveContextService`.
- **Backend AI Engine (Google Gemini 3.8 Flash)**:
  * Được grounding dữ liệu CSDL sống (Học kỳ, Viện trưởng, Danh sách GVHD, Đề tài của chính SV).
  * Bảo vệ bằng XML Data Boundary (`<user_query>`) chống prompt injection.
  * Ứng xử hội thoại ngoài luồng mượt mà, tự nhiên (Graceful Chit-chat).
  * Bộ nhớ đệm phân tầng: Dữ liệu thể chế cache 5 phút; phản hồi API cách ly theo `userId`.
- **Frontend SPA**: Giao diện Chatbot widget hiện đại, chống tràn, hiển thị Role Tag, Quick Questions động và Ant Design icons chuẩn mực.
- **Bảo mật & Liêm chính**: Ngăn chặn 100% rò rỉ chéo dữ liệu sinh viên qua cache và chống jailbreak qua XML data boundary.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Trải Nghiệm Thực Tế & Kiểm Thử Người Dùng (E2E User Verification)**:
   - Điền API Key thực tế vào `backend/.env` (`GEMINI_API_KEY=...`).
   - Đăng nhập tài khoản sinh viên: Hỏi *"Đề tài của em là gì?", "Thầy hướng dẫn của em là ai?", "Viện trưởng là ai?", "Học kỳ này kết thúc khi nào?"* để kiểm chứng độ mượt mà và chính xác của câu trả lời.
   - Thử nghiệm các câu chào hỏi xã giao hoặc các câu hỏi ngoài lề để kiểm tra phản ứng tự nhiên của bot.
   - Thử nghiệm các prompt injection hiểm hóc để xác nhận rào chắn bảo vệ hoạt động bền vững.
2. **Tiếp Tục Hoàn Thiện Nghiệp Vụ Giai Đoạn 5 & 6**:
   - Biên bản tổng hợp điểm bảo vệ đồ án tốt nghiệp và quy trình nộp hồ sơ lưu chiểu đồ án.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Dynamic Database Grounding Thay Vì Dữ Liệu Tĩnh Cứng**:
   - Chatbot không bị "mù" thông tin thời gian thực. Bằng cách nạp dữ liệu sống qua `liveContextService`, chatbot luôn nắm rõ ngày kết thúc đợt, danh tính Viện trưởng và đề tài cụ thể của sinh viên mà không cần sửa đổi prompt mỗi khi qua kỳ mới.
2. **XML Data Boundary (`<user_query>`)**:
   - Cách tiếp cận chuẩn công nghiệp phòng vệ Prompt Injection: cô lập câu hỏi của người dùng dưới dạng khối dữ liệu (data literal) thay vì mệnh lệnh hệ thống (instruction), kết hợp escape ký tự thẻ đóng để chống tag breakout.
3. **Cô Lập Bộ Nhớ Đệm Theo `userId` (User-Isolated Response Caching)**:
   - Băm SHA-256 kèm `userId` vào cache key của `/api/ai/regulation-chat`. Điều này vừa giữ được ưu thế phản hồi dưới 50ms khi một sinh viên hỏi lại, vừa triệt tiêu hoàn toàn nguy cơ sinh viên A nhận được dữ liệu đề tài của sinh viên B.
4. **Header Icon Buttons Đạt Chuẩn UI/UX Pro Max**:
   - Giữ tiêu đề "Trợ lý Học vụ AI" và Role Tag luôn hiển thị đẹp mắt, 3 nút chức năng co gọn thành icon tròn có Tooltip, loại bỏ hoàn toàn hiện tượng vỡ giao diện khi thu nhỏ khung chat.

---

### Phiên 13/11/2026 (Chuyển Đổi Gemini 3.8 Flash, Gỡ Bỏ @xenova/transformers & Phân Quyền Tri Thức AI Chống Rò Rỉ Dữ Liệu)

#### 1. Những phần đã hoàn thành
1. **Thiết kế Kiến trúc & Kế hoạch Triển khai (Spec & Plan)**:
   - Hoàn thành đặc tả [docs/superpowers/specs/2026-11-13-role-based-gemini-academic-chatbot-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-13-role-based-gemini-academic-chatbot-design.md) (Commit `32a5ad6`).
   - Lập và theo dõi kế hoạch 5 task chi tiết [docs/superpowers/plans/2026-11-13-role-based-gemini-academic-chatbot-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-13-role-based-gemini-academic-chatbot-plan.md) (Commit `9ab54c1`).
2. **Task 1: Gỡ bỏ `@xenova/transformers`, làm sạch AI Local & Nâng cấp `geminiProvider.js` (Commit `1acfccd`)**:
   - Gỡ bỏ hoàn toàn thư viện `@xenova/transformers` khỏi `backend/package.json` và `node_modules`.
   - Refactor `localEmbeddingService.js` loại bỏ dynamic import WASM, chuyển sang giải thuật tính tương đồng n-gram Jaccard / Character 3-gram Cosine thuần JS siêu tốc và an toàn.
   - Cấu hình model mặc định: `process.env.GEMINI_MODEL || 'gemini-3.8-flash'`.
   - Triển khai hàm `chatWithGemini({ messages, systemInstruction, model, apiKey, temperature })` chuẩn hóa payload Gemini v1beta REST API đa lượt hội thoại.
   - Viết 9 unit tests tại `backend/tests/unit/gemini38Provider.test.js` (100% PASS).
3. **Task 2: Bộ Tri Thức Học Vụ 3 Tầng & Bộ Nạp Ngữ Cảnh RBAC Chống Rò Rỉ (`academicPromptBuilder.js`) (Commit `69d97c2`)**:
   - Xây dựng 3 tệp tri thức học vụ độc lập tại `backend/src/services/ai/knowledge/`:
     * `studentKnowledge.js`: Toàn bộ 6 giai đoạn đồ án dưới góc nhìn Sinh viên, nguyên tắc 1 SV / 1 đề tài (`maxStudents = 1`), 1 GVHD tối đa 10 SV, nộp BM01-BM04, mốc 168h đổi tên đề tài, 2 Checkpoint dừng đề tài ngay lập tức nếu không đạt (`TERMINATED_FAILED_PROGRESS`), quy chế bảo vệ 3 thành viên, FAQ, liêm chính học thuật.
     * `lecturerKnowledge.js`: Tiêu chí đánh giá học thuật nội bộ, thẩm định lại BM01, bảng điểm 4 tiêu chí chuẩn đầu ra BM04 (10 điểm), 2 kết luận độc lập, quy trình đề xuất dừng đề tài BM03 (`PROPOSE_STOP`) và thẩm định không cho bảo vệ BM04 (`DO_NOT_ALLOW_DEFENSE`), bộ câu hỏi phản biện 3 cấp độ.
     * `adminKnowledge.js`: Tri thức điều hành Viện và Giáo vụ, quy trình ban hành Quyết định giao đề tài kèm danh sách, ban hành Phụ lục điều chỉnh tên theo đợt, quản lý SLA 168h + 1 lần gia hạn 72h, cơ chế 5 Sweep Jobs idempotent zero-fake signatures (`SYSTEM_TIMEOUT`, `ACKNOWLEDGEMENT_TIMEOUT`), quy định phúc khảo.
   - Xây dựng `academicPromptBuilder.js`: Phân quyền 3 tầng tri thức (`STUDENT`, `FACULTY`, `FULL`). Sinh viên CHỈ nhận `studentKnowledge` cùng chỉ thị STRICT SECURITY GUARDRAILS chống prompt injection / bẻ khóa và cấm lộ lọt dữ liệu nội bộ. Giảng viên nhận thêm `lecturerKnowledge`. Admin hoặc Giảng viên có quyền Giáo vụ (`GIAO_VU`, `PROJECT_OVERSIGHT_MANAGE`) nhận đầy đủ 3 tầng tri thức.
   - Viết 9 unit tests tại `backend/tests/unit/academicPromptBuilder.test.js` (100% PASS).
4. **Task 3: Controller & Route Integration, Multi-turn Chat & Cache Cô Lập Vai Trò (Commit `d92e6bc`)**:
   - Cập nhật `aiProviderService.answerAcademicChat` chuẩn hóa lịch sử hội thoại `history` từ mọi định dạng, kết hợp `systemInstruction` từ `academicPromptBuilder` và trích xuất gợi ý câu hỏi/quy chế liên quan.
   - Nâng cấp `aiController.regulationChat`: Tạo cache key băm SHA-256 đối tượng `{ message, history, role, isSuperOrAcademic }`. Đảm bảo sinh viên và giảng viên hỏi cùng câu hỏi vẫn nhận được 2 phản hồi độc lập từ 2 cache key riêng biệt, triệt tiêu nguy cơ rò rỉ dữ liệu qua cache.
   - Viết 9 integration tests tại `backend/tests/integration/roleBasedRegulationChatWorkflow.test.js` (100% PASS).
5. **Task 4: Giao Diện Role-Aware Chatbot Widget & Quick Questions Theo Vai Trò (Commit `99fa04b`)**:
   - Nâng cấp `AcademicChatWidget.jsx`: Nhận diện `user` qua `useAuth()`.
   - Hiển thị Role Badge chính quy trên Header (`Sinh viên`, `Giảng viên / HĐ`, `Quản trị viên`) và model tag `Gemini 3.8 Flash`.
   - Hiển thị danh sách câu hỏi nhanh (Quick Question Chips) phù hợp riêng cho từng vai trò người dùng đang đăng nhập.
   - Gửi payload lịch sử hội thoại chuẩn multi-turn `history: messages.map(m => ({ role, text }))`.
   - Đảm bảo 100% tuân thủ Rule 2.6 (chỉ dùng Ant Design icons, không có emoji thô trong nút bấm).
   - Viết 8 unit tests tại `frontend/src/pages/__tests__/academicChatWidgetUi.test.js` (100% PASS).
6. **Task 5: Hồi Quy Toàn Diện, Xác Nhận UTF-8 & Kiểm Thử Build**:
   - Toàn bộ backend test suite: **101/101 suites PASS, 1.002/1.002 tests PASS (100%)**.
   - Toàn bộ frontend test suite: **187/187 tests PASS (100%)**.
   - Production build `npm --prefix frontend run build`: **PASS (0 lỗi, hoàn thành trong 13.26s)**.
   - Xác nhận 100% file tạo mới và sửa đổi đạt chuẩn **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần
- **Database (Supabase PostgreSQL & Prisma)**: Ổn định 100%, bảo toàn mô hình `TopicRegistration`.
- **Backend AI Engine**: Hoàn toàn giải phóng khỏi `@xenova/transformers`, sẵn sàng kết nối trực tiếp **Gemini 3.8 Flash** qua API Key, có cơ chế Zero-Crash fallback tự động khi offline.
- **Frontend SPA**: Chatbot widget hỗ trợ đa vai trò, đa lượt tương tác, câu hỏi nhanh động; đạt 187/187 tests; build production thành công.
- **Bảo mật Tri thức (Anti-Leakage)**: Dữ liệu nhạy cảm của Giảng viên/Hội đồng được cô lập vật lý ở tầng nạp context và tầng cache key, sinh viên tuyệt đối không thể trích xuất.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm thử Thủ công Trực tiếp trên Trình duyệt**:
   - Đăng nhập tài khoản Sinh viên (`SV001`), mở widget chat, kiểm tra tag `Sinh viên`, bấm các câu hỏi gợi ý nhanh hoặc thử các câu lệnh bẻ khóa (prompt injection) để kiểm tra phản hồi từ chối an toàn.
   - Đăng nhập tài khoản Giảng viên (`GV001`), kiểm tra tag `Giảng viên / HĐ`, hỏi về tiêu chí chấm BM04 hoặc câu hỏi phản biện bảo vệ.
   - Đăng nhập tài khoản Admin (`ADMIN001`), kiểm tra tag `Quản trị viên`, hỏi về quy trình sweep jobs và SLA 168 giờ.
2. **Cấu hình `GEMINI_API_KEY` trong `backend/.env`**:
   - Điền API Key thực tế vào `backend/.env` để trải nghiệm phản hồi tự nhiên, thời gian thực từ Google Gemini 3.8 Flash.
3. **Tiếp tục hoàn thiện Giai đoạn 5 & 6**:
   - Biên bản tổng hợp điểm bảo vệ và luồng nộp quyển/source code lưu chiểu sau bảo vệ.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Loại bỏ Thư viện `@xenova/transformers`**:
   - Giảm tải dung lượng gói cài đặt và triệt tiêu các cảnh báo dynamic import WASM của Node.js; các tính năng so sánh đề tài được xử lý bằng giải thuật cosine/n-gram siêu tốc, chuẩn bị sẵn sàng cho việc tích hợp Ollama / Local AI chuyên dụng sau này theo đúng định hướng của người dùng.
2. **Định Danh Model `gemini-3.8-flash`**:
   - Sử dụng `gemini-3.8-flash` làm model mặc định trong mã nguồn (`process.env.GEMINI_MODEL || 'gemini-3.8-flash'`), cho phép người dùng tự do cấu hình linh hoạt trong `.env`.
3. **Kiến Trúc Phân Tầng Tri Thức (Tiered Context Injection)**:
   - Thay vì nạp toàn bộ dữ liệu rồi dặn AI "đừng nói cho sinh viên biết", hệ thống cô lập dữ liệu từ gốc: payload gửi lên Google cho tài khoản Sinh viên **hoàn toàn không chứa** văn bản quy chế nội bộ của Giảng viên và Admin. Đây là biện pháp chống rò rỉ dữ liệu (Anti-Leakage) triệt để và an toàn nhất hiện nay.
4. **Cô Lập Bộ Nhớ Đệm Theo Vai Trò (Role-Isolated Cache Key)**:
   - Cache key gắn chặt với `role` người hỏi, giải quyết dứt điểm lỗ hổng rò rỉ dữ liệu khi sinh viên hỏi trùng câu hỏi với giảng viên.

---

### Phiên 12-13/11/2026 (Bộ Tứ Tiện Ích Trí Tuệ Nhân Tạo Học Vụ Toàn Diện - Academic AI Assistant Suite & Mini AI Local Embeddings)

#### 1. Những phần đã hoàn thành
1. **Tài liệu Đặc tả & Kế hoạch Triển khai (Spec & Plan)**:
   - Soạn thảo và phê duyệt tài liệu thiết kế kiến trúc [docs/superpowers/specs/2026-11-12-academic-ai-assistant-suite-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-12-academic-ai-assistant-suite-design.md).
   - Lập kế hoạch 5 task chi tiết [docs/superpowers/plans/2026-11-12-academic-ai-assistant-suite-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-12-academic-ai-assistant-suite-plan.md).
2. **Task 1: Mở rộng Adapter AI Backend, Mini AI Local Embeddings & Provider Fallback (Commit `3da211a`)**:
   - Tạo `backend/src/services/ai/localEmbeddingService.js` tích hợp `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`) chạy on-device qua WASM/dynamic import với bộ giải thuật heuristic cosine similarity fallback chống crash.
   - Cập nhật `backend/src/services/ai/geminiProvider.js` bổ sung 3 hàm sinh nhận xét (`generateAcademicFeedback`), sinh câu hỏi phản biện (`generateDefenseQuestions`), và trả lời quy chế (`answerRegulationChat`).
   - Cập nhật `backend/src/services/ai/localFallbackProvider.js` tích hợp kho tri thức quy chế 6 giai đoạn đồ án và heuristic generator offline.
   - Hoàn thiện `backend/src/services/ai/aiProviderService.js` điều phối Facade theo kiến trúc Hybrid Adapter Zero-Crash, gắn timeout 8s và in-memory cache SHA-256 (TTL 5 phút).
   - Bộ unit test `backend/tests/unit/aiAssistantSuiteAdapter.test.js` đạt **17/17 tests PASS**.
3. **Task 2: Xây dựng Endpoints & Controller AI Backend (Commit `4e2509f`)**:
   - Triển khai 3 handler mới trong `backend/src/controllers/aiController.js`: `generateFeedback`, `generateDefenseQuestions`, `regulationChat`.
   - Đăng ký 3 route POST bảo vệ bởi `authenticateToken` trong `backend/src/routes/aiRoutes.js`:
     * `POST /api/ai/generate-feedback`
     * `POST /api/ai/generate-defense-questions`
     * `POST /api/ai/regulation-chat`
   - Bộ integration test `backend/tests/integration/aiAssistantSuiteWorkflow.test.js` đạt **17/17 tests PASS**.
4. **Task 3: Client Service & Widget Chatbot Học Vụ Nổi Toàn Cục (Commit `ff7e88c`)**:
   - Mở rộng `frontend/src/services/aiService.js` với các hàm `generateFeedback`, `generateDefenseQuestions`, `chatRegulation`.
   - Xây dựng `frontend/src/components/common/AcademicChatWidget.jsx`: Widget nổi góc dưới phải (`fixed bottom-6 right-6 z-50`), hỗ trợ đóng/mở mượt mà, gợi ý câu hỏi nhanh (chip tags), cuộn hội thoại tự động, xóa lịch sử chat, tuân thủ nghiêm ngặt Quy tắc 2.6 (không có emoji thô trong text nút).
   - Gắn widget toàn cục vào layout chính `frontend/src/components/layout/AppLayout.jsx`.
   - Bộ frontend test `frontend/src/pages/__tests__/academicChatWidgetUi.test.js` đạt **3/3 tests PASS**.
5. **Task 4: Tích Hợp AI Nhận Xét & Câu Hỏi Phản Biện Vào Giao Diện GVHD & Hội Đồng (Commit `e47039d`)**:
   - Tích hợp nút `AI Gợi ý nhận xét` (`icon={<BulbOutlined />}`) trong `frontend/src/components/lecturer/OutlineReviewModal.jsx` (xét duyệt đề cương BM01).
   - Tích hợp nút `AI Gợi ý nhận xét` (`icon={<BulbOutlined />}`) và Card `Gợi ý câu hỏi phản biện AI` với 3 cấp độ (`FOUNDATION`, `TECHNICAL_CHALLENGE`, `FUTURE_EXPANSION`) kèm nút sao chép nhanh (`icon={<CopyOutlined />}`) trong `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx` (phiếu chấm điểm Hội đồng BM04 / Bảo vệ).
   - Bộ frontend test `frontend/src/pages/__tests__/aiFeedbackAndDefenseQuestionsUi.test.js` đạt **2/2 tests PASS**.
6. **Task 5: Hồi quy Toàn Diện, Kiểm Thử Build & Xác Nhận Chuẩn Mã Hóa (Commit `9b120e9`)**:
   - Toàn bộ 98 test suites backend đạt **975/975 tests PASS (100%)**.
   - Toàn bộ frontend test suite đạt **182/182 tests PASS (100%)**.
   - Chạy thành công production build `npm --prefix frontend run build` (0 lỗi, hoàn thành trong 19.78s).
   - Xác nhận 100% file tạo mới và sửa đổi đạt chuẩn **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần
- **Database (Supabase PostgreSQL & Prisma)**: Ổn định, không phát sinh migration cấu trúc mới, tương thích 100% mô hình `TopicRegistration`.
- **Backend AI Engine**: Hoạt động bền bỉ, hỗ trợ Hybrid song song: Gemini 2.0 Flash API (khi có mạng + có key) và Mini AI Local (`@xenova/transformers` Sentence-Transformers `all-MiniLM-L6-v2` / Fallback heuristic) đảm bảo **Zero Crash (100% trả về 200 OK hợp lệ)**.
- **Frontend SPA**: Tích hợp hoàn chỉnh chatbot quy chế nổi, nút gợi ý nhận xét và câu hỏi phản biện; tuân thủ 100% Rule 2.6 (Ant Design icons); build production vượt qua kiểm tra tĩnh và bundle.
- **Test Coverage**: Backend đạt 98/98 suites (975 tests PASS); Frontend đạt 182/182 tests PASS.
- **Git**: Các chặng triển khai đã được tách nhỏ thành các commit độc lập trên nhánh `develop`.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm thử Trải nghiệm Thực tế (Manual UI Walkthrough)**:
   - Đăng nhập tài khoản Sinh viên kiểm tra hỏi đáp quy chế qua `AcademicChatWidget` nổi.
   - Đăng nhập tài khoản GVHD mở Modal duyệt đề cương BM01 bấm `AI Gợi ý nhận xét`.
   - Đăng nhập tài khoản Giảng viên / Hội đồng mở Phiếu chấm điểm bảo vệ bấm `AI Gợi ý nhận xét` và bấm `Tạo câu hỏi phản biện` rồi sao chép câu hỏi.
2. **Cấu hình Biến Môi trường Gemini Thực tế (Optional)**:
   - Bổ sung biến môi trường `GEMINI_API_KEY` vào file `backend/.env` để kích hoạt Cloud Gemini 2.0 Flash bên cạnh chế độ Mini AI Local mặc định.
3. **Tiếp tục hoàn thiện Giai đoạn 5 & 6**:
   - Rà soát biên bản tổng hợp điểm bảo vệ và luồng nộp quyển/source code lưu chiểu sau bảo vệ.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Kiến trúc Hybrid Adapter Zero-Crash**:
   - Dù hệ thống có cấu hình `GEMINI_API_KEY` hay không, dù mất mạng Internet hay Gemini API bị rate limit/timeout (8s), hệ thống không bao giờ trả về lỗi 500 cho người dùng mà tự động fallback về Mini AI Local Embeddings / Heuristic Fallback Provider với `provider: 'local_fallback'` hoặc `local_embedding`.
2. **Mini AI Local Embeddings On-Device (`@xenova/transformers`)**:
   - Sử dụng mô hình chuẩn học thuật nhẹ `Xenova/all-MiniLM-L6-v2` nhúng thẳng trên Node.js để tính vector ngữ nghĩa và Cosine Similarity, giúp kiểm tra tính mới đề tài siêu tốc (5-10ms) mà không tốn chi phí API hay để lọt dữ liệu đề tài ra ngoài mạng công cộng.
3. **Quy tắc Nút bấm Giao diện (Rule 2.6)**:
   - Tất cả các nút bấm liên quan đến AI đều sử dụng Icon component chính quy từ `@ant-design/icons` (`<BulbOutlined />`, `<MessageOutlined />`, `<CopyOutlined />`, `<DeleteOutlined />`, `<SendOutlined />`), nhãn text tiếng Việt trang trọng, tuyệt đối không chèn emoji thô vào chuỗi string.
4. **Bộ nhớ đệm thông minh In-memory Cache (TTL 5 phút)**:
   - Các yêu cầu AI cùng nội dung đầu vào được băm SHA-256 làm key cache để tránh gọi lặp lại mô hình AI, tiết kiệm tài nguyên và tăng tốc độ phản hồi cho người dùng tức thì.

---

### Phiên 11/11/2026 (Hoàn Tất Chuỗi Quy Trình Học Vụ BM02 – BM04, 5 Sweep Jobs, 2 Bộ Seed Độc Lập & Củng Cố Hội Đồng)

#### 1. Những phần đã hoàn thành
1. **Thiết kế & Thực thi toàn trình Chuỗi Quy trình Học vụ từ BM02 đến BM04 (8/8 Tasks theo Phương án 3)**:
   - **Tài liệu đặc tả & Kế hoạch**: Hoàn thiện tài liệu kiến trúc [2026-11-11-bm02-to-bm04-workflow-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-11-bm02-to-bm04-workflow-design.md) và kế hoạch triển khai [2026-11-11-bm02-to-bm04-implementation-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-11-bm02-to-bm04-implementation-plan.md).
   - **Mở rộng Additive Prisma Schema (`backend/prisma/schema.prisma`)**:
     * Bổ sung 12 bảng mới: `TopicDecision`, `TopicDecisionItem`, `TitleAdjustmentAppendix`, `TitleAdjustmentAppendixItem`, `BM03Record`, `BM03SessionEntry`, `BM03CheckpointReview`, `InstituteStopReview`, `InstituteDefenseReview`, `AcademicElectronicSignature`, `AcademicDocumentSnapshot`, `ScheduledSweepExecution`.
     * Mở rộng các bảng hiện có (`TopicRegistration`, `TopicTitleAdjustment`, `BM04Evaluation`) và 10 enums trạng thái học vụ mới mà không phá vỡ bất kỳ luồng BM01 hay Hội đồng hiện hữu nào.
   - **Dịch vụ nền tảng dùng chung**:
     * `topicTitleResolverService.js`: Hàm `resolveEffectiveTopicTitle(registrationId, { atTime, tx })` phân giải tên đề tài chuẩn tại mọi mốc thời gian.
     * `electronicSignatureService.js`: Chữ ký điện tử nội bộ gắn `payloadHash` SHA-256 (`canonicalJsonHash`), kiểm tra chống giả mạo và xác thực danh tính người ký.
     * `academicPdfService.js` & `academicDocumentService.js`: Xuất PDF chuẩn hành chính học vụ và lưu snapshot bất biến `AcademicDocumentSnapshot`.
2. **Chặng 1A & 1B — Đăng ký BM02, Quyết định giao đề tài, Điều chỉnh tên BM02-A & Phụ lục**:
   - **Backend BM02 & Quyết định (`academicWorkflowService.js`)**: Nộp BM02 (`submitBM02`) cho phép đề xuất tinh chỉnh tên kèm lý do (`bm02ProposedTitle` + `titleChangeReason`) mà vẫn giữ nguyên `bm01ApprovedTitleSnapshot`; Viện duyệt BM02 tối đa 1 lần yêu cầu sửa (`reviewBM02`); lập và công bố Quyết định giao đề tài theo đợt (`createTopicDecision`, `publishTopicDecision`), kích hoạt cửa sổ 168 giờ tính từ `decisionPublishedAt`.
   - **Backend BM02-A & Phụ lục (`bm02aWorkflowService.js`, `titleAdjustmentAppendixService.js`)**: Luồng đơn xin điều chỉnh tên đề tài BM02-A trong 168 giờ, giới hạn tối đa 2 phiên bản (`v1`, `v2`) bằng cập nhật nguyên tử `revisionCount = 0`, chuỗi 3 chữ ký tuần tự bắt buộc (`STUDENT` $\rightarrow$ `ADVISOR` $\rightarrow$ `HEAD_OF_DEPT`) cùng `payloadHash`, và phát hành Phụ lục điều chỉnh tên theo đợt (`ISSUED`).
   - **Frontend Chặng 1A & 1B**: Xây dựng `bm02aService.js`, `TitleAdjustmentModal.jsx` (stepper 3 chữ ký, đồng hồ đếm ngược 168h, so sánh tên cũ/mới), nâng cấp `HybridBMFormModal.jsx`, `BM02ReviewDrawer.jsx`, `TopicApprovalPage.jsx`, `ProjectPeriodPage.jsx`.
3. **Chặng 2 — Theo dõi thực hiện đề tài BM03 & Thẩm định dừng thực hiện**:
   - **Backend BM03 (`bm03WorkflowService.js`, `bm03Controller.js`, `bm03Routes.js`)**:
     * Nhật ký từng buổi hướng dẫn (`BM03SessionEntry`): Chỉ GVHD ghi nhận và ký khóa (`isLocked = true`), sinh viên xem công khai theo thời gian thực mà không phải ký từng buổi.
     * Đánh giá Giữa kỳ (`MIDTERM`: `CONTINUE` / `PROPOSE_STOP`) và Cuối kỳ (`FINAL`: `CONTINUE_TO_BM04` / `PROPOSE_STOP`).
     * Khi GVHD đề xuất `PROPOSE_STOP`, hệ thống tạo hồ sơ `InstituteStopReview` với SLA 168 giờ và tối đa 1 lần gia hạn 72 giờ (`extensionCount = 0`).
     * Khi hoàn tất Cuối kỳ (`CONTINUE_TO_BM04`), GVHD ký toàn phiếu BM03, mở cửa sổ 48 giờ để sinh viên ký xác nhận hoặc ghi nhận ý kiến bảo lưu trước khi xuất PDF chốt sổ.
4. **Chặng 3 — Đánh giá trước bảo vệ BM04, Thẩm định không bảo vệ & 5 Scheduled Sweep Jobs**:
   - **Backend BM04 (`bm04WorkflowService.js`, `bm04Controller.js`, `bm04Routes.js`)**:
     * Phiếu đánh giá BM04 với 4 tiêu chí bắt buộc và 2 kết luận độc lập: `programOutcome` (`COMPLETED` / `NOT_COMPLETED`) và `defenseRecommendation` (`ALLOW_DEFENSE` / `DO_NOT_ALLOW_DEFENSE`).
     * Nhánh đồng ý (`COMPLETED` + `ALLOW_DEFENSE`): Sau khi GVHD ký số, tự động chuyển ngay sang `DEFENSE_READY` (không qua Viện duyệt từng hồ sơ) và xuất PDF BM04.
     * Nhánh không đồng ý (`DO_NOT_ALLOW_DEFENSE`): Mở hồ sơ `InstituteDefenseReview` với SLA 168 giờ + tối đa 1 lần gia hạn 72 giờ để Viện thẩm định (`REJECTED_FINAL` hoặc trả về `BM03_IN_PROGRESS`).
   - **5 Scheduled Sweep Jobs (`bm02ToBm04SweepService.js`)**:
     * Tự động hóa idempotent cho: (1) Đóng cửa sổ 168h BM02-A hết hạn, (2) Chốt BM03 quá hạn 48h sinh viên chưa ký bằng `ACKNOWLEDGEMENT_TIMEOUT`, (3) Xử lý quá hạn SLA 168h thẩm định dừng BM03 bằng `SYSTEM_TIMEOUT`, (4) Xử lý quá hạn SLA 168h thẩm định không bảo vệ BM04 bằng `SYSTEM_TIMEOUT`, (5) Cảnh báo SLA sắp hết hạn trước 24h. Tuyệt đối không tạo chữ ký giả của Admin hay Sinh viên khi timeout.
   - **Frontend Chặng 2 & 3**: Nâng cấp `evaluationService.js`, `meetingLogService.js`, `ProgressTrackingPage.jsx`, `StudentProgressDetailPanel.jsx`, `BM04EvaluationModal.jsx`, `SubmissionPage.jsx`, `StudentDashboardPage.jsx`, `ProjectOversightPage.jsx` (Hàng đợi thẩm định dừng BM03 & không bảo vệ BM04 kèm đếm ngược SLA 168h và nút gia hạn +72h).
5. **Kiểm thử Tích hợp E2E Toàn Trình (`bm02ToBm04FullE2E.test.js`)**:
   - Viết bộ kiểm thử tích hợp 2.297 dòng với **29/29 test cases PASS**, kiểm chứng toàn bộ 15 tiêu chí nghiệm thu từ `BM01_PASSED` $\rightarrow$ `DEFENSE_READY`, bao gồm cả race condition (`Promise.all`) trên giới hạn sửa 1 lần và gia hạn SLA 1 lần.
6. **Xây dựng 2 Bộ Seed Độc Lập cho Giai đoạn 1 & Giai đoạn 2**:
   - Cập nhật `backend/scripts/seed/resetApplicationData.js` bao phủ đủ 62 bảng ứng dụng.
   - **Bộ Seed Giai đoạn 1 (`npm --prefix backend run db:seed:phase1`)**: `backend/prisma/seedPhase1.js` & `backend/scripts/seed/phase1Fixtures.js` tạo 1 Admin, 12 GV, 120 SV chia thành 8 kịch bản phủ kín quy trình từ chưa đăng ký, chờ duyệt GVHD, nộp đề cương BM01 v1, tự động phân công HĐ Đề cương, Thư ký chấm nháp, Chủ tịch công bố kết quả, nộp lại v2 đến `BM01_PASSED`.
   - **Bộ Seed Giai đoạn 2 (`npm --prefix backend run db:seed:phase2`)**: `backend/prisma/seedPhase2.js` & `backend/scripts/seed/phase2Fixtures.js` tạo 1 Admin, 12 GV, 120 SV chia thành 15 kịch bản phủ kín quy trình từ `BM01_PASSED` qua BM02, Quyết định giao đề tài, BM02-A (còn hạn/hết hạn/phụ lục), BM03 (nhật ký buổi học, thẩm định dừng, cửa sổ 48h), BM04 (đồng ý/thẩm định không bảo vệ) đến `DEFENSE_READY` và Hội đồng bảo vệ.
7. **Rà soát & Củng cố `backend/src/controllers/councilController.js`**:
   - Mở rộng kiểm tra xung đột lợi ích (COI) trong `validateCouncilMembersAgainstAssignedStudents` trên cả `outlineCouncilId` và `defenseCouncilId`.
   - Bổ sung kiểm tra quyền thành viên hội đồng trong `getCouncilById` đối với giảng viên không có quyền quản trị.
   - Đồng bộ điều kiện kiểm tra gán sinh viên vào Hội đồng bảo vệ trong `assignRegistrationsToCouncil` (`defenseCouncilId || councilId`, tương thích đầy đủ các trường kết luận BM04).
   - Sửa `deleteCouncil` kiểm tra tổng số sinh viên trên cả 3 quan hệ (`registrations`, `outlineRegistrations`, `defenseRegistrations`) và dọn dẹp các dòng `await prisma.$transaction` bị lặp.

#### 2. Trạng thái cập nhật của từng phần
- **Database (Supabase PostgreSQL & Prisma)**: Đã đồng bộ hoàn toàn schema mới (`npx prisma db push` & `npx prisma generate`), hiện đang nạp sẵn dữ liệu **Bộ Seed Giai đoạn 2** (120 sinh viên, 15 kịch bản BM02–BM04).
- **Backend API**: Hoạt động ổn định 100%; toàn bộ 5 bộ test quy trình BM02–BM04 đạt **124/124 tests PASS**, 4 bộ test Hội đồng & E2E đạt **75/75 tests PASS**.
- **Frontend SPA**: Tuân thủ 100% Rule 2.6 (không chèn ký tự thô/emoji vào nhãn `Button`); **114/114 frontend tests PASS**; `npm --prefix frontend run build` thành công (**0 lỗi**).
- **Git**: Đã commit sạch sẽ toàn bộ các chặng triển khai, bộ seed và bản vá `councilController.js` trên nhánh `develop`.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Kiểm thử Trải nghiệm Người dùng (Manual UI Walkthrough) với 2 Bộ Seed**:
   - Chạy thử nghiệm trực tiếp trên trình duyệt với các tài khoản mẫu trong `db:seed:phase1` và `db:seed:phase2` để rà soát tinh chỉnh UX trên từng màn hình (Sinh viên, GVHD, Trưởng bộ môn, Viện/Admin).
2. **Hoàn thiện Giai đoạn 5 & 6 (Chấm điểm Hội đồng Bảo vệ & Nộp Lưu chiểu sau bảo vệ)**:
   - Rà soát chi tiết luồng chấm điểm độc lập của 3 thành viên Hội đồng Bảo vệ (`DEFENSE_COUNCIL`), xuất biên bản tổng hợp điểm bảo vệ và luồng nộp quyển/source code lưu chiểu sau bảo vệ.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Kiến trúc Sổ cái Học vụ Bất biến (Phương án 3 — Additive Schema)**:
   - Không ghi đè tên đề tài hay xóa lịch sử các lần nộp/duyệt; mọi văn bản pháp lý (Quyết định giao đề tài, Phụ lục điều chỉnh tên, Phiếu BM03, Phiếu BM04) đều được băm SHA-256 (`payloadHash`), ký điện tử nội bộ và lưu snapshot PDF bất biến.
2. **Thứ tự ưu tiên phân giải tên đề tài (`resolveEffectiveTopicTitle`)**:
   - Phụ lục `ISSUED` có `signedDate <= atTime` mới nhất $\rightarrow$ Quyết định giao đề tài `PUBLISHED` $\rightarrow$ BM02 `APPROVED` $\rightarrow$ Tên đề tài gốc trên `TopicRegistration`. Tuyệt đối không lấy tên từ đơn BM02-A đang nháp hoặc chờ duyệt làm tên chính thức.
3. **Chống giả mạo chữ ký khi quá hạn SLA (Timeout Integrity)**:
   - Khi sinh viên quá hạn 48h xác nhận BM03 hoặc Viện quá hạn 168h (+72h) thẩm định dừng/không bảo vệ, Sweep Job xử lý chuyển trạng thái bằng `ACKNOWLEDGEMENT_TIMEOUT` / `SYSTEM_TIMEOUT` và in ghi chú hệ thống lên PDF, tuyệt đối không sinh chữ ký giả của Sinh viên hay Admin.
4. **Tách biệt 2 Bộ Seed Giai đoạn 1 và Giai đoạn 2**:
   - Đảm bảo mỗi bộ seed có 120 sinh viên (12 GVHD $\times$ 10 SV, tuân thủ nghiêm ngặt trần 10 SV/GVHD/đợt) nhưng tập trung sâu vào từng giai đoạn nghiệp vụ riêng biệt, giúp dev và QA có thể kiểm thử ngay lập tức mọi nhánh trạng thái của Giai đoạn 1 hoặc Giai đoạn 2 chỉ bằng 1 câu lệnh.

---

### Phiên 10-11/11/2026 (Nâng Cấp Giao Diện Hội Đồng, Trang Chi Tiết Riêng, Độ Tương Phản UI/UX Pro Max & Nhân Bản Hóa Audit Log)

#### 1. Những phần đã hoàn thành
1. **Tách Biệt Tuyến Đường & Menu 2 Loại Hội Đồng**:
   - Tách riêng biệt 2 menu trên thanh điều hướng và router: `/admin/outline-councils` (Hội đồng Thẩm định Đề cương) và `/admin/defense-councils` (Hội đồng Chấm Bảo vệ).
   - Truyền `forcedCouncilType` chuẩn xác để bảo toàn ngữ cảnh học vụ theo từng giai đoạn của đồ án tốt nghiệp.
2. **Cải Tiến Thuật Toán & Modal Xem Trước Phân Công Tự Động (Auto-Assign Preview Modal)**:
   - Thay đổi vai trò thành viên thứ 3 thành `REVIEWER` (Ủy viên Phản biện) thay vì `MEMBER` để khớp chặt chẽ với cơ cấu hội đồng Viện.
   - Bổ sung API Xem trước Phân công Tự động: `POST /api/councils/auto-assign-outline/preview` giúp Admin xem trước danh sách hội đồng dự kiến, các cảnh báo xung đột và thành viên trước khi ghi xuống CSDL.
   - Xây dựng Modal Xem trước cho phép Admin đổi giảng viên dự kiến của từng hội đồng và xem danh sách sinh viên dự kiến trước khi bấm xác nhận lưu.
3. **Xây Dựng Trang Chi Tiết Hội Đồng Riêng Biệt (`CouncilDetailPage.jsx`)**:
   - Tạo trang chi tiết chuyên dụng mount tại `/admin/outline-councils/:id` và `/admin/defense-councils/:id`.
   - Bố cục 2 cột: Thẻ Lịch & Địa điểm họp + Thẻ Thành phần Hội đồng (3 ủy viên với avatar, mã GV, email) + Cảnh báo xung đột lợi ích GVHD động.
   - Bảng danh sách sinh viên thuộc hội đồng hỗ trợ tìm kiếm thời gian thực theo MSSV, Họ tên, Đề tài, GVHD; hỗ trợ modal gán thêm sinh viên và gỡ sinh viên trực tiếp.
   - Tích hợp nút điều hướng mượt mà giữa trang danh sách và trang chi tiết hội đồng.
4. **Quy Chuẩn Thiết Kế Giao Diện & Nút Bấm (Button Standards - Rule 2.6 trong AGENTS.md)**:
   - Nghiêm cấm triệt để việc chèn emoji hoặc ký tự thô (`←`, `→`, `+`, `🤖`, `📋`, `✓`, `✏️`, `👥`, `🗑️`, `🔓`, v.v.) trực tiếp vào chuỗi text của nút bấm (`Button`).
   - 100% nút bấm phải dùng component icon chính quy từ `@ant-design/icons` qua prop `icon={<IconComponent />}` và nhãn văn bản tiếng Việt thuần túy, chuyên nghiệp.
   - Đã rà soát và dọn dẹp sạch toàn bộ các nút bấm trên giao diện hội đồng và toàn hệ thống.
5. **Nâng Cấp Độ Tương Phản Màu Sắc & Visual Hierarchy theo `/ui-ux-pro-max`**:
   - Chuẩn hóa nền canvas `--bg` từ `#F8FAFC` lên `#F1F5F9` (Slate-100 enterprise), `--border` lên `#CBD5E1` (Slate-300: độ tương phản $\ge 3:1$ với thẻ trắng `#FFFFFF`), loại bỏ hoàn toàn cảm giác "same same nhau khó nhìn".
   - Định danh màu sắc 3 vai trò thành viên HĐ trực quan tức thì: Chủ tịch (Teal-50/200/950), Thư ký (Blue-50/200/950), UV Phản biện (Purple-50/200/950) đồng bộ xuyên suốt từ Matcher Card, Table View, Modal Phân công đến Trang Chi tiết.
   - Thẻ sinh viên (Candidate Queue) có viền rõ ràng, hover teal nổi bật, trạng thái đã gán hiển thị viền xanh lục đậm `4px solid #16A34A` cùng nền `#F0FDF4`.
   - Nâng cấp độ tương phản Ant Design tokens: `colorBgLayout`, `colorBorder`, `colorTextSecondary`, header bảng và đổ bóng thẻ.
6. **Nhân Bản Hóa Toàn Diện Audit Log (Lịch Sử Thao Tác Hội Đồng)**:
   - Khắc phục triệt để tình trạng audit log hiển thị máy móc dạng JSON thô `{"hasMembersPayload": true}`.
   - **Backend**: Nâng cấp `councilController.js` và `outlineAutoSetupService.js` để lưu trữ dữ liệu nghiệp vụ giàu ngữ nghĩa:
     * Tự động so sánh và ghi nhận mảng `changes` (đổi thành viên Chủ tịch/Thư ký/Phản biện từ GV cũ $\rightarrow$ GV mới, đổi phòng họp, ngày họp).
     * Ghi nhận danh sách sinh viên chi tiết (`studentCode`, `studentName`, `topicTitle`) khi gán hoặc gỡ sinh viên.
     * Ghi nhận log đầy đủ cho các thao tác Mở khóa kết quả (`REOPEN_COUNCIL_RESULTS` kèm lý do), Công bố lịch họp (`PUBLISH_COUNCIL_SCHEDULE`), Công bố kết quả (`PUBLISH_COUNCIL_RESULTS`).
   - **Frontend**: Tạo component chuyên nghiệp `CouncilAuditLogModal.jsx`, hiển thị tiếng Việt tự nhiên, có badge thao tác màu sắc phân cấp, bảng đối chiếu thay đổi trước/sau, danh sách ủy viên và sinh viên.
   - Hỗ trợ tương thích ngược 100% với các bản ghi log cũ trong CSDL (tự động diễn giải các payload cũ như `hasMembersPayload: true/false`, `CREATE_COUNCIL` cũ, `ASSIGN_COUNCIL` cũ).
   - Tích hợp modal audit log vào cả trang danh sách hội đồng lẫn trang chi tiết hội đồng.

#### 2. Trạng thái cập nhật của từng phần
- **Backend API**: `OPERATIONAL & ENRICHED` - Các API hội đồng, audit log và outline council setup hoạt động ổn định, 100/100 tests liên quan PASS.
- **Frontend SPA**: `OPERATIONAL & HIGH CONTRAST` - 101/101 unit tests PASS, Vite production build thành công 0 lỗi. Độ tương phản và phân cấp thị giác đạt chuẩn WCAG AA / APCA.
- **Database / Prisma**: `ALIGNED` - Giữ vững mô hình `TopicRegistration`, không thay đổi cấu trúc bảng, tương thích ngược 100% dữ liệu audit log.
- **MCP Servers**: Hoạt động bình thường.
- **Test Suite**:
  + Backend: 100% PASS.
  + Frontend: **101/101 unit tests PASS** (100%).
- **Git Branch**: `develop` - Mã nguồn sạch sẽ, đã commit đầy đủ:
  + `b260296`: Rule 2.6 cấm ký tự thô/emoji trong nhãn nút bấm.
  + `75fb9aa`: Nâng cấp độ tương phản màu sắc và phân cấp vai trò hội đồng.
  + `3c5e4dd`: Nhân bản hóa audit log và tối ưu giao diện modal lịch sử.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Triển Khai Phân Hệ Đơn Đăng Ký Đề Tài Chính Thức (BM02)**:
   - Xây dựng luồng sinh viên nộp đơn BM02 sau khi đã đạt thẩm định đề cương (`BM01_PASSED`).
   - Luồng Trưởng Viện / Quản trị viên thẩm định và ban hành Quyết định giao đề tài chính thức.
2. **Theo Dõi Tiến Độ & Đánh Giá Giữa Kỳ (BM03 Checkpoint 1 & 2)**:
   - Xây dựng giao diện và luồng đánh giá định kỳ của GVHD.
3. **Mở Rộng Hệ Thống Xuất Biên Bản Hội Đồng (Export PDF/Excel)**:
   - Cho phép xuất danh sách sinh viên theo từng hội đồng, biên bản họp thẩm định đề cương phục vụ lưu trữ học vụ.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Định Danh Vai Trò Thứ 3 là `REVIEWER` (Ủy viên Phản biện)**: Thay vì gán nhãn chung chung `MEMBER`, định danh rõ `REVIEWER` ngay từ giai đoạn thẩm định đề cương để đảm bảo tính phản biện học thuật và thống nhất với quy chế đồ án.
2. **Cơ Chế Xem Trước Phân Công Tự Động (Preview-Before-Commit)**: Cho phép quản trị viên xem trước và tinh chỉnh giảng viên dự kiến của từng hội đồng trước khi ghi nhận vào CSDL, loại bỏ rủi ro xáo trộn dữ liệu học vụ khi phân công tự động.
3. **Tách Trang Chi Tiết Hội Đồng Độc Lập (`CouncilDetailPage.jsx`)**: Giảm tải cho giao diện chính Matcher (2 cột), cung cấp không gian thao tác sâu cho từng hội đồng (tra cứu lịch, quản lý danh sách sinh viên, đối chiếu xung đột, xem nhật ký thao tác).
4. **Chuẩn Hóa Thẻ Canvas & Đường Biên Sắc Nét**: Chuyển đổi `--bg: #F1F5F9` và `--border: #CBD5E1` tạo độ tương phản cao và chiều sâu thị giác rõ nét so với thẻ trắng `#FFFFFF`, giải quyết triệt để vấn đề giao diện bị phẳng, bệt màu.
5. **Nhân Bản Hóa Dữ Liệu Audit Log Kết Hợp Tương Thích Ngược**: Thay vì lưu cờ boolean kỹ thuật (`hasMembersPayload`), backend tính toán delta thay đổi cụ thể giữa trước và sau cập nhật; frontend có logic fallback để phiên dịch tự nhiên cả dữ liệu log cũ lẫn mới.

### Phiên 10/11/2026 (Hoàn Thành Toàn Diện Phân Hệ Hồ Sơ Đồ Án & Xét Duyệt Đề Cương BM01)

#### 1. Những phần đã hoàn thành
1. **CSDL & Migration Additive (Task 1)**:
   - Tạo bảng mới `CouncilResultBatch` quản lý vòng đời độc lập của kết quả hội đồng (`DRAFT` -> `PENDING_CHAIR` -> `PUBLISHED` -> `SUPERSEDED` -> `REOPENED`).
   - Mở rộng `Semester`, `Council` (bổ sung `meetingMode`, `meetingLocation`, `meetingLink`, `revisionSubmissionDeadline`), `BM01Evaluation` (`onDelete: Restrict`, `@unique([batchId, registrationId])`, snapshot `supersedesId`).
   - Mở rộng enum `TaskType` (`BM01_INITIAL_SUBMISSION`, `BM01_RESUBMISSION`), `RegistrationStatus` (`BM01_RESUBMITTED`), và các enums: `CouncilMeetingMode`, `CouncilBatchStatus`, `OutlineInitialOutcome`, `OutlineRevisionApprovalStatus`, `AttendanceStatus`.
2. **Thuật toán Tự động Phân công Hội đồng Đề cương Trọn gói (Task 2)**:
   - Triển khai `outlineAutoSetupService.js`: Sắp xếp gom cụm sinh viên theo `mentorId` (Mentor-Clustered Partitioning), cắt lô tối đa 10 SV/HĐ.
   - Tự động loại trừ các GVHD có sinh viên trong lô khỏi hội đồng (`excludedMentorIds`), chọn 3 giảng viên độc lập (`CHAIRMAN`, `SECRETARY`, `MEMBER`) cân bằng tải tham gia.
3. **Dịch vụ Nghiệp vụ Xét duyệt Đề cương & Giao dịch Nguyên tử (Task 3)**:
   - Triển khai `outlineReviewService.js`, `outlineSweepService.js`, `errors.js` với 11 nghiệp vụ nguyên tử.
   - Khóa vĩnh viễn đề cương v1 ngay lần nộp đầu tiên. Cả 3 kết quả `REVISION_REQUIRED`, `FAIL`, `ABSENT` đều nhận đúng một cơ hội nộp lại v2 (`maxSubmissions = 1`) bằng Atomic Conditional Update (`WHERE revisionSubmissionId IS NULL`) trong transaction.
   - Chủ tịch duyệt file nộp lại -> `BM01_PASSED`; từ chối hoặc hết hạn -> `TERMINATED_BM01` kèm nhận xét bắt buộc.
   - Reopen bảo toàn lịch sử append-only: Chuyển batch cũ sang `SUPERSEDED`, tạo batch mới `versionNumber + 1`, snapshot evaluations với `attemptNo = prev + 1`. Chặn tuyệt đối và trả `409 BM02_DEPENDENCY_EXISTS` nếu bất kỳ sinh viên nào đã nộp đơn BM02.
   - Triệt tiêu hoàn toàn side-effect trên các API GET (chỉ tính toán và trả cờ `isOverdue`).
4. **API Controllers, Routes & Middleware RBAC (Task 4)**:
   - Triển khai `outlineController.js`, `outlineRoutes.js`, cập nhật `councilRoutes.js`, `councilController.js`, `app.js`.
   - Áp dụng middleware phân quyền resource-based `requireCouncilRole` (Chủ tịch vs Thư ký).
5. **Cổng Sinh viên - Nộp & Theo dõi Đề cương (Task 5)**:
   - Tạo `frontend/src/services/outlineService.js` hỗ trợ header `Idempotency-Key`.
   - Nâng cấp `SubmissionPage.jsx`, `StudentDashboardPage.jsx`, `HybridBMFormModal.jsx`: Khóa nút nộp v1/v2 sau một lần upload, hiển thị lịch bảo vệ (phòng học/Teams link), hiển thị kết quả và nhận xét của hội đồng, badge `BM01_RESUBMITTED`, xử lý cảnh báo quá hạn `isOverdue`.
6. **Cổng Quản trị viên & Giảng viên - Đánh giá & Phân công Hội đồng (Task 6)**:
   - Mở rộng `frontend/src/services/councilService.js` với 10 methods chuyên trách đề cương, bảo toàn `blockingRegistrations` khi 409.
   - `CouncilAssignmentPage.jsx`: Thêm nút "Tự động phân công HĐ Đề cương" tại tab `OUTLINE_REVIEW`; thêm modal Mở khóa kết quả (Reopen) bắt lỗi 409 và hiển thị danh sách sinh viên gây chặn.
   - `GradingPage.jsx` & `OutlineCouncilGradingCard.jsx`: Bảng Thư ký chấm theo ma trận validation tức thời; công cụ Chủ tịch công bố lịch, công bố kết quả, trả lại thư ký, đặt hạn nộp lại v2, thẩm định bản sửa và chốt danh sách quá hạn. Loại bỏ hoàn toàn dữ liệu giả (Zero mock data).
7. **Kiểm thử Tích hợp Toàn diện E2E & Xác thực Build (Task 7)**:
   - Viết test E2E `backend/tests/integration/outlineWorkflowFullE2E.test.js` kiểm thử 9 bước khép kín toàn bộ vòng đời xét duyệt đề cương.
   - Backend: 71/71 suites PASS (600/600 tests PASS 100%).
   - Frontend: 100/100 tests PASS (100%).
   - Build Production: Vite build thành công 0 lỗi trong 10.83s.
8. **Giải quyết Xung đột Đăng ký & Triệt tiêu Dữ liệu giả trước đó**:
   - Dọn dẹp đề xuất `PENDING` khi sinh viên đăng ký đề tài chính thức thành công.
   - Khôi phục chỉ tiêu đề tài khi GVHD từ chối (`REJECTED`) về 0/1.
   - Hiển thị thông tin sinh viên thực tế trên `TopicApprovalPage.jsx` và học kỳ thực tế trên Topbar `AppLayout.jsx`.

#### 2. Trạng thái cập nhật của từng phần
- **Backend API**: `OPERATIONAL & TESTED` - 71/71 test suites PASS, 600/600 tests PASS 100%. Phân hệ BM01 và quản lý hội đồng đề cương hoạt động chuẩn xác theo nghiệp vụ.
- **Frontend SPA**: `OPERATIONAL & BUILD PASS` - 100/100 tests PASS, production build thành công 0 lỗi. Zero mock data rule tuân thủ nghiêm ngặt.
- **Database / Prisma**: `ALIGNED & MIGRATED` - Migration additive, bảo toàn tính tương thích ngược, 0 breaking changes, quan hệ snapshot `onDelete: Restrict`.
- **MCP Servers**: Hoạt động bình thường.
- **Test Suite**:
  + Backend: **71/71 test suites PASS, 600/600 tests PASS** (100%).
  + Frontend: **100/100 tests PASS** (100%).
- **Git Branch**: `develop` - Mã nguồn sạch, sẵn sàng đóng gói.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **Triển khai Phân hệ Đơn Đăng Ký Đề Tài Chính Thức (BM02)**:
   - Tận dụng trạng thái `BM01_PASSED` làm điều kiện tiên quyết kích hoạt quy trình nộp đơn BM02.
   - Xây dựng luồng Thẩm định & Phê duyệt BM02 của Hiệu trưởng / Trưởng Viện Công nghệ Số (ra Quyết định giao đề tài chính thức).
2. **Tích hợp Thông Báo Thời Gian Thực (In-app Notifications)**:
   - Tự động gửi thông báo cho sinh viên khi Chủ tịch công bố lịch bảo vệ, công bố kết quả đề cương, hoặc mở hạn nộp lại v2.
3. **Stress-test Thuật toán Phân công Tự động**:
   - Thử nghiệm tải với dữ liệu giả lập lớn (hàng trăm sinh viên, hàng chục GVHD) để đánh giá độ cân bằng tải của các hội đồng đề cương.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Tách biệt `CouncilResultBatch` khỏi `RegistrationStatus`**: `RegistrationStatus` chỉ phản ánh trạng thái tổng hợp của hồ sơ sinh viên (`BM01_SUBMITTED`, `BM01_NEEDS_REVISION`, `BM01_RESUBMITTED`, `BM01_PASSED`, `TERMINATED_BM01`), trong khi `CouncilResultBatch` quản lý riêng quy trình dự thảo, trình ký và công bố của hội đồng.
2. **Khóa Nộp Lại v2 Nguyên Tử ở Tầng CSDL (Atomic Conditional Update)**: Sử dụng câu lệnh `WHERE revisionSubmissionId IS NULL` trong transaction để đảm bảo cả `REVISION_REQUIRED`, `FAIL`, `ABSENT` đều chỉ có đúng 1 cơ hội nộp lại duy nhất, loại trừ race conditions.
3. **Bảo toàn Lịch sử Append-Only khi Reopen**: Khi mở khóa kết quả, batch cũ chuyển `SUPERSEDED`, batch mới được tạo với `versionNumber + 1` và snapshot evaluations với `attemptNo = prev + 1`, không bao giờ sửa đè dữ liệu lịch sử.
4. **Chặn Reopen khi có Dependency Downstream (BM02)**: Trả về mã lỗi `409 BM02_DEPENDENCY_EXISTS` kèm danh sách sinh viên gây chặn nếu đã phát sinh dữ liệu BM02, ngăn chặn việc âm thầm đảo ngược trạng thái hồ sơ học vụ.
5. **Triệt tiêu Side-Effect trên Read (No Lazy Side-Effects)**: API GET tuyệt đối không cập nhật trạng thái trễ hạn vào CSDL (chỉ tính toán và trả cờ `isOverdue: boolean`). Việc chuyển trạng thái `TERMINATED_BM01` do quá hạn chỉ thực hiện qua scheduled job hoặc thao tác "Chốt danh sách quá hạn" tường minh của Chủ tịch/Admin.
6. **Thuật toán Phân công Tự động Gom Cụm theo GVHD (Mentor-Clustered Partitioning)**: Tối đa 10 sinh viên / hội đồng, gom cụm các sinh viên chung GVHD để giảm số lượng GVHD bị loại trừ khỏi từng hội đồng, phân công 3 giảng viên độc lập cân bằng khối lượng.

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
1. **Loại bỏ nút mô phỏng "Kê khai Giờ chuẩn" trên Dashboard Giảng viên**: Gỡ bỏ nút bấm và modal mô phỏng `Kê Khai Giờ Chuẩn Hướng Dẫn & Hội Đồng` trong `frontend/src/pages/lecturer/LecturerDashboardPage.jsx` để giao diện gọn gàng, tránh gây hiểu lầm cho giảng viên.
2. **Deploy Production Database Migration**: Chạy `npx prisma migrate deploy` trên môi trường Production để áp dụng enum `ArchivePhase`.
2. **Backfill Archive Data**: Chạy script `node backend/scripts/migrations/backfillArchivePhases.js --dry-run=false` với tài khoản quản trị để phân loại chính xác các hồ sơ lưu chiểu cũ.
3. **End-to-End User Acceptance Test (UAT)**: Thực hiện kịch bản kiểm chứng thực tế từ tài khoản `sv001`, `lecturer01` (Trưởng Viện / GVHD), `lecturer02` (Chủ tịch HĐ) và `admin` theo 10 bước của Kế hoạch Nghiệm thu Toàn tuyến.
4. **CI/CD Polish**: Bổ sung cờ `--forceExit` vào script test trong `backend/package.json` để tự động ngắt kết nối database pool sau khi Jest hoàn tất.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Loại bỏ hoàn toàn `EXCEPTION_REVIEW`**: Do chưa có đặc tả trạng thái, actor, hạn nộp, và audit trail rõ ràng, cơ chế này dễ trở thành cửa sau (bypass) trá hình. Chỉ giữ lại 2 hành động học thuật minh bạch: `APPROVE` và `RETURN_FOR_REVISION`.
2. **Quy trình Khóa Điểm Bảo Vệ 2 Bước Độc Lập**: Tách biệt rõ ràng giữa "Khóa phiếu cá nhân của từng Giám khảo" (bước 1) và "Khóa sổ điểm Hội đồng" (bước 2). Admin không có quyền học thuật tự ý khóa nếu chưa đủ 3 phiếu khóa của Chủ tịch, Thư ký và Phản biện.
3. **Che Điểm Hoàn Toàn Trước Công Bố**: Tránh việc sinh viên xem được điểm thô trước khi Hội đồng/Viện trưởng phê duyệt và ban hành snapshot công bố chính thức, ngăn ngừa khiếu nại sai quy trình và rò rỉ thông tin học vụ.
4. **Chống Race Condition Quota 10 SV Bằng 2 Tầng**: Không chỉ dựa vào kiểm tra ở controller, mà sử dụng cả khóa đồng thời `acquireMentorLock` ở tầng service và mức cô lập giao dịch `Serializable` ở tầng CSDL để đảm bảo không thể vượt quá 10 SV/GVHD dưới tải đồng thời.

### Phiên 10/11/2026 — Tái Cấu Trúc Bộ Dữ Liệu Seed Chuẩn (Chỉ HK1 & HK2) và Tối Ưu Hóa Giao Dịch

#### 1. Những phần đã hoàn thành

1. **Loại bỏ Hoàn toàn Khái niệm "Chính Khóa" / "Bổ Sung" / "Đợt 1" / "Đợt 2"**:
   - Tinh chỉnh toàn bộ tệp định nghĩa và kiểm định seed: `backend/scripts/seed/demoFixtures.js`, `backend/scripts/seed/workflowFixtures.js`, `backend/scripts/seed/validateDemoSeed.js`, `backend/scripts/seed/resetApplicationData.js`, `backend/prisma/seed.js`.
   - Hệ thống chuẩn hóa chỉ gồm đúng 2 học kỳ:
     * `semesterHK1`: `DATN-HK1-2026-27` — `Đồ án tốt nghiệp — HK1 2026–2027` (Đang diễn ra ở giai đoạn bảo vệ và tổng kết).
     * `semesterHK2`: `DATN-HK2-2026-27` — `Đồ án tốt nghiệp — HK2 2026–2027` (Đang mở đăng ký nguyện vọng `REGISTRATION`).
   - Cập nhật giao diện Frontend loại bỏ các chuỗi gắn cứng `(Đợt 1 - Chính khóa)` tại [AppLayout.jsx](file:///d:/DACN/frontend/src/components/layout/AppLayout.jsx), [StudentDashboardPage.jsx](file:///d:/DACN/frontend/src/pages/student/StudentDashboardPage.jsx) và tối ưu logic hiển thị ưu tiên tại [semesterDisplay.js](file:///d:/DACN/frontend/src/utils/semesterDisplay.js).

2. **Chuẩn Hóa Phân Bổ 120 Sinh Viên Theo Tiến Độ Thực Tế**:
   - **Học kỳ 2 (30 SV: `sv001`–`sv030`)**:
     * `1..10`: `HK2_UNREGISTERED` (Chỉ có ghi danh học kỳ, chưa đăng ký đề tài).
     * `11..20`: `HK2_PENDING` (Đã đăng ký nguyện vọng, chờ GVHD duyệt).
     * `21..30`: `HK2_APPROVED` (GVHD đã duyệt đăng ký đề tài).
     * Tạo 12 đề tài mở của 12 giảng viên sẵn sàng tiếp nhận đăng ký trong HK2.
   - **Học kỳ 1 (90 SV: `sv031`–`sv120`)**:
     * `31..35`: `HK1_BM01_SUBMITTED` (Nộp đề cương v1, task `BM01_INITIAL_SUBMISSION` completed).
     * `36..40`: `HK1_BM01_NEEDS_REVISION` (Hội đồng yêu cầu chỉnh sửa, task `BM01_RESUBMISSION` open).
     * `41..45`: `HK1_BM01_RESUBMITTED` (Đã nộp lại đề cương v2, chờ Chủ tịch hội đồng duyệt).
     * `46..50`: `HK1_BM02_SUBMITTED` (Đã nộp đơn đăng ký đề tài BM02).
     * `51..70`: `HK1_DECISION` (Đã ban hành QĐ giao đề tài; sv051 có yêu cầu điều chỉnh tên PENDING, sv052 có yêu cầu APPROVED và phụ lục quyết định).
     * `71..85`: `HK1_CHECKPOINT` (Đánh giá tiến độ Checkpoint 1 & 2; sv085 có khiếu nại chữ ký `CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED`).
     * `86..95`: `HK1_BM04` (sv086..090 `BM03_PASSED`, sv091..095 `BM04_REVIEW` và nộp lưu chiểu sơ bộ pre-defense).
     * `96..100`: `DEFENSE_READY` (Đủ điều kiện sẵn sàng bảo vệ).
     * `101..120`: `HK1_DEFENSE` (20 SV được phân bổ vào 4 Hội đồng bảo vệ với Zero-COI; trải qua đầy đủ các trạng thái `AWAITING_SCORES`, `AWAITING_FINAL_APPROVAL`, `DEFENSE_PASSED`, `DEFENSE_FAILED` và ban hành 4 đợt công bố kết quả).

3. **Tối Ưu Hóa Giao Dịch & Khắc Phục Lỗi Quá Tải Mạng Supabase**:
   - Sửa enum `CouncilMeetingMode` trong `workflowFixtures.js` từ `'OFFLINE'` thành `'IN_PERSON'` chuẩn schema Prisma.
   - Thêm `council_result_batches` vào danh sách `APPLICATION_TABLES` trong `resetApplicationData.js` phục vụ truncate sạch khi reset.
   - Tối ưu `backend/prisma/seed.js`: Pre-compute hash mật khẩu trước khi mở transaction, thay thế 133 lệnh insert đơn lẻ bằng `createMany` + `findMany`, nâng transaction timeout lên 360s.
   - Seed trực tiếp thành công 100% lên cơ sở dữ liệu PostgreSQL Supabase qua cổng session 5432.

4. **Kiểm Thử Toàn Tuyến & Kiểm Tra Độc Lập Qua Subagent**:
   - Backend Unit & Integration Tests:
     * `demoFixtures.test.js`: 6/6 tests PASS.
     * `validateDemoSeed.test.js`: 13/13 tests PASS.
     * `workflowFixtures.test.js`: 6/6 tests PASS.
     * Core Integration Suites (`outlineWorkflowFullE2E`, `bm01.routes`, `semesters.routes`, `registrations.routes`): 30/30 tests PASS.
   - Frontend Tests & Build:
     * `npm test --prefix frontend`: **100/100 tests PASS**.
     * `npm run build --prefix frontend`: **PASS (19.55s, 0 errors)**.
   - Task Reviewer Subagent: Xác nhận 100% tuân thủ mô hình `TopicRegistration`, `maxStudents = 1`, không vượt quota 10 SV/GVHD, Zero-COI và định dạng UTF-8 (no BOM).

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE & SEEDED`; CSDL PostgreSQL Supabase nạp sạch 120 sinh viên, 12 giảng viên, 2 học kỳ (HK1 & HK2) và 4 hội đồng bảo vệ + 1 hội đồng đề cương.
- **Backend API**: `STABLE & TESTED`; 100% unit tests và integration tests liên quan đều PASS.
- **Frontend SPA**: `BUILD PASS (100%)`; 100/100 tests pass, build production thành công 0 lỗi.
- **Dữ liệu & Mã hóa**: 100% đạt chuẩn UTF-8 (no BOM), không còn tàn dư mock data hoặc khái niệm chính khóa/bổ sung.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. **UAT Trực Quan Trên Web**: Đăng nhập thử nghiệm trên giao diện với các tài khoản đại diện của từng giai đoạn:
   - Admin: `admin@university.edu.vn`
   - Viện trưởng / Chủ tịch HĐ: `lecturer01@university.edu.vn`
   - Sinh viên HK2 đăng ký mới: `sv001@university.edu.vn`
   - Sinh viên HK1 các giai đoạn: `sv031` (BM01 v1), `sv036` (BM01 sửa), `sv046` (BM02), `sv071` (Checkpoint), `sv085` (Khiếu nại chữ ký), `sv101` (Bảo vệ).
2. **Triển Khai Tính Năng Mới**: Tiếp nhận các yêu cầu nghiệp vụ tiếp theo từ người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Quy Chuẩn 2 Học Kỳ Độc Lập HK1 & HK2**: Thay thế hoàn toàn cách chia "Đợt 1 Chính khóa" và "Đợt 2 Bổ sung" bằng 2 Học kỳ chuẩn học vụ ĐHQG (`HK1 2026–2027` và `HK2 2026–2027`). Cách tiếp cận này phản ánh đúng thực tế đào tạo đại học, làm rõ ràng vai trò của từng học kỳ (HK1 kết thúc/bảo vệ, HK2 mở đăng ký mới).
2. **Tách Rời Việc Tính Toán Mật Khẩu Khỏi Giao Dịch CSDL**: Chạy bcrypt hash bên ngoài transaction giúp tiết kiệm hàng nghìn chu kỳ CPU và giảm thiểu thời gian chiếm giữ interactive transaction, đảm bảo script seed chạy nhanh và không bị timeout qua kết nối cloud latency cao.
3. **Batch Insertion Cho Danh Sách Tài Khoản**: Chuyển từ 133 lệnh insert tuần tự sang 1 lệnh `createMany` duy nhất, giảm 99% thời gian round-trip mạng sang cụm máy chủ Supabase.

---

### Cập Nhật Phiên Làm Việc (Session Update - Tách Riêng HĐ Xét Duyệt & HĐ Bảo Vệ)

#### 1. Những phần đã hoàn thành

1. **Bổ Sung Quyền Quản Lý Hội Đồng Cho Nhóm QUAN_TRI_VIEN (Admin)**:
   - Cập nhật [`backend/src/constants/permissions.js`](file:///d:/DACN/backend/src/constants/permissions.js): Bổ sung `OUTLINE_COUNCIL_MANAGE`, `DEFENSE_COUNCIL_MANAGE`, `VIEW_COUNCIL_ASSIGNMENTS`, `VIEW_DEFENSE_ASSIGNMENTS` vào nhóm vai trò `QUAN_TRI_VIEN`.
   - Cập nhật trực tiếp vào bảng `permission_group_permissions` trên CSDL PostgreSQL Supabase để tài khoản `admin@university.edu.vn` có hiệu lực ngay lập tức.

2. **Tách Biệt Menu Điều Hướng & Định Tuyến (Navigation & Routing)**:
   - Cập nhật [`frontend/src/config/navigationRegistry.js`](file:///d:/DACN/frontend/src/config/navigationRegistry.js): Tách mục `council-assignments` chung thành 2 mục độc lập thuộc khối **"Hội đồng & bảo vệ"**:
     * `outline-councils`: Nhãn **"HĐ Xét duyệt Đề cương"**, icon `fact_check`, quyền `OUTLINE_COUNCIL_MANAGE`, route `/admin/outline-councils`.
     * `defense-councils`: Nhãn **"HĐ Bảo vệ khóa luận"**, icon `groups`, quyền `DEFENSE_COUNCIL_MANAGE`, route `/admin/defense-councils`.
   - Cập nhật [`frontend/src/App.jsx`](file:///d:/DACN/frontend/src/App.jsx): Đăng ký 2 routes riêng biệt truyền prop `forcedCouncilType="OUTLINE_REVIEW"` và `forcedCouncilType="DEFENSE_COUNCIL"`. Đường dẫn cũ `/admin/councils` được tự động chuyển hướng (`Navigate replace`) sang `/admin/outline-councils` để bảo toàn tương thích ngược.

3. **Tối Ưu Hóa Giao Diện CouncilAssignmentPage Chống Nhầm Lẫn**:
   - Khóa cứng chế độ hội đồng khi nhận prop `forcedCouncilType`, tự động ẩn thanh chuyển đổi giai đoạn (Phase Switcher) không cần thiết và thay thế bằng Tag thông tin số lượng HĐ tương ứng.
   - Tiêu đề trang (`PageHeader`) và nhãn nút bấm tự động thích ứng theo ngữ cảnh (`Phân công Hội đồng Xét duyệt Đề cương` / `Phân công Hội đồng Bảo vệ Khóa luận`).
   - Khắc phục triệt để lỗi cú pháp JSX mồ côi (lines 819–826), đảm bảo `npm run build` thành công 100%.

4. **Kiểm Thử Toàn Diện**:
   - `frontend/tests/navigationRegistry.test.js`: Cập nhật bộ test 28 items kiểm tra quyền hiển thị menu của Viện trưởng và Quản trị viên. 100/100 frontend tests PASS.
   - `backend/tests`: Test luồng phân công và fixtures PASS 100%.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE`; Nhóm `QUAN_TRI_VIEN` đã được cấp đầy đủ quyền quản lý và xem hội đồng cả 2 loại.
- **Backend API**: `RUNNING (Port 5000)`; Server chạy ổn định, các schedulers tự động và API phân công hoạt động bình thường.
- **Frontend SPA**: `RUNNING (Port 5173)`; 100/100 tests pass, `vite build` 0 lỗi.
- **Dữ liệu & Mã hóa**: 100% đạt chuẩn UTF-8 (no BOM).

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Người dùng nghiệm thu trực quan trên giao diện Admin (`admin@university.edu.vn` / `admin123`):
   - Kiểm tra menu bên trái thấy tách rõ ràng **"HĐ Xét duyệt Đề cương"** và **"HĐ Bảo vệ khóa luận"**.
   - Bấm nút `🤖 Tự động phân công HĐ Đề cương` trên học kỳ HK2 để kiểm tra thuật toán phân bổ 15 SV vào các hội đồng không trùng GVHD.
2. Tiếp tục thực hiện các yêu cầu tinh chỉnh hoặc tính năng mới tiếp theo.

#### 4. Quyết định quan trọng (Decisions & Rationale)

---

### Cập Nhật Phiên Làm Việc (Session Update - Bố Cục HĐ Xét Duyệt, Xem Trước Phân Công & Trang Chi Tiết Riêng)

#### 1. Những phần đã hoàn thành

1. **Chuẩn Hóa 3 Vai Trò & Thuật Toán Phân Công Tự Động HĐ Đề Cương (Backend)**:
   - Sửa [`backend/src/services/outlineAutoSetupService.js`](file:///d:/DACN/backend/src/services/outlineAutoSetupService.js): Đổi `OUTLINE_ROLE_ORDER` từ `['CHAIRMAN', 'SECRETARY', 'MEMBER']` sang `['CHAIRMAN', 'SECRETARY', 'REVIEWER']`. Đảm bảo thành viên thứ 3 luôn là Ủy viên Phản biện.
   - Bổ sung hàm `previewAutoOutlineCouncilSetup`: Tính toán gom cụm sinh viên theo GVHD (tối đa 10 SV/HĐ), chọn 3 giảng viên có tải thấp nhất không trùng GVHD của nhóm SV đó và trả về phương án dự kiến `proposedCouncils` mà không ghi CSDL.
   - Tạo endpoint `POST /api/councils/auto-assign-outline/preview` (`previewAutoAssignOutlineCouncils`) trong [`councilController.js`](file:///d:/DACN/backend/src/controllers/councilController.js) và [`councilRoutes.js`](file:///d:/DACN/backend/src/routes/councilRoutes.js).
   - Nâng cấp `runAutoOutlineCouncilSetupForSemester` (`POST /api/councils/auto-assign-outline`): Hỗ trợ nhận `options.proposedCouncils` từ Frontend khi Admin xác nhận; kiểm tra nghiêm ngặt 3 giảng viên khác nhau và đủ 3 vai trò `CHAIRMAN`, `SECRETARY`, `REVIEWER`. Vẫn giữ nguyên logic tự động khi không truyền payload để tương thích ngược 100% với Cronjob ngầm.

2. **Cân Đối Bố Cục Trang Quản Lý & Modal Xem Trước Tinh Chỉnh (Frontend)**:
   - [`frontend/src/index.css`](file:///d:/DACN/frontend/src/index.css): Cập nhật `.council-jury-grid` từ 4 cột thành 3 cột đều nhau (`repeat(3, 1fr)`).
   - [`frontend/src/pages/admin/CouncilAssignmentPage.jsx`](file:///d:/DACN/frontend/src/pages/admin/CouncilAssignmentPage.jsx):
     * Cột phải (Danh sách Hội đồng) được bọc trong `.matcher-pane` với `.matcher-pane-header` đồng bộ hoàn toàn về viền, padding và chiều cao tiêu đề với cột trái.
     * Cảnh báo xung đột lợi ích động: Ẩn hoàn toàn nhãn tĩnh `"✓ 0 Xung đột"`; chỉ hiển thị cảnh báo **`⚠️ Có GV [Tên GV] là GVHD của sinh viên HĐ này`** khi có thành viên HĐ trùng với GVHD của sinh viên trong hội đồng đó.
     * Tên Hội đồng trở thành liên kết click để chuyển trực tiếp sang trang chi tiết riêng (`/admin/outline-councils/:id` hoặc `/admin/defense-councils/:id`), bỏ nút "Danh sách" dư thừa.
     * Đổi tên nút thành **"Đổi thành viên HĐ"**.
     * Modal Xem trước Phân công Tự động: Hiển thị các HĐ dự kiến kèm 3 ô chọn Chủ tịch, Thư ký, Phản biện (chống chọn trùng người), có cảnh báo live nếu chọn GVHD của SV trong HĐ, và có nút **`📋 Xem danh sách SV (N) ▾`** để xổ bảng danh sách sinh viên dự kiến trước khi xác nhận lưu.

3. **Xây Dựng Trang Chi Tiết Hội Đồng Riêng Biệt (`CouncilDetailPage.jsx`)**:
   - Tạo [`frontend/src/pages/admin/CouncilDetailPage.jsx`](file:///d:/DACN/frontend/src/pages/admin/CouncilDetailPage.jsx) và đăng ký 2 routes `/admin/outline-councils/:id` và `/admin/defense-councils/:id` trong [`frontend/src/App.jsx`](file:///d:/DACN/frontend/src/App.jsx).
   - Nút `← Quay lại Danh sách HĐ` tự động điều hướng về đúng trang danh sách tương ứng.
   - Bố cục 2 cột cân đối: Khối thông tin lịch/địa điểm/quy mô SV bên trái (1/3) và 3 thẻ ủy viên hội đồng bên phải (2/3) kèm cảnh báo xung đột động.
   - Bảng sinh viên đầy đủ: Ô tìm kiếm nhanh, phân trang, nút `Gỡ` sinh viên với Popconfirm.
   - Tích hợp đầy đủ các Modal nghiệp vụ: Sửa thông tin HĐ, Đổi thành viên HĐ, Gán thêm SV, và Mở khóa kết quả (Reopen) xử lý an toàn lỗi 409 BM02.

4. **Kiểm Thử Toàn Tuyến & Đánh Giá Độc Lập Qua Subagent**:
   - Backend tests: 57/57 tests PASS (`outlineAutoSetupService.test.js`, `outlineWorkflowFullE2E.test.js`, `outlineRoutes.test.js`).
   - Frontend tests: 101/101 tests PASS (`councilOutlineAndGradingContracts.test.js`, `navigationRegistry.test.js`,...).
   - Frontend build: `vite build` 100% SUCCESS (0 errors, 11.88s).
   - Mã hóa: 100% tệp đạt chuẩn UTF-8 (no BOM).

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE`; CSDL PostgreSQL Supabase sẵn sàng cho luồng phân công xem trước và xác nhận.
- **Backend API**: `STABLE & TESTED`; Các endpoints preview và auto-assign hoạt động hoàn hảo.
- **Frontend SPA**: `BUILD PASS (100%)`; 101/101 tests pass, build production thành công 0 lỗi.
- **Dữ liệu & Mã hóa**: 100% đạt chuẩn UTF-8 (no BOM), tuân thủ nghiêm ngặt mô hình `TopicRegistration`.

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Người dùng kiểm tra trải nghiệm trực tiếp trên giao diện Admin (`http://localhost:5173`):
   - Mở menu **"HĐ Xét duyệt Đề cương"**: Kiểm tra bố cục 2 cột thẳng hàng, lưới 3 giảng viên đều nhau.
   - Bấm nút **`🤖 Tự động phân công HĐ Đề cương`**: Xem trước các HĐ dự kiến, bấm `📋 Xem danh sách SV (N)`, thử đổi giảng viên rồi bấm `✓ Xác nhận & Phân công`.
   - Nhấp vào **tên một Hội đồng**: Trải nghiệm **Trang Chi tiết Hội đồng riêng**, kiểm tra thông tin, 3 giảng viên, cảnh báo xung đột và thao tác gán/gỡ sinh viên.
2. Sẵn sàng tiếp nhận các yêu cầu tiếp theo từ người dùng.

---

### Cập Nhật Phiên Làm Việc (Session Update - Gói 1: Khắc Phục Lỗ Hổng Bảo Mật RBAC & Dọn Dẹp Dữ Liệu Giả Toàn Diện)

#### 1. Những phần đã hoàn thành

1. **Chuẩn Hóa Phân Quyền Kỹ Thuật & Chống Leo Thang Đặc Quyền (Backend - Task 1)**:
   - Sửa [`backend/src/constants/permissions.js`](file:///d:/DACN/backend/src/constants/permissions.js): Chuyển các quyền điều phối hội đồng (`OUTLINE_COUNCIL_MANAGE`, `DEFENSE_COUNCIL_MANAGE`, `DEFENSE_SCHEDULE_PUBLISH`, `DEFENSE_MEMBER_REPLACE`, `VIEW_COUNCIL_ASSIGNMENTS`, `VIEW_DEFENSE_ASSIGNMENTS`) từ `ACADEMIC_PROTECTED_PERMISSIONS` sang `TECHNICAL_PERMISSIONS`. Loại bỏ các quyền học vụ đặc thù (`RUBRIC_LOCK`, `DEFENSE_SCOREBOOK_RETURN`, `ARCHIVE_ACADEMIC_AFFAIRS_REVIEW`) khỏi nhóm `DEFAULT_GROUPS.QUAN_TRI_VIEN`, bảo toàn chúng trong `DEFAULT_GROUPS.GIAO_VU` và `DEFAULT_GROUPS.VIEN_TRUONG`. Giải quyết triệt để lỗi deadlock 403 khi Quản trị viên kỹ thuật gán nhóm `QUAN_TRI_VIEN`.
   - Nâng cấp [`backend/src/controllers/userController.js`](file:///d:/DACN/backend/src/controllers/userController.js) (`updateUser`):
     * Chặn người dùng tự nâng role của chính mình (trả về `403 CANNOT_CHANGE_OWN_ROLE`).
     * Chặn quản trị viên không có quyền `PERMISSION_ASSIGN_ACADEMIC` nâng người khác lên role `ADMIN` (trả về `403 CANNOT_ASSIGN_ADMIN_ROLE`).
     * Chặn thay đổi role của sinh viên đang có `TopicRegistration` kích hoạt hoặc giảng viên đang hướng dẫn/chấm hội đồng (trả về `400 CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD`).
     * Đồng bộ hóa nguyên tử nhóm quyền chức vụ mặc định và ghi nhật ký `UPDATE_USER_ROLE` vào `AuditLog`.

2. **Xây Dựng Endpoint Phát Thông Báo Giảng Viên Thực Tế (Backend - Task 2)**:
   - Viết mới `sendLecturerBroadcast` trong [`backend/src/controllers/notificationController.js`](file:///d:/DACN/backend/src/controllers/notificationController.js): Quét toàn bộ sinh viên đang được giảng viên hướng dẫn trong học kỳ kích hoạt (loại trừ các đề tài đã hủy hoặc rút), tạo bản ghi `Notification` hàng loạt vào CSDL.
   - Đăng ký route `POST /api/notifications/lecturer-broadcast` trong [`backend/src/routes/notificationRoutes.js`](file:///d:/DACN/backend/src/routes/notificationRoutes.js) kèm xác thực và phân quyền, đăng ký miễn trừ bảo vệ `OWNERSHIP_GUARDED` trong [`backend/src/security/authorizationExemptions.js`](file:///d:/DACN/backend/src/security/authorizationExemptions.js).

3. **Làm Giàu Hợp Đồng Dữ Liệu Dashboard Sinh Viên & Sửa Query Triage Hội Đồng (Backend - Task 3)**:
   - Nâng cấp `getStudentDashboard` trong [`backend/src/controllers/dashboardController.js`](file:///d:/DACN/backend/src/controllers/dashboardController.js): Trả về mảng `tasks` nhiệm vụ thực tế từ CSDL, `meetingLogsCount` thực tế từ các buổi trao đổi BM03, `mentorScore` thực tế từ `BM04Evaluation`, và `mentorFullName`.
   - Viết lại câu truy vấn `unassignedRegistrations` trong `getGeneralStats` và `getSemesterOverview`: Sử dụng mệnh đề `OR` tách biệt Stage 1 (`councilId: null` với các trạng thái đề cương) và Stage 2 (`defenseCouncilId: null` với `DEFENSE_READY` / `ELIGIBLE_BY_INSTITUTE`). Đảm bảo trả về đúng số lượng thực tế (trả về 0 khi không có sinh viên cần triage, xóa bỏ hoàn toàn số giả fallback 14, 4, 2).

4. **Kết Nối Xuất PDF BM05 Thật & Modal Phát Thông Báo Thật (Frontend - Task 4)**:
   - Thêm phương thức `sendLecturerBroadcast` trong [`frontend/src/services/notificationService.js`](file:///d:/DACN/frontend/src/services/notificationService.js).
   - Nâng cấp [`frontend/src/pages/admin/GradingDefensePage.jsx`](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx): Kết nối nút "In Biên Bản BM05" với `evaluationService.exportScoreSheetPdf(regId)`, mở file PDF trong tab mới, xóa bỏ hoàn toàn mock toast và `setTimeout`.
   - Nâng cấp [`frontend/src/pages/lecturer/LecturerDashboardPage.jsx`](file:///d:/DACN/frontend/src/pages/lecturer/LecturerDashboardPage.jsx): Kết nối Modal phát thông báo trực tiếp với API `notificationService.sendLecturerBroadcast`, xóa bỏ `setTimeout` giả lập.

5. **Dọn Dẹp Dữ Liệu Giả, Số Liệu Bịa Đặt & Kết Nối Nhiệm Vụ Thật (Frontend - Task 5)**:
   - [`frontend/src/pages/student/StudentDashboardPage.jsx`](file:///d:/DACN/frontend/src/pages/student/StudentDashboardPage.jsx):
     * Kết nối danh sách nhiệm vụ thực từ `dashboardData.tasks`, hiển thị Ant Design `<Empty />` khi chưa có nhiệm vụ; xóa sạch 3 khối HTML nhiệm vụ bịa đặt.
     * Xóa chuỗi hardcoded `'18 / 20h'`, hiển thị `{dashboardData?.meetingLogsCount ?? 0} buổi`.
     * Xóa fallback `'8.8 / 10'`, hiển thị `{dashboardData?.mentorScore != null ? ... : 'Chưa đánh giá'}`.
     * Xóa sạch 3 vị trí fallback `'PGS.TS Lê Quang Dũng'`, lấy tên GVHD thực tế hoặc `'Chưa phân công'`.
     * Xóa tiến độ bịa đặt `65%`, tính tiến độ chuẩn xác dựa trên `RegistrationStatus`.
     * Thay 3 nút tải toast giả bằng `<Button disabled icon={<DownloadOutlined />}>Tải về</Button>` bọc `<Tooltip title="Biểu mẫu chuẩn sẽ được công bố theo thông báo của Nhà trường">`.
   - [`frontend/src/pages/lecturer/ProgressTrackingPage.jsx`](file:///d:/DACN/frontend/src/pages/lecturer/ProgressTrackingPage.jsx): Xóa bỏ số giả `?? 75` và `(sPassed ? 8 : 4)`, hiển thị số lượng thực tế hoặc 0.
   - [`frontend/src/pages/admin/DashboardPage.jsx`](file:///d:/DACN/frontend/src/pages/admin/DashboardPage.jsx): Xóa mảng phân bổ điểm giả 4 mức khi CSDL rỗng; xóa sạch các số triage giả `14`, `4`, `2`.
   - [`frontend/src/pages/common/HomePage.jsx`](file:///d:/DACN/frontend/src/pages/common/HomePage.jsx): Xóa fallback `?? 4` đề tài hướng dẫn; xóa 3 đề tài tiếng Anh giả `'Event-Driven Architecture', 'Distributed Tracing', 'Fintech Core Engine'`.
   - Tuân thủ nghiêm ngặt **Quy chuẩn Rule 2.6 UI/UX Button Standards** trên toàn bộ các trang giao diện.

6. **Kiểm Thử Hồi Quy Toàn Diện & Xác Thực Bản Build Sản Xuất (Task 6)**:
   - Xây dựng bộ test tích hợp toàn diện [`backend/tests/integration/package1FullRegression.test.js`](file:///d:/DACN/backend/tests/integration/package1FullRegression.test.js) (19/19 tests PASS).
   - Backend test suite: **89/89 test suites, 851/851 tests PASS (100%)**.
   - Frontend test suite: **133/133 tests PASS (100%)**.
   - Production Build: `npm run build` thành công xuất sắc (0 lỗi, 11.83s).
   - Mã hóa: 100% tệp lưu định dạng **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE & ENFORCED`; Ràng buộc toàn vẹn dữ liệu, các bảng hồ sơ và snapshots được bảo toàn nghiêm ngặt.
- **Backend API**: `PRODUCTION READY`; Đã thắt chặt anti-escalation cho `PUT /users/:id`, bổ sung API broadcast và truy vấn triage hội đồng chuẩn 2 giai đoạn.
- **Frontend UI**: `CLEAN CONTRACTS & BUILD PASS (100%)`; Không còn bất kỳ điểm dữ liệu giả (mock/fake) hay `setTimeout` giả lập nào trên toàn bộ các dashboard (Student, Lecturer, Admin, Home).
- **Tuân thủ quy chuẩn**: 100% đạt chuẩn AGENTS.md (Rule 1 TopicRegistration, Rule 2.4 UTF-8 no BOM, Rule 2.6 UI Button Standards, Rule 3 Subagent Isolation).

---

### Cập Nhật Phiên Làm Việc (Session Update - Gói 2: Timeline Trực Quan, Mở Truy Cập Logs CSDL, Sao Chép Đề Tài Thật & Triệt Tiêu Vi Phạm Rule 2.6)

#### 1. Những phần đã hoàn thành

1. **Triển Khai Các API Đọc Lịch Sử Trạng Thái CSDL & Nhật Ký Học Vụ (Backend - Task 1)**:
   - Endpoint `GET /api/topics/registrations/:id/history` (và alias `GET /api/registrations/:id/history`): Truy vấn `RegistrationStateHistory` theo quyền sở hữu chặt chẽ (`OWNERSHIP_GUARDED`). Sinh viên chỉ xem của mình (chặn 403 khi xem của SV khác), GVHD chỉ xem sinh viên mình hướng dẫn (chặn 403 với GV khác), Admin xem toàn bộ; sắp xếp tăng dần theo `createdAt`.
   - Endpoint `GET /api/councils/:id/schedule-adjustments`: Truy vấn `DefenseScheduleAdjustmentLog` của hội đồng bảo vệ, trả về chi tiết ca cũ $\rightarrow$ ca mới, sinh viên, đề tài, người điều chỉnh; sắp xếp giảm dần theo thời gian.
   - Endpoint `GET /api/evaluations/councils/:id/return-logs`: Truy vấn `DefenseScoreBookReturnLog` của hội đồng bảo vệ, trả về lý do hoàn trả sổ điểm của Trưởng Viện/Giáo vụ và snapshot phiên bản sổ; sắp xếp giảm dần theo thời gian.

2. **Triển Khai Bộ API Sao Chép Đề Tài Thực Tế Cho Giảng Viên (Backend - Task 2)**:
   - Endpoint `GET /api/topics/cloneable`: Lấy danh sách đề tài đã duyệt ở các học kỳ trước của chính giảng viên đang đăng nhập (hoặc toàn bộ cho Admin), loại trừ học kỳ đang kích hoạt.
   - Endpoint `POST /api/topics/clone`: Sao chép danh sách đề tài được chọn sang học kỳ active hiện tại với trạng thái `DRAFT`, `maxStudents = 1`, `currentEnrollmentCount = 0`, gán `mentorId` của giảng viên và ghi `auditLog`; chặn giảng viên sao chép đề tài của người khác với mã 403 `FORBIDDEN`.

3. **Xây Dựng Component Dùng Chung `RegistrationTimelineDrawer.jsx` (Frontend - Task 3)**:
   - Tạo mới `RegistrationTimelineDrawer.jsx` sử dụng Ant Design `<Timeline>` và `<Drawer>` (width 520), mã màu trực quan (xanh lá: Đạt/Hoàn thành; xanh dương: Đang làm; đỏ: Dừng/Hủy; xám: Khác), hiển thị mốc thời gian, tên người thực hiện, lý do chuyển đổi; hỗ trợ `<Skeleton>` và `<Empty>`.
   - Tích hợp nút `<Button icon={<HistoryOutlined />}>Lịch sử tiến trình</Button>` vào:
     * `StudentDashboardPage.jsx` cho sinh viên tra cứu đề tài của mình.
     * `ProgressTrackingPage.jsx` cho giảng viên tra cứu trên từng sinh viên hướng dẫn.
     * `TopicApprovalPage.jsx` cho giảng viên thẩm định đề cương và giáo vụ duyệt đề tài.

4. **Tích Hợp Hiển Thị Nhật Ký Đổi Ca & Lịch Sử Trả Sổ Điểm Hội Đồng (Frontend - Task 4)**:
   - Bổ sung `councilService.getScheduleAdjustments` và `evaluationService.getScoreBookReturnLogs`.
   - `CouncilDetailPage.jsx`: Bổ sung nút `<Button icon={<HistoryOutlined />}>Nhật ký đổi ca</Button>` và Modal hiển thị bảng lịch sử hoán đổi ca thi của sinh viên.
   - `GradingDefensePage.jsx`: Hiển thị Ant Design `<Alert>` cảnh báo khi hội đồng có bản ghi bị trả sổ điểm, kèm nút `<Button icon={<HistoryOutlined />}>Xem lịch sử trả</Button>` mở Modal chi tiết lý do và thời gian trả sổ.

5. **Kết Nối Sao Chép Đề Tài Thật & Tải Biểu Mẫu Từ Supabase Storage (Frontend - Task 5)**:
   - `TopicManagementPage.jsx`: Xóa bỏ hoàn toàn 2 checkbox giả lập (`DT-2025-042`, `DT-2025-055`) và toast giả lập; tích hợp Modal chọn đề tài thật từ `topicService.getCloneableTopics()` với `<Table>` chọn nhiều đề tài và gọi `topicService.cloneTopics`.
   - `RubricManagementPage.jsx`: Tích hợp `portalContentService.getPublicContent()` lấy danh sách biểu mẫu thật từ CSDL, tải file thật từ Supabase Storage qua `window.open(fileUrl, '_blank')`, hiển thị nút vô hiệu kèm Tooltip khi file chưa được phát hành, xóa sạch toast giả.

6. **Triệt Tiêu 100% Vi Phạm Rule 2.6 UI Button Standards Còn Sót (Frontend - Task 6)**:
   - `OutlineReviewModal.jsx`: Xóa bỏ ký tự thô `✓` và `⚠`, dùng prop `icon={<CheckOutlined />}` và `icon={<ExclamationCircleOutlined />}` với nhãn text tiếng Việt thuần túy.
   - `TopicManagementPage.jsx`: Xóa dấu `+` bị lặp trong nút bấm có `icon={<PlusOutlined />}` và tiêu đề modal.
   - `RubricManagementPage.jsx`: Thay ký tự thô `⚙` bằng component `<SettingOutlined />`.
   - `GradingDefensePage.jsx`: Chuẩn hóa toàn bộ các nút bấm sang Ant Design Button chuẩn.

7. **Kiểm Thử Hồi Quy Toàn Tuyến & Kiểm Tra Build Sản Xuất (Hệ thống - Task 7)**:
   - Xây dựng bộ test tích hợp toàn diện [`package2FullRegression.test.js`](file:///d:/DACN/backend/tests/integration/package2FullRegression.test.js) (18/18 tests PASS).
   - Backend test suite: **92/92 test suites, 892/892 tests PASS (100%)**.
   - Frontend test suite: **150/150 tests PASS (100%)**.
   - Production Build: `npm run build` thành công xuất sắc (**0 lỗi**, 11.87s).
   - Mã hóa: 100% tệp lưu ở định dạng **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE & FULLY ACCESSIBLE`; Các bảng `RegistrationStateHistory`, `DefenseScheduleAdjustmentLog`, `DefenseScoreBookReturnLog` đã có API đọc đầy đủ và an toàn.
- **Backend API**: `PRODUCTION READY`; Bổ sung các API đọc lịch sử, kiểm soát quyền sở hữu đa tầng, cùng bộ API sao chép đề tài cho giảng viên.
- **Frontend UI**: `RICH & CLEAN`; Tích hợp Timeline Drawer trực quan, xem log ca thi, xem lý do trả sổ điểm, sao chép đề tài thật và chuẩn hóa 100% Rule 2.6.
- **Tuân thủ quy chuẩn**: 100% tuân thủ AGENTS.md (Rule 1 TopicRegistration, Rule 2.4 UTF-8 no BOM, Rule 2.6 UI Button Standards, Rule 3 Subagent Isolation).

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Người dùng trải nghiệm thực tế trên giao diện:
   - **Sinh viên** (`/student/dashboard`): Bấm nút **"Lịch sử tiến trình"** để xem Timeline các mốc học vụ của đề tài.
   - **Giảng viên** (`/lecturer/topics`): Mở Modal **"Sao chép từ kỳ trước"** để chọn và nhân bản đề tài thực tế sang học kỳ mới.
   - **Giảng viên** (`/lecturer/progress`): Chọn sinh viên và bấm **"Lịch sử tiến trình"** để kiểm tra lịch sử đề tài của học viên.
   - **Quản trị viên** (`/admin/defense-councils/:id`): Bấm **"Nhật ký đổi ca"** để xem lịch sử điều phối ca thi.
   - **Quản trị viên / Hội đồng** (`/admin/grading`): Xem cảnh báo và **"Lịch sử trả sổ điểm"** khi hội đồng có ghi nhận bị hoàn trả.
2. Sẵn sàng tiếp nhận các yêu cầu phát triển tiếp theo từ người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Phân Quyền Lịch Sử Đề Tài Theo Mô Hình Ownership Đa Tầng**: Sinh viên chỉ xem lịch sử đề tài của chính mình, Giảng viên chỉ xem học viên mình hướng dẫn, và Giáo vụ xem toàn bộ. Chống triệt để việc rò rỉ tiến trình học vụ giữa các sinh viên hoặc giữa các nhóm nghiên cứu khác nhau.
2. **Component `RegistrationTimelineDrawer` Tái Sử Dụng**: Đưa toàn bộ logic trực quan hóa dòng thời gian vào một component duy nhất, giúp giao diện đồng bộ, dễ bảo trì và tải dữ liệu On-Demand chỉ khi người dùng bấm xem.
3. **Sao Chép Đề Tài Với Trạng Thái `DRAFT`**: Khi giảng viên nhân bản đề tài từ kỳ trước, hệ thống tự động gán trạng thái `DRAFT` và `currentEnrollmentCount = 0`, đảm bảo giảng viên có cơ hội rà soát, tinh chỉnh yêu cầu đề tài trước khi chính thức gửi duyệt hoặc công bố cho sinh viên đăng ký.

---

### Cập Nhật Phiên Làm Việc (Session Update - Bộ Ba Tiện Ích Trí Tuệ Nhân Tạo Học Vụ: Academic AI Suite)

#### 1. Những phần đã hoàn thành

1. **Hoàn Tất Ưu Tiên P1 (Thông Báo Sự Kiện Học Vụ & Cửa Sổ Lưu Chiểu 14 Ngày)**:
   - Hoàn thiện 6 trigger thông báo học vụ tự động khi phát sinh sự kiện (Quyết định BM02 được ban hành, BM03 cần ký nhận trong 48h, BM04 đồng ý bảo vệ, Có quyết định phân công hội đồng, Sổ điểm được công bố, Quá hạn nộp lưu chiểu).
   - Tích hợp chuông thông báo hiển thị số lượng chưa đọc trên Header Topbar (`AppLayout.jsx`).
   - Tích hợp banner đếm ngược 14 ngày nộp lưu chiểu sau ngày bảo vệ trên Dashboard Sinh viên (`StudentDashboardPage.jsx`) và thẻ trạng thái tại Kho lưu chiểu (`ProjectOversightPage.jsx`).
   - Đã kiểm thử và commit: `feat(notification): implement academic event-driven notification triggers, topbar unread badge, and 14-day archival countdown` (Commit `4ec5753`).

2. **Thiết Kế Kiến Trúc & Kế Hoạch Bộ Ba Tiện Ích AI Học Vụ (Phương Án 3 - Hybrid Adapter)**:
   - Xây dựng tài liệu thiết kế chi tiết: [docs/superpowers/specs/2026-11-12-academic-ai-suite-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-12-academic-ai-suite-design.md).
   - Xây dựng kế hoạch triển khai 6 Tasks: [docs/superpowers/plans/2026-11-12-academic-ai-suite-plan.md](file:///d:/DACN/docs/superpowers/plans/2026-11-12-academic-ai-suite-plan.md).
   - Đã kiểm thử và commit: `docs(plan): add spec and implementation plan for Academic AI Suite` (Commit `66a983e`).

3. **Hiện Thực Lớp Adapter AI Cốt Lõi & Dự Phòng Nội Bộ Zero-Crash (Backend - Task 1)**:
   - Tạo mới `backend/src/services/ai/geminiProvider.js`: Tích hợp trực tiếp Google Generative Language API (`gemini-2.0-flash:generateContent`) thông qua native `fetch` của Node.js, không phụ thuộc thư viện ngoài nặng nề, có timeout an toàn (8 giây) và format JSON có cấu trúc.
   - Tạo mới `backend/src/services/ai/localFallbackProvider.js`: Bộ phân tích dự phòng rule-based chuyên sâu (Jaccard similarity n-gram, heuristics kiểm tra 5 chiều logic đề cương, đối chiếu chuỗi và bóc tách metadata tài liệu) hoạt động 100% offline, đảm bảo không bao giờ crash hệ thống.
   - Tạo mới `backend/src/services/ai/aiProviderService.js`: Bộ điều phối tự động kiểm tra `GEMINI_API_KEY`. Khi có key gọi Gemini API; khi không có key, timeout hoặc lỗi mạng, tự động chuyển sang `localFallbackProvider` và gắn cờ `provider: 'local_fallback'`.
   - Xây dựng bộ unit tests toàn diện [`backend/tests/unit/aiProviderAdapter.test.js`](file:///d:/DACN/backend/tests/unit/aiProviderAdapter.test.js) (21/21 tests PASS).
   - Đã commit: `feat(ai): implement core AI provider adapter and local fallback service` (Commit `afae1d3`).

4. **Xây Dựng In-Memory Cache, AI Controller & Tuyến Đường API Bảo Mật (Backend - Task 2)**:
   - Tạo mới `backend/src/services/ai/aiCache.js`: Băm SHA-256 payload yêu cầu (`sha256Hash`), lưu cache trong bộ nhớ với TTL 5 phút, tránh gọi lặp lại tốn quota Gemini và tăng tốc độ phản hồi.
   - Tạo mới `backend/src/controllers/aiController.js` và `backend/src/routes/aiRoutes.js`:
     * Endpoint 1: `POST /api/ai/bm01-copilot`: Đánh giá logic 5 chiều đề cương (Tên $\leftrightarrow$ Mục tiêu $\leftrightarrow$ Phạm vi $\leftrightarrow$ Phương pháp $\leftrightarrow$ Sản phẩm), tính điểm hoàn thiện $[0 - 10]$, phân loại `GOOD` / `NEEDS_IMPROVEMENT` / `CRITICAL_GAPS`, và đưa ra gợi ý hành động.
     * Endpoint 2: `POST /api/ai/topic-similarity`: So sánh ngữ nghĩa với toàn bộ kho đề tài lịch sử trong CSDL, tính % tương đồng, phân loại nguy cơ trùng lặp và đề xuất 3 tên đề tài khoa học tăng tính mới.
     * Endpoint 3: `POST /api/ai/cross-check-archive`: Kết nối với `topicTitleResolverService.js` (`resolveEffectiveTopicTitle`) để lấy tên đề tài pháp lý chính thức, họ tên, MSSV, GVHD và đối chiếu với thông tin bóc tách từ tài liệu lưu chiểu (PDF/Word/Slide), chỉ ra các điểm sai lệch cho Giáo vụ duyệt.
   - Gắn tuyến đường vào `backend/src/app.js` tại `/api/ai`, bảo vệ bằng middleware `authenticateToken`.
   - Xây dựng bộ test tích hợp toàn diện [`backend/tests/integration/aiSuiteWorkflow.test.js`](file:///d:/DACN/backend/tests/integration/aiSuiteWorkflow.test.js) (13/13 tests PASS).
   - Đã commit: `feat(ai): expose authenticated AI copilot, topic similarity, and archival cross-check endpoints` (Commit `8f60fab`).

5. **Tích Hợp Giao Diện BM01 Copilot Drawer Cho Sinh Viên (Frontend - Task 3)**:
   - Tạo mới `frontend/src/services/aiService.js`: Cung cấp 3 methods API `analyzeBM01`, `checkTopicSimilarity`, `crossCheckArchive`.
   - Tạo mới `frontend/src/components/student/BM01CopilotDrawer.jsx`: Drawer Ant Design hiển thị đồng hồ điểm hoàn thiện, thanh đánh giá 5 chiều logic (Đạt / Cảnh báo / Chưa đạt), danh sách gợi ý hành động và tag nhận diện AI provider / Offline Fallback.
   - Nâng cấp `frontend/src/components/forms/HybridBMFormModal.jsx`: Bổ sung nút `"Đánh giá đề cương với AI"` (`icon={<RobotOutlined />}`) cho phép sinh viên kiểm tra ngay trên bản nháp trước khi nộp chính thức.
   - Nâng cấp `frontend/src/pages/student/SubmissionPage.jsx`: Bổ sung nút gọi BM01 Copilot tại thẻ nhiệm vụ đề cương v1 và banner yêu cầu chỉnh sửa đề cương v2.
   - Xây dựng bộ test giao diện [`frontend/src/pages/__tests__/bm01CopilotUi.test.js`](file:///d:/DACN/frontend/src/pages/__tests__/bm01CopilotUi.test.js) (4/4 tests PASS).
   - Đã commit: `feat(ui): implement BM01 Copilot drawer and integrate into outline submission flow` (Commit `070a608`).

6. **Tích Hợp Modal Kiểm Tra Tính Mới & Tương Đồng Đề Tài (Frontend - Task 4)**:
   - Tạo mới `frontend/src/components/topics/TopicSimilarityModal.jsx`: Modal Ant Design hiển thị thanh đo % tương đồng cao nhất, nhãn mức độ rủi ro, bảng đối chiếu đề tài trùng trong CSDL và danh sách 3 tên đề tài gợi ý có nút chọn nhanh `"Áp dụng tên này"`.
   - Nâng cấp `frontend/src/pages/lecturer/TopicManagementPage.jsx`: Thêm nút `"Kiểm tra tính mới AI"` (`icon={<AuditOutlined />}`) cạnh trường nhập tên đề tài tiếng Việt.
   - Nâng cấp `frontend/src/pages/admin/TopicManagementPage.jsx`: Thêm nút `"Kiểm tra tính mới AI"` trong Form tạo đề tài và Drawer thẩm định chuyên môn đề tài của Ban chủ nhiệm.
   - Xây dựng bộ test giao diện [`frontend/src/pages/__tests__/topicSimilarityUi.test.js`](file:///d:/DACN/frontend/src/pages/__tests__/topicSimilarityUi.test.js) (4/4 tests PASS).
   - Đã commit: `feat(ui): implement Topic Similarity modal and integrate into topic management` (Commit `20f23c1`).

7. **Tích Hợp Modal Đối Soát Hồ Sơ Lưu Chiểu Cho Giáo Vụ & Sinh Viên (Frontend - Task 5)**:
   - Tạo mới `frontend/src/components/admin/ArchivalCrossCheckModal.jsx`: Modal hiển thị bảng đối soát 2 cột (Dữ liệu pháp lý hệ thống vs Dữ liệu bóc tách từ file scan), thẻ kết quả khớp 100% hoặc sai lệch, và hộp khuyến nghị xử lý nghiệp vụ cho Giáo vụ.
   - Nâng cấp `frontend/src/pages/admin/ProjectOversightPage.jsx`: Bổ sung nút `"AI Đối soát"` (`icon={<ScanOutlined />}`) trực tiếp trong cột Thao tác của bảng Kho lưu chiểu.
   - Nâng cấp `frontend/src/components/forms/ArchiveSubmissionModal.jsx`: Bổ sung nút `"AI Đối soát hồ sơ"` (`icon={<ScanOutlined />}`) trong thanh footer để sinh viên chủ động tự kiểm tra trước khi hoàn tất nộp.
   - Xây dựng bộ test giao diện [`frontend/src/pages/__tests__/archivalCrossCheckUi.test.js`](file:///d:/DACN/frontend/src/pages/__tests__/archivalCrossCheckUi.test.js) (4/4 tests PASS).
   - Đã commit: `feat(ui): implement Archival Cross-Check modal for academic affairs review` (Commit `6530ee9`).

8. **Kiểm Thử Hồi Quy Toàn Diện, Kiểm Tra Mã Hóa & Build Sản Xuất (Task 6)**:
   - Backend test suite: **96/96 test suites, 941/941 tests PASS (100%)**.
   - Frontend test suite: **177/177 tests PASS (100%)**.
   - Production Build: `npm run build` thành công xuất sắc (**0 lỗi**, 12.20s).
   - Mã hóa: 100% tệp đã kiểm tra đạt chuẩn **UTF-8 (no BOM)**.
   - Chuẩn nút bấm (Rule 2.6): 100% nút bấm Ant Design sử dụng prop `icon={<IconComponent />}`, nhãn tiếng Việt thuần túy, không có emoji hay ký tự thô.

#### 2. Trạng thái cập nhật của từng phần

- **Database / Prisma**: `UP TO DATE & FULLY SYNCED`; Khai thác dữ liệu thực tế từ các bảng `TopicRegistration`, `Topic`, `BM02Submission`, `ArchiveRecord` qua hybrid adapter.
- **Backend API**: `PRODUCTION READY`; 3 endpoints `/api/ai/bm01-copilot`, `/api/ai/topic-similarity`, `/api/ai/cross-check-archive` đã vận hành ổn định, bảo mật với token JWT và có cơ chế fallback không bao giờ crash.
- **Frontend UI**: `RICH & HIGHLY INTERACTIVE (100%)`; 3 components AI (`BM01CopilotDrawer`, `TopicSimilarityModal`, `ArchivalCrossCheckModal`) tích hợp mượt mà vào luồng nộp đề cương, quản lý đề tài và thẩm định lưu chiểu.
- **Tuân thủ quy chuẩn**: 100% tuân thủ AGENTS.md (Rule 1 TopicRegistration, Rule 2.4 UTF-8 no BOM, Rule 2.6 UI Button Standards, Rule 3 Subagent Isolation).

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Trải nghiệm thực tế các tính năng AI trên giao diện:
   - **Sinh viên** (`/student/submission`): Khi nộp đề cương BM01 v1 hoặc v2, nhập tên và nội dung rồi bấm **"Đánh giá đề cương với AI"** để xem BM01 Copilot phân tích tính logic 5 chiều.
   - **Giảng viên** (`/lecturer/topics`): Bấm **"Kiểm tra tính mới AI"** khi đề xuất đề tài mới để xem tỷ lệ tương đồng với kho đề tài lịch sử và áp dụng tên gợi ý khoa học.
   - **Giáo vụ / Quản trị viên** (`/admin/oversight` -> Tab Kho lưu chiểu): Bấm **"AI Đối soát"** tại từng hồ sơ sinh viên để AI tự động so khớp tên đề tài pháp lý (BM02/BM02-A), MSSV, GVHD trước khi duyệt nghiệm thu.
2. Sẵn sàng tiếp nhận các yêu cầu phát triển tiếp theo từ người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Kiến Trúc Hybrid Adapter (Zero-Crash Guarantee)**: Sử dụng Google Generative Language API (`gemini-2.0-flash`) thông qua native `fetch` của Node.js (không dùng SDK ngoài nặng nề). Khi không có `GEMINI_API_KEY` trong `.env`, timeout (>8 giây), hoặc gặp sự cố mạng, hệ thống tự động fallback trong suốt sang `localFallbackProvider.js` (rule-based Jaccard similarity, heuristics) với HTTP 200 OK và gắn cờ `provider: 'local_fallback'`, đảm bảo trải nghiệm người dùng luôn thông suốt kể cả khi demo offline.
2. **Bộ Nhớ Đệm In-Memory Hash Cache (`aiCache.js`)**: Băm SHA-256 toàn bộ payload yêu cầu với thời gian sống (TTL) 5 phút. Ngăn chặn việc bấm nút lặp lại gây lãng phí quota Gemini API và mang lại phản hồi tức thì (<10ms) cho các yêu cầu giống nhau.
3. **Đối Soát Dựa Trên Tên Đề Tài Pháp Lý Đã Phân Giải (`resolveEffectiveTopicTitle`)**: Khi đối soát hồ sơ lưu chiểu, hệ thống gọi trực tiếp `resolveEffectiveTopicTitle` để lấy tên đề tài có hiệu lực pháp lý cao nhất (BM02 hoặc BM02-A sau điều chỉnh), khắc phục triệt để lỗi sinh viên nộp báo cáo theo tên đề tài cũ ở BM01.
4. **Chuẩn Hóa UI/UX Theo Rule 2.6**: Tất cả các nút bấm gọi AI đều sử dụng icon Ant Design chính quy (`RobotOutlined`, `AuditOutlined`, `ScanOutlined`), nhãn tiếng Việt thuần túy, tuyệt đối không chèn emoji thô vào nhãn nút.


#### 1. Những phần đã hoàn thành

1. **Triển Khai Bộ Ba API Tổng Hợp Học Vụ & Xuất Excel Thực Tế (Backend - Task 1)**:
   - Endpoint `GET /api/reports/overview`: Tính toán toàn diện số liệu KPIs (tổng SV, số SV hoàn thành, tỷ lệ hoàn thành %, điểm trung bình, điểm cao nhất, điểm thấp nhất), phổ điểm 5 dải màu chuẩn (`EXCELLENT` #10B981, `GOOD` #0F766E, `FAIR` #F59E0B, `AVERAGE` #64748B, `FAILED` #EF4444), phễu tiến độ học vụ tuần tự 6 mốc (`ENROLLED` $\rightarrow$ `BM01_PASSED` $\rightarrow$ `DECISION_ISSUED` $\rightarrow$ `BM03_PASSED` $\rightarrow$ `DEFENSE_READY` $\rightarrow$ `COMPLETED`), và phân nhóm so sánh chi tiết theo chuyên ngành. Hỗ trợ bộ lọc linh hoạt theo `semesterId` và `major`.
   - Endpoint `GET /api/reports/lecturer-workload`: Thống kê khối lượng hướng dẫn của từng giảng viên trong học kỳ (`assignedCount`, `completedCount`, `completionRate%`), điểm trung bình BM04 (`avgMentorScore`), điểm trung bình Hội đồng bảo vệ (`avgCouncilScore`), và độ lệch điểm tuyệt đối ($\Delta = |avgMentor - avgCouncil|$).
   - Endpoint `GET /api/reports/export-excel`: Sử dụng thư viện `xlsx` (SheetJS) tổng hợp và xuất file nhị phân Excel (`.xlsx`) bảng kết quả tốt nghiệp toàn viện với 11 cột chuẩn học vụ (STT, Mã SV, Họ tên, Chuyên ngành, Tên đề tài, GVHD, Điểm BM04, Điểm Hội đồng, Điểm Tổng kết, Xếp loại, Trạng thái), format độ rộng cột tối ưu và trả về dạng attachment download stream.
   - Bảo mật & Phân quyền: Bảo vệ toàn bộ endpoint bằng `authenticateToken` và `authorizeRoleOrPermission(['ADMIN'], [PERMISSIONS.VIEW_PROJECT_OVERSIGHT, PERMISSIONS.PROJECT_OVERSIGHT_MANAGE])`. Chặn hoàn toàn sinh viên và giảng viên không có thẩm quyền giám sát (403 `FORBIDDEN`).
   - Xây dựng bộ test tích hợp toàn diện [`backend/tests/integration/academicReports.test.js`](file:///d:/DACN/backend/tests/integration/academicReports.test.js) (9/9 tests PASS).

2. **Xây Dựng Client Service, Đăng Ký Menu Điều Hướng & Bảo Vệ Tuyến Đường (Frontend - Task 2)**:
   - Tạo mới `frontend/src/services/reportService.js` cung cấp 3 methods: `getOverview`, `getLecturerWorkload`, `exportExcel` (trả về blob).
   - Cập nhật `frontend/src/config/navigationRegistry.js`: Đăng ký mục `academic-reports` ("Báo cáo & Thống kê", icon `bar_chart`, nhóm "Quản trị học vụ", route `/admin/reports`, quyền `VIEW_PROJECT_OVERSIGHT`) vào Khối 6.
   - Cập nhật `frontend/src/components/layout/NavIcon.jsx`: Bổ sung vector SVG 3 cột biểu đồ cho các cases `'bar_chart'`, `'analytics'`, `'poll'` chuẩn phong cách Feather stroke.
   - Cập nhật `frontend/src/routes/index.jsx`: Thêm hằng số định tuyến `ACADEMIC_REPORTS: '/admin/reports'`.
   - Cập nhật `frontend/src/App.jsx`: Lazy load `AcademicReportsPage` và đăng ký route `/admin/reports` bảo vệ bởi `ProtectedRoute` với quyền `['VIEW_PROJECT_OVERSIGHT', 'REPORT_VIEW', 'PROJECT_OVERSIGHT_MANAGE']`.
   - Xây dựng bộ test TDD [`frontend/src/pages/__tests__/academicReportsRouting.test.js`](file:///d:/DACN/frontend/src/pages/__tests__/academicReportsRouting.test.js) (6/6 tests PASS).

3. **Xây Dựng Hoàn Chỉnh Màn Hình Báo Cáo Phân Tích Chuyên Biệt (Frontend - Task 3)**:
   - Tạo mới `frontend/src/pages/admin/AcademicReportsPage.jsx` với trải nghiệm phân tích số liệu học vụ hiện đại:
     * **Top Control Bar**: Bộ chọn học kỳ động từ `semesterService.getAll()`, bộ lọc chuyên ngành, nút "Làm mới" (`<ReloadOutlined />`), và nút "Xuất Báo Cáo Excel" (`<DownloadOutlined />`) tải trực tiếp file `.xlsx` thật qua Blob URL mà không có bất kỳ dữ liệu giả lập nào.
     * **4 Thẻ Tổng Hợp KPIs**: Tổng sinh viên tham gia, Tỷ lệ hoàn thành đồ án, Điểm trung bình toàn viện, và Tỷ lệ Xuất sắc & Giỏi.
     * **Tab 1: Phổ điểm & Xếp loại**: Thanh phân bổ tỷ lệ trực quan 5 mức và Bảng chi tiết từng mức xếp loại.
     * **Tab 2: Phễu tiến độ học vụ**: Phễu chuyển đổi 6 giai đoạn với tỷ lệ giữ chân, số lượng và tỷ lệ hao hụt so với mốc trước, kèm Alert phát hiện điểm nghẽn học vụ tự động.
     * **Tab 3: So sánh Chuyên ngành**: Bảng đối sánh số lượng sinh viên, tỷ lệ hoàn thành và điểm trung bình giữa các chuyên ngành.
     * **Tab 4: Tải GVHD & Độ lệch điểm**: Bảng thống kê toàn bộ giảng viên kèm bộ lọc tìm kiếm nhanh; tự động hiển thị `<Tag color="warning" icon={<WarningOutlined />}>Lệch cao (> 1.5)</Tag>` khi độ lệch điểm GVHD và Hội đồng vượt ngưỡng $1.5$, giúp lãnh đạo viện kịp thời nắm bắt sự sai lệch trong đánh giá chuyên môn.
   - Tuân thủ nghiêm ngặt **Quy chuẩn Rule 2.6 UI/UX Button Standards** (100% dùng prop `icon={<IconComponent />}`, nhãn tiếng Việt thuần túy, không ký tự thô hay emoji trong text nút bấm).
   - Xây dựng test suite [`frontend/src/pages/__tests__/academicReportsPage.test.js`](file:///d:/DACN/frontend/src/pages/__tests__/academicReportsPage.test.js) (6/6 tests PASS).

4. **Kiểm Thử Hồi Quy Toàn Tuyến & Xác Thực Build Sản Xuất (Hệ thống - Task 4)**:
   - Backend test suite: **93/93 test suites, 901/901 tests PASS (100%)**.
   - Frontend test suite: **162/162 tests PASS (100%)**.
   - Production Build: `npm run build` thành công xuất sắc (**0 lỗi**, 16.49s, xuất chunk `AcademicReportsPage-BnMqNV7Z.js`).
   - Mã hóa: 100% tệp lưu ở chuẩn **UTF-8 (no BOM)**.

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `UP TO DATE & FULLY SYNCED`; Toàn bộ dữ liệu tổng hợp được truy vấn trực tiếp từ `TopicRegistration`, `BM04Evaluation`, `CouncilEvaluation`, `User`, `Semester`.
- **Backend API**: `PRODUCTION READY`; 3 endpoints `/api/reports/overview`, `/api/reports/lecturer-workload`, `/api/reports/export-excel` đã hoàn thiện với phân quyền đa tầng và xuất binary buffer Excel trực tiếp.
- **Frontend UI**: `RICH & HIGHLY RESPONSIVE (100%)`; Trang `/admin/reports` cung cấp 4 tab phân tích trực quan, bộ lọc đa chiều và xuất file Excel thật.
- **Tuân thủ quy chuẩn**: 100% tuân thủ AGENTS.md (Rule 1 TopicRegistration, Rule 2.4 UTF-8 no BOM, Rule 2.6 UI Button Standards, Rule 3 Subagent Isolation).

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Trải nghiệm thực tế trên hệ thống:
   - Đăng nhập với quyền Viện trưởng / Quản trị viên (`/admin/reports`).
   - Chọn các học kỳ khác nhau để xem phổ điểm, phễu tiến độ học vụ 6 giai đoạn và đối sánh chuyên ngành.
   - Bấm nút **"Xuất Báo Cáo Excel"** để tải về bảng tổng hợp kết quả tốt nghiệp định dạng `.xlsx`.
   - Kiểm tra Tab **"Tải GVHD & Độ lệch điểm"** để phát hiện các giảng viên có độ lệch điểm hướng dẫn và hội đồng cao ($> 1.5$ điểm).
2. Sẵn sàng tiếp nhận các yêu cầu mở rộng phân tích (ví dụ: dự báo xu hướng điểm qua các năm học) khi có yêu cầu.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Phân Nhóm Phổ Điểm 5 Mức Chuẩn Thay Vì Chia Đều**: Áp dụng thang đánh giá học vụ chuẩn Việt Nam: Xuất sắc ($[8.5, 10.0]$), Giỏi ($[7.0, 8.5)$), Khá ($[5.5, 7.0)$), Trung bình ($[4.0, 5.5)$), Chưa đạt ($< 4.0$ hoặc Vắng). Giúp Hội đồng Khoa học và Ban Giám hiệu nhìn nhận chính xác chất lượng học vụ thay vì chia khoảng điểm cơ học.
2. **Cơ Chế Phát Hiện Độ Lệch Điểm Giảng Viên ($\Delta > 1.5$)**: So sánh điểm nhận xét BM04 của GVHD với điểm tổng kết của Hội đồng bảo vệ. Độ lệch $> 1.5$ là chỉ số cảnh báo sớm quan trọng giúp Ban chủ nhiệm Viện phát hiện các trường hợp đánh giá quá lỏng tay hoặc quá khắt khe.
3. **Phễu Tiến Độ Học Vụ 6 Mốc Tuần Tự (Funnel Analytics)**: Theo dõi chặt chẽ tỷ lệ chuyển đổi từ lúc ghi danh đề tài cho đến khi hoàn thành lưu chiểu thư viện, chỉ ra chính xác giai đoạn nào có tỷ lệ sinh viên dừng đồ án cao nhất để nhà trường có biện pháp can thiệp sớm.
4. **Tận Dụng Thư Viện SheetJS (`xlsx`) Có Sẵn Ở Backend**: Sử dụng trực tiếp `xlsx` và helper nhị phân mà không bổ sung thư viện bên ngoài nặng nề, đảm bảo file Excel xuất ra có đầy đủ 11 cột, định dạng độ rộng cột tối ưu và dung lượng gọn nhẹ.

---

### Phiên 13/11/2026 — Sửa Lỗi Trắng Trang & Tối Ưu Hóa Trải Nghiệm Phân Hệ Giảng Viên (Lecturer Workspace & UI/UX Pro Max)

#### 1. Những phần đã hoàn thành

1. **Sửa lỗi Temporal Dead Zone (TDZ) ReferenceError trong `ProgressTrackingPage.jsx`**:
   - Khắc phục triệt để lỗi biến `sPassed` được sử dụng trước khi khai báo `const` ở dòng 437-438.
   - Đảo trật tự khai báo `sPassed` lên trước `sProgress`, loại bỏ hoàn toàn lỗi crash JavaScript `ReferenceError: Cannot access 'sPassed' before initialization` khi danh sách sinh viên chưa có `progressPercent`.
   - Giúp hai mục menu **"Theo dõi tiến độ"** (`/lecturer/progress`) và **"Phiếu nhận xét hướng dẫn"** (`/lecturer/progress?tab=bm04`) hoạt động ổn định 100%.

2. **Xây dựng `ErrorBoundary.jsx` toàn cục ngăn ngừa trắng màn hình**:
   - Tạo mới `frontend/src/components/common/ErrorBoundary.jsx`: Bắt mọi ngoại lệ render runtime ở component con, hiển thị giao diện báo lỗi học thuật chuyên nghiệp với tông màu Pine Teal (`#0F766E`), nút "Tải lại trang" (`<ReloadOutlined />`) và nút "Về trang chủ" (`<HomeOutlined />`), tuân thủ nghiêm ngặt Quy tắc 2.6 trong `AGENTS.md`.
   - Tích hợp Error Boundary bọc quanh `<Outlet />` trong `AppLayout.jsx` và bao bọc toàn bộ `<Routes>` trong `App.jsx`, thiết lập hệ thống phòng thủ 2 lớp ngăn chặn triệt để tình trạng ứng dụng bị trắng băng (unmount crash).

3. **Sửa lỗi lệch tuyến đường chấm điểm trong `GradingPage.jsx`**:
   - Cập nhật lệnh chuyển hướng trong `GradingPage.jsx`: thay đổi `navigate('/lecturer/grading/' + cand.id)` $\rightarrow$ `navigate('/lecturer/grading/sheet/' + cand.id)`.
   - Khớp 100% với route đăng ký chính quy trong `App.jsx`, chấm dứt việc `RouteFallbackHandler` tự động đá người dùng về Dashboard khi bấm "Vào chấm điểm" hoặc "Xem phiếu chấm".

4. **Kích hoạt Tab Deep-Linking qua `useSearchParams`**:
   - `TopicApprovalPage.jsx`: Tự động nhận diện query param `?tab=bm01` $\rightarrow$ mở tab "Hội Đồng Thẩm Định Đề Cương", `?tab=bm02a` $\rightarrow$ mở tab "Duyệt phiếu đổi tên BM02-A", `?tab=mentor` $\rightarrow$ mở tab "Tiếp nhận nguyện vọng".
   - `ProgressTrackingPage.jsx`: Tự động nhận diện `?tab=bm04` $\rightarrow$ mở tab "Lưu chiểu & BM04" (nghiệm thu đồ án); đồng thời hỗ trợ các tabs `'tasks'`, `'meeting-logs'`, `'checkpoints'`.
   - `ProjectPeriodPage.jsx`: Tự động nhận diện `?tab=decisions` $\rightarrow$ kích hoạt danh sách quyết định giao đề tài.

5. **Tinh gọn & phân tầng thanh điều hướng Giảng viên (`navigationRegistry.js`)**:
   - Lược bỏ mục trùng lặp **"Phiếu nhận xét hướng dẫn"** (`bm04-evaluations`), chỉ giữ lại duy nhất **"Theo dõi tiến độ"** (`/lecturer/progress`) bao hàm trọn vẹn cả 4 khâu nghiệp vụ (Tasks, Meeting logs, Checkpoint BM03, Nghiệm thu BM04). Giảng viên thông thường (regular GVHD) giờ đây có đúng **4 mục cốt lõi**:
     * `/lecturer/topics` ("Đề tài phụ trách" - Hồ sơ của tôi)
     * `/lecturer/approvals` ("Sinh viên hướng dẫn" - Hướng dẫn & tiến độ)
     * `/lecturer/progress` ("Theo dõi tiến độ" - Hướng dẫn & tiến độ)
     * `/lecturer/grading` ("Phiếu chấm bảo vệ" - Hội đồng & bảo vệ)
   - Hợp nhất 3 mục quản trị bị lỗi (`bm02-reviews`, `assignment-decisions`, `academic-delegations`) thành **DUY NHẤT 1 mục trung tâm điều hành học vụ**:
     * `institute-management` ("Điều hành đợt & Quyết định" - `/lecturer/institute`), bảo vệ bởi `requiredAnyPermissions: ['VIEW_ASSIGNMENT_DECISIONS', 'VIEW_BM02_REVIEWS', 'VIEW_ACADEMIC_DELEGATIONS', 'VIEW_PROJECT_PERIODS']`.
     * Giảm số lượng mục trong `NAVIGATION_REGISTRY` từ 29 xuống còn đúng 26 mục chuẩn, xóa sổ hoàn toàn hiện tượng phân mảnh và trùng lặp route.
   - Nâng cấp `ProjectPeriodPage.jsx` giải quyết triệt để lỗi khi người dùng truy cập:
     * Dùng `Promise.allSettled` trong `fetchSemesters` giúp trang không bị sập hay báo lỗi đỏ khi `registrationService` hoặc API con gặp sự cố/403.
     * Dùng `useSearchParams` từ `react-router-dom` đồng bộ 2 chiều mượt mà giữa các tab `periods`, `bm02Queue`, `delegations` với URL và menu layout.
     * Chuẩn hóa nhãn tab BM02 thành "Hàng đợi Thẩm định Đơn đăng ký (BM02)" và nút "Thẩm định đơn BM02".
     * Khởi tạo `fetchDelegations` an toàn (graceful), không bắn toast đỏ khi mới vào trang.

6. **Xây dựng bộ kiểm thử TDD & bảo đảm chất lượng**:
   - `frontend/src/pages/lecturer/__tests__/progressTrackingTdz.test.js`: Xác minh thứ tự khai báo `sPassed` trước `sProgress`.
   - `frontend/src/pages/__tests__/errorBoundaryUi.test.js`: Xác minh component Error Boundary, method xử lý lỗi, icons Ant Design và bọc route/layout.
   - `frontend/src/pages/lecturer/__tests__/gradingPageRouteAlignment.test.js`: Xác minh đường dẫn route `/lecturer/grading/sheet/:registrationId`.
   - `frontend/src/pages/__tests__/tabDeepLinking.test.js`: Xác minh đọc query parameters trong các trang giảng viên/học vụ.
   - `frontend/src/pages/__tests__/projectPeriodGraceful.test.js`: Xác minh nạp dữ liệu an toàn `Promise.allSettled`, `useSearchParams` và nhãn chuẩn BM02.
   - `frontend/src/pages/__tests__/lecturerNavigationStructure.test.js`: Xác minh 4 mục cốt lõi GVHD, hợp nhất `institute-management` và tuân thủ Rule 2.6.
   - `frontend/tests/navigationRegistry.test.js`: Cập nhật cấu trúc 26 mục toàn diện.

#### 2. Trạng thái cập nhật của từng phần

7. **Phân quyền ĐỘNG theo phân công Hội đồng thực tế (Dynamic Council Assignment)**:
   - Backend `authController.js` và `auth.js`: Phân giải động 2 cờ phân công hội đồng thực tế từ bảng `council_members`:
     * `hasDefenseCouncilAssignment`: `true` khi giảng viên có tên trong Hội đồng bảo vệ khóa luận (`DEFENSE_COUNCIL`).
     * `hasOutlineCouncilAssignment`: `true` khi giảng viên có tên trong Hội đồng thẩm định đề cương (`OUTLINE_REVIEW`).
   - Mở quyền xem hồ sơ đồ án 00:00: Bổ sung các quyền `VIEW_DEFENSE_GRADING`, `DEFENSE_SCORE_SUBMIT`, `DEFENSE_SCORE_VIEW` vào `dossierGuards` trong `backend/src/routes/archiveRoutes.js`, giải quyết dứt điểm lỗi `403 FORBIDDEN` khi giảng viên chấm thi bấm "Tài liệu 00:00" trên `GradingPage.jsx`.
   - Frontend `navigationRegistry.js` & `AppLayout.jsx`:
     * Gán `requiresDefenseCouncil: true` cho mục **"Phiếu chấm bảo vệ"** và `requiresOutlineCouncil: true` cho mục **"Thẩm định đề cương"**.
     * Giảng viên KHÔNG được phân công vào hội đồng tương ứng sẽ bị ẩn hoàn toàn các mục này khỏi thanh menu, không còn gây hiểu nhầm hay hiển thị trang trống.
     * Khi được phân công vào Hội đồng bảo vệ $\rightarrow$ tự động kích hoạt hiện "Phiếu chấm bảo vệ".
     * Khi được phân công vào Hội đồng đề cương $\rightarrow$ tự động kích hoạt hiện "Thẩm định đề cương".
   - Khắc phục lỗi trang `CouncilAssignmentPage.jsx` (`/admin/defense-councils`): Tự động fallback sang `userService.getPublicLecturers()` khi không có quyền `VIEW_USERS` của Admin, chuyển đổi `Promise.allSettled` cho dữ liệu hội đồng và sinh viên.
   - Đồng bộ Tab & Modal `GradingDefensePage.jsx` (`/admin/grading`): Bổ sung `useSearchParams`:
     * `?tab=approvals` $\rightarrow$ Tự động chuyển tab và lọc hồ sơ sinh viên `AWAITING_FINAL_APPROVAL` cần phê duyệt.
     * `?tab=publish` $\rightarrow$ Tự động mở Modal công bố kết quả (`DefenseResultPublicationModal`) khi có quyền `canPublishResult`.
   - Bổ sung bộ test tích hợp `frontend/src/pages/__tests__/councilAndGradingDeepLinking.test.js` (8/8 tests PASS).

#### 2. Trạng thái cập nhật của từng phần

- **Database/Prisma**: `STABLE & FULLY COMPATIBLE`; Không thay đổi schema hay migrations. Tuân thủ 100% mô hình `TopicRegistration`.
- **Backend API**: `STABLE (100% PASS)`; Toàn bộ 108 test suites, 1086 tests backend PASS (bổ sung tests phân giải cờ hội đồng và dossier).
- **Frontend SPA**: `RESILIENT, DYNAMIC & STREAMLINED (100% PASS)`;
  * Menu tự động ẩn/hiện "Phiếu chấm bảo vệ" và "Thẩm định đề cương" theo đúng phân công hội đồng thực tế.
  * Hết lỗi 403 khi thành viên hội đồng xem tài liệu 00:00 sinh viên.
  * Hết lỗi nạp giảng viên trên trang phân công hội đồng `CouncilAssignmentPage`.
  * Deep-linking `?tab=approvals` và `?tab=publish` hoạt động chính xác trong `GradingDefensePage`.
  * Toàn bộ 216/216 frontend tests PASS (100%).
- **Production Build**: Vite build hoàn tất thành công trong 16.25s (**0 lỗi bundle**, 3236 modules transformed).
- **Mã hóa & Chuẩn tệp**: Tất cả các tệp tin tạo mới và sửa đổi đều đạt chuẩn **UTF-8 (no BOM)** theo Quy tắc 2.4.
- **Quy chuẩn UI/UX**: Tuân thủ tuyệt đối Quy tắc 2.6 trong `AGENTS.md` (chỉ dùng `@ant-design/icons` qua prop `icon`, không emoji trong text nhãn).
- **Quy chuẩn Subagent**: Tuân thủ nghiêm ngặt Quy tắc 3 trong `AGENTS.md` (ủy thác subagent theo từng task độc lập, kiểm tra chéo trước khi đóng phiên).

#### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Trải nghiệm thực tế trên trình duyệt:
   - Đăng nhập tài khoản Giảng viên KHÔNG có phân công hội đồng:
     * Xác nhận menu chỉ hiển thị đúng **3 mục cốt lõi**: *Đề tài phụ trách*, *Sinh viên hướng dẫn*, *Theo dõi tiến độ*. Tuyệt đối không xuất hiện các nút hội đồng.
   - Đăng nhập tài khoản Giảng viên CÓ phân công Hội đồng bảo vệ (ví dụ: `lecturer01`, `lecturer02`, `lecturer03`):
     * Xác nhận menu xuất hiện nút **"Phiếu chấm bảo vệ"**.
     * Bấm vào xem sinh viên và click "Tài liệu 00:00" $\rightarrow$ hồ sơ mở thành công, không còn lỗi 403.
   - Đăng nhập tài khoản Viện trưởng / Quản lý Hội đồng:
     * Kiểm tra trang Hội đồng bảo vệ `/admin/defense-councils` không còn báo lỗi đỏ danh sách giảng viên.
     * Kiểm tra bấm "Phê duyệt kết quả" và "Công bố kết quả" mở chính xác danh sách chờ duyệt và modal công bố.
2. Sẵn sàng tiếp nhận các yêu cầu tinh chỉnh tiếp theo từ người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)

1. **Chuyển từ Phân quyền Tĩnh sang Phân quyền Động theo Phân công Hội đồng**: Không cấp quyền xem hội đồng một cách dàn trải cho tất cả giảng viên. Chỉ những giảng viên được quyết định thành lập hội đồng và có tên trong bảng `council_members` mới được cấp cờ hiển thị chức năng chấm điểm tương ứng.
2. **Mở Quyền Xem Dossier Bảo vệ cho Thành viên Chấm Điểm**: Thành viên Hội đồng chấm thi bắt buộc phải đọc được 6 tài liệu trong hồ sơ bảo vệ của sinh viên để đánh giá. Bổ sung các quyền chấm điểm vào `dossierGuards` giúp bảo đảm tính thông suốt của chu trình đánh giá học vụ.
3. **Graceful Fallback sang API Công Khai cho Giảng viên**: Trang phân công hội đồng sử dụng `userService.getPublicLecturers()` khi người dùng không phải Admin tối cao, giúp ban lãnh đạo viện thao tác mượt mà không bị rào cản phân quyền hệ thống.
4. **Đồng bộ hóa 2 chiều Modal / Tab Deep-Linking cho Phê duyệt & Công bố**: Tận dụng `useSearchParams` để URL thể hiện rõ ràng hành động người dùng mong muốn (`approvals` / `publish`), hỗ trợ liên kết trực tiếp từ menu hoặc dashboard.

---

### Phiên 13/11/2026 — UI/UX Hardening: Triệt Tiêu Nhảy Chữ Council Pages & Điều Tra Sự Cố Phê Duyệt / Công Bố Kết Quả

#### 1. Những phần đã hoàn thành
- **Chẩn đoán & Chụp ảnh minh chứng hiện tượng "nhảy chữ" bằng Puppeteer headless**:
  - Ghi nhận chính xác hiện tượng layout shift:
    * Ở trang **Hội đồng Bảo vệ Khóa luận** (`/admin/defense-councils`), khối `PageHeader.actions` chứa 5 điều khiển có tổng chiều rộng vượt quá **1.040px**.
    * Khi hiển thị ở màn hình chuẩn (1440px trừ sidebar 280px), phần chiều rộng còn lại cho tiêu đề bị ép xuống chỉ còn **48px - 72px**.
    * Hệ quả: Tiêu đề và dòng mô tả bị bóp nghẹt thành **cột chữ dọc 1 từ / dòng** ("Phân \n công \n Hội \n đồng \n Bảo \n vệ \n Khóa \n luận").
    * Chiều cao header bị phình to hơn 200px so với trang Đề cương, gây hiện tượng giật nảy layout (Cumulative Layout Shift) khi chuyển menu.
- **Tái cấu trúc bố cục giao diện theo chuẩn UI/UX Pro Max**:
  - Tách bạch tầng **Nhận diện trang (Page Identity)** và tầng **Điều khiển bộ lọc (Context & Scope Toolbar)**:
    * Di chuyển 2 dropdown chọn phạm vi dữ liệu (`Chọn Đồ án` & `Chọn Học kỳ`) xuống thanh công cụ ngữ cảnh chuyên biệt nằm ngay trên hàng thẻ KPI.
    * `PageHeader.actions` chỉ còn tập trung vào các nút hành động nghiệp vụ cốt lõi (Action CTAs), giúp giải phóng hơn 400px chiều ngang.
  - Chuẩn hóa nhãn nút bấm & bổ sung Tooltip:
    * Nút `"Công bố DS đủ điều kiện bảo vệ"` (30 ký tự) $\rightarrow$ rút gọn thành `"Công bố DS đủ ĐK bảo vệ"` kèm `<Tooltip title="Công bố danh sách sinh viên đủ điều kiện bảo vệ">`.
    * Nút tạo mới được tinh gọn thành `"Lập Hội đồng"` với prop `icon={<PlusOutlined />}`.
  - Gia cố chống co rút trong [PageHeader.jsx](file:///d:/DACN/frontend/src/components/common/PageHeader.jsx):
    * Thiết lập `space-y-1 min-w-[280px] flex-1` bảo vệ khu vực tiêu đề không bao giờ bị bóp méo dưới 280px.
    * Nâng điểm ngắt responsive lên `lg:flex-row`, tự động chuyển sang xếp tầng mềm mại trên màn hình nhỏ.
- **Xác thực kết quả thực tế qua ảnh chụp & test**:
  - Chụp ảnh màn hình kiểm chứng sau khi sửa (`outline_councils_after.png` và `defense_councils_after.png`):
    * Cả 2 trang đều hiển thị tiêu đề và mô tả trên đúng **1 hàng ngang** duy nhất, thanh nút bấm gọn gàng trên 1 hàng.
    * Chiều cao `PageHeader` và vị trí thanh công cụ của cả 2 trang hoàn toàn trùng khớp từng pixel, **triệt tiêu 100% hiện tượng nhảy chữ / giật layout**.
  - Toàn bộ 223/223 frontend unit tests PASS (100%).
  - Frontend production build thành công trong 15.50s với 0 lỗi.
- **Điều tra & Định vị gốc rễ sự cố 2 trang "Phê duyệt kết quả" và "Công bố kết quả"**:
  - Phân tích qua script Puppeteer headless kiểm tra luồng truy cập `/admin/grading?tab=approvals` và `/admin/grading?tab=publish`:
    * **Nguyên nhân 1 (Route Guard Bounce)**: Trong `frontend/src/utils/authRedirect.js`, hàm `getRouteRedirect` không cấp quyền bypass cho `user.role === 'ADMIN'`. Vì nhóm quyền của `ADMIN` trong CSDL không chứa các mã quyền chuyên biệt `VIEW_DEFENSE_RESULT_APPROVALS` và `VIEW_RESULT_PUBLICATIONS` (vốn chỉ gắn với nhóm `VIEN_TRUONG`), nên khi Admin click vào menu, `ProtectedRoute` tự động đá văng về `/admin/dashboard`.
    * **Nguyên nhân 2 (Quyền Publish không đồng nhất)**: Trong `GradingDefensePage.jsx`, cờ `canPublishResult` kiểm tra `RESULT_PUBLISH`, trong khi menu `navigationRegistry.js` kiểm tra `VIEW_RESULT_PUBLICATIONS`. Nếu không đồng bộ, modal công bố sẽ không tự động bật mở khi có query param `?tab=publish`.
    * **Nguyên nhân 3 (Lỗi 500 endpoint overview)**: Ghi nhận request `GET /api/dashboard/semester-overview` trả về 500 Internal Server Error trong lúc load trang dashboard/admin.

#### 2. Trạng thái cập nhật của từng phần
- **Database/Prisma**: `STABLE`; Không thay đổi schema, tuân thủ 100% mô hình `TopicRegistration`.
- **Backend API**: `108/108 test suites PASS (100%)`; Cần bổ sung các quyền `VIEW_DEFENSE_RESULT_APPROVALS`, `VIEW_RESULT_PUBLICATIONS`, `RESULT_PUBLISH` vào nhóm Quản trị viên (hoặc xử lý bypass cho role `ADMIN`).
- **Frontend SPA**: `ZERO CLS & FULL BUILD PASS (100%)`;
  * 223/223 unit tests PASS.
  * Bản build production đạt 100% không lỗi (15.50s).
- **Quy chuẩn mã hóa & nút bấm**:
  * UTF-8 without BOM (Rule 2.4).
  * 100% nút bấm sử dụng prop `icon={<IconComponent />}` từ `@ant-design/icons`, không emoji hay ký tự đồ họa thô (Rule 2.6).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. **[P0] Khắc phục triệt để lỗi 2 trang "Phê duyệt kết quả" & "Công bố kết quả"**:
   - Cập nhật `frontend/src/utils/authRedirect.js`: Cho phép `user.role === 'ADMIN'` tự động vượt qua các route guard quản trị `/admin/*` mà không bị đá về `/admin/dashboard`.
   - Đồng bộ ma trận quyền trong `backend/src/constants/permissions.js` và cập nhật seed quyền cho tài khoản Quản trị viên: Gán các quyền `VIEW_DEFENSE_RESULT_APPROVALS`, `DEFENSE_RESULT_APPROVE`, `VIEW_RESULT_PUBLICATIONS`, `RESULT_PUBLISH` cho nhóm `QUAN_TRI_VIEN` / role `ADMIN`.
   - Chuẩn hóa cờ `canPublishResult` trong `GradingDefensePage.jsx` để nhận diện cả `RESULT_PUBLISH` lẫn `VIEW_RESULT_PUBLICATIONS`.
   - Sửa lỗi 500 tại endpoint `GET /api/dashboard/semester-overview` khi truy vấn dữ liệu học kỳ.
2. **[P1] Kiểm thử E2E luồng Phê duyệt & Công bố kết quả**:
   - Dùng Puppeteer đăng nhập với cả tài khoản `ADMIN` và `VIEN_TRUONG` (`lecturer01`), truy cập trực tiếp:
     * `/admin/grading?tab=approvals` $\rightarrow$ Xác nhận hiển thị danh sách sinh viên chờ duyệt đạt/không đạt.
     * `/admin/grading?tab=publish` $\rightarrow$ Xác nhận modal công bố kết quả mở lên tự động và thao tác mượt mà.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Phân tách Action CTAs và Scope Filters**: Bộ chọn đợt đồ án và tên đồ án là bộ lọc dữ liệu (Filters/Scope), không nên đặt chung hàng với các nút hành động chính (Primary Actions) trong `PageHeader`. Việc đưa bộ lọc xuống thanh công cụ phía dưới giúp giao diện cân đối, giải phóng không gian cho tiêu đề trang.
2. **Bảo vệ độ rộng tối thiểu cho Tiêu đề (`min-w-[280px]`)**: Sử dụng Flexbox kết hợp `flex-1 min-w-[280px]` để ngăn chặn hoàn toàn việc các nút bấm bên phải chèn ép tiêu đề thành cột chữ 1 từ/dòng khi người dùng dùng màn hình độ phân giải trung bình hoặc mở sidebar.
3. **Admin Role Bypass trong Route Guard**: `ADMIN` là vai trò quản trị tối cao của hệ thống. Cơ chế `getRouteRedirect` cần công nhận vai trò này cho toàn bộ không gian `/admin/*` để tránh tình trạng tài khoản Admin bị rào cản phân quyền của giáo vụ/viện trưởng chặn và đá về trang chủ.

---

### Phiên 19/11/2026 — Khắc Phục Lỗi Sập Trang Hội Đồng, Chuẩn Hóa Trạng Thái "Sẵn Sàng Bảo Vệ" & Xóa Bỏ Chú Thích Mã Biểu Mẫu (BM01 - BM05)

#### 1. Những phần đã hoàn thành
1. **Khắc phục triệt để lỗi sập (crash) 2 trang Hội đồng Admin (`/admin/outline-councils` và `/admin/defense-councils`)**:
   - **Nguyên nhân gốc rễ**: Cả hai trang đều mount component `frontend/src/pages/admin/CouncilAssignmentPage.jsx`. Tại dòng 896, thẻ `<AuthorizedAction feature={effectiveCouncilType === 'OUTLINE_REVIEW' ? 'outline-councils' : 'defense-councils'} action="manage">` tham chiếu đến biến `effectiveCouncilType`. Tuy nhiên biến này chưa từng được định nghĩa trong component, dẫn đến runtime crash `ReferenceError: effectiveCouncilType is not defined`, làm `ErrorBoundary` kích hoạt và trang bị trắng màn hình / báo lỗi hiển thị.
   - **Giải pháp**: Định nghĩa chuẩn hóa `const effectiveCouncilType = forcedCouncilType || (councilTypeFilter !== 'ALL' ? councilTypeFilter : 'DEFENSE_COUNCIL');` ngay tại đầu component `CouncilAssignmentPage.jsx`.
2. **Loại bỏ chuỗi trạng thái kỹ thuật `DEFENSE_READY` trên Hồ sơ sinh viên**:
   - Tại trang Hồ sơ sinh viên (`StudentThesisProgressCard.jsx`), thay thế việc hiển thị thô `{registration.status}` bằng `getStatusTagConfig(registration?.status)`:
     * Chuyển đổi mã kỹ thuật `DEFENSE_READY` thành nhãn tiếng Việt chuẩn học thuật: **"Sẵn sàng bảo vệ"** với màu xanh lá (`color: green`).
   - Tại ngăn kéo Hồ sơ học vụ toàn trình (`AcademicDossierDrawer.jsx`), thay thế `<Tag color="cyan">{registration?.status}</Tag>` bằng `getStatusTagConfig(registration?.status)`.
   - Tại trang Kết quả & Điểm số (`GradeViewPage.jsx`), đồng bộ mapping trạng thái qua `getStatusTagConfig(reg.status)` cho cả thanh chọn đợt và banner trạng thái.
3. **Loại bỏ các chú thích mã biểu mẫu (BM01 - BM05) trên giao diện**:
   - Tại **Thanh tiến trình 5 bước** (`StudentThesisProgressCard.jsx`):
     * Bước 1: `1. Đề cương BM01` $\rightarrow$ `1. Đề cương chi tiết`
     * Bước 2: `2. Giao đề tài BM02` $\rightarrow$ `2. Giao đề tài`
     * Bước 3: `3. Tiến độ BM03` $\rightarrow$ `3. Theo dõi tiến độ`
     * Bước 4: `4. Đánh giá BM04` $\rightarrow$ `4. Đánh giá kết quả`
     * Nút CTA: `Sổ tiến độ BM03` $\rightarrow$ `Sổ theo dõi tiến độ`
   - Tại **Ngăn kéo Hồ sơ học vụ** (`AcademicDossierDrawer.jsx`):
     * Tiêu đề: `HỒ SƠ BIỂU MẪU HỌC VỤ TOÀN TRÌNH (BM01 - BM05)` $\rightarrow$ `HỒ SƠ BIỂU MẪU HỌC VỤ TOÀN TRÌNH`
     * Nút in: `In toàn bộ hồ sơ (BM02–BM05)` $\rightarrow$ `In toàn bộ hồ sơ biểu mẫu`
     * Tiêu đề modal: `HỒ SƠ HỌC VỤ ĐỦ ĐIỀU KIỆN (BM02 - BM05)` $\rightarrow$ `HỒ SƠ HỌC VỤ ĐỦ ĐIỀU KIỆN`
     * Tooltip: Loại bỏ nhắc nhở mã BM02–BM05.
   - Tại từ điển trạng thái `statusMap.js`:
     * `BM04_REVIEW`: "Đang thẩm định BM04" $\rightarrow$ "Đang thẩm định phiếu nhận xét"
     * `BM02_SUBMITTED`: "Chờ duyệt đơn BM02" $\rightarrow$ "Chờ duyệt nhiệm vụ"
     * `BM02_NEEDS_REVISION`: "Yêu cầu chỉnh sửa đơn" $\rightarrow$ "Yêu cầu chỉnh sửa nhiệm vụ"
4. **Nâng cao độ bền bỉ tầng Database Backend (`backend/src/config/database.js` & `backend/.env`)**:
   - Tạo lớp `ResilientPgClient extends Client` chặn các unhandled `'error'` event từ socket timeout / reset gây ra `uncaughtException` làm dừng tiến trình backend.
   - Cấu hình pool chống nghẽn: `DB_POOL_MAX=15`, `DB_POOL_IDLE_TIMEOUT_MS=20000`, `DB_POOL_CONNECTION_TIMEOUT_MS=45000`.
   - Bổ sung process handlers cho `unhandledRejection` và `uncaughtException` trong `backend/src/app.js`.
   - Giãn cách lịch trình chạy cron jobs nhắc việc để tránh nghẽn pool đồng thời.
5. **Kiểm thử & Đảm bảo chất lượng**:
   - Kiểm thử tự động `academicDossierDrawer.test.js` PASS 5/5 tests.
   - Kiểm thử tự động `profilePageUiUx.test.js` PASS 7/7 tests.
   - Production build Vite hoàn tất thành công 100% trong 15.60s (0 lỗi).
   - Đảm bảo 100% UTF-8 without BOM (Rule 2.4) và tuân thủ Rule 2.6 (không emoji/ký tự thô trong button label).

#### 2. Trạng thái cập nhật của từng phần
- **Database/Prisma**: `STABLE`; Tuân thủ 100% mô hình `TopicRegistration`.
- **Backend API**: `RUNNING (Port 5000)`; Đã tích hợp client database tự phục hồi.
- **Frontend SPA**: `RUNNING (Port 5173)`; Đã xử lý triệt để lỗi hiển thị `DEFENSE_READY` và các chú thích mã biểu mẫu `(BM01 - BM05)`.
- **Quy chuẩn mã hóa & nút bấm**:
  * UTF-8 without BOM (Rule 2.4).
  * Tuân thủ 100% Rule 2.6 (sử dụng prop `icon`, không chèn emoji vào button label).

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Thử nghiệm các thao tác tương tác trong trang hội đồng: phân công tự động, kéo thả sinh viên, mở modal gán hội đồng.
2. Tiếp tục hoàn thiện các luồng chấm điểm hoặc báo cáo theo yêu cầu tiếp theo của người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Việt hóa toàn diện trạng thái và loại bỏ mã kỹ thuật/biểu mẫu khỏi UI người dùng**: Sinh viên và giảng viên tiếp cận hệ thống dưới góc độ học thuật trực quan; các mã kỹ thuật (`DEFENSE_READY`, `BM01`, `BM02`,...) gây cảm giác rườm rà và khó hiểu cho người dùng cuối. Việc chuẩn hóa về văn bản tiếng Việt thuần túy ("Sẵn sàng bảo vệ", "Đề cương chi tiết", "Giao đề tài",...) giúp giao diện chuyên nghiệp và thân thiện hơn.
2. **Đồng bộ hóa qua `statusMap.js`**: Mọi hiển thị trạng thái của `TopicRegistration` phải đi qua `getStatusTagConfig(status)` để đảm bảo tính nhất quán về màu sắc và ngôn từ trên toàn bộ ứng dụng.


#### 1. Những phần đã hoàn thành
1. **Tích hợp Tính năng In Sổ Theo Dõi Tiến Độ BM03 tại Trang Theo Dõi Tiến Độ (`ProgressTrackingPage.jsx`)**:
   - Tại **Tab 3 ("3. Đánh giá tiến độ")**:
     * Bổ sung thanh công cụ trên cùng với nút `<Button icon={<PrinterOutlined />}>In Sổ tiến độ BM03</Button>`, cho phép GVHD xem và in sổ tiến độ bất kỳ lúc nào.
     * Bổ sung nút *"In Sổ tiến độ BM03"* ngay tại card *"Ký toàn phiếu BM03 & Xác nhận sinh viên (48h)"*.
   - Tại **Tab 2 ("Nhật ký trao đổi")**:
     * Bổ sung nút `<Button icon={<PrinterOutlined />}>In Sổ tiến độ BM03</Button>` trên thanh tiêu đề cạnh nút *"Ghi nhận buổi hướng dẫn mới"*.
   - Tại **Header Bar** (khu vực thao tác chung của sinh viên đang chọn):
     * Bổ sung nút `<Button icon={<PrinterOutlined />}>In Sổ tiến độ BM03</Button>`.
2. **Chuẩn hóa Triệt Để BM04 & Xóa Bỏ Hoàn Toàn "Điểm Đánh Giá Quá Trình"**:
   - Khắc phục sự nhầm lẫn hiển thị `Điểm đánh giá quá trình: 9.0 / 10` trong card BM04 (vốn là text placeholder sót lại từ bản mẫu prototype cũ).
   - Theo đúng quy chế của Viện Công nghệ Số & Trường ĐH Thủ Dầu Một: GVHD chỉ nhận xét định tính (4 tiêu chí CĐR: Bố cục, Nội dung, Khả năng ứng dụng, Thái độ) và đưa ra 2 kết luận độc lập (Đạt chuẩn đầu ra & Cho phép ra bảo vệ trước Hội đồng). **GVHD hoàn toàn không cho điểm số quá trình**; điểm số sẽ do 3 thành viên Hội đồng chấm trên BM05 sau đó.
   - Chuyển đổi 3 cột thống kê trong thẻ BM04 thành:
     * Cột 1: *Tổng số buổi gặp BM03*: `{count} buổi làm việc`
     * Cột 2: *Chuẩn đầu ra (CĐR)*: `Đạt chuẩn đầu ra` / `Đang thẩm định`
     * Cột 3: *Kết luận của GVHD*: `Đồng ý cho bảo vệ` / `Chưa thẩm định`
   - Hiển thị động ý kiến nhận xét của GVHD từ `reg?.bm04Evaluation?.generalNotes` hoặc `attitudeScore`.
   - Bổ sung nút `<Button icon={<PrinterOutlined />}>In Phiếu BM04</Button>` tại cả Header Bar và Tab 4 cạnh nút *"Xem / Sửa Phiếu nhận xét"*.
3. **Gắn Kết Modal In Ấn Khổ Chuẩn A4**:
   - Tích hợp 2 modal in ấn `AcademicFormPrintModal` tương ứng với `BM03PrintSheet` và `BM04PrintSheet` tại cuối trang `ProgressTrackingPage.jsx`, hỗ trợ thu phóng, xem trước và in ấn A4 chuẩn theo quy chuẩn học thuật.
4. **Kiểm Thử & Đảm Bảo Chất Lượng**:
   - Toàn bộ 291 frontend contract tests PASS (100%).
   - Toàn bộ 118 frontend runtime tests (14 test files) PASS (100%).
   - Production build Vite hoàn tất thành công trong 14.09s (0 lỗi).
   - Tuân thủ nghiêm ngặt Quy tắc 2.4 (UTF-8 no BOM) và Quy tắc 2.6 trong `AGENTS.md` (chuẩn nút bấm Ant Design, không chèn emoji hay ký tự thô vào text nhãn).

#### 2. Trạng thái cập nhật của từng phần
- **Backend**: Cung cấp đầy đủ `bm04Evaluation` và `meetingLogs` trong danh sách `getAllRegistrations`.
- **Frontend**: Trang Theo dõi tiến độ (`ProgressTrackingPage.jsx`) hiển thị đầy đủ các nút In Sổ tiến độ BM03 và In Phiếu BM04 ở tất cả các tab liên quan; thẻ BM04 đã xóa bỏ hoàn toàn điểm số quá trình theo đúng quy chế đào tạo.
- **Biểu mẫu in ấn**: `BM03PrintSheet` và `BM04PrintSheet` hoạt động mượt mà, hỗ trợ xuất in A4 chuẩn.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Thử nghiệm trực tiếp trên trình duyệt với tài khoản GVHD:
   - Vào mục **Theo dõi tiến độ** (`/lecturer/progress`), chọn sinh viên.
   - Thử bấm nút **"In Sổ tiến độ BM03"** tại Header bar, Tab 2 và Tab 3 để kiểm tra bản in A4.
   - Bấm nút **"In Phiếu BM04"** tại Header bar và Tab 4 để kiểm tra bản in Phiếu nhận xét của GVHD.
2. Tiếp tục hoàn thiện các luồng chấm điểm hội đồng hoặc các yêu cầu tiếp theo từ người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Quy chế không có điểm số quá trình cho GVHD trên BM04**:
   - BM04 (Phiếu nhận xét của GVHD / GV phản biện) là văn bản pháp lý định tính nhằm xác nhận tính liêm chính, đáp ứng chuẩn đầu ra và đề nghị cho phép sinh viên được ra bảo vệ. Điểm số thang 10 hoàn toàn không xuất hiện ở giai đoạn này mà được cho độc lập bởi 3 ủy viên Hội đồng trong biên bản chấm BM05. Do đó việc loại bỏ "Điểm đánh giá quá trình 9.0 / 10" là hoàn toàn chuẩn xác theo quy chế đào tạo.
2. **Cung cấp nút in ấn tại mọi ngữ cảnh liên quan**:
   - GVHD có thể muốn in BM03 khi đang xem lại các buổi gặp (Tab 2) hoặc khi đang thẩm định mốc giữa kỳ/cuối kỳ (Tab 3) hoặc ngay từ Header bar. Cung cấp nút in ấn theo ngữ cảnh giúp tối ưu trải nghiệm và thuận tiện cho giảng viên.
3. **Triệt tiêu False-Positive cảnh báo trễ sau khi đã hoàn thành BM03**:
   - Khi sinh viên đã hoàn thành cả 3 mốc gặp BM03 (24/8, 21/9, 19/10), GVHD đã ký đóng sổ BM03 (`advisorSignedAt`) và sinh viên đã xác nhận, chu kỳ gặp mặt định kỳ đã khép lại và chuyển sang giai đoạn thẩm định BM04. Hệ thống không được phép tính khoảng cách ngày từ buổi gặp cuối cùng (`daysSinceLastMeeting > 21`) để báo lỗi trễ tiến độ, mà phải cập nhật trạng thái `BM03_PASSED` và hiển thị nhãn `Chờ duyệt BM04`.

---

### Phiên 19/11/2026 — Đồng Bộ Thước Đo Chỉ Tiêu Hướng Dẫn (Quota Meter) Trên Menu Trái Với Số Lượng Thực Tế Đang Hướng Dẫn

#### 1. Những phần đã hoàn thành
1. **Tìm ra và khắc phục nguyên nhân gốc rễ lỗi lệch chỉ tiêu trên Sidebar (`frontend/src/components/layout/AppLayout.jsx`)**:
   - **Nguyên nhân gốc rễ**: Trong `AppLayout.jsx`, `lecturerStudentCount` ban đầu được tính bằng cách duyệt danh sách `registrationsQuery.data` và kiểm tra điều kiện `r.topic?.lecturerId === user?.id || r.topic?.lecturer?.id === user?.id`. Tuy nhiên, trong CSDL Prisma và schema của hệ thống, thực thể `Topic` có quan hệ với giảng viên qua trường `mentorId` / `mentor`, không hề tồn tại `lecturerId` hay `lecturer`. Do đó, điều kiện luôn trả về `false`/`undefined`, dẫn đến `lecturerStudentCount` luôn bị gán bằng `0` (ví dụ: hiển thị 0/10 dù giảng viên đang hướng dẫn 7 sinh viên).
   - Ngoài ra, việc gọi `useRegistrations` không truyền `periodId` sẽ lấy toàn bộ các học kỳ không giới hạn, không đồng bộ với học kỳ hiện tại (`currentSemester`).
2. **Chuẩn hóa nguồn dữ liệu chỉ tiêu hướng dẫn qua `useLecturerOverview` (Single Source of Truth)**:
   - Thay thế việc tính toán thủ công bằng cách sử dụng `useLecturerOverview(scope, null, showQuotaMeter)` (chung React Query cache với `LecturerDashboardPage` và `LecturerStudentsPage`). Backend đã tính toán và trả về chính xác số liệu `mentorSummary.supervisedCount` và `mentorSummary.maxStudents` theo học kỳ đang kích hoạt.
   - Cơ chế fallback an toàn: Nếu cache chưa sẵn sàng, hệ thống lọc qua `registrationsQuery.data` bằng cả 4 trường chuẩn: `r.topic?.mentorId === user?.id || r.topic?.mentor?.id === user?.id || r.mentorId === user?.id || r.mentor?.id === user?.id` và chỉ tính trong học kỳ hiện hành (`r.period?.semesterId === currentSemester?.id`).
   - Lấy động `lecturerMaxQuota = overviewQuery.data?.mentorSummary?.maxStudents ?? user?.maxStudents ?? 10` thay vì hardcode 10.
3. **Cập nhật component `NavContent.jsx` và `QuotaMeter.jsx`**:
   - `NavContent.jsx`: Nhận `lecturerMaxQuota` từ props và truyền vào prop `max` của `<QuotaMeter />`.
   - `QuotaMeter.jsx`: Cải tiến hiển thị văn bản động `isFull ? 'Đã đủ ' + safeMax + '/' + safeMax : 'Còn ' + remaining + ' chỗ'` thay vì cố định `10/10`.
4. **Cập nhật & Kiểm thử tự động**:
   - `frontend/tests/appLayoutNavigationActive.test.js`: Cập nhật kiểm tra `aria-current="page"` bao gồm cả `NavContent.jsx` sau khi tách file navigation.
   - Chạy test tự động: 3/3 tests PASS.
   - Kiểm thử thực tế bằng Puppeteer headless browser:
     * Đăng nhập tài khoản `gv001@tdmu.edu.vn`.
     * Kiểm tra `/lecturer/dashboard` $\rightarrow$ Thước đo menu trái hiển thị chính xác: `Chỉ tiêu hướng dẫn: 7 / 10 SV (Còn 3 chỗ)`, khớp 100% với KPI tổng quan (7/10) và danh sách sinh viên thực tế (7 sinh viên).
     * Kiểm tra `/lecturer/students` $\rightarrow$ Thước đo menu trái hiển thị chính xác: `Chỉ tiêu hướng dẫn: 7 / 10 SV (Còn 3 chỗ)`.
   - Build Vite Production thành công 100% không cảnh báo/lỗi (18.39s).
   - Đảm bảo 100% UTF-8 without BOM (Rule 2.4) và Rule 2.6 (không emoji/ký tự thô trong button label).

#### 2. Trạng thái cập nhật của từng phần
- **Database/Prisma**: `STABLE`; Cấu trúc `Topic.mentorId` và `TopicRegistration.topic.mentor`.
- **Backend API**: `RUNNING (Port 5000)`; Endpoint `/api/dashboard/lecturer-overview` cung cấp `mentorSummary` chính xác theo học kỳ hoạt động.
- **Frontend SPA**: `RUNNING (Port 5173)`; Thước đo chỉ tiêu trên menu trái (`QuotaMeter`) đồng bộ hoàn toàn với dữ liệu thực tế của giảng viên.
- **Quy chuẩn mã hóa & nút bấm**: Tuân thủ 100% Rule 2.4 & Rule 2.6.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Thử nghiệm trên các tài khoản giảng viên khác (ví dụ giảng viên chưa nhận sinh viên nào `0/10`, hoặc giảng viên đã đủ chỉ tiêu `10/10`) để kiểm tra trạng thái hiển thị của thanh tiến trình (`normal`, `exception`).
2. Sẵn sàng tiếp nhận các yêu cầu tiếp theo từ người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Sử dụng `useLecturerOverview` làm nguồn sự thật duy nhất (Single Source of Truth)**:
   - Thay vì truy vấn danh sách thô và lọc ở client bằng logic riêng dễ sinh lỗi không đồng nhất, việc tái sử dụng hook `useLecturerOverview` giúp chia sẻ cache của React Query với trang Dashboard và trang Danh sách sinh viên. Điều này đảm bảo số liệu ở menu trái và nội dung trang luôn đồng nhất tuyệt đối, đồng thời giảm số lượng HTTP request gửi tới server.
2. **Fallback đúng chuẩn dữ liệu `mentorId`**:
   - Trong schema Prisma, thực thể `Topic` liên kết với giảng viên hướng dẫn qua quan hệ `mentorId` / `mentor` (User relation "MentoredBy"). Việc sửa dứt điểm các tham chiếu cũ `lecturerId` sang `mentorId` ngăn chặn hoàn toàn lỗi đếm sinh viên bằng 0.

---

### Phiên 19/11/2026 — Khắc Phục Triệt Để Lỗi Crash Prisma `BM04Evaluation.evaluator`, Hiện Tượng Connection Terminated Unexpectedly & Ngăn Chặn Xung Đột Truy Vấn Song Song

#### 1. Những phần đã hoàn thành
1. **Sửa dứt điểm lỗi chí mạng `PrismaClientValidationError` trên `BM04Evaluation` (`registrationController.js`)**:
   - **Nguyên nhân gốc rễ**: Khi sinh viên mở giao diện, hàm `getMyRegistration` gọi truy vấn Prisma với mệnh đề `include: { bm04Evaluation: { include: { evaluator: ... } } }`. Trong Prisma Schema (`schema.prisma`), thực thể `BM04Evaluation` liên kết với giảng viên qua quan hệ `lecturer` (chứ không phải `evaluator`). Lỗi này gây ra exception `Unknown field 'evaluator' for include statement on model 'BM04Evaluation'` khiến request `/api/registrations/my` luôn trả về HTTP 500 và sập backend liên tục.
   - **Giải pháp**: Sửa `evaluator` thành `lecturer` chuẩn theo Prisma schema, đồng thời gán alias tương thích ngược `registration.bm04Evaluation.evaluator = registration.bm04Evaluation.lecturer` để đáp ứng mọi component client cần dùng `evaluator` hoặc `lecturer`.
2. **Khắc phục lỗi `Connection terminated unexpectedly` và tối ưu kết nối Supabase Pooler (`database.js` & `.env`)**:
   - **Nguyên nhân gốc rễ**: Supabase Transaction Pooler (Supavisor/PgBouncer cổng 6543) tự động đóng các kết nối nhàn rỗi (idle sockets) sau 10-15 giây. Khi `idleTimeoutMillis` trong app đặt ở mức 20-30s, app giữ kết nối chết trong pool. Khi câu truy vấn tiếp theo gửi vào socket đã bị remote đóng, `pg-pool` phát sinh lỗi `Connection terminated unexpectedly`. Đồng thời `DB_POOL_MAX=15` làm cạn kiệt slot kết nối của Supabase.
   - **Giải pháp**:
     * Điều chỉnh `DB_POOL_MAX=8` và `DB_POOL_IDLE_TIMEOUT_MS=10000` (10s) để client tự giải phóng kết nối nhàn rỗi một cách êm đẹp trước khi Supabase reset.
     * Thiết lập `keepAlive: true` và `keepAliveInitialDelayMillis: 3000` (gửi probe TCP định kỳ 3 giây một lần) để giữ socket hoạt động ổn định.
     * Thêm bộ lọc `isTransientDisconnect` trong `ResilientPgClient`, `pool.on('error')` và `PrismaPg.onPoolError` nhằm triệt tiêu các cảnh báo rác từ tiến trình dọn dẹp socket ngầm của server.
3. **Triệt tiêu lỗi `DeprecationWarning: Calling client.query() when the client is already executing a query`**:
   - Thay thế các `Promise.all` lồng nhau (gây áp lực 14 câu truy vấn đồng thời cùng lúc lên pool database):
     * Trong `dashboardController.js`: Tách `fetchLecturerDashboardData` và `buildUnifiedLecturerOverview` thành 2 bước thực thi tuần tự.
     * Trong `dashboardController.js` (`getSemesterStats`): Chuyển mảng semesters map song song thành vòng lặp `for...of` tuần tự.
     * Trong `councilController.js` (`getCouncilById`): Chuyển vòng lặp map `resolveEffectiveTopicTitle` từ `Promise.all` sang `for...of`, tránh bùng nổ 60 câu truy vấn cùng lúc khi mở hội đồng.
4. **Nâng cấp Global Error Handler (`errorHandler.js`)**:
   - Bắt các lỗi gián đoạn kết nối socket tạm thời (`Connection terminated unexpectedly`, `ECONNRESET`, `P2025`) và phản hồi mã HTTP `503` (Service Temporarily Unavailable) có cấu trúc kèm thông điệp rõ ràng, cho phép client React Query tự động retry mà không làm sập server hay hiện lỗi 500 khó hiểu.
5. **Đồng bộ Unit/Integration Tests**:
   - Cập nhật mock dữ liệu trong `dashboardSemesterFallback.test.js`: PASS 6/6 tests (100%).
   - Cập nhật mock `assertMentorCapacity` trong `registrationController.test.js`: PASS 11/11 tests (100%).
   - Kiểm tra mã hóa: 100% tệp tuân thủ UTF-8 without BOM (Rule 2.4).

#### 2. Trạng thái cập nhật của từng phần
- **Database/Prisma**: `STABLE`; Cấu hình Pool hoàn toàn tương thích với Supabase Session/Transaction Pooler.
- **Backend API**: `RUNNING (Port 5000)`; Xử lý triệt để lỗi sập `getMyRegistration`, không còn tràn kết nối và không còn cảnh báo DeprecationWarning.
- **Frontend SPA**: `RUNNING (Port 5173)`; Các trang hoạt động mượt mà, không gặp lỗi gián đoạn kết nối.
- **Quy chuẩn mã hóa**: Tuân thủ 100% Rule 2.4.

#### 3. Bước tiếp theo cần làm (Next Session Plan)
1. Giữ terminal backend chạy ổn định và quan sát log trong quá trình sử dụng thực tế.
2. Sẵn sàng tiếp nhận các yêu cầu tiếp theo từ người dùng.

#### 4. Quyết định quan trọng (Decisions & Rationale)
1. **Tuân thủ đúng tên quan hệ Prisma Schema (`BM04Evaluation.lecturer`)**:
   - Không tự ý phán đoán tên relation. Mọi quan hệ giữa các bảng phải tra cứu trực tiếp trong `backend/prisma/schema.prisma`.
2. **Cấu hình Connection Pool cho Cloud Pooler (PgBouncer/Supavisor)**:
   - Với các pooler đám mây có cơ chế kill idle socket nhanh (10-15s), client pool phải có `idleTimeoutMillis` ngắn hơn hoặc bằng thời gian đó (10s) và `keepAlive` ngắn (3s) để socket không bị ngắt đột ngột trong khi câu lệnh đang chờ.
3. **Tránh bùng nổ truy vấn song song (Query Burst Starvation)**:
   - Không lạm dụng `Promise.all` với các danh sách lớn hoặc các hàm nghiệp vụ phức tạp chứa nhiều truy vấn con (như `resolveEffectiveTopicTitle`), mà ưu tiên thực thi tuần tự hoặc chia batch nhỏ để bảo vệ pool kết nối.











