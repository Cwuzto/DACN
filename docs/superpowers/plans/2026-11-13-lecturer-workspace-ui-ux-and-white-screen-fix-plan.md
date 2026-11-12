# Kế Hoạch Triển Khai: Sửa Lỗi Trắng Trang & Tối Ưu Hóa Trải Nghiệm Phân Hệ Giảng Viên (Lecturer Workspace)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục dứt điểm lỗi trắng màn hình (TDZ ReferenceError), ngăn chặn crash unmount bằng Error Boundary, sửa lệch route chấm điểm và kích hoạt tab deep-linking mượt mà, đồng thời tinh gọn thanh điều hướng của Giảng viên thành 5 mục cốt lõi chuẩn UI/UX Pro Max.

**Architecture:** Bổ sung lớp phòng thủ `ErrorBoundary` chuẩn React ở tầng AppLayout và Root Routes; chuẩn hóa thứ tự khai báo biến trong `ProgressTrackingPage`; kết nối `useSearchParams()` để đồng bộ trạng thái URL với tabs nội bộ; quy hoạch lại `navigationRegistry.js` phân định rành mạch vai trò GVHD và Ban điều hành Viện.

**Tech Stack:** React 19, React Router v7, Ant Design 6, Node.js Test Runner, Vite.

**Spec:** [docs/superpowers/specs/2026-11-13-lecturer-workspace-ui-ux-and-white-screen-fix-design.md](file:///d:/DACN/docs/superpowers/specs/2026-11-13-lecturer-workspace-ui-ux-and-white-screen-fix-design.md)

## Global Constraints

- 100% tệp tin phải lưu ở định dạng UTF-8 (no BOM) theo Rule 2.4.
- 100% nút bấm tuân thủ Quy tắc 2.6 trong AGENTS.md: chỉ dùng prop `icon={<IconComponent />}` từ `@ant-design/icons`, không chèn emoji hay ký tự thô trong text nhãn.
- Bảo toàn mô hình `TopicRegistration`, không làm sai lệch các API backend hay phá vỡ test suite hiện có.

## Review Focus

1. `ProgressTrackingPage`: Sinh viên trong danh sách chưa có `progressPercent` (undefined/null) không được gây crash màn hình.
2. `ErrorBoundary`: Khi component con ném ngoại lệ bất kỳ, màn hình phải hiển thị fallback UI chuyên nghiệp kèm nút "Tải lại trang" và "Về Dashboard", tuyệt đối không để lộ trang trắng.
3. `GradingPage`: Nút "Vào chấm điểm" và "Xem phiếu chấm" phải điều hướng chính xác đến `/lecturer/grading/sheet/:registrationId`.
4. `TopicApprovalPage`: URL chứa `?tab=bm01` phải kích hoạt ngay tab "Hội Đồng Thẩm Định Đề Cương", `?tab=bm02a` mở tab "Duyệt phiếu đổi tên BM02-A".
5. `navigationRegistry`: Giảng viên thông thường chỉ thấy tối đa 5 mục cốt lõi trong khối "HƯỚNG DẪN ĐỒ ÁN"; chỉ khi có quyền quản trị mới thấy thêm khối "ĐIỀU HÀNH HỌC VỤ & HỘI ĐỒNG".

---

### Task 1: Sửa Lỗi Temporal Dead Zone (TDZ) trong `ProgressTrackingPage.jsx`

**Files:**
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx:435-442`
- Test: `frontend/src/pages/lecturer/__tests__/progressTrackingTdz.test.js`

**Interfaces:**
- Consumes: `s.status`, `s.progressPercent` từ danh sách `filteredStudents`.
- Produces: `sPassed`, `sProgress` khai báo theo đúng trật tự từ vựng.

- [x] **Step 1: Viết test kiểm tra không còn lỗi TDZ trong `ProgressTrackingPage.jsx`**

```javascript
// frontend/src/pages/lecturer/__tests__/progressTrackingTdz.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('ProgressTrackingPage: sPassed is declared BEFORE sProgress to eliminate TDZ ReferenceError', () => {
    const src = read('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');
    const passedIndex = src.indexOf("const sPassed = s.status === 'COMPLETED'");
    const progressIndex = src.indexOf('const sProgress = s.progressPercent ??');

    assert.ok(passedIndex !== -1, 'sPassed declaration must exist');
    assert.ok(progressIndex !== -1, 'sProgress declaration must exist');
    assert.ok(
        passedIndex < progressIndex,
        'sPassed must be declared BEFORE sProgress to prevent TDZ ReferenceError'
    );
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `node --test frontend/src/pages/lecturer/__tests__/progressTrackingTdz.test.js`
Expected: FAIL với assertion error `sPassed must be declared BEFORE sProgress`.

- [x] **Step 3: Đảo thứ tự khai báo trong `ProgressTrackingPage.jsx`**

Trong `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`, đảo dòng khai báo `sPassed` lên trước `sProgress`:
```javascript
const isSel = s.id === reg?.id;
const sPassed = s.status === 'COMPLETED' || s.status === 'DEFENDED' || s.status === 'DEFENSE_READY';
const sProgress = s.progressPercent ?? (sPassed ? 100 : 0);
const sRisk = sProgress < 50;
```

- [x] **Step 4: Chạy test xác nhận test đã PASS**

Run: `node --test frontend/src/pages/lecturer/__tests__/progressTrackingTdz.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/pages/lecturer/ProgressTrackingPage.jsx frontend/src/pages/lecturer/__tests__/progressTrackingTdz.test.js
git commit -m "fix(lecturer): fix TDZ ReferenceError in ProgressTrackingPage student list"
```

---

### Task 2: Xây Dựng `ErrorBoundary.jsx` & Bọc Toàn Cục Tránh Trắng Trang

**Files:**
- Create: `frontend/src/components/common/ErrorBoundary.jsx`
- Modify: `frontend/src/App.jsx:140-155`
- Modify: `frontend/src/components/layout/AppLayout.jsx:420-435`
- Test: `frontend/src/pages/__tests__/errorBoundaryUi.test.js`

**Interfaces:**
- Produces: `<ErrorBoundary fallbackComponent={...}>{children}</ErrorBoundary>`
- Consumes: React standard `componentDidCatch(error, errorInfo)` & `static getDerivedStateFromError(error)`.

- [x] **Step 1: Viết test cho `ErrorBoundary.jsx`**

```javascript
// frontend/src/pages/__tests__/errorBoundaryUi.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('ErrorBoundary: component exists, handles errors, and adheres to Rule 2.6', () => {
    const src = read('frontend/src/components/common/ErrorBoundary.jsx');
    assert.match(src, /class ErrorBoundary extends React\.Component|class ErrorBoundary extends Component/, 'Must be a class component');
    assert.match(src, /getDerivedStateFromError/, 'Must implement getDerivedStateFromError');
    assert.match(src, /componentDidCatch/, 'Must implement componentDidCatch');
    assert.match(src, /ReloadOutlined|HomeOutlined/, 'Must use Ant Design icon components');
    assert.ok(!/[←→+🤖📋✓✏️👥🗑️🔓▾▴↗]/.test(src), 'Must strictly adhere to Rule 2.6 (no raw symbols in buttons)');
});

test('AppLayout & App: Integrates ErrorBoundary around routes and outlets', () => {
    const appSrc = read('frontend/src/App.jsx');
    const layoutSrc = read('frontend/src/components/layout/AppLayout.jsx');
    assert.match(appSrc, /ErrorBoundary/, 'App.jsx must import and use ErrorBoundary');
    assert.match(layoutSrc, /ErrorBoundary/, 'AppLayout.jsx must import and wrap outlet with ErrorBoundary');
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `node --test frontend/src/pages/__tests__/errorBoundaryUi.test.js`
Expected: FAIL (file does not exist).

- [x] **Step 3: Triển khai `ErrorBoundary.jsx` & tích hợp vào `App.jsx` và `AppLayout.jsx`**

Tạo `frontend/src/components/common/ErrorBoundary.jsx`:
- Hiển thị card lỗi học thuật chuẩn màu Pine Teal (`#0F766E`), nút "Tải lại trang" (`icon={<ReloadOutlined />}`) và nút "Về trang chủ" (`icon={<HomeOutlined />}`).
- Bọc quanh `<Outlet />` trong `AppLayout.jsx` và bọc quanh các `<Routes>` trong `App.jsx`.

- [x] **Step 4: Chạy test xác nhận test đã PASS**

Run: `node --test frontend/src/pages/__tests__/errorBoundaryUi.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/common/ErrorBoundary.jsx frontend/src/App.jsx frontend/src/components/layout/AppLayout.jsx frontend/src/pages/__tests__/errorBoundaryUi.test.js
git commit -m "feat(ui): add global ErrorBoundary to prevent blank white screens"
```

---

### Task 3: Sửa Route Chấm Điểm trong `GradingPage.jsx`

**Files:**
- Modify: `frontend/src/pages/lecturer/GradingPage.jsx:326`
- Test: `frontend/src/pages/lecturer/__tests__/gradingPageRouteAlignment.test.js`

**Interfaces:**
- Consumes: `cand.id` từ danh sách sinh viên bảo vệ.
- Produces: Đường dẫn `/lecturer/grading/sheet/:registrationId` khớp 100% với route `App.jsx`.

- [x] **Step 1: Viết test kiểm tra route chấm điểm trong `GradingPage.jsx`**

```javascript
// frontend/src/pages/lecturer/__tests__/gradingPageRouteAlignment.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('GradingPage: Navigates to exact route /lecturer/grading/sheet/:id', () => {
    const src = read('frontend/src/pages/lecturer/GradingPage.jsx');
    assert.match(
        src,
        /navigate\(`\/lecturer\/grading\/sheet\/\$\{cand\.id\}`\)/,
        'Grading button must navigate to /lecturer/grading/sheet/:id'
    );
    assert.ok(
        !src.includes('navigate(`/lecturer/grading/${cand.id}`)'),
        'Legacy invalid route without /sheet/ must be completely removed'
    );
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `node --test frontend/src/pages/lecturer/__tests__/gradingPageRouteAlignment.test.js`
Expected: FAIL.

- [x] **Step 3: Sửa đường dẫn trong `GradingPage.jsx`**

Thay `navigate(`/lecturer/grading/${cand.id}`)` bằng `navigate(`/lecturer/grading/sheet/${cand.id}`)`.

- [x] **Step 4: Chạy test xác nhận test đã PASS**

Run: `node --test frontend/src/pages/lecturer/__tests__/gradingPageRouteAlignment.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/pages/lecturer/GradingPage.jsx frontend/src/pages/lecturer/__tests__/gradingPageRouteAlignment.test.js
git commit -m "fix(lecturer): align grading sheet route in GradingPage to prevent 404 fallback"
```

---

### Task 4: Kích Hoạt Tab Deep-Linking (`TopicApprovalPage`, `ProgressTrackingPage`, `ProjectPeriodPage`)

**Files:**
- Modify: `frontend/src/pages/lecturer/TopicApprovalPage.jsx`
- Modify: `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`
- Modify: `frontend/src/pages/admin/ProjectPeriodPage.jsx`
- Test: `frontend/src/pages/__tests__/tabDeepLinking.test.js`

**Interfaces:**
- Consumes: `useSearchParams()` từ `react-router-dom`.
- Produces: Tự động chuyển `activeTab` khi URL có `?tab=bm01`, `?tab=bm04`, `?tab=decisions`, `?tab=bm02a`.

- [x] **Step 1: Viết test cho Tab Deep-linking**

```javascript
// frontend/src/pages/__tests__/tabDeepLinking.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('TopicApprovalPage: Synchronizes activeTab with ?tab=bm01 or ?tab=bm02a query params', () => {
    const src = read('frontend/src/pages/lecturer/TopicApprovalPage.jsx');
    assert.match(src, /useSearchParams/, 'TopicApprovalPage must import and use useSearchParams');
    assert.match(src, /bm01/, 'Must handle bm01 tab');
});

