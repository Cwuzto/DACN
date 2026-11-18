# Thiết kế phân sinh viên vào hội đồng bảo vệ có xem trước và xét chuyên môn

**Ngày:** 2026-11-19

**Trạng thái:** Đã thống nhất thiết kế trong trao đổi; chờ người dùng duyệt văn bản trước khi lập kế hoạch triển khai.

## 1. Mục tiêu và ranh giới

Admin lập phương án phân **toàn bộ sinh viên đủ điều kiện bảo vệ trong một đợt** vào các hội đồng phù hợp, xem trước và chỉnh phương án trước khi xác nhận. Hệ thống gợi ý số hội đồng theo số sinh viên thực tế và mức mục tiêu lưu theo đợt, xét chuyên môn, tránh xung đột giảng viên/phòng, chia ca theo quy chế. Không xác nhận một phần khi còn sinh viên chưa được xếp.

Phân hội đồng bảo vệ dựa trên `TopicRegistration`; không dùng kiến trúc `group/groupMember`. Mỗi đề tài có một sinh viên (`maxStudents = 1`), GVHD tối đa 10 sinh viên theo quy tắc chung. Không tự công bố lịch, không tạo điểm hoặc thay đổi kết luận BM04. Luồng hội đồng xét duyệt đề cương nằm ngoài phạm vi.

## 2. Phương án đã xem xét

1. **Mở rộng thuật toán gán lần lượt:** thêm chuyên môn và màn xem trước vào cách phân hiện có. Ít thay đổi nhưng có thể báo không khả thi dù một cách xếp khác vẫn tồn tại.
2. **Lập phương án theo ràng buộc — chọn:** xét tập sinh viên, giảng viên, hội đồng và phòng cùng lúc; thỏa tất cả điều kiện bắt buộc trước, sau đó tối ưu mức cân bằng và chuyên môn. Có bản xem trước và bước xác nhận riêng.
3. **Phân tay có cảnh báo:** Admin tự xếp, hệ thống kiểm tra. Dễ kiểm soát từng trường hợp nhưng mất nhiều thao tác khi một đợt có nhiều sinh viên.

## 3. Chuyên môn giảng viên và gợi ý cho đề tài

- **Chỉ Admin** thêm/sửa/import giảng viên. Thêm trường nhiều chuyên môn ngắn, ví dụ `Trí tuệ nhân tạo; Xử lý ảnh; Học máy`, vào form thủ công, mẫu Excel, kiểm tra nhập, lưu và xuất danh sách. Không tạo danh mục chuyên môn riêng. Chuẩn hóa khoảng trắng, loại mục trùng sau chuẩn hóa nhưng giữ nhãn dễ đọc. Chuyên môn là bắt buộc cho giảng viên mới ở cả hai đường; giảng viên lịch sử thiếu dữ liệu phải được Admin bổ sung trước khi tham gia phương án mới. Không tự dùng các nhãn mẫu đang hiển thị trên trang hồ sơ.
- Dùng **tên đề tài hiệu lực** và mô tả có nội dung thực chất để AI gợi ý chuyên môn phù hợp trong các chuyên môn đã nhập. AI trả nhãn chuyên môn đã tồn tại và cụm từ trong đề tài làm căn cứ; không tạo nhãn mới. Kết quả lưu theo phiên bản nội dung đề tài và tập chuyên môn hiện hành để không dùng gợi ý cũ sau khi tên/mô tả/chuyên môn đổi.
- Một ghép nối được tự chấp nhận chỉ khi nhãn chuyên môn có đối chiếu trực tiếp với từ/cụm từ trong nội dung đề tài, phần chứng cứ là đoạn có thật, và kết quả hợp lệ theo cấu trúc yêu cầu. Trường hợp ghép bằng suy luận ngữ nghĩa, thiếu mô tả, thiếu chứng cứ, mơ hồ hoặc AI lỗi được đánh dấu **chưa chắc chắn**; Admin duyệt/chọn chuyên môn phù hợp thủ công. Chỉ những đề tài chưa chắc chắn cần Admin duyệt. Không tin vào mức tự tin do mô hình tự khai.
- Mỗi đề tài phải có **ít nhất một thành viên hội đồng** khớp một chuyên môn đã được tự chấp nhận hoặc Admin duyệt. Ưu tiên người phản biện là người khớp nhất khi có thể; đây là ưu tiên, không phải điều kiện bắt buộc thứ hai. AI chỉ hỗ trợ đánh giá chuyên môn, không vượt qua điều kiện học vụ hoặc tự xác nhận phân hội đồng.

