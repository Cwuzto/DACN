const express = require('express');
const router = express.Router();
const rubricController = require('../controllers/rubricController');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

// Lấy phiên bản active (tất cả user đã đăng nhập đều xem được)
router.get('/active', rubricController.getActiveRubric);

// Kiểm tra trạng thái có được phép chỉnh sửa rubric hay không (Admin)
router.get('/check-editable', authorize('ADMIN'), rubricController.checkEditStatus);

// Lấy danh sách tất cả các phiên bản (Admin, Giảng viên)
router.get('/', authorize('ADMIN', 'LECTURER'), rubricController.getRubrics);

// Lấy chi tiết một phiên bản (Admin, Giảng viên)
router.get('/:id', authorize('ADMIN', 'LECTURER'), rubricController.getRubricById);

// Tạo mới phiên bản (Admin)
router.post('/', authorize('ADMIN'), rubricController.createRubric);

// Cập nhật phiên bản (Admin)
router.put('/:id', authorize('ADMIN'), rubricController.updateRubric);

// Kích hoạt phiên bản thành ACTIVE (Admin)
router.post('/:id/activate', authorize('ADMIN'), rubricController.activateRubric);

// Xóa phiên bản nháp (Admin)
router.delete('/:id', authorize('ADMIN'), rubricController.deleteRubric);

module.exports = router;
