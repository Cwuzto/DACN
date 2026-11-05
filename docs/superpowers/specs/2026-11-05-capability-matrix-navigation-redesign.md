# Thiết Kế Kỹ Thuật: Ma Trận Phân Quyền Hai Tầng (2-Tier Capability Matrix) & Điều Hướng Động 7 Khối Nghiệp Vụ

- **Tài liệu**: `docs/superpowers/specs/2026-11-05-capability-matrix-navigation-redesign.md`
- **Ngày lập**: 05/11/2026
- **Trạng thái**: Bản thảo Hoàn thiện (Final Specification) - Sẵn sàng Triển khai

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ (Intent & Why)

Hệ thống Quản lý Đồ án Tốt nghiệp (DACN) chuyển dịch hoàn toàn từ cơ chế kiểm soát truy cập cứng theo vai trò (Role-Based Access Control - RBAC) sang mô hình phân quyền hướng năng lực hai tầng (2-Tier Capability-Driven Access Control):
1. **Frontend**: Xóa bỏ hoàn toàn rào chắn bằng `allowedRoles` trên React Router. Thay thế bằng Navigation Registry cố định gồm 7 khối nghiệp vụ chuyên môn; mỗi mục menu được bảo vệ bởi đúng một quyền xem (`VIEW_*`). Người dùng có capability nào thì khối nghiệp vụ và menu con tương ứng mới xuất hiện.
2. **Backend**: Tách bạch tuyệt đối quyền xem giao diện (`VIEW_*`) khỏi quyền thao tác thay đổi dữ liệu (`*_CREATE`, `*_SUBMIT`, `*_REVIEW`, `*_APPROVE`, `*_LOCK`, `*_PUBLISH`,...). Tuyệt đối không dùng `VIEW_*` để bảo vệ API mutation.
3. **Phân định vai trò (STUDENT / LECTURER / ADMIN)**: Đóng vai trò là thuộc tính hồ sơ và ngữ cảnh nghiệp vụ (định danh liên kết hướng dẫn, sinh viên phụ trách, hội đồng), **hoàn toàn không tự động cấp quyền truy cập hay bypass học thuật**.

---

## 2. Mục Tiêu, Phi Mục Tiêu & Chống Mục Tiêu (Goals, Non-Goals, Anti-Goals)

### Goals
1. **Mô hình phân quyền 2 tầng**:
   - *Tầng hiển thị*: Mỗi mục menu tương ứng duy nhất 1 quyền xem (`VIEW_*`).
   - *Tầng thao tác*: Mọi mutation được bảo vệ độc lập bởi action capability cụ thể.
2. **Navigation Registry cố định 7 khối đầy đủ 26 mục**: Không chứa code logic rẽ nhánh role; client lọc registry qua `effectivePermissions`.
3. **Phòng thủ 3 lớp (Defense-in-Depth)** trên toàn bộ API backend:
   - *Lớp 1 (Capability)*: Kiểm tra action capability từ CSDL / Cache (không tin cậy JWT thô).
   - *Lớp 2 (Domain Scope)*: Kiểm tra ownership, gán GVHD, thành viên hội đồng.
   - *Lớp 3 (Academic Invariants)*: Kiểm tra trạng thái máy quy trình, đủ 3 phiếu chấm, hạn chót, không xung đột lợi ích (COI).
4. **Bảo tồn URL hiện hữu (In-place Refactoring)**: Giữ nguyên các route path hiện tại (`/student/*`, `/lecturer/*`, `/admin/*`) bọc trong một `AppLayout` duy nhất, bảo toàn nguyên vẹn 378 unit/integration test.
5. **Cơ chế cấp quyền Sinh viên qua Nhóm Bất biến `SYSTEM_STUDENT_BASE`**: Nhóm quyền hệ thống mang cờ `isSystem: true` được cấp tự động khi khởi tạo tài khoản sinh viên, không suy diễn từ role và khóa cấm Admin chỉnh sửa.
6. **Đồng bộ phiên an toàn & Phân định Replay khi Stale**:
   - Chỉ logout khi token 401 hoặc tài khoản bị vô hiệu hóa (`ACCOUNT_DISABLED`). Giữ nguyên session khi gặp lỗi domain 403.
   - Xử lý mã `409 Conflict` (`PERMISSION_VERSION_STALE`): Chỉ tự động replay các request `GET` hoặc mutation có `Idempotency-Key`; các mutation không có Idempotency-Key bắt buộc yêu cầu người dùng xác nhận gửi lại.
   - Đồng bộ đa tab qua `BroadcastChannel` mà không cần WebSocket/SSE.
