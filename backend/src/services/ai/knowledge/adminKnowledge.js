/**
 * TÀI LIỆU TRI THỨC QUẢN TRỊ DÀNH CHO VIỆN, QUẢN TRỊ VIÊN VÀ GIÁO VỤ
 * Viện Công nghệ Số - Hệ thống Quản lý Đồ án & Khóa luận Tốt nghiệp
 *
 * Chuẩn mã hóa: UTF-8 (no BOM)
 * Phân quyền: Cấp cho ADMIN, Ban Chủ nhiệm Viện (VIEN_TRUONG), và Giảng viên có quyền Giáo vụ (GIAO_VU, PROJECT_OVERSIGHT_MANAGE).
 * Tuyệt đối không cung cấp cho Sinh viên hay Giảng viên thông thường.
 */

const adminKnowledge = `
================================================================================
TRI THỨC QUẢN TRỊ DÀNH CHO BAN CHỦ NHIỆM VIỆN, QUẢN TRỊ VIÊN VÀ GIÁO VỤ
VIỆN CÔNG NGHỆ SỐ - ĐIỀU HÀNH HỆ THỐNG, QUY CHUẨN SLA VÀ AUTOMATION JOBS
================================================================================

1. QUY TRÌNH BAN HÀNH QUYẾT ĐỊNH GIAO ĐỀ TÀI VÀ CỬA SỔ ĐỔI TÊN ĐỀ TÀI:
- Ban hành Quyết định giao đề tài:
  + Sau khi các đề cương BM01 đã đạt và sinh viên cùng GVHD nộp đầy đủ BM02, Giáo vụ và Quản trị viên tổng hợp danh sách.
  + Ban Chủ nhiệm Viện ban hành "Quyết định giao đề tài tốt nghiệp kèm danh sách chính thức", bao gồm số quyết định (decisionNumber) và ngày ký ban hành (decisionDate).
  + Khi Quyết định được ban hành trên hệ thống:
    * Tất cả đề tài hợp lệ tự động chuyển trạng thái sang Đang thực hiện (IN_PROGRESS).
    * Hệ thống tự động tạo 2 Task Checkpoint tiến độ (BM03 Checkpoint 1 và Checkpoint 2).
    * Kích hoạt đếm ngược thời gian Cửa sổ 168 giờ (đúng 7 ngày) cho phép sinh viên nộp đơn xin đổi tên đề tài (BM02-A).
- Ban hành Phụ lục điều chỉnh tên đề tài theo đợt (TitleAdjustmentAppendix):
  + Khi hết thời hạn 168 giờ của cửa sổ đổi tên, Giáo vụ rà soát toàn bộ các đơn BM02-A đã được GVHD phê duyệt (APPROVED).
  + Hệ thống tổng hợp thành một "Phụ lục điều chỉnh tên đề tài tốt nghiệp" chính thức theo đợt (TitleAdjustmentAppendix) để Ban Chủ nhiệm Viện ký phê duyệt.
  + Cơ chế pháp lý số: Tên đề tài điều chỉnh (adjustedTitle) trở thành tên pháp lý sử dụng trên phiếu chấm BM03, BM04, biên bản Hội đồng bảo vệ và bằng tốt nghiệp. Tuy nhiên, tên gốc ban đầu (originalTitle) trong Quyết định giao đề tài vẫn được lưu vết bất biến trong cơ sở dữ liệu để phục vụ kiểm toán học vụ.

--------------------------------------------------------------------------------
2. QUẢN LÝ SLA THẨM ĐỊNH DỪNG ĐỀ TÀI / KHÔNG BẢO VỆ VÀ CƠ CHẾ GIA HẠN 72 GIỜ:
- Thời hạn SLA xử lý tiêu chuẩn:
  + Cả hai quy trình Thẩm định Dừng đề tài BM03 (InstituteStopReview) và Thẩm định Không cho bảo vệ BM04 (InstituteDefenseReview) đều có thời hạn SLA xử lý chuẩn là 168 giờ (7 ngày) kể từ khi phát sinh yêu cầu.
  + Trong thời hạn này, Ban Chủ nhiệm Viện và Giáo vụ có trách nhiệm xem xét hồ sơ, đối chất với GVHD và sinh viên (nếu cần thiết) để đưa ra quyết định cuối cùng.
- Cơ chế gia hạn duy nhất 1 lần thêm tối đa 72 giờ:
  + Trong các trường hợp phức tạp cần thu thập thêm chứng cứ xác thực (ví dụ: xác minh vi phạm liêm chính học thuật, hồ sơ bệnh án hoặc tranh chấp kỹ thuật), Ban Chủ nhiệm Viện có quyền kích hoạt tính năng Gia hạn thời hạn thẩm định.
  + Quy tắc ràng buộc: Mỗi hồ sơ CHỈ ĐƯỢC PHÉP GIA HẠN DUY NHẤT 01 LẦN với thời gian cộng thêm tối đa đúng 72 giờ (3 ngày). Hệ thống từ chối mọi yêu cầu gia hạn lần thứ hai.
  + Khi hết thời hạn thẩm định (kể cả thời gian đã gia hạn), nếu Viện chưa kịp ra quyết định thủ công thì hệ thống sẽ tự động kích hoạt tiến trình xử lý tự động để tránh treo hồ sơ sinh viên vô thời hạn.

--------------------------------------------------------------------------------
3. NGUYÊN TẮC HOẠT ĐỘNG CỦA 5 TIẾN TRÌNH QUÉT NỀN TỰ ĐỘNG (5 SWEEP JOBS):
Hệ thống vận hành 5 tiến trình tự động hóa (Sweep Jobs) định kỳ được hiện thực hóa trong dịch vụ bm02ToBm04SweepService.js:
- Nguyên tắc Idempotent: Tất cả 5 Sweep Jobs đều được thiết kế bảo đảm tính Idempotent tuyệt đối (chạy lặp lại nhiều lần với cùng dữ liệu thời gian thì kết quả không bị nhân bản hay xung đột).
- Nguyên tắc Liêm chính Chữ ký số (Zero Fake Signatures): Khi hệ thống tự động xử lý do quá hạn thời gian (Timeout), hệ thống TUYỆT ĐỐI KHÔNG TẠO CHỮ KÝ GIẢ mạo danh con người. Trường reviewedById hoặc chữ ký sinh viên/giảng viên bắt buộc để null và ghi nhận nguồn quyết định là SYSTEM_TIMEOUT hoặc ACKNOWLEDGEMENT_TIMEOUT.

Chi tiết 5 Sweep Jobs:
1. Job 1 - Đóng cửa sổ BM02-A: Tự động đóng cổng tiếp nhận đơn đổi tên BM02-A của các đề tài có thời điểm công bố Quyết định giao đề tài quá 168 giờ (decisionPublishedAt < now - 168h).
2. Job 2 - Hủy đơn BM02-A quá hạn (EXPIRED): Tự động chuyển trạng thái các đơn BM02-A đang soạn thảo dở dang hoặc chưa nộp lại quá hạn sang trạng thái Hết hạn (EXPIRED).
3. Job 3 - Tự động dừng hồ sơ BM03 quá hạn SLA (AUTO_TERMINATED): Tự động chuyển các hồ sơ InstituteStopReview quá hạn stopReviewDeadline sang trạng thái AUTO_TERMINATED với nguồn SYSTEM_TIMEOUT, chuyển hồ sơ đề tài sang AUTO_TERMINATED và đóng sớm tiến độ BM03 với kết luận STOPPED.
4. Job 4 - Tự động hoàn tất xác nhận BM03 quá hạn 48 giờ (ACKNOWLEDGEMENT_TIMEOUT): Tự động xử lý các phiếu BM03 mà sinh viên không chịu ký xác nhận trong 48 giờ (studentAckStatus = ACKNOWLEDGEMENT_TIMEOUT), xuất bản tệp PDF lưu chiểu chính thức ghi rõ lưu ý hệ thống về việc quá hạn và không có chữ ký của sinh viên. Nếu kết luận của GVHD là CONTINUE_TO_BM04, hệ thống tự động chuyển hồ sơ sang BM03_PASSED và mở Task BM04 cho giảng viên.
5. Job 5 - Tự động chốt hồ sơ thẩm định BM04 quá hạn SLA (AUTO_NOT_ELIGIBLE): Tự động xử lý các hồ sơ InstituteDefenseReview quá hạn reviewDeadlineAt sang AUTO_NOT_ELIGIBLE với nguồn SYSTEM_TIMEOUT, chuyển trạng thái đề tài sang NOT_ELIGIBLE_FOR_DEFENSE.

--------------------------------------------------------------------------------
4. QUY ĐỊNH GIẢI QUYẾT KHIẾU NẠI ĐIỂM BẢO VỆ VÀ PHÚC KHẢO:
- Thời hạn nộp đơn phúc khảo: Sinh viên có quyền làm đơn phúc khảo kết quả bảo vệ gửi về Văn phòng Viện trong thời hạn 03 ngày làm việc kể từ thời điểm công bố điểm bảo vệ chính thức.
- Quy trình thành lập Hội đồng Thẩm định Phúc khảo:
  + Ban Chủ nhiệm Viện ban hành quyết định thành lập Tổ thẩm định độc lập gồm tối thiểu 02 giảng viên có học vị Tiến sĩ trở lên trong cùng chuyên ngành, không phải là thành viên của Hội đồng bảo vệ ban đầu và không phải là GVHD của sinh viên.
  + Tổ thẩm định rà soát lại: 1) Quyển báo cáo tốt nghiệp, 2) Băng ghi âm/ghi hình phiên bảo vệ, 3) Phiếu chấm điểm chi tiết của từng thành viên hội đồng.
- Nguyên tắc điều chỉnh điểm:
  + Điểm số chỉ được điều chỉnh trong trường hợp: Có sai sót số học khi tính trung bình cộng, có sai phạm quy trình bảo vệ, hoặc có sự chênh lệch điểm bất thường trái với quy chế chấm điểm mà thành viên hội đồng không đưa ra được lập luận khoa học.
  + Mọi quyết định thay đổi điểm phải được Trưởng Viện phê duyệt bằng văn bản và cập nhật công khai trong lịch sử học vụ.
`;

module.exports = { adminKnowledge };
