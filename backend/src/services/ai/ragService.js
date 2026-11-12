/**
 * Academic Knowledge RAG Engine (ragService.js)
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án Tốt nghiệp
 *
 * Implements:
 * 1. Semantic document chunking of academic knowledge (Stages 1-6, BM01-BM04, FAQs).
 * 2. Strict RBAC role-based chunk isolation (STUDENT, LECTURER, ADMIN).
 * 3. High-performance cosine similarity vector mathematics.
 * 4. Context retrieval and ranking with top-K and minScore filters.
 * 5. Pre-computed vector indexing and caching for sub-10ms lookup.
 *
 * UTF-8 (no BOM)
 */

const fs = require('fs');
const path = require('path');
const { studentKnowledge } = require('./knowledge/studentKnowledge');
const { lecturerKnowledge } = require('./knowledge/lecturerKnowledge');
const { adminKnowledge } = require('./knowledge/adminKnowledge');

const DEFAULT_INDEX_PATH = path.resolve(__dirname, 'knowledge', 'knowledgeVectorIndex.json');

// In-memory cache for precomputed index
let inMemoryIndexCache = null;

/**
 * Standard semantic chunks covering all 6 stages and key administrative forms.
 */
function chunkKnowledgeBase() {
  return [
    // ---------------- STUDENT CHUNKS (roleScope: STUDENT) ----------------
    {
      id: 'student_core_rules',
      title: 'Nguyên tắc cốt lõi: 1 sinh viên 1 đề tài & Quota GVHD',
      stage: 1,
      roleScope: 'STUDENT',
      text: 'Mô hình đăng ký đơn lẻ (Single Registration Model): Mỗi đề tài tốt nghiệp chỉ do đúng 01 sinh viên thực hiện (maxStudents = 1). Tuyệt đối không áp dụng hình thức làm đồ án theo nhóm sinh viên. Định mức hướng dẫn (Quota): Mỗi Giảng viên hướng dẫn (GVHD) chỉ được hướng dẫn tối đa 10 sinh viên trong một học kỳ để đảm bảo chất lượng học thuật. Tính chính quy và minh bạch: Mọi bước từ nộp đề cương, nhận xét, ký biên bản đến công bố điểm đều được thực hiện trực tiếp trên Hệ thống Quản lý Đồ án Tốt nghiệp. Hệ thống không có cơ chế bỏ qua bước (zero bypass).',
    },
    {
      id: 'student_stage_1_registration',
      title: 'Giai đoạn 1: Chuẩn bị & Đăng ký đề tài với GVHD',
      stage: 1,
      roleScope: 'STUDENT',
      text: 'Điều kiện làm đồ án tốt nghiệp: Sinh viên phải tích lũy đủ số tín chỉ quy định của chương trình đào tạo, không nợ các học phần tiên quyết. Điểm trung bình tích lũy (GPA) đạt chuẩn theo thông báo xét duyệt làm đồ án của Viện trong từng học kỳ. Sinh viên có tên trong Danh sách đủ điều kiện làm đồ án tốt nghiệp do Viện công bố trên Trang chủ. Tra cứu thông tin: Sinh viên theo dõi Trang chủ hệ thống để xem Danh sách giảng viên hướng dẫn kèm theo các hướng nghiên cứu chuyên sâu (Trí tuệ nhân tạo, Kỹ thuật phần mềm, An toàn thông tin, Hệ thống nhúng & IoT, v.v.). Đăng ký và xét duyệt đề tài: Sinh viên chủ động liên hệ với GVHD qua email hoặc gặp trực tiếp để trao đổi nguyện vọng, ý tưởng nghiên cứu. Sinh viên nộp đơn đăng ký đề tài trên hệ thống gửi tới GVHD (trạng thái ban đầu: PENDING). GVHD xem xét và phản hồi: Duyệt chấp nhận (APPROVED) hoặc Từ chối (REJECTED) kèm lý do cụ thể. Nếu bị từ chối, sinh viên được phép liên hệ và gửi đơn đến GVHD khác trong thời hạn quy định.',
    },
    {
      id: 'student_stage_2_bm01_bm02',
      title: 'Giai đoạn 2: Đề cương BM01, Xét duyệt, BM02 và Quyết định giao đề tài',
      stage: 2,
      roleScope: 'STUDENT',
      text: 'Nộp Đề cương nghiên cứu (Biểu mẫu BM01): Sinh viên hoàn thiện Đề cương BM01 bao gồm 5 nội dung chính: Bối cảnh & Lý do chọn đề tài, Mục tiêu nghiên cứu, Phạm vi & Đối tượng nghiên cứu, Phương pháp tiếp cận & Giải pháp kỹ thuật, Kế hoạch thực hiện & Sản phẩm dự kiến. Nộp BM01 lên hệ thống đúng thời hạn trước ngày Hội đồng xét duyệt đề cương làm việc. Hội đồng xét duyệt đề cương: Hội đồng chuyên môn của Viện đánh giá đề cương BM01 theo 3 kết luận: ĐẠT (PASSED), CẦN CHỈNH SỬA (NEEDS_REVISION), KHÔNG ĐẠT / VẮNG (FAILED). Quy trình khi CẦN CHỈNH SỬA: Sinh viên tiếp thu ý kiến góp ý của Hội đồng, chỉnh sửa nội dung đề cương BM01 và nộp lại trên hệ thống. Đề cương nộp lại do GVHD trực tiếp thẩm định lại. Khi GVHD đánh giá ĐẠT, sinh viên mới được mở khóa nộp BM02. Tuyệt đối không được nộp BM02 khi BM01 chưa Đạt. Nộp Đơn đăng ký đề tài chính thức (Biểu mẫu BM02): Sinh viên cùng GVHD thống nhất tên đề tài chính thức và nộp BM02 lên hệ thống. Quyết định giao đề tài: Ban Giám đốc Viện ký Quyết định giao đề tài kèm danh sách sinh viên chính thức (decisionNumber, decisionDate). Đề tài chuyển sang trạng thái Đang thực hiện (IN_PROGRESS) và kích hoạt theo dõi tiến độ BM03.',
    },
    {
      id: 'student_stage_2_bm02a_window',
      title: 'Giai đoạn 2: Cửa sổ 7 ngày (168 giờ) xin đổi tên đề tài (BM02-A)',
      stage: 2,
      roleScope: 'STUDENT',
      text: 'Cửa sổ 7 ngày (168 giờ) xin đổi tên đề tài (Biểu mẫu BM02-A): Kể từ thời điểm Viện công bố Quyết định giao đề tài, sinh viên có đúng 7 ngày (168 giờ) để nộp đơn xin điều chỉnh tên đề tài (BM02-A) nếu quá trình nghiên cứu ban đầu cần tinh chỉnh phạm vi. Đơn xin đổi tên được gửi trực tiếp cho GVHD duyệt trên hệ thống. Khi GVHD phê duyệt (APPROVED), tên mới (adjustedTitle) được cập nhật và dùng xuyên suốt cho BM03, BM04 và Hội đồng bảo vệ. Sau 168 giờ, hệ thống tự động đóng tính năng đổi tên đề tài. Mọi đề nghị thay đổi sau đó đều không hợp lệ.',
    },
    {
      id: 'student_stage_3_bm03_progress',
      title: 'Giai đoạn 3: Thực hiện đề tài & Theo dõi tiến độ nghiêm ngặt (BM03)',
      stage: 3,
      roleScope: 'STUDENT',
      text: 'Thời gian nghiên cứu: Kéo dài khoảng 3 tháng theo kế hoạch đào tạo của Viện. Ghi nhận nhật ký trao đổi (Meeting Logs): Sinh viên định kỳ họp với GVHD (tối thiểu 1-2 tuần/lần), cập nhật nội dung trao đổi, kết quả đạt được và nhiệm vụ tuần tiếp theo vào hệ thống. Hai đợt Checkpoint tiến độ bắt buộc: Checkpoint 1: Đánh giá tiến độ giữa kỳ (khối lượng hoàn thành ước tính khoảng 40-50%). Checkpoint 2: Đánh giá tiến độ cuối kỳ (hoàn thiện sản phẩm demo và bản thảo báo cáo khoảng 80-90%). Kết quả đánh giá chỉ gồm 2 mức: ĐẠT (COMPLETED) hoặc KHÔNG ĐẠT (FAILED). NGUYÊN TẮC BẮT BUỘC VỀ DỪNG ĐỀ TÀI: Nếu sinh viên bị đánh giá KHÔNG ĐẠT ở bất kỳ Checkpoint nào, đề tài lập tức bị DỪNG THỰC HIỆN NGAY LẬP TỨC (trạng thái chuyển sang TERMINATED_FAILED_PROGRESS). Sinh viên bị hủy đồ án của học kỳ hiện tại và không được ra bảo vệ. Ký xác nhận BM03 (Cửa sổ 48 giờ): Khi kết thúc giai đoạn theo dõi, GVHD ký hoàn tất Phiếu theo dõi quá trình thực hiện BM03. Sinh viên có thời hạn 48 giờ để truy cập hệ thống kiểm tra và ký điện tử xác nhận phiếu BM03. Nếu quá 48 giờ mà sinh viên không ký, hệ thống tự động ghi nhận trạng thái quá hạn xác nhận và vẫn chuyển sang giai đoạn tiếp theo nếu kết luận của GVHD là cho phép tiếp tục.',
    },
    {
      id: 'student_stage_4_bm04_predefense',
      title: 'Giai đoạn 4: Đánh giá trước bảo vệ (BM04) & Trạng thái DEFENSE_READY',
      stage: 4,
      roleScope: 'STUDENT',
      text: '4 Tiêu chuẩn đánh giá chuẩn đầu ra công khai của GVHD: 1. Hình thức Báo cáo tốt nghiệp (BCTN): Trình bày đúng quy cách chuẩn của Viện, văn phong khoa học, trích dẫn tài liệu tham khảo đúng chuẩn IEEE/APA. 2. Nội dung nghiên cứu và giải pháp khoa học: Mức độ giải quyết trọn vẹn mục tiêu đề ra, độ sâu kỹ thuật, tính logic của các thuật toán hoặc kiến trúc hệ thống. 3. Tính ứng dụng và triển vọng phát triển: Khả năng triển khai thực tế, sản phẩm phần mềm/phần cứng hoạt động ổn định, tiềm năng mở rộng. 4. Thái độ làm việc, tính chủ động và hoàn thành nhiệm vụ: Sự nghiêm túc, tính tự chủ trong nghiên cứu, mức độ hợp tác và tuân thủ thời hạn của sinh viên. Quyết định cho phép bảo vệ: GVHD đưa ra kết luận: ĐỒNG Ý hoặc KHÔNG ĐỒNG Ý cho sinh viên ra bảo vệ trước Hội đồng. Ngay khi GVHD ký nộp, phiếu BM04 được khóa vĩnh viễn (isLocked = true), không thể chỉnh sửa điểm hay nhận xét. Khi GVHD ĐỒNG Ý, đề tài của sinh viên tự động chuyển sang trạng thái Sẵn sàng bảo vệ (DEFENSE_READY). Chỉ sinh viên đạt trạng thái này mới được Viện xếp lịch bảo vệ.',
    },
    {
      id: 'student_stage_5_defense_council',
      title: 'Giai đoạn 5: Hội đồng chấm Báo cáo tốt nghiệp & Bảo vệ',
      stage: 5,
      roleScope: 'STUDENT',
      text: 'Điều kiện tiên quyết: Sinh viên phải có trạng thái DEFENSE_READY từ BM04. Cơ cấu Hội đồng bảo vệ: Gồm 3 thành viên chính thức: 01 Chủ tịch Hội đồng, 01 Thư ký Hội đồng, 01 Giảng viên Phản biện. Nguyên tắc độc lập: GVHD không được là thành viên trong hội đồng chấm chính sinh viên do mình hướng dẫn. Quy chế buổi bảo vệ: Thời gian thuyết trình: Sinh viên trình bày báo cáo và demo sản phẩm từ 15 đến 20 phút. Thời gian vấn đáp: 10 đến 15 phút trả lời các câu hỏi phản biện từ các thành viên hội đồng. Tác phong: Trang phục trang trọng, thái độ tự tin, cầu thị và nắm vững bản chất kỹ thuật của công trình. Điểm tổng kết bảo vệ: 3 thành viên hội đồng chấm điểm độc lập trên thang điểm 10 theo các tiêu chuẩn: chất lượng báo cáo, nội dung nghiên cứu, kỹ năng thuyết trình và năng lực trả lời vấn đáp. Điểm tổng kết bảo vệ là TRUNG BÌNH CỘNG CÔNG KHAI của 3 thành viên hội đồng. Điểm số được công bố minh bạch trên hệ thống sau khi Hội đồng hoàn tất phiên họp.',
    },
    {
      id: 'student_stage_6_post_defense',
      title: 'Giai đoạn 6: Hoàn thiện sau bảo vệ & Nộp lưu chiểu',
      stage: 6,
      roleScope: 'STUDENT',
      text: 'Tiếp thu góp ý: Sinh viên đối chiếu biên bản góp ý của Hội đồng, chỉnh sửa toàn bộ các lỗi chính tả, định dạng và bổ sung giải trình khoa học. Nộp hồ sơ lưu chiểu: 01 bản quyển Báo cáo tốt nghiệp hoàn chỉnh định dạng PDF chuẩn (kèm bản in bìa cứng nộp văn phòng Viện nếu có yêu cầu theo đợt). Toàn bộ mã nguồn (source code) hoàn chỉnh, bộ cài đặt, tài liệu hướng dẫn vận hành và dữ liệu thực nghiệm lưu vào kho lưu trữ số của Viện. Xác nhận hoàn tất lưu chiểu là điều kiện bắt buộc để Viện công nhận tốt nghiệp và cấp bằng cử nhân/kỹ sư.',
    },
    {
      id: 'student_faq_registration_deadlines',
      title: 'Câu hỏi thường gặp: Đề tài đơn lẻ, BM01 chỉnh sửa, Cửa sổ đổi tên 168h, Checkpoint BM03',
      stage: 1,
      roleScope: 'STUDENT',
      text: 'Hỏi: Em có thể làm đồ án chung nhóm 2 bạn được không? Đáp: Không. Quy định bắt buộc của Viện là 1 sinh viên thực hiện 1 đề tài độc lập (maxStudents = 1). Hỏi: Nếu đề cương BM01 của em bị đánh giá Cần chỉnh sửa thì em có bị rớt đồ án không? Đáp: Không bị rớt ngay. Bạn cần chỉnh sửa lại đề cương theo góp ý của Hội đồng và nộp lại trên hệ thống để GVHD thẩm định lại. Khi GVHD duyệt Đạt, bạn sẽ được phép nộp BM02. Hỏi: Em có thể xin đổi tên đề tài vào tuần thứ 6 của đồ án không? Đáp: Không thể. Cửa sổ nộp đơn xin đổi tên đề tài (BM02-A) chỉ mở trong đúng 7 ngày (168 giờ) kể từ ngày Viện ban hành Quyết định giao đề tài. Sau 168 giờ, hệ thống sẽ tự động khóa vĩnh viễn tính năng này. Hỏi: Nếu em bị đánh giá Không đạt ở Checkpoint 1 giữa kỳ thì có cơ hội gỡ lại ở Checkpoint 2 không? Đáp: Không. Quy định của Viện rất nghiêm ngặt: nếu không đạt ở bất kỳ Checkpoint nào (dù là giữa kỳ hay cuối kỳ), đề tài sẽ bị DỪNG NGAY LẬP TỨC (TERMINATED_FAILED_PROGRESS) và không được tiếp tục.',
    },
    {
      id: 'student_faq_plagiarism_medical',
      title: 'Câu hỏi thường gặp: Liêm chính học thuật, chống đạo văn & Hoãn bảo vệ vì lý do sức khỏe',
      stage: 5,
      roleScope: 'STUDENT',
      text: 'Hỏi: Quy định về đạo văn và liêm chính học thuật là gì? Đáp: Toàn bộ báo cáo tốt nghiệp sẽ được quét qua phần mềm kiểm tra trùng lặp. Tỷ lệ trùng lặp phải dưới ngưỡng quy định của Viện (thông thường dưới 20-25%, loại trừ trích dẫn hợp lệ). Mọi hành vi sao chép công trình của người khác, mua bán đồ án, ngụy tạo số liệu thực nghiệm sẽ bị hủy kết quả và chuyển Hội đồng kỷ luật xử lý đình chỉ học tập. Hỏi: Sinh viên bị ốm hoặc có việc đột xuất trong ngày bảo vệ thì phải làm gì? Đáp: Sinh viên phải thông báo ngay cho GVHD và gửi đơn xin hoãn bảo vệ kèm minh chứng hợp lệ (giấy xác nhận của bệnh viện) về Giáo vụ Viện trước giờ khai mạc Hội đồng để được xem xét chuyển sang đợt bảo vệ bổ sung.',
    },

    // ---------------- LECTURER CHUNKS (roleScope: LECTURER) ----------------
    {
      id: 'lecturer_bm01_assessment',
      title: 'Nghiệp vụ Giảng viên: Hướng dẫn thẩm định và chấm đề cương BM01',
      stage: 2,
      roleScope: 'LECTURER',
      text: 'Khung thẩm định 5 chiều logic của Đề cương BM01: 1. Tính logic Tên - Mục tiêu: Tên đề tài phải bao quát đúng mục tiêu cụ thể, không quá rộng hoặc quá hẹp, phản ánh đúng bài toán nghiên cứu. 2. Tính khả thi Phương pháp: Phương pháp tiếp cận, thuật toán hoặc công nghệ đề xuất phải có cơ sở khoa học và khả thi trong thời gian 3 tháng của đồ án. 3. Phạm vi & Dữ liệu thực nghiệm: Phạm vi vừa sức với đồ án cử nhân/kỹ sư 1 sinh viên (maxStudents = 1), nguồn dữ liệu huấn luyện/thực nghiệm phải rõ ràng, có tính kiểm chứng. 4. Sản phẩm dự kiến: Phải có sản phẩm đo lường, nghiệm thu cụ thể (phần mềm demo, mô hình thực nghiệm, báo cáo đánh giá benchmark). 5. Tính hoàn thiện học thuật: Bố cục đề cương chặt chẽ, văn phong khoa học, trích dẫn tài liệu tham khảo sơ bộ đáng tin cậy. Quy trình thẩm định lại đề cương nộp lại: Đối với các đề cương bị Hội đồng xét duyệt đánh giá CẦN CHỈNH SỬA (NEEDS_REVISION), sinh viên sẽ chỉnh sửa và nộp lại trên hệ thống. Thẩm quyền thẩm định lại thuộc về duy nhất GVHD của sinh viên. GVHD đối chiếu các yêu cầu sửa đổi của Hội đồng, nếu sinh viên đã hoàn thiện đầy đủ thì bấm xác nhận ĐẠT để mở khóa cho sinh viên nộp đơn chính thức BM02.',
    },
    {
      id: 'lecturer_bm04_criteria',
      title: 'Nghiệp vụ Giảng viên: Bảng điểm chi tiết 4 tiêu chí chuẩn đầu ra BM04',
      stage: 4,
      roleScope: 'LECTURER',
      text: 'GVHD đánh giá toàn diện sinh viên trên biểu mẫu BM04 theo 4 tiêu chí chuẩn đầu ra (tổng thang điểm 10): Tiêu chí 1: Hình thức BCTN (0-2 điểm). Thang 1.8 - 2.0 điểm: Báo cáo trình bày rất đẹp, chuẩn chỉ theo quy định của Viện, không mắc lỗi chính tả, trích dẫn tài liệu tham khảo đúng chuẩn IEEE/APA, hình vẽ biểu bảng rõ ràng. Thang 1.0 - 1.7 điểm: Bố cục tương đối đầy đủ nhưng còn một số lỗi chính tả nhỏ, định dạng chưa đồng nhất ở một số bảng biểu. Dưới 1.0 điểm: Báo cáo trình bày cẩu thả, sai quy cách nghiêm trọng, thiếu tài liệu tham khảo hoặc trích dẫn sai nguyên tắc. Tiêu chí 2: Nội dung nghiên cứu và giải pháp khoa học (0-4 điểm). Thang 3.5 - 4.0 điểm: Hoàn thành xuất sắc mục tiêu nghiên cứu, giải pháp khoa học có tính sáng tạo, độ phức tạp kỹ thuật cao, phân tích và đánh giá kết quả thực nghiệm sâu sắc. Thang 2.5 - 3.4 điểm: Hoàn thành cơ bản các mục tiêu đề ra, phương pháp áp dụng hợp lý, có kết quả thực nghiệm đáp ứng yêu cầu đồ án tốt nghiệp. Dưới 2.5 điểm: Nội dung nông, giải pháp chắp vá hoặc không giải quyết được bài toán kỹ thuật trọng tâm đã cam kết trong BM01. Tiêu chí 3: Tính ứng dụng và triển vọng phát triển (0-2 điểm). Thang 1.8 - 2.0 điểm: Sản phẩm hoàn chỉnh, chạy thực tế mượt mà, ổn định, có giá trị ứng dụng thực tiễn cao hoặc có tiềm năng phát triển thành công trình công bố khoa học. Thang 1.0 - 1.7 điểm: Sản phẩm hoạt động được ở mức độ demo cơ bản, còn tồn tại lỗi nhỏ khi xử lý dữ liệu biên. Dưới 1.0 điểm: Sản phẩm không chạy được, không có khả năng ứng dụng thực tế. Tiêu chí 4: Thái độ làm việc, tính chủ động và hoàn thành nhiệm vụ (0-2 điểm). Thang 1.8 - 2.0 điểm: Sinh viên thể hiện tinh thần chủ động cao, độc lập giải quyết khó khăn, tham gia đầy đủ và nghiêm túc các buổi trao đổi định kỳ, hoàn thành báo cáo đúng hạn. Thang 1.0 - 1.7 điểm: Sinh viên có cố gắng nhưng cần sự đôn đốc của GVHD, tiến độ đôi khi còn chậm trễ. Dưới 1.0 điểm: Thường xuyên trễ hẹn, thiếu tinh thần trách nhiệm, thụ động và không tiếp thu góp ý chuyên môn của GVHD.',
    },
    {
      id: 'lecturer_bm04_dual_conclusions',
      title: 'Nghiệp vụ Giảng viên: Quy định về hai kết luận độc lập và ràng buộc tương thích trong BM04',
      stage: 4,
      roleScope: 'LECTURER',
      text: 'Trong phiếu nhận xét BM04, GVHD phải đưa ra 2 kết luận độc lập: 1. Kết quả thực hiện chương trình: ĐẠT CHUẨN ĐẦU RA (MEETS_PROGRAM_OUTCOMES) hoặc KHÔNG ĐẠT CHUẨN ĐẦU RA (DOES_NOT_MEET_PROGRAM_OUTCOMES). 2. Đề xuất bảo vệ: ĐỒNG Ý CHO BẢO VỆ (ALLOW_DEFENSE) hoặc KHÔNG ĐỒNG Ý CHO BẢO VỆ (DO_NOT_ALLOW_DEFENSE). Quy tắc ràng buộc logic bất biến: Trường hợp 1: Nếu kết quả là KHÔNG ĐẠT CHUẨN ĐẦU RA thì BẮT BUỘC phải đề xuất KHÔNG CHO BẢO VỆ. Hệ thống cấm tuyệt đối việc chọn Không đạt chuẩn đầu ra nhưng lại đề xuất Cho phép bảo vệ (INVALID_BM04_CONCLUSION_COMBINATION). Trường hợp 2: Nếu kết quả là ĐẠT CHUẨN ĐẦU RA nhưng GVHD vẫn quyết định KHÔNG CHO BẢO VỆ (do sinh viên vi phạm kỷ luật, thái độ tiêu cực hoặc lý do đạo đức học thuật), GVHD BẮT BUỘC phải nhập trường giải trình lý do không tương thích (mismatchReason). Nếu để trống, hệ thống sẽ từ chối lưu và ký phiếu.',
    },
    {
      id: 'lecturer_bm03_stop_and_defense_appeal',
      title: 'Nghiệp vụ Giảng viên: Quy trình đề xuất dừng đề tài BM03 & Thẩm định không cho bảo vệ BM04',
      stage: 3,
      roleScope: 'LECTURER',
      text: 'Quy trình Dừng đề tài BM03 (PROPOSE_STOP): Trong quá trình theo dõi, nếu sinh viên không tham gia họp, bỏ bê tiến độ hoặc không đạt Checkpoint, GVHD lập đề xuất Dừng đề tài (PROPOSE_STOP). Đề xuất này kích hoạt quy trình thẩm định của Viện (InstituteStopReview) với thời hạn xử lý SLA nghiêm ngặt là 168 giờ. Ban Chủ nhiệm Viện sẽ xem xét minh chứng và đưa ra quyết định: Duyệt dừng đề tài (chuyển sang TERMINATED_FAILED_PROGRESS / STOPPED) hoặc yêu cầu giải trình thêm. Quy trình Thẩm định không cho bảo vệ BM04 (DO_NOT_ALLOW_DEFENSE): Khi GVHD kết luận KHÔNG ĐỒNG Ý CHO BẢO VỆ, hồ sơ đề tài chuyển sang trạng thái Thẩm định của Viện (InstituteDefenseReview / PENDING_INSTITUTE_REVIEW) với thời hạn SLA 168 giờ. Viện tiến hành thẩm định độc lập để bảo vệ quyền lợi chính đáng của cả giảng viên lẫn sinh viên. Nếu Viện đồng thuận với GVHD, đề tài chuyển trạng thái không đủ điều kiện bảo vệ (NOT_ELIGIBLE_FOR_DEFENSE).',
    },
    {
      id: 'lecturer_defense_council_questions',
      title: 'Nghiệp vụ Giảng viên: Quy chế chấm điểm Hội đồng bảo vệ & Bộ câu hỏi phản biện 3 cấp độ',
      stage: 5,
      roleScope: 'LECTURER',
      text: 'Cơ chế chấm điểm Hội đồng bảo vệ: Hội đồng gồm 3 thành viên chính thức: Chủ tịch (CHAIRMAN), Thư ký (SECRETARY) và Phản biện (REVIEWER). Mỗi thành viên chấm điểm độc lập trên phiếu chấm điện tử riêng (DefenseMemberScore) theo thang điểm 10. Điểm tổng kết = (Điểm Chủ tịch + Điểm Thư ký + Điểm Phản biện) / 3, làm tròn 1 chữ số thập phân. Bộ khung câu hỏi phản biện 3 cấp độ gợi ý cho Giảng viên & Hội đồng: Cấp độ 1: KIẾN THỨC NỀN TẢNG (FOUNDATION): Em hãy giải thích bản chất kiến trúc hệ thống và luồng dữ liệu chính trong giải pháp của đề tài; Lý do em lựa chọn công nghệ/thuật toán này thay vì các giải pháp truyền thống khác; Cơ sở toán học hoặc lý thuyết nền tảng đằng sau mô hình thực nghiệm là gì? Cấp độ 2: THÁCH THỨC KỸ THUẬT VÀ TỐI ƯU HÓA (TECHNICAL_CHALLENGE): Khi số lượng người dùng đồng thời hoặc dung lượng dữ liệu tăng đột biến (scale-up), hệ thống của em gặp những nút thắt cổ chai (bottleneck) nào và phương án khắc phục; Làm thế nào em đảm bảo tính toàn vẹn dữ liệu và an toàn thông tin khi có tấn công mạng hoặc lỗi hệ thống bất ngờ; Độ trễ (latency), độ chính xác (accuracy/precision/recall) hoặc tài nguyên phần cứng (CPU/RAM/GPU) của hệ thống đã được đo đạc và tối ưu hóa như thế nào? Cấp độ 3: MỞ RỘNG VÀ TRIỂN VỌNG TƯƠNG LAI (FUTURE_EXPANSION): Những hạn chế cốt lõi còn tồn tại trong đồ án hiện nay mà em chưa giải quyết trọn vẹn là gì; Nếu có thêm 6 tháng nghiên cứu và nguồn kinh phí đầu tư, em sẽ định hướng thương mại hóa hoặc nâng cấp giải pháp này theo chiều hướng nào; Khả năng tích hợp giải pháp của em vào các hệ thống công nghiệp thực tế hoặc tiêu chuẩn quốc tế hiện nay ra sao?',
    },

    // ---------------- ADMIN CHUNKS (roleScope: ADMIN) ----------------
    {
      id: 'admin_decision_and_appendix',
      title: 'Nghiệp vụ Quản trị: Quyết định giao đề tài & Phụ lục điều chỉnh tên (TitleAdjustmentAppendix)',
      stage: 2,
      roleScope: 'ADMIN',
      text: 'Ban hành Quyết định giao đề tài: Sau khi các đề cương BM01 đã đạt và sinh viên cùng GVHD nộp đầy đủ BM02, Giáo vụ và Quản trị viên tổng hợp danh sách. Ban Chủ nhiệm Viện ban hành Quyết định giao đề tài tốt nghiệp kèm danh sách chính thức, bao gồm số quyết định (decisionNumber) và ngày ký ban hành (decisionDate). Khi Quyết định được ban hành trên hệ thống: Tất cả đề tài hợp lệ tự động chuyển trạng thái sang Đang thực hiện (IN_PROGRESS); Hệ thống tự động tạo 2 Task Checkpoint tiến độ (BM03 Checkpoint 1 và Checkpoint 2); Kích hoạt đếm ngược thời gian Cửa sổ 168 giờ (đúng 7 ngày) cho phép sinh viên nộp đơn xin đổi tên đề tài (BM02-A). Ban hành Phụ lục điều chỉnh tên đề tài theo đợt (TitleAdjustmentAppendix): Khi hết thời hạn 168 giờ của cửa sổ đổi tên, Giáo vụ rà soát toàn bộ các đơn BM02-A đã được GVHD phê duyệt (APPROVED). Hệ thống tổng hợp thành một Phụ lục điều chỉnh tên đề tài tốt nghiệp chính thức theo đợt (TitleAdjustmentAppendix) để Ban Chủ nhiệm Viện ký phê duyệt. Cơ chế pháp lý số: Tên đề tài điều chỉnh (adjustedTitle) trở thành tên pháp lý sử dụng trên phiếu chấm BM03, BM04, biên bản Hội đồng bảo vệ và bằng tốt nghiệp. Tuy nhiên, tên gốc ban đầu (originalTitle) trong Quyết định giao đề tài vẫn được lưu vết bất biến trong cơ sở dữ liệu để phục vụ kiểm toán học vụ.',
    },
    {
      id: 'admin_sla_reviews_extension',
      title: 'Nghiệp vụ Quản trị: Quản lý SLA thẩm định dừng/không bảo vệ & Cơ chế gia hạn 72 giờ',
      stage: 3,
      roleScope: 'ADMIN',
      text: 'Thời hạn SLA xử lý tiêu chuẩn: Cả hai quy trình Thẩm định Dừng đề tài BM03 (InstituteStopReview) và Thẩm định Không cho bảo vệ BM04 (InstituteDefenseReview) đều có thời hạn SLA xử lý chuẩn là 168 giờ (7 ngày) kể từ khi phát sinh yêu cầu. Trong thời hạn này, Ban Chủ nhiệm Viện và Giáo vụ có trách nhiệm xem xét hồ sơ, đối chất với GVHD và sinh viên (nếu cần thiết) để đưa ra quyết định cuối cùng. Cơ chế gia hạn duy nhất 1 lần thêm tối đa 72 giờ: Trong các trường hợp phức tạp cần thu thập thêm chứng cứ xác thực (ví dụ: xác minh vi phạm liêm chính học thuật, hồ sơ bệnh án hoặc tranh chấp kỹ thuật), Ban Chủ nhiệm Viện có quyền kích hoạt tính năng Gia hạn thời hạn thẩm định. Quy tắc ràng buộc: Mỗi hồ sơ CHỈ ĐƯỢC PHÉP GIA HẠN DUY NHẤT 01 LẦN với thời gian cộng thêm tối đa đúng 72 giờ (3 ngày). Hệ thống từ chối mọi yêu cầu gia hạn lần thứ hai. Khi hết thời hạn thẩm định (kể cả thời gian đã gia hạn), nếu Viện chưa kịp ra quyết định thủ công thì hệ thống sẽ tự động kích hoạt tiến trình xử lý tự động để tránh treo hồ sơ sinh viên vô thời hạn.',
    },
    {
      id: 'admin_sweep_jobs_automation',
      title: 'Nghiệp vụ Quản trị: Nguyên tắc hoạt động của 5 tiến trình quét nền tự động (5 Sweep Jobs)',
      stage: 6,
      roleScope: 'ADMIN',
      text: 'Hệ thống vận hành 5 tiến trình tự động hóa (Sweep Jobs) định kỳ được hiện thực hóa trong dịch vụ bm02ToBm04SweepService.js: Nguyên tắc Idempotent: Tất cả 5 Sweep Jobs đều được thiết kế bảo đảm tính Idempotent tuyệt đối (chạy lặp lại nhiều lần với cùng dữ liệu thời gian thì kết quả không bị nhân bản hay xung đột). Nguyên tắc Liêm chính Chữ ký số (Zero Fake Signatures): Khi hệ thống tự động xử lý do quá hạn thời gian (Timeout), hệ thống TUYỆT ĐỐI KHÔNG TẠO CHỮ KÝ GIẢ mạo danh con người. Trường reviewedById hoặc chữ ký sinh viên/giảng viên bắt buộc để null và ghi nhận nguồn quyết định là SYSTEM_TIMEOUT hoặc ACKNOWLEDGEMENT_TIMEOUT. Chi tiết 5 Sweep Jobs: 1. Job 1 - Đóng cửa sổ BM02-A: Tự động đóng cổng tiếp nhận đơn đổi tên BM02-A của các đề tài có thời điểm công bố Quyết định giao đề tài quá 168 giờ. 2. Job 2 - Hủy đơn BM02-A quá hạn (EXPIRED): Tự động chuyển trạng thái các đơn BM02-A đang soạn thảo dở dang hoặc chưa nộp lại quá hạn sang trạng thái Hết hạn (EXPIRED). 3. Job 3 - Tự động dừng hồ sơ BM03 quá hạn SLA (AUTO_TERMINATED): Tự động chuyển các hồ sơ InstituteStopReview quá hạn stopReviewDeadline sang trạng thái AUTO_TERMINATED với nguồn SYSTEM_TIMEOUT. 4. Job 4 - Tự động hoàn tất xác nhận BM03 quá hạn 48 giờ (ACKNOWLEDGEMENT_TIMEOUT): Tự động xử lý các phiếu BM03 mà sinh viên không chịu ký xác nhận trong 48 giờ, xuất bản tệp PDF lưu chiểu chính thức ghi rõ lưu ý hệ thống về việc quá hạn và không có chữ ký của sinh viên. Nếu kết luận của GVHD là CONTINUE_TO_BM04, hệ thống tự động chuyển hồ sơ sang BM03_PASSED và mở Task BM04 cho giảng viên. 5. Job 5 - Tự động chốt hồ sơ thẩm định BM04 quá hạn SLA (AUTO_NOT_ELIGIBLE): Tự động xử lý các hồ sơ InstituteDefenseReview quá hạn reviewDeadlineAt sang AUTO_NOT_ELIGIBLE với nguồn SYSTEM_TIMEOUT, chuyển trạng thái đề tài sang NOT_ELIGIBLE_FOR_DEFENSE.',
    },
    {
      id: 'admin_appeals_regrade',
      title: 'Nghiệp vụ Quản trị: Quy định giải quyết khiếu nại điểm bảo vệ và phúc khảo',
      stage: 6,
      roleScope: 'ADMIN',
      text: 'Thời hạn nộp đơn phúc khảo: Sinh viên có quyền làm đơn phúc khảo kết quả bảo vệ gửi về Văn phòng Viện trong thời hạn 03 ngày làm việc kể từ thời điểm công bố điểm bảo vệ chính thức. Quy trình thành lập Hội đồng Thẩm định Phúc khảo: Ban Chủ nhiệm Viện ban hành quyết định thành lập Tổ thẩm định độc lập gồm tối thiểu 02 giảng viên có học vị Tiến sĩ trở lên trong cùng chuyên ngành, không phải là thành viên của Hội đồng bảo vệ ban đầu và không phải là GVHD của sinh viên. Tổ thẩm định rà soát lại: 1) Quyển báo cáo tốt nghiệp, 2) Băng ghi âm/ghi hình phiên bảo vệ, 3) Phiếu chấm điểm chi tiết của từng thành viên hội đồng. Nguyên tắc điều chỉnh điểm: Điểm số chỉ được điều chỉnh trong trường hợp: Có sai sót số học khi tính trung bình cộng, có sai phạm quy trình bảo vệ, hoặc có sự chênh lệch điểm bất thường trái với quy chế chấm điểm mà thành viên hội đồng không đưa ra được lập luận khoa học. Mọi quyết định thay đổi điểm phải được Trưởng Viện phê duyệt bằng văn bản và cập nhật công khai trong lịch sử học vụ.',
    },
  ];
}

