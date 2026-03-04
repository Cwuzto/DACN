const router = require('express').Router();
const { login, getMe, changePassword, updateProfile } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

// Public routes (không cần đăng nhập)
router.post('/login', login);

// Protected routes (cần đăng nhập)
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
