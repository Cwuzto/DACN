# Thiết Kế Chi Tiết: Chuẩn Hóa Ngôn Ngữ Giao Diện & Rà Soát Toàn Diện Codebase Frontend (UI Copy Refinement & Audit)

- **Ngày ban hành**: 09/11/2026
- **Tác giả**: Antigravity Pair Programming Agent & Engineering Team
- **Trạng thái**: Draft / Đang chờ duyệt
- **Phạm vi tác động**: Toàn bộ thư mục `frontend/src/` (40+ views, components, modals, drawers, status mappings)

---

## 1. Bối Cảnh & Mục Tiêu (Intent & The Why)

Hệ thống Quản lý Đồ án Tốt nghiệp (DACN) hiện đang phục vụ 3 nhóm người dùng chính: **Sinh viên**, **Giảng viên hướng dẫn / Thành viên hội đồng**, và **Ban Chủ nhiệm Viện / Quản trị viên**. 

Qua quá trình phát triển qua nhiều giai đoạn kỹ thuật, giao diện người dùng hiện tồn tại nhiều cụm từ:
1. **Chứa tiếng Anh hoặc mã kỹ thuật trong ngoặc đơn**: Ví dụ `Phê duyệt (APPROVE)`, `Yêu cầu chỉnh sửa (RETURN_FOR_REVISION)`, `Lần đầu (Initial)`, `Đính chính (Correction)`, `Cơ chế lưu vết (Audit Trail)`, `Chỉ tiêu (Quota)`, `(TERMINATED_FAILED_PROGRESS)`.
2. **Sử dụng mã số biểu mẫu kỹ thuật**: Các nhãn như `BM01`, `BM02`, `BM03`, `BM04` gây khó hiểu đối với sinh viên mới hoặc người dùng không nhớ rõ số hiệu văn bản hành chính.
3. **Từ ngữ khô khan, cộc lốc hoặc ít dùng**: Ví dụ `Cho BV` (thay vì *Đủ điều kiện bảo vệ*), `Bác đơn` (thay vì *Từ chối gia hạn* hoặc *Không chấp thuận*), `Hàng đợi Triage` (thay vì *Việc cần xử lý khẩn*), `Quota` (thay vì *Chỉ tiêu hướng dẫn*).

**Mục tiêu của thiết kế này**:
- Chuyển đổi 100% các từ ngữ trên UI sang tiếng Việt tự nhiên, chuẩn mực học thuật, thân thiện và giàu tính hướng dẫn.
- Loại bỏ hoàn toàn các từ tiếng Anh và mã enum kỹ thuật trong ngoặc đơn.
- Chuyển đổi các mã biểu mẫu BM01-BM04 sang tên gọi nghiệp vụ thuần túy và rõ nghĩa.
- Đồng thời quét, phát hiện và lập danh mục toàn bộ các điểm bất thường, lỗi giao diện (bug) hoặc thành phần chưa sử dụng trong codebase frontend để xử lý dứt điểm.

---

## 2. Mục Tiêu, Phi Mục Tiêu & Chống Mục Tiêu (Goals, Non-Goals, Anti-Goals)

### 2.1. Mục Tiêu (Goals)
- **Tự nhiên hóa ngôn ngữ**: Chuẩn hóa toàn bộ văn bản hiển thị trên các trang, modal, drawer, thanh điều hướng, thông báo toast, tooltip và bảng dữ liệu.
- **Triệt tiêu tiếng Anh trong ngoặc**: Loại bỏ 100% các cụm từ tiếng Anh đi kèm trong ngoặc đơn trên UI.
- **Thuần túy hóa biểu mẫu**:
  - `BM01` $\rightarrow$ **Đề cương nghiên cứu** (hoặc *Đề cương chi tiết*)
  - `BM02` $\rightarrow$ **Quyết định giao đề tài** (hoặc *Đơn đăng ký đề tài chính thức*)
  - `BM03` $\rightarrow$ **Nhật ký & Đánh giá tiến độ**
  - `BM04` $\rightarrow$ **Phiếu nhận xét của người hướng dẫn**
