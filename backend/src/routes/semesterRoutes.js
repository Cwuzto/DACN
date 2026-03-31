const router = require('express').Router();
const semesterController = require('../controllers/semesterController');
const { authenticate, authorize } = require('../middlewares/auth');

router.get('/', authenticate, semesterController.getAllSemesters);
router.get('/:id', authenticate, semesterController.getSemesterById);

router.post('/', authenticate, authorize('ADMIN'), semesterController.createSemester);
router.put('/:id', authenticate, authorize('ADMIN'), semesterController.updateSemester);
router.patch(
    '/:id/registration-toggle',
    authenticate,
    authorize('ADMIN'),
    semesterController.toggleSemesterRegistration
);
router.delete('/:id', authenticate, authorize('ADMIN'), semesterController.deleteSemester);

module.exports = router;
