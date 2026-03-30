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
    getMentorCapacity,
} = require('../controllers/topicController');

router.use(authenticate);

// GET /api/topics/approvals - Danh sách đề tài SV đề xuất chờ duyệt
router.get('/approvals', authorize('ADMIN', 'LECTURER'), getTopicApprovals);

// GET /api/topics/mentor-capacity/:mentorId - Kiểm tra capacity GV
router.get('/mentor-capacity/:mentorId', getMentorCapacity);

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
