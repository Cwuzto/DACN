const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const instituteOperationsController = require('../controllers/instituteOperationsController');

router.get('/operations', authenticate, instituteOperationsController.getOperations);

module.exports = router;
