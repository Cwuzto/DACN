const {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
} = require('../../src/utils/errors');

const {
    submitInitialOutline,
    publishCouncilSchedule,
    saveDraftResults,
    completeSecretaryReview,
    returnResultsToSecretary,
    publishCouncilResults,
    setRevisionDeadline,
    submitResubmissionOutline,
    reviewResubmission,
    reopenCouncilResults,
    finalizeOverdueResubmissions,
} = require('../../src/services/outlineReviewService');

const { runOutlineOverdueSweep } = require('../../src/services/outlineSweepService');

describe('outlineReviewService & outlineSweepService', () => {
    let mockTx;
    let mockDb;

    beforeEach(() => {
        mockTx = {
            topicRegistration: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
                count: jest.fn(),
            },
            semester: {
                findUnique: jest.fn(),
            },
            council: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            councilMember: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
            },
            councilResultBatch: {
                findFirst: jest.fn(),
                findUnique: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            bM01Evaluation: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
                count: jest.fn(),
            },
            task: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
            submission: {
                create: jest.fn(),
            },
            idempotencyRecord: {
                findUnique: jest.fn(),
                create: jest.fn(),
            },
            auditLog: {
                create: jest.fn(),
            },
        };

        mockDb = {
            $transaction: jest.fn(async (cb) => cb(mockTx)),
        };
    });

    describe('1. submitInitialOutline', () => {
        const fileData = {
            fileName: 'de_cuong.pdf',
            fileUrl: 'https://storage/de_cuong.pdf',
            fileSize: 1024 * 500,
            mimeType: 'application/pdf',
        };

        it('successfully submits initial outline (v1) and transitions registration to BM01_SUBMITTED', async () => {
            const now = new Date('2026-11-10T10:00:00Z');
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                periodPolicyVersionId: 1,
                semester: {
                    outlineSubmissionOpenAt: new Date('2026-11-01T00:00:00Z'),
                    outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z'),
                    outlineAllowedExtensions: ['.pdf', '.docx'],
                    outlineMaxFileSizeBytes: 20 * 1024 * 1024,
                },
            });
            mockTx.task.findFirst.mockResolvedValue(null);
            mockTx.task.create.mockResolvedValue({ id: 201, taskType: 'BM01_INITIAL_SUBMISSION' });
            mockTx.submission.create.mockResolvedValue({ id: 301, registrationId: 101, fileUrl: fileData.fileUrl });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue(null);
            mockTx.bM01Evaluation.create.mockResolvedValue({ id: 401, attemptNo: 1, submissionId: 301 });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 101, status: 'BM01_SUBMITTED' });

            const result = await submitInitialOutline(101, fileData, 10, { db: mockDb, now });

            expect(result.id).toBe(301);
            expect(mockTx.bM01Evaluation.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        registrationId: 101,
                        attemptNo: 1,
                        submissionId: 301,
                    }),
                })
            );
            expect(mockTx.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 101 },
                    data: expect.objectContaining({ status: 'BM01_SUBMITTED' }),
                })
            );
        });

        it('throws ConflictError(INITIAL_SUBMISSION_ALREADY_USED) when atomic updateMany count is 0', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semester: {
                    outlineSubmissionOpenAt: new Date('2026-11-01T00:00:00Z'),
                    outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z'),
                    outlineAllowedExtensions: ['.pdf'],
                    outlineMaxFileSizeBytes: 20 * 1024 * 1024,
                },
            });
            mockTx.task.findFirst.mockResolvedValue({ id: 201 });
            mockTx.submission.create.mockResolvedValue({ id: 302 });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({ id: 401, submissionId: 301 }); // already has submission
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 0 }); // conditional update matched nothing

            await expect(
                submitInitialOutline(101, fileData, 10, { db: mockDb })
            ).rejects.toThrow(ConflictError);
        });

        it('rejects submission if registration status is not APPROVED', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'REGISTERED',
                semester: {},
            });

            await expect(
                submitInitialOutline(101, fileData, 10, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('rejects submission when current time is outside deadline window', async () => {
            const now = new Date('2026-11-25T00:00:00Z');
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semester: {
                    outlineSubmissionOpenAt: new Date('2026-11-01T00:00:00Z'),
                    outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z'),
                    outlineAllowedExtensions: ['.pdf'],
                },
            });

            await expect(
                submitInitialOutline(101, fileData, 10, { db: mockDb, now })
            ).rejects.toThrow(BadRequestError);
        });

        it('rejects submission if file extension is not allowed', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semester: {
                    outlineAllowedExtensions: ['.docx'],
                },
            });

            await expect(
                submitInitialOutline(101, { fileName: 'bad.exe', fileUrl: 'http://bad' }, 10, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });
    });

    describe('2. publishCouncilSchedule', () => {
        it('throws ForbiddenError if actor is not CHAIRMAN', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue(null);

            await expect(
                publishCouncilSchedule(1, { defenseDate: '2026-12-01' }, 99, { db: mockDb })
            ).rejects.toThrow(ForbiddenError);
        });

        it('throws BadRequestError if defenseDate is before outlineSubmissionDeadline', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.council.findUnique.mockResolvedValue({
                id: 1,
                semester: { outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z') },
            });

            await expect(
                publishCouncilSchedule(
                    1,
                    { defenseDate: new Date('2026-11-15T00:00:00Z'), location: 'P.101', meetingMode: 'IN_PERSON' },
                    5,
                    { db: mockDb }
                )
            ).rejects.toThrow(BadRequestError);
        });

        it('throws BadRequestError if IN_PERSON mode has no location', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.council.findUnique.mockResolvedValue({
                id: 1,
                location: null,
                semester: { outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z') },
            });

            await expect(
                publishCouncilSchedule(
                    1,
                    { defenseDate: new Date('2026-11-25T00:00:00Z'), meetingMode: 'IN_PERSON', location: '' },
                    5,
                    { db: mockDb }
                )
            ).rejects.toThrow(BadRequestError);
        });

        it('throws BadRequestError if MICROSOFT_TEAMS mode has invalid URL', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.council.findUnique.mockResolvedValue({
                id: 1,
                semester: { outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z') },
            });

            await expect(
                publishCouncilSchedule(
                    1,
                    { defenseDate: new Date('2026-11-25T00:00:00Z'), meetingMode: 'MICROSOFT_TEAMS', meetingUrl: 'http://insecure.com' },
                    5,
                    { db: mockDb }
                )
            ).rejects.toThrow(BadRequestError);
        });

        it('successfully publishes council schedule', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.council.findUnique.mockResolvedValue({
                id: 1,
                semester: { outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z') },
            });
            mockTx.council.update.mockResolvedValue({
                id: 1,
                defenseDate: new Date('2026-11-25T00:00:00Z'),
                meetingMode: 'MICROSOFT_TEAMS',
                meetingUrl: 'https://teams.microsoft.com/l/meetup-join/123',
                schedulePublishedAt: new Date(),
            });

            const result = await publishCouncilSchedule(
                1,
                { defenseDate: new Date('2026-11-25T00:00:00Z'), meetingMode: 'MICROSOFT_TEAMS', meetingUrl: 'https://teams.microsoft.com/l/meetup-join/123' },
                5,
                { db: mockDb }
            );

            expect(result.schedulePublishedAt).toBeDefined();
            expect(mockTx.council.update).toHaveBeenCalled();
        });
    });

    describe('3. saveDraftResults (Validation Matrix)', () => {
        beforeEach(() => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'SECRETARY' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'DRAFT', versionNumber: 1 });
            mockTx.topicRegistration.findUnique.mockResolvedValue({ id: 101, periodPolicyVersionId: 1, outlineCouncilId: 1 });
        });

        it('enforces ABSENT requires attendanceStatus in ABSENT or EXCUSED', async () => {
            await expect(
                saveDraftResults(1, 101, { initialOutcome: 'ABSENT', attendanceStatus: 'PRESENT' }, 6, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('enforces PRESENT cannot have initialOutcome ABSENT', async () => {
            await expect(
                saveDraftResults(1, 101, { initialOutcome: 'ABSENT', attendanceStatus: 'PRESENT' }, 6, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('enforces REVISION_REQUIRED requires non-empty revisionRequirements', async () => {
            await expect(
                saveDraftResults(1, 101, { initialOutcome: 'REVISION_REQUIRED', revisionRequirements: '   ' }, 6, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('enforces FAIL requires non-empty comment', async () => {
            await expect(
                saveDraftResults(1, 101, { initialOutcome: 'FAIL', comment: '' }, 6, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('successfully saves valid draft evaluation', async () => {
            mockTx.bM01Evaluation.findFirst.mockResolvedValue(null);
            mockTx.bM01Evaluation.create.mockResolvedValue({ id: 501, initialOutcome: 'PASS', attendanceStatus: 'PRESENT' });

            const result = await saveDraftResults(
                1,
                101,
                { initialOutcome: 'PASS', attendanceStatus: 'PRESENT', comment: 'Tot' },
                6,
                { db: mockDb }
            );

            expect(result.initialOutcome).toBe('PASS');
            expect(mockTx.bM01Evaluation.create).toHaveBeenCalled();
        });
    });

    describe('4. completeSecretaryReview and returnResultsToSecretary', () => {
        it('blocks secretary complete if any student lacks evaluation', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'SECRETARY' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'DRAFT' });
            mockTx.topicRegistration.count.mockResolvedValue(5);
            mockTx.bM01Evaluation.count.mockResolvedValue(4); // missing 1

            await expect(
                completeSecretaryReview(1, 6, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('completes secretary review: changes batch status to PENDING_CHAIR', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'SECRETARY' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'DRAFT' });
            mockTx.topicRegistration.count.mockResolvedValue(5);
            mockTx.bM01Evaluation.count.mockResolvedValue(5);
            mockTx.councilResultBatch.update.mockResolvedValue({ id: 1, status: 'PENDING_CHAIR' });

            const result = await completeSecretaryReview(1, 6, { db: mockDb });
            expect(result.status).toBe('PENDING_CHAIR');
        });

        it('chair returns results to secretary with mandatory return reason', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'PENDING_CHAIR' });
            mockTx.councilResultBatch.update.mockResolvedValue({ id: 1, status: 'DRAFT', returnReason: 'Chua dat' });

            const result = await returnResultsToSecretary(1, 'Chua dat yeu cau ve cot diem', 5, { db: mockDb });
            expect(result.status).toBe('DRAFT');
            expect(mockTx.councilResultBatch.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ returnReason: 'Chua dat yeu cau ve cot diem' }),
                })
            );
        });

        it('rejects return if reason is empty', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'PENDING_CHAIR' });

            await expect(
                returnResultsToSecretary(1, '', 5, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });
    });

    describe('5. publishCouncilResults (Chair publish & BM02 Task creation)', () => {
        beforeEach(() => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'PENDING_CHAIR' });
            mockTx.idempotencyRecord.findUnique.mockResolvedValue(null);
            mockTx.councilResultBatch.update.mockResolvedValue({ id: 1, status: 'PUBLISHED' });
        });

        it('transitions PASS to BM01_PASSED and creates BM02 task', async () => {
            mockTx.bM01Evaluation.findMany.mockResolvedValue([
                { id: 10, registrationId: 101, initialOutcome: 'PASS' },
            ]);
            mockTx.bM01Evaluation.update.mockResolvedValue({ id: 10, outcome: 'PASSED' });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 101, status: 'BM01_PASSED' });
            mockTx.task.create.mockResolvedValue({ id: 701, taskType: 'BM02' });

            const result = await publishCouncilResults(1, 5, 'idem-pub-1', { db: mockDb });

            expect(result.status).toBe('PUBLISHED');
            expect(mockTx.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 101 },
                    data: expect.objectContaining({ status: 'BM01_PASSED' }),
                })
            );
            expect(mockTx.task.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ registrationId: 101, taskType: 'BM02', status: 'OPEN' }),
                })
            );
        });

        it('transitions REVISION_REQUIRED / FAIL / ABSENT to BM01_NEEDS_REVISION', async () => {
            mockTx.bM01Evaluation.findMany.mockResolvedValue([
                { id: 11, registrationId: 102, initialOutcome: 'REVISION_REQUIRED' },
                { id: 12, registrationId: 103, initialOutcome: 'FAIL' },
                { id: 13, registrationId: 104, initialOutcome: 'ABSENT' },
            ]);

            await publishCouncilResults(1, 5, 'idem-pub-2', { db: mockDb });

            expect(mockTx.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 102 },
                    data: expect.objectContaining({ status: 'BM01_NEEDS_REVISION' }),
                })
            );
            expect(mockTx.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 103 },
                    data: expect.objectContaining({ status: 'BM01_NEEDS_REVISION' }),
                })
            );
            expect(mockTx.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 104 },
                    data: expect.objectContaining({ status: 'BM01_NEEDS_REVISION' }),
                })
            );
        });
    });

    describe('6. setRevisionDeadline', () => {
        it('sets revisionSubmissionDeadline and activates BM01_RESUBMISSION task for BM01_NEEDS_REVISION students', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            const futureDeadline = new Date(Date.now() + 86400000 * 3);
            mockTx.council.update.mockResolvedValue({ id: 1, revisionSubmissionDeadline: futureDeadline });
            mockTx.topicRegistration.findMany.mockResolvedValue([
                { id: 102, status: 'BM01_NEEDS_REVISION' },
            ]);
            mockTx.task.findFirst.mockResolvedValue(null);
            mockTx.task.create.mockResolvedValue({ id: 801 });

            const result = await setRevisionDeadline(1, futureDeadline, 5, { db: mockDb });

            expect(result.revisionSubmissionDeadline).toBeDefined();
            expect(mockTx.task.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        registrationId: 102,
                        taskType: 'BM01_RESUBMISSION',
                        status: 'OPEN',
                        dueDate: futureDeadline,
                    }),
                })
            );
        });

        it('rejects deadline in the past', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            const pastDeadline = new Date(Date.now() - 10000);

            await expect(
                setRevisionDeadline(1, pastDeadline, 5, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });
    });

    describe('7. submitResubmissionOutline', () => {
        const fileData = {
            fileName: 'de_cuong_v2.pdf',
            fileUrl: 'https://storage/de_cuong_v2.pdf',
            fileSize: 1024 * 500,
        };

        it('successfully submits resubmission (v2) with conditional update and transitions to BM01_RESUBMITTED', async () => {
            const now = new Date('2026-11-12T10:00:00Z');
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 11,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: {
                    revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z'),
                },
            });
            mockTx.task.findFirst.mockResolvedValue({ id: 801, taskType: 'BM01_RESUBMISSION' });
            mockTx.submission.create.mockResolvedValue({ id: 901, registrationId: 102 });
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 1 });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 102, status: 'BM01_RESUBMITTED' });

            const result = await submitResubmissionOutline(102, fileData, 11, { db: mockDb, now });

            expect(result.id).toBe(901);
            expect(mockTx.bM01Evaluation.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId: 102, revisionSubmissionId: null },
                    data: { revisionSubmissionId: 901 },
                })
            );
            expect(mockTx.topicRegistration.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 102 },
                    data: expect.objectContaining({ status: 'BM01_RESUBMITTED' }),
                })
            );
        });

        it('throws ConflictError(RESUBMISSION_ALREADY_USED) on second resubmission call', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 11,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: {
                    revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z'),
                },
            });
            mockTx.task.findFirst.mockResolvedValue({ id: 801 });
            mockTx.submission.create.mockResolvedValue({ id: 902 });
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 0 }); // already has revisionSubmissionId

            await expect(
                submitResubmissionOutline(102, fileData, 11, { db: mockDb })
            ).rejects.toThrow(ConflictError);
        });

        it('rejects resubmission if deadline has passed', async () => {
            const now = new Date('2026-11-16T00:00:00Z');
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 11,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: {
                    revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z'),
                },
            });

            await expect(
                submitResubmissionOutline(102, fileData, 11, { db: mockDb, now })
            ).rejects.toThrow(BadRequestError);
        });
    });

    describe('8. reviewResubmission (Chair review)', () => {
        beforeEach(() => {
            mockTx.councilMember.findFirst.mockResolvedValue({ role: 'CHAIRMAN' });
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                outlineCouncilId: 1,
                status: 'BM01_RESUBMITTED',
            });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({ id: 502, registrationId: 102 });
        });

        it('APPROVE transitions registration to BM01_PASSED and creates BM02 task', async () => {
            mockTx.bM01Evaluation.update.mockResolvedValue({ id: 502, outcome: 'PASSED' });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 102, status: 'BM01_PASSED' });
            mockTx.task.create.mockResolvedValue({ id: 999 });

            const result = await reviewResubmission(1, 102, 'APPROVE', 'Sua tot', 5, { db: mockDb });

            expect(result.status).toBe('BM01_PASSED');
            expect(mockTx.bM01Evaluation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        revisionApprovalStatus: 'APPROVED',
                        outcome: 'PASSED',
                    }),
                })
            );
            expect(mockTx.task.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ registrationId: 102, taskType: 'BM02' }),
                })
            );
        });

        it('REJECT without feedback throws BadRequestError(REVISION_FEEDBACK_REQUIRED)', async () => {
            await expect(
                reviewResubmission(1, 102, 'REJECT', '', 5, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('REJECT with feedback transitions registration to TERMINATED_BM01', async () => {
            mockTx.bM01Evaluation.update.mockResolvedValue({ id: 502, outcome: 'TERMINATED' });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 102, status: 'TERMINATED_BM01' });

            const result = await reviewResubmission(1, 102, 'REJECT', 'Khong sua theo yeu cau', 5, { db: mockDb });

            expect(result.status).toBe('TERMINATED_BM01');
            expect(mockTx.bM01Evaluation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        revisionApprovalStatus: 'REJECTED',
                        outcome: 'TERMINATED',
                    }),
                })
            );
        });
    });

    describe('9. reopenCouncilResults (Guard BM02 & Snapshot Batch)', () => {
        beforeEach(() => {
            mockTx.councilResultBatch.findFirst.mockResolvedValue({
                id: 1,
                councilId: 1,
                versionNumber: 1,
                status: 'PUBLISHED',
            });
        });

        it('blocks reopen with ConflictError(BM02_DEPENDENCY_EXISTS) if any student has BM02 records', async () => {
            mockTx.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 101,
                    status: 'BM02_SUBMITTED',
                    student: { fullName: 'Nguyen Van A' },
                    bm02Submissions: [{ id: 1 }],
                },
            ]);

            try {
                await reopenCouncilResults(1, 'Dieu chinh diem', 1, { db: mockDb });
                throw new Error('Should have thrown ConflictError');
            } catch (err) {
                expect(err).toBeInstanceOf(ConflictError);
                expect(err.message).toBe('BM02_DEPENDENCY_EXISTS');
                expect(err.details?.blockingRegistrations?.length).toBe(1);
            }
        });

        it('successfully supersedes previous batch and clones evaluations to new REOPENED batch', async () => {
            mockTx.topicRegistration.findMany.mockResolvedValue([
                { id: 101, status: 'BM01_PASSED', bm02Submissions: [] },
                { id: 102, status: 'BM01_NEEDS_REVISION', bm02Submissions: [] },
            ]);
            mockTx.councilResultBatch.update.mockResolvedValue({ id: 1, status: 'SUPERSEDED' });
            mockTx.councilResultBatch.create.mockResolvedValue({
                id: 2,
                councilId: 1,
                versionNumber: 2,
                status: 'REOPENED',
            });
            mockTx.bM01Evaluation.findMany.mockResolvedValue([
                {
                    id: 10,
                    registrationId: 101,
                    attemptNo: 1,
                    policyVersionId: 1,
                    initialOutcome: 'PASS',
                    attendanceStatus: 'PRESENT',
                    comment: 'Tot',
                },
            ]);
            mockTx.bM01Evaluation.create.mockResolvedValue({ id: 20 });

            const newBatch = await reopenCouncilResults(1, 'Sua diem nham', 1, { db: mockDb });

            expect(newBatch.versionNumber).toBe(2);
            expect(newBatch.status).toBe('REOPENED');
            expect(mockTx.councilResultBatch.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: { status: 'SUPERSEDED' },
                })
            );
            expect(mockTx.bM01Evaluation.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        batchId: 2,
                        attemptNo: 2,
                        supersedesId: 10,
                    }),
                })
            );
        });
    });

    describe('10. Overdue Resubmissions & outlineSweepService', () => {
        it('finalizes overdue resubmissions for a council: sets TERMINATED_BM01 and task OVERDUE', async () => {
            const now = new Date('2026-11-20T00:00:00Z');
            mockTx.council.findUnique.mockResolvedValue({
                id: 1,
                revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z'),
            });
            mockTx.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 105,
                    status: 'BM01_NEEDS_REVISION',
                    bm01Evaluations: [{ id: 50, revisionSubmissionId: null }],
                    tasks: [{ id: 850, taskType: 'BM01_RESUBMISSION', status: 'OPEN' }],
                },
            ]);
            mockTx.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTx.task.updateMany.mockResolvedValue({ count: 1 });
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 1 });

            const result = await finalizeOverdueResubmissions(1, 5, { db: mockDb, now });

            expect(result.terminatedCount).toBe(1);
            expect(mockTx.topicRegistration.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: { in: [105] } },
                    data: { status: 'TERMINATED_BM01' },
                })
            );
            expect(mockTx.task.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: { in: [850] } },
                    data: { status: 'OVERDUE' },
                })
            );
        });

        it('outlineSweepService.runOutlineOverdueSweep scans all councils with expired deadlines', async () => {
            const now = new Date('2026-11-20T00:00:00Z');
            mockTx.topicRegistration.findMany.mockResolvedValue([
                {
                    id: 106,
                    status: 'BM01_NEEDS_REVISION',
                    outlineCouncil: {
                        revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z'),
                    },
                    bm01Evaluations: [{ id: 51, revisionSubmissionId: null }],
                    tasks: [{ id: 851, taskType: 'BM01_RESUBMISSION', status: 'OPEN' }],
                },
            ]);
            mockTx.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
            mockTx.task.updateMany.mockResolvedValue({ count: 1 });
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 1 });

            const result = await runOutlineOverdueSweep({ db: mockDb, now });

            expect(result.terminatedCount).toBe(1);
            expect(result.affectedRegistrationIds).toContain(106);
        });
    });
});
