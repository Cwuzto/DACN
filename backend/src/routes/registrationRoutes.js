const express = require('express');
const { body, param, query } = require('express-validator');
const registrationController = require('../controllers/registrationController');
const { authenticate, authorize } = require('../middlewares/auth');
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
        authorize('ADMIN', 'LECTURER'),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('status')
            .optional()
            .isIn(['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED', 'DROPPED', 'WITHDRAWN'])
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
        authorize('ADMIN', 'LECTURER'),
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
        authorize('ADMIN', 'LECTURER'),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('reason').isString().trim().notEmpty().withMessage('reason bắt buộc và không được rỗng.'),
        validateRequest,
    ],
    registrationController.dropRegistration,
);

router.post(
    '/:id/withdraw',
    [
        authorize('ADMIN', 'LECTURER', 'STUDENT'),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('reason').isString().trim().notEmpty().withMessage('reason bắt buộc và không được rỗng.'),
        validateRequest,
    ],
    registrationController.withdrawRegistration,
);

router.patch(
    '/:id/force-decision',
    [
        authorize('ADMIN'),
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
        authorize('ADMIN', 'LECTURER'),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('status').optional().isIn(['PENDING', 'PASSED', 'REVISION_REQUIRED', 'FAILED']).withMessage('status không hợp lệ.'),
        body('feedback').optional({ nullable: true }).isString(),
        validateRequest,
    ],
    registrationController.updateOutlineReview,
);

router.post(
    '/:id/bm04-review',
    [
        authorize('ADMIN', 'LECTURER'),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('decision').isIn(['AGREED', 'DISAGREED']).withMessage('decision bắt buộc và phải là AGREED hoặc DISAGREED.'),
        body('feedback').optional({ nullable: true }).isString(),
        body('score').optional({ nullable: true }).isFloat({ min: 0, max: 10 }).withMessage('score phải từ 0 đến 10.'),
        validateRequest,
    ],
    registrationController.reviewBM04,
);

router.post(
    '/batch-bypass-outline',
    [
        authorize('ADMIN'),
        body('registrationIds').isArray({ min: 1 }).withMessage('registrationIds phải là mảng có ít nhất 1 phần tử.'),
        body('registrationIds.*').isInt({ min: 1 }).withMessage('Mỗi registrationId phải là số nguyên dương.'),
        body('reason').optional({ nullable: true }).isString().trim(),
        validateRequest,
    ],
    registrationController.batchBypassOutlineReview,
);

router.post(
    '/:id/bypass-outline',
    [
        authorize('ADMIN'),
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('reason').isString().trim().isLength({ min: 1 }).withMessage('reason bắt buộc và không được để trống.'),
        validateRequest,
    ],
    registrationController.bypassOutlineReview,
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

module.exports = router;
