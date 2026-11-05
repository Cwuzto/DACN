const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');

// Public route: Danh sách giảng viên & hướng nghiên cứu công khai
router.get('/public-lecturers', userController.getPublicLecturers);

router.use(authenticate);

// Excel Template, Import, Export
router.get('/template', authorizePermission(PERMISSIONS.USER_IMPORT), userController.downloadUserTemplate);
router.post('/import-excel', authorizePermission(PERMISSIONS.USER_IMPORT), userController.importUsersExcel);
router.get('/export-excel', authorizePermission(PERMISSIONS.USER_IMPORT), userController.exportUsersExcel);

// CRUD
router.get('/', authorizePermission(PERMISSIONS.VIEW_USERS, PERMISSIONS.USER_MANAGE, PERMISSIONS.LECTURER_DIRECTORY_VIEW), userController.getAllUsers);
router.post('/', authorizePermission(PERMISSIONS.USER_MANAGE), userController.createUser);
router.put('/:id', authorizePermission(PERMISSIONS.USER_MANAGE), userController.updateUser);
router.delete('/:id', authorizePermission(PERMISSIONS.USER_MANAGE), userController.deleteUser);

// Permission groups
router.get('/:id/permissions', authorizePermission(PERMISSIONS.PERMISSION_GROUP_MANAGE), userController.getUserPermissions);
router.post('/:id/permission-groups', authorizePermission(PERMISSIONS.PERMISSION_GROUP_MANAGE), userController.updateUserPermissionGroups);

// Lock/Unlock
router.patch('/:id/toggle-active', authorizePermission(PERMISSIONS.USER_MANAGE), userController.toggleActive);

// Reset password
router.post('/:id/reset-password', authorizePermission(PERMISSIONS.USER_MANAGE), userController.resetPassword);

module.exports = router;
