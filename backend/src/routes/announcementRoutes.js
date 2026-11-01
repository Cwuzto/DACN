const router = require('express').Router();
const announcementController = require('../controllers/announcementController');
const { authenticate, optionalAuthenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

// Public routes (với optional auth để admin có thể xem được bài chưa publish nếu cần)
router.get('/', optionalAuthenticate, announcementController.getAnnouncements);
router.get('/:id', optionalAuthenticate, announcementController.getAnnouncementById);

router.post('/', authenticate, authorizePermission(PERMISSIONS.PUBLIC_ANNOUNCEMENT_MANAGE), announcementController.createAnnouncement);
router.put('/:id', authenticate, authorizePermission(PERMISSIONS.PUBLIC_ANNOUNCEMENT_MANAGE), announcementController.updateAnnouncement);
router.delete('/:id', authenticate, authorizePermission(PERMISSIONS.PUBLIC_ANNOUNCEMENT_MANAGE), announcementController.deleteAnnouncement);

module.exports = router;
