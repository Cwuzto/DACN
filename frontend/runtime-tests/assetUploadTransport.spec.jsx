import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import AppQueryProvider from '../src/providers/AppQueryProvider.jsx';
import { createAppQueryClient } from '../src/query/queryClient.js';
import api from '../src/services/api.js';
import {
    selectAssetUploadTransport,
    uploadAssetMultipart,
    uploadAssetResumable,
    uploadGovernedAsset,
    getAssetDownloadUrl,
    abortUploadSession,
    TUS_THRESHOLD_BYTES,
    MAX_UPLOAD_BYTES,
} from '../src/services/resumableUploadService.js';
import {
    useAssetUpload,
    useAssetDownload,
    assetKeys,
} from '../src/queries/assetQueries.js';

let mockUploadInstances = [];

vi.mock('tus-js-client', () => {
    return {
        Upload: vi.fn().mockImplementation(function (file, options) {
            this.file = file;
            this.options = options;
            this.abort = vi.fn();
            this.start = vi.fn().mockImplementation(() => {
                if (options.onProgress) {
                    options.onProgress(Math.floor(file.size / 2), file.size);
                    options.onProgress(file.size, file.size);
                }
                if (options.onSuccess) {
                    Promise.resolve().then(() => options.onSuccess());
                }
            });
            mockUploadInstances.push(this);
        }),
    };
});

