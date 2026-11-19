# Thiết kế trang quá trình hướng dẫn và quản lý biểu mẫu theo sinh viên

**Ngày:** 19/11/2026
**Trạng thái:** Phương án trong hội thoại đã được người dùng đồng ý; chờ duyệt đặc tả viết
**Phạm vi:** Góc nhìn GVHD đối với một `TopicRegistration`; không thay đổi quy trình duyệt hoặc mẫu in A4.

## 1. Vấn đề và kết quả mong muốn

Nút “Hồ sơ” tại danh sách sinh viên GVHD hiện mở `AcademicDossierDrawer` rộng 1040px. Drawer hiển thị sáu tab BM01, BM02, BM02-A, BM03, BM04, BM05 với các `PrintSheet` trong nội dung; đầu drawer còn có ba hành động in. Thông tin sinh viên chỉ là một hàng tóm tắt. Một số sheet vẫn render khi biểu mẫu chưa phát sinh. Người dùng không thấy ngay việc cần làm, đồng thời tên “Hồ sơ” tạo kỳ vọng đây là hồ sơ sinh viên.

GVHD cần mở một sinh viên và trả lời nhanh ba câu: sinh viên và đề tài nào, đang ở giai đoạn nào/cần xử lý gì, mỗi biểu mẫu đã tới trạng thái nào. Bản A4 chỉ cần xuất hiện khi GVHD chủ động xem hoặc in.

## 2. Quyết định và phạm vi

- Từ danh sách ở `/lecturer/students` và danh sách sinh viên trên dashboard, hành động đổi thành **“Xem quá trình”** và dẫn tới `/lecturer/students/:registrationId`. Trang dùng `TopicRegistration` làm trục; không dùng mô hình `group/groupMember`.
- Trang chi tiết có phần đầu (tên, MSSV, đề tài, trạng thái học vụ, đợt), khối **Việc cần xử lý**, và hai mục **Quá trình hướng dẫn** / **Biểu mẫu**. Khối thông tin sinh viên gọn nằm trong phần đầu hoặc vùng phụ, không thay vai trò của danh mục BM.
- Mục Biểu mẫu trình bày từng BM thành một hàng quản lý với tên, trạng thái chữ, ngày cập nhật nếu có, và các hành động hợp lệ. Không nhúng toàn bộ `PrintSheet` vào trang và không render sheet trống khi chưa có dữ liệu.
- Giữ `AcademicDossierDrawer` và các bản in A4 cho các góc nhìn quản trị/hội đồng hiện có. Từ trang GVHD, dùng lại cơ chế xem/in tương ứng khi người dùng chọn một BM; không thay đổi nội dung pháp lý của biểu mẫu.
- Không thêm thao tác sửa thông tin sinh viên từ trang này. Các hành động duyệt, ghi nhật ký, ký và công bố vẫn dùng luồng nghiệp vụ/API hiện có.

## 3. Bố cục và điều hướng

1. **Đầu trang:** nút quay về danh sách; tên SV, MSSV, lớp/chuyên ngành nếu có; tên đề tài chính thức (ưu tiên tên đã điều chỉnh theo quy tắc hiện có), GVHD, đợt đồ án và trạng thái. Nếu thiếu trường tùy chọn, hiển thị “Chưa cập nhật”, không suy đoán.
2. **Việc cần xử lý:** tối đa một hành động chính theo `allowedActions`/trạng thái từ backend; hành động phụ chỉ khi có nghiệp vụ thực. Nếu không có việc, ghi “Hiện không có việc cần xử lý”. Không tạo deadline hoặc tiến độ phần trăm giả.
3. **Quá trình hướng dẫn:** trình tự BM01 → BM02 → BM03 → BM04 → bảo vệ/kết quả; hiển thị mốc đã xảy ra và trạng thái thực. Nhật ký BM03 có lối vào trang theo dõi hiện có. Mốc không có dữ liệu ghi “Chưa bắt đầu”.
4. **Biểu mẫu:** danh sách theo thứ tự học vụ. Mỗi hàng có nhãn BM, tên đầy đủ, trạng thái, thời điểm cập nhật, người cần thực hiện bước kế tiếp nếu backend xác định được, và tối đa hai hành động trực tiếp; hành động khác đưa vào menu có nhãn. BM02-A chỉ hiện nếu từng có yêu cầu; yêu cầu đang chờ được nhấn rõ trong việc cần xử lý.
5. **Thông tin sinh viên:** email, điện thoại, lớp, chuyên ngành, ngày sinh, khóa đào tạo và nơi sinh khi đã lưu. Chỉ hiện dữ liệu cần thiết cho GVHD; trường trống được đánh dấu rõ, không điền chuỗi mặc định như một giá trị thật.

