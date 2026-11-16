# Thiết Kế Chuẩn Hóa Phân Quyền Capability End-to-End

**Ngày:** 16/11/2026

**Trạng thái:** Chờ người dùng duyệt

**Phạm vi:** CSDL/Prisma, backend authorization, cấp và thu hồi quyền, frontend route/menu/action, kiểm thử RBAC 5 persona

## 1. Bối cảnh và kết luận audit

Hệ thống hiện có ba role cơ sở `ADMIN`, `LECTURER`, `STUDENT`. Các chức vụ nghiệp vụ `GVHD`, `GIAO_VU`, `VIEN_TRUONG` được biểu diễn bằng nhóm quyền; quyền tạm thời được bổ sung qua `AcademicDelegation`. Mô hình này phù hợp với nghiệp vụ nhưng hiện có nhiều nguồn quyết định quyền độc lập:

- catalog và nhóm quyền mặc định trong backend;
- middleware và guard theo permission;
- các bypass theo `role` trong route/controller;
- delegation theo học kỳ;
- route guard, navigation registry và action guard ở frontend;
- alias permission phục vụ tương thích.

Các lớp trên chưa dùng cùng một policy contract. Hậu quả đã xác nhận qua audit:

1. Một số quyền được cấp nhưng API vẫn trả `403`, ví dụ `REPORT_VIEW`, `VIEW_PERMISSIONS`, `VIEW_PORTAL_CONTENT`.
2. Một số trang mở bằng quyền xem nhưng vẫn hiển thị nút mutation mà người dùng không có quyền thực hiện.
3. Menu, route và API dùng tập permission khác nhau; có menu hiện nhưng bấm vào bị redirect, hoặc route truy cập được nhưng menu bị ẩn.
4. Một số bypass theo role làm việc thu hồi capability không có hiệu lực đầy đủ.
5. Alias quyền và permission string không thuộc catalog làm tăng nguy cơ quyền chết hoặc kiểm tra sai mã.
6. Delegation theo học kỳ đang dựa một phần vào `semesterId` do client cung cấp thay vì scope suy ra từ resource trên server.
7. Thay đổi permission matrix chưa tăng `permissionVersion` cho toàn bộ người dùng bị ảnh hưởng; quyền và menu có thể stale giữa các process hoặc tab.
8. UI ma trận quyền và backend chưa thống nhất thẩm quyền thay đổi quyền học thuật được bảo vệ.

Backend hiện vẫn chặn được phần lớn truy cập trái phép và các test RBAC trọng tâm đang pass. Công việc này là chuẩn hóa kiến trúc và đóng các khoảng trống đã nêu, không thay thế mô hình nghiệp vụ `TopicRegistration`.

## 2. Mục tiêu

1. Một permission code chỉ có một nghĩa và một mã canonical.
2. Cấp một quyền phải tạo ra hành vi nhất quán tại menu, route, action và API.
3. Thu hồi quyền phải có hiệu lực sớm, đồng nhất giữa backend instance, frontend tab và query cache.
4. Phân biệt rõ quyền xem, quyền thao tác và phạm vi tài nguyên.
5. Backend là nguồn quyết định cuối cùng; frontend chỉ phản chiếu policy để cung cấp UX đúng.
6. Delegation không thể mở rộng ngoài học kỳ, đơn vị hoặc tài nguyên được ủy quyền.
7. Có thể kiểm chứng toàn bộ bằng ma trận 5 persona và contract test tự động.

## 3. Phi mục tiêu

- Không đổi ba role cơ sở trong bảng `User`.
- Không chuyển sang OPA, Casbin hoặc một policy engine bên ngoài.
- Không khôi phục kiến trúc `group/groupMember` cũ.
- Không thay đổi quy tắc `TopicRegistration`: một sinh viên/một đề tài và một GVHD tối đa 10 sinh viên.
- Không cấp quyền học thuật cho Admin kỹ thuật chỉ vì role là `ADMIN`.
- Không biến toàn bộ resource ownership thành permission tĩnh.

## 4. Các phương án đã cân nhắc

### 4.1. Vá từng mismatch

Sửa riêng từng menu, route và API đang lệch. Cách này nhanh nhưng giữ nguyên nhiều nguồn policy và rất dễ tái phát khi bổ sung chức năng mới.

### 4.2. Chuẩn hóa capability end-to-end — được chọn

Giữ mô hình role + permission group + delegation hiện có, nhưng đưa tất cả consumer về một catalog canonical và một contract policy thống nhất. Đây là thay đổi vừa đủ để xử lý gốc vấn đề mà không đưa thêm hạ tầng ngoài dự án.

