const {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    UnprocessableEntityError,
} = require('../../src/utils/errors');

const { getAssetPolicy } = require('../../src/storage/assetPolicyCatalog');
const { storedAssetService, StoredAssetServiceError } = require('../../src/services/storedAssetService');

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
                semesterId: 1,
                periodPolicyVersionId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({
                id: 1,
                outlineSubmissionOpenAt: new Date('2026-11-01T00:00:00Z'),
                outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z'),
                outlineAllowedExtensions: ['.pdf', '.docx'],
                outlineMaxFileSizeBytes: 20 * 1024 * 1024,
            });
            mockTx.task.findFirst.mockResolvedValue(null);
            mockTx.task.create.mockResolvedValue({ id: 201, taskType: 'BM01_INITIAL_SUBMISSION' });
            mockTx.submission.create.mockResolvedValue({ id: 301, registrationId: 101, fileUrl: fileData.fileUrl });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue(null);
            mockTx.bM01Evaluation.create.mockResolvedValue({ id: 401, attemptNo: 1, submissionId: 301 });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 101, status: 'BM01_SUBMITTED' });

            const result = await submitInitialOutline(101, fileData, 10, { db: mockDb, now });

            expect(result.id).toBe(301);
            expect(mockTx.semester.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
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
            const now = new Date('2026-11-10T10:00:00Z');
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semesterId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({
                id: 1,
                outlineSubmissionOpenAt: new Date('2026-11-01T00:00:00Z'),
                outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z'),
                outlineAllowedExtensions: ['.pdf'],
                outlineMaxFileSizeBytes: 20 * 1024 * 1024,
            });
            mockTx.task.findFirst.mockResolvedValue({ id: 201 });
            mockTx.submission.create.mockResolvedValue({ id: 302 });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({ id: 401, submissionId: 301 });
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 0 });

            await expect(
                submitInitialOutline(101, fileData, 10, { db: mockDb, now })
            ).rejects.toThrow(ConflictError);
        });

        it('rejects submission if registration status is not APPROVED', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'REGISTERED',
                semesterId: 1,
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
                semesterId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({
                id: 1,
                outlineSubmissionOpenAt: new Date('2026-11-01T00:00:00Z'),
                outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z'),
                outlineAllowedExtensions: ['.pdf'],
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
                semesterId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({
                id: 1,
                outlineAllowedExtensions: ['.docx'],
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
            expect(mockTx.councilMember.findFirst).toHaveBeenCalledWith({
                where: {
                    councilId: 1,
                    lecturerId: 99,
                    roleInCouncil: 'CHAIRMAN',
                },
            });
        });

        it('throws BadRequestError if defenseDate is before outlineSubmissionDeadline', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
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
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
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
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
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
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
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

    describe('3. saveDraftResults (Validation Matrix & Batch Association)', () => {
        beforeEach(() => {
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'SECRETARY' });
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

        it('re-uses and updates existing unassigned evaluation (batchId: null) into the current batch', async () => {
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({
                id: 401,
                registrationId: 101,
                batchId: null,
                attemptNo: 1,
            });
            mockTx.bM01Evaluation.update.mockResolvedValue({
                id: 401,
                batchId: 1,
                initialOutcome: 'PASS',
                attendanceStatus: 'PRESENT',
            });

            const result = await saveDraftResults(
                1,
                101,
                { initialOutcome: 'PASS', attendanceStatus: 'PRESENT', comment: 'Tot' },
                6,
                { db: mockDb }
            );

            expect(result.initialOutcome).toBe('PASS');
            expect(mockTx.bM01Evaluation.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 401 },
                    data: expect.objectContaining({
                        batchId: 1,
                        councilId: 1,
                        initialOutcome: 'PASS',
                    }),
                })
            );
        });

        it('creates new evaluation if none exists', async () => {
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
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'SECRETARY' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'DRAFT' });
            mockTx.topicRegistration.count.mockResolvedValue(5);
            mockTx.bM01Evaluation.count.mockResolvedValue(4);

            await expect(
                completeSecretaryReview(1, 6, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });

        it('completes secretary review: changes batch status to PENDING_CHAIR', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'SECRETARY' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'DRAFT' });
            mockTx.topicRegistration.count.mockResolvedValue(5);
            mockTx.bM01Evaluation.count.mockResolvedValue(5);
            mockTx.councilResultBatch.update.mockResolvedValue({ id: 1, status: 'PENDING_CHAIR' });

            const result = await completeSecretaryReview(1, 6, { db: mockDb });
            expect(result.status).toBe('PENDING_CHAIR');
        });

        it('chair returns results to secretary with mandatory return reason', async () => {
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
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
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'PENDING_CHAIR' });

            await expect(
                returnResultsToSecretary(1, '', 5, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });
    });

    describe('5. publishCouncilResults (Chair publish & BM02 Task deduplication)', () => {
        beforeEach(() => {
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
            mockTx.councilResultBatch.findFirst.mockResolvedValue({ id: 1, status: 'PENDING_CHAIR' });
            mockTx.idempotencyRecord.findUnique.mockResolvedValue(null);
            mockTx.councilResultBatch.update.mockResolvedValue({ id: 1, status: 'PUBLISHED' });
        });

        it('transitions PASS to BM01_PASSED and creates BM02 task if not existing', async () => {
            mockTx.bM01Evaluation.findMany.mockResolvedValue([
                { id: 10, registrationId: 101, initialOutcome: 'PASS' },
            ]);
            mockTx.bM01Evaluation.update.mockResolvedValue({ id: 10, outcome: 'PASSED' });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 101, status: 'BM01_PASSED' });
            mockTx.task.findFirst.mockResolvedValue(null); // No existing BM02 task
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

        it('does not create duplicate BM02 task if already existing', async () => {
            mockTx.bM01Evaluation.findMany.mockResolvedValue([
                { id: 10, registrationId: 101, initialOutcome: 'PASS' },
            ]);
            mockTx.bM01Evaluation.update.mockResolvedValue({ id: 10, outcome: 'PASSED' });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 101, status: 'BM01_PASSED' });
            mockTx.task.findFirst.mockResolvedValue({ id: 701, taskType: 'BM02' }); // already exists

            await publishCouncilResults(1, 5, 'idem-pub-existing', { db: mockDb });

            expect(mockTx.task.create).not.toHaveBeenCalled();
        });

        it('transitions REVISION_REQUIRED / ABSENT to BM01_NEEDS_REVISION and FAIL to TERMINATED_BM01', async () => {
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
                    data: expect.objectContaining({ status: 'TERMINATED_BM01' }),
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
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
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
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
            const pastDeadline = new Date(Date.now() - 10000);

            await expect(
                setRevisionDeadline(1, pastDeadline, 5, { db: mockDb })
            ).rejects.toThrow(BadRequestError);
        });
    });

    describe('7. submitResubmissionOutline (Targeted Atomic Conditional Update)', () => {
        const fileData = {
            fileName: 'de_cuong_v2.pdf',
            fileUrl: 'https://storage/de_cuong_v2.pdf',
            fileSize: 1024 * 500,
        };

        it('successfully submits resubmission (v2) targeting latest evaluation and transitions to BM01_RESUBMITTED', async () => {
            const now = new Date('2026-11-12T10:00:00Z');
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 11,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: {
                    revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z'),
                },
            });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({
                id: 502,
                registrationId: 102,
                revisionSubmissionId: null,
            });
            mockTx.task.findFirst.mockResolvedValue({ id: 801, taskType: 'BM01_RESUBMISSION' });
            mockTx.submission.create.mockResolvedValue({ id: 901, registrationId: 102 });
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 1 });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 102, status: 'BM01_RESUBMITTED' });

            const result = await submitResubmissionOutline(102, fileData, 11, { db: mockDb, now });

            expect(result.id).toBe(901);
            expect(mockTx.bM01Evaluation.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 502, revisionSubmissionId: null },
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

        it('throws ConflictError(RESUBMISSION_ALREADY_USED) if latest evaluation already has revisionSubmissionId', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 11,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: {
                    revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z'),
                },
            });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({
                id: 502,
                registrationId: 102,
                revisionSubmissionId: 901,
            });

            await expect(
                submitResubmissionOutline(102, fileData, 11, {
                    db: mockDb,
                    now: new Date('2026-11-10T00:00:00Z'),
                })
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

    describe('8. reviewResubmission (Chair review & BM02 Task deduplication)', () => {
        beforeEach(() => {
            mockTx.councilMember.findFirst.mockResolvedValue({ roleInCouncil: 'CHAIRMAN' });
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                outlineCouncilId: 1,
                status: 'BM01_RESUBMITTED',
            });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({ id: 502, registrationId: 102 });
        });

        it('APPROVE transitions registration to BM01_PASSED and creates BM02 task if not existing', async () => {
            mockTx.bM01Evaluation.update.mockResolvedValue({ id: 502, outcome: 'PASSED' });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 102, status: 'BM01_PASSED' });
            mockTx.task.findFirst.mockResolvedValue(null);
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

    describe('9. reopenCouncilResults (Guard BM02 & Unique Constraint Safe Snapshot)', () => {
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

        it('successfully supersedes previous batch and clones evaluations with submissionId: null to respect @unique constraint', async () => {
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
                    submissionId: 301,
                    revisionSubmissionId: null,
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
                        submissionId: null,
                        revisionSubmissionId: null,
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

    describe('10. BM01 PDF Policy & Content Persistence (Task 1 & Task 2)', () => {
        const now = new Date('2026-11-10T10:00:00Z');
        const validV1Content = JSON.stringify({
            formCode: 'BM01',
            taskType: 'BM01_INITIAL_SUBMISSION',
            submittedAt: '1999-01-01T00:00:00.000Z',
            fields: {
                topicTitle: 'Hệ thống quản lý đồ án',
                objectives: 'Xây dựng quy trình nộp và duyệt trực tuyến',
                technologies: 'React, Node.js, PostgreSQL',
                deliverables: 'Mã nguồn, báo cáo đồ án',
            },
        });
        const validV2Content = JSON.stringify({
            formCode: 'BM01',
            taskType: 'BM01_RESUBMISSION',
            submittedAt: '1999-01-01T00:00:00.000Z',
            fields: {
                topicTitle: 'Hệ thống quản lý đồ án',
                revisionSummary: 'Đã bổ sung kiến trúc và kiểm thử bảo mật',
            },
        });

        let assertAssetSpy;

        beforeEach(() => {
            assertAssetSpy = jest.spyOn(storedAssetService, 'assertAssetAccess');
        });

        afterEach(() => {
            assertAssetSpy.mockRestore();
        });

        it('getAssetPolicy("BM01") allows only PDF up to 20 MB', () => {
            const policy = getAssetPolicy('BM01');
            expect(policy.extensions).toEqual(['pdf']);
            expect(policy.mimeTypes).toEqual(['application/pdf']);
            expect(policy.maxBytes).toBe(20971520);
        });

        it('rejects .docx on v1 even when legacy semester.outlineAllowedExtensions includes .docx', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semesterId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({
                id: 1,
                outlineAllowedExtensions: ['.docx', '.pdf'],
                outlineMaxFileSizeBytes: 20 * 1024 * 1024,
            });

            await expect(
                submitInitialOutline(
                    101,
                    {
                        fileName: 'legacy.docx',
                        fileUrl: 'https://storage/legacy.docx',
                        fileSize: 10240,
                        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    },
                    10,
                    { db: mockDb, now, content: validV1Content }
                )
            ).rejects.toThrow(BadRequestError);
            expect(mockTx.submission.create).not.toHaveBeenCalled();
            expect(mockTx.topicRegistration.update).not.toHaveBeenCalled();
        });

        it('rejects fake PDF (inspected asset is not application/pdf) and > 20 MB PDF', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semesterId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({
                id: 1,
                outlineMaxFileSizeBytes: 20 * 1024 * 1024,
            });

            assertAssetSpy.mockResolvedValue({
                id: 'asset-fake-pdf',
                documentType: 'BM01',
                ownerUserId: 10,
                registrationId: 101,
                extension: 'docx',
                detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                sizeBytes: BigInt(1024),
                scanStatus: 'PASSED',
            });

            await expect(
                submitInitialOutline(
                    101,
                    {
                        assetId: 'asset-fake-pdf',
                        fileName: 'fake.pdf',
                        fileUrl: 'https://storage/fake.pdf',
                        fileSize: 1024,
                        mimeType: 'application/pdf',
                    },
                    10,
                    { db: mockDb, now, content: validV1Content }
                )
            ).rejects.toThrow(BadRequestError);

            await expect(
                submitInitialOutline(
                    101,
                    {
                        fileName: 'huge.pdf',
                        fileUrl: 'https://storage/huge.pdf',
                        fileSize: 20 * 1024 * 1024 + 1,
                        mimeType: 'application/pdf',
                    },
                    10,
                    { db: mockDb, now, content: validV1Content }
                )
            ).rejects.toThrow(BadRequestError);

            expect(mockTx.submission.create).not.toHaveBeenCalled();
        });

        it('rejects .docx on v2 resubmission', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 11,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: { revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z') },
            });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({
                id: 502,
                registrationId: 102,
                revisionSubmissionId: null,
            });

            await expect(
                submitResubmissionOutline(
                    102,
                    {
                        fileName: 'v2.docx',
                        fileUrl: 'https://storage/v2.docx',
                        fileSize: 1024,
                    },
                    11,
                    { db: mockDb, now, content: validV2Content }
                )
            ).rejects.toThrow(BadRequestError);
            expect(mockTx.submission.create).not.toHaveBeenCalled();
        });

        it('persists normalized BM01 content (with server submittedAt) and assetId in v1 transaction', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semesterId: 1,
                periodPolicyVersionId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({
                id: 1,
                outlineSubmissionOpenAt: new Date('2026-11-01T00:00:00Z'),
                outlineSubmissionDeadline: new Date('2026-11-20T00:00:00Z'),
                outlineMaxFileSizeBytes: 20 * 1024 * 1024,
            });
            assertAssetSpy.mockResolvedValue({
                id: 'asset-pdf-101',
                documentType: 'BM01',
                ownerUserId: 10,
                registrationId: 101,
                originalName: 'de_cuong_v1.pdf',
                extension: 'pdf',
                detectedMime: 'application/pdf',
                sizeBytes: BigInt(50000),
                scanStatus: 'PASSED',
            });
            mockTx.task.findFirst.mockResolvedValue({ id: 201 });
            mockTx.submission.create.mockResolvedValue({
                id: 301,
                registrationId: 101,
                assetId: 'asset-pdf-101',
                fileName: 'de_cuong_v1.pdf',
                submittedAt: now,
            });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue(null);
            mockTx.bM01Evaluation.create.mockResolvedValue({ id: 401 });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 101, status: 'BM01_SUBMITTED' });

            const result = await submitInitialOutline(
                {
                    registrationId: 101,
                    fileData: {
                        assetId: 'asset-pdf-101',
                        fileName: 'de_cuong_v1.pdf',
                        fileUrl: 'https://storage/de_cuong_v1.pdf',
                        fileSize: 50000,
                        mimeType: 'application/pdf',
                    },
                    content: validV1Content,
                },
                10,
                { db: mockDb, now }
            );

            expect(result.id).toBe(301);
            const createCall = mockTx.submission.create.mock.calls[0][0].data;
            expect(createCall.assetId).toBe('asset-pdf-101');
            expect(createCall.fileName).toBe('de_cuong_v1.pdf');
            expect(createCall.submittedAt).toEqual(now);

            const savedContent = JSON.parse(createCall.content);
            expect(savedContent.formCode).toBe('BM01');
            expect(savedContent.taskType).toBe('BM01_INITIAL_SUBMISSION');
            expect(savedContent.submittedAt).toBe(now.toISOString());
            expect(savedContent.fields).toEqual({
                topicTitle: 'Hệ thống quản lý đồ án',
                objectives: 'Xây dựng quy trình nộp và duyệt trực tuyến',
                technologies: 'React, Node.js, PostgreSQL',
                deliverables: 'Mã nguồn, báo cáo đồ án',
            });
        });

        it('rejects v1 when BM01 content is missing required fields or asset belongs to another registration', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 101,
                studentId: 10,
                status: 'APPROVED',
                semesterId: 1,
            });
            mockTx.semester.findUnique.mockResolvedValue({ id: 1 });

            // Missing objectives
            await expect(
                submitInitialOutline(
                    101,
                    { fileName: 'de_cuong.pdf', fileUrl: 'https://storage/de_cuong.pdf', fileSize: 1024 },
                    10,
                    {
                        db: mockDb,
                        now,
                        content: JSON.stringify({
                            formCode: 'BM01',
                            taskType: 'BM01_INITIAL_SUBMISSION',
                            fields: { topicTitle: 'A' },
                        }),
                    }
                )
            ).rejects.toThrow(BadRequestError);

            // Asset belongs to another registration
            assertAssetSpy.mockResolvedValue({
                id: 'asset-other-reg',
                documentType: 'BM01',
                ownerUserId: 10,
                registrationId: 999,
                extension: 'pdf',
                detectedMime: 'application/pdf',
                sizeBytes: BigInt(1024),
                scanStatus: 'PASSED',
            });

            await expect(
                submitInitialOutline(
                    101,
                    {
                        assetId: 'asset-other-reg',
                        fileName: 'de_cuong.pdf',
                        fileUrl: 'https://storage/de_cuong.pdf',
                        fileSize: 1024,
                    },
                    10,
                    { db: mockDb, now, content: validV1Content }
                )
            ).rejects.toThrow(ForbiddenError);

            // Asset belongs to another user
            assertAssetSpy.mockRejectedValue(
                new StoredAssetServiceError('Unauthorized asset access', 'FORBIDDEN', 403)
            );
            await expect(
                submitInitialOutline(
                    101,
                    {
                        assetId: 'asset-other-user',
                        fileName: 'de_cuong.pdf',
                        fileUrl: 'https://storage/de_cuong.pdf',
                        fileSize: 1024,
                    },
                    10,
                    { db: mockDb, now, content: validV1Content }
                )
            ).rejects.toThrow(ForbiddenError);

            expect(mockTx.submission.create).not.toHaveBeenCalled();
            expect(mockTx.topicRegistration.update).not.toHaveBeenCalled();
        });

        it('persists normalized BM01 content and assetId in v2 resubmission and enforces idempotency key', async () => {
            mockTx.topicRegistration.findUnique.mockResolvedValue({
                id: 102,
                studentId: 11,
                status: 'BM01_NEEDS_REVISION',
                outlineCouncil: { revisionSubmissionDeadline: new Date('2026-11-15T00:00:00Z') },
            });
            mockTx.bM01Evaluation.findFirst.mockResolvedValue({
                id: 502,
                registrationId: 102,
                revisionSubmissionId: null,
            });
            assertAssetSpy.mockResolvedValue({
                id: 'asset-pdf-v2',
                documentType: 'BM01',
                ownerUserId: 11,
                registrationId: 102,
                extension: 'pdf',
                detectedMime: 'application/pdf',
                sizeBytes: BigInt(20480),
                scanStatus: 'PASSED',
            });
            mockTx.task.findFirst.mockResolvedValue({ id: 801 });
            mockTx.idempotencyRecord.findUnique.mockResolvedValue(null);
            mockTx.submission.create.mockResolvedValue({
                id: 901,
                registrationId: 102,
                assetId: 'asset-pdf-v2',
                fileName: 'v2.pdf',
                submittedAt: now,
            });
            mockTx.bM01Evaluation.updateMany.mockResolvedValue({ count: 1 });
            mockTx.topicRegistration.update.mockResolvedValue({ id: 102, status: 'BM01_RESUBMITTED' });

            const firstResult = await submitResubmissionOutline(
                {
                    registrationId: 102,
                    fileData: {
                        assetId: 'asset-pdf-v2',
                        fileName: 'v2.pdf',
                        fileUrl: 'https://storage/v2.pdf',
                        fileSize: 20480,
                    },
                    content: validV2Content,
                    idempotencyKey: 'bm01-v2-key-1',
                },
                11,
                { db: mockDb, now }
            );

            expect(firstResult.id).toBe(901);
            const createCall = mockTx.submission.create.mock.calls[0][0].data;
            const savedContent = JSON.parse(createCall.content);
            expect(savedContent.formCode).toBe('BM01');
            expect(savedContent.taskType).toBe('BM01_RESUBMISSION');
            expect(savedContent.submittedAt).toBe(now.toISOString());
            expect(savedContent.fields.revisionSummary).toBe('Đã bổ sung kiến trúc và kiểm thử bảo mật');
            expect(mockTx.idempotencyRecord.create).toHaveBeenCalledTimes(1);

            // Replay with same idempotencyKey and same payload
            const createdRecord = mockTx.idempotencyRecord.create.mock.calls[0][0].data;
            mockTx.idempotencyRecord.findUnique.mockResolvedValue(createdRecord);
            mockTx.submission.create.mockClear();

            const replayResult = await submitResubmissionOutline(
                {
                    registrationId: 102,
                    fileData: {
                        assetId: 'asset-pdf-v2',
                        fileName: 'v2.pdf',
                        fileUrl: 'https://storage/v2.pdf',
                        fileSize: 20480,
                    },
                    content: validV2Content,
                    idempotencyKey: 'bm01-v2-key-1',
                },
                11,
                { db: mockDb, now }
            );
            expect(replayResult.id).toBe(901);
            expect(mockTx.submission.create).not.toHaveBeenCalled();

            // Reuse same idempotencyKey with different payload -> UnprocessableEntityError
            await expect(
                submitResubmissionOutline(
                    {
                        registrationId: 102,
                        fileData: {
                            assetId: 'asset-pdf-v2',
                            fileName: 'v2-different.pdf',
                            fileUrl: 'https://storage/v2-different.pdf',
                            fileSize: 20480,
                        },
                        content: validV2Content,
                        idempotencyKey: 'bm01-v2-key-1',
                    },
                    11,
                    { db: mockDb, now }
                )
            ).rejects.toThrow(UnprocessableEntityError);
        });
    });
});
