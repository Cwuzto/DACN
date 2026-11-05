# Thiết Kế Kỹ Thuật: Ma Trận Phân Quyền Hai Tầng (2-Tier Capability Matrix) & Điều Hướng Động 7 Khối Nghiệp Vụ

- **Tài liệu**: `docs/superpowers/specs/2026-11-05-capability-matrix-navigation-redesign.md`
- **Ngày lập**: 05/11/2026
- **Trạng thái**: Draft - Đã hoàn thiện rà soát kiến trúc & Sẵn sàng Builder Check

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ (Intent & Why)

Hệ thống Quản lý Đồ án Tốt nghiệp (DACN) chuyển dịch từ cơ chế kiểm soát truy cập cứng theo vai trò (Role-Based Access Control - RBAC) sang mô hình phân quyền hướng năng lực (Capability-Driven Access Control):
1. **Frontend**: Thay thế hoàn toàn việc rào chắn bằng `allowedRoles: ['ADMIN', 'LECTURER', 'STUDENT']` trên router bằng việc kiểm tra năng lực hiển thị (`VIEW_*`) qua một Navigation Registry cố định. Thanh menu bên trái được gom thành 7 khối nghiệp vụ chuyên môn; người dùng có capability nào thì khối nghiệp vụ và menu tương ứng sẽ hiển thị.
2. **Backend**: Tách quyền hiển thị (`VIEW_*`) và quyền thao tác thay đổi dữ liệu (`*_CREATE`, `*_SUBMIT`, `*_REVIEW`, `*_APPROVE`, `*_LOCK`, `*_PUBLISH`,...). Tuyệt đối không dùng `VIEW_*` để bảo vệ API mutation.
3. **Vai trò (STUDENT / LECTURER / ADMIN)**: Đóng vai trò là thuộc tính hồ sơ và ngữ cảnh nghiệp vụ (xác thực liên kết GVHD, sinh viên, hội đồng), **không tự động cấp quyền truy cập học thuật**.

---

## 2. Mục Tiêu, Phi Mục Tiêu & Chống Mục Tiêu (Goals, Non-Goals, Anti-Goals)

### Goals
1. **Mô hình phân quyền 2 tầng**:
   - *Tầng hiển thị*: Mỗi mục menu tương ứng đúng 1 quyền xem (`VIEW_*`).
   - *Tầng thao tác*: Mọi mutation được bảo vệ bởi action capability riêng biệt.
2. **Navigation Registry cố định 7 khối**: Frontend định nghĩa danh mục menu tĩnh, lọc qua `effectivePermissions`, loại bỏ hoàn toàn logic rẽ nhánh role.
3. **Phòng thủ 3 lớp (Defense-in-Depth)**:
   - *Lớp 1 (Capability)*: Kiểm tra action capability từ server cache/DB (không tin cậy JWT thô).
   - *Lớp 2 (Domain Scope)*: Kiểm tra ownership, gán GVHD, thành viên hội đồng.
   - *Lớp 3 (Academic Invariants)*: Kiểm tra trạng thái máy quy trình, đủ 3 phiếu chấm, hạn chót, không xung đột lợi ích (COI).
4. **Bảo tồn URL hiện hữu (In-place Refactoring)**: Giữ nguyên các route path hiện tại (`/student/*`, `/lecturer/*`, `/admin/*`) bọc trong một `AppLayout` duy nhất, bảo toàn 378 unit/integration test.
5. **Cơ chế cấp quyền Sinh viên chuẩn quy chuẩn**: Cấp qua nhóm quyền hệ thống bất biến `SYSTEM_STUDENT_BASE` (`isSystem: true`) khi provisioning tài khoản, không suy diễn từ role.
6. **Đồng bộ quyền qua vòng đời client & BroadcastChannel**: Cập nhật tức thì giữa các tab cùng trình duyệt khi có thay đổi quyền mà không cần WebSocket/SSE.
7. **Tách biệt quyền sở hữu và quyền ủy quyền**: Phân định rõ ràng giữa việc sở hữu capability và quyền được cấp capability đó cho người khác (`grantablePermissionCodes` / `PERMISSION_ASSIGN_ACADEMIC`).