/**
 * Filter chunks according to the authenticated user's role (RBAC).
 *
 * - STUDENT: Only gets chunks with roleScope === 'STUDENT'. Never gets LECTURER or ADMIN chunks.
 * - LECTURER: Gets chunks with roleScope === 'STUDENT' or 'LECTURER'. Never gets ADMIN chunks.
 * - ADMIN (including GIAO_VU, VIEN_TRUONG, PROJECT_OVERSIGHT_MANAGE): Gets all chunks.
 *
 * @param {Array<object>} chunks
 * @param {string|object} userRole - Role string or User object
 * @returns {Array<object>} Filtered chunks
 */
function filterChunksByRole(chunks, userRole) {
  if (!Array.isArray(chunks)) return [];

  let normalizedRole = 'STUDENT';

  if (userRole && typeof userRole === 'object') {
    const role = String(userRole.role || '').toUpperCase();
    const permissions = Array.isArray(userRole.permissionGroups) ? userRole.permissionGroups : [];

    const isAdminTier =
      role === 'ADMIN' ||
      role === 'VIEN_TRUONG' ||
      permissions.includes('GIAO_VU') ||
      permissions.includes('PROJECT_OVERSIGHT_MANAGE');

    if (isAdminTier) {
      normalizedRole = 'ADMIN';
    } else if (role === 'LECTURER' || role === 'GIANG_VIEN' || role === 'FACULTY') {
      normalizedRole = 'LECTURER';
    } else {
      normalizedRole = 'STUDENT';
    }
  } else if (typeof userRole === 'string') {
    const upper = userRole.trim().toUpperCase();
    if (['ADMIN', 'GIAO_VU', 'VIEN_TRUONG', 'PROJECT_OVERSIGHT_MANAGE'].includes(upper)) {
      normalizedRole = 'ADMIN';
    } else if (['LECTURER', 'GIANG_VIEN', 'FACULTY', 'COUNCIL_MEMBER'].includes(upper)) {
      normalizedRole = 'LECTURER';
    } else {
      normalizedRole = 'STUDENT';
    }
  }

  let allowedScopes = ['STUDENT'];
  if (normalizedRole === 'ADMIN') {
    allowedScopes = ['STUDENT', 'LECTURER', 'ADMIN'];
  } else if (normalizedRole === 'LECTURER') {
    allowedScopes = ['STUDENT', 'LECTURER'];
  }

  return chunks.filter((c) => allowedScopes.includes(c.roleScope));
}

