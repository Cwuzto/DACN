const {
    decideStopReview,
    submitStageEvaluation,
    advisorSignWholeBM03,
    createBM03Meeting,
} = require('../../src/services/bm03WorkflowService');

describe('BM03 Rejected Stop Recovery & Enum Safety (Fix P0.10, P0.12)', () => {
    let mockTx;
    let stageEvaluationsStore;
    let stopReviewsStore;
    let record;
    let registration;

    beforeEach(() => {
        stageEvaluationsStore = [];
        stopReviewsStore = [];
        record = {
            id: 501,
            registrationId: 101,
            effectiveTitleSnapshot: 'Hệ thống Quản lý Đồ án',
            midtermStageEvaluationId: 1,
            finalStageEvaluationId: 2,
            finalConclusion: 'PROPOSE_STOP',
            isClosedEarly: false,
            advisorSignedById: null,
            advisorSignedAt: null,
            advisorPayloadHash: null,
            studentAckStatus: null,
        };

        registration = {
            id: 101,
            status: 'STOP_REVIEW_PENDING',
            semesterId: 1,
            studentId: 201,
            semester: {
                id: 1,
                name: 'HK1 2026',
                bm03MidtermEvaluationOpenAt: new Date('2026-11-01T00:00:00Z'),
                bm03FinalizationOpenAt: new Date('2026-11-01T00:00:00Z'),
            },
            topic: {
                id: 301,
                title: 'Hệ thống Quản lý Đồ án',
                mentorId: 10,
                mentor: { id: 10, fullName: 'GVHD Test' },
            },
        };

        const initialStopReview = {
            id: 88,
            bm03RecordId: 501,
            stageEvaluationId: 2,
            registrationId: 101,
            stage: 'FINAL',
            status: 'STOP_REVIEW_PENDING',
            stopProposalSubmittedAt: new Date('2026-11-10T00:00:00Z'),
            stopReviewDeadline: new Date('2026-11-17T00:00:00Z'),
            extensionCount: 0,
            decision: null,
            reviewReason: null,
        };
        stopReviewsStore.push(initialStopReview);

        stageEvaluationsStore.push({
            id: 1,
            bm03RecordId: 501,
            registrationId: 101,
            stage: 'MIDTERM',
            comments: 'Đạt giữa kỳ',
            decision: 'CONTINUE',
            evaluatedById: 10,
        });

        stageEvaluationsStore.push({
            id: 2,
            bm03RecordId: 501,
            registrationId: 101,
            stage: 'FINAL',
            comments: 'Không hoàn thành nhiệm vụ, đề nghị dừng',
            decision: 'PROPOSE_STOP',
            evaluatedById: 10,
        });

        mockTx = {
            instituteStopReview: {
                findUnique: jest.fn(async ({ where }) => {
                    return stopReviewsStore.find((r) => r.id === where.id) || null;
                }),
                findFirst: jest.fn(async ({ where }) => {
                    return stopReviewsStore.find((r) => {
                        if (where.registrationId && r.registrationId !== where.registrationId) return false;
                        if (where.status?.in && !where.status.in.includes(r.status)) return false;
                        return true;
                    }) || null;
                }),
                updateMany: jest.fn(async ({ where, data }) => {
                    const match = stopReviewsStore.find((r) => r.id === where.id);
                    if (match) {
                        Object.assign(match, data);
                        return { count: 1 };
                    }
                    return { count: 0 };
                }),
            },
            bM03ProgressRecord: {
                findUnique: jest.fn(async ({ where }) => {
                    if (where.id === record.id || where.registrationId === record.registrationId) {
                        return {
                            ...record,
                            finalStageEvaluation: stageEvaluationsStore.find((e) => e.id === record.finalStageEvaluationId) || null,
                            registration,
                        };
                    }
                    return null;
                }),
                update: jest.fn(async ({ where, data }) => {
                    Object.assign(record, data);
                    return { ...record };
                }),
            },
            topicRegistration: {
                findUnique: jest.fn(async ({ where }) => {
                    if (where.id === registration.id) return { ...registration };
                    return null;
                }),
                update: jest.fn(async ({ where, data }) => {
                    Object.assign(registration, data);
                    return { ...registration };
                }),
            },
            bM03StageEvaluation: {
                create: jest.fn(async ({ data }) => {
                    const newEval = { id: stageEvaluationsStore.length + 1, ...data };
                    stageEvaluationsStore.push(newEval);
                    return newEval;
                }),
                findMany: jest.fn(async () => stageEvaluationsStore),
            },
            bM03MeetingEntry: {
                create: jest.fn(async ({ data }) => ({ id: 99, ...data })),
            },
            topic: {
                findUnique: jest.fn(async () => ({ id: 301, title: 'Hệ thống Quản lý Đồ án' })),
            },
            user: {
                findUnique: jest.fn(async ({ where }) => ({ id: where.id, department: 'Viện Công nghệ Số' })),
            },
            academicDelegation: {
                findFirst: jest.fn(async () => null),
            },
            electronicSignatureEvent: {
                create: jest.fn(async () => ({ id: 701 })),
            },
        };
    });

    test('FINAL stop rejection reopens review/signing without erasing audit history', async () => {
        // 1. Institute rejects stop proposal for FINAL stage
        const decided = await decideStopReview(
            {
                stopReviewId: 88,
                reviewerId: 99,
                decision: 'REJECT_STOP',
                reason: 'Sinh viên đã bổ sung minh chứng và hoàn thiện báo cáo.',
            },
            { tx: mockTx }
        );

        expect(decided.status).toBe('STOP_REJECTED');
        expect(decided.decision).toBe('REJECT_STOP');
        expect(decided.reviewReason).toBe('Sinh viên đã bổ sung minh chứng và hoàn thiện báo cáo.');

        // Verify finalStageEvaluationId link is cleared on BM03ProgressRecord
        expect(mockTx.bM03ProgressRecord.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 501 },
                data: expect.objectContaining({
                    finalStageEvaluationId: null,
                    finalConclusion: null,
                }),
            })
        );

        // Verify registration restored to IN_PROGRESS_BM03
        expect(mockTx.topicRegistration.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 101 },
                data: { status: 'IN_PROGRESS_BM03' },
            })
        );

        // 2. Advisor can now submit a NEW final evaluation without 409 conflict
        const evalResult = await submitStageEvaluation(
            {
                registrationId: 101,
                advisorId: 10,
                stage: 'FINAL',
                comments: 'Sinh viên đã tiếp thu ý kiến và hoàn thành đồ án tốt.',
                decision: 'CONTINUE_TO_BM04',
            },
            { tx: mockTx }
        );

        expect(evalResult.stageEvaluation).toBeDefined();
        expect(evalResult.stageEvaluation.decision).toBe('CONTINUE_TO_BM04');
        expect(mockTx.bM03ProgressRecord.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 501 },
                data: expect.objectContaining({
                    finalStageEvaluationId: evalResult.stageEvaluation.id,
                    finalConclusion: 'CONTINUE_TO_BM04',
                }),
            })
        );

        // 3. Advisor can now sign whole BM03 form
        const signed = await advisorSignWholeBM03(
            {
                bm03RecordId: 501,
                advisorId: 10,
                signatureImageId: 'sig-123',
            },
            { tx: mockTx }
        );

        expect(signed).toBeDefined();
        expect(signed.studentAckStatus).toBe('PENDING_STUDENT_ACKNOWLEDGEMENT');
    });

    test('ONLINE meeting mode serializes to MICROSOFT_TEAMS enum for Prisma', async () => {
        // Clear pending stop reviews so meeting creation is allowed
        stopReviewsStore.length = 0;
        registration.status = 'IN_PROGRESS_BM03';

        await createBM03Meeting(
            {
                registrationId: 101,
                advisorId: 10,
                meetingDate: '2026-11-12T00:00:00Z',
                meetingMode: 'ONLINE',
                locationOrLink: 'https://teams.microsoft.com/l/meetup-join/abc',
                discussionContent: 'Trao đổi qua Teams',
                studentCompletedWork: 'Hoàn thành tính năng đăng nhập',
                nextTasks: 'Làm giao diện báo cáo',
                progressRating: 'ON_TRACK',
            },
            { tx: mockTx }
        );

        expect(mockTx.bM03MeetingEntry.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    meetingMode: 'MICROSOFT_TEAMS',
                }),
            })
        );
    });
});
