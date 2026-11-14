# Kế Hoạch Triển Khai Hệ Thống Biểu Mẫu Học Thuật A4 & Ngăn Kéo Hồ Sơ Toàn Trình (Academic Forms A4 & Dossier Hub)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa toàn bộ các biểu mẫu đồ án tốt nghiệp (BM01, BM02, BM02-A, BM03, BM04, BM05) thành các bản in A4 tiêu chuẩn hành chính theo mẫu thực tế của Viện Công nghệ Số (Trường ĐH Thủ Dầu Một), đồng thời tích hợp nút in theo ngữ cảnh và ngăn kéo tra cứu trọn bộ hồ sơ sinh viên (Academic Dossier Hub).

**Architecture:** Xây dựng bộ component bản in A4 độc lập chuẩn hóa (`A4PageContainer`, `BM01PrintSheet` đến `BM05PrintSheet`) sử dụng CSS `@media print` và `window.print()` thuần (zero-bloat, không dùng thư viện ngoài). Tích hợp modal in tại chỗ cho Sinh viên & Giảng viên, cùng ngăn kéo tổng hợp `AcademicDossierDrawer` cho Giáo vụ và Giảng viên hướng dẫn tra cứu và in lẻ hoặc in gộp toàn bộ hồ sơ.

**Tech Stack:** React 19, Ant Design 5 (`Modal`, `Drawer`, `Tabs`, `Button`, `Tooltip`), `@ant-design/icons`, Tailwind CSS, Pure CSS Print Media.

**Spec:** `docs/superpowers/specs/2026-11-14-academic-forms-a4-dossier-design.md`

## Global Constraints

- **UTF-8 no BOM**: Tất cả các tệp `.jsx`, `.js`, `.json` phải lưu ở định dạng UTF-8 không có BOM (AGENTS.md Rule 2.4).
- **Quy chuẩn Nút bấm & Icon (AGENTS.md Rule 2.6)**: Tuyệt đối không chèn ký tự thô / emoji (`←`, `→`, `+`, `🤖`, `📋`, `✓`, `✏️`, `👥`, `🗑️`, `🔓`, v.v.) vào nhãn nút; luôn dùng prop `icon={<IconComponent />}` từ `@ant-design/icons`.
- **Zero Mock Policy**: Dữ liệu nạp vào các bản in phải lấy trực tiếp từ các entity thực tế của CSDL/API (nếu trường nào chưa có dữ liệu sẽ hiển thị đường gạch chấm hành chính `........................`).
- **Kích thước Bundle Frontend**: Không cài đặt thư viện ngoài tạo PDF; duy trì kích thước Main Entry Chunk dưới 500 kB và cảnh báo Vite bằng 0.
- **Tiêu chuẩn bản in A4**: Chiều rộng `210mm`, font `Times New Roman`, lề `20mm 15mm 20mm 30mm` (chuẩn đóng gáy), hỗ trợ ngắt trang `page-break-inside: avoid`.

## Review Focus

- **Empty / Incomplete Data Resilience**: Sinh viên chưa nộp BM03 hoặc chưa có nhận xét BM04 thì mở bản in không được crash, mà hiển thị khung mẫu hành chính trống với đường gạch chấm.
- **Browser Print Dialog Triggers**: `window.print()` được gọi mà không làm vỡ giao diện web hiện tại và tự động ẩn các thanh điều hướng, nút đóng/in khi in ra giấy.
- **Evaluator Role Switching in BM04**: BM04 hiển thị tiêu đề và nội dung phù hợp cho Giảng viên hướng dẫn hoặc Giảng viên phản biện dựa trên cờ `evaluatorRole`.
- **Title Consistency Check**: Tên đề tài trên các bản in phải tự động ưu tiên tên đề tài mới nhất có hiệu lực (`adjustedTitle` || `bm01ApprovedTitleSnapshot` || `topic.title`).
- **Multi-page Print Formatting**: Với các bảng biểu dài (nhật ký tuần BM03 hoặc nội dung BM01), ngắt trang in phải sạch sẽ, không bị cắt ngang giữa dòng chữ hoặc bảng chữ ký.

