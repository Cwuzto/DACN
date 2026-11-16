const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMP_UPLOAD_DIR = path.resolve(__dirname, '../../temp/uploads');

/**
 * Returns the absolute path of the designated temporary upload directory.
 * Ensures the directory exists.
 */
const getTempUploadDir = () => {
    if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
        fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
    }
    return TEMP_UPLOAD_DIR;
};

/**
 * Validates whether a file path resides strictly inside the designated temp upload directory.
 * Prevents directory traversal attacks.
 */
const isPathInsideTempDir = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return false;
    const resolvedBase = path.resolve(getTempUploadDir());
    const resolvedTarget = path.resolve(filePath);
    return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
};

/**
 * Generates an isolated temporary file path with a random UUID.
 */
const createTempFilePath = (extension = 'tmp') => {
    const dir = getTempUploadDir();
    const cleanExt = extension.replace(/^\.+/, '');
    const filename = `tmp-${crypto.randomUUID()}.${cleanExt}`;
    return path.join(dir, filename);
};

/**
 * Safely removes a temporary file if it exists and is within the temp directory.
 */
const cleanupTempFile = (filePath) => {
    if (!filePath || typeof filePath !== 'string') return;
    try {
        if (isPathInsideTempDir(filePath) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        // Silently ignore cleanup errors to prevent masking primary errors
    }
};

/**
 * Cleans up all temporary files associated with an Express request.
 */
const cleanupRequestTempFiles = (req) => {
    if (!req) return;

    if (req.file && req.file.path) {
        cleanupTempFile(req.file.path);
    }

    if (Array.isArray(req.files)) {
        for (const file of req.files) {
            if (file && file.path) {
                cleanupTempFile(file.path);
            }
        }
    } else if (req.files && typeof req.files === 'object') {
        for (const field of Object.keys(req.files)) {
            const files = req.files[field];
            if (Array.isArray(files)) {
                for (const file of files) {
                    if (file && file.path) {
                        cleanupTempFile(file.path);
                    }
                }
            }
        }
    }
};

/**
 * Cleans up temporary files older than specified milliseconds (default 24h).
 */
const cleanupStaleTempFiles = (olderThanMs = 24 * 60 * 60 * 1000) => {
    try {
        const dir = getTempUploadDir();
        const files = fs.readdirSync(dir);
        const now = Date.now();

        for (const file of files) {
            const fullPath = path.join(dir, file);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isFile() && (now - stat.mtimeMs > olderThanMs)) {
                    fs.unlinkSync(fullPath);
                }
            } catch (err) {
                // Ignore individual file stat/deletion errors
            }
        }
    } catch (err) {
        // Ignore directory read errors
    }
};

module.exports = {
    TEMP_UPLOAD_DIR,
    getTempUploadDir,
    isPathInsideTempDir,
    createTempFilePath,
    cleanupTempFile,
    cleanupRequestTempFiles,
    cleanupStaleTempFiles,
};
