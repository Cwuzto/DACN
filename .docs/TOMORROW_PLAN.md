# TOMORROW_PLAN.md

## Mục tiêu ngắn hạn

Bắt đầu batch mới theo quyết định ngày 2026-05-01: khóa rule đăng ký đề tài theo môn đồ án mà sinh viên đã đăng ký trước đó, đồng thời chuẩn bị kiến trúc để mở rộng nhiều tên đồ án trong cùng một đợt.

## Kế hoạch thực thi

1. P0 - Dữ liệu và migration
   - Bổ sung danh mục `Tên đồ án` (`ProjectCatalog`).
   - Bổ sung bảng enrollment môn đồ án của sinh viên theo đợt (`StudentProjectEnrollment`).
   - Bổ sung liên kết `projectCatalogId` cho `Topic`.
2. P0 - Backend validation
   - Khóa rule đăng ký đề tài: chỉ hợp lệ khi có enrollment đúng `Tên đồ án` + đúng đợt.
   - Áp dụng cùng rule cho các luồng create/update/chuyển đề tài có liên quan.
3. P0 - Seed và test
   - Seed dữ liệu mẫu cho `ProjectCatalog`, enrollment, topic.
   - Viết test đủ 4 case nghiệp vụ bắt buộc (pass/fail).
4. P1 - UI
   - Trang sinh viên: mặc định đợt mới nhất, tách chọn `Tên đồ án`, chặn đăng ký sai môn.
   - Trang admin: tách filter `Tên đồ án` và `Đợt đồ án`, hiển thị rõ trường tên đồ án.
5. P2 - Chuẩn bị import Excel (chưa bật tính năng)
   - Thêm metadata nguồn dữ liệu enrollment (`SEED`/`MANUAL`/`EXCEL`) và `importBatchId`.

## Tiêu chí hoàn tất

- Sinh viên không thể đăng ký đề tài sai môn đồ án hoặc sai đợt ở mọi luồng.
- Backend test pass đầy đủ cho rule mới.
- UI hiển thị/lọc tách bạch `Tên đồ án` và `Đợt đồ án`.
- Dữ liệu seed vận hành được end-to-end dù chưa có import Excel.
