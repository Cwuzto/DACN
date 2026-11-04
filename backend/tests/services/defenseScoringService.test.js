const {
    computeAggregateDefenseScore,
    saveMemberScoreSheet,
    lockDefenseScores,
} = require('../../src/services/defenseScoringService');
const { WorkflowTransitionError } = require('../../src/services/registrationTransitionService');

describe('defenseScoringService', () => {
    describe('computeAggregateDefenseScore', () => {
        it('trả về null khi danh sách rỗng hoặc không có điểm hợp lệ', () => {
            expect(computeAggregateDefenseScore([])).toBeNull();
            expect(computeAggregateDefenseScore([{ finalScore: null }, { finalScore: undefined }, { finalScore: 'abc' }])).toBeNull();
        });

        it('tính trung bình cộng chính xác của 3 thành viên hội đồng', () => {
            const memberScores = [
                { finalScore: 8.5 },
                { finalScore: 9.0 },
                { finalScore: 9.5 },
            ];
            expect(computeAggregateDefenseScore(memberScores)).toBe(9.0);
        });

        it('làm tròn đúng 2 chữ số thập phân', () => {
            const memberScores = [
                { finalScore: 8.0 },
                { finalScore: 8.5 },
                { finalScore: 8.75 },
            ];
            // (8.0 + 8.5 + 8.75) / 3 = 25.25 / 3 = 8.41666... -> 8.42
            expect(computeAggregateDefenseScore(memberScores)).toBe(8.42);
        });
    });

    describe('saveMemberScoreSheet', () => {
        it('ném lỗi nếu registrationId hoặc evaluatorId không hợp lệ', async () => {
            await expect(saveMemberScoreSheet({ registrationId: null, evaluatorId: 10 })).rejects.toThrow(WorkflowTransitionError);
            await expect(saveMemberScoreSheet({ registrationId: 1, evaluatorId: -5 })).rejects.toThrow(WorkflowTransitionError);
        });

        it('INV-11: Giảng viên hướng dẫn không được chấm điểm hội đồng cho sinh viên mình hướng dẫn', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 20 },
                        defenseCouncil: {
                            id: 5,
                            members: [{ lecturerId: 20, roleInCouncil: 'CHAIRMAN' }],
                        },
                        defenseResult: null,
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            await expect(
                saveMemberScoreSheet(
                    {
                        registrationId: 100,
                        evaluatorId: 20, // trùng mentorId
                        evaluatorRole: 'LECTURER',
                        scores: [{ criterionCode: 'C1', score: 9 }],
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'MENTOR_CANNOT_GRADE_OWN_STUDENT',
                status: 403,
            });
        });

        it('ném lỗi 403 nếu giảng viên không thuộc hội đồng bảo vệ', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                                { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                                { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                            ],
                        },
                        defenseResult: null,
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            await expect(
                saveMemberScoreSheet(
                    {
                        registrationId: 100,
                        evaluatorId: 99, // không nằm trong hội đồng
                        evaluatorRole: 'LECTURER',
                        scores: [{ criterionCode: 'C1', score: 9 }],
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'EVALUATOR_NOT_IN_COUNCIL',
                status: 403,
            });
        });

        it('ném lỗi 409 nếu bảng điểm hội đồng đã bị khóa', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENDED',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            members: [{ lecturerId: 21, roleInCouncil: 'CHAIRMAN' }],
                        },
                        defenseResult: { scoreLocked: true },
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            await expect(
                saveMemberScoreSheet(
                    {
                        registrationId: 100,
                        evaluatorId: 21,
                        evaluatorRole: 'LECTURER',
                        scores: [{ criterionCode: 'C1', score: 9 }],
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'SCORE_LOCKED',
                status: 409,
            });
        });

        it('chấm điểm thành công và tính trung bình cộng thành phần', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                                { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                                { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                            ],
                        },
                        defenseResult: null,
                    }),
                },
                defenseMemberScore: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({ id: 901, finalScore: 9.0 }),
                    findMany: jest.fn().mockResolvedValue([
                        { evaluatorId: 21, finalScore: 9.0 },
                        { evaluatorId: 22, finalScore: 8.5 },
                        { evaluatorId: 23, finalScore: 9.5 },
                    ]),
                },
                defenseMemberCriterionScore: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    createMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
                defenseResult: {
                    upsert: jest.fn().mockResolvedValue({ id: 801, finalScore: 9.0 }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            const res = await saveMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    evaluatorRole: 'LECTURER',
                    scores: [{ criterionCode: 'C1', score: 9.0, maxScore: 10 }],
                },
                { db: mockDb },
            );

            expect(res.aggregateFinalScore).toBe(9.0);
            expect(mockTx.defenseResult.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId: 100 },
                    update: expect.objectContaining({ finalScore: 9.0 }),
                }),
            );
        });
    });

    describe('lockDefenseScores', () => {
        it('ném lỗi nếu chưa có điểm thành viên nào', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        memberScores: [],
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            await expect(
                lockDefenseScores(
                    { registrationId: 100, action: 'LOCK', actorId: 1 },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'NO_MEMBER_SCORES',
                status: 400,
            });
        });

        it('INV-04: ném lỗi nếu thiếu điểm của thành viên hội đồng', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        defenseCouncil: {
                            id: 5,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                                { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                                { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                            ],
                        },
                        // Chỉ mới có điểm của 2/3 thành viên
                        memberScores: [
                            { evaluatorId: 21, finalScore: 9.0 },
                            { evaluatorId: 22, finalScore: 8.5 },
                        ],
                    }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            await expect(
                lockDefenseScores(
                    { registrationId: 100, action: 'LOCK', actorId: 1 },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'MISSING_COUNCIL_MEMBER_SCORES',
                status: 400,
            });
        });

        it('khóa điểm thành công khi đủ 3 thành viên và chuyển AWAITING_FINAL_APPROVAL', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        stateVersion: 5,
                        defenseCouncil: {
                            id: 5,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN' },
                                { lecturerId: 22, roleInCouncil: 'SECRETARY' },
                                { lecturerId: 23, roleInCouncil: 'REVIEWER' },
                            ],
                        },
                        memberScores: [
                            { evaluatorId: 21, finalScore: 9.0, scoreLocked: true },
                            { evaluatorId: 22, finalScore: 8.5, scoreLocked: true },
                            { evaluatorId: 23, finalScore: 9.5, scoreLocked: true },
                        ],
                    }),
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
                idempotencyRecord: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({}),
                },
                registrationStateHistory: {
                    create: jest.fn().mockResolvedValue({}),
                },
                defenseMemberScore: {
                    updateMany: jest.fn().mockResolvedValue({ count: 3 }),
                },
                defenseResult: {
                    upsert: jest.fn().mockResolvedValue({ finalScore: 9.0 }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            const res = await lockDefenseScores(
                { registrationId: 100, action: 'LOCK', actorId: 1, idempotencyKey: 'test-lock-key-123456' },
                { db: mockDb },
            );

            expect(res.status).toBe('AWAITING_FINAL_APPROVAL');
            expect(res.finalScore).toBe(9.0);
            expect(res.scoreLocked).toBe(true);
            expect(mockTx.defenseMemberScore.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId: 100 },
                    data: expect.objectContaining({ scoreLocked: true }),
                }),
            );
        });

        it('mở khóa điểm UNLOCK chuyển từ AWAITING_FINAL_APPROVAL về DEFENSE_READY', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'AWAITING_FINAL_APPROVAL',
                        stateVersion: 6,
                    }),
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
                idempotencyRecord: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({}),
                },
                registrationStateHistory: {
                    create: jest.fn().mockResolvedValue({}),
                },
                defenseMemberScore: {
                    updateMany: jest.fn().mockResolvedValue({ count: 3 }),
                },
                defenseResult: {
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            const res = await lockDefenseScores(
                { registrationId: 100, action: 'UNLOCK', actorId: 1, idempotencyKey: 'test-unlock-key-123456' },
                { db: mockDb },
            );

            expect(res.status).toBe('DEFENSE_READY');
            expect(res.scoreLocked).toBe(false);
            expect(mockTx.defenseMemberScore.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { registrationId: 100 },
                    data: expect.objectContaining({ scoreLocked: false }),
                }),
            );
        });
    });
});
