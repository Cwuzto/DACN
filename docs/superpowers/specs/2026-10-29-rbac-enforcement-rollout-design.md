# Thực thi RBAC Matrix trên toàn bộ Backend

**Ngày:** 29/10/2026
**Phạm vi:** chuyển các endpoint nhân sự từ role guard thô sang capability guard, giữ nguyên role và ownership cho luồng tự phục vụ của sinh viên.

## 1. Bối cảnh

Hệ thống hiện có 46 permission trong catalog và giao diện RBAC Matrix, nhưng phần lớn backend vẫn kiểm tra `ADMIN`, `LECTURER` hoặc `STUDENT`. Chỉ các endpoint quản lý ma trận và thẩm định BM02 kiểm tra permission trực tiếp. Vì vậy việc bật/tắt nhiều ô trong ma trận chưa thay đổi quyền thực thi thực tế.

P0 đã đồng bộ `BM02_REVIEW`, chặn tự thu hồi `PERMISSION_GROUP_MANAGE`, validate payload bulk, dùng transaction `Serializable` và ghi audit nguyên tử. P1 đưa ma trận này vào lớp thực thi của API.

## 2. Quyết định đã duyệt

1. `ADMIN` không được bypass permission. Tài khoản Admin chỉ gọi được endpoint nghiệp vụ khi có capability tương ứng từ nhóm quyền.
2. Sinh viên dùng mô hình hybrid: role `STUDENT` mở luồng tự phục vụ, controller/service tiếp tục kiểm tra ownership và state machine.
3. Permission chỉ mở cửa chức năng; ownership, thành viên hội đồng và điều kiện trạng thái vẫn là lớp kiểm soát bắt buộc phía sau.
4. Endpoint dùng chung cho nhiều loại tài nguyên phải xác định loại tài nguyên rồi kiểm tra đúng permission tương ứng.
5. Được bổ sung permission nguyên tử mới khi catalog hiện tại không có mã đúng nghĩa; không tái sử dụng permission gần giống để lấp chỗ trống.
6. Rollout theo capability và theo từng lát nhỏ, không thay toàn bộ role guard trong một lần.

## 3. Mục tiêu và ngoài phạm vi

### Mục tiêu

- Mỗi endpoint nhân sự có capability policy rõ ràng.
- Thay đổi trong RBAC Matrix có hiệu lực ở request kế tiếp sau khi người dùng được tải lại từ DB.
- Không còn đường bypass mặc định chỉ vì người dùng có role `ADMIN`.
- Giữ nguyên mọi ownership guard và state-machine guard hiện hữu.
- Tự động phát hiện permission được tham chiếu nhưng thiếu trong catalog.
- Có test chứng minh `401`, `403`, `200`, resource-aware authorization và ownership.

### Ngoài phạm vi

- Không thay mô hình `TopicRegistration` và không khôi phục `group/groupMember`.
- Không biến sinh viên thành permission group hoặc gán nhóm hàng loạt cho sinh viên.
- Không thiết kế lại JWT, session, UI RBAC Matrix hoặc state machine BM01–BM04.
- Không triển khai ABAC tổng quát hay policy engine bên ngoài.
- Không thay business rule chỉ để làm test phân quyền đạt.

## 4. Kiến trúc kiểm soát ba lớp

### 4.1. Capability guard tại route

Mỗi route nhân sự khai báo một hoặc nhiều permission bằng hằng số tập trung. Middleware xác thực lấy `permissions[]` từ các `PermissionGroup` của người dùng như hiện tại rồi trả:

- `401` khi chưa xác thực hoặc token không hợp lệ;
- `403` khi đã xác thực nhưng thiếu capability;
- chuyển tiếp request khi có capability phù hợp.

`authorizePermission` giữ ngữ nghĩa **có ít nhất một** permission trong danh sách. Bổ sung `authorizeAllPermissions` chỉ cho endpoint thực sự cần đồng thời nhiều capability. Không middleware nào tự cho phép chỉ vì `role === 'ADMIN'`.

