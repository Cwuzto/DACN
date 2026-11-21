# Kiến Trúc Dữ Liệu & Mô Hình CSDL

Tài liệu này quy định cấu trúc thực thể, quan hệ và mô hình dữ liệu chính trong hệ thống.

---

## 1. Mô hình Quan hệ Cốt lõi

Hệ thống xoay quanh `TopicRegistration` làm trung tâm:

```text
Semester / ProjectCatalog
           │
           ▼
User ──► Topic ──► TopicRegistration ──► Task (BM01, BM02, BM03, BM04)
                     │                 └──► Submission (JSON content + File minh chứng)
                     │
                     └──► Council (OUTLINE_REVIEW / DEFENSE_COUNCIL)
                            └──► DefenseMemberScore (Chấm điểm 3 thành viên)
```

---

## 2. Chi tiết các Thực thể Chính (Schema Prisma)

### 1. `PublicAnnouncement` (Thông báo & Biểu mẫu Trang chủ)
- **Mục đích**: Đăng tin thông báo, hướng nghiên cứu, mẫu biểu mẫu tải về và liên kết nộp bài theo đợt.
- **Fields**: `title`, `content`, `category`, `fileUrl`, `fileName`, `isPinned`, `isPublished`, `authorId`.

### 2. `Topic` & `TopicRegistration`
- **`Topic`**: Đề tài do GVHD hoặc Sinh viên đề xuất, gắn với `ProjectCatalog` và `Semester`. `maxStudents = 1`.
- **`TopicRegistration`**: Đăng ký đề tài của sinh viên.
  - Khóa duy nhất: `@@unique([studentId, semesterId])` (Mỗi sinh viên chỉ có 1 đăng ký trong 1 học kỳ).
  - Trạng thái: enum `RegistrationStatus` trong `backend/prisma/schema.prisma` là nguồn chuẩn. Ngoài các trạng thái đăng ký cơ bản, enum còn chứa các mốc BM01–BM04, quyết định, điều kiện bảo vệ, phê duyệt kết quả và lưu chiểu; không dùng danh sách rút gọn này để sinh logic chuyển trạng thái.

### 3. `Task` & `Submission` (Mô hình Biểu mẫu Hybrid)
- **`Task`**:
  - `taskType`: Enum `[BM01, BM02, BM03_CHECKPOINT, BM04, GENERIC]`.
  - `status`: `OPEN`, `IN_PROGRESS`, `SUBMITTED`, `REVISION`, `COMPLETED`, `OVERDUE`.
- **`Submission`**:
  - `content`: Dữ liệu dạng text/JSON có cấu trúc phục vụ thống kê, kiểm tra điều kiện tự động.
  - `fileUrl` & `fileName`: URL file lưu trên Supabase Storage (bản scan có chữ ký, file PDF, source code).

### 4. `Council` & `CouncilMember`
- **`Council`**:
  - `councilType`: Enum `[OUTLINE_REVIEW, DEFENSE_COUNCIL]`.
  - Thành phần: Đúng 3 thành viên (`CHAIRMAN`, `SECRETARY`, `REVIEWER`).
  - Ràng buộc: Không được trùng GVHD của sinh viên trong hội đồng.
- **`DefenseMemberScore`**:
  - Lưu phiếu chấm điểm riêng của từng thành viên hội đồng cho từng sinh viên.
  - `finalScore`: Điểm thành viên. Điểm tổng kết = Trung bình cộng các thành viên.

---

## 3. Cấu hình Kết nối CSDL

- **Database**: PostgreSQL trên Supabase.
- **Connection Mode**: Session Pooler (port `6543`) được cấu hình trong `backend/src/config/database.js` qua `@prisma/adapter-pg`.
- **MCP Server**: Được cấu hình tại `.agents/mcp_config.json` sử dụng `@modelcontextprotocol/server-postgres`.
