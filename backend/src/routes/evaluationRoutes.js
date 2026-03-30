const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

// SV xem điểm bảo vệ
router.get('/my-grades', authorize('STUDENT'), evaluationController.getMyGrades);

// GV/Admin xem danh sách SV cần chấm điểm
router.get('/grading-students', authorize('LECTURER', 'ADMIN'), evaluationController.getGradingStudents);

// GV/Admin nhập điểm bảo vệ + ảnh bảng chấm
router.post('/defense-result', authorize('LECTURER', 'ADMIN'), evaluationController.submitDefenseResult);

module.exports = router;
