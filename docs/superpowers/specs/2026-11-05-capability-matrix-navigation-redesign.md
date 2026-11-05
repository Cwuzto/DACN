# Thiết Kế Kỹ Thuật: Ma Trận Phân Quyền Hai Tầng (2-Tier Capability Matrix) & Điều Hướng Động 7 Khối Nghiệp Vụ

- **Tài liệu**: `docs/superpowers/specs/2026-11-05-capability-matrix-navigation-redesign.md`
- **Ngày lập**: 05/11/2026
- **Trạng thái**: Draft - Đang chờ Builder Check & Phê duyệt

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ (Intent & Why)

Hệ thống Quản lý Đồ án Tốt nghiệp (DACN) trước đây áp dụng cơ chế phân quyền kết hợp (Hybrid RBAC + Capabilities):
1. **Frontend**: Bị rào cứng bởi 3 layout URL riêng biệt (`/admin/*`, `/lecturer/*`, `/student/*`) với `allowedRoles` kiểm tra cứng vai trò (`ADMIN`, `LECTURER`, `STUDENT`). Menu bên trái đòi hỏi tổ hợp nhiều quyền kỹ thuật hoặc không có quyền mà phụ thuộc role, dẫn đến việc giảng viên hoặc cán bộ chuyên môn khi được ủy quyền quản trị (như phân công hội đồng, ban hành quyết định) bị chặn truy cập.
2. **Backend**: Một số endpoint vẫn dùng `authorize('ADMIN')` hoặc `authorize('LECTURER')`, dẫn đến việc quản trị viên kỹ thuật có nguy cơ can thiệp vào các cổng học thuật mà không cần năng lực chuyên môn, hoặc ngược lại giảng viên không thể thực thi nhiệm vụ được ủy quyền.

### Mục tiêu chuyển đổi:
- **Mô hình 2 tầng phân quyền (2-Tier Capability Model)**:
  - **Tầng hiển thị (Menu/Page View)**: Mỗi mục menu tương ứng với duy nhất một quyền xem (`VIEW_*`). Người dùng được cấp quyền nào thì menu đó xuất hiện và route xem dữ liệu tương ứng được mở khóa.
  - **Tầng thao tác (Action Mutation)**: Mọi thao tác thay đổi dữ liệu (POST, PUT, PATCH, DELETE) đòi hỏi quyền hành động độc lập (`*_CREATE`, `*_SUBMIT`, `*_REVIEW`, `*_APPROVE`, `*_LOCK`, `*_PUBLISH`,...).
- **Cơ chế phòng thủ 3 lớp (Defense-in-Depth)** trên toàn bộ API backend:
  1. *Lớp 1 (Capability)*: Token sở hữu mã quyền hành động cụ thể.
  2. *Lớp 2 (Domain Scope)*: Ràng buộc phạm vi (GVHD phụ trách, thành viên hội đồng, sinh viên sở hữu hồ sơ).
  3. *Lớp 3 (Academic Invariants)*: Ràng buộc trạng thái máy quy trình (State Machine), đầy đủ 3 phiếu chấm, hạn chót, không xung đột lợi ích (COI).
- **Phân nhóm điều hướng theo chuyên môn**: Gom toàn bộ menu thành 7 khối nghiệp vụ chuyên môn độc lập với vai trò; nhóm chỉ xuất hiện khi người dùng có ít nhất một menu con được phép xem.
- **Bảo tồn URL hiện hữu (In-place Refactoring)**: Ánh xạ Registry vào các URL hiện có để đảm bảo an toàn tuyệt đối, tránh hồi quy (regression) trên 378 unit/integration test.

---

## 2. Mục Tiêu, Phi Mục Tiêu & Chống Mục Tiêu (Goals, Non-Goals, Anti-Goals)

