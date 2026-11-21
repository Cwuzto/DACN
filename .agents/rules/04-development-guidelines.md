# Quy Chuẩn Phát Triển & Lệnh Thao Tác

Tài liệu này hướng dẫn các quy chuẩn lập trình và lệnh thao tác cho Frontend và Backend.

---

## 1. Cấu trúc Dự án

- **`backend/`**: REST API Node.js + Express + Prisma Client + PostgreSQL.
- **`frontend/`**: React 19 + Vite + Ant Design + Tailwind CSS + Zustand + Axios.
- **`.agents/rules/`**: Thư mục chứa các tài liệu quy tắc và quy trình chuẩn của dự án.

---

## 2. Các Lệnh Thường Dùng

### Backend (`backend/`)
```bash
npm run dev      # Khởi động server phát triển (nodemon)
npm test         # Chạy unit & integration tests
npx prisma generate  # Sinh mã Prisma Client sau khi sửa schema
```

### Frontend (`frontend/`)
```bash
npm run dev      # Khởi động Vite dev server
npm run build    # Build production bundle
npm run preview  # Xem trước bản build
```

---

## 3. Quy Tắc Lập Trình Bắt Buộc

1. **Tuân thủ mô hình `TopicRegistration`**: Không sử dụng lại mô hình cũ `group/groupMember`.
2. **Frontend bám sát Backend**: Không dùng mock data khi API backend đã có sẵn.
3. **Bảo toàn Encoding**: Tất cả các file (`.md`, `.js`, `.jsx`, `.prisma`, `.json`) phải được lưu ở định dạng **UTF-8 (no BOM)**.
4. **Bảo mật Dữ liệu**: Không commit chuỗi kết nối chứa mật khẩu lên Git (luôn đưa vào `.env` hoặc `.gitignore`).
5. **Chuẩn thiết kế Nút bấm & Giao diện (UI Button Standards)**:
   - Tuyệt đối không chèn ký tự thô / emoji (`←`, `+`, `🤖`, `📋`, `✓`, `✏️`, `👥`, `🔓`, v.v.) vào chuỗi text nhãn của Button.
   - Luôn sử dụng prop `icon={<IconComponent />}` từ `@ant-design/icons` khi cần biểu tượng, giữ nhãn text thuần túy tiếng Việt trang nhã và chuyên nghiệp.
