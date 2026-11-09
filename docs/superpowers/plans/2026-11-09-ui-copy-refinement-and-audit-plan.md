# Kế Hoạch Triển Khai: Chuẩn Hóa Ngôn Ngữ Giao Diện & Báo Cáo Kiểm Toán Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện đại hóa và tự nhiên hóa toàn bộ câu chữ trên giao diện người dùng (Cổng Sinh viên, Cổng Giảng viên, Cổng Quản trị Viện, và Trang công khai), loại bỏ 100% tiếng Anh/mã enum trong dấu ngoặc, chuẩn hóa tên gọi biểu mẫu BM01–BM04 sang nghiệp vụ thuần túy, đồng thời lập báo cáo kiểm toán toàn diện các bất thường, lỗi giao diện và mã nguồn chưa sử dụng.

**Architecture:** Tiếp cận theo từng phân hệ người dùng (Chặng 1: Sinh viên $\rightarrow$ Chặng 2: Giảng viên $\rightarrow$ Chặng 3: Quản trị/Điều hành $\rightarrow$ Chặng 4: Dùng chung $\rightarrow$ Chặng 5: Báo cáo kiểm toán & Nghiệm thu). Giữ nguyên tuyệt đối các enum, giá trị hằng số, API contracts bên dưới; chỉ thay thế nhãn hiển thị phía người dùng (JSX text, props label, title, tooltip) và cập nhật đồng bộ các chuỗi regex trong bộ test UI contract.

**Tech Stack:** React 19, Ant Design v5, Tailwind CSS, Vite, Node test runner (`node --test`), Jest (backend).

**Spec:** [docs/superpowers/specs/2026-11-09-ui-copy-refinement-and-audit-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-09-ui-copy-refinement-and-audit-design.md)

## Global Constraints

- 100% tệp tin chỉnh sửa hoặc tạo mới phải lưu ở chuẩn **UTF-8 (no BOM)**.
- Giữ nguyên các giá trị logic kỹ thuật: `value="APPROVE"`, `value="INITIAL"`, status keys, query params, API endpoints; không can thiệp logic backend.
- Phân định rõ ràng tên gọi nghiệp vụ:
  - `BM01` $\rightarrow$ **Đề cương nghiên cứu chi tiết**
  - `BM02` (phía nộp & thẩm định đơn) $\rightarrow$ **Đơn đăng ký đề tài chính thức**
  - Giai đoạn Viện trưởng ban hành $\rightarrow$ **Quyết định giao đề tài**
  - `BM03` $\rightarrow$ **Nhật ký & Đánh giá tiến độ**
  - `BM04` $\rightarrow$ **Phiếu nhận xét của người hướng dẫn**
- Không để sót bất kỳ từ tiếng Anh hoặc mã enum trong ngoặc đơn dạng `(APPROVE)`, `(Initial)`, `(Correction)`, `(Quota)`, `(Audit Trail)`, `(TERMINATED_FAILED_PROGRESS)`.
- Không tự ý xóa code hoặc refactor 67 cảnh báo ESLint của codebase; chỉ ghi nhận đầy đủ vào tài liệu kiểm toán `docs/superpowers/audits/2026-11-09-ui-quality-and-code-audit.md`.
- Duy trì tỷ lệ đạt kiểm thử 100%: Backend (499/499 PASS), Frontend (93/93 PASS).

## Review Focus

