# Kế hoạch phiên tiếp theo: vận hành Storage và rà soát học vụ

> **Dành cho model 3.8 Flash:** Đọc `AGENTS.md`, `CLAUDE.md` và tài liệu này trước khi sửa mã. Thực hiện từng task theo thứ tự, kiểm tra rồi báo cáo kết quả. Không tự đánh dấu hoàn thành task chưa được xác thực. Chỉ cập nhật mục `Session Update` trong `CLAUDE.md` khi người dùng nói `end phiên`.

**Mục tiêu:** Khóa các rủi ro còn lại trước khi vận hành Storage định kỳ; xác thực quy trình chấm BM05 và sửa báo cáo học vụ theo dữ liệu thật.

**Cách làm:** Sửa từ CSDL/Prisma (nếu cần) → backend/service/API → frontend. Ưu tiên chặn lệnh dọn dữ liệu thiếu snapshot trước khi cấu hình chạy tự động. Các thao tác trên production chỉ được thực hiện khi biết rõ môi trường, có snapshot và cửa sổ bảo trì.

**Nguồn yêu cầu:** `CLAUDE.md` → Session Update 17/11/2026, mục `Next Session Plan`; `docs/operations/supabase-storage-rollout.md`; quyết định BM04 định tính trong `CLAUDE.md`.

## Ràng buộc chung

- Giữ `TopicRegistration` làm kiến trúc đăng ký duy nhất; một sinh viên/đề tài (`maxStudents = 1`), tối đa 10 sinh viên/GVHD. Không khôi phục `group/groupMember`.
- Không thêm mock data khi đã có API. Nút Ant Design dùng `icon={<IconComponent />}` từ `@ant-design/icons`, nhãn tiếng Việt thuần, không emoji/ký tự biểu tượng thô.
- File `.md`, `.js`, `.jsx`, `.json`, `.prisma`, `.yml` phải là UTF-8 không BOM.
- Không ghi secret, URL có token, manifest chứa dữ liệu nhạy cảm hoặc thông tin snapshot vào Git.
- RBAC và Storage implementation plan hiện đã đánh dấu hoàn thành; không làm lại hai kế hoạch đó nếu không có lỗi cụ thể.

## P0 — Task 1: Chặn dọn legacy thiếu snapshot và báo lỗi một phần

**Tệp chính:** `backend/scripts/storage/cleanupLegacyAssets.js`, `backend/src/services/legacyStorageMigrationService.js`, `backend/tests/integration/legacyStorageCleanup.test.js`, `backend/tests/services/legacyStorageMigrationService.test.js`.

**Lỗi đã xác nhận:** CLI đang dùng `args.includes('--confirm-snapshot') || isApply`, khiến `--apply` tự xác nhận snapshot. Sau apply, CLI còn in `SUCCESS` kể cả khi `report.summary.failed > 0`.

- [ ] Viết test cho `--apply` thiếu `--confirm-snapshot`: phải dừng với exit code khác 0 **trước mọi ghi/xóa**. Test thêm trường hợp `failed > 0`: lệnh không được báo thành công hoặc trả exit code 0.
- [ ] Sửa CLI để chỉ nhận xác nhận snapshot từ cờ được truyền thật; xử lý kết quả một phần bằng lỗi rõ ràng và exit code khác 0. Giữ cơ chế chặn `UNRESOLVED` và kiểm tra manifest trong service.
- [ ] Chạy test trọng tâm và dry-run bằng manifest mới; ghi lại tổng `total/processed/succeeded/failed/skipped`, không đưa manifest vào repo.
- [ ] Chỉ chạy `node backend/scripts/storage/cleanupLegacyAssets.js --apply --confirm-snapshot --manifest <đường-dẫn>` khi snapshot **đã thực sự được tạo và kiểm tra khả năng khôi phục**, manifest hiện hành có `UNRESOLVED = 0`, và đang trong cửa sổ bảo trì. Nếu thiếu bất kỳ điều kiện nào, dừng ở dry-run và báo điều kiện còn thiếu; không tự suy diễn từ việc cờ CLI tồn tại.

**Kiểm tra:** `npm --prefix backend test -- --runTestsByPath tests/integration/legacyStorageCleanup.test.js tests/services/legacyStorageMigrationService.test.js`.

## P0 — Task 2: Lập lịch hai Storage worker trên môi trường thực tế

**Tệp tham chiếu:** `backend/package.json`, `backend/scripts/storage/runAssetCleanup.js`, `backend/scripts/storage/reconcileAssets.js`, `docs/operations/supabase-storage-rollout.md`.