Ở màn hình hẹp, các khối xếp dọc, việc cần xử lý đứng trước danh mục. Danh sách BM không cần cuộn ngang để đọc trạng thái/hành động. Trạng thái không chỉ biểu đạt bằng màu; tab/mục đang xem có trạng thái active, heading đúng cấp, focus và nút có nhãn truy cập. Icon nút dùng `@ant-design/icons` qua prop `icon`; nhãn nút là văn bản thuần.

## 4. Quy tắc hiển thị biểu mẫu

| BM | Trạng thái cần phản ánh | Hành động GVHD |
|---|---|---|
| BM01 | Chưa nộp, đã nộp, cần sửa, đã duyệt theo bản nộp/trạng thái thật | Xem PDF đã nộp; dẫn tới luồng duyệt nếu `allowedActions` cho phép |
| BM02 | Chưa nộp, chờ thẩm định, cần sửa, đã duyệt theo submission/verification | Xem chi tiết hoặc bản in khi có submission; dẫn tới luồng nghiệp vụ được phép |
| BM02-A | Chỉ xuất hiện khi có yêu cầu; hiển thị trạng thái yêu cầu mới nhất và lịch sử nếu có | Xem yêu cầu/bản in; duyệt ở trang hiện có khi được phép |
| BM03 | Chưa bắt đầu, đang ghi nhận, đã chốt theo record/nhật ký/checkpoint | Mở theo dõi tiến độ; xem bản in khi đủ dữ liệu, in chính thức theo điều kiện khóa/ký hiện có |
| BM04 | Chưa lập, nháp, chờ ký, đã ký/khóa theo evaluation thật | Mở luồng lập/duyệt của GVHD; xem/in bản chính thức khi điều kiện hiện có thỏa |
| BM05 | Chưa có kết quả, đang xử lý, đã công bố | GVHD chỉ xem kết quả/bản in khi backend xác nhận đã công bố và có quyền; không lộ điểm hoặc nhận xét trước công bố |

Nhãn trạng thái được ánh xạ tại một nơi từ các enum và dữ liệu nghiệp vụ hiện có; không suy ra “hoàn thành” chỉ vì `PrintSheet` có thể render. Tải/in PDF BM01 giữ cách lấy signed URL hiện có. In lẻ các BM khác dùng sheet hiện có. “In toàn bộ” chỉ nằm trong khu vực in/tài liệu khi có biểu mẫu đủ điều kiện, không là hành động nổi bật của trang chi tiết.

## 5. Dữ liệu, phân quyền và thứ tự xử lý

### 5.1. CSDL/Prisma

`StudentProfile` hiện có `gender`, `dateOfBirth`, `className`, `major`. API chi tiết lại chọn `academicYear` và `placeOfBirth` chưa tồn tại, trong khi BM02/BM02-A cần hiển thị “Khóa” và “Nơi sinh”. Bổ sung hai trường **nullable** `academicYear` (nhãn giao diện: “Khóa đào tạo”, ví dụ `2022–2026`) và `placeOfBirth` vào `StudentProfile` bằng migration không áp giá trị giả cho bản ghi cũ. Admin có thể nhập/sửa chúng trong luồng quản lý sinh viên hiện có; import sinh viên và response hồ sơ giữ được hai giá trị nếu nguồn có. Dữ liệu trống tiếp tục trống trên bản in, không lấy năm học của đợt làm khóa đào tạo.