### Non-Goals
1. Không tái cấu trúc URL thành đường dẫn phẳng `/manage/...` trong đợt này để tránh rủi ro hồi quy.
2. Không mở nhóm quyền học thuật cơ bản của sinh viên cho quản trị viên tùy biến trên giao diện.

### Anti-Goals
1. **Tuyệt đối cấm dùng `VIEW_*` để bảo vệ API mutation**: Quyền xem menu không bao giờ cho phép thực thi hành động nghiệp vụ.
2. **Không có đặc quyền Admin học thuật mặc định (Zero-Trust Admin)**: Tài khoản `ADMIN` không thể can thiệp điểm số hay quy trình học thuật nếu không có capability và quyết định phân công.
3. **Không dùng `VIEW_*` cho nút hành động trên từng bản ghi (CTA Invariant)**: Nút hành động trên từng hồ sơ bắt buộc phải kiểm tra mảng `allowedActions[]` do backend tính toán và trả về.
4. **Không dùng JWT làm nguồn quyền tối hậu**: Server luôn resolve quyền từ CSDL/cache theo `permissionVersion` hiện hành.

---

## 3. Ràng Buộc Kỹ Thuật (Constraints)
- **Mã hóa**: 100% file `.js`, `.jsx`, `.json`, `.md` lưu ở chuẩn **UTF-8 (no BOM)**.
- **Toàn vẹn nghiệp vụ đồ án**: Giữ nguyên bất biến 1 sinh viên / 1 đề tài (`maxStudents = 1`), hạn mức 10 sinh viên / 1 GVHD, cấm bypass `EXCEPTION_REVIEW`.
- **Tương thích ngược**: 378 bài kiểm thử (343 backend + 35 frontend) phải tiếp tục pass 100%.

---

## 4. Các Phương Án Đã Cân Nhắc & Lựa Chọn (Approaches)

### Phương án 1: Chuyển đổi Capability tại chỗ & Bảo tồn Route hiện hữu (ĐÃ CHỌN)
- Giữ nguyên cấu trúc URL hiện có, loại bỏ `allowedRoles` khỏi `ProtectedRoute` và backend route guards.
- Registry ánh xạ trực tiếp `VIEW_*` tới các route hiện có.
- Chi phí tối ưu, rủi ro hồi quy tối thiểu, bảo toàn toàn bộ test suite.

### Phương án 2: Tái cấu trúc toàn diện URL phẳng theo Domain (ĐÃ BỎ QUA)
- Xóa bỏ toàn bộ tiền tố `/admin`, `/lecturer`, `/student`, viết lại toàn bộ router.
- Rủi ro làm gãy các test contract và route redirects quá lớn, không cần thiết ở giai đoạn hiện tại.

---

## 5. Kiến Trúc Chi Tiết 7 Khối Nghiệp Vụ & Ma Trận Phân Quyền

### 5.1. Bảng Phân Bổ 7 Khối Nghiệp Vụ (Navigation Registry)