Catalog và mã hằng permission được tách khỏi service có kết nối Prisma để test integrity có thể import mà không khởi tạo DB.

### 4.2. Resource-aware authorization

Route generic có thể phục vụ nhiều loại tài nguyên. Capability cần thiết được suy ra từ tài nguyên thực tế:

- `OUTLINE_REVIEW` → `OUTLINE_COUNCIL_MANAGE`;
- `DEFENSE_COUNCIL` → `DEFENSE_COUNCIL_MANAGE`;
- task/checkpoint BM03 → permission BM03 tương ứng;
- hồ sơ lưu chiểu → `FINAL_DOCUMENT_REVIEW` cho thao tác thẩm định.

Với create, loại tài nguyên được lấy từ payload đã validate. Với read/update/delete, controller/service phải đọc tài nguyên trước, suy ra permission rồi mới trả dữ liệu hoặc mutate. Không dùng `authorizeAnyPermission(OUTLINE_COUNCIL_MANAGE, DEFENSE_COUNCIL_MANAGE)` như lớp kiểm tra cuối cùng vì cách đó cho phép quản trị sai loại hội đồng.

### 4.3. Ownership và business guard

Sau capability guard, controller/service vẫn phải kiểm tra:

- GVHD chỉ thao tác hồ sơ có `topic.mentorId === req.user.id` khi nghiệp vụ yêu cầu ownership;
- giảng viên chấm điểm phải là thành viên hội đồng phù hợp;
- sinh viên chỉ xem/nộp dữ liệu của chính mình;
- hồ sơ phải ở trạng thái cho phép theo state machine;
- giới hạn một sinh viên/một đề tài và tối đa 10 sinh viên/GVHD không đổi.

Capability không thay thế ownership và không được dùng để bỏ qua state machine.

## 5. Permission catalog

### 5.1. Bốn permission mới

| Code | Ý nghĩa | Mapping mặc định |
|---|---|---|
| `RUBRIC_MANAGE` | Quản trị rubric bảo vệ | `QUAN_TRI_VIEN`, `VIEN_TRUONG` |
| `NOTIFICATION_MANAGE` | Broadcast, mẫu và lịch sử thông báo hệ thống | `QUAN_TRI_VIEN` |
| `LEGACY_REVIEW_MANAGE` | Xử lý hàng đợi hồ sơ legacy | `QUAN_TRI_VIEN` |
| `FINAL_DOCUMENT_REVIEW` | Thẩm định hồ sơ lưu chiểu | `GVHD`, `VIEN_TRUONG` |

Migration chỉ upsert bốn permission và thêm mapping mặc định bằng `ON CONFLICT DO NOTHING`. Migration không xóa hoặc tái tạo permission mapping do người dùng tùy chỉnh.

### 5.2. Phân loại 46 permission hiện hữu

