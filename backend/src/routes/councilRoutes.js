const express = require('express');
const { authenticate, authorize } = require('../middlewares/auth');
const councilController = require('../controllers/councilController');

const router = express.Router();

// Tất cả các route quản lý hội đồng đều yêu cầu quyền ADMIN
router.use(authenticate);
router.use(authorize('ADMIN')); // Require Admin

// CRUD Hội đồng
router.get('/', councilController.getAllCouncils);
router.post('/', councilController.createCouncil);
router.get('/:id', councilController.getCouncilById);
router.put('/:id', councilController.updateCouncil);
router.delete('/:id', councilController.deleteCouncil);

// Phân công Nhóm
router.post('/:id/assign', councilController.assignRegistrationsToCouncil);
router.post('/:id/remove-registration', councilController.removeRegistrationFromCouncil);

module.exports = router;
