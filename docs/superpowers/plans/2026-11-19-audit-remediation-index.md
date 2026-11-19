# Kế hoạch tổng và bảng đối chiếu audit 19/11/2026

**Đặc tả đã duyệt:** `docs/superpowers/specs/2026-11-19-full-workflow-audit-remediation-design.md`
**Báo cáo gốc:** `C:/Users/phucm/.gemini/antigravity/brain/2c623d87-b0d8-47b3-8cc9-153a8480800c/audit-greedy-full-workflow-2026-11-19.md`

## Thứ tự thực hiện

1. [Nền dữ liệu, PDF, quota, rubric và job](2026-11-19-audit-remediation-foundation.md) — sửa lỗi gốc dùng chung.
2. [BM01–BM04 và quyền học vụ](2026-11-19-audit-remediation-academic-workflow.md) — nối API và màn hình theo trạng thái thật.
3. [Hội đồng và kết quả](2026-11-19-audit-remediation-council-results.md) — chặn phân sai, khôi phục lịch/sổ điểm.
4. [Lưu chiểu, báo cáo và kiểm chứng](2026-11-19-audit-remediation-archive-reports-verification.md) — hoàn tất biên và hồi quy sáu giai đoạn.

Các kế hoạch này sửa lỗi đã phát hiện; tính năng **chấm nhanh rubric** và **phân hội đồng có preview/AI** có kế hoạch riêng. Khi một sửa lỗi trùng với code của tính năng đã làm, test phải xác định trạng thái hiện tại rồi chỉ sửa phần còn lỗi. Không chạy hai implementer trên cùng file cùng lúc.

## Quy tắc trạng thái

- `NEEDS_REPRODUCTION`: có dấu vết mã tĩnh hoặc mô tả trong report, chưa có test/log hiện hành xác nhận.
- `REPORT_CORRECTION`: report mô tả sai một phần nguyên nhân; vẫn kiểm và sửa triệu chứng thật.
- `CONFIRMED`: có test/log hiện hành tái hiện trước sửa.
- `FIXED`: test hồi quy sau sửa PASS và có commit cụ thể.
- `NOT_REPRODUCIBLE`: đã kiểm có bằng chứng nhưng không còn lỗi trên code hiện hành.

Mọi dòng bắt đầu ở trạng thái dưới đây; khi triển khai ghi thêm **test, kết quả, commit và quyết định** ngay trên dòng hoặc liên kết tới nhật ký ngắn của task. Không đánh dấu `FIXED` chỉ vì build PASS.