- **Báo cáo kiểm toán chất lượng UI**: Ghi nhận chi tiết mọi bug, cảnh báo ESLint, biến không dùng, và thành phần mồ côi (dead code) phát hiện được trong quá trình quét.
- **Bảo toàn kiểm thử**: Giữ vững tỷ lệ đạt 100% của cả hai bộ test: Backend (499/499 tests PASS) và Frontend (93/93 tests PASS).

### 2.2. Phi Mục Tiêu (Non-Goals)
- Không thay đổi các giá trị hằng số, enum, khóa API, route backend hoặc cấu trúc schema Prisma (ví dụ: `Radio value="APPROVE"` giữ nguyên `value="APPROVE"`, chỉ đổi text hiển thị).
- Không xây dựng thư viện i18n đa ngôn ngữ cồng kềnh; tối ưu hóa chuỗi trực tiếp trên JSX để đạt tốc độ render tối đa.

### 2.3. Chống Mục Tiêu (Anti-Goals)
- Tuyệt đối không làm gãy các test contract trong `frontend/tests/` (ví dụ: các kiểm tra regex kiểm tra sự hiện diện của hằng số trong code như `/APPROVE/` hay `/INITIAL/` phải được duy trì thông qua các thuộc tính code/props).
- Không làm mờ nghĩa nghiệp vụ: Đảm bảo người dùng vẫn phân biệt được chính xác từng giai đoạn của đề tài (ví dụ: giai đoạn nộp đề cương khác với giai đoạn ban hành quyết định).

---

## 3. Bảng Ánh Xạ Chuẩn Hóa Thuật Ngữ Học Vụ (Standardized Glossary)

| Thuật ngữ cũ / Khô khan / Kèm tiếng Anh | Thuật ngữ Chuẩn hóa Mới | Ngữ cảnh sử dụng |
| :--- | :--- | :--- |
| `BM01`, `Đề cương BM01` | **Đề cương nghiên cứu** / **Đề cương chi tiết** | Cổng SV, GV duyệt đề cương |
| `BM02`, `QĐ BM02`, `Đơn BM02` | **Quyết định giao đề tài** / **Đơn đăng ký đề tài** | Cổng SV, Cổng Viện trưởng |
| `BM03`, `Checkpoint BM03` | **Nhật ký & Đánh giá tiến độ** / **Đợt đánh giá tiến độ** | Gặp lab, theo dõi tiến độ |
| `BM04`, `Phiếu BM04` | **Phiếu nhận xét của người hướng dẫn** | Đánh giá trước bảo vệ |
| `Phê duyệt (APPROVE)` | **Phê duyệt** | Nút bấm, action |
| `Yêu cầu chỉnh sửa (RETURN_FOR_REVISION)` | **Yêu cầu chỉnh sửa** | Nút bấm, action |
| `Bác đơn (REJECTED)` | **Từ chối đề xuất** / **Không chấp thuận** | Thẩm định khiếu nại chữ ký |
| `Chấp thuận gia hạn (APPROVED)` | **Chấp thuận gia hạn** | Thẩm định khiếu nại chữ ký |
| `Công bố Lần đầu (Initial)` | **Công bố Chính thức đợt 1** | Modal công bố điểm bảo vệ |
| `Công bố Bổ sung (Supplementary)` | **Công bố Bổ sung** | Modal công bố điểm bảo vệ |
| `Công bố Đính chính (Correction)` | **Công bố Đính chính** | Modal công bố điểm bảo vệ |
| `(Audit Trail)` | **Lịch sử kiểm toán** / **Truy vết thay đổi** | Cảnh báo bảo mật hệ thống |
| `(Snapshot Immutability)` | **Bảo toàn dữ liệu vĩnh viễn** | Banner niêm phong công bố |
| `(Quota)` / `Chỉ tiêu Quota` | **Chỉ tiêu hướng dẫn** / **Số lượng tối đa** | Phân công giảng viên |
| `Cho BV` / `✓ Đạt (Cho BV)` | **✓ Đủ điều kiện bảo vệ** | Bảng theo dõi tiến độ |
| `TBC` / `Điểm bảo vệ (TBC)` | **Điểm bảo vệ trung bình** | Sổ điểm, kết quả tốt nghiệp |
| `(TERMINATED_FAILED_PROGRESS)` | **Dừng thực hiện đề tài do không đạt tiến độ** | Cảnh báo tiến độ học vụ |
| `(PRE-DEFENSE CHECKLIST)` | **Hồ sơ lưu chiểu trước bảo vệ** | Trang nộp bài của sinh viên |
| `ĐÃ DUYỆT (PASS)` | **Đã duyệt đạt** | Tag trạng thái nộp bài |
| `ĐẠT (PASSED)` / `KHÔNG ĐẠT (FAILED)` | **Đạt** / **Không đạt** | Kết quả công bố chính thức |
| `Repo` / `(Repo)` | **Kho lưu trữ mã nguồn** | Liên kết GitHub/GitLab |
| `Esc` / `Đóng (Esc)` | **Đóng** | Nút đóng modal/drawer |
| `Hàng đợi Triage` | **Công việc cần xử lý khẩn** | Dashboard Admin |

