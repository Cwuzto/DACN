# Kế hoạch triển khai: Phê duyệt kết quả bảo vệ và công bố theo đợt

**Đặc tả nguồn:** `docs/superpowers/specs/2026-10-29-defense-result-approval-publication-design.md`
**Mục tiêu:** triển khai approval theo từng `TopicRegistration` và publication snapshot bất biến theo `Semester`, giữ nguyên mô hình một sinh viên/một đề tài.

## Phạm vi thay đổi

| Lớp | File/khu vực chính | Kết quả |
| --- | --- | --- |
| Prisma | `backend/prisma/schema.prisma`, migration mới | enum trạng thái, approval history, publication snapshot, index/foreign key |
| Authorization | `backend/src/constants/permissions.js`, migration permission | `DEFENSE_RESULT_APPROVE` độc lập; mapping explicit, không Admin bypass |
| Domain | `backend/src/services/defenseScoringService.js`, service mới | khóa điểm chuyển sang chờ approval; approval/publication có transaction serializable |
| API | `evaluationRoutes.js`, controller/service mới | approve, preview, create/list publication, read result sở hữu |
| Frontend | `GradingDefensePage.jsx`, `evaluationService.js`, `GradeViewPage.jsx` | phê duyệt từng hồ sơ, preview/công bố/lịch sử, kết quả snapshot cho sinh viên |
| Tests | integration/service/frontend | invariant INV-28 đến INV-36 và regression |

## 1. Mở rộng schema và migration additive

1. Bổ sung `AWAITING_SCORES`, `AWAITING_FINAL_APPROVAL`, `DEFENSE_PASSED`, `DEFENSE_FAILED` vào `RegistrationStatus` theo state flow đã duyệt. Các consumer status hiện hữu chỉ coi `COMPLETED` là hoàn tất lưu chiểu; `DEFENSE_FAILED` không được chuyển sang `COMPLETED`.
2. Tạo enum `DefenseApprovalOutcome` (`PASSED`, `FAILED`) và `ResultPublicationType` (`INITIAL`, `SUPPLEMENTARY`, `CORRECTION`).
3. Tạo `DefenseResultApproval` lịch sử bất biến: registration, outcome/score snapshot, approval actor/time, policy version, defense council/score result identity, rubric/score-set fingerprint, reason/notes, `supersedesApprovalId`, `isEffective`, timestamps.
4. Tạo `ResultPublication`: semester, type, predecessor nullable, reason, publisher/time, idempotency key và item relation. Tạo `ResultPublicationItem`: publication, registration, source approval, predecessor item nullable, outcome/score/student-code/student-name/topic-title snapshots.
5. Thêm Prisma relations vào `TopicRegistration`, `Semester`, `User`, `Council`, `DefenseResult` và self relations approval/publication/item; dùng `onDelete: Restrict` cho audit/snapshot data.
6. Thêm unique/index: một item per registration/publication; idempotency per actor/học kỳ; index lịch sử registration/effective approval/publication scope. Unique partial cho “một approval active” sẽ được bảo vệ qua transaction và PostgreSQL partial index SQL trong migration nếu Prisma không biểu diễn được.
7. Viết migration SQL additive: enum alter, table/FK/index/partial unique, upsert `DEFENSE_RESULT_APPROVE`, mapping chỉ định rõ group nghiệp vụ được duyệt. Không cấp implicit cho mọi tài khoản `ADMIN`.

## 2. Chuẩn hóa state transition và score evidence

1. Sửa `lockDefenseScores` trong `defenseScoringService`: khi lock thành công, xác nhận đủ toàn bộ council members và valid scores, chốt aggregate, khóa score rows/result, rồi chuyển `DEFENSE_READY`/trạng thái hợp lệ sang `AWAITING_FINAL_APPROVAL` thay vì `DEFENDED`.
2. Update transition policy/state consumers (`registrationTransitionService`, workflow action/task/archive/status labels) cho các trạng thái mới. Không để archive workflow approve một `DEFENSE_FAILED` thành `COMPLETED`.
3. Tạo hàm service chung nạp “defense evidence” trong transaction: registration+semester+policy+effective defense council, members, locked member scores và locked `DefenseResult`. Hàm yêu cầu đúng ba thành viên/ba phiếu hợp lệ theo council, score result khóa, điểm finite và policy version khớp.
4. Sinh fingerprint deterministic của score set (council id, rubric version, điểm/member locks, aggregate, locked timestamps) và lưu tại approval. Mở khóa/đổi điểm/đổi council/policy làm approval liên quan không còn đủ điều kiện publication.

## 3. Domain service approval và publication

