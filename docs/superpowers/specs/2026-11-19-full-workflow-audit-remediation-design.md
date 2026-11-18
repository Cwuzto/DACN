# Thiết kế khắc phục audit toàn trình sáu giai đoạn

**Ngày:** 2026-11-19

**Nguồn:** `C:/Users/phucm/.gemini/antigravity/brain/2c623d87-b0d8-47b3-8cc9-153a8480800c/audit-greedy-full-workflow-2026-11-19.md`

**Trạng thái:** Ba phần thiết kế đã được người dùng đồng ý trong trao đổi; chờ duyệt văn bản trước khi lập kế hoạch triển khai.

## 1. Mục tiêu và phạm vi

Bao phủ **toàn bộ** 21 mục P0, 9 nhóm P1 và 6 nhóm P2 của báo cáo. Mỗi mục có trạng thái riêng: `CONFIRMED`, `NEEDS_REPRODUCTION`, `REPORT_CORRECTION`, `FIXED`, hoặc `NOT_REPRODUCIBLE`, kèm bằng chứng, bản vá và phép kiểm tra. Báo cáo là nguồn phát hiện, không thay thế quy tắc nghiệp vụ hay kết quả tái hiện trên code hiện tại.

Sửa theo **nguyên nhân gốc** và thứ tự CSDL/Prisma → backend service/controller/route/job → frontend → kiểm thử sáu giai đoạn. Các phần trùng với đặc tả chấm rubric và phân hội đồng đã duyệt được đánh dấu phụ thuộc/điểm giao; không triển khai cùng logic hai lần. Dùng `TopicRegistration`, một sinh viên/một đề tài (`maxStudents = 1`), tối đa 10 sinh viên/GVHD; không phục hồi `group/groupMember`.

## 2. Cách làm đã xem xét

1. **Vá từng dòng audit:** dễ theo dõi số mục nhưng dễ lặp sửa và bỏ qua nguyên nhân chung.
2. **Vá theo cụm nguyên nhân gốc — chọn:** một thay đổi xử lý tất cả triệu chứng liên quan, vẫn giữ bảng đối chiếu từng mã audit và kiểm thử lại toàn trình.

Phạm vi chia thành các kế hoạch nhỏ theo phụ thuộc: **nền dữ liệu/PDF**, **BM01–BM04 và học vụ**, **hội đồng/kết quả/lưu chiểu**, **giao diện/hợp đồng dữ liệu**, rồi **hồi quy toàn trình**. Một mục P0 có thể được chặn an toàn trước khi hoàn thiện tính năng mở rộng liên quan.

## 3. Điều chỉnh kết luận của báo cáo trước khi vá

- **P0.3:** `Semester` đã có trường cấu hình mốc nộp BM01 và PDF mẫu; phần thiếu nằm ở đường nhận/trả dữ liệu và form cấu hình. Không tạo lại cột trùng.
- **P0.5:** `POST /api/assets` trả `{id}` nhưng `HybridBMFormModal` đọc sai khóa nên báo upload thất bại. Fallback `/api/upload` chỉ chạy khi request đầu ném lỗi, không chạy sau mọi phản hồi thành công. Sửa hợp đồng phản hồi và kiểm tra riêng đường legacy để không còn lỗi `500` khi `req.file.buffer` không có.
- **P1.5:** `ReviewQueue` gọi phương thức thiếu qua optional chaining nên có thể rơi về dữ liệu dự phòng; kiểm tra lỗi mất thông tin/nút thực tế thay vì coi là crash trực tiếp.
- Các mục khác mới được đối chiếu **tĩnh**; trước khi sửa phải có test tái hiện hoặc log/request thực, nhất là P0.6 và các nhận định về hành vi UI/DB. Nếu không tái hiện, ghi kết luận và bằng chứng vào bảng đối chiếu.

## 4. Cụm nền dữ liệu, PDF và quy tắc trạng thái

