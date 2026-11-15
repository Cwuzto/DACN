const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
    },
    topic: {
        findUnique: jest.fn(),
        count: jest.fn(),
    },
    task: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
    },
    submission: {
        findMany: jest.fn(),
    },
    meetingLog: {
        count: jest.fn(),
    },
    periodWorkflowPolicyVersion: {
        findMany: jest.fn(),
    },
    bM02AAdjustmentRequest: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
    },
    titleAdjustmentAppendixItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    academicDelegation: {
        findMany: jest.fn(),
    },
};

jest.mock('../../src/config/database', () => mockPrisma);

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn(),
}));

jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');

describe('Integration - Student Defense Result Privacy & BM02-A IDOR Protection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        if (prisma.periodWorkflowPolicyVersion?.findMany) {
            prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([{ id: 1, version: 1, isActive: true }]);
        }
        if (prisma.academicDelegation?.findMany) {
            prisma.academicDelegation.findMany.mockResolvedValue([]);
        }

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token-a') return { userId: 10, role: 'STUDENT' };
            if (token === 'student-token-b') return { userId: 20, role: 'STUDENT' };
            if (token === 'lecturer-mentor-token') return { userId: 100, role: 'LECTURER' };
            if (token === 'lecturer-other-token') return { userId: 200, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where?.id === 10) {
                return {
                    id: 10,
                    email: 'student_a@example.com',
                    fullName: 'Sinh Vien A',
                    code: 'SV010',
                    role: 'STUDENT',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 20) {
                return {
                    id: 20,
                    email: 'student_b@example.com',
                    fullName: 'Sinh Vien B',
                    code: 'SV020',
                    role: 'STUDENT',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 100) {
                return {
                    id: 100,
                    email: 'mentor@example.com',
                    fullName: 'Giang Vien Huong Dan',
                    code: 'GV100',
                    role: 'LECTURER',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 200) {
                return {
                    id: 200,
                    email: 'other_lecturer@example.com',
                    fullName: 'Giang Vien Khac',
                    code: 'GV200',
                    role: 'LECTURER',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where?.id === 1) {
                return {
                    id: 1,
                    email: 'admin@example.com',
                    fullName: 'Quan Tri Vien',
                    code: 'AD001',
                    role: 'ADMIN',
                    department: 'CNTT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });
    });

    describe('Privacy of Defense Results (Registration & Student Dashboard)', () => {
        const activeSemester = {
            id: 1,
            name: 'HK1 2026-2027',
            status: 'DEFENSE',
            startDate: new Date('2026-09-01'),
            endDate: new Date('2027-01-30'),
        };

        const createMockRegistration = (isPublished) => ({
            id: 101,
            studentId: 10,
            semesterId: 1,
            status: 'DEFENSE_COMPLETED',
            student: {
                id: 10,
                fullName: 'Sinh Vien A',
                code: 'SV010',
            },
            topic: {
                id: 50,
                title: 'Hệ thống Quản lý Khóa luận',
                mentorId: 100,
                mentor: { id: 100, fullName: 'Giang Vien Huong Dan', code: 'GV100' },
            },
            tasks: [],
            meetingLogs: [],
            defenseResult: {
                id: 88,
                registrationId: 101,
                councilScore: 9.2,
                finalScoreSnapshot: 9.2,
                feedback: 'Trình bày xuất sắc, đáp ứng đầy đủ yêu cầu.',
                isPublished,
            },
        });

        test('GET /api/registrations/my-registration masks defenseResult when isPublished is false', async () => {
            prisma.semester.findFirst.mockResolvedValue(activeSemester);
            prisma.topicRegistration.findFirst.mockResolvedValue(createMockRegistration(false));

            const response = await request(app)
                .get('/api/registrations/my-registration')
                .set('Authorization', 'Bearer student-token-a')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            // defenseResult must be null when unpublished
            expect(response.body.data.defenseResult).toBeNull();
        });

        test('GET /api/registrations/my-registration exposes defenseResult when isPublished is true', async () => {
            prisma.semester.findFirst.mockResolvedValue(activeSemester);
            prisma.topicRegistration.findFirst.mockResolvedValue(createMockRegistration(true));

            const response = await request(app)
                .get('/api/registrations/my-registration')
                .set('Authorization', 'Bearer student-token-a')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.defenseResult).toBeDefined();
            expect(response.body.data.defenseResult.finalScoreSnapshot).toBe(9.2);
            expect(response.body.data.defenseResult.isPublished).toBe(true);
        });

        test('GET /api/dashboard/student masks defenseResult when isPublished is false', async () => {
            prisma.semester.findFirst.mockResolvedValue(activeSemester);
            prisma.topicRegistration.findFirst.mockResolvedValue(createMockRegistration(false));
            prisma.task.findMany.mockResolvedValue([]);

            const response = await request(app)
                .get('/api/dashboard/student')
                .set('Authorization', 'Bearer student-token-a')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.registration).toBeDefined();
            expect(response.body.data.registration.defenseResult).toBeNull();
        });

        test('GET /api/dashboard/student exposes defenseResult when isPublished is true', async () => {
            prisma.semester.findFirst.mockResolvedValue(activeSemester);
            prisma.topicRegistration.findFirst.mockResolvedValue(createMockRegistration(true));
            prisma.task.findMany.mockResolvedValue([]);

            const response = await request(app)
                .get('/api/dashboard/student')
                .set('Authorization', 'Bearer student-token-a')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.registration.defenseResult).toBeDefined();
            expect(response.body.data.registration.defenseResult.finalScoreSnapshot).toBe(9.2);
            expect(response.body.data.registration.defenseResult.isPublished).toBe(true);
        });
    });

    describe('IDOR & Ownership Controls on BM02-A Requests', () => {
        const mockBM02ARequestOfStudentA = {
            id: 501,
            registrationId: 101,
            proposedTitle: 'Hệ thống Quản lý Khóa luận Tốt nghiệp Nâng cao',
            reason: 'Mở rộng phạm vi nghiên cứu theo yêu cầu thực tế',
            status: 'PENDING_ADVISOR',
            registration: {
                id: 101,
                studentId: 10,
                student: { id: 10, fullName: 'Sinh Vien A', code: 'SV010', email: 'student_a@example.com' },
                topic: {
                    id: 50,
                    mentorId: 100,
                    mentor: { id: 100, fullName: 'Giang Vien Huong Dan', code: 'GV100' },
                },
            },
            versions: [],
            appendixItems: [],
        };

        test('GET /api/bm02a/requests/:id returns 403 FORBIDDEN_RESOURCE when Student B accesses Student A request', async () => {
            prisma.bM02AAdjustmentRequest.findUnique.mockResolvedValue(mockBM02ARequestOfStudentA);

            const response = await request(app)
                .get('/api/bm02a/requests/501')
                .set('Authorization', 'Bearer student-token-b')
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
        });

        test('GET /api/bm02a/requests/:id returns 200 when Student A accesses their own request', async () => {
            prisma.bM02AAdjustmentRequest.findUnique.mockResolvedValue(mockBM02ARequestOfStudentA);

            const response = await request(app)
                .get('/api/bm02a/requests/501')
                .set('Authorization', 'Bearer student-token-a')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(501);
            expect(response.body.data.proposedTitle).toBe('Hệ thống Quản lý Khóa luận Tốt nghiệp Nâng cao');
        });

        test('GET /api/bm02a/requests/:id returns 403 when unrelated Lecturer accesses Student A request', async () => {
            prisma.bM02AAdjustmentRequest.findUnique.mockResolvedValue(mockBM02ARequestOfStudentA);

            const response = await request(app)
                .get('/api/bm02a/requests/501')
                .set('Authorization', 'Bearer lecturer-other-token')
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
        });

        test('GET /api/bm02a/requests/:id returns 200 when Mentor (GVHD) accesses Student A request', async () => {
            prisma.bM02AAdjustmentRequest.findUnique.mockResolvedValue(mockBM02ARequestOfStudentA);

            const response = await request(app)
                .get('/api/bm02a/requests/501')
                .set('Authorization', 'Bearer lecturer-mentor-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(501);
        });

        test('GET /api/bm02a/requests/:id returns 200 when Admin accesses Student A request', async () => {
            prisma.bM02AAdjustmentRequest.findUnique.mockResolvedValue(mockBM02ARequestOfStudentA);

            const response = await request(app)
                .get('/api/bm02a/requests/501')
                .set('Authorization', 'Bearer admin-token')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(501);
        });

        test('GET /api/bm02a/registrations/:registrationId returns 403 when Student B accesses Student A registration BM02-A list', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                topic: { mentorId: 100 },
            });

            const response = await request(app)
                .get('/api/bm02a/registrations/101')
                .set('Authorization', 'Bearer student-token-b')
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
        });

        test('GET /api/bm02a/registrations/:registrationId returns 200 when Student A accesses their own registration BM02-A list', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                topic: { mentorId: 100 },
            });
            prisma.bM02AAdjustmentRequest.findMany.mockResolvedValue([mockBM02ARequestOfStudentA]);

            const response = await request(app)
                .get('/api/bm02a/registrations/101')
                .set('Authorization', 'Bearer student-token-a')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBe(1);
        });
    });
});