| Nhóm nghiệp vụ (Group) | Tên Menu hiển thị (Label) | Quyền xem duy nhất (`VIEW_*`) | Đường dẫn Route hiện tại | Quyền thao tác tách riêng (Action Capabilities) |
|---|---|---|---|---|
| **1. Hồ sơ của tôi** | Đề tài đăng ký | `VIEW_MY_REGISTRATION` | `/student/topics` | `REGISTER_TOPIC`, `RENAME_TOPIC` |
| | Đề tài phụ trách | `VIEW_MY_TOPICS` | `/lecturer/topics` | `TOPIC_CREATE`, `TOPIC_UPDATE_OWN` |
| | Hồ sơ & Nộp bài | `VIEW_MY_SUBMISSIONS` | `/student/submissions` | `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK` |
| | Lưu chiểu số | `VIEW_MY_ARCHIVE` | `/student/submissions?tab=archive` | `SUBMIT_PRE_DEFENSE_ARCHIVE`, `SUBMIT_FINAL_ARCHIVE` |
| | Điểm đồ án của tôi | `VIEW_MY_GRADES` | `/student/grades` | — (Chỉ đọc snapshot công bố) |
| **2. Hướng dẫn & tiến độ** | Sinh viên hướng dẫn | `VIEW_MENTORED_STUDENTS` | `/lecturer/approvals` | `MENTOR_REQUEST_REVIEW` |
| | Checkpoint tiến độ | `VIEW_CHECKPOINTS` | `/lecturer/progress` | `CHECKPOINT_ISSUE`, `CHECKPOINT_SIGN`, `SIGNATURE_APPEAL_REVIEW` |
| | Đánh giá BM04 | `VIEW_BM04_EVALUATIONS` | `/lecturer/progress?tab=bm04` | `BM04_SUBMIT`, `BM04_REVIEW` |
| **3. Thẩm định & quyết định** | Thẩm định BM01 | `VIEW_OUTLINE_REVIEWS` | `/lecturer/approvals?tab=bm01` | `OUTLINE_REVIEW`, `OUTLINE_APPROVE` |
| | Duyệt đơn BM02 | `VIEW_BM02_REVIEWS` | `/lecturer/institute` | `BM02_REVIEW` |
| | Quyết định giao đề tài | `VIEW_ASSIGNMENT_DECISIONS` | `/lecturer/institute?tab=decisions` | `PROJECT_ASSIGNMENT_PUBLISH`, `DECISION_AMENDMENT_SIGN` |
| **4. Hội đồng & bảo vệ** | Phân công Hội đồng | `VIEW_COUNCIL_ASSIGNMENTS` | `/admin/councils` | `OUTLINE_COUNCIL_MANAGE`, `DEFENSE_COUNCIL_MANAGE` |
| | Phiếu chấm bảo vệ | `VIEW_DEFENSE_GRADING` | `/lecturer/grading` | `DEFENSE_SCORE_SUBMIT` |
| | Trung tâm chấm & Khóa sổ | `VIEW_DEFENSE_LOCK_LEDGER` | `/admin/grading` | `RESULT_LOCK`, `DEFENSE_RESULT_APPROVE` |
| **5. Kết quả & công bố** | Phê duyệt kết quả | `VIEW_DEFENSE_RESULT_APPROVALS`| `/admin/grading?tab=approvals` | `DEFENSE_RESULT_APPROVE` |
| | Công bố kết quả | `VIEW_RESULT_PUBLICATIONS` | `/admin/grading?tab=publish` | `RESULT_PUBLICATION_PUBLISH` |
| | Tiêu chí chấm (Rubric) | `VIEW_RUBRIC_CONFIG` | `/admin/rubric-management` | `RUBRIC_MANAGE` |
| **6. Quản trị học vụ** | Đợt đồ án & Học kỳ | `VIEW_PROJECT_PERIODS` | `/admin/project-periods` | `SEMESTER_MANAGE` |
| | Gán môn đồ án (Enrollment)| `VIEW_PROJECT_ENROLLMENTS` | `/admin/project-enrollments` | `ENROLLMENT_MANAGE`, `PROJECT_CATALOG_MANAGE` |
| | Quản lý đề tài chung | `VIEW_ALL_TOPICS` | `/admin/topics` | `TOPIC_REVIEW` |
| | Giám sát tiến độ & rà soát | `VIEW_PROJECT_OVERSIGHT` | `/admin/oversight` | `PROJECT_OVERSIGHT_MANAGE`, `REPORT_VIEW` |
| **7. Quản trị hệ thống** | Quản lý người dùng | `VIEW_USERS` | `/admin/users` | `USER_MANAGE`, `USER_IMPORT` |
| | Phân quyền & Nhóm quyền | `VIEW_PERMISSIONS` | `/admin/permissions` | `PERMISSION_GROUP_MANAGE`, `PERMISSION_ASSIGN_ACADEMIC` |
| | Bản tin Portal | `VIEW_ANNOUNCEMENTS` | `/admin/announcements` | `PUBLIC_ANNOUNCEMENT_MANAGE` |
| | Biểu mẫu & CMS Portal | `VIEW_PORTAL_CONTENT` | `/admin/portal` | `PORTAL_CONTENT_MANAGE` |
| | Gửi thông báo người dùng | `VIEW_NOTIFICATIONS` | `/admin/notifications` | `NOTIFICATION_MANAGE` |

