# Thiết kế tổng quan theo việc tiếp theo cho Admin, GVHD và sinh viên

**Ngày:** 20/11/2026
**Trạng thái:** Thiết kế trong hội thoại đã được duyệt; chờ người dùng rà soát đặc tả viết

## 1. Mục tiêu

Ba trang tổng quan phải trả lời ngay “Tôi cần làm gì tiếp theo trong đợt này?”. Admin thấy việc thuộc quyền mình, GVHD thấy việc cần xử lý và sinh viên cần theo dõi, sinh viên thấy một bước tiếp theo rõ ràng. Thẻ và chỉ số lấy từ dữ liệu nghiệp vụ thật, đổi theo những việc đang phát sinh trong đợt được chọn; không gắn một giai đoạn chung cho mọi sinh viên.

## 2. Hiện trạng và ranh giới

- `frontend/src/pages/admin/DashboardPage.jsx` có ba thẻ cố định. “Đề tài chờ BCN phê duyệt” đang lấy `TopicRegistration.PENDING` (chờ GVHD), “Chưa gắn Hội đồng bảo vệ” gộp cả thiếu HĐ đề cương, và “Hội đồng chấm bảo vệ” lấy thống kê không lọc đúng loại hội đồng. `statsQuery` còn không theo `selectedSemesterId`, nên số thẻ có thể khác đợt đang chọn.
- Admin dashboard có mốc “Đạt/HIỆN TẠI” cố định, `completionRate || 64`, phân bổ chuyên ngành và tỷ lệ tĩnh, năm học mặc định, lối tắt thiên về giai đoạn bảo vệ. Các vùng này tạo cảm giác có dữ liệu dù luồng đang ở bước GVHD duyệt nguyện vọng.
- GVHD đã có API `GET /api/dashboard/lecturer` và `attentionItems`, nhưng hồ sơ `APPROVED` chưa nộp BM01 chưa nằm trong danh sách theo dõi. KPI vẫn cố định theo loại.
- Sinh viên đã có `GET /api/dashboard/student`, nhưng chưa có một khối bước tiếp theo xuyên giai đoạn; một số mã đề tài, quyết định, ngày và tỷ lệ mặc định đang trông như dữ liệu thật.
- Phạm vi là ba dashboard và job nhắc BM01. Không thay quy tắc đăng ký, duyệt BM01/BM02, phân hội đồng, chấm điểm hoặc mẫu biểu. Giữ `TopicRegistration`, 1 SV/1 đề tài, tối đa 10 SV/GVHD; không dùng `group/groupMember`.

## 3. Hướng thiết kế đã chọn

Các backend service tạo **mục công việc theo actor, đợt và trạng thái hồ sơ**. Mỗi mục có `kind`, `count` hoặc `registrationId`, `title`, `description`, `dueAt` khi có hạn thật, `target`, `requiredPermission`, `priority`, `sourceStatus`. URL đích và bộ lọc phải đưa người dùng tới đúng hàng/hồ sơ cần xử lý. Frontend không suy ra quyền từ role hay tự gắn trạng thái “hiện tại”.

Không tạo một bảng workflow mới chỉ để phục vụ dashboard. Quy tắc đọc từ `TopicRegistration`, `Semester`, topic, BM01/BM02, hội đồng, BM03/BM04 và trạng thái công bố kết quả hiện có. Các mục có thể cùng tồn tại ở nhiều chặng vì sinh viên tiến độ khác nhau. Đếm theo registration duy nhất trong từng loại việc; không cộng trùng BM01 với BM02 hoặc HĐ đề cương với HĐ bảo vệ.

Ba hướng đã cân nhắc: (1) logic riêng trong từng trang, dễ triển khai trước mắt nhưng trạng thái và quyền dễ lệch; (2) một “giai đoạn hiện tại” cho cả đợt, đơn giản nhưng sai khi hồ sơ tiến độ khác nhau; (3) **nguồn việc backend theo từng hồ sơ + trình bày theo vai trò**, được chọn vì dữ liệu và quyền nhất quán mà vẫn giữ trải nghiệm riêng cho từng vai trò.

## 4. Tổng quan Admin

Admin chỉ thấy **việc mình có quyền trực tiếp xử lý**. Không đưa các nhiệm vụ chờ GVHD hoặc SV vào hàng đợi Admin. Với đợt đang chọn, vùng đầu là “Việc cần xử lý”: số thẻ **thay đổi theo các loại việc có count > 0**, tối đa ba thẻ ưu tiên; phần còn lại nằm trong danh sách công việc. Nếu không có việc thuộc quyền, hiện “Chưa có việc cần xử lý trong đợt này”, kể cả khi sinh viên đang chờ nộp BM01.

