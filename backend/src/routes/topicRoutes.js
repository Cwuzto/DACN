const router = require('express').Router();
const { authenticate, authorizePermission, authorizeRoleOrPermission } = require('../middlewares/auth');
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

// POST /api/topics - Tạo đề tài (Admin/Lecturer đăng tải, Student đề xuất)
router.post('/', authorizeRoleOrPermission(['STUDENT'], [PERMISSIONS.TOPIC_CREATE]), createTopic);

// PUT /api/topics/:id - Cập nhật đề tài
router.put('/:id', authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN), updateTopic);

// DELETE /api/topics/:id - Xóa đề tài
router.delete('/:id', authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN), deleteTopic);

// PATCH /api/topics/:id/status - Duyệt/Từ chối đề tài SV đề xuất
router.patch('/:id/status', authorizePermission(PERMISSIONS.TOPIC_REVIEW), changeTopicStatus);

module.exports = router;
