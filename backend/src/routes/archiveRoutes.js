const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const archiveController = require('../controllers/archiveController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');

router.use(authenticate);

// 1. Danh sach Kho luu chieu toan khoa
router.get(
    '/',
    authorizePermission(PERMISSIONS.FINAL_DOCUMENT_REVIEW),
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
    authorizePermission(PERMISSIONS.FINAL_DOCUMENT_REVIEW),
    [
        query('semesterId').optional().isInt({ min: 1 }),
        validateRequest,
    ],
    archiveController.getHealthRadarStats,
);

// 3. Lay ho so luu chieu cua 1 registration
router.get(
    '/registrations/:registrationId',
    authorizePermission(
        PERMISSIONS.VIEW_MY_ARCHIVE,
        PERMISSIONS.FINAL_DOCUMENT_REVIEW,
        PERMISSIONS.VIEW_PROJECT_OVERSIGHT,
    ),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    archiveController.getArchiveByRegistration,
);

const preDefenseGuards = [
    authorizePermission(PERMISSIONS.SUBMIT_PRE_DEFENSE_ARCHIVE),
    [
        (req, res, next) => {
            if (req.params.registrationId && !req.body.registrationId) {
                req.body.registrationId = parseInt(req.params.registrationId, 10);
            }
            next();
        },
        body('registrationId').optional().isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('reportFileUrl').optional({ nullable: true }).isString(),
        body('reportFileName').optional({ nullable: true }).isString(),
        body('slideFileUrl').optional({ nullable: true }).isString(),
        body('slideFileName').optional({ nullable: true }).isString(),
        body('sourceCodeUrl').optional({ nullable: true }).isString(),
        body('demoVideoUrl').optional({ nullable: true }).isString(),
        body('notes').optional({ nullable: true }).isString(),
        body('summary').optional({ nullable: true }).isString(),
        validateRequest,
    ],
];

// 3.5. Sinh vien nop ho so luu chieu so bo truoc bao ve (Pre-defense)
router.post(
    '/pre-defense',
    preDefenseGuards,
    archiveController.submitPreDefenseArchive,
);

router.post(
    '/registrations/:registrationId/pre-defense',
    [
        authorizePermission(PERMISSIONS.SUBMIT_PRE_DEFENSE_ARCHIVE),
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('reportFileUrl').optional({ nullable: true }).isString(),
        body('reportFileName').optional({ nullable: true }).isString(),
        body('slideFileUrl').optional({ nullable: true }).isString(),
        body('slideFileName').optional({ nullable: true }).isString(),
        body('sourceCodeUrl').optional({ nullable: true }).isString(),
        body('demoVideoUrl').optional({ nullable: true }).isString(),
        body('notes').optional({ nullable: true }).isString(),
        body('summary').optional({ nullable: true }).isString(),
        validateRequest,
    ],
    archiveController.submitPreDefenseArchive,
);

const finalArchiveGuards = [
    authorizePermission(PERMISSIONS.SUBMIT_FINAL_ARCHIVE),
    [
        (req, res, next) => {
            if (!req.body.registrationId && req.params.registrationId) {
                req.body.registrationId = parseInt(req.params.registrationId, 10);
            }
            next();
        },
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
];

// 4. Sinh vien nop hoac cap nhat ho so luu chieu
router.post(
    '/registrations/:registrationId',
    finalArchiveGuards,
    archiveController.submitArchive,
);

router.post(
    '/final',
    finalArchiveGuards,
    archiveController.submitArchive,
);

// 5. GVHD / Admin nghiem thu ho so luu chieu
router.post(
    '/registrations/:registrationId/review',
    authorizePermission(PERMISSIONS.FINAL_DOCUMENT_REVIEW),
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
    authorizePermission(
        PERMISSIONS.VIEW_CLEARANCE_CERTIFICATES,
        PERMISSIONS.VIEW_MY_ARCHIVE,
        PERMISSIONS.FINAL_DOCUMENT_REVIEW,
    ),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    archiveController.getClearanceCertificate,
);

// 7. Upload phien ban tai lieu bao ve / luu chieu (1 trong 4 loai)
const fileUploadGuards = [
    authorizePermission(
        PERMISSIONS.VIEW_MY_ARCHIVE,
        PERMISSIONS.SUBMIT_PRE_DEFENSE_ARCHIVE,
        PERMISSIONS.SUBMIT_FINAL_ARCHIVE,
        PERMISSIONS.FINAL_DOCUMENT_REVIEW,
    ),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('documentType').isString().notEmpty().withMessage('documentType không được để trống.'),
        body('fileUrl').isString().notEmpty().withMessage('fileUrl không được để trống.'),
        body('fileName').optional({ nullable: true }).isString(),
        body('fileSizeBytes').optional({ nullable: true }).isInt(),
        body('checksum').optional({ nullable: true }).isString(),
        validateRequest,
    ],
];