/**
 * Compute pure JavaScript cosine similarity between two numeric vectors.
 *
 * Formula: dotProduct(vecA, vecB) / (norm(vecA) * norm(vecB))
 * Safely returns 0.0 if vectors are empty, length mismatched, or zero norm.
 *
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number} Value in [-1.0, 1.0]
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0.0;
  if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0.0;

  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normASq += a * a;
    normBSq += b * b;
  }

  const denominator = Math.sqrt(normASq) * Math.sqrt(normBSq);
  if (denominator === 0) return 0.0;

  const cos = dotProduct / denominator;
  return Math.max(-1.0, Math.min(1.0, cos));
}

/**
 * Load precomputed vector index from disk JSON.
 * @param {string} [filePath]
 * @returns {Array<object>|null}
 */
function loadPrecomputedIndex(filePath = DEFAULT_INDEX_PATH) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      inMemoryIndexCache = parsed;
      return parsed;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Save precomputed vector index to disk JSON in UTF-8 (no BOM).
 * @param {Array<object>} chunks
 * @param {string} [filePath]
 * @returns {boolean}
 */
function savePrecomputedIndex(chunks, filePath = DEFAULT_INDEX_PATH) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(chunks, null, 2), 'utf8');
    inMemoryIndexCache = chunks;
    return true;
  } catch (err) {
    throw new Error(`Failed to save precomputed vector index: ${err.message}`);
  }
}

