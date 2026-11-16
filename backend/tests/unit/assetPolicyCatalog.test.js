const {
    STORED_DOCUMENT_TYPES,
    getAssetPolicy,
} = require('../../src/storage/assetPolicyCatalog');
const { STORAGE_BUCKETS, MAX_UPLOAD_BYTES } = require('../../src/config/storageConfig');

describe('assetPolicyCatalog', () => {
    describe('STORED_DOCUMENT_TYPES catalog completeness', () => {
        const expectedTypes = [
            'BM01',
            'BM02',
            'BM02_A',
            'BM03',
            'CHECKPOINT_EVIDENCE',
            'BM04',
            'BM05',
            'ASSIGNMENT_DECISION',
            'ADJUSTMENT_APPENDIX',
            'COUNCIL_DOCUMENT',
            'REPORT_WORD',
            'REPORT_PDF',
            'SLIDE_PPTX',
            'SOURCE_ZIP',
            'CLEARANCE_CERTIFICATE',
            'USER_AVATAR',
            'PORTAL_IMAGE',
            'PORTAL_DOCUMENT',
            'PORTAL_TEMPLATE',
            'TEMP_STAGING',
        ];

        it('should define all required document types', () => {
            for (const type of expectedTypes) {
                expect(STORED_DOCUMENT_TYPES[type]).toBe(type);
            }
        });

        it('should provide exactly one policy for every document type without exceeding 50 MB ceiling', () => {
            const validBuckets = Object.values(STORAGE_BUCKETS);

            for (const docType of Object.values(STORED_DOCUMENT_TYPES)) {
                const policy = getAssetPolicy(docType);
                expect(policy).toBeDefined();
                expect(validBuckets).toContain(policy.bucket);
                expect(policy.maxBytes).toBeGreaterThan(0);
                expect(policy.maxBytes).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
                expect(Array.isArray(policy.extensions)).toBe(true);
                expect(policy.extensions.length).toBeGreaterThan(0);
                expect(Array.isArray(policy.mimeTypes)).toBe(true);
                expect(policy.mimeTypes.length).toBeGreaterThan(0);
                expect(['PUBLIC', 'PRIVATE']).toContain(policy.visibility);
            }
        });
    });

    describe('Specific document policy constraints', () => {
        it('should enforce archive inspection and 50 MB ceiling for SOURCE_ZIP', () => {
            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.SOURCE_ZIP);
            expect(policy.bucket).toBe('hoc-vu');
            expect(policy.maxBytes).toBe(52428800);
            expect(policy.extensions).toEqual(['zip']);
            expect(policy.requireArchiveInspection).toBe(true);
            expect(policy.visibility).toBe('PRIVATE');
        });

        it('should enforce 5 MB ceiling and 7-day retention for USER_AVATAR', () => {
            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.USER_AVATAR);
            expect(policy.bucket).toBe('ca-nhan');
            expect(policy.maxBytes).toBe(5242880);
            expect(policy.extensions).toEqual(expect.arrayContaining(['jpg', 'jpeg', 'png', 'webp']));
            expect(policy.retentionDays).toBe(7);
            expect(policy.visibility).toBe('PRIVATE');
        });

        it('should enforce public visibility and 10 MB limit for PORTAL_IMAGE', () => {
            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.PORTAL_IMAGE);
            expect(policy.bucket).toBe('cong-khai');
            expect(policy.maxBytes).toBe(10485760);
            expect(policy.visibility).toBe('PUBLIC');
        });

        it('should enforce public visibility and 20 MB limit for PORTAL_TEMPLATE and PORTAL_DOCUMENT', () => {
            const templatePolicy = getAssetPolicy(STORED_DOCUMENT_TYPES.PORTAL_TEMPLATE);
            expect(templatePolicy.bucket).toBe('cong-khai');
            expect(templatePolicy.maxBytes).toBe(20971520);
            expect(templatePolicy.visibility).toBe('PUBLIC');

            const docPolicy = getAssetPolicy(STORED_DOCUMENT_TYPES.PORTAL_DOCUMENT);
            expect(docPolicy.bucket).toBe('cong-khai');
            expect(docPolicy.maxBytes).toBe(20971520);
            expect(docPolicy.visibility).toBe('PUBLIC');
        });

        it('should enforce private visibility and 20 MB limit for BM01', () => {
            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.BM01);
            expect(policy.bucket).toBe('hoc-vu');
            expect(policy.maxBytes).toBe(20971520);
            expect(policy.extensions).toContain('pdf');
            expect(policy.extensions).toContain('docx');
            expect(policy.visibility).toBe('PRIVATE');
        });
    });

    describe('Disallowed asset types and error handling', () => {
        it('should reject VIDEO_DEMO with ASSET_TYPE_NOT_ALLOWED', () => {
            expect(() => getAssetPolicy('VIDEO_DEMO')).toThrow(
                expect.objectContaining({ code: 'ASSET_TYPE_NOT_ALLOWED' })
            );
        });

        it('should reject unknown document types with ASSET_POLICY_NOT_FOUND', () => {
            expect(() => getAssetPolicy('RANDOM_INVALID_DOC_TYPE')).toThrow(
                expect.objectContaining({ code: 'ASSET_POLICY_NOT_FOUND' })
            );
        });
    });
});
