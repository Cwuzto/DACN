const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');
const { MAX_UPLOAD_BYTES } = require('../config/storageConfig');

class FileInspectionError extends Error {
    constructor(message, code = 'ASSET_INSPECTION_FAILED', statusCode = 400) {
        super(message);
        this.name = 'FileInspectionError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

/**
 * Computes SHA-256 hash of a file on disk using streaming.
 */
const computeFileSha256 = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', (err) => reject(err));
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

/**
 * Inspects a ZIP archive using yauzl.
 * Validates zip entries against path traversal, zip bombs, executable binaries, and macros.
 */
const inspectZipArchive = (filePath, compressedSize) => {
    return new Promise((resolve, reject) => {
        yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                return reject(new FileInspectionError(`Invalid ZIP structure: ${err.message}`, 'ASSET_ZIP_CORRUPT', 400));
            }

            const entries = [];
            let totalUncompressedSize = 0;
            const MAX_ENTRIES = 10000;
            const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB
            const MAX_RATIO = 100;

            const FORBIDDEN_EXTENSIONS = [
                '.exe', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.msi',
                '.dll', '.com', '.scr', '.jar', '.app', '.apk', '.bin',
                '.docm', '.xlsm', '.pptm'
            ];

            zipfile.readEntry();

            zipfile.on('entry', (entry) => {
                const entryName = entry.fileName;

                // 1. Path traversal check
                if (
                    entryName.includes('..') ||
                    entryName.startsWith('/') ||
                    entryName.startsWith('\\') ||
                    /^[A-Za-z]:/.test(entryName)
                ) {
                    zipfile.close();
                    return reject(new FileInspectionError(
                        `Unsafe archive: path traversal detected in entry '${entryName}'`,
                        'ASSET_ZIP_TRAVERSAL',
                        400
                    ));
                }

                const lowerName = entryName.toLowerCase();

                // 2. Macro checks
                if (lowerName.endsWith('vbaproject.bin') || lowerName.includes('vba')) {
                    zipfile.close();
                    return reject(new FileInspectionError(
                        'Archive contains prohibited Office macro components',
                        'ASSET_MACRO_REJECTED',
                        400
                    ));
                }

                // 3. Executable / dangerous extension check
                const ext = path.extname(lowerName);
                if (FORBIDDEN_EXTENSIONS.includes(ext)) {
                    zipfile.close();
                    return reject(new FileInspectionError(
                        `Archive contains forbidden executable file '${entryName}'`,
                        'ASSET_EXECUTABLE_REJECTED',
                        400
                    ));
                }

                // 4. Zip bomb checks
                entries.push(entryName);
                totalUncompressedSize += entry.uncompressedSize;

                if (entries.length > MAX_ENTRIES) {
                    zipfile.close();
                    return reject(new FileInspectionError(
                        `Archive entry count exceeds maximum threshold (${MAX_ENTRIES})`,
                        'ASSET_ZIP_BOMB',
                        400
                    ));
                }

                if (totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
                    zipfile.close();
                    return reject(new FileInspectionError(
                        'Archive uncompressed size exceeds maximum safety threshold',
                        'ASSET_ZIP_BOMB',
                        400
                    ));
                }

                if (compressedSize > 0 && (totalUncompressedSize / compressedSize > MAX_RATIO) && totalUncompressedSize > 10 * 1024 * 1024) {
                    zipfile.close();
                    return reject(new FileInspectionError(
                        'Potential zip bomb detected: expansion ratio exceeds safety limit',
                        'ASSET_ZIP_BOMB',
                        400
                    ));
                }

                zipfile.readEntry();
            });

            zipfile.on('end', () => {
                // Determine container type
                let detectedMime = 'application/zip';
                let detectedExt = 'zip';

                const hasContentTypes = entries.some(e => e.toLowerCase() === '[content_types].xml');
                const hasWordDoc = entries.some(e => e.toLowerCase().startsWith('word/document.xml'));
                const hasXlWorkbook = entries.some(e => e.toLowerCase().startsWith('xl/workbook.xml'));
                const hasPptPres = entries.some(e => e.toLowerCase().startsWith('ppt/presentation.xml'));

                if (hasContentTypes || hasWordDoc || hasXlWorkbook || hasPptPres) {
                    if (hasWordDoc) {
                        detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                        detectedExt = 'docx';
                    } else if (hasXlWorkbook) {
                        detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        detectedExt = 'xlsx';
                    } else if (hasPptPres) {
                        detectedMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                        detectedExt = 'pptx';
                    }
                }

                resolve({
                    isZip: true,
                    entries,
                    detectedMime,
                    detectedExt,
                    totalUncompressedSize,
                });
            });

            zipfile.on('error', (zipErr) => {
                if (zipErr.message && (zipErr.message.includes('relative path') || zipErr.message.includes('..'))) {
                    return reject(new FileInspectionError(
                        `Unsafe archive: path traversal detected: ${zipErr.message}`,
                        'ASSET_ZIP_TRAVERSAL',
                        400
                    ));
                }
                reject(new FileInspectionError(`Error inspecting ZIP entries: ${zipErr.message}`, 'ASSET_ZIP_ERROR', 400));
            });
        });
    });
};

