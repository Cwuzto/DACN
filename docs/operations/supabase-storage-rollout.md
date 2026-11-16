# Hướng Dẫn Vận Hành và Rollout Supabase Storage

Tài liệu này hướng dẫn quy trình triển khai, kiểm thử và vận hành hạ tầng 4 bucket Supabase Storage cho hệ thống DACN theo đặc tả quản trị Supabase Storage (`docs/superpowers/specs/2026-11-17-supabase-storage-governance-design.md`).

---

## 1. Yêu Cầu Tiên Quyết: Luân Chuyển Khóa Bảo Mật (Secret Rotation)

Trước khi kích hoạt hạ tầng lưu trữ mới trên môi trường production/staging:
1. **Luân chuyển (Rotate) Supabase Service-Role Key**:
   - Truy cập Supabase Dashboard -> **Project Settings** -> **API**.
   - Thực hiện tạo lại / luân chuyển `service_role` secret key.
   - Cập nhật biến môi trường `SUPABASE_SERVICE_ROLE_KEY` trên server chạy backend.
   - **Tuyệt đối không commit giá trị key vào git hoặc in ra log console.**
2. **Luân chuyển Database Credential (nếu cần)**:
   - Nếu mật khẩu cơ sở dữ liệu từng lưu trong tệp cấu hình chia sẻ, tiến hành đổi mật khẩu qua Supabase Dashboard -> **Database Settings**.
   - Cập nhật `DATABASE_URL` trong file `.env` môi trường backend.

---

## 2. Quy Hoạch 4 Bucket Chuẩn

Hệ thống chỉ sử dụng đúng 4 bucket có tên cố định (không sử dụng tiền tố `dacn`):

| Tên Bucket | Tính công khai (`public`) | Mục đích sử dụng |
|---|---|---|
| `cong-khai` | `true` (Public) | Tài nguyên công khai đã phê duyệt (logo, background, biểu mẫu, thông báo cổng thông tin) |
| `hoc-vu` | `false` (Private) | Hồ sơ, biểu mẫu BM01–BM05, minh chứng, báo cáo lưu chiểu, slide, mã nguồn đồ án |
| `ca-nhan` | `false` (Private) | Ảnh đại diện (avatar) của người dùng |
| `tam` | `false` (Private) | Tệp tạm tải lên (staging), chờ kiểm tra, từ chối, hoặc mồ côi (chỉ backend truy cập) |

---

## 3. Khởi Tạo Bucket Bằng CLI (Provisioning CLI)

Tập lệnh `backend/scripts/storage/provisionBuckets.js` hỗ trợ khởi tạo và kiểm tra tính nhất quán (drift detection) của 4 bucket.

### 3.1. Chạy Thử Nghiệm (Dry-Run Mode) - Mặc định
Chế độ này chỉ kiểm tra trạng thái hiện tại của Storage và lập danh sách hành động dự kiến, **không ghi dữ liệu hoặc sửa đổi bucket**:

```powershell
node backend/scripts/storage/provisionBuckets.js --dry-run
```
hoặc chạy trực tiếp không tham số:
```powershell
node backend/scripts/storage/provisionBuckets.js
```

### 3.2. Áp Dụng Thay Đổi (Apply Mode)
Chế độ này sẽ thực hiện tạo các bucket còn thiếu và sửa lại cấu hình public/private nếu phát hiện sai lệch (drift):

```powershell
node backend/scripts/storage/provisionBuckets.js --apply
```

---

## 4. Xác Thực Sau Khi Khởi Tạo (Post-Provisioning Verification)

Sau khi chạy lệnh với cờ `--apply`, thực hiện xác minh:
1. Chạy lại script ở chế độ `--dry-run`:
   - Tất cả 4 bucket phải hiển thị hành động `MATCH` với trạng thái `synced`.
   - Số lượng `Created` và `Updated` bằng `0`.
2. Kiểm tra trên Supabase Dashboard -> **Storage**:
   - Bucket `cong-khai` có nhãn `Public`.
   - Ba bucket `hoc-vu`, `ca-nhan`, `tam` có nhãn `Private`.

---

## 5. Quy Tắc Bảo Mật và Giám Sát

- **Không bao giờ cấp Public URL cho bucket `hoc-vu`, `ca-nhan`, `tam`**: Mọi liên kết tải về cho tài liệu học vụ/cá nhân phải sử dụng signed URL với thời hạn tối đa 600 giây (10 phút).
- **Bucket `tam` không cấp signed URL cho người dùng**: Tệp trong `tam` chỉ dùng nội bộ giữa backend và TUS server/worker kiểm định.
- **Giới hạn dung lượng**:
  - Tệp thông thường: tối đa 20 MB.
  - Báo cáo, slide, mã nguồn ZIP: tối đa 50 MB.
  - Ngưỡng chuyển sang upload TUS: trên 6 MB (sử dụng chunk cố định 6 MB).

---

## 6. Kiểm Kê và Dọn Dẹp Tài Nguyên Cũ (Legacy Storage Inventory & Cleanup)

Nhằm đảm bảo an toàn tuyệt đối và bảo tồn tài nguyên thương hiệu (logo/background), quy trình dọn dẹp dữ liệu cũ bắt buộc chia thành 2 giai đoạn:

### 6.1. Giai đoạn 1: Quét kiểm kê và sinh Manifest (Inventory)
Tập lệnh `backend/scripts/storage/inventoryLegacyAssets.js` quét toàn bộ cơ sở dữ liệu và lưu trữ, phân loại thành 4 nhóm:
- `KEEP_BRANDING`: Logo và background được sao chép sang `cong-khai/thuong-hieu/`, băm SHA-256 và xác thực toàn vẹn trước khi hủy bản cũ.
- `KEEP_EXTERNAL`: Đường dẫn ngoài hợp lệ (GitHub, GitLab, YouTube, Vimeo) được giữ nguyên vẹn trong DB.
- `NULL_AND_DELETE`: Các URL Supabase Storage cũ hoặc đường dẫn cục bộ `/uploads/` được null hóa trong DB và xóa khỏi bucket cũ.
- `UNRESOLVED`: Các chuỗi URL không rõ nguồn gốc hoặc sai định dạng. Nếu có dù chỉ 1 mục `UNRESOLVED`, hệ thống sẽ chặn không cho thực thi lệnh xóa.

Chạy kiểm kê ở chế độ Dry-Run:
```powershell
node backend/scripts/storage/inventoryLegacyAssets.js --dry-run --output "$env:TEMP\legacy-storage-manifest.json"
```

### 6.2. Giai đoạn 2: Dọn dẹp an toàn có kiểm chứng (Cleanup)
Tập lệnh `backend/scripts/storage/cleanupLegacyAssets.js` yêu cầu chỉ định đường dẫn tệp manifest và xác nhận snapshot CSDL:

1. **Chạy thử nghiệm (Dry-Run)**:
```powershell
node backend/scripts/storage/cleanupLegacyAssets.js --dry-run --manifest "$env:TEMP\legacy-storage-manifest.json"
```

2. **Thực thi dọn dẹp chính thức (Apply Mode)**:
Chỉ thực hiện trong cửa sổ bảo trì (maintenance window) sau khi đã sao lưu (snapshot) cơ sở dữ liệu:
```powershell
node backend/scripts/storage/cleanupLegacyAssets.js --apply --confirm-snapshot --manifest "$env:TEMP\legacy-storage-manifest.json"
```

