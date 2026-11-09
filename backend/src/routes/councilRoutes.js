const express = require('express');
const { body, param } = require('express-validator');
const prisma = require('../config/database');
const {
    authenticate,
    authorizeRole,
    authorizePermission,
    authorizeResolvedPermissions,
    authorizeRoleOrPermission,
    requireCouncilRole,
} = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { validateRequest } = require('../middlewares/validate');
const councilController = require('../controllers/councilController');

const router = express.Router();

router.use(authenticate);

const COUNCIL_PERMISSIONS = [
    PERMISSIONS.OUTLINE_COUNCIL_MANAGE,
    PERMISSIONS.DEFENSE_COUNCIL_MANAGE,
];

const permissionForCouncilType = (councilType) => (
    councilType === 'OUTLINE_REVIEW'
        ? PERMISSIONS.OUTLINE_COUNCIL_MANAGE
        : PERMISSIONS.DEFENSE_COUNCIL_MANAGE
);

const resolveCouncilPermissions = async (req) => {
    const councilId = parseInt(req.params.id, 10);
    const council = await prisma.council.findUnique({
        where: { id: councilId },
        select: { id: true, councilType: true },
    });
    if (!council) {
        const error = new Error('Không tìm thấy hội đồng.');
        error.statusCode = 404;
        throw error;
    }
    req.authorizationCouncil = council;

    const required = [permissionForCouncilType(council.councilType)];
    if (req.body?.councilType && req.body.councilType !== council.councilType) {
        required.push(permissionForCouncilType(req.body.councilType));
    }
    return [...new Set(required)];
};

const authorizeCouncilById = authorizeResolvedPermissions(
    COUNCIL_PERMISSIONS,
    resolveCouncilPermissions,
);

const authorizeCouncilCreate = authorizeResolvedPermissions(
    COUNCIL_PERMISSIONS,
    async (req) => permissionForCouncilType(req.body?.councilType || 'DEFENSE_COUNCIL'),
);

router.get(
    '/',
    authorizePermission(
        PERMISSIONS.VIEW_COUNCIL_ASSIGNMENTS,
        PERMISSIONS.NOTIFICATION_MANAGE,
        PERMISSIONS.PROJECT_OVERSIGHT_MANAGE,
        ...COUNCIL_PERMISSIONS,
    ),
    councilController.getAllCouncils
);
router.post(
    '/',
    [
        body('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        body('name').isString().trim().notEmpty().withMessage('name bắt buộc phải là chuỗi.'),
        body('councilType')
            .optional()
            .isIn(['OUTLINE_REVIEW', 'DEFENSE_COUNCIL'])
            .withMessage('councilType phải là OUTLINE_REVIEW hoặc DEFENSE_COUNCIL.'),
        body('location').optional({ nullable: true }).isString().withMessage('location phải là chuỗi.'),
        body('defenseDate')
            .optional({ nullable: true })
            .isISO8601()
            .withMessage('defenseDate không đúng định dạng ISO8601.'),
        body('members').optional().isArray().withMessage('members phải là mảng.'),
        body('members.*.lecturerId')
            .optional()
            .isInt({ min: 1 })
            .withMessage('lecturerId phải là số nguyên dương.'),
        body('members.*.roleInCouncil')
            .optional()
            .isIn(['CHAIRMAN', 'SECRETARY', 'REVIEWER'])
            .withMessage('roleInCouncil không hợp lệ.'),
        validateRequest,
    ],
    authorizeCouncilCreate,
    councilController.createCouncil
);
router.get('/:id', [param('id').isInt({ min: 1 }), validateRequest], authorizeCouncilById, councilController.getCouncilById);
router.get('/:id/logs', [param('id').isInt({ min: 1 }), validateRequest], authorizeCouncilById, councilController.getCouncilAuditLogs);
router.put(
    '/:id',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('name').optional().isString().trim().notEmpty().withMessage('name phải là chuỗi không rỗng.'),
        body('councilType')
            .optional()
            .isIn(['OUTLINE_REVIEW', 'DEFENSE_COUNCIL'])
            .withMessage('councilType phải là OUTLINE_REVIEW hoặc DEFENSE_COUNCIL.'),
        body('location').optional({ nullable: true }).isString().withMessage('location phải là chuỗi.'),
        body('defenseDate')
            .optional({ nullable: true })
            .isISO8601()
            .withMessage('defenseDate không đúng định dạng ISO8601.'),
        body('members').optional().isArray().withMessage('members phải là mảng.'),
        body('members.*.lecturerId')
            .optional()
            .isInt({ min: 1 })
            .withMessage('lecturerId phải là số nguyên dương.'),
        body('members.*.roleInCouncil')
            .optional()
            .isIn(['CHAIRMAN', 'SECRETARY', 'REVIEWER'])
            .withMessage('roleInCouncil không hợp lệ.'),
        validateRequest,
    ],
    authorizeCouncilById,
    councilController.updateCouncil
);
router.delete('/:id', [param('id').isInt({ min: 1 }), validateRequest], authorizeCouncilById, councilController.deleteCouncil);

