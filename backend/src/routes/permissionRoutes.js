const router = require('express').Router();
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const permissionController = require('../controllers/permissionController');

router.use(authenticate, authorizePermission(PERMISSIONS.PERMISSION_GROUP_MANAGE));

router.get('/permissions', permissionController.listAllPermissions);
router.get('/matrix', permissionController.getMatrix);
router.post('/matrix/bulk', permissionController.bulkUpdateMatrix);
router.get('/permission-groups', permissionController.listAllGroups);
router.get('/permission-groups/:id', permissionController.getGroup);
router.post('/permission-groups', permissionController.createNewGroup);
router.put('/permission-groups/:id', permissionController.updateExistingGroup);
router.delete('/permission-groups/:id', permissionController.deleteExistingGroup);

module.exports = router;
