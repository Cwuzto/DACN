const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validate');

router.use(authenticate);

// SV xem diem bao ve
router.get('/my-grades', authorize('STUDENT'), evaluationController.getMyGrades);

// GV/Admin xem danh sach SV can cham diem
router.get(
    '/grading-students',
    authorize('LECTURER', 'ADMIN'),
    [
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('projectCatalogId').optional().isInt({ min: 1 }).withMessage('projectCatalogId phải là số nguyên dương.'),
        query('councilId').optional().isInt({ min: 1 }).withMessage('councilId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getGradingStudents,
);

router.get(
    '/:registrationId/score-sheet',
    authorize('LECTURER', 'ADMIN'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.getScoreSheet,
);

router.put(
    '/:registrationId/score-sheet',
    authorize('LECTURER', 'ADMIN'),
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
    authorize('LECTURER', 'ADMIN'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        body('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phải là số nguyên dương.'),
        validateRequest,
    ],
    evaluationController.exportScoreSheetPdf,
);

// Admin defense center
router.get('/admin-defense-center', authorize('ADMIN'), evaluationController.getAdminDefenseCenter);
router.post(
    '/admin-defense-center/remind-grading',
    authorize('ADMIN'),
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
    authorize('ADMIN'),
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('action').isIn(['LOCK', 'UNLOCK']).withMessage('action phải là LOCK hoặc UNLOCK.'),
        validateRequest,
    ],
    evaluationController.setDefenseScoreLock,
);

module.exports = router;
