# Thiết kế lại Tổng quan giảng viên: GVHD và Viện trưởng trong một dashboard

**Ngày:** 17/11/2026
**Trạng thái:** Thiết kế đã được người dùng duyệt trong hội thoại; chờ rà soát spec trước khi lập kế hoạch triển khai.

## 1. Mục đích và quyết định thiết kế

Trang `/lecturer/dashboard` là nơi giảng viên bắt đầu công việc trong đợt đồ án. Người giữ chức vụ Viện trưởng vẫn là GVHD: họ cần thấy sinh viên của mình trước, đồng thời nhận thêm thông báo và việc thuộc thẩm quyền Viện trưởng ngay trong cùng hàng đợi. Không tạo dashboard toàn viện riêng, tab chuyển vai trò hoặc chế độ xem khác.

Bố cục được chọn là **B — hai vùng cân bằng**: hàng đợi cần chú ý ở bên trái, danh sách sinh viên đang hướng dẫn ở bên phải. Trên màn hình hẹp, hai vùng xếp dọc, hàng đợi trước. Các mục Viện trưởng được xen theo mức ưu tiên và hạn xử lý, gắn nhãn nguồn để không nhầm với việc GVHD.

### Các hướng đã cân nhắc

| Hướng | Đánh đổi | Quyết định |
|---|---|---|
| Hai dashboard hoặc nút chuyển GVHD/Toàn viện | Phân phạm vi rõ nhưng buộc Viện trưởng chuyển màn hình để thấy việc của cả hai trách nhiệm | Không chọn |
| Một hàng đợi hỗn hợp, hai vùng cân bằng | Cần chuẩn hóa dữ liệu, độ ưu tiên và nhãn nguồn | **Chọn** |
| Việc khẩn toàn chiều ngang, sinh viên ở dưới | Tập trung việc khẩn nhưng sinh viên không còn cùng xuất hiện ở màn đầu | Không chọn |

## 2. Phạm vi

### Trong phạm vi

- Thiết kế lại toàn bộ nội dung trang `LecturerDashboardPage.jsx` theo cùng một cấu trúc cho GVHD và Viện trưởng.
- Thống nhất số liệu GVHD, hàng đợi việc cần xử lý, thông báo theo chức vụ và danh sách sinh viên từ dữ liệu backend thực.
- Thêm dữ liệu theo chức vụ Viện trưởng **chỉ** khi backend xác nhận quyền và phạm vi liên quan. Hàng đợi vẫn có mục GVHD của chính tài khoản đó.
- Giữ các thao tác GVHD đang có: duyệt hồ sơ phù hợp trạng thái, ghi nhật ký gặp, gửi thông báo, mở hồ sơ sinh viên. Liên kết đến các trang Viện trưởng đang tồn tại chỉ xuất hiện khi được phép.
- Chuyển phần “chức năng điều hành” hiện chỉ là các thẻ lối tắt thành mục có ngữ cảnh trong hàng đợi hoặc liên kết phụ gọn; không hiển thị thẻ mô tả dài nếu không có dữ liệu cần xử lý.

### Ngoài phạm vi

- Thiết kế lại các trang đích như BM02, hội đồng, khóa sổ điểm hoặc `/admin/dashboard`.
- Thay đổi quy trình nghiệp vụ, quyền học vụ, công thức chấm BM05 hoặc schema `TopicRegistration` nếu không phát hiện thiếu dữ liệu bắt buộc.
- Tạo dashboard thống kê toàn viện độc lập hoặc biểu đồ chỉ để trang trí.

## 3. Hiện trạng cần sửa

- `frontend/src/pages/lecturer/LecturerDashboardPage.jsx` dùng chung cho hai persona nhưng dựng Viện trưởng thành một khối shortcut riêng. Trang khoảng 1.200 dòng, đang trộn truy vấn, tính toán, modal và giao diện.
- `useRegistrations` đang lấy hồ sơ theo phạm vi GVHD, nên các số liệu trên trang không phải số toàn viện. Điều này đúng cho khu vực sinh viên của chính GVHD; thông báo Viện trưởng cần nguồn riêng được kiểm tra quyền.
- Một số chỉ số dùng giá trị giả khi thiếu dữ liệu: tiến độ `82%`, tiến độ từng dòng `75%`, số buổi gặp `4/7`, cùng số hội đồng tĩnh. Chúng phải biến mất hoặc được thay bằng dữ liệu thật có nguồn và trạng thái rỗng rõ ràng.
- `GET /api/dashboard/lecturer` đã có thống kê GVHD, tối đa 5 submission cần phản hồi và task sắp hạn, nhưng chưa trả hàng đợi Viện trưởng hoặc danh sách thống nhất.
- `GET /api/notifications/my` chứa thông báo cá nhân nhưng trạng thái `isRead` chỉ là đã đọc, không chứng minh công việc đã xử lý; không dùng `unreadCount` giới hạn 100 bản ghi làm tổng việc cần xử lý.
- CSS riêng của trang khai báo lại `:root`, có thể chồng token toàn app. Thiết kế mới dùng token và theme hiện có; không thêm hệ màu/font song song.

