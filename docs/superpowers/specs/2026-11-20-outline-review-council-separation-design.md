# Thiết Kế Phân Tách Không Gian Thẩm Định Đề Cương Khỏi Duyệt Nguyện Vọng

Tài liệu này xác định kiến trúc, giao diện người dùng và cơ chế phân quyền cho việc tách biệt hoàn toàn tính năng **Thẩm định đề cương của Hội đồng** ra khỏi trang **Duyệt nguyện vọng của Giảng viên hướng dẫn**, xây dựng không gian làm việc chuyên sâu cho Hội đồng xét duyệt đề cương tương tự như Hội đồng chấm bảo vệ.

---

## 1. Bối Cảnh Và Mục Tiêu

### 1.1. Thực trạng hiện tại
- Trang duyệt của giảng viên hiện đang dồn hai nghiệp vụ khác nhau vào cùng một màn hình với hai thẻ chuyển đổi:
  - Thẻ 1: Giảng viên hướng dẫn tiếp nhận sinh viên đăng ký đề tài.
  - Thẻ 2: Hội đồng thẩm định xem xét đề cương nghiên cứu chi tiết của sinh viên.
- Mặc dù thanh điều hướng bên trái đã hiển thị hai mục riêng biệt gồm "Duyệt nguyện vọng" và "Thẩm định đề cương", nhưng khi người dùng bấm vào thì cả hai đều mở chung một trang và tự động chuyển thẻ qua tham số đường dẫn.
- Sự gộp chung này làm lu mờ ranh giới trách nhiệm: việc nhận hướng dẫn là quan hệ trực tiếp giữa cá nhân người dạy và người học; còn việc thẩm định đề cương là nhiệm vụ của một tập thể Hội đồng gồm ba thành viên được Viện ban hành quyết định thành lập.

### 1.2. Mục tiêu cải tiến
- Tách thành hai trang độc lập với đường dẫn riêng biệt.
- Trang **Duyệt nguyện vọng**: Không gian thuần túy của Giảng viên hướng dẫn để theo dõi chỉ tiêu mười sinh viên, xem hồ sơ đăng ký và đưa ra quyết định tiếp nhận hoặc từ chối.
- Trang **Thẩm định đề cương**: Không gian làm việc chính quy của Hội đồng xét duyệt đề cương. Hiển thị thông tin hội đồng, quyết định thành lập, danh sách đề tài được giao, hỗ trợ xem toàn văn bản in đề cương, phân tích hỗ trợ và biểu mẫu đánh giá.
- Phân định thẩm quyền rõ ràng: Cả **Chủ tịch Hội đồng** và **Thư ký Hội đồng** đều có quyền bấm quyết định kết luận thẩm định; **Ủy viên Hội đồng** có quyền xem hồ sơ, theo dõi nội dung và để lại ý kiến đóng góp.

---

## 2. Kiến Trúc Điều Hướng Và Phân Quyền

### 2.1. Phân định đường dẫn và chính sách màn hình

| Tên màn hình | Đường dẫn | Đối tượng sử dụng | Thành phần giao diện |
| :--- | :--- | :--- | :--- |
| **Duyệt nguyện vọng** | `/lecturer/approvals` | Giảng viên hướng dẫn | `TopicApprovalPage.jsx` (đã tinh giản, bỏ toàn bộ thẻ chuyển đổi bên trong). |
| **Thẩm định đề cương** | `/lecturer/outline-evaluations` | Thành viên Hội đồng thẩm định đề cương | `OutlineReviewPage.jsx` (màn hình mới độc lập hoàn toàn). |

### 2.2. Phân định quyền thao tác trong Hội đồng thẩm định

- **Chủ tịch Hội đồng**: Có quyền xem toàn bộ hồ sơ đề cương, xem ý kiến thành viên và bấm phê duyệt kết luận cuối cùng (Đạt yêu cầu, Yêu cầu chỉnh sửa lại lần hai, hoặc Không đạt).
- **Thư ký Hội đồng**: Có quyền xem toàn bộ hồ sơ, ghi nhận nội dung cuộc họp thẩm định và thay mặt hội đồng bấm phê duyệt kết luận chính thức.
- **Ủy viên Hội đồng**: Có quyền tra cứu toàn văn đề cương, sử dụng công cụ hỗ trợ rà soát, ghi nhận ý kiến nhận xét chuyên môn nhưng không hiển thị nút bấm chốt kết quả thẩm định.

---

## 3. Thiết Kế Giao Diện Người Dùng Hiện Đại (UI/UX Pro Max)

