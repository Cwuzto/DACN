# Academic Print Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In BM02, BM02-A, BM03, BM04, BM05 có nội dung thật trên A4 từ mọi điểm in, không bị CSS làm trắng/cắt trang.

**Architecture:** Giữ `window.print()` và hộp thoại “Lưu dưới dạng PDF”. Một print surface dùng chung trong AntD modal điều khiển print media theo chế độ, còn các sheet nhận dữ liệu đúng phiên bản và không tự điền giá trị giả. BM01 dùng PDF tải lên, được xử lý ở kế hoạch BM01 riêng.

**Tech Stack:** React 19, Ant Design 6, Vite, CSS print media, Playwright, Node test.

**Spec:** `docs/superpowers/specs/2026-11-18-academic-forms-print-and-online-submission-design.md` (§2, §6–8).

**Order:** Chạy kế hoạch này trước BM01, BM02 và BM03; sau đó mỗi luồng dùng chung print surface đã kiểm thử.

## Global Constraints

- `TopicRegistration` là trục hồ sơ; không dùng `group/groupMember`; 1 sinh viên/đề tài, tối đa 10 sinh viên/GVHD.
- Không tạo PDF ở backend cho các sheet này; người dùng chọn “Lưu dưới dạng PDF” trong hộp thoại trình duyệt.
- Không hiển thị dữ liệu giả, chữ ký giả, điểm BM05 chưa công bố hoặc BM03 hoàn tất trước khi đủ điều kiện.
- File `.md`, `.js`, `.jsx`, `.json`, `.prisma` UTF-8 không BOM; icon nút qua `@ant-design/icons` prop `icon`, nhãn không chứa ký tự đồ họa thô.
- Giữ thay đổi ngoài phạm vi trong working tree; chỉ commit file của task sau khi test PASS.

## Review Focus

1. In từ trang sinh viên và từ modal hồ sơ: sheet hiện khi print media bật, bản tin không chen vào (Task 1).
2. Zoom preview 70–140% hoặc modal cuộn: PDF vẫn đủ A4 và không mang transform/overflow (Task 1).
3. Thiếu dữ liệu API: nút in bị chặn với thông báo cụ thể, không xuất trang trắng/giá trị giả (Task 2).
4. BM02/BM05 có dữ liệu: sheet dùng đúng `BM02Submission`/`summaryRecord`, không dùng tên lớp/nơi sinh/điểm mẫu (Task 2).
5. Kết quả BM05 chưa công bố hoặc BM03 chưa chốt: không xuất như hồ sơ hoàn tất (Task 2).

---

### Task 1: Print surface chỉ hiện tài liệu đang chọn

**Files:**
- Modify: `frontend/src/index.css`, `frontend/src/components/prints/AcademicFormPrintModal.jsx`, `frontend/src/components/prints/A4PageContainer.jsx`, `frontend/src/pages/common/HomePage.jsx`
- Modify if failing: `frontend/src/pages/student/student-opendesign.css`, `frontend/src/pages/lecturer/lecturer-opendesign.css`, `frontend/src/pages/admin/admin-opendesign.css`
- Create: `frontend/e2e/academicFormsPrint.spec.js`

**Interfaces:**
- Produces: modal mở có `data-academic-print-root`; khi bấm in, `body` gắn `data-print-mode="academic-form"` đến `afterprint` và gỡ khi đóng/unmount.
- Preserves: nút in bản tin đặt `data-print-mode="announcement"` trước `window.print()` và cleanup sau in; giao diện màn hình không đổi.

- [x] **Step 1: Viết test fail.** `academicFormsPrint.spec.js`: bật `print` media, mở BM02 từ trang sinh viên rồi assert vùng BM02 visible, bản tin/sidebars hidden; đặt zoom khác 100% và assert print root không transform/scroll clip; kiểm tra cùng hành vi tại hồ sơ học vụ. Nút in bản tin vẫn chỉ hiện bản tin.
- [x] **Step 2: Chạy test để xác nhận fail.** `npm --prefix frontend run test:e2e -- e2e/academicFormsPrint.spec.js` → FAIL vì `body * { visibility: hidden !important; }` trong `index.css` chỉ hiện bản tin.
- [x] **Step 3: Sửa CSS và modal.** Scope quy tắc in bản tin theo `data-print-mode="announcement"`, cập nhật hai nút in ở `HomePage`; print mode academic chỉ hiện `data-academic-print-root` và ancestor cần thiết. Trong print media bỏ modal fixed/maxHeight/overflow và zoom transform; A4 giữ ngắt trang. Cleanup print mode ở `afterprint` và unmount.
- [x] **Step 4: Chạy lại test và build.** E2E bước 2 PASS; `npm --prefix frontend run lint` và `npm --prefix frontend run build` PASS.
- [x] **Step 5: Commit.** `fix(print): isolate academic form print surface`.