describe('Asset Upload Transport & Client (TASK 5 Frontend)', () => {
    let queryClient;

    beforeEach(() => {
        mockUploadInstances = [];
        queryClient = createAppQueryClient();
        queryClient.setDefaultOptions({
            queries: { retry: false },
            mutations: { retry: false },
        });
        vi.spyOn(api, 'post').mockReset();
        vi.spyOn(api, 'get').mockReset();
        vi.spyOn(api, 'delete').mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        queryClient.clear();
    });

    describe('selectAssetUploadTransport', () => {
        it('returns "multipart" for size <= 6 MB (6291456 bytes)', () => {
            expect(selectAssetUploadTransport(0)).toBe('multipart');
            expect(selectAssetUploadTransport(1024)).toBe('multipart');
            expect(selectAssetUploadTransport(TUS_THRESHOLD_BYTES)).toBe('multipart');
        });

        it('returns "tus" for size > 6 MB up to 50 MB (52428800 bytes)', () => {
            expect(selectAssetUploadTransport(TUS_THRESHOLD_BYTES + 1)).toBe('tus');
            expect(selectAssetUploadTransport(20 * 1024 * 1024)).toBe('tus');
            expect(selectAssetUploadTransport(MAX_UPLOAD_BYTES)).toBe('tus');
        });

        it('throws ASSET_SIZE_EXCEEDED error for size > 50 MB', () => {
            const excessiveSize = MAX_UPLOAD_BYTES + 1;
            expect(() => selectAssetUploadTransport(excessiveSize)).toThrow(
                'Dung lượng tệp vượt quá giới hạn cho phép tối đa 50 MB'
            );

            try {
                selectAssetUploadTransport(excessiveSize);
            } catch (err) {
                expect(err.code).toBe('ASSET_SIZE_EXCEEDED');
            }
        });
    });

    describe('uploadAssetMultipart', () => {
        it('sends POST /assets with multipart/form-data and tracks progress', async () => {
            const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
            const mockAssetDto = {
                id: 'asset-uuid-1',
                bucket: 'hoc-vu',
                objectKey: 'bm01/report.pdf',
                documentType: 'BM01',
            };

            let capturedProgress = [];
            api.post.mockImplementation((url, formData, config) => {
                if (config?.onUploadProgress) {
                    config.onUploadProgress({ loaded: 50, total: 100 });
                    config.onUploadProgress({ loaded: 100, total: 100 });
                }
                return Promise.resolve({ success: true, data: mockAssetDto });
            });

            const result = await uploadAssetMultipart({
                file,
                documentType: 'BM01',
                resourceContext: { registrationId: 'reg-123' },
                onProgress: (p) => capturedProgress.push(p),
            });

            expect(api.post).toHaveBeenCalledTimes(1);
            const [callUrl, callFormData, callConfig] = api.post.mock.calls[0];
            expect(callUrl).toBe('/assets');
            expect(callFormData.get('file')).toBe(file);
            expect(callFormData.get('documentType')).toBe('BM01');
            expect(JSON.parse(callFormData.get('resourceContext'))).toEqual({ registrationId: 'reg-123' });
            expect(callConfig.headers['Content-Type']).toBe('multipart/form-data');

            expect(capturedProgress.length).toBeGreaterThan(0);
            expect(capturedProgress[capturedProgress.length - 1].percentage).toBe(100);
            expect(result).toEqual(mockAssetDto);
        });
    });

    describe('uploadAssetResumable', () => {
        it('configures tus Upload with endpoint, 6 MB chunk size, headers and finalizes after upload', async () => {
            const file = new File([new ArrayBuffer(8 * 1024 * 1024)], 'large_thesis.pdf', {
                type: 'application/pdf',
            });
            const session = {
                sessionId: 'session-xyz',
                tusEndpoint: 'http://localhost:5000/api/tus/tam',
                chunkSizeBytes: 6291456,
                tusHeaders: { 'Upload-Token': 'signed-jwt-token' },
            };
            const finalizedDto = {
                id: 'finalized-asset-id',
                bucket: 'hoc-vu',
                status: 'ACTIVE',
            };

            api.post.mockResolvedValueOnce({ success: true, data: finalizedDto });

            let capturedProgress = [];
            const result = await uploadAssetResumable({
                file,
                session,
                onProgress: (p) => capturedProgress.push(p),
            });

            expect(mockUploadInstances.length).toBe(1);
            const instance = mockUploadInstances[0];
            expect(instance.options.endpoint).toBe(session.tusEndpoint);
            expect(instance.options.chunkSize).toBe(6291456);
            expect(instance.options.headers).toEqual(session.tusHeaders);
            expect(instance.options.uploadDataDuringCreation).toBe(true);
            expect(instance.options.removeFingerprintOnSuccess).toBe(true);
            expect(instance.options.retryDelays).toEqual([0, 1000, 3000, 5000]);

            expect(api.post).toHaveBeenCalledWith('/assets/upload-sessions/session-xyz/finalize');
            expect(result).toEqual(finalizedDto);
            expect(capturedProgress.length).toBeGreaterThan(0);
        });

        it('aborts upload and rejects if signal is aborted', async () => {
            const file = new File([new ArrayBuffer(8 * 1024 * 1024)], 'large.pdf', {
                type: 'application/pdf',
            });
            const session = {
                sessionId: 'session-abort',
                tusEndpoint: 'http://localhost:5000/api/tus/tam',
            };

            const controller = new AbortController();
            controller.abort();

            await expect(
                uploadAssetResumable({
                    file,
                    session,
                    signal: controller.signal,
                })
            ).rejects.toThrow('Tải tệp lên đã bị hủy');
        });

        it('aborts in-flight upload when signal is triggered during upload', async () => {
            const file = new File([new ArrayBuffer(8 * 1024 * 1024)], 'large.pdf', {
                type: 'application/pdf',
            });
            const session = {
                sessionId: 'session-in-flight',
                tusEndpoint: 'http://localhost:5000/api/tus/tam',
            };

            const controller = new AbortController();

            const { Upload } = await import('tus-js-client');
            Upload.mockImplementationOnce(function (f, opts) {
                this.abort = vi.fn();
                this.start = vi.fn().mockImplementation(() => {
                    setTimeout(() => controller.abort(), 5);
                });
            });

            const uploadPromise = uploadAssetResumable({
                file,
                session,
                signal: controller.signal,
            });

            await expect(uploadPromise).rejects.toThrow('Tải tệp lên đã bị hủy');
        });

        it('rejects if TUS client reports an onError error', async () => {
            const file = new File([new ArrayBuffer(8 * 1024 * 1024)], 'broken.pdf', {
                type: 'application/pdf',
            });
            const session = {
                sessionId: 'session-err',
                tusEndpoint: 'http://localhost:5000/api/tus/tam',
            };

            // Custom mock to simulate network failure
            const { Upload } = await import('tus-js-client');
            Upload.mockImplementationOnce(function (f, opts) {
                this.abort = vi.fn();
                this.start = () => opts.onError(new Error('Network connection lost'));
            });

            await expect(
                uploadAssetResumable({
                    file,
                    session,
                })
            ).rejects.toThrow('Network connection lost');
        });

        it('rejects when finalize API fails with 410 or session expired', async () => {
            const file = new File([new ArrayBuffer(8 * 1024 * 1024)], 'expired.pdf', {
                type: 'application/pdf',
            });
            const session = {
                sessionId: 'session-expired',
                tusEndpoint: 'http://localhost:5000/api/tus/tam',
            };

            api.post.mockRejectedValueOnce(new Error('Session has expired'));

            await expect(
                uploadAssetResumable({
                    file,
                    session,
                })
            ).rejects.toThrow('Session has expired');
        });
    });

    describe('uploadGovernedAsset', () => {
        it('routes to multipart upload when file <= 6 MB', async () => {
            const file = new File(['small content'], 'small.docx', {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
            Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 });

            const mockDto = { id: 'asset-small', documentType: 'BM02' };
            api.post.mockResolvedValueOnce({ success: true, data: mockDto });

            const res = await uploadGovernedAsset({
                file,
                documentType: 'BM02',
                resourceContext: { registrationId: 'reg-1' },
            });

            expect(api.post).toHaveBeenCalledTimes(1);
            expect(api.post.mock.calls[0][0]).toBe('/assets');
            expect(res).toEqual(mockDto);
        });

        it('creates session and routes to TUS upload when file > 6 MB', async () => {
            const file = new File(['large content'], 'large.zip', { type: 'application/zip' });
            Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 });

            const sessionResponse = {
                sessionId: 'session-large-1',
                tusEndpoint: 'http://localhost:5000/api/tus/tam',
                chunkSizeBytes: 6291456,
                tusHeaders: { Authorization: 'Bearer test' },
            };
            const finalizedDto = { id: 'asset-large-final', status: 'ACTIVE' };

            // 1. Session creation response
            api.post.mockResolvedValueOnce({ success: true, data: sessionResponse });
            // 2. Finalize response
            api.post.mockResolvedValueOnce({ success: true, data: finalizedDto });

            const res = await uploadGovernedAsset({
                file,
                documentType: 'ARCHIVE_SOURCE',
                resourceContext: { registrationId: 'reg-2' },
            });

            expect(api.post).toHaveBeenCalledTimes(2);
            expect(api.post.mock.calls[0][0]).toBe('/assets/upload-sessions');
            expect(api.post.mock.calls[0][1]).toEqual({
                documentType: 'ARCHIVE_SOURCE',
                resourceContext: { registrationId: 'reg-2' },
                originalName: 'large.zip',
                declaredMime: 'application/zip',
                sizeBytes: 10 * 1024 * 1024,
            });
            expect(api.post.mock.calls[1][0]).toBe('/assets/upload-sessions/session-large-1/finalize');
            expect(res).toEqual(finalizedDto);
        });

        it('rejects immediately without API calls when file exceeds 50 MB limit', async () => {
            const file = new File(['oversized'], 'oversized.iso', { type: 'application/octet-stream' });
            Object.defineProperty(file, 'size', { value: 55 * 1024 * 1024 });

            await expect(
                uploadGovernedAsset({
                    file,
                    documentType: 'BM01',
                    resourceContext: {},
                })
            ).rejects.toThrow('Dung lượng tệp vượt quá giới hạn cho phép tối đa 50 MB');

            expect(api.post).not.toHaveBeenCalled();
        });
    });

    describe('getAssetDownloadUrl & abortUploadSession', () => {
        it('calls GET /assets/:id/download and returns download payload', async () => {
            const downloadDto = {
                url: 'https://supabase.local/storage/v1/object/sign/hoc-vu/bm01.pdf?token=abc',
                expiresAt: '2026-11-17T03:00:00Z',
                fileName: 'bm01.pdf',
                visibility: 'PRIVATE',
            };
            api.get.mockResolvedValueOnce({ success: true, data: downloadDto });

            const result = await getAssetDownloadUrl('asset-123');
            expect(api.get).toHaveBeenCalledWith('/assets/asset-123/download');
            expect(result).toEqual(downloadDto);
        });

        it('calls DELETE /assets/upload-sessions/:id to abort session', async () => {
            api.delete.mockResolvedValueOnce({ success: true, data: { aborted: true } });

            const result = await abortUploadSession('session-abort-id');
            expect(api.delete).toHaveBeenCalledWith('/assets/upload-sessions/session-abort-id');
            expect(result).toEqual({ aborted: true });
        });

        it('throws error when getAssetDownloadUrl is called without assetId', async () => {
            await expect(getAssetDownloadUrl('')).rejects.toThrow('assetId is required');
        });

        it('throws error when abortUploadSession is called without sessionId', async () => {
            await expect(abortUploadSession('')).rejects.toThrow('sessionId is required');
        });
    });

    describe('TanStack Query Hooks: useAssetUpload & useAssetDownload', () => {
        const wrapper = ({ children }) => (
            <AppQueryProvider client={queryClient}>{children}</AppQueryProvider>
        );

        it('useAssetUpload mutation executes uploadGovernedAsset', async () => {
            const file = new File(['upload data'], 'doc.pdf', { type: 'application/pdf' });
            Object.defineProperty(file, 'size', { value: 1024 });
            const mockDto = { id: 'asset-mutation', status: 'ACTIVE' };
            api.post.mockResolvedValueOnce({ success: true, data: mockDto });

            const { result } = renderHook(() => useAssetUpload(), { wrapper });

            let mutationResult;
            await act(async () => {
                mutationResult = await result.current.mutateAsync({
                    file,
                    documentType: 'BM01',
                    resourceContext: { registrationId: 'reg-m' },
                });
            });

            expect(mutationResult).toEqual(mockDto);
            await waitFor(() => expect(result.current.isSuccess).toBe(true));
        });

        it('useAssetDownload fetches download URL using assetKeys', async () => {
            const downloadDto = {
                url: 'https://example.com/download.pdf',
                fileName: 'download.pdf',
                expiresAt: '2026-11-17T04:00:00Z',
            };
            api.get.mockResolvedValueOnce({ success: true, data: downloadDto });

            const { result } = renderHook(() => useAssetDownload('asset-dl-1'), { wrapper });

            await waitFor(() => expect(result.current.isSuccess).toBe(true));
            expect(result.current.data).toEqual(downloadDto);
            expect(assetKeys.download('asset-dl-1')).toEqual(['assets', 'download', 'asset-dl-1']);
        });
    });
});
