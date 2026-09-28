const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate, authorize, authorizePermission } = require('../middlewares/auth');

// Public route: Danh sách giảng viên & hướng nghiên cứu công khai
router.get('/public-lecturers', userController.getPublicLecturers);

// Tất cả route bên dưới đều cần authenticate + ADMIN
router.use(authenticate);
router.use(authorize('ADMIN'));

// Excel Template, Import, Export
router.get('/template', userController.downloadUserTemplate);
router.post('/import-excel', userController.importUsersExcel);
router.get('/export-excel', userController.exportUsersExcel);

// CRUD
router.get('/', userController.getAllUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

// Permission groups
router.get('/:id/permissions', userController.getUserPermissions);
router.post('/:id/permission-groups', userController.updateUserPermissionGroups);

// Lock/Unlock
router.patch('/:id/toggle-active', userController.toggleActive);

// Reset password
router.post('/:id/reset-password', userController.resetPassword);

module.exports = router;
