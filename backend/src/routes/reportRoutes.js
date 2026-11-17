const express = require('express');
const { authenticateToken, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.use(authenticateToken);

const reportAccessGuard = authorizePermission(PERMISSIONS.REPORT_VIEW);

router.get('/overview', reportAccessGuard, reportController.getOverviewReport);
router.get('/lecturer-workload', reportAccessGuard, reportController.getLecturerWorkloadReport);
router.get('/export-excel', reportAccessGuard, reportController.exportAcademicSummaryExcel);

module.exports = router;
