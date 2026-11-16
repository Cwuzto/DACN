# Thiết Kế Quy Hoạch và Quản Trị Supabase Storage

**Ngày:** 17/11/2026

**Trạng thái:** Đã được người dùng duyệt ngày 17/11/2026; cập nhật giới hạn upload theo quyết định cùng ngày

## 1. Bối cảnh

Hệ thống hiện sử dụng một bucket Supabase Storage chung có tên mặc định `dacn`. Helper upload tự tạo hoặc chuyển bucket thành public, sau đó trả public URL để các bảng nghiệp vụ lưu trực tiếp. Object path được quyết định một phần bởi chuỗi `folder` do frontend gửi.

Audit xác nhận các vấn đề chính:

1. Hồ sơ BM01–BM04, phiếu chấm, source code và lưu chiểu có thể nằm chung bucket public với nội dung Portal.
2. CSDL chủ yếu lưu URL, không có registry object canonical để quản lý owner, bucket, object key, checksum, phiên bản hoặc lifecycle.
3. Nhiều luồng nhận URL tùy ý thay vì một asset đã được backend xác thực và gắn với đúng hồ sơ.
4. Frontend và backend không thống nhất loại file hoặc giới hạn dung lượng; video/PPTX được UI chấp nhận nhưng generic upload backend từ chối.
5. Thay thế/xóa bản ghi nghiệp vụ không xóa hoặc quản lý object tương ứng, tạo file mồ côi.
6. Một số PDF hệ thống sinh trả URL giả khi upload thất bại.
7. Logo/background bị hard-code bằng public URL; các tài liệu legacy tồn tại dưới nhiều dạng URL khác nhau.
8. Supabase service-role key và credential có nguy cơ từng tồn tại dưới dạng plaintext trong môi trường local và cần được luân chuyển trước rollout.

Thiết kế này thay thế cơ chế lưu URL rời rạc bằng bốn bucket theo ranh giới truy cập và registry `StoredAsset` dùng chung.

## 2. Mục tiêu

1. Quy hoạch bucket và object path bằng tên tiếng Việt không dấu, nhất quán và dễ truy vết.
2. Tách tuyệt đối tài nguyên công khai, tài liệu học vụ, dữ liệu cá nhân và file tạm.
3. Lưu đầy đủ metadata, quyền sở hữu, liên kết nghiệp vụ, checksum và phiên bản trong CSDL.
4. Không lưu public URL cho tài liệu private; download phải đi qua authorization và signed URL ngắn hạn.
5. Backend tự quyết định bucket/path theo loại tài liệu và resource; frontend không gửi folder tùy ý.
6. Quản lý upload, thay thế, phiên bản, soft-delete, retention và dọn orphan theo lifecycle rõ ràng.
7. Xóa dữ liệu file legacy không cần thiết, chỉ giữ logo/background và các external URL hợp lệ.
8. Giữ nguyên mô hình nghiệp vụ `TopicRegistration` và các quy tắc học vụ hiện có.

## 3. Phi mục tiêu

- Không lưu video demo trong Supabase Storage.
- Không cung cấp trình quản lý file tổng quát kiểu drive cho người dùng.
- Không cho phép frontend duyệt bucket hoặc đặt object path.
- Không giữ lại các file học vụ/URL legacy hiện có ngoài logo và background.
- Không chuyển link GitHub/YouTube thành object Storage.
- Không khôi phục kiến trúc `group/groupMember`.
- Không dùng tên người, email, ngày sinh hoặc dữ liệu nhạy cảm trong object path.

## 4. Các phương án đã cân nhắc

### 4.1. Một bucket, chia thư mục

Đơn giản nhưng khó bảo đảm public/private, dễ nới policy quá rộng và lặp lại rủi ro hiện tại. Không được chọn.

### 4.2. Bốn bucket theo ranh giới tin cậy — được chọn

- `cong-khai`
- `hoc-vu`
- `ca-nhan`
- `tam`

