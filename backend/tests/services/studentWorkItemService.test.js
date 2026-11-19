const { buildStudentWorkState } = require('../../src/services/studentWorkItemService');

describe('studentWorkItemService - buildStudentWorkState', () => {
    const now = new Date('2026-10-10T10:00:00.000Z');

    const baseSemester = {
        id: 1,
        code: 'HK1-2026-2027',
        name: 'Học kỳ 1 (2026 - 2027)',
        status: 'ONGOING',
        registrationOpen: true,
        registrationDeadline: new Date('2026-10-20T23:59:59.000Z'),
        outlineSubmissionOpenAt: new Date('2026-10-01T00:00:00.000Z'),
        outlineSubmissionDeadline: new Date('2026-10-25T23:59:59.000Z'),
        midtermReportDate: new Date('2026-11-15T23:59:59.000Z'),
        defenseDate: new Date('2026-12-20T08:00:00.000Z'),
    };

    test('returns empty workItems and null nextAction when neither registration nor semester exists', () => {
        const state = buildStudentWorkState({
            registration: null,
            semester: null,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(state).toEqual({
            workItems: [],
            waitingStatus: null,
            nextAction: null,
        });
    });

    test('no registration + open semester returns REGISTER_TOPIC in READY and nextAction', () => {
        const state = buildStudentWorkState({
            registration: null,
            semester: { ...baseSemester, status: 'REGISTRATION', registrationOpen: true },
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(state.workItems).toHaveLength(1);
        expect(state.workItems[0]).toMatchObject({
            kind: 'REGISTER_TOPIC',
            bucket: 'READY',
            canAct: true,
            target: '/student/topics',
        });
        expect(state.waitingStatus).toBeNull();
        expect(state.nextAction).toMatchObject({
            kind: 'REGISTER_TOPIC',
            canAct: true,
            target: '/student/topics',
        });
    });

    test('no registration + closed semester returns waitingStatus and no-CTA nextAction, empty READY', () => {
        const pastDeadlineSemester = {
            ...baseSemester,
            registrationOpen: true,
            registrationDeadline: new Date('2026-10-05T23:59:59.000Z'),
        };

        const state = buildStudentWorkState({
            registration: null,
            semester: pastDeadlineSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(state.workItems.filter((w) => w.bucket === 'READY')).toHaveLength(0);
        expect(state.waitingStatus).not.toBeNull();
        expect(state.nextAction).toMatchObject({
            kind: 'REGISTER_TOPIC',
            canAct: false,
            target: null,
        });
    });

    test('PENDING registration returns waitingStatus for mentor approval, empty READY, and nextAction without CTA', () => {
        const state = buildStudentWorkState({
            registration: { id: 10, status: 'PENDING' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['CANCEL_REGISTRATION'],
            now,
        });

        expect(state.workItems.filter((w) => w.bucket === 'READY')).toHaveLength(0);
        expect(state.waitingStatus).toMatchObject({
            sourceStatus: 'PENDING',
        });
        expect(state.waitingStatus.title).toMatch(/giảng viên hướng dẫn/i);
        expect(state.nextAction).toMatchObject({
            kind: 'WAIT_MENTOR_APPROVAL',
            canAct: false,
            target: null,
            sourceStatus: 'PENDING',
            dueAt: null,
        });
    });

    test('APPROVED registration without task still generates BM01_INITIAL in READY with canAct: true and deep link target', () => {
        const state = buildStudentWorkState({
            registration: { id: 11, status: 'APPROVED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['SUBMIT_BM01', 'CANCEL_REGISTRATION'],
            now,
        });

        const readyBm01 = state.workItems.find((w) => w.kind === 'BM01_INITIAL' && w.bucket === 'READY');
        expect(readyBm01).toBeDefined();
        expect(readyBm01).toMatchObject({
            kind: 'BM01_INITIAL',
            bucket: 'READY',
            canAct: true,
            target: '/student/submissions?work=BM01_INITIAL',
            dueAt: baseSemester.outlineSubmissionDeadline,
        });
        expect(state.nextAction?.kind).toBe('BM01_INITIAL');
        expect(state.nextAction?.target).toBe('/student/submissions?work=BM01_INITIAL');
    });

    test('APPROVED registration with future outlineSubmissionOpenAt within 7 days puts BM01_INITIAL in UPCOMING with canAct: false', () => {
        const futureSemester = {
            ...baseSemester,
            outlineSubmissionOpenAt: new Date('2026-10-15T00:00:00.000Z'), // 4 days 14 hours away (< 7 days)
            outlineSubmissionDeadline: new Date('2026-10-30T23:59:59.000Z'),
        };

        const state = buildStudentWorkState({
            registration: { id: 11, status: 'APPROVED' },
            semester: futureSemester,
            tasks: [],
            allowedActions: ['SUBMIT_BM01'],
            now,
        });

        expect(state.workItems.filter((w) => w.bucket === 'READY')).toHaveLength(0);
        const upcomingBm01 = state.workItems.find((w) => w.kind === 'BM01_INITIAL' && w.bucket === 'UPCOMING');
        expect(upcomingBm01).toBeDefined();
        expect(upcomingBm01).toMatchObject({
            kind: 'BM01_INITIAL',
            bucket: 'UPCOMING',
            canAct: false,
            target: null,
            openAt: futureSemester.outlineSubmissionOpenAt,
        });
        expect(state.nextAction).toMatchObject({
            canAct: false,
            target: null,
        });
    });

    test('APPROVED registration with future outlineSubmissionOpenAt > 7 days does NOT appear in UPCOMING or READY', () => {
        const farFutureSemester = {
            ...baseSemester,
            // 7 days + 1 hour away
            outlineSubmissionOpenAt: new Date(now.getTime() + (7 * 24 + 1) * 60 * 60 * 1000),
            outlineSubmissionDeadline: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
        };

        const state = buildStudentWorkState({
            registration: { id: 11, status: 'APPROVED' },
            semester: farFutureSemester,
            tasks: [],
            allowedActions: ['SUBMIT_BM01'],
            now,
        });

        expect(state.workItems.filter((w) => w.kind === 'BM01_INITIAL')).toHaveLength(0);
        expect(state.nextAction?.canAct).toBe(false);
    });

    test('READY item with near deadline does NOT duplicate in UPCOMING', () => {
        const nearDeadlineSemester = {
            ...baseSemester,
            outlineSubmissionOpenAt: new Date('2026-10-01T00:00:00.000Z'), // already open
            outlineSubmissionDeadline: new Date('2026-10-14T23:59:59.000Z'), // 4 days away
        };

        const state = buildStudentWorkState({
            registration: { id: 11, status: 'APPROVED' },
            semester: nearDeadlineSemester,
            tasks: [],
            allowedActions: ['SUBMIT_BM01'],
            now,
        });

        expect(state.workItems.filter((w) => w.kind === 'BM01_INITIAL' && w.bucket === 'READY')).toHaveLength(1);
        expect(state.workItems.filter((w) => w.kind === 'BM01_INITIAL' && w.bucket === 'UPCOMING')).toHaveLength(0);
        expect(state.workItems.filter((w) => w.bucket === 'UPCOMING' && !w.openAt && !w.dueAt)).toHaveLength(0);
    });

    test('BM01_SUBMITTED and BM01_RESUBMITTED puts BM01_INITIAL in DONE and generates waitingStatus', () => {
        const submittedAt = new Date('2026-10-08T14:30:00.000Z');
        const state = buildStudentWorkState({
            registration: { id: 12, status: 'BM01_SUBMITTED' },
            semester: baseSemester,
            tasks: [],
            outline: { id: 2, submittedAt },
            allowedActions: [],
            now,
        });

        expect(state.workItems.filter((w) => w.bucket === 'READY')).toHaveLength(0);
        const doneBm01 = state.workItems.find((w) => w.kind === 'BM01_INITIAL' && w.bucket === 'DONE');
        expect(doneBm01).toBeDefined();
        expect(doneBm01.completedAt).toEqual(submittedAt);
        expect(state.waitingStatus).toMatchObject({
            sourceStatus: 'BM01_SUBMITTED',
        });
        expect(state.nextAction).toMatchObject({
            kind: 'WAIT_BM01_REVIEW',
            canAct: false,
            target: null,
            sourceStatus: 'BM01_SUBMITTED',
        });
    });

    test('BM01_NEEDS_REVISION generates BM01_RESUBMIT in READY and puts BM01_INITIAL in DONE', () => {
        const revisionDeadline = new Date('2026-10-18T23:59:59.000Z');
        const state = buildStudentWorkState({
            registration: { id: 13, status: 'BM01_NEEDS_REVISION' },
            semester: baseSemester,
            tasks: [],
            outline: { id: 2, submittedAt: new Date('2026-10-05T10:00:00.000Z'), deadlineAt: revisionDeadline },
            allowedActions: ['RESUBMIT_BM01'],
            now,
        });

        const readyResubmit = state.workItems.find((w) => w.kind === 'BM01_RESUBMIT' && w.bucket === 'READY');
        expect(readyResubmit).toBeDefined();
        expect(readyResubmit).toMatchObject({
            kind: 'BM01_RESUBMIT',
            bucket: 'READY',
            canAct: true,
            target: '/student/submissions?work=BM01_RESUBMIT',
            dueAt: revisionDeadline,
        });
        expect(state.workItems.filter((w) => w.kind === 'BM01_INITIAL' && w.bucket === 'DONE')).toHaveLength(1);
        expect(state.nextAction?.kind).toBe('BM01_RESUBMIT');
    });

    test('BM01_PASSED generates BM02 in READY when SUBMIT_BM02 is allowed and puts BM01 in DONE', () => {
        const state = buildStudentWorkState({
            registration: { id: 14, status: 'BM01_PASSED' },
            semester: baseSemester,
            tasks: [],
            outline: { id: 2, reviewedAt: new Date('2026-10-09T08:00:00.000Z') },
            allowedActions: ['SUBMIT_BM02'],
            now,
        });

        const readyBm02 = state.workItems.find((w) => w.kind === 'BM02' && w.bucket === 'READY');
        expect(readyBm02).toBeDefined();
        expect(readyBm02).toMatchObject({
            kind: 'BM02',
            bucket: 'READY',
            canAct: true,
            target: '/student/submissions?work=BM02',
        });
        expect(state.workItems.filter((w) => w.kind === 'BM01_INITIAL' && w.bucket === 'DONE')).toHaveLength(1);
        expect(state.nextAction?.kind).toBe('BM02');
    });

    test('BM02_SUBMITTED puts BM02 in DONE and waitingStatus for BM02 approval', () => {
        const state = buildStudentWorkState({
            registration: { id: 15, status: 'BM02_SUBMITTED', currentBM02Submission: { submittedAt: new Date('2026-10-10T09:00:00.000Z') } },
            semester: baseSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(state.workItems.filter((w) => w.bucket === 'READY')).toHaveLength(0);
        expect(state.workItems.filter((w) => w.kind === 'BM02' && w.bucket === 'DONE')).toHaveLength(1);
        expect(state.waitingStatus).toMatchObject({
            sourceStatus: 'BM02_SUBMITTED',
        });
        expect(state.nextAction).toMatchObject({
            kind: 'WAIT_BM02_APPROVAL',
            canAct: false,
            target: null,
            sourceStatus: 'BM02_SUBMITTED',
        });
    });

    test('IN_PROGRESS with general status and NO tasks / NO checkpoint does NOT generate fake submission in READY', () => {
        const state = buildStudentWorkState({
            registration: { id: 16, status: 'IN_PROGRESS' },
            semester: baseSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(state.workItems.filter((w) => w.bucket === 'READY')).toHaveLength(0);
        expect(state.waitingStatus).toMatchObject({
            sourceStatus: 'IN_PROGRESS',
        });
        expect(state.nextAction).toMatchObject({
            kind: 'SUBMIT_PROGRESS_BM03',
            canAct: false,
            target: null,
            sourceStatus: 'IN_PROGRESS',
        });
    });

    test('IN_PROGRESS with open tasks generates TASK_SUBMISSION in READY; completed tasks go to DONE', () => {
        const taskDue = new Date('2026-10-18T12:00:00.000Z');
        const completedTaskTime = new Date('2026-10-09T10:00:00.000Z');
        const state = buildStudentWorkState({
            registration: { id: 16, status: 'IN_PROGRESS' },
            semester: baseSemester,
            tasks: [
                { id: 1, title: 'Báo cáo khảo sát', status: 'COMPLETED', completedAt: completedTaskTime },
                { id: 2, title: 'Thiết kế cơ sở dữ liệu', status: 'OPEN', dueDate: taskDue },
            ],
            allowedActions: [],
            now,
        });

        const readyTasks = state.workItems.filter((w) => w.bucket === 'READY');
        expect(readyTasks).toHaveLength(1);
        expect(readyTasks[0]).toMatchObject({
            id: 'task-2',
            kind: 'TASK_SUBMISSION',
            canAct: true,
            dueAt: taskDue,
        });

        const doneTasks = state.workItems.filter((w) => w.id === 'task-1' && w.bucket === 'DONE');
        expect(doneTasks).toHaveLength(1);
        expect(doneTasks[0].completedAt).toEqual(completedTaskTime);
        expect(state.nextAction?.kind).toBe('TASK_SUBMISSION');
    });

    test('BM03_SIGNATURE_PENDING generates BM03_ACK in READY with 48h limit and high priority', () => {
        const ackDeadline = new Date('2026-10-12T10:00:00.000Z'); // 48h from now
        const state = buildStudentWorkState({
            registration: { id: 17, status: 'BM03_SIGNATURE_PENDING' },
            semester: baseSemester,
            tasks: [],
            bm03Record: { id: 1, studentAckStatus: 'PENDING', studentAckDeadlineAt: ackDeadline },
            allowedActions: ['SIGN_CHECKPOINT'],
            now,
        });

        const readyAck = state.workItems.find((w) => w.kind === 'BM03_ACK' && w.bucket === 'READY');
        expect(readyAck).toBeDefined();
        expect(readyAck).toMatchObject({
            kind: 'BM03_ACK',
            bucket: 'READY',
            canAct: true,
            dueAt: ackDeadline,
            target: '/student/submissions?work=BM03_ACK',
        });
        expect(state.nextAction?.kind).toBe('BM03_ACK');
    });

    test('READY sorting: overdue tasks come first, then 48h items (BM03_ACK) / resubmissions (BM01_RESUBMIT), then normal items by dueAt', () => {
        const overdueDate = new Date('2026-10-08T10:00:00.000Z');
        const ackDate = new Date('2026-10-12T10:00:00.000Z');
        const normalCloseDate = new Date('2026-10-11T12:00:00.000Z');
        const normalFarDate = new Date('2026-10-20T12:00:00.000Z');

        const state = buildStudentWorkState({
            registration: { id: 17, status: 'BM03_SIGNATURE_PENDING' },
            semester: baseSemester,
            tasks: [
                { id: 1, title: 'Việc thường xa hạn', status: 'OPEN', dueDate: normalFarDate },
                { id: 2, title: 'Việc quá hạn', status: 'OPEN', dueDate: overdueDate },
                { id: 3, title: 'Việc thường gần hạn', status: 'OPEN', dueDate: normalCloseDate },
            ],
            bm03Record: { id: 1, studentAckStatus: 'PENDING', studentAckDeadlineAt: ackDate },
            allowedActions: ['SIGN_CHECKPOINT'],
            now,
        });

        const readyItems = state.workItems.filter((w) => w.bucket === 'READY');
        expect(readyItems).toHaveLength(4);
        // Overdue first
        expect(readyItems[0].id).toBe('task-2');
        // Then urgent 48h BM03_ACK
        expect(readyItems[1].kind).toBe('BM03_ACK');
        // Then normal items by dueAt
        expect(readyItems[2].id).toBe('task-3');
        expect(readyItems[3].id).toBe('task-1');

        expect(state.nextAction?.kind).toBe(readyItems[0].kind);
    });

    test('BM04 completed puts BM04 in DONE; unpublished defense scores are never leaked', () => {
        const signedAt = new Date('2026-10-09T15:00:00.000Z');
        const state = buildStudentWorkState({
            registration: {
                id: 19,
                status: 'DEFENSE_READY',
                defenseResult: { isPublished: false, finalScore: 9.5 },
            },
            semester: baseSemester,
            tasks: [],
            bm04Record: { id: 1, status: 'COMPLETED', signedAt },
            allowedActions: [],
            now,
        });

        const doneBm04 = state.workItems.find((w) => w.kind === 'BM04' && w.bucket === 'DONE');
        expect(doneBm04).toBeDefined();
        expect(doneBm04.completedAt).toEqual(signedAt);

        const readyPreDefense = state.workItems.find((w) => w.kind === 'PRE_DEFENSE' && w.bucket === 'READY');
        expect(readyPreDefense).toBeDefined();
        expect(readyPreDefense.target).toBe('/student/submissions?work=PRE_DEFENSE');

        // Verification: never leak unpublished finalScore
        expect(JSON.stringify(state)).not.toContain('9.5');
    });

    test('DEFENSE_PASSED / ARCHIVE_INCOMPLETE / ARCHIVE_REJECTED generates SUBMIT_ARCHIVE in READY', () => {
        const state = buildStudentWorkState({
            registration: { id: 20, status: 'DEFENSE_PASSED' },
            semester: baseSemester,
            tasks: [],
            archive: { id: 5, windowClosesAt: new Date('2026-11-01T23:59:59.000Z') },
            allowedActions: ['SUBMIT_ARCHIVE'],
            now,
        });

        const readyArchive = state.workItems.find((w) => w.kind === 'SUBMIT_ARCHIVE' && w.bucket === 'READY');
        expect(readyArchive).toBeDefined();
        expect(readyArchive.target).toBe('/student/submissions?work=SUBMIT_ARCHIVE');
        expect(readyArchive.canAct).toBe(true);
        expect(state.nextAction?.kind).toBe('SUBMIT_ARCHIVE');
    });

    test('COMPLETED returns VIEW_GRADES_CERTIFICATE in READY and archive in DONE', () => {
        const certDate = new Date('2026-10-01T10:00:00.000Z');
        const state = buildStudentWorkState({
            registration: { id: 22, status: 'COMPLETED' },
            semester: baseSemester,
            tasks: [],
            archive: { id: 6, certificateSignedAt: certDate },
            allowedActions: ['VIEW_CLEARANCE_CERTIFICATE'],
            now,
        });

        const readyCert = state.workItems.find((w) => w.kind === 'VIEW_GRADES_CERTIFICATE' && w.bucket === 'READY');
        expect(readyCert).toBeDefined();
        expect(readyCert.target).toBe('/student/grades');

        const doneArchive = state.workItems.find((w) => w.kind === 'SUBMIT_ARCHIVE' && w.bucket === 'DONE');
        expect(doneArchive).toBeDefined();
        expect(doneArchive.completedAt).toEqual(certDate);
    });

    test.each(['REJECTED', 'TERMINATED_BM01', 'TERMINATED_FAILED_PROGRESS', 'TERMINATED_BM04', 'WITHDRAWN', 'DROPPED'])(
        '%s returns clear closed status with canAct: false, target: null, and empty READY workItems',
        (status) => {
            const state = buildStudentWorkState({
                registration: { id: 25, status },
                semester: baseSemester,
                tasks: [],
                allowedActions: [],
                now,
            });

            expect(state.workItems.filter((w) => w.bucket === 'READY')).toHaveLength(0);
            expect(state.nextAction).toMatchObject({
                kind: 'REGISTRATION_CLOSED',
                canAct: false,
                target: null,
                sourceStatus: status,
                dueAt: null,
            });
        }
    );
});