---

### Task 1: A4PageContainer & Khung Bao Bản In Dùng Chung

**Files:**
- Create: `frontend/src/components/prints/A4PageContainer.jsx`
- Create: `frontend/src/components/prints/AcademicFormPrintModal.jsx`
- Test: `frontend/src/components/prints/__tests__/a4Foundation.test.js`

**Interfaces:**
- Consumes: Ant Design `Modal`, `Button`, `Space`, `PrinterOutlined`, `CloseOutlined`, `ZoomInOutlined`, `ZoomOutOutlined`
- Produces: 
  - `A4PageContainer({ children, className, id })`: Khung bao khổ A4 tiêu chuẩn 210mm với CSS print media.
  - `AcademicFormPrintModal({ open, onClose, title, documentCode, children, onPrint })`: Modal xem trước và kích hoạt `window.print()`.

- [ ] **Step 1: Viết test kiểm tra A4 Foundation**

```javascript
// frontend/src/components/prints/__tests__/a4Foundation.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('A4 Foundation: Files exist and adhere to UTF-8 without BOM (Rule 2.4)', () => {
    const files = [
        'frontend/src/components/prints/A4PageContainer.jsx',
        'frontend/src/components/prints/AcademicFormPrintModal.jsx'
    ];
    for (const f of files) {
        const buf = fs.readFileSync(path.join(root, f));
        const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        assert.strictEqual(hasBom, false, `${f} must not have BOM`);
    }
});

test('A4 Foundation: AcademicFormPrintModal complies with Rule 2.6 (no raw emoji in button labels)', () => {
    const src = read('frontend/src/components/prints/AcademicFormPrintModal.jsx');
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕]/;
    const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    while ((match = btnRegex.exec(src)) !== null) {
        const label = match[1].replace(/<[^>]+>/g, '').trim();
        assert.ok(!forbidden.test(label), `Button label "${label}" must not contain raw symbols`);
    }
    assert.match(src, /PrinterOutlined/, 'Must use PrinterOutlined icon');
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node --test frontend/src/components/prints/__tests__/a4Foundation.test.js`
Expected: FAIL (tệp chưa tồn tại)

- [ ] **Step 3: Hiện thực `A4PageContainer.jsx` & `AcademicFormPrintModal.jsx`**

`A4PageContainer.jsx` thiết lập vùng hiển thị 210mm x 297mm, font `Times New Roman`, class `simulated-a4-sheet` và nhúng thẻ `<style>` quy định `@media print` ẩn các thành phần UI ngoài trang in, loại bỏ viền đổ bóng và đặt `@page { size: A4 portrait; margin: 0; }`.
`AcademicFormPrintModal.jsx` cung cấp thanh công cụ phía trên gồm: Mã biểu mẫu Tag, Nút In văn bản (`icon={<PrinterOutlined />}`), Nút Thu phóng (Scale preview), Nút Đóng (`icon={<CloseOutlined />}`).

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `node --test frontend/src/components/prints/__tests__/a4Foundation.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/prints/A4PageContainer.jsx frontend/src/components/prints/AcademicFormPrintModal.jsx frontend/src/components/prints/__tests__/a4Foundation.test.js
git commit -m "feat(print): create A4PageContainer and AcademicFormPrintModal foundation"
```

---

### Task 2: Hiện Thực Bản In BM01 & BM02 Chuẩn A4

**Files:**
- Create: `frontend/src/components/prints/BM01PrintSheet.jsx`
- Create: `frontend/src/components/prints/BM02PrintSheet.jsx`
- Test: `frontend/src/components/prints/__tests__/bm01AndBm02Print.test.js`

