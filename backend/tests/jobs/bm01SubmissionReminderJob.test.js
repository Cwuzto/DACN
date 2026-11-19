const {
    processBm01SubmissionReminders,
    startBm01SubmissionReminderScheduler,
} = require('../../src/jobs/bm01SubmissionReminderJob');

const HOUR_MS = 60 * 60 * 1000;

function makeRegistration(overrides = {}) {
    const deadline = overrides.deadline !== undefined
        ? overrides.deadline
        : new Date('2026-11-22T10:00:00.000Z');

    return {
        id: overrides.id ?? 17,
        studentId: overrides.studentId ?? 101,
        status: overrides.status ?? 'APPROVED',
        cancelledAt: overrides.cancelledAt ?? null,
        assignmentStatus: overrides.assignmentStatus ?? 'ACTIVE',
        topic: {
            id: overrides.topicId ?? 5,
            title: overrides.topicTitle ?? 'Hệ thống quản lý đồ án',
        },
        semester: {
            id: overrides.semesterId ?? 3,
            name: overrides.semesterName ?? 'HK1 2026-2027',
            status: overrides.semesterStatus ?? 'ONGOING',
            outlineSubmissionDeadline: deadline,
        },
        bm01Evaluations: overrides.bm01Evaluations ?? [],
        submissions: overrides.submissions ?? [],
    };
}

function makeMockDb(registrations = [], latestById = null) {
    const byId = latestById || new Map(registrations.map((r) => [r.id, r]));
    return {
        topicRegistration: {
            findMany: jest.fn().mockResolvedValue(registrations),
            findUnique: jest.fn().mockImplementation(async ({ where }) => byId.get(where.id) ?? null),
        },
    };
}

