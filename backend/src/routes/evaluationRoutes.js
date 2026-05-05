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
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phai la so nguyen duong.'),
        query('projectCatalogId').optional().isInt({ min: 1 }).withMessage('projectCatalogId phai la so nguyen duong.'),
        query('councilId').optional().isInt({ min: 1 }).withMessage('councilId phai la so nguyen duong.'),
        validateRequest,
    ],
    evaluationController.getGradingStudents,
);

router.get(
    '/:registrationId/score-sheet',
    authorize('LECTURER', 'ADMIN'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phai la so nguyen duong.'),
        query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phai la so nguyen duong.'),
        validateRequest,
    ],
    evaluationController.getScoreSheet,
);

router.put(
    '/:registrationId/score-sheet',
    authorize('LECTURER', 'ADMIN'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phai la so nguyen duong.'),
        body('scores').isArray({ min: 1 }).withMessage('scores phai la mang co it nhat 1 phan tu.'),
        body('scores.*.criterionCode').isString().trim().notEmpty().withMessage('criterionCode la bat buoc.'),
        body('scores.*.score').isFloat({ min: 0 }).withMessage('score phai la so hop le.'),
        body('scores.*.comment').optional({ nullable: true }).isString(),
        body('generalComment').optional({ nullable: true }).isString(),
        body('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phai la so nguyen duong.'),
        validateRequest,
    ],
    evaluationController.saveScoreSheet,
);

router.post(
    '/:registrationId/score-sheet/export-pdf',
    authorize('LECTURER', 'ADMIN'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phai la so nguyen duong.'),
        query('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phai la so nguyen duong.'),
        body('evaluatorId').optional().isInt({ min: 1 }).withMessage('evaluatorId phai la so nguyen duong.'),
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
            .withMessage('registrationIds phai la mang co it nhat 1 phan tu.'),
        body('registrationIds.*')
            .isInt({ min: 1 })
            .withMessage('Moi registrationId phai la so nguyen duong.'),
        validateRequest,
    ],
    evaluationController.remindDefenseGrading,
);
router.patch(
    '/admin-defense-center/:id/score-lock',
    authorize('ADMIN'),
    [
        param('id').isInt({ min: 1 }).withMessage('id phai la so nguyen duong.'),
        body('action').isIn(['LOCK', 'UNLOCK']).withMessage('action phai la LOCK hoac UNLOCK.'),
        validateRequest,
    ],
    evaluationController.setDefenseScoreLock,
);

module.exports = router;