7. **Tách biệt quyền sở hữu và quyền ủy quyền**: Người có capability học thuật không được tự ý cấp capability đó cho người khác; Admin kỹ thuật (`PERMISSION_GROUP_MANAGE`) không được phép gán nhóm học thuật (`VIEN_TRUONG`, `GVHD`).

### Non-Goals
1. Không tái cấu trúc URL thành đường dẫn phẳng `/manage/...` trong đợt này nhằm loại trừ nguy cơ hồi quy test suite.
2. Không mở nhóm quyền học thuật cơ bản của sinh viên cho quản trị viên tùy biến trên giao diện.

### Anti-Goals
1. **Tuyệt đối cấm dùng `VIEW_*` để bảo vệ API mutation**: Quyền xem menu không bao giờ cho phép thực thi hành động nghiệp vụ.
2. **Không có đặc quyền Admin học thuật mặc định (Zero-Trust Admin)**: Tài khoản `ADMIN` không thể can thiệp điểm số hay quy trình học thuật nếu không có capability và quyết định phân công hội đồng.
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

| STT | Nhóm nghiệp vụ (Group) | Tên Menu hiển thị (Label) | Quyền xem duy nhất (`VIEW_*`) | Đường dẫn Route hiện tại | Quyền thao tác tách riêng (Action Capabilities) |
|---|---|---|---|---|---|
| 1 | **Hồ sơ của tôi** | Đề tài đăng ký | `VIEW_MY_REGISTRATION` | `/student/topics` | `REGISTER_TOPIC`, `RENAME_TOPIC` |
| 2 | | Đề tài phụ trách | `VIEW_MY_TOPICS` | `/lecturer/topics` | `TOPIC_CREATE`, `TOPIC_UPDATE_OWN` |
| 3 | | Hồ sơ & Nộp bài | `VIEW_MY_SUBMISSIONS` | `/student/submissions` | `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK` |
| 4 | | Lưu chiểu số | `VIEW_MY_ARCHIVE` | `/student/submissions?tab=archive` | `SUBMIT_PRE_DEFENSE_ARCHIVE`, `SUBMIT_FINAL_ARCHIVE` |
| 5 | | Điểm đồ án của tôi | `VIEW_MY_GRADES` | `/student/grades` | — (Chỉ đọc snapshot công bố của chính mình) |
| 6 | **Hướng dẫn & tiến độ** | Sinh viên hướng dẫn | `VIEW_MENTORED_STUDENTS` | `/lecturer/approvals` | `MENTOR_REQUEST_REVIEW` |
| 7 | | Checkpoint tiến độ | `VIEW_CHECKPOINTS` | `/lecturer/progress` | `CHECKPOINT_ISSUE`, `CHECKPOINT_SIGN`, `SIGNATURE_APPEAL_REVIEW` |
| 8 | | Đánh giá BM04 | `VIEW_BM04_EVALUATIONS` | `/lecturer/progress?tab=bm04` | `BM04_SUBMIT`, `BM04_REVIEW` |
| 9 | **Thẩm định & quyết định**| Thẩm định BM01 | `VIEW_OUTLINE_REVIEWS` | `/lecturer/approvals?tab=bm01` | `OUTLINE_REVIEW`, `OUTLINE_APPROVE` |
| 10 | | Duyệt đơn BM02 | `VIEW_BM02_REVIEWS` | `/lecturer/institute` | `BM02_REVIEW` |
| 11 | | Quyết định giao đề tài | `VIEW_ASSIGNMENT_DECISIONS` | `/lecturer/institute?tab=decisions` | `PROJECT_ASSIGNMENT_PUBLISH`, `DECISION_AMENDMENT_SIGN` |
| 12 | **Hội đồng & bảo vệ** | Phân công Hội đồng | `VIEW_COUNCIL_ASSIGNMENTS` | `/admin/councils` | `OUTLINE_COUNCIL_MANAGE`, `DEFENSE_COUNCIL_MANAGE` |
| 13 | | Phiếu chấm bảo vệ | `VIEW_DEFENSE_GRADING` | `/lecturer/grading` | `DEFENSE_SCORE_SUBMIT` |
| 14 | | Trung tâm chấm & Khóa sổ | `VIEW_DEFENSE_LOCK_LEDGER` | `/admin/grading` | `RESULT_LOCK`, `DEFENSE_RESULT_APPROVE` |
| 15 | **Kết quả & công bố** | Phê duyệt kết quả | `VIEW_DEFENSE_RESULT_APPROVALS`| `/admin/grading?tab=approvals` | `DEFENSE_RESULT_APPROVE` |
| 16 | | Công bố kết quả | `VIEW_RESULT_PUBLICATIONS` | `/admin/grading?tab=publish` | `RESULT_PUBLICATION_PUBLISH` |
| 17 | | Tiêu chí chấm (Rubric) | `VIEW_RUBRIC_CONFIG` | `/admin/rubric-management` | `RUBRIC_MANAGE` |
| 18 | **Quản trị học vụ** | Đợt đồ án & Học kỳ | `VIEW_PROJECT_PERIODS` | `/admin/project-periods` | `SEMESTER_MANAGE` |
| 19 | | Gán môn đồ án (Enrollment)| `VIEW_PROJECT_ENROLLMENTS` | `/admin/project-enrollments` | `ENROLLMENT_MANAGE`, `PROJECT_CATALOG_MANAGE` |
| 20 | | Quản lý đề tài chung | `VIEW_ALL_TOPICS` | `/admin/topics` | `TOPIC_REVIEW` |
| 21 | | Giám sát tiến độ & rà soát | `VIEW_PROJECT_OVERSIGHT` | `/admin/oversight` | `PROJECT_OVERSIGHT_MANAGE`, `REPORT_VIEW` |
| 22 | **Quản trị hệ thống** | Quản lý người dùng | `VIEW_USERS` | `/admin/users` | `USER_MANAGE`, `USER_IMPORT` |
| 23 | | Phân quyền kỹ thuật & Nhóm | `VIEW_PERMISSIONS` | `/admin/permissions` | `PERMISSION_GROUP_MANAGE` (Chỉ nhóm kỹ thuật) |
| 24 | | Bản tin Portal | `VIEW_ANNOUNCEMENTS` | `/admin/announcements` | `PUBLIC_ANNOUNCEMENT_MANAGE` |
| 25 | | Biểu mẫu & CMS Portal | `VIEW_PORTAL_CONTENT` | `/admin/portal` | `PORTAL_CONTENT_MANAGE` |
| 26 | | Gửi thông báo người dùng | `VIEW_NOTIFICATIONS` | `/admin/notifications` | `NOTIFICATION_MANAGE` |

