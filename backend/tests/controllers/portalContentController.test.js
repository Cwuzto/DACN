jest.mock('../../src/services/portalContentService', () => ({
  getPublicPortalContent: jest.fn(),
  createDraftRevision: jest.fn(),
  publishRevision: jest.fn(),
  archiveResource: jest.fn(),
  createPortalResource: jest.fn(),
  getAdminResources: jest.fn(),
}));

const portalContentService = require('../../src/services/portalContentService');
const { getPublicContent, createResource, listResources } = require('../../src/controllers/portalContentController');

describe('portal content controller', () => {
  test('returns the public projection without requiring authentication', async () => {
    portalContentService.getPublicPortalContent.mockResolvedValue({ configuration: null, links: [], templates: [], announcements: [] });
    const res = { json: jest.fn() };

    await getPublicContent({}, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { configuration: null, links: [], templates: [], announcements: [] },
    });
  });
});

test('creates and lists portal resource identities for a capability-authorized admin', async () => {
  portalContentService.createPortalResource.mockResolvedValue({ id: 31 });
  portalContentService.getAdminResources.mockResolvedValue([{ id: 31, revisions: [] }]);
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await createResource({ params: { resourceType: 'announcement' }, user: { id: 7 } }, res, next);
  expect(portalContentService.createPortalResource).toHaveBeenCalledWith({ resourceType: 'ANNOUNCEMENT', actorId: 7 });
  expect(res.status).toHaveBeenCalledWith(201);

  await listResources({ params: { resourceType: 'announcement' } }, res, next);
  expect(portalContentService.getAdminResources).toHaveBeenCalledWith('ANNOUNCEMENT');
  expect(res.json).toHaveBeenLastCalledWith({ success: true, data: [{ id: 31, revisions: [] }] });
});
