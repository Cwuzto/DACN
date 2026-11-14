# Thiết Kế Hệ Thống Biểu Mẫu Học Thuật A4 & Ngăn Kéo Hồ Sơ Toàn Trình (Academic Forms A4 & Dossier Hub)

- **Ngày ban hành**: 14/11/2026
- **Trạng thái**: Chờ duyệt (Pending Approval)
- **Tài liệu căn cứ**: 5 tệp biểu mẫu thực tế tại thư mục `d:\DACN\BieuMau` (`BM01.docx`, `BM02.docx`, `BM02-A.docx`, `BM03.docx`, `BM04.docx`) và mẫu `BM05` đã triển khai.

---

## 1. Bối cảnh & Mục đích (Intent & The Why)

Hệ thống Quản lý Khóa luận Tốt nghiệp của Viện Công nghệ Số (Trường Đại học Thủ Dầu Một) đã số hóa toàn trình 6 giai đoạn học vụ với các quy định nghiệp vụ nghiêm ngặt (1 sinh viên / 1 đề tài, SLA 168 giờ, quy trình duyệt 2 bước, khóa điểm 2 lớp). 

Tuy nhiên, trong thực tế quản lý đào tạo đại học, việc in ấn văn bản hành chính theo đúng thể thức chuẩn của Bộ GD&ĐT và Nhà trường để:
1. Sinh viên và Giảng viên ký tươi lưu hồ sơ bản cứng khi nộp báo cáo.
2. Phục vụ công tác thanh tra, kiểm định chất lượng chương trình đào tạo (AUN-QA / MOET).
3. Cho phép Ban Chủ nhiệm Viện và Giáo vụ tra cứu, kiểm tra đối soát trọn bộ hồ sơ từ BM01 đến BM05 của bất kỳ sinh viên nào chỉ qua một cú nhấp chuột.

Hiện tại, hệ thống mới chỉ có BM05 (Biên bản họp hội đồng) có bản in A4, các biểu mẫu còn lại (BM01, BM02, BM02-A, BM03, BM04) vẫn ở dạng form nhập liệu phân tán, chưa có định dạng in A4 chuẩn hành chính. Dự án này nhằm chuẩn hóa toàn bộ các biểu mẫu trên thành các bản in A4 tiêu chuẩn và tích hợp vào Ngăn kéo Hồ sơ Toàn trình (Academic Dossier Hub).

---

## 2. Mục tiêu, Giới hạn & Chống mục tiêu (Goals, Non-Goals, Anti-Goals)

### 2.1. Mục tiêu (Goals)
1. **Chuẩn hóa thể thức A4 hành chính**:
   - Tái hiện chính xác 100% bố cục từ các tệp mẫu Word gốc (`d:\DACN\BieuMau`): Tiêu ngữ, Tên trường/Viện/Bộ môn, Bảng biểu, Tiêu chí đánh giá, và Khối chữ ký.
   - Định dạng chuẩn in ấn: Khổ A4 dọc (`210mm x 297mm`), phông chữ `Times New Roman`, cỡ chữ 12–13pt, ngắt trang thông minh (`page-break-inside: avoid`).
   - Tự động điền dữ liệu thực tế từ cơ sở dữ liệu (tên đề tài, thông tin sinh viên, GVHD, nhận xét, điểm số, trạng thái duyệt).
2. **Hỗ trợ in tại chỗ theo ngữ cảnh (Contextual In-place Print)**:
   - Thêm nút xem và in A4 trực tiếp tại các modal nghiệp vụ:
     - `SubmissionPage.jsx`: In BM01, BM02, BM03 cho sinh viên.
     - `TitleAdjustmentModal.jsx`: In BM02-A đơn đề nghị đổi tên đề tài.
     - `BM04EvaluationModal.jsx`: In BM04 phiếu nhận xét của GVHD & Giảng viên phản biện.
3. **Trung tâm Hồ sơ Học vụ Toàn trình (Academic Dossier Hub)**:
   - Xây dựng component `AcademicDossierDrawer.jsx` tập trung.
   - Tích hợp vào dòng sinh viên tại `GradingDefensePage.jsx` (Sổ điểm), `ProjectOversightPage.jsx` (Giám sát học vụ), `LecturerDashboardPage.jsx` (Sinh viên hướng dẫn).
   - Cho phép duyệt qua các Tab BM01 $\to$ BM05 và in lẻ từng biểu mẫu hoặc in liên tục toàn bộ hồ sơ.

