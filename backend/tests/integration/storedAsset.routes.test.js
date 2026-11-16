const express = require('express');
const request = require('supertest');

// We will mock storedAssetService to focus the route test on HTTP contracts
jest.mock('../../src/services/storedAssetService', () => {
    const original = jest.requireActual('../../src/services/storedAssetService');
    return {
        ...original,
        storedAssetService: {
            ingestAsset: jest.fn(),
            createUploadSession: jest.fn(),
            finalizeUploadSession: jest.fn(),
            abortUploadSession: jest.fn(),
            getAssetDownload: jest.fn(),
        },
    };
});

// Mock authenticateToken to simulate an authenticated user
jest.mock('../../src/middlewares/auth', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 'mock-user-1', role: 'STUDENT', email: 'student@example.com' };
        next();
    },
    optionalAuthenticateToken: (req, res, next) => {
        req.user = { id: 'mock-user-1', role: 'STUDENT' };
        next();
    },
    optionalAuthenticate: (req, res, next) => {
        req.user = { id: 'mock-user-1', role: 'STUDENT' };
        next();
    },
}));

const storedAssetRoutes = require('../../src/routes/storedAssetRoutes');
const { storedAssetService } = require('../../src/services/storedAssetService');

describe('Task 5: Stored Asset Routes Integration Tests', () => {
    let app;

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.use(express.json());
        app.use('/api/assets', storedAssetRoutes);

        // Global error handler
        app.use((err, req, res, next) => {
            res.status(err.statusCode || 500).json({
                error: err.message,
                code: err.code || 'INTERNAL_ERROR',
            });
        });
    });

    describe('POST /api/assets (Multipart <= 6MB)', () => {
        test('successfully uploads and ingests multipart file <= 6MB', async () => {
            storedAssetService.ingestAsset.mockResolvedValueOnce({
                id: 'asset-1',
                documentType: 'BM01',
                status: 'ACTIVE',
                sizeBytes: '1024',
                originalName: 'de_cuong.pdf',
            });

            const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');

            const res = await request(app)
                .post('/api/assets')
                .field('documentType', 'BM01')
                .field('resourceContext', JSON.stringify({ registrationId: 101 }))
                .attach('file', pdfBytes, { filename: 'de_cuong.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('asset-1');
            expect(storedAssetService.ingestAsset).toHaveBeenCalled();
        });

        test('returns 422 ASSET_TUS_REQUIRED when file exceeds 6MB threshold', async () => {
            const err = new Error('File exceeds 6MB threshold; please use TUS resumable upload.');
            err.code = 'ASSET_TUS_REQUIRED';
            err.statusCode = 422;
            storedAssetService.ingestAsset.mockRejectedValueOnce(err);

            const res = await request(app)
                .post('/api/assets')
                .field('documentType', 'BM01')
                .attach('file', Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'), { filename: 'large.pdf', contentType: 'application/pdf' });

            expect(res.status).toBe(422);
            expect(res.body.code).toBe('ASSET_TUS_REQUIRED');
        });
    });

    describe('POST /api/assets/upload-sessions (TUS Resumable Session)', () => {
        test('creates TUS session and returns upload endpoint and chunk size', async () => {
            storedAssetService.createUploadSession.mockResolvedValueOnce({
                sessionId: 'session-123',
                tusEndpoint: 'https://project.supabase.co/storage/v1/upload/resumable',
                chunkSizeBytes: 6291456,
                stagingBucket: 'tam',
                stagingObjectKey: 'cho-kiem-tra/uuid.pdf',
                token: 'signed-token',
            });

            const res = await request(app)
                .post('/api/assets/upload-sessions')
                .send({
                    documentType: 'REPORT_PDF',
                    resourceContext: { registrationId: 101 },
                    originalName: 'BaoCao.pdf',
                    declaredMime: 'application/pdf',
                    sizeBytes: 15 * 1024 * 1024,
                });

            expect(res.status).toBe(201);
            expect(res.body.sessionId).toBe('session-123');
            expect(res.body.chunkSizeBytes).toBe(6291456);
            expect(storedAssetService.createUploadSession).toHaveBeenCalled();
        });
    });

    describe('POST /api/assets/upload-sessions/:id/finalize', () => {
        test('finalizes staged TUS upload and returns active StoredAsset', async () => {
            storedAssetService.finalizeUploadSession.mockResolvedValueOnce({
                id: 'asset-finalized-1',
                documentType: 'REPORT_PDF',
                status: 'ACTIVE',
            });

            const res = await request(app)
                .post('/api/assets/upload-sessions/session-123/finalize')
                .send();

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('asset-finalized-1');
            expect(storedAssetService.finalizeUploadSession).toHaveBeenCalledWith(
                expect.objectContaining({ sessionId: 'session-123' })
            );
        });
    });

    describe('DELETE /api/assets/upload-sessions/:id', () => {
        test('aborts upload session and enqueues staging cleanup', async () => {
            storedAssetService.abortUploadSession.mockResolvedValueOnce();

            const res = await request(app)
                .delete('/api/assets/upload-sessions/session-123');

            expect(res.status).toBe(200);
            expect(storedAssetService.abortUploadSession).toHaveBeenCalledWith(
                expect.objectContaining({ sessionId: 'session-123' })
            );
        });
    });

    describe('GET /api/assets/:id/download', () => {
        test('returns download URL and metadata for authorized actor', async () => {
            storedAssetService.getAssetDownload.mockResolvedValueOnce({
                url: 'https://example.com/signed-url',
                expiresAt: '2026-11-17T01:10:00Z',
                fileName: 'DeCuong.pdf',
                visibility: 'PRIVATE',
            });

            const res = await request(app)
                .get('/api/assets/asset-1/download');

            expect(res.status).toBe(200);
            expect(res.body.url).toBe('https://example.com/signed-url');
            expect(res.body.fileName).toBe('DeCuong.pdf');
        });
    });
});
