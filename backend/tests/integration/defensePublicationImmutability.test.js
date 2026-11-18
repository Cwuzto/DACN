/**
 * Integration tests cho tính bất biến của Hội đồng và Công bố lịch bảo vệ an toàn (Task 6 backend)
 * (POST /api/councils/:id/confirm-and-publish-schedule, PUT /:id, POST /:id/assign, DELETE /:id)
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
        delete: jest.fn(),
    },
    councilMember: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
    },
    topicRegistration: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
    },
    defenseScheduleAdjustmentLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
    },
    defenseResult: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    bM01Evaluation: {
        findFirst: jest.fn().mockResolvedValue(null),
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

const app = require('../../src/app');

describe('Defense Publication Guards & Immutability Integration', () => {
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

    const validSemester = {
        id: 1,
        code: 'HK251',
        lockedDefenseRubricVersionId: 100,
        defenseEligibleListPublishedAt: new Date('2026-12-01T00:00:00.000Z'),
    };

    const sampleRegistrations = [
        { id: 101, studentId: 1001, student: { id: 1001, fullName: 'SV A', code: 'SV01' }, topic: { title: 'AI' } },
        { id: 102, studentId: 1002, student: { id: 1002, fullName: 'SV B', code: 'SV02' }, topic: { title: 'Web' } },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        mockDatabase.user.findUnique.mockResolvedValue(adminUser);
        mockDatabase.semester.findUnique.mockResolvedValue(validSemester);
    });

    test('1. Publication fails with 409 ASSIGNMENT_NOT_CONFIRMED if council assignment is not confirmed', async () => {
        mockDatabase.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            name: 'Hội đồng 1',
            assignmentConfirmedAt: null, // Chưa xác nhận phân công
            location: 'Phòng 101',
            defenseDate: new Date('2026-12-20'),
            schedulePublishedAt: null,
            semester: validSemester,
            registrations: sampleRegistrations,
            members: [],
        });

        const res = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [101, 102] });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('ASSIGNMENT_NOT_CONFIRMED');
        expect(mockDatabase.council.update).not.toHaveBeenCalled();
    });

    test('2. Publication fails with 400 MISSING_DATE_OR_ROOM if council lacks date or location', async () => {
        mockDatabase.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            name: 'Hội đồng 1',
            assignmentConfirmedAt: new Date(),
            location: null, // Thiếu phòng
            defenseDate: new Date('2026-12-20'),
            schedulePublishedAt: null,
            semester: validSemester,
            registrations: sampleRegistrations,
            members: [],
        });

        const res = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [101, 102] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('MISSING_DATE_OR_ROOM');
        expect(mockDatabase.council.update).not.toHaveBeenCalled();
    });

    test('3. Publication fails with 400 INVALID_ORDERED_REGISTRATION_IDS if orderedRegistrationIds mismatch council roster', async () => {
        mockDatabase.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            name: 'Hội đồng 1',
            assignmentConfirmedAt: new Date(),
            location: 'Phòng 101',
            defenseDate: new Date('2026-12-20'),
            schedulePublishedAt: null,
            semester: validSemester,
            registrations: sampleRegistrations, // có [101, 102]
            members: [],
        });

        // Gửi mảng chỉ có [101], thiếu 102
        const resMismatch = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [101] });

        expect(resMismatch.status).toBe(400);
        expect(resMismatch.body.code).toBe('INVALID_ORDERED_REGISTRATION_IDS');

        // Gửi mảng có ID sinh viên lạ [101, 102, 999]
        const resForeign = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [101, 102, 999] });

        expect(resForeign.status).toBe(400);
        expect(resForeign.body.code).toBe('INVALID_ORDERED_REGISTRATION_IDS');
    });

    test('4. Publication succeeds with correct shift splitting for 22 students (11 morning / 11 afternoon)', async () => {
        const twentyTwoRegs = Array.from({ length: 22 }, (_, i) => ({
            id: 100 + i + 1,
            studentId: 1000 + i + 1,
            student: { id: 1000 + i + 1, fullName: `SV ${i + 1}`, code: `SV${i + 1}` },
            topic: { title: `Đề tài ${i + 1}` },
        }));

        mockDatabase.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            name: 'Hội đồng 1',
            assignmentConfirmedAt: new Date(),
            location: 'Phòng 101',
            defenseDate: new Date('2026-12-20'),
            schedulePublishedAt: null,
            semester: validSemester,
            registrations: twentyTwoRegs,
            members: [],
        });

        const orderedIds = twentyTwoRegs.map((r) => r.id);

        const res = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: orderedIds });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Kiểm tra update council
        expect(mockDatabase.council.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 50 },
                data: expect.objectContaining({
                    scheduleConfirmedAt: expect.any(Date),
                    schedulePublishedAt: expect.any(Date),
                }),
            })
        );

        // Kiểm tra update topicRegistration cho từng sinh viên:
        // Sinh viên 1 (index 0): ca sáng, seq 1, order 1
        expect(mockDatabase.topicRegistration.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 101 },
                data: expect.objectContaining({
                    defenseSessionShift: 'MORNING',
                    defenseSequenceNo: 1,
                    defenseOrderInShift: 1,
                }),
            })
        );

        // Sinh viên 11 (index 10): ca sáng, seq 11, order 11
        expect(mockDatabase.topicRegistration.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 111 },
                data: expect.objectContaining({
                    defenseSessionShift: 'MORNING',
                    defenseSequenceNo: 11,
                    defenseOrderInShift: 11,
                }),
            })
        );

        // Sinh viên 12 (index 11): ca chiều, seq 12, order 1
        expect(mockDatabase.topicRegistration.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 112 },
                data: expect.objectContaining({
                    defenseSessionShift: 'AFTERNOON',
                    defenseSequenceNo: 12,
                    defenseOrderInShift: 1,
                }),
            })
        );
    });

    test('5. Rejects with 409 SCHEDULE_ALREADY_PUBLISHED when calling confirm-and-publish-schedule on published council', async () => {
        mockDatabase.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            name: 'Hội đồng 1',
            assignmentConfirmedAt: new Date(),
            location: 'Phòng 101',
            defenseDate: new Date('2026-12-20'),
            schedulePublishedAt: new Date('2026-12-10'), // Đã công bố lịch
            semester: validSemester,
            registrations: sampleRegistrations,
            members: [],
        });

        const res = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [101, 102] });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SCHEDULE_ALREADY_PUBLISHED');
        expect(mockDatabase.council.update).not.toHaveBeenCalled();
    });

    test('6. Published council is immutable: rejects PUT updateCouncil, POST assign, DELETE council', async () => {
        mockDatabase.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            name: 'Hội đồng 1',
            assignmentConfirmedAt: new Date(),
            location: 'Phòng 101',
            defenseDate: new Date('2026-12-20'),
            schedulePublishedAt: new Date('2026-12-10'), // Đã công bố
            semester: { status: 'ACTIVE' },
            members: [],
            registrations: sampleRegistrations,
            _count: { registrations: 2 },
        });

        // 1. Thử PUT updateCouncil
        const resUpdate = await request(app)
            .put('/api/councils/50')
            .set('Authorization', 'Bearer admin-token')
            .send({ name: 'Tên hội đồng mới' });

        expect(resUpdate.status).toBe(409);
        expect(resUpdate.body.code).toBe('COUNCIL_SCHEDULE_ALREADY_PUBLISHED');

        // 2. Thử POST assignRegistrationsToCouncil
        const resAssign = await request(app)
            .post('/api/councils/50/assign')
            .set('Authorization', 'Bearer admin-token')
            .send({ registrationIds: [103] });

        expect(resAssign.status).toBe(409);

        // 3. Thử DELETE deleteCouncil
        const resDelete = await request(app)
            .delete('/api/councils/50')
            .set('Authorization', 'Bearer admin-token');

        expect(resDelete.status).toBe(409);
        expect(resDelete.body.code).toBe('COUNCIL_SCHEDULE_ALREADY_PUBLISHED');
    });

    test('7. Reasoned schedule adjustment route (PATCH /:id/registrations/:registrationId/schedule) is preserved for published councils', async () => {
        mockDatabase.council.findUnique.mockResolvedValue({
            id: 50,
            semesterId: 1,
            name: 'Hội đồng 1',
            assignmentConfirmedAt: new Date(),
            location: 'Phòng 101',
            defenseDate: new Date('2026-12-20'),
            schedulePublishedAt: new Date('2026-12-10'),
            semester: validSemester,
            registrations: sampleRegistrations,
            members: [],
        });

        mockDatabase.topicRegistration.findUnique.mockResolvedValue({
            id: 101,
            studentId: 1001,
            defenseCouncilId: 50,
            defenseSessionShift: 'MORNING',
            defenseOrderInShift: 1,
            defenseSequenceNo: 1,
        });

        const resAdjust = await request(app)
            .patch('/api/councils/50/registrations/101/schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({
                newShift: 'AFTERNOON',
                newOrderInShift: 2,
                reason: 'Sinh viên có lịch khám bệnh buổi sáng theo giấy xác nhận viện',
            });

        expect(resAdjust.status).toBe(200);
        expect(resAdjust.body.success).toBe(true);
        expect(mockDatabase.defenseScheduleAdjustmentLog.create).toHaveBeenCalled();
    });
});
