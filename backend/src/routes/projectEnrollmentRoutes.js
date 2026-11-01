const express = require('express');
const { body, param, query } = require('express-validator');
const {
    listProjectCatalogs,
    listStudentProjectEnrollments,
    bulkUpsertStudentProjectEnrollments,
    deleteStudentProjectEnrollment,
    downloadEnrollmentTemplate,
    importEnrollmentsExcel,
    exportEnrollmentsExcel,
} = require('../controllers/projectEnrollmentController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

const router = express.Router();

router.use(authenticate);

router.get('/catalogs', authorizePermission(PERMISSIONS.PROJECT_CATALOG_MANAGE), listProjectCatalogs);
router.get('/template', authorizePermission(PERMISSIONS.ENROLLMENT_MANAGE), downloadEnrollmentTemplate);
router.post('/import-excel', authorizePermission(PERMISSIONS.ENROLLMENT_MANAGE), importEnrollmentsExcel);
router.get('/export-excel', authorizePermission(PERMISSIONS.ENROLLMENT_MANAGE), exportEnrollmentsExcel);

router.get(
    '/',
    [
        authorizePermission(PERMISSIONS.ENROLLMENT_MANAGE),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('studentId').optional().isInt({ min: 1 }).withMessage('studentId phải là số nguyên dương.'),
        query('projectCatalogId').optional().isInt({ min: 1 }).withMessage('projectCatalogId phải là số nguyên dương.'),
        query('source').optional().isIn(['MANUAL', 'EXCEL', 'SEED']).withMessage('source khong hop le.'),
        query('importBatchId').optional().isString().trim().notEmpty().withMessage('importBatchId khong hop le.'),
        validateRequest,
    ],
    listStudentProjectEnrollments,
);

router.post(
    '/bulk-upsert',
    [
        authorizePermission(PERMISSIONS.ENROLLMENT_MANAGE),
        body('items').isArray({ min: 1 }).withMessage('items phải là mảng không rỗng.'),
        body('items.*.studentId').isInt({ min: 1 }).withMessage('studentId không hợp lệ.'),
        body('items.*.semesterId').isInt({ min: 1 }).withMessage('semesterId không hợp lệ.'),
        body('items.*.projectCatalogId').isInt({ min: 1 }).withMessage('projectCatalogId không hợp lệ.'),
        body('items.*.status').optional().isIn(['ACTIVE', 'CANCELLED']).withMessage('status không hợp lệ.'),
        body('items.*.source').optional().isIn(['MANUAL', 'EXCEL', 'SEED']).withMessage('source không hợp lệ.'),
        validateRequest,
    ],
    bulkUpsertStudentProjectEnrollments,
);

router.delete(
    '/:id',
    [
        authorizePermission(PERMISSIONS.ENROLLMENT_MANAGE),
        param('id').isInt({ min: 1 }).withMessage('id không hợp lệ.'),
        validateRequest,
    ],
    deleteStudentProjectEnrollment,
);

module.exports = router;

