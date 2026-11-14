const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Mock Prisma Database
const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    topic: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn() },
    registrationStateHistory: { findMany: jest.fn() },
    council: { findUnique: jest.fn(), findMany: jest.fn() },
    defenseScheduleAdjustmentLog: { findMany: jest.fn() },
    defenseScoreBookReturnLog: { findMany: jest.fn() },
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

describe('Package 2: State History, Audit Log, Real Cloning & Rule 2.6 Full Regression Suite', () => {
    const adminPerms = [
        {
            permissionGroup: {
                code: 'ADMIN_GROUP',
                permissions: [
                    { permission: { code: 'VIEW_TOPICS' } },
                    { permission: { code: 'TOPIC_CREATE' } },
                    { permission: { code: 'TOPIC_APPROVE' } },
                    { permission: { code: 'PROJECT_OVERSIGHT_MANAGE' } },
                    { permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } },
                    { permission: { code: 'VIEW_DEFENSE_ASSIGNMENTS' } },
                    { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                ],
            },
        },
    ];

    const activeSemester = {
        id: 99,
        name: 'Học kỳ 1 2026-2027',
        code: 'HK1-2026-2027',
        status: 'ACTIVE',
    };

    const priorSemester = {
        id: 88,
        name: 'Học kỳ 2 2025-2026',
        code: 'HK2-2025-2026',
        status: 'COMPLETED',
    };

    const samplePriorTopics = [
        {
            id: 101,
            title: 'Hệ thống Quản lý Đồ án Tốt nghiệp',
            description: 'Mô tả đề tài 101',
            projectCatalogId: 1,
            semesterId: 88,
            mentorId: 2,
            proposedById: 2,
            maxStudents: 1,
            status: 'APPROVED',
            semester: { id: 88, name: 'Học kỳ 2 2025-2026', academicYear: '2025-2026' },
            projectCatalog: { id: 1, name: 'Đồ án Tốt nghiệp CNTT' },
        },
        {
            id: 102,
            title: 'Ứng dụng AI Hỗ trợ Phân loại Văn bản',
            description: 'Mô tả đề tài 102',
            projectCatalogId: 1,
            semesterId: 88,
            mentorId: 2,
            proposedById: 2,
            maxStudents: 1,
            status: 'APPROVED',
            semester: { id: 88, name: 'Học kỳ 2 2025-2026', academicYear: '2025-2026' },
            projectCatalog: { id: 1, name: 'Đồ án Tốt nghiệp CNTT' },
        },
        {
            id: 201,
            title: 'Hệ thống IoT Giám sát Nông nghiệp Thông minh',
            description: 'Mô tả đề tài 201 của Giảng viên khác',
            projectCatalogId: 2,
            semesterId: 88,
            mentorId: 3,
            proposedById: 3,
            maxStudents: 1,
            status: 'APPROVED',
            semester: { id: 88, name: 'Học kỳ 2 2025-2026', academicYear: '2025-2026' },
            projectCatalog: { id: 2, name: 'Đồ án Tốt nghiệp IoT' },
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'mentor-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'other-lecturer-token') return { userId: 3, role: 'LECTURER' };
            if (token === 'council-lecturer-token') return { userId: 4, role: 'LECTURER' };
            if (token === 'student1-token') return { userId: 10, role: 'STUDENT' };
            if (token === 'student2-token') return { userId: 20, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) {
                return {
                    id: 1,
                    fullName: 'Admin User',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: adminPerms,
                };
            }
            if (where.id === 2) {
                return {
                    id: 2,
                    fullName: 'Mentor Lecturer',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 3) {
                return {
                    id: 3,
                    fullName: 'Other Lecturer',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 4) {
                return {
                    id: 4,
                    fullName: 'Council Lecturer',
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 10) {
                return {
                    id: 10,
                    fullName: 'Student One',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 20) {
                return {
                    id: 20,
                    fullName: 'Student Two',
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });

        prisma.topicRegistration.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 101) {
                return {
                    id: 101,
                    studentId: 10,
                    topicId: 501,
                    topic: { id: 501, title: 'Đồ án Phân tích Dữ liệu', mentorId: 2 },
                    student: { id: 10, fullName: 'Student One', code: 'SV001' },
                };
            }
            return null;
        });

        prisma.registrationStateHistory.findMany.mockResolvedValue([
            {
                id: 1,
                registrationId: 101,
                fromStatus: 'REGISTERED',
                toStatus: 'APPROVED',
                fromStateVersion: 1,
                toStateVersion: 2,
                reason: 'Hồ sơ đạt yêu cầu phê duyệt',
                actorId: 2,
                createdAt: new Date('2026-11-01T08:00:00Z'),
                actor: { id: 2, fullName: 'Mentor Lecturer', email: 'mentor@test.com', role: 'LECTURER' },
            },
            {
                id: 2,
                registrationId: 101,
                fromStatus: 'APPROVED',
                toStatus: 'IN_PROGRESS',
                fromStateVersion: 2,
                toStateVersion: 3,
                reason: 'Bắt đầu triển khai giai đoạn 1',
                actorId: 2,
                createdAt: new Date('2026-11-05T09:30:00Z'),
                actor: { id: 2, fullName: 'Mentor Lecturer', email: 'mentor@test.com', role: 'LECTURER' },
            },
        ]);

        prisma.council.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 88) {
                return {
                    id: 88,
                    name: 'Hội đồng Bảo vệ 01',
                    councilType: 'DEFENSE_COUNCIL',
                    members: [{ lecturerId: 4, roleInCouncil: 'CHAIRMAN' }],
                };
            }
            return null;
        });

        prisma.defenseScheduleAdjustmentLog.findMany.mockResolvedValue([
            {
                id: 10,
                councilId: 88,
                registrationId: 101,
                oldShift: 'MORNING',
                newShift: 'AFTERNOON',
                oldOrderInShift: 1,
                newOrderInShift: 3,
                reason: 'Trùng lịch thi chuyên đề',
                adjustedById: 1,
                createdAt: new Date('2026-11-10T10:00:00Z'),
                adjustedBy: { id: 1, fullName: 'Admin User', role: 'ADMIN' },
                registration: {
                    id: 101,
                    student: { id: 10, fullName: 'Student One', code: 'SV001' },
                    topic: { title: 'Đồ án Phân tích Dữ liệu' },
                },
            },
        ]);

        prisma.defenseScoreBookReturnLog.findMany.mockResolvedValue([
            {
                id: 20,
                councilId: 88,
                registrationId: 101,
                fromLedgerVersion: 1,
                toLedgerVersion: 2,
                reason: 'Hoàn trả để hội đồng chấm lại tiêu chí 3',
                returnedByAdminId: 1,
                returnedAt: new Date('2026-11-11T14:00:00Z'),
                returnedByAdmin: { id: 1, fullName: 'Admin User', email: 'admin@test.com' },
                registration: {
                    id: 101,
                    student: { fullName: 'Student One', code: 'SV001' },
                    topic: { title: 'Đồ án Phân tích Dữ liệu' },
                },
            },
        ]);

        prisma.semester.findFirst.mockImplementation(async ({ where }) => {
            if (where?.status === 'ACTIVE') return activeSemester;
            return null;
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 1: Sinh viên & Quyền xem lịch sử trạng thái đăng ký đề tài
    // =========================================================================
    describe('Tiêu điểm 1: Sinh viên không được xem lịch sử của sinh viên khác & xem của mình sắp xếp tăng dần', () => {
        test('1.1: Sinh viên xem lịch sử của chính mình trả về 200 OK kèm danh sách sắp xếp tăng dần theo thời gian (asc)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer student1-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data).toHaveLength(2);

            // Kiểm tra thứ tự tăng dần theo thời gian
            const t0 = new Date(res.body.data[0].createdAt).getTime();
            const t1 = new Date(res.body.data[1].createdAt).getTime();
            expect(t0).toBeLessThanOrEqual(t1);

            expect(prisma.registrationStateHistory.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId: 101 },
                    orderBy: { createdAt: 'asc' },
                })
            );

            // Endpoint alias /api/registrations/:id/history cũng hoạt động đồng bộ
            const aliasRes = await request(app)
                .get('/api/registrations/101/history')
                .set('Authorization', 'Bearer student1-token');

            expect(aliasRes.status).toBe(200);
            expect(aliasRes.body.success).toBe(true);
        });

        test('1.2: Sinh viên khác cố ý xem hồ sơ đăng ký của sinh viên khác bị chặn 403 Forbidden với mã FORBIDDEN', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer student2-token'); // Student 20 khác với Student 10

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN');
            expect(res.body.message).toContain('Bạn không có quyền xem lịch sử đăng ký đề tài này');
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 2: Phân quyền Giảng viên & Quản trị viên đối với lịch sử trạng thái
    // =========================================================================
    describe('Tiêu điểm 2: Giảng viên chỉ xem lịch sử sinh viên mình hướng dẫn & Admin xem toàn bộ', () => {
        test('2.1: Giảng viên hướng dẫn (mentorId = 2) được xem lịch sử của sinh viên mình (200 OK)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer mentor-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].toStatus).toBe('APPROVED');
        });

        test('2.2: Giảng viên khác (userId = 3) cố tình xem sinh viên của giảng viên khác bị chặn 403 Forbidden', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer other-lecturer-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN');
            expect(res.body.message).toContain('Bạn không có quyền xem lịch sử đăng ký đề tài này');
        });

        test('2.3: Quản trị viên (Admin) có thẩm quyền xem lịch sử của bất kỳ sinh viên nào (200 OK)', async () => {
            const res = await request(app)
                .get('/api/topics/registrations/101/history')
                .set('Authorization', 'Bearer admin-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 3: Nhật ký điều chỉnh ca thi & Nhật ký hoàn trả sổ điểm
    // =========================================================================
    describe('Tiêu điểm 3: Nhật ký điều chỉnh ca thi & hoàn trả sổ điểm theo đúng hội đồng và sắp xếp desc', () => {
        test('3.1: GET /api/councils/:id/schedule-adjustments chỉ trả về đúng hội đồng và sắp xếp desc theo createdAt', async () => {
            const res = await request(app)
                .get('/api/councils/88/schedule-adjustments')
                .set('Authorization', 'Bearer council-lecturer-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].adjustedBy.fullName).toBe('Admin User');
            expect(res.body.data[0].registration.student.fullName).toBe('Student One');
            expect(res.body.data[0].registration.student.studentCode).toBe('SV001');

            expect(prisma.defenseScheduleAdjustmentLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { councilId: 88 },
                    orderBy: { createdAt: 'desc' },
                })
            );
        });

        test('3.2: Giảng viên không thuộc hội đồng bị chặn khi xem nhật ký điều chỉnh ca thi (403 Forbidden)', async () => {
            const res = await request(app)
                .get('/api/councils/88/schedule-adjustments')
                .set('Authorization', 'Bearer other-lecturer-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Bạn không có quyền xem nhật ký điều chỉnh lịch của hội đồng này');
        });

        test('3.3: GET /api/evaluations/councils/:id/return-logs chỉ trả về đúng hội đồng và sắp xếp desc theo returnedAt', async () => {
            const res = await request(app)
                .get('/api/evaluations/councils/88/return-logs')
                .set('Authorization', 'Bearer council-lecturer-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].returnedByAdmin.fullName).toBe('Admin User');
            expect(res.body.data[0].reason).toContain('tiêu chí 3');
            expect(res.body.data[0].registration.student.fullName).toBe('Student One');
            expect(res.body.data[0].registration.student.studentCode).toBe('SV001');

            expect(prisma.defenseScoreBookReturnLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { councilId: 88 },
                    orderBy: { returnedAt: 'desc' },
                })
            );
        });

        test('3.4: Giảng viên không thuộc hội đồng bị chặn khi xem nhật ký hoàn trả sổ điểm (403 Forbidden)', async () => {
            const res = await request(app)
                .get('/api/evaluations/councils/88/return-logs')
                .set('Authorization', 'Bearer other-lecturer-token');

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Bạn không có quyền xem nhật ký hoàn trả sổ điểm của hội đồng này');
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 4: API sao chép đề tài (POST /api/topics/clone) & cloneable topics
    // =========================================================================
    describe('Tiêu điểm 4: API sao chép đề tài tuân thủ quyền sở hữu, trạng thái DRAFT, maxStudents = 1, currentStudents = 0', () => {
        test('4.1: GET /api/topics/cloneable chỉ trả về đề tài kỳ trước của chính giảng viên & chặn sinh viên (403)', async () => {
            prisma.topic.findMany.mockResolvedValueOnce([samplePriorTopics[0], samplePriorTopics[1]]);

            const resLecturer = await request(app)
                .get('/api/topics/cloneable')
                .set('Authorization', 'Bearer mentor-token');

            expect(resLecturer.status).toBe(200);
            expect(resLecturer.body.success).toBe(true);
            expect(resLecturer.body.data).toHaveLength(2);
            expect(prisma.topic.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: { not: 99 },
                        status: { in: ['APPROVED', 'COMPLETED', 'DEFENDED'] },
                        mentorId: 2,
                    }),
                })
            );

            // Sinh viên bị chặn với 403
            const resStudent = await request(app)
                .get('/api/topics/cloneable')
                .set('Authorization', 'Bearer student1-token');

            expect(resStudent.status).toBe(403);
            expect(resStudent.body.code).toBe('FORBIDDEN');
        });

        test('4.2: Giảng viên sao chép đề tài của chính mình sang kỳ active -> DRAFT, maxStudents = 1', async () => {
            const sourceTopics = [samplePriorTopics[0], samplePriorTopics[1]];
            prisma.topic.findMany.mockResolvedValueOnce(sourceTopics);

            prisma.topic.create
                .mockResolvedValueOnce({
                    id: 301,
                    title: sourceTopics[0].title,
                    description: sourceTopics[0].description,
                    projectCatalogId: sourceTopics[0].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                })
                .mockResolvedValueOnce({
                    id: 302,
                    title: sourceTopics[1].title,
                    description: sourceTopics[1].description,
                    projectCatalogId: sourceTopics[1].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                });

            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token')
                .send({ topicIds: [101, 102] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
            expect(res.body.data).toHaveLength(2);

            // Kiểm tra dữ liệu khởi tạo khi sao chép
            expect(prisma.topic.create).toHaveBeenCalledWith({
                data: {
                    title: sourceTopics[0].title,
                    description: sourceTopics[0].description,
                    projectCatalogId: sourceTopics[0].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                },
            });
            expect(prisma.topic.create).toHaveBeenCalledWith({
                data: {
                    title: sourceTopics[1].title,
                    description: sourceTopics[1].description,
                    projectCatalogId: sourceTopics[1].projectCatalogId,
                    semesterId: 99,
                    mentorId: 2,
                    proposedById: 2,
                    maxStudents: 1,
                    status: 'DRAFT',
                },
            });
        });

        test('4.3: Giảng viên cố ý sao chép đề tài của giảng viên khác bị chặn 403 Forbidden', async () => {
            prisma.topic.findMany.mockResolvedValueOnce([samplePriorTopics[2]]); // mentorId = 3

            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer mentor-token') // userId = 2
                .send({ topicIds: [201] });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN');
            expect(res.body.message).toContain('Bạn không có quyền sao chép đề tài của giảng viên khác');
            expect(prisma.topic.create).not.toHaveBeenCalled();
        });

        test('4.4: Sinh viên bị chặn khi gọi API POST /api/topics/clone (403 Forbidden)', async () => {
            const res = await request(app)
                .post('/api/topics/clone')
                .set('Authorization', 'Bearer student1-token')
                .send({ topicIds: [101] });

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('FORBIDDEN');
            expect(prisma.topic.create).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // TIÊU ĐIỂM 5: Frontend Zero Fake Actions, Zero Mock & Tuân thủ Rule 2.6
    // =========================================================================
    describe('Tiêu điểm 5: Xác nhận frontend không còn dữ liệu giả & tuân thủ chuẩn nút Rule 2.6', () => {
        const rootDir = path.resolve(__dirname, '../../../');
        const readSource = (relPath) => fs.readFileSync(path.join(rootDir, relPath), 'utf8');

        test('5.1: TopicManagementPage loại bỏ toàn bộ dữ liệu mẫu giả (DT-2025-042/055) và fake toast', () => {
            const pageSrc = readSource('frontend/src/pages/lecturer/TopicManagementPage.jsx');

            expect(pageSrc).not.toContain('DT-2025-042');
            expect(pageSrc).not.toContain('DT-2025-055');
            expect(pageSrc).not.toContain('Đã sao chép 2 đề tài thành công!');
            expect(pageSrc).toMatch(/topicService\s*\.\s*getCloneableTopics/);
            expect(pageSrc).toMatch(/topicService\s*\.\s*cloneTopics/);
            expect(pageSrc).toMatch(/<Modal[^>]*open=\{cloneModalOpen\}/);
        });

        test('5.2: RubricManagementPage kết nối portalContentService thực, loại bỏ fake toast và hỗ trợ tải tài liệu Supabase', () => {
            const pageSrc = readSource('frontend/src/pages/admin/RubricManagementPage.jsx');

            expect(pageSrc).not.toContain('Đang tải mẫu chuẩn:');
            expect(pageSrc).toMatch(/portalContentService\.getPublicContent/);
            expect(pageSrc).toMatch(/window\.open\((?:form|previewForm)\.fileUrl,\s*['_"]_blank['_"]\)/);
            expect(pageSrc).toMatch(/Biểu mẫu chưa được tải lên hệ thống/);
            expect(pageSrc).toMatch(/Chưa có file/);
        });

        test('5.3: RegistrationTimelineDrawer được tích hợp đầy đủ trong StudentDashboard, ProgressTracking và TopicApproval', () => {
            const drawerSrc = readSource('frontend/src/components/common/RegistrationTimelineDrawer.jsx');
            const studentDash = readSource('frontend/src/pages/student/StudentDashboardPage.jsx');
            const progressTrack = readSource('frontend/src/pages/lecturer/ProgressTrackingPage.jsx');
            const topicApproval = readSource('frontend/src/pages/admin/TopicApprovalPage.jsx');

            // Drawer uses Ant Design Timeline and fetches registration history
            expect(drawerSrc).toMatch(/<Timeline/);
            expect(drawerSrc).toMatch(/registrationService\.getRegistrationHistory|topicService\.getRegistrationHistory|useRegistrationHistory/);
            expect(drawerSrc).toMatch(/Chưa có lịch sử chuyển trạng thái/);

            // Integrated in all 3 dashboards
            expect(studentDash).toMatch(/RegistrationTimelineDrawer/);
            expect(progressTrack).toMatch(/RegistrationTimelineDrawer/);
            expect(topicApproval).toMatch(/RegistrationTimelineDrawer/);
        });

        test('5.4: CouncilDetailPage & GradingDefensePage kết nối log thực và hiển thị cảnh báo hoàn trả', () => {
            const councilDetail = readSource('frontend/src/pages/admin/CouncilDetailPage.jsx');
            const gradingDefense = readSource('frontend/src/pages/admin/GradingDefensePage.jsx');

            expect(councilDetail).toMatch(/councilService\.getScheduleAdjustments|useCouncilAdjustments/);
            expect(councilDetail).toMatch(/Nhật ký đổi ca/);
            expect(gradingDefense).toMatch(/evaluationService\.getScoreBookReturnLogs|useScoreBookReturnLogs/);
            expect(gradingDefense).toMatch(/Hội đồng có lượt hoàn trả sổ điểm/);
            expect(gradingDefense).toMatch(/Xem lịch sử trả/);
        });

        test('5.5: Tuân thủ tuyệt đối AGENTS.md Rule 2.6 - Không chèn emoji/ký tự đồ họa thô vào nhãn nút bấm', () => {
            const filesToCheck = [
                'frontend/src/components/lecturer/OutlineReviewModal.jsx',
                'frontend/src/pages/admin/TopicManagementPage.jsx',
                'frontend/src/pages/lecturer/TopicManagementPage.jsx',
                'frontend/src/pages/admin/GradingDefensePage.jsx',
                'frontend/src/pages/admin/RubricManagementPage.jsx',
                'frontend/src/pages/admin/CouncilDetailPage.jsx',
                'frontend/src/components/common/RegistrationTimelineDrawer.jsx',
            ];

            const rawSymbolRegex = />\s*[^<]*[←→+🤖✓⚠️⚙✏️👥🗑️🔓▾▴↗📖🏛️⏰✕]\s*[^<]*<\/(?:Button|button)>/u;

            for (const relPath of filesToCheck) {
                const content = readSource(relPath);
                expect(rawSymbolRegex.test(content)).toBe(false);
            }
        });
    });
});
