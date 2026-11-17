const {
    resolveLecturerSemester,
    buildMentorOverview,
} = require('../../src/services/lecturerOverviewService');

describe('lecturerOverviewService', () => {
    const fixedNow = new Date('2026-11-17T10:00:00.000Z');

    const makeMockDb = () => ({
        semester: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
        },
        topic: {
            count: jest.fn().mockResolvedValue(2),
            findFirst: jest.fn(),
        },
        topicRegistration: {
            count: jest.fn().mockResolvedValue(2),
            findFirst: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
        },
        submission: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
        },
        task: {
            count: jest.fn().mockResolvedValue(0),
            findMany: jest.fn().mockResolvedValue([]),
        },
        topicTitleAdjustment: {
            findMany: jest.fn().mockResolvedValue([]),
        },
    });

    describe('resolveLecturerSemester', () => {
        it('throws 400 when requestedSemesterId has invalid format', async () => {
            const db = makeMockDb();
            await expect(
                resolveLecturerSemester({ actorId: 77, requestedSemesterId: 'abc', db })
            ).rejects.toMatchObject({ statusCode: 400 });

            await expect(
                resolveLecturerSemester({ actorId: 77, requestedSemesterId: '-3', db })
            ).rejects.toMatchObject({ statusCode: 400 });
        });

        it('throws 403 when requested semester is not viewable (e.g. DRAFT)', async () => {
            const db = makeMockDb();
            db.semester.findUnique.mockResolvedValue({
                id: 99,
                name: 'HK Nháp',
                status: 'DRAFT',
            });

            await expect(
                resolveLecturerSemester({ actorId: 77, requestedSemesterId: '99', db })
            ).rejects.toMatchObject({ statusCode: 403 });
        });

        it('returns requested semester when valid and viewable', async () => {
            const db = makeMockDb();
            const sem = { id: 10, name: 'HK1 2026-2027', status: 'ONGOING' };
            db.semester.findUnique.mockResolvedValue(sem);

            const result = await resolveLecturerSemester({
                actorId: 77,
                requestedSemesterId: '10',
                db,
            });
            expect(result).toEqual(sem);
        });
    });

    describe('buildMentorOverview', () => {
        it('filters by mentor & semester, uses real counts for >5 pending submissions, and produces MENTOR attentionItems without fake metrics', async () => {
            const db = makeMockDb();

            const mentorRegsInSem10 = [
                {
                    id: 101,
                    semesterId: 10,
                    status: 'PENDING',
                    createdAt: new Date('2026-11-10T08:00:00.000Z'),
                    studentId: 1001,
                    student: { id: 1001, fullName: 'Nguyễn Văn A', code: 'SV001' },
                    topic: { id: 501, title: 'Đề tài A', mentorId: 77 },
                    tasks: [],
                    bm04Evaluation: null,
                },
                {
                    id: 102,
                    semesterId: 10,
                    status: 'BM01_RESUBMITTED',
                    createdAt: new Date('2026-11-12T08:00:00.000Z'),
                    studentId: 1002,
                    student: { id: 1002, fullName: 'Trần Thị B', code: 'SV002' },
                    topic: { id: 502, title: 'Đề tài B', mentorId: 77 },
                    tasks: [
                        {
                            id: 301,
                            title: 'Nộp chương 2',
                            dueDate: new Date('2026-11-18T10:00:00.000Z'),
                            status: 'PENDING',
                        },
                    ],
                    bm04Evaluation: null,
                },
            ];

            db.topicRegistration.findMany.mockResolvedValue(mentorRegsInSem10);
            db.submission.count.mockResolvedValue(6);
            db.submission.findMany.mockResolvedValue(
                Array.from({ length: 5 }, (_, idx) => ({
                    id: 900 + idx,
                    fileName: `report-${idx + 1}.pdf`,
                    submittedAt: new Date('2026-11-16T09:00:00.000Z'),
                    student: { id: 1002, fullName: 'Trần Thị B', code: 'SV002' },
                    task: { id: 301, title: `Nhiệm vụ ${idx + 1}` },
                    registration: { id: 102, topic: { title: 'Đề tài B' } },
                }))
            );
            db.topicTitleAdjustment.findMany.mockResolvedValue([
                {
                    id: 401,
                    registrationId: 102,
                    newTitle: 'Đề tài B (đổi tên)',
                    status: 'PENDING',
                    deadline: new Date('2026-11-16T08:00:00.000Z'), // overdue relative to fixedNow
                    registration: {
                        id: 102,
                        student: { fullName: 'Trần Thị B', code: 'SV002' },
                        topic: { title: 'Đề tài B' },
                    },
                },
            ]);
            db.task.count.mockResolvedValue(1);

            const result = await buildMentorOverview({
                actorId: 77,
                semesterId: 10,
                now: fixedNow,
                db,
            });

            // Verify query scoped to mentorId and semesterId
            expect(db.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        semesterId: 10,
                        topic: { mentorId: 77 },
                    }),
                })
            );

            expect(result.mentorSummary).toEqual({
                supervisedCount: 2,
                maxStudents: 10,
                pendingFeedbackCount: 6,
                actionableCount: 9, // 6 submissions + 1 PENDING reg + 1 BM01_RESUBMITTED + 1 title adjustment
                upcomingDeadlineCount: 1,
            });

            expect(result.students).toHaveLength(2);
            expect(result.students.map((s) => s.registrationId)).toEqual([101, 102]);
            expect(result.students[0]).not.toHaveProperty('progress', 82);
            expect(result.students[0]).not.toHaveProperty('progress', 75);

            expect(result.attentionItems.length).toBeGreaterThanOrEqual(4);
            for (const item of result.attentionItems) {
                expect(item.source).toBe('MENTOR');
                expect(item.target).toMatch(/^\/lecturer\//);
                expect(item.isActionable).toBe(true);
            }

            const overdueAdjustment = result.attentionItems.find(
                (i) => i.kind === 'TITLE_ADJUSTMENT_PENDING'
            );
            expect(overdueAdjustment).toBeDefined();
            expect(overdueAdjustment.priority).toBe('OVERDUE');
        });
    });
});

