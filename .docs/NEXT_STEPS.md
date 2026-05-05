# NEXT_STEPS.md

## Trọng tâm hiện tại

Ổn định dài hạn sau batch mở rộng theo `Tên đồ án`, tập trung hoàn thiện vận hành dữ liệu và chuẩn bị pha import.

## Việc cần làm tiếp

### Ưu tiên cao

- [ ] Chuẩn bị P2 import Excel (chưa bật tính năng):
  - metadata nguồn enrollment (`SEED`/`MANUAL`/`EXCEL`)
  - `importBatchId` nullable để truy vết batch
- [ ] Soạn checklist rollout/import cho môi trường dùng chung (staging/dev shared).

### Ưu tiên trung bình

- [ ] Rà dữ liệu sau đối soát nâng cao và xử lý nốt các bản ghi lệch còn tồn (nếu có).
- [ ] Bổ sung test/regression cho các thao tác sửa nhanh ở Admin Project Enrollment (gán projectCatalog, backfill enrollment).

## Đã hoàn thành gần đây (2026-05-01)

- [x] Hoàn tất P1.1/P1.2/P1.3:
  - filter `accountRestricted` ở API + UI,
  - rà soát UX quản trị,
  - gate hồi quy PASS.
- [x] Hoàn thiện UI chấm điểm theo barem thật cho lecturer/admin.
- [x] Chuẩn hóa migration Prisma + rollout thành công bằng `prisma migrate deploy`.
- [x] Đồng bộ hiển thị `Tên đồ án` / `Đợt đồ án` trên các màn admin điều phối chính.
- [x] Bổ sung công cụ đối soát dữ liệu nâng cao + thao tác sửa nhanh.
- [x] Dọn legacy luồng chấm điểm tổng cũ (`/evaluations/defense-result`).

## Gate bắt buộc trước khi chốt batch

```bash
node scripts/check-utf8.js
node scripts/check-md-quality.js
node scripts/regression-check.js
npm --prefix backend test -- --runInBand
npm --prefix frontend run build
```

## Cập nhật bổ sung (2026-05-01)

- [x] Triển khai phiếu chấm theo từng thành viên hội đồng + công thức điểm cuối (trung bình hội đồng).
- [x] Bổ sung chọn người chấm ở modal Admin Grading và export PDF theo người đang chọn.
- [x] Fix lỗi export PDF `Bucket not found` (tự kiểm tra/tạo bucket).
- [x] Rollout migration `20260501194000_add_defense_member_scores` trên DB dùng chung.
- [x] Sửa lỗi encoding màn `GradingDefensePage`.

## Việc cần làm tiếp ngay

- [ ] Chạy smoke test end-to-end role `ADMIN`/`LECTURER` cho luồng 3 phiếu chấm + lock/unlock.
- [ ] Bổ sung test backend cho nhánh fallback `409` khi schema chưa cập nhật.
- [ ] Cập nhật tài liệu `.docs/ONLINE_GRADING_PDF_SPEC.md` theo mô hình `DefenseMemberScore`.

## Cập nhật bổ sung (2026-05-02)

### Đã hoàn thành

- [x] Chuyển màn chấm điểm giảng viên sang trang phiếu chấm riêng (tab mới).
- [x] Đồng bộ giao diện chấm điểm theo file `phieu_cham.html` trong repo.
- [x] Đổi bước tăng điểm ở input sang `0.05`.
- [x] Đồng bộ backend export PDF dùng cùng template HTML gốc.
- [x] Fix lỗi Supabase bucket public URL (`Bucket not found`).
- [x] Fix lỗi PDF dư trang trắng và lỗi căn lề khi in.

### Việc cần làm tiếp ngay

- [ ] Chạy smoke test E2E luồng chấm điểm trên trang mới (LECTURER):
  - mở phiếu,
  - nhập điểm,
  - lưu,
  - xuất PDF,
  - đối chiếu với template gốc.
- [ ] Cập nhật `.docs/ONLINE_GRADING_PDF_SPEC.md` theo cơ chế template chung FE/BE.

## Cập nhật bổ sung 2026-05-06 (append)
### Việc ưu tiên ngay sau phiên này
- [ ] Rà và fix dứt điểm lỗi text/encoding ở các trang trọng yếu:
  - Admin: Người dùng, Giám sát đề tài, Chấm bảo vệ.
  - Lecturer: Duyệt đề tài, Hội đồng chấm điểm.
- [ ] Smoke test luồng tiến độ task:
  - Đạt -> confirm,
  - Không đạt -> nhập nhận xét + hạn nộp mới,
  - sinh viên nộp lại.
- [ ] Kiểm tra thực tế job deadline notification trên dữ liệu hiện tại để xác nhận không gửi trùng.
