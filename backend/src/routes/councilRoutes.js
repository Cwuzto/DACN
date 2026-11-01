const express = require('express');
const { body, param } = require('express-validator');
const prisma = require('../config/database');
const {
    authenticate,
    authorizePermission,
    authorizeResolvedPermissions,
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

router.get('/', authorizePermission(...COUNCIL_PERMISSIONS), councilController.getAllCouncils);
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
