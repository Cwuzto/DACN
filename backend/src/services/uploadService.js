const { getSupabaseClient } = require('../config/supabase');

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'dacn';

const sanitizeFileName = (fileName = 'file') => fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const randomSuffix = () => Math.random().toString(36).slice(2, 10);
const sanitizePathSegment = (value = 'unknown') => String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';

const sanitizeFolderPath = (folderPath = 'general') => String(folderPath)
    .split('/')
    .filter(Boolean)
    .map((part) => sanitizePathSegment(part))
    .join('/');

class UploadService {
    static async ensureBucket(supabase) {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) throw listError;

        const existingBucket = (buckets || []).find((bucket) => bucket.name === DEFAULT_BUCKET);
        if (existingBucket) {
            if (existingBucket.public !== true) {
                const { error: updateError } = await supabase.storage.updateBucket(DEFAULT_BUCKET, {
                    public: true,
                });
                if (updateError) throw updateError;
            }
            return;
        }

        const { error: createError } = await supabase.storage.createBucket(DEFAULT_BUCKET, {
            public: true,
        });
        if (createError && !String(createError.message || '').toLowerCase().includes('already exists')) {
            throw createError;
        }
    }
    /**
     * Upload file tu buffer len Supabase Storage
     * @param {Buffer} fileBuffer
     * @param {string} folder
     * @param {string} mimeType
     * @param {string} originalName
     */
    static async uploadBuffer(fileBuffer, folder = 'general', mimeType = 'application/octet-stream', originalName = 'file') {
        const supabase = getSupabaseClient();
        await UploadService.ensureBucket(supabase);
        const timestamp = Date.now();
        const cleanedName = sanitizeFileName(originalName || 'file');
        const safeFolder = sanitizeFolderPath(folder) || 'general';
        const objectPath = `${safeFolder}/${timestamp}-${randomSuffix()}-${cleanedName}`;

        const { error: uploadError } = await supabase.storage
            .from(DEFAULT_BUCKET)
            .upload(objectPath, fileBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (uploadError) {
            throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
            .from(DEFAULT_BUCKET)
            .getPublicUrl(objectPath);

        return {
            secure_url: publicUrlData.publicUrl,
            public_id: objectPath,
            format: cleanedName.includes('.') ? cleanedName.split('.').pop() : null,
            bytes: fileBuffer.length,
            bucket: DEFAULT_BUCKET,
        };
    }

    /**
     * Xoa file tren Supabase Storage bang object path
     * @param {string} objectPath
     */
    static async deleteFile(objectPath) {
        const supabase = getSupabaseClient();
        const { error } = await supabase.storage
            .from(DEFAULT_BUCKET)
            .remove([objectPath]);

        if (error) {
            throw error;
        }

        return { success: true };
    }
}

module.exports = UploadService;
