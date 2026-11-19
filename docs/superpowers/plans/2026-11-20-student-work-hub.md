# Student Work Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay “Hồ sơ & nộp bài” bằng trang “Việc của tôi” chỉ làm nổi bật việc đang làm được và việc có mốc trong 7 ngày, đồng thời giữ đầy đủ luồng nộp/xem đã có.

**Architecture:** Backend chuẩn hóa `workItems` từ `TopicRegistration` và các bản ghi nghiệp vụ, rồi chọn `nextAction` cho dashboard từ cùng nguồn. Frontend dựng trang theo ba vùng Cần làm ngay, Sắp tới, Đã hoàn thành; các form/modal nghiệp vụ được tách khỏi `SubmissionPage` cũ thành component có trách nhiệm rõ. Route cũ vẫn hoạt động và deep link đưa đến đúng việc.

**Tech Stack:** Express 5, Prisma 7/PostgreSQL, Jest/Supertest, React 19, React Router 7, TanStack Query, Ant Design 6, CSS/Tailwind, Node test/Vitest/Playwright.

**Spec:** `docs/superpowers/specs/2026-11-20-student-work-hub-design.md`

**Related plan:** `docs/superpowers/plans/2026-11-20-lecturer-student-next-actions.md` đã tạo `buildStudentNextAction`; kế hoạch này mở rộng nguồn dữ liệu và giữ interface dashboard tương thích.

## Global Constraints

- `TopicRegistration` là trục, 1 SV/1 đề tài, tối đa 10 SV/GVHD; không dùng `group/groupMember`.
- Chỉ việc mở và có quyền mới ở Cần làm ngay. Sắp tới chỉ việc chưa mở, đủ điều kiện dự kiến và có `openAt`/`dueAt` thật trong **7 ngày**; không tạo ngày giả.
- Một việc chỉ ở một vùng. Đã nộp hiện trong lịch sử và trạng thái chờ phản hồi, không còn nút nộp trừ khi nghiệp vụ cho sửa/nộp lại.
- Dashboard `nextAction` và trang mới lấy từ một service; mutation vẫn kiểm lại quyền/trạng thái ở API gốc.
- Giữ BM01 v1/v2, BM02, BM02-A, BM03/checkpoint/xác nhận 48h, BM04 xem, hồ sơ trước bảo vệ, lịch bảo vệ, bốn tệp lưu chiểu và các bản PDF hợp lệ.
- Giữ `/student/submissions`; đổi nhãn menu thành “Việc của tôi”, bỏ menu lưu chiểu riêng nhưng hỗ trợ `?tab=archive` cũ.
- UI dùng token DACN: teal chính, lam sắp tới, hổ phách gần hạn, đỏ quá hạn, xanh lá hoàn thành. Animation 250–350ms, nút 150–200ms; tắt chuyển động không cần thiết với `prefers-reduced-motion`.
- File UTF-8 không BOM; Button dùng `@ant-design/icons` qua prop `icon`, nhãn tiếng Việt thuần. Chỉ stage tệp của task, không gom thay đổi workspace khác.

## Review Focus

1. `APPROVED` nhưng chưa có Task BM01 do SV chưa mở trang: vẫn có việc nộp BM01, không cần task giả (Task 1).
2. Trạng thái BM03 chung nhưng không có checkpoint/xác nhận mở: không tạo CTA “Nộp tiến độ” ảo (Task 1, 3).
3. Việc mở và sắp hết hạn trong 7 ngày chỉ nằm ở Cần làm ngay; việc khóa và không có mốc không hiện Sắp tới (Task 1, 3).
4. Deep link `/student/submissions?tab=archive` và thông báo cũ vẫn mở đúng khu vực; link `?work=` hết hiệu lực có fallback rõ (Task 4).
5. Nộp BM01 v1/v2, ký BM03, nộp lưu chiểu vẫn gọi API hiện có; BM04/điểm chưa công bố không lộ dữ liệu hoặc bản in (Task 2–4).

---

## File map

