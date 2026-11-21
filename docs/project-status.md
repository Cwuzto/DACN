# Trạng thái dự án DACN

> Cập nhật tài liệu: 21/11/2026. Đây là bản bàn giao ngắn; trạng thái chạy thực tế phải được kiểm tra lại trong phiên mới. Nhật ký chi tiết nằm tại [lịch sử phiên](sessions/2026-10-to-11-session-history.md).

## Phạm vi hiện có

- Hệ thống quản lý đồ án/khóa luận gồm React SPA, Express API, Prisma và PostgreSQL (Supabase); tệp học vụ lưu qua Supabase Storage.
- Luồng nghiệp vụ dựa trên `TopicRegistration`: đăng ký đề tài, BM01, BM02, BM03, BM04, hội đồng bảo vệ, công bố kết quả và lưu chiểu. Quy trình chuẩn: [01-business-workflow.md](../.agents/rules/01-business-workflow.md).
- Quyền truy cập theo vai trò và capability; xem [ma trận phân quyền](rbac/authorization-matrix.md). Hội đồng thẩm định đề cương có trang riêng `/lecturer/outline-evaluations`, tách khỏi duyệt nguyện vọng `/lecturer/approvals`.
- Lộ trình 6 mốc dùng chung qua `AcademicRoadmapStepper` trên tổng quan sinh viên, giảng viên và quản trị viên. Trang chủ đã có thanh điều hướng mới và nút vào Bàn làm việc theo vai trò.

## Tình trạng theo thành phần

| Thành phần | Thông tin có căn cứ | Cần xác nhận khi vận hành |
| --- | --- | --- |
| CSDL/Prisma | Schema có `TopicRegistration`, `Council`, `BM04Evaluation` và các enum quy trình. | Kết nối Supabase, migration và dữ liệu của môi trường đang dùng. |
| Backend API | Nhật ký 21/11 ghi không đổi cấu trúc backend trong phiên đó; API nghiệp vụ và phân quyền đã được triển khai qua các phiên trước. | Khởi động API và chạy lại test khi sửa backend. |
| Frontend | Mã nguồn có lộ trình 6 mốc, trang thẩm định riêng và điều hướng trang chủ mới. | Kiểm tra trình duyệt với dữ liệu thật, desktop/mobile và từng vai trò. |
| Storage/MCP | Có tài liệu [vận hành Supabase Storage](operations/supabase-storage-rollout.md); trạng thái kết nối MCP phụ thuộc phiên làm việc. | Kiểm tra kết nối trước khi thao tác dữ liệu. |
| Test/build | Nhật ký phiên 21/11 ghi nhận **445/445 frontend tests** và production build đạt tại thời điểm đó; phiên 20/11 ghi backend unit/contract tests đạt. | Đây không phải kết quả xác thực mới. Chạy lại các lệnh trong [quy chuẩn phát triển](../.agents/rules/04-development-guidelines.md) sau thay đổi mã nguồn. |

## Ưu tiên tiếp theo

1. **P0:** Kiểm tra trực quan trên browser luồng từ nút **Bàn làm việc** đến dashboard của từng vai trò; kiểm tra lộ trình 6 mốc trên cả ba vai trò và chuyển trạng thái liên vai trò bằng dữ liệu thực.
2. **P1:** Hoàn thiện đồng bộ thiết kế các khối nội dung còn lại của trang chủ (hero, danh bạ giảng viên, kho biểu mẫu) sau khi xác nhận hành vi hiện tại.
3. **P1:** Kiểm thử luồng vận hành từ tạo đợt, gán GVHD/SV, đề xuất đề tài đến đăng ký và duyệt trên môi trường dữ liệu mới trước khi coi là nghiệm thu toàn tuyến.

Các kế hoạch chi tiết theo hạng mục ở [`docs/superpowers/plans/`](superpowers/plans/); kế hoạch cũ cần đối chiếu mã nguồn trước khi thực thi.