- **Xóa đợt (P0.1):** Chỉ xóa cứng đợt mới/trống. Dọn các `PeriodWorkflowPolicyVersion` phụ thuộc trong cùng transaction trước khi xóa; nếu đợt đã có hồ sơ/nghiệp vụ, trả `409` có lý do thay vì lỗi FK `500`. Không cascade dữ liệu học vụ lịch sử.
- **PDF/asset (P0.8, P0.11, P0.21; BM04 và sweep job):** Giữ `StoredAsset.uploadedById` bắt buộc. Luồng do người dùng ký truyền đúng actor; job dùng một tài khoản hệ thống hợp lệ có thể truy vết, không dùng `null` hoặc ID `0`. Tạo asset và cập nhật URL PDF trong transaction hoặc trạng thái lỗi có thể thử lại; không nuốt lỗi để UI tưởng đã hoàn tất khi `finalPdfFileUrl` trống.
- **Rubric và điểm (P0.2, P0.17, P0.18):** Dùng tên trường `levelGoodDesc/FairDesc/AverageDesc/PoorDesc` xuyên suốt form, API và dữ liệu in; không xóa mô tả khi lưu. Phiếu chấm/`DefenseResult` ghim đúng phiên bản rubric của hội đồng/hồ sơ, không tự rơi về `v1` khi trả sổ. Khóa sổ cập nhật `Council.scoreBookLocked` đồng bộ với kết quả trong cùng giao dịch. Phần chấm nhanh rubric mới sẽ dùng hợp đồng đã sửa.
- **BM03/BM04 (P0.10, P0.12, P0.14):** Giá trị “trực tuyến” dùng enum được Prisma hỗ trợ (`MICROSOFT_TEAMS`) ở cả form và service. Khi Viện bác đề nghị dừng cuối kỳ, giải phóng liên kết chốt `finalStageEvaluationId` để GVHD đánh giá lại nhưng giữ lịch sử quyết định; không tự ký/chốt. Không tạo/sửa nháp BM04 khi `TopicRegistration` đã dừng hoặc không còn đủ điều kiện.
- **Quota (P1.1):** Dùng một bộ đếm hồ sơ hoạt động theo mọi trạng thái từ đăng ký đến sau BM01/BM02/BM03, kiểm tra tại tất cả đường duyệt/đổi GVHD. Không nhận quota 15/20 từ UI/Excel trái giới hạn 10.

## 5. Cụm backend học vụ, quyền và tác vụ nền

- **BM01 (P0.3, P0.5, P0.6, P1.2):** Nối đủ cấu hình thời gian/PDF mẫu từ `Semester` qua API và form. Upload governed asset nhận đúng `{id}`; nộp mới cần `assetId` thuộc actor và đúng PDF, `FAIL` giữ đúng kết quả thẩm định thay vì tự biến thành yêu cầu sửa. V1/v2 dùng một command duyệt; v2 `BM01_RESUBMITTED` không bị route cũ từ chối sai.
- **BM02/BM02-A (P0.7, P0.9, P1.5, P1.6):** Duyệt BM02 dùng command xác định trạng thái đích ở backend; UI không phải tự đoán `targetStatus`. Phụ lục BM02-A dùng cùng payload ở form và controller (`decisionId`, `appendixNumber`, `bm02aRequestIds`, `signedDate`). Đồng bộ enum BM02-A, đường đọc chi tiết và prop bản in với schema thật.
- **Phạm vi quyền (P0.13, P1.3, P1.9):** Viện trưởng được thao tác trên phạm vi Viện gồm các bộ môn trực thuộc; GVHD/Giáo vụ/Admin chỉ được đúng quyền đã cấp. Đồng bộ `registration-toggle`, phân công GVHD, bản tin nháp/file asset, lưu chiểu và chứng nhận giữa route, menu, `allowedActions` và backend. Không mở quyền toàn cục để che lỗi scope.
- **Job và phiên bản chính sách (P1.4, P1.7):** Cho phép tạo/nhân bản rubric nháp theo điều kiện nghiệp vụ, khóa với đúng đợt; chỉ một policy version active tại một thời điểm theo phạm vi. Đăng ký sweep job thiếu, thay `SYSTEM_ACTOR_ID=0` bằng actor hợp lệ và dùng advisory lock trên cùng connection/transaction. Job lỗi báo được và có thể chạy lại idempotent.
- **Thông báo (P0.15, P2.2):** Dùng giá trị `NotificationType` hợp lệ hoặc migration bổ sung loại thông báo lịch bảo vệ. Loại bỏ trường không thuộc schema (`isPromulgated`) khi công bố điểm. Gửi thông báo không được làm hỏng transaction chính sau khi dữ liệu đã chốt; lỗi gửi phải được ghi nhận để thử lại.

## 6. Cụm hội đồng, chấm điểm và lưu chiểu

