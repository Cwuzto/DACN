const request = require('supertest');
const jwt = require('jsonwebtoken');

// Prepare mocked Prisma database for testing
const mockTopicRegistration = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
};

const mockTopicAssignmentDecision = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
};

const mockTopicAssignmentDecisionItem = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
};

const mockBM02AAdjustmentRequest = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
};

const mockBM02AFormVersion = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
};

const mockTitleAdjustmentAppendix = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
};

const mockTitleAdjustmentAppendixItem = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
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

const mockPrisma = {
    topicRegistration: mockTopicRegistration,
    topicAssignmentDecision: mockTopicAssignmentDecision,
    topicAssignmentDecisionItem: mockTopicAssignmentDecisionItem,
    bM02AAdjustmentRequest: mockBM02AAdjustmentRequest,
    bM02AFormVersion: mockBM02AFormVersion,
    titleAdjustmentAppendix: mockTitleAdjustmentAppendix,
    titleAdjustmentAppendixItem: mockTitleAdjustmentAppendixItem,
    user: mockUser,
    academicDelegation: mockAcademicDelegation,
    electronicSignatureEvent: mockElectronicSignatureEvent,
    auditLog: mockAuditLog,
    $transaction: jest.fn((callback) => callback(mockPrisma)),
};

jest.mock('../../src/config/database', () => mockPrisma);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/services/academicPdfService', () => ({
    generateImmutableAcademicPdf: jest.fn().mockResolvedValue({
        fileUrl: 'https://storage.example.com/academic/bm02a-final.pdf',
        fileName: 'bm02a-final.pdf',
        pdfHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        pdfBuffer: Buffer.from('mock-pdf'),
    }),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
    sign: jest.fn().mockReturnValue('mock-token'),
}));

const {
    createBM02ARequest,
    studentSignAndSubmitBM02A,
    advisorSignBM02A,
    departmentSignBM02A,
    returnBM02A,
    reviseBM02A,
} = require('../../src/services/bm02aWorkflowService');

const {
    createAppendixDraft,
    updateAppendixItems,
    issueAppendix,
} = require('../../src/services/titleAdjustmentAppendixService');

const { resolveEffectiveTopicTitle } = require('../../src/services/topicTitleResolverService');
const { computeCanonicalPayloadHash } = require('../../src/services/electronicSignatureService');

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