Phương án này đủ cách ly theo nhu cầu bảo mật nhưng không tạo quá nhiều bucket/module-specific cần vận hành riêng.

### 4.3. Nhiều bucket theo từng module

Cách ly mạnh nhưng tăng số policy, migration, backup và điểm cấu hình. Dễ tạo hành vi không đồng nhất giữa BM01–BM05 và lưu chiểu. Không được chọn.

### 4.4. Cách lưu metadata

Ba lựa chọn đã được cân nhắc:

1. tiếp tục lưu URL ở từng bảng;
2. tạo registry `StoredAsset` dùng chung;
3. dùng metadata Supabase Storage làm nguồn chính.

Chọn `StoredAsset` vì cần liên kết chặt với `TopicRegistration`, truy vấn nghiệp vụ, versioning, audit và garbage collection.

## 5. Quy ước đặt tên

### 5.1. Bucket

Bucket dùng chữ thường, tiếng Việt không dấu, không có tiền tố `dacn`:

- `cong-khai`
- `hoc-vu`
- `ca-nhan`
- `tam`

### 5.2. Path segment

Mọi segment:

- chuyển Unicode về dạng chuẩn trước khi transliterate;
- bỏ dấu tiếng Việt, chuyển `đ` thành `d`;
- dùng chữ thường;
- dùng `kebab-case`;
- chỉ cho phép `[a-z0-9-]` với segment mô tả;
- segment định danh có thể dùng số hoặc mã đã sanitize;
- không chứa `..`, slash, backslash, control character hoặc segment rỗng;
- có độ dài tối đa được kiểm soát.

Các segment định danh ổn định được ưu tiên trước phần mô tả, ví dụ `dang-ky-842`, `hoi-dong-17`, `phien-ban-02`.

### 5.3. Object filename

Tên object:

```text
{uuid-v4}-{ten-mo-ta-khong-dau}.{extension-canonical}
```

UUID chống trùng và giảm khả năng đoán object key. Tên mô tả giúp vận hành thủ công khi cần. Object đã ghi không được overwrite (`upsert: false`).

Tên file gốc Unicode được lưu riêng trong CSDL và được dùng cho `Content-Disposition` khi download; không dùng trực tiếp làm object key.

## 6. Quy hoạch bucket

### 6.1. `cong-khai`

Bucket public chỉ chứa tài nguyên đã được phê duyệt công bố:

```text
thuong-hieu/
├── logo/{uuid}-logo-vien-cong-nghe-so.png
└── background/{uuid}-anh-nen-cong-thong-tin.webp

thong-bao-da-cong-bo/
└── nam-{yyyy}/thong-bao-{announcementId}/{uuid}-{ten-tai-lieu}.pdf

bieu-mau-da-cong-bo/
└── {ma-bieu-mau}/phien-ban-{nn}/{uuid}-{ten-bieu-mau}.{pdf|docx|xlsx}

lich-da-cong-bo/
└── dot-{ma-dot}/hoi-dong-{councilId}/{uuid}-lich-bao-ve.pdf
```

Draft Portal không được upload trực tiếp vào `cong-khai`. Draft ở `tam` hoặc vùng private, sau đó chỉ được promote/copy sang `cong-khai` trong transaction công bố.

### 6.2. `hoc-vu`

Bucket private cho toàn bộ tài liệu nghiệp vụ:

