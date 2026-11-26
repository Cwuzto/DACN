# Hệ Thống Quản Lý Đồ Án & Khóa Luận Tốt Nghiệp — Viện Công Nghệ Số (DACN)

Nền tảng số hóa toàn bộ vòng đời thực hiện đồ án và khóa luận tốt nghiệp tại **Viện Công nghệ Số**, hỗ trợ phân quyền chi tiết theo năng lực (Capability-based RBAC), quy trình biểu mẫu học vụ chuẩn **BM01 → BM05**, hội đồng xét duyệt/bảo vệ và kho lưu chiểu số.

---

## 1. Tính Năng Chính Theo Vai Trò

### Quản trị viên & Giáo vụ (`ADMIN`)
- Quản lý người dùng (tạo/sửa/import Excel) và nhóm quyền phân cấp theo năng lực.
- Quản lý đợt đồ án / học kỳ, chính sách thời gian (`PeriodWorkflowPolicyVersion`), loại đồ án và điều phối sinh viên.
- Quản lý danh mục đề tài, phê duyệt đề tài, lập **Hội đồng xét duyệt đề cương** & **Hội đồng bảo vệ** (kiểm tra tự động xung đột lợi ích với GVHD).
- Thiết lập, kích hoạt & khóa **Rubric chấm điểm bảo vệ** (thang 10.0 điểm), theo dõi sổ điểm, công bố danh sách đủ điều kiện bảo vệ và xem chi tiết hồ sơ quá trình của từng sinh viên.
- Quản lý cổng thông tin công khai (Portal), thông báo và báo cáo thống kê học vụ.

### Giảng viên & Viện trưởng (`LECTURER`)
- Đề xuất/quản lý đề tài hướng dẫn (tối đa `10` sinh viên/GVHD) và duyệt nguyện vọng đăng ký.
- Chấm thẩm định đề cương (**BM01**) theo phân công hội đồng; theo dõi quá trình hướng dẫn, ghi nhật ký buổi gặp và đánh giá giữa kỳ/cuối kỳ (**BM03**).
- Lập, lưu nháp và ký số phiếu nhận xét điều kiện bảo vệ (**BM04**) kèm kiểm tra lưu chiểu sơ bộ; xử lý yêu cầu điều chỉnh tên đề tài (**BM02-A**).
- Chấm điểm bảo vệ theo Rubric trên phiếu cá nhân; với vai trò **Viện trưởng**, thực hiện ký duyệt BM02, ban hành Quyết định giao đề tài, khóa sổ điểm hội đồng, phê duyệt kết quả và công bố kết quả học kỳ.

### Sinh viên (`STUDENT`)
- Tra cứu, lọc theo chuyên ngành và đăng ký đề tài (`1` sinh viên / `1` đề tài, `maxStudents = 1`) hoặc đề xuất đề tài mới.
- Nộp đề cương (**BM01**), đơn đăng ký giao đề tài (**BM02**), xác nhận phiếu tiến độ (**BM03**) trong thời hạn 48 giờ, đề xuất điều chỉnh tên đề tài (**BM02-A**) khi cần.
- Nộp **Kho Lưu Chiểu Số** gồm 4 thành phần (`Báo cáo Word`, `Báo cáo PDF`, `Link Video Demo`, `Slide thuyết trình`) kèm cảnh báo hạn nộp sơ bộ (trước bảo vệ 3 ngày) và hạn đóng cổng (14 ngày sau bảo vệ).
- Tra cứu điểm bảo vệ chính thức, kết quả xếp loại, bản in A4 các biểu mẫu và Giấy xác nhận hoàn thành.

---

## 2. Quy Trình Nghiệp Vụ Chuẩn

