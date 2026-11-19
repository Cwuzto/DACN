# Thiết kế trang “Việc của tôi” cho sinh viên

**Ngày:** 20/11/2026
**Trạng thái:** Thiết kế chức năng và hướng giao diện đã được người dùng đồng ý trong hội thoại; chờ rà soát đặc tả viết

## 1. Mục tiêu và hiện trạng

Thay trải nghiệm “Hồ sơ & nộp bài” bằng một trang giúp sinh viên biết **việc nào làm được ngay, việc nào sắp tới, và xem lại những gì đã hoàn thành**. Trang hiện tại `SubmissionPage.jsx` dài khoảng 1.800 dòng, gom BM01/BM02, BM02-A, BM03, BM04, lịch bảo vệ, hồ sơ trước bảo vệ và lưu chiểu sau bảo vệ vào một luồng nhiều banner, modal và bản in. Dữ liệu phần lớn từ API thật; vấn đề là mọi giai đoạn cạnh tranh cùng một màn hình và nút “Nộp báo cáo tiếp theo” chọn task đang mở đầu tiên thay vì một việc có ưu tiên nghiệp vụ rõ.

Trang mới phải ăn khớp với `nextAction` trên Tổng quan sinh viên vừa triển khai. Khi sinh viên bấm từ Tổng quan hoặc thông báo, đúng việc được mở và focus, không phải đầu một trang dài. Không thay quy tắc nghiệp vụ hoặc xóa chức năng nộp/sửa/xác nhận/tải đã có.

## 2. Quyết định cấu trúc

- Menu “Hồ sơ & nộp bài” đổi thành **“Việc của tôi”**. Giữ route `/student/submissions` để link cũ còn hoạt động. Mục menu “Nộp hồ sơ lưu chiểu” riêng được bỏ; lưu chiểu trở thành việc trong trang khi đến giai đoạn. Link cũ `/student/submissions?tab=archive` được ánh xạ tới phần lưu chiểu phù hợp hoặc lịch sử đã nộp, không dẫn tới trang trống.
- Phần đầu chỉ có ba vùng theo thứ tự: **Cần làm ngay**, **Sắp tới**, **Đã hoàn thành**. Không render toàn bộ roadmap BM01–BM04 như một danh sách luôn mở. Sinh viên vẫn có thể tra cứu mốc đã qua trong “Đã hoàn thành”.
- Nếu không có việc hiện tại hoặc sắp tới, nói “Hiện chưa có việc cần làm”. Trạng thái đang chờ GVHD/Hội đồng/Viện được trình bày như **trạng thái chờ**, không giả thành nhiệm vụ sinh viên có thể bấm.
- `TopicRegistration` là trục; 1 SV/1 đề tài, tối đa 10 SV/GVHD. Không dùng `group/groupMember`, không dùng mock data khi API thật đã có.

## 3. Quy tắc phân loại và ưu tiên việc

Backend tạo danh sách `workItems` từ registration, task, mốc Semester, BM01/BM02, BM02-A, BM03/BM04, lịch bảo vệ và lưu chiểu. Mỗi mục có mã ổn định, trạng thái, `openAt`, `dueAt` khi thật sự có, điều kiện thực hiện, hành động/đích, nguồn dữ liệu và tệp hoặc phản hồi đã nộp nếu có. Frontend chỉ trình bày; quyền và cửa sổ nộp được backend kiểm lại khi thao tác.

| Vùng | Quy tắc |
|---|---|
| Cần làm ngay | Đã mở, điều kiện trước đó đạt, SV có quyền thực hiện. Việc có hạn gấp/quá hạn đứng trước; xác nhận BM03 trong 48 giờ và yêu cầu sửa/nộp lại không bị chìm dưới việc thông thường. Mỗi thẻ có một hành động chính và hạn thật. |
| Sắp tới | Việc chưa mở nhưng đủ điều kiện dự kiến, có `openAt` hoặc `dueAt` thật nằm trong **7 ngày tới**. Chỉ hiện ngày và điều kiện mở; không có nút nộp khi cửa sổ chưa mở. Việc xa hơn 7 ngày hoặc không có mốc thật không xuất hiện. |
| Đã hoàn thành | Chỉ bản nộp hoặc mốc thực sự đã hoàn tất: thời điểm, phiên bản, phản hồi, tệp/PDF chính thức. Thu gọn mặc định; sắp mới nhất trước. BM04 là hồ sơ xem khi GVHD đã lập/ký, không phải nhiệm vụ nộp của SV. |

