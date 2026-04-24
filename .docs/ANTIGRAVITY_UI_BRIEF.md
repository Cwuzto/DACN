# ANTIGRAVITY_UI_BRIEF.md

## Mục tiêu

Thiết kế và triển khai lại phần **Admin - Bảo vệ & Điểm** theo mô hình một trung tâm điều phối duy nhất, dễ thao tác, dễ theo dõi trạng thái.

## Phạm vi bắt buộc (In Scope)

1. Tạo một màn hình thống nhất: `Admin > Bảo vệ & Điểm`.
2. Chia giao diện thành 4 tab:
   - `PENDING_ASSIGNMENT` (Chờ phân công)
   - `ASSIGNED_COUNCIL` (Đã phân công hội đồng)
   - `AWAITING_GRADING` (Đã bảo vệ - chờ nhập điểm)
   - `COMPLETED` (Hoàn tất)
3. Có thanh lọc chung:
   - Tìm kiếm theo tên sinh viên, mã sinh viên, tên đề tài.
   - Filter theo hội đồng.
   - Filter theo giảng viên hướng dẫn.
4. Bảng dữ liệu hiển thị tối thiểu:
   - Sinh viên
   - Đề tài
   - Giảng viên hướng dẫn
   - Hội đồng
   - Lịch bảo vệ
   - Trạng thái chấm điểm
   - Điểm cuối (nếu có)
   - Cập nhật lần cuối
5. Action UI:
   - Chọn nhiều dòng và bấm `Nhắc chấm điểm`.
   - Theo từng dòng có nút `Khóa điểm` / `Mở khóa điểm`.

## Không làm trong batch này (Out of Scope)

1. Không làm lại luồng tạo/chỉnh sửa hội đồng chi tiết.
2. Không làm lại form nhập barem điểm chi tiết.
3. Không thay đổi design system toàn project.

## API backend đã sẵn sàng

1. `GET /api/evaluations/admin-defense-center`
   - Query optional: `semesterId`, `tab`, `search`, `councilId`, `mentorId`
   - `tab`: `PENDING_ASSIGNMENT | ASSIGNED_COUNCIL | AWAITING_GRADING | COMPLETED`

2. `POST /api/evaluations/admin-defense-center/remind-grading`
   - Body:
```json
{ "registrationIds": [1, 2, 3] }
```

3. `PATCH /api/evaluations/admin-defense-center/:id/score-lock`
   - Body:
```json
{ "action": "LOCK" }
```
   - Hoặc:
```json
{ "action": "UNLOCK" }
```

## Mapping UI với API

1. 4 tab dùng trực tiếp giá trị `workflowStage`.
2. Badge trạng thái điểm dùng `gradingStatus`:
   - `PENDING` -> Chưa chấm
   - `GRADED` -> Đã chấm
3. Counter mỗi tab dùng `meta.counts`.
4. Dữ liệu bảng dùng `data[]`.
5. Đợt mặc định lấy từ `meta.targetSemester`.

## Tiêu chí hoàn tất (Acceptance Criteria)

1. Chuyển tab đúng dữ liệu theo `workflowStage`.
2. Tìm kiếm/filter hoạt động và gọi đúng query API.
3. `Nhắc chấm điểm` chạy cho selected rows và hiển thị thông báo thành công/thất bại.
4. `Khóa điểm/Mở khóa điểm` cập nhật trạng thái ngay trên UI sau khi API thành công.
5. Không phá luồng cũ ngoài khu vực Admin - Bảo vệ & Điểm.

## Handoff lại cho Codex sau khi xong UI

1. Danh sách file đã chỉnh.
2. Các điểm chưa khớp API (nếu có).
3. Screenshot 4 tab + case nhắc chấm điểm + case khóa/mở khóa.
