# PROJECT_STATE.md

## Trạng thái hiện tại

**Cập nhật lần cuối:** 2026-05-01

Dự án đang ở trạng thái **ổn định luồng chính cho 3 vai trò** (`ADMIN`, `LECTURER`, `STUDENT`) theo workflow `TopicRegistration`.

---

## Tiến độ mới nhất

### 1. Demo data đã làm mới hoàn toàn

- Reset dữ liệu cũ và seed lại dữ liệu lớn, thực tế để phục vụ demo.
- Dữ liệu hiện có:
  - `users`: 86
  - `semesters`: 4
  - `topics`: 166
  - `registrations`: 122
  - `tasks`: 610
  - `submissions`: 366
  - `milestones`: 366
  - `councils`: 7
  - `defenseResults`: 58
  - `notifications`: 220
- Rule đã đồng bộ: mỗi đề tài chỉ 1 sinh viên (`maxStudents = 1`).

### 2. Đã sửa logic toggle mở/đóng đăng ký theo nghiệp vụ

- Backend chỉ cho bật đăng ký trong cửa sổ hợp lệ (`startDate` -> `registrationDeadline`).
- UI admin chỉ cho bật toggle khi học kỳ ở trạng thái `REGISTRATION`.
- API trả thêm trạng thái rõ ràng để UI hiển thị đúng theo hiệu lực thực tế.

### 3. Đã bổ sung backend "Admin Defense Center"

- Thêm endpoint tổng hợp cho Admin để điều phối bảo vệ/chấm điểm theo 4 tab trạng thái:
  - `PENDING_ASSIGNMENT`
  - `ASSIGNED_COUNCIL`
  - `AWAITING_GRADING`
  - `COMPLETED`
- Hỗ trợ filter/search trong cùng endpoint và mặc định chọn đợt theo rule:
  - đợt hiện tại,
  - nếu chưa có thì lấy đợt gần nhất vừa kết thúc.
- Bổ sung action nhắc chấm điểm hàng loạt cho hội đồng và khóa/mở khóa trạng thái điểm.

### 4. Chuẩn hóa tiếng Việt và encoding

- Đã chuẩn hóa rule kiểm tra UTF-8 + chất lượng markdown.

### 5. Đã triển khai backend score-sheet + export PDF thật

- Đã mở API score-sheet:
  - `GET /api/evaluations/:registrationId/score-sheet`
  - `PUT /api/evaluations/:registrationId/score-sheet`
  - `POST /api/evaluations/:registrationId/score-sheet/export-pdf`
- Đã bổ sung dữ liệu chấm điểm chi tiết theo tiêu chí:
  - model `DefenseCriterionScore`
  - field lock/pdf cho `DefenseResult` (`scoreLocked`, `lockedAt`, `lockedBy`, `pdfUrl`, `pdfGeneratedAt`, ...)
- Đã triển khai render PDF server-side bằng `pdfkit` và upload lên storage qua `UploadService`.
- Đã cập nhật UI:
  - Admin có nút export PDF + badge trạng thái khóa điểm/PDF.
  - Lecturer có nút export PDF trên card chấm điểm.

---

## Chất lượng và gate

- `node scripts/check-utf8.js`: **PASS**
- `node scripts/check-md-quality.js`: **PASS**
- `npm --prefix frontend run build`: **PASS**

---

## Yêu cầu mới đã chốt (trạng thái triển khai)

1. [x] Auto-reject đăng ký `PENDING` sau 5 ngày không phản hồi.
2. [x] Auto-reject `PENDING` khi qua `registrationDeadline`.
3. [x] Trang "Đề tài của tôi" của lecturer hiển thị tên sinh viên, tìm kiếm theo sinh viên, bỏ filter bản nháp.
4. [x] Filter mặc định theo đợt hiện tại hoặc đợt gần nhất vừa kết thúc.
5. [x] Bảng chấm điểm hội đồng online theo barem + xuất PDF.
6. [x] Nhận diện và giới hạn quyền tài khoản sinh viên đã hoàn thành đồ án.

---

## Định hướng nghiệp vụ mới đã chốt (2026-05-01)

### Bối cảnh mở rộng

- Hệ thống cần hỗ trợ nhiều `Tên đồ án` trong cùng một học kỳ/đợt.
- Luồng đăng ký đề tài của sinh viên phải phụ thuộc vào môn đồ án mà sinh viên đã đăng ký trước đó.

### Rule nghiệp vụ mới

- Khi vào trang đăng ký đề tài:
  - học kỳ mặc định là học kỳ mới nhất hiện tại.
  - sinh viên chọn `Tên đồ án`.
- Sinh viên chỉ được đăng ký đề tài nếu:
  - đề tài thuộc đúng `Tên đồ án` đã đăng ký môn trước đó,
  - và đúng theo học kỳ/đợt tương ứng.
- Nếu sinh viên chọn `Tên đồ án` khác với môn đã đăng ký:
  - không cho phép đăng ký,
  - trả thông báo lỗi rõ ràng.

### Trạng thái triển khai

- Chưa làm import Excel ở giai đoạn này.
- Trước mắt sẽ:
  - bổ sung thuộc tính/schema cần thiết,
  - seed dữ liệu mẫu thủ công để test end-to-end.


### 6. Đã triển khai giới hạn quyền tài khoản sinh viên đã hoàn thành đồ án

