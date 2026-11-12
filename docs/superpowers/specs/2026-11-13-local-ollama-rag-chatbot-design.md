# Đặc Tả Kỹ Thuật: Hệ Thống RAG & Local AI Chatbot (Ollama, Qwen3:4b, EmbeddingGemma-2)

- **Ngày ban hành**: 13/11/2026
- **Tác giả**: Đội ngũ Phát triển Hệ thống Quản lý Đồ án Tốt nghiệp (DACN)
- **Mục tiêu**: Xây dựng hệ thống Trợ lý Học vụ AI vận hành cục bộ 100% (Local AI) với kiến trúc RAG (Retrieval-Augmented Generation) kết hợp mô hình sinh `qwen3:4b` và mô hình nhúng vector `embeddinggemma-2:270m`, cài đặt và lưu trữ toàn bộ dữ liệu trên ổ đĩa `D:\ollama`.
- **Trạng thái**: Bản thảo đặc tả kỹ thuật (Draft Specification)

---

## 1. Bối Cảnh & Động Lực (Background & Motivation)

### 1.1. Thách Thức Khi Dùng Cloud AI (Google Gemini API)
- Gói Gemini API Free Tier bị giới hạn nghiêm ngặt 20 lượt gọi/ngày đối với các mô hình thế hệ mới (`gemini-3.8-flash`), dẫn đến lỗi `429 RESOURCE_EXHAUSTED` khi test nhiều hoặc triển khai thực tế.
- Cloud AI phụ thuộc vào đường truyền Internet và tài khoản đám mây, tiềm ẩn nguy cơ gián đoạn khi bảo vệ đồ án tốt nghiệp.

