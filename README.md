# Hệ thống Quản lý Đồ án

## Bắt đầu nhanh

Xem hướng dẫn cài đặt và chạy dự án tại: [SETUP_CLONE.md](./SETUP_CLONE.md)

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

- `AGENTS.md`
- `PROJECT_STATE.md`
- `NEXT_STEPS.md`
- `DECISIONS.md`
- `TOMORROW_PLAN.md`
