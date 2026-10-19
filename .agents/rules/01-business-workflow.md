# Quy Trình Nghiệp Vụ Quản Lý Đồ Án / Khóa Luận Tốt Nghiệp

Tài liệu này mô tả chi tiết quy trình nghiệp vụ thực tế và mô hình số hóa chuẩn hóa của Viện Công nghệ Số (đã cập nhật theo Đợt chuẩn hóa quy trình BM01 - Bảo vệ).

---

## 1. Bản Đồ Tổng Quan Quy Trình (6 Giai Đoạn)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 1: Chuẩn bị & Đăng ký đề tài                                      │
│  - Viện công bố DS SV đủ điều kiện, DS GVHD & Hướng nghiên cứu trên Homepage│
│  - SV liên hệ GVHD, gửi yêu cầu đề tài (Tối đa 10 SV/GVHD, 1 SV/đề tài)     │
│  - GVHD Duyệt (APPROVED) hoặc Từ chối (REJECTED)                            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 2: Đề cương & Xét duyệt (BM01 & BM02)                             │
│  - SV nộp Đề cương nghiên cứu (BM01) trước buổi xét duyệt                    │
│  - Hội đồng xét duyệt đề cương họp: ĐẠT hoặc CẦN CHỈNH SỬA / VẮNG            │
│  - Nếu Cần sửa: SV sửa nộp lại -> GVHD thẩm định lại ĐẠT mới được nộp BM02   │
│  - SV & GVHD thống nhất tên chính thức -> Nộp BM02                          │
│  - Trưởng Viện ký & ban hành "Quyết định giao đề tài kèm danh sách"         │
│  - CỬA SỔ 7 NGÀY: SV được nộp đơn xin đổi tên đề tài -> GVHD duyệt trực tiếp│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 3: Thực hiện & Theo dõi tiến độ (BM03)                            │
│  - Kéo dài ~3 tháng thực hiện đề tài; ghi nhận Meeting Logs định kỳ         │
│  - 2 Đợt Checkpoint tiến độ bắt buộc: ĐẠT hoặc KHÔNG ĐẠT                    │
│  - NGUYÊN TẮC NGHIÊM NGẶT: Không đạt bất kỳ Checkpoint nào -> DỪNG ĐỀ TÀI   │
│    ngay lập tức (TERMINATED_FAILED_PROGRESS)                                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 4: Đánh giá trước bảo vệ (BM04)                                   │
│  - GVHD chủ động mở form lập Phiếu nhận xét BM04 theo 4 tiêu chí bắt buộc:  │
│    1) Hình thức BCTN, 2) Nội dung nghiên cứu, 3) Ứng dụng, 4) Thái độ       │
│  - GVHD tick xác nhận: "ĐỒNG Ý" hoặc "KHÔNG ĐỒNG Ý" cho ra bảo vệ           │
│  - Ký tên số -> KHÓA VĨNH VIỄN (isLocked = true, cấm sửa sau nộp)           │
│  - Khi ĐỒNG Ý: Hệ thống tự động chuyển trạng thái sang DEFENSE_READY        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 5: Hội đồng chấm BCTN & Bảo vệ (DEFENSE_COUNCIL)                  │
│  - ĐIỀU KIỆN TIÊN QUYẾT: Chỉ sinh viên đạt DEFENSE_READY mới được xếp HĐ     │
│  - Viện lập Hội đồng: 1 Chủ tịch, 1 Thư ký, 1 Phản biện (Không trùng GVHD)  │
│  - SV bảo vệ trước Hội đồng                                                 │
│  - 3 thành viên chấm điểm độc lập (DefenseMemberScore)                      │
│  - Điểm tổng kết = Trung bình cộng của 3 thành viên                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 6: Hoàn thiện sau bảo vệ & Nộp lưu chiểu                          │
│  - SV chỉnh sửa theo góp ý của Hội đồng                                     │
│  - Nộp quyển báo cáo hoàn chỉnh (PDF), file mềm và source code              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Từng Giai Đoạn & Quy Tắc Nghiệp Vụ Cốt Lõi

### Giai đoạn 1: Chuẩn bị & Đăng ký đề tài
- **Công bố thông tin**:
  - Viện công bố Danh sách sinh viên đủ điều kiện làm đồ án và Danh sách GVHD kèm các hướng nghiên cứu trên **Trang chủ**.
- **Chọn đề tài & GVHD**:
  - Sinh viên chủ động liên hệ GVHD để trao đổi định hướng nghiên cứu và chọn đề tài.
  - **Quy tắc 1 SV / 1 đề tài**: Mỗi đề tài do đúng **1 sinh viên** thực hiện (`maxStudents = 1`).
  - **Giới hạn hướng dẫn (Quota)**: Mỗi GVHD hướng dẫn **tối đa 10 sinh viên** trong một học kỳ.
