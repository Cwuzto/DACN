const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { inspectFile, FileInspectionError } = require('../../src/storage/fileInspector');
const { getAssetPolicy, STORED_DOCUMENT_TYPES } = require('../../src/storage/assetPolicyCatalog');
const { getTempUploadDir, cleanupTempFile } = require('../../src/storage/tempFileManager');

// Helper to create a temporary test file in the temp upload directory
const createTestFile = (filename, content) => {
    const tempDir = getTempUploadDir();
    const filePath = path.join(tempDir, `test-${Date.now()}-${filename}`);
    fs.writeFileSync(filePath, content);
    return filePath;
};

// Simple CRC32 table implementation for test zip generation
const makeCRCTable = () => {
    let c;
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
};
const crcTable = makeCRCTable();
const crc32 = (buf) => {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
};

// Minimal valid zip builder helper without external tools
const createMinimalZipBuffer = (entries = []) => {
    const fileRecords = [];
    const centralDirectoryHeaders = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '', 'utf8');
        const fileCrc = crc32(dataBuf);
        
        // Local file header: 30 bytes + nameLen + extraLen(0)
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0); // signature
        localHeader.writeUInt16LE(20, 4); // version needed
        localHeader.writeUInt16LE(0, 6); // flags
        localHeader.writeUInt16LE(0, 8); // compression: 0 = stored
        localHeader.writeUInt16LE(0, 10); // mod time
        localHeader.writeUInt16LE(0, 12); // mod date
        localHeader.writeUInt32LE(fileCrc, 14); // crc32
        localHeader.writeUInt32LE(dataBuf.length, 18); // compressed size
        localHeader.writeUInt32LE(dataBuf.length, 22); // uncompressed size
        localHeader.writeUInt16LE(nameBuf.length, 26); // file name length
        localHeader.writeUInt16LE(0, 28); // extra field length

        const record = Buffer.concat([localHeader, nameBuf, dataBuf]);
        fileRecords.push(record);

        // Central directory header: 46 bytes + nameLen
        const cdHeader = Buffer.alloc(46);
        cdHeader.writeUInt32LE(0x02014b50, 0); // signature
        cdHeader.writeUInt16LE(20, 4); // version made by
        cdHeader.writeUInt16LE(20, 6); // version needed
        cdHeader.writeUInt16LE(0, 8); // flags
        cdHeader.writeUInt16LE(0, 10); // compression: 0 = stored
        cdHeader.writeUInt16LE(0, 12); // mod time
        cdHeader.writeUInt16LE(0, 14); // mod date
        cdHeader.writeUInt32LE(fileCrc, 16); // crc32
        cdHeader.writeUInt32LE(dataBuf.length, 20); // compressed size
        cdHeader.writeUInt32LE(dataBuf.length, 24); // uncompressed size
        cdHeader.writeUInt16LE(nameBuf.length, 28); // file name length
        cdHeader.writeUInt16LE(0, 30); // extra field length
        cdHeader.writeUInt16LE(0, 32); // comment length
        cdHeader.writeUInt16LE(0, 34); // disk number start
        cdHeader.writeUInt16LE(0, 36); // internal file attributes
        cdHeader.writeUInt32LE(0, 38); // external file attributes
        cdHeader.writeUInt32LE(offset, 42); // relative offset of local header

        centralDirectoryHeaders.push(Buffer.concat([cdHeader, nameBuf]));
        offset += record.length;
    }

    const cdStart = offset;
    const cdBuffer = Buffer.concat(centralDirectoryHeaders);
    const cdSize = cdBuffer.length;

    // End of central directory record (EOCD): 22 bytes
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // signature
    eocd.writeUInt16LE(0, 4); // disk number
    eocd.writeUInt16LE(0, 6); // disk with start of CD
    eocd.writeUInt16LE(entries.length, 8); // total entries on this disk
    eocd.writeUInt16LE(entries.length, 10); // total entries
    eocd.writeUInt32LE(cdSize, 12); // size of CD
    eocd.writeUInt32LE(cdStart, 16); // offset of start of CD
    eocd.writeUInt16LE(0, 20); // comment length

    return Buffer.concat([...fileRecords, cdBuffer, eocd]);
};

