const express = require('express');
const router = express.Router();

const upload = require('../middlewares/upload');
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middlewares/auth');

// Route tải lên file. (Sử dụng authenticate để bảo vệ, ai đăng nhập mới được tải lên)
// 'file' là tên trường trong form-data
router.post('/', authenticate, upload.single('file'), uploadController.uploadFile);

module.exports = router;
