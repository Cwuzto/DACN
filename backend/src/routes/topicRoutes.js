const router = require('express').Router();
const { authenticate, authorize } = require('../middlewares/auth');
const {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic,
    changeTopicStatus,
    getMentorCapacity,
    getAvailableMentors,
} = require('../controllers/topicController');

router.use(authenticate);

router.get('/mentors', getAvailableMentors);

// GET /api/topics - Lấy danh sách đề tài
router.get('/', getAllTopics);

// GET /api/topics/:id - Chi tiết đề tài
router.get('/:id', getTopicById);

// POST /api/topics - Tạo đề tài (Admin/Lecturer đăng tải, Student đề xuất)
router.post('/', authorize('ADMIN', 'LECTURER', 'STUDENT'), createTopic);

// PUT /api/topics/:id - Cập nhật đề tài
router.put('/:id', authorize('ADMIN', 'LECTURER'), updateTopic);

// DELETE /api/topics/:id - Xóa đề tài
router.delete('/:id', authorize('ADMIN', 'LECTURER'), deleteTopic);

// PATCH /api/topics/:id/status - Duyệt/Từ chối đề tài SV đề xuất
router.patch('/:id/status', authorize('ADMIN', 'LECTURER'), changeTopicStatus);

module.exports = router;