1. **Hiển thị nhầm "Quyết định giao đề tài" cho bước nộp đơn sinh viên**: Sinh viên phải thấy nút bấm/hướng dẫn là "Nộp Đơn đăng ký đề tài chính thức", không phải "Nộp Quyết định giao đề tài".
2. **Làm gãy test assertion do chuỗi regex cũ**: Các file test `checkpointAppealUiContracts.test.js`, `bm02ReviewUiContracts.test.js`, `workflowContracts.test.js` kiểm tra khớp chuỗi text nguồn phải được cập nhật tương ứng với nhãn mới.
3. **Mã kỹ thuật rò rỉ trong câu cảnh báo/thông báo**: Thay thế các cảnh báo chứa tên biến `supersedesApprovalId` hay `TERMINATED_FAILED_PROGRESS` bằng tiếng Việt diễn giải rõ ràng, dễ hiểu.
4. **Viết tắt cộc lốc gây khó hiểu**: `Cho BV` phải được đổi thành `Đủ điều kiện bảo vệ`, `TBC` thành `Điểm bảo vệ trung bình`.
5. **Ký tự đóng ngoặc còn sót lại**: Tránh các lỗi gõ nhầm như để sót dấu ngoặc `)` hoặc khoảng trắng thừa khi xóa từ tiếng Anh.

---

### Task 1: Cổng Sinh Viên (Student Portal) - Hiện Đại Hóa Ngôn Ngữ & Đồng Bộ Hợp Đồng Kiểm Thử

**Files:**
- Modify: `frontend/src/pages/student/StudentDashboardPage.jsx`
- Modify: `frontend/src/pages/student/TopicListPage.jsx`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/pages/student/GradeViewPage.jsx`
- Modify: `frontend/src/components/student/CheckpointSignModal.jsx`
- Test: `frontend/tests/checkpointAppealUiContracts.test.js`

**Interfaces:**
- Consumes: Bảng ánh xạ thuật ngữ từ Spec Section 3.
- Produces: Giao diện Sinh viên không còn từ viết tắt BM01–BM04, không còn `(PASSED)`, `(FAILED)`, `(PRE-DEFENSE CHECKLIST)`, thông báo tiến độ thân thiện.

- [ ] **Step 1: Cập nhật nhãn và mô tả trên [StudentDashboardPage.jsx](file:///d:/DACN/frontend/src/pages/student/StudentDashboardPage.jsx)**
  - Đổi `Đã ban hành QĐ (BM02)` $\rightarrow$ `Đã ban hành Quyết định giao đề tài`.
  - Đổi `Quyết định Giao Đề tài Tốt nghiệp (BM02)` $\rightarrow$ `Quyết định Giao Đề tài Tốt nghiệp`.
  - Đổi `Báo cáo tiến độ BM03 đợt 2 (Checkpoint 2)` $\rightarrow$ `Đánh giá tiến độ đợt 2`.
  - Làm mượt các thẻ mốc tiến độ (Đề cương nghiên cứu, Đơn đăng ký đề tài, Đánh giá tiến độ định kỳ, Đánh giá của người hướng dẫn).

- [ ] **Step 2: Cập nhật nhãn và thông báo trên [SubmissionPage.jsx](file:///d:/DACN/frontend/src/pages/student/SubmissionPage.jsx)**
  - Đổi `HỒ SƠ LƯU CHIỂU SƠ BỘ TRƯỚC BẢO VỆ (PRE-DEFENSE CHECKLIST)` $\rightarrow$ `HỒ SƠ LƯU CHIỂU SƠ BỘ TRƯỚC BẢO VỆ`.
  - Đổi `ĐÃ DUYỆT (PASS)` $\rightarrow$ `ĐÃ DUYỆT ĐẠT`.
  - Đổi thông báo: `Bắt buộc nộp bản thảo báo cáo, slide hoặc mã nguồn trước khi GVHD có thể đánh giá và ký duyệt BM04` $\rightarrow$ `Bắt buộc nộp bản thảo báo cáo, slide hoặc mã nguồn trước khi GVHD có thể đánh giá và ký duyệt Phiếu nhận xét`.
  - Đổi các tiêu đề nhiệm vụ: `Đề cương nghiên cứu chi tiết`, `Đơn đăng ký đề tài chính thức`.

- [ ] **Step 3: Cập nhật nhãn trên [GradeViewPage.jsx](file:///d:/DACN/frontend/src/pages/student/GradeViewPage.jsx) và [TopicListPage.jsx](file:///d:/DACN/frontend/src/pages/student/TopicListPage.jsx)**
  - Đổi `ĐẠT (PASSED)` $\rightarrow$ `ĐẠT`, `KHÔNG ĐẠT (FAILED)` $\rightarrow$ `KHÔNG ĐẠT`.
  - Đổi `Video Demo sản phẩm (YouTube/Drive)` $\rightarrow$ `Đường dẫn video giới thiệu sản phẩm`.
  - Xóa bỏ các ngoặc `(Repo)`, `(MSSV)` trên bảng tra cứu đề tài.

- [ ] **Step 4: Cập nhật nhãn trên [CheckpointSignModal.jsx](file:///d:/DACN/frontend/src/components/student/CheckpointSignModal.jsx)**
  - Đổi tiêu đề `Biên bản Đánh giá Tiến độ (BM03 Checkpoint)` $\rightarrow$ `Biên bản Đánh giá Tiến độ`.
  - Chuyển đổi các cảnh báo dừng đề tài sang ngôn ngữ học vụ trang trọng, không kèm mã kỹ thuật.

- [ ] **Step 5: Đồng bộ regex trong [checkpointAppealUiContracts.test.js](file:///d:/DACN/frontend/tests/checkpointAppealUiContracts.test.js)**
  - Cập nhật assertion kiểm tra thông báo nộp pre-defense tương ứng với chuỗi mới.

- [ ] **Step 6: Chạy kiểm thử xác minh**
  - Chạy: `node --test frontend/tests/checkpointAppealUiContracts.test.js`
  - Chạy: `cd frontend; npm test`
  - Kỳ vọng: 93/93 tests PASS.

- [ ] **Step 7: Commit Chặng 1**
  ```bash
  git add frontend/src/pages/student/ frontend/src/components/student/ frontend/tests/checkpointAppealUiContracts.test.js
  git commit -m "refactor(student): modernize ui copy and eliminate english parens on student portal"
  ```

---

### Task 2: Cổng Giảng Viên (Lecturer Portal) - Tự Nhiên Hóa Câu Chữ & Đánh Giá Tiến Độ

**Files:**
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Modify: `frontend/src/pages/lecturer/TopicManagementPage.jsx`
- Modify: `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
- Modify: `frontend/src/pages/lecturer/GradingPage.jsx`
- Modify: `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`
- Modify: `frontend/src/components/lecturer/CheckpointIssueModal.jsx`