Một việc đã mở và gần hạn vẫn ở “Cần làm ngay”, không xuất hiện lần nữa ở “Sắp tới”. Khi đổi trạng thái sau nộp, mục rời “Cần làm ngay”, chuyển sang “Đã hoàn thành” hoặc trạng thái chờ phù hợp. Nếu nộp thất bại, mục vẫn ở vị trí cũ với lỗi rõ. Không dùng `task[0]` hoặc suy từ tên task để chọn việc chính. `nextAction` của Tổng quan lấy từ cùng quy tắc ưu tiên này; dashboard là bản tóm tắt, trang “Việc của tôi” là nơi thực hiện đầy đủ.

## 4. Nghiệp vụ phải giữ và cách xuất hiện

| Giai đoạn | Khi nào nổi bật | Chức năng cần giữ |
|---|---|---|
| BM01 ban đầu | Đăng ký đã được GVHD duyệt, cửa sổ nộp mở | Nộp v1, xem bản đã nộp, PDF, AI hỗ trợ nếu có quyền; cảnh báo bản đầu không thể thay thế nằm cạnh hành động nộp |
| BM01 nộp lại | Có kết quả cần sửa và cửa sổ v2 hợp lệ | Xem nhận xét, nộp v2 duy nhất, hạn sửa thật |
| BM02 | BM01 đạt và cửa sổ BM02 mở | Nộp/xem đơn chính thức, phản hồi, bản in hoặc PDF theo điều kiện hiện có |
| BM02-A | Quyết định đã ban hành và cửa sổ đổi tên còn hiệu lực | Gửi/xem yêu cầu đổi tên, trạng thái duyệt; không tạo thẻ khi chưa đến bước |
| BM03 | Có checkpoint hoặc xác nhận do GVHD ký đang đến lượt SV | Xem nhật ký, checkpoint, ký/xác nhận toàn phiếu trong 48 giờ, phản hồi/kháng nghị theo quyền hiện có |
| BM04 | GVHD đã lập/ký phiếu | Xem nhận xét và PDF hợp lệ trong vùng tra cứu, không có nút SV lập BM04 |
| Trước bảo vệ | Đến cửa sổ nộp hồ sơ sơ bộ hoặc lịch bảo vệ đã công bố | Nộp/cập nhật tệp sơ bộ, xem lịch và thay đổi ca khi có dữ liệu thật |
| Sau bảo vệ | Hồ sơ đủ điều kiện lưu chiểu | Nộp đủ bốn loại tệp lưu chiểu theo nghiệp vụ hiện tại, xem trạng thái nghiệm thu và tệp đã nộp |

Tài liệu/bản in không được mở thành giấy trống khi chưa có dữ liệu. Điểm hoặc nhận xét bảo vệ chưa công bố không được xuất hiện qua trang, deep link hay response dùng cho trang. Các modal nghiệp vụ lớn được tách theo trách nhiệm để việc thay UI không đổi API mutation đang chạy.

## 5. Hướng giao diện và chuyển động