### Goals
1. Chuẩn hóa danh mục quyền thành 2 loại rõ rệt trong CSDL và backend constants: `VIEW_*` (Menu/Route View) và Action Permissions.
2. Thiết lập `navigationRegistry.js` cố định ở frontend, ánh xạ mỗi mục menu tới đúng 1 `VIEW_*` và gán vào 1 trong 7 khối nghiệp vụ chuyên môn.
3. Chuyển đổi `AppLayout.jsx` và `ProtectedRoute.jsx` từ kiểm tra `allowedRoles` sang kiểm tra năng lực thực tế `requiredPermission: VIEW_*`.
4. Thay thế toàn bộ middleware `authorize(role)` ở backend bằng `authorizePermission` kết hợp domain guard.
5. Trang Tổng quan (`/dashboard`) hiển thị chung, các widget con bên trong lọc linh hoạt theo capability và scope.
6. Hỗ trợ làm mới quyền tức thì (Session / Permission Sync) khi quản trị viên phân quyền lại.

### Non-Goals
1. Không đập bỏ hay đổi tên hàng loạt các URL hiện hữu (không chuyển sang đường dẫn phẳng `/manage/...` để tránh gãy các liên kết và test suites).
2. Không biến quy trình làm đồ án của sinh viên thành các quyền quản trị tự do (sinh viên vẫn có vai trò `STUDENT` gắn liền với tài khoản học vụ).

### Anti-Goals
1. **Tuyệt đối không dùng `VIEW_*` để bảo vệ API mutation**: Quyền xem menu không bao giờ đồng nghĩa với quyền sửa/tạo/duyệt dữ liệu.
2. **Không có đặc quyền Admin học thuật (Zero-Trust Admin)**: Vai trò `ADMIN` không tự động có quyền chấm điểm, duyệt đề cương hay khóa điểm nếu không được cấp capability và phân công hội đồng.
3. **Không dựng sidebar từ chuỗi quyền thô**: Không duyệt trực tiếp danh sách chuỗi permission trong CSDL để tạo menu; phải luôn đi qua `navigationRegistry` chuẩn hóa.

---

## 3. Ràng Buộc Kỹ Thuật (Constraints)
- **Mã hóa**: 100% file `.js`, `.jsx`, `.json`, `.md` lưu ở chuẩn **UTF-8 (no BOM)**.
- **Toàn vẹn nghiệp vụ đồ án**: Giữ nguyên bất biến 1 sinh viên / 1 đề tài (`maxStudents = 1`), hạn mức 10 sinh viên / 1 GVHD, cấm bypass `EXCEPTION_REVIEW`.
- **Tương thích ngược**: 378 bài kiểm thử (343 backend + 35 frontend) phải tiếp tục pass 100% sau khi refactor.

---

## 4. Các Phương Án Đã Cân Nhắc & Lựa Chọn (Approaches)

### Phương án 1: Chuyển đổi Capability tại chỗ & Bảo tồn Route hiện hữu (ĐÃ CHỌN)
- **Đặc điểm**: Giữ nguyên tiền tố URL (`/student/*`, `/lecturer/*`, `/admin/*`) nhưng loại bỏ rào chắn vai trò ở Router và Route Guards. Frontend ánh xạ `navigationRegistry` trực tiếp tới các route hiện có. Backend chuyển đổi `authorize(role)` sang `authorizePermission`.
- **Ưu điểm**: Chi phí triển khai tối ưu, độ an toàn cực cao, không làm gãy các liên kết cũ hay test suite.
- **Lý do chọn**: Đạt được toàn bộ yêu cầu về phân quyền và giao diện động mà không gây gián đoạn hệ thống.

### Phương án 2: Tái cấu trúc toàn diện URL phẳng theo Domain (ĐÃ BỎ QUA)
- **Đặc điểm**: Bỏ toàn bộ tiền tố vai trò, đổi thành `/academic/*`, `/defense/*`, `/records/*`.
- **Nhược điểm**: Rủi ro cao, phải sửa hàng trăm file và toàn bộ test suite kiểm tra route redirects, dễ gây lỗi hồi quy.

