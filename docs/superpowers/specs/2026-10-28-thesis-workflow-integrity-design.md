# Thiết kế hoàn chỉnh quy trình Đồ án Tốt nghiệp

- **Ngày:** 28/10/2026
- **Trạng thái:** Chờ người dùng rà soát đặc tả trước khi lập kế hoạch triển khai
- **Phạm vi:** Chuẩn hóa quy trình, state machine, dữ liệu, phân quyền và xử lý ngoại lệ từ đăng ký đề tài đến lưu chiểu.

## 1. Mục tiêu

Thiết lập một nguồn chân lý cho `TopicRegistration` và các thực thể liên quan. Hệ thống phải chặn mọi đường tắt nghiệp vụ, bảo toàn lịch sử pháp lý và xử lý có kiểm soát các ngoại lệ: BM01 không đạt, kháng nghị checkpoint, chuyển GVHD, điều chỉnh Quyết định, thay đổi hội đồng, thiếu/chênh điểm, lưu chiểu quá hạn.

## 2. Quyết định nghiệp vụ đã chốt

1. Mỗi sinh viên chỉ có một lần nộp lại BM01. Không đạt lần nộp lại hoặc quá hạn thì dừng với `TERMINATED_BM01`.
2. Mỗi checkpoint BM03 chỉ có một lần kháng nghị trong hạn. Admin/Viện trưởng phê duyệt thì chỉ mở lại checkpoint bị kháng nghị để GVHD chấm lại; quyết định cũ luôn được lưu.
3. Sau `DECISION_ISSUED`, không có luồng rút/hủy hồ sơ. Hồ sơ chỉ có thể đi tiếp hoặc dừng theo kết quả BM03, BM04, bảo vệ hoặc quy trình ngoại lệ có thẩm quyền.
4. Quyết định gốc không bị sửa/xóa. Sai sót hành chính được xử lý bằng `DecisionAmendment`, tham chiếu quyết định gốc và có người ký.
5. Chuyển GVHD cần Admin/Viện trưởng phê duyệt. GVHD mới kế thừa quyền còn hiệu lực từ thời điểm chuyển giao; BM04 đã ký không được chuyển hoặc sửa.
6. GVHD không bao giờ được chấm bảo vệ sinh viên mình hướng dẫn.
7. Ba thành viên hội đồng chấm độc lập và khóa phiếu riêng. Không tự động tính điểm từ thiếu phiếu; không quy điểm thiếu thành 0; không tự bỏ điểm thấp.
8. Chênh lệch vượt ngưỡng hoặc ngoại lệ thành viên phải có biên bản, người xử lý đúng thẩm quyền và lịch sử điểm gốc. Điểm cuối không tự động lấy trung vị, điểm Chủ tịch hoặc trung bình sau khi đã phát sinh bất đồng.
9. Lưu chiểu trước bảo vệ là điều kiện của `DEFENSE_READY`: báo cáo PDF, source/link repository, và slide hoặc video demo.
10. Hồ sơ lưu chiểu hậu bảo vệ là có phiên bản: SV có 14 ngày để hoàn thiện; GVHD/Admin có 7 ngày phản hồi; tối đa hai vòng sửa. Quá hạn chuyển `ARCHIVE_ESCALATED`; gia hạn phải có lý do và người có thẩm quyền.
11. `DEFENSE_FAILED` là không đạt học phần và không thể trở thành `COMPLETED` chỉ bằng lưu chiểu.

## 3. State machine chuẩn

