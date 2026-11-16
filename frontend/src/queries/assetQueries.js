import { useQuery, useMutation } from '@tanstack/react-query';
import {
    uploadGovernedAsset,
    getAssetDownloadUrl,
} from '../services/resumableUploadService.js';

export const assetKeys = {
    all: ['assets'],
    downloads: () => [...assetKeys.all, 'download'],
    download: (assetId) => [...assetKeys.downloads(), assetId ? String(assetId) : null],
};

/**
 * Mutation hook for governed asset uploads (multipart or TUS resumable)
 */
export const useAssetUpload = (options = {}) => {
    return useMutation({
        mutationFn: async ({ file, documentType, resourceContext, onProgress, signal }) => {
            return await uploadGovernedAsset({
                file,
                documentType,
                resourceContext,
                onProgress,
                signal,
            });
        },
        ...options,
    });
};

/**
 * Query hook for obtaining asset download URLs (signed private or public)
 */
export const useAssetDownload = (assetId, options = {}) => {
    return useQuery({
        queryKey: assetKeys.download(assetId),
        queryFn: async () => {
            return await getAssetDownloadUrl(assetId);
        },
        enabled: Boolean(assetId) && (options.enabled !== undefined ? options.enabled : true),
        staleTime: options.staleTime ?? 5 * 60 * 1000,
        ...options,
    });
};
