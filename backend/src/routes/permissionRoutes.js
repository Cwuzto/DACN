const router = require('express').Router();
const { authenticate, authorizePermission } = require('../middlewares/auth');
const permissionController = require('../controllers/permissionController');

router.use(authenticate, authorizePermission('PERMISSION_GROUP_MANAGE'));

router.get('/permissions', permissionController.listAllPermissions);
router.get('/permission-groups', permissionController.listAllGroups);
router.get('/permission-groups/:id', permissionController.getGroup);
router.post('/permission-groups', permissionController.createNewGroup);
router.put('/permission-groups/:id', permissionController.updateExistingGroup);
router.delete('/permission-groups/:id', permissionController.deleteExistingGroup);

module.exports = router;
