# Báo Cáo Kiểm Toán Chất Lượng Giao Diện & Mã Nguồn Frontend (UI Quality & Code Audit Report)

- **Ngày kiểm toán**: 09/11/2026
- **Phạm vi kiểm toán**: Toàn bộ thư mục `frontend/src/` (40+ trang, linh kiện, dịch vụ, biểu mẫu)
- **Công cụ kiểm toán**: Tự động hóa bằng Node.js AST scan script, ESLint, Node test runner (`node --test`), Jest và Vite build tool.

---

## 1. Kết Quả Chuẩn Hóa Ngôn Ngữ Giao Diện (UI Copy Modernization)

Qua 4 chặng triển khai theo quy trình Subagent-Driven Development, hệ thống đã chuẩn hóa toàn diện:

| Tiêu chí | Trước khi chuẩn hóa | Sau khi chuẩn hóa | Đánh giá |
| :--- | :--- | :--- | :--- |
| **Tiếng Anh trong ngoặc `(EN)`** | **123 vị trí** (`(APPROVE)`, `(Initial)`, `(Correction)`, `(Quota)`, `(Audit Trail)`,...) | **0 vị trí** trên toàn bộ UI | **Hoàn thành 100%** |
| **Mã số biểu mẫu kỹ thuật** | Xuất hiện dày đặc `BM01`, `BM02`, `BM03`, `BM04` | Chuyển thành tên nghiệp vụ thuần túy: *Đề cương nghiên cứu chi tiết*, *Đơn đăng ký đề tài*, *Nhật ký & Đánh giá tiến độ*, *Phiếu nhận xét của người hướng dẫn* | **Đạt chuẩn học thuật** |
| **Từ ngữ cộc lốc / khô khan** | `Cho BV`, `Bác đơn`, `Hàng đợi Triage`, `Mã Trigger (System Code)` | `Đủ điều kiện bảo vệ`, `Từ chối đề xuất`, `Công việc cần xử lý khẩn`, `Mã kích hoạt sự kiện hệ thống` | **Thân thiện, tự nhiên** |
| **Rò rỉ tên biến kỹ thuật ra UI** | `supersedesApprovalId`, `TERMINATED_FAILED_PROGRESS` | Diễn giải thành câu thông báo hành chính học vụ rõ ràng, không lộ mã nguồn | **Bảo mật & Trực quan** |

---

## 2. Các Bug / Bất Thường Đã Phát Hiện & Khắc Phục Tức Thì

