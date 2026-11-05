const router = require('express').Router();
const { authenticate, authorizePermission } = require('../middlewares/auth');
const delegationController = require('../controllers/delegationController');

router.use(authenticate);

router.get(
    '/',
    authorizePermission('PERMISSION_ASSIGN_ACADEMIC', 'VIEW_ACADEMIC_DELEGATIONS'),
    delegationController.getDelegations
);

router.post(
    '/',
    authorizePermission('PERMISSION_ASSIGN_ACADEMIC'),
    delegationController.createDelegation
);

router.delete(
    '/:id',
    authorizePermission('PERMISSION_ASSIGN_ACADEMIC'),
    delegationController.revokeDelegation
);

router.post(
    '/:id/revoke',
    authorizePermission('PERMISSION_ASSIGN_ACADEMIC'),
    delegationController.revokeDelegation
);

module.exports = router;