---

### 5.2. Quyết Định Kỹ Thuật Chi Tiết (Architectural Decisions)

1. **Nhóm quyền hệ thống bất biến `SYSTEM_STUDENT_BASE`**:
   - CSDL định nghĩa nhóm quyền hệ thống `SYSTEM_STUDENT_BASE` (`isSystem: true`) chứa các quyền cơ sở của sinh viên: `VIEW_MY_REGISTRATION`, `VIEW_MY_SUBMISSIONS`, `VIEW_MY_ARCHIVE`, `VIEW_MY_GRADES`, `REGISTER_TOPIC`, `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK`, `SUBMIT_PRE_DEFENSE_ARCHIVE`, `SUBMIT_FINAL_ARCHIVE`.
   - Nhóm quyền này được cấp tự động khi khởi tạo/import tài khoản sinh viên.
   - Bị khóa bất biến: cấm chỉnh sửa, đổi tên, thu hồi hoặc xóa trên UI/API.
   - Backend kiểm tra 100% bằng capability + domain guard: *'Người dùng có hồ sơ sinh viên hợp lệ và có enrollment ACTIVE trong học kỳ'*. Tuyệt đối không suy diễn quyền dựa trên `role === 'STUDENT'`.

2. **Loại bỏ hoàn toàn logic rẽ nhánh role trong Registry**:
   - Tách bạch 2 entry độc lập: `my-registration` (`VIEW_MY_REGISTRATION` $\to$ `/student/topics`) và `my-topics` (`VIEW_MY_TOPICS` $\to$ `/lecturer/topics`).
   - Tách bạch `my-grades` (`VIEW_MY_GRADES` $\to$ `/student/grades`) và `publish-results` (`VIEW_RESULT_PUBLICATIONS` $\to$ `/admin/grading?tab=publish`).
   - `NAVIGATION_REGISTRY` hoàn toàn là hằng số tĩnh, không dùng hàm kiểm tra role.

3. **Cấu trúc Layout thống nhất (Single Unified AppLayout)**:
   - Hợp nhất `AdminLayout`, `LecturerLayout`, `StudentLayout` thành một component `AppLayout` duy nhất.
   - Header hiển thị tên người dùng và vai trò hồ sơ chính; widget `QuotaMeter` chỉ hiển thị nếu người dùng có quyền `TOPIC_CREATE` hoặc `MENTOR_REQUEST_REVIEW`.

4. **Bảo vệ và đồng bộ Tab qua Query Parameters (`?tab=...`)**:
   - Các component trang lớn (`GradingDefensePage`, `ProgressTrackingPage`, `SubmissionPage`, `ProjectPeriodPage`) sử dụng hook `useSearchParams` để đồng bộ active tab theo URL.
   - Nội dung từng tab có guard kiểm tra capability tương ứng; nếu người dùng truy cập tab không có quyền, tự động fallback về tab đầu tiên được phép xem.

