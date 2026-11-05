const portalContentService = require('../services/portalContentService');

const parsePositiveInt = (value, label) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${label} không hợp lệ.`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const getPublicContent = async (req, res, next) => {
  try {
    const data = await portalContentService.getPublicPortalContent();
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const normalizeResourceType = (value) => String(value || '').toUpperCase();

const createResource = async (req, res, next) => {
  try {
    const data = await portalContentService.createPortalResource({
      resourceType: normalizeResourceType(req.params.resourceType),
      actorId: req.user.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const listResources = async (req, res, next) => {
  try {
    const data = await portalContentService.getAdminResources(normalizeResourceType(req.params.resourceType));
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const createDraft = async (req, res, next) => {
  try {
    const data = await portalContentService.createDraftRevision({
      resourceType: normalizeResourceType(req.params.resourceType),
      resourceId: parsePositiveInt(req.params.resourceId, 'Resource'),
      payload: req.body,
      actorId: req.user.id,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const publishDraft = async (req, res, next) => {
  try {
    const data = await portalContentService.publishRevision({
      resourceType: normalizeResourceType(req.params.resourceType),
      resourceId: parsePositiveInt(req.params.resourceId, 'Resource'),
      revisionId: parsePositiveInt(req.params.revisionId, 'Revision'),
      actorId: req.user.id,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const archive = async (req, res, next) => {
  try {
    const data = await portalContentService.archiveResource({
      resourceType: normalizeResourceType(req.params.resourceType),
      resourceId: parsePositiveInt(req.params.resourceId, 'Resource'),
    });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getPublicContent, createResource, listResources, createDraft, publishDraft, archive };