---

## 5. Kiến Trúc Chi Tiết 7 Khối Nghiệp Vụ & Ma Trận Phân Quyền

### 5.1. Bảng Phân Bổ 7 Khối Nghiệp Vụ (Navigation Registry)

| Nhóm nghiệp vụ (Group) | Tên Menu hiển thị (Label) | Quyền xem duy nhất (`VIEW_*`) | Đường dẫn Route hiện tại | Quyền thao tác tách riêng (Action Capabilities) |
|---|---|---|---|---|
| **1. Hồ sơ của tôi** | Đề tài đăng ký | `VIEW_MY_REGISTRATION` | `/student/topics` | `REGISTER_TOPIC`, `RENAME_TOPIC` |
| | Đề tài phụ trách | `VIEW_MY_TOPICS` | `/lecturer/topics` | `TOPIC_CREATE`, `TOPIC_UPDATE_OWN` |
| | Hồ sơ & Nộp bài | `VIEW_MY_SUBMISSIONS` | `/student/submissions` | `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK` |
| | Lưu chiểu số | `VIEW_MY_ARCHIVE` | `/student/submissions?tab=archive` | `SUBMIT_PRE_DEFENSE_ARCHIVE`, `SUBMIT_FINAL_ARCHIVE` |
| | Điểm đồ án của tôi | `VIEW_MY_GRADES` | `/student/grades` | — |
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
| | Phân quyền & Nhóm quyền | `VIEW_PERMISSIONS` | `/admin/permissions` | `PERMISSION_GROUP_MANAGE` |
| | Bản tin Portal | `VIEW_ANNOUNCEMENTS` | `/admin/announcements` | `PUBLIC_ANNOUNCEMENT_MANAGE` |
| | Biểu mẫu & CMS Portal | `VIEW_PORTAL_CONTENT` | `/admin/portal` | `PORTAL_CONTENT_MANAGE` |
| | Gửi thông báo người dùng | `VIEW_NOTIFICATIONS` | `/admin/notifications` | `NOTIFICATION_MANAGE` |

### 5.2. Quyết Định Kỹ Thuật Chi Tiết (Architectural Decisions & Builder Calls)
1. **Cơ chế cấp quyền Sinh viên qua Nhóm quyền Hệ thống Bất biến (`SYSTEM_STUDENT_BASE`)**:
   - CSDL định nghĩa nhóm quyền hệ thống `SYSTEM_STUDENT_BASE` (`isSystem: true`) chứa đầy đủ các capability cơ sở của sinh viên: `VIEW_MY_REGISTRATION`, `VIEW_MY_SUBMISSIONS`, `VIEW_MY_ARCHIVE`, `VIEW_MY_GRADES`, `REGISTER_TOPIC`, `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK`, `SUBMIT_PRE_DEFENSE_ARCHIVE`, `SUBMIT_FINAL_ARCHIVE`.
   - Nhóm quyền này được cấp tự động khi khởi tạo/provisioning tài khoản sinh viên (seed/import Excel/user creation).
   - Tuyệt đối cấm Admin sửa, gỡ bỏ hoặc xóa nhóm `SYSTEM_STUDENT_BASE` trên giao diện phân quyền.
   - Backend kiểm tra 100% bằng capability, kết hợp domain guard: *'Người dùng có hồ sơ sinh viên hợp lệ và có enrollment ACTIVE trong học kỳ'*. Tuyệt đối không suy diễn quyền dựa trên `role === 'STUDENT'`.
2. **Loại bỏ hoàn toàn logic rẽ nhánh role trong Registry**:
   - Tách bạch `VIEW_MY_REGISTRATION` (`/student/topics`) và `VIEW_MY_TOPICS` (`/lecturer/topics`).
   - Tách bạch `VIEW_MY_GRADES` (`/student/grades`) và `VIEW_RESULT_PUBLICATIONS` (`/admin/grading?tab=publish`).
   - `NAVIGATION_REGISTRY` hoàn toàn là hằng số tĩnh, không dùng hàm kiểm tra role.
