const STORAGE_BUCKETS = Object.freeze({
    PUBLIC: 'cong-khai',
    ACADEMIC: 'hoc-vu',
    PERSONAL: 'ca-nhan',
    TEMP: 'tam',
});

const BUCKET_PRIVACY = Object.freeze({
    [STORAGE_BUCKETS.PUBLIC]: true,
    [STORAGE_BUCKETS.ACADEMIC]: false,
    [STORAGE_BUCKETS.PERSONAL]: false,
    [STORAGE_BUCKETS.TEMP]: false,
});

const SIGNED_URL_TTL_SECONDS = 600;
const MAX_UPLOAD_BYTES = 52428800; // 50 MB
const TUS_THRESHOLD_BYTES = 6291456; // 6 MB
const TUS_CHUNK_BYTES = 6291456; // 6 MB

const getStorageTusEndpoint = (supabaseUrl) => {
    if (!supabaseUrl || typeof supabaseUrl !== 'string') {
        throw new Error('Valid supabaseUrl is required to derive Storage TUS endpoint.');
    }
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    return `${cleanUrl}/storage/v1/upload/resumable`;
};

const assertStorageEnvironment = (env = process.env) => {
    const missing = [];
    if (!env || !env.SUPABASE_URL) {
        missing.push('SUPABASE_URL');
    }
    if (!env || !env.SUPABASE_SERVICE_ROLE_KEY) {
        missing.push('SUPABASE_SERVICE_ROLE_KEY');
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required Supabase storage environment variable(s): ${missing.join(', ')}.`
        );
    }
};

module.exports = {
    STORAGE_BUCKETS,
    BUCKET_PRIVACY,
    SIGNED_URL_TTL_SECONDS,
    MAX_UPLOAD_BYTES,
    TUS_THRESHOLD_BYTES,
    TUS_CHUNK_BYTES,
    getStorageTusEndpoint,
    assertStorageEnvironment,
};