### 2.2. Giới hạn ngoài phạm vi (Non-Goals)
- Không thay đổi cấu trúc bảng biểu CSDL Prisma hiện tại (sử dụng dữ liệu sẵn có của `BM01Evaluation`, `BM02Submission`, `BM02AAdjustmentRequest`, `BM03ProgressRecord`, `BM04Evaluation`, `DefenseEvaluationScoreSheet`).
- Không cài đặt các thư viện tạo PDF nặng (như `jspdf`, `pdfmake`, `html2canvas`) nhằm tránh phình to bundle frontend (>500kB) và xung đột React 19. Hệ thống sử dụng cơ chế in chuẩn trình duyệt CSS `@media print` + `window.print()` (hỗ trợ in ra máy in hoặc Lưu dưới dạng PDF - "Save as PDF" gốc siêu nét).

### 2.3. Chống mục tiêu (Anti-Goals)
- Không hardcode dữ liệu giả (mock data). Biểu mẫu nào chưa nộp/chưa chấm sẽ hiển thị trạng thái placeholder ("Chưa khởi tạo / Đang thực hiện") thay vì tự bịa dữ liệu.
- Tuyệt đối không chèn emoji hoặc ký tự thô vào nhãn nút in/xem biểu mẫu (tuân thủ nghiêm ngặt Quy chuẩn UI/UX `AGENTS.md` Rule 2.6).

---

## 3. Các Phương Án Đã Cân Nhắc & Lựa Chọn (Approaches & Decision)

| Phương án | Mô tả | Đánh đổi (Trade-offs) | Kết luận |
| :--- | :--- | :--- | :--- |
| **1. In phân tán tại chỗ (Contextual Only)** | Chỉ gắn nút in A4 tại từng modal nộp/chấm bài riêng lẻ. | Tiện khi đang làm việc nhưng Giáo vụ không thể xem tổng hợp trọn bộ hồ sơ của sinh viên. | Bị loại |
| **2. Chỉ làm ngăn kéo hồ sơ tập trung (Dossier Only)** | Chỉ tạo 1 Drawer xem trọn bộ BM01 $\to$ BM05 ở trang Quản trị. | Quy củ nhưng bất tiện cho Giảng viên/Sinh viên muốn in nhanh phiếu vừa chấm xong. | Bị loại |
| **3. Mô hình Lai Hợp nhất (Hybrid Hub + In-place Action)** | Xây dựng bộ Sheet in tái sử dụng; gắn nút in nhanh tại modal nghiệp vụ, đồng thời gắn Ngăn kéo Hồ sơ Toàn trình tại các bảng quản lý. | Tốn thêm một chút thời gian tích hợp nhưng mang lại trải nghiệm toàn diện nhất cho cả 3 vai trò. | **ĐƯỢC CHỌN ⭐** (Người dùng đã xác nhận) |

---

## 4. Đặc Tả Chi Tiết Từng Biểu Mẫu (Form Layout Specifications)

### 4.1. Khung chứa trang in dùng chung (`A4PageContainer.jsx`)
- Khổ giấy: Chiều rộng `210mm`, chiều cao tối thiểu `297mm`, viền bóng nhẹ khi xem trên màn hình (`box-shadow`), bỏ viền và viền căn lề khi in (`@media print`).
- Lề trang in: Trên 20mm, Dưới 20mm, Trái 30mm (chuẩn đóng gáy), Phải 15mm.
- Phông chữ: `font-family: 'Times New Roman', Times, serif`, kích cỡ tiêu chuẩn `12pt` / `13pt`, giãn dòng `1.35`.

### 4.2. BM01: Đề cương đề tài báo cáo tốt nghiệp (`BM01PrintSheet.jsx`)
- **Phần đầu**:
  - Trái: TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT / VIỆN CÔNG NGHỆ SỐ.
  - Phải: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM / Độc lập - Tự do - Hạnh phúc.
  - Dòng ngày tháng: *TP.HCM/Bình Dương, ngày ... tháng ... năm ...*
