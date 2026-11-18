# Thiết kế chấm nhanh rubric hội đồng bảo vệ

**Ngày:** 2026-11-19
**Trạng thái:** Đã thống nhất thiết kế trong trao đổi; chờ người dùng duyệt văn bản trước khi lập kế hoạch triển khai.

## 1. Mục tiêu và phạm vi

Hội đồng chấm nhiều tiêu chí BM05 nhanh hơn bằng cách chọn một trong bốn mức **Tốt, Khá, Trung bình, Kém** cho từng tiêu chí. Mức chọn điền điểm gợi ý, giảng viên được sửa điểm trước khi khóa phiếu. Thao tác theo nhóm chỉ điền những tiêu chí chưa có điểm. Điểm từng mục, từng nhóm và toàn phiếu cập nhật ngay.

Áp dụng cho phiếu của từng thành viên hội đồng trong luồng `TopicRegistration` hiện có. Giữ nguyên quy tắc mỗi thành viên chấm độc lập, Chủ tịch khóa sổ khi đủ người chấm hợp lệ, Viện duyệt rồi công bố. Không sinh điểm ngẫu nhiên, không tự chấm sẵn khi mở phiếu, không tạo phiếu cho người vắng mặt.

## 2. Phương án đã xem xét

1. **Quy tắc chung cố định:** Dùng một bộ ngưỡng cho mọi phiên bản rubric, tính mức từ điểm đã lưu. Ít thay đổi CSDL nhưng phiếu cũ có thể được diễn giải sang mức khác nếu ngưỡng chung thay đổi.
2. **Quy tắc theo phiên bản rubric — chọn:** Lưu ngưỡng và điểm gợi ý trong `RubricVersion`. Phiếu giữ `scoreRubricVersion` và snapshot hiện có; phiên bản đã dùng để chấm không được sửa. Cần migration và API nhưng giữ được cách diễn giải điểm theo đúng phiên bản.

Không lưu mức chọn riêng trên từng `DefenseMemberCriterionScore`: sau khi người dùng sửa điểm, mức được suy ra từ điểm cuối cùng và quy tắc của phiên bản, tránh hai giá trị mâu thuẫn.

## 3. Quy tắc điểm

Mỗi phiên bản rubric có chính sách bốn khoảng tỷ lệ của `criterion.score / criterion.maxScore`, với biên dưới bao gồm và biên trên không bao gồm, trừ mức Tốt bao gồm 100%. Giá trị mặc định khi tạo hoặc nhân bản phiên bản:

| Mức | Khoảng của điểm tối đa | Điểm gợi ý |
|---|---:|---:|
| Tốt | 85%–100% | 90% |
| Khá | 70%–<85% | 75% |
| Trung bình | 50%–<70% | 60% |
| Kém | 0%–<50% | 30% |

Điểm gợi ý được nhân với `maxScore` của tiêu chí và làm tròn đến **0,01 điểm**, giới hạn trong `[0, maxScore]`. Điểm gợi ý sau khi làm tròn phải vẫn nằm trong khoảng của mức đã chọn; nếu độ phân giải 0,01 không thể biểu diễn mức cho một tiêu chí có `maxScore` quá nhỏ, backend từ chối cấu hình rubric đó trước khi khóa phiên bản. Điểm nhập tay được chấp nhận đến 0,01 điểm, bao gồm `0`; ô trống khác `0`. Backend xác thực điểm hữu hạn, không âm, không vượt `maxScore`, đúng tiêu chí và đúng phiên bản rubric đã gắn với hồ sơ.

Các mốc 50%, 70%, 85% và điểm gợi ý được lưu thành dữ liệu của `RubricVersion`, không hardcode ở màn hình. API trả cùng chính sách cho trang giảng viên và trang quản trị chấm điểm. Việc tạo/nhân bản rubric nhận chính sách mặc định hoặc bản sao của nguồn; chỉ phiên bản nháp chưa được dùng để chấm mới có thể sửa chính sách. Phiên bản cũ đang có phiếu giữ nguyên quy tắc lịch sử; migration khởi tạo chính sách mặc định cho chúng mà không sửa điểm hoặc trạng thái phiếu.

## 4. Luồng giao diện

Mỗi hàng tiêu chí hiển thị tên, mô tả mức, bốn lựa chọn dạng radio, điểm tối đa và ô điểm số. Chọn mức điền điểm gợi ý. Sửa điểm cập nhật radio theo khoảng tương ứng; xóa giá trị làm tiêu chí trở lại trạng thái chưa chấm. Mỗi nhóm có một điều khiển chọn mức để điền **chỉ các mục trống**. Mục đã có điểm, kể cả `0`, được giữ nguyên. Giao diện thông báo số mục vừa điền và số mục được giữ lại.

