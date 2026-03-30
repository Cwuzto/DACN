# DECISIONS.md

## Decision Log

File này lưu các quyết định kỹ thuật/nghiệp vụ quan trọng để tránh quên và tránh làm sai hướng trong các phiên sau.

---

## 2026-03-28 - Repo là bộ nhớ chính, NotebookLM là bộ nhớ phụ

**Quyết định**

- Dùng các file trong repo để lưu trạng thái dự án lâu dài.
- Dùng NotebookLM như công cụ hỗ trợ tra cứu/tóm tắt.

**Lý do**

- Giảm phụ thuộc vào quota NotebookLM
- Giữ nguồn sự thật sát codebase
- Giúp các phiên sau đọc ngay trong repo là tiếp tục được

**Ảnh hưởng**

- Cần duy trì đều các file:
  - `AGENTS.md`
  - `PROJECT_STATE.md`
  - `NEXT_STEPS.md`
  - `DECISIONS.md`
  - `TOMORROW_PLAN.md`

---

## 2026-03-28 - Chốt mô hình `TopicRegistration`

**Quyết định**

- `TopicRegistration` là mô hình nghiệp vụ chính hiện tại.
- Không quay lại phát triển theo `group/groupMember/evaluation` nếu chưa có quyết định mới.

**Lý do**

- Prisma schema hiện tại đã bám theo hướng này
- Cần một nguồn sự thật rõ ràng để refactor dứt điểm

**Ảnh hưởng**

- Mọi controller/page/service còn tư duy theo `group` được xem là legacy cần dọn

---

## 2026-03-29 - Loại bỏ module `group` khỏi backend source

**Quyết định**

- Xóa:
  - `backend/src/controllers/groupController.js`
  - `backend/src/routes/groupRoutes.js`

**Lý do**

- Tránh tái kích hoạt luồng cũ trái với kiến trúc đã chốt
- Giảm nhầm lẫn khi bảo trì

**Ảnh hưởng**

- Source backend hiện không còn API `/api/groups/*`

---

## 2026-03-29 - Chốt quota giảng viên theo học vị

**Quyết định**

- Quota tối đa của giảng viên:
  - `THAC_SI = 10`
  - `TIEN_SI = 15`
  - `PHO_GIAO_SU = 20`

**Lý do**

- Đây là rule nghiệp vụ cốt lõi và phải nhất quán ở mọi nơi

**Ảnh hưởng**

- Rule đã được gom về `backend/src/constants/mentorCapacity.js`
- Nếu đổi rule, sửa ở nguồn chung này trước

---

## 2026-03-29 - User management tạm thời tách theo 3 nhóm trong cùng một page

**Quyết định**

- `UserManagementPage` hiện chia thành 3 nhóm:
  - Giảng viên
  - Quản trị viên
  - Sinh viên
- Khi bấm vào nhóm nào thì mới tải/hiển thị danh sách của nhóm đó

**Lý do**

- Giảm rối cho admin
- Phù hợp hơn với thao tác quản trị thực tế

**Ảnh hưởng**

- Hiện mới tách theo section trong cùng một page
- Nếu cần URL rõ ràng hơn, bước tiếp theo có thể tách thành 3 route riêng