/**
 * Retrieve the top-K most relevant chunks for a user query, strictly bounded by RBAC.
 *
 * @param {object} options
 * @param {string} options.query - User query string
 * @param {string|object} [options.userRole] - User role or User object
 * @param {number} [options.topK=3] - Max chunks to return
 * @param {number} [options.minScore=0.3] - Minimum similarity threshold
 * @param {Function} [options.embedFn] - Custom async embedding function (text) => Array<number>
 * @param {Array<object>} [options.chunks] - Optional pre-embedded chunks
 * @returns {Promise<Array<object>>} Ranked list of matching chunks with similarity score
 */
async function retrieveRelevantChunks(options = {}) {
  const {
    query,
    userRole = 'STUDENT',
    topK = 3,
    minScore = 0.3,
    embedFn,
    chunks: providedChunks,
  } = options;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  // 1. Resolve candidate chunks
  let sourceChunks = providedChunks;
  if (!sourceChunks || !Array.isArray(sourceChunks)) {
    sourceChunks = inMemoryIndexCache || loadPrecomputedIndex() || chunkKnowledgeBase();
  }

  // 2. Strict RBAC Filter: eliminate non-permitted chunks before calculation
  const candidateChunks = filterChunksByRole(sourceChunks, userRole);
  if (!candidateChunks.length) {
    return [];
  }

  // 3. Generate query embedding vector
  let queryVector = null;
  try {
    if (typeof embedFn === 'function') {
      queryVector = await embedFn(query.trim());
    } else {
      const ollamaProvider = require('./ollamaProvider');
      queryVector = await ollamaProvider.generateEmbedding({ text: query.trim() });
    }
  } catch (_err) {
    // If embedding generation fails, fail gracefully and return empty array
    return [];
  }

  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    return [];
  }

  // 4. Score each permitted chunk against query vector
  const scoredChunks = [];

  for (const chunk of candidateChunks) {
    let chunkVector = chunk.embedding;

    // If chunk does not have embedding yet, attempt to compute if embedFn provided
    if ((!chunkVector || !Array.isArray(chunkVector)) && typeof embedFn === 'function') {
      try {
        chunkVector = await embedFn(chunk.text);
      } catch (_e) {
        chunkVector = null;
      }
    }

    if (!Array.isArray(chunkVector) || chunkVector.length === 0) {
      continue;
    }

    const similarity = cosineSimilarity(queryVector, chunkVector);

    if (similarity >= minScore) {
      scoredChunks.push({
        ...chunk,
        similarity,
      });
    }
  }

  // 5. Rank descending by cosine similarity
  scoredChunks.sort((a, b) => b.similarity - a.similarity);

  // 6. Return top-K chunks
  return scoredChunks.slice(0, topK);
}

/**
 * Format a list of retrieved chunks into a clean Markdown block for prompt injection.
 *
 * @param {Array<object>} chunks
 * @returns {string} Formatted Markdown RAG context
 */
function formatRagContext(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return '';
  }

  const lines = [
    '=== CÁC ĐIỀU KHOẢN QUY CHẾ ĐƯỢC TRÍCH XUẤT (RAG CONTEXT) ===',
  ];

  chunks.forEach((chunk, idx) => {
    const itemNum = idx + 1;
    const stageInfo = chunk.stage ? ` (Giai đoạn ${chunk.stage} - Phân quyền ${chunk.roleScope || 'STUDENT'})` : '';
    lines.push(`[Điều khoản ${itemNum}: ${chunk.title}${stageInfo}]`);
    lines.push(chunk.text.trim());
    lines.push('');
  });

  lines.push('==============================================================');

  return lines.join('\n').trim();
}

module.exports = {
  chunkKnowledgeBase,
  filterChunksByRole,
  cosineSimilarity,
  loadPrecomputedIndex,
  savePrecomputedIndex,
  retrieveRelevantChunks,
  formatRagContext,
  DEFAULT_INDEX_PATH,
};
