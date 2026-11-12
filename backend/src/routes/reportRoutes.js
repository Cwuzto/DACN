const express = require('express');
const { authenticateToken, authorizeRoleOrPermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.use(authenticateToken);

const reportAccessGuard = authorizeRoleOrPermission(
    ['ADMIN'],
    [
        PERMISSIONS.VIEW_PROJECT_OVERSIGHT,
        PERMISSIONS.PROJECT_OVERSIGHT_MANAGE,
    ],
);

router.get('/overview', reportAccessGuard, reportController.getOverviewReport);
router.get('/lecturer-workload', reportAccessGuard, reportController.getLecturerWorkloadReport);
router.get('/export-excel', reportAccessGuard, reportController.exportAcademicSummaryExcel);

module.exports = router;
