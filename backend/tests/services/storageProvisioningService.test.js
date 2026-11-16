const { provisionStorageBuckets } = require('../../src/services/storageProvisioningService');
const { STORAGE_BUCKETS, BUCKET_PRIVACY } = require('../../src/config/storageConfig');

describe('storageProvisioningService', () => {
    let mockStorage;

    beforeEach(() => {
        mockStorage = {
            listBuckets: jest.fn(),
            createBucket: jest.fn(),
            updateBucket: jest.fn(),
        };
    });

    it('should throw if storage instance is missing', async () => {
        await expect(provisionStorageBuckets({})).rejects.toThrow(/storage/i);
    });

    it('should handle listBuckets failure', async () => {
        mockStorage.listBuckets.mockResolvedValue({
            data: null,
            error: new Error('Storage service unavailable'),
        });

        await expect(provisionStorageBuckets({ storage: mockStorage })).rejects.toThrow(
            'Storage service unavailable'
        );
    });

    describe('dryRun = true (default)', () => {
        it('should plan creation of missing buckets without calling createBucket', async () => {
            mockStorage.listBuckets.mockResolvedValue({
                data: [],
                error: null,
            });

            const report = await provisionStorageBuckets({ storage: mockStorage });

            expect(report.dryRun).toBe(true);
            expect(report.actions).toHaveLength(4);
            expect(mockStorage.createBucket).not.toHaveBeenCalled();
            expect(mockStorage.updateBucket).not.toHaveBeenCalled();

            for (const [key, name] of Object.entries(STORAGE_BUCKETS)) {
                const action = report.actions.find((a) => a.bucket === name);
                expect(action).toBeDefined();
                expect(action.action).toBe('create');
                expect(action.public).toBe(BUCKET_PRIVACY[name]);
            }
        });

        it('should detect privacy drift without modifying bucket in dryRun', async () => {
            mockStorage.listBuckets.mockResolvedValue({
                data: [
                    { name: 'cong-khai', public: true },
                    { name: 'hoc-vu', public: true }, // DRIFT: should be false
                    { name: 'ca-nhan', public: false },
                    { name: 'tam', public: false },
                ],
                error: null,
            });

            const report = await provisionStorageBuckets({ storage: mockStorage, dryRun: true });

            expect(report.dryRun).toBe(true);
            expect(mockStorage.updateBucket).not.toHaveBeenCalled();

            const hocVuAction = report.actions.find((a) => a.bucket === 'hoc-vu');
            expect(hocVuAction).toBeDefined();
            expect(hocVuAction.action).toBe('update');
            expect(hocVuAction.drift).toBe(true);
            expect(hocVuAction.currentPublic).toBe(true);
            expect(hocVuAction.expectedPublic).toBe(false);

            const congKhaiAction = report.actions.find((a) => a.bucket === 'cong-khai');
            expect(congKhaiAction.action).toBe('match');
        });
    });

    describe('dryRun = false (apply mode)', () => {
        it('should create missing buckets with exact privacy', async () => {
            mockStorage.listBuckets.mockResolvedValue({
                data: [{ name: 'cong-khai', public: true }],
                error: null,
            });
            mockStorage.createBucket.mockResolvedValue({ data: { name: 'created' }, error: null });

            const report = await provisionStorageBuckets({ storage: mockStorage, dryRun: false });

            expect(report.dryRun).toBe(false);
            expect(mockStorage.createBucket).toHaveBeenCalledTimes(3);
            expect(mockStorage.createBucket).toHaveBeenCalledWith('hoc-vu', { public: false });
            expect(mockStorage.createBucket).toHaveBeenCalledWith('ca-nhan', { public: false });
            expect(mockStorage.createBucket).toHaveBeenCalledWith('tam', { public: false });
            expect(mockStorage.updateBucket).not.toHaveBeenCalled();
        });

        it('should correct privacy drift by updating bucket', async () => {
            mockStorage.listBuckets.mockResolvedValue({
                data: [
                    { name: 'cong-khai', public: false }, // DRIFT: should be true
                    { name: 'hoc-vu', public: false },
                    { name: 'ca-nhan', public: false },
                    { name: 'tam', public: false },
                ],
                error: null,
            });
            mockStorage.updateBucket.mockResolvedValue({ data: { message: 'ok' }, error: null });

            const report = await provisionStorageBuckets({ storage: mockStorage, dryRun: false });

            expect(report.dryRun).toBe(false);
            expect(mockStorage.updateBucket).toHaveBeenCalledTimes(1);
            expect(mockStorage.updateBucket).toHaveBeenCalledWith('cong-khai', { public: true });
        });

        it('should be completely idempotent when all buckets exist and match', async () => {
            mockStorage.listBuckets.mockResolvedValue({
                data: [
                    { name: 'cong-khai', public: true },
                    { name: 'hoc-vu', public: false },
                    { name: 'ca-nhan', public: false },
                    { name: 'tam', public: false },
                ],
                error: null,
            });

            const report = await provisionStorageBuckets({ storage: mockStorage, dryRun: false });

            expect(mockStorage.createBucket).not.toHaveBeenCalled();
            expect(mockStorage.updateBucket).not.toHaveBeenCalled();
            expect(report.actions.every((a) => a.action === 'match')).toBe(true);
        });

        it('should throw if createBucket fails', async () => {
            mockStorage.listBuckets.mockResolvedValue({ data: [], error: null });
            mockStorage.createBucket.mockResolvedValue({
                data: null,
                error: new Error('Failed to create bucket hoc-vu'),
            });

            await expect(
                provisionStorageBuckets({ storage: mockStorage, dryRun: false })
            ).rejects.toThrow('Failed to create bucket hoc-vu');
        });
    });
});
