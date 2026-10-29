# Phê duyệt Kết quả Bảo vệ và Công bố Theo Đợt

**Ngày:** 29/10/2026
**Phạm vi:** tách phê duyệt kết quả bảo vệ theo từng hồ sơ khỏi công bố chính thức theo đợt/học kỳ.

## 1. Bối cảnh và mục tiêu

Hệ thống hiện có quyền khóa điểm (`RESULT_LOCK`) và quyền công bố (`RESULT_PUBLISH`), nhưng chưa có workflow backend để phê duyệt kết quả chính thức hoặc phát hành snapshot công bố. Điểm đã khóa không được đồng nghĩa với kết quả đã được phê duyệt hay đã công bố.

Mục tiêu là cho phép xử lý độc lập từng `TopicRegistration` đủ điều kiện, đồng thời chỉ công bố chính thức bằng một lệnh có kiểm soát theo đợt/học kỳ. Lịch sử công bố phải bất biến, truy vết được và hỗ trợ công bố bổ sung hoặc điều chỉnh theo quy chế.

Ngoài phạm vi: thay đổi kiến trúc `TopicRegistration`, khôi phục `group/groupMember`, hoặc suy ra kết quả từ dữ liệu giao diện/điểm tạm.

## 2. Quyết định nghiệp vụ

### 2.1. Phê duyệt theo hồ sơ

Mỗi hồ sơ chỉ được chuyển từ `AWAITING_FINAL_APPROVAL` sang `DEFENSE_PASSED` hoặc `DEFENSE_FAILED` sau khi actor có `DEFENSE_RESULT_APPROVE` phê duyệt. Điều kiện tối thiểu là phiên bảo vệ hiện hành có đủ ba nghĩa vụ/ba phiếu chấm hợp lệ, tất cả điểm thành viên đã khóa, `DefenseResult` tổng hợp đã khóa và mọi guard workflow hiện hữu đã thỏa.

Mỗi quyết định phê duyệt là một bản ghi bất biến, lưu độc lập theo hồ sơ cùng kết quả, điểm chốt, người duyệt, thời điểm duyệt, phiên bản chính sách, nhận diện bộ điểm/phiên bảo vệ đã khóa, ghi chú/lý do và audit. Hồ sơ chưa hợp lệ không ngăn các hồ sơ độc lập khác được phê duyệt.

### 2.2. Công bố theo học kỳ

`ResultPublication` thuộc một học kỳ và đại diện cho một phiên công bố có kiểm soát. Loại phiên là `INITIAL`, `SUPPLEMENTARY` hoặc `CORRECTION`.

Lệnh công bố chỉ chọn các phê duyệt hợp lệ trong học kỳ ở thời điểm transaction chạy; không nhận kết quả, điểm hoặc danh sách tin cậy từ UI. Nó tạo snapshot các dữ liệu đủ điều kiện vào `ResultPublicationItem`.

Phiên `SUPPLEMENTARY` hoặc `CORRECTION` phải có lý do và liên kết tới phiên công bố trước phù hợp. Snapshot cũ không được sửa hoặc xóa. Sai sót sau công bố được xử lý bằng approval điều chỉnh có audit và một phiên `CORRECTION` mới.

## 3. Invariant

| Mã | Điều kiện |
| --- | --- |
| INV-28 | Chỉ approval hợp lệ mới được đưa vào công bố chính thức. |
| INV-29 | Snapshot công bố bất biến; không sửa hoặc xóa lịch sử đã xác nhận. |
| INV-30 | Mỗi phiên có học kỳ, phạm vi hồ sơ, thời điểm và actor có thẩm quyền rõ ràng. |
| INV-31 | Công bố bổ sung/điều chỉnh phải liên kết phiên trước, có lý do, authority và audit. |
| INV-32 | Không suy ra kết quả hồ sơ chưa phê duyệt từ task, điểm tạm hoặc giao diện. |
| INV-33 | Request lặp/concurrent không tạo phiên công bố trùng; phải idempotent và kiểm soát đồng thời. |
| INV-34 | Một approval chỉ hợp lệ cho đúng bộ điểm/phiên bảo vệ và policy version mà nó đã tham chiếu. |
| INV-35 | Không có hai approval cùng hiệu lực cho một hồ sơ tại cùng thời điểm. |
| INV-36 | Không có hồ sơ nào được công bố trùng trong phạm vi publication không phải điều chỉnh. |

