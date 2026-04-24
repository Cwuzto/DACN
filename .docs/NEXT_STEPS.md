# NEXT_STEPS.md

## Trọng tâm hiện tại

Triển khai batch nghiệp vụ đã chốt ngày 2026-04-22, đồng thời giữ chất lượng demo ổn định.

## Việc cần làm tiếp

### Ưu tiên cao

- [ ] Triển khai auto-reject đăng ký `PENDING` sau 5 ngày không phản hồi.
- [ ] Triển khai auto-reject đăng ký `PENDING` khi kết thúc thời gian đăng ký (`registrationDeadline`).
- [ ] Cập nhật API + UI trang "Đề tài của tôi" (LECTURER):
  - Hiển thị tên sinh viên đăng ký thay cho `1/1`.
  - Search theo tên sinh viên.
  - Bỏ filter "Bản nháp".
- [ ] Chuẩn hóa filter mặc định toàn hệ thống: đợt hiện tại, hoặc đợt gần nhất vừa kết thúc nếu chưa có đợt mới.
- [x] Bổ sung backend API "Admin Defense Center" để gom điều phối bảo vệ/chấm điểm về một nơi.

### Ưu tiên trung bình

- [ ] Thiết kế và triển khai bảng chấm điểm hội đồng online theo barem.
- [ ] Hỗ trợ xuất bảng điểm online ra PDF.
- [ ] Định nghĩa và triển khai trạng thái tài khoản cho sinh viên đã hoàn thành đồ án tốt nghiệp.

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