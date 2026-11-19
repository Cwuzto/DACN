jest.mock('../../src/config/database', () => ({
    user: { findUnique: jest.fn() },
    semester: { findFirst: jest.fn(), findUnique: jest.fn() },
    topic: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
    topicRegistration: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
    },
    submission: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    task: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    topicTitleAdjustment: { findMany: jest.fn().mockResolvedValue([]) },
    council: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findMany: jest.fn().mockResolvedValue([]) },
    academicDelegation: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
}));

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const request = require('supertest');
const prisma = require('../../src/config/database');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');

describe('Integration - Lecturer Unified Overview Authorization', () => {
    const activeSemester = {
        id: 10,
        name: 'HK1 2026-2027',
        status: 'ONGOING',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        registrationDeadline: new Date('2026-09-15T00:00:00.000Z'),
        outlineSubmissionDeadline: new Date('2026-11-25T10:00:00.000Z'),
        endDate: new Date('2027-01-15T00:00:00.000Z'),
    };

    const gvhdUser = {
        id: 77,
        email: 'gvhd@tdmu.edu.vn',
        fullName: 'GVHD Thường',
        code: 'GV077',
        role: 'LECTURER',
        department: 'CNTT',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            { permissionGroup: { code: 'GVHD', permissions: [{ permission: { code: 'REPORT_VIEW' } }, { permission: { code: 'VIEW_MY_TOPICS' } }] } },
        ],
        councilMembers: [],
    };

    const directorUser = {
        id: 88,
        email: 'vientruong@tdmu.edu.vn',
        fullName: 'TS. Viện Trưởng',
        code: 'VT088',
        role: 'LECTURER',
        department: 'CNTT',
        isActive: true,
        permissionVersion: 1,
        permissionGroups: [
            {
                permissionGroup: {
                    code: 'VIEN_TRUONG',
                    permissions: [
                        { permission: { code: 'VIEW_MY_TOPICS' } },
                        { permission: { code: 'REPORT_VIEW' } },
                        { permission: { code: 'BM02_REVIEW' } },
                        { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                        { permission: { code: 'DEFENSE_RESULT_APPROVE' } },
                    ],
                },
            },
        ],
        councilMembers: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'integration-secret';
        prisma.semester.findFirst.mockResolvedValue(activeSemester);
        prisma.semester.findUnique.mockResolvedValue(activeSemester);
        prisma.topic.count.mockResolvedValue(0);
        prisma.topicRegistration.count.mockResolvedValue(0);
        prisma.topicRegistration.findMany.mockResolvedValue([]);
        prisma.submission.count.mockResolvedValue(0);
        prisma.submission.findMany.mockResolvedValue([]);
        prisma.task.count.mockResolvedValue(0);
        prisma.task.findMany.mockResolvedValue([]);
        prisma.topicTitleAdjustment.findMany.mockResolvedValue([]);
        prisma.council.findMany.mockResolvedValue([]);
        prisma.notification.findMany.mockResolvedValue([]);
        prisma.academicDelegation.findMany.mockResolvedValue([]);
        prisma.academicDelegation.findFirst.mockResolvedValue(null);

        jwt.verify.mockImplementation((token) => {
            if (token === 'gvhd-token') return { userId: 77, role: 'LECTURER' };
            if (token === 'director-token') return { userId: 88, role: 'LECTURER' };
            throw new Error('invalid token');
        });
    });

    test('GVHD never receives INSTITUTE_DIRECTOR items even when institutional records exist', async () => {
        prisma.user.findUnique.mockResolvedValue(gvhdUser);

        const res = await request(app)
            .get('/api/dashboard/lecturer')
            .set('Authorization', 'Bearer gvhd-token');

        expect(res.status).toBe(200);
        expect(res.body.data.attentionItems.filter((i) => i.source === 'INSTITUTE_DIRECTOR')).toHaveLength(0);
    });

    test('Institute Director with zero supervised students sees empty students list and scoped institute items only', async () => {
        prisma.user.findUnique.mockResolvedValue(directorUser);

        // 1st findMany: fetchLecturerDashboardData? No, buildMentorOverview -> [], then BM02 -> [reg 201], then AWAITING_FINAL_APPROVAL -> []
        prisma.topicRegistration.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 201,
                    semesterId: 10,
                    status: 'BM02_SUBMITTED',
                    updatedAt: new Date('2026-11-16T10:00:00.000Z'),
                    student: { fullName: 'SV CNTT', code: 'SV201' },
                    topic: { title: 'Đề tài CNTT', mentor: { department: 'CNTT' }, proposedBy: { department: 'CNTT' } },
                },
            ])
            .mockResolvedValueOnce([]);
        prisma.topicRegistration.findUnique.mockResolvedValue({
            id: 201,
            topic: { mentor: { department: 'CNTT' }, proposedBy: { department: 'CNTT' } },
        });

        const res = await request(app)
            .get('/api/dashboard/lecturer')
            .set('Authorization', 'Bearer director-token');

        expect(res.status).toBe(200);
        expect(res.body.data.students).toEqual([]);
        expect(res.body.data.mentorSummary.supervisedCount).toBe(0);
        expect(res.body.data.attentionItems.some((i) => i.source === 'INSTITUTE_DIRECTOR' && i.registrationId === 201)).toBe(true);
    });

    test('Revoking director permissions removes INSTITUTE_DIRECTOR items immediately', async () => {
        prisma.user.findUnique.mockResolvedValue({
            ...directorUser,
            permissionGroups: [
                { permissionGroup: { code: 'GVHD', permissions: [{ permission: { code: 'VIEW_MY_TOPICS' } }, { permission: { code: 'REPORT_VIEW' } }] } },
            ],
        });

        const res = await request(app)
            .get('/api/dashboard/lecturer')
            .set('Authorization', 'Bearer director-token');

        expect(res.status).toBe(200);
        expect(res.body.data.attentionItems.filter((i) => i.source === 'INSTITUTE_DIRECTOR')).toHaveLength(0);
    });

    test('GVHD receives watchItems for own APPROVED student without BM01, scoped to mentorId', async () => {
        prisma.user.findUnique.mockResolvedValue(gvhdUser);
        prisma.topicRegistration.findMany.mockResolvedValueOnce([
            {
                id: 301,
                semesterId: 10,
                status: 'APPROVED',
                createdAt: new Date('2026-11-10T08:00:00.000Z'),
                studentId: 3001,
                student: { id: 3001, fullName: 'Nguyễn Minh E', code: 'SV301' },
                topic: { id: 701, title: 'Đề tài GVHD 77', mentorId: 77 },
                tasks: [],
                bm01Evaluations: [],
            },
        ]);
        prisma.notification.findMany.mockResolvedValue([
            {
                id: 91,
                userId: 3001,
                dedupeKey: 'bm01:BEFORE_48H:301:2026-11-25T10:00:00.000Z',
                createdAt: new Date('2026-11-23T10:00:00.000Z'),
            },
        ]);

        const res = await request(app)
            .get('/api/dashboard/lecturer?semesterId=10')
            .set('Authorization', 'Bearer gvhd-token');

        expect(res.status).toBe(200);
        expect(res.body.data.watchItems).toHaveLength(1);
        expect(res.body.data.watchItems[0]).toMatchObject({
            kind: 'BM01_NOT_SUBMITTED',
            registrationId: 301,
            studentId: 3001,
            studentCode: 'SV301',
            target: '/lecturer/students/301',
        });
        expect(res.body.data.watchItems[0].lastReminderAt).toBe('2026-11-23T10:00:00.000Z');
        expect(res.body.data.attentionItems.filter((i) => i.kind === 'BM01_NOT_SUBMITTED')).toHaveLength(0);
    });
});

