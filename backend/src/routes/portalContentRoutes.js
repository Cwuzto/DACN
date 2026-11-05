const router = require('express').Router();
const { authenticate, authorizePermission } = require('../middlewares/auth');
const { PERMISSIONS } = require('../constants/permissions');
const controller = require('../controllers/portalContentController');

router.get('/public', controller.getPublicContent);
router.get('/admin/:resourceType', authenticate, authorizePermission(PERMISSIONS.PORTAL_CONTENT_MANAGE), controller.listResources);
router.post('/:resourceType', authenticate, authorizePermission(PERMISSIONS.PORTAL_CONTENT_MANAGE), controller.createResource);
router.post('/:resourceType/:resourceId/drafts', authenticate, authorizePermission(PERMISSIONS.PORTAL_CONTENT_MANAGE), controller.createDraft);
router.post('/:resourceType/:resourceId/revisions/:revisionId/publish', authenticate, authorizePermission(PERMISSIONS.PORTAL_CONTENT_MANAGE), controller.publishDraft);
router.post('/:resourceType/:resourceId/archive', authenticate, authorizePermission(PERMISSIONS.PORTAL_CONTENT_MANAGE), controller.archive);

module.exports = router;
