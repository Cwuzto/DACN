# Thiết kế lại menu theo quy trình đồ án và trung tâm điều hành Viện trưởng

**Ngày:** 18/11/2026

## 1. Mục đích

Menu bên trái phải nói đúng công việc sẽ mở ra, sắp theo hành trình đồ án và chỉ hiện các mục người dùng được phép xem. Sinh viên và Quản trị/Giáo vụ dùng cấu trúc đã duyệt trong bản xem nhanh. GVHD giữ menu nghiệp vụ hướng dẫn; người có thẩm quyền Viện trưởng được thêm đúng **một mục “Điều hành học vụ”** để thẩm định, ra quyết định và công bố trên một trang thao tác trực tiếp.

Trang Tổng quan GVHD/Viện trưởng vẫn là một dashboard chung theo spec `2026-11-17-lecturer-unified-overview-redesign-design.md`. Mục “Điều hành học vụ” là nơi xử lý nghiệp vụ chuyên sâu, không tạo dashboard Viện trưởng thứ hai.

## 2. Hiện trạng và vấn đề

- Menu hiển thị hiện được dựng từ `FEATURE_POLICIES` trong `frontend/src/auth/featurePolicies.js` qua `getVisibleNavigation`; `frontend/src/config/navigationRegistry.js` còn giữ danh sách nhãn/route/quyền trùng lặp và được `AppLayout` đọc để nhận diện mục anh em có query string. Hai nguồn có thể lệch nhau.
- “Sinh viên hướng dẫn” hiện dẫn vào trang duyệt nguyện vọng và thẩm định, không phải danh sách sinh viên đã hướng dẫn. “Đề tài đăng ký” thực tế là nơi tìm/đề xuất/đăng ký. “Hồ sơ lưu chiểu” và “Công bố kết quả” mở modal trong trang khác; nhãn chưa diễn tả hành động.
- “Bản tin & Thông báo” là nội dung công khai, còn “Gửi thông báo hệ thống” là thông báo gửi tới tài khoản. Tên hiện tại dễ làm người dùng nhầm hai phạm vi.
- Việc Viện trưởng phân tán ở `ProjectPeriodPage`, `ProjectOversightPage`, `GradingDefensePage` và `CouncilAssignmentPage`; có route cũ không mở được cho nhóm Viện trưởng mặc định vì guard của trang rộng hơn quyền nghiệp vụ Viện trưởng có. Gom liên kết cũ vào menu không giải quyết được quyền hoặc luồng thao tác.
- Trang quản lý hội đồng hiện có chỗ coi `ADMIN` là đủ quyền quản lý, dù policy tách quyền xem và quản lý. Thiết kế mới không dựa vào role bypass.

## 3. Các hướng đã cân nhắc

| Hướng | Đánh đổi | Quyết định |
|---|---|---|
| Menu theo quy trình đồ án, lọc theo capability | Người dùng thấy hành trình rõ ràng; cần chuẩn hóa route, nhãn và policy | **Chọn** |
| Menu riêng hoàn toàn cho từng role | Dễ đọc theo từng người nhưng trùng định nghĩa, khó với người kiêm GVHD/Viện trưởng | Không chọn |
| Menu theo đối tượng dữ liệu | Tên ổn định nhưng hành động thẩm định/ra quyết định khó tìm | Không chọn |

Với Viện trưởng, một **trang hub ba tab** được chọn thay cho một nhóm menu bung ra ba mục hoặc một trang chỉ chứa shortcut. Tab phải chứa hàng đợi và thao tác thật; không nhân bản service nghiệp vụ.

## 4. Kiến trúc thông tin menu

### Quy tắc chung