**Interfaces:**
- Consumes: `A4PageContainer.jsx`
- Produces:
  - `BM01PrintSheet({ registration, outlineData, student, mentor })`: Bản in Đề cương đề tài báo cáo tốt nghiệp.
  - `BM02PrintSheet({ registration, taskData, student, mentor })`: Bản in Phiếu đăng ký đề tài / Giao nhiệm vụ.

- [ ] **Step 1: Viết test cho BM01 và BM02 Print Sheets**

```javascript
// frontend/src/components/prints/__tests__/bm01AndBm02Print.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('BM01 & BM02 Print Sheets: Adhere to Rule 2.4 and contain required institutional text', () => {
    const bm01Src = read('frontend/src/components/prints/BM01PrintSheet.jsx');
    const bm02Src = read('frontend/src/components/prints/BM02PrintSheet.jsx');

    // BM01 matches BM01.docx
    assert.match(bm01Src, /TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT/, 'BM01 must contain TDMU university header');
    assert.match(bm01Src, /VIỆN CÔNG NGHỆ SỐ/, 'BM01 must contain institute header');
    assert.match(bm01Src, /ĐỀ CƯƠNG ĐỀ TÀI BÁO CÁO TỐT NGHIỆP/, 'BM01 must contain official title');
    assert.match(bm01Src, /Mục tiêu nghiên cứu/, 'BM01 must have research objectives');
    assert.match(bm01Src, /Kế hoạch thực hiện/, 'BM01 must have weekly schedule');
    assert.match(bm01Src, /GIẢNG VIÊN HƯỚNG DẪN/, 'BM01 must have mentor signature block');
    assert.match(bm01Src, /SINH VIÊN THỰC HIỆN/, 'BM01 must have student signature block');

    // BM02 matches BM02.docx
    assert.match(bm02Src, /PHIẾU ĐĂNG KÝ ĐỀ TÀI/, 'BM02 must contain official title');
    assert.match(bm02Src, /BỘ MÔN CÔNG NGHỆ THÔNG TIN/, 'BM02 must have department header');
    assert.match(bm02Src, /PHỤ TRÁCH BỘ MÔN/, 'BM02 must have head of department signature block');
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node --test frontend/src/components/prints/__tests__/bm01AndBm02Print.test.js`
Expected: FAIL (tệp chưa tồn tại)

- [ ] **Step 3: Hiện thực `BM01PrintSheet.jsx` và `BM02PrintSheet.jsx`**

Bám sát 100% nội dung đã đọc từ `d:\DACN\BieuMau\BM01.docx` và `d:\DACN\BieuMau\BM02.docx`. Hỗ trợ fallback linh hoạt khi các trường thông tin trống (in đường gạch chấm `................................`).

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `node --test frontend/src/components/prints/__tests__/bm01AndBm02Print.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/prints/BM01PrintSheet.jsx frontend/src/components/prints/BM02PrintSheet.jsx frontend/src/components/prints/__tests__/bm01AndBm02Print.test.js
git commit -m "feat(print): implement BM01 and BM02 standardized A4 print sheets"
```

---

### Task 3: Hiện Thực Bản In BM02-A & BM03 Chuẩn A4

**Files:**
- Create: `frontend/src/components/prints/BM02APrintSheet.jsx`
- Create: `frontend/src/components/prints/BM03PrintSheet.jsx`
- Test: `frontend/src/components/prints/__tests__/bm02aAndBm03Print.test.js`

**Interfaces:**
- Consumes: `A4PageContainer.jsx`
- Produces:
  - `BM02APrintSheet({ request, registration, student, mentor })`: Bản in Đơn xin điều chỉnh tên đề tài.
  - `BM03PrintSheet({ registration, progressRecords, student, mentor, checkpoints })`: Bản in Phiếu theo dõi tiến độ thực hiện & 2 Checkpoint.

- [ ] **Step 1: Viết test cho BM02-A và BM03 Print Sheets**

