const express = require('express');
const router = express.Router();
const bm02aController = require('../controllers/bm02aController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

// BM02-A Requests Endpoints
router.post(
    '/bm02a/requests',
    authenticate,
    authorizePermission(PERMISSIONS.RENAME_TOPIC),
    bm02aController.createBM02ARequestController,
);

router.post(
    '/bm02a/requests/:id/student-sign-submit',
    authenticate,
    authorizePermission(PERMISSIONS.RENAME_TOPIC),
    bm02aController.studentSignAndSubmitBM02AController,
);

router.post(
    '/bm02a/requests/:id/advisor-sign',
    authenticate,
    authorizePermission(PERMISSIONS.BM02A_ADVISOR_SIGN),
    bm02aController.advisorSignBM02AController,
);

router.post(
    '/bm02a/requests/:id/return',
    authenticate,
    authorizePermission(
        PERMISSIONS.BM02A_ADVISOR_SIGN,
        PERMISSIONS.BM02A_FINAL_APPROVE,
    ),
    bm02aController.returnBM02AController,
);

router.post(
    '/bm02a/requests/:id/department-sign',
    authenticate,
    authorizePermission(PERMISSIONS.BM02A_FINAL_APPROVE),
    bm02aController.departmentSignBM02AController,
);

router.post(
    '/bm02a/requests/:id/revise',
    authenticate,
    authorizePermission(PERMISSIONS.RENAME_TOPIC),
    bm02aController.reviseBM02AController,
);

router.get(
    '/bm02a/pending',
    authenticate,
    bm02aController.getPendingBM02AQueueController,
);

router.get(
    '/bm02a/requests/:id',
    authenticate,
    bm02aController.getBM02ARequestController,
);

router.get(
    '/bm02a/registrations/:registrationId',
    authenticate,
    bm02aController.getBM02ARequestsByRegistrationController,
);

// Title Adjustment Appendices Endpoints
router.post(
    '/title-adjustment-appendices',
    authenticate,
    authorizePermission(PERMISSIONS.TITLE_ADJUSTMENT_APPENDIX_ISSUE),
    bm02aController.createAppendixDraftController,
);

router.put(
    '/title-adjustment-appendices/:id/items',
    authenticate,
    authorizePermission(PERMISSIONS.TITLE_ADJUSTMENT_APPENDIX_ISSUE),
    bm02aController.updateAppendixItemsController,
);

router.post(
    '/title-adjustment-appendices/:id/issue',
    authenticate,
    authorizePermission(PERMISSIONS.TITLE_ADJUSTMENT_APPENDIX_ISSUE),
    bm02aController.issueAppendixController,
);

router.get(
    '/title-adjustment-appendices/:id',
    authenticate,
    bm02aController.getAppendixController,
);

router.get(
    '/title-adjustment-appendices/decisions/:decisionId',
    authenticate,
    bm02aController.getAppendicesByDecisionController,
);

module.exports = router;
