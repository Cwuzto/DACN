# Thiết kế in và nộp trực tuyến biểu mẫu BM01–BM05

**Ngày:** 2026-11-18

**Phạm vi:** BM01, BM02, BM02-A, BM03, BM04, BM05; sinh viên, GVHD, phụ trách bộ môn và người xem hồ sơ học vụ.

**Trạng thái:** Thiết kế đã trao đổi; chờ người dùng duyệt văn bản trước khi lập kế hoạch triển khai.

## 1. Mục tiêu và ranh giới

- Nút in mở hộp thoại in của trình duyệt để chọn “Lưu dưới dạng PDF”; không tạo PDF rỗng, bị cắt trang hoặc chứa thông tin giả.
- Nộp/ký/xác nhận là thao tác trực tuyến trên hồ sơ có phiên bản, tách khỏi thao tác in. BM01 là ngoại lệ có tệp PDF đề cương chi tiết do sinh viên tải lên; không yêu cầu in, ký tay rồi tải bản in lại.
- Dùng `TopicRegistration` làm trục hồ sơ; một sinh viên/một đề tài, tối đa 10 sinh viên/GVHD. Dữ liệu và quyền được kiểm tra ở backend trước khi giao diện hiển thị.
- “Đã xác thực nội bộ” chỉ mô tả bản ghi xác nhận trong hệ thống. Không gọi đây là chữ ký số có chứng thư hay hiển thị dấu hợp lệ khi chưa kiểm tra được người ký, vai trò, phiên bản và nội dung.

## 2. Luồng từng biểu mẫu

| Biểu mẫu | Nguồn nội dung chính | Nộp và xác nhận | Xem/in |
|---|---|---|---|
| BM01 | Trường tóm tắt và tệp PDF đề cương của sinh viên, cùng phiên bản v1/v2 | Sinh viên xác nhận nộp; GVHD/hội đồng xử lý theo luồng thẩm định hiện có | “Xem BM01” mở **chính PDF đã nộp**; in PDF đó, không dựng lại BM01 từ trường tóm tắt |
| BM02 | Trường BM02 lưu trên `BM02Submission` theo phiên bản | Sinh viên nộp/xác nhận → GVHD xác nhận → phụ trách bộ môn phê duyệt | Mẫu A4 dựng từ bản ghi đã lưu, thể hiện ba trạng thái xác nhận thực |
| BM02-A | `BM02AAdjustmentRequest` và phiên bản có ba sự kiện ký | Giữ luồng sinh viên → GVHD → phụ trách bộ môn | Mẫu A4 dùng đúng phiên bản và sự kiện ký hiện hành |
| BM03 | Nhật ký buổi gặp và đánh giá giữa/cuối kỳ của một hồ sơ tiến độ | GVHD xác nhận từng nhật ký; sinh viên **không ký từng buổi**. Cuối kỳ GVHD ký toàn phiếu, sinh viên xác nhận hoặc nêu lý do không đồng ý | Chỉ xuất/nộp bản BM03 hoàn tất gần cuối kỳ, sau bước chốt; trước đó xem dòng thời gian trên màn hình |
| BM04 | Bản đánh giá GVHD đã lưu | Giữ luồng GVHD lập và ký nộp | In từ bản ghi thật và trạng thái ký thật |
| BM05 | Kết quả/hồ sơ tổng hợp sau bảo vệ | Không tạo bước sinh viên/GVHD nộp BM05 | Chỉ in khi dữ liệu kết quả được phép xem và đủ điều kiện công bố |

## 3. BM01: PDF duy nhất, dữ liệu form không bị mất

1. Sinh viên vào “Hồ sơ & nộp bài” (`/student/submissions`) sau khi hồ sơ đủ điều kiện BM01. Form cho nhập các trường BM01 và **chỉ nhận PDF** đề cương chi tiết. Trước khi nộp, sinh viên xem trước chính tệp đã chọn, rồi bấm “Xác nhận và nộp BM01”.
2. Frontend kiểm tra loại tệp và dung lượng để phản hồi sớm. Backend/luồng lưu trữ xác minh phần mở đầu PDF, loại tệp, dung lượng, quyền sở hữu asset và chính sách kỳ; không tin đuôi tên tệp hoặc MIME do trình duyệt khai báo. Cấu hình kỳ và giao diện quản trị phải thống nhất giới hạn PDF cho lượt nộp mới.
3. API lưu **cả nội dung trường form và `assetId`/tệp** trong một giao dịch gắn với `Submission` v1/v2. Hiện form tạo `content` nhưng `SubmissionPage`/API chỉ chuyển `fileData`; thiết kế sửa điểm mất dữ liệu này. Quy tắc một lần nộp v1 và một lần sửa v2 giữ nguyên.
4. “Xem BM01” ở trang sinh viên, GVHD và hồ sơ học vụ mở PDF của đúng phiên bản được chọn qua URL truy cập được kiểm soát. Nếu không thể tải/hiển thị, báo lỗi và cho tải tệp khi còn quyền; không thay bằng văn bản mô phỏng. Hồ sơ Word cũ vẫn giữ lịch sử và có thể tải xuống theo quyền, nhưng không nhận Word cho lượt nộp mới và không giả vờ xem trước như PDF.

