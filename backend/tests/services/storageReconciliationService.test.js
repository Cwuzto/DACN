const {
    reconcileStoredAssets,
} = require('../../src/services/storageReconciliationService');

describe('storageReconciliationService', () => {
    let mockPrisma;
    let mockStorage;

    beforeEach(() => {
        mockPrisma = {
            storedAsset: {
                findMany: jest.fn().mockResolvedValue([]),
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({}),
                count: jest.fn().mockResolvedValue(0),
            },
        };

        mockStorage = {
            list: jest.fn().mockResolvedValue({ data: [], error: null }),
            stat: jest.fn().mockResolvedValue({ size: 1024 }),
            exists: jest.fn().mockResolvedValue(true),
        };
    });

    it('reports missing objects when DB has active asset but Storage does not contain object', async () => {
        mockPrisma.storedAsset.findMany.mockResolvedValue([
            {
                id: 'asset-active-missing',
                bucket: 'HOC_VU',
                objectKey: 'bm02/missing.pdf',
                status: 'ACTIVE',
            },
        ]);
        mockStorage.exists.mockResolvedValue(false); // Does not exist!

        const report = await reconcileStoredAssets({
            db: mockPrisma,
            storage: mockStorage,
            dryRun: true,
        });

        expect(report.scannedDbCount).toBe(1);
        expect(report.missingObjects).toHaveLength(1);
        expect(report.missingObjects[0]).toEqual(
            expect.objectContaining({
                assetId: 'asset-active-missing',
                bucket: 'HOC_VU',
                objectKey: 'bm02/missing.pdf',
            })
        );
    });

    it('reports orphan objects in dry-run without writing to DB', async () => {
        mockStorage.list.mockImplementation((folder, options) => {
            if (options?.bucket === 'hoc-vu') {
                return Promise.resolve({
                    data: [{ name: 'unknown-file.pdf', metadata: { size: 2048, mimetype: 'application/pdf' } }],
                    error: null,
                });
            }
            return Promise.resolve({ data: [], error: null });
        });
        mockPrisma.storedAsset.findUnique.mockResolvedValue(null);

        const report = await reconcileStoredAssets({
            db: mockPrisma,
            storage: mockStorage,
            dryRun: true,
        });

        expect(report.orphanObjects).toHaveLength(1);
        expect(report.orphanObjects[0].name).toBe('unknown-file.pdf');
        expect(mockPrisma.storedAsset.create).not.toHaveBeenCalled();
    });

    it('registers orphan storage object as ORPHANED with 30-day retention in live mode', async () => {
        const now = new Date('2026-11-17T10:00:00Z');
        mockStorage.list.mockImplementation((folder, options) => {
            if (options?.bucket === 'hoc-vu') {
                return Promise.resolve({
                    data: [{ name: 'stray-report.pdf', metadata: { size: 5000, mimetype: 'application/pdf' } }],
                    error: null,
                });
            }
            return Promise.resolve({ data: [], error: null });
        });
        mockPrisma.storedAsset.findUnique.mockResolvedValue(null);

        const report = await reconcileStoredAssets({
            db: mockPrisma,
            storage: mockStorage,
            dryRun: false,
            now,
        });

        expect(report.orphanObjects).toHaveLength(1);
        expect(mockPrisma.storedAsset.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'ORPHANED',
                    bucket: 'HOC_VU',
                    objectKey: 'stray-report.pdf',
                    retentionUntil: new Date('2026-12-17T10:00:00Z'), // 30 days later
                }),
            })
        );
    });
});