| Nhóm | Permission | Chính sách P1 |
|---|---|---|
| Công khai | `PUBLIC_ANNOUNCEMENT_VIEW`, `TOPIC_VIEW`, `LECTURER_DIRECTORY_VIEW` | Route public/read giữ optional authentication; permission dùng cho các màn hình nội bộ nếu cần dữ liệu mở rộng. |
| Sinh viên tự phục vụ | `ELIGIBILITY_VIEW_OWN`, `MENTOR_REQUEST_CREATE`, `OUTLINE_SUBMIT`, `BM02_SUBMIT`, `POST_DEFENSE_REVISION_SUBMIT`, `FINAL_DOCUMENT_SUBMIT` | Role `STUDENT` + ownership; không bắt buộc permission group. |
| Hồ sơ giảng viên | `LECTURER_PROFILE_VIEW`, `LECTURER_PROFILE_MANAGE` | Self-profile giữ authenticated ownership; quản trị hồ sơ người khác dùng `USER_MANAGE`. |
| Điều kiện và danh bạ | `ELIGIBILITY_VIEW_ALL`, `ELIGIBILITY_PUBLISH`, `LECTURER_DIRECTORY_PUBLISH` | Capability guard trực tiếp. |
| Phân công GVHD | `MENTOR_REQUEST_REVIEW`, `MENTOR_ASSIGN`, `MENTOR_ASSIGNMENT_ADJUST` | Capability guard; điều chuyển mentor dùng `MENTOR_ASSIGNMENT_ADJUST`. |
| Đề tài | `TOPIC_CREATE`, `TOPIC_UPDATE_OWN`, `TOPIC_REVIEW` | Capability tại route và ownership cho update/delete đề tài của GVHD. |
| BM01 | `OUTLINE_REVIEW`, `OUTLINE_APPROVE`, `OUTLINE_COUNCIL_MANAGE` | Review/approve/council dùng capability riêng; GVHD review lại vẫn cần ownership. |
| BM02 | `BM02_REVIEW`, `PROJECT_ASSIGNMENT_PUBLISH` | Giữ guard BM02 hiện tại; ban hành quyết định không còn Admin bypass. |
| BM03/BM04 | `BM03_SUBMIT`, `BM03_REVIEW`, `BM03_CHECKPOINT_DECIDE`, `BM04_SUBMIT`, `BM04_REVIEW` | Capability guard kết hợp mentor ownership hoặc quyền giám sát phù hợp. |
| Bảo vệ | `DEFENSE_COUNCIL_MANAGE`, `DEFENSE_SCORE_SUBMIT`, `DEFENSE_SCORE_VIEW`, `RESULT_LOCK`, `RESULT_PUBLISH` | Capability riêng; chấm điểm còn yêu cầu membership; khóa kết quả không đồng nghĩa công bố. |
| Sau bảo vệ | `POST_DEFENSE_REVISION_REVIEW` | Capability + ownership/người có trách nhiệm. |
| Báo cáo | `REPORT_VIEW`, `AUDIT_LOG_VIEW` | Dashboard/báo cáo và audit log tách biệt. |
| Người dùng/RBAC | `USER_MANAGE`, `USER_IMPORT`, `PERMISSION_GROUP_MANAGE` | CRUD user, import và quản lý nhóm quyền tách biệt; cập nhật nhóm của user yêu cầu `PERMISSION_GROUP_MANAGE`. |
| Hệ thống/học kỳ | `SYSTEM_CONFIG_MANAGE`, `SEMESTER_MANAGE`, `PROJECT_CATALOG_MANAGE`, `ENROLLMENT_MANAGE` | Capability guard trực tiếp, không Admin bypass. |

Các mã `PUBLIC_ANNOUNCEMENT_MANAGE`, `LECTURER_DIRECTORY_VIEW`, `MENTOR_ASSIGN` và những mã còn lại trong catalog vẫn giữ đúng module/ngữ nghĩa đã khai báo; bảng trên nhóm các mã theo chính sách thực thi, không loại bỏ mã nào.

## 6. Ánh xạ route theo lát rollout

### Lát 1 — Quản trị nền tảng

| Route cluster | Capability |
|---|---|
| Tạo/sửa/xóa announcement | `PUBLIC_ANNOUNCEMENT_MANAGE` |
| Danh sách, CRUD, khóa, reset password user | `USER_MANAGE` |
| Import/export mẫu tài khoản | `USER_IMPORT` |
| Xem/cập nhật permission group của user | `PERMISSION_GROUP_MANAGE` |
| CRUD semester | `SEMESTER_MANAGE` |
| Công bố/gỡ/bổ sung quyết định giao đề tài | `PROJECT_ASSIGNMENT_PUBLISH` |
| Project catalog | `PROJECT_CATALOG_MANAGE` |
| Project enrollment/import/export | `ENROLLMENT_MANAGE` |
| Dashboard thống kê | `REPORT_VIEW` |
| Notification history/template/broadcast | `NOTIFICATION_MANAGE` |
| CRUD/activate rubric | `RUBRIC_MANAGE` |
| Manual legacy review | `LEGACY_REVIEW_MANAGE` |
| RBAC Matrix và CRUD permission group | `PERMISSION_GROUP_MANAGE` |

