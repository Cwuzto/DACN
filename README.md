# Hệ thống Quản lý Đồ án

## Bắt đầu nhanh

Xem [quy chuẩn phát triển và lệnh chạy](.agents/rules/04-development-guidelines.md). Cấu hình môi trường theo các tệp mẫu trong `backend/` và `frontend/` trước khi khởi động.

## Giới thiệu

Dự án quản lý quy trình đồ án cho 3 vai trò:

- `ADMIN`
- `LECTURER`
- `STUDENT`

Các luồng chính:

1. Quản lý học kỳ/đợt đồ án.
2. Quản lý đề tài và đăng ký đề tài theo `TopicRegistration`.
3. Theo dõi tiến độ qua `Task`, `Submission`, `Milestone`.
4. Phân công hội đồng và chấm bảo vệ.
5. Lưu kết quả bảo vệ (`DefenseResult`).

## Công nghệ

### Frontend (`frontend/`)

- React + Vite
- Ant Design
- Tailwind CSS
- Zustand
- Axios

### Backend (`backend/`)

- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT
- Supabase Storage

## Lưu ý kiến trúc

- Mô hình chuẩn hiện tại: `TopicRegistration`.
- Không quay lại kiến trúc cũ `group/groupMember/evaluation` khi chưa có quyết định mới.

## Tài liệu quan trọng

- [Hướng dẫn cho agent](CLAUDE.md)
- [Quy tắc làm việc](AGENTS.md)
- [Trạng thái và ưu tiên hiện tại](docs/project-status.md)
- [Quyết định kiến trúc và nghiệp vụ](docs/architecture/decisions.md)
- [Quy trình, dữ liệu, phân quyền và quy chuẩn](.agents/rules/)
- [Lịch sử phiên đã lưu trữ](docs/sessions/2026-10-to-11-session-history.md)
