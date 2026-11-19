# Lecturer and Student Next Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GVHD thấy việc cần làm và sinh viên chưa nộp BM01; sinh viên thấy một bước tiếp theo đúng trạng thái, không có dữ liệu giả.

**Architecture:** Mở rộng API dashboard hiện có bằng dữ liệu đã lọc theo actor/đợt. GVHD có `attentionItems` cho việc của mình và `watchItems` cho sinh viên chưa nộp; SV có `nextAction` duy nhất từ registration/trạng thái/hạn thật. Frontend trình bày các nguồn này, không tự suy quyền hay giai đoạn từ enum để tạo hành động.

**Tech Stack:** Express 5, Prisma 7/PostgreSQL, Jest/Supertest, React 19, TanStack Query, Ant Design 6, Node test/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-role-dashboard-next-actions-design.md` (mục 1–3, 5–8).

**Dependency:** Triển khai sau `docs/superpowers/plans/2026-11-20-bm01-automatic-reminders.md` để `Notification.dedupeKey` và lịch sử nhắc BM01 sẵn có. Admin dashboard trong `2026-11-20-admin-action-dashboard.md` độc lập.

**Student follow-up:** Phần `nextAction` đã triển khai được mở rộng bởi `docs/superpowers/plans/2026-11-20-student-work-hub.md` Task 1: Tổng quan và trang “Việc của tôi” phải cùng lấy việc từ `workItems`, với deep link `?work=<kind>`. Không duy trì hai bảng ánh xạ trạng thái riêng.

## Global Constraints

- `TopicRegistration` là trục; 1 SV/1 đề tài, tối đa 10 SV/GVHD; không dùng `group/groupMember`.
- GVHD chỉ thấy registration của mình; sinh viên chỉ thấy của mình. Việc chức vụ khác có nguồn/quyền riêng.
- GVHD không có nút nhắc BM01; hệ thống gửi trước hạn 48 giờ và một lần sau hạn theo plan job.
- BM01 chưa nộp dùng `status = APPROVED` và deadline `Semester.outlineSubmissionDeadline`; deadline null hiện “Chưa đặt hạn”.
- Dữ liệu không có không được thay bằng mã, ngày, số quyết định, năm học hoặc phần trăm giả.
- Sửa backend trước frontend; UTF-8 không BOM, Button dùng `@ant-design/icons` qua prop `icon` và nhãn tiếng Việt thuần.
- Mỗi commit chỉ stage tệp thuộc task; giữ thay đổi đang có ngoài kế hoạch.

## Review Focus

1. GVHD sở hữu SV `APPROVED` chưa nộp BM01 thấy ở Theo dõi; GVHD khác không thấy (Task 1).
2. BM01 nộp xong trước một lần refetch: mục theo dõi biến mất, việc duyệt xuất hiện đúng một lần (Task 1, 3).
3. Hạn BM01 null hoặc đã quá hạn: nhãn đúng và không tạo ngày giả; lần nhắc lấy từ notification đã gửi (Task 1, 3).
4. SV `PENDING`, `APPROVED`, cần sửa, đã nộp: CTA/chờ đúng người và không đưa link nộp sai cửa sổ (Task 2, 4).
5. API lỗi, không có registration hoặc thiếu dữ liệu profile/quyết định: trang có empty/retry rõ, không dùng fallback mock (Task 3, 4).

---

## File map

| Tệp | Trách nhiệm |
|---|---|
| `backend/src/services/lecturerOverviewService.js` | Việc GVHD và danh sách theo dõi BM01 |
| `backend/src/services/studentDashboardActionService.js` | Một bước tiếp theo của SV |
| `backend/src/controllers/dashboardController.js` | Gắn `nextAction` vào `/dashboard/student`; giữ API GVHD |
| `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`, `components/lecturer/OverviewKpis.jsx`, `AttentionQueue.jsx` | Trình bày việc và theo dõi |
| `frontend/src/pages/student/StudentDashboardPage.jsx`, `frontend/src/queries/dashboardQueries.js` | Bước tiếp theo và dữ liệu thật |

### Task 1: Backend theo dõi BM01 cho GVHD

**Files:** Modify `backend/src/services/lecturerOverviewService.js`; extend `backend/tests/services/lecturerOverviewService.test.js`, `backend/tests/integration/lecturerOverviewAuthorization.routes.test.js`.

**Interfaces:** `buildMentorOverview({ actorId, semesterId, now, db })` giữ fields cũ và thêm `watchItems: Array<{ kind: 'BM01_NOT_SUBMITTED', registrationId, studentId, studentName, studentCode, topicTitle, dueAt, deadlineState, lastReminderAt, target }>`; `target` trỏ `/lecturer/students/:registrationId`. `buildUnifiedLecturerOverview` truyền `watchItems` cho đúng GVHD. `lastReminderAt` lấy thông báo BM01 đã lưu theo `dedupeKey`, query batch cho toàn bộ registration.

- [ ] **Step 1: Viết test thất bại.** `APPROVED` chưa nộp nằm trong watch; BM01_SUBMITTED chuyển sang attention; trạng thái bị chấm dứt hoặc actor khác không thấy; `dueAt` null/đã qua hạn, lastReminderAt theo đúng notification; không N+1 query notification theo từng SV.

```js
expect(overview.watchItems.map(x => x.registrationId)).toEqual([approvedUnsubmittedId]);
expect(overview.attentionItems.filter(x => x.registrationId === submittedId && x.kind === 'BM01_REVIEW_PENDING')).toHaveLength(1);
```

- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/lecturerOverviewService.test.js tests/integration/lecturerOverviewAuthorization.routes.test.js`.
- [ ] **Step 3: Thực hiện.** Bổ sung deadline vào semester select, xây watchItems theo registration và trạng thái BM01; đọc reminder đã gửi bằng khóa từ plan job. Không thêm mục này vào `attentionItems` vì GVHD không nộp thay SV.
- [ ] **Step 4: Chạy lại focused tests; PASS.** Response `/dashboard/lecturer?semesterId=...` không có SV của GVHD khác.
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "feat: track missing BM01 in lecturer overview"`.

### Task 2: Backend chọn một bước tiếp theo cho sinh viên

**Files:** Create `backend/src/services/studentDashboardActionService.js`, `backend/tests/services/studentDashboardActionService.test.js`; modify `backend/src/controllers/dashboardController.js`; extend `backend/tests/integration/dashboardTriageAndStudentData.test.js`, `backend/tests/controllers/dashboardSemesterFallback.test.js`.

**Interfaces:** `buildStudentNextAction({ registration, semester, tasks, allowedActions, now }): { kind, title, description, dueAt, target, sourceStatus, canAct } | null`. `/api/dashboard/student` thêm `data.nextAction`; `target` là route nội bộ như `/student/topics`, `/student/submissions`, `/student/grades`, chỉ khi cửa sổ nghiệp vụ và quyền cho phép. Trạng thái chờ có `canAct: false` và không có nút mutation.

- [ ] **Step 1: Viết test thất bại.** Không registration → chọn đề tài; `PENDING` → chờ GVHD; `APPROVED` → nộp BM01; đã nộp → chờ duyệt; cần sửa → sửa/nộp lại; BM01 đạt → BM02; BM03/BM04/bảo vệ/lưu chiểu theo trạng thái thật. Deadline chỉ từ nguồn có thật, thiếu permission/cửa sổ đóng → không có CTA sai. Không trả điểm BM05 chưa công bố.

```js
expect(buildStudentNextAction({ registration: approved, semester, tasks: [], allowedActions: ['SUBMIT_BM01'], now }).kind).toBe('SUBMIT_BM01');
expect(buildStudentNextAction({ registration: pending, semester, tasks: [], allowedActions: [], now }).canAct).toBe(false);
```

- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/studentDashboardActionService.test.js tests/integration/dashboardTriageAndStudentData.test.js tests/controllers/dashboardSemesterFallback.test.js`.
- [ ] **Step 3: Thực hiện service và response.** Dùng trạng thái đăng ký/nguồn BM thật và capability hiện có, không suy từ text hoặc role ở client. Giữ `data.nextAction = null` khi chưa thể xác định an toàn.
- [ ] **Step 4: Chạy lại focused tests; PASS.** Kiểm response không có ngày/mã mặc định.
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "feat: expose student next academic action"`.

### Task 3: Tổng quan GVHD có việc và vùng theo dõi riêng

**Files:** Modify `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`, `frontend/src/components/lecturer/OverviewKpis.jsx`, `frontend/src/components/lecturer/AttentionQueue.jsx`; create `frontend/src/components/lecturer/BM01WatchList.jsx`, `frontend/tests/lecturerBM01WatchDashboard.test.js`.

**Interfaces:** Dùng `watchItems` Task 1 và `attentionItems` hiện có; `BM01WatchList({ items })` hiển thị SV, hạn, còn hạn/quá hạn, lần nhắc gần nhất và nút “Xem quá trình”. KPI chọn từ count việc/theo dõi > 0 trong đợt; không cố định bốn vị trí. Không gọi endpoint nhắc thủ công.

- [ ] **Step 1: Viết test thất bại.** SV chưa nộp xuất hiện, link đúng ID; sau khi nộp biến khỏi watch; hạn null hiện “Chưa đặt hạn”; quá hạn có chữ rõ; `lastReminderAt` có nguồn; không có nút “Nhắc nộp”; KPI ẩn khi count 0; lỗi query có retry.

```js
assert.match(renderedText, /Sinh viên chưa nộp BM01/);
assert.equal(renderedText.includes('Nhắc nộp'), false);
```

- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix frontend test -- tests/lecturerBM01WatchDashboard.test.js`.
- [ ] **Step 3: Thực hiện UI.** Giữ vùng việc GVHD có thể thực hiện; đặt watch riêng, không giả hạn hoặc đưa việc SV vào action queue. 375px xếp dọc, trạng thái không chỉ dùng màu, focus nhìn thấy được.
- [ ] **Step 4: Chạy lại focused test và `npm --prefix frontend run build`; PASS.** Kiểm link `/lecturer/students/:registrationId` trên SV thật.
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "feat: show BM01 supervision on lecturer dashboard"`.

### Task 4: Tổng quan sinh viên chỉ dẫn bước tiếp theo bằng dữ liệu thật

**Files:** Modify `frontend/src/pages/student/StudentDashboardPage.jsx`, `frontend/src/queries/dashboardQueries.js`, `frontend/src/services/dashboardService.js`; create `frontend/tests/studentNextActionDashboard.test.js`; update `frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`.

**Interfaces:** `useStudentDashboard(scope)` query `/dashboard/student`; trang hiển thị `nextAction` Task 2 ở đầu, link chỉ khi `canAct` và target hợp lệ. Thông tin phụ từ response thật, không tạo mã/ngày/quyết định/tỷ lệ từ fallback literal.

- [ ] **Step 1: Viết test thất bại.** `APPROVED` có CTA nộp BM01 và hạn thật; `PENDING` là chờ GVHD; đã nộp là chờ xét duyệt; null nextAction/không registration, lỗi mạng có empty/retry; thiếu số quyết định/mã/khóa không hiện các giá trị mẫu. Kiểm 375px và bàn phím.

```js
assert.match(renderedText, /Nộp BM01/);
assert.equal(renderedText.includes('458/QĐ'), false);
```

- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix frontend test -- tests/studentNextActionDashboard.test.js src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`.
- [ ] **Step 3: Thực hiện query và UI.** Đặt một khối bước tiếp theo nổi bật; cập nhật các khối phụ theo trạng thái thật, bỏ `DA-2026-KTPM-04`, `458/QĐ...`, `20/09/2026`, `2022 - 2026`, `HK1 2026–2027` và phần trăm suy diễn. Không hiển thị thông tin chưa công bố.
- [ ] **Step 4: Chạy lại focused tests và `npm --prefix frontend run build`; PASS.** Kiểm một SV chưa đăng ký, một SV `APPROVED`, một SV đã nộp BM01.
- [ ] **Step 5: Commit đúng tệp Task 4.** `git commit -m "feat: show real student next action"`.

## Final verification

- [ ] Chạy focused backend/frontend tests Tasks 1–4, build, và kiểm response theo hai actor/đợt; chỉ mở rộng suite để xử lý rủi ro cụ thể.
- [ ] Rà quyền, dữ liệu giả, icon/nút, UTF-8 và `git status` trước khi báo hoàn thành.
