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
    getAvailableMentors,
} = require('../controllers/topicController');

router.use(authenticate);

// GET /api/topics/approvals - Danh sĂ¡ch Ä‘á» tĂ i SV Ä‘á» xuáº¥t chá» duyá»‡t
router.get('/approvals', authorize('ADMIN', 'LECTURER'), getTopicApprovals);

// GET /api/topics/mentor-capacity/:mentorId - Kiá»ƒm tra capacity GV
router.get('/mentor-capacity/:mentorId', getMentorCapacity);

// GET /api/topics/mentors - Danh sach giang vien huong dan active
router.get('/mentors', getAvailableMentors);

// GET /api/topics - Láº¥y danh sĂ¡ch Ä‘á» tĂ i
router.get('/', getAllTopics);

// GET /api/topics/:id - Chi tiáº¿t Ä‘á» tĂ i
router.get('/:id', getTopicById);

// POST /api/topics - Táº¡o Ä‘á» tĂ i (Admin/Lecturer Ä‘Äƒng táº£i, Student Ä‘á» xuáº¥t)
router.post('/', authorize('ADMIN', 'LECTURER', 'STUDENT'), createTopic);

// PUT /api/topics/:id - Cáº­p nháº­t Ä‘á» tĂ i
router.put('/:id', authorize('ADMIN', 'LECTURER'), updateTopic);

// DELETE /api/topics/:id - XĂ³a Ä‘á» tĂ i
router.delete('/:id', authorize('ADMIN', 'LECTURER'), deleteTopic);

// PATCH /api/topics/:id/status - Duyá»‡t/Tá»« chá»‘i Ä‘á» tĂ i SV Ä‘á» xuáº¥t
router.patch('/:id/status', authorize('ADMIN', 'LECTURER'), changeTopicStatus);

module.exports = router;

