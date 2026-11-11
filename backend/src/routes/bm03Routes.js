const express = require('express');
const router = express.Router();
const bm03Controller = require('../controllers/bm03Controller');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

// 1. Get or create BM03 progress record
router.get(
    '/bm03/:registrationId',
    authenticate,
    bm03Controller.getBM03RecordController,
);

// 2. Create BM03 meeting entry (advisor only)
router.post(
    '/bm03/:registrationId/meetings',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_MEETING_RECORD),
    bm03Controller.createBM03MeetingController,
);

// 3. Sign BM03 meeting entry (advisor only)
router.post(
    '/bm03/meetings/:id/sign',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_MEETING_RECORD),
    bm03Controller.signBM03MeetingController,
);

// 4. Submit midterm evaluation
router.post(
    '/bm03/:registrationId/midterm-evaluation',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_STAGE_EVALUATE),
    bm03Controller.submitMidtermEvaluationController,
);

// 5. Submit final evaluation
router.post(
    '/bm03/:registrationId/final-evaluation',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_STAGE_EVALUATE),
    bm03Controller.submitFinalEvaluationController,
);

// 6. Institute request more info for stop review
router.get(
    '/bm03/stop-reviews',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_STOP_REVIEW, PERMISSIONS.VIEW_CHECKPOINTS),
    bm03Controller.listStopReviewsController,
);

router.post(
    '/bm03/stop-reviews/:id/request-more-info',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_STOP_REVIEW),
    bm03Controller.requestMoreInfoForStopReviewController,
);

// 7. Institute decision for stop review
router.post(
    '/bm03/stop-reviews/:id/decision',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_STOP_REVIEW),
    bm03Controller.decideStopReviewController,
);

// 8. Advisor signs whole BM03 form
router.post(
    '/bm03/:id/advisor-sign',
    authenticate,
    authorizePermission(PERMISSIONS.BM03_STAGE_EVALUATE, PERMISSIONS.BM03_MEETING_RECORD),
    bm03Controller.advisorSignWholeBM03Controller,
);

// 9. Student acknowledges BM03 form (48h window)
router.post(
    '/bm03/:id/student-acknowledge',
    authenticate,
    authorizePermission(
        PERMISSIONS.CHECKPOINT_SIGN,
        PERMISSIONS.SUBMIT_TASK,
        PERMISSIONS.VIEW_MY_REGISTRATION,
    ),
    bm03Controller.studentAcknowledgeBM03Controller,
);

// 10. Student declines to acknowledge BM03 form (with mandatory reason)
router.post(
    '/bm03/:id/student-decline',
    authenticate,
    authorizePermission(
        PERMISSIONS.CHECKPOINT_SIGN,
        PERMISSIONS.SUBMIT_TASK,
        PERMISSIONS.VIEW_MY_REGISTRATION,
    ),
    bm03Controller.studentDeclineBM03Controller,
);

module.exports = router;
