const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock Prisma models for BM03
const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM03ProgressRecord = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockBM03MeetingEntry = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockBM03StageEvaluation = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockInstituteStopReview = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockTask = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockUser = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};

const mockAcademicDelegation = {
    findFirst: jest.fn(),
};

const mockElectronicSignatureEvent = {
    create: jest.fn(),
};

const mockAuditLog = {
    create: jest.fn(),
};

const mockTopicAssignmentDecisionItem = {
    findFirst: jest.fn(),
};

const mockTitleAdjustmentAppendixItem = {
    findFirst: jest.fn(),
};

const mockIdempotencyRecord = {
    findUnique: jest.fn(),
    create: jest.fn(),
};

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    bM03ProgressRecord: mockBM03ProgressRecord,
    bM03MeetingEntry: mockBM03MeetingEntry,
    bM03StageEvaluation: mockBM03StageEvaluation,
    instituteStopReview: mockInstituteStopReview,
    task: mockTask,
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    auditLog: mockAuditLog,
    topicAssignmentDecisionItem: mockTopicAssignmentDecisionItem,
    titleAdjustmentAppendixItem: mockTitleAdjustmentAppendixItem,
    idempotencyRecord: mockIdempotencyRecord,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));

const mockGenerateImmutableAcademicPdf = jest.fn().mockResolvedValue({
    fileUrl: 'https://storage.example.com/academic/bm03-final.pdf',
    fileName: 'bm03-final.pdf',
    pdfHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    pdfBuffer: Buffer.from('mock-pdf'),
});

jest.mock('../../src/services/academicPdfService', () => ({
    generateImmutableAcademicPdf: (...args) => mockGenerateImmutableAcademicPdf(...args),
}));

jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const {
    getBM03Record,
    getOrCreateBM03Record,
    createBM03Meeting,
    signBM03Meeting,
    submitStageEvaluation,
    requestMoreInfoForStopReview,
    decideStopReview,
    advisorSignWholeBM03,
    studentAcknowledgeBM03,
    BM03WorkflowError,
} = require('../../src/services/bm03WorkflowService');

const app = require('../../src/app');

function buildUser({ id, role, department = 'CNTT', permissions = [] }) {
    return {
        id,
        role,
        department,
        fullName: `${role} User`,
        email: `${role.toLowerCase()}${id}@test.vn`,
        code: `${role}-${id}`,
        isActive: true,
        studentProfile: role === 'STUDENT' ? {
            dateOfBirth: new Date('2002-05-15T00:00:00Z'),
            placeOfBirth: 'Hà Nội',
            className: 'CNTT1-K65',
            cohort: 'K65',
            major: 'Công nghệ thông tin',
        } : null,
        permissionGroups: permissions.length === 0 ? [] : [{
            permissionGroup: {
                code: `GROUP_${role}`,
                permissions: permissions.map((code) => ({ permission: { code } })),
            },
        }],
    };
}