## 4. Phạm vi sinh viên và ràng buộc cứng

Một dịch vụ điều kiện chung xác định sinh viên được bảo vệ cho cả phân tay, lập phương án tự động và tác vụ nền: cùng đợt, `TopicRegistration` hợp lệ, kết luận BM04 đủ điều kiện và đã khóa hoặc quyết định tương đương của Viện, chưa có kết quả/lịch không thể điều chỉnh. Không suy điều kiện từ riêng trạng thái task `COMPLETED`; không tự đổi trạng thái sang `DEFENSE_READY` để xếp. Hội đồng và thành viên phải đang hoạt động, cùng đợt, đúng loại `DEFENSE_COUNCIL`.

Các điều kiện bắt buộc khi lập và xác nhận phương án:

1. Mỗi sinh viên đủ điều kiện được xếp đúng một hội đồng; phương án thiếu bất kỳ sinh viên nào không thể xác nhận.
2. Hội đồng mặc định có Chủ tịch, Thư ký, Phản biện; vai trò chấm thứ tư theo cấu hình hiện có được giữ nếu đã có. Một giảng viên chỉ thuộc **một hội đồng bảo vệ trong đợt**, làm việc cả hai ca trong một ngày; không là thành viên hội đồng chấm sinh viên do chính mình hướng dẫn.
3. Mỗi đề tài có ít nhất một thành viên phù hợp chuyên môn theo mục 3. Một hội đồng có tối đa **30** sinh viên. Mức mục tiêu là ưu tiên mềm, không thay trần 30.
4. Ngày bảo vệ lấy từ cấu hình đợt nếu đã có; nếu chưa có, Admin phải chọn ngày trước khi lập/xác nhận. Admin nhập danh sách phòng khả dụng khi phân; mỗi hội đồng nhận một phòng riêng trọn ngày, không trùng với hội đồng khác trong cùng ngày. Không cần tạo phân hệ quản lý phòng riêng.
5. Hội đồng/lịch đã công bố là phần cố định của phương án, được tính vào sức chứa và xung đột; không âm thầm đổi thành viên, sinh viên, ngày, phòng hoặc thứ tự của chúng. Điều chỉnh sau công bố tiếp tục theo quy trình có lý do, audit và thông báo hiện có.

## 5. Mức mục tiêu, gợi ý và giải thích phương án

Admin đặt **mức sinh viên mục tiêu/hội đồng theo từng đợt**, giá trị từ 1 đến 30; mặc định đề xuất `22` theo đặc tả hiện hành. Hệ thống đếm sinh viên đủ điều kiện và hội đồng đã cố định, gợi ý số hội đồng cần bổ sung từ `ceil(số sinh viên còn cần xếp / mức mục tiêu)` rồi kiểm tra lại theo số giảng viên, phòng và xung đột chuyên môn. Admin có thể đổi mục tiêu và chạy lại xem trước; mức đã chọn được lưu cho đợt và dùng ở những lần lập phương án sau.

Bộ lập phương án phải tìm một cách xếp thỏa điều kiện cứng; trong các cách hợp lệ, ưu tiên tổng độ lệch so với mức mục tiêu thấp, tải giữa các hội đồng cân bằng và chuyên môn phù hợp hơn. Thứ tự ưu tiên ổn định và kết quả có thể giải thích: mỗi sinh viên có lý do hội đồng phù hợp, chuyên môn nào khớp, và các hạn chế đã áp dụng. Cùng một đầu vào và cùng cấu hình cho cùng kết quả; không dùng ngẫu nhiên. Nếu không có phương án, trả nhóm nguyên nhân cụ thể như thiếu giảng viên, phòng, sức chứa hoặc chuyên môn, kèm số lượng bị ảnh hưởng; không ghi thay đổi.

## 6. Ngày, phòng và chia ca

