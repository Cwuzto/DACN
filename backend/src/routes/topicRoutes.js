const router = require('express').Router();
const { param } = require('express-validator');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');
const {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic,
    changeTopicStatus,
    getMentorCapacity,
    getAvailableMentors,
    getRegistrationHistory,
} = require('../controllers/topicController');

router.use(authenticate);

router.get(
    '/registrations/:id/history',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        validateRequest,
    ],
    getRegistrationHistory
);

router.get('/mentors', getAvailableMentors);

// GET /api/topics - Lấy danh sách đề tài
router.get('/', getAllTopics);

// GET /api/topics/:id - Chi tiết đề tài
router.get('/:id', getTopicById);

// POST /api/topics - Tạo đề tài (Admin/Lecturer đăng tải qua TOPIC_CREATE, Student đề xuất qua REGISTER_TOPIC)
router.post('/', authorizePermission(PERMISSIONS.TOPIC_CREATE, PERMISSIONS.REGISTER_TOPIC), createTopic);

// PUT /api/topics/:id - Cập nhật đề tài
router.put('/:id', authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN), updateTopic);

// DELETE /api/topics/:id - Xóa đề tài (Admin/GVHD xóa đề tài phụ trách, SV hủy đề xuất PENDING của mình)
router.delete(
    '/:id',
    authorizePermission(PERMISSIONS.TOPIC_UPDATE_OWN, PERMISSIONS.REGISTER_TOPIC),
    deleteTopic
);

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
