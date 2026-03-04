const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middlewares/auth');

// Tất cả route đều cần authenticate + ADMIN
router.use(authenticate);
router.use(authorize('ADMIN'));

// CRUD
router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

// Lock/Unlock
router.patch('/:id/toggle-active', userController.toggleActive);

// Reset password
router.post('/:id/reset-password', userController.resetPassword);

module.exports = router;
