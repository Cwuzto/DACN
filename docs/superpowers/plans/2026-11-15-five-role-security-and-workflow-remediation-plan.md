# Kế Hoạch Triển Khai Chi Tiết (Implementation Plan)
## Khắc Phục Toàn Diện Lỗ Hổng Bảo Mật, Quyền Truy Cập & Toàn Vẹn Quy Trình 5 Vai Trò

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `self subagent` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triệt tiêu hoàn toàn các lỗ hổng bảo mật P0 (IDOR, rò rỉ điểm, leo thang đặc quyền Admin), khôi phục tính toàn vẹn quy trình (ban hành QĐ đề tài, quota 10 SV, lưu chiểu 2 cấp) và khắc phục các lỗi runtime vỡ UI theo kết quả audit 5 vai trò.

**Architecture:** Sử dụng mô hình 4 Worker Subagent song song độc lập với **Zero File Collision** (mỗi tệp chỉ do duy nhất 1 Worker chỉnh sửa), sau đó tổng hợp kết quả tại Agent chính và chạy kiểm thử tích hợp chéo toàn diện.

**Tech Stack:** Node.js, Express, Prisma ORM, PostgreSQL (Supabase), React 19, Ant Design, Vite, Jest.

**Spec:** [docs/superpowers/specs/2026-11-15-five-role-security-and-workflow-remediation-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-15-five-role-security-and-workflow-remediation-design.md)

## Global Constraints
- Tuân thủ nghiêm ngặt mô hình `TopicRegistration` (1 sinh viên / 1 đề tài, 1 GVHD tối đa 10 SV).
- Nguyên tắc "Sửa gốc vấn đề trước": CSDL/Prisma $\rightarrow$ Backend Route/Controller $\rightarrow$ Frontend UI.
- Tất cả các tệp phải lưu dưới định dạng **UTF-8 (no BOM)**.
- Tuân thủ chuẩn UI/UX Button (Rule 2.6): Sử dụng prop `icon={<IconComponent />}`, không chèn ký tự emoji/thô vào nhãn nút bấm.
- Frontend không sử dụng dữ liệu giả (mock data) nếu backend đã có API thực tế.

## Review Focus
1. **Leo thang đặc quyền Import**: Kiểm tra payload giả mạo `{ role: 'ADMIN' }` hoặc dùng `onDuplicate: 'UPDATE'` trên tài khoản Admin phải bị chặn đứng, không làm thay đổi quyền hạn.
2. **Rò rỉ điểm bảo vệ**: Sinh viên gọi API đăng ký hoặc dashboard khi Hội đồng chưa khóa sổ và chưa công bố kết quả (`isPublished !== true`) phải không nhận được bất kỳ điểm số hay nhận xét nào.
3. **IDOR chéo hồ sơ**: Sinh viên A gọi GET BM02-A, BM03, BM04 của sinh viên B phải nhận lỗi 403 `FORBIDDEN_RESOURCE`.
4. **Ghi đè phạm vi Hội đồng**: Giảng viên truyền tham số `?councilId=...` không thuộc phân công của mình phải không thể xem danh sách sinh viên hội đồng khác.
5. **Ban hành QĐ đề tài**: API `POST /api/semesters/:id/issue-topic-assignment-decisions` phải tìm thấy và cập nhật chính xác các hồ sơ đang ở trạng thái `BM02_APPROVED`.

---

### Task 1: Worker 1 — Admin & RBAC Core
**Mục tiêu:** Chặn lỗ hổng leo thang quyền Admin qua Excel, chống hạ cấp tài khoản đặc quyền, lọc ủy quyền học vụ theo học kỳ, và cấp quyền điều phối cho Giáo vụ.

**Files:**
- Modify: `backend/src/controllers/userController.js:955-1310`
- Modify: `backend/src/middlewares/auth.js:105-125`
- Modify: `backend/src/constants/permissions.js:395-420`
- Test: `backend/tests/integration/userImportSecurity.test.js`