---

## 4. Các Phương Án Đã Xem Xét & Quyết Định (Approaches)

- **Phương án 1 (Đã chọn)**: Rà soát & thay thế trực diện theo 4 phân hệ người dùng. Đảm bảo an toàn logic, kiểm soát tiến độ theo từng nhóm tính năng và phát hiện bug tức thì.
- **Phương án 2 (Loại bỏ)**: Xây dựng hệ thống từ điển nhãn tập trung i18n. Bị loại vì tăng độ phức tạp kiến trúc và tiềm ẩn nguy cơ regression cao đối với một SPA React không có nhu cầu đa ngữ.

---

## 5. Kế Hoạch Phân Kỳ Triển Khai (Phased Rollout Plan)

Quá trình triển khai sẽ được chia thành 4 chặng độc lập theo phương pháp Subagent-Driven Development:

### Chặng 1: Cổng Sinh Viên (Student Portal)
- **Tệp tin**:
  - `frontend/src/pages/student/StudentDashboardPage.jsx`
  - `frontend/src/pages/student/TopicListPage.jsx`
  - `frontend/src/pages/student/SubmissionPage.jsx`
  - `frontend/src/pages/student/GradeViewPage.jsx`
  - `frontend/src/components/student/CheckpointSignModal.jsx`
- **Nội dung**:
  - Đổi các nhãn `BM01`, `BM02`, `BM03`, `BM04` sang tên nghiệp vụ dễ hiểu.
  - Xóa bỏ `(PASSED)`, `(FAILED)`, `(PRE-DEFENSE CHECKLIST)`.
  - Làm mượt các hướng dẫn nộp bài, tải biểu mẫu và thông điệp cảnh báo.

