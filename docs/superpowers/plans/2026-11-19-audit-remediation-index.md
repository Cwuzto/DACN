# Kế hoạch tổng và bảng đối chiếu audit 19/11/2026

**Đặc tả đã duyệt:** `docs/superpowers/specs/2026-11-19-full-workflow-audit-remediation-design.md`
**Báo cáo gốc:** `C:/Users/phucm/.gemini/antigravity/brain/2c623d87-b0d8-47b3-8cc9-153a8480800c/audit-greedy-full-workflow-2026-11-19.md`

## Thứ tự thực hiện

1. [Nền dữ liệu, PDF, quota, rubric và job](2026-11-19-audit-remediation-foundation.md) — sửa lỗi gốc dùng chung.
2. [BM01–BM04 và quyền học vụ](2026-11-19-audit-remediation-academic-workflow.md) — nối API và màn hình theo trạng thái thật.
3. [Hội đồng và kết quả](2026-11-19-audit-remediation-council-results.md) — chặn phân sai, khôi phục lịch/sổ điểm.
4. [Lưu chiểu, báo cáo và kiểm chứng](2026-11-19-audit-remediation-archive-reports-verification.md) — hoàn tất biên và hồi quy sáu giai đoạn.

Các kế hoạch này sửa lỗi đã phát hiện; tính năng **chấm nhanh rubric** và **phân hội đồng có preview/AI** có kế hoạch riêng. Khi một sửa lỗi trùng với code của tính năng đã làm, test phải xác định trạng thái hiện tại rồi chỉ sửa phần còn lỗi. Không chạy hai implementer trên cùng file cùng lúc.

## Quy tắc trạng thái

- `NEEDS_REPRODUCTION`: có dấu vết mã tĩnh hoặc mô tả trong report, chưa có test/log hiện hành xác nhận.
- `REPORT_CORRECTION`: report mô tả sai một phần nguyên nhân; vẫn kiểm và sửa triệu chứng thật.
- `CONFIRMED`: có test/log hiện hành tái hiện trước sửa.
- `FIXED`: test hồi quy sau sửa PASS và có commit cụ thể.
- `NOT_REPRODUCIBLE`: đã kiểm có bằng chứng nhưng không còn lỗi trên code hiện hành.

Mọi dòng bắt đầu ở trạng thái dưới đây; khi triển khai ghi thêm **test, kết quả, commit và quyết định** ngay trên dòng hoặc liên kết tới nhật ký ngắn của task. Không đánh dấu `FIXED` chỉ vì build PASS.