## 4. Mô hình dữ liệu

### 4.1. Approval theo hồ sơ

Thêm `DefenseResultApproval` theo mô hình lịch sử một-nhiều với `TopicRegistration`; mỗi quyết định là bất biến. Bản ghi có `registrationId`, `outcome` (`PASSED`/`FAILED`), `finalScore`, `approvedById`, `approvedAt`, `policyVersionId`, nhận diện phiên bảo vệ/hội đồng hiện hành, tham chiếu `DefenseResult` đã khóa và phiên bản rubric/bộ `DefenseMemberScore` đã khóa, `reason`, `notes`, `supersedesApprovalId`, trạng thái hiệu lực và timestamps.

Một hồ sơ có nhiều approval lịch sử nhưng tối đa một approval đang hiệu lực. Khi điểm, phiên bảo vệ hoặc policy version đổi qua một workflow ngoại lệ được phép, approval cũ tự mất hiệu lực để không được công bố lại. Điều chỉnh tạo approval mới tham chiếu quyết định trước, kèm căn cứ/lý do/audit; không update âm thầm approval hay snapshot đã công bố.

### 4.2. Publication và snapshot

`ResultPublication` gồm `semesterId`, `type`, `previousPublicationId` nullable, `reason`, `publishedById`, `publishedAt`, `idempotencyKey`, timestamps và các item snapshot.

`ResultPublicationItem` lưu `publicationId`, `registrationId`, tham chiếu approval, outcome snapshot, final score snapshot, tên/mã sinh viên snapshot và tiêu đề đề tài snapshot. Với `CORRECTION`, item còn tham chiếu item publication trước mà nó thay thế. Các trường snapshot giữ nguyên cả khi dữ liệu nguồn đổi về sau.

Migration phải additive, có foreign key/index đúng scope, unique key cho idempotency theo actor/học kỳ và ràng buộc một item cho mỗi registration trong một publication. Transaction publication phải kiểm tra toàn bộ lịch sử theo học kỳ: `INITIAL` chỉ đưa mỗi hồ sơ vào phạm vi ban đầu một lần; `SUPPLEMENTARY` chỉ nhận hồ sơ hợp lệ chưa được công bố; `CORRECTION` chỉ thay thế item được chỉ định của publication trước. Prisma/model guard, ranh giới service và quyền DB chặn update/delete publication/item sau khi xác nhận.

## 5. API và phân quyền

### 5.1. Approval

`POST /api/registrations/:id/defense-result/approve` yêu cầu `DEFENSE_RESULT_APPROVE`. Backend kiểm tra capability còn hiệu lực, phạm vi học kỳ/ủy quyền tại thời điểm thực thi, trạng thái `AWAITING_FINAL_APPROVAL`, ba phiếu hợp lệ đã khóa, `DefenseResult` hiện hành đã khóa và policy version khớp. Payload chỉ nhận outcome cùng reason/notes; backend tự lấy final score và fingerprint/phiên bản bộ điểm.

Trong transaction serializable, backend khóa hồ sơ/bộ điểm liên quan, xác minh điều kiện, vô hiệu hóa approval hiện hành nếu là điều chỉnh được phép, tạo approval mới, chuyển `TopicRegistration` sang `DEFENSE_PASSED` hoặc `DEFENSE_FAILED`, rồi ghi audit. Thiếu capability hoặc ngoài scope trả `403`; resource không tồn tại trả `404`; state/input sai trả `400`; tranh chấp concurrent trả `409`.

### 5.2. Publication

`POST /api/semesters/:semesterId/result-publications` yêu cầu `RESULT_PUBLISH`. Backend kiểm tra capability còn hiệu lực, phạm vi học kỳ/ủy quyền tại thời điểm thực thi. Payload nhận loại phiên, lý do khi là bổ sung/điều chỉnh, liên kết publication/item trước khi bắt buộc và `Idempotency-Key`. Backend tự resolve approval hợp lệ đúng học kỳ và tạo cả publication/item snapshot trong transaction serializable.