- Trang dùng bố cục rõ thứ bậc: header “Đồ án của tôi” với tên đề tài/đợt thật nếu có; khối **Cần làm ngay** chiếm vùng nhìn chính (desktop khoảng 2/3), ô trạng thái bước hiện tại ở cạnh; **Sắp tới** bên dưới; **Đã hoàn thành** là danh sách/accordion gọn. Trên 375px mọi vùng xếp dọc, hành động chính không nằm dưới màn hình dài.
- Màu có vai trò rõ: teal đậm cho hành động chính, xanh lam cho sắp tới, hổ phách cho gần hạn, đỏ cho quá hạn, xanh lá nhẹ cho hoàn thành; nền trung tính để màu trạng thái nổi bật. Dùng token/palette hiện có của DACN, tối đa vài màu chức năng nhất quán. Trạng thái luôn có chữ; không dùng màu làm tín hiệu duy nhất. Không dùng emoji/ký tự icon thô trong nhãn nút, dùng `@ant-design/icons` qua `icon` prop.
- Thẻ vào trang hoặc đổi trạng thái có fade + dịch 8–12px trong 250–350ms, stagger rất ngắn cho danh sách nhỏ. Nút phản hồi bằng màu/độ nổi trong khoảng 150–200ms, không đổi kích thước bố cục. Không có pulse vô hạn hoặc hiệu ứng kéo dài khi refetch. Dùng CSS/Ant Design hiện có, không thêm thư viện animation chỉ cho trang này.
- `prefers-reduced-motion: reduce` đưa nội dung tới trạng thái cuối ngay và vẫn giữ nhãn/viền/trật tự ưu tiên. Focus nhìn thấy được, heading đúng cấp, vùng bấm đủ lớn, thông báo thay đổi trạng thái không đọc lặp liên tục. Kiểm 375px, tablet và desktop; không che focus bởi thanh cố định hoặc menu nổi.

## 6. Dữ liệu, điều hướng và lỗi

- Một service backend dùng chung phân loại `workItems` và chọn `nextAction` cho dashboard. Nếu dashboard đã có `buildStudentNextAction`, nâng cấp/tái dùng quy tắc đó thay vì giữ hai bảng ánh xạ trạng thái độc lập. Response giới hạn dữ liệu theo SV đang đăng nhập và đợt/hồ sơ có quyền xem; mutation vẫn kiểm quyền/trạng thái ở API gốc.
- Mã việc ổn định trong query param, ví dụ `/student/submissions?work=BM01_INITIAL` hoặc `?work=BM03_ACK`; trang cuộn/focus tới mục đang tồn tại. Link cũ không có `work` mở trang bình thường. Nếu mục deep link đã hoàn thành, mở bản trong lịch sử; nếu không còn hợp lệ, hiện thông báo ngắn và đưa về việc hiện tại.
- Tải trang có skeleton theo bố cục thật; lỗi API có Retry, khác với “không có việc”. Các nguồn phụ lỗi không làm mất hành động chính đã tải được; vùng đó hiện lỗi riêng. Sau mutation thành công, cập nhật query liên quan và thông báo kết quả, giữ focus hợp lý. Khi không có registration, hướng SV sang đăng ký đề tài nếu được phép.
- Lưu chiểu và BM03 tải dữ liệu chi tiết theo nhu cầu khi vùng tương ứng hiện/mở; tránh tải mọi bản in và modal khi sinh viên ở giai đoạn BM01. Giữ khả năng tra cứu lịch sử mà không bắt buộc mount toàn bộ `PrintSheet`.

## 7. Kiểm chứng và quan hệ với kế hoạch trước

- Test ma trận: chưa đăng ký, `PENDING`, `APPROVED`, BM01 đã nộp/cần sửa/đạt, BM02, BM03 xác nhận 48h, BM04 đã ký, trước/sau bảo vệ, lưu chiểu; kiểm một việc chỉ ở một vùng, mốc 7 ngày, deadline null và nhiều việc đồng thời.
- Test chuyển từ Tổng quan/notification tới đúng việc; route cũ và `?tab=archive` còn tới được nội dung phù hợp. Test nộp/sửa/xác nhận và xem tệp/PDF hiện có sau khi tách component. Test lỗi mạng/permission/cửa sổ đóng, 375px, bàn phím, reduced motion, UTF-8 không BOM.
- Kế hoạch `docs/superpowers/plans/2026-11-20-lecturer-student-next-actions.md` đã xây `nextAction` cho SV. Trước khi triển khai trang mới, cập nhật phần SV của kế hoạch đó để `nextAction` lấy từ cùng nguồn `workItems` và target có deep link; không tạo logic thứ hai khiến Tổng quan và “Việc của tôi” trái nhau.