### Lát 2 — Học vụ và hướng dẫn

| Route cluster | Capability và lớp bổ sung |
|---|---|
| Danh sách registration cho GVHD | `BM03_REVIEW` + controller scope theo mentor |
| Danh sách registration giám sát toàn hệ thống | `REPORT_VIEW` |
| Duyệt/từ chối yêu cầu đăng ký | `MENTOR_REQUEST_REVIEW` + mentor ownership khi áp dụng |
| Force decision | `MENTOR_ASSIGN` |
| Drop/transfer mentor | `MENTOR_ASSIGNMENT_ADJUST` |
| Hội đồng review/duyệt BM01 | `OUTLINE_REVIEW` hoặc `OUTLINE_APPROVE` theo hành động |
| BM02 review | `BM02_REVIEW` |
| Duyệt điều chỉnh tên | `TOPIC_UPDATE_OWN` + mentor ownership |
| Tạo/cập nhật nhật ký BM03 | `BM03_SUBMIT` + mentor ownership |
| Xem nhật ký/tiến độ | `BM03_REVIEW` + ownership hoặc quyền giám sát |
| Chấm checkpoint | `BM03_CHECKPOINT_DECIDE` + mentor ownership |
| Lập BM04 | `BM04_SUBMIT` + mentor ownership |
| Xem BM04 với tư cách nhân sự | `BM04_REVIEW`; sinh viên xem bản thân bằng role + ownership |
| Topic create/update/review | `TOPIC_CREATE`, `TOPIC_UPDATE_OWN`, `TOPIC_REVIEW` theo hành động |

Task generic phải suy ra capability từ `taskType`; không cho phép một permission BM03 quản lý task thuộc BM01/BM04 nếu nghiệp vụ không tương ứng.

### Lát 3 — Hội đồng, điểm và lưu chiểu

| Route cluster | Capability và lớp bổ sung |
|---|---|
| CRUD/gán Hội đồng đề cương | `OUTLINE_COUNCIL_MANAGE` |
| CRUD/gán Hội đồng bảo vệ | `DEFENSE_COUNCIL_MANAGE` |
| Xem audit log hội đồng | capability quản lý đúng loại hội đồng và `AUDIT_LOG_VIEW` khi xem audit toàn hệ thống |
| Danh sách sinh viên cần chấm | `DEFENSE_SCORE_SUBMIT` + membership |
| Xem score sheet | `DEFENSE_SCORE_VIEW` + membership hoặc quyền giám sát |
| Lưu score sheet | `DEFENSE_SCORE_SUBMIT` + membership |
| Khóa/mở khóa điểm | `RESULT_LOCK` |
| Công bố kết quả | `RESULT_PUBLISH` |
| Xem kho lưu chiểu/radar | `FINAL_DOCUMENT_REVIEW` hoặc `REPORT_VIEW` tùy màn hình |
| Thẩm định lưu chiểu | `FINAL_DOCUMENT_REVIEW` + mentor/viện ownership |
| Nộp và xem hồ sơ của sinh viên | role `STUDENT` + ownership |

## 7. Ngoại lệ role/self-service được phép

Danh sách ngoại lệ phải khai báo tường minh trong test coverage:

- health check;
- login;
- `GET /auth/me`, đổi mật khẩu và cập nhật hồ sơ cá nhân;
- public semester, announcement, lecturer directory và topic read;
- student registration/submission/signature/appeal/archive của chính mình;
- notification cá nhân: list, mark read, delete của chính người dùng;
- upload đã xác thực, với validation MIME/kích thước và ownership tại endpoint sử dụng file;
- allowed-actions chỉ trả dữ liệu sau khi controller xác minh người dùng có quyền xem registration.

Không route nhân sự nào được thêm vào ngoại lệ chỉ để tránh viết permission mapping.

## 8. Data flow