3. **Cấu trúc Layout thống nhất (Single Unified AppLayout)**:
   - Hợp nhất `AdminLayout`, `LecturerLayout`, `StudentLayout` thành một component `AppLayout` duy nhất.
   - Header sẽ hiển thị tên người dùng và vai trò hồ sơ chính; widget `QuotaMeter` chỉ hiển thị nếu người dùng có quyền `TOPIC_CREATE` hoặc `MENTOR_REQUEST_REVIEW`.
4. **Bảo vệ và đồng bộ Tab qua Query Parameters (`?tab=...`)**:
   - Các component trang lớn (`GradingDefensePage`, `ProgressTrackingPage`, `SubmissionPage`, `ProjectPeriodPage`) sử dụng hook `useSearchParams` để đồng bộ active tab theo URL.
   - Nội dung từng tab có guard kiểm tra capability tương ứng; nếu người dùng truy cập tab không có quyền, tự động fallback về tab đầu tiên được phép xem.
5. **Nguyên tắc hiển thị nút hành động (In-page CTA vs `VIEW_*`)**:
   - `VIEW_*` CHỈ được dùng để quyết định hiển thị mục menu trên sidebar và route truy cập trang.
   - Các nút hành động nghiệp vụ (CTA buttons như: *'Khóa bảng điểm'*, *'Ký duyệt checkpoint'*, *'Phê duyệt đề cương'*, *'Ban hành quyết định'*,...) trên từng dòng hồ sơ/bảng dữ liệu **BẮT BUỘC phải dựa trên mảng `allowedActions[]` do backend tính toán và trả về theo từng bản ghi**.
   - Tránh tuyệt đối lỗi: Người dùng có quyền `RESULT_LOCK` vẫn thấy nút khóa điểm trên hồ sơ không thuộc hội đồng của mình hoặc chưa đủ 3 phiếu chấm.
6. **Bảo vệ chống leo thang đặc quyền (Privilege Escalation Guards) cho `PERMISSION_GROUP_MANAGE`**:
   - **Cấm tự cấp quyền (Anti-Self-Escalation)**: Người thực hiện không được phép tự gán thêm quyền hoặc gán nhóm quyền mới cho chính tài khoản của mình (`targetUserId !== req.user.id`).
   - **Bảo vệ nhóm hệ thống**: Cấm chỉnh sửa, đổi tên hoặc xóa các nhóm hệ thống bất biến (như `SYSTEM_STUDENT_BASE`).
   - **Giới hạn phạm vi ủy quyền (Delegation Boundary)**: Quản trị viên chỉ được phép gán cho người khác các capability nằm trong tập quyền mà bản thân họ đang sở hữu hoặc thuộc phạm vi ủy quyền rõ ràng.
   - **Tính bất biến & Audit**: Mọi thay đổi nhóm/quyền bắt buộc phải có Idempotency-Key, ghi nhận Audit Log đầy đủ (actor, target, old permissions, new permissions) và kích hoạt tăng `permissionVersion` của người dùng mục tiêu.
7. **Loại bỏ khái niệm `LEGACY_REVIEW_MANAGE`**:
   - Đổi tên quyền giám sát thành `PROJECT_OVERSIGHT_MANAGE`, phục vụ thuần túy chức năng rà soát tiến độ và kiểm toán học vụ, loại bỏ hoàn toàn ngữ nghĩa "legacy bypass".

---

## 6. Mô Hình Bảo Vệ API Backend (3-Layer Defense-in-Depth)

Mọi yêu cầu mutation đều phải đi qua pipeline kiểm soát chặt chẽ:

```
[Request]
   │
   ▼
┌────────────────────────────────────────────────────────┐
│ 1. Capability Check (Token & Database Permissions)     │
│    - Kiểm tra req.user.permissions chứa Action Code?   │
│    - VÍ DỤ: 'RESULT_LOCK'                              │
└────────────────────────────────────────────────────────┘
   │
   ▼ Pass
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

### Bảng Ánh Xạ Chuyển Đổi Route Backend (Tách Khỏi `authorizeRole`)

| Route Endpoint | Phương thức | Middleware cũ | Middleware mới (Capability) | Domain Guard bổ sung |
|---|---|---|---|---|
| `/api/registrations/register` | `POST` | `authorize('STUDENT')` | `authorizePermission('REGISTER_TOPIC')` | Kiểm tra sinh viên có enrollment ACTIVE |
| `/api/registrations/:id/status` | `PATCH` | `authorize('LECTURER')` | `authorizePermission('MENTOR_REQUEST_REVIEW')` | Ràng buộc `topic.mentorId === req.user.id` |
| `/api/evaluations/councils/:id/lock-scores` | `POST` | `authorizePermission('RESULT_LOCK')` | `authorizePermission('RESULT_LOCK')` | Ràng buộc Hội đồng, 3 phiếu chấm cá nhân |
| `/api/semesters/:id/decisions` | `POST` | `authorizePermission('PROJECT_ASSIGNMENT_PUBLISH')` | `authorizePermission('PROJECT_ASSIGNMENT_PUBLISH')` | Ràng buộc Viện trưởng/Khoa, Idempotency-Key |
| `/api/evaluations/my-grades` | `GET` | `authorize('STUDENT')` | `authorizePermission('VIEW_MY_GRADES')` | Ràng buộc `registration.studentId === req.user.id` và chỉ trả snapshot đã công bố chính thức |
| `/api/dashboards/overview` | `GET` | Tách lẻ 3 route | `authenticate` (Dùng chung) | Widget lọc theo tập `req.user.permissions` |

### 6.1. Rào Chắn Chống Leo Thang Quyền Cho `PERMISSION_GROUP_MANAGE` (Anti-Privilege Escalation)
Endpoint quản trị phân quyền (`/api/users/:id/permission-groups`, `/api/permissions/groups`) là nơi có nguy cơ leo thang đặc quyền cao nhất, do đó bắt buộc phải tuân thủ các quy tắc bảo mật sau:
1. **Cấm tự nâng quyền (Anti-Self-Escalation)**: Người dùng có quyền `PERMISSION_GROUP_MANAGE` không được phép tự gán thêm quyền hoặc đổi nhóm quyền cho chính mình (`targetUserId !== req.user.id`).
2. **Khóa nhóm hệ thống (System Group Protection)**: Nhóm `SYSTEM_STUDENT_BASE` và các nhóm hệ thống mang cờ `isSystem: true` không được phép chỉnh sửa danh sách quyền, không được đổi tên hoặc xóa qua API/UI.
3. **Giới hạn phạm vi ủy quyền (Delegation Boundary)**: Người gán chỉ được phép cấp cho tài khoản khác những quyền nằm trong tập quyền mà bản thân họ đang sở hữu (hoặc thuộc danh mục quyền quản trị được phân quyền rõ ràng).
4. **Bắt buộc Idempotency, Audit Log & Tăng Version**: Mọi thao tác gán/thu hồi quyền bắt buộc phải truyền `Idempotency-Key`, ghi nhật ký `AuditLog` chi tiết (actor, target, old permissions, new permissions) và kích hoạt tăng `permissionVersion` của người dùng mục tiêu để vô hiệu hóa token cũ.

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

### 7.3. Đồng Bộ Quyền Tức Thì Phía Client (Client-Driven Session Sync & Permission Versioning)
Hệ thống không sử dụng WebSocket/SSE để tránh tăng độ phức tạp vận hành mà áp dụng mô hình đồng bộ hướng sự kiện vòng đời (Client-lifecycle Event-driven Sync):
1. **Quản lý phiên bản quyền (Permission Versioning)**:
   - Backend theo dõi `permissionVersion: Int` cho mỗi tài khoản (tăng `+1` mỗi khi Admin gán/hủy nhóm quyền hoặc cập nhật bảng quyền).
   - JWT payload hoặc header phản hồi API kèm theo `permissionVersion`.
   - Mỗi request mutation hoặc đọc dữ liệu nhạy cảm được backend kiểm tra quyền thực tế tức thì (fail-closed); nếu phát hiện client gửi token có version cũ, backend trả mã lỗi `PERMISSION_VERSION_STALE` kèm header cập nhật.
2. **Các thời điểm Client kích hoạt Refetch (`authService.getMe()` / Refresh Token)**:
   - Khi đăng nhập thành công hoặc refresh token.
   - Khi chuyển route điều hướng trong ứng dụng.
   - Khi quay lại tab trình duyệt (`window.focus` hoặc sự kiện `visibilitychange` khi tab chuyển từ ẩn sang hiện).
   - Ngay sau khi Admin thực hiện thao tác lưu phân quyền trên modal.
   - Khi API trả về lỗi `PERMISSION_VERSION_STALE`.
3. **Đồng bộ đa Tab không cần Server Push (BroadcastChannel)**:
   - Khởi tạo kênh `const authChannel = new BroadcastChannel('dacn_auth_sync');`.
   - Khi Admin cập nhật phân quyền tại Tab 1, client phát thông điệp `authChannel.postMessage({ type: 'PERMISSIONS_UPDATED', userId })`.
   - Các tab khác trong cùng trình duyệt nhận thông điệp sẽ tự động gọi `authService.getMe()`, cập nhật `effectivePermissions` trong `authStore` và render lại Navigation Registry ngay lập tức trong vài mili-giây mà không cần F5 hay WebSocket.
4. **Phân biệt rành mạch giữa 401, 403 và Stale Version (Không logout hàng loạt)**:
   - **401 Unauthorized** hoặc `ACCOUNT_DISABLED`: Token hết hạn / tài khoản bị khóa -> Xóa sạch session, reset `authStore` và điều hướng về trang đăng nhập.
   - **403 Forbidden**: Lỗi nghiệp vụ domain (xung đột lợi ích COI, ngoài thẩm quyền hội đồng, sai trạng thái quy trình, quá hạn chót) -> **GIỮ NGUYÊN session đăng nhập**, hiển thị thông báo lỗi/toast giải thích rõ lý do từ chối cho người dùng.
   - **PERMISSION_VERSION_STALE**: Quyền vừa bị quản trị viên thay đổi -> Client tự động gọi `authService.getMe()`, cập nhật `authStore` và điều hướng an toàn về trang phù hợp hoặc thử lại thao tác.
5. **Chính sách Cache**:
   - Cho phép cache client cục bộ tối đa 1–3 phút để tối ưu hiệu năng gọi API `getMe()`, nhưng **tuyệt đối không dùng cache client làm nguồn xác thực quyền học thuật**. Mọi quyết định tối hậu thuộc về backend.

---

## 8. Các Phần Dành Cho Builder Tự Quyết (What's Left to Builder)
1. Thống kê chi tiết danh sách icon Google Material Symbols phù hợp nhất cho từng menu con trong 7 khối.
2. Thiết kế logic chuyển hướng tại `/dashboard` (tự động load widget thống kê tương ứng với quyền cao nhất của người dùng).
3. Viết script seed / migration cập nhật bảng `Permission` và `PermissionGroup` trong CSDL Supabase PostgreSQL.
4. Cập nhật unit test `rbacUiContracts.test.js` và `platformAuthorization.routes.test.js` để kiểm thử toàn diện mô hình mới.