/**
 * Detects MIME and format from the file's binary header (magic bytes).
 */
const detectMagicBytes = (headerBuffer, size) => {
    if (!headerBuffer || headerBuffer.length === 0) {
        throw new FileInspectionError('File is empty (0 bytes)', 'ASSET_FILE_EMPTY', 400);
    }

    // Executable check (MZ DOS/PE)
    if (headerBuffer.length >= 2 && headerBuffer[0] === 0x4D && headerBuffer[1] === 0x5A) {
        throw new FileInspectionError('Executable binaries are strictly prohibited', 'ASSET_EXECUTABLE_REJECTED', 400);
    }

    // RAR check
    if (headerBuffer.length >= 4 && headerBuffer[0] === 0x52 && headerBuffer[1] === 0x61 && headerBuffer[2] === 0x72 && headerBuffer[3] === 0x21) {
        throw new FileInspectionError('RAR archives are not supported. Use standard ZIP format.', 'ASSET_RAR_REJECTED', 400);
    }

    // PDF check: %PDF-
    if (headerBuffer.length >= 5 && headerBuffer.subarray(0, 5).toString('ascii') === '%PDF-') {
        return { detectedMime: 'application/pdf', extension: 'pdf' };
    }

    // PNG check: 89 50 4E 47 0D 0A 1A 0A
    if (
        headerBuffer.length >= 8 &&
        headerBuffer[0] === 0x89 &&
        headerBuffer[1] === 0x50 &&
        headerBuffer[2] === 0x4E &&
        headerBuffer[3] === 0x47 &&
        headerBuffer[4] === 0x0D &&
        headerBuffer[5] === 0x0A &&
        headerBuffer[6] === 0x1A &&
        headerBuffer[7] === 0x0A
    ) {
        return { detectedMime: 'image/png', extension: 'png' };
    }

    // JPEG check: FF D8 FF
    if (
        headerBuffer.length >= 3 &&
        headerBuffer[0] === 0xFF &&
        headerBuffer[1] === 0xD8 &&
        headerBuffer[2] === 0xFF
    ) {
        return { detectedMime: 'image/jpeg', extension: 'jpg' };
    }

    // WEBP check: RIFF....WEBP
    if (
        headerBuffer.length >= 12 &&
        headerBuffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        headerBuffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
        return { detectedMime: 'image/webp', extension: 'webp' };
    }

    // OLE2 Compound Document (DOC / XLS legacy): D0 CF 11 E0 A1 B1 1A E1
    if (
        headerBuffer.length >= 8 &&
        headerBuffer[0] === 0xD0 &&
        headerBuffer[1] === 0xCF &&
        headerBuffer[2] === 0x11 &&
        headerBuffer[3] === 0xE0 &&
        headerBuffer[4] === 0xA1 &&
        headerBuffer[5] === 0xB1 &&
        headerBuffer[6] === 0x1A &&
        headerBuffer[7] === 0xE1
    ) {
        return { detectedMime: 'application/msword', extension: 'doc', isOle2: true };
    }

    // ZIP container check: 50 4B 03 04, 50 4B 05 06, 50 4B 07 08
    if (
        headerBuffer.length >= 4 &&
        headerBuffer[0] === 0x50 &&
        headerBuffer[1] === 0x4B &&
        ((headerBuffer[2] === 0x03 && headerBuffer[3] === 0x04) ||
         (headerBuffer[2] === 0x05 && headerBuffer[3] === 0x06) ||
         (headerBuffer[2] === 0x07 && headerBuffer[3] === 0x08))
    ) {
        return { isZip: true };
    }

    return null;
};