1. Tạo `backend/src/services/defenseResultPublicationService.js` với boundary duy nhất được phép ghi approval/publication snapshot.
2. `approveDefenseResult`: transaction Serializable; load/lock registration evidence, assert status `AWAITING_FINAL_APPROVAL`, capability scope do caller truyền đã xác minh, validate outcome/reason, vô hiệu hóa approval active chỉ khi correction workflow hợp lệ, tạo immutable approval, transition registration sang `DEFENSE_PASSED` hoặc `DEFENSE_FAILED`, ghi audit trong cùng transaction.
3. `previewPublication`: read-only, lấy approval active hợp lệ đúng semester; trả eligible/excluded cùng reason do server tính.
4. `createPublication`: transaction Serializable; kiểm tra idempotency record trước; resolve source approvals server-side; enforce scope rules theo lịch sử publication:
   - `INITIAL`: registration chưa xuất hiện trong bất kỳ initial scope;
   - `SUPPLEMENTARY`: chỉ approval active chưa từng được snapshot;
   - `CORRECTION`: có predecessor publication/item của cùng registration, approval mới hợp lệ và reason bắt buộc.
5. Tạo publication và toàn bộ immutable item trong cùng transaction; lỗi ở bất kỳ item nào rollback header/item. Trả publication cũ khi retry cùng idempotency key.
6. Không export update/delete service/route cho snapshot. Ghi audit `DEFENSE_RESULT_APPROVED`, `RESULT_PUBLICATION_CREATED`, `RESULT_PUBLICATION_CORRECTED` với chain IDs và request IP.

## 4. Routes, validators và controller

1. Bổ sung `PERMISSIONS.DEFENSE_RESULT_APPROVE`; route approval có `authorizePermission`, validator outcome/reason/notes, controller mỏng gọi domain service.
2. Thêm `GET /api/evaluations/admin-defense-center/:id/result-approval` và `POST /api/evaluations/admin-defense-center/:id/result-approval`; read/approve guards tách đúng `DEFENSE_SCORE_VIEW` / `DEFENSE_RESULT_APPROVE`.
3. Thêm `GET /api/semesters/:semesterId/result-publications/preview`, `GET /api/semesters/:semesterId/result-publications`, `POST /api/semesters/:semesterId/result-publications`, tất cả staff endpoint cần `RESULT_PUBLISH`; POST bắt buộc `Idempotency-Key` và validators type/reason/predecessor IDs.
4. Thêm endpoint self-service `GET /api/evaluations/my-published-result`; `authorize('STUDENT')`, ownership server-side, chỉ trả item snapshot published của chính registration.
5. Thống nhất error mapping: `401` auth, `403` capability/scope, `404` resource, `400` validation/state, `409` idempotency/scope/concurrent conflict. Không nhận final score, result hay approval IDs tin cậy từ UI ngoài lineage IDs dùng cho correction.

## 5. Frontend bám API thật

1. Mở rộng `evaluationService` bằng approve/get-approval, preview/list/create publication và get-my-published-result; POST generate một idempotency key và giữ nó khi retry cùng thao tác.
2. Cập nhật `GradingDefensePage`: render state mới, CTA approve chỉ với `DEFENSE_RESULT_APPROVE`, modal hiển thị evidence do API trả về và bắt buộc reason khi workflow correction yêu cầu.
3. Thêm publication panel theo semester cho `RESULT_PUBLISH`: preview server-side, loại publication, predecessor/rationale, confirmation counts, history read-only. Disable/hide actions theo capability; API response là nguồn toast thành công.
4. Cập nhật `GradeViewPage` dùng only `my-published-result` cho banner kết quả chính thức; tách rõ internal score/approval khỏi snapshot chính thức.
5. Bổ sung nhãn status tại `statusMap.js` và những selector/filter/dashboard cần bao gồm state mới, không dùng mock fallback để suy ra passed/failed.

## 6. Test-first và verification

1. Mở rộng service tests `defenseScoringService`: lock yêu cầu đủ council grades và chuyển đúng `AWAITING_FINAL_APPROVAL`; unlock/invalidate không cho approval cũ được công bố.
2. Thêm integration approval: no token `401`, thiếu `DEFENSE_RESULT_APPROVE` `403`, có `RESULT_LOCK` không approval, score/policy/session invalid `400/409`, happy path, audit, hai request đồng thời chỉ một approval effective.
3. Thêm integration publication: server chọn approval đúng semester, ignores UI list/score, idempotency replay, different keys + overlap reject, supplementary only unpublished, correction lineage, transaction rollback và immutable historical items.
4. Thêm ownership/security tests: `RESULT_PUBLISH` không approve; `DEFENSE_RESULT_APPROVE` không publish; student không xem internal approval/other registrations; source name/title/approval mutation không đổi snapshot.
5. Thêm frontend tests service/permission rendering và build path; verify no success UI without API success.
6. Chạy `npx prisma validate`, `npx prisma migrate status`, backend `npm test`, frontend `npm test`, frontend `npm run build`, `git diff --check` và UTF-8 no BOM cho file đổi.

## Thứ tự thực thi

1. Schema/migration/catalog và schema validation.
2. State transition + domain evidence/service, test unit.
3. Route/controller/API integration tests.
4. Frontend service/UI + tests.
5. Toàn bộ verification, migrate deployment theo quy trình môi trường và smoke E2E P0 RBAC bằng tài khoản thật.