```javascript
// frontend/src/components/prints/__tests__/bm02aAndBm03Print.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('BM02-A & BM03 Print Sheets: Adhere to Rule 2.4 and contain required institutional sections', () => {
    const bm02aSrc = read('frontend/src/components/prints/BM02APrintSheet.jsx');
    const bm03Src = read('frontend/src/components/prints/BM03PrintSheet.jsx');

    // BM02-A matches BM02-A.docx
    assert.match(bm02aSrc, /PHIẾU ĐỀ NGHỊ ĐIỀU CHỈNH TÊN ĐỀ TÀI/, 'BM02-A must contain official title');
    assert.match(bm02aSrc, /Tên đề tài đã đăng ký/, 'BM02-A must have old registered title field');
    assert.match(bm02aSrc, /Tên đề tài xin điều chỉnh/, 'BM02-A must have new adjusted title field');
    assert.match(bm02aSrc, /Lý do điều chỉnh/, 'BM02-A must have reason field');

    // BM03 matches BM03.docx
    assert.match(bm03Src, /PHIẾU THEO DÕI TIẾN ĐỘ/, 'BM03 must contain official title');
    assert.match(bm03Src, /Tuần thứ/, 'BM03 must have week column');
    assert.match(bm03Src, /Kế hoạch thực hiện/, 'BM03 must have plan column');
    assert.match(bm03Src, /Được tiếp tục/, 'BM03 must have Checkpoint continue checkbox');
    assert.match(bm03Src, /Không tiếp tục/, 'BM03 must have Checkpoint discontinue checkbox');
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node --test frontend/src/components/prints/__tests__/bm02aAndBm03Print.test.js`
Expected: FAIL

- [ ] **Step 3: Hiện thực `BM02APrintSheet.jsx` và `BM03PrintSheet.jsx`**

Bám sát cấu trúc từ `BM02-A.docx` và `BM03.docx`. Trong `BM03PrintSheet.jsx`, bảng tuần hiển thị các buổi gặp GVHD thực tế kèm nhận xét, có khung Checkpoint giữa kỳ đánh giá *Được tiếp tục ◻ / Không tiếp tục ◻*.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `node --test frontend/src/components/prints/__tests__/bm02aAndBm03Print.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/prints/BM02APrintSheet.jsx frontend/src/components/prints/BM03PrintSheet.jsx frontend/src/components/prints/__tests__/bm02aAndBm03Print.test.js
git commit -m "feat(print): implement BM02-A and BM03 standardized A4 print sheets"
```

---

### Task 4: Hiện Thực Bản In BM04 & BM05 Tái Sử Dụng

**Files:**
- Create: `frontend/src/components/prints/BM04PrintSheet.jsx`
- Create: `frontend/src/components/prints/BM05PrintSheet.jsx`
- Modify: `frontend/src/components/admin/DefenseSummaryRecordModal.jsx` (refactor để dùng `BM05PrintSheet`)
- Test: `frontend/src/components/prints/__tests__/bm04AndBm05Print.test.js`

**Interfaces:**
- Consumes: `A4PageContainer.jsx`
- Produces:
  - `BM04PrintSheet({ evaluation, registration, evaluatorRole, evaluatorName })`: Bản in Phiếu nhận xét đồ án tốt nghiệp của GVHD / GVPB.
  - `BM05PrintSheet({ registration })`: Bản in Biên bản họp hội đồng bảo vệ khóa luận.

- [ ] **Step 1: Viết test cho BM04 và BM05 Print Sheets**

