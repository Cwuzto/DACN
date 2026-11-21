# Phân Quyền & Quản Lý Người Dùng (RBAC)

Tài liệu này quy định hệ thống vai trò (Roles) và ma trận phân quyền (RBAC) trong hệ thống.

---

## 1. Vai trò cơ sở (Base Roles)

Hệ thống có 3 vai trò cơ sở:

1. **`ADMIN` (Quản trị viên)**:
   - Quản lý đợt đồ án, danh mục môn đồ án (`ProjectCatalog`).
   - Quản lý người dùng: Tạo thủ công, import file Excel sinh viên/giảng viên, cấp tài khoản.
   - Quản lý nhóm quyền (RBAC) và gán quyền cho người dùng.
   - Quản lý tin tức / thông báo / biểu mẫu trên Trang chủ (`PublicAnnouncement`).
   - Lập hội đồng xét duyệt đề cương và hội đồng bảo vệ, phân công sinh viên.
2. **`LECTURER` (Giảng viên)**:
   - Đề xuất đề tài, duyệt/từ chối yêu cầu đăng ký đề tài của sinh viên (tối đa 10 SV).
   - Theo dõi tiến độ định kỳ (BM03) và đánh giá 2 đợt checkpoint.
   - Lập phiếu nhận xét BM04 quyết định cho sinh viên ra bảo vệ.
   - Tham gia hội đồng (Chủ tịch, Thư ký, Phản biện) và chấm điểm bảo vệ độc lập.
3. **`STUDENT` (Sinh viên)**:
   - Xem thông báo, hướng nghiên cứu và danh sách GVHD trên Trang chủ.
   - Đăng ký đề tài với GVHD (1 sinh viên / 1 đề tài).
   - Nộp đề cương (BM01), đơn đăng ký chính thức (BM02), báo cáo tiến độ (BM03), nhận xét (BM04) và nộp lưu chiểu sau bảo vệ.
   - Xem kết quả đánh giá, điểm số hội đồng.

---

## 2. Nhóm quyền Chức vụ (Permission Groups)

Bên cạnh vai trò cơ sở, một Giảng viên có thể được gán thêm nhóm quyền để thực hiện các nghiệp vụ quản trị chuyên biệt:

- **`VIEN_TRUONG` (Viện trưởng / Phó Viện trưởng)**:
  - Có toàn quyền xem và điều phối phân công đề tài/GVHD khi cần thiết.
  - Phê duyệt danh sách giao đề tài, danh sách hội đồng.
- **`GVHD` (Giảng viên hướng dẫn)**:
  - Các quyền tiêu chuẩn của giảng viên hướng dẫn đồ án.
- **`QUAN_TRI_VIEN`**:
  - Nhóm quyền quản trị hệ thống.

---

## 3. Quản lý Tài khoản & Phân quyền

- **Tài khoản nội bộ**: Do Quản trị viên cấp (không mở đăng ký tự do để bảo đảm an toàn dữ liệu trường học).
- **Import dữ liệu**: Hỗ trợ import danh sách sinh viên đủ điều kiện và giảng viên từ file Excel.