## 4. BM02: nhập liệu và xác nhận nội bộ theo phiên bản

1. Sau khi BM01 đạt, sinh viên vào cùng trang “Hồ sơ & nộp bài”, điền BM02, xem trước A4 rồi xác nhận nộp. Bỏ yêu cầu tải bản scan BM02 đã ký. Trường tên đề tài đã duyệt BM01 được lấy từ snapshot; đổi cách diễn đạt tên phải có lý do theo quy tắc backend.
2. `BM02Submission` là phiên bản dữ liệu duy nhất. Các trường nhiệm vụ/mốc thời gian hiện đi trong `content` phải được kiểm tra và lưu; endpoint chính `/bm02/applications/:registrationId/submit` và endpoint tương thích `/registrations/bm02-submit` dùng cùng một command, không tạo hai nghiệp vụ khác nhau.
3. Mỗi xác nhận tạo một `ElectronicSignatureEvent` gắn với `BM02Submission.id`, `versionNo`, người ký/vai trò, thời điểm và hash nội dung bất biến: **sinh viên nộp → GVHD của đề tài xác nhận → phụ trách bộ môn có thẩm quyền phê duyệt**. Backend kiểm tra quan hệ hồ sơ, quyền, thứ tự, trạng thái và hash trước từng bước; không cho người có role nhưng không thuộc hồ sơ ký. Cách lưu hash/sự kiện có thể tái dùng từ BM02-A, nhưng BM02 có endpoint và trạng thái riêng.
4. Ba ô ký trong bản xem/in hiển thị “Chờ xác nhận” hoặc “Đã xác thực nội bộ” kèm họ tên, vai trò, thời điểm và mã phiên bản. Chỉ hiện trạng thái hợp lệ khi sự kiện ký khớp phiên bản và hash hiện hành. Không vẽ hình chữ ký giả hay tên mặc định. Khi bị trả về, v2 giữ lịch sử v1 nhưng yêu cầu xác nhận lại từ đầu; bản in v1 không được gắn dấu của v2.
5. Việc thẩm định và ban hành quyết định học vụ hiện có chỉ nhận bản BM02 đủ các xác nhận bắt buộc. Không tự công bố hoặc đổi tên đề tài vì một ô ký vừa chuyển trạng thái.

## 5. BM03: một dòng thời gian, hai mốc đánh giá

1. Nhật ký trao đổi mở trong giai đoạn thực hiện đồ án. GVHD ghi và xác nhận từng buổi; sinh viên xem được nhưng **không có thao tác ký/xác nhận từng buổi**. Bản sửa nhật ký tạo phiên bản mới và giữ lịch sử.
2. Học vụ cấu hình **ngày mở đánh giá giữa kỳ** và **ngày bắt đầu chốt BM03 cuối kỳ** cho từng đợt; backend lưu ngày và snapshot chính sách áp dụng cho hồ sơ. Trường `Semester.midtermReportDate` hiện là hạn nộp báo cáo, không được dùng ngầm làm ngày mở. Thiếu mốc được cấu hình thì hành động giai đoạn tương ứng đóng và báo lý do cho học vụ.
3. Đến ngày giữa kỳ, thẻ đánh giá xuất hiện **ngay trong dòng thời gian**: GVHD chọn “Cho làm tiếp” hoặc “Đề nghị dừng” kèm nhận xét. Backend kiểm tra ngày, GVHD sở hữu đề tài và chưa đánh giá trước đó. Nếu cho làm tiếp, nhật ký tiếp tục. Nếu đề nghị dừng, chuyển hồ sơ vào luồng Viện thẩm định hiện có; không tự kết thúc đề tài. Trong thời gian chờ quyết định dừng, nhật ký ở trạng thái chỉ đọc; nếu Viện bác đề nghị dừng thì mở ghi tiếp.
4. Chỉ từ ngày bắt đầu chốt cuối kỳ, sau đánh giá giữa kỳ hợp lệ và không có đề nghị dừng đang chờ, GVHD làm đánh giá cuối, ký toàn BM03. Sinh viên xem toàn phiếu và xác nhận hoặc nêu lý do không đồng ý trong cửa sổ hiện có. Sau xử lý xác nhận, hệ thống tạo bản PDF bất biến từ các nhật ký hiện hành và đánh giá thật. Trước mốc này không có nút xuất/nộp **BM03 hoàn tất**; xem nhật ký trên màn hình vẫn luôn có.
5. `BM03StageEvaluation` là nguồn kết luận giữa/cuối kỳ cho luồng mới. Hai checkpoint cũ chỉ còn là chứng cứ tiến độ, không được độc lập chuyển hồ sơ sang `BM03_PASSED` sau checkpoint 2. Hồ sơ đã `BM03_PASSED` trước ngày triển khai giữ nguyên và hiển thị là dữ liệu lịch sử; không tự thêm chữ ký hay đảo trạng thái. Với hồ sơ đang mở, checkpoint đã ký vẫn được hiển thị nhưng không tự tạo kết luận giữa/cuối kỳ mới; GVHD phải ghi đánh giá giai đoạn đúng mốc nếu chưa có `BM03StageEvaluation`. Endpoint checkpoint cũ cũng phải ngừng chuyển trạng thái hoàn tất cho các lượt mới.

