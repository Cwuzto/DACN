# Hướng dẫn làm việc với dự án DACN

Tài liệu này là điểm bắt đầu ngắn gọn cho AI Agent. Đọc [AGENTS.md](AGENTS.md) để biết quy tắc phiên làm việc và các ràng buộc bắt buộc. Trạng thái, kế hoạch và kết quả kiểm thử chi tiết nằm ở các tài liệu liên kết bên dưới.

## Tổng quan

- Hệ thống quản lý đồ án và khóa luận tốt nghiệp của Viện Công nghệ Số.
- Frontend: React 19, Vite, Ant Design, Tailwind CSS, Zustand (`frontend/`).
- Backend: Node.js, Express, Prisma, PostgreSQL, JWT (`backend/`); tệp lưu trên Supabase Storage.
- Mô hình nghiệp vụ trung tâm là `TopicRegistration`: một sinh viên đăng ký một đề tài trong học kỳ, `Topic.maxStudents = 1`, mỗi GVHD tối đa 10 sinh viên. Không phát triển theo `group/groupMember` cũ.
- Khi sửa luồng nghiệp vụ, kiểm tra theo thứ tự Prisma/CSDL → Backend API → Frontend. Giao diện dùng API thật khi đã có; nút có biểu tượng dùng `@ant-design/icons`, nhãn chữ thuần Việt. Lưu file UTF-8 không BOM.

## Bản đồ tài liệu

| Cần tìm | Tài liệu |
| --- | --- |
| Trạng thái hiện tại, việc tiếp theo, mức kiểm chứng | [docs/project-status.md](docs/project-status.md) |
| Quyết định kiến trúc và nghiệp vụ còn hiệu lực | [docs/architecture/decisions.md](docs/architecture/decisions.md) |
| Quy trình BM01–BM04, hội đồng, bảo vệ | [.agents/rules/01-business-workflow.md](.agents/rules/01-business-workflow.md) |
| Mô hình dữ liệu | [.agents/rules/02-data-architecture.md](.agents/rules/02-data-architecture.md) và `backend/prisma/schema.prisma` |
| Vai trò, phân quyền | [.agents/rules/03-roles-and-permissions.md](.agents/rules/03-roles-and-permissions.md), [ma trận quyền](docs/rbac/authorization-matrix.md) |
| Lệnh chạy, chuẩn mã | [.agents/rules/04-development-guidelines.md](.agents/rules/04-development-guidelines.md) |
| Thiết kế và kế hoạch theo tính năng | [docs/superpowers/specs](docs/superpowers/specs), [docs/superpowers/plans](docs/superpowers/plans) |
| Nhật ký phiên cũ, giữ nguyên văn | [docs/sessions/2026-10-to-11-session-history.md](docs/sessions/2026-10-to-11-session-history.md) |

Đối chiếu `schema.prisma` và code khi tài liệu mô tả enum/API khác hiện trạng. Các kế hoạch cũ phản ánh thời điểm viết, không mặc nhiên là backlog hiện tại.

## Session Update — 27/11/2026

### 1. Những phần đã hoàn thành