describe('Task 5: Chặng 2 Backend — BM03 Guidance Meetings, Midterm/Final Evaluations, Institute Stop Review (7+3d SLA) & 48h Student Acknowledgement', () => {
    const studentId = 10;
    const advisorId = 20;
    const instituteReviewerId = 30;
    const otherLecturerId = 40;
    const registrationId = 100;
    const bm03RecordId = 500;

    let baseRegistration;
    let baseBM03Record;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        baseRegistration = {
            id: registrationId,
            studentId,
            status: 'IN_PROGRESS_BM03',
            stateVersion: 1,
            topic: {
                id: 42,
                title: 'Hệ thống nhận dạng biển số xe',
                mentorId: advisorId,
                mentor: { id: advisorId, fullName: 'TS. Nguyễn Văn Hướng Dẫn', department: 'CNTT' },
            },
            student: {
                id: studentId,
                fullName: 'Sinh Viên A',
                code: 'SV-20220001',
            },
        };

        baseBM03Record = {
            id: bm03RecordId,
            registrationId,
            effectiveTitleSnapshot: 'Hệ thống nhận dạng biển số xe',
            midtermStageEvaluationId: null,
            finalStageEvaluationId: null,
            finalConclusion: null,
            isClosedEarly: false,
            advisorSignedById: null,
            advisorSignedAt: null,
            advisorPayloadHash: null,
            advisorSignatureEventId: null,
            studentAckStatus: null,
            studentAckDeadlineAt: null,
            studentAckAt: null,
            studentComment: null,
            studentSignatureEventId: null,
            finalPdfFileUrl: null,
            meetings: [],
            stageEvaluations: [],
            stopReviews: [],
            registration: baseRegistration,
        };

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: studentId, role: 'STUDENT' };
            if (token === 'advisor-token') return { userId: advisorId, role: 'LECTURER' };
            if (token === 'reviewer-token') return { userId: instituteReviewerId, role: 'ADMIN' };
            if (token === 'other-lecturer-token') return { userId: otherLecturerId, role: 'LECTURER' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === studentId) return buildUser({ id: studentId, role: 'STUDENT', permissions: ['VIEW_MY_REGISTRATION', 'SUBMIT_TASK', 'CHECKPOINT_SIGN'] });
            if (where.id === advisorId) return buildUser({ id: advisorId, role: 'LECTURER', department: 'CNTT', permissions: ['BM03_MEETING_RECORD', 'BM03_STAGE_EVALUATE'] });
            if (where.id === instituteReviewerId) return buildUser({ id: instituteReviewerId, role: 'ADMIN', department: 'CNTT', permissions: ['BM03_STOP_REVIEW'] });
            if (where.id === otherLecturerId) return buildUser({ id: otherLecturerId, role: 'LECTURER', department: 'CNTT', permissions: ['BM03_MEETING_RECORD', 'BM03_STAGE_EVALUATE'] });
            return null;
        });

        mockTopicRegistration.findUnique.mockResolvedValue(baseRegistration);
        mockBM03ProgressRecord.findUnique.mockResolvedValue(baseBM03Record);
        mockBM03ProgressRecord.findFirst.mockResolvedValue(baseBM03Record);
    });

    describe('1. BM03 Record Initialization and Title Resolution (No Side-Effects on GET)', () => {
        it('getBM03Record is purely read-only: returns existing record and does NOT call create', async () => {
            const record = await getBM03Record(registrationId);
            expect(record).toBeDefined();
            expect(record.id).toBe(bm03RecordId);
            expect(mockBM03ProgressRecord.create).not.toHaveBeenCalled();
        });

        it('getBM03Record returns virtual projection without DB write when record does not exist yet', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce(null);
            mockTopicAssignmentDecisionItem.findFirst.mockResolvedValueOnce({
                approvedTitleSnapshot: 'Tên Đề Tài Theo Quyết Định Gốc',
                decision: { decisionNumber: 'QD-2026-01', decisionDate: new Date() },
            });

            const record = await getBM03Record(registrationId);
            expect(record).toBeDefined();
            expect(record.id).toBeNull();
            expect(record.isVirtualProjection).toBe(true);
            expect(record.effectiveTitleSnapshot).toBe('Tên Đề Tài Theo Quyết Định Gốc');
            expect(mockBM03ProgressRecord.create).not.toHaveBeenCalled();
        });

        it('getOrCreateBM03Record creates record with snapshot title from resolveEffectiveTopicTitle only when called by mutating actions', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce(null);
            mockTopicAssignmentDecisionItem.findFirst.mockResolvedValueOnce({
                approvedTitleSnapshot: 'Tên Đề Tài Theo Quyết Định Gốc',
                decision: { decisionNumber: 'QD-2026-01', decisionDate: new Date() },
            });
            mockBM03ProgressRecord.create.mockResolvedValueOnce({
                id: bm03RecordId,
                registrationId,
                effectiveTitleSnapshot: 'Tên Đề Tài Theo Quyết Định Gốc',
                meetings: [],
            });

            const record = await getOrCreateBM03Record(registrationId);
            expect(record).toBeDefined();
            expect(mockBM03ProgressRecord.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    registrationId,
                    effectiveTitleSnapshot: 'Tên Đề Tài Theo Quyết Định Gốc',
                }),
            }));
        });
    });

    describe('2. Meeting Creation & Advisor-Only Signing (Locked, Superseding v2)', () => {
        it('fails to create meeting if actor is not the advisor of the registration', async () => {
            await expect(
                createBM03Meeting({
                    registrationId,
                    advisorId: otherLecturerId,
                    meetingDate: new Date(),
                    meetingMode: 'IN_PERSON',
                    locationOrLink: 'Phòng 402-B1',
                    discussionContent: 'Thảo luận phương pháp',
                    studentCompletedWork: 'Tìm hiểu tài liệu YOLOv8',
                    nextTasks: 'Thu thập tập dữ liệu ảnh',
                    progressRating: 'ON_TRACK',
                })
            ).rejects.toThrow('Chỉ giảng viên hướng dẫn của đề tài mới có quyền ghi nhật ký buổi hướng dẫn.');
        });

        it('fails to create meeting if BM03 record is already closed early', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce({
                ...baseBM03Record,
                isClosedEarly: true,
                finalConclusion: 'STOPPED',
            });

            await expect(
                createBM03Meeting({
                    registrationId,
                    advisorId,
                    meetingDate: new Date(),
                    meetingMode: 'IN_PERSON',
                    locationOrLink: 'Phòng 402-B1',
                    discussionContent: 'Thảo luận phương pháp',
                    studentCompletedWork: 'Đã hoàn thành',
                    nextTasks: 'Nhiệm vụ tiếp theo',
                    progressRating: 'ON_TRACK',
                })
            ).rejects.toThrow(/đã được đóng sớm/);
        });

        it('creates initial meeting (versionNumber=1, isLocked=false)', async () => {
            const meetingData = {
                id: 1,
                bm03RecordId,
                registrationId,
                versionNumber: 1,
                supersedesEntryId: null,
                meetingDate: new Date(),
                meetingMode: 'IN_PERSON',
                locationOrLink: 'Phòng 402-B1',
                discussionContent: 'Thảo luận kiến trúc mô hình',
                studentCompletedWork: 'Cài đặt xong baseline model',
                remainingIssues: 'Dữ liệu thiếu nhãn ban đêm',
                nextTasks: 'Bổ sung 500 ảnh ban đêm',
                expectedDeadline: new Date(Date.now() + 7 * 86400 * 1000),
                progressRating: 'ON_TRACK',
                isLocked: false,
            };
            mockBM03MeetingEntry.create.mockResolvedValueOnce(meetingData);

            const meeting = await createBM03Meeting({
                registrationId,
                advisorId,
                ...meetingData,
            });

            expect(meeting.versionNumber).toBe(1);
            expect(mockBM03MeetingEntry.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    versionNumber: 1,
                    supersedesEntryId: null,
                    isLocked: false,
                    progressRating: 'ON_TRACK',
                }),
            }));
        });

        it('advisor signs meeting: verifies payloadHash, sets isLocked=true, records signature event (advisor only, no student signature)', async () => {
            const existingMeeting = {
                id: 1,
                bm03RecordId,
                registrationId,
                versionNumber: 1,
                meetingDate: new Date('2026-11-15T09:00:00Z'),
                meetingMode: 'IN_PERSON',
                locationOrLink: 'Phòng 402-B1',
                discussionContent: 'Nội dung trao đổi',
                studentCompletedWork: 'Công việc đã làm',
                remainingIssues: null,
                nextTasks: 'Công việc tiếp',
                expectedDeadline: null,
                progressRating: 'ON_TRACK',
                isLocked: false,
                registration: baseRegistration,
            };
            mockBM03MeetingEntry.findUnique.mockResolvedValueOnce(existingMeeting);
            mockElectronicSignatureEvent.create.mockResolvedValueOnce({ id: 99 });
            mockBM03MeetingEntry.update.mockResolvedValueOnce({
                ...existingMeeting,
                isLocked: true,
                advisorSignedById: advisorId,
                advisorSignedAt: new Date(),
                signatureEventId: 99,
            });

            const signed = await signBM03Meeting({
                meetingId: 1,
                advisorId,
                signatureImageId: 'sig-img-123',
                ipAddress: '127.0.0.1',
                userAgent: 'JestTest',
            });

            expect(signed.isLocked).toBe(true);
            expect(mockElectronicSignatureEvent.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    entityType: 'BM03_MEETING',
                    entityId: 1,
                    signerId: advisorId,
                    signerRole: 'ADVISOR',
                    action: 'SIGN',
                }),
            }));
            expect(mockBM03MeetingEntry.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    isLocked: true,
                    advisorSignedById: advisorId,
                }),
            }));
        });

        it('editing signed meeting creates v2 superseding v1 (supersedesEntryId=1, versionNumber=2)', async () => {
            const lockedMeetingV1 = {
                id: 1,
                bm03RecordId,
                registrationId,
                versionNumber: 1,
                isLocked: true,
                supersededBy: null,
                registration: baseRegistration,
            };
            mockBM03MeetingEntry.findUnique.mockResolvedValueOnce(lockedMeetingV1);

            const meetingV2Data = {
                id: 2,
                bm03RecordId,
                registrationId,
                versionNumber: 2,
                supersedesEntryId: 1,
                meetingDate: new Date(),
                meetingMode: 'ONLINE',
                locationOrLink: 'https://meet.google.com/xyz',
                discussionContent: 'Cập nhật lại kết quả thảo luận',
                studentCompletedWork: 'Bổ sung số liệu test mới',
                remainingIssues: null,
                nextTasks: 'Viết báo cáo chương 3',
                progressRating: 'ON_TRACK',
                isLocked: false,
            };
            mockBM03MeetingEntry.create.mockResolvedValueOnce(meetingV2Data);

            const v2 = await createBM03Meeting({
                registrationId,
                advisorId,
                supersedesEntryId: 1,
                ...meetingV2Data,
            });

            expect(v2.versionNumber).toBe(2);
            expect(mockBM03MeetingEntry.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    versionNumber: 2,
                    supersedesEntryId: 1,
                }),
            }));
        });
    });

    describe('3. Midterm and Final Stage Evaluations (CONTINUE, CONTINUE_TO_BM04, PROPOSE_STOP)', () => {
        it('submits midterm evaluation with CONTINUE -> student continues, midtermStageEvaluationId updated', async () => {
            const evalRecord = {
                id: 10,
                bm03RecordId,
                registrationId,
                stage: 'MIDTERM',
                comments: 'Tiến độ rất tốt, bám sát kế hoạch.',
                decision: 'CONTINUE',
                evaluatedById: advisorId,
                evaluatedAt: new Date(),
            };
            mockBM03StageEvaluation.create.mockResolvedValueOnce(evalRecord);
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                midtermStageEvaluationId: 10,
            });

            const result = await submitStageEvaluation({
                registrationId,
                advisorId,
                stage: 'MIDTERM',
                comments: 'Tiến độ rất tốt, bám sát kế hoạch.',
                decision: 'CONTINUE',
            });

            expect(result.stageEvaluation.decision).toBe('CONTINUE');
            expect(mockBM03StageEvaluation.create).toHaveBeenCalled();
            expect(mockBM03ProgressRecord.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: bm03RecordId },
                data: expect.objectContaining({ midtermStageEvaluationId: 10 }),
            }));
            expect(mockInstituteStopReview.create).not.toHaveBeenCalled();
        });

        it('submits midterm evaluation with PROPOSE_STOP -> creates InstituteStopReview (168h SLA) & sets registration to STOP_REVIEW_PENDING', async () => {
            const now = new Date('2026-11-20T10:00:00Z');
            const evalRecord = {
                id: 11,
                bm03RecordId,
                registrationId,
                stage: 'MIDTERM',
                comments: 'Sinh viên không tham gia các buổi hướng dẫn, không có tiến độ.',
                decision: 'PROPOSE_STOP',
                evaluatedById: advisorId,
                evaluatedAt: now,
            };
            mockBM03StageEvaluation.create.mockResolvedValueOnce(evalRecord);
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                midtermStageEvaluationId: 11,
            });
            mockInstituteStopReview.create.mockResolvedValueOnce({
                id: 201,
                bm03RecordId,
                stageEvaluationId: 11,
                registrationId,
                stage: 'MIDTERM',
                status: 'STOP_REVIEW_PENDING',
                stopProposalSubmittedAt: now,
                stopReviewDeadline: new Date(now.getTime() + 168 * 3600 * 1000),
                extensionCount: 0,
            });

            const result = await submitStageEvaluation({
                registrationId,
                advisorId,
                stage: 'MIDTERM',
                comments: 'Sinh viên không tham gia các buổi hướng dẫn, không có tiến độ.',
                decision: 'PROPOSE_STOP',
            }, { now });

            expect(result.stopReview).toBeDefined();
            expect(result.stopReview.status).toBe('STOP_REVIEW_PENDING');
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: expect.objectContaining({ status: 'STOP_REVIEW_PENDING' }),
            }));
            expect(mockInstituteStopReview.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    stage: 'MIDTERM',
                    status: 'STOP_REVIEW_PENDING',
                    stopReviewDeadline: new Date(now.getTime() + 168 * 3600 * 1000),
                }),
            }));
        });

        it('submits final evaluation with CONTINUE_TO_BM04 -> sets finalConclusion=CONTINUE_TO_BM04', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce({
                ...baseBM03Record,
                midtermStageEvaluationId: 10,
            });
            const evalRecord = {
                id: 12,
                bm03RecordId,
                registrationId,
                stage: 'FINAL',
                comments: 'Đã hoàn thành toàn bộ khối lượng nghiên cứu và sản phẩm thực nghiệm.',
                decision: 'CONTINUE_TO_BM04',
                evaluatedById: advisorId,
                evaluatedAt: new Date(),
            };
            mockBM03StageEvaluation.create.mockResolvedValueOnce(evalRecord);
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                finalStageEvaluationId: 12,
                finalConclusion: 'CONTINUE_TO_BM04',
            });

            const result = await submitStageEvaluation({
                registrationId,
                advisorId,
                stage: 'FINAL',
                comments: 'Đã hoàn thành toàn bộ khối lượng nghiên cứu và sản phẩm thực nghiệm.',
                decision: 'CONTINUE_TO_BM04',
            });

            expect(result.stageEvaluation.decision).toBe('CONTINUE_TO_BM04');
            expect(mockBM03ProgressRecord.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: bm03RecordId },
                data: expect.objectContaining({
                    finalStageEvaluationId: 12,
                    finalConclusion: 'CONTINUE_TO_BM04',
                }),
            }));
        });
    });

    describe('4. Institute Stop Review SLA (168h + 72h) & Decisions', () => {
        const stopReviewId = 201;
        const now = new Date('2026-11-22T08:00:00Z');
        const deadline168h = new Date(now.getTime() + 100 * 3600 * 1000); // still active

        it('requestMoreInfo extends stopReviewDeadline by exactly +72h (original + 72h, extensionCount=1)', async () => {
            const stopReview = {
                id: stopReviewId,
                registrationId,
                status: 'STOP_REVIEW_PENDING',
                stopReviewDeadline: deadline168h,
                extensionCount: 0,
                registration: baseRegistration,
            };
            mockInstituteStopReview.findUnique.mockResolvedValueOnce(stopReview);
            const expectedExtendedDeadline = new Date(deadline168h.getTime() + 72 * 3600 * 1000);

            mockInstituteStopReview.updateMany.mockResolvedValueOnce({ count: 1 });
            mockInstituteStopReview.findUnique.mockResolvedValueOnce({
                ...stopReview,
                status: 'MORE_INFO_REQUIRED',
                extensionCount: 1,
                stopReviewDeadline: expectedExtendedDeadline,
            });

            const updated = await requestMoreInfoForStopReview({
                stopReviewId,
                reviewerId: instituteReviewerId,
                note: 'Yêu cầu GVHD cung cấp thêm biên bản họp với sinh viên.',
            }, { now });

            expect(updated.status).toBe('MORE_INFO_REQUIRED');
            expect(updated.extensionCount).toBe(1);
            expect(updated.stopReviewDeadline.getTime()).toBe(expectedExtendedDeadline.getTime());
        });

        it('second requestMoreInfo fails with 409 EXTENSION_QUOTA_EXHAUSTED', async () => {
            const alreadyExtended = {
                id: stopReviewId,
                registrationId,
                status: 'MORE_INFO_REQUIRED',
                stopReviewDeadline: new Date(now.getTime() + 50 * 3600 * 1000),
                extensionCount: 1,
                registration: baseRegistration,
            };
            mockInstituteStopReview.findUnique.mockResolvedValueOnce(alreadyExtended);

            await expect(
                requestMoreInfoForStopReview({
                    stopReviewId,
                    reviewerId: instituteReviewerId,
                    note: 'Yêu cầu bổ sung lần 2',
                }, { now })
            ).rejects.toThrow('Chỉ được yêu cầu bổ sung thông tin và gia hạn duy nhất 1 lần.');
        });

        it('decideStopReview with APPROVE_STOP: closes BM03 early, finalConclusion=STOPPED, transitions registration to TERMINATED_FAILED_PROGRESS', async () => {
            const stopReview = {
                id: stopReviewId,
                bm03RecordId,
                registrationId,
                status: 'STOP_REVIEW_PENDING',
                stopReviewDeadline: deadline168h,
                extensionCount: 0,
                registration: baseRegistration,
            };
            mockInstituteStopReview.findUnique.mockResolvedValueOnce(stopReview);
            mockInstituteStopReview.updateMany.mockResolvedValueOnce({ count: 1 });
            mockInstituteStopReview.findUnique.mockResolvedValueOnce({
                ...stopReview,
                status: 'STOP_APPROVED',
                decision: 'APPROVE_STOP',
            });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                isClosedEarly: true,
                finalConclusion: 'STOPPED',
            });

            const result = await decideStopReview({
                stopReviewId,
                reviewerId: instituteReviewerId,
                decision: 'APPROVE_STOP',
                reason: 'Đồng ý dừng đề tài do sinh viên bỏ học không liên lạc được.',
            }, { now });

            expect(result.status).toBe('STOP_APPROVED');
            expect(mockBM03ProgressRecord.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: bm03RecordId },
                data: expect.objectContaining({
                    isClosedEarly: true,
                    finalConclusion: 'STOPPED',
                }),
            }));
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: expect.objectContaining({ status: 'TERMINATED_FAILED_PROGRESS' }),
            }));
        });

        it('decideStopReview with REJECT_STOP: sets STOP_REJECTED, registration remains active to continue', async () => {
            const stopReview = {
                id: stopReviewId,
                bm03RecordId,
                registrationId,
                status: 'STOP_REVIEW_PENDING',
                stopReviewDeadline: deadline168h,
                extensionCount: 0,
                registration: baseRegistration,
            };
            mockInstituteStopReview.findUnique.mockResolvedValueOnce(stopReview);
            mockInstituteStopReview.updateMany.mockResolvedValueOnce({ count: 1 });
            mockInstituteStopReview.findUnique.mockResolvedValueOnce({
                ...stopReview,
                status: 'STOP_REJECTED',
                decision: 'REJECT_STOP',
            });

            const result = await decideStopReview({
                stopReviewId,
                reviewerId: instituteReviewerId,
                decision: 'REJECT_STOP',
                reason: 'Viện nhận thấy sinh viên có lý do chính đáng và đề nghị GVHD gia hạn thêm thời gian.',
            }, { now });

            expect(result.status).toBe('STOP_REJECTED');
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: expect.objectContaining({ status: 'IN_PROGRESS_BM03' }),
            }));
        });

        it('decideStopReview fails with 409 CONCURRENT_UPDATE_CONFLICT if updateMany affects 0 rows', async () => {
            const stopReview = {
                id: stopReviewId,
                bm03RecordId,
                registrationId,
                status: 'STOP_REVIEW_PENDING',
                stopReviewDeadline: deadline168h,
                extensionCount: 0,
                registration: baseRegistration,
            };
            mockInstituteStopReview.findUnique.mockResolvedValueOnce(stopReview);
            mockInstituteStopReview.updateMany.mockResolvedValueOnce({ count: 0 }); // Concurrency conflict!

            await expect(
                decideStopReview({
                    stopReviewId,
                    reviewerId: instituteReviewerId,
                    decision: 'APPROVE_STOP',
                    reason: 'Concurrent approve',
                }, { now })
            ).rejects.toThrow('Đề xuất dừng đã được xử lý bởi phiên làm việc khác.');
        });
    });

    describe('5. Advisor Whole-Form Signing & 48h Student Acknowledgement Window', () => {
        const now = new Date('2026-11-25T14:00:00Z');

        it('fails whole-form signing if final conclusion is missing', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce({
                ...baseBM03Record,
                finalConclusion: null,
            });

            await expect(
                advisorSignWholeBM03({
                    bm03RecordId,
                    advisorId,
                    signatureImageId: 'sig-whole-01',
                }, { now })
            ).rejects.toThrow(/Chỉ được ký toàn phiếu BM03 khi đã có kết luận cuối cùng/);
        });

        it('advisor signs whole BM03: records signature event, opens 48h student acknowledgement window', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce({
                ...baseBM03Record,
                finalConclusion: 'CONTINUE_TO_BM04',
            });
            mockElectronicSignatureEvent.create.mockResolvedValueOnce({ id: 101 });
            const expected48hDeadline = new Date(now.getTime() + 48 * 3600 * 1000);

            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                finalConclusion: 'CONTINUE_TO_BM04',
                advisorSignedById: advisorId,
                advisorSignedAt: now,
                advisorSignatureEventId: 101,
                studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                studentAckDeadlineAt: expected48hDeadline,
            });

            const signed = await advisorSignWholeBM03({
                bm03RecordId,
                advisorId,
                signatureImageId: 'sig-whole-01',
                ipAddress: '127.0.0.1',
                userAgent: 'JestTest',
            }, { now });

            expect(signed.studentAckStatus).toBe('PENDING_STUDENT_ACKNOWLEDGEMENT');
            expect(signed.studentAckDeadlineAt.getTime()).toBe(expected48hDeadline.getTime());
            expect(mockElectronicSignatureEvent.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    entityType: 'BM03_RECORD',
                    entityId: bm03RecordId,
                    signerId: advisorId,
                    signerRole: 'ADVISOR',
                    action: 'SIGN',
                }),
            }));
        });
    });

    describe('6. Student Acknowledgement, PDF Generation, BM03_PASSED & Task(BM04) Opening', () => {
        const signedAt = new Date('2026-11-25T14:00:00Z');
        const deadline48h = new Date(signedAt.getTime() + 48 * 3600 * 1000);
        const within48h = new Date(signedAt.getTime() + 20 * 3600 * 1000);

        let signedRecord;

        beforeEach(() => {
            signedRecord = {
                ...baseBM03Record,
                finalConclusion: 'CONTINUE_TO_BM04',
                advisorSignedById: advisorId,
                advisorSignedAt: signedAt,
                advisorPayloadHash: 'hash-advisor-whole-bm03',
                advisorSignatureEventId: 101,
                studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                studentAckDeadlineAt: deadline48h,
                registration: baseRegistration,
                meetings: [
                    {
                        id: 1,
                        versionNumber: 1,
                        meetingDate: new Date('2026-11-10T09:00:00Z'),
                        meetingMode: 'IN_PERSON',
                        discussionContent: 'Nội dung v1 (đã bị sửa đổi)',
                        progressRating: 'BEHIND',
                        supersededBy: { id: 2, versionNumber: 2 }, // Superseded!
                    },
                    {
                        id: 2,
                        versionNumber: 2,
                        meetingDate: new Date('2026-11-10T09:00:00Z'),
                        meetingMode: 'IN_PERSON',
                        discussionContent: 'Nội dung v2 (chính xác)',
                        progressRating: 'ON_TRACK',
                        supersededBy: null, // Active!
                    },
                ],
            };
            mockBM03ProgressRecord.findUnique.mockResolvedValue(signedRecord);
        });

        it('fails if non-student attempts to acknowledge', async () => {
            await expect(
                studentAcknowledgeBM03({
                    bm03RecordId,
                    studentId: 999, // different student
                    action: 'ACKNOWLEDGED',
                }, { now: within48h })
            ).rejects.toThrow('Sinh viên không phải chủ sở hữu hồ sơ này.');
        });

        it('fails if student acknowledges after 48h deadline', async () => {
            const past48h = new Date(deadline48h.getTime() + 3600 * 1000);
            await expect(
                studentAcknowledgeBM03({
                    bm03RecordId,
                    studentId,
                    action: 'ACKNOWLEDGED',
                }, { now: past48h })
            ).rejects.toThrow(/Thời hạn 48 giờ để sinh viên xác nhận BM03 đã hết hạn/);
        });

        it('fails if student declines to acknowledge without reason/comment', async () => {
            await expect(
                studentAcknowledgeBM03({
                    bm03RecordId,
                    studentId,
                    action: 'DECLINED_TO_ACKNOWLEDGE',
                    comment: '',
                }, { now: within48h })
            ).rejects.toThrow(/Bắt buộc nhập lý do khi từ chối xác nhận BM03/);
        });

        it('student acknowledges: records signature event, generates immutable PDF filtering out superseded meetings, transitions registration to BM03_PASSED, and opens Task(BM04)', async () => {
            mockElectronicSignatureEvent.create.mockResolvedValueOnce({ id: 102 });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...signedRecord,
                studentAckStatus: 'ACKNOWLEDGED',
                studentAckAt: within48h,
                studentSignatureEventId: 102,
                finalPdfFileUrl: 'https://storage.example.com/academic/bm03-final.pdf',
            });
            mockTask.findFirst.mockResolvedValueOnce(null); // No existing BM04 task
            mockTask.create.mockResolvedValueOnce({ id: 301, taskType: 'BM04', status: 'OPEN' });

            const acknowledged = await studentAcknowledgeBM03({
                bm03RecordId,
                studentId,
                action: 'ACKNOWLEDGED',
                comment: 'Em đã xem và nhất trí với nhận xét của thầy.',
                ipAddress: '127.0.0.1',
                userAgent: 'JestTest',
            }, { now: within48h });

            expect(acknowledged.studentAckStatus).toBe('ACKNOWLEDGED');

            // Verify PDF generation received only active meeting (v2) and filtered out superseded meeting (v1)
            expect(mockGenerateImmutableAcademicPdf).toHaveBeenCalledWith(
                expect.objectContaining({
                    sections: expect.arrayContaining([
                        expect.objectContaining({
                            heading: '2. NHẬT KÝ CÁC BUỔI HƯỚNG DẪN',
                            lines: expect.arrayContaining([
                                expect.stringContaining('Nội dung v2 (chính xác)'),
                            ]),
                        }),
                    ]),
                }),
                expect.anything(),
            );

            // Ensure v1 does NOT appear in lines
            const pdfCallArgs = mockGenerateImmutableAcademicPdf.mock.calls[0][0];
            const meetingSection = pdfCallArgs.sections.find((s) => s.heading === '2. NHẬT KÝ CÁC BUỔI HƯỚNG DẪN');
            expect(meetingSection.lines.length).toBe(1);
            expect(meetingSection.lines[0]).not.toContain('đã bị sửa đổi');

            expect(mockElectronicSignatureEvent.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    entityType: 'BM03_RECORD',
                    entityId: bm03RecordId,
                    signerId: studentId,
                    signerRole: 'STUDENT',
                    action: 'ACKNOWLEDGE',
                }),
            }));
            expect(mockTopicRegistration.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: registrationId },
                data: expect.objectContaining({ status: 'BM03_PASSED' }),
            }));
            expect(mockTask.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    registrationId,
                    taskType: 'BM04',
                    status: 'OPEN',
                }),
            }));
        });
    });

    describe('7. HTTP Endpoints via Supertest', () => {
        it('GET /api/bm03/:registrationId returns BM03 record without mutating database', async () => {
            const res = await request(app)
                .get(`/api/bm03/${registrationId}`)
                .set('Authorization', 'Bearer student-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(bm03RecordId);
            expect(mockBM03ProgressRecord.create).not.toHaveBeenCalled();
        });

        it('POST /api/bm03/:registrationId/meetings creates meeting entry', async () => {
            mockBM03MeetingEntry.create.mockResolvedValueOnce({
                id: 1,
                bm03RecordId,
                registrationId,
                versionNumber: 1,
                isLocked: false,
                progressRating: 'ON_TRACK',
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/meetings`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    meetingDate: '2026-11-15T09:00:00Z',
                    meetingMode: 'IN_PERSON',
                    locationOrLink: 'Phòng 402-B1',
                    discussionContent: 'Thảo luận kiến trúc mô hình',
                    studentCompletedWork: 'Cài đặt xong baseline model',
                    nextTasks: 'Bổ sung ảnh dữ liệu',
                    progressRating: 'ON_TRACK',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(1);
        });

        it('POST /api/bm03/meetings/:id/sign signs meeting entry', async () => {
            mockBM03MeetingEntry.findUnique.mockResolvedValueOnce({
                id: 1,
                bm03RecordId,
                registrationId,
                versionNumber: 1,
                meetingDate: new Date('2026-11-15T09:00:00Z'),
                meetingMode: 'IN_PERSON',
                locationOrLink: 'Phòng 402-B1',
                discussionContent: 'Thảo luận kiến trúc mô hình',
                studentCompletedWork: 'Cài đặt xong baseline model',
                nextTasks: 'Bổ sung ảnh dữ liệu',
                progressRating: 'ON_TRACK',
                isLocked: false,
                registration: baseRegistration,
            });
            mockElectronicSignatureEvent.create.mockResolvedValueOnce({ id: 99 });
            mockBM03MeetingEntry.update.mockResolvedValueOnce({
                id: 1,
                isLocked: true,
                advisorSignedById: advisorId,
            });

            const res = await request(app)
                .post('/api/bm03/meetings/1/sign')
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    signatureImageId: 'sig-img-123',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.isLocked).toBe(true);
        });

        it('POST /api/bm03/:registrationId/midterm-evaluation submits midterm evaluation', async () => {
            mockBM03StageEvaluation.create.mockResolvedValueOnce({
                id: 10,
                bm03RecordId,
                registrationId,
                stage: 'MIDTERM',
                comments: 'Tiến độ tốt',
                decision: 'CONTINUE',
            });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                midtermStageEvaluationId: 10,
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/midterm-evaluation`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    comments: 'Tiến độ tốt',
                    decision: 'CONTINUE',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.stageEvaluation.decision).toBe('CONTINUE');
        });

        it('POST /api/bm03/:registrationId/final-evaluation submits final evaluation', async () => {
            mockBM03StageEvaluation.create.mockResolvedValueOnce({
                id: 12,
                bm03RecordId,
                registrationId,
                stage: 'FINAL',
                comments: 'Hoàn thành tốt',
                decision: 'CONTINUE_TO_BM04',
            });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                finalStageEvaluationId: 12,
                finalConclusion: 'CONTINUE_TO_BM04',
            });

            const res = await request(app)
                .post(`/api/bm03/${registrationId}/final-evaluation`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    comments: 'Hoàn thành tốt',
                    decision: 'CONTINUE_TO_BM04',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.stageEvaluation.decision).toBe('CONTINUE_TO_BM04');
        });

        it('POST /api/bm03/stop-reviews/:id/request-more-info extends deadline', async () => {
            const stopReview = {
                id: 201,
                registrationId,
                status: 'STOP_REVIEW_PENDING',
                stopReviewDeadline: new Date(Date.now() + 50 * 3600 * 1000),
                extensionCount: 0,
                registration: baseRegistration,
            };
            mockInstituteStopReview.findUnique.mockResolvedValueOnce(stopReview);
            mockInstituteStopReview.updateMany.mockResolvedValueOnce({ count: 1 });
            mockInstituteStopReview.findUnique.mockResolvedValueOnce({
                ...stopReview,
                status: 'MORE_INFO_REQUIRED',
                extensionCount: 1,
            });

            const res = await request(app)
                .post('/api/bm03/stop-reviews/201/request-more-info')
                .set('Authorization', 'Bearer reviewer-token')
                .send({
                    note: 'Cần thêm biên bản làm việc',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.extensionCount).toBe(1);
        });

        it('POST /api/bm03/stop-reviews/:id/decision makes institute decision', async () => {
            const stopReview = {
                id: 201,
                bm03RecordId,
                registrationId,
                status: 'STOP_REVIEW_PENDING',
                stopReviewDeadline: new Date(Date.now() + 50 * 3600 * 1000),
                extensionCount: 0,
                registration: baseRegistration,
            };
            mockInstituteStopReview.findUnique.mockResolvedValueOnce(stopReview);
            mockInstituteStopReview.updateMany.mockResolvedValueOnce({ count: 1 });
            mockInstituteStopReview.findUnique.mockResolvedValueOnce({
                ...stopReview,
                status: 'STOP_APPROVED',
                decision: 'APPROVE_STOP',
            });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                isClosedEarly: true,
                finalConclusion: 'STOPPED',
            });

            const res = await request(app)
                .post('/api/bm03/stop-reviews/201/decision')
                .set('Authorization', 'Bearer reviewer-token')
                .send({
                    decision: 'APPROVE_STOP',
                    reason: 'Chấp thuận đề nghị dừng',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('STOP_APPROVED');
        });

        it('POST /api/bm03/:id/advisor-sign signs whole BM03 form', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce({
                ...baseBM03Record,
                finalConclusion: 'CONTINUE_TO_BM04',
            });
            mockElectronicSignatureEvent.create.mockResolvedValueOnce({ id: 101 });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                advisorSignedById: advisorId,
                advisorSignedAt: new Date(),
                studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
            });

            const res = await request(app)
                .post(`/api/bm03/${bm03RecordId}/advisor-sign`)
                .set('Authorization', 'Bearer advisor-token')
                .send({
                    signatureImageId: 'sig-img-whole',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.studentAckStatus).toBe('PENDING_STUDENT_ACKNOWLEDGEMENT');
        });

        it('POST /api/bm03/:id/student-acknowledge acknowledges BM03 form', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce({
                ...baseBM03Record,
                finalConclusion: 'CONTINUE_TO_BM04',
                advisorSignedById: advisorId,
                advisorSignedAt: new Date(),
                advisorPayloadHash: 'hash-advisor-whole-bm03',
                studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                studentAckDeadlineAt: new Date(Date.now() + 24 * 3600 * 1000),
                registration: baseRegistration,
            });
            mockElectronicSignatureEvent.create.mockResolvedValueOnce({ id: 102 });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                studentAckStatus: 'ACKNOWLEDGED',
                finalPdfFileUrl: 'https://storage.example.com/academic/bm03-final.pdf',
            });
            mockTask.findFirst.mockResolvedValueOnce(null);
            mockTask.create.mockResolvedValueOnce({ id: 301, taskType: 'BM04', status: 'OPEN' });

            const res = await request(app)
                .post(`/api/bm03/${bm03RecordId}/student-acknowledge`)
                .set('Authorization', 'Bearer student-token')
                .send({
                    action: 'ACKNOWLEDGED',
                    comment: 'Đã xem và đồng ý',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.studentAckStatus).toBe('ACKNOWLEDGED');
        });

        it('POST /api/bm03/:id/student-decline declines to acknowledge BM03 form', async () => {
            mockBM03ProgressRecord.findUnique.mockResolvedValueOnce({
                ...baseBM03Record,
                finalConclusion: 'CONTINUE_TO_BM04',
                advisorSignedById: advisorId,
                advisorSignedAt: new Date(),
                advisorPayloadHash: 'hash-advisor-whole-bm03',
                studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
                studentAckDeadlineAt: new Date(Date.now() + 24 * 3600 * 1000),
                registration: baseRegistration,
            });
            mockElectronicSignatureEvent.create.mockResolvedValueOnce({ id: 103 });
            mockBM03ProgressRecord.update.mockResolvedValueOnce({
                ...baseBM03Record,
                studentAckStatus: 'DECLINED_TO_ACKNOWLEDGE',
                studentComment: 'Em không đồng ý với nhận xét này vì lý do XYZ',
                finalPdfFileUrl: 'https://storage.example.com/academic/bm03-final.pdf',
            });

            const res = await request(app)
                .post(`/api/bm03/${bm03RecordId}/student-decline`)
                .set('Authorization', 'Bearer student-token')
                .send({
                    comment: 'Em không đồng ý với nhận xét này vì lý do XYZ',
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.studentAckStatus).toBe('DECLINED_TO_ACKNOWLEDGE');
        });
    });
});