- **Hội đồng (P0.4, P0.16, P1.9):** Bỏ select `Topic.code` không tồn tại. Đường phân tay/tự động kiểm cùng điều kiện BM04 đã khóa và trạng thái hồ sơ, chỉ tính thành viên `isActive`, cùng đợt và không trùng GVHD. Chặn đường auto/job có thể xóa thành viên hoặc tự gán sinh viên sai điều kiện; luồng xem trước/xác nhận của đặc tả phân hội đồng kế tiếp thay nó khi được triển khai. Màn hình hiển thị cả `DEFENSE_ELIGIBLE`/`ELIGIBLE_BY_INSTITUTE`, ca từ `defenseSessionShift` và chỉ thành viên hiệu lực.
- **Sổ điểm (P0.17–P0.19, P1.9):** Danh sách trung tâm hội đồng trả ID phiếu thành viên, điểm thô/làm tròn và trạng thái vắng mặt; UI dùng đúng dữ liệu lồng trong `defenseResult`. Trả sổ mở đúng phiếu và rubric ghim; sau khi chấm/khóa lại, Viện trưởng thấy hành động duyệt đúng lúc. Không hiển thị/công bố điểm từ phiếu chưa đủ điều kiện.
- **Lưu chiểu (P0.20, P0.21, P1.9, P2.1):** Video demo nhập **URL HTTPS** ở form đúng với backend; kiểm URL tại cả hai tầng. Hồ sơ `DEFENSE_FAILED`, `NOT_ELIGIBLE_FOR_DEFENSE`, `AUTO_TERMINATED` không được nộp file lưu chiểu. Màn hình kết quả đọc đúng danh sách file; biểu mẫu chứng nhận và scope Giáo vụ khớp API.

## 7. Cụm frontend và hợp đồng dữ liệu

Sửa từng màn tại nguồn dữ liệu thực, không chèn mock để vượt qua lỗi API. `RubricManagementPage`, `HybridBMFormModal`, `TopicApprovalPage`/`OutlineReviewModal`, `BM02ReviewDrawer`, `DecisionQueue`, `ProgressTrackingPage`, `SubmissionPage`, `BM04EvaluationModal`, `CouncilAssignmentPage`/`CouncilDetailPage`, `GradingDefensePage`, `ArchiveSubmissionModal`, `GradeViewPage` và các phiếu in được rà theo hợp đồng backend đã chốt.

Phiếu BM03/BM04 chưa đủ điều kiện hoặc đã ký/khóa có trạng thái chỉ đọc rõ, không tạo chữ ký/kết luận giả khi in. Trường bắt buộc có nhãn và lỗi cạnh trường; form nhiều lỗi có tóm tắt liên kết đến trường sai và nhận focus sau khi submit thất bại. Lỗi quyền/trạng thái hiển thị lý do từ backend; không chỉ toast chung. Phím Tab và màn hình 375px được kiểm tra. Nút có icon dùng prop `icon={<IconComponent />}` từ `@ant-design/icons`, nhãn thuần tiếng Việt.

## 8. Bảo vệ biên, báo cáo và dữ liệu in

- **P2.3–P2.6:** Tiêu đề PDF học vụ dùng “TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT”; xuất báo cáo rỗng vẫn có header và tên file UTF-8 hợp lệ; enum trạng thái báo cáo frontend khớp backend; `bm03Controller` kiểm ID đầu vào; bộ đếm buổi họp bỏ bản đã bị thay thế; `GET /registrations/my` trả đủ dữ liệu thật cho BM02/BM03 print sheets theo quyền.
- File text/code được lưu UTF-8 không BOM. Không tạo migration nếu trường đã có; không đổi dữ liệu lịch sử để làm test pass. Các lỗi hợp đồng trả `4xx` có mã/lý do rõ, lỗi hệ thống trả `5xx` có log nhưng không lộ thông tin nhạy cảm.

## 9. Bảng bao phủ và nghiệm thu

| Cụm | Mã audit cần đối chiếu |
|---|---|
| Nền dữ liệu/PDF/quota | P0.1, P0.2, P0.8, P0.10–P0.12, P0.14, P0.17–P0.18, P0.21; P1.1, P1.4, P1.7 |
| BM01–BM04 và quyền | P0.3, P0.5–P0.7, P0.9, P0.13; P1.2, P1.3, P1.5, P1.6, P1.8 |
| Hội đồng/kết quả/lưu chiểu | P0.4, P0.15–P0.20; P1.9; P2.1, P2.2 |
| Báo cáo/biên/in | P2.3–P2.6 |

Mỗi mã trong bảng phải có phép kiểm tái hiện và phép kiểm sau sửa, hoặc kết luận `REPORT_CORRECTION`/`NOT_REPRODUCIBLE` có bằng chứng. Kiểm thử theo hành trình Admin → Giáo vụ/Viện trưởng → GVHD/Hội đồng → Sinh viên trong sáu giai đoạn, trên đợt và CSDL thử nghiệm cách ly; không chạy bài test có ghi dữ liệu trên CSDL người dùng khi chưa xác định rõ môi trường. Chạy test backend/frontend và build theo từng cụm, rồi một lượt toàn trình cuối. Không coi build thành công là đủ để kết luận luồng nghiệp vụ đã sửa.