```text
nam-hoc-{yyyy-yyyy}/hoc-ky-{n}/{dacn|datn}/dot-{ma-dot}/
├── dang-ky-{registrationId}/
│   ├── bm01/phien-ban-{nn}/{uuid}-de-cuong-do-an.{pdf|docx}
│   ├── bm02/phien-ban-{nn}/{uuid}-don-dang-ky-de-tai.pdf
│   ├── bm02a/phien-ban-{nn}/{uuid}-don-dieu-chinh-ten-de-tai.pdf
│   ├── bm03/phien-ban-{nn}/{uuid}-so-theo-doi-tien-do.pdf
│   ├── checkpoint-{n}/minh-chung/{uuid}-minh-chung.{pdf|jpg|png}
│   ├── bm04/phien-ban-{nn}/{uuid}-phieu-nhan-xet.pdf
│   ├── bm05/hoi-dong-{councilId}/thanh-vien-{memberId}/{uuid}-phieu-cham-diem.pdf
│   ├── luu-chieu/
│   │   ├── bao-cao-word/phien-ban-{nn}/{uuid}-bao-cao-hoan-chinh.docx
│   │   ├── bao-cao-pdf/phien-ban-{nn}/{uuid}-bao-cao-hoan-chinh.pdf
│   │   ├── slide/phien-ban-{nn}/{uuid}-slide-bao-ve.{pptx|pdf}
│   │   └── source-code/phien-ban-{nn}/{uuid}-ma-nguon.zip
│   └── chung-nhan/{uuid}-xac-nhan-hoan-thanh.pdf
├── quyet-dinh/quyet-dinh-{decisionId}/phien-ban-{nn}/{uuid}-quyet-dinh-giao-de-tai.pdf
├── phu-luc/phu-luc-{appendixId}/phien-ban-{nn}/{uuid}-phu-luc-dieu-chinh.pdf
└── hoi-dong/hoi-dong-{councilId}/{lich|bien-ban|bang-diem}/phien-ban-{nn}/{uuid}-tai-lieu.pdf
```

Path không chứa mã sinh viên hoặc họ tên. Quan hệ tới sinh viên, đề tài, học kỳ và loại đồ án nằm trong `StoredAsset` và các FK nghiệp vụ.

### 6.3. `ca-nhan`

Bucket private cho tài nguyên cá nhân:

```text
nguoi-dung-{userId}/
└── anh-dai-dien/
    ├── hien-tai/{uuid}-anh-dai-dien.webp
    └── da-thay-the/{uuid}-anh-dai-dien-cu.webp
```

Avatar cũ giữ 7 ngày trước khi xóa vật lý. Thiết kế không mở rộng thành kho tài liệu cá nhân tổng quát trong giai đoạn này.

### 6.4. `tam`

Bucket private chỉ service role được đọc:

```text
cho-kiem-tra/ngay-{yyyy-mm-dd}/phien-{uploadSessionId}/...
bi-tu-choi/ngay-{yyyy-mm-dd}/phien-{uploadSessionId}/...
cho-gan-ho-so/ngay-{yyyy-mm-dd}/phien-{uploadSessionId}/...
mo-coi/ngay-{yyyy-mm-dd}/{objectKeyHash}/...
```

TTL:

| Khu vực | TTL |
|---|---:|
| Chờ kiểm tra | 24 giờ |
| Bị từ chối | 7 ngày |
| Chờ gắn hồ sơ | 24 giờ |
| Mồ côi | 30 ngày |

## 7. Mô hình dữ liệu `StoredAsset`

`StoredAsset` là registry canonical cho object Storage. Các trường đề xuất:

| Nhóm | Trường |
|---|---|
| Định danh | `id`, `provider`, `bucket`, `objectKey` unique |
| Tên file | `originalName`, `normalizedName`, `extension` |
| Nội dung | `declaredMime`, `detectedMime`, `sizeBytes`, `sha256` |
| Sở hữu | `ownerUserId`, `uploadedById` |
| Nghiệp vụ | `registrationId`, `semesterId`, `projectCatalogId`, `documentType`, `version` |
| Truy cập | `visibility`, `accessPolicy` |
| Kiểm tra | `scanStatus`, `scanMessage`, `verifiedAt` |
| Lifecycle | `status`, `retentionUntil`, `replacedById`, `deletedAt`, `createdAt`, `updatedAt` |

Các enum chính:

- `StorageBucket`: `CONG_KHAI`, `HOC_VU`, `CA_NHAN`, `TAM`.
- `AssetVisibility`: `PUBLIC`, `PRIVATE`.
- `AssetScanStatus`: `PENDING`, `PASSED`, `REJECTED`, `FAILED`.
- `AssetStatus`: `STAGED`, `ACTIVE`, `REPLACED`, `SOFT_DELETED`, `ORPHANED`, `PURGED`.

`documentType` dùng enum/catalog có kiểm soát, bao gồm BM01, BM02, BM02-A, BM03, checkpoint evidence, BM04, BM05, quyết định, phụ lục, tài liệu hội đồng, các loại lưu chiểu, avatar và tài nguyên Portal.

Không lưu signed URL. URL public có thể được suy ra từ bucket/object key; signed URL private chỉ được tạo theo request.

## 8. Liên kết nghiệp vụ

- Các bảng submission/version tham chiếu `assetId` thay cho nhận URL tùy ý.
- Tài liệu nhiều phiên bản giữ từng `StoredAsset` bất biến và có version row riêng.
- `DefenseDocumentVersion` được bổ sung relation tới `StoredAsset`; metadata trùng lặp được loại bỏ dần sau compatibility window.
- Các file system-generated BM02-A/BM03/BM04/BM05/chứng nhận cũng phải tạo `StoredAsset` và hash từ bytes thực.
- Video demo dùng `externalUrl` HTTPS đã validate, không có `assetId`.
- GitHub/source repository link là `externalUrl`; source ZIP nộp lưu chiểu là `StoredAsset` riêng.
- Portal revision chỉ tham chiếu asset draft; publish tạo/promote asset public và snapshot relation.

Trong giai đoạn chuyển đổi, trường URL cũ có thể tồn tại nullable để rollback nhưng code mới không được ghi vào đó.

## 9. Upload pipeline

### 9.1. Request contract

Frontend gửi multipart gồm:

- file;
- `documentType`;
- ID tài nguyên nghiệp vụ cần thiết, ví dụ `registrationId`, `taskId`, `announcementId`;
- idempotency key/upload session ID.

Frontend không gửi bucket, folder, object key hoặc public URL.

### 9.2. Các bước xử lý

1. Xác thực và authorize capability.
2. Load resource từ CSDL và kiểm ownership/GVHD/hội đồng/đơn vị/học kỳ.
3. Chọn policy theo `documentType`.
4. Nhận multipart upload qua backend và ghi theo luồng vào vùng tạm; không giữ toàn bộ file trong RAM.
5. Kiểm extension, declared MIME, magic bytes, kích thước và cấu trúc container.
6. Tính SHA-256 từ bytes.
7. Quét nội dung/malware theo capability hạ tầng; trạng thái phải được lưu ngay cả khi scanner tạm lỗi.
8. Tạo object path đích bằng builder phía server.
9. Copy/move sang bucket đích với `upsert: false`.
10. Transaction ghi `StoredAsset` và gắn vào entity nghiệp vụ.
11. Xóa object staging hoặc chuyển sang hàng đợi cleanup.

Nếu Storage thành công nhưng DB thất bại, object được ghi vào outbox/orphan queue để cleanup; không trả URL giả và không đánh dấu workflow hoàn tất.

## 10. Policy loại file và dung lượng

| Loại | Định dạng | Tối đa |
|---|---|---:|
| Avatar | JPG, PNG, WEBP | 5 MB |
| Portal image | JPG, PNG, WEBP | 10 MB |
| Portal document/template | PDF, DOC, DOCX, XLS, XLSX | 20 MB |
| BM01/BM02/minh chứng | PDF, DOC, DOCX, JPG, PNG theo document type | 20 MB |
| PDF hệ thống sinh | PDF | 20 MB |
| Báo cáo lưu chiểu | DOCX, PDF | 50 MB |
| Slide | PPTX, PDF | 50 MB |
| Source code | ZIP | 50 MB |
| Video demo | Không upload; HTTPS external URL | Không áp dụng |

