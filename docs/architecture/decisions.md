# Quyết định kiến trúc và nghiệp vụ còn hiệu lực

> Bản tóm tắt tính đến 21/11/2026. Khi tài liệu và mã nguồn khác nhau, kiểm tra schema/API hiện hành trước khi sửa. Lịch sử và lý do đầy đủ: [nhật ký phiên](../sessions/2026-10-to-11-session-history.md).

| Quyết định | Lý do và nguồn chi tiết |
| --- | --- |
| `TopicRegistration` là thực thể trung tâm; một sinh viên một đề tài trong học kỳ, một đề tài tối đa một sinh viên, GVHD tối đa 10 sinh viên. Không phát triển `group/groupMember`. | Giữ một nguồn dữ liệu cho đăng ký, tiến độ và hội đồng. [Kiến trúc dữ liệu](../../.agents/rules/02-data-architecture.md), [quy trình](../../.agents/rules/01-business-workflow.md). |
| Thay đổi nghiệp vụ theo thứ tự CSDL/Prisma → Backend API → Frontend. UI dùng API thật khi có. | Tránh lệch hợp đồng và dữ liệu giả. [Quy chuẩn phát triển](../../.agents/rules/04-development-guidelines.md). |
| Biểu mẫu lưu nội dung có cấu trúc và tệp minh chứng; dữ liệu tệp học vụ phải qua cơ chế Storage phù hợp quyền. | Dữ liệu có thể kiểm tra tự động, bản ký vẫn được lưu. [Kiến trúc dữ liệu](../../.agents/rules/02-data-architecture.md), [vận hành Storage](../operations/supabase-storage-rollout.md). |
| Phân quyền chức vụ theo capability bên cạnh vai trò cơ sở; bảo vệ ở API và phản ánh ở UI. | Quyền ký duyệt, điều phối và chấm điểm không đồng nhất với tên vai trò. [Ma trận phân quyền](../rbac/authorization-matrix.md), [thiết kế capability](../superpowers/specs/2026-11-16-canonical-rbac-capability-design.md). |
| Duyệt nguyện vọng đề tài của GVHD và thẩm định BM01 của hội đồng là hai tác vụ riêng. | Khác chủ thể và thẩm quyền; trang riêng `/lecturer/approvals` và `/lecturer/outline-evaluations`. [Thiết kế tách hội đồng](../superpowers/specs/2026-11-20-outline-review-council-separation-design.md). |
| Dùng một `AcademicRoadmapStepper` cho sinh viên, giảng viên, quản trị viên, với dữ liệu/điều hướng theo vai trò. | Giữ sáu mốc và cách hiển thị thống nhất. [Thiết kế lộ trình](../superpowers/specs/2026-11-20-academic-roadmap-design.md). |
| Trên thanh công cụ đề tài GVHD, ưu tiên hành động **Đề xuất đề tài mới**; ẩn hành động sao chép kỳ trước khỏi vị trí chính. | Giảm nhiễu cho thao tác thường dùng; không suy ra chức năng sao chép nội bộ đã bị xóa. [Phiên 21/11](../sessions/2026-10-to-11-session-history.md). |
| Nhãn nút là tiếng Việt thuần, icon dùng `@ant-design/icons` qua prop `icon`; tệp text/code lưu UTF-8 không BOM. | Duy trì giao diện nhất quán và tránh lỗi mã hóa. [Quy chuẩn phát triển](../../.agents/rules/04-development-guidelines.md). |

Các chi tiết triển khai có thể thay đổi theo phiên; không dùng số test, PID, trạng thái kết nối hay kế hoạch cũ làm quy tắc kiến trúc.