| Unit | Tệp | Trách nhiệm |
|---|---|---|
| Work read model | `backend/src/services/studentWorkItemService.js`, `studentDashboardActionService.js`, `dashboardController.js` | Phân loại việc/ưu tiên, đồng bộ dashboard |
| Work query | `frontend/src/queries/dashboardQueries.js`, `frontend/src/services/dashboardService.js` | Lấy `workItems`, `waitingStatus`, `nextAction` theo user |
| Work actions | `frontend/src/components/student/work/StudentWorkActions.jsx` và các component theo BM/archive | Gọi các modal/API nghiệp vụ hiện có |
| Work page | `frontend/src/pages/student/StudentWorkHubPage.jsx`, CSS/page styles | Ba vùng, trạng thái, animation, deep link |
| Navigation | `frontend/src/App.jsx`, `frontend/src/auth/featurePolicies.js`, `StudentDashboardPage.jsx`, `NotificationsPage.jsx` | Route/menu/link cũ và mới |

### Task 1: Một nguồn việc cho dashboard và trang sinh viên

**Files:** Create `backend/src/services/studentWorkItemService.js`, `backend/tests/services/studentWorkItemService.test.js`; modify `backend/src/services/studentDashboardActionService.js`, `backend/src/controllers/dashboardController.js`; extend `backend/tests/services/studentDashboardActionService.test.js`, `backend/tests/integration/dashboardTriageAndStudentData.test.js`.

**Interfaces:** `buildStudentWorkState({ registration, semester, tasks, outline, bm03Record, bm04Record, archive, dossier, allowedActions, now }): { workItems: Array<{ id, kind, title, description, bucket: 'READY'|'UPCOMING'|'DONE', openAt, dueAt, target, canAct, sourceStatus, completedAt }>, waitingStatus: { title, description, sourceStatus } | null, nextAction: object | null }`. `nextAction` lấy từ READY ưu tiên, rồi waitingStatus nếu không có READY, giữ các field `{ kind, title, description, dueAt, target, sourceStatus, canAct }` hiện có. `/api/dashboard/student` thêm `data.workItems` và `data.waitingStatus`.

- [ ] **Step 1: Viết test thất bại.** Ma trận BM01 v1/v2, BM02, BM02-A, BM03 48h, archive; `APPROVED` không có task; BM03 status chung không có task mở; thời điểm cách mốc 7 ngày/7 ngày + 1 phút; việc READY có hạn gần không lặp UPCOMING; DONE chỉ từ bản nộp/mốc hoàn tất thật. Dashboard `nextAction` bằng việc READY đầu tiên, trạng thái chờ không có CTA.

```js
expect(state.workItems.filter(x => x.kind === 'BM01_INITIAL' && x.bucket === 'READY')).toHaveLength(1);
expect(state.workItems.filter(x => x.bucket === 'UPCOMING' && !x.openAt && !x.dueAt)).toHaveLength(0);
expect(state.nextAction?.kind).toBe(state.workItems.find(x => x.bucket === 'READY')?.kind);
```

- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/studentWorkItemService.test.js tests/services/studentDashboardActionService.test.js tests/integration/dashboardTriageAndStudentData.test.js`.
- [ ] **Step 3: Thực hiện service và response.** Tái dùng trạng thái/cửa sổ thật, không dựa tên task hoặc thứ tự mảng. Trường `Task` hiện chỉ có `dueDate`; `openAt` lấy từ mốc Semester hoặc nghiệp vụ có mốc mở, để null nếu nguồn không có. Không trả thông tin BM04/kết quả chưa được phép xem; query thêm relation cần thiết theo ID SV hiện tại. `buildStudentNextAction` gọi chung logic hoặc làm wrapper, không giữ bảng ánh xạ song song.
- [ ] **Step 4: Chạy lại focused tests; PASS.** So sánh response dashboard với service trên cùng fixture, không có target cho việc chưa mở.
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "feat: derive student work and next action together"`.

### Task 2: Tách thao tác BM01, BM02 và BM02-A

**Files:** Create `frontend/src/components/student/work/StudentWorkActions.jsx`, `frontend/src/components/student/work/StudentSubmissionActions.jsx`, `frontend/tests/studentSubmissionWorkActions.test.js`; modify `frontend/src/pages/student/SubmissionPage.jsx` trong quá trình chuyển; update `frontend/src/pages/__tests__/bm01CopilotUi.test.js`, `contextualPrintButtons.test.js` khi các assertion cũ trỏ vào file cũ.

**Interfaces:** `StudentWorkActions({ item, registration, sources, onCompleted })` chọn component nghiệp vụ theo `item.kind`. `StudentSubmissionActions` giữ `outlineService`, `registrationService.submitBM02`, `taskService.submitTask` và BM02-A; chỉ mount khi sinh viên mở việc tương ứng.