Không chấp nhận RAR, executable, file Office macro-enabled hoặc archive có cấu trúc nguy hiểm. DOCX/PPTX/XLSX phải được kiểm tra là ZIP container đúng cấu trúc và có giới hạn chống zip bomb.

Giai đoạn này không triển khai TUS/resumable upload. Tất cả loại file đều có trần tuyệt đối 50 MB; nếu tương lai cần file lớn hơn phải có một thiết kế bổ sung riêng.

## 11. Download và authorization

### 11.1. Public

`cong-khai` dùng public URL ổn định và CDN cache. Chỉ asset trạng thái `ACTIVE`, `PUBLIC` và đã publish mới được đặt trong bucket này.

### 11.2. Private

Client gọi download endpoint bằng `assetId`. Backend:

1. load `StoredAsset` và resource liên quan;
2. kiểm asset `ACTIVE` và chưa hết retention;
3. kiểm capability + resource scope;
4. tạo signed URL 10 phút;
5. ghi audit tải xuống;
6. trả URL và expiry.

Signed URL/token không được ghi vào audit hoặc CSDL.

`tam` không cấp signed URL cho end user.

## 12. Phiên bản, thay thế và xóa

- BM01–BM05, quyết định, phụ lục, hội đồng và lưu chiểu là tài liệu bất biến theo phiên bản.
- Phiên bản mới không overwrite object cũ.
- Avatar, logo và background được phép thay thế; asset cũ chuyển `REPLACED` và có `retentionUntil`.
- Avatar cũ giữ 7 ngày.
- Logo/background cũ giữ tối thiểu 7 ngày sau khi URL mới được xác minh.
- Xóa nghiệp vụ trước hết là soft-delete và audit.
- Worker dọn vật lý chỉ xóa object khi hết retention và không còn relation active.
- Job reconciliation định kỳ so sánh DB registry với Storage để phát hiện missing object và orphan object.

## 13. Migration dữ liệu legacy

Người dùng đã quyết định không giữ file/URL legacy ngoài background và logo.

### 13.1. Nguyên tắc an toàn

- Script mặc định chạy `--dry-run`.
- `--apply` yêu cầu xác nhận môi trường, snapshot CSDL và manifest đã được lưu.
- Không xóa dựa trên URL/parsing chưa xác minh.
- Mọi action có audit manifest: object cũ, DB field, action, lý do và kết quả.

### 13.2. Trình tự

1. Rotate Supabase service-role key và credential liên quan.
2. Inventory bucket/object và toàn bộ trường URL/file metadata trong DB.
3. Phân loại: branding giữ lại, Supabase legacy xóa, `/uploads/` legacy xóa/null, external URL giữ lại, unresolved cần review.
4. Copy logo/background sang `cong-khai/thuong-hieu` với tên mới.
5. Tính checksum và xác minh URL mới.
6. Cập nhật cấu hình Portal/CSS/component dùng asset mới.
7. Làm sạch các trường file URL legacy trong DB; giữ GitHub/YouTube HTTPS hợp lệ.
8. Xóa object Storage legacy còn lại theo manifest.
9. Đối soát không còn URL private/public cũ ngoài allowlist.

Migration không tạo dữ liệu giả thay thế cho các file đã xóa.

## 14. Error contract

Các lỗi có code ổn định:

- `ASSET_POLICY_NOT_FOUND`
- `ASSET_TYPE_NOT_ALLOWED`
- `ASSET_SIZE_EXCEEDED`
- `ASSET_CONTENT_MISMATCH`
- `ASSET_ARCHIVE_UNSAFE`
- `ASSET_SCAN_REJECTED`
- `ASSET_SCAN_UNAVAILABLE`
- `ASSET_SCOPE_FORBIDDEN`
- `ASSET_NOT_READY`
- `ASSET_NOT_FOUND`
- `ASSET_DELETED`
- `ASSET_UPLOAD_DUPLICATE`
- `STORAGE_TEMPORARILY_UNAVAILABLE`

