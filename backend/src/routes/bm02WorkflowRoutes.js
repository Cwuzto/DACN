const express = require('express');
const router = express.Router();
const bm02WorkflowController = require('../controllers/bm02WorkflowController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

// BM02 Application endpoints
router.post(
    '/bm02/applications/:registrationId/submit',
    authenticate,
    authorizePermission(PERMISSIONS.SUBMIT_BM02),
    bm02WorkflowController.submitBM02Application,
);

router.post(
    '/bm02/applications/:id/request-revision',
    authenticate,
    authorizePermission(PERMISSIONS.BM02_REVIEW),
    bm02WorkflowController.requestBM02Revision,
);

router.post(
    '/bm02/applications/:id/resubmit',
    authenticate,
    authorizePermission(PERMISSIONS.SUBMIT_BM02),
    bm02WorkflowController.resubmitBM02Application,
);

router.post(
    '/bm02/applications/:id/approve',
    authenticate,
    authorizePermission(PERMISSIONS.BM02_REVIEW),
    bm02WorkflowController.approveBM02Application,
);

// Topic Assignment Decision endpoints
router.post(
    '/topic-decisions',
    authenticate,
    authorizePermission(
        PERMISSIONS.TOPIC_ASSIGNMENT_DECISION_ISSUE,
        PERMISSIONS.PROJECT_ASSIGNMENT_PUBLISH,
    ),
    bm02WorkflowController.createTopicDecisionController,
);

router.post(
    '/topic-decisions/:id/publish',
    authenticate,
    authorizePermission(
        PERMISSIONS.TOPIC_ASSIGNMENT_DECISION_ISSUE,
        PERMISSIONS.PROJECT_ASSIGNMENT_PUBLISH,
    ),
    bm02WorkflowController.publishTopicDecisionController,
);

module.exports = router;
