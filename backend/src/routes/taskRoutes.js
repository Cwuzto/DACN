const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate, authorize } = require('../middlewares/auth');

// Tất cả endpoints đều cần xác thực
router.use(authenticate);

// Giảng viên tạo task cho nhóm
router.post('/', authorize('LECTURER', 'ADMIN'), taskController.createTask);

// Lấy danh sách nhiệm vụ của một sinh viên (cho cả GV và SV xem)
router.get('/registration/:id', taskController.getTasksByRegistration);

// Sinh viên nộp báo cáo cho một task
router.post('/:id/submit', authorize('STUDENT'), taskController.submitTask);

// Giảng viên nhận xét và chấm điểm báo cáo
router.post('/submission/:id/grade', authorize('LECTURER', 'ADMIN'), taskController.gradeSubmission);

// Giảng viên/Admin cập nhật trạng thái task
router.patch('/:id/status', authorize('LECTURER', 'ADMIN'), taskController.updateTaskStatus);

module.exports = router;