Danh mục nguồn việc được áp dụng khi nghiệp vụ đã tới trạng thái hợp lệ và actor có permission/scope:

| Loại việc | Điều kiện đếm | Đích |
|---|---|---|
| Duyệt đề tài | Topic thực sự chờ thẩm định bởi Admin/Viện, không dùng registration `PENDING` của GVHD | Danh sách đề tài lọc chờ duyệt |
| Phân hội đồng đề cương | Registration đủ điều kiện để API phân HĐ đề cương nhận và chưa được phân; không đếm mọi hồ sơ thiếu HĐ | `/admin/outline-councils` hoặc trang phân công cùng bộ lọc đợt |
| Thẩm định BM02 / ban hành quyết định | BM01 đã đạt, BM02 đã nộp và còn bước thuộc thẩm quyền Admin/Viện | Trang nghiệp vụ BM02/điều phối đúng đợt |
| Phân hội đồng bảo vệ | Chỉ hồ sơ đủ điều kiện `DEFENSE_READY`/quy tắc hiện hành và chưa có HĐ bảo vệ | `/admin/defense-councils` |
| Duyệt, khóa, công bố kết quả | Chỉ record đã đến bước tương ứng, quyền tương ứng và chưa hoàn thành | `/admin/grading` với tab/bộ lọc phù hợp |

Mục sau trong quy trình không được đặt lên đầu chỉ vì một số tổng cộng lớn hơn. Ưu tiên theo quá hạn/cần làm ngay, rồi hạn thật và thứ tự nghiệp vụ. Không gán “quá hạn” nếu không có deadline. Khi actor thiếu quyền, không trả mục hoặc số đếm nhạy cảm. Ba thẻ hiện tại được thay bằng dữ liệu danh mục này, không cố giữ ba vị trí.

Các vùng còn lại: bộ chọn đợt nhất quán cho mọi truy vấn; lộ trình đợt từ trạng thái tổng hợp thực và không ghi cứng “Đạt/HIỆN TẠI”; thống kê phụ chỉ hiện khi có nguồn thật và có ích ở giai đoạn đó. Bỏ phân bổ chuyên ngành tĩnh, `64%` mặc định, năm học/quyết định/ngày giả và shortcut gây hiểu lầm. Nếu muốn giữ biểu đồ điểm, chỉ hiện khi có kết quả được phép xem của đúng đợt.

## 5. Tổng quan GVHD

Vùng **Việc cần làm** chứa hành động thuộc GVHD: đăng ký nguyện vọng chờ duyệt, BM01 nộp lại cần thẩm định, BM02-A chờ ký/duyệt, bài nộp cần phản hồi, BM03/BM04 khi thực sự đến bước GVHD. Mục được cấp khi backend xác nhận quyền và trạng thái, dẫn tới đúng registration/yêu cầu.

Vùng **Sinh viên cần theo dõi** tách riêng khỏi việc trực tiếp xử lý. Với registration thuộc GVHD, trạng thái `APPROVED` và chưa có BM01 hợp lệ, hiển thị sinh viên, đề tài, hạn BM01 từ `Semester.outlineSubmissionDeadline`, “Còn hạn/Quá hạn” nếu có hạn, và thời điểm nhắc tự động gần nhất. GVHD mở được đúng sinh viên để xem quá trình; không có nút nhắc thủ công. Khi BM01 nộp, sinh viên biến khỏi danh sách chưa nộp và xuất hiện ở việc duyệt phù hợp. Nếu đợt chưa cấu hình hạn, hiển thị “Chưa đặt hạn”, không suy ra ngày giả.

KPI GVHD thay đổi theo việc/vùng theo dõi có dữ liệu trong đợt; không giữ bốn thẻ cố định. Việc của chức vụ khác (ví dụ Viện trưởng kiêm GVHD) phải gắn nhãn nguồn và quyền rõ ràng, không gộp thành việc GVHD của sinh viên khác.

## 6. Tổng quan sinh viên

Vùng đầu có **một bước tiếp theo** theo registration và cửa sổ nghiệp vụ thực: chưa đăng ký → chọn/đăng ký đề tài; `PENDING` → chờ GVHD; `APPROVED` chưa nộp BM01 → nộp BM01; đã nộp → chờ duyệt/xét duyệt; cần sửa → sửa/nộp lại; BM01 đạt → nộp BM02; các bước BM03, BM04, bảo vệ, lưu chiểu theo trạng thái tương ứng. Các trạng thái chờ nêu rõ đang chờ ai, không đưa nút hành động khi chưa được phép. Hạn nộp chỉ hiện khi `Semester` hoặc task có ngày thật.