- [ ] **Step 1: Viết test thất bại.** Nộp BM01 v1/v2 gọi đúng API và giới hạn phiên bản; BM02/BM02-A giữ payload và lỗi validation; bản in/PDF chỉ mở khi có dữ liệu. Test source giả chỉ để kiểm hành vi, không đưa mock vào production UI.
- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix frontend test -- tests/studentSubmissionWorkActions.test.js src/pages/__tests__/bm01CopilotUi.test.js src/pages/__tests__/contextualPrintButtons.test.js`.
- [ ] **Step 3: Chuyển handler/modal BM01/BM02/BM02-A từ trang cũ.** Giữ service calls và điều kiện nghiệp vụ; `onCompleted` invalidate/refetch dashboard/work/registration để mục chuyển trạng thái. Không mount bản in khi chưa có dữ liệu.
- [ ] **Step 4: Chạy lại focused tests và `npm --prefix frontend run build`; PASS.** So sánh payload các luồng chính trước/sau chuyển.
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "refactor(student): isolate BM01 and BM02 actions"`.

### Task 3: Tách thao tác BM03, xem BM04 và lưu chiểu

**Files:** Create `frontend/src/components/student/work/StudentProgressActions.jsx`, `frontend/src/components/student/work/StudentArchiveActions.jsx`, `frontend/tests/studentProgressArchiveActions.test.js`; modify `frontend/src/components/student/work/StudentWorkActions.jsx`, `frontend/src/pages/student/SubmissionPage.jsx`; update `frontend/src/pages/__tests__/defenseToCompletionUI.test.js`, `frontend/tests/checkpointAppealUiContracts.test.js` khi assertion cũ trỏ vào file cũ.

**Interfaces:** `StudentWorkActions` Task 2 nhận thêm kind BM03/ARCHIVE; `StudentProgressActions` giữ `evaluationService.studentAcknowledgeBM03` và checkpoint; `StudentArchiveActions` giữ `archiveService.submitPreDefenseArchive` và bốn tệp lưu chiểu. BM04 chỉ cho xem dữ liệu/PDF đã được phép.

- [ ] **Step 1: Viết test thất bại.** Xác nhận BM03 trong 48h, checkpoint/kháng nghị, hồ sơ sơ bộ và bốn tệp lưu chiểu giữ payload/validation; BM04 chưa ký không có bản in; điểm bảo vệ chưa công bố không lộ.
- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix frontend test -- tests/studentProgressArchiveActions.test.js src/pages/__tests__/defenseToCompletionUI.test.js tests/checkpointAppealUiContracts.test.js`.
- [ ] **Step 3: Chuyển handler/modal của BM03/BM04/archive từ trang cũ.** Giữ API và điều kiện quyền; chi tiết nặng chỉ mount khi vùng tương ứng mở; `onCompleted` refetch các query liên quan.
- [ ] **Step 4: Chạy lại focused tests và build; PASS.** Kiểm một BM03 đang chờ xác nhận và một hồ sơ lưu chiểu.
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "refactor(student): isolate progress and archive actions"`.

### Task 4: Dựng trang “Việc của tôi” và visual design

**Files:** Create `frontend/src/pages/student/StudentWorkHubPage.jsx`, `frontend/src/pages/student/student-work-hub.css`, `frontend/tests/studentWorkHub.test.js`.

**Interfaces:** `StudentWorkHubPage` đọc `data.workItems`/`waitingStatus` từ `useStudentDashboard(scope)` hiện có; `StudentWorkActions` Tasks 2–3 gắn với READY item đang chọn. UPCOMING không có mutation; DONE chỉ xem nộp/feedback/PDF. Thứ tự READY: quá hạn, hạn gần, việc xác nhận 48h/sửa nộp lại, rồi việc thường; cùng mức ưu tiên theo dueAt thực.

- [x] **Step 1: Viết test thất bại.** Không có việc hiện “Hiện chưa có việc cần làm”; waitingStatus nói rõ đang chờ ai; READY/UPCOMING/DONE xếp đúng; một item không lặp; nút nộp chỉ ở READY; hoàn thành làm mục chuyển vùng; lỗi API có retry, nguồn phụ lỗi không che CTA. Kiểm text trạng thái không chỉ theo màu, focus/heading và reduced motion.