**Interfaces:**
- Consumes: Thuật ngữ chuẩn hóa Đánh giá tiến độ, Phiếu nhận xét của người hướng dẫn, Đủ điều kiện bảo vệ.
- Produces: Cổng Giảng viên không còn từ cộc lốc `Cho BV`, không còn mã `(BM03 Checkpoint)`, `(BM04)`, `(BM01_PASSED)`.

- [ ] **Step 1: Cập nhật [ProgressTrackingPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/ProgressTrackingPage.jsx)**
  - Đổi `✓ Đã duyệt BM04 (Cho BV)` $\rightarrow$ `✓ Đã duyệt phiếu nhận xét - Đủ điều kiện bảo vệ`.
  - Đổi `Phiếu Nhận Xét Của Giảng Viên Hướng Dẫn (BM04)` $\rightarrow$ `Phiếu Nhận Xét Của Giảng Viên Hướng Dẫn`.
  - Đổi `+ Ghi Nhận Buổi Gặp Lab Mới (BM03)` $\rightarrow$ `+ Ghi Nhận Buổi Gặp Hướng Dẫn Mới`.
  - Đổi `GitHub Repo (Public)` $\rightarrow$ `Kho lưu trữ mã nguồn công khai`.
  - Đổi `Chỉ tiêu (Quota)` $\rightarrow$ `Chỉ tiêu hướng dẫn`.

