# AGENTS.md

## Mục đích

File này là hướng dẫn nền cho mọi agent làm việc trong repo `DACN/`.
Mục tiêu là giúp các phiên làm việc sau:

- hiểu đúng mục đích ban đầu của dự án,
- không đi lệch hướng nghiệp vụ,
- không quên tiến độ đang làm,
- không vô tình khôi phục lại kiến trúc cũ.

---

## Bối cảnh dự án

Đây là dự án **Hệ thống Quản lý Đồ án** cho 3 vai trò:

- `ADMIN`
- `LECTURER`
- `STUDENT`

Mục tiêu sản phẩm:

- quản lý học kỳ / đợt đồ án,
- quản lý đề tài,
- đăng ký đề tài,
- theo dõi tiến độ thực hiện,
- nộp bài / phản hồi,
- phân công hội đồng,
- chấm điểm và lưu kết quả bảo vệ.

---

## Trạng thái kiến trúc hiện tại

Project đang ở trạng thái **chuyển tiếp kiến trúc**.

Schema Prisma hiện tại đã đi theo mô hình:

- `TopicRegistration`
- `Task`
- `Submission`
- `Milestone`
- `Council`
- `DefenseResult`

Tuy nhiên trong codebase vẫn còn sót phần kiến trúc cũ dùng:

- `group`
- `groupMember`
- `evaluation`

Các phần cũ này không còn là nguồn sự thật chính của dự án.

---

## Quyết định làm việc mặc định

Trừ khi người dùng yêu cầu khác rõ ràng, hãy làm theo các nguyên tắc sau:

1. **Ưu tiên mô hình `TopicRegistration`**
   - Không chủ động mở rộng lại mô hình `group/groupMember`
   - Không viết tính năng mới dựa trên kiến trúc cũ

2. **Sửa gốc vấn đề trước**
   - Ưu tiên sửa backend/model/service trước khi chỉnh UI hiển thị

3. **Giữ thay đổi nhỏ, chính xác**
   - Không refactor lan rộng nếu chưa cần
   - Không đổi tên/đổi cấu trúc ngoài phạm vi cần thiết

4. **Frontend phải bám backend thật**
   - Không duy trì mock data nếu API thật đã có hoặc chuẩn bị có
   - Đồng bộ field và response contract trước khi chỉnh giao diện

5. **Mọi phiên làm việc mới nên đọc các file này trước**
   - `README.md`
   - `PROJECT_STATE.md`
   - `NEXT_STEPS.md`
   - `DECISIONS.md`
   - `TOMORROW_PLAN.md` nếu còn liên quan

---

## Điều cần tránh

- Không tái đưa `group`, `groupMember`, `evaluation` thành kiến trúc chính nếu chưa có quyết định mới
- Không giả định frontend đang đúng chỉ vì UI render được
- Không thêm chức năng mới khi các lỗi P0/P1 chưa xử lý
- Không dùng NotebookLM làm nguồn nhớ duy nhất; repo mới là nguồn chính

---

## Cách cập nhật sau mỗi phiên

Khi kết thúc một phiên làm việc có thay đổi đáng kể, nên cập nhật:

- `PROJECT_STATE.md`: hiện trạng mới nhất
- `NEXT_STEPS.md`: việc cần làm tiếp ngay
- `DECISIONS.md`: nếu có quyết định kỹ thuật/kiến trúc mới

Nếu cần đồng bộ sang NotebookLM, chỉ upload các file tổng hợp thay vì upload mọi thay đổi nhỏ.