- **Tiêu đề**: **ĐỀ CƯƠNG ĐỀ TÀI BÁO CÁO TỐT NGHIỆP** (In hoa, đậm, căn giữa).
- **Mục 1**: Thông tin sinh viên (Họ tên, MSSV, Lớp, Khóa, SĐT, Giảng viên hướng dẫn).
- **Mục 2**: Tên đề tài đăng ký.
- **Mục 3**: Mục tiêu nghiên cứu (Mục tiêu chung, Mục tiêu cụ thể).
- **Mục 4**: Nội dung và phạm vi nghiên cứu.
- **Mục 5**: Phương pháp nghiên cứu.
- **Mục 6**: Bảng kế hoạch thực hiện theo tuần (Tuần, Thời gian, Nội dung công việc, Sản phẩm dự kiến).
- **Mục 7**: Kết quả dự kiến đạt được.
- **Khối chữ ký (3 cột)**:
  - Cột 1: GIẢNG VIÊN HƯỚNG DẪN (Ký và ghi rõ họ tên).
  - Cột 2: PHỤ TRÁCH BỘ MÔN / BAN CHỦ NHIỆM VIỆN (Ký và ghi rõ họ tên).
  - Cột 3: SINH VIÊN THỰC HIỆN (Ký và ghi rõ họ tên).

### 4.3. BM02: Phiếu đăng ký đề tài / Giao nhiệm vụ (`BM02PrintSheet.jsx`)
- **Phần đầu**: VIỆN CÔNG NGHỆ SỐ - BỘ MÔN CÔNG NGHỆ THÔNG TIN.
- **Tiêu đề**: **PHIẾU ĐĂNG KÝ ĐỀ TÀI** (In hoa, đậm, căn giữa).
- **Thông tin sinh viên**: Họ tên, MSSV, Ngày tháng năm sinh, Nơi sinh, Lớp, Khóa, Chuyên ngành.
- **Nội dung giao**: Tên đề tài đăng ký, Giảng viên hướng dẫn đề nghị.
- **Khối chữ ký (3 cột)**: GIẢNG VIÊN HƯỚNG DẪN - SINH VIÊN ĐĂNG KÝ - PHỤ TRÁCH BỘ MÔN.

### 4.4. BM02-A: Phiếu đề nghị điều chỉnh tên đề tài (`BM02APrintSheet.jsx`)
- **Phần đầu**: KHOA/VIỆN CÔNG NGHỆ SỐ - CHƯƠNG TRÌNH ĐÀO TẠO.
- **Tiêu đề**: **PHIẾU ĐỀ NGHỊ ĐIỀU CHỈNH TÊN ĐỀ TÀI** (In hoa, đậm, căn giữa).
- **Thông tin sinh viên**: Họ tên, MSSV, Ngày sinh, Nơi sinh, Lớp, Khóa, Chuyên ngành.
- **Bảng đối chiếu điều chỉnh**:
  - Tên đề tài đã đăng ký (Tên cũ theo Quyết định giao ban đầu).
  - Tên đề tài xin điều chỉnh (Tên mới đề xuất).
  - Lý do điều chỉnh chi tiết.
- **Khối chữ ký (3 cột)**: GIẢNG VIÊN HƯỚNG DẪN - SINH VIÊN ĐĂNG KÝ - PHỤ TRÁCH BỘ MÔN.

### 4.5. BM03: Phiếu theo dõi tiến độ thực hiện đồ án (`BM03PrintSheet.jsx`)
- **Phần đầu**: TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT - VIỆN CÔNG NGHỆ SỐ - BỘ MÔN CNTT.
- **Tiêu đề**: **PHIẾU THEO DÕI TIẾN ĐỘ THỰC HIỆN BÁO CÁO TỐT NGHIỆP** (In hoa, đậm, căn giữa).
- **Thông tin sinh viên & đề tài**: Họ tên, MSSV, Lớp, Điện thoại, Email, Tên đề tài.
- **Bảng nhật ký tuần**:
  - Cột: Tuần thứ | Ngày | Kế hoạch thực hiện | Nhận xét của CBHD (Ký tên).
  - Khung Checkpoint 1 & Checkpoint 2 chèn giữa các tuần:
    * Ô đánh giá: *Được tiếp tục ◻ / Không tiếp tục ◻*
    * Ngày kiểm tra và chữ ký xác nhận của CBHD.
- **Đánh giá tổng thể cuối kỳ & Chữ ký của GVHD**.

### 4.6. BM04: Phiếu nhận xét đồ án tốt nghiệp (`BM04PrintSheet.jsx`)
- **Phần đầu**: VIỆN CÔNG NGHỆ SỐ - CHƯƠNG TRÌNH ĐÀO TẠO.
- **Tiêu đề**: **PHIẾU NHẬN XÉT**
  - Phụ đề: *(Dành cho Giảng viên hướng dẫn)* hoặc *(Dành cho Giảng viên phản biện)* dựa theo thuộc tính `evaluatorRole`.
