const request = require('supertest');

const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    user: {
        findUnique: jest.fn(),
        count: jest.fn(),
    },
    semester: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
    },
    topic: {
        count: jest.fn(),
        findFirst: jest.fn(),
    },
    council: {
        count: jest.fn(),
    },
    task: {
        findMany: jest.fn(),
    },
    meetingLog: {
        count: jest.fn(),
        findMany: jest.fn(),
    },
    bM03MeetingEntry: {
        count: jest.fn(),
    },
    bM04Evaluation: {
        findUnique: jest.fn(),
    },
    defenseResult: {
        count: jest.fn(),
    },
    notification: {
        findMany: jest.fn(),
        count: jest.fn(),
    },
    submission: {
        findMany: jest.fn(),
    },
    academicDelegation: {
        findMany: jest.fn().mockResolvedValue([]),
    },
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - Dashboard Student Data Contract & Triage Metric Queries', () => {
    const studentToken = 'student-test-token';
    const adminToken = 'admin-test-token';

    const activeSemester = {
        id: 1,
        code: 'HK1-2026-2027',
        name: 'Học kỳ 1 (2026 - 2027)',
        status: 'ONGOING',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        registrationDeadline: new Date('2026-09-30T00:00:00.000Z'),
        endDate: new Date('2027-01-15T00:00:00.000Z'),
        registrationOpen: false,
    };

    const studentUser = {
        id: 101,
        role: 'STUDENT',
        email: 'student101@student.tdmu.edu.vn',
        fullName: 'Nguyễn Văn Sinh Viên',
        code: 'SV101',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

    const adminUser = {
        id: 999,
        role: 'ADMIN',
        email: 'admin@tdmu.edu.vn',
        fullName: 'Quản Trị Viên Học Vụ',
        code: 'AD999',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            {
                permissionGroup: {
                    code: 'GIAO_VU',
                    permissions: [
                        { permission: { code: 'REPORT_VIEW' } },
                        { permission: { code: 'DASHBOARD_STATS_VIEW' } },
                    ],
                },
            },
        ],
        councilMembers: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === studentToken) return { userId: studentUser.id, role: studentUser.role };
            if (token === adminToken) return { userId: adminUser.id, role: adminUser.role };
            throw new Error('invalid token');
        });

        mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === studentUser.id) return studentUser;
            if (where.id === adminUser.id) return adminUser;
            return null;
        });

        mockPrisma.semester.findFirst.mockResolvedValue(activeSemester);
        mockPrisma.semester.findUnique.mockResolvedValue(activeSemester);
    });

    describe('1. GET /api/dashboard/student - Data Contract Enrichment', () => {
        test('Test 1.1: Trả về đầy đủ tasks mảng thật, meetingLogsCount thật, mentorScore thật từ BM04Evaluation, và mentorFullName', async () => {
            const dueDate1 = new Date(Date.now() + 86400000);
            const dueDate2 = new Date(Date.now() + 172800000);

            const mockRegistration = {
                id: 501,
                studentId: 101,
                semesterId: 1,
                status: 'IN_PROGRESS',
                decisionNumber: 'QD-501',
                decisionDate: new Date('2026-10-01T00:00:00.000Z'),
                adjustedTitle: null,
                student: { id: 101, fullName: 'Nguyễn Văn Sinh Viên', code: 'SV101' },
                topic: {
                    id: 10,
                    title: 'Xây dựng Hệ thống Quản lý Đồ án Tốt nghiệp',
                    mentor: { fullName: 'TS. Nguyễn Văn B' },
                },
                tasks: [
                    {
                        id: 1,
                        registrationId: 501,
                        title: 'Nhiệm vụ 1: Khảo sát tài liệu',
                        content: 'Nghiên cứu các tài liệu liên quan',
                        taskType: 'MILESTONE',
                        dueDate: dueDate1,
                        status: 'COMPLETED',
                        isBypassed: false,
                        bypassReason: null,
                        submissions: [
                            { id: 10, submittedBy: 101, fileName: 'khao_sat.pdf', fileUrl: 'https://cdn.example.com/khao_sat.pdf' },
                        ],
                    },
                    {
                        id: 2,
                        registrationId: 501,
                        title: 'Nhiệm vụ 2: Thiết kế hệ thống',
                        content: 'Thiết kế cơ sở dữ liệu và API',
                        taskType: 'GENERIC',
                        dueDate: dueDate2,
                        status: 'OPEN',
                        isBypassed: false,
                        bypassReason: null,
                        submissions: [],
                    },
                ],
                meetingLogs: [{ id: 1 }, { id: 2 }, { id: 3 }],
                bm04Evaluation: {
                    id: 99,
                    score: 9.2,
                    programOutcome: 'MEETS_PROGRAM_OUTCOMES',
                    conclusion: 'AGREED_FOR_DEFENSE',
                },
                defenseResult: null,
            };

            mockPrisma.topicRegistration.findFirst.mockResolvedValue(mockRegistration);

            const res = await request(app)
                .get('/api/dashboard/student')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const { data } = res.body;
            expect(data.hasRegistration).toBe(true);

            // Kiểm tra mảng tasks thật
            expect(Array.isArray(data.tasks)).toBe(true);
            expect(data.tasks).toHaveLength(2);
            expect(data.tasks[0]).toMatchObject({
                id: 1,
                title: 'Nhiệm vụ 1: Khảo sát tài liệu',
                description: 'Nghiên cứu các tài liệu liên quan',
                status: 'COMPLETED',
                taskType: 'MILESTONE',
            });
            expect(data.tasks[0].deadline).toBeDefined();
            expect(data.tasks[0].submissions).toHaveLength(1);

            // Kiểm tra số buổi gặp mặt thật và điểm đánh giá GVHD thật
            expect(data.meetingLogsCount).toBe(3);
            expect(data.mentorScore).toBe(9.2);
            expect(data.mentorFullName).toBe('TS. Nguyễn Văn B');

            // Đảm bảo registrationDetails cũng chứa các trường này để frontend tương thích
            expect(data.registrationDetails.meetingLogsCount).toBe(3);
            expect(data.registrationDetails.mentorScore).toBe(9.2);
            expect(data.registrationDetails.mentorFullName).toBe('TS. Nguyễn Văn B');
            expect(data.registrationDetails.tasks).toHaveLength(2);
        });

        test('Test 1.2: Sinh viên chưa có nhiệm vụ, chưa có buổi gặp và chưa có BM04 -> trả về tasks rỗng, meetingLogsCount=0, mentorScore=null', async () => {
            const mockRegistration = {
                id: 502,
                studentId: 101,
                semesterId: 1,
                status: 'APPROVED',
                decisionNumber: null,
                decisionDate: null,
                adjustedTitle: null,
                student: { id: 101, fullName: 'Nguyễn Văn Sinh Viên', code: 'SV101' },
                topic: {
                    id: 11,
                    title: 'Đề tài Mới Duyệt',
                    mentor: { fullName: 'ThS. Trần Thị C' },
                },
                tasks: [],
                meetingLogs: [],
                bm04Evaluation: null,
                defenseResult: null,
            };

            mockPrisma.topicRegistration.findFirst.mockResolvedValue(mockRegistration);

            const res = await request(app)
                .get('/api/dashboard/student')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const { data } = res.body;
            expect(data.tasks).toEqual([]);
            expect(data.meetingLogsCount).toBe(0);
            expect(data.mentorScore).toBeNull();
            expect(data.mentorFullName).toBe('ThS. Trần Thị C');
        });
    });

    describe('2. GET /api/dashboard/stats & /semester-overview - Triage Metric Queries', () => {
        test('Test 2: getGeneralStats đếm đúng sinh viên DEFENSE_READY chưa có defenseCouncilId (kể cả khi councilId != null từ vòng đề cương)', async () => {
            mockPrisma.user.count.mockResolvedValue(50);
            mockPrisma.topic.count.mockResolvedValue(30);
            mockPrisma.council.count.mockResolvedValue(5);
            // Giả lập trả về 7 sinh viên cần phân công
            mockPrisma.topicRegistration.count.mockResolvedValue(7);

            const res = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.unassignedRegistrations).toBe(7);

            // Kiểm tra câu truy vấn topicRegistration.count được gọi đúng cấu trúc OR chuẩn hóa
            expect(mockPrisma.topicRegistration.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: 1,
                        OR: [
                            {
                                status: { in: ['APPROVED', 'BM01_PASSED', 'BM01_SUBMITTED', 'BM01_RESUBMITTED'] },
                                councilId: null,
                            },
                            {
                                status: { in: ['DEFENSE_READY', 'ELIGIBLE_BY_INSTITUTE'] },
                                defenseCouncilId: null,
                            },
                        ],
                    }),
                })
            );
        });

        test('Test 3: getGeneralStats bao gồm cả sinh viên đề cương chưa có councilId trong nhánh OR 1', async () => {
            mockPrisma.user.count.mockResolvedValue(50);
            mockPrisma.topic.count.mockResolvedValue(30);
            mockPrisma.council.count.mockResolvedValue(5);
            mockPrisma.topicRegistration.count.mockResolvedValue(3);

            const res = await request(app)
                .get('/api/dashboard/stats?semesterId=1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const calledWhere = mockPrisma.topicRegistration.count.mock.calls[0][0].where;
            expect(calledWhere.OR[0]).toEqual({
                status: { in: ['APPROVED', 'BM01_PASSED', 'BM01_SUBMITTED', 'BM01_RESUBMITTED'] },
                councilId: null,
            });
            expect(calledWhere.OR[1]).toEqual({
                status: { in: ['DEFENSE_READY', 'ELIGIBLE_BY_INSTITUTE'] },
                defenseCouncilId: null,
            });
        });

        test('Test 4: Khi không có sinh viên nào cần triage, trả về đúng 0 (không fallback số giả 4 hay 14)', async () => {
            mockPrisma.user.count.mockResolvedValue(10);
            mockPrisma.topic.count.mockResolvedValue(5);
            mockPrisma.council.count.mockResolvedValue(1);
            mockPrisma.topicRegistration.count.mockResolvedValue(0);
            mockPrisma.defenseResult.count.mockResolvedValue(0);

            const statsRes = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(statsRes.status).toBe(200);
            expect(statsRes.body.data.unassignedRegistrations).toBe(0);

            const overviewRes = await request(app)
                .get('/api/dashboard/semester-overview')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(overviewRes.status).toBe(200);
            expect(overviewRes.body.data.registrations.unassignedRegistrations).toBe(0);
            expect(overviewRes.body.data.registrations.pending).toBe(0);
        });
    });
});
