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
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phai la so nguyen duong.'),
        validateRequest,
    ],
    registrationController.getMyRegistration,
);

router.get(
    '/',
    [
        authorize('ADMIN', 'LECTURER'),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phai la so nguyen duong.'),
        query('status')
            .optional()
            .isIn(['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED', 'DROPPED', 'WITHDRAWN'])
            .withMessage('status khong hop le.'),
        query('unassignedCouncilOnly')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('unassignedCouncilOnly chi nhan true/false.'),
        query('stalePendingOnly')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('stalePendingOnly chi nhan true/false.'),
        validateRequest,
    ],
    registrationController.getAllRegistrations,
);

router.post(
    '/',
    [
        authorize('STUDENT'),
        body('topicId').isInt({ min: 1 }).withMessage('topicId phai la so nguyen duong.'),
        body('semesterId').isInt({ min: 1 }).withMessage('semesterId phai la so nguyen duong.'),
        validateRequest,
    ],
    registrationController.registerTopic,
);

router.patch(
    '/:id/approve',
    [
        authorize('ADMIN', 'LECTURER'),
        param('id').isInt({ min: 1 }).withMessage('id phai la so nguyen duong.'),
        body('action').isIn(['APPROVE', 'REJECT']).withMessage('action phai la APPROVE hoac REJECT.'),
        body('rejectReason')
            .optional({ nullable: true })
            .isString()
            .trim()
            .isLength({ min: 1 })
            .withMessage('rejectReason phai la chuoi khong rong neu duoc gui.'),
        validateRequest,
    ],
    registrationController.handleRegistration,
);

router.patch(
    '/:id/drop',
    [
        authorize('ADMIN', 'LECTURER'),
        param('id').isInt({ min: 1 }).withMessage('id phai la so nguyen duong.'),
        body('reason').isString().trim().notEmpty().withMessage('reason bat buoc va khong duoc rong.'),
        validateRequest,
    ],
    registrationController.dropRegistration,
);

router.post(
    '/:id/withdraw',
    [
        authorize('ADMIN', 'LECTURER', 'STUDENT'),
        param('id').isInt({ min: 1 }).withMessage('id phai la so nguyen duong.'),
        body('reason').isString().trim().notEmpty().withMessage('reason bat buoc va khong duoc rong.'),
        validateRequest,
    ],
    registrationController.withdrawRegistration,
);

router.patch(
    '/:id/force-decision',
    [
        authorize('ADMIN'),
        param('id').isInt({ min: 1 }).withMessage('id phai la so nguyen duong.'),
        body('action').isIn(['FORCE_APPROVE', 'FORCE_REJECT']).withMessage('action khong hop le.'),
        body('rejectReason').optional({ nullable: true }).isString().trim(),
        validateRequest,
    ],
    registrationController.forceDecisionRegistration,
);

router.delete(
    '/:id',
    [
        authorize('STUDENT'),
        param('id').isInt({ min: 1 }).withMessage('id phai la so nguyen duong.'),
        validateRequest,
    ],
    registrationController.cancelRegistration,
);

module.exports = router;
