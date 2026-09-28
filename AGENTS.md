# Quy Chuẩn Hoạt Động Của AI Agent (AGENTS.md)

Tài liệu này chứa các quy tắc làm việc và cơ chế tự động hóa theo lệnh cho AI Agent trong repository `DACN`.

---

## 1. Cơ Chế Quản Lý Phiên Làm Việc (Session Management)

### Khi người dùng nói "mở phiên" (Bắt đầu Session mới)
AI Agent phải tự động thực hiện ngay:
1. Đọc file **[CLAUDE.md](file:///d:/DACN/CLAUDE.md)** và kiểm tra trạng thái hiện tại của codebase.
2. Lập Kế hoạch triển khai (Session Plan) cho ngày hôm nay:
   - Liệt kê các công việc cần làm được chia theo mức độ ưu tiên (`P0`, `P1`,...).
   - Sắp xếp thứ tự thực hiện rõ ràng, logic (CSDL -> Backend API -> Frontend UI).
   - Đưa ra các câu hỏi/quyết định cần người dùng xác nhận (nếu có).

### Khi người dùng nói "end phiên" (Kết thúc Session)
AI Agent phải tự động cập nhật mục **`Session Update`** trong file **[CLAUDE.md](file:///d:/DACN/CLAUDE.md)** gồm đầy đủ 4 phần:
1. **Những phần đã hoàn thành**: Liệt kê chi tiết các tính năng, API, màn hình, cấu hình đã làm xong trong session.
2. **Trạng thái cập nhật của từng phần**: Tình trạng hoạt động (Backend, Frontend, DB, MCP, Test).
3. **Bước tiếp theo cần làm (Next Session Plan)**: Các đầu việc ưu tiên cho session sau.
4. **Quyết định quan trọng (Decisions & Rationale)**: Những quyết định kỹ thuật/nghiệp vụ đã đưa ra kèm lý do tại sao.

---

## 2. Quy Tắc Kỹ Thuật Bắt Buộc

1. **Tuân thủ mô hình `TopicRegistration`**:
   - Tuyệt đối không khôi phục hoặc phát triển tính năng dựa trên kiến trúc cũ `group/groupMember`.
   - 1 sinh viên / 1 đề tài (`maxStudents = 1`), 1 GVHD tối đa 10 sinh viên.
2. **Nguyên tắc "Sửa gốc vấn đề trước"**:
   - Luôn xử lý từ tầng CSDL/Prisma -> Backend Controller/Service/Route -> rồi mới đến Giao diện Frontend.
3. **Frontend bám sát Backend thực tế**:
   - Không duy trì dữ liệu giả (mock data) nếu backend đã có API thực tế.
4. **Chuẩn mã hóa**:
   - Tất cả các file (`.md`, `.js`, `.jsx`, `.json`, `.prisma`, `.yml`) phải lưu ở định dạng **UTF-8 (no BOM)**.
5. **Chủ động cảnh báo ngữ cảnh**:
   - Khi phiên làm việc kéo dài hoặc ngữ cảnh chat sắp đầy, Agent chủ động nhắc người dùng gõ `end phiên` và mở cửa sổ chat mới.