## 4. Bố cục và thứ bậc thông tin

1. **Tiêu đề và ngữ cảnh đợt:** tên trang, đợt đang xem, thời điểm cập nhật và bộ lọc đợt nếu dữ liệu API hỗ trợ. Một đợt duy nhất chi phối KPI, hàng đợi và danh sách sinh viên; đổi đợt cập nhật đồng bộ cả ba.
2. **KPI ngắn:** sinh viên đang hướng dẫn trên chỉ tiêu tối đa 10; số việc thật cần xử lý; số mốc có hạn sắp đến. Không hiển thị phần trăm khi không có mẫu số hợp lệ. Không dùng số Viện trưởng để thay chỉ tiêu GVHD.
3. **Lưới hai vùng:** trái là “Cần chú ý và xử lý”, phải là “Sinh viên đang hướng dẫn”. Hai vùng cùng xuất hiện ở màn đầu ở desktop, có chiều cao và nhịp chữ tương đương; mobile xếp trái trước phải.
4. **Hàng đợi:** mỗi dòng có tiêu đề hành động hoặc nội dung thông báo, người/hồ sơ/đợt liên quan, hạn thật nếu có, nhãn `GVHD` hoặc `Viện trưởng`, trạng thái rõ nghĩa, và hành động phù hợp quyền. Mục chỉ để đọc có nhãn `Thông báo`, không hiển thị như mutation.
5. **Danh sách sinh viên:** chỉ sinh viên thuộc đề tài do tài khoản hướng dẫn trong đợt đã chọn; tên, đề tài, trạng thái quy trình, việc kế tiếp hoặc mốc thật, liên kết đến hồ sơ. Không gán tiến độ hoặc số buổi gặp mặc định.
6. **Tác vụ phụ:** ghi nhật ký gặp, gửi thông báo và liên kết quản trị thường dùng nằm sau nội dung chính, không tranh vị trí với hàng đợi.

## 5. Dữ liệu và quyền

### Hợp đồng backend

Mở rộng `GET /api/dashboard/lecturer` theo hướng cộng thêm dữ liệu, giữ các trường hiện có để tránh phá consumer và test cũ. Tham số `semesterId` tùy chọn phải được backend xác thực; thiếu tham số thì dùng đợt hoạt động hoặc đợt có hồ sơ GVHD theo quy tắc hiện có. Response bổ sung:

- `mentorSummary`: `supervisedCount`, `maxStudents` (10), `actionableCount`, `upcomingDeadlineCount`.
- `attentionItems[]`: `id`, `source` (`MENTOR` hoặc `INSTITUTE_DIRECTOR`), `kind`, `title`, `description`, `semesterId`, `registrationId?`, `dueAt?`, `priority` (`OVERDUE`, `DUE_SOON`, `NORMAL`, `INFO`), `isActionable`, `target` (route nội bộ hợp lệ) và `allowedAction?`. Không gửi một target mutation nếu actor không đủ quyền.
- `students[]`: `registrationId`, `studentId`, `studentName`, `studentCode`, `topicTitle`, `status`, `nextMilestone?`, `nextMilestoneAt?`, `allowedActions[]`. Chỉ lấy hồ sơ theo `topic.mentorId = actor.id` và kỳ được phép xem.
- `generatedAt` để UI hiển thị thời điểm cập nhật. Không tự tạo số liệu hoặc deadline khi nguồn không có.

Backend tạo hàng đợi từ bản ghi nghiệp vụ thật và thông báo cá nhân liên quan. Tối thiểu bao phủ việc GVHD đang có trên trang (đăng ký chờ duyệt, BM01 cần duyệt lại, đổi tên đề tài, submission cần phản hồi) và thông báo/việc Viện trưởng từ các nguồn nghiệp vụ đã có (ví dụ BM02 chờ thẩm định, quyết định, hội đồng, công bố kết quả) **chỉ khi truy vấn được trạng thái thật và kiểm tra được quyền tài nguyên**. Với nguồn chưa có truy vấn an toàn, không hiển thị số đếm hoặc thông báo giả; kế hoạch triển khai phải ghi rõ endpoint/query cần bổ sung.

Hàng đợi sắp theo `OVERDUE` → `DUE_SOON` → `NORMAL` → `INFO`, sau đó theo `dueAt` tăng dần; mục không có hạn không bị gắn “quá hạn”. Các mục có cùng hồ sơ và hành động được khử trùng lặp ổn định. Danh sách có giới hạn ban đầu và liên kết “Xem tất cả” đến trang phù hợp; không tải toàn bộ hồ sơ toàn viện vào dashboard.

### Ranh giới phân quyền

