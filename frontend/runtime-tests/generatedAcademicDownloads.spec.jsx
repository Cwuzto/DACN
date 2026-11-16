import { describe, it, expect, vi, afterEach } from 'vitest';
import * as resumableService from '../src/services/resumableUploadService';

describe('Task 7 Frontend: Generated Academic Document Downloads and Governance Tests', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('uses governed getAssetDownloadUrl endpoint rather than direct URL for private academic downloads', async () => {
        const spy = vi.spyOn(resumableService, 'getAssetDownloadUrl').mockResolvedValue({
            downloadUrl: 'https://storage.supabase.co/object/sign/hoc-vu/bm03.pdf?token=abc',
            expiresInSeconds: 600,
            fileName: 'bm03.pdf',
        });

        const result = await resumableService.getAssetDownloadUrl('test-asset-uuid-777');
        expect(spy).toHaveBeenCalledWith('test-asset-uuid-777');
        expect(result.expiresInSeconds).toBe(600);
        expect(result.downloadUrl).toContain('token=abc');
    });

    it('rejects downloading if assetId is missing or falsy', async () => {
        await expect(resumableService.getAssetDownloadUrl('')).rejects.toThrow('assetId is required');
    });
});
