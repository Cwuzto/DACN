const {
  isAllowedPortalMime,
  PORTAL_IMAGE_MIME_TYPES,
  PORTAL_DOCUMENT_MIME_TYPES,
} = require('../../src/middlewares/portalUpload');

describe('portal upload allow-list', () => {
  test('accepts only configured image and document MIME types', () => {
    expect(PORTAL_IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    expect(PORTAL_DOCUMENT_MIME_TYPES).toEqual([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    expect(isAllowedPortalMime('image', 'image/png')).toBe(true);
    expect(isAllowedPortalMime('document', 'application/pdf')).toBe(true);
    expect(isAllowedPortalMime('document', 'application/zip')).toBe(false);
    expect(isAllowedPortalMime('image', 'image/svg+xml')).toBe(false);
  });
});
