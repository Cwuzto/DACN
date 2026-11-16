const { SupabaseStorageAdapter } = require('../../src/storage/supabaseStorageAdapter');

describe('Task 4: SupabaseStorageAdapter Service Tests', () => {
    let mockSupabase;
    let mockStorageBucket;
    let adapter;

    beforeEach(() => {
        mockStorageBucket = {
            upload: jest.fn().mockResolvedValue({ data: { path: 'test.pdf' }, error: null }),
            download: jest.fn().mockResolvedValue({ data: Buffer.from('file-content'), error: null }),
            remove: jest.fn().mockResolvedValue({ data: [{ name: 'test.pdf' }], error: null }),
            list: jest.fn().mockResolvedValue({
                data: [{ name: 'test.pdf', metadata: { size: 1024, mimetype: 'application/pdf', etag: '"123"' }, updated_at: '2026-11-17T00:00:00Z' }],
                error: null,
            }),
            move: jest.fn().mockResolvedValue({ data: { message: 'Successfully moved' }, error: null }),
            copy: jest.fn().mockResolvedValue({ data: { message: 'Successfully copied' }, error: null }),
            createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed-url' }, error: null }),
            createSignedUploadUrl: jest.fn().mockResolvedValue({ data: { url: 'https://example.com/signed-upload-url', token: 'upload-token' }, error: null }),
            getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/public-url' } }),
        };

        mockSupabase = {
            storage: {
                from: jest.fn().mockReturnValue(mockStorageBucket),
                createBucket: jest.fn(),
                updateBucket: jest.fn(),
                deleteBucket: jest.fn(),
            },
        };

        adapter = new SupabaseStorageAdapter({ supabaseClient: mockSupabase });
    });

    test('upload uses explicit bucket, objectKey and enforces upsert: false by default', async () => {
        const fileBuffer = Buffer.from('hello world');
        const result = await adapter.upload({
            bucket: 'hoc-vu',
            objectKey: 'bm01/uuid-file.pdf',
            data: fileBuffer,
            contentType: 'application/pdf',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('hoc-vu');
        expect(mockStorageBucket.upload).toHaveBeenCalledWith(
            'bm01/uuid-file.pdf',
            fileBuffer,
            expect.objectContaining({
                contentType: 'application/pdf',
                upsert: false,
            })
        );
        expect(result).toBeDefined();
        // Never call createBucket or updateBucket
        expect(mockSupabase.storage.createBucket).not.toHaveBeenCalled();
        expect(mockSupabase.storage.updateBucket).not.toHaveBeenCalled();
    });

    test('stat returns object metadata from storage list/query', async () => {
        const metadata = await adapter.stat({
            bucket: 'tam',
            objectKey: 'cho-kiem-tra/ngay-2026-11-17/phien-1/test.pdf',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('tam');
        expect(metadata).toBeDefined();
        expect(metadata.size).toBe(1024);
        expect(metadata.mimetype).toBe('application/pdf');
    });

    test('exists returns true when object exists and false when not found', async () => {
        const found = await adapter.exists({
            bucket: 'hoc-vu',
            objectKey: 'bm01/test.pdf',
        });
        expect(found).toBe(true);

        mockStorageBucket.list.mockResolvedValueOnce({ data: [], error: null });
        const notFound = await adapter.exists({
            bucket: 'hoc-vu',
            objectKey: 'bm01/missing.pdf',
        });
        expect(notFound).toBe(false);
    });

    test('move performs same-bucket move when fromBucket equals toBucket', async () => {
        await adapter.move({
            fromBucket: 'hoc-vu',
            fromKey: 'draft/doc.pdf',
            toBucket: 'hoc-vu',
            toKey: 'approved/doc.pdf',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('hoc-vu');
        expect(mockStorageBucket.move).toHaveBeenCalledWith('draft/doc.pdf', 'approved/doc.pdf');
    });

    test('move performs cross-bucket promotion (download -> upload -> delete) when buckets differ', async () => {
        await adapter.move({
            fromBucket: 'tam',
            fromKey: 'cho-kiem-tra/test.pdf',
            toBucket: 'hoc-vu',
            toKey: 'bm01/final.pdf',
            contentType: 'application/pdf',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('tam');
        expect(mockStorageBucket.download).toHaveBeenCalledWith('cho-kiem-tra/test.pdf');
        expect(mockSupabase.storage.from).toHaveBeenCalledWith('hoc-vu');
        expect(mockStorageBucket.upload).toHaveBeenCalledWith(
            'bm01/final.pdf',
            expect.any(Buffer),
            expect.objectContaining({ upsert: false })
        );
        // source file should be removed from tam
        expect(mockStorageBucket.remove).toHaveBeenCalledWith(['cho-kiem-tra/test.pdf']);
    });

    test('createSignedUrl requests 600s signed URL by default', async () => {
        const result = await adapter.createSignedUrl({
            bucket: 'hoc-vu',
            objectKey: 'bm01/private.pdf',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('hoc-vu');
        expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith('bm01/private.pdf', 600);
        expect(result.signedUrl).toBe('https://example.com/signed-url');
    });

    test('createSignedUploadUrl returns signed upload URL bound to exact object path', async () => {
        const result = await adapter.createSignedUploadUrl({
            bucket: 'tam',
            objectKey: 'cho-kiem-tra/upload.bin',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('tam');
        expect(mockStorageBucket.createSignedUploadUrl).toHaveBeenCalledWith('cho-kiem-tra/upload.bin');
        expect(result.url).toBe('https://example.com/signed-upload-url');
    });

    test('getPublicUrl returns public URL for cong-khai bucket', () => {
        const url = adapter.getPublicUrl({
            bucket: 'cong-khai',
            objectKey: 'thuong-hieu/logo.png',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('cong-khai');
        expect(mockStorageBucket.getPublicUrl).toHaveBeenCalledWith('thuong-hieu/logo.png');
        expect(url).toBe('https://example.com/public-url');
    });

    test('remove deletes the specified objectKey', async () => {
        await adapter.remove({
            bucket: 'tam',
            objectKey: 'staging/temp.pdf',
        });

        expect(mockSupabase.storage.from).toHaveBeenCalledWith('tam');
        expect(mockStorageBucket.remove).toHaveBeenCalledWith(['staging/temp.pdf']);
    });
});
