const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    topicRegistration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
    },
    councilMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    bM03ProgressRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    bM04Evaluation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    academicDelegation: {
        findMany: jest.fn(),
    },
    auditLog: {
        create: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/notificationService', () => ({
    safeNotify: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');
const { ACTIVE_REGISTRATION_STATUSES } = require('../../src/constants/mentorCapacity');

describe('Task 2: Lecturer Workflow Specialist - Ownership & Grading Scope', () => {
    const makeUser = ({ id, role = 'LECTURER', permissionCodes = [], councilMembers = [] }) => ({
        id,
        fullName: `User ${id}`,
        code: `U${id}`,
        role,
        isActive: true,
        permissionVersion: 1,
        studentProfile: role === 'STUDENT' ? { className: 'D20CNTT1' } : null,
        permissionGroups: [
            {
                permissionGroup: {
                    code: `GROUP_${id}`,
                    permissions: permissionCodes.map((code) => ({ permission: { code } })),
                },
            },
        ],
        councilMembers,
    });

    const mockRegistration = {
        id: 100,
        studentId: 10,
        semesterId: 1,
        councilId: null,
        defenseCouncilId: 50,
        status: 'DEFENSE_READY',
        student: { id: 10, fullName: 'Sinh Vien Chu De', code: 'SV010' },
        topic: {
            id: 1,
            title: 'Nghien cuu he thong AI',
            mentorId: 20,
            projectCatalogId: 2,
            mentor: { id: 20, fullName: 'GVHD Phuc', department: 'CNTT' },
        },
    };

    const mockBM03Record = {
        id: 1,
        registrationId: 100,
        effectiveTitleSnapshot: 'Nghien cuu he thong AI',
        registration: mockRegistration,
        meetings: [],
        stageEvaluations: [],
        stopReviews: [],
    };

    const mockBM04Record = {
        id: 1,
        registrationId: 100,
        status: 'DRAFT',
        isLocked: false,
        effectiveTitleSnapshot: 'Nghien cuu he thong AI',
        registration: mockRegistration,
        instituteDefenseReview: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret-key';
        jwt.verify.mockImplementation((token) => ({ userId: Number(token) }));
        prisma.academicDelegation.findMany.mockResolvedValue([]);
    });

    // =========================================================================
    // 1. ACTIVE_REGISTRATION_STATUSES Test
    // =========================================================================
    describe('1. ACTIVE_REGISTRATION_STATUSES constants', () => {
        test('contains all missing active statuses requested in specification', () => {
            const requiredStatuses = [
                'REGISTERED',
                'PENDING',
                'BM01_RESUBMITTED',
                'BM02_OPEN',
                'BM02_APPROVED',
                'BM02_REVISION_REQUIRED',
                'BM02_EXCEPTION_REVIEW',
                'DEFENSE_ELIGIBLE',
                'ELIGIBLE_BY_INSTITUTE',
                'STOP_REVIEW_PENDING',
                'PENDING_INSTITUTE_SIGNATURE',
                'ARCHIVE_INCOMPLETE',
                'ARCHIVE_REJECTED',
            ];

            requiredStatuses.forEach((status) => {
                expect(ACTIVE_REGISTRATION_STATUSES).toContain(status);
            });
        });

        test('preserves previously supported active statuses', () => {
            const legacyStatuses = [
                'SUBMITTED',
                'APPROVED',
                'IN_PROGRESS',
                'BM01_SUBMITTED',
                'BM01_PASSED',
                'BM01_NEEDS_REVISION',
                'BM02_SUBMITTED',
                'BM02_RESUBMITTED',
                'BM02_NEEDS_REVISION',
                'DECISION_ISSUED',
                'IN_PROGRESS_BM03',
                'BM03_SIGNATURE_PENDING',
                'BM03_PASSED',
                'BM04_REVIEW',
                'DEFENSE_READY',
                'AWAITING_SCORES',
                'AWAITING_FINAL_APPROVAL',
                'DEFENDED',
                'DEFENSE_PASSED',
                'COMPLETED',
            ];

            legacyStatuses.forEach((status) => {
                expect(ACTIVE_REGISTRATION_STATUSES).toContain(status);
            });
        });
    });

    // =========================================================================
    // 2. getGradingStudents scoping test
    // =========================================================================
    describe('2. getGradingStudents councilId and lecturer scope isolation', () => {
        test('does NOT overwrite where.OR when councilId is supplied for LECTURER', async () => {
            const lecturerId = 42;
            const targetCouncilId = 15;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: lecturerId,
                    role: 'LECTURER',
                    permissionCodes: ['DEFENSE_SCORE_VIEW'],
                })
            );

            prisma.topicRegistration.findMany.mockResolvedValue([]);

            const response = await request(app)
                .get(`/api/evaluations/grading-students?councilId=${targetCouncilId}`)
                .set('Authorization', `Bearer ${lecturerId}`);

            expect(response.status).toBe(200);
            expect(prisma.topicRegistration.findMany).toHaveBeenCalled();

            const queryArgs = prisma.topicRegistration.findMany.mock.calls[0][0];
            const where = queryArgs.where;

            // where.AND must combine both lecturer membership AND councilId
            expect(where.AND).toBeDefined();
            expect(Array.isArray(where.AND)).toBe(true);
            expect(where.AND).toHaveLength(2);

            // First condition: Lecturer is in council or defenseCouncil
            expect(where.AND[0]).toEqual({
                OR: [
                    { council: { members: { some: { lecturerId } } } },
                    { defenseCouncil: { members: { some: { lecturerId } } } },
                ],
            });

            // Second condition: councilId matches query
            expect(where.AND[1]).toEqual({
                OR: [
                    { councilId: targetCouncilId },
                    { defenseCouncilId: targetCouncilId },
                ],
            });

            // where.OR must not be overwritten at top level
            expect(where.OR).toBeUndefined();
        });

        test('applies only lecturer conditions when councilId is omitted', async () => {
            const lecturerId = 42;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: lecturerId,
                    role: 'LECTURER',
                    permissionCodes: ['DEFENSE_SCORE_VIEW'],
                })
            );

            prisma.topicRegistration.findMany.mockResolvedValue([]);

            const response = await request(app)
                .get('/api/evaluations/grading-students')
                .set('Authorization', `Bearer ${lecturerId}`);

            expect(response.status).toBe(200);

            const queryArgs = prisma.topicRegistration.findMany.mock.calls[0][0];
            const where = queryArgs.where;

            expect(where.AND).toBeDefined();
            expect(where.AND).toHaveLength(1);
            expect(where.AND[0]).toEqual({
                OR: [
                    { council: { members: { some: { lecturerId } } } },
                    { defenseCouncil: { members: { some: { lecturerId } } } },
                ],
            });
        });

        test('applies councilId filter without lecturer restriction for ADMIN role', async () => {
            const adminId = 1;
            const targetCouncilId = 15;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: adminId,
                    role: 'ADMIN',
                    permissionCodes: ['DEFENSE_SCORE_VIEW'],
                })
            );

            prisma.topicRegistration.findMany.mockResolvedValue([]);

            const response = await request(app)
                .get(`/api/evaluations/grading-students?councilId=${targetCouncilId}`)
                .set('Authorization', `Bearer ${adminId}`);

            expect(response.status).toBe(200);

            const queryArgs = prisma.topicRegistration.findMany.mock.calls[0][0];
            const where = queryArgs.where;

            expect(where.AND).toBeDefined();
            expect(where.AND).toHaveLength(1);
            expect(where.AND[0]).toEqual({
                OR: [
                    { councilId: targetCouncilId },
                    { defenseCouncilId: targetCouncilId },
                ],
            });
        });
    });

    // =========================================================================
    // 3. GET /api/bm03/:registrationId ownership & authorization
    // =========================================================================
    describe('3. GET /api/bm03/:registrationId ownership and authorization', () => {
        beforeEach(() => {
            prisma.bM03ProgressRecord.findUnique.mockResolvedValue(mockBM03Record);
        });

        test('returns 403 FORBIDDEN_RESOURCE when called by an unrelated student', async () => {
            const strangerStudentId = 99;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: strangerStudentId,
                    role: 'STUDENT',
                    permissionCodes: ['VIEW_MY_REGISTRATION'],
                })
            );

            const response = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', `Bearer ${strangerStudentId}`);

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
            expect(response.body.success).toBe(false);
        });

        test('returns 403 FORBIDDEN_RESOURCE when called by an unrelated lecturer', async () => {
            const strangerLecturerId = 99;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: strangerLecturerId,
                    role: 'LECTURER',
                    permissionCodes: ['VIEW_MENTOR_STUDENTS'],
                })
            );
            prisma.councilMember.findFirst.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', `Bearer ${strangerLecturerId}`);

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
            expect(response.body.success).toBe(false);
        });

        test('allows owner student to read their own BM03', async () => {
            const ownerStudentId = 10;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: ownerStudentId,
                    role: 'STUDENT',
                    permissionCodes: ['VIEW_MY_REGISTRATION'],
                })
            );

            const response = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', `Bearer ${ownerStudentId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(1);
        });

        test('allows assigned mentor to read BM03 of their student', async () => {
            const mentorId = 20;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: mentorId,
                    role: 'LECTURER',
                    permissionCodes: ['VIEW_MENTOR_STUDENTS', 'BM03_MEETING_RECORD'],
                })
            );

            const response = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', `Bearer ${mentorId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(1);
        });

        test('allows defense council member to read BM03 of assigned candidate', async () => {
            const councilMemberLecturerId = 30;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: councilMemberLecturerId,
                    role: 'LECTURER',
                    permissionCodes: ['VIEW_DEFENSE_GRADING'],
                })
            );

            // Lecturer 30 is active member in defenseCouncil 50
            prisma.councilMember.findFirst.mockResolvedValue({
                id: 501,
                councilId: 50,
                lecturerId: councilMemberLecturerId,
                isActive: true,
            });

            const response = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', `Bearer ${councilMemberLecturerId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(prisma.councilMember.findFirst).toHaveBeenCalledWith({
                where: {
                    councilId: { in: [50] },
                    lecturerId: councilMemberLecturerId,
                    isActive: true,
                },
            });
        });

        test('allows user with VIEW_PROJECT_OVERSIGHT or BM03_STOP_REVIEW to read BM03', async () => {
            const supervisorId = 88;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: supervisorId,
                    role: 'LECTURER',
                    permissionCodes: ['VIEW_PROJECT_OVERSIGHT'],
                })
            );

            const response = await request(app)
                .get('/api/bm03/100')
                .set('Authorization', `Bearer ${supervisorId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    // =========================================================================
    // 4. GET /api/bm04/:registrationId ownership & authorization
    // =========================================================================
    describe('4. GET /api/bm04/:registrationId ownership and authorization', () => {
        beforeEach(() => {
            prisma.bM04Evaluation.findUnique.mockResolvedValue(mockBM04Record);
        });

        test('returns 403 FORBIDDEN_RESOURCE when called by an unrelated student', async () => {
            const strangerStudentId = 99;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: strangerStudentId,
                    role: 'STUDENT',
                    permissionCodes: ['VIEW_MY_REGISTRATION'],
                })
            );

            const response = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', `Bearer ${strangerStudentId}`);

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
            expect(response.body.success).toBe(false);
        });

        test('returns 403 FORBIDDEN_RESOURCE when called by an unrelated lecturer', async () => {
            const strangerLecturerId = 99;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: strangerLecturerId,
                    role: 'LECTURER',
                    permissionCodes: ['VIEW_DEFENSE_GRADING'],
                })
            );
            prisma.councilMember.findFirst.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', `Bearer ${strangerLecturerId}`);

            expect(response.status).toBe(403);
            expect(response.body.code).toBe('FORBIDDEN_RESOURCE');
            expect(response.body.success).toBe(false);
        });

        test('allows owner student to read their own BM04', async () => {
            const ownerStudentId = 10;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: ownerStudentId,
                    role: 'STUDENT',
                    permissionCodes: ['VIEW_MY_REGISTRATION'],
                })
            );

            const response = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', `Bearer ${ownerStudentId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(1);
        });

        test('allows assigned mentor to read BM04', async () => {
            const mentorId = 20;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: mentorId,
                    role: 'LECTURER',
                    permissionCodes: ['BM04_CREATE_AND_SIGN'],
                })
            );

            const response = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', `Bearer ${mentorId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(1);
        });

        test('allows defense council member to read candidate BM04', async () => {
            const councilMemberLecturerId = 30;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: councilMemberLecturerId,
                    role: 'LECTURER',
                    permissionCodes: ['VIEW_DEFENSE_GRADING'],
                })
            );

            prisma.councilMember.findFirst.mockResolvedValue({
                id: 501,
                councilId: 50,
                lecturerId: councilMemberLecturerId,
                isActive: true,
            });

            const response = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', `Bearer ${councilMemberLecturerId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(prisma.councilMember.findFirst).toHaveBeenCalledWith({
                where: {
                    councilId: { in: [50] },
                    lecturerId: councilMemberLecturerId,
                    isActive: true,
                },
            });
        });

        test('allows privileged reviewer with BM04_REVIEW or VIEW_PROJECT_OVERSIGHT', async () => {
            const reviewerId = 77;

            prisma.user.findUnique.mockResolvedValue(
                makeUser({
                    id: reviewerId,
                    role: 'LECTURER',
                    permissionCodes: ['BM04_REVIEW'],
                })
            );

            const response = await request(app)
                .get('/api/bm04/100')
                .set('Authorization', `Bearer ${reviewerId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
});
