const request = require('supertest');

const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockPrisma)),
    user: {
        findUnique: jest.fn(),
    },
    semester: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
    },
    topicRegistration: {
        findMany: jest.fn(),
    },
    notification: {
        createMany: jest.fn(),
        create: jest.fn(),
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
const { PLATFORM_AUTHORIZATION_EXEMPTIONS } = require('../../src/security/authorizationExemptions');

describe('Integration - Lecturer Broadcast Notification (/api/notifications/lecturer-broadcast)', () => {
    const lecturerToken = 'lecturer-token';
    const noMenteeToken = 'no-mentee-token';
    const studentToken = 'student-token';

    const lecturerUser = {
        id: 201,
        role: 'LECTURER',
        email: 'gvhd201@tdmu.edu.vn',
        fullName: 'TS. Nguyễn Văn A',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

    const noMenteeLecturer = {
        id: 202,
        role: 'LECTURER',
        email: 'gvhd202@tdmu.edu.vn',
        fullName: 'ThS. Trần Thị B',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

    const studentUser = {
        id: 301,
        role: 'STUDENT',
        email: 'sv301@student.tdmu.edu.vn',
        fullName: 'Lê Văn C',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [],
        councilMembers: [],
    };

    const activeSemester = {
        id: 10,
        code: 'HK1-2026-2027',
        name: 'Học kỳ 1 (2026 - 2027)',
        status: 'ONGOING',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-15'),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        jwt.verify.mockImplementation((token) => {
            if (token === lecturerToken) return { userId: lecturerUser.id, role: lecturerUser.role };
            if (token === noMenteeToken) return { userId: noMenteeLecturer.id, role: noMenteeLecturer.role };
            if (token === studentToken) return { userId: studentUser.id, role: studentUser.role };
            throw new Error('invalid token');
        });

        mockPrisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === lecturerUser.id) return lecturerUser;
            if (where.id === noMenteeLecturer.id) return noMenteeLecturer;
            if (where.id === studentUser.id) return studentUser;
            return null;
        });

        mockPrisma.semester.findFirst.mockResolvedValue(activeSemester);
        mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });
    });

    test('Test 1: Giảng viên có sinh viên hướng dẫn gửi broadcast thành công, tạo đủ Notification rows trong DB cho từng sinh viên', async () => {
        mockPrisma.topicRegistration.findMany.mockResolvedValue([
            { studentId: 301, student: { fullName: 'Lê Văn C' } },
            { studentId: 302, student: { fullName: 'Phạm Thị D' } },
        ]);

        const res = await request(app)
            .post('/api/notifications/lecturer-broadcast')
            .set('Authorization', `Bearer ${lecturerToken}`)
            .send({
                subject: 'Nhắc nhở nộp báo cáo tuần 8',
                content: 'Các em vui lòng cập nhật báo cáo tiến độ trước 17h thứ 6.',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('2 sinh viên');
        expect(res.body.data.sentCount).toBe(2);
        expect(res.body.data.recipientStudentIds).toEqual([301, 302]);

        expect(mockPrisma.notification.createMany).toHaveBeenCalledTimes(1);
        const createCallArgs = mockPrisma.notification.createMany.mock.calls[0][0];
        expect(createCallArgs.data).toHaveLength(2);
        expect(createCallArgs.data[0]).toMatchObject({
            userId: 301,
            title: 'Nhắc nhở nộp báo cáo tuần 8',
            content: 'Các em vui lòng cập nhật báo cáo tiến độ trước 17h thứ 6.',
            type: 'SYSTEM',
            isRead: false,
        });
        expect(createCallArgs.data[1]).toMatchObject({
            userId: 302,
            title: 'Nhắc nhở nộp báo cáo tuần 8',
            content: 'Các em vui lòng cập nhật báo cáo tiến độ trước 17h thứ 6.',
            type: 'SYSTEM',
            isRead: false,
        });
    });

    test('Test 2: Giảng viên không có sinh viên hướng dẫn gửi broadcast -> nhận lỗi 400 NO_ACTIVE_STUDENTS', async () => {
        mockPrisma.topicRegistration.findMany.mockResolvedValue([]);

        const res = await request(app)
            .post('/api/notifications/lecturer-broadcast')
            .set('Authorization', `Bearer ${noMenteeToken}`)
            .send({
                content: 'Thông báo thử nghiệm',
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error || res.body.code).toBe('NO_ACTIVE_STUDENTS');
        expect(res.body.message).toBe('Bạn hiện không có sinh viên nào đang hướng dẫn trong học kỳ này');
        expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    test('Test 3: Gửi broadcast với content rỗng -> nhận lỗi 400', async () => {
        const resEmpty = await request(app)
            .post('/api/notifications/lecturer-broadcast')
            .set('Authorization', `Bearer ${lecturerToken}`)
            .send({
                subject: 'Chỉ có tiêu đề',
                content: '   ',
            });

        expect(resEmpty.status).toBe(400);
        expect(resEmpty.body.success).toBe(false);
        expect(resEmpty.body.message).toBe('Nội dung thông báo không được để trống');
        expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();

        const resMissing = await request(app)
            .post('/api/notifications/lecturer-broadcast')
            .set('Authorization', `Bearer ${lecturerToken}`)
            .send({
                subject: 'Không có nội dung',
            });

        expect(resMissing.status).toBe(400);
        expect(resMissing.body.success).toBe(false);
        expect(resMissing.body.message).toBe('Nội dung thông báo không được để trống');
    });

    test('Test 4: Chưa đăng nhập gọi endpoint -> nhận lỗi 401', async () => {
        const res = await request(app)
            .post('/api/notifications/lecturer-broadcast')
            .send({
                content: 'Gửi mà không có token',
            });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('Test 5: Route authorization coverage: POST /lecturer-broadcast được khai báo exemption OWNERSHIP_GUARDED hợp lệ', () => {
        const exemption = PLATFORM_AUTHORIZATION_EXEMPTIONS.find(
            (item) => item.routeFile === 'notificationRoutes' && item.method === 'POST' && item.path === '/lecturer-broadcast'
        );

        expect(exemption).toBeDefined();
        expect(exemption.type).toBe('OWNERSHIP_GUARDED');
        expect(typeof exemption.reason).toBe('string');
        expect(exemption.reason.length).toBeGreaterThan(0);
    });
});