### 4.3. Policy engine/ABAC đầy đủ

Linh hoạt nhất nhưng làm tăng đáng kể độ phức tạp triển khai, vận hành và migration. Chưa cần thiết với quy mô và vòng đời hiện tại của DACN.

## 5. Mô hình phân quyền đích

### 5.1. Ba lớp quyết định

Mỗi yêu cầu được đánh giá qua ba lớp độc lập:

1. **Identity eligibility:** role cơ sở nào có thể mang capability này. Ví dụ quyền của sinh viên không thể gán cho tài khoản giảng viên và ngược lại.
2. **Capability:** người dùng có quyền canonical cần thiết từ permission group hoặc delegation còn hiệu lực.
3. **Resource scope:** người dùng có quan hệ hợp lệ với tài nguyên cụ thể, ví dụ là sinh viên sở hữu đăng ký, GVHD của đề tài, thành viên hội đồng được phân công, đúng đơn vị hoặc đúng học kỳ.

Một request chỉ được phép khi cả ba lớp đều đạt. Role không tự động thay thế capability, ngoại trừ capability nền được khai báo rõ trong policy catalog.

### 5.2. Năm persona chuẩn để kiểm thử

| Persona | Biểu diễn | Phạm vi chính |
|---|---|---|
| Sinh viên | `STUDENT` + nhóm nền | Chỉ tài nguyên của chính mình |
| GVHD | `LECTURER` + `GVHD` | Sinh viên/đề tài đang hướng dẫn và hội đồng được phân công |
| Giáo vụ | `LECTURER` + `GIAO_VU` | Điều phối, thẩm định, lưu chiểu và báo cáo đúng đơn vị/học kỳ |
| Viện trưởng | `LECTURER` + `VIEN_TRUONG` | Phê duyệt, ký và công bố cuối cùng đúng phạm vi viện |
| Admin kỹ thuật | `ADMIN` + `QUAN_TRI_VIEN` | Người dùng, cấu hình kỹ thuật, portal; không mặc định có quyền học thuật |

## 6. Canonical permission catalog

### 6.1. Một nguồn chuẩn

`backend/src/constants/permissions.js` tiếp tục là nguồn khai báo gốc, nhưng mỗi permission phải bổ sung metadata đủ để các lớp khác sinh contract:

- `code` canonical;
- `label`, `module`;
- `kind`: `VIEW` hoặc `ACTION`;
- `eligibleRoles`;
- `protectedDomain`: `TECHNICAL`, `ACADEMIC` hoặc `STUDENT_BASE`;
- `scopeType`: `GLOBAL`, `DEPARTMENT`, `SEMESTER`, `RESOURCE` hoặc tổ hợp được quy định;
- quyền view/action liên quan nếu một màn hình có cả hai lớp.

Frontend sử dụng artifact sinh ra hoặc module cấu hình được kiểm tra parity với catalog backend. Không duy trì hai danh sách thủ công có thể lệch nhau.

### 6.2. Xử lý alias

- Chọn một code canonical cho mỗi cặp alias.
- Trong giai đoạn chuyển tiếp, resolver có thể đọc alias nhưng luôn normalize về canonical trước khi đánh giá.
- Seed/migration chuyển association hiện có sang canonical.
- Frontend, route và controller ngừng ghi alias mới.
- Sau khi contract scan không còn consumer, xóa alias khỏi catalog.

CI phải thất bại nếu source code kiểm tra một permission string không có trong catalog hoặc dùng alias đã bị cấm ghi mới.

## 7. Backend authorization

### 7.1. Capability resolver dùng chung

Tạo một resolver duy nhất phục vụ login, `/auth/me`, middleware request và test fixture. Resolver hợp nhất:

- permission groups của user;
- delegation đang `ACTIVE`, còn thời hạn;
- canonical normalization;
- `permissionVersion`;
- metadata assignment hội đồng cần cho UI.

Không có resolver riêng với quy tắc lọc delegation khác nhau giữa login và request.

### 7.2. Guard tách read/write và scope

Route GET dùng quyền view; route mutation dùng action permission. Router không được khóa toàn bộ GET và mutation bằng cùng một quyền quản lý nếu catalog đã tách hai loại.

Guard backend thực hiện theo thứ tự:

1. xác thực;
2. resolve capability canonical;
3. kiểm tra eligible role;
4. load hoặc resolve resource context từ CSDL;
5. kiểm tra semester/department/ownership/assignment;
6. cho phép hoặc trả lỗi có mã ổn định.

