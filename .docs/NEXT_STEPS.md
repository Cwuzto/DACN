# NEXT_STEPS.md

## Trọng tâm hiện tại

Triển khai batch nghiệp vụ đã chốt ngày 2026-04-22, đồng thời giữ chất lượng demo ổn định.

## Việc cần làm tiếp

### Ưu tiên cao

- [x] Triển khai auto-reject đăng ký `PENDING` sau 5 ngày không phản hồi.
- [x] Triển khai auto-reject đăng ký `PENDING` khi kết thúc thời gian đăng ký (`registrationDeadline`).
- [x] Cập nhật API + UI trang "Đề tài của tôi" (LECTURER):
  - Hiển thị tên sinh viên đăng ký thay cho `1/1`.
  - Search theo tên sinh viên.
  - Bỏ filter "Bản nháp".
- [x] Chuẩn hóa filter mặc định toàn hệ thống: đợt hiện tại, hoặc đợt gần nhất vừa kết thúc nếu chưa có đợt mới.
- [x] Bổ sung backend API "Admin Defense Center" để gom điều phối bảo vệ/chấm điểm về một nơi.

### Ưu tiên trung bình

- [x] Thiết kế kỹ thuật bảng chấm điểm hội đồng online theo barem + xuất PDF (`.docs/ONLINE_GRADING_PDF_SPEC.md`).
- [x] Triển khai backend bảng chấm điểm hội đồng online theo barem (API score-sheet + lock/unlock + lưu điểm chi tiết).
- [x] Hoàn thiện luồng xuất bảng điểm online ra PDF (render PDF server-side + upload storage + trả `pdfUrl`).
- [ ] Định nghĩa và triển khai trạng thái tài khoản cho sinh viên đã hoàn thành đồ án tốt nghiệp.

### Ưu tiên cao (mới)

- [ ] Ổn định gate trước khi chốt batch:
  - Sửa test đang fail `tests/integration/semesters.routes.test.js`.
  - Chạy lại full gate:
    - `node scripts/regression-check.js`
    - `npm --prefix backend test -- --runInBand`
    - `npm --prefix frontend run build`
- [ ] Hoàn thiện UI chấm điểm theo barem thật (form theo tiêu chí thay vì chỉ nhập điểm tổng).
- [ ] Chuẩn hóa migration Prisma lâu dài (tránh phụ thuộc `db push` cho môi trường dev nhiều người).

### Ưu tiên cao (mới - 2026-05-01)

- [ ] P0 - Chốt dữ liệu mở rộng theo `Tên đồ án`:
  - Tạo danh mục `ProjectCatalog` (ví dụ: Đồ án A, Đồ án B, Đồ án tốt nghiệp).
  - Tạo liên kết sinh viên đăng ký môn đồ án theo đợt (`StudentProjectEnrollment`).
  - Bổ sung liên kết `projectCatalogId` cho `Topic`.
- [ ] P0 - Khóa rule backend khi đăng ký đề tài:
  - Chỉ cho phép đăng ký khi sinh viên có enrollment hợp lệ theo đúng `Tên đồ án` và đúng đợt.
  - Chặn cả luồng create/update/chuyển đề tài để tránh bypass.
- [ ] P0 - Seed dữ liệu tạm thời:
  - Seed `ProjectCatalog`.
  - Seed `StudentProjectEnrollment`.
  - Seed `Topic` gắn đúng `projectCatalogId`.
- [ ] P0 - Viết test nghiệp vụ bắt buộc:
  - Đúng môn + đúng đợt => pass.
  - Sai môn => fail.
  - Khác đợt => fail.
  - Không có enrollment => fail.

### Ưu tiên trung bình (mới - 2026-05-01)

- [ ] P1 - Cập nhật UI sinh viên đăng ký đề tài:
  - Mặc định đợt mới nhất.
  - Tách chọn `Tên đồ án` riêng.
  - Disable đăng ký + báo lý do nếu chưa đăng ký môn tương ứng.
- [ ] P1 - Cập nhật UI admin:
  - Tách filter `Tên đồ án` và `Đợt đồ án`.
  - Hiển thị rõ `Tên đồ án` ở các bảng điều phối chính.
- [ ] P1 - Thêm màn đối soát dữ liệu:
  - SV đã đăng ký môn nhưng chưa đăng ký đề tài.
  - Topic thiếu `projectCatalogId`.
  - Registration cũ lệch rule mới.

### Ưu tiên thấp (mới - 2026-05-01)

- [ ] P2 - Chuẩn bị cho import Excel (chưa bật tính năng):
  - Bổ sung metadata nguồn dữ liệu enrollment (`SEED`/`MANUAL`/`EXCEL`).
  - Bổ sung `importBatchId` nullable để truy vết batch import sau này.
- [ ] P2 - Bổ sung snapshot thông tin tại thời điểm đăng ký để ổn định lịch sử.

### Ưu tiên thấp

- [ ] Dọn dead code legacy sau các quyết định kiến trúc mới.

## Gate bắt buộc trước khi chốt batch

```bash
node scripts/check-utf8.js
node scripts/check-md-quality.js
node scripts/regression-check.js
npm --prefix backend test -- --runInBand
npm --prefix frontend run build
```
