const router = require('express').Router();
const semesterController = require('../controllers/semesterController');
const { authenticate, authorize } = require('../middlewares/auth');

// - Lấy danh sách đợt đồ án
router.get('/', authenticate, semesterController.getAllSemesters);

// - Lấy chi tiết
router.get('/:id', authenticate, semesterController.getSemesterById);

// Các thao tác mutations (Thêm, Sửa, Xóa) chỉ Admin mới được phép
router.post('/', authenticate, authorize('ADMIN'), semesterController.createSemester);
router.put('/:id', authenticate, authorize('ADMIN'), semesterController.updateSemester);
router.delete('/:id', authenticate, authorize('ADMIN'), semesterController.deleteSemester);

module.exports = router;
