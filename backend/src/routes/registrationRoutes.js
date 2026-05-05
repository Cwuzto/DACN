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