router.post(
    ['/registration/:registrationId/files', '/registrations/:registrationId/files'],
    fileUploadGuards,
    archiveController.uploadDocumentVersion,
);

// 8. Lay ho so 6 tai lieu bao ve & cua so thoi gian
const dossierGuards = [
    authorizePermission(
        PERMISSIONS.VIEW_MY_ARCHIVE,
        PERMISSIONS.FINAL_DOCUMENT_REVIEW,
        PERMISSIONS.VIEW_PROJECT_OVERSIGHT,
        PERMISSIONS.DEFENSE_COUNCIL_MANAGE,
        PERMISSIONS.VIEW_DEFENSE_GRADING,
        PERMISSIONS.DEFENSE_SCORE_SUBMIT,
        PERMISSIONS.DEFENSE_SCORE_VIEW,
    ),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
];

router.get(
    ['/registration/:registrationId/dossier', '/registrations/:registrationId/dossier'],
    dossierGuards,
    archiveController.getDefenseDossier,
);

// 9. Chup snapshot bat bien 00:00 ngay bao ve
const zeroHourSnapshotGuards = [
    authorizePermission(
        PERMISSIONS.DEFENSE_COUNCIL_MANAGE,
        PERMISSIONS.FINAL_DOCUMENT_REVIEW,
    ),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('capturedAt').optional({ nullable: true }).isISO8601(),
        validateRequest,
    ],
];

router.post(
    ['/registration/:registrationId/snapshots/defense-zero-hour', '/registrations/:registrationId/snapshots/defense-zero-hour'],
    zeroHourSnapshotGuards,
    archiveController.captureDefenseZeroHourSnapshot,
);

// 10. Dong cong nop luu chieu ngay thu 15
const closeWindowGuards = [
    authorizePermission(
        PERMISSIONS.DEFENSE_COUNCIL_MANAGE,
        PERMISSIONS.FINAL_DOCUMENT_REVIEW,
    ),
    [
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('closedAt').optional({ nullable: true }).isISO8601(),
        validateRequest,
    ],
];

router.post(
    ['/registration/:registrationId/close-window', '/registrations/:registrationId/close-window'],
    closeWindowGuards,
    archiveController.closeArchiveWindow,
);

// 11. GVHD duyệt chuyên môn/nội dung lưu chiểu (Tầng 1)
const mentorReviewGuards = [
    authorizePermission(PERMISSIONS.ARCHIVE_MENTOR_REVIEW),
    [
        param('id').optional().isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        param('registrationId').optional().isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('status').isIn(['APPROVED', 'REVISION_REQUIRED', 'REJECTED']).withMessage('status phải là APPROVED, REVISION_REQUIRED hoặc REJECTED.'),
        body('notes').optional({ nullable: true }).isString(),
        body('versionFeedbacks').optional().isArray(),
        validateRequest,
    ],
];

router.post(
    ['/:id/mentor-review', '/registrations/:registrationId/mentor-review'],
    mentorReviewGuards,
    archiveController.mentorReviewArchive,
);

// 12. Giáo vụ duyệt thủ tục/thành phần hồ sơ lưu chiểu (Tầng 2)
const academicAffairsReviewGuards = [
    authorizePermission(PERMISSIONS.ARCHIVE_ACADEMIC_AFFAIRS_REVIEW),
    [
        param('id').optional().isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        param('registrationId').optional().isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('status').isIn(['APPROVED', 'REVISION_REQUIRED', 'REJECTED']).withMessage('status phải là APPROVED, REVISION_REQUIRED hoặc REJECTED.'),
        body('notes').optional({ nullable: true }).isString(),
        body('versionFeedbacks').optional().isArray(),
        validateRequest,
    ],
];

router.post(
    ['/:id/academic-affairs-review', '/registrations/:registrationId/academic-affairs-review'],
    academicAffairsReviewGuards,
    archiveController.academicAffairsReviewArchive,
);

// 13. Viện trưởng ký Giấy xác nhận hoàn thành đồ án
const signCertificateGuards = [
    authorizePermission(PERMISSIONS.CLEARANCE_CERTIFICATE_SIGN),
    [
        param('id').optional().isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        param('registrationId').optional().isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('expectedPayloadHash').optional({ nullable: true }).isString(),
        validateRequest,
    ],
];

router.post(
    ['/:id/sign-certificate', '/registrations/:registrationId/sign-certificate'],
    signCertificateGuards,
    archiveController.signClearanceCertificate,
);

// 14. Trigger sweep job an toan
const sweepGuards = [
    authorizePermission(PERMISSIONS.DEFENSE_COUNCIL_MANAGE),
    [
        body('now').optional({ nullable: true }).isISO8601(),
        validateRequest,
    ],
];

router.post(
    '/sweep',
    sweepGuards,
    archiveController.runSweepJob,
);

module.exports = router;