- Backend đã chặn sinh viên đã có đăng ký ở trạng thái `DEFENDED`/`COMPLETED` khỏi luồng đăng ký và đề xuất đề tài mới.
- API enrollments trả thêm cờ `accountRestricted` và `accountRestrictionReason` để frontend hiển thị rõ lý do.
- Admin User Management đã hiển thị trạng thái restricted trên danh sách người dùng.

### 7. Cập nhật bổ sung (2026-05-01)

- Đã hoàn tất filter admin theo trạng thái `accountRestricted` trên `GET /api/users` (`true/false`).
- Đã cập nhật UI Admin User Management để lọc sinh viên theo 2 trạng thái:
  - `SV đã hoàn thành đồ án`
  - `SV bình thường`
- Đã nâng cấp UI chấm điểm của `LECTURER` sang luồng score-sheet theo barem tiêu chí:
  - dùng `GET/PUT /api/evaluations/:registrationId/score-sheet`,
  - không còn nhập điểm tổng trực tiếp ở card cũ,
  - vẫn hỗ trợ export PDF từ dữ liệu score-sheet thật.
- Đã bổ sung migration Prisma chính thức cho score-sheet/PDF:
  - `20260501113000_add_defense_scoresheet_schema`
  - chuẩn hóa các cột `score_locked`, `locked_at`, `locked_by`, `pdf_url`, `pdf_generated_at`, `score_rubric_version`
  - thêm bảng `defense_criterion_scores` + FK/unique.
- Đã rollout migration trên DB dùng chung:
  - `npm --prefix backend run db:deploy`: PASS
  - `npm --prefix backend run db:status`: `Database schema is up to date!`
- Đã đồng bộ hiển thị `Tên đồ án` / `Đợt đồ án` trên các màn admin điều phối chính:
  - Admin Grading Defense
  - Project Oversight
  - Topic Management
- Đã nâng cấp màn đối soát dữ liệu nâng cao ở Admin Project Enrollment:
  - phân loại rõ `registration` lệch rule theo nguyên nhân,
  - hỗ trợ thao tác sửa nhanh:
    - gán `Tên đồ án` cho `topic` đang thiếu `projectCatalogId`,
    - backfill `enrollment` khớp cho `registration` thiếu enrollment.
- Đã dọn luồng chấm điểm tổng cũ (legacy) để tránh quay lại kiến trúc cũ:
  - gỡ API `POST /api/evaluations/defense-result`,
  - gỡ handler backend `submitDefenseResult`,
  - gỡ method frontend `evaluationService.submitDefenseResult`.
- Gate sau thay đổi đều PASS:
  - `node scripts/check-utf8.js`
  - `node scripts/check-md-quality.js`
  - `node scripts/regression-check.js`
  - `npm --prefix backend test -- --runInBand`
  - `npm --prefix frontend run build`

## Cập nhật bổ sung (2026-05-01)

- Đã triển khai mô hình phiếu chấm theo từng thành viên hội đồng:
  - `DefenseMemberScore`
  - `DefenseMemberCriterionScore`
- Đã chốt cách tính điểm bảo vệ cuối:
  - trung bình cộng điểm hệ 10 của các thành viên hội đồng đã nộp phiếu.
- Đã nâng cấp màn Admin Grading:
  - chọn phiếu theo từng giảng viên hội đồng trong modal,
  - xuất PDF theo người chấm đang chọn.
- Đã bổ sung thông tin trên phiếu/PDF:
  - Họ tên người chấm,
  - Chức danh trong HĐ,
  - Ngành học (dưới dòng tên + MSSV).
- Đã fix lỗi export PDF `Bucket not found`:
  - `UploadService` tự kiểm tra/tạo bucket Supabase trước khi upload.
- Đã rollout migration trên DB:
  - `20260501194000_add_defense_member_scores`
  - `npm --prefix backend run db:status`: `Database schema is up to date!`
- Đã vá an toàn tương thích:
  - nếu backend chưa migrate/client chưa reload thì API trả `409` có thông báo hướng dẫn, tránh crash.
- Đã sửa encoding màn `GradingDefensePage`:
  - text tiếng Việt hiển thị đúng,
  - frontend build PASS.

## Cập nhật bổ sung (2026-05-02)

- Đã chuyển luồng chấm điểm `LECTURER` sang trang phiếu chấm riêng:
  - route: `/lecturer/grading/sheet/:registrationId`
  - mở tab mới từ danh sách chấm điểm.
- Đã đồng bộ biểu mẫu theo file gốc `frontend/src/pages/lecturer/phieu_cham.html`:
  - dùng template gốc để render UI,
  - thay các trường thông tin động theo sinh viên/người chấm,
  - ô điểm trong bảng được thay bằng input tương tác.
- Đã cập nhật quy tắc nhập điểm:
  - bước tăng điểm `step = 0.05`.
- Đã chuyển backend export PDF dùng cùng 1 template với frontend:
  - `backend/src/services/scoreSheetPdfService.js` đọc trực tiếp `phieu_cham.html`.
- Đã fix lỗi storage bucket Supabase:
  - đảm bảo bucket tồn tại và public trước khi tạo public URL.
- Đã fix lỗi PDF mất lề trang / dư trang trắng cuối:
  - bỏ cấu hình gây tràn page theo print mode,
  - dùng `@page` + `preferCSSPageSize` để giữ bố cục ổn định.

## Gate sau cập nhật (2026-05-02)

- `npm --prefix frontend run build`: PASS
- `npm --prefix backend test -- --runInBand`: PASS
- `node scripts/check-utf8.js`: PASS
