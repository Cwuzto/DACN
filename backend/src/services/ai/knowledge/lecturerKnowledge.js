/**
 * TÀI LIỆU TRI THỨC HỌC VỤ NỘI BỘ DÀNH CHO GIẢNG VIÊN & HỘI ĐỒNG
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp
 *
 * Chuẩn mã hóa: UTF-8 (no BOM)
 * Phân quyền: Chỉ cấp cho LECTURER, Ban Chủ nhiệm Viện, Giáo vụ và Hội đồng.
 * Không cung cấp cho Sinh viên nhằm tránh rò rỉ tiêu chuẩn đánh giá kín và câu hỏi phản biện.
 */

const lecturerKnowledge = `
================================================================================
TIÊU CHÍ ĐÁNH GIÁ HỌC THUẬT NỘI BỘ DÀNH CHO GIẢNG VIÊN VÀ HỘI ĐỒNG
VIỆN CÔNG NGHỆ SỐ - QUY CHUẨN ĐÁNH GIÁ VÀ HƯỚNG DẪN CHUYÊN MÔN
================================================================================

1. HƯỚNG DẪN THẨM ĐỊNH VÀ CHẤM ĐỀ CƯƠNG BM01:
- Khung thẩm định 5 chiều logic của Đề cương BM01:
  1. Tính logic Tên - Mục tiêu: Tên đề tài phải bao quát đúng mục tiêu cụ thể, không quá rộng hoặc quá hẹp, phản ánh đúng bài toán nghiên cứu.
  2. Tính khả thi Phương pháp: Phương pháp tiếp cận, thuật toán hoặc công nghệ đề xuất phải có cơ sở khoa học và khả thi trong thời gian 3 tháng của đồ án.
  3. Phạm vi & Dữ liệu thực nghiệm: Phạm vi vừa sức với đồ án cử nhân/kỹ sư 1 sinh viên (maxStudents = 1), nguồn dữ liệu huấn luyện/thực nghiệm phải rõ ràng, có tính kiểm chứng.
  4. Sản phẩm dự kiến: Phải có sản phẩm đo lường, nghiệm thu cụ thể (phần mềm demo, mô hình thực nghiệm, báo cáo đánh giá benchmark).
  5. Tính hoàn thiện học thuật: Bố cục đề cương chặt chẽ, văn phong khoa học, trích dẫn tài liệu tham khảo sơ bộ đáng tin cậy.
- Quy trình thẩm định lại đề cương nộp lại:
  + Đối với các đề cương bị Hội đồng xét duyệt đánh giá CẦN CHỈNH SỬA (NEEDS_REVISION), sinh viên sẽ chỉnh sửa và nộp lại trên hệ thống.
  + Thẩm quyền thẩm định lại thuộc về duy nhất GVHD của sinh viên.
  + GVHD đối chiếu các yêu cầu sửa đổi của Hội đồng, nếu sinh viên đã hoàn thiện đầy đủ thì bấm xác nhận ĐẠT để mở khóa cho sinh viên nộp đơn chính thức BM02.

--------------------------------------------------------------------------------
2. BẢNG ĐIỂM CHI TIẾT 4 TIÊU CHÍ CHUẨN ĐẦU RA BM04 VÀ QUY CÁCH ĐÁNH GIÁ:
GVHD đánh giá toàn diện sinh viên trên biểu mẫu BM04 theo 4 tiêu chí chuẩn đầu ra (tổng thang điểm 10):
- Tiêu chí 1: Hình thức BCTN (0-2 điểm)
  + Thang 1.8 - 2.0 điểm: Báo cáo trình bày rất đẹp, chuẩn chỉ theo quy định của Viện, không mắc lỗi chính tả, trích dẫn tài liệu tham khảo đúng chuẩn IEEE/APA, hình vẽ biểu bảng rõ ràng.
  + Thang 1.0 - 1.7 điểm: Bố cục tương đối đầy đủ nhưng còn một số lỗi chính tả nhỏ, định dạng chưa đồng nhất ở một số bảng biểu.
  + Dưới 1.0 điểm: Báo cáo trình bày cẩu thả, sai quy cách nghiêm trọng, thiếu tài liệu tham khảo hoặc trích dẫn sai nguyên tắc.
- Tiêu chí 2: Nội dung nghiên cứu và giải pháp khoa học (0-4 điểm)
  + Thang 3.5 - 4.0 điểm: Hoàn thành xuất sắc mục tiêu nghiên cứu, giải pháp khoa học có tính sáng tạo, độ phức tạp kỹ thuật cao, phân tích và đánh giá kết quả thực nghiệm sâu sắc.
  + Thang 2.5 - 3.4 điểm: Hoàn thành cơ bản các mục tiêu đề ra, phương pháp áp dụng hợp lý, có kết quả thực nghiệm đáp ứng yêu cầu đồ án tốt nghiệp.
  + Dưới 2.5 điểm: Nội dung nông, giải pháp chắp vá hoặc không giải quyết được bài toán kỹ thuật trọng tâm đã cam kết trong BM01.
- Tiêu chí 3: Tính ứng dụng và triển vọng phát triển (0-2 điểm)
  + Thang 1.8 - 2.0 điểm: Sản phẩm hoàn chỉnh, chạy thực tế mượt mà, ổn định, có giá trị ứng dụng thực tiễn cao hoặc có tiềm năng phát triển thành công trình công bố khoa học.
  + Thang 1.0 - 1.7 điểm: Sản phẩm hoạt động được ở mức độ demo cơ bản, còn tồn tại lỗi nhỏ khi xử lý dữ liệu biên.
  + Dưới 1.0 điểm: Sản phẩm không chạy được, không có khả năng ứng dụng thực tế.
- Tiêu chí 4: Thái độ làm việc, tính chủ động và hoàn thành nhiệm vụ (0-2 điểm)
  + Thang 1.8 - 2.0 điểm: Sinh viên thể hiện tinh thần chủ động cao, độc lập giải quyết khó khăn, tham gia đầy đủ và nghiêm túc các buổi trao đổi định kỳ, hoàn thành báo cáo đúng hạn.
  + Thang 1.0 - 1.7 điểm: Sinh viên có cố gắng nhưng cần sự đôn đốc của GVHD, tiến độ đôi khi còn chậm trễ.
  + Dưới 1.0 điểm: Thường xuyên trễ hẹn, thiếu tinh thần trách nhiệm, thụ động và không tiếp thu góp ý chuyên môn của GVHD.

--------------------------------------------------------------------------------
3. QUY ĐỊNH VỀ HAI KẾT LUẬN ĐỘC LẬP VÀ RÀNG BUỘC TƯƠNG THÍCH TRONG BM04:
Trong phiếu nhận xét BM04, GVHD phải đưa ra 2 kết luận độc lập:
1. Kết quả thực hiện chương trình: ĐẠT CHUẨN ĐẦU RA (MEETS_PROGRAM_OUTCOMES / COMPLETED) hoặc KHÔNG ĐẠT CHUẨN ĐẦU RA (DOES_NOT_MEET_PROGRAM_OUTCOMES / NOT_COMPLETED).
2. Đề xuất bảo vệ: ĐỒNG Ý CHO BẢO VỆ (ALLOW_DEFENSE / APPROVE_FOR_DEFENSE) hoặc KHÔNG ĐỒNG Ý CHO BẢO VỆ (DO_NOT_ALLOW_DEFENSE / NOT_APPROVE_FOR_DEFENSE).

Quy tắc ràng buộc logic bất biến:
- Trường hợp 1: Nếu kết quả là KHÔNG ĐẠT CHUẨN ĐẦU RA thì BẮT BUỘC phải đề xuất KHÔNG CHO BẢO VỆ. Hệ thống cấm tuyệt đối việc chọn "Không đạt chuẩn đầu ra" nhưng lại đề xuất "Cho phép bảo vệ" (INVALID_BM04_CONCLUSION_COMBINATION).
- Trường hợp 2: Nếu kết quả là ĐẠT CHUẨN ĐẦU RA nhưng GVHD vẫn quyết định KHÔNG CHO BẢO VỆ (do sinh viên vi phạm kỷ luật, thái độ tiêu cực hoặc lý do đạo đức học thuật), GVHD BẮT BUỘC phải nhập trường giải trình lý do không tương thích (mismatchReason). Nếu để trống, hệ thống sẽ từ chối lưu và ký phiếu.

--------------------------------------------------------------------------------
4. QUY TRÌNH ĐỀ XUẤT DỪNG ĐỀ TÀI BM03 VÀ THẨM ĐỊNH KHÔNG CHO BẢO VỆ BM04:
- Quy trình Dừng đề tài BM03 (PROPOSE_STOP):
  + Trong quá trình theo dõi, nếu sinh viên không tham gia họp, bỏ bê tiến độ hoặc không đạt Checkpoint, GVHD lập đề xuất Dừng đề tài (PROPOSE_STOP).
  + Đề xuất này kích hoạt quy trình thẩm định của Viện (InstituteStopReview) với thời hạn xử lý SLA nghiêm ngặt là 168 giờ.
  + Ban Chủ nhiệm Viện sẽ xem xét minh chứng và đưa ra quyết định: Duyệt dừng đề tài (chuyển sang trạng thái TERMINATED_FAILED_PROGRESS / STOPPED) hoặc yêu cầu giải trình thêm.
- Quy trình Thẩm định không cho bảo vệ BM04 (DO_NOT_ALLOW_DEFENSE):
  + Khi GVHD kết luận KHÔNG ĐỒNG Ý CHO BẢO VỆ, hồ sơ đề tài chuyển sang trạng thái Thẩm định của Viện (InstituteDefenseReview / PENDING_INSTITUTE_REVIEW) với thời hạn SLA 168 giờ.
  + Viện tiến hành thẩm định độc lập để bảo vệ quyền lợi chính đáng của cả giảng viên lẫn sinh viên. Nếu Viện đồng thuận với GVHD, đề tài chuyển trạng thái không đủ điều kiện bảo vệ (NOT_ELIGIBLE_FOR_DEFENSE).

--------------------------------------------------------------------------------
5. QUY CHẾ CHẤM ĐIỂM HỘI ĐỒNG BẢO VỆ VÀ BỘ CÂU HỎI PHẢN BIỆN 3 CẤP ĐỘ:
- Cơ chế chấm điểm Hội đồng bảo vệ:
  + Hội đồng gồm 3 thành viên chính thức: Chủ tịch (CHAIRMAN), Thư ký (SECRETARY) và Phản biện (REVIEWER).
  + Mỗi thành viên chấm điểm độc lập trên phiếu chấm điện tử riêng (DefenseMemberScore) theo thang điểm 10.
  + Điểm tổng kết = (Điểm Chủ tịch + Điểm Thư ký + Điểm Phản biện) / 3, làm tròn 1 chữ số thập phân.
- Bộ khung câu hỏi phản biện 3 cấp độ gợi ý cho Giảng viên & Hội đồng:
  + Cấp độ 1: KIẾN THỨC NỀN TẢNG (FOUNDATION)
    * Em hãy giải thích bản chất kiến trúc hệ thống và luồng dữ liệu chính trong giải pháp của đề tài.
    * Lý do em lựa chọn công nghệ/thuật toán này thay vì các giải pháp truyền thống khác?
    * Cơ sở toán học hoặc lý thuyết nền tảng đằng sau mô hình thực nghiệm là gì?
  + Cấp độ 2: THÁCH THỨC KỸ THUẬT VÀ TỐI ƯU HÓA (TECHNICAL_CHALLENGE)
    * Khi số lượng người dùng đồng thời hoặc dung lượng dữ liệu tăng đột biến (scale-up), hệ thống của em gặp những nút thắt cổ chai (bottleneck) nào và phương án khắc phục?
    * Làm thế nào em đảm bảo tính toàn vẹn dữ liệu và an toàn thông tin khi có tấn công mạng hoặc lỗi hệ thống bất ngờ?
    * Độ trễ (latency), độ chính xác (accuracy/precision/recall) hoặc tài nguyên phần cứng (CPU/RAM/GPU) của hệ thống đã được đo đạc và tối ưu hóa như thế nào?
  + Cấp độ 3: MỞ RỘNG VÀ TRIỂN VỌNG TƯƠNG LAI (FUTURE_EXPANSION)
    * Những hạn chế cốt lõi còn tồn tại trong đồ án hiện nay mà em chưa giải quyết trọn vẹn là gì?
    * Nếu có thêm 6 tháng nghiên cứu và nguồn kinh phí đầu tư, em sẽ định hướng thương mại hóa hoặc nâng cấp giải pháp này theo chiều hướng nào?
    * Khả năng tích hợp giải pháp của em vào các hệ thống công nghiệp thực tế hoặc tiêu chuẩn quốc tế hiện nay ra sao?
`;

module.exports = { lecturerKnowledge };