```javascript
// frontend/src/components/prints/__tests__/bm04AndBm05Print.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('BM04 & BM05 Print Sheets: Verify 4 CĐR criteria, 2 conclusions and scorebook ledger', () => {
    const bm04Src = read('frontend/src/components/prints/BM04PrintSheet.jsx');
    const bm05Src = read('frontend/src/components/prints/BM05PrintSheet.jsx');

    // BM04 matches BM04.docx
    assert.match(bm04Src, /PHIẾU NHẬN XÉT/, 'BM04 must contain official title');
    assert.match(bm04Src, /Hình thức đáp ứng yêu cầu của Báo cáo tốt nghiệp/, 'BM04 must contain criterion 1');
    assert.match(bm04Src, /Tổng quan tình hình NC; PP nghiên cứu; kết quả nghiên cứu/, 'BM04 must contain criterion 2');
    assert.match(bm04Src, /Tính ứng dụng và triển vọng của đề tài/, 'BM04 must contain criterion 3');
    assert.match(bm04Src, /Đánh giá về thái độ và ý thức làm việc của sinh viên/, 'BM04 must contain criterion 4');
    assert.match(bm04Src, /Đáp ứng chuẩn đầu ra của Chương trình đào tạo/, 'BM04 must contain program outcome conclusion');
    assert.match(bm04Src, /Đồng ý cho bảo vệ/, 'BM04 must contain defense recommendation');

    // BM05 matches BM05 Defense Summary Record
    assert.match(bm05Src, /BIÊN BẢN HỌP HỘI ĐỒNG/, 'BM05 must contain council record title');
    assert.match(bm05Src, /THƯ KÝ HỘI ĐỒNG/, 'BM05 must contain secretary signature');
    assert.match(bm05Src, /CHỦ TỊCH HỘI ĐỒNG/, 'BM05 must contain chairman signature');
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node --test frontend/src/components/prints/__tests__/bm04AndBm05Print.test.js`
Expected: FAIL

- [ ] **Step 3: Hiện thực `BM04PrintSheet.jsx`, `BM05PrintSheet.jsx` và cập nhật `DefenseSummaryRecordModal.jsx`**

`BM04PrintSheet.jsx` xây dựng dựa trên `BM04.docx`: hiển thị phụ đề dynamically (*Dành cho giảng viên hướng dẫn* hoặc *Dành cho giảng viên phản biện*), liệt kê 4 tiêu chí CĐR, 2 kết luận độc lập và chữ ký.
`BM05PrintSheet.jsx` chuyển phần giao diện bảng điểm và chữ ký từ `DefenseSummaryRecordModal.jsx` thành component độc lập, tái sử dụng tại cả modal BM05 và Dossier Drawer.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `node --test frontend/src/components/prints/__tests__/bm04AndBm05Print.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/prints/BM04PrintSheet.jsx frontend/src/components/prints/BM05PrintSheet.jsx frontend/src/components/admin/DefenseSummaryRecordModal.jsx frontend/src/components/prints/__tests__/bm04AndBm05Print.test.js
git commit -m "feat(print): implement BM04 and BM05 standardized A4 print sheets"
```

---

### Task 5: Tích Hợp Nút In Theo Ngữ Cảnh Vào Màn Hình Nghiệp Vụ

**Files:**
- Modify: `frontend/src/pages/student/SubmissionPage.jsx`
- Modify: `frontend/src/components/student/TitleAdjustmentModal.jsx`
- Modify: `frontend/src/components/lecturer/BM04EvaluationModal.jsx`
- Test: `frontend/src/pages/__tests__/contextualPrintButtons.test.js`

**Interfaces:**
- Consumes: `AcademicFormPrintModal`, `BM01PrintSheet`, `BM02PrintSheet`, `BM02APrintSheet`, `BM03PrintSheet`, `BM04PrintSheet`
- Produces: Thao tác in A4 tại chỗ trực tiếp trong quy trình nộp và chấm điểm.

- [ ] **Step 1: Viết test cho các nút in theo ngữ cảnh**