5. **Nguyên tắc In-page CTA vs `VIEW_*`**:
   - `VIEW_*` CHỈ được dùng để quyết định hiển thị mục menu trên sidebar và route truy cập trang.
   - Mọi nút bấm hành động nghiệp vụ (Khóa điểm, Ký duyệt checkpoint, Duyệt đề cương, Ban hành quyết định) trên từng dòng dữ liệu **BẮT BUỘC phải căn cứ vào mảng `allowedActions[]` do backend tính toán và trả về theo từng bản ghi**.

6. **Loại bỏ hoàn toàn khái niệm `LEGACY_REVIEW_MANAGE`**:
   - Thay thế bằng `PROJECT_OVERSIGHT_MANAGE`, phục vụ thuần túy rà soát tiến độ và kiểm toán học vụ, xóa bỏ hoàn toàn nguy cơ bypass nghiệp vụ.

---

## 6. Mô Hình Bảo Vệ API Backend (3-Layer Defense-in-Depth)

Mọi yêu cầu mutation đều phải đi qua pipeline kiểm soát chặt chẽ:

```
[Request]
   │
   ▼
┌────────────────────────────────────────────────────────┐
│ 1. Capability Check (Server-Resolved Permissions)      │
│    - Kiểm tra permissionVersion khớp CSDL / Cache?     │
│    - Kiểm tra danh sách quyền thực tế chứa Action Code?│
│    - VÍ DỤ: 'RESULT_LOCK'                              │
└────────────────────────────────────────────────────────┘
   │
   ▼ Pass (Nếu Version cũ -> Trả PERMISSION_VERSION_STALE)
┌────────────────────────────────────────────────────────┐
│ 2. Domain Scope & Membership Guard                     │
│    - Người dùng có thuộc hội đồng được chấm?           │
│    - Hoặc có phải GVHD được phân công / Sinh viên chủ? │
│    - VÍ DỤ: councilMember.lecturerId === req.user.id   │
└────────────────────────────────────────────────────────┘
   │
   ▼ Pass
┌────────────────────────────────────────────────────────┐
│ 3. State Machine & Academic Invariant Guard            │
│    - Trạng thái TopicRegistration có hợp lệ?           │
│    - Đã nộp đủ 3 phiếu chấm cá nhân của hội đồng?      │
│    - Không có xung đột lợi ích GVHD (COI)?             │
│    - Còn trong hạn chót (Policy Deadline)?             │
└────────────────────────────────────────────────────────┘
   │
   ▼ Pass
[Thực thi nghiệp vụ & Lưu Audit Log]
```

### Bảng Ánh Xạ Chuyển Đổi Route Backend

| Route Endpoint | Phương thức | Middleware cũ | Middleware mới (Capability) | Domain Guard bổ sung |
|---|---|---|---|---|
| `/api/registrations/register` | `POST` | `authorize('STUDENT')` | `authorizePermission('REGISTER_TOPIC')` | Kiểm tra sinh viên có enrollment ACTIVE |
| `/api/registrations/:id/status` | `PATCH` | `authorize('LECTURER')` | `authorizePermission('MENTOR_REQUEST_REVIEW')` | Ràng buộc `topic.mentorId === req.user.id` |
| `/api/evaluations/councils/:id/lock-scores` | `POST` | `authorizePermission('RESULT_LOCK')` | `authorizePermission('RESULT_LOCK')` | Ràng buộc Hội đồng, 3 phiếu chấm cá nhân |
| `/api/semesters/:id/decisions` | `POST` | `authorizePermission('PROJECT_ASSIGNMENT_PUBLISH')` | `authorizePermission('PROJECT_ASSIGNMENT_PUBLISH')` | Ràng buộc Viện trưởng/Khoa, Idempotency-Key |
| `/api/evaluations/my-grades` | `GET` | `authorize('STUDENT')` | `authorizePermission('VIEW_MY_GRADES')` | Ràng buộc `registration.studentId === req.user.id` và chỉ trả snapshot đã công bố chính thức |
| `/api/dashboards/overview` | `GET` | Tách lẻ 3 route | `authenticate` (Dùng chung) | Widget lọc theo tập `req.user.permissions` |