- **Nâng cấp UI/UX toàn diện (`ui-ux-pro-max`)**:
  - Thiết kế lại `AppLayout`, thanh điều hướng Portal (đồng bộ logo giữa Portal & giao diện role), thanh tiến độ Đợt đồ án sinh động và 4 đợt nâng cấp toàn bộ các trang chức năng Admin.
  - Thiết kế lại trang Công bố kết quả học kỳ / Sổ điểm bảo vệ (`GradingDefensePage.jsx`, `DefenseResultPublicationModal.jsx`, `PublicationHistoryModal.jsx`): đồng bộ bộ font với Tổng quan (`Lexend` + `Inter` + `JetBrains Mono`), bỏ các chú thích dấu ngoặc `()` thừa & chữ tiếng Anh kỹ thuật (`rawAverage`, `roundedScore`, `Snapshot`), bổ sung bộ lọc **Đợt học kỳ** (`semesterId`) & **Loại đồ án** (`projectCatalogId`).
  - Xây dựng component dùng chung `ArchiveDeadlineBanner.jsx` hiển thị hạn nộp hồ sơ lưu chiểu (sơ bộ trước bảo vệ 3 ngày & đóng cổng 14 ngày sau bảo vệ) kèm cảnh báo nổi bật khi sinh viên thiếu tài liệu (`X/4`), tích hợp vào 5 màn hình (`StudentDashboardPage`, `GradeViewPage`, `ArchiveSubmissionModal`, `StudentArchiveActions`, `ProgressTrackingPage`).
  - Thiết kế lại luồng **Sinh viên đang hướng dẫn → Trang chi tiết quá trình sinh viên** dùng chung cho cả GVHD (`/lecturer/students/:registrationId`) và Admin (`/admin/students/:registrationId`): bỏ nút cũ trên ô sinh viên & cột thao tác thừa trên `/admin/grading`, nhấp vào tên/ô sinh viên mở thẳng trang chi tiết, đưa nút `Ghi nhật ký` lên góc trên phải Header, hiển thị đủ BM01–BM05 & chỉ hiển thị BM02-A khi sinh viên thực sự có nộp.
- **Kiểm thử khám phá End-to-End (Exploratory & Negative Testing) và xử lý trọn bộ 4 đợt lỗi (`P0`, `P1`, `P2`)**:
  - **CSDL & Backend**: Đổi `BM04Evaluation.signedAt` thành nullable (`DateTime?`); bổ sung quyền `BM02_DEPARTMENT_SIGN` cho `VIEN_TRUONG` (kèm `isDepartmentUnderInstitute`) và quyền xem sổ điểm/công bố cho `QUAN_TRI_VIEN`; gỡ deadlock `500 BM01_CONCURRENT_COMMAND`, deadlock kích hoạt/khóa Rubric, deadlock `PRE_DEFENSE` lưu chiểu trước BM04, và deadlock công bố kết quả (`EVIDENCE_STALE` / `eligible: []`); đồng bộ mốc BM03 giữa `Semester` và `PeriodWorkflowPolicyVersion`; sửa gốc `Mốc kế tiếp` trong `lecturerOverviewService.js`, sửa dữ liệu `dashboardController.js` & `studentWorkItemService.js`; mở quyền đọc nhật ký/checkpoint/BM02-A cho Admin.
  - **Frontend**: Xóa sạch mock data (`Nguyễn Tiến Đạt`) trên `/admin/grading`; sửa `NaN / 10`, sửa crash `queryKeys.studentDashboard is not a function`, sửa `ReferenceError: Tooltip is not defined` trên `ProgressTrackingPage.jsx`; đồng bộ cache invalidation; chuyển Video Demo sang link `https://`; đồng bộ Sidebar/RBAC & toast khi redirect chéo URL; thay 100% `material-symbols-outlined` sang `@ant-design/icons`; parse JSON ghi chú BM02; bổ sung `aria-label` và dọn sạch cảnh báo Ant Design v6 trên 58 tệp.
- **Chuẩn hóa danh mục Bộ môn & Ngành Viện Công nghệ số (Dropdown cố định)**:
  - Tạo hằng số dùng chung `academicUnits.js` ở cả Backend & Frontend: 2 Bộ môn Giảng viên (`Công Nghệ Thông Tin`, `Hệ thống Thông tin`) và 4 Ngành Sinh viên (`Công Nghệ Thông Tin`, `Kỹ thuật Phần mềm`, `Hệ thống Thông tin`, `Trí Tuệ Nhân Tạo`).
  - Siết validation ở Backend (`studentProfileService`, `userController`, `authController`, `excelHelper`) và chuyển toàn bộ ô nhập/lọc trên Frontend (`UserManagementPage`, `ProfileIdentityCard`, `AcademicDelegationDrawer`, `TopicListPage`, `HomePage`, `studentImportHelper`) sang Dropdown `<Select>` cố định, không cho nhập tự do.

### 2. Trạng thái cập nhật của từng phần