1. `authenticate` xác minh JWT và tải user cùng permission groups từ DB.
2. Route capability guard kiểm tra permission tĩnh nếu endpoint có một capability cố định.
3. Validator kiểm tra params/body/query.
4. Controller/service tải resource nếu permission phụ thuộc loại tài nguyên.
5. Resource-aware guard suy ra permission cần thiết và kiểm tra `req.user.permissions`.
6. Ownership và state-machine guard chạy trước mọi mutation hoặc trả dữ liệu nhạy cảm.
7. Controller thực thi nghiệp vụ và audit các mutation vốn yêu cầu audit.

Thay đổi ma trận có hiệu lực ở request kế tiếp vì `authenticate` đọc lại user/group từ DB cho mỗi request; không cần thu hồi JWT hiện tại.

## 9. Frontend alignment

Backend là nguồn thực thi cuối cùng. Frontend dùng `permissions` và `permissionGroups` từ `/auth/me` để:

- ẩn menu/nút không có capability;
- khóa route trước khi mount trang;
- không hiển thị toast thành công khi API trả `401/403`;
- giữ redirect theo portal hiện tại, nhưng không redirect toàn cục cho mọi `403` nghiệp vụ.

Frontend không tự suy ra rằng `ADMIN` có mọi quyền.

## 10. Xử lý lỗi và an toàn rollout

- `401`: thiếu token, token lỗi/hết hạn hoặc user inactive.
- `403`: thiếu capability, sai ownership, sai membership hoặc sai loại resource.
- `400`: input/ID không hợp lệ.
- `404`: resource hợp lệ về định dạng nhưng không tồn tại; controller có thể dùng `404` thay vì tiết lộ resource ngoài ownership nếu cần tránh enumeration.
- Không có fallback từ permission sang role `ADMIN`.
- Catalog migration phải deploy trước code route của lát tương ứng.
- Mỗi lát được merge/deploy độc lập và phải qua toàn bộ test trước khi chuyển lát sau.
- Worktree hiện có nhiều thay đổi; implementation phải sửa theo phạm vi hẹp và không reset file ngoài P1.

## 11. Kiểm thử

### Integrity và coverage

1. Mọi permission constant/policy được dùng phải tồn tại trong catalog.
2. Catalog không có code trùng.
3. Mọi staff endpoint phải có capability policy hoặc nằm trong whitelist self-service/public.
4. Không route P1 nào còn `authorize('ADMIN')` làm lớp cho phép duy nhất.

### Integration

Với mỗi lát, test tối thiểu:

- không token → `401`;
- user đúng role nhưng thiếu permission → `403`;
- user có permission → đi qua capability guard;
- có permission nhưng sai ownership/membership → `403`;
- Admin thiếu permission → `403`;
- permission mới có mapping mặc định đúng sau migration.

### Resource-aware

- `OUTLINE_COUNCIL_MANAGE` không thao tác Hội đồng bảo vệ;
- `DEFENSE_COUNCIL_MANAGE` không thao tác Hội đồng đề cương;
- quyền xem điểm không cho phép ghi điểm;
- quyền khóa kết quả không tự cho phép công bố;
- `FINAL_DOCUMENT_REVIEW` không cho phép thẩm định hồ sơ ngoài phạm vi được giao.

### Regression

- Toàn bộ backend Jest suite;
- frontend Node tests và production build;
- Prisma validate và migrate status;
- UTF-8 no BOM cho file thay đổi.

## 12. Tiêu chí nghiệm thu

1. RBAC Matrix thay đổi quyền thực thi của endpoint nhân sự ở request tiếp theo.
2. Admin không permission nhận `403` thay vì được bypass bằng role.
3. Sinh viên vẫn hoàn tất các luồng tự phục vụ hợp lệ bằng role + ownership.
4. Không permission nào mở rộng ownership hoặc bỏ qua state machine.
5. Bốn permission mới tồn tại và có mapping mặc định đã duyệt.
6. Route coverage test không còn staff endpoint ngoài policy/whitelist.
7. Test `401/403/200`, dynamic resource và ownership đạt cho cả ba lát.
8. Backend test, frontend test/build và Prisma validation đều PASS.
