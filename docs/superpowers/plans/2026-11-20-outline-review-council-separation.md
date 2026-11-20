# Kế Hoạch Triển Khai Phân Tách Trang Thẩm Định Đề Cương Của Hội Đồng

> **Dành cho kỹ sư AI:** KỸ NĂNG BẮT BUỘC: Sử dụng `superpowers:subagent-driven-development` để triển khai kế hoạch này theo từng tác vụ độc lập. Các bước sử dụng cú pháp hộp kiểm (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Tách biệt hoàn toàn tính năng Thẩm định đề cương của Hội đồng ra khỏi trang Duyệt nguyện vọng của Giảng viên hướng dẫn, xây dựng màn hình mới `/lecturer/outline-evaluations` chuyên nghiệp theo chuẩn `ui-ux-pro-max`, đồng thời mở rộng quyền thẩm định cho cả Chủ tịch Hội đồng và Thư ký Hội đồng.

**Kiến trúc:** Tầng Backend mở rộng điều kiện kiểm tra vai trò hội đồng cho phép Chủ tịch và Thư ký bấm duyệt; Tầng Frontend phân tách `TopicApprovalPage.jsx` thành trang thuần túy của Giảng viên hướng dẫn và tạo mới `OutlineReviewPage.jsx` làm không gian làm việc độc lập của Hội đồng xét duyệt đề cương; Tầng Định tuyến đồng bộ chính sách `outline-reviews` và tương thích ngược cho các liên kết cũ.

**Công nghệ:** React 19, Ant Design, Tailwind CSS, TanStack React Query, Node.js, Express, Prisma ORM, Node test runner & Jest.

**Tài liệu thiết kế:** [docs/superpowers/specs/2026-11-20-outline-review-council-separation-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-20-outline-review-council-separation-design.md)

## Ràng Buộc Chung

- **Quy tắc 2.1 (Mô hình TopicRegistration)**: Bám sát 1 sinh viên / 1 đề tài (`maxStudents = 1`), 1 giảng viên hướng dẫn tối đa 10 sinh viên, không dùng kiến trúc nhóm cũ.
- **Quy tắc 2.4 (Chuẩn mã hóa UTF-8)**: 100% tệp tạo mới hoặc chỉnh sửa phải lưu định dạng UTF-8 không có BOM (`[0xef, 0xbb, 0xbf]`).
- **Quy tắc 2.6 (Chuẩn nút bấm UI/UX)**: Nút bấm Ant Design `<Button>` sử dụng thuộc tính `icon={<IconComponent />}`, nhãn tiếng Việt thuần túy, tuyệt đối không chèn ký tự đồ họa thô hoặc hình vẽ cảm xúc vào nhãn nút.
- **Ngôn ngữ chuẩn mực**: Sử dụng danh xưng học thuật chính xác (Chủ tịch Hội đồng, Thư ký Hội đồng, Ủy viên Hội đồng, Giảng viên hướng dẫn), không dùng từ ngữ cơ sở dữ liệu thô hoặc tiếng Anh trong giao diện.

## Trọng Tâm Rà Soát

1. Thư ký Hội đồng bấm thẩm định đề cương phải được backend chấp thuận hợp lệ, không bị lỗi từ chối quyền.
2. Ủy viên Hội đồng chỉ có quyền xem đề cương và ý kiến, không được hiển thị nút bấm chốt kết luận.
3. Người dùng truy cập đường dẫn cũ `/lecturer/approvals?tab=bm01` phải được chuyển hướng tự động sang `/lecturer/outline-evaluations`.
4. Trang Duyệt nguyện vọng `/lecturer/approvals` không còn bất kỳ thẻ chuyển đổi nào, tập trung 100% vào việc tiếp nhận sinh viên của giảng viên hướng dẫn.
5. Kiểm thử biên dịch Vite build và bộ kiểm thử tự động của hệ thống phải đạt 100% không phát sinh lỗi.

---

### Tác Vụ 1: Phân Quyền Backend Cho Chủ Tịch Và Thư Ký Hội Đồng Thẩm Định

**Tệp thực hiện:**
- Chỉnh sửa: `backend/src/services/outlineReviewService.js`
- Chỉnh sửa: `backend/src/controllers/registrationController.js`
- Tạo mới: `backend/tests/services/outlineReviewCouncilAuth.test.js`

**Giao diện & Hợp đồng:**
- Đầu vào: `reviewOutlineRegistration({ registrationId, reviewerId, decision, feedback })`
- Quy tắc quyền: Nếu người thẩm định thuộc Hội đồng thẩm định đề cương, vai trò phải là `CHAIRMAN` hoặc `SECRETARY`. Nếu là `MEMBER` hoặc không thuộc hội đồng, báo lỗi `UNAUTHORIZED_COUNCIL_ROLE` / `ONLY_CHAIRMAN_OR_SECRETARY_CAN_APPROVE_OUTLINE`.
- Đầu vào danh sách: `GET /api/registrations?asCouncilMember=true` (hoặc mở rộng `asCouncilChairman=true` hỗ trợ cả thành viên hội đồng đề cương) trả về danh sách đề tài phân công cho hội đồng của giảng viên.

- [ ] **Bước 1: Viết bài kiểm thử thất bại**
  Tạo `backend/tests/services/outlineReviewCouncilAuth.test.js`:
  - Chủ tịch Hội đồng thẩm định đề cương -> Thành công.
  - Thư ký Hội đồng thẩm định đề cương -> Thành công.
  - Ủy viên Hội đồng thẩm định đề cương -> Bị từ chối (Lỗi quyền).
  - Giảng viên ngoài hội đồng -> Bị từ chối.
  - Truy vấn danh sách đề tài của hội đồng hỗ trợ cả Chủ tịch, Thư ký và Ủy viên.

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**
  Chạy lệnh: `npm --prefix backend test -- tests/services/outlineReviewCouncilAuth.test.js`
  Kết quả dự kiến: Thất bại do hiện tại `outlineReviewService.js` đang chặn mọi vai trò khác `CHAIRMAN`.

- [ ] **Bước 3: Cập nhật mã nguồn dịch vụ Backend**
  - Trong `backend/src/services/outlineReviewService.js`: Sửa điều kiện kiểm tra quyền thành `if (membership && !['CHAIRMAN', 'SECRETARY'].includes(membership.roleInCouncil))`.
  - Trong `backend/src/controllers/registrationController.js`: Bổ sung xử lý `asCouncilMember === 'true'` hoặc mở rộng `asCouncilChairman === 'true'` tìm kiếm theo `roleInCouncil: { in: ['CHAIRMAN', 'SECRETARY', 'MEMBER'] }` hoặc bất kỳ thành viên nào trong hội đồng.

- [ ] **Bước 4: Chạy lại kiểm thử xác nhận thành công**
  Chạy lệnh: `npm --prefix backend test -- tests/services/outlineReviewCouncilAuth.test.js`
  Kết quả dự kiến: ĐẠT 100%.

- [ ] **Bước 5: Tạo commit git Tác vụ 1**
  `git commit -m "feat(backend): allow chairman and secretary to review outline"`

---

### Tác Vụ 2: Tinh Giản Trang Duyệt Nguyện Vọng Của Giảng Viên Hướng Dẫn

**Tệp thực hiện:**
- Chỉnh sửa: `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
- Tạo mới: `frontend/tests/topicApprovalMentorOnly.test.js`

**Giao diện & Hợp đồng:**
- `TopicApprovalPage.jsx` không còn chứa `segmented-tabs`, không còn Tab 2 về đề cương BM01.
- Nếu có tham số `?tab=bm01` hoặc `?tab=outline`, tự động chuyển hướng sang `/lecturer/outline-evaluations`.
- Header hiển thị rõ ràng chỉ tiêu hướng dẫn: `Chỉ tiêu: Đã nhận X / 10 sinh viên`.
- Bảng danh sách nguyện vọng hiển thị sinh viên đăng ký đề tài của giảng viên, hỗ trợ Chấp thuận và Từ chối kèm lý do.

- [ ] **Bước 1: Viết bài kiểm thử thất bại**
  Tạo `frontend/tests/topicApprovalMentorOnly.test.js`:
  - `TopicApprovalPage` không còn chứa thẻ chuyển đổi "Hội Đồng Thẩm Định Đề Cương".
  - Chuyển hướng `tab=bm01` sang `/lecturer/outline-evaluations`.
  - Tuân thủ Quy tắc 2.1, 2.4, 2.6 (không có emoji hoặc ký tự thô trong nút bấm).

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**
  Chạy lệnh: `npm --prefix frontend test -- tests/topicApprovalMentorOnly.test.js`
  Kết quả dự kiến: Thất bại do trang cũ vẫn còn chứa tab đề cương.

- [ ] **Bước 3: Thực hiện tinh giản `TopicApprovalPage.jsx`**
  - Gỡ bỏ state `activeTab`, `pendingOutlineCount`, `councilOutlineQuery`, `OutlineReviewModal`.
  - Thêm xử lý chuyển hướng nếu phát hiện `tabParam === 'bm01' || tabParam === 'outline'`.
  - Giữ lại giao diện xét duyệt nguyện vọng tiếp nhận sinh viên chuyên nghiệp.

- [ ] **Bước 4: Chạy lại kiểm thử xác nhận thành công**
  Chạy lệnh: `npm --prefix frontend test -- tests/topicApprovalMentorOnly.test.js`
  Kết quả dự kiến: ĐẠT 100%.

- [ ] **Bước 5: Tạo commit git Tác vụ 2**
  `git commit -m "refactor(lecturer): streamline mentor approval page"`

---

### Tác Vụ 3: Xây Dựng Trang Độc Lập "Thẩm Định Đề Cương"

**Tệp thực hiện:**
- Tạo mới: `frontend/src/pages/lecturer/OutlineReviewPage.jsx`
- Tạo mới: `frontend/src/pages/lecturer/outline-review.css`
- Tạo mới: `frontend/tests/outlineReviewPage.test.js`

**Giao diện & Hợp đồng:**
- `OutlineReviewPage.jsx`:
  - Khối Bento Header nhận diện Hội đồng: Tên hội đồng, quyết định thành lập, danh sách thành viên (Chủ tịch, Thư ký, Ủy viên) và huy hiệu vai trò của người đăng nhập.
  - Dãy 4 thẻ đo lường tiến độ thẩm định (Tổng số, Chờ thẩm định, Đã đạt, Cần chỉnh sửa) với màu sắc rực rỡ (Xanh biển sâu, Ngọc lục bảo, Vàng hổ phách, Tím thạch anh).
  - Bảng danh sách đề tài phân công cho hội đồng: Tra cứu nhanh, xem đề cương BM01 qua modal bản in.
  - Quyền bấm thẩm định:
    - Chủ tịch Hội đồng & Thư ký Hội đồng: Hiển thị nút chính `<Button type="primary" icon={<CheckSquareOutlined />}>Thẩm định đề cương</Button>` mở `OutlineReviewModal` để chấm.
    - Ủy viên Hội đồng: Hiển thị nút `<Button icon={<EyeOutlined />}>Xem & Góp ý</Button>` (chế độ chỉ xem và đóng góp ý kiến).
  - Hiệu ứng chuyển động vi mô: `fadeSlideIn`, nâng nhẹ khi rê chuột, hỗ trợ `@media (prefers-reduced-motion)`.

- [x] **Bước 1: Viết bài kiểm thử thất bại**
  Tạo `frontend/tests/outlineReviewPage.test.js`:
  - Kiểm tra tồn tại tệp và chuẩn UTF-8 không BOM (Quy tắc 2.4).
  - Kiểm tra không dùng kiến trúc nhóm cũ (Quy tắc 2.1).
  - Kiểm tra nút bấm Ant Design dùng prop icon, không chứa emoji hay ký tự thô (Quy tắc 2.6).
  - Kiểm tra phân quyền: Chủ tịch và Thư ký có nút thẩm định; Ủy viên chỉ có nút xem & góp ý.
  - Kiểm tra kết nối modal xem bản in BM01 và rà soát AI Copilot.

- [x] **Bước 2: Chạy kiểm thử để xác nhận thất bại**
  Chạy lệnh: `npm --prefix frontend test -- tests/outlineReviewPage.test.js`
  Kết quả dự kiến: Thất bại do chưa tạo trang và css.

- [x] **Bước 3: Xây dựng `OutlineReviewPage.jsx` và `outline-review.css`**
  - Xây dựng giao diện Bento Grid + Data-Dense hiện đại theo chuẩn `ui-ux-pro-max`.
  - Kết nối `useRegistrations(scope, { asCouncilMember: 'true' })`.
  - Tích hợp `OutlineReviewModal`, `BM01PrintSheet`, `AcademicFormPrintModal`, `BM01CopilotDrawer`.

- [x] **Bước 4: Chạy lại kiểm thử xác nhận thành công**
  Chạy lệnh: `npm --prefix frontend test -- tests/outlineReviewPage.test.js`
  Kết quả dự kiến: ĐẠT 100%.

- [x] **Bước 5: Tạo commit git Tác vụ 3**
  `git commit -m "feat(lecturer): build dedicated outline review council page"`

---

### Tác Vụ 4: Cập Nhật Định Tuyến, Chính Sách Và Tính Tương Thích

**Tệp thực hiện:**
- Chỉnh sửa: `frontend/src/App.jsx`
- Chỉnh sửa: `frontend/src/auth/featurePolicies.js`
- Chỉnh sửa: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Chỉnh sửa: `frontend/src/pages/common/NotificationsPage.jsx`
- Tạo mới: `frontend/tests/outlineReviewNavigation.test.js`
- Cập nhật: `frontend/tests/navigationRegistry.test.js`, `frontend/tests/featurePolicyParity.test.js`

**Giao diện & Hợp đồng:**
- Gắn route `/lecturer/outline-evaluations` nạp `OutlineReviewPage` vào `App.jsx`.
- Cập nhật chính sách `outline-reviews` trong `featurePolicies.js` trỏ trực tiếp đến route `/lecturer/outline-evaluations`.
- Cập nhật các liên kết CTA từ Dashboard giảng viên và thông báo nạp đề cương BM01 dẫn thẳng về `/lecturer/outline-evaluations`.

- [ ] **Bước 1: Viết bài kiểm thử thất bại**
  Tạo `frontend/tests/outlineReviewNavigation.test.js`:
  - Route `/lecturer/outline-evaluations` được cấu hình và bảo vệ bởi chính sách `outline-reviews`.
  - Menu sidebar "Thẩm định đề cương" dẫn tới `/lecturer/outline-evaluations`.
  - Các thông báo thẩm định đề cương điều hướng về `/lecturer/outline-evaluations`.
  - Quyền truy cập theo phân công hội đồng `assignment: 'outlineCouncil'` được bảo toàn.

- [ ] **Bước 2: Chạy kiểm thử để xác nhận thất bại**
  Chạy lệnh: `npm --prefix frontend test -- tests/outlineReviewNavigation.test.js`
  Kết quả dự kiến: Thất bại do chưa cập nhật route và chính sách.

- [ ] **Bước 3: Cập nhật định tuyến và chính sách**
  - Trong `frontend/src/App.jsx`: Thêm route lazy load cho `OutlineReviewPage`.
  - Trong `frontend/src/auth/featurePolicies.js`: Sửa `route: '/lecturer/outline-evaluations'`.
  - Trong `LecturerDashboardPage.jsx` và `NotificationsPage.jsx`: Cập nhật target đường dẫn.
  - Đồng bộ `navigationRegistry.test.js` và `featurePolicyParity.test.js`.

- [ ] **Bước 4: Chạy lại kiểm thử xác nhận thành công**
  Chạy lệnh: `npm --prefix frontend test -- tests/outlineReviewNavigation.test.js tests/navigationRegistry.test.js tests/featurePolicyParity.test.js`
  Kết quả dự kiến: ĐẠT 100%.

- [ ] **Bước 5: Tạo commit git Tác vụ 4**
  `git commit -m "feat: route outline reviews to dedicated council page"`

---

## Nghiệm Thu Toàn Diện Cuối Cùng

- [ ] Chạy toàn bộ các bài kiểm thử tự động của Backend:
  `npm --prefix backend test -- tests/services/outlineReviewCouncilAuth.test.js tests/services/outlineReviewService.test.js`
- [ ] Chạy toàn bộ các bài kiểm thử tự động của Frontend:
  `npm --prefix frontend test -- tests/outlineReviewPage.test.js tests/outlineReviewNavigation.test.js tests/topicApprovalMentorOnly.test.js tests/navigationRegistry.test.js tests/featurePolicyParity.test.js`
- [ ] Chạy kiểm thử đóng gói production:
  `npm --prefix frontend run build`
- [ ] Kiểm tra chuẩn mã hóa UTF-8 không BOM và trạng thái git sạch sẽ.