Trang hiển thị tiến độ `đã chấm/tổng số mục`, điểm từng nhóm và tổng điểm tạm tính. Mục chưa chấm không bị hiển thị hoặc gửi như điểm `0`. Nút **Lưu nháp** cho phép phiếu chưa đủ mục; nút **Khóa phiếu** chỉ hoạt động khi mọi mục có điểm hợp lệ. Sau khóa, điểm và mức chỉ đọc theo luồng mở khóa/trả sổ hiện có. Tất cả nút có biểu tượng dùng prop `icon` từ `@ant-design/icons`; nhãn nút là văn bản thuần.

Áp dụng cùng quy tắc cho các điểm chấm có thể chỉnh trên `LecturerGradingSheetPage.jsx` và `GradingDefensePage.jsx`. Bỏ cách tự điền 85% ở trang quản trị. Giao diện truy cập bằng bàn phím, hiển thị được trên màn hình 375px, có trạng thái tải và lỗi khi không lấy được rubric. Không dùng dữ liệu giả nếu API đã có dữ liệu thật.

## 5. CSDL và backend

1. **Prisma/migration:** Thêm chính sách mức điểm có cấu trúc vào `RubricVersion`, kiểm tra tính đầy đủ, thứ tự khoảng, điểm gợi ý nằm trong khoảng và khả năng biểu diễn với độ phân giải 0,01. Giữ `DefenseMemberCriterionScore.score` làm nguồn điểm; `DefenseMemberScore.scoreRubricVersion` và `rubricSnapshot` tiếp tục làm dấu vết phiên bản.
2. **Rubric API:** Trả chính sách theo phiên bản rubric gắn với `TopicRegistration`/hội đồng, không mặc định chuyển sang rubric đang active nếu hồ sơ đã chốt phiên bản. Các đường tạo, nhân bản, cập nhật, khóa rubric dùng cùng bộ xác thực và không sửa phiên bản đã có phiếu.
3. **Phiếu thành viên:** Cả hai route lưu phiếu hiện có đi qua cùng một command/service để kiểm tra quyền, tiêu chí, phiên bản, điểm và trạng thái khóa. Lưu nháp có thể thiếu mục; khóa phiếu yêu cầu đủ mục. Mỗi thành viên chỉ sửa phiếu được phép của mình; luồng quản trị thay mặt phải giữ kiểm tra quyền và dấu vết người thao tác hiện có.
4. **Tổng hợp:** Phiếu cá nhân có tổng điểm từ các mục đã lưu, nhưng `DefenseResult` không ghi điểm hội đồng cuối cùng từ một tập phiếu chưa đủ. Với sinh viên có mặt, Chủ tịch chỉ khóa sổ khi đủ **3 hoặc 4** thành viên chấm có hiệu lực đã khóa phiếu. Khi đó tính trung bình từ đúng các phiếu này và làm tròn một chữ số theo quy tắc hiện có. Nhánh xác nhận vắng mặt giữ quy trình riêng và không tạo điểm giả.
5. **Sửa lệch luồng hiện hữu trong phạm vi:** Đường lưu ở `evaluationController.saveScoreSheet` hiện tính trung bình khi mới có một phần phiếu; cần thống nhất với service. `lockDefenseScoreBookByChairman` đang tham chiếu `validScores` ngoài phạm vi khai báo ở nhánh sinh viên có mặt; sửa trước khi dựa vào khóa sổ. Nhãn số người chấm trên UI lấy từ danh sách thành viên có hiệu lực, không cố định `/3`.

## 6. Kiểm chứng và tiêu chí hoàn thành

- Test các biên 0%, 50%, 70%, 85%, 100%; `maxScore` khác nhau; làm tròn 0,01; mục trống so với điểm `0`; sửa điểm làm radio đổi mức; thao tác theo nhóm không ghi đè điểm cũ.
- Test lưu nháp thiếu mục, khóa phiếu thiếu mục bị từ chối, đúng phiên bản, sai quyền, phiên bản đã có phiếu không thể đổi chính sách; kiểm tra phiếu lịch sử sau migration.
- Test 3 và 4 thành viên, phiếu chưa khóa, thành viên không có hiệu lực, sinh viên vắng mặt, khóa sổ và làm tròn. Kiểm tra hai route lưu phiếu cùng nghiệp vụ và không công bố điểm khi chưa đủ điều kiện.
- Kiểm tra giao diện giảng viên và quản trị bằng dữ liệu API thật, bàn phím và màn hình 375px. Một mục tối đa 1 điểm khi chọn Tốt điền `0,90`; sửa thành `0,75` chuyển sang Khá; chấm nhóm không thay mục đã sửa.

Hoàn thành khi giảng viên có thể chấm các mục bằng mức, điều chỉnh số điểm, lưu nháp và khóa phiếu hợp lệ; Chủ tịch khóa sổ được sau khi đủ phiếu, điểm tổng không phụ thuộc vào thứ tự các thành viên nộp phiếu, và mỗi phiếu lịch sử vẫn được diễn giải theo đúng rubric đã dùng.
