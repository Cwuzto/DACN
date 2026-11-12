const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const aiController = require('../controllers/aiController');

router.post('/bm01-copilot', authenticateToken, aiController.bm01Copilot);
router.post('/topic-similarity', authenticateToken, aiController.topicSimilarity);
router.post('/cross-check-archive', authenticateToken, aiController.crossCheckArchive);
router.post('/generate-feedback', authenticateToken, aiController.generateFeedback);
router.post('/generate-defense-questions', authenticateToken, aiController.generateDefenseQuestions);
router.post('/regulation-chat', authenticateToken, aiController.regulationChat);

module.exports = router;
