/**
 * Integration tests cho chức năng Xem trước và Xác nhận phương án phân bổ hội đồng bảo vệ
 * (POST /api/councils/defense-assignment/preview và POST /api/councils/defense-assignment/confirm)
 * Tuân thủ quy chuẩn TopicRegistration, UTF-8 no BOM.
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    council: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    councilMember: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
    },
    topicRegistration: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    topicExpertiseAssessment: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    notification: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: {
        create: jest.fn().mockResolvedValue({}),
    },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const planningService = require('../../src/services/defenseCouncilPlanningService');
const app = require('../../src/app');

describe('Defense Council Assignment Preview & Confirmation Integration', () => {
    const adminUser = {
        id: 1,
        fullName: 'Admin User',
        role: 'ADMIN',
        isActive: true,
        permissionGroups: [{
            permissionGroup: {
                code: 'ADMIN_GROUP',
                permissions: [
                    { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                    { permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } },
                ],
            },
        }],
    };

    const giaoVuUser = {
        id: 2,
        fullName: 'Giao Vu User',
        role: 'GIAO_VU',
        isActive: true,
        permissionGroups: [{
            permissionGroup: {
                code: 'GIAO_VU_GROUP',
                permissions: [
                    { permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } },
                ],
            },
        }],
    };

    const sampleSemester = {
        id: 1,
        code: 'HK251',
        defenseDate: new Date('2026-12-20T00:00:00.000Z'),
        defenseCouncilTargetSize: 22,
    };

    const createEligibleRecord = (id, studentId, topicId, title, mentorId, expertise) => ({
        id,
        semesterId: 1,
        studentId,
        topicId,
        status: 'IN_PROGRESS',
        student: { id: studentId, fullName: `Sinh viên ${studentId}`, code: `SV${studentId}` },
        topic: {
            id: topicId,
            title,
            mentorId,
            maxStudents: 1,
            acceptedExpertise: [expertise],
            mentor: { id: mentorId, fullName: `GV Hướng dẫn ${mentorId}` },
        },
        bm04Evaluation: {
            id: 300 + id,
            conclusion: 'AGREED_FOR_DEFENSE',
            isLocked: true,
            status: 'SIGNED_APPROVED',
        },
        defenseCouncilId: null,
        councilId: null,
    });

    let defaultRegistrations;

    const lecturers = [
        { id: 11, fullName: 'GV Chủ tịch', academicTitle: 'TS', expertiseAreas: ['Web', 'AI'], role: 'LECTURER', isActive: true },
        { id: 12, fullName: 'GV Thư ký', academicTitle: 'ThS', expertiseAreas: ['Web'], role: 'LECTURER', isActive: true },
        { id: 13, fullName: 'GV Phản biện', academicTitle: 'PGS', expertiseAreas: ['AI'], role: 'LECTURER', isActive: true },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        defaultRegistrations = [
            createEligibleRecord(101, 1001, 201, 'Hệ thống AI', 50, 'AI'),
            createEligibleRecord(102, 1002, 202, 'Hệ thống Web', 51, 'Web'),
        ];

        mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'giao-vu-token') return { userId: 2, role: 'GIAO_VU' };
            throw new Error('invalid token');
        });

        mockDatabase.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) return adminUser;
            if (where.id === 2) return giaoVuUser;
            return null;
        });

        mockDatabase.semester.findUnique.mockResolvedValue(sampleSemester);
        mockDatabase.user.findMany.mockResolvedValue(lecturers);
        mockDatabase.council.findMany.mockResolvedValue([]);

        mockDatabase.topicRegistration.findMany.mockImplementation(async (query) => {
            if (query?.where?.id?.in) {
                return defaultRegistrations.filter((r) => query.where.id.in.includes(r.id));
            }
            return defaultRegistrations;
        });

        mockDatabase.topicExpertiseAssessment.findUnique.mockImplementation(async ({ where }) => {
            if (where.topicId === 201) {
                return { topicId: 201, status: 'APPROVED', acceptedAreas: ['AI'] };
            }
            if (where.topicId === 202) {
                return { topicId: 202, status: 'APPROVED', acceptedAreas: ['Web'] };
            }
            return null;
        });
    });

    test('1. Preview endpoint performs zero database mutations (0 writes)', async () => {
        const res = await request(app)
            .post('/api/councils/defense-assignment/preview')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                date: '2026-12-20',
                rooms: ['Phòng 101'],
                targetSize: 22,
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('FEASIBLE');
        expect(res.body.fingerprint).toBeDefined();
        expect(res.body.councils).toHaveLength(1);

        // Đảm bảo không có bất kỳ mutation nào xuống database
        expect(mockDatabase.council.create).not.toHaveBeenCalled();
        expect(mockDatabase.council.update).not.toHaveBeenCalled();
        expect(mockDatabase.councilMember.create).not.toHaveBeenCalled();
        expect(mockDatabase.topicRegistration.update).not.toHaveBeenCalled();
        expect(mockDatabase.topicRegistration.updateMany).not.toHaveBeenCalled();
    });

    test('2. Giáo vụ can preview but cannot confirm (403 Forbidden on confirm)', async () => {
        // GIAO_VU xem trước thành công
        const resPreview = await request(app)
            .post('/api/councils/defense-assignment/preview')
            .set('Authorization', 'Bearer giao-vu-token')
            .send({
                semesterId: 1,
                date: '2026-12-20',
                rooms: ['Phòng 101'],
            });

        expect(resPreview.status).toBe(200);

        // GIAO_VU xác nhận -> bị chặn 403 Forbidden
        const resConfirm = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer giao-vu-token')
            .send({
                semesterId: 1,
                fingerprint: resPreview.body.fingerprint,
                councils: resPreview.body.councils,
            });

        expect(resConfirm.status).toBe(403);
        expect(mockDatabase.council.create).not.toHaveBeenCalled();
    });

    test('3. Admin confirms valid plan successfully: creates council and assigns students', async () => {
        // Lấy preview trước
        const previewRes = await request(app)
            .post('/api/councils/defense-assignment/preview')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                date: '2026-12-20',
                rooms: ['Phòng 101'],
                targetSize: 22,
            });

        expect(previewRes.status).toBe(200);
        const { fingerprint, councils } = previewRes.body;

        mockDatabase.council.create.mockResolvedValue({ id: 501, name: 'Hội đồng 1' });
        mockDatabase.councilMember.create.mockResolvedValue({ id: 1 });
        mockDatabase.topicRegistration.updateMany.mockResolvedValue({ count: 1 });

        const confirmRes = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                fingerprint,
                councils,
                date: '2026-12-20',
                rooms: ['Phòng 101'],
                targetSize: 22,
            });

        expect(confirmRes.status).toBe(200);
        expect(confirmRes.body.success).toBe(true);
        expect(confirmRes.body.createdCouncilIds).toEqual([501]);
        expect(confirmRes.body.assignedRegistrationCount).toBe(2);

        // Xác thực Council được tạo với assignmentConfirmedAt
        expect(mockDatabase.council.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    semesterId: 1,
                    councilType: 'DEFENSE_COUNCIL',
                    location: 'Phòng 101',
                    assignmentConfirmedById: 1,
                }),
            })
        );

        // Xác thực topicRegistration.updateMany được gọi 2 lần với defenseCouncilId: 501
        expect(mockDatabase.topicRegistration.updateMany).toHaveBeenCalledTimes(2);
        expect(mockDatabase.topicRegistration.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 101, defenseCouncilId: null },
                data: expect.objectContaining({
                    defenseCouncilId: 501,
                    councilId: 501,
                    defenseSessionShift: 'MORNING',
                }),
            })
        );
    });

    test('4. Rejects with 409 PLAN_FINGERPRINT_STALE when source data or fingerprint changes', async () => {
        const confirmRes = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                fingerprint: 'outdated-stale-fingerprint-12345',
                councils: [{ name: 'Hội đồng 1', students: [{ id: 101 }, { id: 102 }] }],
            });

        expect(confirmRes.status).toBe(409);
        expect(confirmRes.body.code).toBe('PLAN_FINGERPRINT_STALE');
        expect(mockDatabase.council.create).not.toHaveBeenCalled();
    });

    test('5. Rejects with 400 INCOMPLETE_ASSIGNMENT when some eligible students are missing in plan', async () => {
        const preview = await planningService.buildDefenseCouncilPlan(
            { semesterId: 1, date: '2026-12-20', rooms: ['Phòng 101'], targetSize: 22 },
            { db: mockDatabase }
        );

        // Cố tình xóa bớt 1 sinh viên khỏi plan
        const modifiedCouncils = JSON.parse(JSON.stringify(preview.councils));
        modifiedCouncils[0].students = modifiedCouncils[0].students.slice(0, 1);

        // Giả lập preview vẫn trả về fingerprint ban đầu
        jest.spyOn(planningService, 'buildDefenseCouncilPlan').mockResolvedValue(preview);

        const res = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                fingerprint: preview.fingerprint,
                councils: modifiedCouncils,
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INCOMPLETE_ASSIGNMENT');
        expect(mockDatabase.council.create).not.toHaveBeenCalled();
    });

    test('6. Rejects with 409 STUDENT_ALREADY_ASSIGNED on concurrent confirmation race condition', async () => {
        const preview = await planningService.buildDefenseCouncilPlan(
            { semesterId: 1, date: '2026-12-20', rooms: ['Phòng 101'], targetSize: 22 },
            { db: mockDatabase }
        );
        jest.spyOn(planningService, 'buildDefenseCouncilPlan').mockResolvedValue(preview);

        mockDatabase.council.create.mockResolvedValue({ id: 502, name: 'Hội đồng 1' });
        mockDatabase.councilMember.create.mockResolvedValue({ id: 1 });

        // Giả lập cuộc đua: sinh viên đã bị một admin khác gán trước đó (updateMany count: 0)
        mockDatabase.topicRegistration.updateMany.mockResolvedValue({ count: 0 });

        const confirmRes = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                fingerprint: preview.fingerprint,
                councils: preview.councils,
            });

        expect(confirmRes.status).toBe(409);
        expect(confirmRes.body.code).toBe('STUDENT_ALREADY_ASSIGNED');
    });

    test('7. Hard constraint rejection: MENTOR_CONFLICT rejects plan when member is student mentor', async () => {
        const preview = await planningService.buildDefenseCouncilPlan(
            { semesterId: 1, date: '2026-12-20', rooms: ['Phòng 101'], targetSize: 22 },
            { db: mockDatabase }
        );
        jest.spyOn(planningService, 'buildDefenseCouncilPlan').mockResolvedValue(preview);

        // Sửa hội đồng: đổi member thành ID 50 (trùng với mentorId của SV A)
        const modifiedCouncils = JSON.parse(JSON.stringify(preview.councils));
        modifiedCouncils[0].members[0].lecturerId = 50;
        modifiedCouncils[0].members[0].id = 50;

        const res = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                fingerprint: preview.fingerprint,
                councils: modifiedCouncils,
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('MENTOR_CONFLICT');
    });

    test('8. Hard constraint rejection: LECTURER_DOUBLE_BOOKED rejects when a lecturer is in 2 councils', async () => {
        const preview = await planningService.buildDefenseCouncilPlan(
            { semesterId: 1, date: '2026-12-20', rooms: ['Phòng 101', 'Phòng 102'], targetSize: 22 },
            { db: mockDatabase }
        );
        jest.spyOn(planningService, 'buildDefenseCouncilPlan').mockResolvedValue(preview);

        // Tạo 2 hội đồng nhưng chung giảng viên ID 11
        const modifiedCouncils = [
            {
                name: 'Hội đồng 1',
                room: 'Phòng 101',
                date: '2026-12-20',
                members: [
                    { lecturerId: 11, role: 'CHAIRMAN' },
                    { lecturerId: 12, role: 'SECRETARY' },
                    { lecturerId: 13, role: 'REVIEWER' },
                ],
                students: [{ id: 101 }],
            },
            {
                name: 'Hội đồng 2',
                room: 'Phòng 102',
                date: '2026-12-20',
                members: [
                    { lecturerId: 11, role: 'CHAIRMAN' }, // Trùng ID 11
                    { lecturerId: 12, role: 'SECRETARY' },
                    { lecturerId: 13, role: 'REVIEWER' },
                ],
                students: [{ id: 102 }],
            },
        ];

        const res = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                fingerprint: preview.fingerprint,
                councils: modifiedCouncils,
                rooms: ['Phòng 101', 'Phòng 102'],
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('LECTURER_DOUBLE_BOOKED');
    });

    test('9. Hard constraint rejection: ROOM_COLLISION rejects when 2 councils share the same room on the same day', async () => {
        const preview = await planningService.buildDefenseCouncilPlan(
            { semesterId: 1, date: '2026-12-20', rooms: ['Phòng 101'], targetSize: 22 },
            { db: mockDatabase }
        );
        jest.spyOn(planningService, 'buildDefenseCouncilPlan').mockResolvedValue(preview);

        const modifiedCouncils = [
            {
                name: 'Hội đồng 1',
                room: 'Phòng 101',
                date: '2026-12-20',
                members: [
                    { lecturerId: 11, role: 'CHAIRMAN' },
                    { lecturerId: 12, role: 'SECRETARY' },
                    { lecturerId: 13, role: 'REVIEWER' },
                ],
                students: [{ id: 101 }],
            },
            {
                name: 'Hội đồng 2',
                room: 'Phòng 101', // Trùng phòng 'Phòng 101' cùng ngày
                date: '2026-12-20',
                members: [
                    { lecturerId: 14, role: 'CHAIRMAN', expertiseAreas: ['Web'] },
                    { lecturerId: 15, role: 'SECRETARY', expertiseAreas: ['Web'] },
                    { lecturerId: 16, role: 'REVIEWER', expertiseAreas: ['Web'] },
                ],
                students: [{ id: 102 }],
            },
        ];

        const res = await request(app)
            .post('/api/councils/defense-assignment/confirm')
            .set('Authorization', 'Bearer admin-token')
            .send({
                semesterId: 1,
                fingerprint: preview.fingerprint,
                councils: modifiedCouncils,
                rooms: ['Phòng 101'],
            });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('ROOM_COLLISION');
    });
});
