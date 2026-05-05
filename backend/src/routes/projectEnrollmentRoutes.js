const express = require('express');
const { body, param, query } = require('express-validator');
const {
    listProjectCatalogs,
    listStudentProjectEnrollments,
    bulkUpsertStudentProjectEnrollments,
    deleteStudentProjectEnrollment,
} = require('../controllers/projectEnrollmentController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validate');

const router = express.Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/catalogs', listProjectCatalogs);

router.get(
    '/',
    [
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
    [param('id').isInt({ min: 1 }).withMessage('id không hợp lệ.'), validateRequest],
    deleteStudentProjectEnrollment,
);

module.exports = router;

