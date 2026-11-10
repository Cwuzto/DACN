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
6. **Chuẩn thiết kế Giao diện & Nút bấm (UI/UX Button Standards)**:
   - **Tuyệt đối không chèn ký tự thô / emoji vào nhãn nút bấm**: Không chèn các ký tự đồ họa thô hoặc emoji (như `←`, `→`, `+`, `🤖`, `📋`, `✓`, `✏️`, `👥`, `🗑️`, `🔓`, `▾`, `▴`, `↗`, v.v.) trực tiếp vào chuỗi text của nút bấm (button label).
   - **Sử dụng component Icon chính quy**: Khi cần hiển thị biểu tượng, luôn sử dụng prop `icon={<IconComponent />}` từ thư viện `@ant-design/icons` (ví dụ: `<Button icon={<ArrowLeftOutlined />}>Quay lại</Button>`, `<Button icon={<PlusOutlined />}>Lập hội đồng</Button>`).
   - **Không lặp icon trong text**: Khi nút đã có icon component thông qua prop `icon`, nhãn text bên trong phải là văn bản tiếng Việt thuần túy, chuyên nghiệp và ngắn gọn (tránh trường hợp vừa có prop `icon={<ArrowLeftOutlined />}` vừa viết `← Quay lại`).

---

## 3. Cơ Chế Phân Công Subagent Giữ Sạch Ngữ Cảnh (Experimental Rule)

> [!NOTE]
> **Quy chuẩn thử nghiệm (Có thể thu hồi)**:
> Mục này được thiết lập riêng để giữ sạch cửa sổ ngữ cảnh (Context Window) của phiên chính, tránh tình trạng AI bị suy giảm trí nhớ do tràn ngữ cảnh.
> Nếu sau này người dùng thấy không phù hợp, có thể xóa toàn bộ Mục 3 này mà không gây ảnh hưởng đến Mục 1 và Mục 2.

### 3.1. Phân định vai trò (Separation of Roles)
* **Agent chính (Main Orchestrator)**:
  - Là đầu mối duy nhất trao đổi trực tiếp với người dùng.
  - Chịu trách nhiệm lập kế hoạch, kiểm soát tiến độ, đưa ra quyết định kiến trúc, ghi chép `CLAUDE.md` và tạo Git commit.
  - Tuyệt đối hạn chế nạp log terminal dài, nội dung thô của nhiều file lớn, hoặc kết quả chạy test hàng trăm dòng vào ngữ cảnh chính.
* **Subagent (Specialized Worker)**:
  - Làm việc trong không gian cách ly (Isolated Context), chỉ nhận prompt chứa đúng dữ liệu cần thiết cho tác vụ được giao.
  - Tự động thực thi, tự chạy kiểm tra/test lại phần việc của mình.
  - **Quy chuẩn báo cáo về Agent chính**: Chỉ trả lời ngắn gọn theo 3 ý:
    1. Đã thực hiện những việc gì?
    2. Danh sách tệp đã tạo / chỉnh sửa.
    3. Kết quả xác thực / kiểm thử (Pass/Fail).

### 3.2. Tiêu chí bắt buộc ủy thác cho Subagent
Agent chính phải tự động kích hoạt Subagent cho các tác vụ sau:
1. **Khảo sát / Quét tìm kiếm diện rộng (`research subagent`)**:
   - Tìm kiếm chuỗi/logic quét qua nhiều thư mục trong dự án.
   - Đọc các tệp tài liệu đặc tả, schema lớn hoặc log hệ thống dài.
2. **Thực thi tác vụ hoặc sửa lỗi độc lập (`self subagent`)**:
   - Viết tính năng mới, tạo màn hình/component, hoặc refactor code theo kế hoạch đã vạch sẵn.
   - Sửa các module backend/frontend độc lập không bị phụ thuộc chéo.
3. **Chạy kiểm thử & chẩn đoán lỗi nặng**:
   - Chạy toàn bộ test suite (backend/frontend) hoặc phân tích stack trace lỗi phức tạp.
4. **Kiểm tra chéo chất lượng (Task Reviewer)**:
   - Rà soát code trước khi đóng phiên: kiểm tra vi phạm `TopicRegistration`, dữ liệu giả (mock data), hoặc chuẩn UTF-8.

### 3.3. Các trường hợp Agent chính làm trực tiếp
Agent chính không cần gọi Subagent trong các trường hợp:
* Trao đổi, tư vấn ý tưởng, giải thích nghiệp vụ với người dùng.
* Sửa nhanh 1–2 tệp có phạm vi rất rõ ràng, cụ thể (quick fix lỗi nhỏ, chỉnh nhãn text giao diện, cập nhật import).
* Đọc và cập nhật nhật ký phiên trong `CLAUDE.md`, `AGENTS.md` và tạo commit Git.
