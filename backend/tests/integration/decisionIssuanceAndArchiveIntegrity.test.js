jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
    },
    semester: {
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
        update: jest.fn(),
    },
    idempotencyRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
    },
    notification: {
        create: jest.fn().mockResolvedValue({}),
    },
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/academicDocumentService', () => ({
    createTopicDecision: jest.fn().mockResolvedValue({ id: 99, decisionNumber: 'QĐ-001' }),
    publishTopicDecision: jest.fn().mockResolvedValue({ id: 99, status: 'PUBLISHED' }),
}));

jest.mock('../../src/services/defenseDossierService', () => ({
    getDefenseDossier: jest.fn().mockResolvedValue({
        registrationId: 101,
        student: { id: 10, fullName: 'Sinh Vien A' },
        documents: [],
    }),
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
        code: 'TEST_GROUP',
        permissions: codes.map((code) => ({ permission: { code } })),
    },
}];

describe('Worker 4: Decision Issuance and Archive Integrity Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        prisma.$transaction.mockImplementation(async (callback) => {
            if (typeof callback === 'function') {
                return await callback(prisma);
            }
            return callback;
        });

        prisma.notification.create.mockResolvedValue({});

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-owner-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'other-student-token') return { userId: 11, role: 'STUDENT' };
            if (token === 'mentor-token') return { userId: 20, role: 'LECTURER' };
            if (token === 'council-member-token') return { userId: 30, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: 99, role: 'LECTURER' };
            if (token === 'academic-affairs-token') return { userId: 50, role: 'LECTURER' };
            if (token === 'director-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 10) {
                return {
                    id: 10,
                    fullName: 'Sinh Vien A',
                    code: 'SV001',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: permissionGroups('VIEW_MY_ARCHIVE'),
                };
            }
            if (where.id === 11) {
                return {
                    id: 11,
                    fullName: 'Sinh Vien B',
                    code: 'SV002',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: permissionGroups('VIEW_MY_ARCHIVE'),
                };
            }
            if (where.id === 20) {
                return {
                    id: 20,
                    fullName: 'GVHD C',
                    code: 'GV001',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: permissionGroups('FINAL_DOCUMENT_REVIEW', 'ARCHIVE_MENTOR_REVIEW'),
                };
            }
            if (where.id === 30) {
                return {
                    id: 30,
                    fullName: 'Uy Vien Hoi Dong D',
                    code: 'GV002',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: permissionGroups('VIEW_DEFENSE_GRADING', 'DEFENSE_SCORE_SUBMIT'),
                };
            }
            if (where.id === 99) {
                return {
                    id: 99,
                    fullName: 'Giang Vien Khac E',
                    code: 'GV099',
                    role: 'LECTURER',
                    isActive: true,
                    // Lecturer has VIEW_DEFENSE_GRADING for their own council, but NOT this student's council
                    permissionGroups: permissionGroups('VIEW_DEFENSE_GRADING'),
                };
            }
            if (where.id === 50) {
                return {
                    id: 50,
                    fullName: 'Giao Vu Khoa F',
                    code: 'GV050',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: permissionGroups('ARCHIVE_ACADEMIC_AFFAIRS_REVIEW', 'VIEW_PROJECT_ENROLLMENTS'),
                };
            }
            if (where.id === 1) {
                return {
                    id: 1,
                    fullName: 'Vien Truong G',
                    code: 'VT001',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: permissionGroups('PROJECT_ASSIGNMENT_PUBLISH', 'FINAL_DOCUMENT_REVIEW', 'VIEW_PROJECT_OVERSIGHT'),
                };
            }
            return null;
        });
    });

    describe('1. issueTopicAssignmentDecisions with BM02_APPROVED Status', () => {
        it('should successfully find and process registrations at status BM02_APPROVED', async () => {
            prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
            prisma.semester.findUnique.mockResolvedValue({
                id: 1,
                name: 'HK1 2026-2027',
            });

            let queriedStatusFilter = null;
            prisma.topicRegistration.findMany.mockImplementation(async ({ where }) => {
                queriedStatusFilter = where.status;
                return [
                    {
                        id: 101,
                        studentId: 10,
                        semesterId: 1,
                        status: 'BM02_APPROVED',
                        student: { id: 10, fullName: 'Sinh Vien A', code: 'SV001' },
                        topic: { id: 201, title: 'He thong IoT Smart Home', mentorId: 20 },
                        currentBM02Submission: {
                            id: 501,
                            registrationId: 101,
                            outcome: 'APPROVED',
                        },
                    },
                ];
            });

            const res = await request(app)
                .post('/api/semesters/1/issue-decision')
                .set('Authorization', 'Bearer director-token')
                .set('Idempotency-Key', 'issue-dec-key-12345678')
                .send({
                    decisionNumber: 'QĐ-CNTT-2026-001',
                    decisionDate: '2026-11-15',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(queriedStatusFilter).toBeDefined();
            expect(queriedStatusFilter.in).toContain('BM02_APPROVED');
            expect(queriedStatusFilter.in).toContain('BM02_SUBMITTED');
            expect(queriedStatusFilter.in).toContain('BM02_RESUBMITTED');
        });
    });

    describe('2. reviewArchive Integrity (No direct bypass to COMPLETED)', () => {
        it('should NOT bypass registration status directly to COMPLETED when GVHD reviews archive', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'DEFENSE_PASSED',
                stateVersion: 3,
                topic: { id: 201, title: 'He thong IoT Smart Home', mentorId: 20 },
                archive: { id: 55, status: 'SUBMITTED' },
                defenseResult: { finalScore: 8.5 },
            });

            let updatedRegistrationStatus = null;
            prisma.$transaction.mockImplementation(async (callback) => {
                const tx = {
                    projectArchive: {
                        update: jest.fn().mockImplementation(async ({ data }) => ({
                            id: 55,
                            ...data,
                            reviewer: { id: 20, fullName: 'GVHD C', code: 'GV001', role: 'LECTURER' },
                        })),
                    },
                    topicRegistration: {
                        update: jest.fn().mockImplementation(async ({ data }) => {
                            updatedRegistrationStatus = data.status;
                            return { id: 101, status: data.status };
                        }),
                    },
                    registrationStateHistory: {
                        create: jest.fn().mockResolvedValue({}),
                    },
                };
                return await callback(tx);
            });

            const res = await request(app)
                .post('/api/archives/registrations/101/review')
                .set('Authorization', 'Bearer mentor-token')
                .send({
                    decision: 'APPROVED',
                    reviewerNotes: 'Hồ sơ lưu chiểu chuyên môn đạt yêu cầu.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            // Must NOT have bypassed topicRegistration to COMPLETED
            expect(updatedRegistrationStatus).not.toBe('COMPLETED');
            expect(res.body.data.status).toBe('MENTOR_APPROVED');
            expect(res.body.data.mentorReviewStatus).toBe('APPROVED');
        });
    });

    describe('3. getDefenseDossier Access Control (Forbidden vs Authorized)', () => {
        const mockRegistration = {
            id: 101,
            studentId: 10,
            topic: { mentorId: 20 },
            defenseCouncil: {
                members: [
                    { lecturerId: 30, isActive: true },
                ],
            },
            council: {
                members: [],
            },
        };

        it('should return 403 FORBIDDEN_DOSSIER_ACCESS when unauthorized student requests dossier', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue(mockRegistration);

            const res = await request(app)
                .get('/api/archives/registrations/101/dossier')
                .set('Authorization', 'Bearer other-student-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN_DOSSIER_ACCESS');
        });

        it('should return 403 FORBIDDEN_DOSSIER_ACCESS when unauthorized lecturer requests dossier', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue(mockRegistration);

            const res = await request(app)
                .get('/api/archives/registrations/101/dossier')
                .set('Authorization', 'Bearer other-lecturer-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN_DOSSIER_ACCESS');
        });

        it('should allow student owner to access their own dossier', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue(mockRegistration);

            const res = await request(app)
                .get('/api/archives/registrations/101/dossier')
                .set('Authorization', 'Bearer student-owner-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.registrationId).toBe(101);
        });

        it('should allow mentor to access the student dossier', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue(mockRegistration);

            const res = await request(app)
                .get('/api/archives/registrations/101/dossier')
                .set('Authorization', 'Bearer mentor-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.registrationId).toBe(101);
        });

        it('should allow assigned defense council member to access dossier', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue(mockRegistration);

            const res = await request(app)
                .get('/api/archives/registrations/101/dossier')
                .set('Authorization', 'Bearer council-member-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.registrationId).toBe(101);
        });

        it('should allow Academic Affairs reviewer to access dossier', async () => {
            const res = await request(app)
                .get('/api/archives/registrations/101/dossier')
                .set('Authorization', 'Bearer academic-affairs-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.registrationId).toBe(101);
        });
    });
});