`semesterId`, `department`, `registrationId` hoặc `councilId` do client gửi chỉ là định danh đầu vào. Giá trị có thẩm quyền phải được đối chiếu từ resource trong CSDL. Header `x-semester-id` không được tự mình mở capability.

### 7.3. Role bypass

Mọi bypass `role === 'ADMIN'`, `role === 'STUDENT'` hoặc `role === 'LECTURER'` tại action API phải được phân loại:

- chuyển thành capability nền canonical nếu hành vi là bắt buộc và bất khả thu hồi;
- hoặc thay bằng guard capability + resource scope nếu quyền phải có thể cấp/thu hồi.

Không giữ bypass ngầm trong controller/service.

### 7.4. Delegation

Delegation phải có:

- capability nằm trong allowlist ủy quyền;
- người cấp có authority tương ứng;
- `department` bắt buộc với delegation cấp đơn vị;
- `semesterId` bắt buộc với delegation theo đợt, trừ quyền được định nghĩa `GLOBAL`;
- thời hạn và trạng thái;
- audit log đầy đủ.

List, create và revoke đều fail-closed nếu actor cần department nhưng không có department. Scope của request được suy ra từ resource, sau đó mới chọn delegation phù hợp.

## 8. Cấp, thu hồi và đồng bộ quyền

### 8.1. Hai authority rõ ràng

- `PERMISSION_GROUP_MANAGE`: quản lý nhóm và quyền kỹ thuật.
- `PERMISSION_ASSIGN_ACADEMIC`: gán/thu hồi nhóm hoặc delegation học thuật trong phạm vi hợp lệ.

UI và backend dùng cùng quy tắc này. Người có cả hai quyền có thể thay đổi phần tương ứng; người chỉ có quyền kỹ thuật không thể chỉnh quyền học thuật được bảo vệ.

### 8.2. Thay đổi ma trận

Mọi thao tác create/update/delete group, bulk matrix, assign/revoke group hoặc delegation phải:

1. chạy transaction;
2. xác định danh sách user bị ảnh hưởng;
3. tăng `permissionVersion` của các user đó;
4. xóa cache capability;
5. ghi audit log;
6. phát sự kiện thay đổi quyền sau commit.

Trong triển khai một instance, event có thể dùng cơ chế nội bộ hiện có. Nếu chạy nhiều instance, cần cơ chế invalidation dùng chung phù hợp hạ tầng triển khai; không dựa riêng vào RAM cache của một process.

### 8.3. Frontend session refresh

Khi nhận sự kiện hoặc lỗi `PERMISSION_VERSION_STALE`, frontend gọi `/auth/me`, nhận token/user mới, xóa query cache theo scope cũ và dựng lại menu. Thao tác cấp/thu hồi thành công phải chủ động broadcast `PERMISSIONS_UPDATED`; không chờ tab đích tự gặp `409`.

## 9. Frontend policy contract

### 9.1. Feature policy manifest

Mỗi chức năng định nghĩa một policy manifest duy nhất, tối thiểu gồm:

- route/path và workspace;
- `viewAnyOf` hoặc `viewAllOf`;
- các action và permission tương ứng;
- assignment predicate nếu cần hội đồng/GVHD;
- menu metadata.

`navigationRegistry`, `ProtectedRoute` và action guards đọc cùng manifest. Frontend không tự thêm permission theo group, không bypass theo role và không lặp lại danh sách permission khác nhau ở nhiều file.

### 9.2. Quy tắc hiển thị

- Không có quyền view: ẩn menu và chặn direct URL.
- Có quyền view nhưng không có action: mở trang ở chế độ read-only; ẩn hoặc disable có giải thích các nút mutation.
- Có action nhưng thiếu resource scope: không hiển thị hành động cho resource đó; backend vẫn kiểm tra lại.
- API trả `403` do scope thay đổi: giữ shell, hiển thị trạng thái không đủ quyền và refresh session nếu `permissionVersion` stale.

## 10. Error contract và audit

Authorization trả mã lỗi ổn định để frontend xử lý đúng:

- `AUTHENTICATION_REQUIRED` — `401`;
- `CAPABILITY_REQUIRED` — `403`;
- `RESOURCE_SCOPE_FORBIDDEN` — `403`;
- `DELEGATION_SCOPE_FORBIDDEN` — `403`;
- `PERMISSION_VERSION_STALE` — `409`;
- `PROTECTED_PERMISSION_MODIFICATION_FORBIDDEN` — `403`.

Audit log lưu actor, target user/group, permission delta, scope, timestamp, IP và kết quả. Không ghi token hoặc dữ liệu nhạy cảm.

## 11. Migration strategy

Triển khai theo lát cắt và luôn giữ hệ thống chạy được:

1. Lập inventory permission đang được dùng và tạo contract scan.
2. Chọn canonical code, thêm metadata và adapter alias chuyển tiếp.
3. Chuẩn hóa resolver capability và `permissionVersion` lifecycle.
4. Vá các lỗ hổng scope P0: delegation học kỳ/đơn vị và role bypass.
5. Tách read/write guard cho các API hiện bị lệch.
6. Chuẩn hóa API cấp/thu hồi và permission matrix.
7. Tạo feature policy manifest và chuyển menu/route/action theo từng module.
8. Xóa ngoại lệ frontend, alias và permission string chết sau khi không còn consumer.
9. Chạy ma trận test, E2E năm persona và regression nghiệp vụ.

Mỗi module chuyển đổi phải hoàn tất đồng thời backend guard, frontend manifest/action và test. Không migration riêng frontend trước backend hoặc ngược lại.

## 12. Kiểm thử và tiêu chí nghiệm thu

### 12.1. Contract/static tests

- Mọi permission string trong backend/frontend tồn tại trong catalog.
- Không consumer mới dùng alias.
- Mỗi navigation item có route policy tương ứng.
- Mỗi action UI có action permission tương ứng.
- Mỗi route mutation có action guard; mỗi route đọc có view guard thích hợp.

### 12.2. Ma trận năm persona

Với từng persona:

- menu hợp lệ được hiện, menu cấm bị ẩn;
- direct URL hợp lệ mở được, URL cấm redirect hoặc hiển thị `403` phù hợp;
- GET/action API trả đúng `2xx/401/403`;
- quyền view không làm xuất hiện mutation trái phép;
- scope own/mentor/council/department/semester được kiểm tra cả positive và negative.

### 12.3. Grant/revoke lifecycle

- Cấp nhóm hoặc delegation làm menu, route và API có hiệu lực sau refresh session.
- Thu hồi làm token cũ nhận `409`, session mới mất quyền, menu biến mất và API bị từ chối.
- Hai tab trình duyệt đồng bộ quyền.
- Multi-instance không giữ quyền cũ quá giới hạn được chấp nhận.

### 12.4. Regression nghiệp vụ

- Không rò rỉ điểm chưa công bố.
- BM02-A, BM03, BM04, BM05 và hồ sơ lưu chiểu giữ đúng ownership/assignment.
- Việc chấm độc lập của thành viên hội đồng không bị mở rộng bởi quyền xem chung.
- Mô hình `TopicRegistration`, quota GVHD và các trạng thái workflow không thay đổi.

## 13. Thứ tự ưu tiên

### P0

1. Không tin semester/department do client cung cấp để mở delegation.
2. Đóng role bypass làm thu hồi capability vô hiệu.
3. Fail-closed delegation list/revoke khi thiếu department.
4. Thêm test âm cho scope học kỳ, đơn vị và resource.

### P1

1. Canonical catalog và contract scan.
2. Sửa mismatch quyền được cấp nhưng API `403`.
3. Tách view/action trên backend và frontend.
4. Đồng bộ `permissionVersion`, cache và cross-tab event.
5. Chuẩn hóa feature policy manifest.

### P2

1. Xóa alias và permission string chết.
2. Chuẩn hóa `isSystem` cho nhóm nền và seed.
3. Hoàn thiện E2E năm persona và báo cáo ma trận quyền.

## 14. Rủi ro và biện pháp giảm thiểu

- **Khóa nhầm người dùng hợp lệ:** chuyển đổi từng module, giữ adapter alias tạm thời và chạy test persona trước khi xóa compatibility.
- **Mở rộng quyền ngoài ý muốn:** default deny, kiểm tra delta quyền và negative test cho mọi action trọng yếu.
- **Stale quyền trong lúc migration:** tăng `permissionVersion` theo user bị ảnh hưởng và xóa query cache theo identity scope.
- **Plan quá lớn:** chia task theo tầng gốc và theo module, mỗi task có test đỏ trước khi sửa.
- **Frontend tạo cảm giác bảo mật giả:** mọi điều kiện UI đều có guard tương ứng ở backend; frontend không phải security boundary.

## 15. Quyết định đã chốt

1. Chọn chuẩn hóa capability end-to-end, không dùng policy engine ngoài.
2. Giữ ba role cơ sở và ba nhóm chức vụ học thuật chính.
3. Backend là nguồn quyết định cuối cùng.
4. Tách rõ view, action và resource scope.
5. Dùng một catalog canonical và một feature policy contract.
6. Thực hiện từ CSDL/catalog và backend trước, sau đó mới chuyển frontend.
