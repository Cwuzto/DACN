# Kế Hoạch Đánh Giá & Chuẩn Hóa Nghiệp Vụ Toàn Diện (BA Analysis & Target Roadmap)

Tài liệu này là bản phân tích nghiệp vụ chuyên sâu (Business Analysis - BA) và quy chuẩn kỹ thuật cho hệ thống **Quản lý Đồ án & Khóa luận Tốt nghiệp – Viện Công nghệ Số**. Bản kế hoạch đã được đồng bộ hóa với hiện trạng thực tế của codebase, giải quyết triệt để các lỗ hổng kiến trúc, chuẩn hóa ma trận vòng đời trạng thái hai tầng, làm rõ tính linh hoạt của quy trình (Bypass/Skip), và định nghĩa cơ chế giám sát tiến độ thực tế khi Giảng viên meeting trực tiếp với Sinh viên.

---

## 1. Đánh Giá Tổng Quan & Hiện Trạng Thực Tế (Executive Summary & Reality Sync)

### 1.1. Các Trụ Cột Nghiệp Vụ Đã Hoàn Thành (100% Production-Ready)
- [x] **Ưu tiên 1 (P0) - Cổng Thông Tin & Quản Lý Thông Báo**: Trang chủ công khai chuẩn Swiss Modernism (`HomePage.jsx`), tích hợp module tin tức / thông báo phân loại theo đối tượng (`AnnouncementManagementPage.jsx`, `public_announcements`).
- [x] **Ưu tiên 2 (P0) - Luồng Biểu Mẫu Hybrid BM01 - BM04**:
  - Kiến trúc Hybrid Form: Lưu song song dữ liệu JSON có cấu trúc (phục vụ tự động kiểm tra rule) và file đính kèm/scan có chữ ký (đảm bảo tính pháp lý).
  - Hoàn thiện trọn bộ UI/UX cho Sinh viên nộp biểu mẫu (`SubmissionPage.jsx`, `HybridBMFormModal.jsx`) và Giảng viên hướng dẫn duyệt/góp ý (`ProgressTrackingPage.jsx`, `BMReviewDrawer.jsx`).
- [x] **Ưu tiên 3 (P0) - Phân Loại Hội Đồng & Chấm Điểm Độc Lập 3 Thành Viên**:
  - Giao diện Admin phân công hội đồng phân loại (`OUTLINE_REVIEW` và `DEFENSE_COUNCIL`), tự động loại trừ GVHD khỏi hội đồng để chống xung đột lợi ích (`CouncilAssignmentPage.jsx`).
  - Cơ chế Gatekeeping BM04: Bắt buộc GVHD duyệt "ĐỒNG Ý" tại BM04 mới được phép xếp vào Hội đồng bảo vệ.
  - Phiếu chấm điểm độc lập 3 thành viên (`DefenseMemberScore`), tự động tính điểm trung bình cộng và chức năng khóa sổ điểm (`GradingPage.jsx`, `GradeViewPage.jsx`).
- [x] **Ưu tiên 4 (P1) - Quản Trị Người Dùng & Import/Export Excel**:
  - Module tiện ích tạo file mẫu Excel chuẩn hóa cho Sinh viên, Giảng viên, và Gán môn đồ án (`excelHelper.js`).
  - Modal kéo thả file, phân tích client-side tức thì, kiểm tra lỗi và preview trực quan (`ExcelImportModal.jsx`).
  - Tự động mã hóa mật khẩu mặc định bằng `bcrypt` theo mã số, hỗ trợ xử lý trùng lặp (`SKIP`/`UPDATE`) và phân bổ đợt import (`importBatchId`).
  - Chức năng xuất dữ liệu người dùng và danh sách gán đồ án ra file `.xlsx` (`UserManagementPage.jsx`, `ProjectEnrollmentPage.jsx`).

---

## 2. Tính Linh Hoạt Của Quy Trình End-to-End: Cho Phép "Skip" Các Giai Đoạn Trực Tiếp

### 2.1. Phân định Chốt chặn Cứng (Hard Gates) vs Chốt chặn Mềm (Soft Gates)

