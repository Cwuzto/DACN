const express = require('express');
const { body, param, query } = require('express-validator');
const {
    listLecturerAssignments,
    createLecturerAssignment,
    updateLecturerAssignment,
    deleteLecturerAssignment,
    bulkUpsertLecturerAssignments,
    getRoundCoordinationOverview,
} = require('../controllers/lecturerAssignmentController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

const router = express.Router();

router.use(authenticate);

// Overview / metrics for a round
router.get(
    '/overview',
    [
        authorizePermission(
            PERMISSIONS.VIEW_PROJECT_ENROLLMENTS,
            PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC,
            PERMISSIONS.MENTOR_ASSIGN,
            PERMISSIONS.LECTURER_DIRECTORY_VIEW,
            PERMISSIONS.SEMESTER_MANAGE
        ),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('projectCatalogId').optional().isInt({ min: 1 }).withMessage('projectCatalogId phải là số nguyên dương.'),
        validateRequest,
    ],
    getRoundCoordinationOverview
);

// Bulk upsert assignments (e.g. from Excel or multi-row editor)
router.post(
    '/bulk-upsert',
    [
        authorizePermission(PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC, PERMISSIONS.MENTOR_ASSIGN),
        body('items').isArray({ min: 1 }).withMessage('items phải là mảng không rỗng.'),
        body('items.*.lecturerId').isInt({ min: 1 }).withMessage('lecturerId không hợp lệ.'),
        body('items.*.semesterId').isInt({ min: 1 }).withMessage('semesterId không hợp lệ.'),
        body('items.*.projectCatalogId').isInt({ min: 1 }).withMessage('projectCatalogId không hợp lệ.'),
        body('items.*.plannedQuota').optional().isInt({ min: 1, max: 10 }).withMessage('plannedQuota phải từ 1 đến 10.'),
        body('items.*.status').optional().isIn(['DRAFT', 'ACTIVE', 'CLOSED']).withMessage('status không hợp lệ.'),
        validateRequest,
    ],
    bulkUpsertLecturerAssignments
);

// List lecturer assignments
router.get(
    '/',
    [
        authorizePermission(
            PERMISSIONS.VIEW_PROJECT_ENROLLMENTS,
            PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC,
            PERMISSIONS.MENTOR_ASSIGN,
            PERMISSIONS.LECTURER_DIRECTORY_VIEW,
            PERMISSIONS.SEMESTER_MANAGE
        ),
        query('semesterId').optional().isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        query('projectCatalogId').optional().isInt({ min: 1 }).withMessage('projectCatalogId phải là số nguyên dương.'),
        query('lecturerId').optional().isInt({ min: 1 }).withMessage('lecturerId phải là số nguyên dương.'),
        query('status').optional().isIn(['DRAFT', 'ACTIVE', 'CLOSED']).withMessage('status không hợp lệ.'),
        validateRequest,
    ],
    listLecturerAssignments
);

// Create lecturer assignment
router.post(
    '/',
    [
        authorizePermission(PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC, PERMISSIONS.MENTOR_ASSIGN),
        body('lecturerId').isInt({ min: 1 }).withMessage('lecturerId phải là số nguyên dương.'),
        body('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        body('projectCatalogId').isInt({ min: 1 }).withMessage('projectCatalogId phải là số nguyên dương.'),
        body('plannedQuota').optional().isInt({ min: 1 }).withMessage('plannedQuota phải là số nguyên dương.'),
        body('status').optional().isIn(['DRAFT', 'ACTIVE', 'CLOSED']).withMessage('status không hợp lệ.'),
        validateRequest,
    ],
    createLecturerAssignment
);

// Update lecturer assignment
router.put(
    '/:id',
    [
        authorizePermission(PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC, PERMISSIONS.MENTOR_ASSIGN),
        param('id').isInt({ min: 1 }).withMessage('id không hợp lệ.'),
        body('plannedQuota').optional().isInt({ min: 1 }).withMessage('plannedQuota phải là số nguyên dương.'),
        body('status').optional().isIn(['DRAFT', 'ACTIVE', 'CLOSED']).withMessage('status không hợp lệ.'),
        validateRequest,
    ],
    updateLecturerAssignment
);

// Delete or close lecturer assignment
router.delete(
    '/:id',
    [
        authorizePermission(PERMISSIONS.PERMISSION_ASSIGN_ACADEMIC, PERMISSIONS.MENTOR_ASSIGN),
        param('id').isInt({ min: 1 }).withMessage('id không hợp lệ.'),
        validateRequest,
    ],
    deleteLecturerAssignment
);

module.exports = router;
