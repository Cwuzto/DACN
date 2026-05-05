const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

router.post('/', authorize('LECTURER', 'ADMIN'), taskController.createTask);
router.get('/registration/:id', taskController.getTasksByRegistration);
router.post('/:id/submit', authorize('STUDENT'), taskController.submitTask);
router.post('/submission/:id/grade', authorize('LECTURER', 'ADMIN'), taskController.gradeSubmission);
router.patch('/:id/status', authorize('LECTURER', 'ADMIN'), taskController.updateTaskStatus);
router.post('/remind', authorize('LECTURER', 'ADMIN'), taskController.remindTasks);

module.exports = router;
