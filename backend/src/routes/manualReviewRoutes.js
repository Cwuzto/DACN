const express = require('express');
const { param, query, body } = require('express-validator');
const manualReviewController = require('../controllers/manualReviewController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

const router = express.Router();

router.use(authenticate);
router.use(authorizePermission(PERMISSIONS.LEGACY_REVIEW_MANAGE));

router.get(
    '/',
    [
        query('status').optional().isIn(['OPEN', 'RESOLVED', 'ALL']).withMessage('status không hợp lệ.'),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('page').optional().isInt({ min: 1 }).withMessage('page phải là số nguyên dương.'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit phải từ 1 đến 100.'),
        validateRequest,
    ],
    manualReviewController.listManualReviewCases,
);

router.get(
    '/:id',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        validateRequest,
    ],
    manualReviewController.getManualReviewCaseDetail,
);

router.post(
    '/:id/resolve',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('resolution').isString().trim().notEmpty().withMessage('resolution không được để trống.'),
        body('targetStatus').optional().isString().trim(),
        validateRequest,
    ],
    manualReviewController.resolveManualReviewCase,
);

module.exports = router;
