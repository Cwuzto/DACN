const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
    studentProfile: {
        upsert: jest.fn(),
        create: jest.fn(),
    },
    semester: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    topicRegistration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
    },
    topic: {
        findFirst: jest.fn(),
        count: jest.fn(),
    },
    council: {
        count: jest.fn(),
    },
    councilMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    permissionGroup: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    permissionGroupPermission: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
    },
    userPermissionGroup: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
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
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
    },
    auditLog: {
        create: jest.fn(),
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

const app = require('../../src/app');
const { DEFAULT_GROUPS, ACADEMIC_PROTECTED_PERMISSIONS } = require('../../src/constants/permissions');

describe('Integration - Package 1 Full Regression Verification', () => {
    const techAdminToken = 'tech-admin-token';
    const academicAdminToken = 'academic-admin-token';
    const lecturerToken = 'lecturer-token';
    const studentToken = 'student-token';

    const techAdminUser = {
        id: 1,
        role: 'ADMIN',
        email: 'admin.tech@tdmu.edu.vn',
        fullName: 'Quản Trị Viên Kỹ Thuật',
        code: 'ADM_TECH',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            {
                permissionGroup: {
                    code: 'QUAN_TRI_VIEN',
                    permissions: [
                        { permission: { code: 'USER_MANAGE' } },
                        { permission: { code: 'PERMISSION_GROUP_MANAGE' } },
                    ],
                },
            },
        ],
        councilMembers: [],
    };

    const academicAdminUser = {
        id: 2,
        role: 'ADMIN',
        email: 'admin.academic@tdmu.edu.vn',
        fullName: 'Quản Trị Viên Học Vụ',
        code: 'ADM_ACAD',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            {
                permissionGroup: {
                    code: 'GIAO_VU',
                    permissions: [
                        { permission: { code: 'USER_MANAGE' } },
                        { permission: { code: 'PERMISSION_ASSIGN_ACADEMIC' } },
                        { permission: { code: 'REPORT_VIEW' } },
                        { permission: { code: 'DASHBOARD_STATS_VIEW' } },
                    ],
                },
            },
        ],
        councilMembers: [],
    };

    const lecturerUser = {
        id: 201,
        role: 'LECTURER',
        email: 'lecturer201@tdmu.edu.vn',
        fullName: 'TS. Nguyễn Văn A',
        code: 'GV201',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            {
                permissionGroup: {
                    code: 'GVHD',
                    permissions: [{ permission: { code: 'TOPIC_PROPOSE' } }],
                },
            },
        ],
        councilMembers: [],
    };

    const studentUser = {
        id: 301,
        role: 'STUDENT',
        email: 'student301@student.tdmu.edu.vn',
        fullName: 'Trần Văn Sinh Viên',
        code: 'SV301',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

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

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));
        process.env.JWT_SECRET = 'test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === techAdminToken) return { userId: techAdminUser.id, role: techAdminUser.role };
            if (token === academicAdminToken) return { userId: academicAdminUser.id, role: academicAdminUser.role };
            if (token === lecturerToken) return { userId: lecturerUser.id, role: lecturerUser.role };
            if (token === studentToken) return { userId: studentUser.id, role: studentUser.role };
            throw new Error('invalid token');
        });

        mockPrisma.semester.findFirst.mockResolvedValue(activeSemester);
        mockPrisma.semester.findUnique.mockResolvedValue(activeSemester);
    });

    // =========================================================================
    // TIÊU ĐIỂM 1: RBAC Realignment & Anti-Escalation
    // =========================================================================
    describe('Tiêu điểm 1: RBAC Realignment & Anti-Escalation Guards', () => {
        test('1.1: DEFAULT_GROUPS.QUAN_TRI_VIEN không chứa bất kỳ quyền nào thuộc ACADEMIC_PROTECTED_PERMISSIONS', () => {
            const techAdminGroup = DEFAULT_GROUPS.find((g) => g.code === 'QUAN_TRI_VIEN');
            expect(techAdminGroup).toBeDefined();

            const violating = techAdminGroup.permissions.filter((p) =>
                ACADEMIC_PROTECTED_PERMISSIONS.includes(p)
            );
            expect(violating).toEqual([]);
        });

        test('1.2: GIAO_VU và VIEN_TRUONG bảo toàn các quyền học vụ đặc thù', () => {
            const giaoVuGroup = DEFAULT_GROUPS.find((g) => g.code === 'GIAO_VU');
            const vienTruongGroup = DEFAULT_GROUPS.find((g) => g.code === 'VIEN_TRUONG');

            expect(giaoVuGroup).toBeDefined();
            expect(vienTruongGroup).toBeDefined();

            const academicPerms = ['RUBRIC_LOCK', 'DEFENSE_SCOREBOOK_RETURN', 'ARCHIVE_ACADEMIC_AFFAIRS_REVIEW'];
            for (const perm of academicPerms) {
                expect(giaoVuGroup.permissions).toContain(perm);
                expect(vienTruongGroup.permissions).toContain(perm);
            }
        });

        test('1.3: Quản trị viên kỹ thuật gán nhóm QUAN_TRI_VIEN không bị lỗi 403 deadlock', async () => {
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === techAdminUser.id) return techAdminUser;
                if (where.id === 50) {
                    return {
                        id: 50,
                        role: 'ADMIN',
                        fullName: 'Staff IT',
                        code: 'IT_50',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [],
                    };
                }
                return null;
            });

            const quanTriVienGroup = DEFAULT_GROUPS.find((g) => g.code === 'QUAN_TRI_VIEN');
            mockPrisma.permissionGroup.findMany.mockResolvedValue([
                {
                    id: 10,
                    code: 'QUAN_TRI_VIEN',
                    name: 'Quản trị viên',
                    permissions: quanTriVienGroup.permissions.map((code) => ({ permission: { code } })),
                },
            ]);

            const res = await request(app)
                .post('/api/users/50/permission-groups')
                .set('Authorization', `Bearer ${techAdminToken}`)
                .send({ groupIds: [10] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('1.4: PUT /api/users/:id - Chặn người dùng tự nâng/sửa role của chính mình (403)', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(techAdminUser);

            const res = await request(app)
                .put(`/api/users/${techAdminUser.id}`)
                .set('Authorization', `Bearer ${techAdminToken}`)
                .send({ role: 'STUDENT' });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Không thể tự thay đổi vai trò của chính mình');
        });

        test('1.5: PUT /api/users/:id - Chặn admin không có PERMISSION_ASSIGN_ACADEMIC nâng người khác lên role ADMIN (403)', async () => {
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === techAdminUser.id) return techAdminUser;
                if (where.id === 302) {
                    return {
                        id: 302,
                        role: 'LECTURER',
                        fullName: 'Giảng viên B',
                        code: 'GV302',
                        isActive: true,
                        permissionVersion: 1,
                        permissionGroups: [],
                    };
                }
                return null;
            });

            const res = await request(app)
                .put('/api/users/302')
                .set('Authorization', `Bearer ${techAdminToken}`)
                .send({ role: 'ADMIN' });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toBe('Quản trị viên kỹ thuật không có thẩm quyền nâng người dùng lên vai trò Quản trị viên');
        });

        test('1.6: PUT /api/users/:id - Chặn thay đổi role của sinh viên đang có TopicRegistration kích hoạt (400 CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD)', async () => {
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === academicAdminUser.id) return academicAdminUser;
                if (where.id === studentUser.id) {
                    return {
                        ...studentUser,
                        studentProfile: { id: 1, className: 'D21_TH01' },
                    };
                }
                return null;
            });

            // Giả lập sinh viên đang có đề tài đồ án hoạt động
            mockPrisma.topicRegistration.findFirst.mockResolvedValue({
                id: 101,
                studentId: studentUser.id,
                status: 'IN_PROGRESS',
            });

            const res = await request(app)
                .put(`/api/users/${studentUser.id}`)
                .set('Authorization', `Bearer ${academicAdminToken}`)
                .send({ role: 'LECTURER' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD');
            expect(res.body.message).toMatch(/Không thể đổi vai trò khi sinh viên đang có đề tài đồ án hoạt động/);
        });

        test('1.7: PUT /api/users/:id - Chặn thay đổi role của giảng viên đang hướng dẫn đề tài hoạt động (400 CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD)', async () => {
            mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
                if (where.id === academicAdminUser.id) return academicAdminUser;
                if (where.id === lecturerUser.id) return lecturerUser;
                return null;
            });

            mockPrisma.topicRegistration.findFirst.mockResolvedValue({
                id: 102,
                topicId: 55,
                status: 'DEFENSE_READY',
            });
            mockPrisma.councilMember.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .put(`/api/users/${lecturerUser.id}`)
                .set('Authorization', `Bearer ${academicAdminToken}`)
                .send({ role: 'STUDENT' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('CANNOT_CHANGE_ROLE_WITH_ACTIVE_ACADEMIC_WORKLOAD');
            expect(res.body.message).toMatch(/Không thể đổi vai trò khi giảng viên đang hướng dẫn đề tài hoặc tham gia hội đồng hoạt động/);
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 2: Lecturer Broadcast API
    // =========================================================================
    describe('Tiêu điểm 2: Lecturer Broadcast API (/api/notifications/lecturer-broadcast)', () => {
        test('2.1: Giảng viên gửi broadcast chỉ đến các sinh viên được hướng dẫn trong học kỳ kích hoạt', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(lecturerUser);

            const activeMentees = [
                {
                    id: 11,
                    studentId: 301,
                    status: 'IN_PROGRESS',
                    topic: { id: 10, title: 'Hệ thống Quản lý Đồ án', mentorId: lecturerUser.id },
                    student: { id: 301, fullName: 'Sinh Viên 1', email: 'sv1@tdmu.edu.vn' },
                },
                {
                    id: 12,
                    studentId: 302,
                    status: 'DEFENSE_READY',
                    topic: { id: 11, title: 'Hệ thống AI Assistant', mentorId: lecturerUser.id },
                    student: { id: 302, fullName: 'Sinh Viên 2', email: 'sv2@tdmu.edu.vn' },
                },
            ];

            mockPrisma.topicRegistration.findMany.mockResolvedValue(activeMentees);
            mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

            const res = await request(app)
                .post('/api/notifications/lecturer-broadcast')
                .set('Authorization', `Bearer ${lecturerToken}`)
                .send({
                    subject: 'Thông báo họp đồ án tốt nghiệp tuần 10',
                    content: 'Tất cả sinh viên nộp báo cáo tiến độ BM03 trước thứ Sáu.',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.sentCount).toBe(2);

            // Xác minh query lấy đúng học kỳ và loại bỏ các status hủy/rút
            expect(mockPrisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: activeSemester.id,
                        topic: { mentorId: lecturerUser.id },
                        status: { notIn: ['DROPPED', 'WITHDRAWN', 'REJECTED'] },
                    }),
                })
            );

            // Xác minh notifications được tạo cho danh sách studentId
            expect(mockPrisma.notification.createMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.arrayContaining([
                        expect.objectContaining({
                            userId: 301,
                            title: 'Thông báo họp đồ án tốt nghiệp tuần 10',
                            content: 'Tất cả sinh viên nộp báo cáo tiến độ BM03 trước thứ Sáu.',
                        }),
                        expect.objectContaining({
                            userId: 302,
                            title: 'Thông báo họp đồ án tốt nghiệp tuần 10',
                            content: 'Tất cả sinh viên nộp báo cáo tiến độ BM03 trước thứ Sáu.',
                        }),
                    ]),
                })
            );
        });

        test('2.2: Giảng viên không có sinh viên hướng dẫn nào trong học kỳ trả về lỗi 400', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(lecturerUser);
            mockPrisma.topicRegistration.findMany.mockResolvedValue([]);

            const res = await request(app)
                .post('/api/notifications/lecturer-broadcast')
                .set('Authorization', `Bearer ${lecturerToken}`)
                .send({
                    content: 'Thông báo thử nghiệm',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/không có sinh viên/i);
        });

        test('2.3: Sinh viên gọi API lecturer-broadcast bị chặn với 403', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(studentUser);

            const res = await request(app)
                .post('/api/notifications/lecturer-broadcast')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    content: 'Hack thông báo',
                });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/Chỉ giảng viên/);
        });

        test('2.4: Yêu cầu không có token bị từ chối 401', async () => {
            const res = await request(app)
                .post('/api/notifications/lecturer-broadcast')
                .send({ content: 'Chưa đăng nhập' });

            expect(res.status).toBe(401);
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 3: Student Dashboard Data Contract
    // =========================================================================
    describe('Tiêu điểm 3: Student Dashboard Data Contract Enriched', () => {
        test('3.1: GET /api/dashboard/student trả về đúng cấu trúc tasks, meetingLogsCount, mentorScore từ BM04 và mentorFullName', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(studentUser);

            const mockRegistration = {
                id: 501,
                studentId: studentUser.id,
                semesterId: activeSemester.id,
                status: 'IN_PROGRESS',
                decisionNumber: 'QD-501',
                decisionDate: new Date('2026-10-01'),
                adjustedTitle: null,
                student: { id: studentUser.id, fullName: studentUser.fullName, code: studentUser.code },
                topic: {
                    id: 10,
                    title: 'Xây dựng Phần mềm Đồ án',
                    mentor: { fullName: 'TS. Nguyễn Văn A' },
                },
                tasks: [
                    {
                        id: 1,
                        registrationId: 501,
                        title: 'Nhiệm vụ 1: Phân tích nghiệp vụ',
                        content: 'Thu thập yêu cầu thực tế',
                        taskType: 'MILESTONE',
                        dueDate: new Date(Date.now() + 86400000),
                        status: 'COMPLETED',
                        isBypassed: false,
                        bypassReason: null,
                        submissions: [{ id: 1, submittedBy: studentUser.id, fileName: 'spec.pdf', fileUrl: 'https://tdmu.edu.vn/spec.pdf' }],
                    },
                ],
                meetingLogs: [{ id: 10 }, { id: 11 }, { id: 12 }, { id: 13 }],
                bm04Evaluation: {
                    id: 88,
                    score: 9.0,
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
            expect(Array.isArray(data.tasks)).toBe(true);
            expect(data.tasks).toHaveLength(1);
            expect(data.tasks[0]).toMatchObject({
                id: 1,
                title: 'Nhiệm vụ 1: Phân tích nghiệp vụ',
                status: 'COMPLETED',
                taskType: 'MILESTONE',
            });
            expect(data.meetingLogsCount).toBe(4);
            expect(data.mentorScore).toBe(9.0);
            expect(data.mentorFullName).toBe('TS. Nguyễn Văn A');
        });

        test('3.2: Khi sinh viên chưa có nhiệm vụ/buổi gặp/BM04 -> trả về tasks: [], meetingLogsCount: 0, mentorScore: null', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(studentUser);

            const mockEmptyRegistration = {
                id: 502,
                studentId: studentUser.id,
                semesterId: activeSemester.id,
                status: 'APPROVED',
                decisionNumber: null,
                decisionDate: null,
                adjustedTitle: null,
                student: { id: studentUser.id, fullName: studentUser.fullName, code: studentUser.code },
                topic: {
                    id: 11,
                    title: 'Đề tài Chưa Triển khai',
                    mentor: { fullName: 'ThS. Lê Thị D' },
                },
                tasks: [],
                meetingLogs: [],
                bm04Evaluation: null,
                defenseResult: null,
            };

            mockPrisma.topicRegistration.findFirst.mockResolvedValue(mockEmptyRegistration);

            const res = await request(app)
                .get('/api/dashboard/student')
                .set('Authorization', `Bearer ${studentToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const { data } = res.body;
            expect(data.tasks).toEqual([]);
            expect(data.meetingLogsCount).toBe(0);
            expect(data.mentorScore).toBeNull();
            expect(data.mentorFullName).toBe('ThS. Lê Thị D');
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 4: Triage Metric Queries
    // =========================================================================
    describe('Tiêu điểm 4: Triage Metric Queries & Zero Fabricated Fallbacks', () => {
        test('4.1: getGeneralStats tính unassignedRegistrations bằng câu truy vấn OR tách biệt 2 giai đoạn', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(academicAdminUser);
            mockPrisma.user.count.mockResolvedValue(100);
            mockPrisma.topic.count.mockResolvedValue(60);
            mockPrisma.council.count.mockResolvedValue(10);
            mockPrisma.topicRegistration.count.mockResolvedValue(8);

            const res = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', `Bearer ${academicAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.unassignedRegistrations).toBe(8);

            // Kiểm tra cấu trúc câu lệnh where OR trong Prisma
            expect(mockPrisma.topicRegistration.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: activeSemester.id,
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

        test('4.2: Khi số sinh viên cần triage bằng 0 -> trả về đúng 0, không fallback số giả (14, 4, 2)', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(academicAdminUser);
            mockPrisma.user.count.mockResolvedValue(20);
            mockPrisma.topic.count.mockResolvedValue(10);
            mockPrisma.council.count.mockResolvedValue(2);
            mockPrisma.topicRegistration.count.mockResolvedValue(0);
            mockPrisma.defenseResult.count.mockResolvedValue(0);

            const statsRes = await request(app)
                .get('/api/dashboard/stats')
                .set('Authorization', `Bearer ${academicAdminToken}`);

            expect(statsRes.status).toBe(200);
            expect(statsRes.body.data.unassignedRegistrations).toBe(0);

            const overviewRes = await request(app)
                .get('/api/dashboard/semester-overview')
                .set('Authorization', `Bearer ${academicAdminToken}`);

            expect(overviewRes.status).toBe(200);
            expect(overviewRes.body.data.registrations.unassignedRegistrations).toBe(0);
            expect(overviewRes.body.data.registrations.pending).toBe(0);
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 5: Frontend Zero Fake Actions & Zero Mock Verification
    // =========================================================================
    describe('Tiêu điểm 5: Frontend Zero Fake Actions & Zero Mock Codebase Verification', () => {
        const rootDir = path.resolve(__dirname, '../../../');
        const readSource = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

        test('5.1: GradingDefensePage.jsx đã xóa bỏ toast BM05 giả, kết nối exportScoreSheetPdf thực và không có setTimeout', () => {
            const pageSrc = readSource('frontend/src/pages/admin/GradingDefensePage.jsx');

            expect(pageSrc).not.toContain('Đang tạo Biên bản bảo vệ BM05 kèm chữ ký số...');
            expect(pageSrc).toMatch(/evaluationService\.exportScoreSheetPdf\s*\(/);
            expect(pageSrc).toMatch(/window\.open\s*\(/);
            expect(pageSrc).not.toMatch(/handleExportBM05[\s\S]*?setTimeout/);
        });

        test('5.2: LecturerDashboardPage.jsx kết nối API phát thông báo thực và không có fake broadcast setTimeout', () => {
            const pageSrc = readSource('frontend/src/pages/lecturer/LecturerDashboardPage.jsx');

            expect(pageSrc).toMatch(/import\s+notificationService\s+from\s+['"].*notificationService['"]/);
            expect(pageSrc).toMatch(/notificationService\.sendLecturerBroadcast\s*\(/);
            expect(pageSrc).not.toMatch(/handleSendBroadcast\s*=\s*(?:async\s*)?\(\)\s*=>\s*\{[\s\S]*?setTimeout\s*\(/m);
        });

        test('5.3: StudentDashboardPage.jsx không còn các chỉ số giả (18 / 20h, 8.8 / 10, PGS.TS Lê Quang Dũng) và liên kết tasks thực', () => {
            const pageSrc = readSource('frontend/src/pages/student/StudentDashboardPage.jsx');

            expect(pageSrc).not.toContain('18 / 20h');
            expect(pageSrc).not.toContain('8.8 / 10');
            expect(pageSrc).not.toContain('PGS.TS Lê Quang Dũng');
            expect(pageSrc).toMatch(/dashboardData\?\.meetingLogsCount\s*\?\?\s*0\}\s*buổi/);
            expect(pageSrc).toMatch(/dashboardData\?\.tasks/);
            expect(pageSrc).toMatch(/<Empty[\s\S]*?description=['"]Chưa có nhiệm vụ cần nộp trong đợt này['"]/);
            expect(pageSrc).not.toContain("message.success('Đang tải DeCuong_NghienCuu.docx...')");
        });

        test('5.4: Tuân thủ Quy tắc 2.6 (UI Button Standards) không chèn emoji thô hoặc ký tự đặc biệt vào nhãn nút', () => {
            const studentDash = readSource('frontend/src/pages/student/StudentDashboardPage.jsx');
            const lecturerDash = readSource('frontend/src/pages/lecturer/LecturerDashboardPage.jsx');
            const gradingDefense = readSource('frontend/src/pages/admin/GradingDefensePage.jsx');

            const forbiddenPatterns = [
                />\s*✓\s*Xong/u,
                />\s*⚙\s*\{/u,
                />\s*\+\s*Ghi nhận/u,
                />\s*[^<]*→\s*<\/(?:button|Button)>/u,
            ];

            for (const pattern of forbiddenPatterns) {
                expect(pattern.test(studentDash)).toBe(false);
                expect(pattern.test(lecturerDash)).toBe(false);
                expect(pattern.test(gradingDefense)).toBe(false);
            }
        });
    });
});