### Bug 1: Lỗi `ReferenceError: getClosestSemester is not defined` trên Trang Chủ (`HomePage.jsx`)
- **Vị trí**: [frontend/src/pages/common/HomePage.jsx](file:///d:/DACN/frontend/src/pages/common/HomePage.jsx#L565)
- **Hiện tượng**: Khi gọi API lấy danh sách học kỳ công khai (`semesterService.getPublic()`), dòng code xử lý chọn học kỳ dự phòng:
  ```javascript
  const chosen = active || getClosestSemester(res.data) || res.data[0];
  ```
  tuy nhiên hàm `getClosestSemester` **chưa từng được import** trong file `HomePage.jsx` (hàm này nằm ở `frontend/src/utils/semesterDisplay.js`).
- **Mức độ rủi ro**: **CRITICAL** — Gây sập trắng trang (White Screen of Death) trên HomePage đối với khách vãng lai nếu không có học kỳ nào đang `ACTIVE`.
- **Hành động xử lý**: Đã bổ sung import `import { getClosestSemester } from '../../utils/semesterDisplay';` và commit `03f7150`. Trang chủ hiện đã hoạt động an toàn tuyệt đối.

---

## 3. Danh Mục Thành Phần Mồ Côi & Mã Nguồn Chưa Sử Dụng (Dead Code)

Trong quá trình rà soát, chúng tôi ghi nhận các thành phần và biến không còn được sử dụng:

### 3.1. Linh Kiện Mồ Côi (Unused Component)
- **`frontend/src/components/forms/BMReviewDrawer.jsx`**:
  - Tệp component này dài 273 dòng code, khai báo một Drawer thẩm định biểu mẫu cũ.
  - Qua rà soát toàn bộ thư mục `frontend/src/`, **không có bất kỳ file nào import hoặc gọi đến `BMReviewDrawer`**.
  - Quy trình nghiệp vụ hiện tại đã sử dụng các modal/drawer chuyên biệt: `OutlineReviewModal.jsx`, `BM02ReviewDrawer.jsx`, `CheckpointIssueModal.jsx`, và `CheckpointAppealReviewModal.jsx`.
  - **Khuyến nghị**: Có thể xóa bỏ tệp này trong phiên dọn dẹp tiếp theo để giảm kích thước bundle.

### 3.2. Biến & State Dư Thừa (Unused Variables & States)
1. **[TopicListPage.jsx](file:///d:/DACN/frontend/src/pages/student/TopicListPage.jsx)**:
   - Các biến/state được gán nhưng không sử dụng: `navigate` (dòng 33), `loading` (dòng 35), `myProjectEnrollments` (dòng 60), `accountRestricted` (dòng 62), `accountRestrictionReason` (dòng 63).
2. **[TopicManagementPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/TopicManagementPage.jsx)**:
   - State `tags`, `setTags` (dòng 39) khai báo nhưng không tham gia render hay logic lọc.
3. **[StudentProgressDetailPanel.jsx](file:///d:/DACN/frontend/src/pages/lecturer/components/StudentProgressDetailPanel.jsx)**:
   - Biến `archiveLoading` (dòng 88) được khai báo nhưng không dùng.
4. **[LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx)**:
   - Hàm `handleCommentChange` (dòng 117) được định nghĩa nhưng form Ant Design đã tự quản lý field value qua `Form.Item`.
5. **[ExcelImportModal.jsx](file:///d:/DACN/frontend/src/components/common/ExcelImportModal.jsx)**:
   - Biến `fileList` (dòng 45) khai báo state nhưng Upload dùng chế độ custom parser `beforeUpload={() => false}`.
6. **[AuthModal.jsx](file:///d:/DACN/frontend/src/components/auth/AuthModal.jsx)**:
   - Hàm `hasPermissionOrGroup` (dòng 5) được import từ `authRedirect.js` nhưng không được gọi.

---

## 4. Các Cảnh Báo Chất Lượng Code & React Hook Linting

Chạy `npm run lint` trên `frontend/` ghi nhận **67 cảnh báo/lỗi linting** sẵn có từ trước. Các nhóm vấn đề chính bao gồm:

### 4.1. Lỗi React 19 Immutability (`react-hooks/immutability`)
- **`HomePage.jsx` (dòng 677)**:
  ```javascript
  const handleOpenAnnouncementDetail = (ann) => {
      setSelectedAnnouncement(ann);
      window.location.hash = 'announcement-' + ann.id; // Vi phạm quy tắc không can thiệp biến bên ngoài hook
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  ```
  - **Khuyến nghị**: Nên chuyển thao tác đồng bộ `window.location.hash` vào một `useEffect` theo dõi `selectedAnnouncement`.

### 4.2. Khuyết Thiếu Dependency Trong React Hooks (`react-hooks/exhaustive-deps`)
- **`MentorTransferModal.jsx` (dòng 25)**: `useEffect` thiếu `fetchLecturers`.
- **`ArchiveSubmissionModal.jsx` (dòng 85)**: `useEffect` thiếu `form`.
- **`HybridBMFormModal.jsx` (dòng 153)**: `useEffect` thiếu `form` và `taskType`.
- **`BMReviewDrawer.jsx` (dòng 43)**: `useEffect` thiếu `form`.
- **`ExcelImportModal.jsx` (dòng 825)**: `useMemo` thiếu `handleOpenEdit`.

### 4.3. Khối Lệnh Bắt Lỗi Rỗng Không Có Log (`no-empty`)
- **[api.js](file:///d:/DACN/frontend/src/services/api.js)** (các dòng 11, 115, 119, 192):
  - Chứa các khối `try { ... } catch (e) {}` rỗng mà không có ghi log cảnh báo (`console.warn`) hoặc giải thích lý do bỏ qua lỗi token/sync.
- **[AppLayout.jsx](file:///d:/DACN/frontend/src/components/layout/AppLayout.jsx)** (các dòng 40, 96):
  - Khối catch rỗng khi parse dữ liệu từ local storage.

---

## 5. Tổng Hợp Kết Quả Kiểm Thử & Nghiệm Thu Hệ Thống

Toàn bộ hệ thống đã được kiểm thử tự động toàn diện:

1. **Frontend Test Suite**:
   - Lệnh: `cd frontend; npm test`
   - Kết quả: **93/93 tests PASS (100%)** trong 0.72 giây.
   - Hợp đồng kiểm thử giao diện (`checkpointAppealUiContracts`, `bm02ReviewUiContracts`, `workflowContracts`) đều tương thích 100% với nhãn mới.
2. **Frontend Production Build**:
   - Lệnh: `cd frontend; npm run build`
   - Kết quả: **PASS (13.72s, 0 lỗi, 3222 modules)**.
3. **Backend Test Suite**:
   - Lệnh: `cd backend; npm test`
   - Kết quả: **66/66 test suites PASS, 499/499 tests PASS (100%)** trong 29.4s.
4. **Định dạng & Chuẩn mã hóa**:
   - 100% tệp tin đã tạo và chỉnh sửa đạt chuẩn **UTF-8 (no BOM)**.
   - Bảo toàn tuyệt đối kiến trúc `TopicRegistration` (`1 SV / 1 Đề tài`, tối đa 10 SV / GVHD).