### 1.2. Mục Tiêu Của Giải Pháp Local AI + RAG
1. **Độc lập và bảo mật 100%**: Vận hành hoàn toàn offline trên máy chủ/máy trạm local, không gửi dữ liệu ra bên ngoài.
2. **Không giới hạn lượt gọi (Zero Rate-limit)**: Tự do truy vấn không lo cạn kiệt quota hay tốn chi phí token.
3. **Kiến trúc RAG (Retrieval-Augmented Generation)**: Thay vì nhồi toàn bộ tài liệu dài hàng nghìn dòng vào prompt (gây chậm và tràn bộ nhớ), hệ thống chỉ trích xuất đúng 3–5 đoạn quy chế liên quan nhất (semantic similarity search) để làm ngữ cảnh trả lời.
4. **Tối ưu hóa phần cứng hiện có**: Chạy mượt mà, siêu tốc trên card đồ họa **NVIDIA GeForce GTX 1650 (4GB VRAM)** và CPU **AMD Ryzen 7 4800H (16GB RAM)**.
5. **Lưu trữ tập trung trên `D:\ollama`**: Giữ sạch ổ đĩa hệ thống `C:\`, lưu trữ toàn bộ phần mềm Ollama và trọng số mô hình lớn tại thư mục `D:\ollama`.

---

## 2. Ma Trận Tương Thích Phần Cứng (Hardware Compatibility Matrix)

| Thành phần | Cấu hình máy | Yêu cầu tài nguyên | Tình trạng tương thích |
| :--- | :--- | :--- | :--- |
| **GPU** | NVIDIA GeForce GTX 1650 (4GB VRAM) | Cần ~2.5GB cho `qwen3:4b` + 270MB cho `embeddinggemma-2:270m` | **100% Tương thích**: Tổng tải ~2.8GB VRAM < 4GB VRAM. Dư ~1.2GB VRAM cho hệ điều hành và render giao diện. |
| **CPU** | AMD Ryzen 7 4800H (8 nhân, 16 luồng) | Xử lý nạp vector, cosine similarity và prompt formatting | **Rất mạnh**: Đảm bảo thời gian tính toán vector < 10ms. |
| **RAM** | 16 GB DDR4 | Bộ nhớ đệm vector và runtime Node.js | **Dư dả**: Hệ thống RAG in-memory chỉ chiếm ~50MB RAM. |
| **Ổ đĩa** | Ổ `D:\ollama` | Trọng số mô hình ~3GB | **Tối ưu**: Toàn bộ nhị phân và weights nằm tại `D:\ollama\models`. |

---

## 3. Kiến Trúc Tổng Thể (System Architecture)

```
                            [GIAO DIỆN CHATBOT WIDGET]
                                       │
                                       ▼ (POST /api/ai/regulation-chat)
                            [aiController.regulationChat]
                                       │
                                       ▼
                             [aiProviderService.js]
               ┌───────────────────────┴───────────────────────┐
               │ AI_PROVIDER='ollama'                          │ AI_PROVIDER='gemini' / Fallback
               ▼                                               ▼
       [ollamaProvider.js]                            [geminiProvider.js]
               │                                               │
               ▼                                               ▼
         [ragService.js]                             [localFallbackProvider.js]
         (Bộ máy RAG Quy chế)
               ├─► 1. Gọi embeddinggemma-2:270m: Vector hóa câu hỏi (768 chiều)
               ├─► 2. Cosine Similarity Search: Tìm Top 3-5 đoạn quy chế phù hợp nhất
               └─► 3. liveContextService: Nạp dữ liệu sống (Học kỳ, Đề tài của SV, GVHD)
               │
               ▼
     [Prompt Assembly: Context + XML Data Boundary + Anti-Injection Guardrails]
               │
               ▼ (POST http://localhost:11434/api/chat)
        [qwen3:4b (Ollama)]
               │
               ▼
[Phản hồi JSON/Text chất lượng cao: Đúng quy chế, trích dẫn biểu mẫu, gợi ý câu hỏi tiếp theo]
```

---

## 4. Đặc Tả Chi Tiết Các Thành Phần

### 4.1. Thiết Lập Môi Trường Ollama Trên `D:\ollama`
- **Thư mục cài đặt**: `D:\ollama`
- **Thư mục lưu mô hình**: `D:\ollama\models`
- **Biến môi trường hệ thống**:
  * `OLLAMA_MODELS = D:\ollama\models`
  * Bổ sung `D:\ollama` vào biến `PATH`.
- **Cấu hình `.env` Backend**:
  ```env
  AI_PROVIDER=ollama
  OLLAMA_BASE_URL=http://localhost:11434
  OLLAMA_CHAT_MODEL=qwen3:4b
  OLLAMA_EMBED_MODEL=embeddinggemma-2:270m
  OLLAMA_TIMEOUT_MS=30000
  ```

### 4.2. Module `ollamaProvider.js`
Adapter giao tiếp với REST API gốc của Ollama không dùng thư viện ngoài (sử dụng native `fetch`):
- `isOllamaAvailable()`: Ping `GET http://localhost:11434/api/version` kiểm tra Ollama daemon đang chạy.
- `chatWithOllama({ messages, systemInstruction, model, temperature, signal })`:
  * Gọi `POST http://localhost:11434/api/chat` với body:
    ```json
    {
      "model": "qwen3:4b",
      "messages": [
        { "role": "system", "content": "..." },
        { "role": "user", "content": "..." }
      ],
      "stream": false,
      "options": {
        "temperature": 0.2,
        "num_ctx": 4096
      }
    }
    ```
- `generateEmbedding({ text, model })`:
  * Gọi `POST http://localhost:11434/api/embed` (hoặc `/api/embeddings`) với mô hình `embeddinggemma-2:270m`.
  * Trả về mảng số thực vector embedding.

### 4.3. Module `ragService.js` (Bộ Máy RAG Tri Thức Học Vụ)
- **Tài liệu nguồn**:
  * `backend/src/services/ai/knowledge/studentKnowledge.js`
  * `backend/src/services/ai/knowledge/lecturerKnowledge.js`
  * `backend/src/services/ai/knowledge/adminKnowledge.js`
- **Chiến lược Chunking**:
  * Tách theo tiêu đề mục `### Giai đoạn...`, `### Biểu mẫu...`, `### FAQ...` hoặc cửa sổ trượt 300 từ với 50 từ overlap.
  * Mỗi chunk có metadata: `{ id, stage, title, content, roleScope: 'STUDENT' | 'LECTURER' | 'ADMIN' }`.
- **Vector Index & Storage**:
  * Lưu trữ vector index sẵn sàng trong bộ nhớ (`knowledgeVectorIndex.json` hoặc in-memory array) được sinh ra từ lệnh seeder.
  * Khi khởi động ứng dụng: Nạp vector index vào RAM (~50MB).
- **Quy trình Truy vấn (Retrieval Flow)**:
  1. Lấy vai trò của người gọi (`user.role`). Lọc trước các chunks được phép truy cập theo RBAC (Sinh viên không bao giờ lấy được chunk của Giảng viên/Admin).
  2. Tạo vector cho câu hỏi người dùng qua `embeddinggemma-2:270m`.
  3. Tính Cosine Similarity giữa câu hỏi và danh sách chunk hợp lệ:
     $$\text{Cosine}(A, B) = \frac{A \cdot B}{\|A\| \|B\|}$$
  4. Lấy Top $K$ ($K=3 \div 5$) chunks có điểm tương đồng cao nhất (ngưỡng tối thiểu $\ge 0.35$).
  5. Ghép các đoạn quy chế này thành chuỗi ngữ cảnh RAG (`retrievedRegulationsText`).

### 4.4. Tích Hợp Live Context & Ghép Prompt Hoàn Chỉnh
Ngữ cảnh gửi cho `qwen3:4b` bao gồm 3 lớp:
1. **Lớp 1 (RAG Context)**: Các điều khoản quy chế thực tế vừa trích xuất từ `ragService`.
2. **Lớp 2 (Live Database Context)**: Dữ liệu thời gian thực từ `liveContextService` (Học kỳ hiện tại, Viện trưởng, Đề tài của chính sinh viên, GVHD).
3. **Lớp 3 (XML Boundary & Anti-Injection Guardrails)**: Câu hỏi được bọc trong `<user_query>\n...\n</user_query>` kèm chỉ thị từ chối bẻ khóa và ứng xử ngoài luồng ân cần (Graceful Chit-chat).

### 4.5. Cơ Chế Điều Phối Đa Nền Tảng (Hybrid AI Facade & Zero-Crash)
Trong `aiProviderService.js`:
```
Nếu AI_PROVIDER === 'ollama' && Ollama khả dụng:
    Thực hiện RAG + Chat với qwen3:4b (Ollama Local)
Ngược lại nếu có GEMINI_API_KEY:
    Fallback sang Gemini 3.8 Flash / Flash-Lite API
Ngược lại:
    Fallback sang Local Heuristic Provider
```
$\rightarrow$ **Cam kết Zero-Crash 100%**: Kể cả khi chưa khởi động Ollama, hệ thống vẫn tự động chuyển sang chế độ dự phòng mà không bao giờ báo lỗi sập ứng dụng.

---

## 5. Kế Hoạch Kiểm Thử (Testing Strategy)

1. **Unit Tests (`tests/unit/ollamaProvider.test.js`)**:
   - Kiểm tra `isOllamaAvailable` (mock fetch version 200 vs connection refused).
   - Kiểm tra `chatWithOllama` (gửi đúng messages, parse câu trả lời).
   - Kiểm tra `generateEmbedding` (trả về mảng vector số thực).
   - Kiểm tra timeout và xử lý lỗi mạng an toàn.
2. **Unit Tests (`tests/unit/ragService.test.js`)**:
   - Kiểm tra logic chunking tài liệu học vụ.
   - Kiểm tra lọc phân quyền RBAC (Role-based filtering).
   - Kiểm tra giải thuật Cosine Similarity và trích xuất Top-K.
3. **Integration Tests (`tests/integration/ollamaRagWorkflow.test.js`)**:
   - Kiểm tra toàn trình: Người dùng hỏi quy chế đồ án -> RAG trích xuất đúng điều khoản -> Gọi `chatWithOllama` -> Trả về câu trả lời chuẩn xác.
   - Kiểm tra cơ chế tự động chuyển đổi dự phòng khi Ollama offline.
4. **Hồi quy hệ thống**:
   - Đảm bảo toàn bộ 104 test suites backend (1.029 tests) và 187 frontend tests tiếp tục PASS 100%.
   - Xác thực UTF-8 (no BOM) trên toàn bộ tệp mới.
