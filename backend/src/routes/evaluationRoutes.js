const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validate');

router.use(authenticate);

// SV xem diem bao ve
router.get('/my-grades', authorize('STUDENT'), evaluationController.getMyGrades);

// GV/Admin xem danh sach SV can cham diem
router.get('/grading-students', authorize('LECTURER', 'ADMIN'), evaluationController.getGradingStudents);

// GV/Admin nhap diem bao ve + anh bang cham
router.post('/defense-result', authorize('LECTURER', 'ADMIN'), evaluationController.submitDefenseResult);

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
