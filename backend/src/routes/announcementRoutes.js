const router = require('express').Router();
const announcementController = require('../controllers/announcementController');
const { authenticate, optionalAuthenticate, authorize } = require('../middlewares/auth');

// Public routes (với optional auth để admin có thể xem được bài chưa publish nếu cần)
router.get('/', optionalAuthenticate, announcementController.getAnnouncements);
router.get('/:id', optionalAuthenticate, announcementController.getAnnouncementById);

// Admin-only management routes
router.post('/', authenticate, authorize('ADMIN'), announcementController.createAnnouncement);
router.put('/:id', authenticate, authorize('ADMIN'), announcementController.updateAnnouncement);
router.delete('/:id', authenticate, authorize('ADMIN'), announcementController.deleteAnnouncement);

module.exports = router;
