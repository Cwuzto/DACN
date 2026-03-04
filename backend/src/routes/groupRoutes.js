const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate, authorize } = require('../middlewares/auth');

// Đăng ký middleware xác thực cho tất cả route bên dưới
router.use(authenticate);

// Admin và Lecturer lấy danh sách nhóm
router.get('/', authorize('ADMIN', 'LECTURER'), groupController.getAllGroups);

// Sinh viên xem thông tin nhóm của chính mình
router.get('/my-group', authorize('STUDENT'), groupController.getMyGroup);

// Student tạo nhóm mới
router.post('/', authorize('STUDENT'), groupController.createGroup);

// Trưởng nhóm mời sinh viên vào nhóm
router.post('/:id/invite', authorize('STUDENT'), groupController.inviteMember);

// Sinh viên nhận/từ chối lời mời
router.post('/:id/accept', authorize('STUDENT'), groupController.handleInvitation);

// Trưởng nhóm chốt đăng ký topic
router.post('/:id/register-topic', authorize('STUDENT'), groupController.registerTopic);

// Rời nhóm hoặc Xóa thành viên
router.delete('/:id/members/:studentId', authorize('STUDENT'), groupController.removeMember);

module.exports = router;
