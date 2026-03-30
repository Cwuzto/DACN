const router = require('express').Router();
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/history', notificationController.getNotificationHistory);
router.post('/broadcast', notificationController.sendBroadcastNotification);

module.exports = router;
