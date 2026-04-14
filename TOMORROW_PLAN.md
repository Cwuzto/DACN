# TOMORROW_PLAN.md

## Mục tiêu buổi tiếp theo

Khóa chất lượng cho batch hiện tại và hoàn tất các phần vận hành còn thiếu trước demo.

## Kế hoạch thực thi

1. Chạy UAT clone sạch theo `SETUP_CLONE.md`.
2. Bổ sung test integration cho các endpoint quan trọng của task/dashboard.
3. Chạy smoke test upload Supabase với bucket thật.
4. Chạy full gate trước khi chốt:
   - `node scripts/check-utf8.js`
   - `node scripts/check-md-quality.js`
   - `node scripts/regression-check.js`
   - `npm --prefix backend test -- --runInBand`
   - `npm --prefix frontend run build`

## Tiêu chí hoàn tất

- UAT pass luồng chính cho 3 vai trò.
- Test và build pass ổn định.
- Không còn lỗi encoding/mojibake hoặc tiếng Việt không dấu bất thường trong tài liệu.
