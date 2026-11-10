# Tài Liệu Thiết Kế Kỹ Thuật: Chuỗi Quy Trình Học Vụ BM02 – BM04

**Ngày lập:** 11/11/2026  
**Nguồn nghiệp vụ gốc:** [dac-ta-thiet-ke-bm02-den-bm04.md](file:///d:/DACN/dac-ta-thiet-ke-bm02-den-bm04.md)  
**Phạm vi:** Từ khi sinh viên đạt đề cương (`BM01_PASSED`) đến khi hoàn tất đánh giá trước bảo vệ (`BM04`) và xác định điều kiện ra Hội đồng bảo vệ (`DEFENSE_READY` / `DEFENSE_ELIGIBLE`).  
**Phương án kiến trúc đã chọn:** Phương án 3 — Mở rộng Additive trên Schema Prisma hiện hữu kết hợp thực thi cuốn chiếu 4 Đợt dọc (Phased Vertical Slices).

---

## 1. Mục Đích & Lý Do Thiết Kế (Intent & Why)

Sau khi phân hệ Hồ sơ đồ án & Xét duyệt đề cương (BM01) đã hoàn tất và đưa hồ sơ sinh viên tới trạng thái `BM01_PASSED`, hệ thống cần một chuỗi nghiệp vụ liên hoàn, chặt chẽ về mặt pháp lý học vụ để quản lý quá trình từ lúc đăng ký đề tài chính thức đến trước khi ra hội đồng bảo vệ cuối kỳ:

1. **Chặng 1A (BM02 & Quyết định giao đề tài):** Cho phép sinh viên nộp đơn đăng ký đề tài chính thức (BM02) có cập nhật cách diễn đạt tên đề tài theo góp ý của Hội đồng đề cương (nhưng vẫn bảo lưu snapshot `bm01ApprovedTitle`), Viện thẩm định (tối đa 1 lần yêu cầu sửa) và ban hành Quyết định giao đề tài chính thức.
2. **Chặng 1B (BM02-A & Phụ lục điều chỉnh tên đề tài):** Mở cửa sổ đúng 168 giờ (7 ngày dương lịch) tính từ thời điểm công bố quyết định (`decisionPublishedAt`) để sinh viên lập phiếu BM02-A xin điều chỉnh tên đề tài. Phiếu BM02-A đi qua chuỗi **3 chữ ký điện tử nội bộ** (Sinh viên $\rightarrow$ GVHD $\rightarrow$ Phụ trách bộ môn) gắn cùng một `payloadHash`, tối đa 2 phiên bản (`versionNumber = 1, 2`). Các phiếu đã duyệt được Viện gom lập thành nhiều đợt **Phụ lục điều chỉnh (`TitleAdjustmentAppendix`)**; tên mới có hiệu lực từ `signedDate` của phụ lục đã `ISSUED`.
3. **Chặng 2 (BM03 — Theo dõi quá trình thực hiện):** GVHD ghi nhận nhật ký các buổi hướng dẫn (chỉ cần chữ ký GVHD, sinh viên không ký từng buổi), thực hiện đánh giá giữa giai đoạn (`CONTINUE` / `PROPOSE_STOP`) và cuối giai đoạn (`CONTINUE_TO_BM04` / `PROPOSE_STOP`). Mọi đề nghị dừng (`PROPOSE_STOP`) phải qua **Viện thẩm định** với thời hạn SLA **7 ngày (168h) + tối đa 1 lần gia hạn 3 ngày (72h)** khi yêu cầu bổ sung thông tin; nếu quá hạn mà Viện chưa kết luận, hệ thống tự động chấp thuận dừng (`SYSTEM_TIMEOUT`, không giả chữ ký Admin). Cuối kỳ, GVHD ký toàn phiếu BM03 và sinh viên có **48 giờ** để xác nhận đã biết (nếu quá 48 giờ chuyển `ACKNOWLEDGEMENT_TIMEOUT`, không giả chữ ký sinh viên và không làm treo bước tiếp theo).
4. **Chặng 3 (BM04 — Phiếu nhận xét của GVHD):** Mở khi BM03 có kết luận tiếp tục và đã hoàn tất xác nhận sinh viên (hoặc hết hạn 48 giờ). GVHD lưu nháp hoặc ký nộp với 4 tiêu chí bắt buộc và 2 kết luận (`programOutcome` & `defenseRecommendation`). Nếu đạt chuẩn đầu ra và đồng ý bảo vệ, hồ sơ chuyển ngay sang đủ điều kiện bảo vệ (`DEFENSE_READY` / `DEFENSE_ELIGIBLE`). Nếu GVHD không đồng ý bảo vệ, đề nghị này chuyển sang **Viện thẩm định** theo cơ chế SLA **7+3 ngày** tương tự BM03.

---

## 2. Mục Tiêu, Ngoài Phạm Vi & Phản Mục Tiêu (Goals, Non-Goals & Anti-Goals)

### 2.1. Mục tiêu (Goals)
- Hiện thực hóa đầy đủ 15 tiêu chí nghiệm thu trong [dac-ta-thiet-ke-bm02-den-bm04.md](file:///d:/DACN/dac-ta-thiet-ke-bm02-den-bm04.md).
- Bảo đảm tính **bất biến (immutability)** của mọi văn bản, chữ ký điện tử, quyết định, phụ lục và tệp PDF đã ký/ban hành.
- Cung cấp hàm phân giải tên đề tài chuẩn hóa `resolveEffectiveTopicTitle(registrationId, atTime)` dùng chung trên toàn hệ thống.
- Đảm bảo tính **nguyên tử (atomicity)**, **idempotency** và **optimistic locking** cho mọi thao tác ký, trả sửa, gia hạn, ban hành và chuyển trạng thái.
- Tương thích ngược 100% với phân hệ BM01 (`outlineReviewService`), phân hệ Hội đồng bảo vệ (`DEFENSE_COUNCIL`) và toàn bộ test suite hiện hữu.

### 2.2. Ngoài phạm vi (Non-Goals)
- Không tích hợp chứng thư số phần cứng PKI/CA bên thứ ba (sử dụng chữ ký điện tử mô phỏng nội bộ kèm băm SHA-256 `payloadHash`).
- Không thay đổi cấu trúc chấm điểm Rubric của Hội đồng bảo vệ cuối kỳ (Pha 5).
- Không tự động tạo phòng họp trực tuyến qua Microsoft Graph API.

### 2.3. Phản mục tiêu (Anti-Goals — Những điều tuyệt đối cấm dù code chạy được)
- **Cấm giả mạo chữ ký người dùng khi hết hạn:** Khi quá hạn 48h xác nhận BM03 của sinh viên hoặc quá hạn 7+3 ngày thẩm định của Viện, hệ thống chỉ được phép ghi nhận trạng thái hệ thống (`ACKNOWLEDGEMENT_TIMEOUT`, `SYSTEM_TIMEOUT` / `AUTO_TERMINATED` / `AUTO_NOT_ELIGIBLE`), tuyệt đối không tạo bản ghi chữ ký giả mang tên Sinh viên hay Admin.
- **Cấm thay đổi trạng thái trên API đọc (`GET`):** Mọi xử lý quá hạn phải đi qua Scheduled Sweep Jobs idempotent hoặc lệnh chốt tường minh.
- **Cấm ghi đè lịch sử:** Không sửa đè phiên bản BM02, BM02-A, buổi họp BM03 hay PDF đã phát hành; không dùng `onDelete: Cascade` làm mất hồ sơ đã ký.
- **Cấm cơ chế đi tắt (Bypass):** Không có nút hay API nào cho phép nhảy cóc qua BM02, Quyết định, BM03 hoặc BM04.
- **Cấm vi phạm quy chuẩn dự án (`AGENTS.md`):** Không dùng mô hình `group/groupMember`, không dùng dữ liệu giả (mock data), không chèn emoji/ký tự thô vào nhãn `Button`.

---

## 3. Ràng Buộc Kỹ Thuật & Nghiệp Vụ (Constraints)

1. **Mô hình `TopicRegistration` (`1 SV / 1 Đề tài`):** Mọi bảng mới đều neo vào `registrationId` (`TopicRegistration.id`), tuân thủ nghiêm ngặt quota 10 SV/GVHD.
2. **Múi giờ & Đơn vị thời gian:** Mọi phép tính hạn chót xử lý theo giờ dương lịch chuẩn (`Asia/Ho_Chi_Minh`):
   - Cửa sổ BM02-A: `decisionPublishedAt + 168 giờ` (7 ngày dương lịch).
   - Thời hạn Viện thẩm định dừng BM03 / từ chối bảo vệ BM04: `submittedAt + 168 giờ` (7 ngày dương lịch); gia hạn đúng 1 lần khi `REQUEST_MORE_INFO`: `currentDeadline + 72 giờ` (tổng tối đa 240 giờ = 10 ngày dương lịch).
   - Thời hạn sinh viên xác nhận BM03: `advisorSignedAt + 48 giờ` (2 ngày dương lịch).
3. **Khóa Policy Học kỳ (`periodPolicyVersionId`):**
   - `Semester` khóa phiên bản policy khi kích hoạt đợt. Nếu `TopicRegistration.periodPolicyVersionId` đang `null` tại thời điểm chuyển `BM01_PASSED` hoặc mở BM02, hệ thống chỉ kế thừa phiên bản policy đã khóa của đúng `semesterId` đó, không tự sinh hay lấy policy tùy ý.
4. **Chuẩn mã hóa & Giao diện:** Tất cả các tệp lưu định dạng **UTF-8 (no BOM)**; 100% nút bấm Frontend sử dụng icon từ `@ant-design/icons` qua prop `icon`, không chèn ký tự thô/emoji vào chuỗi text.

---

## 4. Các Phương Án Kiến Trúc Đã Cân Nhắc (Approaches)

| Phương án | Mô tả | Đánh đổi (Trade-offs) | Quyết định |
|---|---|---|---|
| **Phương án 1: Mở rộng Additive trên Schema hiện hữu** | Giữ và mở rộng không phá hủy các bảng hiện có (`BM02Submission`, `AssignmentDecision`, `BM04Evaluation`), đồng thời thêm các bảng mới còn thiếu (`BM02AAdjustmentRequest`, `TitleAdjustmentAppendix`, `BM03ProgressRecord`, `InstituteStopReview`, `InstituteDefenseReview`, `ElectronicSignatureEvent`), triển khai toàn bộ trong một đợt. | Giữ sạch schema, tương thích ngược tốt, nhưng nếu code toàn bộ 4 chặng trong 1 lần sẽ rất lớn. | Dùng làm nền tảng dữ liệu cho Phương án 3 |
| **Phương án 2: Tạo 14 bảng V2 song song độc lập** | Giữ nguyên các bảng cũ không đụng tới, tạo mới hoàn toàn 14 bảng trùng tên logic trong đặc tả. | Gây trùng lặp dữ liệu học vụ trên cùng một `TopicRegistration`, làm hỏng các truy vấn tổng hợp (Dashboard, Oversight, BM01 Reopen Guard) và 600+ bài test hiện hữu. | **Loại bỏ** |
| **Phương án 3: Kiến trúc Additive (PA1) + Thực thi cuốn chiếu 4 Đợt dọc** | Thực hiện Migration CSDL Additive và các dịch vụ lõi (Title Resolver, Signature & PDF Engine, Permissions) ngay từ đầu, sau đó triển khai cuốn chiếu 4 đợt dọc (Chặng 1A $\rightarrow$ Chặng 1B $\rightarrow$ Chặng 2 $\rightarrow$ Chặng 3 & Sweep Jobs). | Vừa bảo toàn tính toàn vẹn kiến trúc từ đầu đến cuối, vừa kiểm thử nghiệm thu dứt điểm từng chặng. | **Đã chọn** |

---

## 5. Thiết Kế Kỹ Thuật Chi Tiết (The How)

### 5.1. Ma Trận Phân Quyền & Phạm Vi Tài Nguyên (RBAC & Resource Scope)

Bổ sung 10 mã quyền chuẩn vào `backend/src/constants/permissions.js` và ánh xạ vào cơ chế kiểm tra:

| Mã Permission | Vai trò / Nhóm mặc định | Kiểm tra phạm vi tài nguyên (Resource Scope Guard) |
|---|---|---|
| `BM02_REVIEW` | Admin / Viện trưởng / Giáo vụ được ủy quyền | Kiểm tra `validateAcademicScope` theo khoa/viện của hồ sơ |
| `TOPIC_ASSIGNMENT_DECISION_ISSUE` | Admin / Viện trưởng (`VIEN_TRUONG`) | Toàn đợt đồ án (`semesterId`), đồng bộ với `PROJECT_ASSIGNMENT_PUBLISH` |
| `BM02A_ADVISOR_SIGN` | Giảng viên hướng dẫn (`LECTURER`) | Bắt buộc `registration.topic.mentorId === req.user.id` |
| `BM02A_FINAL_APPROVE` | Phụ trách bộ môn (`TRUONG_BO_MON` / Ủy quyền) | Kiểm tra `validateAcademicScope(tx, { actorId, registrationId, capabilityCode: 'BM02A_FINAL_APPROVE' })` khớp `department` của GVHD |
| `TITLE_ADJUSTMENT_APPENDIX_ISSUE` | Admin / Viện trưởng | Toàn đợt / theo quyết định gốc (`decisionId`) |
| `BM03_MEETING_RECORD` | Giảng viên hướng dẫn (`LECTURER`) | Bắt buộc `registration.topic.mentorId === req.user.id` |
| `BM03_STAGE_EVALUATE` | Giảng viên hướng dẫn (`LECTURER`) | Bắt buộc `registration.topic.mentorId === req.user.id` |
| `BM03_STOP_REVIEW` | Admin / Viện trưởng | Kiểm tra `validateAcademicScope` hoặc quyền cấp Viện |
| `BM04_CREATE_AND_SIGN` | Giảng viên hướng dẫn (`LECTURER`) | Bắt buộc `registration.topic.mentorId === req.user.id` |
| `BM04_REJECTION_REVIEW` | Admin / Viện trưởng | Kiểm tra `validateAcademicScope` hoặc quyền cấp Viện |

*(Quyết định của Builder: Giữ tương thích ngược với các mã quyền hiện hữu như `PROJECT_ASSIGNMENT_PUBLISH` bằng canonical alias trong `permissions.js` để không làm gãy cấu hình nhóm quyền cũ).*

---

### 5.2. Thiết Kế Mở Rộng Mô Hình Dữ Liệu (Additive Prisma Schema)

Tất cả các quan hệ tới dữ liệu đã ký/ban hành đều đặt `onDelete: Restrict`.

#### A. Nhóm Bảng Chữ Ký Điện Tử & Khóa Policy
1. **`Semester` & `TopicRegistration` (Mở rộng trường):**
   - `Semester`: Thêm `lockedPolicyVersionId Int? @map("locked_policy_version_id")`.
   - `TopicRegistration`: Thêm `decisionPublishedAt DateTime? @map("decision_published_at")` và `bm01ApprovedTitleSnapshot String? @map("bm01_approved_title_snapshot")`.
   - **Tương thích trạng thái `RegistrationStatus`:** Bổ sung các giá trị trạng thái còn thiếu vào enum `RegistrationStatus` (`BM02_OPEN`, `BM02_REVISION_REQUIRED`, `BM02_APPROVED`, `BM02_REJECTED`, `DEFENSE_ELIGIBLE`, `NOT_ELIGIBLE_FOR_DEFENSE`, `ELIGIBLE_BY_INSTITUTE`, `AUTO_NOT_ELIGIBLE`, `AUTO_TERMINATED`, `STOP_REVIEW_PENDING`). Ở tầng dịch vụ Hội đồng bảo vệ (Pha 5), chấp nhận cả `DEFENSE_READY` và `DEFENSE_ELIGIBLE` và `ELIGIBLE_BY_INSTITUTE` là đủ điều kiện xếp hội đồng bảo vệ.
2. **`ElectronicSignatureEvent` (Bảng mới — Lưu trữ chữ ký điện tử & hành động trả/từ chối):**
   - Trường: `id`, `registrationId Int`, `entityType String` (`BM02A_VERSION`, `BM03_MEETING`, `BM03_RECORD`, `BM04_EVALUATION`), `entityId Int`, `versionNumber Int @default(1)`, `signerId Int`, `signerRole String` (`STUDENT`, `ADVISOR`, `DEPARTMENT_HEAD`), `action String` (`SIGN`, `RETURN`, `REJECT`, `ACKNOWLEDGE`, `ACKNOWLEDGE_WITH_COMMENT`, `DECLINE_ACKNOWLEDGE`), `signedAt DateTime @default(now())`, `signatureImageId String?`, `payloadHash String`, `ipAddress String?`, `userAgent String?`, `rejectionOrReturnReason String? @db.Text`.
   - Index: `@@index([entityType, entityId, versionNumber])`, `@@index([registrationId])`.

#### B. Nhóm Bảng Chặng 1A — BM02 & Quyết Định Giao Đề Tài
1. **`BM02Submission` (Ánh xạ từ `BM02Application` — Mở rộng trên bảng hiện hữu):**
   - Bổ sung:
     - `bm01ApprovedTitle String? @map("bm01_approved_title")`
     - `bm02ProposedTitle String? @map("bm02_proposed_title")`
     - `titleChangeReason String? @map("title_change_reason") @db.Text`
     - `studentSnapshot Json? @map("student_snapshot")`
     - `mentorSnapshot Json? @map("mentor_snapshot")`
2. **`TopicAssignmentDecision` & `TopicAssignmentDecisionItem` (Bảng mới cho Quyết định theo đợt, đồng bộ với `AssignmentDecision`):**
   - `TopicAssignmentDecision`: `id`, `semesterId Int`, `decisionNumber String @unique`, `decisionDate DateTime`, `decisionPublishedAt DateTime?`, `fileUrl String?`, `fileName String?`, `issuedById Int`, `policyVersionId Int`, `status String @default("PUBLISHED")` (`DRAFT`, `PUBLISHED`), `idempotencyKey String @unique`, `createdAt DateTime @default(now())`.
   - `TopicAssignmentDecisionItem`: `id`, `decisionId Int`, `registrationId Int @unique`, `bm02SubmissionId Int @unique`, `approvedTitleSnapshot String`, `studentCodeSnapshot String`, `studentNameSnapshot String`, `mentorNameSnapshot String`, `createdAt DateTime @default(now())`.
   - Khi công bố quyết định (`publish`), cập nhật đồng thời `TopicRegistration.decisionNumber`, `decisionDate`, `decisionPublishedAt` và bản ghi `AssignmentDecision` để mọi màn hình cũ/mới đều đọc thống nhất.

#### C. Nhóm Bảng Chặng 1B — BM02-A & Phụ Lục Điều Chỉnh Tên
1. **`BM02AAdjustmentRequest` (Bảng mới):**
   - Trường: `id`, `registrationId Int`, `decisionId Int`, `status BM02AStatus @default(STUDENT_PREPARING)`, `revisionCount Int @default(0)`, `currentVersionNumber Int @default(1)`, `titleAdjustmentDeadline DateTime`, `finalPayloadHash String?`, `finalPdfFileUrl String?`, `createdById Int`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`.
   - Enum `BM02AStatus`: `STUDENT_PREPARING`, `PENDING_ADVISOR`, `RETURNED_FOR_CORRECTION`, `PENDING_DEPARTMENT_APPROVAL`, `APPROVED_PENDING_APPENDIX`, `REJECTED_FINAL`, `EXPIRED`, `ASSIGNED_TO_APPENDIX`, `ADJUSTMENT_ISSUED`.
2. **`BM02AFormVersion` (Bảng mới — Tối đa 2 phiên bản cho mỗi Request):**
   - Trường: `id`, `requestId Int`, `versionNumber Int` (`1` hoặc `2`), `studentSnapshot Json` (`fullName`, `studentCode`, `dateOfBirth`, `placeOfBirth`, `className`, `cohort`, `major`), `registeredTitleSnapshot String`, `proposedTitle String`, `reason String @db.Text`, `payloadHash String`, `studentSignatureEventId Int?`, `advisorSignatureEventId Int?`, `departmentSignatureEventId Int?`, `returnedByRole String?`, `returnReason String? @db.Text`, `returnedAt DateTime?`, `isLocked Boolean @default(false)`, `createdAt DateTime @default(now())`.
   - Unique: `@@unique([requestId, versionNumber])`.
3. **`TitleAdjustmentAppendix` & `TitleAdjustmentAppendixItem` (Bảng mới):**
   - `TitleAdjustmentAppendix`: `id`, `decisionId Int`, `appendixNumber String @unique`, `sequenceNo Int`, `signedDate DateTime`, `recordedAt DateTime @default(now())`, `fileUrl String?`, `fileName String?`, `issuedById Int`, `status AppendixStatus @default(DRAFT)` (`DRAFT`, `ISSUED`, `VOID`, `SUPERSEDED`), `supersedesAppendixId Int? @unique`, `idempotencyKey String? @unique`, `createdAt DateTime @default(now())`.
   - `TitleAdjustmentAppendixItem`: `id`, `appendixId Int`, `bm02aRequestId Int`, `registrationId Int`, `oldTitle String`, `newTitle String`, `createdAt DateTime @default(now())`.
   - Unique: `@@unique([appendixId, bm02aRequestId])`. Ràng buộc trong transaction: một `bm02aRequestId` không được xuất hiện trong 2 phụ lục đang có trạng thái `DRAFT` hoặc `ISSUED`.

#### D. Nhóm Bảng Chặng 2 — BM03 Theo Dõi Tiến Độ & Viện Thẩm Định Dừng
1. **`BM03ProgressRecord` (Bảng mới — Phiếu tổng hợp BM03 theo từng `registrationId`):**
   - Trường: `id`, `registrationId Int @unique`, `effectiveTitleSnapshot String`, `midtermStageEvaluationId Int? @unique`, `finalStageEvaluationId Int? @unique`, `finalConclusion String?` (`CONTINUE_TO_BM04`, `STOPPED`), `isClosedEarly Boolean @default(false)`, `advisorSignedById Int?`, `advisorSignedAt DateTime?`, `advisorPayloadHash String?`, `advisorSignatureEventId Int?`, `studentAckStatus BM03AckStatus?`, `studentAckDeadlineAt DateTime?`, `studentAckAt DateTime?`, `studentComment String? @db.Text`, `studentSignatureEventId Int?`, `finalPdfFileUrl String?`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`.
   - Enum `BM03AckStatus`: `PENDING_STUDENT_ACKNOWLEDGEMENT`, `ACKNOWLEDGED`, `ACKNOWLEDGED_WITH_COMMENT`, `DECLINED_TO_ACKNOWLEDGE`, `ACKNOWLEDGEMENT_TIMEOUT`.
2. **`BM03MeetingEntry` (Bảng mới — Nhật ký từng buổi hướng dẫn có chữ ký khóa của GVHD):**
   - Trường: `id`, `bm03RecordId Int`, `registrationId Int`, `versionNumber Int @default(1)`, `supersedesEntryId Int? @unique`, `meetingDate DateTime`, `meetingMode CouncilMeetingMode @default(IN_PERSON)`, `locationOrLink String`, `discussionContent String @db.Text`, `studentCompletedWork String @db.Text`, `remainingIssues String? @db.Text`, `nextTasks String @db.Text`, `expectedDeadline DateTime?`, `progressRating BM03ProgressRating` (`ON_TRACK`, `AT_RISK`, `BEHIND`, `NO_PROGRESS`), `evidenceFileUrl String?`, `evidenceFileName String?`, `advisorSignedById Int?`, `advisorSignedAt DateTime?`, `payloadHash String?`, `signatureEventId Int?`, `isLocked Boolean @default(false)`, `createdAt DateTime @default(now())`.
3. **`BM03StageEvaluation` (Bảng mới — Đánh giá giữa / cuối giai đoạn):**
   - Trường: `id`, `bm03RecordId Int`, `registrationId Int`, `stage BM03StageType` (`MIDTERM`, `FINAL`), `comments String @db.Text`, `decision BM03StageDecision` (`CONTINUE`, `CONTINUE_TO_BM04`, `PROPOSE_STOP`), `evaluatedById Int`, `evaluatedAt DateTime @default(now())`, `payloadHash String`.
4. **`InstituteStopReview` (Bảng mới — Viện thẩm định đề nghị dừng BM03):**
   - Trường: `id`, `bm03RecordId Int`, `stageEvaluationId Int @unique`, `registrationId Int`, `stage BM03StageType`, `status StopReviewStatus @default(STOP_REVIEW_PENDING)` (`STOP_REVIEW_PENDING`, `MORE_INFO_REQUIRED`, `STOP_APPROVED`, `STOP_REJECTED`, `AUTO_TERMINATED`), `stopProposalSubmittedAt DateTime @default(now())`, `stopReviewDeadline DateTime`, `extensionCount Int @default(0)`, `extendedAt DateTime?`, `moreInfoRequestedById Int?`, `moreInfoRequestNote String? @db.Text`, `moreInfoRespondedAt DateTime?`, `moreInfoResponseNote String? @db.Text`, `decision String?` (`APPROVE_STOP`, `REJECT_STOP`, `REQUEST_MORE_INFO`), `decisionSource String?` (`INSTITUTE_REVIEWER`, `SYSTEM_TIMEOUT`), `reviewedById Int?`, `reviewedAt DateTime?`, `reviewReason String? @db.Text`, `idempotencyKey String? @unique`.

#### E. Nhóm Bảng Chặng 3 — BM04 & Viện Thẩm Định Đề Nghị Không Cho Bảo Vệ
1. **`BM04Evaluation` (Mở rộng trên bảng hiện hữu):**
   - Bổ sung:
     - `effectiveTitleSnapshot String? @map("effective_title_snapshot")`
     - `studentClassSnapshot String? @map("student_class_snapshot")`
     - `programOutcome BM04ProgramOutcome? @map("program_outcome")` (`MEETS_PROGRAM_OUTCOMES`, `DOES_NOT_MEET_PROGRAM_OUTCOMES`)
     - `defenseRecommendation BM04DefenseRecommendation? @map("defense_recommendation")` (`APPROVE_FOR_DEFENSE`, `NOT_APPROVE_FOR_DEFENSE`)
     - `mismatchReason String? @map("mismatch_reason") @db.Text` (bắt buộc khi `MEETS_PROGRAM_OUTCOMES` nhưng `NOT_APPROVE_FOR_DEFENSE`)
     - `status BM04ReviewStatus @default(DRAFT)` (`DRAFT`, `SIGNED_APPROVED`, `PENDING_INSTITUTE_REVIEW`, `NOT_ELIGIBLE_FOR_DEFENSE`, `ELIGIBLE_BY_INSTITUTE`, `AUTO_NOT_ELIGIBLE`)
     - `payloadHash String? @map("payload_hash")`
     - `signatureEventId Int? @map("signature_event_id")`
     - `finalPdfFileUrl String? @map("final_pdf_file_url")`
   - Khi lưu nháp (`save-draft`), `isLocked = false`; khi ký nộp (`sign-submit`), kiểm tra đủ 4 tiêu chí + 2 kết luận, tạo `ElectronicSignatureEvent`, sinh PDF và khóa `isLocked = true`.
2. **`InstituteDefenseReview` (Bảng mới — Viện thẩm định khi GVHD không đồng ý cho bảo vệ):**
   - Trường: `id`, `bm04EvaluationId Int @unique`, `registrationId Int`, `status BM04ReviewStatus @default(PENDING_INSTITUTE_REVIEW)`, `submittedAt DateTime @default(now())`, `reviewDeadlineAt DateTime` (`+168h`), `extensionCount Int @default(0)`, `extendedAt DateTime?`, `moreInfoRequestedById Int?`, `moreInfoRequestNote String? @db.Text`, `moreInfoResponseNote String? @db.Text`, `decision String?` (`APPROVE_NOT_ELIGIBLE`, `OVERRIDE_ELIGIBLE`, `REQUEST_MORE_INFO`), `decisionSource String?` (`INSTITUTE_REVIEWER`, `SYSTEM_TIMEOUT`), `reviewedById Int?`, `reviewedAt DateTime?`, `reviewReason String? @db.Text`, `idempotencyKey String? @unique`.

---

### 5.3. Thuật Toán Phân Giải Tên Đề Tài Có Hiệu Lực (`resolveEffectiveTopicTitle`)

Hàm dùng chung đặt tại `backend/src/services/topicTitleResolverService.js`:

```javascript
async function resolveEffectiveTopicTitle(registrationId, atTime = new Date(), options = {})
```

Thứ tự ưu tiên:
1. Truy vấn `TitleAdjustmentAppendixItem` của `registrationId` thuộc `TitleAdjustmentAppendix` có `status = 'ISSUED'` và `signedDate <= atTime`, sắp xếp theo `appendix.signedDate DESC, appendix.sequenceNo DESC, item.id DESC`. Nếu tìm thấy, trả về `item.newTitle` kèm metadata nguồn (`source: 'APPENDIX'`, `appendixNumber`, `signedDate`).
2. Nếu không có phụ lục phù hợp, truy vấn `TopicAssignmentDecisionItem` thuộc `TopicAssignmentDecision` có `status = 'PUBLISHED'` (hoặc `AssignmentDecision` đã ban hành) của `registrationId`. Trả về `approvedTitleSnapshot`.
3. Nếu chưa ban hành quyết định giao đề tài:
   - Nếu đang ở bước lập quyết định và `BM02Submission` hiện hành đã `APPROVED`, dùng `bm02ProposedTitle || bm01ApprovedTitle || topic.title`.
   - Trong mọi trường hợp hiển thị chính thức sau quyết định, tuyệt đối không lấy tên đang chờ duyệt (`PENDING_ADVISOR`, `PENDING_DEPARTMENT_APPROVAL`, `APPROVED_PENDING_APPENDIX`) hoặc tên đề xuất nháp làm tên chính thức.

---

### 5.4. Cơ Chế Chữ Ký Điện Tử Nội Bộ & Sinh PDF Bất Biến

1. **Chuẩn hóa `payloadHash`:**
   - Dữ liệu nghiệp vụ của biểu mẫu được canonicalize (sắp xếp key JSON theo thứ tự bảng chữ cái) rồi băm SHA-256.
   - Với **BM02-A**: Cả 3 chữ ký (`STUDENT`, `ADVISOR`, `DEPARTMENT_HEAD`) trên cùng một `BM02AFormVersion` bắt buộc phải ký trên cùng `payloadHash`. Nếu sinh viên tạo `versionNumber = 2`, một `payloadHash` mới được sinh ra và cả Sinh viên lẫn GVHD phải ký lại từ đầu.
2. **Kết xuất PDF bằng `pdfkit` (`backend/src/services/academicPdfService.js`):**
   - Khi văn bản hoàn tất chữ ký (BM02-A đủ 3 chữ ký; BM03 sau khi GVHD ký và SV xác nhận hoặc hết hạn 48h; BM04 khi GVHD ký nộp hoặc khi Viện có kết luận cuối cùng), hệ thống kết xuất file PDF bất biến lưu vào thư mục lưu trữ/Supabase Storage, ghi nhận đường dẫn `finalPdfFileUrl` và không bao giờ ghi đè file đó.
   - Trường hợp quá hạn (`SYSTEM_TIMEOUT` hoặc `ACKNOWLEDGEMENT_TIMEOUT`), bản PDF in rõ dòng chữ hệ thống (ví dụ: *"Hồ sơ dừng theo cơ chế quá hạn thẩm định (SYSTEM_TIMEOUT)"* hoặc *"Sinh viên không xác nhận trong thời hạn 48 giờ (ACKNOWLEDGEMENT_TIMEOUT)"*), phần chữ ký của cá nhân tương ứng để trống.

---

### 5.5. Lộ Trình Thực Thi Cuốn Chiếu 4 Đợt Dọc (4 Phased Vertical Slices)

#### **Đợt 1: Nền tảng Schema, Title Resolver & Chặng 1A (BM02 + Quyết định giao đề tài)**
- Migration Prisma additive cho toàn bộ các bảng & enums mới; bổ sung 10 permissions vào `permissions.js`.
- Xây dựng `topicTitleResolverService.js`, `electronicSignatureService.js`, `academicPdfService.js`.
- Nâng cấp luồng mở BM02 khi `BM01_PASSED` (kế thừa đúng `lockedPolicyVersionId` của học kỳ).
- Nâng cấp API & UI nộp BM02 (`POST /api/bm02/applications/:registrationId/submit`, `request-revision`, `resubmit`, `approve`), cho phép sinh viên cập nhật cách diễn đạt tên đề tài (`bm02ProposedTitle` + `titleChangeReason`) mà vẫn giữ nguyên `bm01ApprovedTitle`, đồng bộ trạng thái `Task` (`SUBMITTED`, `REVISION`, `COMPLETED`).
- Nâng cấp API & UI Ban hành và Công bố Quyết định giao đề tài (`POST /api/topic-decisions`, `POST /api/topic-decisions/:id/publish`), ghi nhận `decisionPublishedAt` và mở cửa sổ 168 giờ cho BM02-A.

#### **Đợt 2: Chặng 1B — Luồng Ký 3 Bên BM02-A & Phụ Lục Điều Chỉnh Theo Đợt**
- Xây dựng Backend API cho BM02-A (`/api/bm02a/requests`, `student-sign-submit`, `advisor-sign`, `return`, `department-sign`, `revise`).
- Đảm bảo conditional update nguyên tử: `revisionCount = 0 AND now <= titleAdjustmentDeadline` khi tạo `versionNumber = 2`.
- Xây dựng Backend API cho Phụ lục điều chỉnh (`/api/title-adjustment-appendices`, `PUT items`, `POST issue`).
- Xây dựng Frontend UI:
  - Sinh viên: Modal lập, ký gửi BM02-A trong cửa sổ 168h, xem trạng thái 3 chữ ký và sửa lại bản v2 (nếu được trả sửa khi còn hạn).
  - GVHD & Phụ trách bộ môn: Hàng đợi thẩm định, ký điện tử hoặc trả sửa BM02-A.
  - Admin/Viện: Giao diện quản lý Phụ lục điều chỉnh theo đợt (`DRAFT` $\rightarrow$ thêm/gỡ BM02-A đạt $\rightarrow$ `ISSUED`).

#### **Đợt 3: Chặng 2 — Nhật Ký BM03, Đánh Giá Giữa/Cuối Giai Đoạn, Viện Thẩm Định Dừng (7+3 ngày) & Xác Nhận 48h**
- Xây dựng Backend API cho BM03 (`/api/bm03/:registrationId/meetings`, `meetings/:id/sign`, `midterm-evaluation`, `final-evaluation`, `stop-reviews/:id/decision`, `stop-reviews/:id/request-more-info`, `advisor-sign`, `student-acknowledge`, `student-decline`).
- Xây dựng Frontend UI:
  - GVHD (`ProgressTrackingPage.jsx`): Ghi & ký khóa từng buổi hướng dẫn (`ON_TRACK`, `AT_RISK`, `BEHIND`, `NO_PROGRESS`); lập đánh giá giữa kỳ (`CONTINUE` / `PROPOSE_STOP`) và cuối kỳ (`CONTINUE_TO_BM04` / `PROPOSE_STOP`); ký toàn phiếu BM03.
  - Admin/Viện: Hàng đợi thẩm định đề nghị dừng BM03 với đồng hồ đếm ngược SLA 7 ngày và nút yêu cầu bổ sung (+72h duy nhất 1 lần).
  - Sinh viên (`SubmissionPage.jsx` / `StudentDashboardPage.jsx`): Xem nhật ký BM03, xác nhận đã biết toàn phiếu BM03 trong 48 giờ (Ký xác nhận / Xác nhận kèm ý kiến / Từ chối ký kèm lý do).

#### **Đợt 4: Chặng 3 — Phiếu Nhận Xét BM04, Viện Thẩm Định Không Cho Bảo Vệ (7+3 ngày) & 5 Scheduled Sweep Jobs**
- Xây dựng Backend API cho BM04 (`POST /api/bm04/:registrationId/save-draft`, `sign-submit`, `defense-reviews/:id/decision`, `defense-reviews/:id/request-more-info`).
- Ràng buộc chặt chẽ: `DOES_NOT_MEET_PROGRAM_OUTCOMES` bắt buộc đi kèm `NOT_APPROVE_FOR_DEFENSE`; nếu `MEETS_PROGRAM_OUTCOMES` + `APPROVE_FOR_DEFENSE` thì chuyển ngay sang đủ điều kiện bảo vệ (`DEFENSE_READY` / `DEFENSE_ELIGIBLE`) trong cùng transaction.
- Xây dựng 5 Scheduled Sweep Jobs idempotent (`backend/src/services/bm02ToBm04SweepService.js`) và Outbox thông báo:
  1. Đóng cửa sổ BM02-A sau 168 giờ.
  2. Kết thúc (`EXPIRED`) các yêu cầu BM02-A đang ở trạng thái nháp/trả sửa không gửi lại kịp hạn.
  3. Tự động dừng (`AUTO_TERMINATED`, `decisionSource = SYSTEM_TIMEOUT`) khi Viện quá hạn thẩm định đề nghị dừng BM03.
  4. Tự động chuyển `ACKNOWLEDGEMENT_TIMEOUT` khi sinh viên không phản hồi BM03 sau 48 giờ và mở khóa BM04 (nếu kết luận là tiếp tục).
  5. Tự động chuyển `AUTO_NOT_ELIGIBLE` (`decisionSource = SYSTEM_TIMEOUT`) khi Viện quá hạn thẩm định BM04 không đồng ý bảo vệ.
- Xây dựng Frontend UI cho GVHD (Lưu nháp & Ký nộp BM04 4 tiêu chí + 2 kết luận), Admin/Viện (Thẩm định đề nghị không cho bảo vệ BM04) và Sinh viên (Xem phiếu nhận xét BM04 & PDF).

---

## 6. Những Phần Dành Cho Người Triển Khai (What's Left to the Builder)

1. **Bố cục chi tiết file PDF (`pdfkit`):** Căn lề, cỡ chữ, quốc hiệu tiêu ngữ và cách trình bày khung 3 chữ ký trên file PDF xuất ra của BM02-A, BM03 và BM04.
2. **Chi tiết thông tin nhân thân sinh viên trên BM02-A:** Lấy từ bảng `User` hiện hữu; các trường mở rộng (ngày sinh, nơi sinh, lớp, khóa, chuyên ngành) nếu chưa có cột riêng trên `User` có thể lưu/đọc từ metadata hồ sơ sinh viên (`StudentProjectEnrollment` / JSON profile) hoặc bổ sung cột nullable vào `User` để hiển thị trọn vẹn trên snapshot BM02-A.
3. **Giữ các route cũ làm Adapter:** Các endpoint cũ (`/api/registrations/bm02-submit`, `/api/registrations/bm02/:id/review`, `/api/semesters/:id/issue-decision`) sẽ ủy thác (delegate) vào cùng service với bộ route chuẩn mới ở Mục 9 để cả code cũ lẫn code mới đều hoạt động đồng nhất.