- **Quy trình gửi & duyệt yêu cầu**:
  - Sinh viên gửi yêu cầu đăng ký đề tài tới GVHD (trạng thái `PENDING`).
  - GVHD duyệt: **Chấp nhận (`APPROVED`)** hoặc **Từ chối (`REJECTED`)** kèm lý do.

---

### Giai đoạn 2: Đề cương, Xét duyệt BM01, BM02 & Quyết Định Viện
1. **Lập đề cương (BM01)**:
   - Sinh viên nộp Đề cương nghiên cứu theo mẫu **BM01** lên hệ thống trước buổi xét duyệt.
2. **Hội đồng xét duyệt đề cương (`OUTLINE_REVIEW`)**:
   - Chủ tịch Hội đồng xét duyệt trực tiếp cho kết quả:
     - **ĐẠT (`PASSED`)**: Sinh viên đủ điều kiện tiến hành BM02.
     - **CẦN CHỈNH SỬA (`NEEDS_REVISION`)** hoặc **VẮNG/KHÔNG ĐẠT (`FAILED`)**: Sinh viên chỉnh sửa lại đề cương và nộp lại trên hệ thống.
3. **Thẩm định lại đề cương nộp lại**:
   - Đề cương BM01 nộp lại được chuyển cho **GVHD thẩm định lại**.
   - Khi GVHD xác nhận **ĐẠT**, sinh viên mới được mở khóa nộp BM02.
4. **Nộp đơn đăng ký đề tài chính thức (BM02)**:
   - SV và GVHD thảo luận hoàn thiện tên đề tài chính thức và nộp BM02 (`BM02_SUBMITTED`).
   - Cấm nộp BM02 nếu BM01 chưa có kết quả Đạt.
5. **Ban hành Quyết định giao đề tài của Viện**:
   - Trưởng Viện / Quản trị viên duyệt danh sách nộp BM02 và ban hành **Quyết định giao đề tài kèm danh sách** (`decisionNumber`, `decisionDate`).
   - Các đề tài được chuyển sang trạng thái **Đang thực hiện (`IN_PROGRESS`)** và tự động sinh 2 mốc Checkpoint BM03.
6. **Cửa sổ 7 ngày xin đổi tên đề tài**:
   - Kể từ thời điểm ban hành Quyết định, sinh viên có **đúng 7 ngày** (`decisionDate + 7 ngày`) để nộp đơn xin đổi tên đề tài (`TopicTitleAdjustment`).
   - GVHD duyệt trực tiếp đơn xin đổi tên. Khi duyệt `APPROVED`, hệ thống cập nhật `adjustedTitle` cho đề tài. Tên mới được dùng xuyên suốt cho BM03, BM04 và Hội đồng bảo vệ; tên gốc trong Quyết định vẫn được lưu vết đầy đủ.
   - Sau 7 ngày, hệ thống tự động khóa tính năng xin đổi tên.

---

### Giai đoạn 3: Thực hiện đề tài & Theo dõi tiến độ nghiêm ngặt (BM03)
- **Thời gian thực hiện**: Kéo dài khoảng 3 tháng; thường xuyên ghi nhận Meeting Logs trao đổi định kỳ.
- **2 Checkpoint tiến độ bắt buộc**:
  - Gồm **Checkpoint 1** (giữa kỳ) và **Checkpoint 2** (cuối kỳ).
  - Kết quả đánh giá chỉ gồm 2 mức: **ĐẠT (`COMPLETED`)** hoặc **KHÔNG ĐẠT (`FAILED`)**.
- **Cơ chế Dừng đề tài lập tức**:
  - Nếu sinh viên bị đánh giá **KHÔNG ĐẠT** ở bất kỳ Checkpoint nào, đề tài lập tức chuyển sang trạng thái **`TERMINATED_FAILED_PROGRESS` (Dừng thực hiện đề tài)**, không được phép tiếp tục và không được ra bảo vệ.

---

### Giai đoạn 4: Đánh giá trước bảo vệ (BM04)
- **4 Tiêu chuẩn bắt buộc**:
  1. Hình thức BCTN.
  2. Nội dung nghiên cứu.
  3. Tính ứng dụng & triển vọng phát triển.
  4. Thái độ làm việc và mức độ hoàn thành nhiệm vụ.
