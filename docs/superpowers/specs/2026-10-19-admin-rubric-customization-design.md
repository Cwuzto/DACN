# Thiết Kế Chi Tiết: Tùy Chỉnh Tiêu Chí Rubric Chấm Điểm Bảo Vệ Cho Quản Trị Viên (Admin)

- **Ngày tạo:** 2026-10-19
- **Nhánh triển khai:** `redesign-with-opendesign`
- **Trạng thái:** Đã duyệt thiết kế (Design Approved)
- **Tài liệu tham chiếu:** [AGENTS.md](file:///d:/DACN/AGENTS.md), [CLAUDE.md](file:///d:/DACN/CLAUDE.md), [.agents/rules/01-business-workflow.md](file:///d:/DACN/.agents/rules/01-business-workflow.md)

---

## 1. Mục Tiêu & Bối Cảnh Nghiệp Vụ

### 1.1. Bối cảnh
Trước đây, bộ tiêu chí chấm điểm bảo vệ đồ án tốt nghiệp (Barem Rubric) gồm 14 tiêu chí được gắn cứng trong mã nguồn (`RUBRIC_V1` trong [evaluationController.js](file:///d:/DACN/backend/src/controllers/evaluationController.js) và danh sách mã tĩnh trong [LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx)). Việc này gây ra các bất cập:
- Quản trị viên (Admin) không thể cập nhật, bổ sung hoặc điều chỉnh barem điểm khi nhà trường thay đổi quy chế đánh giá.
- Không có cấu trúc nhóm theo từng Mục lớn (Category) chuẩn của Hội đồng chấm khóa luận tốt nghiệp.
- Giảng viên khó theo dõi các mức độ đánh giá chi tiết (Rubric Descriptors) của từng tiêu chí.

### 1.2. Mục tiêu
Xây dựng phân hệ Quản trị Rubric hoàn chỉnh cho phép:
1. Quản lý toàn hệ thống theo phiên bản (`RubricVersion`: `v1`, `v2`, `v3`...), với cơ chế bảo lưu lịch sử (không ảnh hưởng điểm số của các khóa trước).
2. Cấu trúc phân cấp 2 tầng: **Mục lớn (Category)** $\rightarrow$ **Tiêu chí con (Criterion)**.
3. Ràng buộc bảo toàn điểm:
   - Tổng điểm các tiêu chí con trong mỗi mục = Điểm tối đa của mục.
   - Tổng điểm của tất cả các mục = Chính xác **10.0** điểm.
4. **Business Guard (Khóa an toàn)**: Chỉ cho phép Admin chỉnh sửa hoặc kích hoạt phiên bản Rubric khi **chưa vào đợt đồ án** (học kỳ hiện tại ở trạng thái `UPCOMING` hoặc trước ngày `startDate`). Khi học kỳ chuyển sang `ONGOING`, `DEFENSE` hoặc sau `startDate`, hệ thống tự động khóa (Read-only mode).
5. Đồng bộ giao diện chấm điểm của Giảng viên ([LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx)) và giao diện xem phiếu điểm của Admin ([GradingDefensePage.jsx](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx)) hiển thị động theo đúng phiên bản Rubric của đề tài.

---

## 2. Kiến Trúc Dữ Liệu (Database Schema)

### 2.1. Cập nhật Prisma Schema (`backend/prisma/schema.prisma`)

```prisma
enum RubricStatus {
  DRAFT       // Bản thảo, Admin có thể tự do chỉnh sửa
  ACTIVE      // Bản chính thức đang áp dụng cho hệ thống
  ARCHIVED    // Bản cũ lưu trữ, chỉ đọc để bảo lưu dữ liệu lịch sử
}

model RubricVersion {
  id             Int              @id @default(autoincrement())
  version        String           @unique // e.g. "v1", "v2", "v3"
  title          String           // vd: "Barem điểm bảo vệ đồ án K2026"
  description    String?          @db.Text
  totalMaxScore  Float            @default(10.0) @map("total_max_score")
  status         RubricStatus     @default(DRAFT)
  isActive       Boolean          @default(false) @map("is_active")
  createdById    Int?             @map("created_by_id")
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")

  createdByUser  User?            @relation("RubricCreator", fields: [createdById], references: [id])
  categories     RubricCategory[]

  @@map("rubric_versions")
}

model RubricCategory {
  id              Int               @id @default(autoincrement())
  rubricVersionId Int               @map("rubric_version_id")
  code            String            @map("code") // vd: "CAT_REPORT_FORMAT", "CAT_RESEARCH_CONTENT", "CAT_DEFENSE_QA"
  name            String            @map("name") // vd: "1. Hình thức và kỹ năng trình bày báo cáo"
  description     String?           @db.Text
  maxScore        Float             @map("max_score") // Điểm tối đa của mục (vd: 1.0, 5.0, 4.0)
  orderIndex      Int               @default(0) @map("order_index")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  rubricVersion   RubricVersion     @relation(fields: [rubricVersionId], references: [id], onDelete: Cascade)
  criteria        RubricCriterion[]

  @@unique([rubricVersionId, code])
  @@index([rubricVersionId, orderIndex])
  @@map("rubric_categories")
}

model RubricCriterion {
  id          Int            @id @default(autoincrement())
  categoryId  Int            @map("category_id")
  code        String         @map("code") // vd: "STRUCTURE", "RESEARCH_CONTENT"
  label       String         @map("label") // Tên tiêu chí, vd: "Bố cục, cấu trúc đề tài"
  description String?        @db.Text // Mô tả chi tiết / Các cấp độ đánh giá (Xuất sắc, Tốt, TB...)
  maxScore    Float          @map("max_score") // Điểm tối đa tiêu chí (vd: 0.5, 2.5)
  orderIndex  Int            @default(0) @map("order_index")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  category    RubricCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([categoryId, orderIndex])
  @@map("rubric_criteria")
}
```

### 2.2. Seed Data Khởi Tạo & Tương Thích Ngược
Tạo migration và file seed data di chuyển toàn bộ 14 tiêu chí hiện tại của `RUBRIC_V1` vào cơ sở dữ liệu với trạng thái `ACTIVE = true` và `version = 'v1'`:
- **Mục 1: Hình thức và kỹ năng trình bày báo cáo (Tối đa 1.0 điểm)**
  - `STRUCTURE`: Cấu trúc báo cáo (0.5 điểm)
  - `CITATION_FORMAT`: Trích dẫn, hình thức trình bày (0.25 điểm)
  - `LANGUAGE`: Ngôn ngữ diễn đạt (0.25 điểm)
- **Mục 2: Nội dung và kết quả nghiên cứu (Tối đa 5.0 điểm)**
  - `PROBLEM_STATEMENT`: Đặt vấn đề, tổng quan tình hình nghiên cứu (1.0 điểm)
  - `RESEARCH_METHOD`: Phương pháp nghiên cứu (0.5 điểm)
  - `RESEARCH_CONTENT`: Nội dung nghiên cứu (2.5 điểm)
  - `RESEARCH_RESULT`: Kết quả nghiên cứu (1.0 điểm)
- **Mục 3: Tính thời sự, ứng dụng và công bố (Tối đa 1.0 điểm)**
  - `NOVELTY`: Tính mới và tính thời sự (0.25 điểm)
  - `APPLICABILITY`: Tính ứng dụng thực tiễn (0.5 điểm)
  - `PUBLICATION`: Đề tài có bài báo khoa học (0.25 điểm)
- **Mục 4: Thuyết trình và trả lời câu hỏi Hội đồng (Tối đa 3.0 điểm)**
  - `PRESENTATION_SKILL`: Kỹ năng và hình thức bài thuyết trình (0.5 điểm)
  - `ATTITUDE`: Thái độ, tác phong, bản lĩnh học thuật (0.5 điểm)
  - `PRESENTATION_CONTENT`: Nội dung bài thuyết trình (1.0 điểm)
  - `QA_RESPONSE`: Trả lời câu hỏi của Hội đồng (1.0 điểm)

Tổng điểm các mục: $1.0 + 5.0 + 1.0 + 3.0 = 10.0$ điểm. Toàn bộ dữ liệu điểm số cũ trong [DefenseMemberScore](file:///d:/DACN/backend/prisma/schema.prisma#L305) liên kết với phiên bản `v1` được bảo toàn nguyên vẹn.

---

## 3. Backend API & Business Logic

### 3.1. Danh Sách Endpoint (`/api/v1/rubrics`)

| Method | Endpoint | Quyền | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/rubrics` | `ADMIN`, `LECTURER` | Lấy danh sách các phiên bản Rubric (kèm cờ `isEditable` của hệ thống) |
| `GET` | `/api/v1/rubrics/active` | Public / All Auth | Lấy chi tiết phiên bản Rubric đang `ACTIVE` kèm danh mục & tiêu chí |
| `GET` | `/api/v1/rubrics/:id` | `ADMIN` | Lấy chi tiết phiên bản (Mục, Tiêu chí, Mô tả) |
| `POST` | `/api/v1/rubrics` | `ADMIN` | Tạo phiên bản mới hoặc Nhân bản (Clone) từ phiên bản cũ |
| `PUT` | `/api/v1/rubrics/:id` | `ADMIN` | Cập nhật cấu trúc danh mục, tiêu chí, mô tả và điểm số |
| `POST` | `/api/v1/rubrics/:id/activate` | `ADMIN` | Kích hoạt phiên bản thành bản chính thức áp dụng |
| `DELETE` | `/api/v1/rubrics/:id` | `ADMIN` | Xóa phiên bản nháp `DRAFT` (chặn xóa nếu là `ACTIVE` hoặc đã có điểm) |

### 3.2. Business Logic Guard: Kiểm tra điều kiện chỉnh sửa (`canEditRubric`)
```javascript
// backend/src/services/rubricService.js
async function checkCanEditRubric() {
    const now = new Date();
    // 1. Kiểm tra học kỳ đang diễn ra hoặc đang bảo vệ
    const ongoingSemester = await prisma.semester.findFirst({
        where: { status: { in: ['ONGOING', 'DEFENSE'] } },
    });
    if (ongoingSemester) {
        return {
            canEdit: false,
            reason: `Học kỳ ${ongoingSemester.name} đang trong giai đoạn thực hiện đồ án hoặc bảo vệ. Barem chấm điểm đã bị khóa để đảm bảo tính công bằng.`,
        };
    }

    // 2. Kiểm tra học kỳ đã vượt qua startDate
    const startedSemester = await prisma.semester.findFirst({
        where: {
            startDate: { lte: now },
            endDate: { gte: now },
        },
    });
    if (startedSemester) {
        return {
            canEdit: false,
            reason: `Học kỳ ${startedSemester.name} đã bắt đầu (sau ngày ${startedSemester.startDate.toLocaleDateString()}). Barem chấm điểm đã bị khóa.`,
        };
    }

    return { canEdit: true };
}
```

### 3.3. Ràng Buộc Kiểm Tra Khi Lưu & Kích Hoạt (`validateRubricStructure`)
1. Mỗi danh mục phải có ít nhất 1 tiêu chí con.
2. Với mỗi danh mục: $\sum \text{maxScore(criteria)} == \text{maxScore(category)}$.
3. Với toàn bộ barem: $\sum \text{maxScore(categories)} == 10.0$.
4. Khi kích hoạt:
   - Phải thỏa mãn `checkCanEditRubric()`.
   - Chuyển phiên bản hiện tại thành `ACTIVE`, cập nhật phiên bản `ACTIVE` trước đó thành `ARCHIVED`.

### 3.4. Tích Hợp Vào Controller Chấm Điểm (`evaluationController.js`)
* `getScoreSheet(registrationId)`:
  - Lấy `scoreRubricVersion` của hồ sơ hoặc lấy phiên bản đang `ACTIVE`.
  - Nạp danh sách Mục và Tiêu chí con từ CSDL trả về cho frontend thay cho biến tĩnh `RUBRIC_V1`.
* `saveScoreSheet(registrationId)`:
  - Xác thực điểm từng tiêu chí dựa trên `maxScore` thực tế trong CSDL của phiên bản tương ứng.
  - Tự động cộng tổng điểm và ghi nhận `scoreRubricVersion`.

---

## 4. Frontend UI/UX (Giao Diện Người Dùng)

### 4.1. Trang Quản Lý Rubric Cho Admin (`/admin/rubric-management`)
* **Menu điều hướng**: Thêm mục **"Tiêu chí chấm điểm (Rubric)"** vào Sidebar Quản trị viên.
* **Danh sách phiên bản**:
  - Thẻ tóm tắt thông tin: Mã phiên bản, Tên phiên bản, Trạng thái (`ACTIVE` xanh lá, `DRAFT` cam, `ARCHIVED` xám), Tổng số mục, Tổng số tiêu chí, Ngày tạo.
  - Các nút tác vụ:
    - **Tạo phiên bản mới / Nhân bản**: Tạo bản nháp từ bản hiện tại.
    - **Xem / Chỉnh sửa**: Mở trình soạn thảo Rubric.
    - **Kích hoạt**: Kiểm tra ràng buộc và kích hoạt.
* **Trình soạn thảo Rubric (Rubric Editor)**:
  - **Banner cảnh báo khóa an toàn**: Nếu `canEdit === false`, hiển thị Banner màu vàng với lý do khóa cụ thể và chuyển toàn bộ form sang chế độ `Read-only`.
  - **Thẻ điểm số trực quan (Score Summary Card)**:
    - Hiển thị tổng điểm thời gian thực: `Tổng điểm hiện tại: 10.0 / 10.0`.
    - Nếu tổng điểm khác 10.0: Hiển thị cảnh báo màu đỏ và vô hiệu hóa nút Lưu/Kích hoạt.
  - **Danh sách Mục (Categories)**:
    - Mỗi mục là một thẻ card có thể thu gọn/mở rộng.
    - Cho phép sửa Tên mục, Điểm tối đa của mục.
    - Hiển thị tiến độ điểm: $\text{Tổng điểm tiêu chí con} / \text{Điểm tối đa của mục}$ (cảnh báo nếu chưa khớp).
    - Thêm/Xóa mục linh hoạt.
  - **Danh sách Tiêu chí con (Criteria)** trong từng Mục:
    - Tên tiêu chí, Mã tiêu chí, Điểm tối đa.
    - Khung nhập mô tả / Hướng dẫn đánh giá các mức độ (Xuất sắc, Tốt, Khá, Trung bình...).
    - Thêm/Xóa tiêu chí con.

### 4.2. Cập Nhật Giao Diện Chấm Điểm Của Giảng Viên ([LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx))
* Loại bỏ mảng tĩnh `RUBRIC_CODES` và chuỗi HTML regex tĩnh.
* Render bảng chấm điểm động:
  - Các dòng nhóm Mục lớn (Category Row) nổi bật với điểm tối đa của mục.
  - Các dòng tiêu chí con (Criteria Rows) hiển thị rõ: STT, Tên tiêu chí, Mô tả/Các cấp độ đánh giá, Điểm tối đa, Ô nhập điểm của giảng viên, Ghi chú.
  - Tính tổng điểm tự động theo thời gian thực và validate không cho nhập vượt quá `maxScore` của từng ô.

---

## 5. Kế Hoạch Triển Khai (Phasing Plan)

1. **Giai đoạn 1: Database & Migration**
   - Viết schema mới trong `schema.prisma`.
   - Tạo migration và script seed dữ liệu khởi tạo phiên bản `v1` chuẩn hóa.
2. **Giai đoạn 2: Backend Service & API Controller**
   - Xây dựng `rubricService.js` (CRUD, checkCanEdit, validateStructure).
   - Xây dựng `rubricController.js` và route `/api/v1/rubrics`.
   - Cập nhật `evaluationController.js` hỗ trợ nạp và chấm điểm theo Rubric động từ CSDL.
3. **Giai đoạn 3: Frontend Admin Rubric Management**
   - Tạo `rubricService.js` ở frontend.
   - Xây dựng trang [RubricManagementPage.jsx](file:///d:/DACN/frontend/src/pages/admin/RubricManagementPage.jsx).
   - Thêm route và menu điều hướng cho Admin.
4. **Giai đoạn 4: Frontend Chấm Điểm Động Cho Giảng Viên & Admin**
   - Cập nhật [LecturerGradingSheetPage.jsx](file:///d:/DACN/frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx) hiển thị bảng động theo cấu trúc nhóm mục.
   - Cập nhật modal xem phiếu điểm trong [GradingDefensePage.jsx](file:///d:/DACN/frontend/src/pages/admin/GradingDefensePage.jsx).
5. **Giai đoạn 5: Kiểm Thử Tích Hợp Toàn Diện (E2E & Integration Tests)**
   - Viết test suite kiểm tra toàn bộ luồng tạo, sửa, clone, kích hoạt, khóa khi vào kỳ, và chấm điểm thực tế.
   - Chạy `npm run build` trên cả frontend và backend, đảm bảo 0 lỗi.
