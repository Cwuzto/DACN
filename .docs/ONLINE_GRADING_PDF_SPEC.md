# ONLINE_GRADING_PDF_SPEC.md

## Mục tiêu

Chốt đặc tả kỹ thuật cho:

1. Bảng chấm điểm hội đồng online theo barem.
2. Xuất phiếu điểm bảo vệ ra PDF.

Tài liệu này là baseline triển khai cho batch tiếp theo, bám kiến trúc `TopicRegistration` và `DefenseResult`.

---

## Phạm vi

### In scope

- Nhập điểm chi tiết theo từng tiêu chí (barem).
- Tự tính tổng điểm có trọng số.
- Lưu điểm online theo từng `registrationId`.
- Khóa/mở khóa điểm sau khi chốt.
- Xuất PDF phiếu điểm từ dữ liệu đã chốt.

### Out of scope (batch sau)

- Chữ ký số PKI.
- Workflow phúc khảo nhiều vòng.
- Kho mẫu PDF đa ngôn ngữ.

---

## Vai trò và quyền

- `LECTURER` (thành viên hội đồng): nhập/sửa điểm khi chưa khóa.
- `ADMIN`: xem toàn bộ, khóa/mở khóa, xuất PDF, nhắc chấm.
- `STUDENT`: chỉ xem kết quả cuối cùng theo quyền hiện hành.

Rule quyền:

- Chỉ người thuộc `CouncilMember` của hội đồng tương ứng được nhập điểm chi tiết.
- `ADMIN` có thể override khi cần nghiệp vụ.
- Khi `TopicRegistration.status = COMPLETED` và score lock đang bật: không cho sửa điểm.

---

## Barem chuẩn (v1)

Sử dụng barem mặc định v1 (100 điểm):

1. `CONTENT_QUALITY` - Chất lượng nội dung: 30
2. `IMPLEMENTATION` - Hiện thực/kỹ thuật: 30
3. `PRESENTATION` - Trình bày: 20
4. `QA_RESPONSE` - Trả lời phản biện: 20

Điểm mỗi tiêu chí: `0 -> maxScore`.

Tổng điểm cuối:

- `finalScoreRaw = sum(criteriaScore)`
- `finalScore10 = round((finalScoreRaw / 10), 2)`

Quy tắc làm tròn: 2 chữ số thập phân, round half up.

---

## Thiết kế dữ liệu

Giữ `DefenseResult` là nguồn sự thật cuối cùng, bổ sung chi tiết chấm điểm bằng bảng mới.

### Bảng mới: `DefenseCriterionScore`

- `id` (PK)
- `defenseResultId` (FK -> `DefenseResult.id`)
- `criterionCode` (string)
- `criterionLabel` (string)
- `maxScore` (float)
- `score` (float)
- `comment` (string, nullable)
- `createdAt`, `updatedAt`

Ràng buộc:

- Unique (`defenseResultId`, `criterionCode`).
- Validate `0 <= score <= maxScore`.

### Bổ sung `DefenseResult`

- `scoreRubricVersion` (string, default: `v1`)
- `scoreLocked` (boolean, default: false)
- `lockedAt` (datetime, nullable)
- `lockedBy` (FK -> `User.id`, nullable)
- `pdfUrl` (string, nullable)
- `pdfGeneratedAt` (datetime, nullable)

Ghi chú:

- `finalScore` vẫn là điểm cuối cùng chuẩn để báo cáo.
- `DefenseCriterionScore` là chi tiết phục vụ audit và PDF.

---

## API contract

Base: `/api/evaluations`

### 1) Lấy barem + dữ liệu chấm hiện tại

`GET /:registrationId/score-sheet`

Response:

- `registration`
- `rubric` (version + criteria)
- `scores` (theo từng tiêu chí)
- `finalScore`
- `scoreLocked`

### 2) Lưu nháp/chấm điểm

`PUT /:registrationId/score-sheet`

