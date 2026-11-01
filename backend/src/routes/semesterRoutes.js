const router = require('express').Router();
const { body, param } = require('express-validator');
const semesterController = require('../controllers/semesterController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

// Public route: Cho phép trang chủ Cổng thông tin xem thông tin đợt học kỳ đang mở
router.get('/public', semesterController.getAllSemesters);

router.get('/', authenticate, semesterController.getAllSemesters);
router.get('/:id', authenticate, semesterController.getSemesterById);

router.post('/', authenticate, authorizePermission(PERMISSIONS.SEMESTER_MANAGE), semesterController.createSemester);
router.put('/:id', authenticate, authorizePermission(PERMISSIONS.SEMESTER_MANAGE), semesterController.updateSemester);
router.patch(
    '/:id/registration-toggle',
    authenticate,
    authorizePermission(PERMISSIONS.PROJECT_ASSIGNMENT_PUBLISH),
    semesterController.toggleSemesterRegistration
);
router.post(
    '/:id/issue-decision',
    authenticate,
    authorizePermission(PERMISSIONS.PROJECT_ASSIGNMENT_PUBLISH),
    semesterController.issuePeriodDecision
);
router.post(
    '/decisions/:decisionId/amendments',
    authenticate,
    authorizePermission(PERMISSIONS.PROJECT_ASSIGNMENT_PUBLISH),
    [
        param('decisionId').isInt({ min: 1 }).withMessage('decisionId phải là số nguyên dương.'),
        body('amendmentNumber').isString().trim().notEmpty().withMessage('amendmentNumber là bắt buộc.'),
        body('reason').isString().trim().notEmpty().withMessage('reason là bắt buộc.'),
        body('changes').isObject().withMessage('changes phải là object.'),
        body('effectiveAt').optional().isISO8601().withMessage('effectiveAt không hợp lệ.'),
        validateRequest,
    ],
    semesterController.amendAssignmentDecision
);
router.delete('/:id', authenticate, authorizePermission(PERMISSIONS.SEMESTER_MANAGE), semesterController.deleteSemester);

module.exports = router;
