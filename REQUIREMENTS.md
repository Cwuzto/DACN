# Yêu Cầu Hệ Thống, Môi Trường & Nghiệp Vụ (REQUIREMENTS)

Tài liệu này tổng hợp đầy đủ yêu cầu môi trường cài đặt, biến cấu hình, danh sách thư viện phụ thuộc và các ràng buộc nghiệp vụ cốt lõi của **Hệ thống Quản lý Đồ án — Viện Công nghệ Số (DACN)**.

---

## 1. Yêu Cầu Môi Trường (System Prerequisites)

| Thành phần | Phiên bản khuyến nghị | Ghi chú |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.x` (đã xác thực trên `v24.x`) | Dùng chung cho cả `backend/` và `frontend/` |
| **npm** | `>= 10.x` | Cài đặt dependencies & chạy script |
| **PostgreSQL** | `>= 15.x` | CSDL chính qua Prisma ORM 7 (`@prisma/adapter-pg`) |
| **Supabase Storage** | Cloud hoặc Self-hosted | Lưu trữ tệp PDF/Word/Slide theo kiến trúc 4 buckets (`cong-khai`, `hoc-vu`, `ca-nhan`, `tam`) |
| **Trình duyệt (Chromium)** | Bản mới nhất | Phục vụ xuất PDF (`puppeteer`) và kiểm thử E2E (`playwright`) |
| **Ollama / Gemini API** | Tùy chọn | Dùng cho các tính năng trợ lý AI (BM01 Copilot, BM04 Suggestion, Đối soát lưu chiểu) |

---

## 2. Biến Môi Trường (Environment Variables)

### Backend (`backend/.env` — mẫu tại `backend/.env.example`)

| Biến | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL (`postgresql://user:pass@host:5432/db`) |
| `DB_POOL_MAX` | Không | Số kết nối tối đa trong pool (mặc định `8`) |
| `DB_POOL_IDLE_TIMEOUT_MS` | Không | Thời gian chờ đóng kết nối nhàn rỗi (mặc định `30000`) |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | Không | Thời gian chờ kết nối DB (mặc định `15000`) |
| `JWT_SECRET` | Có | Chuỗi bí mật ký JWT access token |
| `JWT_EXPIRES_IN` | Không | Thời hạn token (mặc định `7d`) |
| `SUPABASE_URL` | Có | URL dự án Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Có | Service role key để quản lý lưu trữ tệp |
| `PORT` | Không | Cổng chạy Express server (mặc định `5000`) |
| `NODE_ENV` | Không | `development` / `production` / `test` |
| `ENABLE_PENDING_REMINDER_JOB` | Không | Bật/tắt job nhắc việc định kỳ (`true`/`false`) |
| `PENDING_REMINDER_INTERVAL_MINUTES` | Không | Chu kỳ chạy job nhắc việc tính bằng phút (mặc định `60`) |
| `SYSTEM_ACTOR_USER_ID` | Không | ID tài khoản hệ thống ghi audit log (mặc định `1`) |
| `MAX_SUBMISSIONS_PER_TASK` | Không | Số lần nộp tối đa cho mỗi task (mặc định `3`) |
| `AI_PROVIDER` | Không | `ollama` hoặc `gemini` |
| `OLLAMA_BASE_URL` | Không | URL Ollama local (mặc định `http://localhost:11434`) |
| `OLLAMA_CHAT_MODEL` | Không | Model chat Ollama (mặc định `qwen2.5:3b`) |
| `OLLAMA_EMBED_MODEL` | Không | Model embedding Ollama (mặc định `embeddinggemma-2:270m`) |
| `OLLAMA_TIMEOUT_MS` | Không | Timeout gọi Ollama (mặc định `120000`) |
| `GEMINI_API_KEY` | Không | API key Google Gemini (khi `AI_PROVIDER=gemini`) |
| `GEMINI_MODEL` | Không | Tên model Gemini (mặc định `gemini-3.5-flash-lite`) |

### Frontend (`frontend/.env` — mẫu tại `frontend/.env.example`)

| Biến | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `VITE_API_URL` | Có | Base URL tới Backend API (mặc định `http://localhost:5000/api`) |

---

## 3. Thư Viện Phụ Thuộc Chính (Dependencies)