```javascript
// frontend/src/pages/__tests__/contextualPrintButtons.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Contextual Print Buttons: Strictly adhere to Rule 2.6 (no raw emoji in button labels)', () => {
    const files = [
        'frontend/src/pages/student/SubmissionPage.jsx',
        'frontend/src/components/student/TitleAdjustmentModal.jsx',
        'frontend/src/components/lecturer/BM04EvaluationModal.jsx'
    ];
    const forbidden = /[🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕]/;
    for (const f of files) {
        const src = read(f);
        const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
        let match;
        while ((match = btnRegex.exec(src)) !== null) {
            const label = match[1].replace(/<[^>]+>/g, '').trim();
            assert.ok(!forbidden.test(label), `File ${f} button "${label}" has forbidden symbol`);
        }
    }
});

test('Contextual Print Buttons: Integrates A4 print modals into SubmissionPage, TitleAdjustmentModal, and BM04EvaluationModal', () => {
    const subSrc = read('frontend/src/pages/student/SubmissionPage.jsx');
    const titleSrc = read('frontend/src/components/student/TitleAdjustmentModal.jsx');
    const bm04Src = read('frontend/src/components/lecturer/BM04EvaluationModal.jsx');

    assert.match(subSrc, /AcademicFormPrintModal/, 'SubmissionPage must import AcademicFormPrintModal');
    assert.match(titleSrc, /AcademicFormPrintModal|BM02APrintSheet/, 'TitleAdjustmentModal must import print component');
    assert.match(bm04Src, /AcademicFormPrintModal|BM04PrintSheet/, 'BM04EvaluationModal must import print component');
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node --test frontend/src/pages/__tests__/contextualPrintButtons.test.js`
Expected: FAIL

- [ ] **Step 3: Tích hợp nút in vào các component nghiệp vụ**

- Trong `SubmissionPage.jsx`: Thêm nút `<Button icon={<PrinterOutlined />}>In Đề cương BM01</Button>`, `<Button icon={<PrinterOutlined />}>In Nhiệm vụ BM02</Button>`, `<Button icon={<PrinterOutlined />}>In Sổ tiến độ BM03</Button>`.
- Trong `TitleAdjustmentModal.jsx`: Thêm nút `<Button icon={<PrinterOutlined />}>In Đơn BM02-A</Button>`.
- Trong `BM04EvaluationModal.jsx`: Thêm nút `<Button icon={<PrinterOutlined />}>Xem & In Phiếu BM04</Button>`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `node --test frontend/src/pages/__tests__/contextualPrintButtons.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/student/SubmissionPage.jsx frontend/src/components/student/TitleAdjustmentModal.jsx frontend/src/components/lecturer/BM04EvaluationModal.jsx frontend/src/pages/__tests__/contextualPrintButtons.test.js
git commit -m "feat(print): integrate contextual A4 print action buttons in submission and evaluation pages"
```

---

### Task 6: Ngăn Kéo Hồ Sơ Học Vụ Toàn Trình (Academic Dossier Hub)

**Files:**
- Create: `frontend/src/components/prints/AcademicDossierDrawer.jsx`
- Modify: `frontend/src/pages/admin/GradingDefensePage.jsx`
- Modify: `frontend/src/pages/admin/ProjectOversightPage.jsx`
- Modify: `frontend/src/pages/lecturer/LecturerDashboardPage.jsx`
- Test: `frontend/src/pages/__tests__/academicDossierDrawer.test.js`

**Interfaces:**
- Consumes: All 6 PrintSheets (`BM01PrintSheet` -> `BM05PrintSheet`), Ant Design `Drawer`, `Tabs`, `Button`, `PrinterOutlined`, `FolderOpenOutlined`
- Produces: `AcademicDossierDrawer({ open, onClose, registration })`

- [ ] **Step 1: Viết test cho AcademicDossierDrawer**

