const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const upload = require('../../src/middlewares/upload');
const { getTempUploadDir, cleanupTempFile, cleanupRequestTempFiles } = require('../../src/storage/tempFileManager');

describe('Task 4: Upload Security and Temp File Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Test route using disk-backed upload.single
        app.post('/test/upload-single', upload.single('file'), (req, res) => {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            res.status(200).json({
                filename: req.file.filename,
                path: req.file.path,
                size: req.file.size,
                mimetype: req.file.mimetype,
            });
        });

        // Test route with error in handler to verify cleanup
        app.post('/test/upload-error', upload.single('file'), (req, res, next) => {
            const err = new Error('Simulated processing failure');
            err.statusCode = 500;
            next(err);
        });

        // Standard error handler
        app.use((err, req, res, next) => {
            // Clean up files on error
            cleanupRequestTempFiles(req);
            res.status(err.statusCode || (err.message && err.message.includes('file') ? 400 : 500)).json({
                error: err.message || 'Internal server error',
            });
        });
    });

    test('stores incoming multipart file in isolated temp directory and validates magic bytes', async () => {
        const validPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');

        const response = await request(app)
            .post('/test/upload-single')
            .attach('file', validPdfBytes, { filename: 'test.pdf', contentType: 'application/pdf' });

        expect(response.status).toBe(200);
        expect(response.body.path).toBeDefined();

        const filePath = response.body.path;
        const tempDir = getTempUploadDir();
        // Check that path is within the dedicated temp upload directory
        expect(path.resolve(filePath).startsWith(path.resolve(tempDir))).toBe(true);

        // Clean up test file
        cleanupTempFile(filePath);
        expect(fs.existsSync(filePath)).toBe(false);
    });

    test('rejects disallowed format (e.g. RAR archive)', async () => {
        const rarBytes = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]);

        const response = await request(app)
            .post('/test/upload-single')
            .attach('file', rarBytes, { filename: 'archive.rar', contentType: 'application/x-rar-compressed' });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/không được hỗ trợ|disallowed|unsupported/i);
    });

    test('cleans up temp files when request processing fails with an error', async () => {
        const validPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');

        const response = await request(app)
            .post('/test/upload-error')
            .attach('file', validPdfBytes, { filename: 'failing.pdf', contentType: 'application/pdf' });

        expect(response.status).toBe(500);

        // Verify that no orphaned file remains in temp upload directory for this request
        const tempFiles = fs.readdirSync(getTempUploadDir());
        const matching = tempFiles.filter((f) => f.includes('failing'));
        expect(matching.length).toBe(0);
    });
});
