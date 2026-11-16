const router = require('express').Router();
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const permissionController = require('../controllers/permissionController');

router.use(authenticate);

// View permissions and matrix
router.get(
    '/permissions',
    authorizePermission(PERMISSIONS.VIEW_PERMISSIONS, PERMISSIONS.PERMISSION_GROUP_MANAGE),
    permissionController.listAllPermissions
);

router.get(
    '/matrix',
    authorizePermission(
        PERMISSIONS.VIEW_PERMISSIONS,
        PERMISSIONS.VIEW_PERMISSION_GROUPS,
        PERMISSIONS.PERMISSION_GROUP_MANAGE
    ),
    permissionController.getMatrix
);

router.post(
    '/matrix/bulk',
    authorizePermission(PERMISSIONS.PERMISSION_GROUP_MANAGE),
    permissionController.bulkUpdateMatrix
);

// View and mutate permission groups
router.get(
    '/permission-groups',
    authorizePermission(
        PERMISSIONS.VIEW_PERMISSION_GROUPS,
        PERMISSIONS.VIEW_PERMISSIONS,
        PERMISSIONS.PERMISSION_GROUP_MANAGE
    ),
    permissionController.listAllGroups
);

router.get(
    '/permission-groups/:id',
    authorizePermission(
        PERMISSIONS.VIEW_PERMISSION_GROUPS,
        PERMISSIONS.VIEW_PERMISSIONS,
        PERMISSIONS.PERMISSION_GROUP_MANAGE
    ),
    permissionController.getGroup
);

router.post(
    '/permission-groups',
    authorizePermission(PERMISSIONS.PERMISSION_GROUP_MANAGE),
    permissionController.createNewGroup
);

router.put(
    '/permission-groups/:id',
    authorizePermission(PERMISSIONS.PERMISSION_GROUP_MANAGE),
    permissionController.updateExistingGroup
);

router.delete(
    '/permission-groups/:id',
    authorizePermission(PERMISSIONS.PERMISSION_GROUP_MANAGE),
    permissionController.deleteExistingGroup
);

module.exports = router;
