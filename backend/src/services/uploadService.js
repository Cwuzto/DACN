const { getSupabaseClient } = require('../config/supabase');

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'dacn';

const sanitizeFileName = (fileName = 'file') => fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const randomSuffix = () => Math.random().toString(36).slice(2, 10);

class UploadService {
    /**
     * Upload file tu buffer len Supabase Storage
     * @param {Buffer} fileBuffer
     * @param {string} folder
     * @param {string} mimeType
     * @param {string} originalName
     */
    static async uploadBuffer(fileBuffer, folder = 'general', mimeType = 'application/octet-stream', originalName = 'file') {
        const supabase = getSupabaseClient();
        const timestamp = Date.now();
        const cleanedName = sanitizeFileName(originalName || 'file');
        const objectPath = `dacn/${folder}/${timestamp}-${randomSuffix()}-${cleanedName}`;

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