test('ProgressTrackingPage: Synchronizes activeTab with ?tab=bm04 query param', () => {
    const src = read('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');
    assert.match(src, /tabParam === ['"]bm04['"]|searchParams\.get\(['"]tab['"]\)/, 'ProgressTrackingPage must read tab parameter');
});

test('ProjectPeriodPage: Handles tab=decisions query param gracefully', () => {
    const src = read('frontend/src/pages/admin/ProjectPeriodPage.jsx');
    assert.match(src, /tabParam === ['"]decisions['"]|params\.get\(['"]tab['"]\) === ['"]decisions['"]/, 'ProjectPeriodPage must handle decisions tab');
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `node --test frontend/src/pages/__tests__/tabDeepLinking.test.js`
Expected: FAIL.

- [x] **Step 3: Triển khai đồng bộ Tab theo Query Params**

- Trong `TopicApprovalPage.jsx`: Thêm `useSearchParams()`, `useEffect` lắng nghe `searchParams.get('tab')`: nếu là `'bm01'`, set `activeTab('outline')`; nếu là `'bm02a'`, set `activeTab('bm02a')`; nếu là `'mentor'`, set `activeTab('mentor')`.
- Trong `ProgressTrackingPage.jsx`: Lắng nghe `searchParams.get('tab')`: nếu là `'bm04'`, set `activeTab('archive')` và cuộn hoặc mở vùng BM04; hỗ trợ thêm các giá trị `'tasks'`, `'meeting-logs'`, `'checkpoints'`.
- Trong `ProjectPeriodPage.jsx`: Lắng nghe `tab === 'decisions'`, tự động mở modal danh sách quyết định hoặc highlight đợt hiện tại.

- [x] **Step 4: Chạy test xác nhận test đã PASS**

Run: `node --test frontend/src/pages/__tests__/tabDeepLinking.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/pages/lecturer/TopicApprovalPage.jsx frontend/src/pages/lecturer/ProgressTrackingPage.jsx frontend/src/pages/admin/ProjectPeriodPage.jsx frontend/src/pages/__tests__/tabDeepLinking.test.js
git commit -m "feat(navigation): enable query-param tab deep-linking across lecturer workflows"
```

---

### Task 5: Tinh Gọn & Phân Tầng Menu Giảng Viên (`navigationRegistry.js`)

**Files:**
- Modify: `frontend/src/config/navigationRegistry.js`
- Test: `frontend/src/pages/__tests__/lecturerNavigationStructure.test.js`

**Interfaces:**
- Consumes: `permissionSet` của Giảng viên.
- Produces: Danh sách menu tinh gọn (5 mục cốt lõi GVHD + nhóm Quản trị rõ ràng).

- [x] **Step 1: Viết test cho cấu trúc menu tinh gọn của Giảng viên**

```javascript
// frontend/src/pages/__tests__/lecturerNavigationStructure.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleNavigation, NAVIGATION_REGISTRY } from '../../config/navigationRegistry.js';

test('Lecturer navigation: Regular GVHD sees exactly the 5 core teaching items', () => {
    const gvhdPerms = [
        'VIEW_MY_TOPICS',
        'VIEW_MENTORED_STUDENTS',
        'VIEW_CHECKPOINTS',
        'VIEW_BM04_EVALUATIONS',
        'VIEW_DEFENSE_GRADING',
    ];
    const groups = getVisibleNavigation(gvhdPerms);
    const allItems = groups.flatMap((g) => g.items);
    assert.equal(allItems.length, 5, 'Regular GVHD must see exactly 5 core items');
    const routes = allItems.map((i) => i.route);
    assert.ok(routes.includes('/lecturer/topics'));
    assert.ok(routes.includes('/lecturer/approvals'));
    assert.ok(routes.includes('/lecturer/progress'));
    assert.ok(routes.includes('/lecturer/progress?tab=bm04'));
    assert.ok(routes.includes('/lecturer/grading'));
});
```

- [x] **Step 2: Chạy test để xác minh trạng thái**

Run: `node --test frontend/src/pages/__tests__/lecturerNavigationStructure.test.js`

- [x] **Step 3: Cập nhật `navigationRegistry.js` chuẩn hóa nhãn & gom nhóm**

Chuẩn hóa tiêu đề nhóm:
- "HƯỚNG DẪN ĐỒ ÁN" cho các chức năng GVHD.
- "ĐIỀU HÀNH HỌC VỤ & HỘI ĐỒNG" cho các quyền quản lý cấp Viện / Chủ tịch HĐ.
- Đảm bảo tính tương thích ngược 100%.

- [x] **Step 4: Chạy test xác nhận test đã PASS**

Run: `node --test frontend/src/pages/__tests__/lecturerNavigationStructure.test.js`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/config/navigationRegistry.js frontend/src/pages/__tests__/lecturerNavigationStructure.test.js
git commit -m "feat(nav): streamline lecturer navigation structure and group separation"
```

---

### Task 6: Hồi Quy Toàn Diện, Kiểm Thử Build & Xác Nhận Chuẩn UTF-8

**Files:**
- Test toàn bộ: `frontend/` & `backend/`

- [x] **Step 1: Chạy toàn bộ frontend test suite**

Run: `npm --prefix frontend test`
Expected: Tất cả các test suites PASS (188+ tests).

- [x] **Step 2: Chạy toàn bộ backend test suite**

Run: `npm --prefix backend test`
Expected: Tất cả 108 test suites PASS (1.081 tests).

- [x] **Step 3: Chạy production build frontend**

Run: `npm --prefix frontend run build`
Expected: PASS (0 lỗi bundle).

- [x] **Step 4: Xác nhận không có BOM (UTF-8 no BOM)**

Run node script kiểm tra tất cả các file sửa đổi và tạo mới không chứa ký tự `\uFEFF`.

- [x] **Step 5: Cập nhật CLAUDE.md và hoàn tất commit**

