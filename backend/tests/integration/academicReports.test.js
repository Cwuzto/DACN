const request = require('supertest');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findFirst: jest.fn(), findUnique: jest.fn() },
    topicRegistration: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    academicDelegation: { findMany: jest.fn().mockResolvedValue([]) },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');

describe('Academic BI & Reporting Hub - Integration Tests', () => {
    const adminToken = 'admin-token';
    const studentToken = 'student-token';
    const lecturerToken = 'lecturer-token';
    const oversightToken = 'oversight-token';

    const activeSemester = {
        id: 1,
        code: 'HK1-2026-2027',
        name: 'Học kỳ 1 2026-2027',
        status: 'ONGOING',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-15'),
    };

    const mockAdminUser = {
        id: 1,
        role: 'ADMIN',
        email: 'admin@tdmu.edu.vn',
        fullName: 'Quản Trị Viên',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

    const mockOversightUser = {
        id: 2,
        role: 'LECTURER',
        email: 'oversight@tdmu.edu.vn',
        fullName: 'Thầy Trưởng Bộ Môn',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            {
                permissionGroup: {
                    code: 'BO_MON',
                    permissions: [
                        { permission: { code: 'VIEW_PROJECT_OVERSIGHT' } },
                    ],
                },
            },
        ],
        councilMembers: [],
    };

    const mockStudentUser = {
        id: 10,
        role: 'STUDENT',
        email: 'sv@student.tdmu.edu.vn',
        fullName: 'Sinh Viên A',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

    const mockLecturerPlainUser = {
        id: 20,
        role: 'LECTURER',
        email: 'gv@tdmu.edu.vn',
        fullName: 'Giảng Viên Thường',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

    const mockRegistrations = [
        {
            id: 101,
            semesterId: 1,
            status: 'COMPLETED',
            studentId: 1001,
            student: {
                id: 1001,
                fullName: 'Nguyễn Văn Xuất Sắc',
                code: 'SV20260001',
                studentProfile: { major: 'Kỹ thuật Phần mềm', className: 'D20KTPM01' },
            },
            topic: {
                id: 501,
                title: 'Hệ thống AI Assistant Tự Động',
                targetMajor: 'Kỹ thuật Phần mềm',
                mentorId: 201,
                mentor: {
                    id: 201,
                    fullName: 'TS. Trần Văn Thầy',
                    email: 'tvthay@tdmu.edu.vn',
                    department: 'Kỹ thuật Phần mềm',
                },
            },
            bm04Evaluation: {
                score: 9.0,
                thesisFormatScore: '2.5',
                researchContentScore: '2.5',
                applicabilityScore: '2.0',
                attitudeScore: '2.0',
                conclusion: 'AGREED_FOR_DEFENSE',
            },
            defenseResult: {
                finalScore: 9.2,
                rawAverageScore: 9.2,
            },
        },
        {
            id: 102,
            semesterId: 1,
            status: 'COMPLETED',
            studentId: 1002,
            student: {
                id: 1002,
                fullName: 'Lê Thị Giỏi',
                code: 'SV20260002',
                studentProfile: { major: 'Kỹ thuật Phần mềm', className: 'D20KTPM01' },
            },
            topic: {
                id: 502,
                title: 'Nền tảng Quản lý Học vụ',
                targetMajor: 'Kỹ thuật Phần mềm',
                mentorId: 201,
                mentor: {
                    id: 201,
                    fullName: 'TS. Trần Văn Thầy',
                    email: 'tvthay@tdmu.edu.vn',
                    department: 'Kỹ thuật Phần mềm',
                },
            },
            bm04Evaluation: {
                score: 8.0,
                conclusion: 'AGREED_FOR_DEFENSE',
            },
            defenseResult: {
                finalScore: 7.8,
                rawAverageScore: 7.8,
            },
        },
        {
            id: 103,
            semesterId: 1,
            status: 'DEFENSE_READY',
            studentId: 1003,
            student: {
                id: 1003,
                fullName: 'Phạm Văn Khá',
                code: 'SV20260003',
                studentProfile: { major: 'Hệ thống Thông tin', className: 'D20HTTT01' },
            },
            topic: {
                id: 503,
                title: 'Ứng dụng IoT trong Nông nghiệp',
                targetMajor: 'Hệ thống Thông tin',
                mentorId: 202,
                mentor: {
                    id: 202,
                    fullName: 'ThS. Nguyễn Thị Cô',
                    email: 'ntco@tdmu.edu.vn',
                    department: 'Hệ thống Thông tin',
                },
            },
            bm04Evaluation: {
                score: 6.5,
                conclusion: 'AGREED_FOR_DEFENSE',
            },
            defenseResult: {
                finalScore: 6.0,
            },
        },
        {
            id: 104,
            semesterId: 1,
            status: 'IN_PROGRESS_BM03',
            studentId: 1004,
            student: {
                id: 1004,
                fullName: 'Hoàng Văn Tiến Độ',
                code: 'SV20260004',
                studentProfile: { major: 'Hệ thống Thông tin', className: 'D20HTTT01' },
            },
            topic: {
                id: 504,
                title: 'Hệ thống Giám sát Chuỗi cung ứng',
                targetMajor: 'Hệ thống Thông tin',
                mentorId: 202,
                mentor: {
                    id: 202,
                    fullName: 'ThS. Nguyễn Thị Cô',
                    email: 'ntco@tdmu.edu.vn',
                    department: 'Hệ thống Thông tin',
                },
            },
            bm04Evaluation: null,
            defenseResult: null,
        },
        {
            id: 105,
            semesterId: 1,
            status: 'REGISTERED',
            studentId: 1005,
            student: {
                id: 1005,
                fullName: 'Đỗ Văn Mới ĐK',
                code: 'SV20260005',
                studentProfile: { major: 'Khoa học Dữ liệu', className: 'D20KHDL01' },
            },
            topic: {
                id: 505,
                title: 'Phân tích Dữ liệu Gen',
                targetMajor: 'Khoa học Dữ liệu',
                mentorId: 201,
                mentor: {
                    id: 201,
                    fullName: 'TS. Trần Văn Thầy',
                    email: 'tvthay@tdmu.edu.vn',
                    department: 'Kỹ thuật Phần mềm',
                },
            },
            bm04Evaluation: null,
            defenseResult: null,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === adminToken) return { userId: mockAdminUser.id, role: mockAdminUser.role };
            if (token === oversightToken) return { userId: mockOversightUser.id, role: mockOversightUser.role };
            if (token === studentToken) return { userId: mockStudentUser.id, role: mockStudentUser.role };
            if (token === lecturerToken) return { userId: mockLecturerPlainUser.id, role: mockLecturerPlainUser.role };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === mockAdminUser.id) return mockAdminUser;
            if (where.id === mockOversightUser.id) return mockOversightUser;
            if (where.id === mockStudentUser.id) return mockStudentUser;
            if (where.id === mockLecturerPlainUser.id) return mockLecturerPlainUser;
            return null;
        });

        prisma.semester.findFirst.mockResolvedValue(activeSemester);
        prisma.semester.findUnique.mockResolvedValue(activeSemester);
        prisma.topicRegistration.findMany.mockResolvedValue(mockRegistrations);
    });

    describe('Access Control', () => {
        it('should return 401 when unauthenticated', async () => {
            const res = await request(app).get('/api/reports/overview');
            expect(res.status).toBe(401);
        });

        it('should return 403 when a student without reporting permissions accesses overview', async () => {
            const res = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', `Bearer ${studentToken}`);
            expect(res.status).toBe(403);
        });

        it('should return 403 when a normal lecturer without oversight permissions accesses overview', async () => {
            const res = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', `Bearer ${lecturerToken}`);
            expect(res.status).toBe(403);
        });

        it('should allow access for admin', async () => {
            const res = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
        });

        it('should allow access for user with VIEW_PROJECT_OVERSIGHT capability', async () => {
            const res = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', `Bearer ${oversightToken}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/reports/overview', () => {
        it('should return accurate KPIs, 5-band grade distribution, funnel, and majors breakdown', async () => {
            const res = await request(app)
                .get('/api/reports/overview')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const { semester, kpis, gradeDistribution, funnel, majors } = res.body.data;

            // Semester Info
            expect(semester).toBeDefined();
            expect(semester.id).toBe(1);

            // KPIs
            expect(kpis.totalStudents).toBe(5);
            expect(kpis.completedCount).toBe(2);
            expect(kpis.completionRate).toBe(40.0);
            expect(kpis.averageScore).toBe(7.67); // (9.2 + 7.8 + 6.0) / 3 = 7.6666... -> 7.67
            expect(kpis.maxScore).toBe(9.2);
            expect(kpis.minScore).toBe(6.0);

            // Grade Distribution (5 bands)
            expect(gradeDistribution).toHaveLength(5);
            const excellent = gradeDistribution.find((g) => g.grade === 'EXCELLENT');
            const good = gradeDistribution.find((g) => g.grade === 'GOOD');
            const fair = gradeDistribution.find((g) => g.grade === 'FAIR');
            const average = gradeDistribution.find((g) => g.grade === 'AVERAGE');
            const failed = gradeDistribution.find((g) => g.grade === 'FAILED');

            expect(excellent).toMatchObject({ count: 1, color: '#10B981' });
            expect(good).toMatchObject({ count: 1, color: '#0F766E' });
            expect(fair).toMatchObject({ count: 1, color: '#F59E0B' });
            expect(average).toMatchObject({ count: 0, color: '#64748B' });
            expect(failed).toMatchObject({ count: 2, color: '#EF4444' }); // 2 students with no defense score yet

            // Funnel (6 milestones)
            expect(funnel).toHaveLength(6);
            expect(funnel[0]).toMatchObject({ step: 'ENROLLED', count: 5, rate: 100 });
            expect(funnel[1]).toMatchObject({ step: 'BM01_PASSED' });
            expect(funnel[2]).toMatchObject({ step: 'DECISION_ISSUED' });
            expect(funnel[3]).toMatchObject({ step: 'BM03_PASSED' });
            expect(funnel[4]).toMatchObject({ step: 'DEFENSE_READY' });
            expect(funnel[5]).toMatchObject({ step: 'COMPLETED', count: 2, rate: 40 });

            // Majors breakdown
            expect(Array.isArray(majors)).toBe(true);
            const ktpm = majors.find((m) => m.major === 'Kỹ thuật Phần mềm');
            expect(ktpm).toBeDefined();
            expect(ktpm.studentCount).toBe(2);
            expect(ktpm.completedCount).toBe(2);
            expect(ktpm.avgScore).toBe(8.5); // (9.2 + 7.8) / 2
        });

        it('should filter by major when major query param is provided', async () => {
            const res = await request(app)
                .get('/api/reports/overview?major=Hệ thống Thông tin')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            const { kpis, majors } = res.body.data;
            expect(kpis.totalStudents).toBe(2);
            expect(majors).toHaveLength(1);
            expect(majors[0].major).toBe('Hệ thống Thông tin');
        });
    });

    describe('GET /api/reports/lecturer-workload', () => {
        it('should return mentor workload stats, completion rates, and score variance', async () => {
            const res = await request(app)
                .get('/api/reports/lecturer-workload')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);

            const lecturers = res.body.data;
            expect(lecturers.length).toBe(2);

            const mentor1 = lecturers.find((l) => l.lecturerId === 201);
            expect(mentor1).toBeDefined();
            expect(mentor1.fullName).toBe('TS. Trần Văn Thầy');
            expect(mentor1.assignedCount).toBe(3);
            expect(mentor1.completedCount).toBe(2);
            expect(mentor1.completionRate).toBe(66.7);
            expect(mentor1.avgMentorScore).toBe(8.5); // (9.0 + 8.0) / 2
            expect(mentor1.avgCouncilScore).toBe(8.5); // (9.2 + 7.8) / 2
            expect(mentor1.variance).toBe(0); // |8.5 - 8.5| = 0

            const mentor2 = lecturers.find((l) => l.lecturerId === 202);
            expect(mentor2).toBeDefined();
            expect(mentor2.fullName).toBe('ThS. Nguyễn Thị Cô');
            expect(mentor2.assignedCount).toBe(2);
            expect(mentor2.completedCount).toBe(0);
            expect(mentor2.avgMentorScore).toBe(6.5);
            expect(mentor2.avgCouncilScore).toBe(6.0);
            expect(mentor2.variance).toBe(0.5); // |6.5 - 6.0| = 0.5
        });
    });

    describe('GET /api/reports/export-excel', () => {
        it('should return valid excel binary buffer with correct headers', async () => {
            const res = await request(app)
                .get('/api/reports/export-excel')
                .set('Authorization', `Bearer ${adminToken}`)
                .responseType('blob');

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(res.headers['content-disposition']).toContain('attachment;');
            expect(res.headers['content-disposition']).toContain('.xlsx');

            // Verify parseable buffer
            const workbook = XLSX.read(res.body, { type: 'buffer' });
            expect(workbook.SheetNames.length).toBeGreaterThan(0);

            const sheetName = workbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
            expect(rows.length).toBe(5);
            expect(rows[0]).toHaveProperty('Mã SV');
            expect(rows[0]).toHaveProperty('Họ và tên');
            expect(rows[0]).toHaveProperty('Tên đề tài');
            expect(rows[0]).toHaveProperty('GVHD');
        });
    });
});
