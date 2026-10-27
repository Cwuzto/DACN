# Hoàn thiện luồng nghiệp vụ Cổng Giảng viên

**Ngày:** 28/10/2026  
**Phạm vi:** năm chức năng đang là placeholder hoặc chưa tích hợp hoàn chỉnh trong Lecturer Portal.

## Mục tiêu

Biến các thao tác đang chỉ hiển thị thông báo thành luồng nghiệp vụ có dữ liệu thật, đồng thời giữ nguyên mô hình `TopicRegistration`: một sinh viên làm một đề tài và mọi quyền truy cập của giảng viên chỉ giới hạn trong các hồ sơ do mình hướng dẫn.

## Phạm vi được duyệt

1. GVHD gửi thông báo nội bộ cho sinh viên đang hướng dẫn.
2. Sửa luồng tạo nhật ký gặp BM03.
3. Gửi nhắc nộp bài hàng loạt.
4. Chấm Checkpoint BM03 đợt 1 và đợt 2.
5. Duyệt lại BM01 sinh viên đã chỉnh sửa.

Không bao gồm email, chat, tải/xét duyệt hồ sơ lưu chiểu, sao chép đề tài, hoặc xuất workload.

## Thiết kế API và phân quyền

### Broadcast nội bộ của GVHD

Thêm `POST /api/notifications/lecturer-broadcast`.

- Chỉ `LECTURER` được gọi.
- Payload: `title`, `content`.
- Backend xác định người nhận từ `TopicRegistration` có `topic.mentorId = req.user.id` và trạng thái còn hiệu lực; frontend không được truyền `studentId` hay danh sách người nhận.
- Mỗi sinh viên nhận một bản ghi `Notification` loại `SYSTEM`; không gửi email.
- Phản hồi gồm `sentCount` và `sentAt`.
- Không tạo schema mới. Không thay đổi endpoint broadcast của Admin.

### Nhật ký gặp BM03

Giữ API hiện có `POST /api/registrations/:registrationId/meeting-logs`.

- Sửa frontend để gọi `meetingLogService.createMeetingLog(registrationId, data)` thay vì truyền một object duy nhất.
- Backend tiếp tục kiểm tra GVHD sở hữu đề tài trước khi tạo nhật ký.

### Nhắc nộp bài

Giữ API hiện có `POST /api/tasks/remind`.

- Frontend thu thập các task chưa hoàn thành của sinh viên đang hiển thị rồi gọi `taskService.remindTasks({ taskIds, message })`.
- Không gửi reminder cho task đã hoàn thành, đã bị bỏ qua hoặc thuộc sinh viên ngoài phạm vi GVHD.
- Kết quả hiển thị số reminder thực tế từ backend; không hiển thị thành công khi request thất bại.

### Checkpoint BM03

Giữ API chấm submission `POST /api/tasks/submission/:id/grade`.

- Progress Tracking lấy task thật có `taskType` là `BM03_CHECKPOINT_1` hoặc `BM03_CHECKPOINT_2` cùng submission mới nhất.
- Nếu chưa có submission, chỉ hiển thị trạng thái chờ nộp; không cho GVHD quyết định.
- Modal đánh giá bắt buộc có nhận xét và hai quyết định: `COMPLETED` (Đạt) hoặc `FAILED` (Không đạt).
- Quy tắc chuyển trạng thái tiếp tục do backend quyết định: checkpoint không đạt chuyển hồ sơ sang `TERMINATED_FAILED_PROGRESS`; hai checkpoint đạt chuyển sang `BM03_PASSED`.

### Duyệt lại BM01

Giữ API `POST /api/evaluations/bm01-gvhd-approve/:registrationId`.

- Lecturer Dashboard bổ sung hàng đợi hồ sơ `BM01_NEEDS_REVISION` đã nộp lại.
- GVHD xem nội dung/tệp BM01 nộp lại và nhập phản hồi tùy chọn trước khi duyệt.
- Sau khi thành công, refresh dashboard; backend là nguồn quyết định trạng thái `BM01_PASSED`.

## Thay đổi frontend

- `notificationService`: thêm `sendLecturerBroadcast`.
- `LecturerDashboardPage`: thay broadcast giả lập bằng API, sửa nhật ký gặp, thêm hàng đợi và modal duyệt BM01.
- `ProgressTrackingPage`: thay reminder/checkpoint mẫu bằng dữ liệu thật và API thật; sửa lời gọi nhật ký gặp.
- Dùng các service hiện có `taskService`, `meetingLogService`, `evaluationService`, `registrationService`.

## An toàn và xử lý lỗi

- Không tin `registrationId`/người nhận do UI suy ra: backend luôn xác minh quan hệ `topic.mentorId`.
- Validate `title`/`content` không rỗng, giới hạn độ dài theo validator hiện hữu.
- API lỗi phải trả lỗi giao diện; tuyệt đối không dùng toast thành công fallback.
- Không thay đổi dữ liệu cho các trạng thái terminal (`TERMINATED_FAILED_PROGRESS`, `DEFENDED`, `COMPLETED`) ngoài business rule hiện hữu.

## Kiểm thử

1. Integration test broadcast: GVHD chỉ gửi cho sinh viên của mình; không có người nhận trả lỗi phù hợp; Student/Admin bị 403.
2. Regression test meeting log với đúng URL và ownership.
3. Reminder test: task không thuộc GVHD hoặc đã hoàn thành không được nhắc.
4. Regression checkpoint: Đạt/Không đạt duy trì state machine hiện có.
5. Regression BM01: chỉ GVHD chủ đề được duyệt lại hồ sơ hợp lệ.
6. `npm test` backend và `npm run build` frontend.

## Tiêu chí nghiệm thu

- Không còn `setTimeout` hoặc toast giả lập cho năm luồng trong phạm vi.
- Mọi danh sách/điểm checkpoint và phản hồi BM01 lấy từ API thật.
- Không có GVHD nào gửi thông báo, chấm checkpoint, ghi nhật ký hoặc duyệt BM01 của sinh viên không thuộc mình.
