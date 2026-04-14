# SETUP_CLONE.md

Hướng dẫn nhanh cho thành viên mới clone repo `DACN` và chạy được ngay.

## 1. Điều kiện cần

- Node.js `>= 20`
- npm `>= 10`
- Có quyền truy cập project Supabase (để lấy `DATABASE_URL`)

## 2. Clone project

```bash
git clone <repo-url>
cd DACN
```

## 3. Cấu hình môi trường backend

```bash
cd backend
cp .env.example .env
```

Điền tối thiểu các biến sau trong `backend/.env`:

```env
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require"
JWT_SECRET="mot-secret-bat-ky-nhung-kho-doan"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development

SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
SUPABASE_STORAGE_BUCKET="dacn"
```

## 4. Cài dependency

```bash
cd backend
npm install
cd ../frontend
npm install
```

## 5. Chạy migrate + seed

```bash
cd backend
npx prisma migrate deploy
npm run db:seed
```

## 6. Chạy hệ thống

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

## 7. Kiểm tra nhanh sau khi clone

```bash
cd ..
node scripts/check-utf8.js
node scripts/check-md-quality.js
node scripts/regression-check.js
```

Nếu cả ba lệnh PASS là có thể bắt đầu làm việc.