- Menu nhóm theo giai đoạn: Bắt đầu → Đăng ký & đề cương → Hướng dẫn & tiến độ → Hội đồng & bảo vệ → Kết quả & hoàn tất. Các chức năng cấu hình nằm cuối dưới “Nội dung & hệ thống”. Chỉ hiện nhóm có ít nhất một mục được phép.
- Tên mục là **động từ + đối tượng** khi mở tác vụ (“Duyệt nguyện vọng”, “Nộp hồ sơ lưu chiểu”), hoặc **danh từ rõ phạm vi** khi mở danh sách (“Sinh viên đang hướng dẫn”, “Bản tin công khai”). Tránh các nhãn rộng như “Quản lý” nếu trang chỉ làm một việc.
- Một feature policy là nguồn chuẩn cho `key`, nhãn, nhóm, route, quyền xem và hành động. `NAVIGATION_REGISTRY` phải được dẫn xuất từ nguồn này hoặc loại bỏ; không duy trì hai bản thủ công.
- Các mục trỏ vào cùng trang bằng `?tab=` phải đánh dấu đúng mục đang chọn theo **pathname + tab**, không chỉ pathname. Back/Forward và deep link phải khôi phục đúng tab.
- Menu không tự cấp quyền. Route và API kiểm tra capability/scope; không dùng `role === 'ADMIN'` hay `isInstituteDirector` như đường tắt cấp hành động.

### Sinh viên

| Nhóm | Mục hiển thị | Trang đích / hành vi |
|---|---|---|
| Bắt đầu | Tổng quan | `/student/dashboard` |
| Đăng ký & đề cương | Tìm & đăng ký đề tài | `/student/topics`, gồm tìm, đề xuất và đăng ký; bỏ nhãn cũ “Đề tài đăng ký” |
| Thực hiện đồ án | Hồ sơ & nộp bài | `/student/submissions` |
| Bảo vệ & hoàn tất | Kết quả & điểm đồ án | `/student/grades` |
| Bảo vệ & hoàn tất | Nộp hồ sơ lưu chiểu | Deep link mở đúng luồng nộp lưu chiểu, giữ `/student/submissions?tab=archive` tương thích |

### GVHD và giảng viên tham gia hội đồng

| Nhóm | Mục hiển thị | Trang đích / hành vi |
|---|---|---|
| Bắt đầu | Tổng quan công việc | `/lecturer/dashboard` chung cho GVHD/Viện trưởng |
| Đăng ký & đề cương | Đề tài phụ trách | `/lecturer/topics` |
| Đăng ký & đề cương | Duyệt nguyện vọng | `/lecturer/approvals?tab=mentor`, chỉ hàng đợi tiếp nhận hướng dẫn |
| Đăng ký & đề cương | Thẩm định đề cương | `/lecturer/approvals?tab=bm01`, chỉ khi có quyền/chức trách hội đồng xét duyệt |
| Hướng dẫn & tiến độ | Sinh viên đang hướng dẫn | Trang danh sách riêng `/lecturer/students`, chỉ `TopicRegistration` có mentor là actor; không dẫn vào hàng đợi nguyện vọng |
| Hướng dẫn & tiến độ | Theo dõi tiến độ | `/lecturer/progress` |
| Hội đồng & bảo vệ | Hội đồng xét duyệt đề cương | Trang hội đồng hiện có khi actor có quyền xem/quản lý tương ứng |
| Hội đồng & bảo vệ | Hội đồng bảo vệ | Trang hội đồng hiện có khi actor có quyền xem/quản lý tương ứng |
| Hội đồng & bảo vệ | Phiếu chấm bảo vệ | `/lecturer/grading` khi actor là thành viên chấm và có quyền |

BM02-A/đổi tên do GVHD xử lý vẫn mở qua hàng đợi dashboard, hồ sơ đề tài hoặc deep link cũ `/lecturer/approvals?tab=bm02a`; không gắn thêm một menu chính mang tên không bao quát. Các mục hội đồng ở workspace nào phải được route guard theo capability thật, không hiển thị rồi trả 403.

### Quản trị / Giáo vụ