Body:

- `scores[]`: `{ criterionCode, score, comment? }`
- `generalComment?`

Behavior:

- Validate quyền.
- Validate range.
- Recalculate `finalScore`.
- Upsert `DefenseResult` + `DefenseCriterionScore`.

### 3) Khóa điểm

`POST /:registrationId/score-sheet/lock`

Behavior:

- Set `scoreLocked = true`, `lockedAt`, `lockedBy`.
- Đồng bộ `TopicRegistration.status = COMPLETED`.

### 4) Mở khóa điểm

`POST /:registrationId/score-sheet/unlock`

Behavior:

- Set `scoreLocked = false`, clear lock metadata.
- Đồng bộ `TopicRegistration.status = DEFENDED`.

### 5) Xuất PDF

`POST /:registrationId/score-sheet/export-pdf`

Behavior:

- Chỉ cho export khi có điểm hợp lệ.
- Render PDF từ template chuẩn.
- Upload storage, lưu `pdfUrl`, `pdfGeneratedAt`.
- Trả `pdfUrl`.

---

## PDF specification (v1)

Tên file:

- `scoresheet_{semester}_{registrationId}_{yyyyMMdd_HHmm}.pdf`

Nội dung PDF:

1. Header đơn vị + tên tài liệu "PHIẾU CHẤM BẢO VỆ ĐỒ ÁN".
2. Thông tin sinh viên, mã SV, đề tài, hội đồng, ngày bảo vệ.
3. Bảng tiêu chí chấm: tiêu chí, điểm tối đa, điểm đạt, nhận xét ngắn.
4. Tổng điểm hệ 100 + quy đổi hệ 10.
5. Nhận xét chung.
6. Metadata: người khóa điểm, thời gian khóa, thời gian xuất PDF.

Chuẩn hiển thị:

- Font Unicode tiếng Việt.
- A4 dọc.
- Margin 20mm.

---

## Kỹ thuật đề xuất

Backend:

- Dùng `pdfkit` (server-side) để render PDF.
- Upload PDF qua luồng storage hiện có (Supabase storage service).

Frontend:

- Reuse trang `GradingPage` để thêm modal/bảng tiêu chí.
- Nút `Lưu điểm`, `Khóa điểm`, `Xuất PDF` theo quyền.
- Disable toàn bộ input khi `scoreLocked = true`.

---

## Logging và audit

Bắt buộc ghi `auditLog` cho:

- `SAVE_SCORE_SHEET`
- `LOCK_SCORE_SHEET`
- `UNLOCK_SCORE_SHEET`
- `EXPORT_SCORE_SHEET_PDF`

Chi tiết log tối thiểu:

- `registrationId`
- `defenseResultId`
- `rubricVersion`
- `finalScore`

---

## Tiêu chí hoàn tất (DoD)

1. Nhập điểm theo barem và tính điểm tự động đúng.
2. Khóa/mở khóa điểm hoạt động đúng quyền.
3. Export PDF thành công, tải được file, nội dung đúng dữ liệu đã khóa.
4. Qua gate:
   - `node scripts/check-utf8.js`
   - `node scripts/check-md-quality.js`
   - `node scripts/regression-check.js`
   - `npm --prefix backend test -- --runInBand`
   - `npm --prefix frontend run build`

---

## Kế hoạch triển khai ngắn

1. [x] Migration/schema cho `DefenseCriterionScore` + field mới `DefenseResult` (đã sync bằng `db push`).
2. [x] Implement service tính điểm + validate barem.
3. [x] Implement API score-sheet + lock/unlock + export-pdf.
4. [x] Cập nhật UI export PDF (admin/lecturer) + trạng thái khóa điểm/PDF trên admin.
5. [ ] Cập nhật UI nhập điểm theo barem đầy đủ (theo tiêu chí).
6. [ ] Chốt migration chuẩn + full regression test trước khi merge.
