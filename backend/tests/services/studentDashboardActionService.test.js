const { buildStudentNextAction } = require('../../src/services/studentDashboardActionService');
const { buildStudentWorkState } = require('../../src/services/studentWorkItemService');

describe('studentDashboardActionService - buildStudentNextAction', () => {
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

    test('returns null when neither registration nor semester exists', () => {
        expect(
            buildStudentNextAction({
                registration: null,
                semester: null,
                tasks: [],
                allowedActions: [],
                now,
            })
        ).toBeNull();
    });

    test('no registration with open semester returns REGISTER_TOPIC with canAct: true', () => {
        const action = buildStudentNextAction({
            registration: null,
            semester: { ...baseSemester, status: 'REGISTRATION', registrationOpen: true },
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(action).toMatchObject({
            kind: 'REGISTER_TOPIC',
            target: '/student/topics',
            sourceStatus: null,
            canAct: true,
        });
        expect(action.dueAt).toEqual(baseSemester.registrationDeadline);
    });

    test('no registration with closed registration window returns REGISTER_TOPIC with canAct: false and no target', () => {
        const action = buildStudentNextAction({
            registration: null,
            semester: { ...baseSemester, registrationOpen: false },
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(action).toMatchObject({
            kind: 'REGISTER_TOPIC',
            target: null,
            sourceStatus: null,
            canAct: false,
        });
    });

    test('no registration past registrationDeadline returns canAct: false and no target', () => {
        const pastSemester = {
            ...baseSemester,
            registrationOpen: true,
            registrationDeadline: new Date('2026-10-05T23:59:59.000Z'),
        };

        const action = buildStudentNextAction({
            registration: null,
            semester: pastSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(action.kind).toBe('REGISTER_TOPIC');
        expect(action.canAct).toBe(false);
        expect(action.target).toBeNull();
    });

    test('PENDING registration returns waiting for GVHD with canAct: false and no mutation target', () => {
        const action = buildStudentNextAction({
            registration: { id: 10, status: 'PENDING' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['CANCEL_REGISTRATION'],
            now,
        });

        expect(action).toMatchObject({
            kind: 'WAIT_MENTOR_APPROVAL',
            target: null,
            sourceStatus: 'PENDING',
            canAct: false,
            dueAt: null,
        });
        expect(action.title).toMatch(/giảng viên hướng dẫn/i);
    });

    test('APPROVED registration with SUBMIT_BM01 and open window returns BM01_INITIAL with real deadline and deep link target', () => {
        const action = buildStudentNextAction({
            registration: { id: 11, status: 'APPROVED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['SUBMIT_BM01', 'CANCEL_REGISTRATION'],
            now,
        });

        expect(action).toMatchObject({
            kind: 'BM01_INITIAL',
            target: '/student/submissions?work=BM01_INITIAL',
            sourceStatus: 'APPROVED',
            canAct: true,
            dueAt: baseSemester.outlineSubmissionDeadline,
        });
    });

    test('APPROVED registration without SUBMIT_BM01 permission or closed window returns canAct: false and target: null', () => {
        const missingPerm = buildStudentNextAction({
            registration: { id: 11, status: 'APPROVED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: [],
            now,
        });
        expect(missingPerm.kind).toBe('BM01_INITIAL');
        expect(missingPerm.canAct).toBe(false);
        expect(missingPerm.target).toBeNull();

        const pastDeadline = buildStudentNextAction({
            registration: { id: 11, status: 'APPROVED' },
            semester: {
                ...baseSemester,
                outlineSubmissionDeadline: new Date('2026-10-08T00:00:00.000Z'),
            },
            tasks: [],
            allowedActions: ['SUBMIT_BM01'],
            now,
        });
        expect(pastDeadline.kind).toBe('BM01_INITIAL');
        expect(pastDeadline.canAct).toBe(false);
        expect(pastDeadline.target).toBeNull();
    });

    test('APPROVED registration with null outlineSubmissionDeadline preserves dueAt: null', () => {
        const action = buildStudentNextAction({
            registration: { id: 11, status: 'APPROVED' },
            semester: { ...baseSemester, outlineSubmissionDeadline: null },
            tasks: [],
            allowedActions: ['SUBMIT_BM01'],
            now,
        });

        expect(action.kind).toBe('BM01_INITIAL');
        expect(action.dueAt).toBeNull();
        expect(action.canAct).toBe(true);
    });

    test.each(['BM01_SUBMITTED', 'BM01_RESUBMITTED'])(
        '%s returns waiting for review with canAct: false',
        (status) => {
            const action = buildStudentNextAction({
                registration: { id: 12, status },
                semester: baseSemester,
                tasks: [],
                allowedActions: [],
                now,
            });

            expect(action).toMatchObject({
                kind: 'WAIT_BM01_REVIEW',
                target: null,
                sourceStatus: status,
                canAct: false,
            });
        }
    );

    test('BM01_NEEDS_REVISION returns BM01_RESUBMIT with canAct: true when allowed', () => {
        const action = buildStudentNextAction({
            registration: { id: 13, status: 'BM01_NEEDS_REVISION' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['RESUBMIT_BM01'],
            now,
        });

        expect(action).toMatchObject({
            kind: 'BM01_RESUBMIT',
            target: '/student/submissions?work=BM01_RESUBMIT',
            sourceStatus: 'BM01_NEEDS_REVISION',
            canAct: true,
        });
    });

    test('BM01_PASSED returns BM02 when SUBMIT_BM02 is allowed', () => {
        const action = buildStudentNextAction({
            registration: { id: 14, status: 'BM01_PASSED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['SUBMIT_BM02'],
            now,
        });

        expect(action).toMatchObject({
            kind: 'BM02',
            target: '/student/submissions?work=BM02',
            sourceStatus: 'BM01_PASSED',
            canAct: true,
        });
    });

    test('BM02_SUBMITTED returns waiting for confirmation with canAct: false', () => {
        const action = buildStudentNextAction({
            registration: { id: 15, status: 'BM02_SUBMITTED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(action).toMatchObject({
            kind: 'WAIT_BM02_APPROVAL',
            target: null,
            sourceStatus: 'BM02_SUBMITTED',
            canAct: false,
        });
    });

    test.each(['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03'])(
        '%s with open task returns task action targeting work hub with real task dueDate',
        (status) => {
            const taskDue = new Date('2026-10-18T12:00:00.000Z');
            const action = buildStudentNextAction({
                registration: { id: 16, status },
                semester: baseSemester,
                tasks: [{ id: 1, status: 'OPEN', dueDate: taskDue, title: 'Báo cáo khảo sát' }],
                allowedActions: [],
                now,
            });

            expect(action).toMatchObject({
                kind: 'TASK_SUBMISSION',
                target: '/student/submissions?work=task-1',
                sourceStatus: 'OPEN',
                canAct: true,
                dueAt: taskDue,
            });
        }
    );

    test('IN_PROGRESS with NO open task returns waitingStatus with canAct: false and target: null', () => {
        const action = buildStudentNextAction({
            registration: { id: 16, status: 'IN_PROGRESS' },
            semester: baseSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(action).toMatchObject({
            kind: 'SUBMIT_PROGRESS_BM03',
            target: null,
            sourceStatus: 'IN_PROGRESS',
            canAct: false,
        });
    });

    test('BM03_SIGNATURE_PENDING returns BM03_ACK gated by SIGN_CHECKPOINT', () => {
        const action = buildStudentNextAction({
            registration: { id: 17, status: 'BM03_SIGNATURE_PENDING' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['SIGN_CHECKPOINT'],
            now,
        });

        expect(action).toMatchObject({
            kind: 'BM03_ACK',
            target: '/student/submissions?work=BM03_ACK',
            sourceStatus: 'BM03_SIGNATURE_PENDING',
            canAct: true,
        });
    });

    test.each(['BM03_PASSED', 'BM04_REVIEW'])(
        '%s returns waiting for BM04 with canAct: false',
        (status) => {
            const action = buildStudentNextAction({
                registration: { id: 18, status },
                semester: baseSemester,
                tasks: [],
                allowedActions: [],
                now,
            });

            expect(action).toMatchObject({
                kind: 'WAIT_BM04_EVALUATION',
                target: null,
                sourceStatus: status,
                canAct: false,
            });
        }
    );

    test('DEFENSE_READY returns PRE_DEFENSE with semester defenseDate and never leaks unpublished scores', () => {
        const action = buildStudentNextAction({
            registration: {
                id: 19,
                status: 'DEFENSE_READY',
                defenseResult: { isPublished: false, finalScore: 8.7 },
            },
            semester: baseSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(action).toMatchObject({
            kind: 'PRE_DEFENSE',
            target: '/student/submissions?work=PRE_DEFENSE',
            sourceStatus: 'DEFENSE_READY',
            canAct: true,
            dueAt: baseSemester.defenseDate,
        });
        expect(JSON.stringify(action)).not.toContain('8.7');
    });

    test.each(['DEFENSE_PASSED', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED'])(
        '%s returns SUBMIT_ARCHIVE targeting /student/submissions?work=SUBMIT_ARCHIVE',
        (status) => {
            const action = buildStudentNextAction({
                registration: { id: 20, status },
                semester: baseSemester,
                tasks: [],
                allowedActions: [],
                now,
            });

            expect(action).toMatchObject({
                kind: 'SUBMIT_ARCHIVE',
                target: '/student/submissions?work=SUBMIT_ARCHIVE',
                sourceStatus: status,
                canAct: true,
            });
        }
    );

    test('PENDING_INSTITUTE_SIGNATURE returns waiting for Institute signature with canAct: false', () => {
        const action = buildStudentNextAction({
            registration: { id: 21, status: 'PENDING_INSTITUTE_SIGNATURE' },
            semester: baseSemester,
            tasks: [],
            allowedActions: [],
            now,
        });

        expect(action).toMatchObject({
            kind: 'WAIT_INSTITUTE_SIGNATURE',
            target: null,
            sourceStatus: 'PENDING_INSTITUTE_SIGNATURE',
            canAct: false,
        });
    });

    test('COMPLETED returns VIEW_GRADES_CERTIFICATE targeting /student/grades', () => {
        const action = buildStudentNextAction({
            registration: { id: 22, status: 'COMPLETED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['VIEW_CLEARANCE_CERTIFICATE'],
            now,
        });

        expect(action).toMatchObject({
            kind: 'VIEW_GRADES_CERTIFICATE',
            target: '/student/grades',
            sourceStatus: 'COMPLETED',
            canAct: true,
        });
    });

    test('DEFENDED with SUBMIT_ARCHIVE returns SUBMIT_ARCHIVE; without SUBMIT_ARCHIVE returns VIEW_GRADES_CERTIFICATE', () => {
        const archiveAction = buildStudentNextAction({
            registration: { id: 23, status: 'DEFENDED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['SUBMIT_ARCHIVE'],
            now,
        });
        expect(archiveAction).toMatchObject({
            kind: 'SUBMIT_ARCHIVE',
            target: '/student/submissions?work=SUBMIT_ARCHIVE',
            sourceStatus: 'DEFENDED',
            canAct: true,
        });

        const viewAction = buildStudentNextAction({
            registration: { id: 24, status: 'DEFENDED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['VIEW_CLEARANCE_CERTIFICATE'],
            now,
        });
        expect(viewAction).toMatchObject({
            kind: 'VIEW_GRADES_CERTIFICATE',
            target: '/student/grades',
            sourceStatus: 'DEFENDED',
            canAct: true,
        });
    });

    test.each(['REJECTED', 'TERMINATED_BM01', 'TERMINATED_FAILED_PROGRESS', 'TERMINATED_BM04', 'WITHDRAWN', 'DROPPED'])(
        '%s returns clear closed/terminated status with canAct: false and target: null',
        (status) => {
            const action = buildStudentNextAction({
                registration: { id: 25, status },
                semester: baseSemester,
                tasks: [],
                allowedActions: [],
                now,
            });

            expect(action).toMatchObject({
                kind: 'REGISTRATION_CLOSED',
                target: null,
                sourceStatus: status,
                canAct: false,
                dueAt: null,
            });
        }
    );

    test('always matches buildStudentWorkState nextAction exactly (single source of truth)', () => {
        const params = {
            registration: { id: 30, status: 'APPROVED' },
            semester: baseSemester,
            tasks: [],
            allowedActions: ['SUBMIT_BM01'],
            now,
        };

        const fromAction = buildStudentNextAction(params);
        const fromWorkState = buildStudentWorkState(params).nextAction;

        expect(fromAction).toEqual(fromWorkState);
    });

    test('returns null for unknown registration status', () => {
        expect(
            buildStudentNextAction({
                registration: { id: 26, status: 'UNKNOWN_STATUS_XYZ' },
                semester: baseSemester,
                tasks: [],
                allowedActions: [],
                now,
            })
        ).toBeNull();
    });
});
