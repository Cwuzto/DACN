const request = require('supertest');
const jwt = require('jsonwebtoken');

const mockDatabase = {
    $transaction: jest.fn(),
    user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    semester: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    rubricVersion: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    topicRegistration: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(),
    },
    council: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    councilMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
    },
    defenseResult: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
    },
    defenseMemberScore: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
    },
    defenseScoreBookReturnLog: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
    },
    defenseResultApproval: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
    },
    resultPublication: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
    },
    resultPublicationItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    projectArchive: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
    },
    defenseDocumentVersion: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    electronicSignatureEvent: {
        create: jest.fn().mockResolvedValue({ id: 888 }),
        findMany: jest.fn().mockResolvedValue([]),
    },
    idempotencyRecord: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
    },
    registrationStateHistory: {
        create: jest.fn().mockResolvedValue({}),
    },
    titleAdjustmentAppendixItem: {
        findFirst: jest.fn().mockResolvedValue(null),
    },
    notification: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
    },
    auditLog: {
        create: jest.fn().mockResolvedValue({}),
    },
};

mockDatabase.$transaction.mockImplementation(async (cb) => {
    if (typeof cb === 'function') {
        return cb(mockDatabase);
    }
    return Promise.resolve(cb);
});

jest.mock('../../src/config/database', () => mockDatabase);
jest.mock('../../src/services/auditLogService', () => ({
    auditLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('jsonwebtoken', () => ({
    verify: jest.fn(),
}));

const prisma = require('../../src/config/database');
const app = require('../../src/app');
const {
    hashScoreEvidence,
    createResultPublication,
} = require('../../src/services/defenseResultPublicationService');
const defenseScoringService = require('../../src/services/defenseScoringService');
const archivalWorkflowService = require('../../src/services/archivalWorkflowService');

const adminPerms = [
    {
        permissionGroup: {
            code: 'ADMIN_GROUP',
            permissions: [
                { permission: { code: 'DEFENSE_COUNCIL_MANAGE' } },
                { permission: { code: 'COUNCIL_VIEW' } },
                { permission: { code: 'CLEARANCE_CERTIFICATE_SIGN' } },
            ],
        },
    },
];

describe('Event-Driven Academic Notification Triggers & SEC-12 Verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        mockDatabase.$transaction.mockImplementation(async (cb) => {
            if (typeof cb === 'function') {
                return cb(mockDatabase);
            }
            return Promise.resolve(cb);
        });

        prisma.topicRegistration.updateMany.mockResolvedValue({ count: 1 });
        prisma.resultPublicationItem.findMany.mockResolvedValue([]);
        prisma.resultPublicationItem.findFirst.mockResolvedValue(null);

        jwt.verify.mockImplementation((token) => {
            if (token === 'admin-token') return { userId: 1, role: 'ADMIN' };
            if (token === 'director-token') return { userId: 5, role: 'ADMIN' };
            if (token === 'lecturer-token') return { userId: 2, role: 'LECTURER' };
            if (token === 'student-token') return { userId: 101, role: 'STUDENT' };
            throw new Error('invalid token');
        });

        prisma.user.findUnique.mockImplementation(async ({ where }) => {
            if (where.id === 1) {
                return {
                    id: 1,
                    fullName: 'Admin User',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: adminPerms,
                };
            }
            if (where.id === 5) {
                return {
                    id: 5,
                    fullName: 'Dr. Nguyen Van Giam Doc',
                    role: 'ADMIN',
                    isActive: true,
                    permissionGroups: [
                        {
                            permissionGroup: {
                                code: 'DIRECTOR_GROUP',
                                permissions: [{ permission: { code: 'CLEARANCE_CERTIFICATE_SIGN' } }],
                            },
                        },
                    ],
                };
            }
            if (where.id === 2 || where.id === 201 || where.id === 202 || where.id === 203) {
                return {
                    id: where.id,
                    fullName: `Giang Vien ${where.id}`,
                    role: 'LECTURER',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            if (where.id === 101 || where.id === 102) {
                return {
                    id: where.id,
                    fullName: `Sinh Vien ${where.id}`,
                    role: 'STUDENT',
                    isActive: true,
                    permissionGroups: [],
                };
            }
            return null;
        });
    });

    test('a) publishDefenseEligibleList creates notification records for eligible students', async () => {
        prisma.semester.findUnique.mockResolvedValue({
            id: 1,
            lockedDefenseRubricVersionId: 10,
            lockedDefenseRubricVersion: {
                id: 10,
                lockedAt: new Date(),
                totalMaxScore: 10.0,
            },
        });

        prisma.topicRegistration.findMany.mockResolvedValue([
            {
                id: 11,
                studentId: 101,
                status: 'DEFENSE_READY',
                student: { fullName: 'Nguyen Van A', code: 'SV001' },
                topic: { title: 'De tai tot nghiep 1' },
            },
            {
                id: 12,
                studentId: 102,
                status: 'DEFENSE_ELIGIBLE',
                student: { fullName: 'Tran Thi B', code: 'SV002' },
                topic: { title: 'De tai tot nghiep 2' },
            },
        ]);

        prisma.semester.update.mockResolvedValue({
            id: 1,
            lockedDefenseRubricVersionId: 10,
            defenseEligibleListPublishedAt: new Date(),
        });

        const res = await request(app)
            .post('/api/councils/semesters/1/publish-eligible-defense-list')
            .set('Authorization', 'Bearer admin-token')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify createMany was called with notification for eligible students
        expect(prisma.notification.createMany).toHaveBeenCalled();
        const notificationBatches = prisma.notification.createMany.mock.calls.map((call) => call[0].data);
        const eligibleListBatch = notificationBatches.find((batch) =>
            batch.some((item) => item.title === 'Đủ điều kiện bảo vệ khóa luận tốt nghiệp')
        );

        expect(eligibleListBatch).toBeDefined();
        expect(eligibleListBatch).toHaveLength(2);
        expect(eligibleListBatch).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    userId: 101,
                    title: 'Đủ điều kiện bảo vệ khóa luận tốt nghiệp',
                    content: 'Chúc mừng! Bạn đã đủ điều kiện ra bảo vệ khóa luận tốt nghiệp đợt này. Vui lòng kiểm tra và chuẩn bị 4 thành phần tài liệu bảo vệ.',
                    type: 'DEFENSE',
                }),
                expect.objectContaining({
                    userId: 102,
                    title: 'Đủ điều kiện bảo vệ khóa luận tốt nghiệp',
                    content: 'Chúc mừng! Bạn đã đủ điều kiện ra bảo vệ khóa luận tốt nghiệp đợt này. Vui lòng kiểm tra và chuẩn bị 4 thành phần tài liệu bảo vệ.',
                    type: 'DEFENSE',
                }),
            ])
        );
    });

    test('b) confirmAndPublishDefenseSchedule creates notifications for council members and students', async () => {
        prisma.council.findUnique.mockResolvedValue({
            id: 50,
            name: 'Hoi dong Cong nghe phan mem',
            semesterId: 1,
            semester: {
                lockedDefenseRubricVersionId: 10,
                lockedDefenseRubricVersion: { id: 10, lockedAt: new Date() },
                defenseEligibleListPublishedAt: new Date(),
            },
            registrations: [
                { id: 1, studentId: 101, student: { fullName: 'Nguyen Van A', code: 'SV001' } },
                { id: 2, studentId: 102, student: { fullName: 'Tran Thi B', code: 'SV002' } },
            ],
            members: [
                { id: 1, lecturerId: 201, userId: 201, roleInCouncil: 'CHAIRMAN', isActive: true },
                { id: 2, lecturerId: 202, userId: 202, roleInCouncil: 'SECRETARY', isActive: true },
            ],
        });

        prisma.topicRegistration.update.mockResolvedValue({});
        prisma.council.update.mockResolvedValue({
            id: 50,
            scheduleConfirmedAt: new Date(),
            schedulePublishedAt: new Date(),
        });

        const res = await request(app)
            .post('/api/councils/50/confirm-and-publish-schedule')
            .set('Authorization', 'Bearer admin-token')
            .send({ orderedRegistrationIds: [1, 2] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const batches = prisma.notification.createMany.mock.calls.map((call) => call[0].data);

        // 1. Student notification batch
        const studentBatch = batches.find((batch) =>
            batch.some((item) => item.title === 'Lịch bảo vệ chính thức đã được công bố')
        );
        expect(studentBatch).toBeDefined();
        expect(studentBatch).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    userId: 101,
                    type: 'DEFENSE_SCHEDULE_PUBLISHED',
                }),
                expect.objectContaining({
                    userId: 102,
                    type: 'DEFENSE_SCHEDULE_PUBLISHED',
                }),
            ])
        );

        // 2. Council lecturer members notification batch
        const memberBatch = batches.find((batch) =>
            batch.some((item) => item.title === 'Lịch bảo vệ chính thức - Hội đồng Hoi dong Cong nghe phan mem')
        );
        expect(memberBatch).toBeDefined();
        expect(memberBatch).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    userId: 201,
                    title: 'Lịch bảo vệ chính thức - Hội đồng Hoi dong Cong nghe phan mem',
                    content: 'Lịch bảo vệ khóa luận cho hội đồng Hoi dong Cong nghe phan mem đã được công bố chính thức. Phiên bảo vệ gồm 2 sinh viên chia ca Sáng/Chiều.',
                    type: 'DEFENSE_SCHEDULE_PUBLISHED',
                }),
                expect.objectContaining({
                    userId: 202,
                    title: 'Lịch bảo vệ chính thức - Hội đồng Hoi dong Cong nghe phan mem',
                    content: 'Lịch bảo vệ khóa luận cho hội đồng Hoi dong Cong nghe phan mem đã được công bố chính thức. Phiên bảo vệ gồm 2 sinh viên chia ca Sáng/Chiều.',
                    type: 'DEFENSE_SCHEDULE_PUBLISHED',
                }),
            ])
        );
    });

    test('c) publishDefenseResults creates notification records with isPromulgated: true for students', async () => {
        const createMembers = () => [
            { id: 1, lecturerId: 201, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
            { id: 2, lecturerId: 202, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
            { id: 3, lecturerId: 203, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
        ];

        const reg1 = {
            id: 11,
            studentId: 101,
            semesterId: 1,
            defenseCouncilId: 50,
            periodPolicyVersionId: 1,
            student: { id: 101, code: 'SV001', fullName: 'Nguyen Van A' },
            topic: { title: 'He thong quan ly hoc vu' },
            defenseCouncil: { members: createMembers() },
            council: null,
            defenseResult: {
                id: 501,
                attendanceStatus: 'PRESENT',
                finalScore: 8.5,
                roundedFinalScore: 8.5,
                rawAverageScore: 8.5,
                scoreRubricVersion: 'v1',
                scoreLocked: true,
                lockedAt: new Date('2026-10-29T00:00:00.000Z'),
            },
            memberScores: [
                { evaluatorId: 201, finalScore: 8.5, scoreRubricVersion: 'v1', scoreLocked: true, isEffective: true, lockedAt: new Date('2026-10-29T00:00:00.000Z') },
                { evaluatorId: 202, finalScore: 8.5, scoreRubricVersion: 'v1', scoreLocked: true, isEffective: true, lockedAt: new Date('2026-10-29T00:00:00.000Z') },
                { evaluatorId: 203, finalScore: 8.5, scoreRubricVersion: 'v1', scoreLocked: true, isEffective: true, lockedAt: new Date('2026-10-29T00:00:00.000Z') },
            ],
        };

        const approvalPassed = {
            id: 1,
            registrationId: 11,
            defenseResultId: 501,
            defenseCouncilId: 50,
            policyVersionId: 1,
            rubricVersionSnapshot: 'v1',
            finalScoreSnapshot: 8.5,
            outcome: 'PASSED',
            isEffective: true,
            scoreFingerprint: hashScoreEvidence(reg1),
            registration: reg1,
        };

        prisma.defenseResultApproval.findMany.mockResolvedValue([approvalPassed]);
        prisma.resultPublicationItem.findMany.mockResolvedValue([]);
        prisma.resultPublication.create.mockResolvedValue({ id: 99, semesterId: 1, type: 'INITIAL' });
        prisma.resultPublication.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 99, items: [] });

        const result = await createResultPublication({
            semesterId: 1,
            actorId: 1,
            type: 'INITIAL',
            idempotencyKey: 'pub-test-notif-001',
        });

        expect(result).toBeDefined();
        expect(prisma.notification.createMany).toHaveBeenCalled();

        const publishedBatches = prisma.notification.createMany.mock.calls.map((call) => call[0].data);
        const resultBatch = publishedBatches.find((batch) =>
            batch.some((item) => item.title === 'Kết quả bảo vệ khóa luận chính thức đã được công bố')
        );

        expect(resultBatch).toBeDefined();

        // Verification of SEC-12: notification must have isPromulgated: true
        const passedNotif = resultBatch.find((n) => n.userId === 101);
        expect(passedNotif).toBeDefined();
        expect(passedNotif.isPromulgated).toBe(true);
        expect(passedNotif.type).toBe('DEFENSE');
        expect(passedNotif.content).toContain('Kết luận: ĐẠT');
        expect(passedNotif.content).toContain('Điểm chính thức: 8.5');
    });

    test('d) returnScoreBookBeforePublication creates notification records for council members', async () => {
        const mockReg = {
            id: 25,
            status: 'AWAITING_FINAL_APPROVAL',
            stateVersion: 2,
            studentId: 101,
            student: { id: 101, fullName: 'Pham Van Cuong', code: 'SV099' },
            defenseCouncilId: 77,
            defenseCouncil: {
                id: 77,
                members: [
                    { id: 1, lecturerId: 201, userId: 201, roleInCouncil: 'CHAIRMAN', isActive: true },
                    { id: 2, lecturerId: 202, userId: 202, roleInCouncil: 'SECRETARY', isActive: true },
                ],
            },
            defenseResult: {
                id: 300,
                scoreLocked: true,
                ledgerVersion: 1,
                finalScore: 8.0,
                rawAverageScore: 8.0,
                roundedFinalScore: 8.0,
            },
            memberScores: [
                { id: 10, evaluatorId: 201, finalScore: 8.0, versionNumber: 1, scoreLocked: true, isEffective: true },
                { id: 11, evaluatorId: 202, finalScore: 8.0, versionNumber: 1, scoreLocked: true, isEffective: true },
            ],
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(mockReg);
        prisma.resultPublicationItem.findFirst.mockResolvedValue(null);
        prisma.defenseMemberScore.update.mockResolvedValue({});
        prisma.defenseResult.update.mockResolvedValue({
            registrationId: 25,
            scoreLocked: false,
            ledgerVersion: 2,
        });

        await defenseScoringService.returnScoreBookBeforePublication({
            registrationId: 25,
            adminId: 1,
            reason: 'Phát hiện sai sót barem tiêu chí số 3',
            reopenMemberScoreIds: [10],
            idempotencyKey: 'return-scorebook-test-01',
        });

        expect(prisma.notification.createMany).toHaveBeenCalled();
        const batches = prisma.notification.createMany.mock.calls.map((c) => c[0].data);
        const returnBatch = batches.find((batch) =>
            batch.some((item) => item.title === 'Sổ điểm hội đồng đã được hoàn trả để rà soát')
        );

        expect(returnBatch).toBeDefined();
        expect(returnBatch).toHaveLength(2);
        expect(returnBatch).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    userId: 201,
                    title: 'Sổ điểm hội đồng đã được hoàn trả để rà soát',
                    content: expect.stringContaining('Pham Van Cuong'),
                    type: 'DEFENSE',
                }),
                expect.objectContaining({
                    userId: 202,
                    title: 'Sổ điểm hội đồng đã được hoàn trả để rà soát',
                    content: expect.stringContaining('Phát hiện sai sót barem tiêu chí số 3'),
                    type: 'DEFENSE',
                }),
            ])
        );
    });

    test('e) reviewArchivalDossierByAdvisor and reviewArchivalDossierByAcademicAffairs create notifications on REVISION_REQUIRED / REJECTED', async () => {
        const sampleReg = {
            id: 40,
            studentId: 101,
            status: 'DEFENSE_PASSED',
            stateVersion: 1,
            topic: { mentorId: 2 },
        };

        const sampleArchive = {
            id: 88,
            registrationId: 40,
            status: 'SUBMITTED',
            mentorReviewStatus: 'PENDING',
            academicAffairsReviewStatus: 'PENDING',
            registration: sampleReg,
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(sampleReg);
        prisma.projectArchive.findUnique.mockResolvedValue(sampleArchive);
        prisma.projectArchive.update.mockImplementation(async ({ data }) => ({
            ...sampleArchive,
            ...data,
            mentorReviewedBy: { id: 2, fullName: 'GVHD 2' },
            academicAffairsReviewedBy: { id: 1, fullName: 'Giao vu 1' },
            registration: sampleReg,
        }));

        // 1. Advisor review -> REVISION_REQUIRED
        await archivalWorkflowService.reviewArchivalDossierByAdvisor({
            archiveId: 88,
            mentorId: 2,
            status: 'REVISION_REQUIRED',
            notes: 'Cần cập nhật lại format mục lục đồ án',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 101,
                    title: 'Hồ sơ lưu chiểu cần chỉnh sửa bổ sung',
                    content: expect.stringContaining('Cần cập nhật lại format mục lục đồ án'),
                    type: 'SUBMISSION',
                }),
            })
        );

        // 2. Advisor review -> REJECTED
        await archivalWorkflowService.reviewArchivalDossierByAdvisor({
            archiveId: 88,
            mentorId: 2,
            status: 'REJECTED',
            notes: 'Nội dung đạo văn vượt quá 40%',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 101,
                    title: 'Hồ sơ lưu chiểu chuyên môn bị từ chối',
                    content: expect.stringContaining('Nội dung đạo văn vượt quá 40%'),
                    type: 'SUBMISSION',
                }),
            })
        );

        // 3. Academic Affairs review -> REVISION_REQUIRED
        await archivalWorkflowService.reviewArchivalDossierByAcademicAffairs({
            archiveId: 88,
            reviewerId: 1,
            status: 'REVISION_REQUIRED',
            notes: 'Thiếu chữ ký số xác nhận của GVHD trang bìa',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 101,
                    title: 'Hồ sơ lưu chiểu cần bổ sung thủ tục (Giáo vụ)',
                    content: expect.stringContaining('Thiếu chữ ký số xác nhận của GVHD trang bìa'),
                    type: 'SUBMISSION',
                }),
            })
        );

        // 4. Academic Affairs review -> REJECTED
        await archivalWorkflowService.reviewArchivalDossierByAcademicAffairs({
            archiveId: 88,
            reviewerId: 1,
            status: 'REJECTED',
            notes: 'Quá hạn hoàn thiện hồ sơ lưu chiểu 15 ngày',
        });

        expect(prisma.notification.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 101,
                    title: 'Hồ sơ lưu chiểu bị từ chối (Giáo vụ)',
                    content: expect.stringContaining('Quá hạn hoàn thiện hồ sơ lưu chiểu 15 ngày'),
                    type: 'SUBMISSION',
                }),
            })
        );
    });

    test('f) signClearanceCertificateByInstituteDirector creates notification for student when clearance certificate is signed', async () => {
        const reg60 = {
            id: 60,
            studentId: 101,
            status: 'PENDING_INSTITUTE_SIGNATURE',
            stateVersion: 3,
            student: { id: 101, fullName: 'Hoang Van Thuong', code: 'SV777' },
            topic: {
                title: 'Ung dung AI trong nhan dien giong noi',
                mentor: { id: 2, fullName: 'PGS. TS. Nguyen Van Thuan' },
            },
            defenseResult: { finalScore: 9.2 },
        };

        const readyArchive = {
            id: 95,
            registrationId: 60,
            status: 'PENDING_INSTITUTE_SIGNATURE',
            mentorReviewStatus: 'APPROVED',
            academicAffairsReviewStatus: 'APPROVED',
            certificateNumber: 'XNHT-20261112-60',
            registration: reg60,
        };

        prisma.topicRegistration.findUnique.mockResolvedValue(reg60);
        prisma.projectArchive.findUnique.mockResolvedValue(readyArchive);
        prisma.defenseDocumentVersion.findMany.mockResolvedValue([]);
        prisma.projectArchive.update.mockImplementation(async ({ data }) => ({
            ...readyArchive,
            ...data,
            certificateSignedBy: { id: 5, fullName: 'Dr. Nguyen Van Giam Doc' },
        }));

        const directorUser = {
            id: 5,
            fullName: 'Dr. Nguyen Van Giam Doc',
            role: 'ADMIN',
            permissions: ['CLEARANCE_CERTIFICATE_SIGN'],
        };

        const result = await archivalWorkflowService.signClearanceCertificateByInstituteDirector({
            archiveId: 95,
            directorUser,
        });

        expect(result).toBeDefined();
        expect(prisma.notification.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userId: 101,
                    title: 'Giấy xác nhận hoàn thành đồ án tốt nghiệp đã được cấp',
                    content: expect.stringContaining('Viện trưởng đã ký Giấy xác nhận hoàn thành số XNHT-20261112-60'),
                    type: 'SYSTEM',
                }),
            })
        );
    });
});