Cùng idempotency key phải trả lại publication đã tạo. Dù khác idempotency key, transaction vẫn từ chối scope chồng lấp: `INITIAL` không lặp registration, `SUPPLEMENTARY` không chứa registration đã công bố và `CORRECTION` phải thay thế item được chỉ định bằng approval mới hợp lệ. Lỗi giữa lúc tạo header/item phải rollback toàn bộ. Không có endpoint update/delete snapshot. Endpoint read lịch sử/công bố cần `RESULT_PUBLISH`; sinh viên chỉ đọc item snapshot đã công bố của chính hồ sơ sở hữu.

## 6. Giao diện

Sổ điểm bảo vệ hiển thị riêng các giai đoạn: `AWAITING_SCORES`, `AWAITING_FINAL_APPROVAL`, kết quả đạt/không đạt đã phê duyệt và đã công bố. `DEFENSE_FAILED` là kết quả bảo vệ đã phê duyệt có thể công bố, nhưng không làm hồ sơ đủ điều kiện chuyển sang `COMPLETED`. Người có `DEFENSE_RESULT_APPROVE` thấy thao tác phê duyệt trên từng hồ sơ đủ điều kiện.

Màn hình công bố theo học kỳ dành cho người có `RESULT_PUBLISH`: xem trước tập snapshot do backend trả về, chọn loại publication, nhập lý do theo loại và xác nhận modal có thống kê hồ sơ bao gồm/loại trừ. Lịch sử chỉ đọc hiển thị mã phiên, loại, actor, thời điểm, số item, lý do và liên kết phiên trước.

Trang sinh viên chỉ hiển thị kết quả từ snapshot công bố của hồ sơ sở hữu. Không hiển thị điểm tạm hoặc approval nội bộ dưới dạng kết quả chính thức.

## 7. Kiểm thử và rollout

1. Migration thêm enum/model/index và permission `DEFENSE_RESULT_APPROVE`; migration mapping quyền phải nêu rõ các group được cấp, không tự cấp cho mọi `ADMIN`.
2. Integration test approval: `401`, `403`, state sai, chưa khóa đủ ba phiếu, policy/bộ điểm sai phiên bản, approval hợp lệ, audit và hai request concurrent không tạo hai approval hiệu lực.
3. Integration test publication: chỉ lấy approval hợp lệ đúng học kỳ, không tin danh sách từ UI, `INITIAL`/`SUPPLEMENTARY` chống chồng lấp giữa hai idempotency key, `CORRECTION` liên kết item/approval trước và rollback toàn bộ nếu tạo header/item lỗi.
4. Test snapshot: thay tên sinh viên, tiêu đề đề tài hoặc approval nguồn sau công bố không đổi item snapshot; không có service/API/DB path hợp lệ để update/delete snapshot xác nhận.
5. Test permission separation: `RESULT_LOCK` không cho approval/publication; `DEFENSE_RESULT_APPROVE` không cho publication; `RESULT_PUBLISH` không cho approval.
6. Test student ownership: không đọc approval nội bộ hay snapshot hồ sơ khác; chỉ đọc snapshot chính hồ sơ sau công bố.
7. Chạy Prisma validate/migrate status, toàn bộ backend Jest, frontend tests, Vite build và kiểm tra UTF-8 no BOM cho file đổi.

## 8. Tiêu chí nghiệm thu

1. Hồ sơ đủ điều kiện được phê duyệt độc lập với đúng bộ điểm/policy và không có hai approval hiệu lực.
2. Công bố tạo snapshot theo học kỳ mà không lấy hồ sơ chưa approval hoặc sai phiên bản điểm.
3. Snapshot/lịch sử công bố không thể bị sửa hoặc xóa qua API, service hoặc thay đổi dữ liệu nguồn.
4. Bổ sung/điều chỉnh có predecessor, item thay thế, lý do, actor và audit.
5. Retry/concurrent/khác idempotency key không tạo publication hay item chồng lấp trái quy tắc.
6. UI chỉ phản ánh thành công sau API thực; sinh viên chỉ xem kết quả đã công bố của chính mình.