```mermaid
flowchart TD
    A[PENDING] --> B[REGISTERED]
    B --> C[BM01_SUBMITTED]
    C -->|Đạt| D[BM01_PASSED]
    C -->|Chưa đạt hoặc vắng| E[BM01_NEEDS_REVISION]
    E -->|Nộp lại hợp lệ và được duyệt| D
    E -->|Hết hạn hoặc không đạt lần 2| F[TERMINATED_BM01]
    D --> G[BM02_SUBMITTED]
    G --> H[DECISION_ISSUED]
    H --> I[IN_PROGRESS_BM03]
    I -->|Checkpoint chưa đạt| J[CHECKPOINT_APPEAL_WINDOW]
    J -->|Được chấp thuận| I
    J -->|Hết hạn, bị bác hoặc chấm lại không đạt| K[TERMINATED_FAILED_PROGRESS]
    I -->|Đủ 2 checkpoint| L[BM03_PASSED]
    L --> M[BM04_REVIEW]
    M -->|Không đồng ý| N[TERMINATED_BM04]
    M -->|Đồng ý và đủ lưu chiểu| O[DEFENSE_READY]
    O --> P[DEFENSE_ASSIGNED]
    P --> Q[AWAITING_SCORES]
    Q -->|Thiếu phiếu hoặc thành viên| R[MEMBER_EXCEPTION_REVIEW]
    Q -->|Chênh lệch vượt ngưỡng| S[SCORE_VARIANCE_REVIEW]
    Q -->|Hội đồng không đủ điều kiện| T[DEFENSE_SESSION_EXCEPTION]
    R -->|Đã xử lý hợp lệ| Q
    S -->|Đã giải quyết hợp lệ| Q
    T -->|Được phép tiếp tục hoặc bố trí lại| P
    Q -->|Đủ điều kiện và đủ điểm hợp lệ| U[AWAITING_FINAL_APPROVAL]
    U -->|Đạt| V[DEFENSE_PASSED]
    U -->|Không đạt| W[DEFENSE_FAILED]
    V --> X[ARCHIVE_POST_DEFENSE_REVIEW]
    X -->|Đạt yêu cầu| Y[COMPLETED]
```

`TopicRegistration` chỉ lưu trạng thái flow chính. Phiếu chấm, sự tham gia hội đồng, kháng nghị và lưu chiểu là thực thể phụ trợ; không nhồi trạng thái chi tiết của chúng vào một cột trạng thái đăng ký.

## 4. Invariant bắt buộc ở backend

| Mã | Điều kiện bất biến |
| --- | --- |
| INV-01 | Không chuyển sang `IN_PROGRESS_BM03` trước `DECISION_ISSUED`. |
| INV-02 | Không mở `BM04_REVIEW` nếu chưa `BM03_PASSED`. |
| INV-03 | Không tạo `DEFENSE_READY` nếu BM04 chưa chấp thuận hoặc lưu chiểu trước bảo vệ thiếu tối thiểu. |
| INV-04 | Không chốt điểm khi thiếu phiếu bắt buộc hoặc hội đồng không hợp lệ, trừ ngoại lệ được quy chế cho phép và đã phê duyệt. |
| INV-05 | Không tính điểm thiếu thành 0; không tự loại điểm của thành viên có điểm thấp. |
| INV-06 | Không chuyển `DEFENSE_FAILED` sang `COMPLETED` chỉ vì hoàn thành lưu chiểu. |
| INV-07 | Không xóa hoặc ghi đè Quyết định, phiếu chấm và lịch sử trạng thái đã xác nhận. |
| INV-08 | Không cho hai yêu cầu đồng thời chuyển hồ sơ sang hai nhánh không tương thích. |
| INV-09 | BM01 chỉ được nộp lại một lần và luôn gắn với kết quả BM01 bị yêu cầu sửa. |
| INV-10 | Mỗi checkpoint chỉ có tối đa một kháng nghị, gắn với checkpoint, quyết định cũ, hạn và người duyệt. |
| INV-11 | Chỉ thành viên hợp lệ tại thời điểm bảo vệ được tạo/khóa phiếu chấm; GVHD bị cấm. |
| INV-12 | Transition chạy trong transaction, kiểm tra trạng thái kỳ vọng và phiên bản để chống race condition. |

## 5. Dữ liệu và phân quyền

| Thực thể | Trách nhiệm |
| --- | --- |
| `TopicRegistration` | Trạng thái chính, `stateVersion`, mốc thời gian. |
| `RegistrationStateHistory` | Lịch sử transition append-only, actor, lý do, dữ liệu tham chiếu. |
| `CheckpointAppeal` | Một kháng nghị/checkpoint: quyết định cũ, chứng cứ, hạn, phê duyệt và kết quả chấm lại. |
| `MentorTransfer` | GVHD cũ/mới, lý do, thời điểm hiệu lực, người duyệt. |
| `DecisionAmendment` | Quyết định điều chỉnh, tham chiếu QĐ gốc, lý do, danh sách hồ sơ tác động, người ký. |
| `CouncilMemberParticipation` | Có mặt, vắng, thay thế hoặc rời buổi của từng thành viên. |
| `DefenseSessionException` | Sự cố buổi bảo vệ, hướng xử lý và quyết định có thẩm quyền. |
| `DefenseResolution` | Biên bản thiếu thành viên/chênh lệch, điểm gốc, giải trình, điểm cuối và phê duyệt. |
| `ProjectArchiveVersion` | Các phiên bản trước/sau bảo vệ, vòng phản hồi, hạn và kết quả nghiệm thu. |
| `PeriodWorkflowPolicy` | Cấu hình từng đợt: hạn, ngưỡng chênh lệch, số phiếu tối thiểu, công thức điểm, vòng sửa. |