| Mã | Trạng thái cuối | Commit | Test kiểm chứng & Bằng chứng xác nhận | Ghi chú & Quyết định kỹ thuật |
|---|---|---|---|---|
| P0.1 | FIXED | `c198d53` | `backend/tests/integration/semesterDeletionPolicyIntegrity.test.js` (PASS 16/16) | Xóa policy versions cùng transaction cho đợt trống; trả `409 PERIOD_NOT_EMPTY` khi có hồ sơ. |
| P0.2 | FIXED | `b380e19` | `backend/tests/integration/rubricRoutes.test.js`, `frontend/runtime-tests/rubricLevelManagement.spec.jsx` | Giữ nguyên 4 mô tả level tiêu chí khi lưu/sửa; cho phép clone draft khi đợt ONGOING. |
| P0.3 | REPORT_CORRECTION | `19cccda` | `backend/tests/integration/semesters.routes.test.js`, `frontend/runtime-tests/bm01PeriodConfig.spec.jsx` | DB đã có đủ cột; bổ sung wire API controller và form ProjectPeriodPage. |
| P0.4 | FIXED | `1d5f8be` | `backend/tests/integration/getAllCouncilsForGrading.test.js` (PASS 1/1) | Loại bỏ trường không tồn tại `Topic.code` trong `GET /api/councils?forGrading=true`. |
| P0.5 | REPORT_CORRECTION | `19cccda` | `frontend/runtime-tests/bm01PeriodConfig.spec.jsx` | HybridBMFormModal đọc đúng asset `{id}`, chỉ fallback khi request ném lỗi. |
| P0.6 | FIXED | `29f3598` | `backend/tests/services/outlineReviewService.test.js` (PASS 42/42), `bm01ResubmissionReview.spec.jsx` | Một command thống nhất duyệt BM01 lần đầu và BM01 v2 (`BM01_RESUBMITTED`). |
| P0.7 | FIXED | `1716ed3` | `backend/tests/services/bm02ReviewService.test.js` (PASS 28/28) | Command backend gán `BM02_APPROVED` không phụ thuộc vào `targetStatus` từ UI. |
| P0.8 | FIXED | `aaa6502` | `backend/tests/integration/generatedPdfActorFlows.test.js` | `systemActorService.resolveSystemActor` gán actor hợp lệ (không null/0) cho BM02-A PDF. |
| P0.9 | FIXED | `1716ed3` | `frontend/runtime-tests/bm02aAppendixContract.spec.jsx` (PASS 4/4) | Chuẩn hóa payload ký phụ lục BM02-A: `{ decisionId, appendixNumber, bm02aRequestIds, signedDate }`. |
| P0.10 | FIXED | `8d1d580` | `backend/tests/services/bm03Workflow.test.js` (PASS 33/33) | Chuẩn hóa serialize enum họp trực tuyến `MICROSOFT_TEAMS`, loại trừ giá trị ngoài schema. |
| P0.11 | FIXED | `aaa6502` | `backend/tests/integration/generatedPdfActorFlows.test.js` | Actor hợp lệ cho BM03 PDF thông qua `resolveSystemActor`. |
| P0.12 | FIXED | `8d1d580` | `backend/tests/services/bm03RejectedStopRecovery.test.js` | Viện trưởng bác dừng giải phóng `finalStageEvaluationId = null` trên BM03 để GVHD đánh giá/ký lại. |
| P0.13 | FIXED | `907942a` | `backend/tests/services/antiEscalationAndScopeGuard.test.js`, `academicActionPermissions.spec.jsx` | Mở rộng `INSTITUTE_SCOPE` cho Viện trưởng bao quát các bộ môn trực thuộc Viện. |
| P0.14 | FIXED | `1cfda69` | `backend/tests/services/bm04AtomicWorkflow.test.js` | `saveBM04Draft` từ chối hồ sơ `TERMINATED`; form BM04 khóa read-only khi đã ký. |
| P0.15 | FIXED | `bdb9791`, `6970a5e` | `backend/tests/services/defenseScheduleNotifications.test.js` (PASS 3/3) | Thêm enum `DEFENSE_SCHEDULE_PUBLISHED` / `ADJUSTED`, migration DB và deploy thành công. |
| P0.16 | FIXED | `1d5f8be` | `backend/tests/integration/defenseAutoAssignmentSafety.test.js` (PASS 13/13) | Chặn auto-assign ngầm cho defense, bắt buộc qua `defenseCouncilEligibilityService`. |
| P0.17 | FIXED | `3690a89` | `backend/tests/services/scoreBookRubricPinRecovery.test.js` (PASS 4/4) | Ghim đúng `rubricVersion` của hội đồng/phiếu chấm, không fallback sang `v1` giả khi mở lại sổ. |
| P0.18 | FIXED | `3690a89` | `backend/tests/services/scoreBookRubricPinRecovery.test.js` (PASS 4/4) | Khóa sổ cập nhật đồng bộ `Council.scoreBookLocked = true` và `DefenseResult`. |
| P0.19 | FIXED | `9768215` | `frontend/runtime-tests/scoreBookReturnContract.spec.jsx` | `evaluationController` trả về numeric `memberScores[].id`; UI gửi đúng ID khi trả sổ. |
| P0.20 | FIXED | `1cb77c1` | `backend/tests/integration/archiveSubmissionEligibility.test.js`, `archiveDossier.spec.jsx` | Video demo nhận URL HTTPS, từ chối `http:` và upload file video trực tiếp. |
| P0.21 | FIXED | `aaa6502`, `b0bf734` | `backend/tests/integration/generatedPdfActorFlows.test.js`, `clearanceCertificateContract.spec.jsx` | Giấy xác nhận PDF lưu actor hợp lệ của Viện trưởng từ `resolveSystemActor`. |
| P1.1 | FIXED | `cedd2c5` | `backend/tests/integration/registrationPolicyAndQuotaConcurrency.test.js`, `mentorQuotaUi.spec.jsx` | Thống nhất `ACTIVE_MENTOR_OCCUPANCY_STATUSES`, chặn sinh viên thứ 11, dọn tàn dư quota 15/20. |
| P1.2 | FIXED | `19cccda`, `29f3598` | `backend/tests/services/outlineReviewService.test.js` | BM01 kết luận `FAIL` giữ nguyên domain `FAIL`, asset đính kèm lưu nhất quán. |
| P1.3 | FIXED | `907942a` | `backend/tests/services/antiEscalationAndScopeGuard.test.js` | Thêm route `POST /api/lecturer-assignments/publish`; giữ `fileAssetId` trong bản tin nháp. |
| P1.4 | FIXED | `b380e19`, `c198d53` | `backend/tests/integration/rubricRoutes.test.js`, `semesterDeletionPolicyIntegrity.test.js` | Cho phép nhân bản rubric draft khi ONGOING; duy nhất 1 policy active tại 1 thời điểm. |
| P1.5 | REPORT_CORRECTION | `1716ed3` | `frontend/runtime-tests/bm02aAppendixContract.spec.jsx` | Gọi `getRegistrationById` lấy detail đầy đủ loại bỏ trường hợp thiếu detail do shallow fallback. |
| P1.6 | FIXED | `1716ed3` | `frontend/runtime-tests/bm02aAppendixContract.spec.jsx` | Đồng bộ enum, API và props in phụ lục BM02-A. |
| P1.7 | FIXED | `4742864` | `backend/tests/services/workflowJobLocking.test.js` (PASS 34/34) | Đăng ký scheduler sweep job, dùng transaction advisory lock `pg_try_advisory_xact_lock`. |
| P1.8 | FIXED | `1cfda69` | `backend/tests/services/bm04AtomicWorkflow.test.js`, `bm04LockedAndPrint.spec.jsx` | BM03/BM04 khóa form read-only sau khi ký, bản in hiển thị đúng trạng thái chữ ký số. |
| P1.9 | FIXED | `1d5f8be`, `9768215`, `b0bf734` | `defenseAutoAssignmentSafety.test.js`, `scoreBookReturnContract.spec.jsx`, `clearanceCertificateContract.spec.jsx` | Đồng bộ danh sách hội đồng, trả sổ điểm và xem/ký chứng nhận hoàn thành. |
| P2.1 | FIXED | `1cb77c1` | `backend/tests/integration/archiveSubmissionEligibility.test.js` (PASS 9/9) | Chặn nộp file lưu chiểu đối với hồ sơ `DEFENSE_FAILED`, `NOT_ELIGIBLE_FOR_DEFENSE`, `AUTO_TERMINATED`. |
| P2.2 | FIXED | `2e8ec6b` | `backend/tests/services/notificationService.test.js` (PASS 3/3) | `sanitizeNotificationData` loại bỏ `isPromulgated` và trường lạ trước khi ghi Prisma. |
| P2.3 | FIXED | `2e8ec6b` | `frontend/runtime-tests/generatedAcademicDownloads.spec.jsx` | Sửa header PDF thành `TRƯỜNG ĐẠI HỌC THỦ DẦU MỘT` thay cho tên trường cũ. |
| P2.4 | FIXED | `786feea` | `backend/tests/integration/academicReports.test.js`, `academicReportsPage.test.js` | Export báo cáo 0 dòng vẫn có 11 cột header chuẩn; tên file UTF-8 RFC 5987; enum UI chuẩn. |
| P2.5 | FIXED | `8d1d580` | `backend/tests/services/bm03Workflow.test.js` | Giữ nguyên ID BM03 và buổi họp ban đầu trong suốt quá trình đánh giá tiến độ. |
| P2.6 | FIXED | `1cfda69` | `frontend/runtime-tests/bm04LockedAndPrint.spec.jsx` | `GET /api/registrations/my` include đầy đủ profile, bm03Record, bm04Evaluation phục vụ in. |

## Cổng kiểm chứng cuối

Kế hoạch Lưu chiểu Task 5 kiểm đủ 36 dòng. Mỗi mục phải kết thúc bằng `FIXED`, `REPORT_CORRECTION` đã kiểm, hoặc `NOT_REPRODUCIBLE` có bằng chứng. Chạy test ghi dữ liệu trên DB thử nghiệm cách ly, test frontend và build; kiểm tra bằng vai trò Admin, Giáo vụ, Viện trưởng, GVHD/Hội đồng và Sinh viên qua sáu giai đoạn. Ghi rõ giới hạn của mọi mục chưa thể tái hiện; không suy ra PASS từ việc không thấy lỗi trong mã tĩnh.