- **Quyết định cho phép bảo vệ**:
  - GVHD chọn **ĐỒNG Ý** hoặc **KHÔNG ĐỒNG Ý** cho ra bảo vệ.
  - Điền chữ ký xác nhận của GVHD.
- **Khóa bất biến (`isLocked = true`)**:
  - Ngay khi nộp, phiếu BM04 được khóa vĩnh viễn, ngăn chặn mọi hành vi chỉnh sửa điểm hay nhận xét sau đó.
- **Tự động chuyển `DEFENSE_READY`**:
  - Nếu GVHD chọn **ĐỒNG Ý**, đề tài tự động chuyển trạng thái sang **`DEFENSE_READY`**.

---

### Giai đoạn 5: Hội đồng chấm BCTN & Bảo vệ
- **Điều kiện tiên quyết**: Chỉ sinh viên có trạng thái **`DEFENSE_READY`** mới được hiển thị trong danh sách phân công Hội đồng bảo vệ (`DEFENSE_COUNCIL`).
- **Thành phần hội đồng**:
  - Gồm 3 thành viên: 1 Chủ tịch, 1 Thư ký, 1 Phản biện.
  - **Quy tắc xung đột lợi ích**: GVHD không được tham gia hội đồng chấm sinh viên mình hướng dẫn.
- **Chấm điểm**:
  - 3 thành viên chấm điểm độc lập trên 3 phiếu chấm riêng (`DefenseMemberScore`).
  - Điểm tổng kết là trung bình cộng của 3 thành viên.

---

### Giai đoạn 6: Hoàn thiện sau bảo vệ & Nộp lưu chiểu
- Sinh viên chỉnh sửa theo góp ý của Hội đồng, nộp quyển hoàn chỉnh (PDF) và source code lên hệ thống lưu trữ.

---

## 3. Nguyên Tắc "Triệt Tiêu Hoàn Toàn Bypass"

- Hệ thống **tuyệt đối không hỗ trợ bất kỳ nút, nhãn hoặc cơ chế miễn thẩm định/bỏ qua bước (Bypass)** nào trên toàn bộ Backend và Frontend.
- Mọi đề tài bắt buộc phải trải qua đầy đủ các mắt xích: BM01 Đạt -> BM02 -> Quyết định Viện -> Checkpoint 1 Đạt -> Checkpoint 2 Đạt -> BM04 Đồng ý -> Hội đồng bảo vệ.

---

## 4. Phân Hệ Quản Trị Tiêu Chí Rubric Chấm Điểm Bảo Vệ

- **Quản lý phiên bản toàn hệ thống (Global Rubric Versioning `v1`, `v2`, `v3`...)**:
  - Tại một thời điểm chỉ có 1 phiên bản mang trạng thái `ACTIVE` áp dụng cho việc chấm điểm.
  - Các phiên bản cũ chuyển sang `ARCHIVED` để bảo lưu dữ liệu lịch sử.
- **Cấu trúc phân cấp 2 tầng (Hierarchical Categories & Criteria)**:
  - Nhóm mục lớn (Category): vd Hình thức, Nội dung & kết quả, Thuyết trình & phản biện.
  - Tiêu chí con (Criterion): Gồm mã tiêu chí, tên tiêu chí, điểm tối đa, và mô tả chi tiết cấp độ đánh giá (Xuất sắc, Tốt, Khá, Trung bình, Yếu).
- **Ràng buộc điểm học thuật nghiêm ngặt**:
  - $\sum(\text{Điểm tối đa tiêu chí con}) = \text{Điểm tối đa của Mục}$.
  - $\sum(\text{Điểm tối đa các Mục}) = 10.0$ điểm tuyệt đối.
- **Quy tắc Khóa an toàn (Business Guard)**:
  - Chỉ cho phép Quản trị viên (Admin) tạo mới, chỉnh sửa hoặc kích hoạt Rubric khi **chưa vào đợt đồ án** (học kỳ ở trạng thái `UPCOMING` hoặc trước ngày `startDate`).
  - Khi học kỳ chuyển sang `ONGOING`, `DEFENSE` hoặc sau ngày `startDate`, hệ thống tự động khóa sang chế độ **Chỉ đọc (Read-only)** nhằm bảo đảm tính công bằng học vụ.
- **Bảo lưu lịch sử điểm số bất biến**:
  - Từng đề tài và từng thành viên hội đồng lưu vết `scoreRubricVersion` cụ thể.
  - Các khóa trước đã chấm theo `v1` sẽ vĩnh viễn hiển thị và tính toán theo chuẩn `v1`, không bao giờ bị sai lệch khi Admin kích hoạt phiên bản mới (`v2`, `v3`).