- **Phần I. Thông tin chung**: Họ tên sinh viên, MSSV, Lớp, Tên đề tài.
- **Phần II. Nội dung nhận xét (4 tiêu chí CĐR)**:
  - Tiêu chí 1: Hình thức đáp ứng yêu cầu của Báo cáo tốt nghiệp (điểm & nhận xét).
  - Tiêu chí 2: Nội dung nghiên cứu (Tổng quan, PP, kết quả đạt được).
  - Tiêu chí 3: Tính ứng dụng và triển vọng của đề tài.
  - Tiêu chí 4: Đánh giá thái độ và ý thức làm việc của sinh viên.
- **Phần III. Kết luận**:
  - Kết luận 1: Đáp ứng chuẩn đầu ra CTĐT (*Đáp ứng ◻ / Không đáp ứng ◻*).
  - Kết luận 2: Ý kiến bảo vệ (*Đồng ý cho bảo vệ ◻ / Không đồng ý ◻*).
- **Khối chữ ký**: NGƯỜI NHẬN XÉT (Ký và ghi rõ họ tên).

### 4.7. BM05: Biên bản họp hội đồng chấm bảo vệ (`BM05PrintSheet.jsx`)
- Tái cấu trúc từ `DefenseSummaryRecordModal.jsx` thành component sheet độc lập để nhúng vào cả `DefenseSummaryRecordModal` và `AcademicDossierDrawer`.

---

## 5. Kiến Trúc Frontend & Các Điểm Tích Hợp (Architecture & Integration Points)

### 5.1. Cấu trúc thư mục mới:
```
frontend/src/components/prints/
├── A4PageContainer.jsx           # Khung bao CSS A4 chuẩn in ấn
├── AcademicFormPrintModal.jsx    # Modal xem trước và in A4 dùng chung
├── BM01PrintSheet.jsx            # Bản in BM01 Đề cương
├── BM02PrintSheet.jsx            # Bản in BM02 Giao nhiệm vụ
├── BM02APrintSheet.jsx           # Bản in BM02-A Đổi tên đề tài
├── BM03PrintSheet.jsx            # Bản in BM03 Sổ tiến độ & Checkpoint
├── BM04PrintSheet.jsx            # Bản in BM04 Phiếu nhận xét (GVHD/GVPB)
├── BM05PrintSheet.jsx            # Bản in BM05 Biên bản hội đồng bảo vệ
└── AcademicDossierDrawer.jsx     # Ngăn kéo tra cứu trọn bộ hồ sơ sinh viên
```

### 5.2. Các điểm tích hợp nút bấm:
1. **`frontend/src/pages/student/SubmissionPage.jsx`**:
   - Thêm nút `<Button icon={<PrinterOutlined />}>In BM01</Button>` khi đề cương đã nộp/duyệt.
   - Thêm nút `<Button icon={<PrinterOutlined />}>In BM02</Button>` khi nhiệm vụ đã duyệt.
   - Thêm nút `<Button icon={<PrinterOutlined />}>In BM03</Button>` khi có tiến độ.
2. **`frontend/src/components/student/TitleAdjustmentModal.jsx`**:
   - Thêm nút `<Button icon={<PrinterOutlined />}>In Đơn BM02-A</Button>`.
3. **`frontend/src/components/lecturer/BM04EvaluationModal.jsx`**:
   - Thêm nút `<Button icon={<PrinterOutlined />}>Xem & In Phiếu BM04</Button>`.
4. **`frontend/src/pages/admin/GradingDefensePage.jsx` & `ProjectOversightPage.jsx`**:
   - Thêm nút `<Button icon={<FolderOpenOutlined />}>Hồ sơ BM</Button>` tại từng hàng sinh viên để mở `AcademicDossierDrawer.jsx`.

---

## 6. Phân Công & Những Việc Dành Cho Builder (What's Left to the Builder)

- **Căn chỉnh CSS in ấn**: Đảm bảo các thuộc tính `@page { size: A4 portrait; margin: 0; }` và `@media print` hoạt động đồng nhất trên cả Chrome, Edge, Firefox.
- **Xử lý giá trị trống (Empty Fallbacks)**: Khi một trường thông tin chưa có dữ liệu (ví dụ đề tài chưa có nhận xét phản biện), in ra đường chấm gạch `................................` đúng chuẩn biểu mẫu giấy hành chính.
- **Unit & Contract Testing**:
  - Viết bộ kiểm thử `academicFormsPrint.test.js` kiểm tra không có BOM (Rule 2.4), không có emoji trong nút bấm (Rule 2.6).
  - Kiểm tra các prop dữ liệu truyền vào từng PrintSheet hiển thị đầy đủ thông tin.