---

### 6.1. Rào Chắn Chống Leo Thang Quyền & Tách Biệt Quyền Ủy Quyền (Delegation Boundary)

1. **Tách biệt Quyền Sở hữu (Possession) và Quyền Ủy quyền (Delegation)**:
   - Sở hữu một capability (ví dụ: `RESULT_LOCK`) **KHÔNG** đồng nghĩa với việc có quyền cấp `RESULT_LOCK` cho người khác.
   - Chỉ người dùng sở hữu quyền quản trị ủy quyền (`PERMISSION_GROUP_MANAGE` hoặc capability chuyên biệt `PERMISSION_ASSIGN_ACADEMIC`) mới được phép gán nhóm/quyền cho người khác.
   - Thao tác gán quyền bị giới hạn bởi danh mục `grantablePermissionCodes` được quy định chặt chẽ theo phân cấp quản trị.
2. **Cấm tự nâng quyền (Anti-Self-Escalation)**:
   - Người dùng thực hiện không được phép tự gán thêm quyền hoặc đổi nhóm quyền cho chính mình (`targetUserId !== req.user.id`).
3. **Bảo vệ nhóm hệ thống**:
   - Nhóm `SYSTEM_STUDENT_BASE` mang cờ `isSystem: true` không được phép chỉnh sửa danh sách quyền, không được đổi tên hoặc xóa qua API/UI.
4. **Server-Authoritative Permission Resolution**:
   - JWT chỉ mang `userId`, `role` và `permissionVersion`, **không mang quyền tối hậu**.
   - Server nạp quyền từ CSDL hoặc in-memory cache theo `userId + permissionVersion`. Khi Admin thay đổi phân quyền của User A, `permissionVersion` của A tăng lên `+1`. Yêu cầu mutation tiếp theo mang version cũ sẽ bị từ chối ngay với mã lỗi `PERMISSION_VERSION_STALE`.
5. **Tính bất biến & Audit**:
   - Mọi thao tác gán/thu hồi quyền bắt buộc phải có `Idempotency-Key`, ghi nhật ký `AuditLog` chi tiết (actor, target, old permissions, new permissions).

---

## 7. Kiến Trúc Frontend Navigation Registry & Session Sync

### 7.1. Cấu Trúc Navigation Registry (`frontend/src/config/navigationRegistry.js`)

Registry là hằng số cố định, không tạo động từ chuỗi server và không chứa logic rẽ nhánh role:

```javascript
export const NAVIGATION_REGISTRY = [
  {
    key: 'my-registration',
    label: 'Đề tài đăng ký',
    icon: 'folder_open',
    group: 'Hồ sơ của tôi',
    requiredPermission: 'VIEW_MY_REGISTRATION',
    route: '/student/topics',
  },
  {
    key: 'my-topics',
    label: 'Đề tài phụ trách',
    icon: 'topic',
    group: 'Hồ sơ của tôi',
    requiredPermission: 'VIEW_MY_TOPICS',
    route: '/lecturer/topics',
  },
  {
    key: 'defense-grading',
    label: 'Phiếu chấm bảo vệ',
    icon: 'rate_review',
    group: 'Hội đồng & bảo vệ',
    requiredPermission: 'VIEW_DEFENSE_GRADING',
    route: '/lecturer/grading',
  },
  {
    key: 'defense-lock',
    label: 'Trung tâm chấm & Khóa sổ',
    icon: 'lock',
    group: 'Hội đồng & bảo vệ',
    requiredPermission: 'VIEW_DEFENSE_LOCK_LEDGER',
    route: '/admin/grading',
  },
  // ... Đầy đủ 22 mục tương ứng 7 nhóm nghiệp vụ (mỗi mục đúng 1 route và 1 VIEW_*)
];
```

