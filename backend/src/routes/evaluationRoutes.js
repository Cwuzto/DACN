const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

router.use(authenticate);

// SV xem diem bao ve
router.get('/my-grades', authorizePermission(PERMISSIONS.VIEW_MY_GRADES), evaluationController.getMyGrades);
router.get('/my-published-result', authorizePermission(PERMISSIONS.VIEW_MY_GRADES), evaluationController.getMyPublishedDefenseResult);

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
    ['/member-score/lock', '/councils/:id/score-sheet/lock'],
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_SUBMIT),
    [
        (req, res, next) => {
            if (!req.body.registrationId && req.params.id) {
                req.body.registrationId = parseInt(req.params.id, 10);
            }
            next();
        },
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

const getScoreSheetGuards = [
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW, PERMISSIONS.VIEW_DEFENSE_GRADING),
    (req, res, next) => {
        if (!req.params.registrationId && req.params.id) {
            req.params.registrationId = req.params.id;
        }
        next();
    },
    param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
    query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
    validateRequest,
];

router.get(
    '/:registrationId/score-sheet',
    getScoreSheetGuards,
    evaluationController.getScoreSheet,
);

router.get(
    '/councils/:id/score-sheet',
    getScoreSheetGuards,
    evaluationController.getScoreSheet,
);

const saveScoreSheetGuards = [
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_SUBMIT),
    (req, res, next) => {
        if (!req.params.registrationId && req.params.id) {
            req.params.registrationId = req.params.id;
        }
        next();
    },
    param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
    body('scores').isArray({ min: 1 }).withMessage('scores phải là mảng có ít nhất 1 phần tử.'),
    body('scores.*.criterionCode').isString().trim().notEmpty().withMessage('criterionCode là bắt buộc.'),
    body('scores.*.score').isFloat({ min: 0 }).withMessage('score phải là số hợp lệ.'),
    body('scores.*.comment').optional({ nullable: true }).isString(),
    body('generalComment').optional({ nullable: true }).isString(),
    body('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
    validateRequest,
];

router.put(
    '/:registrationId/score-sheet',
    saveScoreSheetGuards,
    evaluationController.saveScoreSheet,
);

router.post(
    '/councils/:id/score-sheet',
    saveScoreSheetGuards,
    evaluationController.saveScoreSheet,
);

// Read-only PDF stream generation (uses POST for filter payload, does not mutate DB state)
router.post(
    '/:registrationId/score-sheet/export-pdf',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW, PERMISSIONS.VIEW_DEFENSE_GRADING),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        body('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.exportScoreSheetPdf,
);

// Admin defense center
router.get(
    '/admin-defense-center',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW, PERMISSIONS.VIEW_DEFENSE_LOCK_LEDGER, PERMISSIONS.VIEW_RESULT_LOCKS),
    evaluationController.getAdminDefenseCenter,
);

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

const scoreLockGuards = [
    authorizePermission(PERMISSIONS.RESULT_LOCK),
    param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
    (req, res, next) => {
        if (!req.body.action) {
            req.body.action = 'LOCK';
        }
        next();
    },
    body('action').isIn(['LOCK', 'UNLOCK']).withMessage('action phải là LOCK hoặc UNLOCK.'),
    validateRequest,
];

router.patch(
    '/admin-defense-center/:id/score-lock',
    scoreLockGuards,
    evaluationController.setDefenseScoreLock,
);

router.post(
    '/councils/:id/lock-scores',
    scoreLockGuards,
    evaluationController.setDefenseScoreLock,
);

// Chairman mark student absent
router.post(
    ['/:registrationId/mark-absent', '/registrations/:registrationId/mark-absent'],
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_SUBMIT, PERMISSIONS.RESULT_LOCK),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('absentMinutesText').isString().trim().notEmpty().withMessage('Biên bản xác nhận sinh viên vắng mặt là bắt buộc.'),
        validateRequest,
    ],
    evaluationController.markStudentAbsentAction,
);

// Chairman lock scorebook
router.post(
    ['/:registrationId/lock-scorebook', '/registrations/:registrationId/lock-scorebook'],
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_SUBMIT, PERMISSIONS.RESULT_LOCK),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.lockDefenseScoreBookAction,
);