### Task 2: Sheet dùng đúng dữ liệu thật và bộ hồ sơ nêu rõ BM01 riêng

**Files:**
- Modify: `frontend/src/components/prints/AcademicDossierDrawer.jsx`, `frontend/src/components/prints/BM02PrintSheet.jsx`, `frontend/src/components/prints/BM02APrintSheet.jsx`, `frontend/src/components/prints/BM03PrintSheet.jsx`, `frontend/src/components/prints/BM04PrintSheet.jsx`, `frontend/src/components/prints/BM05PrintSheet.jsx`
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`, `frontend/src/pages/lecturer/ProgressTrackingPage.jsx`, `frontend/src/components/lecturer/BM04EvaluationModal.jsx`
- Create: `frontend/runtime-tests/academicPrintData.spec.jsx`; extend `frontend/e2e/academicFormsPrint.spec.js`

**Interfaces:**
- Produces: `BM02PrintSheet({ registration, submission, verification = null })`, `BM05PrintSheet({ registration, summaryRecord })`; thiếu `verification` thì ô ký ở trạng thái chờ, không suy diễn từ tên. Các sheet khác nhận bản ghi đã tải của đúng phiên bản.
- Produces: hồ sơ học vụ có hai hành động rõ: tải/in PDF BM01 riêng và in BM02–BM05/BM02-A đủ điều kiện bằng trình duyệt; không trộn PDF upload vào `window.print()`.

- [x] **Step 1: Viết test fail.** Fixture có tiêu đề/nhiệm vụ BM02, kết quả BM05 và trạng thái chữ ký khác giá trị mặc định; assert text bản in khớp fixture, không có `D22CNTT01`, `2022 - 2026`, điểm mẫu hoặc “đã ký” khi thiếu event. Fixture thiếu dữ liệu hoặc BM05 chưa công bố phải chặn in; BM03 chưa chốt không ghi “đạt” mặc định. Assert hành động in bộ hồ sơ chỉ ra BM01 là tệp riêng.
- [x] **Step 2: Chạy test fail.** `npm --prefix frontend run test:runtime -- runtime-tests/academicPrintData.spec.jsx`; `npm --prefix frontend run test:e2e -- e2e/academicFormsPrint.spec.js` → FAIL ở prop/placeholder hoặc điều kiện in.
- [x] **Step 3: Nối dữ liệu và trạng thái.** Thay prop `task` bằng `submission` của `BM02PrintSheet`, truyền `summaryRecord` cho BM05; dùng dữ liệu thật, trạng thái loading/error/không đủ điều kiện. Bỏ fallback nhân thân và kết luận đạt giả. BM02 chưa đủ xác nhận chỉ được xem/in với nhãn bản nháp; BM03 chưa chốt chỉ xem nhật ký trên màn hình, không xuất BM03 hoàn tất. Kế hoạch BM02/BM03 sau sẽ cung cấp sự kiện ký và mốc chốt chính thức.
- [x] **Step 4: Chạy regression.** Test bước 2 PASS; `node --test frontend/src/components/prints/__tests__/a4Foundation.test.js frontend/src/components/prints/__tests__/bm01AndBm02Print.test.js frontend/src/components/prints/__tests__/bm02aAndBm03Print.test.js frontend/src/components/prints/__tests__/bm04AndBm05Print.test.js`, lint/build PASS. Tạo PDF từ mỗi nơi in và kiểm tra text/không cắt trang bằng Playwright artifact hoặc `pypdf` cục bộ.
- [x] **Step 5: Commit.** `fix(print): render real academic form data`.
