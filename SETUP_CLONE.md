# SETUP_CLONE.md

Hướng dẫn này dành cho thành viên mới clone repo `DACN` về máy và chạy được ngay.

## 1. Điều kiện cần

- Node.js `>= 20`
- npm `>= 10`
- Có quyền truy cập project Supabase (lấy được `DATABASE_URL`)

## 2. Clone project

```bash
git clone <repo-url>
cd DACN
```

## 3. Cấu hình biến môi trường

### Backend

```bash
cd backend
cp .env.example .env
```

Mở `backend/.env` và điền tối thiểu:

```env
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require"
JWT_SECRET="mot-secret-bat-ky-nhung-kho-doan"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
```

Lưu ý:
- `DATABASE_URL` phải trỏ đúng **Supabase project đang dùng chung**.
- `JWT_SECRET` bắt buộc phải có, thiếu biến này login sẽ lỗi.

### Frontend

```bash
cd ../frontend
cp .env.example .env
```

Mở `frontend/.env`:

```env
VITE_API_URL="http://localhost:5000/api"
```

## 4. Cài package và chuẩn bị database

### Backend

```bash
cd ../backend
npm install
npx prisma migrate deploy
npm run db:seed
```

Giải thích nhanh:
- `migrate deploy`: áp migration lên DB Supabase (an toàn để chạy lại).
- `db:seed`: tạo dữ liệu mẫu và tài khoản login.

## 5. Chạy dự án

Mở 2 terminal:

Terminal 1 (backend):
```bash
cd backend
npm run dev
```

Terminal 2 (frontend):
```bash
cd frontend
npm install
npm run dev
```

## 6. Tài khoản đăng nhập mẫu

- Admin: `admin@university.edu.vn / admin123`
- Lecturer: `nguyenvana@university.edu.vn / lecturer123`
- Student: `sv001@university.edu.vn / student123`

## 7. Checklist khi "không login được"

1. Kiểm tra `backend/.env` có đúng `DATABASE_URL` và có `JWT_SECRET`.
2. Chạy:
   - `npx prisma migrate status`
   - `npm run db:seed`
3. Đảm bảo backend chạy cổng `5000`.
4. Đảm bảo frontend trỏ đúng `VITE_API_URL=http://localhost:5000/api`.
5. Nếu frontend chạy cổng lạ (không phải `5173` hoặc `5174`), cập nhật CORS trong `backend/src/app.js`.

## 8. Lưu ý làm việc nhóm

- Không commit file `.env`.
- Khi có thay đổi Prisma schema:
  1. tạo migration mới,
  2. cập nhật schema,
  3. báo team chạy lại migrate.
- Trước khi chốt batch, chạy gate:

```bash
node scripts/check-utf8.js
node scripts/regression-check.js
```