- [ ] **Step 2: Cập nhật [LecturerDashboardPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerDashboardPage.jsx) và [TopicApprovalPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/TopicApprovalPage.jsx)**
  - Đổi `✓ Đạt (Cho BV)` $\rightarrow$ `✓ Đạt - Đủ điều kiện bảo vệ`.
  - Đổi `✓ Đã duyệt ĐẠT (BM01_PASSED)` $\rightarrow$ `✓ Đã duyệt đạt đề cương`.
  - Cập nhật tiêu đề hàng đợi thẩm định đề cương và theo dõi tiến độ sinh viên.

- [ ] **Step 3: Cập nhật [CheckpointIssueModal.jsx](file:///d:/DACN/frontend/src/components/lecturer/CheckpointIssueModal.jsx) và [LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx)**
  - Đổi tiêu đề `Phát Hành Biên Bản Đánh Giá Tiến Độ (BM03 Checkpoint)` $\rightarrow$ `Phát Hành Biên Bản Đánh Giá Tiến Độ`.
  - Đổi `Bảng Tiêu Chí Đánh Giá Khóa Luận (Rubric)` $\rightarrow$ `Phiếu Đánh Giá Điểm Bảo Vệ Theo Tiêu Chí`.
  - Loại bỏ các mã kỹ thuật `(TERMINATED_FAILED_PROGRESS)` trong cảnh báo phát hành tiến độ, thay bằng lời giải thích rõ ràng hậu quả học vụ.

- [ ] **Step 4: Chạy kiểm thử xác minh Chặng 2**
  - Chạy: `cd frontend; npm test`
  - Kỳ vọng: 93/93 tests PASS.

- [ ] **Step 5: Commit Chặng 2**
  ```bash
  git add frontend/src/pages/lecturer/ frontend/src/components/lecturer/
  git commit -m "refactor(lecturer): polish academic copy and remove dry abbreviations on lecturer portal"
  ```

---

### Task 3: Cổng Quản Trị & Điều Hành Viện (Admin & Institute Portal) - Xóa Tiếng Anh Trong Ngoặc & Thuật Ngữ Kỹ Thuật

**Files:**
- Modify: `frontend/src/pages/admin/DashboardPage.jsx`
- Modify: `frontend/src/pages/admin/TopicManagementPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectEnrollmentPage.jsx`
- Modify: `frontend/src/pages/admin/CouncilAssignmentPage.jsx`
- Modify: `frontend/src/pages/admin/GradingDefensePage.jsx`
- Modify: `frontend/src/pages/admin/ProjectOversightPage.jsx`
- Modify: `frontend/src/pages/admin/UserManagementPage.jsx`
- Modify: `frontend/src/components/admin/BM02ReviewDrawer.jsx`
- Modify: `frontend/src/components/admin/DefenseResultPublicationModal.jsx`
- Modify: `frontend/src/components/admin/PublicationHistoryModal.jsx`
- Modify: `frontend/src/components/admin/CorrectDefenseResultModal.jsx`
- Modify: `frontend/src/components/admin/CheckpointAppealReviewModal.jsx`
- Modify: `frontend/src/components/admin/ManualReviewModal.jsx`
- Modify: `frontend/src/components/coordination/LecturerAssignmentTab.jsx`
- Modify: `frontend/src/components/coordination/CoordinationOverviewTab.jsx`
- Test: `frontend/tests/bm02ReviewUiContracts.test.js`

**Interfaces:**
- Consumes: Quyết định giao đề tài, Đơn đăng ký đề tài chính thức, Công bố chính thức đợt 1 / Bổ sung / Đính chính.
- Produces: Cổng Quản trị không còn `(APPROVE)`, `(RETURN_FOR_REVISION)`, `(Initial)`, `(Correction)`, `(Audit Trail)`, `(Quota)`.

- [ ] **Step 1: Cập nhật [BM02ReviewDrawer.jsx](file:///d:/DACN/frontend/src/components/admin/BM02ReviewDrawer.jsx) và đồng bộ test [bm02ReviewUiContracts.test.js](file:///d:/DACN/frontend/tests/bm02ReviewUiContracts.test.js)**
  - Đổi nhãn nút `Phê duyệt (APPROVE)` $\rightarrow$ `Phê duyệt`.
  - Đổi nhãn nút `Yêu cầu chỉnh sửa (RETURN_FOR_REVISION)` $\rightarrow$ `Yêu cầu chỉnh sửa`.
  - Viết lại câu mô tả quyền Viện: Loại bỏ `(APPROVE)` và `(RETURN_FOR_REVISION)`.
  - Đảm bảo Radio value vẫn giữ nguyên `'APPROVE'` và `'RETURN_FOR_REVISION'` để test contract không bị ảnh hưởng.
  - Chạy `node --test frontend/tests/bm02ReviewUiContracts.test.js` để kiểm chứng.

- [ ] **Step 2: Cập nhật [DefenseResultPublicationModal.jsx](file:///d:/DACN/frontend/src/components/admin/DefenseResultPublicationModal.jsx) và [PublicationHistoryModal.jsx](file:///d:/DACN/frontend/src/components/admin/PublicationHistoryModal.jsx)**
  - Đổi `label: 'Công bố Lần đầu (Initial)'` $\rightarrow$ `label: 'Công bố Chính thức đợt 1'`.
  - Đổi `label: 'Công bố Bổ sung (Supplementary)'` $\rightarrow$ `label: 'Công bố Bổ sung'`.
  - Đổi `label: 'Công bố Đính chính (Correction)'` $\rightarrow$ `label: 'Công bố Đính chính'`.
  - Đổi `Cam kết tính toàn vẹn và bất biến (Snapshot Immutability)` $\rightarrow$ `Cam kết bảo toàn dữ liệu vĩnh viễn`.
  - Viết lại phần mô tả niêm phong dữ liệu: bỏ cụm `(CORRECTION)`.

- [ ] **Step 3: Cập nhật [CorrectDefenseResultModal.jsx](file:///d:/DACN/frontend/src/components/admin/CorrectDefenseResultModal.jsx) và [CheckpointAppealReviewModal.jsx](file:///d:/DACN/frontend/src/components/admin/CheckpointAppealReviewModal.jsx)**
  - Đổi `Điểm bảo vệ (TBC)` $\rightarrow$ `Điểm bảo vệ trung bình`.
  - Đổi `ĐẠT BẢO VỆ (DEFENSE_PASSED)` $\rightarrow$ `ĐẠT BẢO VỆ`.
  - Đổi `KHÔNG ĐẠT (DEFENSE_FAILED)` $\rightarrow$ `KHÔNG ĐẠT`.
  - Đổi `Cơ chế bảo toàn dấu vết kiểm toán (Audit Trail)` $\rightarrow$ `Cơ chế lưu vết kiểm toán`.
  - Viết lại câu mô tả: loại bỏ các mã kỹ thuật `(supersedesApprovalId)` và `(CORRECTION)`.
  - Đổi nhãn nút quyết định khiếu nại: `Bác đơn (REJECTED)` $\rightarrow$ `Từ chối đề xuất`, `Chấp thuận gia hạn (APPROVED)` $\rightarrow$ `Chấp thuận gia hạn`.

- [ ] **Step 4: Cập nhật các Tab điều phối [LecturerAssignmentTab.jsx](file:///d:/DACN/frontend/src/components/coordination/LecturerAssignmentTab.jsx) và [CoordinationOverviewTab.jsx](file:///d:/DACN/frontend/src/components/coordination/CoordinationOverviewTab.jsx)**
  - Đổi các nhãn hiển thị `Quota`, `SV Tối Đa (Quota)` $\rightarrow$ `Chỉ tiêu hướng dẫn`.
  - Đổi `Hàng đợi Triage` trên [DashboardPage.jsx](file:///d:/DACN/frontend/src/pages/admin/DashboardPage.jsx) $\rightarrow$ `Công việc cần xử lý khẩn`.

- [ ] **Step 5: Cập nhật các trang [ProjectPeriodPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectPeriodPage.jsx), [CouncilAssignmentPage.jsx](file:///d:/DACN/frontend/src/pages/admin/CouncilAssignmentPage.jsx), [GradingDefensePage.jsx](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx), [ProjectOversightPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectOversightPage.jsx)**
  - Phân định rõ ràng: Danh sách đề tài nộp đơn đăng ký vs Danh sách đã ký Quyết định giao đề tài.
  - Bỏ các mã số BM01–BM04 trên các tab và thanh công cụ.

- [ ] **Step 6: Chạy kiểm thử xác minh Chặng 3**
  - Chạy: `node --test frontend/tests/bm02ReviewUiContracts.test.js`
  - Chạy: `cd frontend; npm test`
  - Kỳ vọng: 93/93 tests PASS.

- [ ] **Step 7: Commit Chặng 3**
  ```bash
  git add frontend/src/pages/admin/ frontend/src/components/admin/ frontend/src/components/coordination/ frontend/tests/bm02ReviewUiContracts.test.js
  git commit -m "refactor(admin): humanize academic administrative copy and remove technical brackets"
  ```

---

### Task 4: Thành Phần Dùng Chung, Điều Hướng & Trang Chủ (Shared & Public)

**Files:**
- Modify: `frontend/src/components/layout/AppLayout.jsx`
- Modify: `frontend/src/components/common/statusMap.js`
- Modify: `frontend/src/components/common/ExcelImportModal.jsx`
- Modify: `frontend/src/components/forms/HybridBMFormModal.jsx`
- Modify: `frontend/src/components/forms/BMSubmissionViewer.jsx`
- Modify: `frontend/src/components/forms/ClearanceCertificateModal.jsx`
- Modify: `frontend/src/pages/common/HomePage.jsx`
- Modify: `frontend/src/pages/common/ProfilePage.jsx`
- Test: `frontend/tests/workflowContracts.test.js`

**Interfaces:**
- Consumes: Bảng trạng thái chuẩn hóa, thanh menu điều hướng chuẩn.
- Produces: Thanh điều hướng, trạng thái hồ sơ, modal import và trang chủ hoàn toàn sạch bóng tiếng Anh trong ngoặc.

- [ ] **Step 1: Cập nhật từ điển trạng thái [statusMap.js](file:///d:/DACN/frontend/src/components/common/statusMap.js)**
  - Rà soát toàn bộ nhãn hiển thị trạng thái hồ sơ:
    - Loại bỏ mã viết tắt BM01, BM02, BM03, BM04 trong nhãn tiếng Việt (ví dụ: `Chờ duyệt đề cương`, `Đang thực hiện đồ án`, `Chờ ký xác nhận tiến độ`, `Đã duyệt phiếu nhận xét - Sẵn sàng bảo vệ`,...).

- [ ] **Step 2: Cập nhật thanh điều hướng [AppLayout.jsx](file:///d:/DACN/frontend/src/components/layout/AppLayout.jsx) và [navigationRegistry.js](file:///d:/DACN/frontend/src/config/navigationRegistry.js)**
  - Rà soát các tiêu đề nhóm và mục menu:
    - Phân định rõ "Thẩm định Đơn đăng ký đề tài" vs "Quyết định giao đề tài".

- [ ] **Step 3: Cập nhật [ExcelImportModal.jsx](file:///d:/DACN/frontend/src/components/common/ExcelImportModal.jsx) và các modal biểu mẫu**
  - Đổi `File Excel không có trang tính (sheet) nào.` $\rightarrow$ `Tệp Excel không có trang tính nào.`.
  - Đổi các nhãn học vị: `Thạc sĩ (THAC_SI)` $\rightarrow$ `Thạc sĩ`, `Tiến sĩ (TIEN_SI)` $\rightarrow$ `Tiến sĩ`, `Phó Giáo sư (PHO_GIAO_SU)` $\rightarrow$ `Phó Giáo sư`, `Giáo sư (GIAO_SU)` $\rightarrow$ `Giáo sư`.
  - Đổi `SV Tối Đa (Quota)` $\rightarrow$ `Chỉ tiêu hướng dẫn`.
  - Đổi `Đóng (Esc)` $\rightarrow$ `Đóng`.

- [ ] **Step 4: Cập nhật [HomePage.jsx](file:///d:/DACN/frontend/src/pages/common/HomePage.jsx) và [ProfilePage.jsx](file:///d:/DACN/frontend/src/pages/common/ProfilePage.jsx)**
  - Đổi `Mã số sinh viên (MSSV)` $\rightarrow$ `Mã số sinh viên`.
  - Rà soát các thông báo kiểm tra đạo văn: Bỏ các ngoặc đơn dư thừa `(Overall Similarity Index)`, `(Single Source Match)`, `(Exclude)`.

- [ ] **Step 5: Chạy kiểm thử xác minh Chặng 4**
  - Chạy: `node --test frontend/tests/workflowContracts.test.js`
  - Chạy: `cd frontend; npm test`
  - Kỳ vọng: 93/93 tests PASS.

- [ ] **Step 6: Commit Chặng 4**
  ```bash
  git add frontend/src/components/layout/ frontend/src/components/common/ frontend/src/components/forms/ frontend/src/pages/common/
  git commit -m "refactor(common): clean up status map, import modals, navigation, and landing page copy"
  ```

---

### Task 5: Báo Cáo Kiểm Toán Chất Lượng UI & Nghiệm Thu Toàn Diện (Audit Report & Final Verification)

**Files:**
- Create: `docs/superpowers/audits/2026-11-09-ui-quality-and-code-audit.md`
- Test: Toàn bộ Backend test suites + Frontend test suites + Vite build.

**Interfaces:**
- Consumes: Kết quả quét script tự động và chạy `npm run lint`.
- Produces: Báo cáo kiểm toán chính thức trình người dùng, xác nhận 0 lỗi tiếng Anh trong ngoặc và 100% tests PASS.

- [ ] **Step 1: Chạy script quét tự động kiểm tra tiếng Anh trong ngoặc**
  - Chạy: `node C:\Users\phucm\.gemini\antigravity\brain\0043035e-8225-46f5-ac02-718ccc56f497\scratch\scan_ui.js`
  - Kỳ vọng: 0 trường hợp tiếng Anh hoặc mã enum trong ngoặc trên toàn bộ UI `frontend/src/`.

- [ ] **Step 2: Chạy kiểm toán mã nguồn & linting**
  - Chạy: `cd frontend; npm run lint`
  - Thu thập danh sách chi tiết: các biến không dùng, lỗi React 19 immutability (nếu có trên HomePage), thiếu dependency trong hooks, và các thành phần thừa.

- [ ] **Step 3: Lập tài liệu báo cáo kiểm toán [2026-11-09-ui-quality-and-code-audit.md](file:///d:/DACN/docs/superpowers/audits/2026-11-09-ui-quality-and-code-audit.md)**
  - Tổng hợp danh sách:
    1. Các điểm bất thường phát hiện được trên UI.
    2. Các cảnh báo linting / code quality theo từng phân hệ.
    3. Các mã nguồn hoặc linh kiện chưa sử dụng (dead code candidates).
    4. Khuyến nghị giải pháp xử lý cho các phiên làm việc tiếp theo.

- [ ] **Step 4: Chạy kiểm thử nghiệm thu toàn hệ thống**
  - Backend: `cd backend; npm test` (Kỳ vọng: 66/66 test suites PASS, 499/499 tests PASS).
  - Frontend: `cd frontend; npm test` (Kỳ vọng: 93/93 tests PASS).
  - Frontend Build: `cd frontend; npm run build` (Kỳ vọng: PASS 0 errors).

- [ ] **Step 5: Commit Báo cáo kiểm toán**
  ```bash
  git add -f docs/superpowers/audits/2026-11-09-ui-quality-and-code-audit.md
  git commit -m "docs(audit): publish ui quality, anomalies, and dead code audit report"
  ```
