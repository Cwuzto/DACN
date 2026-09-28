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
    },
    notification: {
        create: jest.fn(),
    },
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - Project Archive & Clearance Certificate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'other-student-token') return { userId: 11, role: 'STUDENT' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: 99, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) return { id: 10, role: 'STUDENT', isActive: true, fullName: 'Sinh Vien A' };
            if (where.id === 11) return { id: 11, role: 'STUDENT', isActive: true, fullName: 'Sinh Vien B' };
            if (where.id === 2) return { id: 2, role: 'LECTURER', isActive: true, fullName: 'GVHD C' };
            if (where.id === 99) return { id: 99, role: 'LECTURER', isActive: true, fullName: 'GV Khac D' };
            if (where.id === 1) return { id: 1, role: 'ADMIN', isActive: true, fullName: 'Admin' };
            return null;
        });
    });

    describe('GET /api/archives/registrations/:registrationId', () => {
        it('allows the student owner to view their archive details', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENDED',
                topic: { mentorId: 2, title: 'Hệ thống AI' },
                archive: {
                    id: 1,
                    status: 'SUBMITTED',
                    reportFileUrl: 'https://example.com/report.pdf',
                    demoVideoUrl: 'https://youtube.com/watch?v=123',
                },
            });

            const res = await request(app)
                .get('/api/archives/registrations/101')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.archive.status).toBe('SUBMITTED');
        });

        it('forbids another student from viewing the archive', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                topic: { mentorId: 2 },
            });

            const res = await request(app)
                .get('/api/archives/registrations/101')
                .set('Authorization', 'Bearer other-student-token');

            expect(res.status).toBe(403);
        });
    });

    describe('POST /api/archives/registrations/:registrationId (Submit Archive)', () => {
        it('rejects archive submission if the student has not passed defense', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'IN_PROGRESS',
                defenseResult: null,
            });

            const res = await request(app)
                .post('/api/archives/registrations/101')
                .set('Authorization', 'Bearer student-token')
                .send({
                    reportFileUrl: 'https://example.com/report.pdf',
                    demoVideoUrl: 'https://youtube.com/watch?v=xyz',
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('chưa hoàn tất bảo vệ');
        });

        it('accepts archive submission when student is DEFENDED and provides demo/report links', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENDED',
                topic: { mentorId: 2, title: 'Hệ thống IoT' },
                defenseResult: { finalScore: 8.5 },
            });

            prisma.projectArchive.upsert.mockResolvedValue({
                id: 5,
                registrationId: 101,
                status: 'SUBMITTED',
                reportFileUrl: 'https://example.com/report.pdf',
                demoVideoUrl: 'https://youtube.com/watch?v=iot-demo',
                sourceCodeUrl: 'https://github.com/tdmu/iot-project',
            });

            prisma.notification.create.mockResolvedValue({});

            const res = await request(app)
                .post('/api/archives/registrations/101')
                .set('Authorization', 'Bearer student-token')
                .send({
                    reportFileUrl: 'https://example.com/report.pdf',
                    reportFileName: 'BaoCao_HoanThien.pdf',
                    demoVideoUrl: 'https://youtube.com/watch?v=iot-demo',
                    sourceCodeUrl: 'https://github.com/tdmu/iot-project',
                    summary: 'Đã tích hợp đầy đủ theo góp ý của Hội đồng bảo vệ.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('SUBMITTED');
            expect(prisma.projectArchive.upsert).toHaveBeenCalled();
        });
    });

    describe('POST /api/archives/registrations/:registrationId/review (Review Archive)', () => {
        it('forbids lecturers who are not mentors from approving archive', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                topic: { mentorId: 2 },
                archive: { id: 5, status: 'SUBMITTED' },
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/review')
                .set('Authorization', 'Bearer other-lecturer-token')
                .send({ decision: 'APPROVED' });

            expect(res.status).toBe(403);
        });

        it('approves archive and upgrades topic registration status to COMPLETED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                topic: { mentorId: 2, title: 'Ứng dụng AI' },
                archive: { id: 5, status: 'SUBMITTED' },
            });

            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    projectArchive: {
                        update: jest.fn().mockResolvedValue({
                            id: 5,
                            status: 'APPROVED',
                            reviewedBy: 2,
                        }),
                    },
                    topicRegistration: {
                        update: jest.fn().mockResolvedValue({
                            id: 101,
                            status: 'COMPLETED',
                        }),
                    },
                };
                return await callback(tx);
            });

            prisma.notification.create.mockResolvedValue({});

            const res = await request(app)
                .post('/api/archives/registrations/101/review')
                .set('Authorization', 'Bearer lecturer-token')
                .send({
                    decision: 'APPROVED',
                    reviewerNotes: 'Hồ sơ lưu chiểu đầy đủ, chuẩn quy cách viện.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('COMPLETED');
        });
    });

    describe('GET /api/archives/registrations/:registrationId/clearance-certificate', () => {
        it('returns 400 if archive has not been officially approved', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                status: 'DEFENDED',
                archive: { status: 'SUBMITTED' },
            });

            const res = await request(app)
                .get('/api/archives/registrations/101/clearance-certificate')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('chưa được nghiệm thu');
        });

        it('generates certificate data when registration is COMPLETED / archive APPROVED', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                status: 'COMPLETED',
                student: { fullName: 'Nguyễn Văn A', code: '212480103001', department: 'CNTT' },
                topic: {
                    title: 'Xây dựng hệ thống Big Data',
                    mentor: { fullName: 'TS. Trần Văn B', academicTitle: 'TIEN_SI' },
                    projectCatalog: { name: 'Khóa luận tốt nghiệp' },
                },
                defenseResult: { finalScore: 9.0 },
                defenseCouncil: { name: 'Hội đồng CNTT 01' },
                archive: {
                    status: 'APPROVED',
                    reviewedAt: new Date('2026-06-20'),
                    reviewer: { fullName: 'TS. Trần Văn B' },
                },
            });

            const res = await request(app)
                .get('/api/archives/registrations/101/clearance-certificate')
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.certificateNumber).toContain('TDMU-DA-CERT');
            expect(res.body.data.evaluation.letterGrade).toBe('A');
            expect(res.body.data.evaluation.finalScore).toBe(9.0);
        });
    });

    describe('GET /api/archives/health-radar', () => {
        it('calculates health radar metrics and inactive students', async () => {
            prisma.topicRegistration.findMany
                .mockResolvedValueOnce([]) // defended
                .mockResolvedValueOnce([]); // in progress

            prisma.projectArchive.count.mockResolvedValue(2);

            const res = await request(app)
                .get('/api/archives/health-radar')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.pendingArchiveReviewCount).toBe(2);
        });
    });
});
