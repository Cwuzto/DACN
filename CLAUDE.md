# Hướng dẫn làm việc với dự án DACN

Tài liệu này là điểm bắt đầu ngắn gọn cho AI Agent. Đọc [AGENTS.md](AGENTS.md) để biết quy tắc phiên làm việc và các ràng buộc bắt buộc. Trạng thái, kế hoạch và kết quả kiểm thử chi tiết nằm ở các tài liệu liên kết bên dưới.

## Tổng quan

- Hệ thống quản lý đồ án và khóa luận tốt nghiệp của Viện Công nghệ Số.
- Frontend: React 19, Vite, Ant Design, Tailwind CSS, Zustand (`frontend/`).
- Backend: Node.js, Express, Prisma, PostgreSQL, JWT (`backend/`); tệp lưu trên Supabase Storage.
- Mô hình nghiệp vụ trung tâm là `TopicRegistration`: một sinh viên đăng ký một đề tài trong học kỳ, `Topic.maxStudents = 1`, mỗi GVHD tối đa 10 sinh viên. Không phát triển theo `group/groupMember` cũ.
- Khi sửa luồng nghiệp vụ, kiểm tra theo thứ tự Prisma/CSDL → Backend API → Frontend. Giao diện dùng API thật khi đã có; nút có biểu tượng dùng `@ant-design/icons`, nhãn chữ thuần Việt. Lưu file UTF-8 không BOM.

## Bản đồ tài liệu

| Cần tìm | Tài liệu |
| --- | --- |
| Trạng thái hiện tại, việc tiếp theo, mức kiểm chứng | [docs/project-status.md](docs/project-status.md) |
| Quyết định kiến trúc và nghiệp vụ còn hiệu lực | [docs/architecture/decisions.md](docs/architecture/decisions.md) |
| Quy trình BM01–BM04, hội đồng, bảo vệ | [.agents/rules/01-business-workflow.md](.agents/rules/01-business-workflow.md) |
| Mô hình dữ liệu | [.agents/rules/02-data-architecture.md](.agents/rules/02-data-architecture.md) và `backend/prisma/schema.prisma` |
| Vai trò, phân quyền | [.agents/rules/03-roles-and-permissions.md](.agents/rules/03-roles-and-permissions.md), [ma trận quyền](docs/rbac/authorization-matrix.md) |
| Lệnh chạy, chuẩn mã | [.agents/rules/04-development-guidelines.md](.agents/rules/04-development-guidelines.md) |
| Thiết kế và kế hoạch theo tính năng | [docs/superpowers/specs](docs/superpowers/specs), [docs/superpowers/plans](docs/superpowers/plans) |
| Nhật ký phiên cũ, giữ nguyên văn | [docs/sessions/2026-10-to-11-session-history.md](docs/sessions/2026-10-to-11-session-history.md) |

Đối chiếu `schema.prisma` và code khi tài liệu mô tả enum/API khác hiện trạng. Các kế hoạch cũ phản ánh thời điểm viết, không mặc nhiên là backlog hiện tại.

## Session Update — 21/11/2026

### 1. Những phần đã hoàn thành

- Trong phiên gần nhất: tinh gọn thanh công cụ đề tài giảng viên; thiết kế lại điều hướng và logo cổng thông tin, gồm bố cục responsive và hỗ trợ giảm chuyển động. Chi tiết và commit tương ứng được giữ trong [nhật ký phiên](docs/sessions/2026-10-to-11-session-history.md).
- Lần bảo trì tài liệu này: chuyển nguyên văn lịch sử phiên khỏi `CLAUDE.md`, tổng hợp trạng thái và quyết định vào tài liệu riêng, sửa các liên kết tài liệu lỗi thời.

### 2. Trạng thái cập nhật của từng phần

- Frontend: phiên 21/11 ghi nhận 445/445 test và production build đạt. Đây là kết quả lịch sử, cần chạy lại khi có thay đổi code.
- Backend, DB: lần bảo trì tài liệu này không thay đổi code hoặc schema; trạng thái chức năng xem [project-status.md](docs/project-status.md).
- MCP: chưa kiểm tra kết nối trong lần bảo trì tài liệu này.
- Test: chỉ kiểm tra cấu trúc, liên kết và encoding của tài liệu; không chạy lại test ứng dụng vì không sửa code.

### 3. Bước tiếp theo cần làm

1. Kiểm tra trực quan Homepage và luồng từ nút **Bàn làm việc** tới dashboard từng vai trò.
2. Kiểm tra lộ trình sáu mốc và chuyển trạng thái giữa các vai trò trên trình duyệt.
3. Nếu tiếp tục thiết kế Homepage, đối chiếu dữ liệu API và kiểm thử giao diện sau thay đổi.

### 4. Quyết định quan trọng

- `CLAUDE.md` chỉ giữ điểm vào, trạng thái cô đọng và kế hoạch gần nhất; lịch sử đầy đủ nằm trong `docs/sessions/` để tránh tăng dung lượng theo mỗi phiên.
- Quy tắc nghiệp vụ và quyết định dài hạn có nơi lưu riêng; khi kết thúc phiên, cập nhật bốn mục Session Update ở đây và bổ sung tài liệu chi tiết nếu phát sinh quyết định mới.
