# Thiết Kế Kiến Trúc Quy Trình Đồ Án Tốt Nghiệp (BM01 - BM04 & Bảo Vệ)

- **Ngày ban hành**: 19/10/2026
- **Trạng thái**: Đã phê duyệt qua Brainstorming
- **Phạm vi**: Backend API (Prisma/Express) & Frontend UI (React SPA)
- **Tài liệu tham chiếu**: [01-business-workflow.md](file:///d:/DACN/.agents/rules/01-business-workflow.md), [02-data-architecture.md](file:///d:/DACN/.agents/rules/02-data-architecture.md)

---

## 1. Mục Tiêu & Bối Cảnh

Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp Viện Công nghệ Số cần chuẩn hóa chuỗi quy trình học vụ thực tế từ bước Đăng ký ban đầu đến khi Bảo vệ trước Hội đồng, đảm bảo:
1. **Minh bạch thẩm quyền**:
   - Chủ tịch Hội đồng xét duyệt đề cương quyết định Đạt/Không đạt cho BM01.
   - GVHD toàn quyền chuyên môn: Thẩm định lại đề cương BM01, duyệt đơn điều chỉnh tên đề tài (trong 7 ngày), đánh giá 2 Checkpoint BM03, và lập/ký khóa biểu mẫu BM04.
   - Trưởng Viện (hoặc Giảng viên kiêm nhiệm quyền Viện trưởng) chỉ can thiệp để ban hành các văn bản/danh sách pháp lý (Quyết định giao đề tài sau BM02, Quyết định Hội đồng bảo vệ sau BM04).
2. **Không có cơ chế "Bypass"**: Tất cả các chặng đều đi tuần tự, bắt buộc hoàn thành chặng trước mới được mở khóa chặng sau.
3. **Quản lý phiên bản & Chữ ký số bất biến**: Phiếu BM04 do GVHD trực tiếp khởi tạo và ký khóa vĩnh viễn, gắn chặt với đợt đồ án (`periodId`), ngăn chặn việc dùng lại phiếu cũ.

---

## 2. Máy Trạng Thái Tuần Tự (TopicRegistration State Machine)

```text
[REGISTERED]
     │
     ▼ (Sinh viên nộp đề cương BM01)
[BM01_SUBMITTED]
     │
     ├── (Chủ tịch HĐ chấm "Không đạt" hoặc "Vắng") ──► [BM01_NEEDS_REVISION]
     │                                                         │
     │                                              (SV nộp bản sửa & GVHD duyệt Đạt)
     │                                                         │
     ▼ (Chủ tịch HĐ chấm "Đạt") ◄──────────────────────────────┘
[BM01_PASSED]
     │
     ▼ (SV và GVHD thống nhất nộp BM02)
[BM02_SUBMITTED]
     │
     ▼ (Trưởng Viện ký Quyết định giao đề tài kèm danh sách)
[DECISION_ISSUED] ── (Trong 7 ngày: SV có thể xin Đổi tên đề tài ➔ GVHD duyệt)
     │
     ▼ (Bắt đầu giai đoạn thực hiện 3 tháng)
[IN_PROGRESS_BM03]
     │
     ├── (GVHD chấm Checkpoint 1 = "Không đạt") ──► [TERMINATED_FAILED_PROGRESS] (Dừng đề tài)
     │
     ├── (GVHD chấm Checkpoint 2 = "Không đạt") ──► [TERMINATED_FAILED_PROGRESS] (Dừng đề tài)
     │
     ▼ (Cả Checkpoint 1 & 2 đều "Đạt")
[BM03_PASSED]
     │
     ▼ (GVHD mở form BM04, chấm 4 tiêu chí, tick "ĐỒNG Ý" & ký xác nhận)
[DEFENSE_READY] ◄── Tự động chuyển trạng thái ngay khi BM04 đạt (Khóa form BM04 vĩnh viễn)
     │
     ▼ (Hội đồng bảo vệ chấm điểm)
[DEFENDED]
```

### Chi tiết các trạng thái:
- `REGISTERED`: Đề tài được đăng ký thành công giữa SV và GVHD.
- `BM01_SUBMITTED`: Đã nộp đề cương BM01, chờ buổi xét duyệt của Hội đồng đề cương.
- `BM01_NEEDS_REVISION`: Hội đồng đánh giá chưa đạt hoặc vắng; chờ SV sửa nộp lại và GVHD thẩm định.
- `BM01_PASSED`: Đề cương đã được thông qua (bởi HĐ hoặc GVHD duyệt lại). Mở khóa nộp BM02.
- `BM02_SUBMITTED`: Đã nộp Phiếu đăng ký đề tài chính thức BM02, chờ Trưởng Viện ra Quyết định.
- `DECISION_ISSUED`: Quyết định giao đề tài đã được ban hành; kích hoạt thời hạn 7 ngày điều chỉnh tên đề tài.
- `IN_PROGRESS_BM03`: Đang thực hiện đề tài và ghi nhận tiến độ BM03.
- `TERMINATED_FAILED_PROGRESS`: Dừng thực hiện đề tài do không đạt Checkpoint BM03 hoặc GVHD không đồng ý ở BM04.
- `BM03_PASSED`: Đã vượt qua cả 2 Checkpoint bắt buộc của BM03.
- `DEFENSE_READY`: GVHD đã ký BM04 xác nhận "ĐỒNG Ý cho ra bảo vệ"; đủ điều kiện đưa vào danh sách xếp Hội đồng bảo vệ.
- `DEFENDED`: Đã hoàn thành bảo vệ trước Hội đồng chấm BCTN.

---

## 3. Kiến Trúc Dữ Liệu (Prisma Schema Updates)

### 3.1 Cập nhật Enum `RegistrationStatus`
```prisma
enum RegistrationStatus {
  REGISTERED
  BM01_SUBMITTED
  BM01_NEEDS_REVISION
  BM01_PASSED
  BM02_SUBMITTED
  DECISION_ISSUED
  IN_PROGRESS_BM03
  BM03_PASSED
  DEFENSE_READY
  DEFENDED
  TERMINATED_FAILED_PROGRESS
  REJECTED
}
```

### 3.2 Bảng Lịch Sử Điều Chỉnh Tên Đề Tài (`TopicTitleAdjustment`)
```prisma
model TopicTitleAdjustment {
  id             String             @id @default(uuid())
  registrationId String
  registration   TopicRegistration  @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  originalTitle  String             // Tên đề tài theo Quyết định giao đề tài ban đầu
  newTitle       String             // Tên đề tài mới xin điều chỉnh
  reason         String             // Lý do xin điều chỉnh
  status         AdjustmentStatus   @default(PENDING) // PENDING, APPROVED, REJECTED
  requestedAt    DateTime           @default(now())
  reviewedAt     DateTime?
  reviewedById   String?
  reviewedBy     User?              @relation("AdjustTitleReviewer", fields: [reviewedById], references: [id])
  rejectionReason String?
  deadline       DateTime           // Ngày hết hạn (7 ngày sau Decision)

  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@index([registrationId])
}

enum AdjustmentStatus {
  PENDING
  APPROVED
  REJECTED
}
```

### 3.3 Bảng Đánh Giá Biểu Mẫu BM04 (`Evaluation` / `BM04Evaluation`)
```prisma
model BM04Evaluation {
  id              String            @id @default(uuid())
  registrationId  String            @unique
  registration    TopicRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  periodId        String
  period          ProjectPeriod     @relation(fields: [periodId], references: [id])
  studentId       String
  student         User              @relation("StudentBM04", fields: [studentId], references: [id])
  lecturerId      String
  lecturer        User              @relation("LecturerBM04", fields: [lecturerId], references: [id])
  
  // 4 tiêu chí đánh giá bắt buộc
  thesisFormatScore     String      // Nhận xét tiêu chí 1: Hình thức đáp ứng yêu cầu BCTN
  researchContentScore  String      // Nhận xét tiêu chí 2: Nội dung nghiên cứu
  applicabilityScore    String      // Nhận xét tiêu chí 3: Tính ứng dụng và triển vọng
  attitudeScore         String      // Nhận xét tiêu chí 4: Thái độ và ý thức làm việc
  
  // Kết luận và chữ ký
  conclusion      BM04Conclusion    // AGREED_FOR_DEFENSE | NOT_AGREED
  generalNotes    String?
  lecturerSignature String          // Chữ ký điện tử / Tên GVHD xác nhận
  signedAt        DateTime          @default(now())
  isLocked        Boolean           @default(true) // Khóa vĩnh viễn sau khi ký

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([periodId, studentId])
}

enum BM04Conclusion {
  AGREED_FOR_DEFENSE
  NOT_AGREED
}
```

---

## 4. Đặc Tả Chi Tiết Từng Phân Hệ & Logic Nghiệp Vụ

### 4.1 Pha Đề Cương BM01 & Cơ Chế Xét Duyệt Lại
1. **Xét duyệt lần 1 (Tại Hội đồng xét duyệt đề cương)**:
   - Chủ tịch Hội đồng nhập nhận xét và chọn kết luận: `PASSED` (Đạt) hoặc `FAILED` / `ABSENT` (Chưa đạt / Vắng).
   - Nếu `PASSED`: Hệ thống chuyển trạng thái `BM01_PASSED`, mở quyền nộp BM02.
   - Nếu `FAILED` / `ABSENT`: Hệ thống chuyển trạng thái sang `BM01_NEEDS_REVISION`, mở form cho phép sinh viên nộp lại bản đề cương chỉnh sửa.
2. **Cơ chế Duyệt lại đề cương (Ủy quyền cho GVHD)**:
   - Sinh viên tải lên file PDF đề cương đã tiếp thu góp ý và cập nhật tóm tắt nội dung/chức năng.
   - GVHD đăng nhập vào hệ thống, xem bản so sánh/chỉnh sửa của sinh viên.
   - GVHD bấm nút **`[Xác nhận đề cương đã chỉnh sửa ĐẠT]`**.
   - Hệ thống chuyển trạng thái đề tài thành `BM01_PASSED`, cho phép sinh viên chuyển sang nộp BM02.

### 4.2 Pha Đăng Ký Chính Thức BM02 & Quyết Định Của Viện
1. **Nộp đơn BM02**:
   - Sinh viên và GVHD chốt tên đề tài chính thức và nộp biểu mẫu BM02. Trạng thái đề tài chuyển thành `BM02_SUBMITTED`.
2. **Ban hành Quyết định (Trưởng Viện)**:
   - Trưởng Viện xem danh sách sinh viên đã nộp BM02, kiểm tra tính đầy đủ và bấm nút **`[Ký duyệt & Ban hành Quyết định]`**.
   - Hệ thống:
     - Gán số hiệu Quyết định và ngày ban hành vào toàn bộ hồ sơ trong đợt.
     - Chuyển trạng thái sang `DECISION_ISSUED`.
     - Kích hoạt cửa sổ đếm ngược **7 ngày** tính từ `decisionDate` cho phép nộp đơn đổi tên đề tài.

### 4.3 Pha Điều Chỉnh Tên Đề Tài (Cửa Sổ 7 Ngày)
1. **Gửi đơn xin điều chỉnh**:
   - Trong vòng 7 ngày, sinh viên có thể vào Dashboard gửi yêu cầu thay đổi tên đề tài (nhập tên mới, giải trình lý do).
2. **GVHD phê duyệt**:
   - GVHD xem đơn và bấm **Duyệt (`APPROVED`)** hoặc **Từ chối (`REJECTED`)**.
   - Khi Duyệt: Tên đề tài mới được ghi nhận làm tên chính thức cho các pha BM03, BM04 và Hội đồng bảo vệ.
   - Tên gốc trong Quyết định ban đầu vẫn được lưu giữ nguyên bản trong `TopicTitleAdjustment.originalTitle` để đối chiếu pháp lý khi cần.
3. **Khóa cổng**: Sau khi hết 7 ngày, cổng nộp đơn tự động đóng.

### 4.4 Pha Thực Hiện BM03 (2 Checkpoint Bắt Buộc)
1. **Theo dõi tiến độ**: Giai đoạn kéo dài ~3 tháng. GVHD và sinh viên trao đổi định kỳ.
2. **Đánh giá Checkpoint 1 & Checkpoint 2**:
   - GVHD chỉ có đúng 2 lựa chọn: **`PASSED` (Đạt)** hoặc **`FAILED` (Không đạt)**.
   - Nếu GVHD đánh giá `FAILED` ở bất kỳ Checkpoint nào: Hệ thống chuyển trạng thái thành `TERMINATED_FAILED_PROGRESS` (Dừng làm đề tài ngay lập tức, không được phép tiếp tục).
   - Nếu cả 2 Checkpoint đều `PASSED`: Hệ thống chuyển trạng thái sang `BM03_PASSED`, mở quyền cho GVHD vào lập phiếu BM04.

### 4.5 Pha BM04 & Tự Động Chuyển Sang Bảo Vệ
1. **Khởi tạo & Điền BM04 (Độc quyền GVHD)**:
   - GVHD vào danh sách sinh viên mình hướng dẫn, mở form BM04.
   - Điền đầy đủ nhận xét vào 4 tiêu chí bắt buộc:
     1. Hình thức đáp ứng yêu cầu của BCTN.
     2. Nội dung nghiên cứu.
     3. Tính ứng dụng và triển vọng đề tài.
     4. Đánh giá thái độ và ý thức làm việc của sinh viên.
   - Tick chọn kết luận: **`AGREED_FOR_DEFENSE` (Đồng ý)** hoặc **`NOT_AGREED` (Không đồng ý)**.
   - GVHD ký tên xác nhận và gửi phiếu.
2. **Khóa phiếu & Tự động chuyển pha**:
   - Ngay sau khi ký nộp, phiếu chuyển sang trạng thái `isLocked = true` (khóa vĩnh viễn, không cho sửa).
   - Nếu GVHD chọn `AGREED_FOR_DEFENSE`: Hệ thống tự động chuyển trạng thái đề tài thành **`DEFENSE_READY`** (Đủ điều kiện xếp Hội đồng bảo vệ).
   - Nếu GVHD chọn `NOT_AGREED`: Đề tài chuyển sang `TERMINATED_FAILED_PROGRESS` (Không đủ điều kiện ra bảo vệ).
   - Đảm bảo phiếu độc lập theo từng đợt đồ án: khóa ngoại bắt buộc `periodId` trùng khớp với đợt đang mở.

---

## 5. Danh Sách API Endpoints Backend

| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/evaluations/outline-review/:registrationId` | Chủ tịch HĐ | Đánh giá BM01 (Đạt / Không đạt / Vắng) |
| `POST` | `/api/evaluations/bm01-resubmit/:registrationId` | Sinh viên | Nộp lại đề cương BM01 đã chỉnh sửa |
| `POST` | `/api/evaluations/bm01-gvhd-approve/:registrationId` | GVHD | GVHD duyệt lại đề cương BM01 sau chỉnh sửa |
| `POST` | `/api/registrations/bm02-submit` | Sinh viên | Nộp đơn đăng ký đề tài chính thức BM02 |
| `POST` | `/api/admin/periods/:periodId/issue-decision` | Trưởng Viện | Ký duyệt Quyết định giao đề tài kèm danh sách |
| `POST` | `/api/registrations/adjust-title` | Sinh viên | Gửi đơn xin đổi tên đề tài (trong hạn 7 ngày) |
| `PUT` | `/api/registrations/adjust-title/:id/review` | GVHD | GVHD duyệt/từ chối đổi tên đề tài |
| `POST` | `/api/tasks/checkpoint-evaluate` | GVHD | Đánh giá Checkpoint 1 & 2 (Đạt / Không đạt) |
| `POST` | `/api/evaluations/bm04-submit` | GVHD | GVHD điền 4 tiêu chí, tick Đồng ý & ký khóa BM04 |
| `GET` | `/api/evaluations/bm04/:registrationId` | SV, GVHD, Admin | Xem phiếu BM04 đã khóa (Read-only) |
| `GET` | `/api/councils/eligible-defense-students` | Admin | Lấy danh sách SV có trạng thái `DEFENSE_READY` để xếp HĐ |

---

## 6. Danh Mục Các Màn Hình Frontend & Components

1. **Sinh viên**:
   - `StudentDashboardPage.jsx`: Thẻ tiến độ 5 giai đoạn, Banner đếm ngược 7 ngày đổi tên đề tài, thông báo kết quả các chặng.
   - `BMSubmissionViewer.jsx`: Form nộp BM01, nộp lại BM01 revision, nộp BM02, xem phiếu BM04 read-only.
   - `TitleAdjustmentModal.jsx`: Modal nộp đơn xin đổi tên đề tài.
2. **Giảng viên**:
   - `LecturerDashboardPage.jsx`: Danh sách cần duyệt lại BM01, danh sách đơn xin đổi tên đề tài cần duyệt.
   - `ProgressTrackingPage.jsx`: Chấm Checkpoint 1 và 2 với 2 nút chọn Đạt / Không đạt.
   - `BM04EvaluationModal.jsx`: Form chuyên biệt 4 tiêu chí + Tick Đồng ý/Không đồng ý + Ký xác nhận & Khóa.
3. **Quản trị viên / Trưởng Viện**:
   - `ProjectPeriodPage.jsx`: Nút Ban hành Quyết định giao đề tài kèm danh sách sinh viên nộp BM02.
   - `CouncilAssignmentPage.jsx`: Tự động áp dụng bộ lọc chỉ cho phép xếp lịch bảo vệ với sinh viên có trạng thái `DEFENSE_READY`.

---

## 7. Kế Hoạch Kiểm Thử (Testing Strategy)

1. **Unit Test (Backend Service)**:
   - Test máy trạng thái: Chặn nộp BM02 nếu BM01 chưa Đạt.
   - Test cơ chế duyệt lại BM01: Cho phép GVHD duyệt lại khi trạng thái là `BM01_NEEDS_REVISION`.
   - Test thời hạn đổi tên đề tài: Chặn đổi tên sau 7 ngày kể từ ngày ban hành Quyết định.
   - Test Checkpoint BM03: Đánh giá `FAILED` lập tức chuyển sang `TERMINATED_FAILED_PROGRESS`.
   - Test BM04: Chặn sửa sau khi `isLocked = true`; tự động chuyển `DEFENSE_READY` khi chọn `AGREED_FOR_DEFENSE`.
2. **Integration & E2E Test (UI Flow)**:
   - Thử nghiệm toàn bộ luồng từ BM01 ➔ BM02 ➔ Quyết định ➔ Đổi tên đề tài ➔ BM03 ➔ BM04 ➔ Phân công Hội đồng bảo vệ trên giao diện React.
