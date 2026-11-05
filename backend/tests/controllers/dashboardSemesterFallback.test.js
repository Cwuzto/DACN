jest.mock('../../src/config/database', () => ({
    topicRegistration: {
        findFirst: jest.fn(),
        count: jest.fn(),
    },
    topic: {
        findFirst: jest.fn(),
        count: jest.fn(),
    },
    submission: {
        findMany: jest.fn(),
    },
    task: {
        findMany: jest.fn(),
    },
    semester: {
        findFirst: jest.fn(),
    },
}));

jest.mock('../../src/utils/semesterResolver', () => ({
    getDefaultSemester: jest.fn(),
}));

const prisma = require('../../src/config/database');
const { getDefaultSemester } = require('../../src/utils/semesterResolver');
const dashboardController = require('../../src/controllers/dashboardController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('Dashboard Controller - User-Scoped Semester Fallback', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('getStudentDashboard fallback', () => {
        const semester1 = {
            id: 1,
            name: 'Học kỳ 1 2025-2026',
            status: 'ONGOING',
            startDate: new Date('2025-09-01T00:00:00.000Z'),
            registrationDeadline: new Date('2025-09-30T00:00:00.000Z'),
            endDate: new Date('2026-01-31T00:00:00.000Z'),
        };

        const semester2 = {
            id: 2,
            name: 'Học kỳ 2 2025-2026',
            status: 'REGISTRATION',
            startDate: new Date('2026-02-01T00:00:00.000Z'),
            registrationDeadline: new Date('2026-02-28T00:00:00.000Z'),
            endDate: new Date('2026-06-30T00:00:00.000Z'),
        };

        test('falls back to active semester where student is registered when default semester has no registration', async () => {
            getDefaultSemester.mockResolvedValue(semester2);

            // First call for semester2 returns null
            prisma.topicRegistration.findFirst.mockResolvedValueOnce(null);

            // Second call (fallback query) returns registration in semester1
            const mockRegistration = {
                id: 101,
                status: 'IN_PROGRESS',
                decisionNumber: 'QD-01',
                decisionDate: new Date('2025-10-01'),
                adjustedTitle: null,
                semester: semester1,
                student: { id: 10, fullName: 'Nguyen Van A', code: 'SV010' },
                topic: {
                    id: 5,
                    title: 'Hệ thống Quản lý Đồ án',
                    mentor: { fullName: 'TS. Tran Van B' },
                },
                tasks: [
                    {
                        id: 1,
                        title: 'Nộp báo cáo tuần 1',
                        status: 'COMPLETED',
                        dueDate: new Date(Date.now() + 86400000),
                        content: 'Nộp báo cáo tiến độ',
                        submissions: [{ id: 1, submittedBy: 10 }],
                    },
                ],
                defenseResult: null,
            };
            prisma.topicRegistration.findFirst.mockResolvedValueOnce(mockRegistration);

            const req = createMockReq({ user: { id: 10 } });
            const res = createMockRes();
            const next = createNext();

            await dashboardController.getStudentDashboard(req, res, next);

            expect(prisma.topicRegistration.findFirst).toHaveBeenCalledTimes(2);

            // First check: default semester
            expect(prisma.topicRegistration.findFirst).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    where: expect.objectContaining({
                        studentId: 10,
                        semesterId: semester2.id,
                        status: { not: 'REJECTED' },
                    }),
                })
            );

            // Second check: fallback to any active semester
            expect(prisma.topicRegistration.findFirst).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: expect.objectContaining({
                        studentId: 10,
                        semester: { status: { in: ['REGISTRATION', 'ONGOING', 'DEFENSE'] } },
                        status: { not: 'REJECTED' },
                    }),
                })
            );

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        hasRegistration: true,
                        activeSemester: expect.objectContaining({ id: semester1.id, name: semester1.name }),
                        registrationDetails: expect.objectContaining({
                            registrationId: 101,
                            status: 'IN_PROGRESS',
                            topic: expect.objectContaining({
                                title: 'Hệ thống Quản lý Đồ án',
                                mentorName: 'TS. Tran Van B',
                            }),
                        }),
                        taskStatus: expect.objectContaining({
                            total: 1,
                            completed: 1,
                        }),
                    }),
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('returns registration directly from default semester without fallback query', async () => {
            getDefaultSemester.mockResolvedValue(semester2);

            const mockRegistration = {
                id: 102,
                status: 'APPROVED',
                decisionNumber: null,
                decisionDate: null,
                adjustedTitle: null,
                student: { id: 10, fullName: 'Nguyen Van A', code: 'SV010' },
                topic: {
                    id: 6,
                    title: 'Xây dựng Ứng dụng AI',
                    mentor: { fullName: 'TS. Tran Van B' },
                },
                tasks: [],
                defenseResult: null,
            };
            prisma.topicRegistration.findFirst.mockResolvedValueOnce(mockRegistration);

            const req = createMockReq({ user: { id: 10 } });
            const res = createMockRes();
            const next = createNext();

            await dashboardController.getStudentDashboard(req, res, next);

            expect(prisma.topicRegistration.findFirst).toHaveBeenCalledTimes(1);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        hasRegistration: true,
                        activeSemester: expect.objectContaining({ id: semester2.id }),
                        registrationDetails: expect.objectContaining({
                            registrationId: 102,
                        }),
                    }),
                })
            );
        });

        test('returns hasRegistration: false when student has no registration in any active semester', async () => {
            getDefaultSemester.mockResolvedValue(semester2);

            // Default semester check returns null
            prisma.topicRegistration.findFirst.mockResolvedValueOnce(null);
            // Fallback check returns null
            prisma.topicRegistration.findFirst.mockResolvedValueOnce(null);

            const req = createMockReq({ user: { id: 10 } });
            const res = createMockRes();
            const next = createNext();

            await dashboardController.getStudentDashboard(req, res, next);

            expect(prisma.topicRegistration.findFirst).toHaveBeenCalledTimes(2);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        hasRegistration: false,
                        activeSemester: expect.objectContaining({ id: semester2.id }),
                        registrationDetails: null,
                    }),
                })
            );
        });
    });

    describe('getLecturerDashboard fallback', () => {
        const semester1 = {
            id: 1,
            name: 'Học kỳ 1 2025-2026',
            status: 'ONGOING',
            startDate: new Date('2025-09-01T00:00:00.000Z'),
            registrationDeadline: new Date('2025-09-30T00:00:00.000Z'),
            endDate: new Date('2026-01-31T00:00:00.000Z'),
        };

        const semester2 = {
            id: 2,
            name: 'Học kỳ 2 2025-2026',
            status: 'REGISTRATION',
            startDate: new Date('2026-02-01T00:00:00.000Z'),
            registrationDeadline: new Date('2026-02-28T00:00:00.000Z'),
            endDate: new Date('2026-06-30T00:00:00.000Z'),
        };

        test('falls back to active semester where lecturer has registrations when default semester has 0 topics and 0 registrations', async () => {
            getDefaultSemester.mockResolvedValue(semester2);

            // Semester 2 stats: 0 topics, 0 registrations, 0 completed, 0 submissions, 0 tasks, 0 stale
            prisma.topic.count.mockResolvedValueOnce(0);
            prisma.topicRegistration.count
                .mockResolvedValueOnce(0) // activeRegistrations
                .mockResolvedValueOnce(0) // completedRegistrations
                .mockResolvedValueOnce(0); // stalePendingRegistrations
            prisma.submission.findMany.mockResolvedValueOnce([]);
            prisma.task.findMany.mockResolvedValueOnce([]);

            // Fallback find: lecturer has registration in semester 1
            prisma.topicRegistration.findFirst.mockResolvedValueOnce({
                id: 201,
                semesterId: 1,
                semester: semester1,
            });

            // Semester 1 stats: 4 topics, 3 registrations, 1 completed, etc.
            prisma.topic.count.mockResolvedValueOnce(4);
            prisma.topicRegistration.count
                .mockResolvedValueOnce(3) // activeRegistrations
                .mockResolvedValueOnce(1) // completedRegistrations
                .mockResolvedValueOnce(0); // stalePendingRegistrations
            prisma.submission.findMany.mockResolvedValueOnce([]);
            prisma.task.findMany.mockResolvedValueOnce([]);

            const req = createMockReq({ user: { id: 20 } });
            const res = createMockRes();
            const next = createNext();

            await dashboardController.getLecturerDashboard(req, res, next);

            expect(prisma.topicRegistration.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        topic: { mentorId: 20 },
                        semester: { status: { in: ['REGISTRATION', 'ONGOING', 'DEFENSE'] } },
                        status: { not: 'REJECTED' },
                    }),
                })
            );

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        activeSemester: expect.objectContaining({ id: semester1.id, name: semester1.name }),
                        stats: expect.objectContaining({
                            activeTopics: 4,
                            studentGroups: 3,
                            completedRegistrations: 1,
                        }),
                    }),
                })
            );
            expect(next).not.toHaveBeenCalled();
        });

        test('falls back to active semester via topics when lecturer has topics but 0 registrations in another semester', async () => {
            getDefaultSemester.mockResolvedValue(semester2);

            // Semester 2: 0 topics, 0 registrations
            prisma.topic.count.mockResolvedValueOnce(0);
            prisma.topicRegistration.count
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0);
            prisma.submission.findMany.mockResolvedValueOnce([]);
            prisma.task.findMany.mockResolvedValueOnce([]);

            // Fallback registration check returns null
            prisma.topicRegistration.findFirst.mockResolvedValueOnce(null);

            // Fallback topic check finds topic in semester 1
            prisma.topic.findFirst.mockResolvedValueOnce({
                id: 15,
                mentorId: 20,
                semesterId: 1,
                semester: semester1,
            });

            // Semester 1 stats: 2 topics, 0 registrations
            prisma.topic.count.mockResolvedValueOnce(2);
            prisma.topicRegistration.count
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0);
            prisma.submission.findMany.mockResolvedValueOnce([]);
            prisma.task.findMany.mockResolvedValueOnce([]);

            const req = createMockReq({ user: { id: 20 } });
            const res = createMockRes();
            const next = createNext();

            await dashboardController.getLecturerDashboard(req, res, next);

            expect(prisma.topic.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        mentorId: 20,
                        semester: { status: { in: ['REGISTRATION', 'ONGOING', 'DEFENSE'] } },
                        status: { not: 'REJECTED' },
                    }),
                })
            );

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        activeSemester: expect.objectContaining({ id: semester1.id }),
                        stats: expect.objectContaining({
                            activeTopics: 2,
                            studentGroups: 0,
                        }),
                    }),
                })
            );
        });

        test('does not fall back if lecturer already has topics in default semester', async () => {
            getDefaultSemester.mockResolvedValue(semester2);

            // Semester 2: 2 topics, 0 registrations
            prisma.topic.count.mockResolvedValueOnce(2);
            prisma.topicRegistration.count
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0)
                .mockResolvedValueOnce(0);
            prisma.submission.findMany.mockResolvedValueOnce([]);
            prisma.task.findMany.mockResolvedValueOnce([]);

            const req = createMockReq({ user: { id: 20 } });
            const res = createMockRes();
            const next = createNext();

            await dashboardController.getLecturerDashboard(req, res, next);

            // Fallback queries should not be called
            expect(prisma.topicRegistration.findFirst).not.toHaveBeenCalled();
            expect(prisma.topic.findFirst).not.toHaveBeenCalled();

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        activeSemester: expect.objectContaining({ id: semester2.id }),
                        stats: expect.objectContaining({
                            activeTopics: 2,
                            studentGroups: 0,
                        }),
                    }),
                })
            );
        });
    });
});
