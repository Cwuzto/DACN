const express = require('express');
const { body, param, query } = require('express-validator');
const registrationController = require('../controllers/registrationController');
const { authenticate, authorize, authorizePermission, authorizeRoleOrPermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

const router = express.Router();

router.use(authenticate);

router.get(
    '/my',
    [
        authorize('STUDENT'),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        validateRequest,
    ],
    registrationController.getMyRegistration,
);

router.get(
    '/my-project-enrollments',
    [
        authorize('STUDENT'),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        validateRequest,
    ],
    registrationController.getMyProjectEnrollments,
);

router.get(
    '/',
    [
        authorizePermission(
            PERMISSIONS.BM03_REVIEW,
            PERMISSIONS.REPORT_VIEW,
            PERMISSIONS.OUTLINE_COUNCIL_MANAGE,
            PERMISSIONS.DEFENSE_COUNCIL_MANAGE,
        ),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('status')
            .optional()
            .isIn(['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'SUBMITTED', 'AWAITING_SCORES', 'AWAITING_FINAL_APPROVAL', 'DEFENSE_PASSED', 'DEFENSE_FAILED', 'DEFENDED', 'COMPLETED', 'DROPPED', 'WITHDRAWN'])
            .withMessage('status không hợp lệ.'),
        query('unassignedCouncilOnly')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('unassignedCouncilOnly chỉ nhận true/false.'),
        query('councilType')
            .optional()
            .isIn(['OUTLINE_REVIEW', 'DEFENSE_COUNCIL'])
            .withMessage('councilType không hợp lệ.'),
        query('stalePendingOnly')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('stalePendingOnly chỉ nhận true/false.'),
        validateRequest,
    ],
    registrationController.getAllRegistrations,
);

router.post(
    '/',
    [
        authorize('STUDENT'),
        body('topicId').isInt({ min: 1 }).withMessage('topicId phải là số nguyên dương.'),
        body('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        validateRequest,
    ],
    registrationController.registerTopic,
);

router.patch(
    '/:id/approve',
    [
        authorizePermission(PERMISSIONS.MENTOR_REQUEST_REVIEW),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('action').isIn(['APPROVE', 'REJECT']).withMessage('action phải là APPROVE hoặc REJECT.'),
        body('rejectReason')
            .optional({ nullable: true })
            .isString()
            .trim()
            .isLength({ min: 1 })
            .withMessage('rejectReason phải là chuỗi không rỗng nếu được gửi.'),
        validateRequest,
    ],
    registrationController.handleRegistration,
);

router.patch(
    '/:id/drop',
    [
        authorizePermission(PERMISSIONS.MENTOR_ASSIGNMENT_ADJUST),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('reason').isString().trim().notEmpty().withMessage('reason bắt buộc và không được rỗng.'),
        validateRequest,
    ],
    registrationController.dropRegistration,
);

router.post(
    '/:id/withdraw',
    [
        authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.MENTOR_ASSIGNMENT_ADJUST]),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('reason').isString().trim().notEmpty().withMessage('reason bắt buộc và không được rỗng.'),
        validateRequest,
    ],
    registrationController.withdrawRegistration,
);

router.patch(
    '/:id/force-decision',
    [
        authorizePermission(PERMISSIONS.MENTOR_ASSIGN),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('action').isIn(['FORCE_APPROVE', 'FORCE_REJECT']).withMessage('action không hợp lệ.'),
        body('rejectReason').optional({ nullable: true }).isString().trim(),
        validateRequest,
    ],
    registrationController.forceDecisionRegistration,
);

router.patch(
    '/:id/outline-review',
    [
        authorizePermission(PERMISSIONS.OUTLINE_APPROVE),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('status').isIn(['PASSED', 'REVISION_REQUIRED', 'FAILED']).withMessage('status không hợp lệ.'),
        body('feedback').optional({ nullable: true }).isString(),
        validateRequest,
    ],
    registrationController.updateOutlineReview,
);

// Nộp BM02 (Đơn đăng ký đề tài chính thức)
router.post(
    '/bm02-submit',
    [
        authorize('STUDENT'),
        body('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    registrationController.submitBM02,
);

router.post(
    '/bm02/:id/review',
    [
        authorizePermission(PERMISSIONS.BM02_REVIEW),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('action').isIn(['APPROVE', 'RETURN_FOR_REVISION', 'EXCEPTION_REVIEW']).withMessage('action không hợp lệ.'),
        body('issues').optional({ nullable: true }).isArray().withMessage('issues phải là một mảng.'),
        validateRequest,
    ],
    registrationController.reviewCurrentBM02,
);

// Điều chỉnh tên đề tài (trong hạn 7 ngày sau Quyết định)
router.post(
    '/adjust-title',
    [
        authorize('STUDENT'),
        body('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('newTitle').isString().trim().notEmpty().withMessage('newTitle không được để trống.'),
        body('reason').isString().trim().notEmpty().withMessage('reason không được để trống.'),
        validateRequest,
    ],
    registrationController.requestTitleAdjustment,
);

router.put(
    '/adjust-title/:id/review',
    [
        authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('action').isIn(['APPROVE', 'REJECT']).withMessage('action phải là APPROVE hoặc REJECT.'),
        validateRequest,
    ],
    registrationController.reviewTitleAdjustment,
);

router.get(
    '/adjust-title/my',
    authorize('STUDENT'),
    registrationController.getMyTitleAdjustments,
);

router.get(
    '/adjust-title/pending',
    authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN),
    registrationController.getPendingTitleAdjustments,
);

router.post(
    '/:id/transfer-mentor',
    [
        authorizePermission(PERMISSIONS.MENTOR_ASSIGNMENT_ADJUST),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('newMentorId').isInt({ min: 1 }).withMessage('newMentorId phải là số nguyên dương.'),
        body('reason').isString().trim().notEmpty().withMessage('reason không được để trống.'),
        validateRequest,
    ],
    registrationController.transferTopicMentor,
);

router.delete(
    '/:id',
    [
        authorize('STUDENT'),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        validateRequest,
    ],
    registrationController.cancelRegistration,
);

router.get(
    '/:id/allowed-actions',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        validateRequest,
    ],
    registrationController.getAllowedActions,
);

module.exports = router;
