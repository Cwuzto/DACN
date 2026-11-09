# Đặc Tả Thiết Kế: Hồ Sơ Đồ Án và Phân Hệ Xét Duyệt Đề Cương (BM01)

- **Ngày ban hành**: 2026-11-10
- **Trạng thái**: Bản sửa đổi hoàn thiện (Ready for Approval)
- **Tài liệu tham chiếu**: [dac-ta-ky-thuat-ho-so-do-an-va-xet-duyet-de-cuong.md](file:///d:/DACN/dac-ta-ky-thuat-ho-so-do-an-va-xet-duyet-de-cuong.md)
- **Kiến trúc áp dụng**: Phương án 1 (Tiến hóa mở rộng trên CSDL hiện hữu, phân tầng trạng thái độc lập, bảo toàn lịch sử append-only).

---

## 1. Intent & The Why (Mục Đích & Bối Cảnh)

### Bối cảnh nghiệp vụ
Trong quy trình thực hiện đồ án tốt nghiệp, giai đoạn xét duyệt đề cương (BM01) là cửa ải học thuật đầu tiên và then chốt. Sau khi sinh viên đăng ký sơ bộ đề tài và được GVHD chấp thuận, sinh viên phải nộp đề cương để Hội đồng chuyên môn thẩm định tính khả thi, phương pháp nghiên cứu và hàm lượng khoa học.

Trước đây, hệ thống chưa có phân hệ khép kín cho Hội đồng xét duyệt đề cương: thiếu quy trình cho Thư ký lập biên bản dự thảo, Chủ tịch chốt và công bố kết quả có hiệu lực tức thì, thiếu kiểm soát version file đề cương và cơ chế nộp lại duy nhất có khóa cứng nguyên tử.

### Mục tiêu cốt lõi
1. Xây dựng phân hệ Quản lý hồ sơ đồ án và Xét duyệt đề cương (BM01) tuân thủ nghiêm ngặt quy chế đào tạo đại học.
2. Đảm bảo tính toàn vẹn dữ liệu: không bao giờ ghi đè file cũ, lượt nộp lại là duy nhất (`maxSubmissions = 1`), bị khóa ngay khi upload hợp lệ đầu tiên hoàn tất.
3. Phân tách rõ ràng trách nhiệm 4 tác nhân:
   - **Admin**: Cấu hình thời gian đợt, thành lập Hội đồng xét duyệt đề cương, phân sinh viên, mở khóa kết quả theo ngoại lệ (kèm cơ chế bảo vệ phụ thuộc BM02).
   - **Chủ tịch Hội đồng**: Công bố lịch bảo vệ (trực tiếp / Teams), đặt hạn nộp lại chung, công bố kết quả (hiệu lực ngay), thẩm định duyệt/từ chối file nộp lại kèm nhận xét học thuật bắt buộc.
   - **Thư ký Hội đồng**: Nhập kết quả đánh giá dự thảo theo danh sách, chuyển Chủ tịch kiểm tra.
   - **Sinh viên**: Nộp đề cương ban đầu (trước khi phân hội đồng), tiếp thu góp ý và nộp lại đúng một lần nếu nhận kết luận chỉnh sửa hoặc không đạt.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals (Mục tiêu đạt được)
- **G-01**: Cung cấp cấu hình đợt trên `Semester`: thời gian mở, hạn nộp chung toàn đợt, file mẫu, định dạng (`Json` tương thích đa CSDL) và dung lượng tối đa.
- **G-02**: Cho phép sinh viên nộp đề cương v1 ngay sau khi GVHD duyệt đề tài và đợt mở cổng nộp; không phụ thuộc vào việc đã được gán vào Hội đồng hay chưa.
- **G-03**: Cho phép Chủ tịch công bố lịch bảo vệ của Hội đồng (`IN_PERSON` hoặc `MICROSOFT_TEAMS`) sau khi kiểm tra điều kiện lịch bảo vệ phải sau hạn nộp chung của đợt và tất cả sinh viên được bảo vệ phải được gán vào Hội đồng.
- **G-04**: Quản lý đợt công bố kết quả qua bảng mới `CouncilResultBatch` theo vòng đời append-only: `DRAFT` -> `PENDING_CHAIR` -> `PUBLISHED` -> `SUPERSEDED` -> `REOPENED` (version mới).
- **G-05**: Mở rộng `BM01Evaluation` lưu chi tiết kết quả từng sinh viên theo từng batch: `initialOutcome` (`PASS`, `REVISION_REQUIRED`, `FAIL`, `ABSENT`), ý kiến nhận xét, yêu cầu chỉnh sửa, liên kết file nộp lại duy nhất và `revisionFeedback` khi Chủ tịch thẩm định file nộp lại.
- **G-06**: Tự động đồng bộ sang `RegistrationStatus`:
  - `PASS` -> `BM01_PASSED` (tự động kích hoạt nhiệm vụ nộp đơn đăng ký đề tài chính thức BM02).
  - `REVISION_REQUIRED`, `FAIL`, `ABSENT` -> `BM01_NEEDS_REVISION`.
  - Sinh viên nộp lại -> `BM01_RESUBMITTED`.
  - Chủ tịch duyệt file nộp lại -> `BM01_PASSED`; Chủ tịch từ chối hoặc hết hạn -> `TERMINATED_BM01` (dừng đồ án trong đợt).
- **G-07**: Đảm bảo tính nguyên tử (atomicity) và chống race condition bằng Conditional Update (`WHERE ... IS NULL`) trong Prisma Transaction.
- **G-08**: Tách bạch 2 nhiệm vụ độc lập: `BM01_INITIAL_SUBMISSION` và `BM01_RESUBMISSION`.
- **G-09**: Bảo vệ tính toàn vẹn học vụ: Chặn Admin mở khóa kết quả nếu trong Hội đồng đã có sinh viên nộp/xử lý/duyệt đơn BM02 (`409 BM02_DEPENDENCY_EXISTS`).

### Non-Goals (Không thuộc phạm vi)
- Không chấm điểm bảo vệ đồ án cuối kỳ hoặc thành lập hội đồng bảo vệ cuối kỳ (đã được xử lý ở phân hệ bảo vệ).
- Không tự động gọi Graph API tạo Microsoft Teams meeting; phiên bản hiện tại lưu và xác thực HTTPS link do Chủ tịch cung cấp.
- Không tổ chức buổi họp bảo vệ đề cương bổ sung cho sinh viên phải nộp lại.

### Anti-Goals (Tuyệt đối không làm)
- **Không dồn toàn bộ trạng thái chi tiết của Hội đồng vào `RegistrationStatus`**: `RegistrationStatus` chỉ đóng vai trò trạng thái tổng hợp mức cao.
- **Không cho phép file nháp**: Bất kỳ file upload hợp lệ nào vào hệ thống đều trở thành bản nộp chính thức, bị khóa tức thì và không thể chỉnh sửa/thay thế.
- **Không ghi đè hoặc xóa lịch sử đánh giá**: Mọi lần đánh giá, mở khóa, công bố lại đều được lưu vết append-only phục vụ thanh tra đào tạo.
- **Không thay đổi dữ liệu khi gọi API GET (No mutation on read)**: API GET chỉ tính toán và trả cờ `isOverdue`, không được sửa đổi CSDL.
- **Không xóa vật lý dữ liệu học vụ**: Áp dụng `onDelete: Restrict` cho các quan hệ đánh giá và hội đồng; dùng xóa mềm khi cần.
- **Không cho phép sinh viên nộp lại lần 2**: Chặn tuyệt đối ở tầng CSDL/Backend bằng conditional update trong transaction.
- **Không tự động âm thầm tạm treo đơn BM02 khi Admin mở khóa**: Phải fail-fast và yêu cầu thao tác độc lập có audit giải trình.

---

## 3. Constraints (Ràng Buộc Kỹ Thuật & Nghiệp Vụ)

1. **Ràng buộc Additive Migration**: Mọi thay đổi trong CSDL phải là additive; không xóa cột, không đổi tên bảng/cột cũ để không gây breaking change cho các test suites hiện hành.
2. **Ràng buộc quy chế 1 SV / 1 Đề tài**: Tuân thủ triệt để mô hình `TopicRegistration`, `maxStudents = 1`.
3. **Ràng buộc thời gian**:
   - `Semester.outlineSubmissionOpenAt < Semester.outlineSubmissionDeadline`.
   - `Council.defenseDate > Semester.outlineSubmissionDeadline`.
   - `Council.revisionSubmissionDeadline > CouncilResultBatch.chairPublishedAt`.
4. **Ràng buộc phân quyền theo Resource (Resource-based Authorization)**:
   - Chỉ Giảng viên có vai trò `CHAIR` của đúng `Council` đó mới được công bố lịch, công bố kết quả, trả hồ sơ, đặt hạn nộp lại và duyệt file nộp lại.
   - Chỉ `SECRETARY` hoặc `CHAIR` của đúng Hội đồng mới được nhập kết quả dự thảo.
   - Sinh viên chỉ được nộp đề cương của chính hồ sơ đồ án của mình.
5. **Ràng buộc Idempotency**: Mọi thao tác chuyển trạng thái nhạy cảm (`publish`, `secretary-complete`, `reopen`, `approve-resubmission`, `reject-resubmission`) phải hỗ trợ `Idempotency-Key` với cơ chế kiểm tra hash và replay kết quả lưu tại bảng `idempotency_records`.
6. **Ràng buộc độc lập CSDL**: Không dùng kiểu dữ liệu đặc thù của riêng một hệ quản trị (như `String[]` của Postgres); sử dụng kiểu `Json` cho danh sách phần mở rộng cho phép.

---

## 4. Approaches & Evaluation (Đánh Giá Phương Án)

### Các phương án đã cân nhắc
1. **Phương án 1 (Tiến hóa CSDL hiện hữu & Phân tầng trạng thái - ĐÃ CHỌN)**:
   - Tận dụng `Semester`, `TopicRegistration`, `Council(OUTLINE_REVIEW)`, `CouncilMember`, `BM01Evaluation`, `Submission`.
   - Bổ sung bảng `CouncilResultBatch` để điều phối vòng đời danh sách theo đợt.
   - Mở rộng `BM01Evaluation` lưu `initialOutcome`, nhận xét, yêu cầu sửa và conditional update cho file nộp lại.
   - Tách 2 loại Task trong `TaskType`: `BM01_INITIAL_SUBMISSION` và `BM01_RESUBMISSION`.
   - *Lý do chọn*: Tương thích 100% với hệ thống hiện hữu, tái sử dụng toàn bộ hạ tầng authentication, authorization, notification, và router đã ổn định; không gây phân mảnh dữ liệu.
2. **Phương án 2 (Cụm bảng độc lập song song - BỊ LOẠI)**:
   - Tạo mới `OutlineCouncil`, `DossierTask`, `DossierDocumentVersion`, `OutlineReviewResult`.
   - *Lý do loại*: Trùng lặp thực thể với `Council` và `TopicRegistration`, phát sinh rủi ro lệch pha dữ liệu giữa các bảng và phức tạp hóa bảo trì dài hạn.

---

## 5. Architectural Design & Implementation Details

### 5.1. Mô hình CSDL (Database Schema Extensions)

```mermaid
erDiagram
    Semester ||--o{ Council : "hosts"
    Semester ||--o{ TopicRegistration : "contains"
    Council ||--o{ CouncilMember : "has"
    Council ||--o{ CouncilResultBatch : "tracks batches"
    Council ||--o{ TopicRegistration : "evaluates (outlineCouncilId)"
    CouncilResultBatch ||--o{ BM01Evaluation : "contains (1-to-many)"
    TopicRegistration ||--o{ BM01Evaluation : "has"
    BM01Evaluation ||--o| Submission : "v1 submission"
    BM01Evaluation ||--o| Submission : "v2 resubmission"
    TopicRegistration ||--o{ Task : "tracks tasks"
```

#### A. Mở rộng Model `Semester`
Bổ sung các trường cấu hình xét duyệt đề cương (dùng `Json` để độc lập CSDL, hỗ trợ cả PostgreSQL và MySQL):
```prisma
// Trong model Semester:
outlineSubmissionOpenAt    DateTime? @map("outline_submission_open_at")
outlineSubmissionDeadline  DateTime? @map("outline_submission_deadline")
outlineTemplateFileUrl     String?   @map("outline_template_file_url")
outlineTemplateFileId      Int?      @map("outline_template_file_id")
outlineAllowedExtensions   Json      @default("[\".docx\", \".pdf\"]") @map("outline_allowed_extensions")
outlineMaxFileSizeBytes    Int       @default(20971520) @map("outline_max_file_size_bytes") // 20 MB
```

#### B. Mở rộng Model `Council`
Bổ sung cấu hình phiên bảo vệ đề cương, hạn nộp lại và cờ soft-delete:
```prisma
// Trong model Council:
meetingMode                CouncilMeetingMode? @default(IN_PERSON) @map("meeting_mode")
meetingUrl                 String?             @map("meeting_url")
schedulePublishedAt        DateTime?           @map("schedule_published_at")
revisionSubmissionDeadline DateTime?           @map("revision_submission_deadline")
isActive                   Boolean             @default(true) @map("is_active")
deletedAt                  DateTime?           @map("deleted_at")
rowVersion                 Int                 @default(1) @map("row_version")
resultBatches              CouncilResultBatch[]
```

#### C. Thêm Enum Mới & Mở rộng Enum
```prisma
enum CouncilMeetingMode {
  IN_PERSON
  MICROSOFT_TEAMS
}

enum CouncilBatchStatus {
  DRAFT
  PENDING_CHAIR
  PUBLISHED
  SUPERSEDED
  REOPENED
}

enum OutlineInitialOutcome {
  PASS
  REVISION_REQUIRED
  FAIL
  ABSENT
}

enum OutlineRevisionApprovalStatus {
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  EXCUSED
}

// Bổ sung vào enum TaskType hiện có:
enum TaskType {
  BM01
  BM01_INITIAL_SUBMISSION  // MỚI: Nộp đề cương v1
  BM01_RESUBMISSION        // MỚI: Nộp lại đề cương v2
  BM02
  BM03_CHECKPOINT_1
  BM03_CHECKPOINT_2
  BM03_CHECKPOINT
  REPORT_DRAFT
  BM04
  GENERIC
}

// Bổ sung vào enum RegistrationStatus hiện có:
enum RegistrationStatus {
  // ... các trạng thái hiện hữu
  BM01_SUBMITTED
  BM01_NEEDS_REVISION
  BM01_RESUBMITTED         // MỚI: Sinh viên đã nộp bản sửa đổi duy nhất
  BM01_PASSED
  // ...
  TERMINATED_BM01          // Sinh viên bị từ chối đề cương hoặc quá hạn nộp lại
}
```

#### D. Bổ sung Model `CouncilResultBatch`
Quản lý trạng thái danh sách kết quả theo Hội đồng, bảo toàn lịch sử append-only (`onDelete: Restrict`):
```prisma
model CouncilResultBatch {
  id                     Int                 @id @default(autoincrement())
  councilId              Int                 @map("council_id")
  versionNumber          Int                 @default(1) @map("version_number")
  status                 CouncilBatchStatus  @default(DRAFT)
  secretaryCompletedAt   DateTime?           @map("secretary_completed_at")
  secretaryCompletedById Int?                @map("secretary_completed_by_id")
  chairPublishedAt       DateTime?           @map("chair_published_at")
  chairPublishedById     Int?                @map("chair_published_by_id")
  returnedAt             DateTime?           @map("returned_at")
  returnedById           Int?                @map("returned_by_id")
  returnReason           String?             @map("return_reason")
  reopenedAt             DateTime?           @map("reopened_at")
  reopenedById           Int?                @map("reopened_by_id")
  reopenReason           String?             @map("reopen_reason")
  createdAt              DateTime            @default(now()) @map("created_at")
  updatedAt              DateTime            @updatedAt @map("updated_at")

  council                Council             @relation(fields: [councilId], references: [id], onDelete: Restrict)
  secretaryCompletedBy   User?               @relation("BatchSecretary", fields: [secretaryCompletedById], references: [id], onDelete: Restrict)
  chairPublishedBy       User?               @relation("BatchChair", fields: [chairPublishedById], references: [id], onDelete: Restrict)
  returnedBy             User?               @relation("BatchReturnedBy", fields: [returnedById], references: [id], onDelete: Restrict)
  reopenedBy             User?               @relation("BatchReopenedBy", fields: [reopenedById], references: [id], onDelete: Restrict)
  evaluations            BM01Evaluation[]

  @@unique([councilId, versionNumber])
  @@index([councilId, status])
  @@map("council_result_batches")
}
```

#### E. Mở rộng Model `BM01Evaluation`
Lưu kết quả chi tiết từng sinh viên theo batch, khóa cứng file nộp và liên kết an toàn (`onDelete: Restrict`):
```prisma
// Bổ sung các trường vào BM01Evaluation:
councilId                   Int?                           @map("council_id")
batchId                     Int?                           @map("batch_id")
initialOutcome              OutlineInitialOutcome?         @map("initial_outcome")
attendanceStatus            AttendanceStatus?              @default(PRESENT) @map("attendance_status")
comment                     String?
revisionRequirements        String?                        @map("revision_requirements")
revisionSubmissionId        Int?                           @unique @map("revision_submission_id")
revisionApprovalStatus      OutlineRevisionApprovalStatus? @default(NOT_REQUIRED) @map("revision_approval_status")
revisionReviewedAt          DateTime?                      @map("revision_reviewed_at")
revisionReviewedById        Int?                           @map("revision_reviewed_by_id")
revisionFeedback            String?                        @map("revision_feedback") // Nhận xét bắt buộc khi REJECT bản sửa

council                     Council?                       @relation(fields: [councilId], references: [id], onDelete: Restrict)
batch                       CouncilResultBatch?            @relation(fields: [batchId], references: [id], onDelete: Restrict)
revisionSubmission          Submission?                    @relation("BM01RevisionSubmission", fields: [revisionSubmissionId], references: [id], onDelete: Restrict)
revisionReviewedBy          User?                          @relation("BM01RevisionReviewedBy", fields: [revisionReviewedById], references: [id], onDelete: Restrict)

// Unique constraint đảm bảo mỗi sinh viên có đúng một bản ghi đánh giá trong một batch:
@@unique([batchId, registrationId])
```

---

### 5.2. Ma Trận Hợp Lệ Dữ Liệu (Validation Rules Matrix)

Để loại trừ hoàn toàn các trạng thái tự mâu thuẫn, backend bắt buộc thực hiện kiểm tra các quy tắc sau trước khi ghi dữ liệu:

| Tình huống kiểm tra | Quy tắc bắt buộc | Mã lỗi trả về |
|---|---|---|
| Đánh giá vắng mặt | `initialOutcome === 'ABSENT'` yêu cầu `attendanceStatus in ['ABSENT', 'EXCUSED']` | `400 INVALID_ATTENDANCE_STATUS` |
| Đánh giá có mặt | `attendanceStatus === 'PRESENT'` không được chọn `initialOutcome === 'ABSENT'` | `400 OUTCOME_ATTENDANCE_MISMATCH` |
| Yêu cầu sửa đổi | `initialOutcome === 'REVISION_REQUIRED'` bắt buộc `revisionRequirements` không rỗng | `400 REVISION_REQUIREMENTS_REQUIRED` |
| Đánh giá không đạt | `initialOutcome === 'FAIL'` bắt buộc có `comment` nhận xét học thuật không rỗng | `400 FAIL_COMMENT_REQUIRED` |
| Từ chối bản nộp lại | Chủ tịch chọn `REJECT` bắt buộc có `revisionFeedback` không rỗng | `400 REVISION_FEEDBACK_REQUIRED` |
| Đã có file nộp lại | `revisionSubmissionId !== null` chỉ cho phép khi hồ sơ ở `BM01_RESUBMITTED`, `BM01_PASSED`, hoặc `TERMINATED_BM01` | `400 INVALID_RESUBMISSION_STATE` |

---

### 5.3. Luồng Chuyển Đổi Trạng Thái (State Machine)

```mermaid
stateDiagram-v2
    direction TB
    [*] --> APPROVED : GVHD duyệt đề tài sơ bộ
    APPROVED --> BM01_SUBMITTED : Nộp đề cương v1 (không cần chờ phân HĐ)
    
    state "Phân bổ & Bảo vệ Đề cương" as CouncilReviewSession {
        BM01_SUBMITTED --> CouncilAssigned : Admin phân HĐ
        CouncilAssigned --> SchedulePublished : Chủ tịch công bố lịch
        SchedulePublished --> DraftBatch : Thư ký nhập kết quả
        DraftBatch --> PendingChair : Thư ký hoàn tất danh sách
        PendingChair --> DraftBatch : Chủ tịch trả lại kèm lý do
        PendingChair --> PublishedBatch : Chủ tịch ký công bố (Hiệu lực ngay)
    }

    PublishedBatch --> BM01_PASSED : initialOutcome = PASS
    PublishedBatch --> BM01_NEEDS_REVISION : initialOutcome in [REVISION_REQUIRED, FAIL, ABSENT]
    
    BM01_NEEDS_REVISION --> BM01_RESUBMITTED : Nộp lại duy nhất qua conditional update
    
    BM01_RESUBMITTED --> BM01_PASSED : Chủ tịch APPROVED
    BM01_RESUBMITTED --> TERMINATED_BM01 : Chủ tịch REJECTED kèm feedback
    BM01_NEEDS_REVISION --> TERMINATED_BM01 : Scheduled Job hoặc Chủ tịch chốt quá hạn
    
    BM01_PASSED --> BM02_SUBMITTED : Tự động mở nhiệm vụ nộp BM02
```

---

### 5.4. Chi Tiết Các Giao Dịch Backend Trọng Yếu

#### 1. Sinh viên nộp đề cương v1 (`POST /api/outline/submissions`)
- **Điều kiện**:
  - `TopicRegistration.status === 'APPROVED'`.
  - Thuộc đợt có `outlineSubmissionOpenAt <= now <= outlineSubmissionDeadline`.
  - Không bắt buộc đã được phân Hội đồng: file đề cương gắn liền với Hồ sơ đồ án (`TopicRegistration`).
  - File hợp lệ về MIME, extension (kiểm tra theo `Semester.outlineAllowedExtensions`) và dung lượng $\le$ `outlineMaxFileSizeBytes`.
- **Giao dịch nguyên tử (Atomic Conditional Update)**:
  1. Tạo `Submission` (version 1) gắn với `Task` loại `BM01_INITIAL_SUBMISSION`.
  2. Thực hiện cập nhật điều kiện chống nộp đè:
     ```javascript
     const updated = await tx.bM01Evaluation.updateMany({
       where: {
         registrationId: registration.id,
         submissionId: null, // Guard: chưa từng có file v1
       },
       data: {
         submissionId: newSubmission.id,
         submittedAt: new Date(),
         submittedById: userId,
       }
     });
     if (updated.count === 0) {
       throw new ConflictError('INITIAL_SUBMISSION_ALREADY_USED');
     }
     ```
  3. Cập nhật `TopicRegistration.status = 'BM01_SUBMITTED'`.
  4. Đánh dấu `Task` loại `BM01_INITIAL_SUBMISSION` sang `COMPLETED`.
- *Quy tắc*: Upload thành công hợp lệ đầu tiên bị khóa vĩnh viễn, không cung cấp API thay thế hay xóa.

#### 2. Chủ tịch công bố lịch bảo vệ (`POST /api/councils/:id/schedule/publish`)
- **Điều kiện**:
  - Người thao tác là `CHAIR` của đúng Council đó.
  - Hội đồng có đủ Chủ tịch, Thư ký, thành viên và ít nhất 1 sinh viên.
  - **Bắt buộc**: Tất cả sinh viên trong danh sách bảo vệ của hội đồng phải có `outlineCouncilId === council.id`.
  - `defenseDate > Semester.outlineSubmissionDeadline`.
  - Nếu `meetingMode === 'IN_PERSON'`: bắt buộc có `location`.
  - Nếu `meetingMode === 'MICROSOFT_TEAMS'`: bắt buộc có `meetingUrl` (HTTPS hợp lệ).
- **Hành động**:
  1. Cập nhật `Council.schedulePublishedAt = now()`.
  2. Bắn thông báo outbox tới Sinh viên, GVHD và Thành viên hội đồng.

#### 3. Thư ký lưu nháp và hoàn tất kết quả
- **Lưu nháp từng sinh viên (`PUT /api/councils/:id/results/:registrationId`)**:
  - Quyền: `SECRETARY` hoặc `CHAIR`.
  - Áp dụng ma trận validation tại Mục 5.2.
  - Cho phép lưu nháp khi batch ở trạng thái `DRAFT` hoặc `REOPENED`.
- **Hoàn tất nhập kết quả (`POST /api/councils/:id/results/secretary-complete`)**:
  - Quyền: `SECRETARY` hoặc `CHAIR`.
  - **Validation**: 100% sinh viên trong hội đồng phải có kết quả đánh giá hợp lệ.
  - **Hành động**: Chuyển `CouncilResultBatch.status = 'PENDING_CHAIR'`. Khóa quyền sửa của Thư ký.

#### 4. Chủ tịch trả lại danh sách kết quả (`POST /api/councils/:id/results/return`)
- **Điều kiện**: Người thao tác là `CHAIR`. Batch đang ở `PENDING_CHAIR`.
- **Validation**: Bắt buộc gửi kèm `returnReason`.
- **Hành động**:
  1. Chuyển `CouncilResultBatch.status = 'DRAFT'`.
  2. Ghi nhận `returnedAt = now()`, `returnedById`, `returnReason`.
  3. Mở lại quyền chỉnh sửa cho Thư ký và gửi thông báo.

#### 5. Chủ tịch công bố kết quả (`POST /api/councils/:id/results/publish`)
- **Điều kiện**: Người thao tác là `CHAIR`. Batch đang ở `PENDING_CHAIR`.
- **Giao dịch nguyên tử (Atomic Transaction & Idempotent)**:
  1. Chuyển `CouncilResultBatch.status = 'PUBLISHED'`, ghi nhận `chairPublishedAt = now()`, `chairPublishedById`.
  2. Duyệt qua từng sinh viên:
     - Nếu `initialOutcome === 'PASS'`:
       + Cập nhật `BM01Evaluation.outcome = 'PASSED'`, `revisionApprovalStatus = 'NOT_REQUIRED'`.
       + Chuyển `TopicRegistration.status = 'BM01_PASSED'`.
       + Tự động tạo `Task` nộp đơn đăng ký đề tài chính thức BM02 (`SUBMIT_FORMAL_APPLICATION`).
     - Nếu `initialOutcome in ['REVISION_REQUIRED', 'FAIL', 'ABSENT']`:
       + Cập nhật `BM01Evaluation.outcome = 'NEEDS_REVISION'`, `revisionApprovalStatus = 'PENDING'`.
       + Chuyển `TopicRegistration.status = 'BM01_NEEDS_REVISION'`.
  3. Ghi audit log bất biến.
  4. Trả về kết quả công bố thành công.

#### 6. Chủ tịch thiết lập hạn nộp lại chung (`PUT /api/councils/:id/revision-deadline`)
- **Điều kiện**: Người thao tác là `CHAIR`. `deadline > now()`.
- **Hành động**:
  1. Cập nhật `Council.revisionSubmissionDeadline = deadline`.
  2. Tự động tạo hoặc kích hoạt `Task` loại `BM01_RESUBMISSION` với `dueDate = deadline` cho tất cả sinh viên đang ở trạng thái `BM01_NEEDS_REVISION` thuộc hội đồng.
  3. Bắn thông báo cho sinh viên và GVHD.

#### 7. Sinh viên nộp lại đề cương duy nhất (`POST /api/outline/resubmissions`)
- **Điều kiện**:
  - Sinh viên sở hữu hồ sơ và đang ở trạng thái `BM01_NEEDS_REVISION`.
  - Thời gian hiện tại $\le$ `Council.revisionSubmissionDeadline`.
  - Task `BM01_RESUBMISSION` đang `OPEN`.
- **Giao dịch nguyên tử (Atomic Conditional Update)**:
  1. Tạo `Submission` gắn với `Task` loại `BM01_RESUBMISSION`.
  2. Thực hiện cập nhật có điều kiện:
     ```javascript
     const updated = await tx.bM01Evaluation.updateMany({
       where: {
         registrationId: registration.id,
         revisionSubmissionId: null, // Guard: bắt buộc chưa từng nộp lại
       },
       data: {
         revisionSubmissionId: newSubmission.id,
       }
     });
     if (updated.count === 0) {
       throw new ConflictError('RESUBMISSION_ALREADY_USED');
     }
     ```
  3. Chuyển `TopicRegistration.status = 'BM01_RESUBMITTED'`.
  4. Đánh dấu `Task` loại `BM01_RESUBMISSION` sang `COMPLETED`.
  5. Bắn thông báo tới Chủ tịch hội đồng.
- *Quy tắc*: Upload thành công đầu tiên bị khóa vĩnh viễn, không thể thay thế hoặc nộp lần hai.

#### 8. Chủ tịch xác nhận file nộp lại (`POST /api/councils/:id/resubmissions/:registrationId/review`)
- **Điều kiện**: Người thao tác là `CHAIR`. Sinh viên đang ở trạng thái `BM01_RESUBMITTED`.
- **Thao tác**:
  - Nếu `decision === 'APPROVE'`:
    + Cập nhật `BM01Evaluation.revisionApprovalStatus = 'APPROVED'`, `outcome = 'PASSED'`, `revisionFeedback`.
    + Chuyển `TopicRegistration.status = 'BM01_PASSED'`.
    + Tự động tạo nhiệm vụ nộp đơn đăng ký đề tài chính thức BM02.
  - Nếu `decision === 'REJECT'`:
    + Bắt buộc có `revisionFeedback` ghi rõ lý do học thuật không đạt.
    + Cập nhật `BM01Evaluation.revisionApprovalStatus = 'REJECTED'`, `outcome = 'TERMINATED'`, `revisionFeedback`.
    + Chuyển `TopicRegistration.status = 'TERMINATED_BM01'`.
    + Đóng hồ sơ đồ án của sinh viên trong đợt này.

---

### 5.5. Cơ Chế Xử Lý Quá Hạn Nộp Lại (No Mutation on GET)

Tuyệt đối **không thay đổi CSDL khi gọi API GET**. API GET chỉ tính toán thuộc tính ảo `isOverdue: boolean` để hiển thị cảnh báo trên giao diện.

Việc chuyển trạng thái sang `TERMINATED_BM01` được thực thi bởi 2 cơ chế độc lập:
1. **Scheduled Job Idempotent**: Chạy định kỳ (hoặc qua worker), quét các hồ sơ có `status === 'BM01_NEEDS_REVISION'`, `now() > Council.revisionSubmissionDeadline` và `BM01Evaluation.revisionSubmissionId === null`. Chuyển sang `TERMINATED_BM01` và ghi log audit hệ thống.
2. **Nút "Chốt danh sách quá hạn" (`POST /api/councils/:id/finalize-resubmissions`)**: Dành cho Chủ tịch hoặc Admin chủ động kích hoạt quét và chốt trạng thái dừng đồ án cho các sinh viên bỏ lỡ hạn chót.

---

### 5.6. Quy Trình Reopen Bảo Toàn Lịch Sử Append-Only

Khi Admin mở khóa kết quả đã công bố (`POST /api/councils/:id/results/reopen`):

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant Server as Backend API
    participant DB as PostgreSQL
    
    Admin->>Server: POST /results/reopen (reason)
    Server->>DB: Kiểm tra sinh viên trong HĐ có đơn BM02 không?
    alt Tồn tại BM02 (Submitted / Approved)
        Server-->>Admin: 409 BM02_DEPENDENCY_EXISTS (kèm danh sách SV)
    else Không tồn tại BM02
        Server->>DB: Đánh dấu Batch hiện tại: status = SUPERSEDED
        Server->>DB: Tạo New Batch: versionNumber = prev + 1, status = REOPENED
        Server->>DB: Sao chép snapshot BM01Evaluation sang New Batch (batchId = new.id)
        Server->>DB: Ghi AuditLog bất biến
        Server-->>Admin: 200 Reopened Successfully
    end
```

1. **Kiểm tra an toàn dữ liệu (Guard chống cascading corruption)**:
   - Backend quét toàn bộ sinh viên trong Hội đồng.
   - Nếu tồn tại bất kỳ sinh viên nào đã có hồ sơ BM02 (`SUBMITTED`, `APPROVED`, `RESUBMITTED`), **CHẶN MỞ KHÓA** và trả lỗi:
     ```json
     {
       "statusCode": 409,
       "error": "BM02_DEPENDENCY_EXISTS",
       "message": "Không thể mở khóa kết quả Hội đồng vì đã tồn tại dữ liệu đơn đăng ký đề tài BM02.",
       "blockingRegistrations": [
         { "registrationId": 12, "studentName": "Nguyễn Văn A", "bm02Status": "BM02_SUBMITTED" }
       ]
     }
     ```
   - Admin/Khoa bắt buộc phải thu hồi hoặc xử lý đơn BM02 trước bằng một thao tác ngoại lệ riêng biệt có lý do và audit.
2. **Thuật toán sinh Batch mới (Append-Only Snapshot)**:
   - Chuyển `currentBatch.status = 'SUPERSEDED'`.
   - Tạo `newBatch` với: `versionNumber = currentBatch.versionNumber + 1`, `status = 'REOPENED'`, `reopenedAt = now()`, `reopenedById`, `reopenReason`.
   - Sao chép toàn bộ các bản ghi `BM01Evaluation` từ batch cũ sang batch mới với `batchId = newBatch.id`, `attemptNo = prev.attemptNo + 1`, liên kết `supersedesId = prev.id`.
   - Bản ghi cũ nằm nguyên ở batch cũ (`SUPERSEDED`), đảm bảo lịch sử thanh tra đào tạo bất biến 100%.

---

### 5.7. Kiến Trúc Idempotency Hoàn Chỉnh

Áp dụng bảng `idempotency_records` hiện có trong CSDL:
- **Scope**: `outline_review_actions` (ví dụ: `councils:publish`, `councils:reopen`, `outline:resubmit`).
- **Key**: Chuỗi UUID v4 truyền trong header `Idempotency-Key`.
- **Command Hash**: `sha256(requestBody + JSON.stringify(params) + actorId)`.
- **Xử lý**:
  - Nếu key chưa tồn tại: Thực thi transaction, lưu response payload và HTTP status vào `idempotency_records`.
  - Nếu key đã tồn tại và `commandHash` trùng khớp: Replay ngay lập tức kết quả đã lưu kèm header `X-Cache-Lookup: HIT-IDEMPOTENT`, không chạy lại transaction.
  - Nếu key đã tồn tại nhưng `commandHash` khác: Từ chối ngay lập tức với mã lỗi `422 IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH`.
  - **Thời gian hết hạn (TTL)**: 24 giờ.

---

### 5.8. Giao Diện Người Dùng (UI/UX)

1. **Cổng Sinh Viên (`StudentDashboardPage.jsx` & `SubmissionPage.jsx`)**:
   - Nộp đề cương v1 ngay trên trang nộp hồ sơ khi đợt mở cổng, không cần chờ xếp Hội đồng. File nộp đầu tiên khóa nút nộp vĩnh viễn.
   - Khi được xếp Hội đồng: Thẻ thông tin phiên bảo vệ hiển thị thời gian, địa điểm hoặc nút tham gia "Tham gia Microsoft Teams".
   - Khu vực thông báo kết quả: Hiển thị kết luận ban đầu (`Đạt` / `Cần chỉnh sửa` / `Không đạt` / `Vắng mặt`), ý kiến nhận xét của Hội đồng và các yêu cầu sửa đổi.
   - Khu vực nộp lại duy nhất: Hiển thị hạn chót nộp lại của Hội đồng, ô upload file (kèm banner cảnh báo: "Bản nộp đầu tiên là bản chính thức và không thể thay thế"), nút nộp bị vô hiệu hóa ngay sau khi upload thành công. Cảnh báo trễ hạn tính toán qua thuộc tính ảo `isOverdue`.
2. **Cổng Giảng Viên - Hội Đồng (`CouncilOutlinePage.jsx` hoặc Tab Hội đồng Đề cương)**:
   - Dành cho Chủ tịch: Card công bố lịch bảo vệ (chọn trực tiếp / Teams), nút Đặt hạn nộp lại chung, nút Công bố kết quả chính thức, nút Trả lại thư ký, và Drawer thẩm định file nộp lại (Duyệt / Từ chối kèm ô nhận xét bắt buộc khi từ chối). Nút "Chốt danh sách quá hạn" để quét các sinh viên không nộp bài.
   - Dành cho Thư ký: Bảng nhập kết quả đánh giá (chọn `initialOutcome`, nhập nhận xét và yêu cầu chỉnh sửa có validation tức thì), nút Lưu nháp từng sinh viên, nút Hoàn tất nhập kết quả chuyển Chủ tịch.
3. **Cổng Quản Trị Viên (`CouncilAssignmentPage.jsx` & `ProjectPeriodPage.jsx`)**:
   - Quản trị cấu hình nộp đề cương theo đợt học kỳ: Thời gian mở, hạn nộp chung toàn đợt, upload file mẫu.
   - Điều phối Hội đồng thẩm định đề cương: Two-column matcher ghép sinh viên vào Hội đồng `OUTLINE_REVIEW` dựa trên đề tài và file đề cương đã nộp.
   - Nút hành động ngoại lệ "Mở khóa kết quả Hội đồng" kèm modal bắt buộc nhập lý do mở khóa, hiển thị modal cảnh báo chi tiết nếu vướng phụ thuộc đơn BM02.

---

## 6. What's Left to the Builder (Nhiệm Vụ Của Đội Ngũ Triển Khai)

1. **Prisma Migration**:
   - Tạo migration additive bổ sung các trường vào `Semester`, `Council`, `BM01Evaluation`, mở rộng enum `TaskType` (`BM01_INITIAL_SUBMISSION`, `BM01_RESUBMISSION`), enum `RegistrationStatus` (`BM01_RESUBMITTED`), và tạo bảng `CouncilResultBatch`.
   - Cấu hình `onDelete: Restrict` trên tất cả quan hệ hội đồng và kết quả đánh giá.
   - Kiểm tra `npx prisma validate` và generate Prisma Client.
2. **Backend Services & Routes**:
   - Viết `outlineReviewService.js` chứa toàn bộ các nghiệp vụ chuyển trạng thái nguyên tử, conditional update, idempotency record và thuật toán snapshot reopen.
   - Viết các route controller trong `outlineController.js` và bổ sung middleware xác thực vai trò Hội đồng (`requireCouncilRole('CHAIR')`, `requireCouncilRole('SECRETARY')`).
   - Cập nhật `registrationTransitionService` để quản lý chuyển trạng thái `BM01_SUBMITTED`, `BM01_NEEDS_REVISION`, `BM01_RESUBMITTED`, `BM01_PASSED`, `TERMINATED_BM01`.
   - Viết `outlineSweepService.js` để quét xử lý quá hạn định kỳ (chạy không có side-effect trên GET).
3. **Frontend Integration**:
   - Tích hợp API vào `outlineService.js` trên frontend.
   - Cập nhật giao diện sinh viên `SubmissionPage.jsx` hiển thị stepper đề cương và form nộp file duy nhất.
   - Hoàn thiện giao diện Hội đồng cho Giảng viên (Thư ký nhập biên bản có validation matrix, Chủ tịch ký duyệt và công bố).
4. **Unit & Integration Tests**:
   - Viết test suite chuyên biệt `tests/integration/outlineReviewWorkflow.test.js` bao phủ 100% các nhánh nghiệp vụ (PASS, REVISION -> RESUBMIT -> APPROVE/REJECT, OVERDUE, Reopen Batch Snapshot & BM02 Dependency Guard, Idempotency Replay).
