const path = require('path');
const { getSupabaseClient } = require('../config/supabase');

class StorageAdapterError extends Error {
    constructor(message, code = 'STORAGE_ADAPTER_ERROR', statusCode = 500) {
        super(message);
        this.name = 'StorageAdapterError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

class SupabaseStorageAdapter {
    constructor({ supabaseClient } = {}) {
        this._client = supabaseClient || null;
    }

    get supabase() {
        if (!this._client) {
            try {
                this._client = getSupabaseClient();
            } catch {
                return null;
            }
        }
        return this._client;
    }

    _getBucketRef(bucket) {
        if (!bucket || typeof bucket !== 'string') {
            throw new StorageAdapterError('Bucket name is required', 'STORAGE_BUCKET_REQUIRED', 400);
        }
        return this.supabase.storage.from(bucket);
    }

    /**
     * Upload an object into the specified bucket with upsert: false enforced.
     */
    async upload({ bucket, objectKey, data, contentType, upsert = false }) {
        if (!objectKey || typeof objectKey !== 'string') {
            throw new StorageAdapterError('objectKey is required for upload', 'STORAGE_KEY_REQUIRED', 400);
        }

        const bucketRef = this._getBucketRef(bucket);
        const options = {
            contentType: contentType || 'application/octet-stream',
            upsert: false, // Governance rule: immutable writes, never true unless explicitly forced
        };

        const { data: uploadData, error } = await bucketRef.upload(objectKey, data, options);

        if (error) {
            throw new StorageAdapterError(`Storage upload failed: ${error.message}`, 'STORAGE_UPLOAD_FAILED', 500);
        }

        return uploadData;
    }

    /**
     * Downloads an object from the specified bucket.
     */
    async download({ bucket, objectKey }) {
        const bucketRef = this._getBucketRef(bucket);
        const { data, error } = await bucketRef.download(objectKey);

        if (error) {
            throw new StorageAdapterError(`Storage download failed: ${error.message}`, 'STORAGE_DOWNLOAD_FAILED', 404);
        }

        return data;
    }

    /**
     * Removes one or more objects from a bucket.
     */
    async remove({ bucket, objectKey }) {
        const bucketRef = this._getBucketRef(bucket);
        const keys = Array.isArray(objectKey) ? objectKey : [objectKey];
        const { data, error } = await bucketRef.remove(keys);

        if (error) {
            throw new StorageAdapterError(`Storage remove failed: ${error.message}`, 'STORAGE_REMOVE_FAILED', 500);
        }

        return data;
    }

    /**
     * Lists objects in a bucket/folder.
     */
    async list({ bucket, folder = '', options = {} } = {}) {
        const bucketRef = this._getBucketRef(bucket);
        const { data, error } = await bucketRef.list(folder, options);

        if (error) {
            throw new StorageAdapterError(`Storage list failed: ${error.message}`, 'STORAGE_LIST_FAILED', 500);
        }

        return data || [];
    }

    /**
     * Retrieves metadata for an object.
     */
    async stat({ bucket, objectKey }) {
        const bucketRef = this._getBucketRef(bucket);
        const lastSlash = objectKey.lastIndexOf('/');
        const folder = lastSlash >= 0 ? objectKey.substring(0, lastSlash) : '';
        const filename = lastSlash >= 0 ? objectKey.substring(lastSlash + 1) : objectKey;

        const { data, error } = await bucketRef.list(folder, { search: filename });

        if (error) {
            throw new StorageAdapterError(`Storage stat failed: ${error.message}`, 'STORAGE_STAT_FAILED', 500);
        }

        const match = Array.isArray(data) ? data.find((item) => item.name === filename) : null;
        if (!match) {
            throw new StorageAdapterError(`Object '${objectKey}' not found in bucket '${bucket}'`, 'STORAGE_OBJECT_NOT_FOUND', 404);
        }

        return {
            name: match.name,
            size: match.metadata?.size,
            mimetype: match.metadata?.mimetype,
            etag: match.metadata?.etag,
            updated_at: match.updated_at,
            rawMetadata: match.metadata,
        };
    }

    /**
     * Checks if an object exists in a bucket.
     */
    async exists({ bucket, objectKey }) {
        try {
            await this.stat({ bucket, objectKey });
            return true;
        } catch (err) {
            if (err.code === 'STORAGE_OBJECT_NOT_FOUND') {
                return false;
            }
            // If list returns empty or throws
            return false;
        }
    }

    /**
     * Moves an object within or across buckets.
     */
    async move({ fromBucket, fromKey, toBucket, toKey, contentType }) {
        if (!fromBucket || !fromKey || !toBucket || !toKey) {
            throw new StorageAdapterError('fromBucket, fromKey, toBucket, and toKey are all required for move', 'STORAGE_MOVE_PARAMS_INVALID', 400);
        }

        if (fromBucket === toBucket) {
            const bucketRef = this._getBucketRef(fromBucket);
            const { data, error } = await bucketRef.move(fromKey, toKey);
            if (error) {
                throw new StorageAdapterError(`Storage move failed: ${error.message}`, 'STORAGE_MOVE_FAILED', 500);
            }
            return data;
        }

        // Cross-bucket move: download from source, upload to target, remove from source
        const fileData = await this.download({ bucket: fromBucket, objectKey: fromKey });
        
        // Convert Blob to Buffer if needed
        let bufferData = fileData;
        if (typeof fileData.arrayBuffer === 'function') {
            const arrayBuffer = await fileData.arrayBuffer();
            bufferData = Buffer.from(arrayBuffer);
        }

        await this.upload({
            bucket: toBucket,
            objectKey: toKey,
            data: bufferData,
            contentType,
            upsert: false,
        });

        await this.remove({ bucket: fromBucket, objectKey: fromKey });

        return { message: 'Successfully moved across buckets' };
    }

    /**
     * Copies an object within or across buckets.
     */
    async copy({ fromBucket, fromKey, toBucket, toKey, contentType }) {
        if (!fromBucket || !fromKey || !toBucket || !toKey) {
            throw new StorageAdapterError('fromBucket, fromKey, toBucket, and toKey are all required for copy', 'STORAGE_COPY_PARAMS_INVALID', 400);
        }

        if (fromBucket === toBucket) {
            const bucketRef = this._getBucketRef(fromBucket);
            const { data, error } = await bucketRef.copy(fromKey, toKey);
            if (error) {
                throw new StorageAdapterError(`Storage copy failed: ${error.message}`, 'STORAGE_COPY_FAILED', 500);
            }
            return data;
        }

        // Cross-bucket copy
        const fileData = await this.download({ bucket: fromBucket, objectKey: fromKey });
        let bufferData = fileData;
        if (typeof fileData.arrayBuffer === 'function') {
            const arrayBuffer = await fileData.arrayBuffer();
            bufferData = Buffer.from(arrayBuffer);
        }

        await this.upload({
            bucket: toBucket,
            objectKey: toKey,
            data: bufferData,
            contentType,
            upsert: false,
        });

        return { message: 'Successfully copied across buckets' };
    }

    /**
     * Creates a signed download URL valid for expiresInSeconds (default 600s = 10 min).
     */
    async createSignedUrl({ bucket, objectKey, expiresInSeconds = 600 }) {
        const bucketRef = this._getBucketRef(bucket);
        const { data, error } = await bucketRef.createSignedUrl(objectKey, expiresInSeconds);

        if (error) {
            throw new StorageAdapterError(`Storage signed URL generation failed: ${error.message}`, 'STORAGE_SIGNED_URL_FAILED', 500);
        }

        return data;
    }

    /**
     * Creates a signed upload URL bound to an explicit object path.
     */
    async createSignedUploadUrl({ bucket, objectKey }) {
        const bucketRef = this._getBucketRef(bucket);
        const { data, error } = await bucketRef.createSignedUploadUrl(objectKey);

        if (error) {
            throw new StorageAdapterError(`Storage signed upload URL generation failed: ${error.message}`, 'STORAGE_SIGNED_UPLOAD_URL_FAILED', 500);
        }

        return data;
    }

    /**
     * Gets the public URL for an object in a public bucket (e.g. cong-khai).
     */
    getPublicUrl({ bucket, objectKey }) {
        const bucketRef = this._getBucketRef(bucket);
        const { data } = bucketRef.getPublicUrl(objectKey);
        return data?.publicUrl || '';
    }
}

const defaultStorageAdapter = new SupabaseStorageAdapter();

module.exports = {
    SupabaseStorageAdapter,
    storageAdapter: defaultStorageAdapter,
    StorageAdapterError,
};
