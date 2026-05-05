# TOMORROW_PLAN.md

## Mục tiêu ngắn hạn

Chuyển sang pha P2: chuẩn bị dữ liệu và quy trình cho import enrollment theo Excel, đồng thời giữ hệ thống ổn định sau các thay đổi lớn đã chốt.

## Kế hoạch thực thi

1. P2.1 - Chuẩn bị metadata import
   - Rà schema/enrollment để chốt use-case `source=EXCEL`.
   - Chuẩn hóa `importBatchId` để truy vết theo từng đợt import.
2. P2.2 - Chuẩn bị vận hành import
   - Soạn checklist chạy import trên môi trường dùng chung.
   - Chốt quy tắc kiểm tra dữ liệu đầu vào và rollback khi import lỗi.
3. P2.3 - Quality gate
   - Chạy lại regression-check + backend test + frontend build sau mọi thay đổi.

## Tiêu chí hoàn tất

- Có thiết kế/contract rõ cho metadata import (`source`, `importBatchId`).
- Có checklist import dùng được cho team.
- Tất cả gate PASS, không phát sinh regression.

## Ghi nhận đã hoàn tất

- P1 đã hoàn thành end-to-end (API/UI/gate).
- Migration Prisma score-sheet/PDF đã deploy thành công và DB ở trạng thái up-to-date.

## Cập nhật tiến độ mới (2026-05-01)

- Đã hoàn tất batch nâng cấp chấm điểm hội đồng theo 3 phiếu độc lập.
- Đã áp dụng migration `20260501194000_add_defense_member_scores` và DB đang up-to-date.
- Đã hoàn thiện luồng admin chọn người chấm trong modal và xuất PDF theo đúng người đang chọn.
- Đã sửa lỗi `Bucket not found` trong export PDF bằng cơ chế tự kiểm tra/tạo bucket.
- Đã sửa lỗi encoding tiếng Việt ở trang `GradingDefensePage`.

## Cập nhật tiến độ mới (2026-05-02)

- Đã chốt về áp dụng template chấm điểm HTML gốc cho cả FE và BE.
- Đã đưa luồng chấm điểm giảng viên sang trang riêng theo biểu mẫu thực tế.
- Đã đổi step nhập điểm sang `0.05`.
- Đã fix nhóm lỗi export PDF:
  - bucket storage,
  - căn lề trang,
  - trang trắng dư.

## Ưu tiên ngày tiếp theo

1. Chạy smoke test E2E với 2-3 hồ sơ mẫu trên luồng mới.
2. Chốt lại `ONLINE_GRADING_PDF_SPEC.md` theo cơ chế template chung.
3. Nếu còn lệch bố cục in trên máy thực tế: tinh chỉnh thông số `@page` trong 1 batch nhỏ.

## Cập nhật bổ sung 2026-05-06 (append)
1. Chốt toàn bộ lỗi tiếng Việt hiển thị ở các trang admin/lecturer ưu tiên.
2. Chạy lại smoke test cho các luồng đã đổi nghiệp vụ task review.
3. Theo dõi job thông báo deadline trong ít nhất 1 chu kỳ để xác nhận hành vi gửi thực tế.