---

### 5.2. Quyết Định Kỹ Thuật Chi Tiết (Architectural Decisions)

1. **Nhóm quyền hệ thống bất biến `SYSTEM_STUDENT_BASE`**:
   - CSDL định nghĩa nhóm quyền hệ thống `SYSTEM_STUDENT_BASE` (`isSystem: true`) chứa đầy đủ 14 capability cơ sở của sinh viên: `VIEW_MY_REGISTRATION`, `VIEW_MY_SUBMISSIONS`, `VIEW_MY_ARCHIVE`, `VIEW_MY_GRADES`, `REGISTER_TOPIC`, `RENAME_TOPIC`, `REGISTRATION_CANCEL`, `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK`, `CHECKPOINT_SIGN`, `SIGNATURE_APPEAL_SUBMIT`, `SUBMIT_PRE_DEFENSE_ARCHIVE`, `SUBMIT_FINAL_ARCHIVE`.
   - Nhóm quyền này được cấp tự động khi khởi tạo/import tài khoản sinh viên.
   - Bị khóa bất biến: cấm chỉnh sửa, đổi tên, thu hồi hoặc xóa trên UI/API.
   - Backend kiểm tra 100% bằng capability, kết hợp domain guard:
     - *Với các mutation đăng ký/nộp bài đợt hiện hành (`REGISTER_TOPIC`, `SUBMIT_BM01`, `SUBMIT_BM02`, `SUBMIT_TASK`, `RENAME_TOPIC`, `REGISTRATION_CANCEL`)*: Bắt buộc sinh viên có enrollment `ACTIVE` trong học kỳ hiện tại.
     - *Với các truy vấn tra cứu lịch sử (`VIEW_MY_GRADES`, `VIEW_MY_ARCHIVE`)*: Không đòi hỏi enrollment hiện tại phải active, cho phép sinh viên đã tốt nghiệp tra cứu kết quả bảo vệ cũ và hồ sơ lưu chiểu hợp lệ của chính mình (`registration.studentId === req.user.id`).
     - Tuyệt đối không suy diễn quyền dựa trên `role === 'STUDENT'`.

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
   - Mọi nút bấm hành động nghiệp vụ trên từng hồ sơ/vòng đời đề tài (Khóa điểm, Ký duyệt checkpoint, Duyệt đề cương, Ban hành quyết định) **BẮT BUỘC phải căn cứ vào mảng `allowedActions[]` do backend tính toán qua `workflowActionService.js` và trả về theo từng bản ghi**.
   - Các thực thể không thuộc vòng đời đề tài (User, Semester, Rubric, Portal Content): hiển thị nút thao tác dựa trên action capability tương ứng (`USER_MANAGE`, `SEMESTER_MANAGE`, `RUBRIC_MANAGE`) trong `effectivePermissions`.

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
   ▼ Pass (Nếu Version cũ -> Trả 409 PERMISSION_VERSION_STALE)
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
| `/api/registrations/register` | `POST` | `authorize('STUDENT')` | `authorizePermission('REGISTER_TOPIC')` | Kiểm tra sinh viên có enrollment ACTIVE trong kỳ |
| `/api/registrations/:id/status` | `PATCH` | `authorize('LECTURER')` | `authorizePermission('MENTOR_REQUEST_REVIEW')` | Ràng buộc `topic.mentorId === req.user.id` |
| `/api/evaluations/councils/:id/lock-scores` | `POST` | `authorizePermission('RESULT_LOCK')` | `authorizePermission('RESULT_LOCK')` | Ràng buộc Hội đồng, 3 phiếu chấm cá nhân |
| `/api/semesters/:id/decisions` | `POST` | `authorizePermission('PROJECT_ASSIGNMENT_PUBLISH')` | `authorizePermission('PROJECT_ASSIGNMENT_PUBLISH')` | Ràng buộc Lãnh đạo Khoa/Viện, Idempotency-Key |
| `/api/evaluations/my-grades` | `GET` | `authorize('STUDENT')` | `authorizePermission('VIEW_MY_GRADES')` | Ràng buộc `registration.studentId === req.user.id` và chỉ trả snapshot đã công bố chính thức |
| `/api/dashboards/overview` | `GET` | Tách lẻ 3 route | `authenticate` (Dùng chung) | Widget lọc theo tập `req.user.permissions` |

