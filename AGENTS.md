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

Trong codebase vẫn còn một số dấu vết kiến trúc cũ (`group`, `groupMember`, `evaluation`),
nhưng các phần cũ này **không còn là nguồn sự thật chính**.

---

## Quy tắc làm việc mặc định

1. **Ưu tiên mô hình `TopicRegistration`**
   - Không chủ động mở rộng lại mô hình `group/groupMember`.
   - Không viết tính năng mới dựa trên kiến trúc cũ.

2. **Sửa gốc vấn đề trước**
   - Ưu tiên backend/model/service trước khi chỉnh UI.

3. **Giữ thay đổi nhỏ, chính xác**
   - Không refactor lan rộng khi chưa cần.
   - Không đổi tên/đổi cấu trúc ngoài phạm vi cần thiết.

4. **Frontend bám backend thật**
   - Không duy trì mock data nếu API thật đã có.
   - Đồng bộ field/contract trước khi chỉnh giao diện.

5. **Mở phiên mới phải đọc trước**
   - `README.md`
   - `.docs/PROJECT_STATE.md`
   - `.docs/NEXT_STEPS.md`
   - `.docs/DECISIONS.md`
   - `.docs/TOMORROW_PLAN.md` (nếu còn liên quan)

---

## Điều cần tránh

- Không tái đưa `group`, `groupMember`, `evaluation` thành kiến trúc chính khi chưa có quyết định mới.
- Không giả định frontend đúng chỉ vì UI render được.
- Không thêm chức năng mới khi các lỗi P0/P1 chưa xử lý.
- Không dùng NotebookLM làm nguồn nhớ duy nhất; repo mới là nguồn chính.

---

## Cách cập nhật sau mỗi phiên

Khi kết thúc phiên có thay đổi đáng kể, cần cập nhật:

- `.docs/PROJECT_STATE.md`: hiện trạng mới nhất
- `.docs/NEXT_STEPS.md`: việc cần làm tiếp ngay
- `.docs/DECISIONS.md`: quyết định kỹ thuật/kiến trúc mới (nếu có)

---

## Rule bổ sung (2026-04-15)

1. **Bắt buộc kiểm tra UTF-8 trước khi chốt batch**
   - Chạy: `node scripts/check-utf8.js` (hoặc `node scripts/regression-check.js`).

2. **Bắt buộc kiểm tra chất lượng tiếng Việt trong file `.md`**
   - Chạy: `node scripts/check-md-quality.js`.
   - Mục tiêu: phát hiện sớm lỗi `mojibake` và cụm tiếng Việt không dấu bất thường.

3. **Bắt buộc lưu file text bằng UTF-8 không BOM**
   - Áp dụng cho `.md`, `.js`, `.jsx`, `.json`, `.prisma`, `.yml`, ...
   - Không dùng `UTF-8 with BOM`.
   - Khi tạo/sửa file bằng tool hoặc editor, **luôn** save trực tiếp ở `UTF-8 (no BOM)` ngay từ lần ghi đầu tiên.
   - Sau khi hoàn tất chỉnh sửa, nên chạy `node scripts/check-utf8.js` để xác nhận không phát sinh lỗi encoding/mojibake.

4. **Cảnh báo sớm khi ngữ cảnh chat sắp đầy**
   - Agent phải chủ động cảnh báo để người dùng mở cửa sổ chat mới khi cần.