- Backend là nguồn quyết định cuối cùng: kiểm tra capability **và** scope học kỳ/đơn vị/tài nguyên cho từng mục Viện trưởng. `isInstituteDirector` ở frontend chỉ phục vụ trình bày, không cấp dữ liệu hoặc quyền.
- Không tin `semesterId`, `registrationId`, `department`, `councilId` từ client để mở rộng phạm vi. Dữ liệu sinh viên GVHD vẫn giới hạn theo người hướng dẫn dù actor là Viện trưởng.
- Chỉ mục có `allowedAction` hợp lệ mới hiển thị nút mutation; trường hợp chỉ xem phải trỏ đến màn hình đọc được. Khi quyền bị thu hồi, làm mới session/query theo lifecycle RBAC hiện có và ẩn mục không còn quyền.
- Không tiết lộ điểm BM05 hoặc nhận xét chưa công bố qua thẻ, mô tả, số đếm hay link preview.

## 6. Tương tác, chuyển động và khả năng tiếp cận

- Việc mới hoặc vừa chuyển sang quá hạn được nhấn bằng viền, nền nhẹ, nhãn chữ và một hiệu ứng vào ngắn; không nhấp nháy liên tục. Cùng mức khẩn không tự chạy lại animation mỗi lần React render hoặc query refetch.
- `prefers-reduced-motion: reduce` tắt chuyển động nhưng giữ viền, nhãn và thứ tự ưu tiên. Màu không là tín hiệu duy nhất. Hiệu ứng không đẩy bố cục hoặc đổi kích thước vùng bấm.
- Dùng `@ant-design/icons` qua prop `icon` của `Button`; nhãn nút là tiếng Việt thuần. Không có emoji/ký tự biểu tượng thô trong nút hoặc thẻ điều hành.
- Mọi hành động có nhãn truy cập rõ, focus nhìn thấy được và dùng bàn phím được. Heading đi theo thứ tự h1 → h2 → h3; thông báo cập nhật không gây đọc lặp liên tục bởi screen reader.
- Ở 375px, hai vùng xếp dọc và nội dung không tràn ngang; ở 768px, 1024px, 1440px phải giữ tiêu đề/hàng đợi/danh sách dễ quét. Màn hình hẹp vẫn thấy hạn và nguồn của từng mục trước khi mở chi tiết.
- Trạng thái tải dùng skeleton theo cấu trúc thật; trạng thái trống phân biệt “không có việc cần xử lý”, “chưa có sinh viên trong đợt”, và “không có thông báo chức vụ”; lỗi có nút thử lại. Không dùng `0`, `82%` hoặc chuỗi mặc định để che lỗi API.

## 7. Ranh giới thành phần

- Backend tách logic tổng hợp hàng đợi khỏi controller để từng nguồn việc có thể kiểm thử độc lập; controller chỉ đọc actor đã xác thực, gọi service và trả response.
- Frontend dùng một query theo identity + permission version + semester; không ghép các mảng nhiều nguồn rồi tự cấp quyền. Tách page container khỏi `OverviewKpis`, `AttentionQueue`, `SupervisedStudentList` và các modal/hành động đã có. Những thành phần này nhận dữ liệu đã chuẩn hóa, không tự gọi API hoặc tự suy luận role.
- Giữ `LecturerLayout` và Ant Design/Tailwind hiện có. Cô lập hoặc loại bỏ CSS `:root` riêng cho lecturer trong phạm vi thay đổi để token chung không bị ghi đè.

## 8. Tiêu chí nghiệm thu

1. GVHD thường mở dashboard và chỉ thấy dữ liệu, việc, thông báo trong phạm vi của mình; không thấy thẻ Viện trưởng.
2. Viện trưởng mở **cùng dashboard** và thấy công việc GVHD của mình xen với mục chức vụ trong một hàng đợi; không có nút chuyển góc nhìn hay khối điều hành riêng dài.
3. Hàng đợi phản ánh dữ liệu thật và quyền hiện hành; mục chỉ đọc không có mutation, mục không đủ quyền không xuất hiện; đổi đợt hoặc thu hồi quyền không để lại dữ liệu cũ.
4. KPI, trạng thái sinh viên, hạn, số buổi và tiến độ không dùng fallback giả. Đợt không có dữ liệu hiển thị trạng thái rỗng đúng nghĩa.
5. Việc mới/quá hạn dễ thấy bằng cả chữ và hình thức; animation ngắn, không lặp theo refetch và tắt dưới reduced motion.
6. Test backend kiểm tra GVHD/Viện trưởng, scope khác kỳ/đơn vị, quyền bị thu hồi, thứ tự ưu tiên, dữ liệu rỗng và không lộ BM05; test frontend kiểm tra hai persona, trạng thái tải/lỗi/trống, responsive và nút theo quyền.
7. Build, lint và test liên quan pass; kiểm tra trực quan ở 375/768/1024/1440px. Toàn bộ file mới/chỉnh sửa dùng UTF-8 không BOM.
