const { buildGuidanceWorkspace } = require('../../src/services/guidanceWorkspaceService');

describe('guidanceWorkspaceService.buildGuidanceWorkspace', () => {
    const mentorActor = {
        id: 77,
        role: 'LECTURER',
        permissions: [
            'VIEW_MENTORED_STUDENTS',
            'BM02A_ADVISOR_SIGN',
            'BM03_REVIEW',
            'BM03_MEETING_RECORD',
            'BM03_STAGE_EVALUATE',
            'BM04_SUBMIT',
            'BM04_CREATE_AND_SIGN',
        ],
    };

    const readOnlyActor = {
        id: 201,
        role: 'LECTURER',
        permissions: ['VIEW_PROJECT_OVERSIGHT'],
    };

    const baseRegistration = (overrides = {}) => ({
        id: 42,
        studentId: 5,
        semesterId: 9,
        status: 'REGISTERED',
        outlineReviewStatus: 'PENDING',
        topic: { id: 100, mentorId: 77, title: 'He thong A' },
        submissions: [],
        bm01Evaluations: [],
        currentBM02Submission: null,
        bm02Submissions: [],
        bm02aRequests: [],
        bm03Record: null,
        bm03MeetingEntries: [],
        checkpointEvaluations: [],
        bm04Evaluation: null,
        defenseResult: null,
        resultPublicationItems: [],
        ...overrides,
    });

    test('returns BM01, BM02, BM03, BM04, BM05 in order and omits BM02-A when no requests exist', () => {
        const ws = buildGuidanceWorkspace(baseRegistration(), mentorActor, { allowedActions: [] });

        expect(ws.forms.map((f) => f.code)).toEqual(['BM01', 'BM02', 'BM03', 'BM04', 'BM05']);
        expect(ws.nextAction).toBeNull();
        for (const form of ws.forms) {
            expect(form.updatedAt).toBeNull();
        }
        expect(ws.forms.find((f) => f.code === 'BM01').statusLabel).toBe('Chưa nộp');
        expect(ws.forms.find((f) => f.code === 'BM02').statusLabel).toBe('Chưa nộp');
        expect(ws.forms.find((f) => f.code === 'BM03').statusLabel).toBe('Chưa bắt đầu');
        expect(ws.forms.find((f) => f.code === 'BM04').statusLabel).toBe('Chưa lập');
        expect(ws.forms.find((f) => f.code === 'BM05').statusLabel).toBe('Chưa có kết quả');
    });

    test('inserts BM02-A right after BM02 when requests exist and picks latest version/request', () => {
        const olderDate = new Date('2026-10-01T10:00:00.000Z');
        const newerDate = new Date('2026-10-05T12:00:00.000Z');
        const reg = baseRegistration({
            status: 'DECISION_ISSUED',
            bm02aRequests: [
                { id: 10, status: 'RETURNED_FOR_CORRECTION', createdAt: olderDate, updatedAt: olderDate },
                { id: 11, status: 'PENDING_ADVISOR', createdAt: newerDate, updatedAt: newerDate },
            ],
        });

        const ws = buildGuidanceWorkspace(reg, mentorActor, { allowedActions: [] });

        expect(ws.forms.map((f) => f.code)).toEqual(['BM01', 'BM02', 'BM02-A', 'BM03', 'BM04', 'BM05']);
        const bm02a = ws.forms.find((f) => f.code === 'BM02-A');
        expect(bm02a.statusLabel).toBe('Chờ GVHD duyệt');
        expect(bm02a.updatedAt).toEqual(newerDate);
        expect(bm02a.actions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: 'VIEW', params: { registrationId: 42, requestId: 11 } }),
                expect.objectContaining({ code: 'VIEW_PRINT', params: { registrationId: 42, requestId: 11 } }),
                expect.objectContaining({ code: 'REVIEW', params: { registrationId: 42, requestId: 11 } }),
            ])
        );
        expect(ws.nextAction).toEqual(
            expect.objectContaining({
                code: 'REVIEW',
                params: { registrationId: 42, requestId: 11 },
            })
        );
    });

    test('does not grant mutation actions when actor lacks business permission', () => {
        const reg = baseRegistration({
            status: 'BM03_PASSED',
            bm02aRequests: [
                { id: 11, status: 'PENDING_ADVISOR', createdAt: new Date('2026-10-05T12:00:00.000Z'), updatedAt: new Date('2026-10-05T12:00:00.000Z') },
            ],
        });

        const ws = buildGuidanceWorkspace(reg, readOnlyActor, { allowedActions: [] });

        const bm02a = ws.forms.find((f) => f.code === 'BM02-A');
        const bm03 = ws.forms.find((f) => f.code === 'BM03');
        const bm04 = ws.forms.find((f) => f.code === 'BM04');

        expect(bm02a.actions.map((a) => a.code)).not.toContain('REVIEW');
        expect(bm03.actions.map((a) => a.code)).not.toContain('OPEN_PROGRESS');
        expect(bm04.actions.map((a) => a.code)).not.toContain('REVIEW');
        expect(ws.nextAction).toBeNull();
    });

    test('handles BM01, BM02, BM03, BM04 real records and timestamps accurately', () => {
        const bm01Date = new Date('2026-09-10T08:00:00.000Z');
        const bm02Date = new Date('2026-09-15T09:00:00.000Z');
        const bm03Date = new Date('2026-10-20T14:00:00.000Z');
        const bm04Date = new Date('2026-11-01T16:00:00.000Z');

        const reg = baseRegistration({
            status: 'DEFENSE_READY',
            outlineReviewStatus: 'PASSED',
            submissions: [
                {
                    id: 101,
                    fileUrl: '/uploads/bm01.pdf',
                    submittedAt: bm01Date,
                    task: { taskType: 'BM01_INITIAL_SUBMISSION' },
                },
            ],
            bm01Evaluations: [
                { id: 201, attemptNo: 1, outcome: 'PASSED', reviewedAt: bm01Date, createdAt: bm01Date },
            ],
            currentBM02Submission: {
                id: 301,
                outcome: 'APPROVED',
                submittedAt: bm02Date,
                reviewedAt: bm02Date,
            },
            bm03Record: {
                id: 401,
                advisorSignedAt: bm03Date,
                studentAckStatus: 'ACKNOWLEDGED',
                updatedAt: bm03Date,
            },
            bm04Evaluation: {
                id: 501,
                status: 'SIGNED_APPROVED',
                isLocked: true,
                signedAt: bm04Date,
                updatedAt: bm04Date,
            },
        });

        const ws = buildGuidanceWorkspace(reg, mentorActor, { allowedActions: [] });

        const bm01 = ws.forms.find((f) => f.code === 'BM01');
        expect(bm01.statusLabel).toBe('Đã duyệt');
        expect(bm01.updatedAt).toEqual(bm01Date);
        expect(bm01.actions).toEqual(
            expect.arrayContaining([expect.objectContaining({ code: 'VIEW', params: { registrationId: 42, submissionId: 101 } })])
        );

        const bm02 = ws.forms.find((f) => f.code === 'BM02');
        expect(bm02.statusLabel).toBe('Đã duyệt');
        expect(bm02.updatedAt).toEqual(bm02Date);
        expect(bm02.actions.map((a) => a.code)).toEqual(expect.arrayContaining(['VIEW', 'VIEW_PRINT']));

        const bm03 = ws.forms.find((f) => f.code === 'BM03');
        expect(bm03.statusLabel).toBe('Đã chốt');
        expect(bm03.updatedAt).toEqual(bm03Date);
        expect(bm03.actions.map((a) => a.code)).toEqual(expect.arrayContaining(['OPEN_PROGRESS', 'VIEW_PRINT']));

        const bm04 = ws.forms.find((f) => f.code === 'BM04');
        expect(bm04.statusLabel).toBe('Đã ký');
        expect(bm04.updatedAt).toEqual(bm04Date);
        expect(bm04.actions.map((a) => a.code)).toEqual(expect.arrayContaining(['VIEW_PRINT']));
    });

    test('BM05 unpublished never exposes VIEW_PRINT or score/comment data', () => {
        const reg = baseRegistration({
            status: 'DEFENDED',
            defenseCouncilId: 12,
            defenseResult: {
                id: 99,
                finalScore: 8.75,
                comments: 'Nhan xet hoi dong mat',
                isPublished: false,
                updatedAt: new Date('2026-11-10T10:00:00.000Z'),
            },
            resultPublicationItems: [],
        });

        const ws = buildGuidanceWorkspace(reg, mentorActor, { allowedActions: [] });
        const bm05 = ws.forms.find((f) => f.code === 'BM05');

        expect(bm05.statusLabel).toBe('Đang xử lý');
        expect(bm05.updatedAt).toBeNull();
        expect(bm05.actions).toEqual([]);
        const serialized = JSON.stringify(ws);
        expect(serialized).not.toContain('VIEW_PRINT');
        expect(serialized).not.toContain('8.75');
        expect(serialized).not.toContain('Nhan xet hoi dong mat');
    });

    test('BM05 published exposes VIEW_PRINT and publication timestamp', () => {
        const pubDate = new Date('2026-11-15T09:00:00.000Z');
        const reg = baseRegistration({
            status: 'COMPLETED',
            defenseResult: {
                id: 99,
                finalScore: 8.75,
                isPublished: true,
                updatedAt: pubDate,
            },
            resultPublicationItems: [
                {
                    id: 1,
                    createdAt: pubDate,
                    publication: { id: 5, semesterId: 9, type: 'INITIAL', publishedAt: pubDate },
                },
            ],
        });

        const ws = buildGuidanceWorkspace(reg, mentorActor, { allowedActions: [] });
        const bm05 = ws.forms.find((f) => f.code === 'BM05');

        expect(bm05.statusLabel).toBe('Đã công bố');
        expect(bm05.updatedAt).toEqual(pubDate);
        expect(bm05.actions).toEqual([
            expect.objectContaining({ code: 'VIEW_PRINT', params: { registrationId: 42 } }),
        ]);
        expect(ws.nextAction).toBeNull();
    });

    test('sets nextAction to OPEN_PROGRESS when BM03 is in progress and mentor can issue checkpoint', () => {
        const reg = baseRegistration({
            status: 'IN_PROGRESS_BM03',
        });

        const ws = buildGuidanceWorkspace(reg, mentorActor, {
            allowedActions: ['ISSUE_CHECKPOINT_1'],
        });

        expect(ws.nextAction).toEqual(
            expect.objectContaining({
                code: 'OPEN_PROGRESS',
                params: { registrationId: 42 },
            })
        );
    });
});
