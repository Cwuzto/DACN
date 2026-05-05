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
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId pháº£i lĂ  sá»‘ nguyĂªn dÆ°Æ¡ng.'),
        query('studentId').optional().isInt({ min: 1 }).withMessage('studentId pháº£i lĂ  sá»‘ nguyĂªn dÆ°Æ¡ng.'),
        query('projectCatalogId').optional().isInt({ min: 1 }).withMessage('projectCatalogId pháº£i lĂ  sá»‘ nguyĂªn dÆ°Æ¡ng.'),
        query('source').optional().isIn(['MANUAL', 'EXCEL', 'SEED']).withMessage('source khong hop le.'),
        query('importBatchId').optional().isString().trim().notEmpty().withMessage('importBatchId khong hop le.'),
        validateRequest,
    ],
    listStudentProjectEnrollments,
);

router.post(
    '/bulk-upsert',
    [
        body('items').isArray({ min: 1 }).withMessage('items pháº£i lĂ  máº£ng khĂ´ng rá»—ng.'),
        body('items.*.studentId').isInt({ min: 1 }).withMessage('studentId khĂ´ng há»£p lá»‡.'),
        body('items.*.semesterId').isInt({ min: 1 }).withMessage('semesterId khĂ´ng há»£p lá»‡.'),
        body('items.*.projectCatalogId').isInt({ min: 1 }).withMessage('projectCatalogId khĂ´ng há»£p lá»‡.'),
        body('items.*.status').optional().isIn(['ACTIVE', 'CANCELLED']).withMessage('status khĂ´ng há»£p lá»‡.'),
        body('items.*.source').optional().isIn(['MANUAL', 'EXCEL', 'SEED']).withMessage('source khĂ´ng há»£p lá»‡.'),
        validateRequest,
    ],
    bulkUpsertStudentProjectEnrollments,
);

router.delete(
    '/:id',
    [param('id').isInt({ min: 1 }).withMessage('id khĂ´ng há»£p lá»‡.'), validateRequest],
    deleteStudentProjectEnrollment,
);

module.exports = router;

