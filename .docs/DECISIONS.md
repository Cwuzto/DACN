# DECISIONS.md

## Decision Log

Tài liệu lưu các quyết định kỹ thuật/nghiệp vụ quan trọng để tránh lệch hướng giữa các phiên.

---

## 2026-03-28 - Repo là bộ nhớ chính

**Quyết định**

- Dùng file trong repo làm nguồn trạng thái chính thức.
- NotebookLM chỉ là công cụ hỗ trợ tra cứu/tóm tắt.

**Ảnh hưởng**

- Luôn đồng bộ các file trong `.docs/`.

---

## 2026-03-28 - Chốt mô hình `TopicRegistration`

**Quyết định**

- `TopicRegistration` là mô hình nghiệp vụ chính.
- Không đưa `group/groupMember/evaluation` trở lại kiến trúc chính.

**Ảnh hưởng**

- Mọi phát triển mới phải bám workflow hiện tại.

---

## 2026-03-29 - Quota giảng viên theo học vị

**Quyết định**

- `THAC_SI = 10`
- `TIEN_SI = 15`
- `PHO_GIAO_SU = 20`

**Ảnh hưởng**

- Rule tập trung tại `backend/src/constants/mentorCapacity.js`.

---

## 2026-04-01 - Toggle đăng ký theo từng học kỳ

**Quyết định**

- Trạng thái mở/đóng đăng ký được lưu theo `Semester.registrationOpen`.
- Không tạo bảng `SystemConfig` cho bài toán này.

**Ảnh hưởng**

- Dùng endpoint `PATCH /api/semesters/:id/registration-toggle`.

---

## 2026-04-15 - Seed dữ liệu demo lớn và thực tế

**Quyết định**

- Xóa dữ liệu cũ và seed lại bộ dữ liệu demo đầy đủ theo nhiều giai đoạn học kỳ.
- Giữ rule: mỗi đề tài chỉ 1 sinh viên (`maxStudents = 1`).

---

## 2026-04-15 - Siết logic toggle đăng ký theo thời gian thực tế

**Quyết định**

- Chỉ cho bật đăng ký khi đang trong cửa sổ hợp lệ: `startDate` -> `registrationDeadline`.

---

## 2026-04-15 - Bổ sung gate chất lượng Markdown

**Quyết định**

- Thêm script `node scripts/check-md-quality.js` vào quy trình gate.

---

## 2026-04-22 - Chốt phạm vi batch nghiệp vụ mới

**Quyết định**

- Tự động `REJECT` đăng ký đề tài `PENDING` sau 5 ngày nếu giảng viên không phản hồi.
- Tự động `REJECT` các đăng ký `PENDING` khi kết thúc hạn đăng ký của đợt.
- Trang "Đề tài của tôi" của giảng viên hiển thị tên sinh viên đăng ký, hỗ trợ search theo tên sinh viên, và bỏ filter "Bản nháp".
- Quy tắc filter mặc định ưu tiên đợt hiện tại; nếu chưa có thì lấy đợt gần nhất vừa kết thúc.
- Triển khai bảng chấm điểm hội đồng online theo barem, hỗ trợ xuất PDF.
- Bổ sung cơ chế nhận diện và giới hạn quyền tài khoản sinh viên đã hoàn thành đồ án tốt nghiệp.

---

## 2026-04-22 - Hợp nhất API quản trị bảo vệ/chấm điểm cho Admin

**Quyết định**

- Bổ sung nhóm endpoint `Admin Defense Center` dưới `/api/evaluations/admin-defense-center`.
- Dùng mô hình tab theo workflow thực tế: `PENDING_ASSIGNMENT`, `ASSIGNED_COUNCIL`, `AWAITING_GRADING`, `COMPLETED`.
- Bổ sung action nghiệp vụ cho admin: nhắc chấm điểm hàng loạt và khóa/mở khóa trạng thái điểm.

**Ảnh hưởng**

