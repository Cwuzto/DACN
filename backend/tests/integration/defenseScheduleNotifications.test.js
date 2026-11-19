const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    semester: { findUnique: jest.fn(), findFirst: jest.fn() },
    council: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    councilMember: { findMany: jest.fn(), findUnique: jest.fn() },
    topicRegistration: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    defenseScheduleAdjustmentLog: { create: jest.fn().mockResolvedValue({}) },
    notification: {
        create: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    periodWorkflowPolicyVersion: { findMany: jest.fn().mockResolvedValue([]) },
    academicDelegation: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
};

mockDatabase.$transaction.mockImplementation(async (cb) => cb(mockDatabase));

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn(),
}));
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const notificationService = require('../../src/services/notificationService');
jest.spyOn(notificationService, 'safeNotifyMany');

const prisma = require('../../src/config/database');
const app = require('../../src/app');

describe('Task 2: Defense Schedule Notification Types & Active Member Filtering (P0.15)', () => {
    const adminUser = {
        id: 1,
        code: 'AD0001',
        fullName: 'Admin Quản Trị',
        role: 'ADMIN',
        isActive: true,
        permissions: ['DEFENSE_COUNCIL_MANAGE', 'VIEW_COUNCIL_ASSIGNMENTS'],
        permissionGroups: [
            {
                permissionGroup: {
                    permissions: [
                        { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                        { permission: { code: 'VIEW_COUNCIL_ASSIGNMENTS' } },
                    ],
                },
            },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        jwt.verify.mockImplementation((t) => {
            if (t === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('Invalid token');
        });

        prisma.user.findUnique.mockResolvedValue(adminUser);
        prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([]);
        prisma.academicDelegation.findMany.mockResolvedValue([]);
    });

    describe('1. confirmAndPublishDefenseSchedule notifications', () => {
        test('publishes schedule with DEFENSE_SCHEDULE_PUBLISHED and notifies ONLY active members (excludes isActive=false)', async () => {
            const councilWithMixedMembers = {
                id: 88,
                name: 'Hội đồng Bảo vệ CNTT 01',
                councilType: 'DEFENSE_COUNCIL',
                semesterId: 1,
                location: 'Phòng 402 - Tòa A',
                defenseDate: new Date('2026-12-01T08:00:00Z'),
                assignmentConfirmedAt: new Date('2026-11-18T00:00:00Z'),
                schedulePublishedAt: null,
                semester: {
                    id: 1,
                    lockedDefenseRubricVersionId: 10,
                    lockedDefenseRubricVersion: { id: 10, lockedAt: new Date() },
                    defenseEligibleListPublishedAt: new Date('2026-11-15T00:00:00Z'),
                },
                registrations: [
                    { id: 101, studentId: 1001, student: { id: 1001, fullName: 'Sinh Vien A', code: 'SV01' } },
                    { id: 102, studentId: 1002, student: { id: 1002, fullName: 'Sinh Vien B', code: 'SV02' } },
                ],
                members: [
                    { id: 1, lecturerId: 201, userId: 201, roleInCouncil: 'CHAIRMAN', isActive: true },
                    { id: 2, lecturerId: 202, userId: 202, roleInCouncil: 'SECRETARY', isActive: true },
                    { id: 3, lecturerId: 203, userId: 203, roleInCouncil: 'REVIEWER', isActive: true },
                    // Inactive member: previously replaced, MUST NOT receive notifications
                    { id: 4, lecturerId: 204, userId: 204, roleInCouncil: 'REVIEWER', isActive: false },
                ],
            };

            prisma.council.findUnique.mockResolvedValue(councilWithMixedMembers);
            prisma.council.update.mockResolvedValue({
                ...councilWithMixedMembers,
                schedulePublishedAt: new Date(),
                scheduleConfirmedAt: new Date(),
            });
            prisma.topicRegistration.update.mockResolvedValue({});

            const res = await request(app)
                .post('/api/councils/88/confirm-and-publish-schedule')
                .set('Authorization', 'Bearer admin-token')
                .send({ orderedRegistrationIds: [101, 102] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify safeNotifyMany calls
            expect(notificationService.safeNotifyMany).toHaveBeenCalled();

            // Check calls: should notify students and active members
            const allNotifications = notificationService.safeNotifyMany.mock.calls.flatMap(
                ([notifications]) => notifications
            );

            // Students (1001, 1002)
            const studentNotifs = allNotifications.filter((n) => [1001, 1002].includes(n.userId));
            expect(studentNotifs).toHaveLength(2);
            studentNotifs.forEach((n) => {
                expect(n.type).toBe('DEFENSE_SCHEDULE_PUBLISHED');
            });

            // Active members (201, 202, 203)
            const activeMemberNotifs = allNotifications.filter((n) => [201, 202, 203].includes(n.userId));
            expect(activeMemberNotifs).toHaveLength(3);
            activeMemberNotifs.forEach((n) => {
                expect(n.type).toBe('DEFENSE_SCHEDULE_PUBLISHED');
            });

            // Inactive member (204) MUST NOT be notified
            const inactiveMemberNotifs = allNotifications.filter((n) => n.userId === 204);
            expect(inactiveMemberNotifs).toHaveLength(0);
        });
    });

    describe('2. adjustStudentDefenseSchedule notifications and validation', () => {
        test('rejects adjustment when reason is missing or whitespace', async () => {
            const res = await request(app)
                .patch('/api/councils/88/registrations/101/schedule')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    newShift: 'AFTERNOON',
                    newOrderInShift: 3,
                    reason: '   ',
                });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            const errDetail = JSON.stringify(res.body);
            expect(errDetail).toMatch(/reason|Lý do điều chỉnh/i);
            expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
            expect(prisma.defenseScheduleAdjustmentLog.create).not.toHaveBeenCalled();
        });

        test('adjusts schedule, saves log, and notifies student + active members with DEFENSE_SCHEDULE_ADJUSTED', async () => {
            const councilWithMixedMembers = {
                id: 88,
                name: 'Hội đồng Bảo vệ CNTT 01',
                members: [
                    { id: 1, lecturerId: 201, userId: 201, isActive: true },
                    { id: 2, lecturerId: 202, userId: 202, isActive: true },
                    { id: 3, lecturerId: 203, userId: 203, isActive: true },
                    // Replaced inactive member
                    { id: 4, lecturerId: 204, userId: 204, isActive: false },
                ],
            };

            const registration = {
                id: 101,
                studentId: 1001,
                councilId: 88,
                defenseSessionShift: 'MORNING',
                defenseOrderInShift: 2,
                student: { fullName: 'Sinh Vien A', code: 'SV01' },
                topic: { title: 'Đề tài Nghiên cứu AI' },
            };

            prisma.council.findUnique.mockResolvedValue(councilWithMixedMembers);
            prisma.topicRegistration.findUnique.mockResolvedValue(registration);
            prisma.topicRegistration.update.mockResolvedValue({
                ...registration,
                defenseSessionShift: 'AFTERNOON',
                defenseOrderInShift: 1,
            });

            const res = await request(app)
                .patch('/api/councils/88/registrations/101/schedule')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    newShift: 'AFTERNOON',
                    newOrderInShift: 1,
                    reason: 'Sinh viên có lịch công tác buổi sáng',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // 1. Check log creation
            expect(prisma.defenseScheduleAdjustmentLog.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        councilId: 88,
                        registrationId: 101,
                        oldShift: 'MORNING',
                        newShift: 'AFTERNOON',
                        oldOrderInShift: 2,
                        newOrderInShift: 1,
                        reason: 'Sinh viên có lịch công tác buổi sáng',
                    }),
                })
            );

            // 2. Check student notification with DEFENSE_SCHEDULE_ADJUSTED
            expect(prisma.notification.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 1001,
                        type: 'DEFENSE_SCHEDULE_ADJUSTED',
                    }),
                })
            );

            // 3. Check active council members notification with DEFENSE_SCHEDULE_ADJUSTED
            expect(notificationService.safeNotifyMany).toHaveBeenCalled();
            const memberCalls = notificationService.safeNotifyMany.mock.calls.flatMap(
                ([notifications]) => notifications
            );

            const activeMemberNotifs = memberCalls.filter((n) => [201, 202, 203].includes(n.userId));
            expect(activeMemberNotifs).toHaveLength(3);
            activeMemberNotifs.forEach((n) => {
                expect(n.type).toBe('DEFENSE_SCHEDULE_ADJUSTED');
            });

            // Inactive member (204) MUST NOT receive notification
            const inactiveNotifs = memberCalls.filter((n) => n.userId === 204);
            expect(inactiveNotifs).toHaveLength(0);
        });
    });
});
