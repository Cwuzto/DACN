jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    topicRegistration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
    },
    topic: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
    },
    studentProjectEnrollment: {
        findFirst: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
    },
    notification: {
        create: jest.fn(),
    },
    task: {
        groupBy: jest.fn(),
    },
    periodWorkflowPolicyVersion: {
        findMany: jest.fn(),
    },
    academicDelegation: {
        findMany: jest.fn().mockResolvedValue([]),
    },
}));

jest.mock('../../src/constants/mentorCapacity', () => ({
    getMentorMaxSlots: jest.fn(),
    assertMentorCapacity: jest.fn().mockResolvedValue(true),
    countActiveOccupiedMentoredTopics: jest.fn().mockResolvedValue(0),
}));
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../src/config/database');
const { getMentorMaxSlots } = require('../../src/constants/mentorCapacity');
const {
    registerTopic,
    handleRegistration,
    getAllRegistrations,
    getRegistrationById,
} = require('../../src/controllers/registrationController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

describe('registrationController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.$transaction.mockImplementation(async (callback) => callback(prisma));
        if (prisma.task?.groupBy) {
            prisma.task.groupBy.mockResolvedValue([]);
        }
        if (prisma.periodWorkflowPolicyVersion?.findMany) {
            prisma.periodWorkflowPolicyVersion.findMany.mockResolvedValue([{ id: 1, version: 1, isActive: true }]);
        }
    });

    test('registerTopic creates registration successfully', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: true,
        });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topic.findUnique.mockResolvedValue({
            id: 100,
            title: 'Do an AI',
            semesterId: 9,
            mentorId: 77,
            projectCatalogId: 1,
            status: 'APPROVED',
            maxStudents: 1,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 1, name: 'Do an tot nghiep' },
            _count: { registrations: 0 },
        });
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue({ id: 7001 });
        getMentorMaxSlots.mockReturnValue(15);
        prisma.topicRegistration.count.mockResolvedValue(3);
        prisma.topicRegistration.create.mockResolvedValue({
            id: 501,
            topicId: 100,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
        });

        const req = createMockReq({
            user: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            body: { topicId: 100, semesterId: 9 },
        });
        const res = createMockRes();
        const next = createNext();

        await registerTopic(req, res, next);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.topicRegistration.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    topicId: 100,
                    studentId: 5,
                    semesterId: 9,
                    status: 'PENDING',
                }),
            })
        );
        expect(prisma.topic.updateMany).toHaveBeenCalledWith({
            where: {
                proposedById: 5,
                semesterId: 9,
                status: 'PENDING',
            },
            data: {
                status: 'CANCELLED',
            },
        });
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });

    test('registerTopic rejects when semester registration is closed', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: false,
        });

        const req = createMockReq({
            user: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            body: { topicId: 100, semesterId: 9 },
        });
        const res = createMockRes();
        const next = createNext();

        await registerTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topicRegistration.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('registerTopic rejects when student account is restricted after completion', async () => {
        prisma.topicRegistration.findFirst.mockResolvedValueOnce({ id: 999 });

        const req = createMockReq({
            user: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            body: { topicId: 100, semesterId: 9 },
        });
        const res = createMockRes();
        const next = createNext();

        await registerTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(prisma.semester.findUnique).not.toHaveBeenCalled();
        expect(prisma.topicRegistration.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('registerTopic rejects when student has no matching project enrollment', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: true,
        });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topic.findUnique.mockResolvedValue({
            id: 100,
            title: 'Do an AI',
            semesterId: 9,
            mentorId: 77,
            projectCatalogId: 2,
            status: 'APPROVED',
            maxStudents: 1,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 2, name: 'Do an B' },
            _count: { registrations: 0 },
        });
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue(null);

        const req = createMockReq({
            user: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            body: { topicId: 100, semesterId: 9 },
        });
        const res = createMockRes();
        const next = createNext();

        await registerTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topicRegistration.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('registerTopic rejects when enrollment exists but in different semester', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 9,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            registrationDeadline: new Date('2099-12-31T23:59:59.000Z'),
            registrationOpen: true,
        });
        prisma.topicRegistration.findUnique.mockResolvedValue(null);
        prisma.topic.findUnique.mockResolvedValue({
            id: 100,
            title: 'Do an AI',
            semesterId: 9,
            mentorId: 77,
            projectCatalogId: 2,
            status: 'APPROVED',
            maxStudents: 1,
            mentor: { id: 77, academicTitle: 'TIEN_SI' },
            projectCatalog: { id: 2, name: 'Do an B' },
            _count: { registrations: 0 },
        });
        prisma.studentProjectEnrollment.findFirst.mockResolvedValue(null);

        const req = createMockReq({
            user: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
            body: { topicId: 100, semesterId: 9 },
        });
        const res = createMockRes();
        const next = createNext();

        await registerTopic(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topicRegistration.create).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('handleRegistration approves a pending registration', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 88,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
            topic: {
                id: 100,
                title: 'Do an AI',
                mentorId: 77,
                mentor: { id: 77, academicTitle: 'TIEN_SI' },
            },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
        });
        getMentorMaxSlots.mockReturnValue(15);
        prisma.topicRegistration.count.mockResolvedValue(2);
        prisma.topicRegistration.update.mockResolvedValue({
            id: 88,
            status: 'APPROVED',
        });

        const req = createMockReq({
            params: { id: '88' },
            body: { action: 'APPROVE' },
            user: { id: 77, role: 'LECTURER' },
        });
        const res = createMockRes();
        const next = createNext();

        await handleRegistration(req, res, next);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.topicRegistration.update).toHaveBeenCalledWith({
            where: { id: 88 },
            data: { status: 'APPROVED', rejectReason: null },
        });
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
        expect(next).not.toHaveBeenCalled();
    });

    test('handleRegistration rejects when reason is missing', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 90,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
            topic: {
                id: 101,
                title: 'Do an Web',
                mentorId: 77,
                mentor: { id: 77, academicTitle: 'THAC_SI' },
            },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
        });

        const req = createMockReq({
            params: { id: '90' },
            body: { action: 'REJECT' },
            user: { id: 1, role: 'ADMIN' },
        });
        const res = createMockRes();
        const next = createNext();

        await handleRegistration(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.topicRegistration.update).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('handleRegistration rejects with reason successfully', async () => {
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 91,
            studentId: 5,
            semesterId: 9,
            status: 'PENDING',
            topic: {
                id: 102,
                title: 'Do an Cloud',
                mentorId: 77,
                mentor: { id: 77, academicTitle: 'THAC_SI' },
            },
            student: { id: 5, fullName: 'Nguyen Van A', code: 'SV005' },
        });
        prisma.topicRegistration.update.mockResolvedValue({
            id: 91,
            status: 'REJECTED',
        });

        const req = createMockReq({
            params: { id: '91' },
            body: { action: 'REJECT', rejectReason: 'De tai khong phu hop' },
            user: { id: 1, role: 'ADMIN' },
        });
        const res = createMockRes();
        const next = createNext();

        await handleRegistration(req, res, next);

        expect(prisma.topicRegistration.update).toHaveBeenCalledWith({
            where: { id: 91 },
            data: { status: 'REJECTED', rejectReason: 'De tai khong phu hop' },
        });
        expect(prisma.notification.create).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
        expect(next).not.toHaveBeenCalled();
    });

    describe('getAllRegistrations', () => {
        it('filters by mentorId when called by a regular lecturer', async () => {
            prisma.topicRegistration.findMany.mockResolvedValueOnce([
                { id: 1, topicId: 10, status: 'BM02_SUBMITTED' }
            ]);

            const req = createMockReq({
                query: { semesterId: '2' },
                user: { id: 135, role: 'LECTURER', permissions: ['VIEW_MENTORED_STUDENTS'], permissionGroups: ['GVHD'] },
            });
            const res = createMockRes();
            const next = createNext();

            await getAllRegistrations(req, res, next);

            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        topic: { mentorId: 135 },
                        semesterId: 2,
                    }),
                })
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.any(Array),
                })
            );
        });

        it('does NOT filter by mentorId when called with asInstituteDirector=true by Viện Trưởng', async () => {
            prisma.topicRegistration.findMany.mockResolvedValueOnce([
                { id: 1, topicId: 10, status: 'BM02_SUBMITTED' },
                { id: 2, topicId: 11, status: 'BM02_SUBMITTED' },
            ]);

            const req = createMockReq({
                query: { asInstituteDirector: 'true' },
                user: {
                    id: 135,
                    role: 'LECTURER',
                    permissions: ['VIEW_BM02_REVIEWS', 'BM02_REVIEW'],
                    permissionGroups: ['VIEN_TRUONG', 'GVHD'],
                },
            });
            const res = createMockRes();
            const next = createNext();

            await getAllRegistrations(req, res, next);

            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({
                        topic: { mentorId: 135 },
                    }),
                })
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.arrayContaining([
                        expect.objectContaining({ id: 1 }),
                        expect.objectContaining({ id: 2 }),
                    ]),
                })
            );
        });

        it('computes totalMeetings and _count properly from bm03MeetingEntries and meetingLogs', async () => {
            const meetingDate1 = new Date('2026-10-01T08:00:00Z');
            const meetingDate2 = new Date('2026-10-15T08:00:00Z');

            prisma.topicRegistration.findMany.mockResolvedValueOnce([
                {
                    id: 10,
                    topicId: 100,
                    status: 'IN_PROGRESS_BM03',
                    createdAt: new Date('2026-09-01'),
                    tasks: [],
                    meetingLogs: [],
                    bm03MeetingEntries: [
                        { id: 201, meetingDate: meetingDate1 },
                        { id: 202, meetingDate: meetingDate2 },
                    ],
                    _count: {
                        submissions: 0,
                        meetingLogs: 0,
                        bm03MeetingEntries: 2,
                    },
                },
            ]);

            const req = createMockReq({
                query: { semesterId: '2' },
                user: { id: 135, role: 'LECTURER', permissions: ['VIEW_MENTORED_STUDENTS'], permissionGroups: ['GVHD'] },
            });
            const res = createMockRes();
            const next = createNext();

            await getAllRegistrations(req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: [
                        expect.objectContaining({
                            id: 10,
                            totalMeetings: 2,
                            lastMeetingDate: meetingDate2,
                            _count: expect.objectContaining({
                                bm03MeetingEntries: 2,
                                meetingLogs: 0,
                            }),
                        }),
                    ],
                })
            );
        });
    });

    describe('getRegistrationById', () => {
        const makeRegistrationFixture = (overrides = {}) => ({
            id: 42,
            studentId: 5,
            semesterId: 9,
            status: 'DEFENDED',
            stateVersion: 1,
            student: {
                id: 5,
                fullName: 'Nguyen Van A',
                code: 'SV005',
                email: 'sv005@example.com',
                phone: '0901234567',
                department: 'CNTT',
                studentProfile: {
                    studentId: 5,
                    gender: 'MALE',
                    dateOfBirth: new Date('2004-05-10'),
                    className: 'CNTT-K63',
                    major: 'CNTT',
                    academicYear: '2022-2026',
                    placeOfBirth: 'Ha Noi',
                },
            },
            topic: {
                id: 100,
                title: 'He thong quan ly do an',
                description: 'Mo ta',
                mentorId: 77,
                semesterId: 9,
                projectCatalog: { id: 1, code: 'DATN', name: 'Do an tot nghiep' },
                mentor: {
                    id: 77,
                    fullName: 'TS. Tran Van B',
                    code: 'GV077',
                    email: 'gv077@example.com',
                    department: 'CNTT',
                    academicTitle: 'TIEN_SI',
                },
            },
            outlineCouncil: { id: 11, members: [] },
            defenseCouncil: { id: 12, members: [] },
            defenseResult: {
                id: 99,
                finalScore: 8.75,
                rawAverageScore: 8.75,
                roundedFinalScore: 8.8,
                comments: 'Nhan xet hoi dong mat',
                isPublished: false,
            },
            memberScores: [
                { id: 1, evaluatorId: 88, finalScore: 8.5, comments: 'Diem thanh vien' },
            ],
            resultPublicationItems: [],
            ...overrides,
        });

        it('returns 404 when registration does not exist', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(null);

            const req = createMockReq({
                params: { id: '9999' },
                user: { id: 77, role: 'LECTURER', permissions: ['VIEW_MENTORED_STUDENTS'], permissionGroups: ['GVHD'] },
            });
            const res = createMockRes();
            const next = createNext();

            await getRegistrationById(req, res, next);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false })
            );
        });

        it('returns 200 for owning GVHD and uses safe studentProfile include', async () => {
            const fixture = makeRegistrationFixture({ defenseResult: null, memberScores: undefined });
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(fixture);

            const req = createMockReq({
                params: { id: '42' },
                user: { id: 77, role: 'LECTURER', permissions: ['VIEW_MENTORED_STUDENTS'], permissionGroups: ['GVHD'] },
            });
            const res = createMockRes();
            const next = createNext();

            await getRegistrationById(req, res, next);

            expect(prisma.topicRegistration.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 42 },
                    include: expect.objectContaining({
                        student: expect.objectContaining({
                            select: expect.objectContaining({
                                studentProfile: true,
                            }),
                        }),
                    }),
                })
            );
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    data: expect.objectContaining({
                        id: 42,
                        student: expect.objectContaining({
                            studentProfile: expect.objectContaining({
                                className: 'CNTT-K63',
                                academicYear: '2022-2026',
                                placeOfBirth: 'Ha Noi',
                            }),
                        }),
                    }),
                })
            );
        });

        it('returns 403 for another GVHD even when actor has VIEW_MENTORED_STUDENTS', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(makeRegistrationFixture());

            const req = createMockReq({
                params: { id: '42' },
                user: {
                    id: 88,
                    role: 'LECTURER',
                    department: 'CNTT',
                    basePermissions: ['VIEW_MENTORED_STUDENTS', 'BM03_REVIEW'],
                    permissions: ['VIEW_MENTORED_STUDENTS', 'BM03_REVIEW'],
                    permissionGroups: ['GVHD'],
                    activeDelegations: [],
                },
            });
            const res = createMockRes();
            const next = createNext();

            await getRegistrationById(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false })
            );
        });

        it('returns 403 for another student', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(makeRegistrationFixture());

            const req = createMockReq({
                params: { id: '42' },
                user: {
                    id: 6,
                    role: 'STUDENT',
                    basePermissions: ['VIEW_MY_REGISTRATION'],
                    permissions: ['VIEW_MY_REGISTRATION'],
                    permissionGroups: ['SYSTEM_STUDENT_BASE'],
                },
            });
            const res = createMockRes();
            const next = createNext();

            await getRegistrationById(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: false })
            );
        });

        it('allows scoped oversight/delegated actor within scope and rejects out-of-scope with 403', async () => {
            // In-scope department delegation for VIEW_PROJECT_OVERSIGHT
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(makeRegistrationFixture());
            const inScopeReq = createMockReq({
                params: { id: '42' },
                user: {
                    id: 201,
                    role: 'LECTURER',
                    department: 'CNTT',
                    basePermissions: ['VIEW_MENTORED_STUDENTS'],
                    permissions: ['VIEW_MENTORED_STUDENTS', 'VIEW_PROJECT_OVERSIGHT'],
                    permissionGroups: ['GVHD'],
                    activeDelegations: [
                        {
                            capabilityCode: 'VIEW_PROJECT_OVERSIGHT',
                            department: 'CNTT',
                            semesterId: 9,
                            status: 'ACTIVE',
                        },
                    ],
                },
            });
            const inScopeRes = createMockRes();
            await getRegistrationById(inScopeReq, inScopeRes, createNext());
            expect(inScopeRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );

            // Out-of-scope department delegation (ATTT vs CNTT) -> 403
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(makeRegistrationFixture());
            const outScopeReq = createMockReq({
                params: { id: '42' },
                user: {
                    id: 202,
                    role: 'LECTURER',
                    department: 'ATTT',
                    basePermissions: ['VIEW_MENTORED_STUDENTS'],
                    permissions: ['VIEW_MENTORED_STUDENTS', 'VIEW_PROJECT_OVERSIGHT'],
                    permissionGroups: ['GVHD'],
                    activeDelegations: [
                        {
                            capabilityCode: 'VIEW_PROJECT_OVERSIGHT',
                            department: 'ATTT',
                            semesterId: 9,
                            status: 'ACTIVE',
                        },
                    ],
                },
            });
            const outScopeRes = createMockRes();
            await getRegistrationById(outScopeReq, outScopeRes, createNext());
            expect(outScopeRes.status).toHaveBeenCalledWith(403);
        });

        it('redacts unpublished BM05 defenseResult, memberScores, finalScore, and comments', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(makeRegistrationFixture());

            const req = createMockReq({
                params: { id: '42' },
                user: {
                    id: 77,
                    role: 'LECTURER',
                    basePermissions: ['VIEW_MENTORED_STUDENTS'],
                    permissions: ['VIEW_MENTORED_STUDENTS'],
                    permissionGroups: ['GVHD'],
                },
            });
            const res = createMockRes();
            await getRegistrationById(req, res, createNext());

            expect(res.json).toHaveBeenCalledTimes(1);
            const payload = res.json.mock.calls[0][0];
            expect(payload.success).toBe(true);
            expect(payload.data.defenseResult).toBeNull();
            expect(payload.data.memberScores).toBeUndefined();
            const serialized = JSON.stringify(payload.data);
            expect(serialized).not.toContain('8.75');
            expect(serialized).not.toContain('Nhan xet hoi dong mat');
            expect(serialized).not.toContain('Diem thanh vien');
        });

        it('includes published BM05 defenseResult for authorized actor', async () => {
            prisma.topicRegistration.findUnique.mockResolvedValueOnce(
                makeRegistrationFixture({
                    defenseResult: {
                        id: 99,
                        finalScore: 8.75,
                        rawAverageScore: 8.75,
                        roundedFinalScore: 8.8,
                        comments: 'Bao ve tot',
                        isPublished: true,
                    },
                })
            );

            const req = createMockReq({
                params: { id: '42' },
                user: {
                    id: 77,
                    role: 'LECTURER',
                    basePermissions: ['VIEW_MENTORED_STUDENTS'],
                    permissions: ['VIEW_MENTORED_STUDENTS'],
                    permissionGroups: ['GVHD'],
                },
            });
            const res = createMockRes();
            await getRegistrationById(req, res, createNext());

            const payload = res.json.mock.calls[0][0];
            expect(payload.success).toBe(true);
            expect(payload.data.defenseResult).toEqual(
                expect.objectContaining({
                    id: 99,
                    finalScore: 8.75,
                    comments: 'Bao ve tot',
                    isPublished: true,
                })
            );
        });
    });
});
