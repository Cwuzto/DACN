# Setup Clone DACN

Hướng dẫn cài nhanh trên máy mới để chạy được cả backend và frontend.

## 1. Điều kiện cần

- Node.js `>= 20`
- npm `>= 10`
- PostgreSQL database (khuyến nghị dùng Supabase như môi trường hiện tại của team)

Kiểm tra version:

```bash
node -v
npm -v
```

## 2. Clone mã nguồn

```bash
git clone <repo-url>
cd DACN
```

## 3. Cấu hình biến môi trường

### Backend (`backend/.env`)

Tạo file `.env` từ mẫu:

```bash
cd backend
cp .env.example .env
```

Nếu dùng PowerShell và lệnh `cp` không chạy:

```powershell
Copy-Item .env.example .env
```

Điền tối thiểu các biến sau:

```env
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require"
DB_POOL_MAX=2
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_POOL_CONNECTION_TIMEOUT_MS=10000
JWT_SECRET="replace-with-strong-secret"
JWT_EXPIRES_IN="7d"
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_STORAGE_BUCKET="dacn"
PORT=5000
NODE_ENV=development
```

### Frontend (`frontend/.env`)

```bash
cd ../frontend
cp .env.example .env
```

Nội dung mặc định:

```env
VITE_API_URL="http://localhost:5000/api"
```

## 4. Cài dependencies

```bash
cd ../backend
npm install
cd ../frontend
npm install
```

## 5. Khởi tạo database (migrate + seed)

```bash
cd ../backend
npx prisma migrate deploy
npm run db:seed
```

Tài khoản test nhanh sau khi seed:

- `admin@university.edu.vn / admin123`
- `lecturer01@university.edu.vn / lecturer123`
- `sv001@university.edu.vn / student123`

## 6. Chạy hệ thống

Terminal 1 (backend):

```bash
cd backend
npm run dev
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev
```

Truy cập:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/health`

## 7. Gate kiểm tra sau khi clone

Từ thư mục gốc repo:

```bash
node scripts/check-utf8.js
node scripts/check-md-quality.js
node scripts/regression-check.js
```

Nếu tất cả PASS thì môi trường clone mới đã sẵn sàng làm việc.

## 8. Lỗi thường gặp

- `P1001/P1000` khi migrate: kiểm tra lại `DATABASE_URL` và quyền truy cập DB.
- `maxClientsInSessionMode: max clients reached`: giảm `DB_POOL_MAX` (khuyến nghị `2`) hoặc tăng pool size ở DB pooler.
- Lỗi CORS hoặc frontend không gọi được API: kiểm tra `frontend/.env` (`VITE_API_URL`).
- Lỗi upload file: kiểm tra `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