Lỗi validation trả `400`/`422`; thiếu quyền trả `403`; không tồn tại trả `404`; duplicate/idempotency conflict trả `409`; hạ tầng Storage/scanner tạm lỗi trả `503` và không hoàn tất workflow.

## 15. Security và vận hành

- Service-role key chỉ tồn tại ở backend secret manager.
- Không dùng service-role key tại frontend.
- Không tự create/update bucket privacy trong request path.
- Bucket/policy được quản lý bằng deployment script có thể kiểm chứng.
- Object key không chứa PII.
- Rate limit upload, download-sign và retry.
- Audit upload, promote, bind, replace, soft-delete, purge và private download.
- Metrics: upload success/failure, scan latency, orphan count, signed URL issuance, cleanup backlog, storage usage theo bucket/document type.
- Alert khi asset registry trỏ tới object thiếu hoặc bucket private bị đổi policy.

## 16. Kiểm thử và tiêu chí nghiệm thu

### 16.1. Unit/contract

- Transliteration tiếng Việt, NFC/NFD và path traversal.
- Path builder cho mọi `documentType`.
- Policy loại file/kích thước.
- MIME + magic bytes + container validation.
- SHA-256 từ bytes.
- Idempotency và version allocator.
- Không có consumer mới ghi `fileUrl` trực tiếp.

### 16.2. Integration

- Upload hợp lệ tạo đúng object và `StoredAsset`.
- Sai owner/resource/semester/council bị `403`.
- DB rollback tạo cleanup record, không tạo URL giả.
- Signed URL chỉ cấp cho actor hợp lệ và hết hạn sau 10 phút.
- Public draft không xuất hiện trong `cong-khai` trước publish.
- Soft-delete/retention/purge đúng lifecycle.
- Reconciliation phát hiện missing và orphan object.

### 16.3. Migration

- Dry-run không thay đổi DB/Storage.
- Branding được copy và checksum khớp.
- External GitHub/YouTube được giữ.
- Các URL file legacy khác được null/xóa theo manifest.
- Apply có thể resume an toàn sau lỗi và không xóa lặp ngoài manifest.

### 16.4. E2E

- Sinh viên chỉ upload/download hồ sơ của mình.
- GVHD chỉ truy cập sinh viên đang hướng dẫn.
- Thành viên hội đồng chỉ truy cập hồ sơ được phân công; BM05 độc lập không bị lộ.
- Giáo vụ/Viện trưởng truy cập đúng capability và scope.
- Portal visitor chỉ xem asset đã công bố.
- Avatar thay thế và rollback trong retention hoạt động.

## 17. Thứ tự triển khai

Theo nguyên tắc sửa gốc trước:

1. Rotate secret và audit hạ tầng.
2. Prisma schema/migration cho `StoredAsset`, lifecycle và relation.
3. Bucket provisioning/policy.
4. Naming/path builder và asset policy catalog.
5. Upload staging/validation/hash/scan pipeline.
6. Binding và versioning theo domain.
7. Private download/signed URL/audit.
8. Frontend chuyển từ URL/folder sang asset contract.
9. Legacy cleanup migration.
10. Reconciliation/retention worker.
11. Full test, E2E và rollout verification.

## 18. Quyết định đã chốt

1. Dùng bốn bucket `cong-khai`, `hoc-vu`, `ca-nhan`, `tam`.
2. Không có tiền tố `dacn` trong bucket.
3. Path dùng tiếng Việt không dấu, chữ thường, kebab-case.
4. Dùng `StoredAsset` làm registry canonical.
5. Tài liệu học vụ bất biến theo phiên bản.
6. Avatar, logo, background cho phép thay thế và giữ bản cũ 7 ngày.
7. Private signed URL có hạn 10 phút.
8. `tam` không phát URL cho end user.
9. Mọi upload tối đa 50 MB, bao gồm source ZIP và slide; không lưu video demo.
10. Xóa file/URL legacy, chỉ giữ và chuyển logo/background; giữ external GitHub/YouTube.
