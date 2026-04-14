# PROJECT_STATE.md

## Trạng thái hiện tại

**Cập nhật lần cuối:** 2026-04-15

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

- Trước đây giữa kỳ vẫn có thể bật `registrationOpen` nên gây sai cảm giác vận hành.
- Hiện tại:
  - Backend chỉ cho bật đăng ký trong cửa sổ hợp lệ (`startDate` -> `registrationDeadline`).
  - UI admin chỉ cho bật toggle khi học kỳ ở trạng thái `REGISTRATION`.
  - API trả thêm trạng thái rõ ràng để UI hiển thị đúng theo hiệu lực thực tế.

### 3. Chuẩn hóa tiếng Việt và encoding

- Đã chuyển seed dữ liệu sang tiếng Việt có dấu để demo tự nhiên hơn.
- Đã chuẩn hóa và cập nhật rule kiểm tra UTF-8 + chất lượng text markdown.

---

## Chất lượng và gate

- `node scripts/check-utf8.js`: **PASS**
- `node scripts/check-md-quality.js`: **PASS**
- `npm --prefix frontend run build`: **PASS**

---

## Rủi ro còn lại cần theo dõi

1. Cần UAT nhanh toàn luồng trước demo (admin, lecturer, student).
2. Cần chụp sẵn ảnh màn hình backup cho tình huống mạng không ổn định khi demo.
3. Một số file tài liệu cũ ngoài bộ trạng thái chính có thể cần rà soát thêm để đồng bộ văn phong/encoding.