| Nhóm | Mục hiển thị | Nguồn/trang hiện có |
|---|---|---|
| Đợt & đăng ký | Đợt đồ án & học kỳ; Điều phối sinh viên; Danh mục đề tài | `project-periods`, `project-enrollments`, `all-topics` |
| Hướng dẫn & tiến độ | Giám sát tiến độ | `project-oversight` |
| Hội đồng & bảo vệ | Hội đồng xét duyệt; Hội đồng bảo vệ; Sổ điểm bảo vệ | `outline-councils`, `defense-councils`, `defense-lock` |
| Kết quả & báo cáo | Phê duyệt kết quả; Công bố kết quả học kỳ; Tiêu chí chấm điểm; Báo cáo học vụ | `defense-result-approvals`, `result-publications`, `rubric-config`, `academic-reports` |
| Nội dung & hệ thống | Bản tin công khai; Biểu mẫu & nội dung; Thông báo tài khoản; Người dùng; Phân quyền | `announcements`, `portal-content`, `notifications`, `users`, `permissions` |

Các chức năng Quản trị/Giáo vụ vẫn lọc theo capability; bảng trên là cấu trúc, không giả định mọi người trong workspace đều thấy tất cả. “Báo cáo học vụ” và “Giám sát tiến độ” có quyền xem độc lập, route/API phải khớp với menu. Hành động gửi thông báo tài khoản và biên tập bản tin công khai không dùng cùng nhãn.

### Viện trưởng

Viện trưởng kế thừa menu GVHD có quyền tương ứng và được thêm **một mục duy nhất** trong nhóm “Điều hành viện”: **Điều hành học vụ** → `/lecturer/institute`. Các việc thẩm định, quyết định và công bố thuộc chức vụ không rải thêm thành các mục cấp một ở sidebar. Quyền được ủy quyền có thể làm mục này xuất hiện cho actor không mang nhãn chức vụ, nhưng chỉ tab/chức năng được cấp quyền mới hiện.

Trong workspace giảng viên, các feature admin tương ứng với việc đã gom vào hub không được xuất hiện thêm thành mục menu thứ hai. URL admin cũ vẫn được bảo toàn cho người có quyền và cho liên kết đã lưu.

Quản lý học kỳ, điều phối hội đồng, chấm/khóa điểm và theo dõi tiến độ vẫn là nghiệp vụ riêng khi actor có quyền. “Ủy quyền chuyên môn” là công cụ phụ trong hub hoặc trang cấu hình theo ngữ cảnh, không là tab thứ tư hoặc mục menu Viện trưởng thứ hai.

## 5. Trang “Điều hành học vụ”

### Cấu trúc

- URL chuẩn: `/lecturer/institute?tab=review|decisions|publish`, kèm `semesterId` và resource ID khi deep link hợp lệ. Mặc định mở tab có việc cần xử lý đầu tiên mà actor được xem; nếu không có việc, mở tab đầu tiên được phép.
- Header hiển thị đợt đang xem, thông tin cập nhật và số việc thật theo từng tab. Chỉ đếm bản ghi actor được phép xem; không dùng unread notification làm số việc cần xử lý.
- Mỗi tab có bộ lọc trạng thái, hàng đợi có phân trang và trạng thái tải/trống/lỗi. Dòng việc cho thấy hồ sơ, giai đoạn, hạn thật, trạng thái, quyền xử lý; không có deadline thì không đánh dấu quá hạn.
- Xem chi tiết và hành động mở trong hub qua drawer/modal hoặc vùng chi tiết theo mẫu nghiệp vụ hiện có. Mutation dùng service/API hiện tại, cập nhật query sau thành công và hiển thị lỗi theo từng hồ sơ.

### Ba tab

1. **Thẩm định:** BM02 chờ duyệt/nộp lại, BM03 dừng hoặc khiếu nại thuộc thẩm quyền Viện, BM04 không thống nhất/ngoại lệ và hồ sơ thẩm định khác có capability tương ứng. Không đưa thẩm định BM01 của hội đồng vào đây chỉ vì actor cũng là Viện trưởng; việc đó vẫn theo vai trò hội đồng.
2. **Quyết định:** ban hành quyết định giao đề tài, phụ lục/điều chỉnh theo thẩm quyền, ký giấy xác nhận hoàn thành và phê duyệt kết quả bảo vệ. Mỗi loại hành động có xác nhận và điều kiện workflow từ backend.
3. **Công bố:** công bố danh sách đủ điều kiện bảo vệ và kết quả bảo vệ chính thức. Preview chỉ hiển thị dữ liệu actor được phép; điểm BM05 chưa công bố không xuất hiện ngoài luồng nội bộ có quyền phù hợp.

