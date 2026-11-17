const express = require('express');
const { body, query } = require('express-validator');
const {
    authenticateToken,
    authorizePermission,
} = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');
const outlineController = require('../controllers/outlineController');

const router = express.Router();

router.use(authenticateToken);

const outlineSubmissionValidators = [
    body('registrationId')
        .isInt({ min: 1 })
        .withMessage('registrationId phải là số nguyên dương.'),
    body('fileData')
        .isObject()
        .withMessage('fileData phải là object.'),
    body('fileData.fileUrl')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('fileUrl là bắt buộc.'),
    body('fileData.fileName')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('fileName là bắt buộc.'),
    body('fileData.assetId')
        .optional({ nullable: true })
        .isString()
        .trim()
        .notEmpty()
        .withMessage('fileData.assetId phải là chuỗi hợp lệ.'),
    body('assetId')
        .optional({ nullable: true })
        .isString()
        .trim()
        .notEmpty()
        .withMessage('assetId phải là chuỗi hợp lệ.'),
    body('content')
        .optional()
        .custom((value) => {
            if (typeof value === 'string') {
                return value.trim().length > 0;
            }
            return Boolean(value && typeof value === 'object' && !Array.isArray(value));
        })
        .withMessage('content phải là chuỗi JSON hoặc object hợp lệ.'),
    validateRequest,
];

// Sinh viên nộp đề cương v1
router.post(
    '/submissions',
    authorizePermission(PERMISSIONS.SUBMIT_BM01),
    outlineSubmissionValidators,
    outlineController.submitOutline
);

// Sinh viên nộp lại đề cương v2
router.post(
    '/resubmissions',
    authorizePermission(PERMISSIONS.SUBMIT_BM01),
    outlineSubmissionValidators,
    outlineController.submitResubmission
);

// Sinh viên xem thông tin đề cương của mình
router.get(
    '/my-outline',
    authorizePermission(
        PERMISSIONS.VIEW_MY_REGISTRATION,
        PERMISSIONS.VIEW_OUTLINE_REVIEWS
    ),
    [
        query('semesterId')
            .optional()
            .isInt({ min: 1 })
            .withMessage('semesterId phải là số nguyên dương.'),
        validateRequest,
    ],
    outlineController.getMyOutline
);

module.exports = router;