### Backend (`backend/package.json`)
- **Runtime:** `express@^5.2.1`, `@prisma/client@^7.4.2`, `@prisma/adapter-pg@^7.4.2`, `pg@^8.19.0`, `@supabase/supabase-js@^2.103.0`, `jsonwebtoken@^9.0.3`, `bcryptjs@^3.0.3`, `cors@^2.8.6`, `dotenv@^17.3.1`, `express-validator@^7.3.1`, `multer@^2.1.0`, `pdfkit@^0.18.0`, `puppeteer@^24.42.0`, `sanitize-html@^2.13.0`, `swagger-jsdoc@^6.2.8`, `swagger-ui-express@^5.0.1`, `xlsx@^0.18.5`, `yauzl@^3.4.0`.
- **Development & Test:** `prisma@^7.4.2`, `nodemon@^3.1.14`, `jest@^30.3.0`, `supertest@^7.2.2`, `@types/node@^25.5.0`.

### Frontend (`frontend/package.json`)
- **Runtime:** `react@^19.2.0`, `react-dom@^19.2.0`, `react-router-dom@^7.13.1`, `antd@^6.3.1`, `@ant-design/icons@^6.1.0`, `@tanstack/react-query@^5.107.1`, `zustand@^5.0.11`, `axios@^1.13.6`, `dayjs@^1.11.19`, `tus-js-client@^4.3.1`, `xlsx@^0.18.5`.
- **Development & Test:** `vite@^7.3.1`, `@vitejs/plugin-react@^5.1.1`, `tailwindcss@^3.4.19`, `postcss@^8.5.8`, `autoprefixer@^10.4.27`, `eslint@^9.39.1`, `vitest@^5.1.0`, `@testing-library/react@^16.3.3`, `@testing-library/jest-dom@^7.0.1`, `@testing-library/user-event@^16.3.0`, `@playwright/test@^1.65.1`, `jsdom@^29.1.1`.

---

## 4. Yêu Cầu Nghiệp Vụ & Ràng Buộc Kỹ Thuật

1. **Mô hình đăng ký `TopicRegistration`:**
   - Mỗi sinh viên chỉ đăng ký `1` đề tài trong một học kỳ (`Topic.maxStudents = 1`).
   - Mỗi giảng viên hướng dẫn tối đa `10` sinh viên trong một đợt.
   - Không sử dụng hay khôi phục kiến trúc nhóm cũ (`group/groupMember`).
2. **Danh mục đơn vị học thuật cố định (Viện Công nghệ Số):**
   - **Bộ môn Giảng viên (Dropdown cố định):** `Công Nghệ Thông Tin`, `Hệ thống Thông tin`.
   - **Ngành Sinh viên (Dropdown cố định):** `Công Nghệ Thông Tin`, `Kỹ thuật Phần mềm`, `Hệ thống Thông tin`, `Trí Tuệ Nhân Tạo`.
3. **Chuẩn quy trình biểu mẫu & lưu chiểu:**
   - Vòng đời bắt buộc: `BM01` (Đề cương) → `BM02` (Đơn giao đề tài & Quyết định) → `BM03` (Tiến độ & SV xác nhận 48h) → Lưu chiểu sơ bộ & `BM04` (Nhận xét GVHD) → Khóa Rubric `10.0` → Hội đồng Bảo vệ (tối thiểu 3 thành viên, không trùng GVHD) → Chấm điểm, Khóa sổ, Phê duyệt & Công bố kết quả (`BM05`) → Hoàn thiện Lưu chiểu sau bảo vệ (14 ngày) → Cấp Giấy xác nhận hoàn thành.
   - `BM02-A` (Điều chỉnh tên đề tài) chỉ hiển thị khi sinh viên thực sự có nộp yêu cầu.
   - **Kho Lưu Chiểu Số (4 tài liệu):** `Báo cáo Word (.docx)`, `Báo cáo PDF (.pdf)`, `Video Demo (Link ngoài https://)`, `Slide thuyết trình (.pptx)`.
4. **Chuẩn mã nguồn & giao diện:**
   - Tất cả tệp mã nguồn và tài liệu lưu chuẩn **UTF-8 (no BOM)**.
   - Bộ font giao diện đồng bộ: `Lexend` (tiêu đề), `Inter` (nội dung), `JetBrains Mono` (mã số/điểm/KPI).
   - Nút bấm sử dụng `@ant-design/icons` qua prop `icon`, không chèn ký tự thô hoặc emoji vào nhãn văn bản.
