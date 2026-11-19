# BM01 Automatic Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hệ thống tự gửi một thông báo BM01 trước hạn 48 giờ và một thông báo sau hạn cho sinh viên còn chưa nộp, không gửi trùng.

**Architecture:** Notification có khóa dedupe duy nhất ở DB; `safeNotify` lưu khóa và liên kết thật bằng create nguyên tử. Job BM01 đọc `TopicRegistration` + hạn trên `Semester`, không lệ thuộc task BM01. Các job hạn cũ dùng cùng cơ chế dedupe và tránh gửi trùng BM01.

**Tech Stack:** Prisma 7/PostgreSQL, Express 5, Jest, scheduler Node.js hiện có.

**Spec:** `docs/superpowers/specs/2026-11-20-role-dashboard-next-actions-design.md` (mục 7–8).

## Global Constraints

- Sửa từ Prisma → service thông báo → jobs. Chỉ chạy migration trên DB thử nghiệm.
- `TopicRegistration.status = APPROVED` và `Semester.outlineSubmissionDeadline` là nguồn BM01 chưa nộp/hạn thật; không tạo task giả.
- Hai mốc duy nhất theo registration và deadline: `[deadline - 48h, deadline)` và `now >= deadline`; không nhắc khi deadline null hoặc BM01 đã nộp.
- Thông báo trong ứng dụng cho SV, liên kết `/student/submissions`; không tạo nút GVHD nhắc và không dùng lecturer broadcast.
- Khóa dedupe DB chịu được hai instance chạy đồng thời. Lưu thất bại không được báo thành công hoặc khóa mất lần thử sau.
- File text UTF-8 không BOM; không gom thay đổi workspace khác vào commit.

## Review Focus

1. Hai job chạy đồng thời cùng registration/mốc chỉ tạo một Notification (Task 1–2).
2. `safeNotify` đang làm rơi `referenceUrl`; sau sửa link đích vẫn là `/student/submissions`, khóa dedupe là trường riêng (Task 1).
3. SV nộp BM01 giữa lúc query và lúc gửi: job kiểm lại trạng thái, không gửi nhầm (Task 2).
4. Hạn đổi hoặc job dừng qua mốc trước hạn: không gửi reminder sai thời điểm; mốc quá hạn mới dùng deadline mới (Task 2).
5. Task deadline job cũ và job BM01 cùng hoạt động: không gửi BM01 trùng; nhắc task khác vẫn chạy (Task 3).

---

## File map

| Tệp | Trách nhiệm |
|---|---|
| `backend/prisma/schema.prisma`, migration mới | `Notification.dedupeKey` nullable unique |
| `backend/src/services/notificationService.js` | Lưu `referenceUrl` và `dedupeKey` hợp lệ, xử lý unique conflict |
| `backend/src/jobs/bm01SubmissionReminderJob.js` | Quét BM01 trước hạn/quá hạn |
| `backend/src/jobs/index.js` | Khởi động/dừng scheduler mới |
| `backend/src/jobs/taskDeadlineNotificationJob.js`, `pendingRegistrationReminderJob.js` | Chuyển khóa dedupe và loại nhắc BM01 trùng |

### Task 1: Khóa chống gửi trùng trong Notification

**Files:** Modify `backend/prisma/schema.prisma`, `backend/src/services/notificationService.js`, `backend/src/jobs/taskDeadlineNotificationJob.js`, `backend/src/jobs/pendingRegistrationReminderJob.js`; create `backend/prisma/migrations/20261120100000_notification_dedupe_key/migration.sql`; extend `backend/tests/services/notificationService.test.js`; create `backend/tests/jobs/taskDeadlineNotificationJob.test.js` nếu chưa có.

**Interfaces:** `Notification.dedupeKey String? @unique`; `safeNotify({ userId, title, content, type, referenceUrl?, dedupeKey? }, context)` trả `{ ok: true, created }` khi lưu, `{ ok: false, skipped: true, reason: 'duplicate' }` khi unique conflict. `safeNotifyMany` giữ hai trường, dùng `skipDuplicates` khi có khóa. `referenceUrl` là link điều hướng, không dùng làm chữ ký.

- [ ] **Step 1: Viết test thất bại.** Lưu notification có `referenceUrl` và `dedupeKey`, test P2002 trả duplicate thay vì lỗi chung; `safeNotifyMany` giữ link/khóa. Test job task/pending chuyển sang dedupeKey và chỉ tăng count khi lưu thành công.

```js
expect(createArg.data).toMatchObject({ referenceUrl: '/student/submissions', dedupeKey: 'bm01:before:17:2026-11-20T10:00:00.000Z' });
expect(duplicateResult).toMatchObject({ ok: false, skipped: true, reason: 'duplicate' });
```

