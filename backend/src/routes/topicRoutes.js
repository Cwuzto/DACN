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

// GET /api/topics - Lay danh sach de tai
router.get('/', getAllTopics);

// GET /api/topics/:id - Chi tiet de tai
router.get('/:id', getTopicById);

// POST /api/topics - Tao de tai (Admin/Lecturer dang tai, Student de xuat)
router.post('/', authorize('ADMIN', 'LECTURER', 'STUDENT'), createTopic);

// PUT /api/topics/:id - Cap nhat de tai
router.put('/:id', authorize('ADMIN', 'LECTURER'), updateTopic);

// DELETE /api/topics/:id - Xoa de tai
router.delete('/:id', authorize('ADMIN', 'LECTURER'), deleteTopic);

// PATCH /api/topics/:id/status - Duyet/Tu choi de tai SV de xuat
router.patch('/:id/status', authorize('ADMIN', 'LECTURER'), changeTopicStatus);

module.exports = router;