// Admin return scorebook before publication
router.post(
    ['/:registrationId/return-scorebook', '/registrations/:registrationId/return-scorebook'],
    authorizePermission(PERMISSIONS.DEFENSE_SCOREBOOK_RETURN, PERMISSIONS.RESULT_LOCK),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('reason').isString().trim().notEmpty().withMessage('Lý do trả sổ điểm là bắt buộc.'),
        body('reopenMemberScoreIds').isArray({ min: 1 }).withMessage('reopenMemberScoreIds phải là mảng chứa ít nhất 1 ID.'),
        body('reopenMemberScoreIds.*').isInt({ min: 1 }).withMessage('Mỗi ID trong reopenMemberScoreIds phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.returnScoreBookAction,
);

router.get(
    '/admin-defense-center/:id/result-approval',
    authorizePermission(PERMISSIONS.DEFENSE_SCORE_VIEW, PERMISSIONS.VIEW_DEFENSE_RESULT_APPROVALS, PERMISSIONS.VIEW_DEFENSE_RESULTS_APPROVAL),
    [param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'), validateRequest],
    evaluationController.getDefenseResultApprovalAction,
);

const approveResultGuards = [
    authorizePermission(PERMISSIONS.DEFENSE_RESULT_APPROVE),
    param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
    body('outcome').optional().isIn(['PASSED', 'FAILED']).withMessage('outcome phải là PASSED hoặc FAILED.'),
    body('reason').optional({ nullable: true }).isString().trim().isLength({ max: 4000 }),
    body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 8000 }),
    validateRequest,
];

router.post(
    ['/admin-defense-center/:id/result-approval', '/councils/:id/results/approve', '/admin-defense-center/:id/approve-result', '/:id/approve-result'],
    approveResultGuards,
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
    authorizePermission(PERMISSIONS.RESULT_PUBLISH, PERMISSIONS.RESULT_PUBLICATION_PUBLISH),
    [param('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'), validateRequest],
    evaluationController.previewResultPublication,
);

router.get(
    '/semesters/:semesterId/result-publications',
    authorizePermission(PERMISSIONS.RESULT_PUBLISH, PERMISSIONS.RESULT_PUBLICATION_PUBLISH),
    [param('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'), validateRequest],
    evaluationController.getResultPublicationHistory,
);

