const {
  PERMISSIONS,
  PERMISSION_CATALOG,
  DEFAULT_GROUPS,
} = require('../../src/constants/permissions');

describe('portal content permission boundary', () => {
  test('grants portal content management only to the technical administrator default group', () => {
    const permission = PERMISSION_CATALOG.find(({ code }) => code === 'PORTAL_CONTENT_MANAGE');
    const groups = Object.fromEntries(DEFAULT_GROUPS.map((group) => [group.code, new Set(group.permissions)]));

    expect(PERMISSIONS.PORTAL_CONTENT_MANAGE).toBe('PORTAL_CONTENT_MANAGE');
    expect(permission).toMatchObject({
      code: 'PORTAL_CONTENT_MANAGE',
      module: 'PORTAL',
    });
    expect(groups.QUAN_TRI_VIEN.has('PORTAL_CONTENT_MANAGE')).toBe(true);
    expect(groups.GVHD.has('PORTAL_CONTENT_MANAGE')).toBe(false);
    expect(groups.VIEN_TRUONG.has('PORTAL_CONTENT_MANAGE')).toBe(false);
  });
});