Giao diện áp dụng phong cách bố cục lưới đa tầng hiện đại kết hợp không gian làm việc tập trung dữ liệu. Hệ thống màu sắc sử dụng bảng màu học thuật phong phú, độ tương phản cao, chuyển động thẻ mượt mà và trực quan.

### 3.1. Bảng màu chủ đạo và hiệu ứng thị giác

- **Xanh biển sâu (`#1E3A5F` và `#0F2942`)**: Dành cho khối thông tin Hội đồng, thể hiện tính pháp lý, trang trọng của quyết định thành lập hội đồng.
- **Ngọc lục bảo (`#059669` và nền `#ECFDF5`)**: Trạng thái Đạt yêu cầu, thông qua đề cương.
- **Vàng hổ phách (`#D97706` và nền `#FFFBEB`)**: Trạng thái Chờ thẩm định, các mốc thời gian cần xử lý ưu tiên.
- **Tím thạch anh (`#7C3AED` và nền `#F5F3FF`)**: Trạng thái Yêu cầu chỉnh sửa lần hai, các lưu ý từ hội đồng.
- **Lam hoàng gia (`#2563EB` và nền `#EFF6FF`)**: Nhận diện vai trò Thư ký Hội đồng và các thông tin nghiệp vụ.
- **Chuyển động vi mô**:
  - Hiệu ứng trượt nhẹ từ dưới lên và hiển thị êm dịu khi nạp dữ liệu trong khoảng thời gian ba trăm mili giây.
  - Các thẻ tổng quan có hiệu ứng nâng nhẹ bề mặt và đổi viền màu sắc khi rê chuột qua trong vòng hai trăm mili giây.
  - Hỗ trợ đầy đủ tiêu chuẩn giảm chuyển động đối với người dùng cài đặt ưu tiên giao diện tĩnh.

### 3.2. Cấu trúc trang "Thẩm định đề cương"

#### Khối 1: Bảng thông tin nhận diện Hội đồng
- Thẻ lớn dạng bề mặt phẳng nổi bật với viền xanh ngọc bích sang trọng.
- Hiển thị đầy đủ:
  - Tên Hội đồng: Ví dụ `Hội đồng Thẩm định Đề cương Đồ án số 02 · Ngành Kỹ thuật Phần mềm`
  - Quyết định thành lập: Số quyết định, ngày ban hành của Viện Công nghệ Số.
  - Danh sách thành viên hội đồng kèm vai trò chính thức: Chủ tịch Hội đồng, Thư ký Hội đồng, Ủy viên Hội đồng.
  - Huy hiệu hiển thị vai trò hiện tại của người đang đăng nhập (ví dụ: `Vai trò của bạn: Thư ký Hội đồng`).

#### Khối 2: Bốn thẻ đo lường tiến độ thẩm định
Bốn thẻ chỉ số được xếp ngang với màu sắc phân định trực quan:
1. **Tổng số đề tài**: Nền trắng viền lam, thể hiện tổng khối lượng công việc hội đồng đảm nhiệm.
2. **Chờ thẩm định**: Nền vàng hổ phách, chữ số nổi bật thể hiện số đề tài cần hội đồng xem xét ngay.
3. **Đã thông qua**: Nền ngọc lục bảo, thể hiện số đề tài đã hoàn tất thẩm định đạt chuẩn.
4. **Cần chỉnh sửa**: Nền tím thạch anh, thể hiện các đề cương cần sinh viên bổ sung chỉnh sửa lần hai.

#### Khối 3: Bảng danh sách đề tài và không gian thẩm định
- Thanh công cụ phía trên gồm: Ô tìm kiếm nhanh (theo tên sinh viên, mã số sinh viên, tên đề tài), bộ lọc nhanh theo tình trạng xử lý và nút làm mới dữ liệu.
- Danh sách đề tài hiển thị rõ ràng:
  - Mã đề tài và Tên đề tài nghiên cứu.
  - Sinh viên thực hiện, Mã số sinh viên, Chuyên ngành đào tạo.
  - Họ và tên Giảng viên hướng dẫn.
  - Đợt nộp đề cương: Bản nộp lần đầu hoặc Bản nộp lại lần hai.
  - Trạng thái thẩm định kèm nhãn màu tương ứng.
  - Cột thao tác:
    - Nút **Xem đề cương**: Mở cửa sổ xem trực tiếp toàn văn bản in đề cương học thuật.
    - Nút **Thẩm định đề cương**:
      - Hiển thị nổi bật đối với Chủ tịch Hội đồng và Thư ký Hội đồng.
      - Chuyển thành nút **Xem & Góp ý** đối với Ủy viên Hội đồng.