- UI Admin có thể gom điều phối hội đồng + theo dõi chấm điểm trên một màn hình thống nhất.
- Giảm thao tác qua lại giữa trang hội đồng và trang chấm điểm.
- Cần frontend cập nhật theo contract API mới.

---

## 2026-04-30 - Chốt triển khai batch auto-reject + default semester fallback + lecturer topics UX

**Quyết định**

- Tận dụng scheduler hiện có (`pendingRegistrationReminderJob`) để chạy thêm auto-reject đăng ký `PENDING`.
- Rule auto-reject gồm 2 điều kiện:
  - quá 5 ngày không được phản hồi,
  - quá `registrationDeadline` của đợt.
- Chuẩn hóa rule chọn đợt mặc định ở backend bằng helper dùng chung:
  - ưu tiên đợt hiện tại,
  - nếu chưa có thì lấy đợt gần nhất vừa kết thúc.
- Trang "Đề tài của tôi" của giảng viên dùng dữ liệu đăng ký thật:
  - hiển thị tên sinh viên đăng ký,
  - hỗ trợ search theo sinh viên,
  - bỏ filter "Bản nháp" khỏi filter nhanh.

**Ảnh hưởng**

- Đồng bộ behavior mặc định giữa các API dashboard/registration.
- Giảm sai lệch giữa UI giảng viên và trạng thái đăng ký thực tế.
- Tăng tính nhất quán nghiệp vụ theo mô hình `TopicRegistration`.

---

## 2026-04-30 - Chốt đặc tả kỹ thuật bảng chấm điểm online + xuất PDF (v1)

**Quyết định**

- Chốt tài liệu kỹ thuật tại `.docs/ONLINE_GRADING_PDF_SPEC.md`.
- Dùng mô hình `DefenseResult` làm nguồn điểm cuối, bổ sung bảng chi tiết `DefenseCriterionScore`.
- Chuẩn hóa barem v1 theo 100 điểm và quy đổi hệ 10.
- Khóa/mở khóa điểm gắn với trạng thái `TopicRegistration` (`COMPLETED`/`DEFENDED`).

**Ảnh hưởng**

- Batch tiếp theo có thể bắt đầu triển khai backend/frontend theo contract rõ ràng.
- Giảm rủi ro lệch giữa UI chấm điểm, báo cáo và PDF đầu ra.

---

## 2026-04-30 - Chốt phương án triển khai PDF server-side bằng `pdfkit`

**Quyết định**

- Triển khai export PDF server-side bằng `pdfkit` (thay cho phương án tạm reuse file upload).
- PDF được render từ dữ liệu score-sheet thật (`DefenseResult` + `DefenseCriterionScore`) rồi upload storage qua `UploadService`.
- Lưu metadata PDF vào `DefenseResult`: `pdfUrl`, `pdfGeneratedAt`.

**Ảnh hưởng**

- Luồng export PDF đã chạy end-to-end từ dữ liệu chấm điểm thực.
- UI admin/lecturer có thể mở file PDF ngay sau khi export.
- Cần tiếp tục chuẩn hóa migration/test để chốt batch an toàn.

---

## 2026-05-01 - Chốt rule đăng ký đề tài theo môn đồ án đã đăng ký

**Quyết định**

- Hệ thống mở rộng theo mô hình:
  - `Tên đồ án` (danh mục môn đồ án),
  - `Đợt đồ án` (thuộc học kỳ/năm học),
  - `Đề tài` (thuộc tên đồ án cụ thể).
- Sinh viên chỉ được đăng ký đề tài nếu đã có đăng ký môn đồ án hợp lệ tương ứng trong đúng đợt.
- Học kỳ/đợt mặc định ở UI đăng ký đề tài là đợt mới nhất hiện tại.
- Giai đoạn hiện tại chưa triển khai import Excel; trước mắt bổ sung schema và seed dữ liệu để vận hành.

**Ảnh hưởng**