Thông tin phụ như mã đề tài, số quyết định, ngày ký, khóa đào tạo, tỷ lệ tiến độ chỉ hiện khi dữ liệu thật có nguồn; thiếu dữ liệu dùng “Chưa cập nhật” hoặc ẩn khối. Không dùng chuỗi mặc định `DA-2026-KTPM-04`, `458/QĐ...`, `20/09/2026`, `2022 - 2026`, `HK1 2026–2027` như một giá trị thật. Các thẻ phụ đổi theo trạng thái có ích, không cạnh tranh với bước tiếp theo.

## 7. Nhắc BM01 tự động

- Job quét `TopicRegistration.status = APPROVED` thuộc đợt có `outlineSubmissionDeadline`, kiểm lại BM01 chưa được nộp tại thời điểm gửi. Không phụ thuộc việc task BM01 đã được tạo khi SV mở trang. Gửi **thông báo trong ứng dụng cho SV**, kèm hạn thực và liên kết `/student/submissions`.
- Hai mốc duy nhất cho mỗi registration và hạn nộp: **trước hạn 48 giờ** (chỉ khi job chạy trong khoảng `[deadline - 48h, deadline)`) và **một lần sau hạn** (khi `now >= deadline`). Nếu hạn đổi, mốc mới tính theo hạn mới; không gửi lại mốc cũ. Không gửi khi hạn null, registration không còn `APPROVED`, BM01 đã nộp, hoặc SV không còn thuộc đợt.
- Cần chống trùng **ở CSDL**, kể cả hai instance job chạy đồng thời. Bổ sung khóa dedupe duy nhất nullable cho Notification hoặc cơ chế unique tương đương; khóa gồm loại BM01, registration ID, mốc và deadline. `safeNotify`/`safeNotifyMany` phải giữ `referenceUrl` hợp lệ và khóa dedupe thay vì làm rơi chúng. Các job nhắc cũ dùng `referenceUrl` làm dấu phải được rà để không tiếp tục gửi trùng; job task chung không được gửi thêm lời nhắc BM01 cùng mốc.
- Backend trả trạng thái gửi/lần gửi gần nhất cho vùng theo dõi GVHD. Việc gửi lỗi được ghi log và thử ở lần quét sau, không đánh dấu đã gửi khi notification chưa được lưu; job không thay đổi trạng thái đăng ký.

## 8. UI, lỗi và kiểm chứng

Ba dashboard dùng cùng nguyên tắc: tiêu đề và đợt rõ, việc tiếp theo ở vùng dễ thấy nhất, thẻ có số + nhãn + đích cụ thể, trạng thái trống có giải thích, lỗi API có thử lại. Màu không là tín hiệu duy nhất; nút dùng `@ant-design/icons` qua prop `icon` và nhãn tiếng Việt thuần. Dùng Ant Design/Tailwind đang có; ở 375px thẻ xếp dọc, không cần cuộn ngang, focus và thứ tự heading đúng. Không dùng hiệu ứng nhấp nháy để báo việc khẩn.

Kiểm thử theo thứ tự CSDL → backend → frontend:

1. Quy tắc công việc với các hồ sơ cùng đợt ở nhiều chặng, nhiều đợt, quyền khác nhau; số đếm và target đúng nguồn, không lộ việc ngoài scope.
2. Admin ở giai đoạn sau GVHD duyệt: không thấy thẻ HĐ bảo vệ/điểm khi chưa phát sinh; khi đủ điều kiện phân HĐ đề cương, thẻ và link xuất hiện; BM02 chỉ xuất hiện khi đã nộp và đến lượt thẩm định.
3. GVHD thấy SV `APPROVED` chưa nộp BM01; SV nộp xong thì chuyển khỏi danh sách theo dõi sang việc xét duyệt tương ứng. SV thấy bước nộp BM01 hoặc trạng thái chờ phù hợp.
4. Job chạy lặp/đồng thời, đổi hạn, không có hạn, đã nộp trước lúc quét, lỗi lưu notification: không gửi trùng hoặc gửi nhầm. Kiểm tra job task cũ không tạo thông báo BM01 trùng.
5. Giao diện trạng thái rỗng/lỗi, chọn đợt, lọc đích, màn hình hẹp, bàn phím, UTF-8 không BOM; không còn các giá trị giả liệt kê ở mục 2 và 6.
