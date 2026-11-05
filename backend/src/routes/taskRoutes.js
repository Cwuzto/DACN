const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

router.use(authenticate);

router.post('/', authorizePermission(PERMISSIONS.BM03_SUBMIT), taskController.createTask);
router.get(
    '/registration/:id',
    authorizePermission(PERMISSIONS.VIEW_MY_SUBMISSIONS, PERMISSIONS.BM03_REVIEW),
    taskController.getTasksByRegistration,
);
router.post(
    '/:id/submit',
    authorizePermission(PERMISSIONS.SUBMIT_TASK),
    taskController.submitTask,
);
router.post(
    '/submission/:id/grade',
    authorizePermission(PERMISSIONS.BM03_CHECKPOINT_DECIDE),
    taskController.gradeSubmission,
);
router.patch(
    '/:id/status',
    authorizePermission(PERMISSIONS.BM03_SUBMIT),
    taskController.updateTaskStatus,
);
router.post(
    '/remind',
    authorizePermission(PERMISSIONS.BM03_SUBMIT),
    taskController.remindTasks,
);

module.exports = router;