#### Khối 4: Cửa sổ thẩm định và ban hành kết luận
- Khi Chủ tịch hoặc Thư ký bấm thẩm định, cửa sổ chi tiết xuất hiện:
  - Tóm tắt mục tiêu, nhiệm vụ và phương pháp nghiên cứu từ đề cương.
  - Công cụ trợ lý thông minh hỗ trợ rà soát tính khả thi và phạm vi nghiên cứu của đề tài.
  - Khung lựa chọn kết luận:
    - `Đạt yêu cầu`: Chấp thuận đề cương, cho phép triển khai đồ án chính thức.
    - `Yêu cầu chỉnh sửa`: Chỉ định các nội dung cần bổ sung hoàn thiện trong vòng mười bốn ngày (sinh viên chỉ được nộp lại đúng một lần duy nhất).
    - `Không đạt`: Dừng đề tài nếu đề cương không đáp ứng yêu cầu học thuật.
  - Khung nhập nhận xét và góp ý chi tiết của hội đồng gửi cho sinh viên và giảng viên hướng dẫn.

---

### 3.3. Cấu trúc trang "Duyệt nguyện vọng" sau khi tinh giản

- Loại bỏ hoàn toàn hai thẻ chuyển đổi gây nhầm lẫn trên trang `TopicApprovalPage.jsx`.
- Toàn bộ trang trở thành không gian làm việc thuần túy của Giảng viên hướng dẫn:
  - Thẻ hiển thị chỉ tiêu: `Hạn mức hướng dẫn: Đã tiếp nhận 6 / 10 sinh viên`.
  - Bảng danh sách sinh viên đang nộp đơn đăng ký vào đề tài của giảng viên.
  - Thao tác xét duyệt trực tiếp: Nút **Chấp thuận hướng dẫn** và nút **Từ chối tiếp nhận** (bắt buộc nhập lý do từ chối để thông báo cho sinh viên).

---

## 4. Chuẩn Mực Kỹ Thuật Bắt Buộc

1. **Mô hình đề tài**: Tuyệt đối tuân thủ mô hình một sinh viên thực hiện một đề tài, một giảng viên hướng dẫn tối đa mười sinh viên trong một đợt.
2. **Quy chuẩn nút bấm và biểu tượng**:
   - Sử dụng thành phần biểu tượng chính quy từ thư viện Ant Design thông qua thuộc tính `icon`.
   - Nhãn văn bản bên trong nút là tiếng Việt thuần túy, ngắn gọn, lịch sự.
   - Tuyệt đối không chèn ký tự đồ họa thô hoặc hình vẽ cảm xúc vào văn bản nút bấm.
3. **Mã hóa tệp nguồn**: Tất cả các tệp mã nguồn tạo mới và chỉnh sửa phải lưu đúng chuẩn UTF-8 không có dấu hiệu thứ tự byte ở đầu tệp.
4. **Bảo mật và toàn vẹn dữ liệu**: Không sử dụng dữ liệu giả lập khi backend đã có API thực tế.

---

## 5. Kế Hoạch Xác Thực Và Kiểm Thử

1. **Kiểm thử phân quyền giao diện**:
   - Kiểm tra tài khoản là Chủ tịch Hội đồng: Hiển thị đầy đủ quyền và nút bấm chốt kết luận.
   - Kiểm tra tài khoản là Thư ký Hội đồng: Hiển thị đầy đủ quyền và nút bấm chốt kết luận.
   - Kiểm tra tài khoản là Ủy viên Hội đồng: Chỉ hiển thị nút xem đề cương và khung góp ý, không có nút ban hành kết luận.
   - Kiểm tra tài khoản không thuộc hội đồng: Không xuất hiện menu Thẩm định đề cương trên thanh điều hướng.
2. **Kiểm thử điều hướng và tính tương thích**:
   - Kiểm tra liên kết từ bảng điều khiển giảng viên và danh sách thông báo khi bấm vào thông báo đề cương chuyển đúng sang trang `/lecturer/outline-evaluations`.
   - Kiểm tra trang `/lecturer/approvals` hoạt động trơn tru không còn thẻ lồng nhau.
3. **Kiểm thử biên dịch**: Chạy toàn bộ bộ kiểm thử tự động và đảm bảo quá trình đóng gói ứng dụng hoàn thành không có lỗi.