---

### 6.1. Rào Chắn Chống Leo Thang Quyền & Tách Biệt Quyền Ủy Quyền (Delegation Boundary)

1. **Tách biệt Quyền Quản trị Kỹ thuật, Lãnh đạo Học vụ và Phân công Hướng dẫn**:
   - **Quản trị viên kỹ thuật (`PERMISSION_GROUP_MANAGE`)**: Chỉ có thẩm quyền tạo tài khoản, khóa/mở tài khoản, và quản lý các nhóm kỹ thuật (`QUAN_TRI_VIEN`). **Tuyệt đối không được phép tự gán các nhóm chứa capability học thuật như `VIEN_TRUONG` hoặc `GVHD`** trên giao diện `/admin/permissions` để ngăn chặn tạo quyền học thuật gián tiếp.
   - **Chức danh tổ chức `VIEN_TRUONG`**: Không phải là nhóm quyền tự do gán từ UI dropdown. Việc bổ nhiệm Viện trưởng bắt nguồn từ quyết định nhân sự/hồ sơ tổ chức được audit độc lập hoặc seed hệ thống cấp trên.
   - **Lãnh đạo học vụ / Viện trưởng (`PERMISSION_ASSIGN_ACADEMIC`)**: Thao tác ủy quyền học thuật được tổ chức thành một tab riêng biệt **"Ủy quyền chuyên môn" tại `/lecturer/institute?tab=delegations`**, chỉ người dùng có `PERMISSION_ASSIGN_ACADEMIC` và thuộc đúng viện/khoa mới được phép truy cập.
   - **Quy chuẩn Tab "Ủy quyền chuyên môn"**: Bắt buộc phải có các trường:
     - Người được ủy quyền (`delegateeUserId`) — phải là giảng viên thuộc cùng viện/khoa (`department`).
     - Capability chuyên môn được ủy quyền — bắt buộc thuộc danh mục `grantablePermissionCodes` (`OUTLINE_REVIEW`, `BM02_REVIEW`, `DEFENSE_SCORE_SUBMIT`, `DEFENSE_RESULT_APPROVE`).
     - Phạm vi ủy quyền: Viện/khoa hoặc đợt đồ án/học kỳ cụ thể.
     - Thời hạn hiệu lực: Ngày bắt đầu (`effectiveFrom`) và ngày hết hạn (`effectiveTo`).
     - Lý do ủy quyền (`reason`) và `Idempotency-Key`.
     - Cấm tự ủy quyền cho chính mình (`delegateeUserId !== req.user.id`), cấm ủy quyền vượt phạm vi đơn vị, và cấm ủy quyền lại nếu không có quyền tái ủy quyền riêng.
   - **Bản chất của GVHD**: Hướng dẫn đề tài chủ yếu là quan hệ phân công trên từng `TopicRegistration`. Capability học thuật chỉ cho phép giảng viên vào chức năng màn hình; còn quan hệ `topic.mentorId === req.user.id` mới là điều kiện quyết định hồ sơ nào họ được phép thao tác.
