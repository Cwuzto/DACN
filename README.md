# Hệ thống Quản lý Đồ án

## 1. Giới thiệu

Đây là dự án web quản lý quy trình đồ án cho 3 vai trò:

- `ADMIN`
- `LECTURER`
- `STUDENT`

Mục tiêu:

1. Quản lý học kỳ/đợt đồ án.
2. Quản lý đề tài và phê duyệt đề tài.
3. Đăng ký đề tài theo mô hình `TopicRegistration`.
4. Theo dõi tiến độ qua `Task`, `Submission`, `Milestone`.
5. Phân công hội đồng và chấm bảo vệ.
6. Lưu kết quả bảo vệ (`DefenseResult`).

---

## 2. Công nghệ

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
- Cloudinary

---

## 3. Kiến trúc dữ liệu hiện tại

Mô hình chuẩn đang dùng:

- `User`
- `Semester`
- `Topic`
- `TopicRegistration`
- `Task`
- `Submission`
- `Milestone`
- `Council`
- `CouncilMember`
- `DefenseResult`
- `Notification`

Lưu ý: Không quay lại kiến trúc cũ `group/groupMember/evaluation` nếu chưa có quyết định mới.

---

## 4. Trạng thái hiện tại

Đã hoàn thành các phần chính:

- Workflow E2E theo `TopicRegistration`.
- Đồng bộ phần lớn frontend với API thật, dọn mock/hardcode chính.
- Hoàn thiện các batch role-flow quan trọng (admin/lecturer/student).
- Bổ sung nền tảng test backend (unit + integration route-level cho nhóm chính).
- Bổ sung gate UTF-8 và regression check.
- Chuẩn hóa `GradingDefensePage` sang tiếng Việt UTF-8.
- Làm mới seed dữ liệu thật theo hướng logic nghiệp vụ.

---

## 5. Cấu hình môi trường

### Backend (`backend/.env`)

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `PORT`
- `NODE_ENV`

### Frontend (`frontend/.env`)

- `VITE_API_URL`

Các file mẫu:

- `backend/.env.example`
- `frontend/.env.example`

---

## 6. Cách chạy

### Backend

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 7. Tài khoản mẫu

- Admin: `admin@university.edu.vn / admin123`
- Giảng viên: `nguyenvana@university.edu.vn / lecturer123`
- Sinh viên: `sv001@university.edu.vn / student123`

---

## 8. Prisma Release Checklist

Khi thay đổi `schema.prisma`:

1. Tạo/apply migration (`migrate dev` hoặc `migrate deploy`).
2. `npx prisma generate`.
3. Restart backend.
4. Chạy gate trước khi chốt batch:

```bash
node scripts/check-utf8.js
node scripts/regression-check.js
```

---

## 9. Tài liệu trạng thái cần đọc mỗi phiên

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `NEXT_STEPS.md`
4. `DECISIONS.md`
5. `TOMORROW_PLAN.md`
