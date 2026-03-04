const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticate, authorize } = require('../middlewares/auth');

// Tất cả endpoints đều cần xác thực
router.use(authenticate);

// Giảng viên lấy danh sách nhóm đang hướng dẫn để chấm điểm
router.get('/grading-groups', authorize('LECTURER', 'ADMIN'), evaluationController.getGradingGroups);

// Giảng viên/Hội đồng lưu điểm đánh giá
router.post('/', authorize('LECTURER', 'ADMIN'), evaluationController.submitEvaluations);

// Sinh viên xem điểm của mình
router.get('/my-grades', authorize('STUDENT'), evaluationController.getMyGrades);

module.exports = router;
