const {
    STORAGE_BUCKETS,
    BUCKET_PRIVACY,
    SIGNED_URL_TTL_SECONDS,
    MAX_UPLOAD_BYTES,
    TUS_THRESHOLD_BYTES,
    TUS_CHUNK_BYTES,
    getStorageTusEndpoint,
    assertStorageEnvironment,
} = require('../../src/config/storageConfig');

describe('storageConfig', () => {
    describe('STORAGE_BUCKETS', () => {
        it('should define exact 4 bucket names without dacn prefix', () => {
            expect(STORAGE_BUCKETS).toEqual({
                PUBLIC: 'cong-khai',
                ACADEMIC: 'hoc-vu',
                PERSONAL: 'ca-nhan',
                TEMP: 'tam',
            });
            expect(Object.isFrozen(STORAGE_BUCKETS)).toBe(true);
        });

        it('should have correct bucket privacy definitions', () => {
            expect(BUCKET_PRIVACY).toEqual({
                'cong-khai': true,
                'hoc-vu': false,
                'ca-nhan': false,
                'tam': false,
            });
            expect(Object.isFrozen(BUCKET_PRIVACY)).toBe(true);
        });
    });

    describe('Numeric constraints', () => {
        it('should define 600-second signed URL TTL', () => {
            expect(SIGNED_URL_TTL_SECONDS).toBe(600);
        });

        it('should define 50 MB max upload bytes ceiling', () => {
            expect(MAX_UPLOAD_BYTES).toBe(52428800);
        });

        it('should define 6 MB TUS threshold and chunk size', () => {
            expect(TUS_THRESHOLD_BYTES).toBe(6291456);
            expect(TUS_CHUNK_BYTES).toBe(6291456);
        });
    });

    describe('getStorageTusEndpoint', () => {
        it('should derive direct Storage TUS endpoint without trailing slashes', () => {
            const url = 'https://xyzproject.supabase.co';
            expect(getStorageTusEndpoint(url)).toBe(
                'https://xyzproject.supabase.co/storage/v1/upload/resumable'
            );
        });

        it('should normalize trailing slashes properly', () => {
            const url = 'https://xyzproject.supabase.co///';
            expect(getStorageTusEndpoint(url)).toBe(
                'https://xyzproject.supabase.co/storage/v1/upload/resumable'
            );
        });

        it('should throw if url is missing or not a string', () => {
            expect(() => getStorageTusEndpoint(null)).toThrow(/supabaseUrl/i);
            expect(() => getStorageTusEndpoint('')).toThrow(/supabaseUrl/i);
        });
    });

    describe('assertStorageEnvironment', () => {
        it('should succeed when required environment variables are set', () => {
            expect(() =>
                assertStorageEnvironment({
                    SUPABASE_URL: 'https://xyzproject.supabase.co',
                    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
                })
            ).not.toThrow();
        });

        it('should throw when SUPABASE_URL is missing', () => {
            expect(() =>
                assertStorageEnvironment({
                    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
                })
            ).toThrow(/SUPABASE_URL/i);
        });

        it('should throw when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
            expect(() =>
                assertStorageEnvironment({
                    SUPABASE_URL: 'https://xyzproject.supabase.co',
                })
            ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/i);
        });
    });
});