| Mã | Trạng thái đầu | Chủ sở hữu trong kế hoạch | Triệu chứng/điều kiện kiểm |
|---|---|---|---|
| P0.1 | NEEDS_REPRODUCTION | Nền Task 1 | Xóa đợt mới với policy FK |
| P0.2 | NEEDS_REPRODUCTION | Nền Task 4 | Rubric mất bốn mô tả sau lưu UI |
| P0.3 | REPORT_CORRECTION | Học vụ Task 1 | BM01 fields đã có DB; thiếu API/form |
| P0.4 | NEEDS_REPRODUCTION | Hội đồng Task 1 | `forGrading` select `Topic.code` |
| P0.5 | REPORT_CORRECTION | Học vụ Task 1 | `{id}` bị đọc sai; fallback chỉ khi request ném lỗi |
| P0.6 | NEEDS_REPRODUCTION | Học vụ Task 2 | BM01 v2 bị route cũ trả 409 |
| P0.7 | NEEDS_REPRODUCTION | Học vụ Task 3 | BM02 review thiếu trạng thái đích |
| P0.8 | NEEDS_REPRODUCTION | Nền Task 2 | BM02-A ký PDF asset thiếu actor |
| P0.9 | NEEDS_REPRODUCTION | Học vụ Task 3 | Phụ lục BM02-A sai payload |
| P0.10 | NEEDS_REPRODUCTION | Học vụ Task 4 | `ONLINE` trái enum Prisma |
| P0.11 | NEEDS_REPRODUCTION | Nền Task 2 | BM03 xác nhận PDF thiếu actor |
| P0.12 | NEEDS_REPRODUCTION | Học vụ Task 4 | FINAL bác dừng kẹt evaluation link |
| P0.13 | NEEDS_REPRODUCTION | Học vụ Task 6 | Viện trưởng bị chặn scope bộ môn |
| P0.14 | NEEDS_REPRODUCTION | Học vụ Task 5 | BM04 nháp vẫn tạo sau dừng |
| P0.15 | NEEDS_REPRODUCTION | Hội đồng Task 2 | Đổi ca dùng notification enum sai |
| P0.16 | NEEDS_REPRODUCTION | Hội đồng Task 1 | Auto assign thiếu active/BM04 guard |
| P0.17 | NEEDS_REPRODUCTION | Hội đồng Task 3 | Trả sổ ghim rubric `v1` giả |
| P0.18 | NEEDS_REPRODUCTION | Hội đồng Task 3 | Council flag không bật khi khóa sổ |
| P0.19 | NEEDS_REPRODUCTION | Hội đồng Task 4 | Trả sổ UI thiếu ID phiếu |
| P0.20 | NEEDS_REPRODUCTION | Lưu chiểu Task 1 | Video upload thay URL HTTPS |
| P0.21 | NEEDS_REPRODUCTION | Nền Task 2; Lưu chiểu Task 2 | Chứng nhận PDF asset thiếu actor |
| P1.1 | NEEDS_REPRODUCTION | Nền Task 3 | Quota thiếu trạng thái BM01 trở đi |
| P1.2 | NEEDS_REPRODUCTION | Học vụ Task 1–2 | BM01 thiếu asset và FAIL sai trạng thái |
| P1.3 | NEEDS_REPRODUCTION | Học vụ Task 6 | RBAC đợt/phân GVHD/bản tin lệch |
| P1.4 | NEEDS_REPRODUCTION | Nền Task 1, 4 | Rubric draft/lock và policy active |
| P1.5 | REPORT_CORRECTION | Học vụ Task 3 | Optional chaining fallback làm thiếu detail |
| P1.6 | NEEDS_REPRODUCTION | Học vụ Task 3 | BM02-A enum/API/print prop lệch |
| P1.7 | NEEDS_REPRODUCTION | Nền Task 5 | Sweep job, actor `0`, advisory lock |
| P1.8 | NEEDS_REPRODUCTION | Học vụ Task 5 | BM03/BM04 in và form khóa sai |
| P1.9 | NEEDS_REPRODUCTION | Hội đồng Task 1–4; Lưu chiểu Task 2 | Danh sách hội đồng, sổ điểm, chứng nhận |
| P2.1 | NEEDS_REPRODUCTION | Lưu chiểu Task 1 | Trạng thái trượt vẫn nộp file |
| P2.2 | NEEDS_REPRODUCTION | Lưu chiểu Task 3 | Notification chứa `isPromulgated` |
| P2.3 | NEEDS_REPRODUCTION | Lưu chiểu Task 3 | Header PDF tên trường cũ |
| P2.4 | NEEDS_REPRODUCTION | Lưu chiểu Task 4 | Báo cáo rỗng/tên file/enum UI |
| P2.5 | NEEDS_REPRODUCTION | Học vụ Task 4 | ID BM03/buổi họp bị thay thế |
| P2.6 | NEEDS_REPRODUCTION | Học vụ Task 5 | `/registrations/my` thiếu dữ liệu in |

## Cổng kiểm chứng cuối

Kế hoạch Lưu chiểu Task 5 kiểm đủ 36 dòng. Mỗi mục phải kết thúc bằng `FIXED`, `REPORT_CORRECTION` đã kiểm, hoặc `NOT_REPRODUCIBLE` có bằng chứng. Chạy test ghi dữ liệu trên DB thử nghiệm cách ly, test frontend và build; kiểm tra bằng vai trò Admin, Giáo vụ, Viện trưởng, GVHD/Hội đồng và Sinh viên qua sáu giai đoạn. Ghi rõ giới hạn của mọi mục chưa thể tái hiện; không suy ra PASS từ việc không thấy lỗi trong mã tĩnh.
