/**
 * TÀI LIỆU TRI THỨC HỌC VỤ CÔNG KHAI DÀNH CHO SINH VIÊN
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp
 *
 * Chuẩn mã hóa: UTF-8 (no BOM)
 * Quy tắc: 1 Sinh viên / 1 Đề tài (maxStudents = 1), 1 GVHD tối đa 10 Sinh viên.
 */

const studentKnowledge = `
================================================================================
BỘ QUY CHẾ VÀ HƯỚNG DẪN THỰC HIỆN ĐỒ ÁN / KHÓA LUẬN TỐT NGHIỆP DÀNH CHO SINH VIÊN
VIỆN CÔNG NGHỆ SỐ - TOÀN TRÌNH NGHIỆP VỤ 6 GIAI ĐOẠN SỐ HÓA
================================================================================

1. NGUYÊN TẮC CỐT LÕI VÀ ĐIỀU KIỆN TIÊN QUYẾT:
- Mô hình đăng ký đơn lẻ (Single Registration Model): Mỗi đề tài tốt nghiệp chỉ do đúng 01 sinh viên thực hiện (maxStudents = 1). Tuyệt đối không áp dụng hình thức làm đồ án theo nhóm sinh viên.
- Định mức hướng dẫn (Quota): Mỗi Giảng viên hướng dẫn (GVHD) chỉ được hướng dẫn tối đa 10 sinh viên trong một học kỳ để đảm bảo chất lượng học thuật.
- Tính chính quy và minh bạch: Mọi bước từ nộp đề cương, nhận xét, ký biên bản đến công bố điểm đều được thực hiện trực tiếp trên Hệ thống Quản lý Đồ án Tốt nghiệp. Hệ thống không có cơ chế bỏ qua bước (zero bypass).

--------------------------------------------------------------------------------
2. CHI TIẾT 6 GIAI ĐOẠN THỰC HIỆN ĐỒ ÁN CỦA SINH VIÊN:

--------------------------------------------------------------------------------
Giai đoạn 1: Chuẩn bị & Đăng ký đề tài
- Điều kiện làm đồ án tốt nghiệp:
  + Sinh viên phải tích lũy đủ số tín chỉ quy định của chương trình đào tạo, không nợ các học phần tiên quyết.
  + Điểm trung bình tích lũy (GPA) đạt chuẩn theo thông báo xét duyệt làm đồ án của Viện trong từng học kỳ.
  + Sinh viên có tên trong Danh sách đủ điều kiện làm đồ án tốt nghiệp do Viện công bố trên Trang chủ.
- Tra cứu thông tin:
  + Sinh viên theo dõi Trang chủ hệ thống để xem Danh sách giảng viên hướng dẫn kèm theo các hướng nghiên cứu chuyên sâu (Trí tuệ nhân tạo, Kỹ thuật phần mềm, An toàn thông tin, Hệ thống nhúng & IoT, v.v.).
- Đăng ký và xét duyệt đề tài:
  + Sinh viên chủ động liên hệ với GVHD qua email hoặc gặp trực tiếp để trao đổi nguyện vọng, ý tưởng nghiên cứu.
  + Sinh viên nộp đơn đăng ký đề tài trên hệ thống gửi tới GVHD (trạng thái ban đầu: PENDING).
  + GVHD xem xét và phản hồi: Duyệt chấp nhận (APPROVED) hoặc Từ chối (REJECTED) kèm lý do cụ thể. Nếu bị từ chối, sinh viên được phép liên hệ và gửi đơn đến GVHD khác trong thời hạn quy định.

--------------------------------------------------------------------------------
Giai đoạn 2: Đề cương, Xét duyệt (BM01, BM02) & Đổi tên đề tài (BM02-A)
- Nộp Đề cương nghiên cứu (Biểu mẫu BM01):
  + Sinh viên hoàn thiện Đề cương BM01 bao gồm 5 nội dung chính: Bối cảnh & Lý do chọn đề tài, Mục tiêu nghiên cứu, Phạm vi & Đối tượng nghiên cứu, Phương pháp tiếp cận & Giải pháp kỹ thuật, Kế hoạch thực hiện & Sản phẩm dự kiến.
  + Nộp BM01 lên hệ thống đúng thời hạn trước ngày Hội đồng xét duyệt đề cương làm việc.
- Hội đồng xét duyệt đề cương:
  + Hội đồng chuyên môn của Viện đánh giá đề cương BM01 theo 3 kết luận:
    1. ĐẠT (PASSED): Đề cương đạt chất lượng, sinh viên được tiến hành nộp BM02.
    2. CẦN CHỈNH SỬA (NEEDS_REVISION): Đề cương còn thiếu sót về phạm vi hoặc phương pháp.
    3. KHÔNG ĐẠT / VẮNG (FAILED): Không tham gia hoặc nội dung không đạt yêu cầu học thuật.
- Quy trình khi CẦN CHỈNH SỬA:
  + Sinh viên tiếp thu ý kiến góp ý của Hội đồng, tiến hành chỉnh sửa nội dung đề cương BM01 và nộp lại trên hệ thống.
  + Đề cương nộp lại sẽ do chính GVHD trực tiếp thẩm định lại. Khi GVHD đánh giá ĐẠT, sinh viên mới được mở khóa để nộp đơn chính thức BM02. Tuyệt đối không được nộp BM02 khi BM01 chưa Đạt.
- Nộp Đơn đăng ký đề tài chính thức (Biểu mẫu BM02):
  + Sinh viên cùng GVHD thống nhất tên đề tài chính thức và nộp BM02 lên hệ thống.
- Quyết định giao đề tài của Viện:
  + Ban Giám đốc Viện ký và ban hành Quyết định giao đề tài kèm danh sách sinh viên chính thức (kèm số quyết định decisionNumber và ngày ban hành decisionDate).
  + Đề tài chính thức chuyển sang trạng thái Đang thực hiện (IN_PROGRESS) và kích hoạt theo dõi tiến độ BM03.
- Cửa sổ 7 ngày (168 giờ) xin đổi tên đề tài (Biểu mẫu BM02-A):
  + Kể từ thời điểm Viện công bố Quyết định giao đề tài, sinh viên có đúng 7 ngày (168 giờ) để nộp đơn xin điều chỉnh tên đề tài (BM02-A) nếu quá trình nghiên cứu ban đầu cần tinh chỉnh phạm vi.
  + Đơn xin đổi tên được gửi trực tiếp cho GVHD duyệt trên hệ thống. Khi GVHD phê duyệt (APPROVED), tên mới (adjustedTitle) được cập nhật và dùng xuyên suốt cho BM03, BM04 và Hội đồng bảo vệ.
  + Sau 168 giờ, hệ thống tự động đóng tính năng đổi tên đề tài. Mọi đề nghị thay đổi sau đó đều không hợp lệ.

--------------------------------------------------------------------------------
Giai đoạn 3: Thực hiện đề tài & Theo dõi tiến độ nghiêm ngặt (BM03)
- Thời gian nghiên cứu: Kéo dài khoảng 3 tháng theo kế hoạch đào tạo của Viện.
- Ghi nhận nhật ký trao đổi (Meeting Logs):
  + Sinh viên định kỳ họp với GVHD (tối thiểu 1-2 tuần/lần), cập nhật nội dung trao đổi, kết quả đạt được và nhiệm vụ tuần tiếp theo vào hệ thống.
- Hai đợt Checkpoint tiến độ bắt buộc:
  + Checkpoint 1: Đánh giá tiến độ giữa kỳ (khối lượng hoàn thành ước tính khoảng 40-50%).
  + Checkpoint 2: Đánh giá tiến độ cuối kỳ (hoàn thiện sản phẩm demo và bản thảo báo cáo khoảng 80-90%).
  + Kết quả đánh giá chỉ gồm 2 mức: ĐẠT (COMPLETED) hoặc KHÔNG ĐẠT (FAILED).
- NGUYÊN TẮC BẮT BUỘC VỀ DỪNG ĐỀ TÀI:
  + Nếu sinh viên bị đánh giá KHÔNG ĐẠT ở bất kỳ Checkpoint nào, đề tài lập tức bị DỪNG THỰC HIỆN NGAY LẬP TỨC (trạng thái chuyển sang TERMINATED_FAILED_PROGRESS). Sinh viên bị hủy đồ án của học kỳ hiện tại và không được ra bảo vệ.
- Ký xác nhận BM03 (Cửa sổ 48 giờ):
  + Khi kết thúc giai đoạn theo dõi, GVHD ký hoàn tất Phiếu theo dõi quá trình thực hiện BM03.
  + Sinh viên có thời hạn 48 giờ để truy cập hệ thống kiểm tra và ký điện tử xác nhận phiếu BM03.
  + Nếu quá 48 giờ mà sinh viên không ký, hệ thống sẽ tự động ghi nhận trạng thái quá hạn xác nhận và hệ thống vẫn chuyển sang giai đoạn tiếp theo nếu kết luận của GVHD là cho phép tiếp tục.

--------------------------------------------------------------------------------
Giai đoạn 4: Đánh giá trước bảo vệ (BM04)
- 4 Tiêu chuẩn đánh giá chuẩn đầu ra công khai của GVHD:
  1. Hình thức Báo cáo tốt nghiệp (BCTN): Trình bày đúng quy cách chuẩn của Viện, văn phong khoa học, trích dẫn tài liệu tham khảo đúng chuẩn IEEE/APA.
  2. Nội dung nghiên cứu và giải pháp khoa học: Mức độ giải quyết trọn vẹn mục tiêu đề ra, độ sâu kỹ thuật, tính logic của các thuật toán hoặc kiến trúc hệ thống.
  3. Tính ứng dụng và triển vọng phát triển: Khả năng triển khai thực tế, sản phẩm phần mềm/phần cứng hoạt động ổn định, tiềm năng mở rộng.
  4. Thái độ làm việc, tính chủ động và hoàn thành nhiệm vụ: Sự nghiêm túc, tính tự chủ trong nghiên cứu, mức độ hợp tác và tuân thủ thời hạn của sinh viên.
- Quyết định cho phép bảo vệ:
  + GVHD đưa ra kết luận: ĐỒNG Ý hoặc KHÔNG ĐỒNG Ý cho sinh viên ra bảo vệ trước Hội đồng.
  + Ngay khi GVHD ký nộp, phiếu BM04 được khóa vĩnh viễn (isLocked = true), không thể chỉnh sửa điểm hay nhận xét.
  + Khi GVHD ĐỒNG Ý, đề tài của sinh viên tự động chuyển sang trạng thái Sẵn sàng bảo vệ (DEFENSE_READY). Chỉ sinh viên đạt trạng thái này mới được Viện xếp lịch bảo vệ.

--------------------------------------------------------------------------------
Giai đoạn 5: Hội đồng chấm Báo cáo tốt nghiệp & Bảo vệ
- Điều kiện tiên quyết: Sinh viên phải có trạng thái DEFENSE_READY từ BM04.
- Cơ cấu Hội đồng bảo vệ:
  + Gồm 3 thành viên chính thức: 01 Chủ tịch Hội đồng, 01 Thư ký Hội đồng, 01 Giảng viên Phản biện.
  + Nguyên tắc độc lập: GVHD không được là thành viên trong hội đồng chấm chính sinh viên do mình hướng dẫn.
- Quy chế buổi bảo vệ:
  + Thời gian thuyết trình: Sinh viên trình bày báo cáo và demo sản phẩm từ 15 đến 20 phút.
  + Thời gian vấn đáp: 10 đến 15 phút trả lời các câu hỏi phản biện từ các thành viên hội đồng.
  + Tác phong: Trang phục trang trọng, thái độ tự tin, cầu thị và nắm vững bản chất kỹ thuật của công trình.
- Điểm tổng kết bảo vệ:
  + 3 thành viên hội đồng chấm điểm độc lập trên thang điểm 10 theo các tiêu chuẩn: chất lượng báo cáo, nội dung nghiên cứu, kỹ năng thuyết trình và năng lực trả lời vấn đáp.
  + Điểm tổng kết bảo vệ là TRUNG BÌNH CỘNG CÔNG KHAI của 3 thành viên hội đồng. Điểm số được công bố minh bạch trên hệ thống sau khi Hội đồng hoàn tất phiên họp.

--------------------------------------------------------------------------------
Giai đoạn 6: Hoàn thiện sau bảo vệ & Nộp lưu chiểu
- Tiếp thu góp ý: Sinh viên đối chiếu biên bản góp ý của Hội đồng, chỉnh sửa toàn bộ các lỗi chính tả, định dạng và bổ sung giải trình khoa học.
- Nộp hồ sơ lưu chiểu:
  + 01 bản quyển Báo cáo tốt nghiệp hoàn chỉnh định dạng PDF chuẩn (kèm bản in bìa cứng nộp văn phòng Viện nếu có yêu cầu theo đợt).
  + Toàn bộ mã nguồn (source code) hoàn chỉnh, bộ cài đặt, tài liệu hướng dẫn vận hành và dữ liệu thực nghiệm lưu vào kho lưu trữ số của Viện.
  + Xác nhận hoàn tất lưu chiểu là điều kiện bắt buộc để Viện công nhận tốt nghiệp và cấp bằng cử nhân/kỹ sư.

--------------------------------------------------------------------------------
3. CÂU HỎI THƯỜNG GẶP (FAQ) & CÁC TRƯỜNG HỢP NGOẠI LỆ:

Hỏi: Em có thể làm đồ án chung nhóm 2 bạn được không?
Đáp: Không. Quy định bắt buộc của Viện là 1 sinh viên thực hiện 1 đề tài độc lập (maxStudents = 1).

Hỏi: Nếu đề cương BM01 của em bị đánh giá "Cần chỉnh sửa" thì em có bị rớt đồ án không?
Đáp: Không bị rớt ngay. Bạn cần chỉnh sửa lại đề cương theo góp ý của Hội đồng và nộp lại trên hệ thống để GVHD thẩm định lại. Khi GVHD duyệt Đạt, bạn sẽ được phép nộp BM02.

Hỏi: Em có thể xin đổi tên đề tài vào tuần thứ 6 của đồ án không?
Đáp: Không thể. Cửa sổ nộp đơn xin đổi tên đề tài (BM02-A) chỉ mở trong đúng 7 ngày (168 giờ) kể từ ngày Viện ban hành Quyết định giao đề tài. Sau 168 giờ, hệ thống sẽ tự động khóa vĩnh viễn tính năng này.

Hỏi: Nếu em bị đánh giá "Không đạt" ở Checkpoint 1 giữa kỳ thì có cơ hội gỡ lại ở Checkpoint 2 không?
Đáp: Không. Quy định của Viện rất nghiêm ngặt: nếu không đạt ở bất kỳ Checkpoint nào (dù là giữa kỳ hay cuối kỳ), đề tài sẽ bị DỪNG NGAY LẬP TỨC (TERMINATED_FAILED_PROGRESS) và không được tiếp tục.

Hỏi: Quy định về đạo văn và liêm chính học thuật là gì?
Đáp: Toàn bộ báo cáo tốt nghiệp sẽ được quét qua phần mềm kiểm tra trùng lặp. Tỷ lệ trùng lặp phải dưới ngưỡng quy định của Viện (thông thường dưới 20-25%, loại trừ trích dẫn hợp lệ). Mọi hành vi sao chép công trình của người khác, mua bán đồ án, ngụy tạo số liệu thực nghiệm sẽ bị hủy kết quả và chuyển Hội đồng kỷ luật xử lý đình chỉ học tập.

Hỏi: Sinh viên bị ốm hoặc có việc đột xuất trong ngày bảo vệ thì phải làm gì?
Đáp: Sinh viên phải thông báo ngay cho GVHD và gửi đơn xin hoãn bảo vệ kèm minh chứng hợp lệ (giấy xác nhận của bệnh viện) về Giáo vụ Viện trước giờ khai mạc Hội đồng để được xem xét chuyển sang đợt bảo vệ bổ sung.
`;

module.exports = { studentKnowledge };
