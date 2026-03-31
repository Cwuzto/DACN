const express = require('express');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const { validateRequest } = require('../middlewares/validate');
const councilController = require('../controllers/councilController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', councilController.getAllCouncils);
router.post(
    '/',
    [
        body('semesterId').isInt({ min: 1 }).withMessage('semesterId phải là số nguyên dương.'),
        body('name').isString().trim().notEmpty().withMessage('name bắt buộc phải là chuỗi.'),
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
            .isIn(['CHAIRMAN', 'SECRETARY', 'REVIEWER', 'MEMBER'])
            .withMessage('roleInCouncil không hợp lệ.'),
        validateRequest,
    ],
    councilController.createCouncil
);
router.get('/:id', [param('id').isInt({ min: 1 }), validateRequest], councilController.getCouncilById);
router.put(
    '/:id',
    [
        param('id').isInt({ min: 1 }).withMessage('id phải là số nguyên dương.'),
        body('name').optional().isString().trim().notEmpty().withMessage('name phải là chuỗi không rỗng.'),
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
            .isIn(['CHAIRMAN', 'SECRETARY', 'REVIEWER', 'MEMBER'])
            .withMessage('roleInCouncil không hợp lệ.'),
        validateRequest,
    ],
    councilController.updateCouncil
);
router.delete('/:id', [param('id').isInt({ min: 1 }), validateRequest], councilController.deleteCouncil);

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
    councilController.removeRegistrationFromCouncil
);

module.exports = router;