Không thêm bảng BM tổng hợp: trạng thái lấy từ `TopicRegistration` và các bảng nghiệp vụ hiện có. Giữ 1 SV/1 đề tài, tối đa 10 SV/GVHD.

### 5.2. Backend

Sửa `GET /api/registrations/:id` để select đúng schema và kiểm quyền **trên bản ghi** trước khi trả dữ liệu: GVHD chỉ thấy registration mình đang hướng dẫn; sinh viên chỉ thấy của mình; chức vụ khác theo scope/quyền hiện hành. Việc có một trong các capability ở route không tự cho phép đọc mọi registration. Trả 404 khi không tồn tại; trả 403 khi tồn tại nhưng actor ngoài phạm vi theo convention bảo mật hiện hành.

Response chi tiết cung cấp dữ liệu đầu trang và trạng thái/hành động BM được suy ra ở backend từ nguồn thật, hoặc các nguồn nghiệp vụ được tải bằng endpoint đã kiểm cùng scope. Không dựa vào bản ghi tóm tắt từ danh sách để dựng BM05. `allowedActions` là nguồn cho nút nghiệp vụ; frontend không tự cấp quyền theo role hay chỉ theo enum trạng thái. Dữ liệu BM05 trước công bố phải được lọc/che tại backend, kể cả trường lồng trong registration response.

### 5.3. Frontend

Trang mới tải theo `registrationId` trên URL, có loading, empty, 403, 404 và retry khi lỗi mạng. Từ dashboard và trang danh sách cùng đi tới URL này; quay lại giữ ngữ cảnh danh sách/đợt nếu có. Query cache khóa theo người dùng và registration. Các nút nghiệp vụ dẫn tới trang đã có (duyệt BM01, BM02-A, BM03, BM04) với `registrationId`/request ID phù hợp; không tạo form chỉnh sửa thứ hai.

## 6. Kiểm chứng và tiêu chí nghiệm thu

- Prisma validate và migration chạy trên DB thử nghiệm; bản ghi StudentProfile cũ không mất dữ liệu và hai trường mới vẫn null.
- API chi tiết: GVHD đúng sinh viên nhận dữ liệu; GVHD khác và sinh viên khác bị chặn; quyền chức vụ theo scope; không trả điểm BM05 chưa công bố. Không còn lỗi select trường Prisma không tồn tại.
- Trang từ cả dashboard và danh sách mở đúng registration. BM không phát sinh hiện trạng thái rỗng, không hiện giấy A4 trắng. BM02-A vắng khi không có yêu cầu. Các hành động chỉ hiện khi được phép.
- Xem/in BM01–BM05 dùng đúng dữ liệu và điều kiện đã có; BM05 công bố mới hiện kết quả. Kiểm tra ở 375px và desktop, bằng bàn phím, focus, trạng thái active, icon/nút, UTF-8 không BOM.
- Điều chỉnh test cũ đang yêu cầu `AcademicDossierDrawer` tích hợp vào dashboard: drawer vẫn được giữ cho các màn khác, còn dashboard GVHD kiểm tra điều hướng mới. Không xóa test mà không thay bằng xác nhận luồng mới.

## 7. Rủi ro và ranh giới

- Dữ liệu profile cũ thiếu khóa/nơi sinh: migration không thể tự suy đoán, nên admin bổ sung khi có hồ sơ gốc.
- Một số route nghiệp vụ có thể chưa nhận `registrationId` qua URL hoặc chưa kiểm scope theo bản ghi. Kế hoạch triển khai phải rà từng hành động và sửa backend trước khi bật nút tương ứng.
- Các trang quản trị/hội đồng đang dùng drawer A4 có nhu cầu tra cứu khác GVHD; giữ luồng đó trong phạm vi thiết kế này để tránh làm gián đoạn việc in/đối soát.