```js
assert.equal(screen.queryByRole('button', { name: /nộp/i }) !== null, readyItems.length > 0);
assert.equal(screen.getByText('Sắp tới').closest('section').querySelectorAll('button[disabled]').length, 0);
```

- [x] **Step 2: Chạy focused test để thấy FAIL.** `npm --prefix frontend test -- tests/studentWorkHub.test.js`.
- [x] **Step 3: Thực hiện bố cục.** Header đề tài/đợt thật; hero teal Cần làm ngay và trạng thái cạnh bên desktop, Sắp tới lam/hổ phách, Đã hoàn thành thu gọn. CSS fade + dịch 8–12px trong 250–350ms, hover 150–200ms; không pulse vô hạn hoặc animation lặp khi refetch. `prefers-reduced-motion` tắt motion. Dùng icon Ant Design, token hiện có, không thêm thư viện animation.
- [x] **Step 4: Chạy lại focused test và build; PASS.** Dùng Playwright kiểm 375px, tablet, desktop, keyboard và reduced motion; ảnh chụp chỉ để QA, không làm artifact sản phẩm.
- [x] **Step 5: Commit đúng tệp Task 4.** `git commit -m "feat: add contextual student work hub"`.

### Task 5: Chuyển route, menu và deep links

**Files:** Modify `frontend/src/App.jsx`, `frontend/src/auth/featurePolicies.js`, `frontend/src/pages/student/StudentDashboardPage.jsx`, `frontend/src/pages/common/NotificationsPage.jsx`; replace/retire `frontend/src/pages/student/SubmissionPage.jsx` sau khi Task 2/3 đã dùng hết chức năng; create `frontend/tests/studentWorkNavigation.test.js`; update `frontend/tests/navigationRegistry.test.js`, `frontend/tests/featurePolicyParity.test.js`, `frontend/tests/studentNextActionDashboard.test.js`.

**Interfaces:** `/student/submissions?work=<kind>` mở READY item hoặc DONE record tương ứng; `?tab=archive` cũ ánh xạ tới `SUBMIT_ARCHIVE`/lịch sử archive; route không param mở đầu trang. `my-submissions` label thành “Việc của tôi”; bỏ entry `my-archive` khỏi menu nhưng giữ quyền lưu chiểu ở route. Dashboard `nextAction.target` chứa `work=<kind>` khi action đi qua hub; notification link cũ vẫn hợp lệ.

- [x] **Step 1: Viết test thất bại.** Menu chỉ còn “Việc của tôi”; dashboard BM01 dẫn `?work=BM01_INITIAL`; notification BM03/archival dẫn đúng việc; `?tab=archive` mở archive hoặc lịch sử; `?work=` không còn hợp lệ hiện hướng dẫn và việc hiện tại; link không param hoạt động. Các quyền `VIEW_MY_ARCHIVE`/`SUBMIT_FINAL_ARCHIVE` vẫn mở được route.
- [x] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix frontend test -- tests/studentWorkNavigation.test.js tests/navigationRegistry.test.js tests/featurePolicyParity.test.js tests/studentNextActionDashboard.test.js`.
- [x] **Step 3: Thực hiện route/menu/link.** Dùng `StudentWorkHubPage` cho route cũ, đồng bộ target backend Task 1, cập nhật link Dashboard/Notifications, bỏ entry archive riêng. Chỉ xóa `SubmissionPage` cũ khi test xác nhận mọi API nghiệp vụ còn được dùng từ component mới.
- [x] **Step 4: Chạy lại focused tests, backend Task 1 tests và frontend build; PASS.** Kiểm deep link sau refresh trình duyệt và khi việc đã hoàn thành.
- [x] **Step 5: Commit đúng tệp Task 5.** `git commit -m "feat: route student submissions to work hub"`.

## Final verification

- [ ] Chạy focused tests của Tasks 1–5 và frontend build. Chạy kiểm thử trình duyệt trên dữ liệu giai đoạn BM01, BM03 và lưu chiểu; mở rộng test chỉ khi rủi ro cụ thể còn lại.
- [ ] Kiểm không còn chức năng orphan trong `SubmissionPage`, không còn menu lưu chiểu riêng, không mất quyền/deep link, không lộ dữ liệu chưa công bố, UTF-8 không BOM và `git status` sạch cho tệp thuộc tính năng.