2. **Bảo vệ nhóm hệ thống**:
   - Nhóm `SYSTEM_STUDENT_BASE` mang cờ `isSystem: true` không được phép chỉnh sửa danh sách quyền, không được đổi tên hoặc xóa qua API/UI.
3. **Server-Authoritative Permission Resolution**:
   - JWT chỉ mang `userId`, `role` và `permissionVersion`, **không mang quyền tối hậu**.
   - Server nạp quyền từ CSDL hoặc in-memory cache theo `userId + permissionVersion`. Khi phân quyền của User A thay đổi, `permissionVersion` của A tăng lên `+1`.
4. **Quy tắc Replay an toàn khi gặp `PERMISSION_VERSION_STALE`**:
   - Khi một request mutation hoặc đọc nhạy cảm mang token có version cũ, backend trả về HTTP `409 Conflict` với body `{ error: 'PERMISSION_VERSION_STALE', message: 'Phiên bản quyền đã được cập nhật.' }`.
   - Endpoint `GET /api/auth/me` bỏ qua kiểm tra stale version (tránh deadlock) nhưng **vẫn bắt buộc kiểm tra token hợp lệ và tài khoản chưa bị vô hiệu hóa** (`isActive === true`), nạp quyền mới nhất từ DB và trả về Access Token mới `{ success: true, data: user, token: refreshedAccessToken }`.
   - Axios interceptor ở client:
     - Với request `GET`: Tự động gọi `authService.getMe()`, cập nhật `token`, `effectivePermissions`, `permissionVersion` và retry (thử lại) request gốc một lần duy nhất.
     - Với mutation (`POST`, `PUT`, `PATCH`, `DELETE`): **CHỈ tự động retry khi request gốc có header `Idempotency-Key`**. Nếu request không có `Idempotency-Key`, client chỉ refetch session rồi hiển thị thông báo yêu cầu người dùng chủ động nhấn xác nhận gửi lại nhằm ngăn chặn duplicate mutation.
5. **Tính bất biến & Audit**:
   - Mọi thao tác gán/thu hồi quyền bắt buộc phải có `Idempotency-Key`, ghi nhật ký `AuditLog` chi tiết (actor, target, old permissions, new permissions).

---

## 7. Kiến Trúc Frontend Navigation Registry & Session Sync

### 7.1. Cấu Trúc Navigation Registry Đầy Đủ 26 Mục (`frontend/src/config/navigationRegistry.js`)

Registry là hằng số cố định, không tạo động từ chuỗi server và không chứa logic rẽ nhánh role:

```javascript
export const NAVIGATION_REGISTRY = [
  // KHỐI 1: HỒ SƠ CỦA TÔI
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
    key: 'my-submissions',
    label: 'Hồ sơ & Nộp bài',
    icon: 'cloud_upload',
    group: 'Hồ sơ của tôi',
    requiredPermission: 'VIEW_MY_SUBMISSIONS',
    route: '/student/submissions',
  },
  {
    key: 'my-archive',
    label: 'Lưu chiểu số',
    icon: 'inventory_2',
    group: 'Hồ sơ của tôi',
    requiredPermission: 'VIEW_MY_ARCHIVE',
    route: '/student/submissions?tab=archive',
  },
  {
    key: 'my-grades',
    label: 'Điểm đồ án của tôi',
    icon: 'workspace_premium',
    group: 'Hồ sơ của tôi',
    requiredPermission: 'VIEW_MY_GRADES',
    route: '/student/grades',
  },

  // KHỐI 2: HƯỚNG DẪN & TIẾN ĐỘ
  {
    key: 'mentored-students',
    label: 'Sinh viên hướng dẫn',
    icon: 'school',
    group: 'Hướng dẫn & tiến độ',
    requiredPermission: 'VIEW_MENTORED_STUDENTS',
    route: '/lecturer/approvals',
  },
  {
    key: 'progress-checkpoints',
    label: 'Checkpoint tiến độ',
    icon: 'fact_check',
    group: 'Hướng dẫn & tiến độ',
    requiredPermission: 'VIEW_CHECKPOINTS',
    route: '/lecturer/progress',
  },
  {
    key: 'bm04-evaluations',
    label: 'Đánh giá BM04',
    icon: 'assignment_turned_in',
    group: 'Hướng dẫn & tiến độ',
    requiredPermission: 'VIEW_BM04_EVALUATIONS',
    route: '/lecturer/progress?tab=bm04',
  },

  // KHỐI 3: THẨM ĐỊNH & QUYẾT ĐỊNH
  {
    key: 'outline-reviews',
    label: 'Thẩm định BM01',
    icon: 'rate_review',
    group: 'Thẩm định & quyết định',
    requiredPermission: 'VIEW_OUTLINE_REVIEWS',
    route: '/lecturer/approvals?tab=bm01',
  },
  {
    key: 'bm02-reviews',
    label: 'Duyệt đơn BM02',
    icon: 'verified',
    group: 'Thẩm định & quyết định',
    requiredPermission: 'VIEW_BM02_REVIEWS',
    route: '/lecturer/institute',
  },
  {
    key: 'assignment-decisions',
    label: 'Quyết định giao đề tài',
    icon: 'gavel',
    group: 'Thẩm định & quyết định',
    requiredPermission: 'VIEW_ASSIGNMENT_DECISIONS',
    route: '/lecturer/institute?tab=decisions',
  },

  // KHỐI 4: HỘI ĐỒNG & BẢO VỆ
  {
    key: 'council-assignments',
    label: 'Phân công Hội đồng',
    icon: 'groups',
    group: 'Hội đồng & bảo vệ',
    requiredPermission: 'VIEW_COUNCIL_ASSIGNMENTS',
    route: '/admin/councils',
  },
  {
    key: 'defense-grading',
    label: 'Phiếu chấm bảo vệ',
    icon: 'edit_note',
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

  // KHỐI 5: KẾT QUẢ & CÔNG BỐ
  {
    key: 'defense-result-approvals',
    label: 'Phê duyệt kết quả',
    icon: 'approval',
    group: 'Kết quả & công bố',
    requiredPermission: 'VIEW_DEFENSE_RESULT_APPROVALS',
    route: '/admin/grading?tab=approvals',
  },
  {
    key: 'result-publications',
    label: 'Công bố kết quả',
    icon: 'campaign',
    group: 'Kết quả & công bố',
    requiredPermission: 'VIEW_RESULT_PUBLICATIONS',
    route: '/admin/grading?tab=publish',
  },
  {
    key: 'rubric-config',
    label: 'Tiêu chí chấm (Rubric)',
    icon: 'rule',
    group: 'Kết quả & công bố',
    requiredPermission: 'VIEW_RUBRIC_CONFIG',
    route: '/admin/rubric-management',
  },

  // KHỐI 6: QUẢN TRỊ HỌC VỤ
  {
    key: 'project-periods',
    label: 'Đợt đồ án & Học kỳ',
    icon: 'calendar_month',
    group: 'Quản trị học vụ',
    requiredPermission: 'VIEW_PROJECT_PERIODS',
    route: '/admin/project-periods',
  },
  {
    key: 'project-enrollments',
    label: 'Gán môn đồ án (Enrollment)',
    icon: 'playlist_add_check',
    group: 'Quản trị học vụ',
    requiredPermission: 'VIEW_PROJECT_ENROLLMENTS',
    route: '/admin/project-enrollments',
  },
  {
    key: 'all-topics',
    label: 'Quản lý đề tài chung',
    icon: 'list_alt',
    group: 'Quản trị học vụ',
    requiredPermission: 'VIEW_ALL_TOPICS',
    route: '/admin/topics',
  },
  {
    key: 'project-oversight',
    label: 'Giám sát tiến độ & rà soát',
    icon: 'policy',
    group: 'Quản trị học vụ',
    requiredPermission: 'VIEW_PROJECT_OVERSIGHT',
    route: '/admin/oversight',
  },

  // KHỐI 7: QUẢN TRỊ HỆ THỐNG
  {
    key: 'users',
    label: 'Quản lý người dùng',
    icon: 'group',
    group: 'Quản trị hệ thống',
    requiredPermission: 'VIEW_USERS',
    route: '/admin/users',
  },
  {
    key: 'permissions',
    label: 'Phân quyền kỹ thuật & Nhóm',
    icon: 'shield_lock',
    group: 'Quản trị hệ thống',
    requiredPermission: 'VIEW_PERMISSIONS',
    route: '/admin/permissions',
  },
  {
    key: 'announcements',
    label: 'Bản tin Portal',
    icon: 'feed',
    group: 'Quản trị hệ thống',
    requiredPermission: 'VIEW_ANNOUNCEMENTS',
    route: '/admin/announcements',
  },
  {
    key: 'portal-content',
    label: 'Biểu mẫu & CMS Portal',
    icon: 'file_copy',
    group: 'Quản trị hệ thống',
    requiredPermission: 'VIEW_PORTAL_CONTENT',
    route: '/admin/portal',
  },
  {
    key: 'notifications',
    label: 'Gửi thông báo người dùng',
    icon: 'notifications_active',
    group: 'Quản trị hệ thống',
    requiredPermission: 'VIEW_NOTIFICATIONS',
    route: '/admin/notifications',
  },
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
   - Ngay sau khi Admin lưu phân quyền thành công trên modal.
   - Khi API backend trả về lỗi `409 Conflict` kèm mã `PERMISSION_VERSION_STALE`.
2. **Đồng bộ đa Tab không cần Server Push (BroadcastChannel)**:
   - Khởi tạo kênh `const authChannel = new BroadcastChannel('dacn_auth_sync');`.
   - Khi Admin cập nhật phân quyền tại Tab 1, client phát thông điệp `authChannel.postMessage({ type: 'PERMISSIONS_UPDATED', userId })`.
   - Các tab khác trong cùng trình duyệt nhận thông điệp sẽ tự động gọi `authService.getMe()`, cập nhật `effectivePermissions` trong `authStore` và render lại Navigation Registry ngay lập tức trong vài mili-giây mà không cần F5 hay WebSocket.
3. **Phân biệt rành mạch giữa 401, 403 và Stale Version (Không logout hàng loạt)**:
   - **401 Unauthorized** hoặc `ACCOUNT_DISABLED`: Token hết hạn / tài khoản bị vô hiệu hóa $\to$ Xóa sạch session, reset `authStore` và điều hướng về trang đăng nhập.
   - **403 Forbidden**: Lỗi nghiệp vụ domain (xung đột lợi ích COI, ngoài thẩm quyền hội đồng, sai trạng thái quy trình, quá hạn chót) $\to$ **GIỮ NGUYÊN session đăng nhập**, hiển thị thông báo lỗi/toast giải thích rõ lý do từ chối cho người dùng. Tuyệt đối không xóa session và không logout.
   - **PERMISSION_VERSION_STALE**: Quyền vừa bị quản trị viên thay đổi $\to$ Client tự động gọi `authService.getMe()`, cập nhật `authStore` và điều hướng an toàn về trang phù hợp hoặc thử lại thao tác theo quy tắc an toàn tại Mục 6.1.4.
4. **Chính sách Cache**:
   - Cho phép cache client cục bộ tối đa 1–3 phút để tối ưu hiệu năng gọi API `getMe()`, nhưng **tuyệt đối không dùng cache client làm nguồn xác thực quyền học thuật**. Mọi quyết định tối hậu thuộc về backend.

---

## 8. Các Phần Dành Cho Builder Tự Quyết (What's Left to Builder)
1. Thiết kế logic chuyển hướng tại `/dashboard` (tự động load widget thống kê tương ứng với quyền cao nhất của người dùng).
2. Viết script seed / migration cập nhật bảng `Permission` và `PermissionGroup` trong CSDL Supabase PostgreSQL.
3. Cập nhật unit test `rbacUiContracts.test.js` và `platformAuthorization.routes.test.js` để kiểm thử toàn diện mô hình mới.