- **SV:** nộp BM, kháng nghị một lần, nộp hồ sơ lưu chiểu.
- **GVHD hiện hành:** chấm BM03, ký BM04, nghiệm thu lưu chiểu; không chấm bảo vệ.
- **Thành viên hội đồng:** chỉ tạo/khóa phiếu của hồ sơ được phân công hợp lệ.
- **Chủ tịch:** lập biên bản xử lý; không tự ghi đè điểm thành viên.
- **Admin/Viện trưởng:** duyệt kháng nghị, chuyển GVHD, điều chỉnh QĐ, ngoại lệ hội đồng và chốt điểm theo policy.

## 6. Kế hoạch triển khai

### Giai đoạn 0 — Đặc tả và mapping dữ liệu

- Cập nhật tài liệu workflow, data architecture, RBAC thành nguồn chân lý mới.
- Lập mapping trạng thái cũ sang trạng thái mới; hồ sơ không suy luận được phải vào `MANUAL_REVIEW`.
- Chốt cấu hình mặc định của `PeriodWorkflowPolicy`.

### Giai đoạn 1 — Guard P0 cho luồng hiện hữu

- Chỉ ban hành QĐ cho `BM02_SUBMITTED`.
- BM04 chỉ sau `BM03_PASSED` và do GVHD hiện hành ký.
- Xóa endpoint/UI/logic bypass; đưa dữ liệu bypass cũ vào `MANUAL_REVIEW`.
- Cấm GVHD chấm bảo vệ sinh viên mình hướng dẫn.
- Bắt buộc đủ phiếu và thành phần hội đồng trước khóa điểm.
- Chặn `DEFENSE_FAILED` đi vào `COMPLETED`; cấm rút sau QĐ.
- Bắt buộc đủ ba vai trò trước tạo/cập nhật/gán hội đồng.

### Giai đoạn 2 — State machine và migration

- Migration enum và các bảng trong mục 5.
- Thêm `stateVersion`, `RegistrationStateHistory`.
- Tạo một state-transition service duy nhất; controller không cập nhật `registration.status` trực tiếp.
- Migration thử trên bản sao DB, báo cáo mapping và rollback script.

### Giai đoạn 3 — Nghiệp vụ trước bảo vệ

- BM01 một lần sửa; BM02/QĐ; QĐ điều chỉnh.
- Đổi tên đúng trạng thái/hạn/GVHD hiệu lực.
- Kháng nghị checkpoint và chuyển GVHD.
- Kiểm tra bộ lưu chiểu trước bảo vệ trước `DEFENSE_READY`.

### Giai đoạn 4 — Hội đồng và kết quả bảo vệ

- Quản lý tham gia/thay thế thành viên và sự cố buổi bảo vệ.
- Phiếu chấm độc lập, thiếu điểm, chênh lệch và biên bản xử lý.
- Chốt `DEFENSE_PASSED` hoặc `DEFENSE_FAILED` theo policy.

### Giai đoạn 5 — Lưu chiểu hậu bảo vệ

- Version hóa lưu chiểu, hạn 14/7 ngày, tối đa hai vòng sửa, escalation và gia hạn có lý do.
- Chỉ bản được nghiệm thu mới chuyển `COMPLETED`.

### Giai đoạn 6 — UI và nghiệm thu

- UI Student/Lecturer/Admin bám state machine; không có bypass hoặc trạng thái giả.
- Unit test invariant; integration test transition/race condition; E2E happy path và từng case ngoại lệ.
- UAT ba vai trò trên database migration thử trước production.

## 7. Tiêu chí nghiệm thu tổng thể

1. API không có đường nào vi phạm INV-01 đến INV-12.
2. Mọi thay đổi pháp lý/học vụ quan trọng đều append-only, có actor, thời gian, lý do và dữ liệu trước/sau.
3. UI không hiển thị hành động mà backend không chấp nhận.
4. Migration không làm mất hồ sơ; các bản ghi mơ hồ được phân loại để rà soát thủ công.
5. Mọi nhánh state machine và ngoại lệ có test tự động.