- [ ] Xác định nơi backend đang chạy và cơ chế scheduler thật (host cron, platform scheduled job, hoặc dịch vụ tương đương). Không tạo cấu hình cho một nền tảng chưa được dùng.
- [ ] Kiểm tra quyền truy cập secret/DB/Storage và chạy mỗi worker ở `--dry-run`; xác nhận lệnh thoát thành công, log có số liệu, và không phát sinh ghi dữ liệu.
- [ ] Cấu hình cleanup mỗi giờ (`0 * * * *`): `npm --prefix backend run storage:cleanup -- --apply`. Cấu hình reconcile mỗi ngày lúc **02:00 Asia/Ho_Chi_Minh**: `npm --prefix backend run storage:reconcile -- --apply`; chuyển đổi múi giờ nếu scheduler dùng UTC.
- [ ] Bảo đảm mỗi job có cảnh báo khi exit code khác 0, tránh chạy trùng và lưu log đủ để đối chiếu. Chạy thử một lượt theo đúng cấu hình, xem kết quả DB/Storage rồi ghi cách vận hành vào `docs/operations/supabase-storage-rollout.md`.

**Điều kiện dừng:** Nếu chưa biết platform hoặc chưa có quyền cấu hình scheduler, hoàn thành dry-run và tài liệu cấu hình cụ thể, báo chính xác thông tin/quyền còn thiếu; không khẳng định cron đã chạy production.

## P1 — Task 3: Rà soát BM05 và khóa sổ điểm

**Tệp chính:** `backend/src/services/defenseScoringService.js`, `backend/src/controllers/evaluationController.js`, `backend/src/routes/evaluationRoutes.js`, `frontend/src/pages/lecturer/LecturerGradingSheetPage.jsx`, `frontend/src/pages/admin/GradingDefensePage.jsx`, `frontend/src/services/evaluationService.js`.

- [ ] Đối chiếu schema → backend → frontend cho ba phiếu BM05 độc lập của Chủ tịch, Thư ký, Phản biện; kiểm tra chỉ thành viên có quyền được nhập/chỉnh phiếu thuộc hội đồng mình.
- [ ] Kiểm tra khóa từng phiếu, khóa sổ hai bước, điều kiện mở khóa, tính điểm hội đồng và thời điểm công bố. Trước công bố, sinh viên không được nhận điểm/nhận xét qua bất kỳ API hoặc dashboard nào.
- [ ] Bổ sung test cho bất kỳ lỗ hổng thực tế nào rồi sửa đúng tầng gốc. Không đổi quy chế tính điểm chỉ để làm test pass. Nếu không thấy lỗi, ghi bằng chứng test và không sửa mã.

**Kiểm tra:** Chạy test BM05/lifecycle và ma trận phân quyền liên quan trong `backend/tests/integration/fullLifecycle.test.js`, `backend/tests/integration/fivePersonaAuthorizationMatrix.test.js`; kiểm tra UI tương ứng khi có thay đổi frontend.

## P1 — Task 4: Sửa Academic Reports và xuất Excel

**Tệp chính:** `backend/src/controllers/reportController.js`, `backend/src/routes/reportRoutes.js`, `frontend/src/pages/admin/AcademicReportsPage.jsx`, `frontend/src/services/reportService.js`, `backend/tests/integration/academicReports.test.js`, `frontend/src/pages/__tests__/academicReportsPage.test.js`.

**Sai lệch đã xác nhận:** `reportController.js` vẫn đọc `getMentorScore(reg)` từ BM04, dùng làm fallback cho `Điểm Tổng kết`, và xuất cột `Điểm Quá trình (BM04)`. `CLAUDE.md` quy định BM04 là nhận xét **định tính**; điểm thang 10 chỉ do ba thành viên hội đồng chấm BM05 độc lập.

- [ ] Viết test cho đăng ký có BM04 nhưng chưa có điểm hội đồng/công bố: báo cáo và Excel không được tạo điểm tổng kết từ BM04, không xuất điểm BM04 định lượng. Kiểm tra cả API overview/workload và `GET /api/reports/export-excel`.
- [ ] Sửa backend để điểm/xếp loại dùng nguồn BM05 chính thức theo quy tắc công bố hiện hành; giữ BM04 là trạng thái/nhận xét định tính nếu báo cáo cần hiển thị. Không làm lộ điểm chưa công bố.
- [ ] Cập nhật UI/nhãn cột nếu hợp đồng API đổi; dùng dữ liệu API thật. Chạy test backend/frontend trọng tâm, lint và build khi có sửa frontend.

**Kiểm tra:** `npm --prefix backend test -- --runTestsByPath tests/integration/academicReports.test.js`; chạy lệnh test frontend hiện có cho `academicReportsPage.test.js` theo script của `frontend/package.json`.

## Báo cáo bàn giao

Sau mỗi task, báo ngắn: việc đã làm, tệp đã sửa, lệnh kiểm tra và kết quả Pass/Fail, commit tương ứng, cùng điều kiện production còn thiếu. Kết thúc bằng `git status --short` và danh sách task còn mở. Không cập nhật `CLAUDE.md` trước lệnh `end phiên`.