describe('bm01SubmissionReminderJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not send reminder when more than 48h before deadline (e.g. 49h before)', async () => {
        const deadline = new Date('2026-11-22T10:00:00.000Z');
        const now = new Date(deadline.getTime() - 49 * HOUR_MS);
        const db = makeMockDb([makeRegistration({ deadline })]);
        const notify = jest.fn();

        const result = await processBm01SubmissionReminders({ db, now, notify });

        expect(result).toEqual({
            scanned: 1,
            beforeSent: 0,
            overdueSent: 0,
            skipped: 1,
        });
        expect(notify).not.toHaveBeenCalled();
    });

    it('sends BEFORE_48H reminder once when now is inside [deadline - 48h, deadline)', async () => {
        const deadline = new Date('2026-11-22T10:00:00.000Z');
        const now = new Date(deadline.getTime() - 48 * HOUR_MS);
        const db = makeMockDb([makeRegistration({ id: 17, studentId: 101, deadline })]);
        const notify = jest.fn().mockResolvedValue({ ok: true, created: { id: 1 } });

        const result = await processBm01SubmissionReminders({ db, now, notify });

        expect(result).toEqual({
            scanned: 1,
            beforeSent: 1,
            overdueSent: 0,
            skipped: 0,
        });
        expect(notify).toHaveBeenCalledTimes(1);
        expect(notify).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 101,
                type: 'TASK_REMINDER',
                referenceUrl: '/student/submissions',
                dedupeKey: `bm01:BEFORE_48H:17:${deadline.toISOString()}`,
            }),
            expect.any(String),
        );
    });

    it('sends OVERDUE reminder once when now >= deadline', async () => {
        const deadline = new Date('2026-11-22T10:00:00.000Z');
        const now = new Date(deadline.getTime());
        const db = makeMockDb([makeRegistration({ id: 18, studentId: 102, deadline })]);
        const notify = jest.fn().mockResolvedValue({ ok: true, created: { id: 2 } });

        const result = await processBm01SubmissionReminders({ db, now, notify });

        expect(result).toEqual({
            scanned: 1,
            beforeSent: 0,
            overdueSent: 1,
            skipped: 0,
        });
        expect(notify).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 102,
                type: 'TASK_REMINDER',
                referenceUrl: '/student/submissions',
                dedupeKey: `bm01:OVERDUE:18:${deadline.toISOString()}`,
            }),
            expect.any(String),
        );
    });

    it('skips when deadline is null, registration is not APPROVED, inactive, or BM01 already submitted', async () => {
        const deadline = new Date('2026-11-22T10:00:00.000Z');
        const now = new Date(deadline.getTime() - 10 * HOUR_MS);

        const regs = [
            makeRegistration({ id: 1, deadline: null }),
            makeRegistration({ id: 2, status: 'BM01_SUBMITTED', deadline }),
            makeRegistration({ id: 3, assignmentStatus: 'CANCELLED', deadline }),
            makeRegistration({ id: 4, cancelledAt: new Date(), deadline }),
            makeRegistration({ id: 5, submissions: [{ id: 99 }], deadline }),
            makeRegistration({ id: 6, bm01Evaluations: [{ id: 88 }], deadline }),
            makeRegistration({ id: 7, semesterStatus: 'COMPLETED', deadline }),
        ];
        const db = makeMockDb(regs);
        const notify = jest.fn();

        const result = await processBm01SubmissionReminders({ db, now, notify });

        expect(result).toEqual({
            scanned: 7,
            beforeSent: 0,
            overdueSent: 0,
            skipped: 7,
        });
        expect(notify).not.toHaveBeenCalled();
    });

    it('re-checks status and BM01 submission right before calling notify', async () => {
        const deadline = new Date('2026-11-22T10:00:00.000Z');
        const now = new Date(deadline.getTime() - 12 * HOUR_MS);
        const initialReg = makeRegistration({ id: 25, studentId: 105, deadline });
        const submittedReg = makeRegistration({
            id: 25,
            studentId: 105,
            status: 'BM01_SUBMITTED',
            submissions: [{ id: 500 }],
            deadline,
        });

        const db = makeMockDb([initialReg], new Map([[25, submittedReg]]));
        const notify = jest.fn();

        const result = await processBm01SubmissionReminders({ db, now, notify });

        expect(result).toEqual({
            scanned: 1,
            beforeSent: 0,
            overdueSent: 0,
            skipped: 1,
        });
        expect(db.topicRegistration.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 25 } }),
        );
        expect(notify).not.toHaveBeenCalled();
    });

    it('does not count duplicate or failed notify calls as sent and allows retry on failure', async () => {
        const deadline = new Date('2026-11-22T10:00:00.000Z');
        const now = new Date(deadline.getTime() - 5 * HOUR_MS);
        const reg = makeRegistration({ id: 30, studentId: 110, deadline });
        const db = makeMockDb([reg]);

        const notify = jest.fn()
            .mockResolvedValueOnce({ ok: false, skipped: true, reason: 'duplicate' })
            .mockResolvedValueOnce({ ok: false, error: 'db_error' })
            .mockResolvedValueOnce({ ok: true, created: { id: 3 } });

        const firstRun = await processBm01SubmissionReminders({ db, now, notify });
        expect(firstRun).toEqual({ scanned: 1, beforeSent: 0, overdueSent: 0, skipped: 1 });

        const secondRun = await processBm01SubmissionReminders({ db, now, notify });
        expect(secondRun).toEqual({ scanned: 1, beforeSent: 0, overdueSent: 0, skipped: 1 });

        const thirdRun = await processBm01SubmissionReminders({ db, now, notify });
        expect(thirdRun).toEqual({ scanned: 1, beforeSent: 1, overdueSent: 0, skipped: 0 });
    });

    it('generates a new dedupeKey when semester deadline changes', async () => {
        const oldDeadline = new Date('2026-11-22T10:00:00.000Z');
        const newDeadline = new Date('2026-11-25T10:00:00.000Z');
        const now = new Date(newDeadline.getTime() - 24 * HOUR_MS);

        const db = makeMockDb([makeRegistration({ id: 40, studentId: 120, deadline: newDeadline })]);
        const notify = jest.fn().mockResolvedValue({ ok: true, created: { id: 4 } });

        const result = await processBm01SubmissionReminders({ db, now, notify });

        expect(result.beforeSent).toBe(1);
        const sentKey = notify.mock.calls[0][0].dedupeKey;
        expect(sentKey).toBe(`bm01:BEFORE_48H:40:${newDeadline.toISOString()}`);
        expect(sentKey).not.toBe(`bm01:BEFORE_48H:40:${oldDeadline.toISOString()}`);
    });

    describe('startBm01SubmissionReminderScheduler', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });

        it('starts and stops timers cleanly and respects ENABLE_BM01_REMINDER_JOB=false', () => {
            const oldVal = process.env.ENABLE_BM01_REMINDER_JOB;

            process.env.ENABLE_BM01_REMINDER_JOB = 'false';
            const stopDisabled = startBm01SubmissionReminderScheduler();
            expect(jest.getTimerCount()).toBe(0);
            stopDisabled();

            delete process.env.ENABLE_BM01_REMINDER_JOB;
            const stopEnabled = startBm01SubmissionReminderScheduler();
            expect(jest.getTimerCount()).toBeGreaterThanOrEqual(1);
            stopEnabled();
            expect(jest.getTimerCount()).toBe(0);

            if (oldVal !== undefined) {
                process.env.ENABLE_BM01_REMINDER_JOB = oldVal;
            }
        });
    });
});
