const { ForbiddenError, NotFoundError } = require('../../src/utils/errors');
const { reviewOutlineRegistration } = require('../../src/services/outlineReviewService');
const { getAllRegistrations } = require('../../src/controllers/registrationController');
const { createMockReq, createMockRes, createNext } = require('../helpers/http');

jest.mock('../../src/config/database', () => ({
    $transaction: jest.fn(),
    topicRegistration: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
    },
    task: {
        groupBy: jest.fn().mockResolvedValue([]),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
}));

jest.mock('../../src/services/bm01WorkflowService', () => ({
    reviewBM01: jest.fn(),
}));

jest.mock('../../src/utils/semesterResolver', () => ({
    getDefaultSemester: jest.fn().mockResolvedValue({ id: 1 }),
}));

const prisma = require('../../src/config/database');
const { reviewBM01 } = require('../../src/services/bm01WorkflowService');

describe('Outline Review Council Authorization & Query Separation (Task 1)', () => {
    let mockDb;

    const sampleRegistration = {
        id: 101,
        studentId: 10,
        status: 'BM01_SUBMITTED',
        topic: { id: 5, title: 'Hệ thống Quản lý Khóa luận', mentorId: 99 },
        outlineCouncilId: 1,
        outlineCouncil: {
            id: 1,
            name: 'Hội đồng thẩm định đề cương số 01',
            members: [
                { id: 11, councilId: 1, lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                { id: 12, councilId: 1, lecturerId: 202, roleInCouncil: 'SECRETARY' },
                { id: 13, councilId: 1, lecturerId: 203, roleInCouncil: 'MEMBER' },
            ],
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockDb = {
            topicRegistration: {
                findUnique: jest.fn().mockResolvedValue(sampleRegistration),
            },
        };
        prisma.topicRegistration.findUnique.mockResolvedValue(sampleRegistration);
        prisma.topicRegistration.findMany.mockResolvedValue([]);
        reviewBM01.mockResolvedValue({
            evaluation: { id: 501, attemptNo: 1, outcome: 'PASSED' },
            targetStatus: 'BM01_PASSED',
            idempotent: false,
        });
    });

    describe('reviewOutlineRegistration permissions', () => {
        it('allows Council CHAIRMAN to review outline successfully', async () => {
            const result = await reviewOutlineRegistration({
                registrationId: 101,
                reviewerId: 201, // CHAIRMAN
                decision: 'PASSED',
                feedback: 'Đề cương tốt, thông qua.',
                idempotencyKey: 'key-chair-001',
            }, { db: mockDb });

            expect(result).toBeDefined();
            expect(result.targetStatus).toBe('BM01_PASSED');
            expect(reviewBM01).toHaveBeenCalledWith(
                expect.objectContaining({
                    registrationId: 101,
                    reviewerId: 201,
                    outcome: 'PASSED',
                    feedback: 'Đề cương tốt, thông qua.',
                }),
                expect.anything()
            );
        });

        it('allows Council SECRETARY to review outline successfully', async () => {
            const result = await reviewOutlineRegistration({
                registrationId: 101,
                reviewerId: 202, // SECRETARY
                decision: 'NEEDS_REVISION',
                feedback: 'Cần bổ sung phạm vi nghiên cứu.',
                idempotencyKey: 'key-sec-001',
            }, { db: mockDb });

            expect(result).toBeDefined();
            expect(reviewBM01).toHaveBeenCalledWith(
                expect.objectContaining({
                    registrationId: 101,
                    reviewerId: 202,
                    outcome: 'NEEDS_REVISION',
                    feedback: 'Cần bổ sung phạm vi nghiên cứu.',
                }),
                expect.anything()
            );
        });

        it('forbids Council MEMBER from reviewing outline and throws ForbiddenError', async () => {
            await expect(
                reviewOutlineRegistration({
                    registrationId: 101,
                    reviewerId: 203, // MEMBER
                    decision: 'PASSED',
                    feedback: 'Ủy viên thử duyệt',
                }, { db: mockDb })
            ).rejects.toThrow(ForbiddenError);

            expect(reviewBM01).not.toHaveBeenCalled();
        });

        it('forbids Lecturer NOT in outlineCouncil from reviewing outline and throws ForbiddenError', async () => {
            await expect(
                reviewOutlineRegistration({
                    registrationId: 101,
                    reviewerId: 299, // Outsider
                    decision: 'PASSED',
                    feedback: 'Người ngoài thử duyệt',
                }, { db: mockDb })
            ).rejects.toThrow(ForbiddenError);

            expect(reviewBM01).not.toHaveBeenCalled();
        });

        it('throws ForbiddenError when registration has no outlineCouncil assigned', async () => {
            mockDb.topicRegistration.findUnique.mockResolvedValue({
                ...sampleRegistration,
                outlineCouncilId: null,
                outlineCouncil: null,
            });

            await expect(
                reviewOutlineRegistration({
                    registrationId: 101,
                    reviewerId: 201,
                    decision: 'PASSED',
                }, { db: mockDb })
            ).rejects.toThrow(ForbiddenError);

            expect(reviewBM01).not.toHaveBeenCalled();
        });

        it('throws NotFoundError when registration does not exist', async () => {
            mockDb.topicRegistration.findUnique.mockResolvedValue(null);

            await expect(
                reviewOutlineRegistration({
                    registrationId: 9999,
                    reviewerId: 201,
                    decision: 'PASSED',
                }, { db: mockDb })
            ).rejects.toThrow(NotFoundError);
        });
    });

    describe('GET /api/registrations (getAllRegistrations) Council query filtering', () => {
        it('supports asCouncilMember=true to fetch all registrations assigned to council of the lecturer', async () => {
            prisma.topicRegistration.findMany.mockResolvedValue([
                { id: 101, status: 'BM01_SUBMITTED', topicId: 5 },
            ]);

            const req = createMockReq({
                query: { asCouncilMember: 'true', semesterId: '1' },
                user: { id: 202, role: 'LECTURER', permissions: ['OUTLINE_REVIEW'] },
            });
            const res = createMockRes();
            const next = createNext();

            await getAllRegistrations(req, res, next);

            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        outlineCouncil: {
                            members: {
                                some: {
                                    lecturerId: 202,
                                },
                            },
                        },
                        status: { in: ['BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_PASSED'] },
                        semesterId: 1,
                    }),
                })
            );

            // Ensure roleInCouncil is NOT constrained to CHAIRMAN when asCouncilMember=true
            const callArgs = prisma.topicRegistration.findMany.mock.calls[0][0];
            expect(callArgs.where.outlineCouncil.members.some.roleInCouncil).toBeUndefined();

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                })
            );
        });

        it('supports asCouncilChairman=true to fetch registrations where lecturer is CHAIRMAN', async () => {
            prisma.topicRegistration.findMany.mockResolvedValue([
                { id: 101, status: 'BM01_SUBMITTED', topicId: 5 },
            ]);

            const req = createMockReq({
                query: { asCouncilChairman: 'true', semesterId: '1' },
                user: { id: 201, role: 'LECTURER', permissions: ['OUTLINE_REVIEW'] },
            });
            const res = createMockRes();
            const next = createNext();

            await getAllRegistrations(req, res, next);

            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        outlineCouncil: {
                            members: {
                                some: {
                                    lecturerId: 201,
                                    roleInCouncil: 'CHAIRMAN',
                                },
                            },
                        },
                        status: { in: ['BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_PASSED'] },
                        semesterId: 1,
                    }),
                })
            );
        });

        it('preserves custom status query when passed alongside asCouncilMember=true', async () => {
            const req = createMockReq({
                query: { asCouncilMember: 'true', status: 'BM01_SUBMITTED', semesterId: '1' },
                user: { id: 203, role: 'LECTURER', permissions: ['OUTLINE_REVIEW'] }, // MEMBER
            });
            const res = createMockRes();
            const next = createNext();

            await getAllRegistrations(req, res, next);

            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        outlineCouncil: {
                            members: {
                                some: {
                                    lecturerId: 203,
                                },
                            },
                        },
                        status: 'BM01_SUBMITTED',
                        semesterId: 1,
                    }),
                })
            );
        });

        it('falls back to mentorId filter when neither asCouncilMember nor asCouncilChairman is passed', async () => {
            const req = createMockReq({
                query: { semesterId: '1' },
                user: { id: 201, role: 'LECTURER' },
            });
            const res = createMockRes();
            const next = createNext();

            await getAllRegistrations(req, res, next);

            expect(prisma.topicRegistration.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        topic: { mentorId: 201 },
                        semesterId: 1,
                    }),
                })
            );
        });
    });
});
