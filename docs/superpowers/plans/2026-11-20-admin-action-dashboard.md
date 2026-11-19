# Admin Action Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tổng quan Admin hiển thị việc thuộc quyền xử lý trong đợt đang chọn bằng thẻ động và số liệu thật.

**Architecture:** Backend tổng hợp từng loại việc từ trạng thái nghiệp vụ và quyền actor, trả count/đích/bộ lọc theo semester. Frontend thay ba thẻ và các khối demo bằng hàng đợi việc và trạng thái rỗng trung thực. Không suy ra một giai đoạn chung cho mọi registration.

**Tech Stack:** Express 5, Prisma 7/PostgreSQL, Jest/Supertest, React 19, TanStack Query, Ant Design 6, Node test/Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-role-dashboard-next-actions-design.md` (mục 1–4, 8).

## Global Constraints

- `TopicRegistration` là trục, 1 SV/1 đề tài, tối đa 10 SV/GVHD; không dùng `group/groupMember`.
- Chỉ trả việc Admin có capability và scope được phép; không đưa việc chờ GVHD/SV vào hàng đợi Admin.
- Tất cả count phải theo `selectedSemesterId`; thẻ chỉ hiện khi count > 0, tối đa ba thẻ đầu, số loại việc còn lại trong danh sách.
- Không dùng số, tỷ lệ, năm học, trạng thái mốc hoặc phân bổ chuyên ngành ghi cứng. Thiếu dữ liệu là trạng thái rỗng hoặc lỗi, không là `0` giả.
- Sửa backend trước frontend; giữ UTF-8 không BOM, `@ant-design/icons` qua prop `icon` của Button và nhãn tiếng Việt thuần.
- Workspace có thay đổi không thuộc kế hoạch; mỗi commit chỉ stage tệp của task.

## Review Focus

1. Admin chọn học kỳ B trong khi A có nhiều việc: mọi thẻ và danh sách chỉ đếm B (Task 1, 2).
2. Registration `PENDING` chờ GVHD: không được tính là “đề tài chờ Admin duyệt” (Task 1).
3. Hồ sơ chưa có hội đồng nhưng chưa đủ điều kiện phân công: không vào thẻ hội đồng (Task 1).
4. Actor có quyền xem dashboard nhưng thiếu permission xử lý BM02/kết quả: không thấy mục hoặc count đó (Task 1).
5. Đợt không có việc hoặc API lỗi: hiển thị trạng thái trống/lỗi riêng, không dựng ba thẻ 0 hay mốc “HIỆN TẠI” (Task 2).

---

## File map

| Tệp | Trách nhiệm |
|---|---|
| `backend/src/services/adminDashboardActionsService.js` | Tính loại việc, count, ưu tiên, target theo actor và semester |
| `backend/src/controllers/dashboardController.js`, `backend/src/routes/dashboardRoutes.js` | Endpoint Admin và quyền truy cập |
| `frontend/src/services/dashboardService.js`, `frontend/src/queries/dashboardQueries.js` | Lấy dữ liệu theo scope + semester |
| `frontend/src/pages/admin/DashboardPage.jsx` | Hàng đợi, thẻ động, trạng thái rỗng/lỗi |
| `frontend/src/pages/admin/CouncilAssignmentPage.jsx` và trang đích liên quan | Đọc bộ lọc URL khi chưa hỗ trợ |

### Task 1: Backend trả danh mục việc Admin đúng đợt và đúng quyền

**Files:** Create `backend/src/services/adminDashboardActionsService.js`, `backend/tests/services/adminDashboardActionsService.test.js`; modify `backend/src/controllers/dashboardController.js`, `backend/src/routes/dashboardRoutes.js`; extend `backend/tests/integration/dashboardTriageAndStudentData.test.js`, `backend/tests/integration/dashboard.routes.test.js`.

**Interfaces:** `buildAdminDashboardActions({ actor, semesterId, db, now }): Promise<{ semesterId, items: Array<{ kind, count, title, description, dueAt, priority, target, requiredPermission, sourceStatus }> }>`; `GET /api/dashboard/admin-actions?semesterId=<id>` trả `{ success: true, data }`. `kind` gồm `TOPIC_REVIEW`, `OUTLINE_COUNCIL_ASSIGN`, `BM02_REVIEW`, `DEFENSE_COUNCIL_ASSIGN`, và các bước result được phép (`RESULT_APPROVE`, `RESULT_LOCK`, `RESULT_PUBLISH`). `target` là đường dẫn + bộ lọc để mở đúng nơi xử lý.

- [ ] **Step 1: Viết test thất bại.** Test hai đợt, `PENDING` registration, hồ sơ thiếu HĐ nhưng chưa đủ điều kiện, BM02 chưa nộp/đã nộp, hồ sơ `DEFENSE_READY`, quyền thiếu; assert count theo ID registration duy nhất, kind và target đúng. Test endpoint từ actor ngoài scope bị chặn.

```js
expect(result.items.find(x => x.kind === 'OUTLINE_COUNCIL_ASSIGN')?.count).toBe(eligibleInSelectedSemester);
expect(result.items.some(x => x.kind === 'BM02_REVIEW')).toBe(false); // BM02 chưa nộp
expect(result.items.some(x => x.kind === 'TOPIC_REVIEW' && x.count === pendingMentorRegistrations)).toBe(false);
```

- [ ] **Step 2: Chạy test để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/adminDashboardActionsService.test.js tests/integration/dashboardTriageAndStudentData.test.js tests/integration/dashboard.routes.test.js`.
- [ ] **Step 3: Thực hiện service và endpoint.** Tái dùng điều kiện eligibility/permission của các API nghiệp vụ; không tính “thiếu council” thô hoặc cộng hai loại council. Kiểm scope bằng cơ chế `requireDashboardReportScope` hiện có và quyền từng action. Không đổi kết quả các endpoint dashboard cũ ngoài chỗ cần sửa số liệu sai.
- [ ] **Step 4: Chạy lại test trên; PASS.** Đối chiếu count mỗi kind với danh sách mà target lọc ra.
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "feat: expose scoped admin dashboard actions"`.

### Task 2: Thay tổng quan Admin bằng việc và số liệu thật

**Files:** Modify `frontend/src/pages/admin/DashboardPage.jsx`, `frontend/src/services/dashboardService.js`, `frontend/src/queries/dashboardQueries.js`; modify trang đích nhận bộ lọc nếu cần; create `frontend/tests/adminActionDashboard.test.js`; update `frontend/src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`.

**Interfaces:** `useAdminDashboardActions(scope, semesterId, enabled)` gọi endpoint Task 1 với query key gồm scope + semesterId. Page dùng `items.filter(count > 0)` sắp theo priority/dueAt/luồng; ba item đầu là thẻ, các item còn lại trong hàng đợi. `target` từ backend được kiểm là route nội bộ hợp lệ trước điều hướng.

- [ ] **Step 1: Viết test thất bại.** Chọn đợt đổi count/thẻ; 0 việc hiện thông báo; API lỗi hiện retry; item không có quyền hoặc count 0 không có thẻ; click mở route kèm bộ lọc; không còn `64%`, bốn dòng phân bổ tĩnh, năm học mặc định, mốc “HIỆN TẠI”, ba thẻ cố định.

```js
assert.equal(renderedCards.length, positiveActionKindsInSelectedSemester);
assert.equal(screen.queryByText('Hội đồng chấm bảo vệ'), null); // chưa phát sinh việc bảo vệ
```

- [ ] **Step 2: Chạy focused test để thấy FAIL.** `npm --prefix frontend test -- tests/adminActionDashboard.test.js src/pages/__tests__/dashboardRealDataAndFallbackCleanup.test.js`.
- [ ] **Step 3: Thực hiện page và query.** Giữ bộ chọn đợt; tất cả khối còn lại dùng dữ liệu cùng đợt hoặc ẩn khi không có nguồn. Hiển thị trạng thái chữ và liên kết đúng trang; layout dọc ở 375px, focus/heading đúng. Nếu trang đích chưa nhận filter, bổ sung đọc query param cùng task này.
- [ ] **Step 4: Chạy lại focused tests và `npm --prefix frontend run build`; PASS.** Kiểm một đợt đăng ký và một đợt chưa có dữ liệu.
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "feat: show real admin next actions"`.

## Final verification

- [ ] Chạy lại focused backend/frontend tests, build và kiểm thao tác trên hai đợt; chỉ mở rộng test khi phát hiện rủi ro cụ thể.
- [ ] Rà `git status`, UTF-8, quyền, link đích và không có thay đổi ngoài scope trong commit.