- [ ] **Step 1.1**: Viết test tích hợp `userImportSecurity.test.js` mô phỏng yêu cầu import với `{ role: 'ADMIN' }` (kỳ vọng 400 `ADMIN_IMPORT_FORBIDDEN`) và import cập nhật trùng sinh viên lên tài khoản Admin hiện hữu (kỳ vọng không bị đổi role thành `STUDENT`).
- [ ] **Step 1.2**: Chỉnh sửa [userController.js](file:///d:/DACN/backend/src/controllers/userController.js#L960-L970):
  - Ràng buộc: `if (!['STUDENT', 'LECTURER'].includes(role)) return res.status(400).json({ success: false, code: 'ADMIN_IMPORT_FORBIDDEN', message: 'Không được phép import tài khoản Quản trị viên qua file Excel.' });`
  - Tại logic `onDuplicate === 'UPDATE'`: Nếu `existing.role === 'ADMIN'`, giữ nguyên `role: existing.role` và không ghi đè quyền hạn quản trị.
- [ ] **Step 1.3**: Chỉnh sửa [auth.js](file:///d:/DACN/backend/src/middlewares/auth.js#L105-L125):
  - Trích xuất `semesterId` từ ngữ cảnh hiện tại (hoặc query/header), thêm điều kiện: `OR: [{ semesterId: null }, { semesterId: currentSemesterId }]` khi truy vấn `academicDelegation`.
- [ ] **Step 1.4**: Chỉnh sửa [permissions.js](file:///d:/DACN/backend/src/constants/permissions.js#L398-L415):
  - Bổ sung quyền `VIEW_PROJECT_ENROLLMENTS` vào nhóm `GIAO_VU`.
- [ ] **Step 1.5**: Chạy test `userImportSecurity.test.js` và xác nhận PASS.

---

### Task 2: Worker 2 — Giảng Viên & Đánh Giá BM03/BM04/BM05
**Mục tiêu:** Bổ sung đầy đủ trạng thái vào bộ đếm trần 10 SV, bảo vệ bí mật chấm độc lập BM05, chặn IDOR đọc BM03/BM04, và sửa lỗi `fetchDefenseData` trên giao diện chấm điểm.

**Files:**
- Modify: `backend/src/constants/mentorCapacity.js:3-35`
- Modify: `backend/src/controllers/evaluationController.js:400-430`
- Modify: `backend/src/routes/bm03Routes.js:15-25`
- Modify: `backend/src/controllers/bm03Controller.js:45-60`
- Modify: `backend/src/routes/bm04Routes.js:15-30`
- Modify: `backend/src/controllers/bm04Controller.js:45-60`
- Modify: `frontend/src/pages/lecturer/GradingPage.jsx:170-185`
- Test: `backend/tests/integration/mentorOwnershipAndGradingScope.test.js`

- [ ] **Step 2.1**: Viết test tích hợp `mentorOwnershipAndGradingScope.test.js`:
  - Giảng viên A không được xem BM03/BM04 của sinh viên do Giảng viên B hướng dẫn.
  - Bộ đếm quota tính đúng khi sinh viên ở các trạng thái `BM02_APPROVED`, `DEFENSE_ELIGIBLE`.
  - Filter `councilId` không ghi đè phạm vi hội đồng của giảng viên.
- [ ] **Step 2.2**: Cập nhật [mentorCapacity.js](file:///d:/DACN/backend/src/constants/mentorCapacity.js#L3-L28) với danh sách đầy đủ các trạng thái hoạt động:
  - Bổ sung: `REGISTERED`, `PENDING`, `BM01_RESUBMITTED`, `BM02_OPEN`, `BM02_APPROVED`, `BM02_REVISION_REQUIRED`, `BM02_EXCEPTION_REVIEW`, `DEFENSE_ELIGIBLE`, `ELIGIBLE_BY_INSTITUTE`, `STOP_REVIEW_PENDING`, `PENDING_INSTITUTE_SIGNATURE`, `ARCHIVE_INCOMPLETE`, `ARCHIVE_REJECTED`.
- [ ] **Step 2.3**: Sửa [evaluationController.js](file:///d:/DACN/backend/src/controllers/evaluationController.js#L400-L416):
  - Dùng `where.AND = conditions` kết hợp phạm vi giảng viên và `councilId`, không ghi đè `where.OR`.
- [ ] **Step 2.4**: Sửa [bm03Controller.js](file:///d:/DACN/backend/src/controllers/bm03Controller.js#L45-L55) và [bm04Controller.js](file:///d:/DACN/backend/src/controllers/bm04Controller.js#L45-L55):
  - Bổ sung guard kiểm tra: Người gọi phải là sinh viên đề tài, GVHD đề tài, thành viên hội đồng được phân công, hoặc người dùng có quyền quản trị/giám sát (`VIEW_PROJECT_OVERSIGHT`, `BM03_STOP_REVIEW`, `BM04_REVIEW`).
- [ ] **Step 2.5**: Sửa [GradingPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/GradingPage.jsx#L175):
  - Thay thế tham chiếu không tồn tại `onRefreshParent={fetchDefenseData}` bằng hàm refetch chính xác của trang.
- [ ] **Step 2.6**: Chạy test `mentorOwnershipAndGradingScope.test.js` và xác nhận PASS.

---

### Task 3: Worker 3 — Sinh Viên & Đề Tài (Che Điểm, IDOR BM02-A & UI)
**Mục tiêu:** Che giấu điểm bảo vệ chưa công bố trong API đăng ký & Dashboard, chặn IDOR đọc đổi tên đề tài BM02-A, và sửa các lỗi `ReferenceError` trên giao diện sinh viên.

**Files:**
- Modify: `backend/src/controllers/registrationController.js:490-512`
- Modify: `backend/src/controllers/dashboardController.js:615-630, 810-835`
- Modify: `backend/src/routes/bm02aRoutes.js:53-70`
- Modify: `backend/src/controllers/bm02aController.js:100-140`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx:245-257`
- Modify: `frontend/src/pages/student/GradeViewPage.jsx:105-120, 435-445`
- Test: `backend/tests/integration/studentDefenseResultPrivacy.test.js`

- [ ] **Step 3.1**: Viết test tích hợp `studentDefenseResultPrivacy.test.js`:
  - Gọi `GET /api/registrations/my-registration` và `GET /api/dashboards/student` khi `defenseResult.isPublished = false` $\rightarrow$ Trường `defenseResult` phải là `null` hoặc bị ẩn điểm/nhận xét.
  - Sinh viên A gọi GET request BM02-A của sinh viên B $\rightarrow$ Trả về 403 `FORBIDDEN_RESOURCE`.
- [ ] **Step 3.2**: Sửa [registrationController.js](file:///d:/DACN/backend/src/controllers/registrationController.js#L496-L508):
  - Kiểm tra nếu `registration.defenseResult && !registration.defenseResult.isPublished` $\rightarrow$ Gán `registration.defenseResult = null`.
- [ ] **Step 3.3**: Sửa [dashboardController.js](file:///d:/DACN/backend/src/controllers/dashboardController.js#L824):
  - Áp dụng logic che giấu tương tự trước khi đóng gói đối tượng trả về trong payload dashboard.
- [ ] **Step 3.4**: Sửa [bm02aRoutes.js](file:///d:/DACN/backend/src/routes/bm02aRoutes.js#L53-L69) & [bm02aController.js](file:///d:/DACN/backend/src/controllers/bm02aController.js):
  - Bổ sung kiểm tra quyền sở hữu: Sinh viên chỉ xem được hồ sơ đổi tên của chính mình.
- [ ] **Step 3.5**: Sửa [SubmissionPage.jsx](file:///d:/DACN/frontend/src/pages/student/SubmissionPage.jsx#L251):
  - Xóa dòng `setBm04Record(res.data);` bị lỗi undefined.
- [ ] **Step 3.6**: Sửa [GradeViewPage.jsx](file:///d:/DACN/frontend/src/pages/student/GradeViewPage.jsx#L112,L440):
  - Sửa `onClick={fetchGrades}` $\rightarrow$ `onClick={() => gradesQuery.refetch()}`.
  - Sửa `onSuccess={() => fetchArchive(selectedRegistration.id)}` $\rightarrow$ `onSuccess={() => archiveQuery.refetch()}`.
- [ ] **Step 3.7**: Chạy test `studentDefenseResultPrivacy.test.js` và xác nhận PASS.

---

### Task 4: Worker 4 — Giáo Vụ & Viện Trưởng (Quyết Định, Lưu Chiểu & Menu)
**Mục tiêu:** Mở khóa ban hành quyết định giao đề tài BM02, chặn bypass `COMPLETED` tại bước lưu chiểu, kiểm tra quyền truy cập dossier, đồng bộ `ARCHIVE_ACADEMIC_AFFAIRS_REVIEW`, và sửa menu/link cho Giáo vụ & Viện trưởng.

**Files:**
- Modify: `backend/src/controllers/semesterController.js:435-450`
- Modify: `backend/src/controllers/archiveController.js:320-385, 810-820, 895-920`
- Modify: `backend/src/routes/archiveRoutes.js:200-210`
- Modify: `frontend/src/pages/admin/ProjectOversightPage.jsx:128-135`
- Modify: `frontend/src/config/navigationRegistry.js:175-190`
- Modify: `frontend/src/App.jsx:190-200`
- Test: `backend/tests/integration/decisionIssuanceAndArchiveIntegrity.test.js`

- [ ] **Step 4.1**: Viết test tích hợp `decisionIssuanceAndArchiveIntegrity.test.js`:
  - Ban hành quyết định nhận đúng hồ sơ `BM02_APPROVED`.
  - Nghiệm thu lưu chiểu legacy không được chuyển thẳng sang `COMPLETED` khi chưa có chữ ký Viện trưởng.
  - Người dùng không có thẩm quyền không được đọc Defense Dossier.
- [ ] **Step 4.2**: Sửa [semesterController.js](file:///d:/DACN/backend/src/controllers/semesterController.js#L441):
  - Cập nhật query: `status: { in: ['BM02_SUBMITTED', 'BM02_RESUBMITTED', 'BM02_APPROVED'] }`.
- [ ] **Step 4.3**: Sửa [archiveController.js](file:///d:/DACN/backend/src/controllers/archiveController.js#L363-L373):
  - Loại bỏ việc gán trực tiếp `COMPLETED` tại `reviewArchive`. Hồ sơ sau khi GVHD nghiệm thu đạt sẽ chuyển tiếp sang bước thẩm định lưu chiểu Giáo vụ & ký Viện trưởng.
  - Sửa deep-link tại [L814](file:///d:/DACN/backend/src/controllers/archiveController.js#L814): `referenceUrl: '/lecturer/progress'`.
  - Bổ sung kiểm tra thẩm quyền tại `getDefenseDossier` ([L897](file:///d:/DACN/backend/src/controllers/archiveController.js#L897)).
- [ ] **Step 4.4**: Sửa [ProjectOversightPage.jsx](file:///d:/DACN/frontend/src/pages/admin/ProjectOversightPage.jsx#L131):
  - Thêm quyền `ARCHIVE_ACADEMIC_AFFAIRS_REVIEW` vào `canReviewArchive`.
- [ ] **Step 4.5**: Sửa [navigationRegistry.js](file:///d:/DACN/frontend/src/config/navigationRegistry.js) & [App.jsx](file:///d:/DACN/frontend/src/App.jsx#L193):
  - Cho phép nhóm `GIAO_VU` thấy menu và truy cập route `project-enrollments` (Điều phối & Gán sinh viên).
- [ ] **Step 4.6**: Chạy test `decisionIssuanceAndArchiveIntegrity.test.js` và xác nhận PASS.

---

### Task 5: Tổng Hợp & Kiểm Thử Toàn Diện (QA & Verification)
**Mục tiêu:** Xác minh toàn bộ hệ thống sau khi 4 Worker Subagent hoàn thành.

- [ ] **Step 5.1**: Chạy toàn bộ các bài test mới tạo của 4 Worker:
  `npm --prefix backend test tests/integration/userImportSecurity.test.js tests/integration/mentorOwnershipAndGradingScope.test.js tests/integration/studentDefenseResultPrivacy.test.js tests/integration/decisionIssuanceAndArchiveIntegrity.test.js`
- [ ] **Step 5.2**: Chạy kiểm tra build production của Frontend:
  `npm --prefix frontend run build`
- [ ] **Step 5.3**: Kiểm tra git status, đảm bảo tất cả các file chỉnh sửa đều tuân thủ UTF-8 without BOM và không có file nào bị xung đột.
- [ ] **Step 5.4**: Cập nhật mục `Session Update` trong [CLAUDE.md](file:///d:/DACN/CLAUDE.md) và tạo commit hoàn tất phiên.
