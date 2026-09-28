const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validate');

router.use(authenticate);

// 1. Danh sach Kho luu chieu toan khoa
router.get(
    '/',
    authorize('ADMIN', 'LECTURER'),
    [
        query('semesterId').optional().isInt({ min: 1 }),
        query('status').optional().isIn(['ALL', 'SUBMITTED', 'APPROVED', 'REVISION_REQUIRED']),
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        validateRequest,
    ],
    archiveController.getAllArchives,
);

// 2. Health Radar canh bao som tien do & luu chieu
router.get(
    '/health-radar',
    authorize('ADMIN', 'LECTURER'),
    [
        query('semesterId').optional().isInt({ min: 1 }),
        validateRequest,
    ],
    archiveController.getHealthRadarStats,
);

// 3. Lay ho so luu chieu cua 1 registration
router.get(
    '/registrations/:registrationId',
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    archiveController.getArchiveByRegistration,
);

// 4. Sinh vien nop hoac cap nhat ho so luu chieu
router.post(
    '/registrations/:registrationId',
    authorize('STUDENT', 'ADMIN'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('reportFileUrl').optional({ nullable: true }).isString(),
        body('reportFileName').optional({ nullable: true }).isString(),
        body('slideFileUrl').optional({ nullable: true }).isString(),
        body('slideFileName').optional({ nullable: true }).isString(),
        body('sourceCodeUrl').optional({ nullable: true }).isString(),
        body('demoVideoUrl').optional({ nullable: true }).isString(),
        body('bm03FileUrl').optional({ nullable: true }).isString(),
        body('bm04FileUrl').optional({ nullable: true }).isString(),
        body('summary').optional({ nullable: true }).isString(),
        validateRequest,
    ],
    archiveController.submitArchive,
);

// 5. GVHD / Admin nghiem thu ho so luu chieu
router.post(
    '/registrations/:registrationId/review',
    authorize('LECTURER', 'ADMIN'),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('decision').isIn(['APPROVED', 'REVISION_REQUIRED']).withMessage('decision phải là APPROVED hoặc REVISION_REQUIRED.'),
        body('reviewerNotes').optional({ nullable: true }).isString(),
        validateRequest,
    ],
    archiveController.reviewArchive,
);

// 6. Trich xuat Giay Xac Nhan Hoan Thanh Do An (Clearance Certificate)
router.get(
    '/registrations/:registrationId/clearance-certificate',
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    archiveController.getClearanceCertificate,
);

module.exports = router;