- [ ] **Step 2: Chạy focused tests để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/services/notificationService.test.js tests/jobs/taskDeadlineNotificationJob.test.js`.
- [ ] **Step 3: Thực hiện schema/migration và service.** Chỉ chấp nhận URL nội bộ hợp lệ ở `referenceUrl`; không đưa tên trường `link` chưa có trong Prisma vào create. Dùng unique DB và bắt P2002; chuyển hai job cũ sang khóa dedupe tách khỏi link và sửa count dựa trên `safeNotify().ok`.
- [ ] **Step 4: Chạy lại focused tests, `npm --prefix backend exec prisma validate`, và migration trên DB thử nghiệm; PASS.** Xác nhận hai notification không có khóa vẫn lưu được.
- [ ] **Step 5: Commit đúng tệp Task 1.** `git commit -m "fix: persist notification delivery keys atomically"`.

### Task 2: Job BM01 hai mốc tự động

**Files:** Create `backend/src/jobs/bm01SubmissionReminderJob.js`, `backend/tests/jobs/bm01SubmissionReminderJob.test.js`; modify `backend/src/jobs/index.js`.

**Interfaces:** `processBm01SubmissionReminders({ db = prisma, now = new Date(), notify = safeNotify }): Promise<{ scanned, beforeSent, overdueSent, skipped }>`; `startBm01SubmissionReminderScheduler()` dùng interval cấu hình, mặc định 30 phút, trả hàm stop. Khóa `bm01:<BEFORE_48H|OVERDUE>:<registrationId>:<deadlineISO>`. Job gọi `safeNotify` với `type: 'TASK_REMINDER'`, `referenceUrl: '/student/submissions'`.

- [ ] **Step 1: Viết test thất bại.** Trước hạn 49h không gửi; còn 48h gửi một lần; quá hạn gửi một lần; deadline null, BM01 đã nộp, registration khác đợt/không active không gửi; chạy lại/đồng thời không trùng; đổi hạn tạo mốc mới; save lỗi không tính sent và lần sau thử lại. Dùng clock tiêm qua `now`, không chờ thời gian thật.

```js
expect(result.beforeSent).toBe(1);
expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: studentId, referenceUrl: '/student/submissions' }), expect.any(String));
```

- [ ] **Step 2: Chạy test để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/jobs/bm01SubmissionReminderJob.test.js`.
- [ ] **Step 3: Thực hiện job.** Quét `APPROVED` với hạn BM01, dùng điều kiện thời gian trên; kiểm lại status/BM01 ngay trước create; ghi kết quả thực, không mutate registration. Đăng ký scheduler trong `jobs/index.js`, giữ env switch để tắt trong test/ops.
- [ ] **Step 4: Chạy lại focused test; PASS.** Khởi động/dừng scheduler trong test với timer giả để không tạo job treo.
- [ ] **Step 5: Commit đúng tệp Task 2.** `git commit -m "feat: send automatic BM01 submission reminders"`.

### Task 3: Chặn trùng với job hạn task hiện có

**Files:** Modify `backend/src/jobs/taskDeadlineNotificationJob.js`, `backend/tests/jobs/taskDeadlineNotificationJob.test.js`; extend `backend/tests/jobs/bm01SubmissionReminderJob.test.js`.

**Interfaces:** Job task chung bỏ qua `TaskType` BM01 (`BM01`, `BM01_INITIAL_SUBMISSION`, `BM01_RESUBMISSION`) cho lời nhắc nộp ban đầu; vẫn nhắc các loại task khác theo chính sách hiện hành. Nếu BM01 resubmission có hạn riêng, giữ luồng nhắc riêng của resubmission sau khi xác minh loại task, không vô hiệu hóa nhắc nộp lại hợp lệ.

- [ ] **Step 1: Viết test thất bại.** BM01 ban đầu không nhận notification từ generic job; task không phải BM01 vẫn nhận đúng một lần; BM01 resubmission có deadline riêng không bị mất lời nhắc hợp lệ.
- [ ] **Step 2: Chạy focused test để thấy FAIL.** `npm --prefix backend test -- --runTestsByPath tests/jobs/taskDeadlineNotificationJob.test.js tests/jobs/bm01SubmissionReminderJob.test.js`.
- [ ] **Step 3: Thực hiện filter theo taskType và nguồn hạn.** Không lọc tất cả BM01 bằng regex rộng; phân biệt nộp đầu với nộp lại.
- [ ] **Step 4: Chạy lại focused tests và `npm --prefix backend test -- --runTestsByPath tests/services/workflowJobLocking.test.js tests/services/notificationService.test.js`; PASS.**
- [ ] **Step 5: Commit đúng tệp Task 3.** `git commit -m "fix: avoid duplicate BM01 deadline reminders"`.

## Final verification

- [ ] Chạy focused tests của cả ba task, Prisma validate và kiểm DB thử nghiệm với hai worker đồng thời; không chạy migration trên production khi chưa có quy trình triển khai.
- [ ] Đối chiếu notification link, khóa dedupe, count sent, UTF-8 và `git status`.