1. **Chốt chặn Mềm (Soft/Configurable Gates - Cho phép Bypass/Skip)**:
   - **Giai đoạn Đăng ký đề tài**: Đề tài do Doanh nghiệp hoặc Khoa phân bổ sẵn kèm bản đặc tả nhiệm vụ $\rightarrow$ Admin import danh sách là kích hoạt thẳng trạng thái làm đồ án, bỏ qua bước đăng ký/chờ duyệt.

2. **Chốt chặn Cứng (Hard Gates - Bắt buộc pháp lý, không được Skip)**:
   - **BM04 (Thẩm định trước bảo vệ của GVHD)**: Bắt buộc GVHD xác nhận ĐỒNG Ý thì hệ thống mới mở khóa cho phép xếp vào Hội đồng bảo vệ.
   - **DEFENSE_COUNCIL (Hội đồng bảo vệ)**: 3 thành viên chấm điểm độc lập ra điểm trung bình cộng.
   - **Nộp lưu chiểu (Archive Submission)**: Bắt buộc nộp bản PDF hoàn thiện và source code để đủ điều kiện xét tốt nghiệp.

---

## 3. Đánh Giá Khâu Theo Dõi Tiến Độ (BM03): Khi GV & SV Meeting Trực Tiếp Ngoài Đời

### 3.1. Phân tích Nghịch lý Thực tế (The Real-World Paradox)
- **Thực tế giảng đường**: Giảng viên và sinh viên thường gặp nhau trực tiếp ngoài đời (tại phòng Lab, văn phòng bộ môn) hoặc qua Google Meet / Zoom định kỳ hàng tuần.
- **Bất cập của mô hình cũ**: Nếu hệ thống bắt sinh viên tuần nào cũng phải lên web nộp form báo cáo cồng kềnh và ép giảng viên phải chấm từng tuần, thì **cả thầy và trò đều lười**, dẫn đến việc họ gặp nhau ngoài đời nhưng bỏ mặc hệ thống, đến cuối kỳ mới nộp dồn một lần để "chống chế" mở khóa BM04.
- **Nếu BM03 chỉ là 1 Task đơn lẻ (như hiện tại)**: Nộp ở tuần 4 thì suốt từ tuần 5 đến tuần 12 hệ thống hoàn toàn "mù thông tin", không biết thầy trò có tiếp tục làm việc hay không.

### 3.2. Mô Hình Giám Sát 3 Tầng Thực Tế (Real-World Supervision Architecture)
Hệ thống **không thay thế** buổi gặp trực tiếp, mà đóng vai trò là **SỔ NHẬT KÝ HỌC VỤ SỐ (Digital Supervision Log)** và **RADAR CẢNH BÁO SỚM (Early Warning Radar)** cho Ban Chủ nhiệm Viện:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   MÔ HÌNH GIÁM SÁT TIẾN ĐỘ THỰC TẾ (BM03 REAL-WORLD)                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 1: NHẬT KÝ BUỔI GẶP (Lightweight Meeting Log / Check-in)                          │
│   • GVHD: Nhập tóm tắt các ý sau buổi gặp (Ngày, các phần sinh viên đã làm, ghi chú)   │ 
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 2: HAI MỐC CHỐT CHẶN PHÁP LÝ (Checkpoint 1 - Tuần 6 & Checkpoint 2 - Tuần 11)     │
│   • Dùng Form BM03 chính thức: GVHD chốt % Khối lượng + Kết luận:                      │
│     ĐẠT (PASSED) / CẢNH BÁO (WARNING) / ĐÌNH CHỈ (FAILED_PROGRESS)                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TẦNG 3: RADAR GIÁM SÁT CHO BAN CHỦ NHIỆM VIỆN (Admin Early Warning & Health Radar)     │
│   • Cảnh báo tự động: "Sinh viên X đã quá 3 tuần không có nhật ký gặp GVHD"            │
│   • Cảnh báo rủi ro: Lọc danh sách SV có nguy cơ bỏ đồ án để giáo vụ can thiệp sớm     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3. Vận hành chi tiết từng tầng:
1. **Tầng 1 - Nhật ký gặp gỡ tinh gọn (Meeting Log)**:
   - **GVHD nhập**:
     - *Ngày họp*: Trực tiếp tại Lab / Văn phòng / Google Meet.
     - *các phần sinh viên đã làm*: Đã báo cáo nội dung gì, Việc cần làm sắp tới.
     - *Ghi chú*: GVHD góp ý gì.