router.post(
    '/auto-assign',
    [
        body('semesterId')
            .optional()
            .isInt({ min: 1 })
            .withMessage('semesterId phai la so nguyen duong.'),
        validateRequest,
    ],
    authorizePermission(PERMISSIONS.DEFENSE_COUNCIL_MANAGE),
    councilController.autoAssignRegistrationsToCouncils
);

router.post(
    '/auto-assign-outline',
    [
        body('semesterId')
            .isInt({ min: 1 })
            .withMessage('semesterId phải là số nguyên dương.'),
        validateRequest,
    ],
    authorizeRoleOrPermission(
        ['ADMIN'],
        [PERMISSIONS.OUTLINE_COUNCIL_MANAGE, PERMISSIONS.DEFENSE_COUNCIL_MANAGE]
    ),
    councilController.autoAssignOutlineCouncils
);

router.post(
    '/:id/results/reopen',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('reason')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('reason bắt buộc phải là chuỗi không rỗng.'),
        validateRequest,
    ],
    authorizeRole('ADMIN'),
    councilController.reopenCouncilResults
);

router.put(
    '/:id/schedule',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('defenseDate')
            .isISO8601()
            .withMessage('defenseDate không đúng định dạng ISO8601.'),
        body('meetingMode')
            .optional()
            .isIn(['OFFLINE', 'ONLINE', 'HYBRID', 'IN_PERSON', 'MICROSOFT_TEAMS'])
            .withMessage('meetingMode không hợp lệ.'),
        validateRequest,
    ],
    requireCouncilRole('CHAIRMAN'),
    councilController.publishCouncilSchedule
);

router.put(
    '/:id/results/:registrationId',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('initialOutcome')
            .isIn(['PASS', 'REVISION_REQUIRED', 'FAIL', 'ABSENT'])
            .withMessage('initialOutcome không hợp lệ.'),
        body('attendanceStatus')
            .isIn(['PRESENT', 'ABSENT', 'EXCUSED'])
            .withMessage('attendanceStatus không hợp lệ.'),
        validateRequest,
    ],
    requireCouncilRole('SECRETARY', 'CHAIRMAN'),
    councilController.saveDraftResults
);

router.post(
    '/:id/results/secretary-complete',
    [param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'), validateRequest],
    requireCouncilRole('SECRETARY', 'CHAIRMAN'),
    councilController.completeSecretaryReview
);

router.post(
    '/:id/results/return',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('returnReason')
            .isString()
            .trim()
            .notEmpty()
            .withMessage('returnReason bắt buộc phải là chuỗi không rỗng.'),
        validateRequest,
    ],
    requireCouncilRole('CHAIRMAN'),
    councilController.returnResultsToSecretary
);

router.post(
    '/:id/results/publish',
    [param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'), validateRequest],
    requireCouncilRole('CHAIRMAN'),
    councilController.publishCouncilResults
);

router.put(
    '/:id/revision-deadline',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('revisionDeadline')
            .isISO8601()
            .withMessage('revisionDeadline không đúng định dạng ISO8601.'),
        validateRequest,
    ],
    requireCouncilRole('CHAIRMAN'),
    councilController.setRevisionDeadline
);

router.post(
    '/:id/resubmissions/:registrationId/review',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        param('registrationId').isInt({ min: 1 }).withMessage('registrationId phải là số nguyên dương.'),
        body('decision')
            .isIn(['APPROVE', 'REJECT'])
            .withMessage('decision phải là APPROVE hoặc REJECT.'),
        validateRequest,
    ],
    requireCouncilRole('CHAIRMAN'),
    councilController.reviewResubmission
);

router.post(
    '/:id/finalize-resubmissions',
    [param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'), validateRequest],
    requireCouncilRole('CHAIRMAN', 'ADMIN'),
    councilController.finalizeResubmissions
);

router.post(
    '/:id/assign',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('registrationIds')
            .isArray({ min: 1 })
            .withMessage('registrationIds phải là mảng có ít nhất 1 phần tử.'),
        body('registrationIds.*')
            .isInt({ min: 1 })
            .withMessage('Mỗi registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    authorizeCouncilById,
    councilController.assignRegistrationsToCouncil
);
router.post(
    '/:id/remove-registration',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('registrationId')
            .isInt({ min: 1 })
            .withMessage('registrationId phải là số nguyên dương.'),
        validateRequest,
    ],
    authorizeCouncilById,
    councilController.removeRegistrationFromCouncil
);

module.exports = router;
