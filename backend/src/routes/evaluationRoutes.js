const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticate, authorize, authorizePermission, authorizeRoleOrPermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

router.use(authenticate);

// SV xem diem bao ve
router.get('/my-grades', authorize('STUDENT'), evaluationController.getMyGrades);
router.get('/my-published-result', authorize('STUDENT'), evaluationController.getMyPublishedDefenseResult);

// GV/Admin xem danh sach SV can cham diem
router.get(
    '/grading-students',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW),
    [
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('projectCatalogId').optional().isInt({ min: 1 }).withMessage('projectCatalogId phải là số nguyên dương.'),
        query('councilId').optional().isInt({ min: 1 }).withMessage('councilId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getGradingStudents,
);

router.post(
    '/member-score/lock',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_SUBMIT),
    [
        body('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('scores').optional().isArray({ min: 1 }).withMessage('scores phải là mảng hợp lệ.'),
        body('scores.*.criterionCode').optional().isString().trim().notEmpty(),
        body('scores.*.score').optional().isFloat({ min: 0 }),
        body('scores.*.comment').optional({ nullable: true }).isString(),
        body('generalComment').optional({ nullable: true }).isString(),
        validateRequest,
    ],
    evaluationController.lockMemberScore,
);

router.get(
    '/:registrationId/score-sheet',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getScoreSheet,
);

router.put(
    '/:registrationId/score-sheet',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_SUBMIT),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('scores').isArray({ min: 1 }).withMessage('scores phải là mảng có ít nhất 1 phần tử.'),
        body('scores.*.criterionCode').isString().trim().notEmpty().withMessage('criterionCode là bắt buộc.'),
        body('scores.*.score').isFloat({ min: 0 }).withMessage('score phải là số hợp lệ.'),
        body('scores.*.comment').optional({ nullable: true }).isString(),
        body('generalComment').optional({ nullable: true }).isString(),
        body('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.saveScoreSheet,
);

router.post(
    '/:registrationId/score-sheet/export-pdf',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        body('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.exportScoreSheetPdf,
);

// Admin defense center
router.get('/admin-defense-center', authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW), evaluationController.getAdminDefenseCenter);
router.post(
    '/admin-defense-center/remind-grading',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW),
    [
        body('registrationIds')
            .isArray({ min: 1 })
            .withMessage('registrationIds phải là mảng có ít nhất 1 phần tử.'),
        body('registrationIds.*')
            .isInt({ min: 1 })
            .withMessage('Mỗi registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.remindDefenseGrading,
);
router.patch(
    '/admin-defense-center/:id/score-lock',
    authorizePermission(PERMISSIONS.RESULT_LOCK),
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('action').isIn(['LOCK', 'UNLOCK']).withMessage('action phải là LOCK hoặc UNLOCK.'),
        validateRequest,
    ],
    evaluationController.setDefenseScoreLock,
);

router.get(
    '/admin-defense-center/:id/result-approval',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW),
    [param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'), validateRequest],
    evaluationController.getDefenseResultApprovalAction,
);

router.post(
    '/admin-defense-center/:id/result-approval',
    authorizePermission(PERMISSIONS.DEFENSE_RESULT_APPROVE),
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('outcome').isIn(['PASSED', 'FAILED']).withMessage('outcome phải là PASSED hoặc FAILED.'),
        body('reason').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
        body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 8000 }),
        validateRequest,
    ],
    evaluationController.approveDefenseResultAction,
);

router.post(
    '/admin-defense-center/:id/result-approval/correction',
    authorizePermission(PERMISSIONS.DEFENSE_RESULT_APPROVE),
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('outcome').isIn(['PASSED', 'FAILED']).withMessage('outcome phải là PASSED hoặc FAILED.'),
        body('reason').isString().trim().notEmpty().isLength({ max: 4000 }),
        body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 8000 }),
        validateRequest,
    ],
    evaluationController.correctDefenseResultAction,
);

router.get(
    '/semesters/:semesterId/result-publications/preview',
    authorizePermission(PERMISSIONS.RESULT_PUBLISH),
    [param('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'), validateRequest],
    evaluationController.previewResultPublication,
);

router.get(
    '/semesters/:semesterId/result-publications',
    authorizePermission(PERMISSIONS.RESULT_PUBLISH),
    [param('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'), validateRequest],
    evaluationController.getResultPublicationHistory,
);

