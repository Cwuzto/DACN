jest.mock('../../src/config/database', () => ({
  $transaction: jest.fn(),
  portalContentRevision: {
    aggregate: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  publicAnnouncement: { update: jest.fn(), findMany: jest.fn() },
  portalConfiguration: { findUnique: jest.fn() },
  portalLink: { findMany: jest.fn() },
  portalTemplate: { findMany: jest.fn() },
}));

jest.mock('../../src/services/auditLogService', () => ({ auditLog: jest.fn() }));

const prisma = require('../../src/config/database');
const { auditLog } = require('../../src/services/auditLogService');
const {
  PERMISSIONS,
  PERMISSION_CATALOG,
  DEFAULT_GROUPS,
} = require('../../src/constants/permissions');
const { validatePortalPayload, createDraftRevision } = require('../../src/services/portalContentService');

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

describe('portal revision payload validation', () => {
  test('rejects an announcement that mixes a PDF attachment with rich text', () => {
    expect(() => validatePortalPayload('ANNOUNCEMENT', {
      title: 'Thông báo bảo vệ',
      type: 'PDF',
      fileUrl: 'https://storage.example.edu/notice.pdf',
      fileName: 'notice.pdf',
      richContentHtml: '<p>Nội dung không được phép đi kèm PDF</p>',
    })).toThrow('PDF announcement cannot include rich text');
  });
});

describe('portal revision drafts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates the next immutable draft version for a resource', async () => {
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.portalContentRevision.aggregate.mockResolvedValue({ _max: { version: 2 } });
    prisma.portalContentRevision.create.mockResolvedValue({
      id: 91,
      resourceType: 'ANNOUNCEMENT',
      resourceId: 18,
      version: 3,
      status: 'DRAFT',
      payload: { title: 'Thông báo mới', type: 'RICH_TEXT', richContentHtml: '<p>Nội dung</p>' },
      createdById: 7,
    });

    const draft = await createDraftRevision({
      resourceType: 'ANNOUNCEMENT',
      resourceId: 18,
      actorId: 7,
      payload: { title: 'Thông báo mới', type: 'RICH_TEXT', richContentHtml: '<p>Nội dung</p>' },
    });

    expect(prisma.portalContentRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        resourceType: 'ANNOUNCEMENT',
        resourceId: 18,
        version: 3,
        status: 'DRAFT',
        createdById: 7,
      }),
    });
    expect(draft.version).toBe(3);
    expect(draft.status).toBe('DRAFT');
    expect(auditLog).toHaveBeenCalledWith(7, 'PORTAL_CONTENT_DRAFT_CREATED', 'PortalContentRevision', 91, {
      resourceType: 'ANNOUNCEMENT',
      resourceId: 18,
      version: 3,
    }, null);
  });
});

describe('portal revision publication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('publishes only the matching draft and switches the announcement pointer transactionally', async () => {
    const { publishRevision } = require('../../src/services/portalContentService');
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.portalContentRevision.findUnique.mockResolvedValue({
      id: 91,
      resourceType: 'ANNOUNCEMENT',
      resourceId: 18,
      status: 'DRAFT',
      payload: { title: 'Thông báo mới', type: 'RICH_TEXT', richContentHtml: '<p>Nội dung</p>' },
    });
    prisma.portalContentRevision.update.mockResolvedValue({ id: 91, status: 'PUBLISHED' });
    prisma.publicAnnouncement.update.mockResolvedValue({ id: 18, currentPublishedRevisionId: 91 });

    await publishRevision({
      resourceType: 'ANNOUNCEMENT',
      resourceId: 18,
      revisionId: 91,
      actorId: 7,
    });

    expect(prisma.portalContentRevision.update).toHaveBeenCalledWith({
      where: { id: 91 },
      data: expect.objectContaining({ status: 'PUBLISHED', publishedById: 7 }),
    });
    expect(prisma.publicAnnouncement.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { currentPublishedRevisionId: 91 },
    });
  });
});

describe('portal resource archive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('archives an announcement by removing its public pointer without mutating its published revision', async () => {
    const { archiveResource } = require('../../src/services/portalContentService');
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.publicAnnouncement.update.mockResolvedValue({ id: 18, currentPublishedRevisionId: null });

    await archiveResource({ resourceType: 'ANNOUNCEMENT', resourceId: 18 });

    expect(prisma.publicAnnouncement.update).toHaveBeenCalledWith({
      where: { id: 18 },
      data: { currentPublishedRevisionId: null },
    });
    expect(prisma.portalContentRevision.update).not.toHaveBeenCalled();
  });
});

describe('portal public projection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns only published revision payloads without revision or actor metadata', async () => {
    const { getPublicPortalContent } = require('../../src/services/portalContentService');
    prisma.portalConfiguration.findUnique.mockResolvedValue({ currentPublishedRevisionId: null });
    prisma.portalLink.findMany.mockResolvedValue([]);
    prisma.portalTemplate.findMany.mockResolvedValue([]);
    prisma.publicAnnouncement.findMany.mockResolvedValue([{ id: 18, currentPublishedRevisionId: 91 }]);
    prisma.portalContentRevision.findMany.mockResolvedValue([
      {
        id: 91,
        resourceType: 'ANNOUNCEMENT',
        resourceId: 18,
        status: 'PUBLISHED',
        payload: { title: 'Thông báo công khai', type: 'RICH_TEXT', richContentHtml: '<p>Nội dung</p>' },
        createdById: 7,
        publishedById: 7,
      },
    ]);

    await expect(getPublicPortalContent()).resolves.toEqual({
      configuration: null,
      links: [],
      templates: [],
      announcements: [{
        id: 18,
        title: 'Thông báo công khai',
        type: 'RICH_TEXT',
        richContentHtml: '<p>Nội dung</p>',
      }],
    });
  });
});