2. **Tầng 2 - Hai mốc Checkpoint pháp lý (Tuần 6 & Tuần 11)**:
   - Đến giữa kỳ và trước ngày nộp quyển, hệ thống kích hoạt 2 đợt Checkpoint chính thức.
   - GVHD đánh giá: % Khối lượng hoàn thành và Kết luận có đủ điều kiện tiếp tục hay không.
3. **Tầng 3 - Radar giám sát & Trích xuất tự động vào BM04**:
   - Viện giám sát qua Dashboard: Thống kê "Lần gặp gần nhất" (ví dụ: *Gặp cách đây 3 ngày* $\rightarrow$ Xanh lá; *Chưa gặp > 21 ngày* $\rightarrow$ Báo đỏ).
   - Khi GV lập phiếu BM04 cho ra bảo vệ, hệ thống **tự động trích xuất minh chứng**:  
     *“Tổng số buổi làm việc định kỳ đã ghi nhận: 8 buổi (6 buổi tại Lab, 2 buổi online). Đạt 2/2 mốc Checkpoint tiến độ.”*  
     $\rightarrow$ Minh chứng khách quan, thuyết phục Hội đồng chấm bảo vệ.

---

## 4. Phân Tích Các Lỗ Hổng Nghiệp Vụ Cốt Lõi & Giải Pháp Kiến Trúc

### 4.1. Lỗ hổng Cấu Trúc Hội Đồng Hai Chặng (Two-Stage Council Schema Gap)
- **Vấn đề**: Trong một học kỳ, sinh viên trải qua 2 hội đồng độc lập:
  1. Hội đồng xét duyệt đề cương (`OUTLINE_REVIEW`) ở Giai đoạn 2.
  2. Hội đồng chấm bảo vệ khóa luận (`DEFENSE_COUNCIL`) ở Giai đoạn 5.
  Hiện tại `TopicRegistration` chỉ có một trường `councilId Int?`, nếu gán Hội đồng bảo vệ sẽ ghi đè mất lịch sử của Hội đồng đề cương.
- **Giải pháp dứt điểm**:
  - Tách trong `TopicRegistration` thành hai trường quan hệ độc lập:
    - `outlineCouncilId Int?`: Hội đồng xét duyệt đề cương (BM01).
    - `defenseCouncilId Int?`: Hội đồng chấm bảo vệ tốt nghiệp (BM04 $\rightarrow$ Chấm điểm).
  - Bổ sung trường đánh giá đề cương trực tiếp trên `TopicRegistration`:
    - `outlineReviewStatus` (`PENDING`, `PASSED`, `REVISION_REQUIRED`, `FAILED`).
    - `outlineFeedback String?` (Ý kiến đóng góp / biên bản tóm tắt của Hội đồng đề cương).
  - Giữ nguyên `DefenseResult` và `DefenseMemberScore` chuyên phục vụ chặng bảo vệ tốt nghiệp cuối cùng.

### 4.2. Kiến Trúc Trạng Thái Hai Tầng (Two-Tier State Machine)
Tránh hiện tượng bùng nổ trạng thái (State Explosion) bằng cách tách biệt:

```mermaid
graph TD
    subgraph Tầng 1: Vòng Đời Tổng Thể (TopicRegistration.status)
        S1[PENDING] -->|GVHD Chấp thuận| S2[APPROVED]
        S2 -->|Bước vào thực hiện| S3[IN_PROGRESS]
        S3 -->|GVHD duyệt BM04| S4[READY_FOR_DEFENSE / SUBMITTED]
        S4 -->|Xếp HĐ DEFENSE_COUNCIL| S5[DEFENDING]
        S5 -->|Điểm TB >= 5.0 & Nộp Lưu chiểu| S6[COMPLETED]
        S1 -->|GVHD từ chối| R1[REJECTED]
        S3 -->|Vi phạm Checkpoint| R2[FAILED_PROGRESS]
        S3 -->|GVHD từ chối BM04 / SV dừng| R3[DROPPED]
    end

    subgraph Tầng 2: Trạng Thái Biểu Mẫu / Nhiệm Vụ (TaskStatus & SubmissionStatus)
        BM01[BM01 Đề Cương: OPEN / SUBMITTED / REVISION / COMPLETED]
        BM02[BM02 Giao Nhiệm Vụ: OPEN / SUBMITTED / COMPLETED]
        BM03[BM03 Checkpoint 1 & 2 + Meeting Logs: IN_PROGRESS / PASSED / FAILED]
        BM04[BM04 Ý Kiến GVHD: OPEN / APPROVED 'Đồng ý' / REJECTED 'Không đồng ý']
    end
```