router.post(
    '/semesters/:semesterId/result-publications',
    authorizePermission(PERMISSIONS.RESULT_PUBLISH),
    [
        param('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        body('type').isIn(['INITIAL', 'SUPPLEMENTARY', 'CORRECTION']).withMessage('type không hợp lệ.'),
        body('reason').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
        body('previousPublicationId').optional({ nullable: true }).isInt({ min: 1 }),
        body('correctionItems').optional().isArray(),
        body('correctionItems.*.registrationId').optional().isInt({ min: 1 }),
        body('correctionItems.*.replacesPublicationItemId').optional().isInt({ min: 1 }),
        validateRequest,
    ],
    evaluationController.publishDefenseResults,
);

// BM01 Re-review endpoints
router.post(
    '/bm01-submit/:registrationId',
    authorize('STUDENT'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.submitBM01,
);

router.post(
    '/bm01-resubmit/:registrationId',
    authorize('STUDENT'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.resubmitBM01,
);

router.post(
    '/bm01-gvhd-approve/:registrationId',
    authorizePermission(PERMISSIONS.OUTLINE_REVIEW),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('outcome').optional().isIn(['PASSED', 'NEEDS_REVISION']).withMessage('outcome không hợp lệ.'),
        validateRequest,
    ],
    evaluationController.approveResubmittedBM01,
);

// BM04 Evaluation endpoints
router.post(
    '/bm04-submit',
    authorizePermission(PERMISSIONS.BM04_SUBMIT),
    [
        body('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('thesisFormatScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 1 là bắt buộc.'),
        body('researchContentScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 2 là bắt buộc.'),
        body('applicabilityScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 3 là bắt buộc.'),
        body('attitudeScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 4 là bắt buộc.'),
        body('conclusion').isIn(['AGREED_FOR_DEFENSE', 'NOT_AGREED_FOR_DEFENSE']).withMessage('conclusion không hợp lệ.'),
        body('lecturerSignature').isString().trim().notEmpty().withMessage('Chữ ký GVHD là bắt buộc.'),
        validateRequest,
    ],
    evaluationController.submitBM04Evaluation,
);

router.get(
    '/bm04/:registrationId',
    authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.BM04_REVIEW]),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getBM04Evaluation,
);

// BM03 Checkpoint endpoints
router.post(
    '/checkpoint-issue',
    authorizePermission(PERMISSIONS.BM03_CHECKPOINT_DECIDE),
    [
        body('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('checkpointNo').isInt({ min: 1, max: 2 }).withMessage('checkpointNo phải là 1 hoặc 2.'),
        body('conclusion').isIn(['ALLOWED_TO_CONTINUE', 'NOT_ALLOWED_TO_CONTINUE']).withMessage('conclusion không hợp lệ.'),
        body('mentorSignature').isString().trim().notEmpty().withMessage('Chữ ký GVHD là bắt buộc.'),
        validateRequest,
    ],
    evaluationController.issueCheckpointEvaluation,
);

router.post(
    '/checkpoint-sign',
    authorize('STUDENT'),
    [
        body('checkpointEvaluationId').isInt({ min: 1 }).withMessage('checkpointEvaluationId phải là số nguyên dương.'),
        body('studentSignature').isString().trim().notEmpty().withMessage('Chữ ký sinh viên là bắt buộc.'),
        validateRequest,
    ],
    evaluationController.signCheckpointEvaluation,
);

router.post(
    '/checkpoint-overdue',
    authorizePermission(PERMISSIONS.BM03_CHECKPOINT_DECIDE),
    [
        body('checkpointEvaluationId').isInt({ min: 1 }).withMessage('checkpointEvaluationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.handleCheckpointOverdue,
);

router.post(
    '/checkpoint-appeal-submit',
    authorize('STUDENT'),
    [
        body('checkpointEvaluationId').isInt({ min: 1 }).withMessage('checkpointEvaluationId phải là số nguyên dương.'),
        body('reason').isString().trim().notEmpty().withMessage('Lý do khiếu nại là bắt buộc.'),
        validateRequest,
    ],
    evaluationController.submitCheckpointAppeal,
);

router.post(
    '/checkpoint-appeal-review',
    authorizePermission(PERMISSIONS.BM03_CHECKPOINT_DECIDE),
    [
        body('appealId').isInt({ min: 1 }).withMessage('appealId phải là số nguyên dương.'),
        body('decision').isIn(['APPROVED', 'REJECTED']).withMessage('decision phải là APPROVED hoặc REJECTED.'),
        validateRequest,
    ],
    evaluationController.reviewCheckpointAppeal,
);

router.get(
    '/checkpoint-appeals',
    authorizeRoleOrPermission(['ADMIN'], [PERMISSIONS.BM03_CHECKPOINT_DECIDE]),
    evaluationController.getCheckpointAppeals,
);

router.get(
    '/checkpoint/:registrationId',
    [
        authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.BM03_REVIEW]),
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getCheckpointEvaluations,
);

module.exports = router;