### 7.2. Nguyên Tắc Hiển Thị Sidebar
1. Đọc `effectivePermissions = new Set(user?.permissions || [])`.
2. Lọc các mục thỏa mãn: `item.requiredPermission ? effectivePermissions.has(item.requiredPermission) : true`.
3. Gom nhóm theo `group`. Nhóm nào có danh sách mục rỗng (`items.length === 0`) sẽ **tự động ẩn hoàn toàn**.
4. Menu "Tổng quan" (`/dashboard`) luôn hiển thị ở vị trí đầu tiên cho mọi người dùng đã đăng nhập.

### 7.3. Đồng Bộ Quyền Phía Client (Client-Driven Session Sync & Permission Versioning)

1. **Các thời điểm Client kích hoạt Refetch (`authService.getMe()`)**:
   - Khi đăng nhập thành công hoặc refresh token.
   - Khi chuyển route điều hướng trong ứng dụng.
   - Khi quay lại tab trình duyệt (`window.focus` hoặc sự kiện `visibilitychange` khi tab chuyển từ ẩn sang hiện).
   - Ngay sau khi Admin thực hiện thao tác lưu phân quyền trên modal.
   - Khi API backend trả về lỗi `PERMISSION_VERSION_STALE`.
2. **Đồng bộ đa Tab không cần Server Push (BroadcastChannel)**:
   - Khởi tạo kênh `const authChannel = new BroadcastChannel('dacn_auth_sync');`.
   - Khi Admin cập nhật phân quyền tại Tab 1, client phát thông điệp `authChannel.postMessage({ type: 'PERMISSIONS_UPDATED', userId })`.
   - Các tab khác trong cùng trình duyệt nhận thông điệp sẽ tự động gọi `authService.getMe()`, cập nhật `effectivePermissions` trong `authStore` và render lại Navigation Registry ngay lập tức trong vài mili-giây mà không cần F5 hay WebSocket.
3. **Phân biệt rành mạch giữa 401, 403 và Stale Version (Không logout hàng loạt)**:
   - **401 Unauthorized** hoặc `ACCOUNT_DISABLED`: Token hết hạn / tài khoản bị vô hiệu hóa $\to$ Xóa sạch session, reset `authStore` và điều hướng về trang đăng nhập.
   - **403 Forbidden**: Lỗi nghiệp vụ domain (xung đột lợi ích COI, ngoài thẩm quyền hội đồng, sai trạng thái quy trình, quá hạn chót) $\to$ **GIỮ NGUYÊN session đăng nhập**, hiển thị thông báo lỗi/toast giải thích rõ lý do từ chối cho người dùng. Tuyệt đối không xóa session và không logout.
   - **PERMISSION_VERSION_STALE**: Quyền vừa bị quản trị viên thay đổi $\to$ Client tự động gọi `authService.getMe()`, cập nhật `authStore` và điều hướng an toàn về trang phù hợp hoặc thử lại thao tác.
4. **Chính sách Cache**:
   - Cho phép cache client cục bộ tối đa 1–3 phút để tối ưu hiệu năng gọi API `getMe()`, nhưng **tuyệt đối không dùng cache client làm nguồn xác thực quyền học thuật**. Mọi quyết định tối hậu thuộc về backend.

---

## 8. Các Phần Dành Cho Builder Tự Quyết (What's Left to Builder)
1. Thống kê chi tiết danh sách icon Google Material Symbols phù hợp nhất cho từng menu con trong 7 khối.
2. Thiết kế logic chuyển hướng tại `/dashboard` (tự động load widget thống kê tương ứng với quyền cao nhất của người dùng).
3. Viết script seed / migration cập nhật bảng `Permission` và `PermissionGroup` trong CSDL Supabase PostgreSQL.
4. Cập nhật unit test `rbacUiContracts.test.js` và `platformAuthorization.routes.test.js` để kiểm thử toàn diện mô hình mới.
