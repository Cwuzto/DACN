const express = require('express');
const { body, query } = require('express-validator');
const {
    authenticateToken,
    authorizeRoleOrPermission,
} = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');
const outlineController = require('../controllers/outlineController');

const router = express.Router();

router.use(authenticateToken);

// Sinh viên nộp đề cương v1
router.post(
    '/submissions',
    authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.SUBMIT_BM01]),
    [
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
        validateRequest,
    ],
    outlineController.submitOutline
);

// Sinh viên nộp lại đề cương v2
router.post(
    '/resubmissions',
    authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.SUBMIT_BM01]),
    [
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
        validateRequest,
    ],
    outlineController.submitResubmission
);

// Sinh viên xem thông tin đề cương của mình
router.get(
    '/my-outline',
    authorizeRoleOrPermission(
        ['STUDENT'],
        [PERMISSIONS.VIEW_MY_REGISTRATION, PERMISSIONS.VIEW_OUTLINE_REVIEWS]
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
