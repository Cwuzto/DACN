const router = require('express').Router();
const { body, param, query } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validate');

router.use(authenticate);

router.get(
    '/my',
    [
        query('unreadOnly')
            .optional()
            .isIn(['true', 'false'])
            .withMessage('unreadOnly chỉ nhận true/false.'),
        validateRequest,
    ],
    notificationController.getMyNotifications
);

router.patch(
    '/:id/read',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        validateRequest,
    ],
    notificationController.markNotificationRead
);
router.patch('/read-all', notificationController.markAllNotificationsRead);
router.delete(
    '/:id',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        validateRequest,
    ],
    notificationController.deleteMyNotification
);

router.get('/history', authorize('ADMIN'), notificationController.getNotificationHistory);
router.get('/templates', authorize('ADMIN'), notificationController.getNotificationTemplates);
router.put(
    '/templates/:key',
    [
        authorize('ADMIN'),
        param('key').isString().trim().notEmpty().withMessage('key bat buoc phai la chuoi.'),
        body('name').optional().isString().trim().notEmpty().withMessage('name phai la chuoi.'),
        body('title').optional().isString().trim().notEmpty().withMessage('title phai la chuoi.'),
        body('content').optional().isString().trim().notEmpty().withMessage('content phai la chuoi.'),
        body('autoTrigger').optional().isString().trim().notEmpty().withMessage('autoTrigger phai la chuoi.'),
        body('isActive').optional().isBoolean().withMessage('isActive phai la boolean.'),
        validateRequest,
    ],
    notificationController.updateNotificationTemplate
);
router.post(
    '/broadcast',
    [
        authorize('ADMIN'),
        body('title').isString().trim().notEmpty().withMessage('title bắt buộc phải là chuỗi.'),
        body('content').isString().trim().notEmpty().withMessage('content bắt buộc phải là chuỗi.'),
        body('audience')
            .isIn(['ALL_USERS', 'ALL_STUDENTS', 'ALL_LECTURERS', 'ALL_ADMINS', 'SPECIFIC_COUNCIL'])
            .withMessage('audience không hợp lệ.'),
        body('councilId')
            .if(body('audience').equals('SPECIFIC_COUNCIL'))
            .isInt({ min: 1 })
            .withMessage('councilId bắt buộc và phải là số nguyên dương khi audience=SPECIFIC_COUNCIL.'),
        validateRequest,
    ],
    notificationController.sendBroadcastNotification
);

module.exports = router;