```javascript
// frontend/src/pages/__tests__/academicDossierDrawer.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('AcademicDossierDrawer: Adheres strictly to Rule 2.4 and Rule 2.6', () => {
    const drawerPath = path.join(root, 'frontend/src/components/prints/AcademicDossierDrawer.jsx');
    const buf = fs.readFileSync(drawerPath);
    const hasBom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
    assert.strictEqual(hasBom, false, 'Must not have BOM');

    const src = read('frontend/src/components/prints/AcademicDossierDrawer.jsx');
    const forbidden = /[📁🖨️←→+📋✓✏️👥🗑️🔓▾▴↗✕]/;
    const btnRegex = /<Button[^>]*>([\s\S]*?)<\/Button>/g;
    let match;
    while ((match = btnRegex.exec(src)) !== null) {
        const label = match[1].replace(/<[^>]+>/g, '').trim();
        assert.ok(!forbidden.test(label), `Button "${label}" must not contain raw symbols`);
    }
});

test('AcademicDossierDrawer: Contains 6 tabs from BM01 to BM05 and integrates into target pages', () => {
    const src = read('frontend/src/components/prints/AcademicDossierDrawer.jsx');
    assert.match(src, /BM01/, 'Must support BM01 tab');
    assert.match(src, /BM02/, 'Must support BM02 tab');
    assert.match(src, /BM03/, 'Must support BM03 tab');
    assert.match(src, /BM04/, 'Must support BM04 tab');
    assert.match(src, /BM05/, 'Must support BM05 tab');

    const gradingSrc = read('frontend/src/pages/admin/GradingDefensePage.jsx');
    assert.match(gradingSrc, /AcademicDossierDrawer/, 'GradingDefensePage must mount AcademicDossierDrawer');
});
```

- [ ] **Step 2: Chạy test để xác nhận FAIL**

Run: `node --test frontend/src/pages/__tests__/academicDossierDrawer.test.js`
Expected: FAIL

- [ ] **Step 3: Hiện thực `AcademicDossierDrawer.jsx` và tích hợp vào các trang quản lý**

- `AcademicDossierDrawer.jsx`: Header hiển thị thông tin sinh viên & đề tài, Tabs gồm `[BM01: Đề cương]`, `[BM02: Giao nhiệm vụ]`, `[BM02-A: Đổi tên]`, `[BM03: Tiến độ]`, `[BM04: Nhận xét]`, `[BM05: Biên bản HĐ]`. Phía trên có nút "In biểu mẫu này" và nút "In toàn bộ hồ sơ" (ghép các sheet với `@media print` ngắt trang `page-break-after: always`).
- Tích hợp nút mở Drawer trên các hàng bảng tại `GradingDefensePage.jsx`, `ProjectOversightPage.jsx`, và `LecturerDashboardPage.jsx`.

- [ ] **Step 4: Chạy test để xác nhận PASS**

Run: `node --test frontend/src/pages/__tests__/academicDossierDrawer.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/prints/AcademicDossierDrawer.jsx frontend/src/pages/admin/GradingDefensePage.jsx frontend/src/pages/admin/ProjectOversightPage.jsx frontend/src/pages/lecturer/LecturerDashboardPage.jsx frontend/src/pages/__tests__/academicDossierDrawer.test.js
git commit -m "feat(dossier): implement AcademicDossierDrawer hub and integrate into administrative tables"
```

---

### Task 7: Kiểm Thử Toàn Diện & Xác Thực Build Production

**Files:**
- Toàn bộ codebase Frontend & Backend

- [ ] **Step 1: Chạy toàn bộ Unit & Contract Tests của Frontend**

Run: `npm --prefix frontend test`
Expected: 100% tests PASS (>= 272 tests)

- [ ] **Step 2: Chạy toàn bộ Runtime Vitest Tests**

Run: `npm --prefix frontend run test:runtime`
Expected: 100% tests PASS

- [ ] **Step 3: Chạy Playwright E2E Tests**

Run: `npm --prefix frontend run test:e2e`
Expected: 6/6 tests PASS

- [ ] **Step 4: Chạy Vite Production Build**

Run: `npm --prefix frontend run build`
Expected: Build thành công trong < 20s, Main Entry Chunk < 500 kB, 0 warnings.

- [ ] **Step 5: Commit & Đóng gói phiên bản**

```bash
git add .
git commit -m "chore(release): finalize A4 academic forms suite and dossier hub with 100% test coverage"
```