describe('Task 3: Chặng 1B — BM02-A 3-Signature Workflow & Batch Appendices', () => {
    const studentId = 10;
    const advisorId = 20;
    const departmentHeadId = 30;
    const registrationId = 100;
    const decisionId = 5;

    let baseDecisionPublishedAt;
    let deadline168h;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';

        baseDecisionPublishedAt = new Date(Date.now() - 3600 * 1000); // 1 hour ago
        deadline168h = new Date(baseDecisionPublishedAt.getTime() + 168 * 3600 * 1000); // ~7 days in future

        jwt.verify.mockImplementation((token) => {
            if (token === 'student-token') return { userId: studentId, role: 'STUDENT' };
            if (token === 'advisor-token') return { userId: advisorId, role: 'LECTURER' };
            if (token === 'dept-head-token') return { userId: departmentHeadId, role: 'LECTURER' };
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            throw new Error('invalid token');
        });

        mockUser.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === studentId) return buildUser({ id: studentId, role: 'STUDENT', permissions: ['RENAME_TOPIC'] });
            if (where.id === advisorId) return buildUser({ id: advisorId, role: 'LECTURER', department: 'CNTT', permissions: ['BM02A_ADVISOR_SIGN'] });
            if (where.id === departmentHeadId) return buildUser({ id: departmentHeadId, role: 'LECTURER', department: 'CNTT', permissions: ['BM02A_FINAL_APPROVE'] });
            if (where.id === 1) return buildUser({
                id: 1,
                role: 'ADMIN',
                department: 'CNTT',
                permissions: ['TITLE_ADJUSTMENT_APPENDIX_ISSUE', 'BM02A_FINAL_APPROVE'],
            });
            return null;
        });

        mockTopicRegistration.findUnique.mockResolvedValue({
            id: registrationId,
            studentId,
            titleAdjustmentDeadline: deadline168h,
            topic: {
                id: 42,
                title: 'Nghiên cứu thị giác máy tính',
                mentorId: advisorId,
                mentor: { id: advisorId, fullName: 'TS. Nguyễn Văn Hướng Dẫn', department: 'CNTT' },
            },
        });

        mockTopicAssignmentDecisionItem.findFirst.mockResolvedValue({
            id: 1,
            decisionId,
            registrationId,
            approvedTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
            decision: {
                id: decisionId,
                decisionNumber: 'QD-2026-001',
                decisionPublishedAt: baseDecisionPublishedAt,
                status: 'PUBLISHED',
            },
        });

        mockTopicAssignmentDecision.findUnique.mockResolvedValue({
            id: decisionId,
            decisionNumber: 'QD-2026-001',
            decisionPublishedAt: baseDecisionPublishedAt,
            status: 'PUBLISHED',
        });

        mockElectronicSignatureEvent.create.mockImplementation(async ({ data }) => ({
            id: Math.floor(Math.random() * 1000) + 1,
            ...data,
            signedAt: new Date(),
        }));
    });

    describe('1. BM02-A Creation and 168h Window Validation', () => {
        test('fails to create BM02-A if 168h window has expired', async () => {
            const pastDeadlineNow = new Date(deadline168h.getTime() + 1000); // 1 second after 168h

            await expect(
                createBM02ARequest({
                    registrationId,
                    studentId,
                    proposedTitle: 'Ứng dụng AI nhận diện cây trồng',
                    reason: 'Làm rõ phạm vi nghiên cứu theo thực tế triển khai',
                }, { now: pastDeadlineNow })
            ).rejects.toMatchObject({
                code: 'TITLE_ADJUSTMENT_WINDOW_CLOSED',
                statusCode: 409,
            });
        });

        test('successfully creates BM02-A request (v1, revisionCount=0, STUDENT_PREPARING) within 168h window', async () => {
            const validNow = new Date('2026-11-02T10:00:00Z');
            mockBM02AAdjustmentRequest.findFirst.mockResolvedValue(null);

            const mockCreatedVersion = {
                id: 11,
                requestId: 1,
                versionNumber: 1,
                studentSnapshot: {
                    fullName: 'STUDENT User',
                    studentCode: 'STUDENT-10',
                    dateOfBirth: new Date('2002-05-15T00:00:00Z'),
                    placeOfBirth: 'Hà Nội',
                    className: 'CNTT1-K65',
                    cohort: 'K65',
                    major: 'Công nghệ thông tin',
                },
                registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                proposedTitle: 'Ứng dụng AI nhận diện cây trồng thực địa',
                reason: 'Làm rõ phạm vi nghiên cứu theo đề cương chi tiết',
                payloadHash: 'hash-v1',
            };

            const mockCreatedRequest = {
                id: 1,
                registrationId,
                decisionId,
                status: 'STUDENT_PREPARING',
                revisionCount: 0,
                currentVersionNumber: 1,
                titleAdjustmentDeadline: deadline168h,
                createdById: studentId,
                versions: [mockCreatedVersion],
            };

            mockBM02AAdjustmentRequest.create.mockResolvedValue(mockCreatedRequest);
            mockBM02AFormVersion.create.mockResolvedValue(mockCreatedVersion);

            const result = await createBM02ARequest({
                registrationId,
                studentId,
                proposedTitle: 'Ứng dụng AI nhận diện cây trồng thực địa',
                reason: 'Làm rõ phạm vi nghiên cứu theo đề cương chi tiết',
            }, { now: validNow });

            expect(result).toBeDefined();
            expect(mockBM02AAdjustmentRequest.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    registrationId,
                    decisionId,
                    status: 'STUDENT_PREPARING',
                    revisionCount: 0,
                    currentVersionNumber: 1,
                }),
            }));
            expect(mockBM02AFormVersion.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    versionNumber: 1,
                    registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                    proposedTitle: 'Ứng dụng AI nhận diện cây trồng thực địa',
                }),
            }));
        });
    });

    describe('2. Student Sign and Submit BM02-A', () => {
        test('rejects student signature if payloadHash mismatches version payloadHash', async () => {
            const mockRequest = {
                id: 1,
                registrationId,
                createdById: studentId,
                currentVersionNumber: 1,
                status: 'STUDENT_PREPARING',
                titleAdjustmentDeadline: deadline168h,
                registration: {
                    id: registrationId,
                    studentId,
                    topic: { mentorId: advisorId },
                },
                versions: [{
                    id: 11,
                    versionNumber: 1,
                    payloadHash: 'canonical-hash-v1',
                    registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                    proposedTitle: 'Ứng dụng AI nhận diện cây trồng thực địa',
                    reason: 'Làm rõ phạm vi nghiên cứu',
                    studentSnapshot: {},
                }],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequest);

            await expect(
                studentSignAndSubmitBM02A({
                    requestId: 1,
                    studentId,
                    payloadHash: 'tampered-or-mismatched-hash',
                }, { now: new Date('2026-11-03T00:00:00Z') })
            ).rejects.toMatchObject({
                code: 'PAYLOAD_HASH_MISMATCH',
                statusCode: 409,
            });
        });

        test('records student signature and transitions request to PENDING_ADVISOR', async () => {
            const v1Payload = {
                registrationId,
                versionNumber: 1,
                registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                proposedTitle: 'Ứng dụng AI nhận diện cây trồng thực địa',
                reason: 'Làm rõ phạm vi nghiên cứu',
                studentSnapshot: { fullName: 'STUDENT User' },
            };
            const validHash = computeCanonicalPayloadHash(v1Payload);

            const mockRequest = {
                id: 1,
                registrationId,
                createdById: studentId,
                currentVersionNumber: 1,
                status: 'STUDENT_PREPARING',
                titleAdjustmentDeadline: deadline168h,
                registration: {
                    id: registrationId,
                    studentId,
                    topic: { mentorId: advisorId },
                },
                versions: [{
                    id: 11,
                    versionNumber: 1,
                    payloadHash: validHash,
                    registeredTitleSnapshot: v1Payload.registeredTitleSnapshot,
                    proposedTitle: v1Payload.proposedTitle,
                    reason: v1Payload.reason,
                    studentSnapshot: v1Payload.studentSnapshot,
                }],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequest);
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...mockRequest,
                status: 'PENDING_ADVISOR',
            });

            const result = await studentSignAndSubmitBM02A({
                requestId: 1,
                studentId,
                payloadHash: validHash,
                ipAddress: '127.0.0.1',
                userAgent: 'Jest',
            }, { now: new Date('2026-11-03T00:00:00Z') });

            expect(mockElectronicSignatureEvent.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    signerId: studentId,
                    signerRole: 'STUDENT',
                    action: 'SIGN',
                    payloadHash: validHash,
                }),
            }));
            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ status: 'PENDING_ADVISOR' }),
            }));
        });
    });

    describe('3. Advisor Sign / Return & Department Approval', () => {
        test('rejects non-advisor lecturer attempting to sign BM02-A', async () => {
            const mockRequest = {
                id: 1,
                registrationId,
                currentVersionNumber: 1,
                status: 'PENDING_ADVISOR',
                registration: {
                    topic: { mentorId: 999 }, // Different advisor
                },
                versions: [{ id: 11, versionNumber: 1, payloadHash: 'hash-1' }],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequest);

            await expect(
                advisorSignBM02A({
                    requestId: 1,
                    advisorId,
                    payloadHash: 'hash-1',
                })
            ).rejects.toMatchObject({
                code: 'FORBIDDEN_NOT_ADVISOR',
                statusCode: 403,
            });
        });

        test('advisor returns v1 within 168h -> transitions to RETURNED_FOR_CORRECTION', async () => {
            const mockRequest = {
                id: 1,
                registrationId,
                currentVersionNumber: 1,
                revisionCount: 0,
                status: 'PENDING_ADVISOR',
                titleAdjustmentDeadline: deadline168h,
                registration: {
                    topic: { mentorId: advisorId },
                },
                versions: [{
                    id: 11,
                    versionNumber: 1,
                    payloadHash: 'hash-v1',
                    studentSnapshot: {},
                }],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequest);
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...mockRequest,
                status: 'RETURNED_FOR_CORRECTION',
            });

            const result = await returnBM02A({
                requestId: 1,
                actorId: advisorId,
                actorRole: 'ADVISOR',
                reason: 'Cần viết cụ thể hơn phương pháp ứng dụng thị giác máy tính',
            }, { now: new Date('2026-11-04T00:00:00Z') });

            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ status: 'RETURNED_FOR_CORRECTION' }),
            }));
            expect(mockBM02AFormVersion.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 11 },
                data: expect.objectContaining({
                    returnedByRole: 'ADVISOR',
                    returnReason: 'Cần viết cụ thể hơn phương pháp ứng dụng thị giác máy tính',
                }),
            }));
        });

        test('advisor return on v2 or after 168h -> transitions to REJECTED_FINAL', async () => {
            const mockRequest = {
                id: 1,
                registrationId,
                currentVersionNumber: 2, // Already v2!
                revisionCount: 1,
                status: 'PENDING_ADVISOR',
                titleAdjustmentDeadline: deadline168h,
                registration: {
                    topic: { mentorId: advisorId },
                },
                versions: [{
                    id: 12,
                    versionNumber: 2,
                    payloadHash: 'hash-v2',
                    studentSnapshot: {},
                }],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequest);
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...mockRequest,
                status: 'REJECTED_FINAL',
            });

            await returnBM02A({
                requestId: 1,
                actorId: advisorId,
                actorRole: 'ADVISOR',
                reason: 'Nội dung v2 vẫn không đáp ứng yêu cầu',
            }, { now: new Date('2026-11-05T00:00:00Z') });

            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ status: 'REJECTED_FINAL' }),
            }));
        });
    });

    describe('4. Atomic Revision Guard (revisionCount=0) & Fresh v2 Payload Hash', () => {
        test('reviseBM02A atomically creates v2 (revisionCount=1, status=STUDENT_PREPARING) when revisionCount=0', async () => {
            const mockRequest = {
                id: 1,
                registrationId,
                createdById: studentId,
                status: 'RETURNED_FOR_CORRECTION',
                revisionCount: 0,
                currentVersionNumber: 1,
                titleAdjustmentDeadline: deadline168h,
                registration: { studentId },
                versions: [{
                    id: 11,
                    versionNumber: 1,
                    registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                    proposedTitle: 'Ứng dụng AI nhận diện cây trồng',
                    reason: 'Lý do v1',
                    studentSnapshot: { fullName: 'STUDENT User' },
                }],
            };

            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequest);
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 1 }); // Atomic conditional update succeeded

            const result = await reviseBM02A({
                requestId: 1,
                studentId,
                proposedTitle: 'Ứng dụng YOLOv8 nhận diện bệnh trên lá lúa',
                reason: 'Bổ sung mô hình YOLOv8 theo yêu cầu của GVHD',
            }, { now: new Date('2026-11-05T00:00:00Z') });

            expect(mockBM02AAdjustmentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    id: 1,
                    revisionCount: 0,
                    status: 'RETURNED_FOR_CORRECTION',
                }),
                data: expect.objectContaining({
                    revisionCount: 1,
                    currentVersionNumber: 2,
                    status: 'STUDENT_PREPARING',
                }),
            }));

            expect(mockBM02AFormVersion.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    requestId: 1,
                    versionNumber: 2,
                    proposedTitle: 'Ứng dụng YOLOv8 nhận diện bệnh trên lá lúa',
                }),
            }));
        });

        test('concurrent or second reviseBM02A call fails with 409 REVISION_LIMIT_EXCEEDED when revisionCount=0 check fails', async () => {
            const mockRequest = {
                id: 1,
                registrationId,
                createdById: studentId,
                status: 'RETURNED_FOR_CORRECTION',
                revisionCount: 1, // Already revised!
                currentVersionNumber: 2,
                titleAdjustmentDeadline: deadline168h,
                registration: { studentId },
                versions: [],
            };

            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequest);
            mockBM02AAdjustmentRequest.updateMany.mockResolvedValue({ count: 0 }); // Atomic check failed

            await expect(
                reviseBM02A({
                    requestId: 1,
                    studentId,
                    proposedTitle: 'Đổi tên lần 3',
                    reason: 'Cố tình sửa thêm lần nữa',
                }, { now: new Date('2026-11-05T00:00:00Z') })
            ).rejects.toMatchObject({
                code: 'REVISION_LIMIT_EXCEEDED',
                statusCode: 409,
            });
        });
    });

    describe('5. Advisor & Department Head Sign v2, PDF Lock & Status Transition', () => {
        test('allows advisor and department head to sign after 168h if student signed on time, generates PDF and locks version', async () => {
            const afterDeadline = new Date(deadline168h.getTime() + 24 * 3600 * 1000); // 1 day after 168h deadline

            const v2Payload = {
                registrationId,
                versionNumber: 2,
                registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                proposedTitle: 'Ứng dụng YOLOv8 nhận diện bệnh trên lá lúa',
                reason: 'Bổ sung mô hình YOLOv8',
                studentSnapshot: { fullName: 'STUDENT User' },
            };
            const v2Hash = computeCanonicalPayloadHash(v2Payload);

            // Step 5a: Advisor signs v2
            const mockRequestAdvisor = {
                id: 1,
                registrationId,
                currentVersionNumber: 2,
                status: 'PENDING_ADVISOR',
                titleAdjustmentDeadline: deadline168h,
                registration: {
                    id: registrationId,
                    topic: {
                        mentorId: advisorId,
                        mentor: { id: advisorId, fullName: 'TS. Nguyễn Văn Hướng Dẫn', department: 'CNTT' },
                    },
                },
                versions: [{
                    id: 12,
                    versionNumber: 2,
                    payloadHash: v2Hash,
                    registeredTitleSnapshot: v2Payload.registeredTitleSnapshot,
                    proposedTitle: v2Payload.proposedTitle,
                    reason: v2Payload.reason,
                    studentSnapshot: v2Payload.studentSnapshot,
                }],
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequestAdvisor);
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                ...mockRequestAdvisor,
                status: 'PENDING_DEPARTMENT_APPROVAL',
            });

            await advisorSignBM02A({
                requestId: 1,
                advisorId,
                payloadHash: v2Hash,
            }, { now: afterDeadline });

            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ status: 'PENDING_DEPARTMENT_APPROVAL' }),
            }));

            // Step 5b: Department head signs v2
            const mockRequestDept = {
                ...mockRequestAdvisor,
                status: 'PENDING_DEPARTMENT_APPROVAL',
            };
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockRequestDept);

            await departmentSignBM02A({
                requestId: 1,
                departmentHeadId,
                payloadHash: v2Hash,
            }, { now: afterDeadline });

            expect(mockElectronicSignatureEvent.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    signerId: departmentHeadId,
                    signerRole: 'DEPARTMENT_HEAD',
                    action: 'SIGN',
                    payloadHash: v2Hash,
                }),
            }));

            expect(mockBM02AFormVersion.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 12 },
                data: expect.objectContaining({ isLocked: true }),
            }));

            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({
                    status: 'APPROVED_PENDING_APPENDIX',
                    finalPayloadHash: v2Hash,
                }),
            }));
        });
    });

    describe('6. Batch Title Adjustment Appendices and Effective Title Resolution', () => {
        test('createAppendixDraft fails if any BM02-A is already in an active (DRAFT/ISSUED) appendix', async () => {
            mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue({
                id: 99,
                bm02aRequestId: 1,
                appendix: { status: 'DRAFT', appendixNumber: 'PL-2026-001' },
            });

            await expect(
                createAppendixDraft({
                    decisionId,
                    appendixNumber: 'PL-2026-002',
                    signedDate: new Date('2026-11-10T00:00:00Z'),
                    bm02aRequestIds: [1],
                    issuedById: 1,
                })
            ).rejects.toMatchObject({
                code: 'BM02A_ALREADY_IN_ACTIVE_APPENDIX',
                statusCode: 409,
            });
        });

        test('createAppendixDraft -> updateAppendixItems -> issueAppendix transitions BM02-A to ADJUSTMENT_ISSUED and activates new title', async () => {
            mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
            mockTitleAdjustmentAppendix.count.mockResolvedValue(0);

            const mockApprovedRequest = {
                id: 1,
                registrationId,
                decisionId,
                status: 'APPROVED_PENDING_APPENDIX',
                versions: [{
                    id: 12,
                    versionNumber: 2,
                    registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                    proposedTitle: 'Ứng dụng YOLOv8 nhận diện bệnh trên lá lúa',
                }],
            };
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([mockApprovedRequest]);
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue(mockApprovedRequest);

            const mockCreatedAppendix = {
                id: 50,
                decisionId,
                appendixNumber: 'PL-2026-001',
                sequenceNo: 1,
                signedDate: new Date('2026-11-10T00:00:00Z'),
                status: 'DRAFT',
                issuedById: 1,
                items: [{
                    id: 501,
                    appendixId: 50,
                    bm02aRequestId: 1,
                    registrationId,
                    oldTitle: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                    newTitle: 'Ứng dụng YOLOv8 nhận diện bệnh trên lá lúa',
                }],
            };

            mockTitleAdjustmentAppendix.create.mockResolvedValue(mockCreatedAppendix);
            mockTitleAdjustmentAppendix.findUnique.mockResolvedValue(mockCreatedAppendix);
            mockTitleAdjustmentAppendix.update.mockResolvedValue({
                ...mockCreatedAppendix,
                status: 'ISSUED',
            });

            // 1. Create draft
            const draft = await createAppendixDraft({
                decisionId,
                appendixNumber: 'PL-2026-001',
                signedDate: new Date('2026-11-10T00:00:00Z'),
                bm02aRequestIds: [1],
                issuedById: 1,
            });
            expect(draft.status).toBe('DRAFT');
            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ status: 'ASSIGNED_TO_APPENDIX' }),
            }));

            // 2. Issue appendix
            const issued = await issueAppendix({
                appendixId: 50,
                issuedById: 1,
                signedDate: new Date('2026-11-10T00:00:00Z'),
            });
            expect(issued.status).toBe('ISSUED');
            expect(mockBM02AAdjustmentRequest.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ status: 'ADJUSTMENT_ISSUED' }),
            }));

            // 3. Verify resolveEffectiveTopicTitle returns new title after appendix signedDate
            mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue({
                newTitle: 'Ứng dụng YOLOv8 nhận diện bệnh trên lá lúa',
                appendix: {
                    appendixNumber: 'PL-2026-001',
                    signedDate: new Date('2026-11-10T00:00:00Z'),
                },
            });

            const effectiveTitle = await resolveEffectiveTopicTitle(registrationId, new Date('2026-11-11T00:00:00Z'));
            expect(effectiveTitle).toEqual(expect.objectContaining({
                title: 'Ứng dụng YOLOv8 nhận diện bệnh trên lá lúa',
                source: 'APPENDIX',
                referenceNumber: 'PL-2026-001',
            }));
        });
    });

    describe('7. HTTP Endpoints via Supertest', () => {
        test('POST /api/bm02a/requests creates request', async () => {
            mockBM02AAdjustmentRequest.findFirst.mockResolvedValue(null);
            mockBM02AAdjustmentRequest.create.mockResolvedValue({
                id: 1,
                registrationId,
                status: 'STUDENT_PREPARING',
            });
            mockBM02AFormVersion.create.mockResolvedValue({
                id: 11,
                versionNumber: 1,
                payloadHash: 'hash-v1',
            });

            const res = await request(app)
                .post('/api/bm02a/requests')
                .set('Authorization', 'Bearer student-token')
                .send({
                    registrationId,
                    proposedTitle: 'Ứng dụng AI nông nghiệp mới',
                    reason: 'Lý do đổi tên',
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        test('POST /api/bm02a/requests/:id/student-sign-submit signs and submits request', async () => {
            const v1Payload = {
                registrationId,
                versionNumber: 1,
                registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                proposedTitle: 'Ứng dụng AI nông nghiệp mới',
                reason: 'Lý do đổi tên',
                studentSnapshot: {},
            };
            const validHash = computeCanonicalPayloadHash(v1Payload);

            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: 1,
                registrationId,
                createdById: studentId,
                currentVersionNumber: 1,
                status: 'STUDENT_PREPARING',
                titleAdjustmentDeadline: deadline168h,
                registration: { studentId, topic: { mentorId: advisorId } },
                versions: [{
                    id: 11,
                    versionNumber: 1,
                    payloadHash: validHash,
                    ...v1Payload,
                }],
            });
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                id: 1,
                status: 'PENDING_ADVISOR',
            });

            const res = await request(app)
                .post('/api/bm02a/requests/1/student-sign-submit')
                .set('Authorization', 'Bearer student-token')
                .send({ payloadHash: validHash });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('POST /api/bm02a/requests/:id/advisor-sign signs as advisor', async () => {
            const v1Payload = {
                registrationId,
                versionNumber: 1,
                registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                proposedTitle: 'Ứng dụng AI nông nghiệp mới',
                reason: 'Lý do đổi tên',
                studentSnapshot: {},
            };
            const validHash = computeCanonicalPayloadHash(v1Payload);
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: 1,
                registrationId,
                currentVersionNumber: 1,
                status: 'PENDING_ADVISOR',
                titleAdjustmentDeadline: deadline168h,
                registration: { topic: { mentorId: advisorId } },
                versions: [{ id: 11, versionNumber: 1, payloadHash: validHash, ...v1Payload }],
            });
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                id: 1,
                status: 'PENDING_DEPARTMENT_APPROVAL',
            });

            const res = await request(app)
                .post('/api/bm02a/requests/1/advisor-sign')
                .set('Authorization', 'Bearer advisor-token')
                .send({ payloadHash: validHash });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('POST /api/bm02a/requests/:id/department-sign signs as department head', async () => {
            const v1Payload = {
                registrationId,
                versionNumber: 1,
                registeredTitleSnapshot: 'Nghiên cứu thị giác máy tính trong nông nghiệp',
                proposedTitle: 'Ứng dụng AI nông nghiệp mới',
                reason: 'Lý do đổi tên',
                studentSnapshot: {},
            };
            const validHash = computeCanonicalPayloadHash(v1Payload);
            mockBM02AAdjustmentRequest.findUnique.mockResolvedValue({
                id: 1,
                registrationId,
                currentVersionNumber: 1,
                status: 'PENDING_DEPARTMENT_APPROVAL',
                titleAdjustmentDeadline: deadline168h,
                registration: {
                    topic: {
                        mentor: { department: 'CNTT' },
                    },
                },
                versions: [{ id: 11, versionNumber: 1, payloadHash: validHash, ...v1Payload }],
            });
            mockBM02AAdjustmentRequest.update.mockResolvedValue({
                id: 1,
                status: 'APPROVED_PENDING_APPENDIX',
            });
            mockBM02AFormVersion.update.mockResolvedValue({
                id: 11,
                isLocked: true,
            });

            const res = await request(app)
                .post('/api/bm02a/requests/1/department-sign')
                .set('Authorization', 'Bearer dept-head-token')
                .send({ payloadHash: validHash });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        test('POST /api/title-adjustment-appendices creates draft appendix', async () => {
            mockTitleAdjustmentAppendixItem.findFirst.mockResolvedValue(null);
            mockBM02AAdjustmentRequest.findMany.mockResolvedValue([{
                id: 1,
                registrationId,
                status: 'APPROVED_PENDING_APPENDIX',
                versions: [{ versionNumber: 1, registeredTitleSnapshot: 'Old Title', proposedTitle: 'New Title' }],
            }]);
            mockTitleAdjustmentAppendix.create.mockResolvedValue({
                id: 10,
                appendixNumber: 'PL-2026-001',
                status: 'DRAFT',
            });

            const res = await request(app)
                .post('/api/title-adjustment-appendices')
                .set('Authorization', 'Bearer admin-token')
                .send({
                    decisionId,
                    appendixNumber: 'PL-2026-001',
                    signedDate: new Date(),
                    bm02aRequestIds: [1],
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        test('POST /api/title-adjustment-appendices/:id/issue issues appendix', async () => {
            mockTitleAdjustmentAppendix.findUnique.mockResolvedValue({
                id: 10,
                status: 'DRAFT',
                items: [{ id: 1, bm02aRequestId: 1 }],
            });
            mockTitleAdjustmentAppendix.update.mockResolvedValue({
                id: 10,
                status: 'ISSUED',
            });

            const res = await request(app)
                .post('/api/title-adjustment-appendices/10/issue')
                .set('Authorization', 'Bearer admin-token')
                .send({ signedDate: new Date() });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
