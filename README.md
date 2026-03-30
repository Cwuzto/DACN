# Hệ thống Quản lý Đồ án

## 1. Giới thiệu

Đây là dự án web hỗ trợ quản lý quy trình đồ án tại Viện Công nghệ Số, phục vụ 3 nhóm người dùng:

- **Admin**: quản lý người dùng, học kỳ, đề tài, hội đồng, thống kê.
- **Giảng viên**: quản lý đề tài, duyệt đăng ký, theo dõi tiến độ, chấm điểm.
- **Sinh viên**: đăng ký đề tài, theo dõi tiến độ, nộp bài, xem kết quả.

Hệ thống hướng tới số hóa toàn bộ vòng đời của một đề tài đồ án:

1. Tạo học kỳ / đợt đồ án  
2. Tạo và duyệt đề tài  
3. Sinh viên đăng ký đề tài  
4. Theo dõi tiến độ và nộp bài  
5. Phân công hội đồng  
6. Chấm điểm và lưu kết quả bảo vệ  

---

## 2. Kiến trúc dự án

Project được tách thành 2 phần:

### `frontend/`

- React + Vite
- Ant Design
- Tailwind CSS
- Zustand
- Axios

### `backend/`

- Node.js + Express
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Cloudinary (upload file)

---

## 3. Cấu trúc thư mục chính

```text
DACN/
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   └── services/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── stores/
└── README.md
```

---

## 4. Chức năng chính

### Admin

- Quản lý tài khoản người dùng
- Quản lý học kỳ / đợt đồ án
- Quản lý danh sách đề tài
- Phân công hội đồng
- Theo dõi tổng quan hệ thống
- Quản lý thông báo

### Giảng viên

- Tạo đề tài mới
- Lưu nháp / gửi duyệt đề tài
- Duyệt hoặc từ chối đề tài sinh viên đề xuất
- Theo dõi tiến độ thực hiện
- Giao task, nhận bài nộp
- Chấm điểm bảo vệ

### Sinh viên

- Xem danh sách đề tài
- Đăng ký đề tài
- Theo dõi trạng thái đăng ký
- Xem task / milestone
- Nộp báo cáo
- Xem điểm và kết quả bảo vệ

---

## 5. Mô hình dữ liệu hiện tại

Các thực thể chính trong hệ thống:

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

Hiện tại schema backend đang đi theo mô hình:

- **1 sinh viên đăng ký 1 đề tài trong 1 học kỳ**
- quản lý tiến độ qua `Task`, `Submission`, `Milestone`
- quản lý bảo vệ qua `Council` và `DefenseResult`

---

## 6. Cách chạy dự án

## Backend

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Backend mặc định chạy tại:

```text
http://localhost:5000
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

---

## 7. Tài khoản mẫu

Seed hiện có tạo sẵn một số tài khoản để test:

- **Admin**: `admin@university.edu.vn` / `admin123`
- **Giảng viên**: `nguyenvana@university.edu.vn` / `lecturer123`
- **Sinh viên**: `sv001@university.edu.vn` / `student123`

---

## 8. Thực trạng hiện tại của dự án

Dự án đã có:

- khung frontend/backend rõ ràng
- schema dữ liệu tương đối đầy đủ
- nhiều API nghiệp vụ chính đã được viết
- nhiều màn hình giao diện cho 3 vai trò

Tuy nhiên dự án **chưa hoàn thiện hoàn toàn**, hiện còn một số phần đang dở hoặc chưa đồng bộ.

---

## 9. Các vấn đề tồn tại cần ưu tiên xử lý

### Mức ưu tiên cao

1. **Code backend chưa refactor xong**
   - Một số controller vẫn dùng mô hình cũ `group`, `groupMember`, `evaluation`
   - Trong khi schema hiện tại đã chuyển sang `TopicRegistration`

2. **Dashboard backend có nguy cơ lỗi runtime**
   - Vì còn truy cập model không còn tồn tại trong Prisma schema hiện tại

3. **Frontend service chưa đồng bộ với Axios interceptor**
   - Interceptor đã trả thẳng payload
   - Nhưng nhiều service vẫn gọi tiếp `response.data`

4. **Frontend và backend chưa thống nhất tên field**
   - Ví dụ: frontend dùng `maxGroups`
   - backend dùng `maxStudents`

### Mức ưu tiên trung bình

5. **Nhiều màn hình vẫn dùng dữ liệu mock**
   - Admin dashboard
   - Grading defense
   - Notification center
   - Project oversight

6. **Một số màn hình frontend vẫn bám logic mô hình nhóm cũ**
   - Student dashboard
   - Lecturer dashboard
   - Progress tracking
   - Grade view

7. **Nhiều giá trị đang hardcode**
   - học kỳ mặc định
   - email hỗ trợ
   - domain production placeholder

### Mức ưu tiên thấp

8. **Thiếu test**
   - backend chưa có unit/integration test thực sự
   - frontend chưa có test

9. **Thiếu tài liệu kỹ thuật đầy đủ**
   - chưa có hướng dẫn env chi tiết
   - chưa có hướng dẫn deploy

10. **Có lỗi encoding tiếng Việt ở một số file**
   - ảnh hưởng hiển thị message/log

---

## 10. Hướng phát triển tiếp theo

Các bước nên làm tiếp:

1. Chốt mô hình nghiệp vụ cuối cùng:
   - theo cá nhân (`TopicRegistration`)
   - hoặc quay lại mô hình nhóm

2. Refactor toàn bộ backend theo một mô hình duy nhất

3. Đồng bộ lại toàn bộ frontend với backend

4. Thay dữ liệu mock bằng API thật

5. Bổ sung test cho các module quan trọng:
   - auth
   - topics
   - registrations
   - evaluations

6. Hoàn thiện tài liệu triển khai và sử dụng

---

## 11. Ghi chú

Đây là dự án đang trong giai đoạn phát triển và hoàn thiện.  
Nếu tiếp tục triển khai, nên ưu tiên sửa các lỗi kiến trúc và đồng bộ dữ liệu trước khi mở rộng thêm chức năng mới.
