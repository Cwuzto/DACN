const router = require('express').Router();
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
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

// POST /api/topics - Tạo đề tài (Admin/Lecturer đăng tải qua TOPIC_CREATE, Student đề xuất qua REGISTER_TOPIC)
router.post('/', authorizePermission(PERMISSIONS.TOPIC_CREATE, PERMISSIONS.REGISTER_TOPIC), createTopic);

// PUT /api/topics/:id - Cập nhật đề tài
router.put('/:id', authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN), updateTopic);

// DELETE /api/topics/:id - Xóa đề tài
router.delete('/:id', authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN), deleteTopic);

// PATCH /api/topics/:id/status - Duyệt/Từ chối đề tài SV đề xuất (GVHD duyệt đề tài sinh viên gửi cho mình hoặc Ban quản trị/Viện thẩm định)
router.patch(
    '/:id/status',
    authorizePermission(
        PERMISSIONS.TOPIC_REVIEW,
        PERMISSIONS.MENTOR_REQUEST_REVIEW,
        PERMISSIONS.TOPIC_UPDATE_OWN
    ),
    changeTopicStatus
);

module.exports = router;
