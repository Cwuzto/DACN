jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
    },
    topicRegistration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
    },
    projectArchive: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    defenseDocumentVersion: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
    },
    storedAsset: {
        findUnique: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/storedAssetService', () => ({
    storedAssetService: {
        assertAssetAccess: jest.fn().mockResolvedValue({
            id: 'asset-word-1',
            originalName: 'report.docx',
            sizeBytes: 1024,
            sha256: 'a'.repeat(64),
        }),
    },
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

const permissionGroups = (...codes) => [{
    permissionGroup: {
        code: 'TEST',
        permissions: codes.map((code) => ({ permission: { code } })),
    },
}];

describe('Integration - Archive Submission Eligibility & Video Demo HTTPS (Task 1: P0.20, P2.1)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-owner-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'student-other-token') return { userId: 11, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return { id: 10, role: 'STUDENT', isActive: true, fullName: 'Sinh Vien A' };
            if (where.id === 11) return { id: 11, role: 'STUDENT', isActive: true, fullName: 'Sinh Vien B' };
            if (where.id === 2) return { id: 2, role: 'LECTURER', isActive: true, fullName: 'GVHD C', permissionGroups: permissionGroups('FINAL_DOCUMENT_REVIEW') };
            if (where.id === 1) return { id: 1, role: 'ADMIN', isActive: true, fullName: 'Admin', permissionGroups: permissionGroups('FINAL_DOCUMENT_REVIEW', 'PROJECT_ASSIGNMENT_PUBLISH') };
            return null;
        });
    });

    describe('1. Registration Eligibility Policy for POST /api/archives/registrations/:id/files', () => {
        it('rejects upload when student status is DEFENSE_FAILED with HTTP 400', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_FAILED',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'https://youtube.com/watch?v=valid123',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('REGISTRATION_NOT_ELIGIBLE');
            expect(res.body.message).toContain('không đủ điều kiện');
        });

        it('rejects upload when student status is NOT_ELIGIBLE_FOR_DEFENSE with HTTP 400', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 10,
                status: 'NOT_ELIGIBLE_FOR_DEFENSE',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/102/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'https://youtube.com/watch?v=valid123',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('REGISTRATION_NOT_ELIGIBLE');
        });

        it('rejects upload when student status is AUTO_TERMINATED with HTTP 400', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 103,
                studentId: 10,
                status: 'AUTO_TERMINATED',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/103/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'https://youtube.com/watch?v=valid123',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('REGISTRATION_NOT_ELIGIBLE');
        });

        it('rejects upload when dossier does not belong to the calling student actor with HTTP 403', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10, // belongs to student 10
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/files')
                .set('Authorization', 'Bearer student-other-token') // student 11 calling
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'https://youtube.com/watch?v=valid123',
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN_DOSSIER_ACCESS');
        });
    });

    describe('2. Video Demo HTTPS Validation Policy', () => {
        it('rejects direct file upload for DEMO_VIDEO via assetId with HTTP 400', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    assetId: 'some-asset-id',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('DIRECT_VIDEO_UPLOAD_NOT_ALLOWED');
        });

        it('rejects direct video upload via fileUrl without demoVideoExternalUrl with HTTP 400', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    fileUrl: 'https://storage/demo.mp4',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('DIRECT_VIDEO_UPLOAD_NOT_ALLOWED');
        });

        it('rejects http: URL for demoVideoExternalUrl with HTTP 400 and code INVALID_DEMO_VIDEO_URL', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'http://insecure-video.com/demo.mp4',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('INVALID_DEMO_VIDEO_URL');
        });

        it('rejects malformed non-URL string for demoVideoExternalUrl with HTTP 400 and code INVALID_DEMO_VIDEO_URL', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'not-a-valid-url',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('INVALID_DEMO_VIDEO_URL');
        });

        it('accepts valid https: URL for demoVideoExternalUrl with HTTP 200', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                topic: { mentorId: 2 },
                archive: null,
            });

            prisma.projectArchive.upsert.mockResolvedValue({
                id: 1,
                registrationId: 101,
                status: 'SUBMITTED',
            });

            prisma.defenseDocumentVersion.findFirst.mockResolvedValue(null);
            prisma.defenseDocumentVersion.create.mockResolvedValue({
                id: 50,
                registrationId: 101,
                documentType: 'DEMO_VIDEO',
                versionNumber: 1,
                demoVideoExternalUrl: 'https://youtube.com/watch?v=valid123',
                fileUrl: 'https://youtube.com/watch?v=valid123',
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/files')
                .set('Authorization', 'Bearer student-owner-token')
                .send({
                    documentType: 'DEMO_VIDEO',
                    demoVideoExternalUrl: 'https://youtube.com/watch?v=valid123',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.version.demoVideoExternalUrl).toBe('https://youtube.com/watch?v=valid123');
        });
    });
});
