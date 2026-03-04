const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth');
const {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic,
    changeTopicStatus,
    getTopicApprovals,
} = require('../controllers/topicController');

// Tất cả route đều cần đăng nhập
router.use(authenticate);

// GET /api/topics/approvals - Lấy danh sách chờ duyệt (Lecturer + Admin)
router.get('/approvals', authorize('ADMIN', 'LECTURER'), getTopicApprovals);

// GET /api/topics - Lấy danh sách đề tài
router.get('/', getAllTopics);

// GET /api/topics/:id - Xem chi tiết đề tài
router.get('/:id', getTopicById);

// POST /api/topics - Tạo đề tài (Admin + Lecturer + Student)
router.post('/', authorize('ADMIN', 'LECTURER', 'STUDENT'), createTopic);

// PUT /api/topics/:id - Cập nhật đề tài (Admin + Lecturer)
router.put('/:id', authorize('ADMIN', 'LECTURER'), updateTopic);

// DELETE /api/topics/:id - Xóa đề tài (Admin + Lecturer)
router.delete('/:id', authorize('ADMIN', 'LECTURER'), deleteTopic);

// PATCH /api/topics/:id/status - Duyệt/Từ chối đề tài (Admin + Lecturer)
router.patch('/:id/status', authorize('ADMIN', 'LECTURER'), changeTopicStatus);

module.exports = router;