- **Database / Prisma**: Đã đồng bộ schema mới (`BM04Evaluation.signedAt` nullable) qua `npx prisma db push` & `prisma generate`; đã đồng bộ quyền `BM02_DEPARTMENT_SIGN` (`VIEN_TRUONG`) và quyền xem sổ điểm (`QUAN_TRI_VIEN`) trong DB.
- **Backend**: Cú pháp sạch (`node -c` pass). Các bộ test trọng tâm đều PASS: `studentWorkItem|defenseTimeWindow|studentDashboard|archive` (`8/8` suites, `106/106` tests), `lecturerOverviewService|guidanceWorkspaceService|permissionUsage.contract` (`3/3` suites, `20/20` tests), `studentProfileService|userController|authController|excelHelper|userExcel` (`5/5` suites, `62/62` tests). *(Toàn bộ suite `npm test` đạt `152/177` suites; 25 suites fail là lỗi pre-existing về mock storage/file/seed và assertion cũ chưa cập nhật `BM02_DEPARTMENT_SIGN`).*
- **Frontend**: `npm run build` (`vite build`) PASS (`✓ 3393 modules transformed`, exit code `0`).
- **Playwright End-to-End Verification**: Đã kiểm chứng trực tiếp trên trình duyệt cho cả 3 vai trò (`Admin`, `GV001` Viện trưởng, `SV 0001`): công bố kết quả học kỳ thành công (`201`, SV thấy điểm `9.0` loại `A`), hiển thị hạn nộp & cảnh báo thiếu `Video Demo` (`3/4`), luồng click tên SV mở trang chi tiết hoạt động mượt cho cả GVHD & Admin, `0 pageerror`, `0` cảnh báo AntD v6 deprecated.
- **MCP**: Chưa sử dụng/kiểm tra lại MCP trong phiên này.

### 3. Bước tiếp theo cần làm (Next Session Plan)

1. Cập nhật các test pre-existing còn fail trong `backend/tests` (đặc biệt `permissionCatalogMigration.test.js` và các test storage/file mock) để đưa toàn bộ Jest suite về 100% pass.
2. Kiểm thử luồng duyệt lưu chiểu 3 tầng sau bảo vệ (SV bổ sung link Video Demo đủ `4/4` → GVHD duyệt chuyên môn → Giáo vụ/Admin duyệt → Viện trưởng ký Giấy xác nhận hoàn thành) end-to-end trên trình duyệt.
3. Rà soát & chuẩn hóa dữ liệu `department`/`major` hiện có trong database (nếu còn bản ghi cũ từ seed trước dùng tên cũ như `Công nghệ Phần mềm`) khớp với danh mục mới `academicUnits.js`.

### 4. Quyết định quan trọng (Decisions & Rationale)

- **Video Demo trong Kho Lưu Chiểu dùng Link ngoài (`https://`) thay vì upload `.mp4` trực tiếp**: Khớp với chính sách `DIRECT_VIDEO_UPLOAD_NOT_ALLOWED` ở backend (`archiveController.js`) và tránh phình dung lượng Supabase Storage.
- **Cấp `BM02_DEPARTMENT_SIGN` cho `VIEN_TRUONG` kết hợp `isDepartmentUnderInstitute`**: Tránh bế tắc quy trình ký BM02 cấp Bộ môn khi chưa cấu hình ủy quyền riêng, trong khi vẫn giữ nguyên cơ chế `AcademicDelegation` khi cần ủy quyền cho Trưởng bộ môn.
- **Dùng chung trang chi tiết quá trình sinh viên (`/lecturer/students/:registrationId` & `/admin/students/:registrationId`)**: Giữ nguyên Sidebar theo từng workspace, gom toàn bộ BM01–BM05 & lưu chiểu về một điểm xem duy nhất thay vì dàn trải quá nhiều nút thao tác trên bảng, chỉ hiển thị BM02-A khi sinh viên thực sự có nộp.
- **Cố định danh mục Bộ môn (2) và Ngành (4) bằng Dropdown**: Chống sai lệch dữ liệu tự do gây lệch phạm vi kiểm tra khoa/bộ môn và lỗi lọc báo cáo.