- Cần bổ sung dữ liệu danh mục `Tên đồ án` và bảng enrollment môn đồ án của sinh viên.
- Cần khóa validate ở backend cho mọi luồng tạo/cập nhật đăng ký đề tài để tránh bypass từ UI.
- Cần cập nhật filter và cách hiển thị ở frontend để tách rõ:
  - `Tên đồ án`,
  - `Đợt đồ án`.

**Lộ trình áp dụng**

- P0: schema + backend validation + seed + test.
- P1: UI student/admin + đối soát dữ liệu.
- P2: chuẩn bị metadata phục vụ import Excel trong pha tiếp theo.

---

## 2026-05-01 - Chuẩn hóa migration Prisma, không phụ thuộc `db push`

**Quyết định**

- Bổ sung migration SQL chính thức cho score-sheet/PDF:
  - thêm cột lock/pdf/rubric cho `defense_results`,
  - thêm bảng `defense_criterion_scores` + ràng buộc FK/unique.
- Chuẩn hóa script backend cho team:
  - `npm run db:deploy`
  - `npm run db:status`
- Không dùng `db push` như luồng mặc định khi có thay đổi schema nghiệp vụ.

**Ảnh hưởng**

- Giảm drift schema giữa máy dev.
- Dễ rollout nhất quán qua `migrate deploy` trên môi trường dùng chung.
- Các thay đổi schema score-sheet/PDF đã có lịch sử migration truy vết được.

## 2026-05-01 - Chốt mô hình 3 phiếu chấm hội đồng + điểm cuối theo trung bình

**Quyết định**

- Mỗi thành viên hội đồng có một phiếu chấm riêng, lưu theo cặp `(registrationId, evaluatorId)`.
- Dùng thêm bảng chi tiết tiêu chí cho từng phiếu:
  - `DefenseMemberScore`
  - `DefenseMemberCriterionScore`
- Điểm bảo vệ cuối cùng của sinh viên được tính bằng trung bình cộng điểm hệ 10 của các thành viên hội đồng đã nộp phiếu.
- Admin được chọn xem/sửa phiếu theo từng thành viên và export PDF theo đúng người chấm được chọn.

**Ảnh hưởng**

- Tăng tính minh bạch: truy vết được từng phiếu chấm theo thành viên.
- Giảm tranh chấp điểm: tách rõ điểm cá nhân và điểm cuối tổng hợp.
- Cần đảm bảo migration + restart backend sau rollout để tránh lệch Prisma Client.

---

## 2026-05-01 - Chốt xử lý lỗi export PDF do Supabase bucket

**Quyết định**

- `UploadService` phải kiểm tra bucket tồn tại trước upload.
- Nếu bucket chưa tồn tại thì tự tạo bucket public rồi tiếp tục upload.

**Ảnh hưởng**

- Loại bỏ lỗi runtime `Bucket not found` trong luồng xuất PDF.
- Giảm phụ thuộc thao tác cấu hình thủ công trên môi trường mới.

---

## 2026-05-02 - Chốt dùng 1 template HTML gốc cho cả chấm online và export PDF

**Quyết định**

- Dùng file `frontend/src/pages/lecturer/phieu_cham.html` làm template nguồn duy nhất.
- FE trang chấm điểm render trực tiếp từ template này và inject dữ liệu động.
- BE export PDF đọc chính template này để render PDF, không duy trì template riêng khác.

**Ảnh hưởng**

- Giảm lệch bố cục giữa màn hình chấm điểm và file PDF xuất ra.
- Tăng khả năng bảo trì (1 nguồn template thay đổi là cả FE/BE đồng bộ).
- Cần giữ kỷ luật cập nhật template có kiểm thử xuất PDF ngay sau mỗi thay đổi.

## 2026-05-02 - Chốt quy tắc nhập điểm ở phiếu chấm

**Quyết định**

- Ô điểm trong phiếu chấm dùng `input[type=number]` với `step=0.05`.

**Ảnh hưởng**

- Phù hợp yêu cầu chấm điểm chi tiết hơn so với step lớn hơn.
- Cần đảm bảo backend validate vẫn nằm trong giới hạn `maxScore` từng tiêu chí.