---

## 5. Quy Chế Định Lượng Cho Các Kịch Bản Ngoại Lệ (Concrete Unhappy Policies)

### 5.1. Chặng 1 - Đề Cương Chi Tiết (BM01)
- **Quy tắc chỉnh sửa**: Sinh viên được nộp lại và chỉnh sửa đề cương tối đa **02 lần** nếu Hội đồng / GVHD yêu cầu sửa đổi (`REVISION_REQUIRED`).
- **Thời hạn khắc phục**: Tối đa 07 ngày làm việc kể từ ngày nhận góp ý.
- **Xử lý nếu không đạt**: Nếu sau 02 lần chỉnh sửa vẫn bị đánh giá `FAILED` $\rightarrow$ Hủy lượt đăng ký hiện tại (`status = REJECTED`), sinh viên không được tính vào học kỳ này và phải đăng ký lại môn đồ án ở kỳ tiếp theo.

### 5.2. Chặng 2 - Đánh Giá Tiến Độ Giữa Kỳ (BM03 Checkpoint 1 & 2)
- **Checkpoint 1 (Tuần 5 - 6)** & **Checkpoint 2 (Tuần 9 - 10)**.
- **Xử lý vi phạm tiến độ**:
  - Sinh viên vắng mặt cả 2 đợt checkpoint không có lý do chính đáng hoặc khối lượng công việc hoàn thành $< 40\%$.
  - GVHD có quyền đánh giá `FAILED` tại BM03 và gửi đề xuất đình chỉ đồ án về Ban Quản Trị Viện.
  - Ban Quản Trị Viện phê duyệt $\rightarrow$ Chuyển trạng thái `TopicRegistration.status = FAILED_PROGRESS`, khóa tài khoản làm đồ án trong học kỳ này.

### 5.3. Chặng 3 - Thẩm Định Cho Ra Bảo Vệ (BM04)
- **Quy tắc Gatekeeping**: GVHD bắt buộc ký nhận xét và chọn 1 trong 2 phương án:
  - **ĐỒNG Ý cho ra bảo vệ**: Hệ thống chuyển `status = SUBMITTED` (hoặc `READY_FOR_DEFENSE`) $\rightarrow$ Mở khóa cho Admin xếp vào `DEFENSE_COUNCIL`.
  - **KHÔNG ĐỒNG Ý cho ra bảo vệ**: Hệ thống tự động chuyển `status = DROPPED` (hoặc `INELIGIBLE_FOR_DEFENSE`), khóa vĩnh viễn nút gán Hội đồng bảo vệ cho sinh viên này trong đợt này.

### 5.4. Chặng 4 - Xử Lý Lệch Điểm Hội Đồng (Score Discrepancy Policy)
- Sau khi 3 thành viên hội đồng nhập điểm:
  - Hệ thống tự động tính độ lệch lớn nhất giữa 3 điểm thành phần: $\Delta = \max(Score_i) - \min(Score_i)$.
  - **Nếu $\Delta \ge 2.0$ điểm**: Hệ thống hiển thị cảnh báo màu hổ phách yêu cầu Chủ tịch hội đồng chủ trì hội ý thống nhất điểm trước khi khóa sổ.
  - Sau khi hội ý, các thành viên có quyền cập nhật lại điểm nếu chưa bị khóa (`isLocked = false`). Khi Chủ tịch bấm "Khóa sổ điểm" (`lockScore`), toàn bộ điểm số trở thành bất biến.

---

## 6. Quy Trình Nộp Lưu Chiểu & Nghiệm Thu Sau Bảo Vệ (Post-Defense & Archive Workflow)

Sau khi Hội đồng bảo vệ khóa sổ điểm và sinh viên đạt kết quả (Điểm trung bình cộng $\ge 5.0$):

