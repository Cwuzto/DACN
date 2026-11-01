jest.mock('../../src/services/portalContentService', () => ({
  getPublicPortalContent: jest.fn(),
  createDraftRevision: jest.fn(),
  publishRevision: jest.fn(),
  archiveResource: jest.fn(),
}));

const portalContentService = require('../../src/services/portalContentService');
const { getPublicContent } = require('../../src/controllers/portalContentController');

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
