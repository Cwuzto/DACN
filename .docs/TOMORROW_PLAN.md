# TOMORROW_PLAN.md

## Mục tiêu ngắn hạn

Triển khai batch yêu cầu nghiệp vụ mới đã chốt ngày 2026-04-22, ưu tiên auto-reject đăng ký và cập nhật trải nghiệm cho giảng viên.

## Kế hoạch thực thi

1. Hoàn thiện backend auto-reject:
   - Reject `PENDING` quá 5 ngày.
   - Reject `PENDING` khi qua `registrationDeadline`.
   - Đảm bảo audit log + notification liên quan.
2. Cập nhật lọc dữ liệu theo đợt mặc định:
   - Đợt hiện tại.
   - Nếu không có, fallback đợt gần nhất vừa kết thúc.
3. Cập nhật trang "Đề tài của tôi" cho lecturer:
   - Hiển thị tên sinh viên đăng ký.
   - Search theo tên sinh viên.
   - Bỏ filter bản nháp.
4. Thiết kế khung dữ liệu cho bảng chấm điểm hội đồng online + xuất PDF.
5. Chốt phương án hạn quyền tài khoản sinh viên đã hoàn thành đồ án tốt nghiệp và bắt đầu triển khai.

## Tiêu chí hoàn tất

- Auto-reject chạy đúng rule thời gian.
- Trang lecturer hiển thị/sort/search đúng theo sinh viên đăng ký.
- Filter mặc định đúng theo đợt hiện tại hoặc đợt gần nhất vừa kết thúc.
- Thiết kế bảng chấm điểm online và lộ trình xuất PDF được chốt kỹ thuật.
- Không còn lỗi encoding/mojibake hoặc tiếng Việt không dấu bất thường trong tài liệu.

