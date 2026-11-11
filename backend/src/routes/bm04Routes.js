const express = require('express');
const router = express.Router();
const bm04Controller = require('../controllers/bm04Controller');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

// 0. List institute defense reviews (must precede /bm04/:registrationId to avoid route shadowing)
router.get(
    '/bm04/defense-reviews',
    authenticate,
    authorizePermission(PERMISSIONS.BM04_REJECTION_REVIEW, PERMISSIONS.BM04_REVIEW),
    bm04Controller.listDefenseReviewsController,
);

// 1. Get BM04 record (read-only)
router.get(
    '/bm04/:registrationId',
    authenticate,
    authorizePermission(
        PERMISSIONS.BM04_REVIEW,
        PERMISSIONS.BM04_CREATE_AND_SIGN,
        PERMISSIONS.BM04_SUBMIT,
        PERMISSIONS.VIEW_MY_REGISTRATION,
        PERMISSIONS.VIEW_BM04_EVALUATIONS,
    ),
    bm04Controller.getBM04RecordController,
);

// 2. Save BM04 draft (advisor only)
router.post(
    '/bm04/:registrationId/save-draft',
    authenticate,
    authorizePermission(PERMISSIONS.BM04_CREATE_AND_SIGN, PERMISSIONS.BM04_SUBMIT),
    bm04Controller.saveBM04DraftController,
);

// 3. Sign and submit BM04 (advisor only)
router.post(
    '/bm04/:registrationId/sign-submit',
    authenticate,
    authorizePermission(PERMISSIONS.BM04_CREATE_AND_SIGN, PERMISSIONS.BM04_SUBMIT),
    bm04Controller.signAndSubmitBM04Controller,
);

// 4. Institute request more info on defense review
router.post(
    '/bm04/defense-reviews/:id/request-more-info',
    authenticate,
    authorizePermission(PERMISSIONS.BM04_REJECTION_REVIEW),
    bm04Controller.requestMoreInfoForDefenseReviewController,
);

// 5. Institute decision on defense review
router.post(
    '/bm04/defense-reviews/:id/decision',
    authenticate,
    authorizePermission(PERMISSIONS.BM04_REJECTION_REVIEW),
    bm04Controller.decideDefenseReviewController,
);

// 6. Run sweep overdue jobs across BM02 to BM04
router.post(
    '/bm04/sweep-overdue',
    authenticate,
    authorizePermission(PERMISSIONS.BM04_REJECTION_REVIEW, PERMISSIONS.DEFENSE_COUNCIL_MANAGE),
    bm04Controller.runSweepJobsController,
);

module.exports = router;
