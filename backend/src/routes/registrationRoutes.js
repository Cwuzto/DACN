const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

// SV xem đăng ký hiện tại
router.get('/my', authorize('STUDENT'), registrationController.getMyRegistration);

// Admin/GV xem danh sách đăng ký
router.get('/', authorize('ADMIN', 'LECTURER'), registrationController.getAllRegistrations);

// SV đăng ký đề tài
router.post('/', authorize('STUDENT'), registrationController.registerTopic);

// GV duyệt/từ chối đăng ký
router.patch('/:id/approve', authorize('ADMIN', 'LECTURER'), registrationController.handleRegistration);

// SV hủy đăng ký (chỉ khi PENDING)
router.delete('/:id', authorize('STUDENT'), registrationController.cancelRegistration);

module.exports = router;
