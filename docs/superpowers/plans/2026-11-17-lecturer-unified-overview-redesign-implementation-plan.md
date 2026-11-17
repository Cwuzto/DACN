# Lecturer Unified Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết kế lại `/lecturer/dashboard` thành một dashboard hai vùng cân bằng, xen việc GVHD và thông báo/việc Viện trưởng trong cùng hàng đợi, không dùng số liệu giả.

**Architecture:** Giữ route và API `GET /api/dashboard/lecturer`, thêm hợp đồng tổng quan theo dạng additive. Backend tổng hợp, sắp ưu tiên và kiểm tra capability + resource scope; frontend chỉ trình bày các mục đã được phép trong một layout chung và giữ các mutation hiện có. CSDL `TopicRegistration` và các entity học vụ hiện tại đủ dữ liệu cho bước đầu, nên không tạo migration nếu kiểm tra schema không phát hiện thiếu ràng buộc bắt buộc.

**Tech Stack:** PostgreSQL/Prisma, Express/CommonJS/Jest, React 19/Vite, TanStack Query, Ant Design, Tailwind, Vitest/Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-lecturer-unified-overview-redesign-design.md`

## Global Constraints

- Giữ `TopicRegistration` là kiến trúc đăng ký duy nhất; `maxStudents = 1`, một GVHD tối đa 10 sinh viên. Không dùng lại `group/groupMember`.
- Sửa từ CSDL/Prisma → backend → frontend; dùng dữ liệu API thật, không thêm mock hoặc fallback số liệu giả.
- Một dashboard duy nhất cho GVHD và Viện trưởng; không thêm tab hoặc nút chuyển góc nhìn. Viện trưởng vẫn thấy danh sách sinh viên do chính mình hướng dẫn.
- Backend là security boundary: kiểm tra capability và scope học kỳ/đơn vị/tài nguyên; không tin tham số client để mở rộng quyền.
- Giữ response cũ của `GET /api/dashboard/lecturer` tương thích; các trường mới là additive. Không làm lộ điểm/nhận xét BM05 chưa công bố.
- Nút dùng `@ant-design/icons` qua prop `icon`; label tiếng Việt thuần, không emoji/ký tự đồ họa thô. File `.md/.js/.jsx/.json/.prisma/.yml` là UTF-8 không BOM.
- Không sửa các thay đổi đang có ngoài phạm vi dashboard trong working tree. Mỗi task có test và commit riêng sau review; chỉ cập nhật `CLAUDE.md` khi người dùng nói `end phiên`.

## Review Focus

1. Viện trưởng có quyền chức vụ nhưng không hướng dẫn sinh viên nào: thấy việc/ thông báo được phép và trạng thái danh sách sinh viên rỗng, không nhận sinh viên toàn viện (Task 2, 5).
2. Client gửi `semesterId` của kỳ khác hoặc quyền chức vụ bị thu hồi: mục Viện trưởng biến mất hoặc API từ chối theo scope; hàng đợi GVHD không rò dữ liệu kỳ khác (Task 1, 2, 4).
3. Có hơn 5 submission cần phản hồi: `pendingFeedback`/`actionableCount` vẫn là tổng thật, không bằng độ dài preview 5 mục (Task 1).
4. Thông báo đã đọc hoặc không có deadline: không được biến thành việc đã hoàn thành, quá hạn hoặc tạo mutation giả (Task 2).
5. Query refetch, chuyển đợt hoặc reduced motion: item không nhấp nháy lặp; skeleton/empty/error không giữ số liệu cũ hoặc cho thao tác sai phạm vi (Task 4, 5).

---

### Task 1: Xác nhận schema và hợp đồng tổng quan GVHD

**Files:**
- Read: `backend/prisma/schema.prisma` (`TopicRegistration`, `Task`, `Submission`, `TopicTitleAdjustment`, `BM04Evaluation`, `Semester`)
- Create: `backend/src/services/lecturerOverviewService.js`
- Modify: `backend/src/controllers/dashboardController.js`
- Modify: `backend/tests/integration/dashboard.routes.test.js`
- Create: `backend/tests/services/lecturerOverviewService.test.js`

**Interfaces:**
- Produces: `resolveLecturerSemester({ actorId, requestedSemesterId?, db }) -> Semester | null` theo default/fallback đang có; `requestedSemesterId` sai định dạng trả 400, kỳ không được xem trả 403.
- Produces: `buildMentorOverview({ actorId, semesterId, now, db }) -> { mentorSummary, attentionItems, students }`.
- Extends: `GET /api/dashboard/lecturer?semesterId=<id>` with `mentorSummary`, `attentionItems`, `students`, `generatedAt`; giữ `activeSemester`, `stats`, `recentSubmissions`, `timelineEvents` hiện có.

- [ ] **Step 1: Kiểm tra Prisma trước khi code.** Đối chiếu các quan hệ và index theo actor/semester trong schema; chạy `npm --prefix backend exec prisma validate`. Nếu thiếu trường bắt buộc, thêm migration + test migration ở task này trước service; không đổi `TopicRegistration`/quota.
- [ ] **Step 2: Viết test fail cho hợp đồng GVHD.** Fixtures: một mentor có 2 hồ sơ ở kỳ hiện tại, một hồ sơ kỳ khác; 6 submission chờ feedback; đăng ký PENDING, BM01 cần duyệt lại và đổi tên chờ xử lý. Assert `students` chỉ thuộc mentor/kỳ, `mentorSummary.supervisedCount = 2`, `maxStudents = 10`, số pending từ count thật, item có `source='MENTOR'`, `target` hợp lệ, không có 82%/75%/4/7; `semesterId` không hợp lệ trả 400.
- [ ] **Step 3: Chạy test để xác nhận fail.** `npm --prefix backend test -- --runTestsByPath tests/services/lecturerOverviewService.test.js tests/integration/dashboard.routes.test.js`.
- [ ] **Step 4: Implement tối thiểu.** Tách truy vấn GVHD khỏi controller vào service, dùng `topic.mentorId = actorId`, `semesterId` đã được giải quyết ở server và các trạng thái workflow thực tế. Tách count khỏi preview `take: 5`; không lấy độ dài preview làm tổng. Tiêm `now` để kiểm tra hạn quyết định được. Giữ response cũ nguyên nghĩa.
- [ ] **Step 5: Chạy lại test và commit.** Test bước 3 và `npm --prefix backend exec prisma validate` phải PASS; commit `feat(dashboard): add mentor overview contract`.

### Task 2: Hàng đợi Viện trưởng có scope và thông báo thật

**Files:**
- Create: `backend/src/services/instituteAttentionSource.js`
- Modify: `backend/src/services/lecturerOverviewService.js`
- Modify: `backend/src/controllers/dashboardController.js`
- Create: `backend/tests/services/instituteAttentionSource.test.js`
- Create: `backend/tests/integration/lecturerOverviewAuthorization.routes.test.js`

**Interfaces:**
- Consumes: `buildMentorOverview` và `resolveLecturerSemester` từ Task 1.
- Produces: `buildInstituteAttention({ actor, semesterId, now, db }) -> AttentionItem[]`; chỉ trả mục có capability và resource scope hợp lệ.
- Produces: một `attentionItems[]` chung, có `source='MENTOR'|'INSTITUTE_DIRECTOR'`, `priority='OVERDUE'|'DUE_SOON'|'NORMAL'|'INFO'`, `isActionable`, `target`, `allowedAction?`, `dueAt?`.

- [ ] **Step 1: Viết test fail về quyền và nguồn.** Kiểm tra GVHD không có mục Viện trưởng; Viện trưởng vẫn có sinh viên GVHD của mình; Viện trưởng không có sinh viên hướng dẫn chỉ thấy danh sách rỗng. Kiểm tra BM02 chờ thẩm định, quyết định chưa ban hành, hội đồng cần phân công, kết quả chờ công bố chỉ xuất hiện nếu actor đủ quyền + scope. Thu hồi quyền hoặc kỳ/đơn vị khác làm mục biến mất; không lộ điểm BM05 trước công bố.
- [ ] **Step 2: Viết test fail cho thông báo và sắp xếp.** Notification của `userId` hiện tại chỉ là `INFO`, `isRead` không phải trạng thái xử lý; notification không gắn được kỳ hiển thị như thông tin chung và không đi vào KPI kỳ. Mục không có `dueAt` không quá hạn. Với `now` cố định, `OVERDUE` < hiện tại, `DUE_SOON` trong 72 giờ tới, sau đó `NORMAL`, `INFO`; khử trùng lặp theo `kind + resourceId + allowedAction`; `actionableCount` tính trước khi cắt preview.
- [ ] **Step 3: Chạy test để xác nhận fail.** `npm --prefix backend test -- --runTestsByPath tests/services/instituteAttentionSource.test.js tests/integration/lecturerOverviewAuthorization.routes.test.js`.
- [ ] **Step 4: Implement nguồn Viện trưởng.** Dùng entity thật (`BM02Submission`/`TopicRegistration`, `AssignmentDecision`, `Council`, `ResultPublication`, `Notification`) và helper `resolveResourceScope`/`validateAcademicScope` phù hợp từng resource. Không tái dùng list toàn viện trên frontend hoặc `allowedActions` của đăng ký làm quyền duy nhất cho BM02/hội đồng/công bố. Mục chưa xác minh được trạng thái hoặc route đích thì bỏ qua, không tạo count giả. `target` phải là route đang tồn tại; notification chỉ đọc có `isActionable=false`.
- [ ] **Step 5: Chạy lại test và commit.** Test bước 3 và ma trận RBAC liên quan phải PASS; commit `feat(dashboard): merge scoped institute attention`.

### Task 3: Query frontend theo identity và đợt

**Files:**
- Modify: `frontend/src/services/dashboardService.js`
- Modify: `frontend/src/queries/dashboardQueries.js`
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Modify: `frontend/runtime-tests/lecturerQueries.spec.jsx`

**Interfaces:**
- Produces: `dashboardService.getLecturerOverview({ semesterId? })` gọi `/dashboard/lecturer`.
- Produces: `useLecturerOverview(scope, semesterId)` với query key bao gồm `scope` (identity + permission version) và `semesterId`.
- Preserves: query/mutation hiện có cho ghi nhật ký gặp, duyệt BM01, đổi tên đề tài, gửi thông báo.

- [ ] **Step 1: Viết runtime test fail.** Assert chỉ một query tổng quan theo actor/kỳ, đổi kỳ dùng key mới; quyền đổi làm query cũ bị loại theo lifecycle RBAC. Mutation thành công invalidate đúng query tổng quan cùng với nguồn cũ; lỗi API vẫn vào trạng thái lỗi, không dùng fallback số.
- [ ] **Step 2: Chạy test để xác nhận fail.** `npm --prefix frontend run test:runtime -- runtime-tests/lecturerQueries.spec.jsx`.
- [ ] **Step 3: Thêm service/hook và nối page container.** Dùng `requireSuccess` như query hiện có; chỉ lấy `semesterId` từ bộ chọn hợp lệ và để backend xác thực lại. Không tự ghép mảng Viện trưởng ở client; không dùng `isInstituteDirector` làm quyền dữ liệu. Bảo toàn modal/mutation đang hoạt động và invalidate query sau mutation.
- [ ] **Step 4: Chạy lại test và commit.** Test bước 2 PASS; commit `refactor(lecturer): use scoped overview query`.

### Task 4: Bố cục chung, KPI và danh sách sinh viên

**Files:**
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Create: `frontend/src/components/lecturer/OverviewKpis.jsx`
- Create: `frontend/src/components/lecturer/AttentionQueue.jsx`
- Create: `frontend/src/components/lecturer/SupervisedStudentList.jsx`
- Modify: `frontend/src/pages/lecturer/lecturer-opendesign.css` (chỉ phần dashboard; cô lập `:root` đang ảnh hưởng toàn app)
- Create: `frontend/runtime-tests/LecturerOverview.spec.jsx`
- Modify: `frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`

**Interfaces:**
- Consumes: `mentorSummary`, `attentionItems`, `students`, `generatedAt` từ Task 1–3.
- Produces: một layout chung cho GVHD/Viện trưởng; không có toggle hoặc hub Viện trưởng riêng.

- [ ] **Step 1: Viết test fail cho hai persona và trạng thái.** GVHD chỉ thấy mục `MENTOR`; Viện trưởng thấy mục GVHD/Viện trưởng xen kẽ trong một hàng đợi và chỉ sinh viên mình hướng dẫn. Assert không còn số giả `82`, `75`, `4/7`, hai hội đồng cố định; trạng thái loading, empty, error có nội dung riêng và nút thử lại.
- [ ] **Step 2: Chạy test để xác nhận fail.** `npm --prefix frontend run test:runtime -- runtime-tests/LecturerOverview.spec.jsx` và `node --test frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`.
- [ ] **Step 3: Tách component và dựng bố cục B.** Desktop: KPI ngắn, hàng đợi trái và sinh viên phải ở màn đầu. Mobile: hàng đợi trước, sinh viên sau; mỗi dòng hiện nguồn, hồ sơ, hạn và action hợp lệ. Việc Viện trưởng là item trong hàng đợi, không có khối shortcut dài. Chuyển các thao tác phụ và modal xuống sau hai vùng chính. Dùng token/theme hiện có, không khai báo `:root` toàn cục trong CSS lecturer.
- [ ] **Step 4: Chạy lại test, lint/build và commit.** Test bước 2, `npm --prefix frontend run lint`, `npm --prefix frontend run build` PASS; commit `feat(lecturer): redesign unified overview layout`.

### Task 5: Chuyển động, truy cập và responsive

**Files:**
- Modify: `frontend/src/components/lecturer/AttentionQueue.jsx`
- Modify: `frontend/src/pages/lecturer/lecturer-opendesign.css`
- Modify: `frontend/runtime-tests/LecturerOverview.spec.jsx`
- Create: `frontend/e2e/lecturer-overview.spec.js`

**Interfaces:**
- Consumes: `AttentionItem.id`, `priority`, `source`, `isActionable`, `allowedAction`, `target`.
- Produces: hiệu ứng vào ngắn chỉ khi item mới hoặc vừa chuyển quá hạn; reduced motion giữ tín hiệu tĩnh.

- [ ] **Step 1: Viết test fail.** Refetch cùng item không chạy lại animation; item mới/quá hạn chỉ nhấn một lần; reduced motion tắt animation; item `INFO` không có nút mutation. Kiểm tra heading order, keyboard focus, accessible name, icon qua `@ant-design/icons` và không có emoji trong label nút.
- [ ] **Step 2: Chạy test để xác nhận fail.** `npm --prefix frontend run test:runtime -- runtime-tests/LecturerOverview.spec.jsx`.
- [ ] **Step 3: Implement motion và a11y.** Dùng nhãn, viền, nền và hiệu ứng một lần ngắn; không lặp vô hạn, không đổi kích thước bố cục. Thêm `prefers-reduced-motion`, focus visible, trạng thái disabled/empty rõ nghĩa. Giữ action theo backend; không mở mutation từ `source` hay role UI.
- [ ] **Step 4: Kiểm tra browser hai persona ở 375/768/1024/1440px**, cả reduced motion và lỗi API. E2E chứng minh một dashboard chung, quyền action đúng, không tràn ngang và không lộ dữ liệu sau đổi kỳ.
- [ ] **Step 5: Chạy test và commit.** Test bước 2, `npm --prefix frontend run test:e2e -- e2e/lecturer-overview.spec.js`, lint/build PASS; commit `feat(lecturer): add accessible priority motion`.

### Task 6: Hồi quy, rà soát quy tắc và bàn giao

**Files:**
- Modify: `docs/superpowers/plans/2026-11-17-lecturer-unified-overview-redesign-implementation-plan.md` để đánh dấu task thực sự hoàn thành
- Do not modify: `CLAUDE.md` cho đến khi người dùng nói `end phiên`

- [ ] **Step 1: Chạy kiểm tra backend.** `npm --prefix backend test -- --runTestsByPath tests/integration/dashboard.routes.test.js tests/integration/dashboardTriageAndStudentData.test.js tests/integration/lecturerOverviewAuthorization.routes.test.js tests/services/lecturerOverviewService.test.js tests/services/instituteAttentionSource.test.js`; `npm --prefix backend exec prisma validate`.
- [ ] **Step 2: Chạy kiểm tra frontend.** Runtime/query tests của Task 3–5, E2E hai persona, `npm --prefix frontend run lint`, `npm --prefix frontend run build`.
- [ ] **Step 3: Rà soát chéo.** Quét phần thay đổi để xác nhận không có `group/groupMember`, số liệu giả, icon thô trong button, BOM, role bypass, client scope bypass, link chết hoặc dữ liệu BM05 chưa công bố. Kiểm tra `git diff --check` và ghi rõ các thay đổi ngoài task đã có từ trước vẫn được giữ nguyên.
- [ ] **Step 4: Review và commit markers.** Chỉ tick các bước có bằng chứng PASS; commit riêng tài liệu hoàn thành. Báo tệp, test, commit và rủi ro còn lại; không cập nhật `CLAUDE.md` trước `end phiên`.