describe('Task 4: fileInspector Unit Tests', () => {
    const createdFiles = [];

    afterEach(() => {
        for (const f of createdFiles) {
            cleanupTempFile(f);
        }
        createdFiles.length = 0;
    });

    describe('Standard Document & Image Inspection', () => {
        test('inspects a valid PDF file matching BM01 policy', async () => {
            const pdfBytes = Buffer.concat([
                Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
            ]);
            const filePath = createTestFile('test.pdf', pdfBytes);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.BM01);
            const result = await inspectFile({
                path: filePath,
                originalName: 'De_Cuong.pdf',
                declaredMime: 'application/pdf',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('application/pdf');
            expect(result.extension).toBe('pdf');
            expect(Number(result.sizeBytes)).toBe(pdfBytes.length);
            expect(result.sha256).toBe(crypto.createHash('sha256').update(pdfBytes).digest('hex'));
        });

        test('inspects a valid PNG image matching USER_AVATAR policy', async () => {
            const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
            const filePath = createTestFile('avatar.png', pngHeader);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.USER_AVATAR);
            const result = await inspectFile({
                path: filePath,
                originalName: 'avatar.png',
                declaredMime: 'image/png',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('image/png');
            expect(result.extension).toBe('png');
        });

        test('inspects a valid JPEG image matching CHECKPOINT_EVIDENCE policy', async () => {
            const jpegBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
            const filePath = createTestFile('evidence.jpg', jpegBytes);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.CHECKPOINT_EVIDENCE);
            const result = await inspectFile({
                path: filePath,
                originalName: 'evidence.jpg',
                declaredMime: 'image/jpeg',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('image/jpeg');
            expect(result.extension).toBe('jpg');
        });

        test('inspects a valid WEBP image matching PORTAL_IMAGE policy', async () => {
            // RIFF + 4 bytes size + WEBP
            const webpBytes = Buffer.from([
                0x52, 0x49, 0x46, 0x46, // RIFF
                0x24, 0x00, 0x00, 0x00, // size
                0x57, 0x45, 0x42, 0x50, // WEBP
                0x56, 0x50, 0x38, 0x20, // VP8_
            ]);
            const filePath = createTestFile('banner.webp', webpBytes);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.PORTAL_IMAGE);
            const result = await inspectFile({
                path: filePath,
                originalName: 'banner.webp',
                declaredMime: 'image/webp',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('image/webp');
            expect(result.extension).toBe('webp');
        });

        test('inspects a valid DOC file (OLE2 Compound File) matching PORTAL_DOCUMENT policy', async () => {
            const docBytes = Buffer.from([
                0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            ]);
            const filePath = createTestFile('legacy.doc', docBytes);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.PORTAL_DOCUMENT);
            const result = await inspectFile({
                path: filePath,
                originalName: 'legacy.doc',
                declaredMime: 'application/msword',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('application/msword');
            expect(result.extension).toBe('doc');
        });
    });

    describe('ZIP and Office OpenXML Inspection', () => {
        test('inspects a valid DOCX container matching REPORT_WORD policy', async () => {
            const docxZip = createMinimalZipBuffer([
                { name: '[Content_Types].xml', data: '<Types><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>' },
                { name: '_rels/.rels', data: '<Relationships/>' },
                { name: 'word/document.xml', data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>' },
            ]);
            const filePath = createTestFile('report.docx', docxZip);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.REPORT_WORD);
            const result = await inspectFile({
                path: filePath,
                originalName: 'report.docx',
                declaredMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            expect(result.extension).toBe('docx');
        });

        test('inspects a valid PPTX container matching SLIDE_PPTX policy', async () => {
            const pptxZip = createMinimalZipBuffer([
                { name: '[Content_Types].xml', data: '<Types/>' },
                { name: 'ppt/presentation.xml', data: '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>' },
            ]);
            const filePath = createTestFile('slides.pptx', pptxZip);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.SLIDE_PPTX);
            const result = await inspectFile({
                path: filePath,
                originalName: 'slides.pptx',
                declaredMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
            expect(result.extension).toBe('pptx');
        });

        test('inspects a valid SOURCE_ZIP archive matching SOURCE_ZIP policy', async () => {
            const sourceZip = createMinimalZipBuffer([
                { name: 'src/index.js', data: 'console.log("hello world");' },
                { name: 'package.json', data: '{"name": "test-project"}' },
                { name: 'README.md', data: '# Test Project' },
            ]);
            const filePath = createTestFile('source.zip', sourceZip);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.SOURCE_ZIP);
            const result = await inspectFile({
                path: filePath,
                originalName: 'source.zip',
                declaredMime: 'application/zip',
                policy,
            });

            expect(result.isValid).toBe(true);
            expect(result.detectedMime).toBe('application/zip');
            expect(result.extension).toBe('zip');
        });
    });

    describe('Security Rejections & Boundaries', () => {
        test('rejects empty file (0 bytes)', async () => {
            const filePath = createTestFile('empty.pdf', Buffer.alloc(0));
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.BM01);
            await expect(
                inspectFile({
                    path: filePath,
                    originalName: 'empty.pdf',
                    declaredMime: 'application/pdf',
                    policy,
                })
            ).rejects.toThrow(/empty/i);
        });

        test('rejects file exceeding policy maxBytes', async () => {
            // USER_AVATAR policy maxBytes = 5 MB
            const fiveMbPlus = Buffer.alloc(5 * 1024 * 1024 + 1024);
            fiveMbPlus[0] = 0x89;
            fiveMbPlus[1] = 0x50;
            fiveMbPlus[2] = 0x4E;
            fiveMbPlus[3] = 0x47;
            fiveMbPlus[4] = 0x0D;
            fiveMbPlus[5] = 0x0A;
            fiveMbPlus[6] = 0x1A;
            fiveMbPlus[7] = 0x0A;

            const filePath = createTestFile('huge_avatar.png', fiveMbPlus);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.USER_AVATAR);
            await expect(
                inspectFile({
                    path: filePath,
                    originalName: 'huge.png',
                    declaredMime: 'image/png',
                    policy,
                })
            ).rejects.toThrow(/exceeds/i);
        });

        test('rejects file with declared MIME mismatch (executable disguised as PDF)', async () => {
            // MZ header (DOS/Windows Executable)
            const exeHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
            const filePath = createTestFile('malicious.pdf', exeHeader);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.BM01);
            await expect(
                inspectFile({
                    path: filePath,
                    originalName: 'malicious.pdf',
                    declaredMime: 'application/pdf',
                    policy,
                })
            ).rejects.toThrow(/mismatch|invalid|executable/i);
        });

        test('rejects ZIP archive containing path traversal (zip slip)', async () => {
            const traversalZip = createMinimalZipBuffer([
                { name: 'valid.txt', data: 'ok' },
                { name: '../../etc/passwd', data: 'root:x:0:0' },
            ]);
            const filePath = createTestFile('traversal.zip', traversalZip);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.SOURCE_ZIP);
            await expect(
                inspectFile({
                    path: filePath,
                    originalName: 'traversal.zip',
                    declaredMime: 'application/zip',
                    policy,
                })
            ).rejects.toThrow(/path traversal|unsafe/i);
        });

        test('rejects ZIP archive containing executable binaries (.exe, .sh, .bat)', async () => {
            const maliciousZip = createMinimalZipBuffer([
                { name: 'project/index.js', data: 'console.log("clean");' },
                { name: 'project/run.exe', data: Buffer.from([0x4D, 0x5A, 0x00, 0x00]) },
            ]);
            const filePath = createTestFile('malware.zip', maliciousZip);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.SOURCE_ZIP);
            await expect(
                inspectFile({
                    path: filePath,
                    originalName: 'malware.zip',
                    declaredMime: 'application/zip',
                    policy,
                })
            ).rejects.toThrow(/executable|forbidden file/i);
        });

        test('rejects Office file containing VBA macro (vbaProject.bin)', async () => {
            const macroDocx = createMinimalZipBuffer([
                { name: '[Content_Types].xml', data: '<Types/>' },
                { name: 'word/document.xml', data: '<w:document/>' },
                { name: 'word/vbaProject.bin', data: 'VBA binary code' },
            ]);
            const filePath = createTestFile('macro.docx', macroDocx);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.REPORT_WORD);
            await expect(
                inspectFile({
                    path: filePath,
                    originalName: 'macro.docx',
                    declaredMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    policy,
                })
            ).rejects.toThrow(/macro/i);
        });

        test('rejects disallowed archive formats such as RAR for academic documents', async () => {
            // Rar! magic bytes: 52 61 72 21 1A 07 00
            const rarBytes = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]);
            const filePath = createTestFile('archive.rar', rarBytes);
            createdFiles.push(filePath);

            const policy = getAssetPolicy(STORED_DOCUMENT_TYPES.SOURCE_ZIP);
            await expect(
                inspectFile({
                    path: filePath,
                    originalName: 'archive.rar',
                    declaredMime: 'application/x-rar-compressed',
                    policy,
                })
            ).rejects.toThrow(/rar|not supported|extension/i);
        });
    });
});
