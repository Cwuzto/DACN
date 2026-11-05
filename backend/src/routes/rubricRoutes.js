const express = require('express');
const router = express.Router();
const rubricController = require('../controllers/rubricController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

router.use(authenticate);

// Lấy phiên bản active (tất cả user đã đăng nhập đều xem được)
router.get('/active', rubricController.getActiveRubric);

// Kiểm tra trạng thái có được phép chỉnh sửa rubric hay không (Admin)
router.get('/check-editable', authorizePermission(PERMISSIONS.RUBRIC_MANAGE), rubricController.checkEditStatus);

// Lấy danh sách tất cả các phiên bản (Admin, Giảng viên)
router.get('/', authorizePermission(PERMISSIONS.VIEW_RUBRIC_CONFIG, PERMISSIONS.RUBRIC_MANAGE), rubricController.getRubrics);

// Lấy chi tiết một phiên bản (Admin, Giảng viên)
router.get('/:id', authorizePermission(PERMISSIONS.VIEW_RUBRIC_CONFIG, PERMISSIONS.RUBRIC_MANAGE), rubricController.getRubricById);

// Tạo mới phiên bản (Admin)
router.post('/', authorizePermission(PERMISSIONS.RUBRIC_MANAGE), rubricController.createRubric);

// Cập nhật phiên bản (Admin)
router.put('/:id', authorizePermission(PERMISSIONS.RUBRIC_MANAGE), rubricController.updateRubric);

// Kích hoạt phiên bản thành ACTIVE (Admin)
router.post('/:id/activate', authorizePermission(PERMISSIONS.RUBRIC_MANAGE), rubricController.activateRubric);

// Xóa phiên bản nháp (Admin)
router.delete('/:id', authorizePermission(PERMISSIONS.RUBRIC_MANAGE), rubricController.deleteRubric);

module.exports = router;