router.post(
    ['/semesters/:semesterId/result-publications', '/semesters/:semesterId/results/publish'],
    authorizePermission(PERMISSIONS.RESULT_PUBLICATION_PUBLISH),
    [
        param('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        body('type').optional().isIn(['INITIAL', 'SUPPLEMENTARY', 'CORRECTION']).withMessage('type không hợp lệ.'),
        (req, res, next) => {
            if (!req.body.type) req.body.type = 'INITIAL';
            next();
        },
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
    authorizePermission(PERMISSIONS.SUBMIT_BM01),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.submitBM01,
);

router.post(
    '/bm01-resubmit/:registrationId',
    authorizePermission(PERMISSIONS.SUBMIT_BM01),
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

const bm04SubmitGuards = [
    authorizePermission(PERMISSIONS.BM04_SUBMIT),
    (req, res, next) => {
        if (!req.body.registrationId && req.params.registrationId) {
            req.body.registrationId = parseInt(req.params.registrationId, 10);
        }
        next();
    },
    body('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
    body('thesisFormatScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 1 là bắt buộc.'),
    body('researchContentScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 2 là bắt buộc.'),
    body('applicabilityScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 3 là bắt buộc.'),
    body('attitudeScore').isString().trim().notEmpty().withMessage('Nhận xét tiêu chí 4 là bắt buộc.'),
    body('conclusion').isIn(['AGREED_FOR_DEFENSE', 'NOT_AGREED_FOR_DEFENSE']).withMessage('conclusion không hợp lệ.'),
    body('lecturerSignature').isString().trim().notEmpty().withMessage('Chữ ký GVHD là bắt buộc.'),
    validateRequest,
];

// BM04 Evaluation endpoints
router.post(
    ['/bm04-submit', '/registrations/:registrationId/bm04'],
    bm04SubmitGuards,
    evaluationController.submitBM04Evaluation,
);

router.get(
    ['/bm04/:registrationId', '/registrations/:registrationId/bm04'],
    authorizePermission(PERMISSIONS.VIEW_MY_SUBMISSIONS, PERMISSIONS.BM04_REVIEW, PERMISSIONS.VIEW_BM04_EVALUATIONS),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getBM04Evaluation,
);

const checkpointIssueGuards = [
    authorizePermission(PERMISSIONS.CHECKPOINT_ISSUE),
    (req, res, next) => {
        if (!req.body.registrationId && req.params.registrationId) {
            req.body.registrationId = parseInt(req.params.registrationId, 10);
        }
        next();
    },
    body('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
    body('checkpointNo').isInt({ min: 1, max: 2 }).withMessage('checkpointNo phải là 1 hoặc 2.'),
    body('conclusion').isIn(['ALLOWED_TO_CONTINUE', 'NOT_ALLOWED_TO_CONTINUE']).withMessage('conclusion không hợp lệ.'),
    body('mentorSignature').isString().trim().notEmpty().withMessage('Chữ ký GVHD là bắt buộc.'),
    validateRequest,
];

// BM03 Checkpoint endpoints
router.post(
    ['/checkpoint-issue', '/registrations/:registrationId/checkpoints'],
    checkpointIssueGuards,
    evaluationController.issueCheckpointEvaluation,
);

const checkpointSignGuards = [
    authorizePermission(PERMISSIONS.CHECKPOINT_SIGN),
    (req, res, next) => {
        if (!req.body.checkpointEvaluationId && req.params.id) {
            req.body.checkpointEvaluationId = parseInt(req.params.id, 10);
        }
        next();
    },
    body('checkpointEvaluationId').isInt({ min: 1 }).withMessage('checkpointEvaluationId phải là số nguyên dương.'),
    body('studentSignature').isString().trim().notEmpty().withMessage('Chữ ký sinh viên là bắt buộc.'),
    validateRequest,
];

router.post(
    ['/checkpoint-sign', '/checkpoints/:id/sign'],
    checkpointSignGuards,
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

const checkpointAppealGuards = [
    authorizePermission(PERMISSIONS.SIGNATURE_APPEAL_SUBMIT),
    (req, res, next) => {
        if (!req.body.checkpointEvaluationId && req.params.id) {
            req.body.checkpointEvaluationId = parseInt(req.params.id, 10);
        }
        next();
    },
    body('checkpointEvaluationId').isInt({ min: 1 }).withMessage('checkpointEvaluationId phải là số nguyên dương.'),
    body('reason').isString().trim().notEmpty().withMessage('Lý do khiếu nại là bắt buộc.'),
    validateRequest,
];

router.post(
    ['/checkpoint-appeal-submit', '/checkpoints/:id/appeal'],
    checkpointAppealGuards,
    evaluationController.submitCheckpointAppeal,
);

const checkpointAppealReviewGuards = [
    authorizePermission(PERMISSIONS.SIGNATURE_APPEAL_REVIEW),
    (req, res, next) => {
        if (!req.body.appealId && req.params.id) {
            req.body.appealId = parseInt(req.params.id, 10);
        }
        next();
    },
    body('appealId').isInt({ min: 1 }).withMessage('appealId phải là số nguyên dương.'),
    body('decision').isIn(['APPROVED', 'REJECTED']).withMessage('decision phải là APPROVED hoặc REJECTED.'),
    validateRequest,
];

router.post(
    ['/checkpoint-appeal-review', '/checkpoints/appeals/:id/review'],
    checkpointAppealReviewGuards,
    evaluationController.reviewCheckpointAppeal,
);

router.get(
    '/checkpoint-appeals',
    authorizePermission(PERMISSIONS.SIGNATURE_APPEAL_REVIEW, PERMISSIONS.PROJECT_OVERSIGHT_MANAGE),
    evaluationController.getCheckpointAppeals,
);

router.get(
    ['/checkpoint/:registrationId', '/registrations/:registrationId/checkpoints'],
    [
        authorizePermission(PERMISSIONS.VIEW_MY_SUBMISSIONS, PERMISSIONS.VIEW_CHECKPOINTS, PERMISSIONS.BM03_REVIEW),
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getCheckpointEvaluations,
);

module.exports = router;
