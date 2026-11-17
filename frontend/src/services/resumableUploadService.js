import { Upload } from 'tus-js-client';
import api from './api.js';

export const TUS_THRESHOLD_BYTES = 6291456; // 6 MB
export const MAX_UPLOAD_BYTES = 52428800; // 50 MB

/**
 * Unwrap API response if enveloped in { success: true, data: ... }
 */
const unwrapData = (response) => {
    if (response && typeof response === 'object' && response.success === true && 'data' in response) {
        return response.data;
    }
    return response;
};

/**
 * Select upload transport based on file size
 * - <= 6 MB: 'multipart'
 * - > 6 MB & <= 50 MB: 'tus'
 * - > 50 MB: throws Error with code 'ASSET_SIZE_EXCEEDED'
 */
export function selectAssetUploadTransport(sizeBytes) {
    const size = Number(sizeBytes);
    if (size > MAX_UPLOAD_BYTES) {
        const error = new Error('Dung lượng tệp vượt quá giới hạn cho phép tối đa 50 MB');
        error.code = 'ASSET_SIZE_EXCEEDED';
        throw error;
    }
    if (size > TUS_THRESHOLD_BYTES) {
        return 'tus';
    }
    return 'multipart';
}

/**
 * Multipart upload for assets <= 6 MB
 */
export async function uploadAssetMultipart({ file, documentType, resourceContext, onProgress, signal }) {
    const formData = new FormData();
    formData.append('file', file);

    if (documentType) {
        formData.append('documentType', documentType);
    }

    if (resourceContext !== undefined && resourceContext !== null) {
        formData.append(
            'resourceContext',
            typeof resourceContext === 'string' ? resourceContext : JSON.stringify(resourceContext)
        );
    }

    const response = await api.post('/assets', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        signal,
        onUploadProgress: (progressEvent) => {
            if (typeof onProgress === 'function') {
                const total = progressEvent.total ?? file.size;
                const loaded = progressEvent.loaded ?? 0;
                const percentage = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                onProgress({ loaded, total, percentage, percent: percentage });
            }
        },
    });

    return unwrapData(response);
}

/**
 * Resumable TUS upload for staged assets (> 6 MB up to 50 MB)
 */
export function uploadAssetResumable({ file, session, onProgress, signal }) {
    return new Promise((resolve, reject) => {
        const sessionId = session?.sessionId || session?.id;
        if (!sessionId) {
            reject(new Error('Missing sessionId in upload session'));
            return;
        }

        const endpoint = session.tusEndpoint || session.uploadUrl || session.endpoint;
        const chunkSize = session.chunkSizeBytes || TUS_THRESHOLD_BYTES;
        const headers = session.tusHeaders || session.headers || {};

        let uploadInstance = null;
        let isAborted = false;

        const handleAbort = () => {
            isAborted = true;
            if (uploadInstance) {
                try {
                    uploadInstance.abort();
                } catch (_err) {
                    // Bỏ qua lỗi hủy nếu phiên tải đã kết thúc
                }
            }
            const abortErr = new Error('Tải tệp lên đã bị hủy');
            abortErr.name = 'AbortError';
            abortErr.code = 'UPLOAD_ABORTED';
            reject(abortErr);
        };

        if (signal) {
            if (signal.aborted) {
                handleAbort();
                return;
            }
            signal.addEventListener('abort', handleAbort, { once: true });
        }

        uploadInstance = new Upload(file, {
            endpoint,
            chunkSize,
            headers,
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            retryDelays: [0, 1000, 3000, 5000],
            metadata: {
                filename: file.name,
                filetype: file.type || 'application/octet-stream',
            },
            onError: (error) => {
                if (isAborted) return;
                reject(error);
            },
            onProgress: (bytesUploaded, bytesTotal) => {
                if (isAborted) return;
                if (typeof onProgress === 'function') {
                    const percentage = bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0;
                    onProgress({ loaded: bytesUploaded, total: bytesTotal, percentage, percent: percentage });
                }
            },
            onSuccess: async () => {
                if (isAborted) return;
                try {
                    const finalizedResponse = await api.post(`/assets/upload-sessions/${sessionId}/finalize`);
                    resolve(unwrapData(finalizedResponse));
                } catch (finalizeErr) {
                    reject(finalizeErr);
                }
            },
        });

        uploadInstance.start();
    });
}

/**
 * Governed asset upload router:
 * Determines transport, initiates multipart or TUS session, and returns finalized asset
 */
export async function uploadGovernedAsset({ file, documentType, resourceContext, onProgress, signal }) {
    const transport = selectAssetUploadTransport(file.size);

    if (transport === 'multipart') {
        return await uploadAssetMultipart({
            file,
            documentType,
            resourceContext,
            onProgress,
            signal,
        });
    }

    // Transport is 'tus'
    const sessionPayload = {
        documentType,
        resourceContext,
        originalName: file.name,
        declaredMime: file.type || 'application/octet-stream',
        sizeBytes: file.size,
    };

    const sessionResponse = await api.post('/assets/upload-sessions', sessionPayload, { signal });
    const session = unwrapData(sessionResponse);

    return await uploadAssetResumable({
        file,
        session,
        onProgress,
        signal,
    });
}

/**
 * Obtain signed or public download URL for an active asset
 */
export async function getAssetDownloadUrl(assetId) {
    if (!assetId) {
        throw new Error('assetId is required');
    }
    const response = await api.get(`/assets/${assetId}/download`);
    return unwrapData(response);
}

/**
 * Abort an active upload session and trigger staging cleanup
 */
export async function abortUploadSession(sessionId) {
    if (!sessionId) {
        throw new Error('sessionId is required');
    }
    const response = await api.delete(`/assets/upload-sessions/${sessionId}`);
    return unwrapData(response);
}

const resumableUploadService = {
    TUS_THRESHOLD_BYTES,
    MAX_UPLOAD_BYTES,
    selectAssetUploadTransport,
    uploadAssetMultipart,
    uploadAssetResumable,
    uploadGovernedAsset,
    getAssetDownloadUrl,
    abortUploadSession,
};

export default resumableUploadService;
