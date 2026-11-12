const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const aiController = require('../controllers/aiController');

router.post('/bm01-copilot', authenticateToken, aiController.bm01Copilot);
router.post('/topic-similarity', authenticateToken, aiController.topicSimilarity);
router.post('/cross-check-archive', authenticateToken, aiController.crossCheckArchive);

module.exports = router;