## 6. Hạ tầng xem và in

- Sửa quy tắc `@media print` toàn cục đang ẩn `body *` và chỉ hiện vùng bản tin. Chế độ in BM chỉ hiện vùng biểu mẫu đang chọn; chế độ in bản tin chỉ hiện bản tin. Không để quy tắc của trang sinh viên/GVHD/Quản trị ẩn ancestor của vùng in.
- Khi in qua `AcademicFormPrintModal`, bỏ giới hạn `maxHeight`/`overflow`, hiệu ứng zoom `transform`, vị trí fixed và phần khung modal khỏi bản in. Giữ kích thước A4, ngắt trang và nội dung nhiều trang. Chỉ cho gọi `window.print()` khi dữ liệu mẫu đã tải và hợp lệ; lỗi tải dữ liệu hiện trên màn hình thay vì PDF trắng.
- BM02/BM02-A/BM03/BM04/BM05 dùng snapshot đúng phiên bản; loại giá trị ví dụ giả và placeholder có thể bị hiểu là dữ liệu thật. Sửa prop không khớp (`BM02PrintSheet` nhận `taskData` nhưng caller truyền `task`; `BM05PrintSheet` chưa nhận `summaryRecord`). BM05 không lộ điểm/chứng từ chưa được phép công bố.
- Nút “In toàn bộ hồ sơ” được thay bằng thao tác rõ ràng: **tải/in PDF BM01 riêng**, và **in các BM còn lại bằng trình duyệt**. Không ghép PDF BM01 tải lên với trang HTML trong cùng lần `window.print()`, không âm thầm dựng lại BM01. Danh sách biểu mẫu cho biết mẫu nào đã có dữ liệu và mẫu nào chưa đủ điều kiện in.

## 7. Thứ tự triển khai và kiểm chứng

1. **CSDL/Prisma:** mốc BM03 theo đợt/chính sách, sự kiện xác nhận BM02 và quan hệ phiên bản; dùng các model hiện có khi đủ, thêm migration chỉ cho dữ liệu thiếu. Bảo toàn lịch sử BM01/BM02/BM03.
2. **Backend:** kiểm tra PDF BM01, lưu trường form cùng asset trong giao dịch; kiểm tra quyền và sự kiện xác nhận BM02; khóa mốc BM03 và thống nhất chuyển trạng thái checkpoint; trả dữ liệu bản in theo phiên bản và scope.
3. **Frontend:** luồng nộp/xem BM01 PDF; form và ô xác nhận BM02; dòng thời gian BM03; sửa các điểm in chung và bộ hồ sơ. Nút có icon dùng `@ant-design/icons` qua prop `icon`, nhãn văn bản thuần.
4. **Kiểm chứng thực tế:** in BM02/BM02-A/BM03/BM04/BM05 từ từng vai trò và hồ sơ học vụ, đọc text PDF và kiểm tra không cắt trang. BM01 xem/in đúng file PDF v1/v2. Test từ chối Word mới, file giả PDF, asset không thuộc actor, thiếu trường form, sai thứ tự ký, hash/phiên bản lệch, sửa BM02 v2, gọi API BM03 trước mốc, checkpoint 2 không chốt sớm, người khác không xem/ký hồ sơ. Kiểm tra keyboard, 375px và trạng thái loading/error; không dùng mock thay API thật.

## 8. Tiêu chí hoàn thành

- Người dùng bấm in ở mọi điểm BM **đã đủ điều kiện in** và nhận trang có nội dung đúng, không rỗng hoặc cắt mất nội dung; bản xem và PDF cùng một phiên bản.
- BM01 mới chỉ nhận PDF; nội dung form và tệp được lưu cùng v1/v2; “Xem BM01” hiển thị PDF đã nộp.
- BM02 nộp bằng dữ liệu form, ba xác nhận nội bộ tuần tự và kiểm chứng được; không cần bản scan ký tay, không có ô ký giả.
- BM03 có nhật ký liên tục, đánh giá giữa kỳ theo ngày học vụ cấu hình, chốt gần cuối kỳ, sinh viên chỉ xác nhận toàn phiếu; không chốt sớm bởi checkpoint song song.
- “In toàn bộ hồ sơ” chỉ dẫn rõ BM01 là PDF riêng và các BM còn lại in qua trình duyệt.