Mỗi hội đồng bảo vệ trong **một ngày**, ca sáng **07:00–11:00** và ca chiều **13:00–17:00** theo giờ Việt Nam. Danh sách sinh viên của hội đồng được Admin xem/chỉnh thứ tự trước khi xác nhận; chia thành hai phần liên tiếp, nếu lẻ ca sáng thêm một người. Mỗi sinh viên có số thứ tự trong ca, không có giờ hẹn riêng. Ví dụ 22 sinh viên chia 11/11, 23 sinh viên chia 12/11.

Ngày và phòng được lưu khi Admin xác nhận phân hội đồng. Lịch được công bố bằng bước công bố hiện có sau khi đáp ứng các điều kiện học vụ liên quan; thời điểm công bố chốt ca và thứ tự. Không cho đường công bố bỏ qua kiểm tra danh sách đầy đủ, ngày, phòng hoặc xung đột.

## 7. Xem trước, chỉnh sửa và xác nhận

Chỉ **Admin** cấu hình hội đồng, ngày/phòng và xác nhận phương án. Giáo vụ xem phương án và kết quả, không quản lý tài khoản giảng viên hoặc xác nhận phân trong luồng mới. Màn xem trước hiển thị từng hội đồng dự kiến, thành viên/vai trò, phòng, số sinh viên, hai ca, mức độ phù hợp chuyên môn và các đề tài cần duyệt. Admin đổi thành viên, chuyển sinh viên, đổi phòng hoặc thứ tự; mỗi thay đổi chạy lại kiểm tra toàn phương án.

Xem trước là thao tác chỉ đọc, không tạo hội đồng hay gán sinh viên. Xác nhận là một giao dịch: kiểm tra lại tập sinh viên đủ điều kiện, trạng thái BM04, chuyên môn đã duyệt, thành viên, phòng, hội đồng/lịch cố định và phiên bản phương án. Nếu dữ liệu nguồn đã đổi, từ chối và yêu cầu tạo lại bản xem trước. Nếu hợp lệ, tạo hội đồng được đề xuất, lưu ngày/phòng/thành viên và gán tất cả sinh viên đúng một lần; không có kết quả ghi một phần. Đường auto job hiện có không được tự tạo hoặc gán hội đồng bảo vệ mà không qua xác nhận của Admin.

## 8. Kiểm chứng và tiêu chí hoàn thành

- Thêm/sửa/import/export giảng viên giữ được nhiều chuyên môn; thiếu chuyên môn bị từ chối ở đường tạo mới và không đưa giảng viên lịch sử thiếu dữ liệu vào phương án. Không tăng quota GVHD vượt 10.
- AI dùng tên đề tài hiệu lực, gợi ý có chứng cứ; trường hợp suy luận/không đủ dữ liệu/lỗi được Admin duyệt; gợi ý cũ vô hiệu khi nội dung hoặc chuyên môn đổi. Không dùng giá trị mẫu/hardcode để ghép.
- Phân tay và tự động dùng cùng điều kiện BM04; từ chối khác đợt, GVHD chấm sinh viên của mình, giảng viên ở hai hội đồng, phòng trùng, quá 30 sinh viên, thiếu ít nhất một người đúng chuyên môn, thiếu ngày/phòng và phương án không xếp hết.
- Với 22 sinh viên, ca chia 11/11; với 23 sinh viên, chia 12/11. Hội đồng đã công bố không bị đổi ngầm. Dữ liệu thay đổi giữa xem trước và xác nhận phải khiến xác nhận thất bại mà không ghi một phần.
- Admin xem được vì sao đề xuất hội đồng mới, sinh viên nào gán vào đâu và vì sao không có phương án nếu thiếu nguồn lực. Giao diện dùng dữ liệu thật, hỗ trợ bàn phím và màn hình hẹp; nút có icon dùng `@ant-design/icons` qua prop `icon`, nhãn thuần tiếng Việt.

Hoàn thành khi Admin có thể nhận gợi ý, chỉnh và xác nhận **một phương án trọn đợt, hợp lệ và giải thích được**; Giáo vụ xem được kết quả; không có đường phân tự động khác âm thầm tạo lịch hoặc xếp sinh viên chưa đủ điều kiện.