### Chặng 2: Cổng Giảng Viên (Lecturer Portal)
- **Tệp tin**:
  - `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
  - `frontend/src/pages/lecturer/TopicManagementPage.jsx`
  - `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
  - `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
  - `frontend/src/pages/lecturer/GradingPage.jsx`
  - `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`
  - `frontend/src/components/lecturer/CheckpointIssueModal.jsx`
- **Nội dung**:
  - Thay thế `Cho BV` bằng `Đủ điều kiện bảo vệ`.
  - Thay thế `(BM03 Checkpoint)`, `(BM04)` bằng tên thuần túy.
  - Chuẩn hóa giao diện chấm Rubric và hàng đợi thẩm định đề cương.

### Chặng 3: Cổng Quản Trị & Điều Hành Viện (Admin & Institute Portal)
- **Tệp tin**:
  - `frontend/src/pages/admin/DashboardPage.jsx`
  - `frontend/src/pages/admin/TopicManagementPage.jsx`
  - `frontend/src/pages/admin/ProjectPeriodPage.jsx`
  - `frontend/src/pages/admin/ProjectEnrollmentPage.jsx`
  - `frontend/src/pages/admin/CouncilAssignmentPage.jsx`
  - `frontend/src/pages/admin/GradingDefensePage.jsx`
  - `frontend/src/pages/admin/ProjectOversightPage.jsx`
  - `frontend/src/pages/admin/UserManagementPage.jsx`
  - `frontend/src/components/admin/BM02ReviewDrawer.jsx`
  - `frontend/src/components/admin/DefenseResultPublicationModal.jsx`
  - `frontend/src/components/admin/PublicationHistoryModal.jsx`
  - `frontend/src/components/admin/CorrectDefenseResultModal.jsx`
  - `frontend/src/components/admin/CheckpointAppealReviewModal.jsx`
  - `frontend/src/components/admin/ManualReviewModal.jsx`
  - `frontend/src/components/coordination/LecturerAssignmentTab.jsx`
  - `frontend/src/components/coordination/CoordinationOverviewTab.jsx`
- **Nội dung**:
  - Loại bỏ các mã `(APPROVE)`, `(RETURN_FOR_REVISION)`, `(Initial)`, `(Correction)`, `(Quota)`.
  - Thay các thông báo chứa tên biến kỹ thuật (`supersedesApprovalId`, `TERMINATED_FAILED_PROGRESS`) bằng diễn giải thân thiện.
  - Chuẩn hóa giao diện sổ điểm bảo vệ và thẩm định đề tài.

### Chặng 4: Thành Phần Dùng Chung, Điều Hướng & Trang Chủ (Shared & Public)
- **Tệp tin**:
  - `frontend/src/components/layout/AppLayout.jsx`
  - `frontend/src/components/common/statusMap.js`
  - `frontend/src/components/common/ExcelImportModal.jsx`
  - `frontend/src/components/forms/HybridBMFormModal.jsx`
  - `frontend/src/components/forms/BMSubmissionViewer.jsx`
  - `frontend/src/components/forms/ClearanceCertificateModal.jsx`
  - `frontend/src/pages/common/HomePage.jsx`
  - `frontend/src/pages/common/ProfilePage.jsx`
- **Nội dung**:
  - Chuẩn hóa nhãn menu điều hướng, từ điển trạng thái `statusMap.js`.
  - Thay thế các định danh học vị trong modal import Excel (`(THAC_SI)` $\rightarrow$ `Thạc sĩ`,...).
  - Dọn sạch các chuỗi kiểm tra đạo văn khô khan trên HomePage.

---

## 6. Tiêu Chí Nghiệm Thu & Kiểm Thử (Acceptance Criteria)

1. **Không còn tiếng Anh/mã enum trong ngoặc**: Quét tự động bằng script không còn phát hiện bất kỳ chuỗi `(EN_WORD)` hoặc `(CODE)` nào trên toàn bộ file JSX của `frontend/src/`.
2. **Biểu mẫu hiển thị tự nhiên**: 100% các vị trí trước đây gọi `BM01`, `BM02`, `BM03`, `BM04` được thay thế bằng tên nghiệp vụ tiếng Việt tương ứng.
3. **Báo cáo kiểm toán hoàn tất**: Tạo tài liệu báo cáo tổng hợp danh sách các bug, bất thường hoặc mã nguồn chưa dùng phát hiện được trong quá trình rà soát.
4. **Kiểm thử tự động 100% PASS**:
   - Backend: 66/66 suites, 499/499 tests PASS.
   - Frontend: 93/93 tests PASS (bao gồm các kiểm tra hợp đồng giao diện).
   - Build Production: `vite build` PASS (0 lỗi, 0 cảnh báo nghiêm trọng).
5. **Chuẩn mã hóa**: 100% tệp tin lưu ở định dạng **UTF-8 (no BOM)**.