/**
 * Inspects a file on disk against policy, magic bytes, container structure, and checksum.
 *
 * @param {Object} params
 * @param {string} params.path - Absolute path to the file on disk
 * @param {string} params.originalName - User-provided original filename
 * @param {string} params.declaredMime - User/client-declared MIME type
 * @param {Object} params.policy - Asset policy from assetPolicyCatalog
 * @returns {Promise<Object>} Inspected file metadata
 */
const inspectFile = async ({ path: filePath, originalName, declaredMime, policy }) => {
    if (!filePath || !fs.existsSync(filePath)) {
        throw new FileInspectionError('File does not exist on disk', 'ASSET_FILE_NOT_FOUND', 404);
    }

    const stat = fs.statSync(filePath);
    const size = stat.size;

    // 1. Check size limits
    if (size === 0) {
        throw new FileInspectionError('File is empty (0 bytes)', 'ASSET_FILE_EMPTY', 400);
    }

    if (size > MAX_UPLOAD_BYTES) {
        throw new FileInspectionError(
            `File size (${size} bytes) exceeds maximum ceiling of 50 MB`,
            'ASSET_CEILING_EXCEEDED',
            413
        );
    }

    if (policy && policy.maxBytes && size > policy.maxBytes) {
        throw new FileInspectionError(
            `File size (${size} bytes) exceeds policy maxBytes (${policy.maxBytes} bytes)`,
            'ASSET_FILE_TOO_LARGE',
            413
        );
    }

    // 2. Read file header (first 4KB)
    const fd = fs.openSync(filePath, 'r');
    const headerBuffer = Buffer.alloc(Math.min(size, 4096));
    fs.readSync(fd, headerBuffer, 0, headerBuffer.length, 0);
    fs.closeSync(fd);

    // 3. Compute SHA-256
    const sha256 = await computeFileSha256(filePath);

    // 4. Magic bytes detection
    const magicResult = detectMagicBytes(headerBuffer, size);

    let detectedMime = null;
    let extension = null;

    if (magicResult && magicResult.isZip) {
        // Inspect ZIP container
        const zipDetails = await inspectZipArchive(filePath, size);
        detectedMime = zipDetails.detectedMime;
        extension = zipDetails.detectedExt;
    } else if (magicResult) {
        detectedMime = magicResult.detectedMime;
        extension = magicResult.extension;

        // Special handling for XLS if OLE2 and original filename is .xls
        if (magicResult.isOle2 && originalName) {
            const fileExt = path.extname(originalName).replace(/^\.+/, '').toLowerCase();
            if (fileExt === 'xls') {
                detectedMime = 'application/vnd.ms-excel';
                extension = 'xls';
            }
        }
    } else {
        throw new FileInspectionError(
            'Unable to determine valid file format or file format is not supported',
            'ASSET_FORMAT_UNKNOWN',
            400
        );
    }

    // Determine normalized extension from originalName if valid, else detected extension
    const originalExt = originalName ? path.extname(originalName).replace(/^\.+/, '').toLowerCase() : '';
    const finalExtension = (originalExt && (originalExt === extension || (originalExt === 'jpeg' && extension === 'jpg')))
        ? originalExt
        : extension;

    // 5. Match against policy
    if (policy) {
        // Extension check
        if (Array.isArray(policy.extensions) && policy.extensions.length > 0) {
            const extAllowed = policy.extensions.includes(finalExtension) || policy.extensions.includes(extension);
            if (!extAllowed) {
                throw new FileInspectionError(
                    `File extension '${finalExtension}' is not allowed for this document type. Allowed: ${policy.extensions.join(', ')}`,
                    'ASSET_EXTENSION_NOT_ALLOWED',
                    400
                );
            }
        }

        // MIME type check
        if (Array.isArray(policy.mimeTypes) && policy.mimeTypes.length > 0) {
            const mimeAllowed = policy.mimeTypes.includes(detectedMime);
            if (!mimeAllowed) {
                throw new FileInspectionError(
                    `Detected MIME '${detectedMime}' is not permitted by policy. Allowed: ${policy.mimeTypes.join(', ')}`,
                    'ASSET_MIME_NOT_ALLOWED',
                    400
                );
            }
        }
    }

    return {
        detectedMime,
        extension: finalExtension,
        sizeBytes: BigInt(size),
        sha256,
        isValid: true,
        error: null,
    };
};

module.exports = {
    FileInspectionError,
    inspectFile,
    computeFileSha256,
};
