const prisma = require('../config/database');
const { auditLog } = require('./auditLogService');

const RESOURCE_TYPES = new Set(['CONFIGURATION', 'LINK', 'TEMPLATE', 'ANNOUNCEMENT']);
const RESOURCE_MODEL_BY_TYPE = {
  CONFIGURATION: 'portalConfiguration',
  LINK: 'portalLink',
  TEMPLATE: 'portalTemplate',
  ANNOUNCEMENT: 'publicAnnouncement',
};

const requireNonEmptyString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
};

const validateAnnouncementPayload = (payload) => {
  requireNonEmptyString(payload?.title, 'Announcement title');

  if (payload.type === 'PDF') {
    requireNonEmptyString(payload.fileUrl, 'PDF fileUrl');
    requireNonEmptyString(payload.fileName, 'PDF fileName');
    if (payload.richContentHtml) throw new Error('PDF announcement cannot include rich text');
    return;
  }

  if (payload.type === 'RICH_TEXT') {
    requireNonEmptyString(payload.richContentHtml, 'Rich text content');
    if (payload.fileUrl || payload.fileName) throw new Error('Rich text announcement cannot include a PDF attachment');
    return;
  }

  throw new Error('Announcement type must be PDF or RICH_TEXT');
};

const validatePortalPayload = (resourceType, payload) => {
  if (!RESOURCE_TYPES.has(resourceType)) throw new Error('Unsupported portal resource type');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Portal payload must be an object');

  if (resourceType === 'ANNOUNCEMENT') validateAnnouncementPayload(payload);
  return payload;
};

const createDraftRevision = async ({ resourceType, resourceId, payload, actorId }) => {
  if (!Number.isInteger(resourceId) || resourceId <= 0) throw new Error('Portal resource id must be a positive integer');
  validatePortalPayload(resourceType, payload);

  const draft = await prisma.$transaction(async (tx) => {
    const latest = await tx.portalContentRevision.aggregate({
      where: { resourceType, resourceId },
      _max: { version: true },
    });

    return tx.portalContentRevision.create({
      data: {
        resourceType,
        resourceId,
        version: (latest._max.version || 0) + 1,
        status: 'DRAFT',
        payload,
        createdById: actorId || null,
      },
    });
  });
  await auditLog(actorId || null, 'PORTAL_CONTENT_DRAFT_CREATED', 'PortalContentRevision', draft.id, {
    resourceType,
    resourceId,
    version: draft.version,
  }, null);
  return draft;
};

const publishRevision = async ({ resourceType, resourceId, revisionId, actorId }) => {
  if (!RESOURCE_TYPES.has(resourceType)) throw new Error('Unsupported portal resource type');
  if (!Number.isInteger(resourceId) || resourceId <= 0) throw new Error('Portal resource id must be a positive integer');
  if (!Number.isInteger(revisionId) || revisionId <= 0) throw new Error('Portal revision id must be a positive integer');

  return prisma.$transaction(async (tx) => {
    const revision = await tx.portalContentRevision.findUnique({ where: { id: revisionId } });
    if (!revision || revision.resourceType !== resourceType || revision.resourceId !== resourceId) {
      throw new Error('Portal revision does not belong to this resource');
    }
    if (revision.status !== 'DRAFT') throw new Error('Only draft portal revisions can be published');

    const published = await tx.portalContentRevision.update({
      where: { id: revisionId },
      data: { status: 'PUBLISHED', publishedById: actorId || null, publishedAt: new Date() },
    });
    await tx[RESOURCE_MODEL_BY_TYPE[resourceType]].update({
      where: { id: resourceId },
      data: { currentPublishedRevisionId: revisionId },
    });
    return published;
  });
};

const archiveResource = async ({ resourceType, resourceId }) => {
  if (!RESOURCE_TYPES.has(resourceType)) throw new Error('Unsupported portal resource type');
  if (!Number.isInteger(resourceId) || resourceId <= 0) throw new Error('Portal resource id must be a positive integer');

  return prisma.$transaction((tx) => tx[RESOURCE_MODEL_BY_TYPE[resourceType]].update({
    where: { id: resourceId },
    data: { currentPublishedRevisionId: null },
  }));
};

const getPublicPortalContent = async () => {
  const [configuration, links, templates, announcements] = await Promise.all([
    prisma.portalConfiguration.findUnique({ where: { id: 1 }, select: { currentPublishedRevisionId: true } }),
    prisma.portalLink.findMany({ select: { id: true, currentPublishedRevisionId: true } }),
    prisma.portalTemplate.findMany({ select: { id: true, currentPublishedRevisionId: true } }),
    prisma.publicAnnouncement.findMany({
      where: { currentPublishedRevisionId: { not: null } },
      select: { id: true, currentPublishedRevisionId: true },
    }),
  ]);

  const pointers = [
    configuration?.currentPublishedRevisionId,
    ...links.map((item) => item.currentPublishedRevisionId),
    ...templates.map((item) => item.currentPublishedRevisionId),
    ...announcements.map((item) => item.currentPublishedRevisionId),
  ].filter(Boolean);
  const revisions = pointers.length
    ? await prisma.portalContentRevision.findMany({
      where: { id: { in: pointers }, status: 'PUBLISHED' },
      select: { id: true, resourceType: true, resourceId: true, payload: true },
    })
    : [];
  const payloadByRevision = new Map(revisions.map((revision) => [revision.id, revision.payload]));
  const withPayload = (resource) => ({ id: resource.id, ...(payloadByRevision.get(resource.currentPublishedRevisionId) || {}) });

  return {
    configuration: payloadByRevision.get(configuration?.currentPublishedRevisionId) || null,
    links: links.filter((item) => payloadByRevision.has(item.currentPublishedRevisionId)).map(withPayload),
    templates: templates.filter((item) => payloadByRevision.has(item.currentPublishedRevisionId)).map(withPayload),
    announcements: announcements.filter((item) => payloadByRevision.has(item.currentPublishedRevisionId)).map(withPayload),
  };
};

module.exports = {
  validatePortalPayload,
  createDraftRevision,
  publishRevision,
  archiveResource,
  getPublicPortalContent,
};