```text
Đăng ký đề tài (TopicRegistration)
  → BM01: Nộp & Thẩm định đề cương (HĐ Đề cương)
  → BM02: Ký 3 cấp (SV → GVHD → Bộ môn/Viện) & Ban hành Quyết định giao đề tài
  → BM03: Nhật ký hướng dẫn, Đánh giá giữa kỳ/cuối kỳ & SV xác nhận
  → Lưu chiểu sơ bộ & BM04: GVHD ký nhận xét đủ điều kiện bảo vệ
  → Khóa Rubric 10.0 → Lập HĐ Bảo vệ → Công bố DS đủ ĐK bảo vệ
  → Chấm điểm 3 thành viên HĐ → Khóa sổ → Phê duyệt → Công bố kết quả học kỳ (BM05)
  → Hoàn thiện Lưu chiểu sau bảo vệ (14 ngày) → Nghiệm thu & Cấp Giấy xác nhận hoàn thành
```

### Danh Mục Bộ Môn & Ngành Chuẩn (Viện Công Nghệ Số)
- **Bộ môn (Giảng viên):** `Công Nghệ Thông Tin`, `Hệ thống Thông tin`.
- **Ngành (Sinh viên):** `Công Nghệ Thông Tin`, `Kỹ thuật Phần mềm`, `Hệ thống Thông tin`, `Trí Tuệ Nhân Tạo`.

---

## 3. Công Nghệ Sử Dụng

| Tầng | Công nghệ chính |
| :--- | :--- |
| **Frontend (`frontend/`)** | React 19, Vite 7, Ant Design 6 (`@ant-design/icons`), Tailwind CSS 3, TanStack React Query 5, Zustand 5, React Router 7, Axios, Day.js |
| **Backend (`backend/`)** | Node.js, Express 5, Prisma ORM 7 (`@prisma/adapter-pg`), PostgreSQL, JWT, `bcryptjs`, `express-validator`, `multer`, `pdfkit`, `puppeteer`, `xlsx` |
| **Lưu trữ & AI** | Supabase Storage (4 buckets), Ollama Local RAG / Google Gemini (tùy chọn) |
| **Kiểm thử** | Jest + Supertest (Backend), Vitest + Testing Library + Playwright (Frontend) |

---

## 4. Cấu Trúc Thư Mục

```text
DACN/
├── backend/                # Express API, Prisma schema, services, controllers, Jest tests
│   ├── prisma/             # schema.prisma, migrations, seed scripts
│   └── src/                # constants, controllers, middlewares, routes, services, utils
├── frontend/               # React + Vite SPA
│   └── src/                # auth, components, constants, pages (admin/lecturer/student), queries, services, stores
├── docs/                   # Trạng thái dự án, quyết định kiến trúc, ma trận RBAC, lịch sử phiên
├── .agents/                # Quy chuẩn nghiệp vụ, kiến trúc dữ liệu, phân quyền
├── REQUIREMENTS.md         # Yêu cầu hệ thống, biến môi trường, thư viện & quy chuẩn nghiệp vụ
├── CLAUDE.md               # Điểm vào & cập nhật trạng thái phiên gần nhất
└── AGENTS.md               # Quy chuẩn hoạt động của AI Agent
```

---

## 5. Cài Đặt & Chạy Nhanh

Xem chi tiết yêu cầu môi trường và biến cấu hình tại [REQUIREMENTS.md](REQUIREMENTS.md).

### Bước 1: Cấu hình biến môi trường
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Điền thông tin `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` vào `backend/.env`.

### Bước 2: Khởi tạo CSDL & chạy Backend (`:5000`)
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

### Bước 3: Chạy Frontend (`:5173`)
```bash
cd frontend
npm install
npm run dev
```

### Bước 4: Kiểm thử & Build
```bash
# Backend Jest tests
cd backend && npm test

# Frontend production build & tests
cd frontend && npm run build
cd frontend && npm run test:runtime
```

---

## 6. Tài Liệu Liên Quan

- [Yêu cầu hệ thống & môi trường (REQUIREMENTS.md)](REQUIREMENTS.md)
- [Hướng dẫn nhanh & cập nhật phiên (CLAUDE.md)](CLAUDE.md)
- [Quy chuẩn làm việc (AGENTS.md)](AGENTS.md)
- [Trạng thái dự án & backlog](docs/project-status.md)
- [Quyết định kiến trúc & nghiệp vụ](docs/architecture/decisions.md)
- [Ma trận phân quyền RBAC](docs/rbac/authorization-matrix.md)