Hành động điều phối hội đồng và khóa sổ điểm vẫn ở trang chuyên môn tương ứng; hub có thể trỏ tới hồ sơ liên quan nhưng không sao chép form quản lý hội đồng hoặc logic tính điểm.

### Tương thích và nguồn code

- Route `/lecturer/institute` hiện dùng `ProjectPeriodPage`. Tách thành trang hub mới, giữ `/admin/project-periods` trên trang quản lý đợt; tái dùng component/service nghiệp vụ bằng cách tách phần dùng chung, không fork logic mutation.
- Deep link cũ `?tab=bm02Queue` đi đến `review`; `?tab=periods`/`?tab=decisions` đi đến `decisions`; `?tab=delegations` mở công cụ ủy quyền theo ngữ cảnh. Các URL admin cũ vẫn mở chức năng cho người có quyền, không redirect mù theo role.
- Viện trưởng mặc định có các capability nghiệp vụ nhưng hiện có trang `/admin/oversight` cần `VIEW_PROJECT_OVERSIGHT`. Hub phải query/guard theo quyền của **từng nghiệp vụ**, không dựa vào việc mở được trang cũ. Backend luôn kiểm tra semester/department/registration/council từ tài nguyên trong DB.

## 6. Tương tác, khả năng tiếp cận và kiểm thử

- Sidebar có thứ tự tab bàn phím theo hiển thị, focus rõ, `aria-current="page"` cho mục active và tên nhóm đọc được. Thu gọn menu không làm mất nhãn truy cập; trên màn 375px dùng drawer có nút đóng/mở rõ và không che nội dung hoặc focus.
- Label tiếng Việt ngắn gọn, có nghĩa. Nút dùng `@ant-design/icons` qua prop `icon`; không chèn emoji hoặc ký tự biểu tượng thô vào text. Dùng theme/token hiện có, không tạo hệ màu riêng cho từng role.
- Người chỉ có quyền xem thấy tab/hồ sơ đọc được nhưng không thấy mutation. Người bị thu hồi quyền hoặc đổi học kỳ không giữ dữ liệu cũ trong sidebar/hub; request tiếp theo nhận lỗi đúng lifecycle RBAC. Không dùng `role === 'ADMIN'` để mở hành động hội đồng.
- Test contract kiểm tra feature key → label/group/route/permission, không có hai nguồn menu thủ công, deep link active chính xác, mọi menu route tồn tại và không mở màn hình sai chức năng.
- Test persona Sinh viên, GVHD, Viện trưởng, Giáo vụ, Quản trị viên: menu đúng quyền; view-only không có mutation; hub ba tab chỉ hiện đúng capability; direct URL/API ngoài scope trả 403; BM05 chưa công bố không lộ dữ liệu.
- Test browser ở 375/768/1024/1440px, bàn phím, back/forward, URL với `?tab=`, loading/empty/error. Kiểm tra UTF-8 không BOM và `TopicRegistration`/quota hiện hành.

## 7. Tiêu chí hoàn thành

1. Người dùng chọn một mục menu và nhận đúng chức năng mà tên mục mô tả; không có mục menu dẫn tới tab/modal không liên quan mà không nói rõ hành động.
2. Sinh viên và Quản trị/Giáo vụ có cấu trúc theo giai đoạn đã duyệt; GVHD có “Duyệt nguyện vọng” và “Sinh viên đang hướng dẫn” là hai đích khác nhau.
3. Viện trưởng có một mục “Điều hành học vụ” với ba tab thao tác thật; không cần đi qua trang admin thiếu quyền để thẩm định, quyết định hoặc công bố.
4. Menu, route, action và API nhất quán với capability + resource scope; không có admin bypass hoặc dữ liệu học kỳ khác.
5. URL cũ hoạt động theo ánh xạ nêu trên; deep link mới khôi phục đúng tab/hồ sơ, back/forward không làm mất trạng thái.