1. **Sinh viên nộp hồ sơ lưu chiểu** trên hệ thống:
   - **Bản DOCS, PDF**: Đã chỉnh sửa toàn diện theo biên bản góp ý của Hội đồng.
   - **Bản PPTX**: Bản trình bày mà SV trình bày ở buổi bảo vệ.
   - **Bản Video Demo (MP4)**: Video trình bày sản phẩm của SV trong buổi bảo vệ (không quá 10 phút)
   - **Bản biểu mẫu**: BM03 BM04
   - **Link Source Code & Sản phẩm**: Link kho mã nguồn (GitHub/GitLab/Bitbucket) kèm hướng dẫn cài đặt và link video demo.
2. **Nghiệm thu hồ sơ**:
   - GVHD hoặc Thư ký Hội đồng kiểm tra các hạng mục nộp.
   - Bấm nút **"Nghiệm thu lưu chiểu"** trên hệ thống.
3. **Hoàn tất đồ án**:
   - `TopicRegistration.status` chuyển sang `COMPLETED`.
   - Hệ thống khóa toàn bộ quyền chỉnh sửa hồ sơ.
   - Sinh viên có thể tải về **Giấy Xác Nhận Hoàn Thành Đồ Án / Khóa Luận** (PDF tự động sinh).

---

## 7. Lộ Trình Hành Động Tiếp Theo (Updated Target Roadmap)

### Giai đoạn Tiếp Theo 1 (P0): Cơ Chế Bypass/Skip & Tinh Chỉnh Checkpoint BM03
- [ ] Bổ sung cơ chế **Bypass Step** cho BM01/BM02: Cho phép GVHD/Admin đánh dấu "Miễn thẩm định / Bỏ qua" để mở khóa thẳng sang giai đoạn thực hiện nếu đợt đồ án không yêu cầu.
- [ ] Nâng cấp BM03 thành **Mô hình Giám sát 3 tầng**:
  - Hỗ trợ tạo các buổi **Nhật ký gặp gỡ (Meeting Log)** tinh gọn do GVHD nhập.
  - Tách bạch rõ 2 mốc **Checkpoint 1 (Tuần 6)** và **Checkpoint 2 (Tuần 11)**.
  - Tự động thống kê số buổi gặp và tỷ lệ hoàn thành đưa vào làm minh chứng trong BM04.

### Giai đoạn Tiếp Theo 2 (P1): Radar Cảnh Báo Sớm Trên Dashboard Viện
- [x] Bổ sung chỉ số **Health Radar** trên `ProjectOversightPage.jsx`: Cảnh báo sinh viên quá 3 tuần chưa tương tác với GVHD và quá 14 ngày chưa nộp lưu chiểu.
- [x] Bộ lọc 1-click & Modal chi tiết: Xem danh sách sinh viên có nguy cơ rớt đồ án giữa kỳ hoặc chậm trễ tốt nghiệp.

### Giai đoạn Tiếp Theo 3 (P1): Module Nộp Lưu Chiểu & Nghiệm Thu Hoàn Tất
- [x] Xây dựng màn hình nộp lưu chiểu cho Sinh viên (`ArchiveSubmissionModal.jsx`): Báo cáo hoàn thiện (PDF/DOCX), Slide (PPTX/PDF), link Video Demo (YouTube/Drive) và link repo GitHub.
- [x] Xây dựng giao diện duyệt nghiệm thu lưu chiểu cho GVHD (`StudentProgressDetailPanel.jsx`) & Quản trị Viện (`ProjectOversightPage.jsx`).
- [x] Cấp chức năng xuất "Giấy xác nhận hoàn thành đồ án" (Clearance Certificate) chuẩn trang trọng TDMU kèm chức năng in trực tiếp.

### Giai đoạn Tiếp Theo 4 (P1): Kiểm Thử Tự Động & Xanh Hóa Toàn Bộ Test Suite
- [ ] Cập nhật lại các test suites cũ theo đúng schema mới và logic Bypass/Skip.
- [ ] Chạy kiểm thử E2E Playwright trên luồng hoàn chỉnh từ Sinh viên nộp bài $\rightarrow$ GV duyệt $\rightarrow$ Hội đồng chấm điểm $\rightarrow$ Lưu chiểu.
