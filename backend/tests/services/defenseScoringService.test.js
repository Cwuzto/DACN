const {
    computeAggregateDefenseScore,
    saveMemberScoreSheet,
    lockDefenseScores,
} = require('../../src/services/defenseScoringService');
const { WorkflowTransitionError } = require('../../src/services/registrationTransitionService');

const buildFullV1Scores = (overrideMap = {}) => ([
    { criterionCode: 'STRUCTURE', score: 0.5 },
    { criterionCode: 'CITATION_FORMAT', score: 0.25 },
    { criterionCode: 'LANGUAGE', score: 0.25 },
    { criterionCode: 'PROBLEM_STATEMENT', score: 1.0 },
    { criterionCode: 'RESEARCH_METHOD', score: 0.5 },
    { criterionCode: 'RESEARCH_CONTENT', score: 2.5 },
    { criterionCode: 'RESEARCH_RESULT', score: 1.0 },
    { criterionCode: 'NOVELTY', score: 0.25 },
    { criterionCode: 'APPLICABILITY', score: 0.5 },
    { criterionCode: 'PUBLICATION', score: 0.25 },
    { criterionCode: 'PRESENTATION_SKILL', score: 0.5 },
    { criterionCode: 'ATTITUDE', score: 0.5 },
    { criterionCode: 'PRESENTATION_CONTENT', score: 1.0 },
    { criterionCode: 'QA_RESPONSE', score: 1.0 },
].map((row) => (
    Object.prototype.hasOwnProperty.call(overrideMap, row.criterionCode)
        ? { ...row, score: overrideMap[row.criterionCode] }
        : row
)));

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

        it('lưu phiếu điểm thành viên thành công và không ghi DefenseResult.finalScore chính thức khi chỉ mới lưu phiếu cá nhân', async () => {
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
                    create: jest.fn().mockResolvedValue({ id: 901, finalScore: 10.0 }),
                },
                defenseMemberCriterionScore: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    createMany: jest.fn().mockResolvedValue({ count: 14 }),
                },
                defenseResult: {
                    upsert: jest.fn(),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            const res = await saveMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    evaluatorRole: 'LECTURER',
                    scores: buildFullV1Scores(),
                },
                { db: mockDb },
            );

            expect(res.finalScore).toBe(10);
            expect(res.aggregateFinalScore).toBeNull();
            expect(mockTx.defenseResult.upsert).not.toHaveBeenCalled();
        });

        it('cho phép lưu nháp rỗng (scores: []) mà không tạo điểm 0 giả và đặt finalScore = null', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                                { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                                { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                            ],
                        },
                        defenseResult: null,
                    }),
                },
                defenseMemberScore: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockImplementation(async ({ data }) => ({ id: 902, ...data })),
                },
                defenseMemberCriterionScore: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    createMany: jest.fn(),
                },
                defenseResult: {
                    upsert: jest.fn(),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            const res = await saveMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    evaluatorRole: 'LECTURER',
                    scores: [],
                    generalComment: 'Đang nhập nháp',
                },
                { db: mockDb },
            );

            expect(mockTx.defenseMemberScore.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        finalScore: null,
                        scoreLocked: false,
                    }),
                }),
            );
            expect(mockTx.defenseMemberCriterionScore.deleteMany).toHaveBeenCalled();
            expect(mockTx.defenseMemberCriterionScore.createMany).not.toHaveBeenCalled();
            expect(mockTx.defenseResult.upsert).not.toHaveBeenCalled();
            expect(res.finalScore).toBeNull();
            expect(res.scoredCriteriaCount).toBe(0);
        });

        it('cho phép lưu nháp một phần tiêu chí và giữ nguyên mục chưa chấm (không tự điền 0)', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'AWAITING_SCORES',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                                { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                                { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                            ],
                        },
                        defenseResult: null,
                    }),
                },
                defenseMemberScore: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockImplementation(async ({ data }) => ({ id: 903, ...data })),
                },
                defenseMemberCriterionScore: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    createMany: jest.fn().mockResolvedValue({ count: 2 }),
                },
                defenseResult: {
                    upsert: jest.fn(),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            const res = await saveMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    evaluatorRole: 'LECTURER',
                    scores: [
                        { criterionCode: 'STRUCTURE', score: 0.45 },
                        { criterionCode: 'LANGUAGE', score: 0.2 },
                    ],
                },
                { db: mockDb },
            );

            expect(mockTx.defenseMemberCriterionScore.createMany).toHaveBeenCalledWith({
                data: [
                    expect.objectContaining({ criterionCode: 'STRUCTURE', score: 0.45, maxScore: 0.5 }),
                    expect.objectContaining({ criterionCode: 'LANGUAGE', score: 0.2, maxScore: 0.25 }),
                ],
            });
            expect(res.finalScore).toBe(0.65);
            expect(res.scoredCriteriaCount).toBe(2);
            expect(res.totalCriteriaCount).toBe(14);
            expect(res.aggregateFinalScore).toBeNull();
            expect(mockTx.defenseResult.upsert).not.toHaveBeenCalled();
        });

        it('lưu điểm 0 là giá trị đã chấm hợp lệ (không bị coi là trống hoặc null)', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                            ],
                        },
                        defenseResult: null,
                    }),
                },
                defenseMemberScore: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockImplementation(async ({ data }) => ({ id: 904, ...data })),
                },
                defenseMemberCriterionScore: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    createMany: jest.fn().mockResolvedValue({ count: 2 }),
                },
            };
            const mockDb = { $transaction: jest.fn((callback) => callback(mockTx)) };

            const res = await saveMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 21,
                    evaluatorRole: 'LECTURER',
                    scores: [
                        { criterionCode: 'STRUCTURE', score: 0 },
                        { criterionCode: 'RESEARCH_CONTENT', score: 0 },
                    ],
                },
                { db: mockDb },
            );

            expect(mockTx.defenseMemberCriterionScore.createMany).toHaveBeenCalledWith({
                data: [
                    expect.objectContaining({ criterionCode: 'STRUCTURE', score: 0 }),
                    expect.objectContaining({ criterionCode: 'RESEARCH_CONTENT', score: 0 }),
                ],
            });
            expect(res.finalScore).toBe(0);
            expect(res.scoredCriteriaCount).toBe(2);
        });

        it('từ chối điểm > 2 chữ số thập phân, âm, vượt maxScore, rỗng/null, không hữu hạn, mã sai/trùng, sai targetRubricVersion', async () => {
            const makeDb = () => {
                const mockTx = {
                    topicRegistration: {
                        findUnique: jest.fn().mockResolvedValue({
                            id: 100,
                            status: 'DEFENSE_READY',
                            topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                            defenseCouncil: {
                                id: 5,
                                rubricVersionId: 77,
                                rubricVersion: { id: 77, version: 'v_pinned' },
                                members: [{ lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true }],
                            },
                            defenseResult: null,
                        }),
                    },
                    rubricVersion: {
                        findUnique: jest.fn().mockResolvedValue({
                            id: 77,
                            version: 'v_pinned',
                            title: 'Pinned',
                            totalMaxScore: 10,
                            categories: [
                                {
                                    code: 'CAT1',
                                    name: 'Group 1',
                                    maxScore: 10,
                                    orderIndex: 1,
                                    criteria: [
                                        { code: 'STRUCTURE', label: 'Cấu trúc', maxScore: 0.5, orderIndex: 1 },
                                        { code: 'RESEARCH_CONTENT', label: 'Nội dung', maxScore: 9.5, orderIndex: 2 },
                                    ],
                                },
                            ],
                        }),
                    },
                    defenseMemberScore: {
                        findUnique: jest.fn().mockResolvedValue(null),
                    },
                };
                return { $transaction: jest.fn((cb) => cb(mockTx)) };
            };

            const invalidPayloads = [
                { scores: [{ criterionCode: 'STRUCTURE', score: 0.125 }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: 0.255 }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: -0.01 }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: 0.51 }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: null }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: '' }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: Number.NaN }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: Number.POSITIVE_INFINITY }] },
                { scores: [{ criterionCode: 'UNKNOWN_CODE', score: 0.2 }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: 0.2 }, { criterionCode: 'STRUCTURE', score: 0.3 }] },
                { scores: [{ criterionCode: 'STRUCTURE', score: 0.2 }], targetRubricVersion: 'v_other' },
            ];

            for (const payload of invalidPayloads) {
                await expect(
                    saveMemberScoreSheet(
                        {
                            registrationId: 100,
                            evaluatorId: 21,
                            actorId: 21,
                            evaluatorRole: 'LECTURER',
                            ...payload,
                        },
                        { db: makeDb() },
                    ),
                ).rejects.toMatchObject({ status: 400 });
            }
        });

        it('từ chối khi rubric đã gắn bị thiếu (PINNED_RUBRIC_NOT_FOUND) và không fallback sang active rubric', async () => {
            const mockTx = {
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            rubricVersionId: 888,
                            members: [{ lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true }],
                        },
                        defenseResult: { scoreRubricVersion: 'v_deleted_888' },
                    }),
                },
                rubricVersion: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    findFirst: jest.fn().mockResolvedValue({ id: 99, version: 'v_active', categories: [] }),
                },
                defenseMemberScore: { findUnique: jest.fn().mockResolvedValue(null) },
            };
            const mockDb = { $transaction: jest.fn((cb) => cb(mockTx)) };

            await expect(
                saveMemberScoreSheet(
                    {
                        registrationId: 100,
                        evaluatorId: 21,
                        actorId: 21,
                        evaluatorRole: 'LECTURER',
                        scores: [{ criterionCode: 'STRUCTURE', score: 0.5 }],
                    },
                    { db: mockDb },
                ),
            ).rejects.toMatchObject({
                code: 'PINNED_RUBRIC_NOT_FOUND',
                status: 404,
            });
            expect(mockTx.rubricVersion.findFirst).not.toHaveBeenCalled();
        });

        it('từ chối thành viên hội đồng không có quyền chấm (non-scoring MEMBER / inactive) và bảo toàn quyền sở hữu vs ủy quyền admin', async () => {
            const makeTx = () => ({
                topicRegistration: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 100,
                        status: 'DEFENSE_READY',
                        topic: { id: 1, title: 'Đề tài A', mentorId: 15 },
                        defenseCouncil: {
                            id: 5,
                            allowFourthScoringMember: false,
                            members: [
                                { lecturerId: 21, roleInCouncil: 'CHAIRMAN', isActive: true, isScoringMember: true },
                                { lecturerId: 22, roleInCouncil: 'SECRETARY', isActive: true, isScoringMember: true },
                                { lecturerId: 23, roleInCouncil: 'REVIEWER', isActive: true, isScoringMember: true },
                                { lecturerId: 24, roleInCouncil: 'MEMBER', isActive: true, isScoringMember: false },
                            ],
                        },
                        defenseResult: null,
                    }),
                },
                defenseMemberScore: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockImplementation(async ({ data }) => ({ id: 905, ...data })),
                },
                defenseMemberCriterionScore: {
                    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                    createMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
            });

            // Non-scoring 4th member rejected with 403
            await expect(
                saveMemberScoreSheet(
                    {
                        registrationId: 100,
                        evaluatorId: 24,
                        actorId: 24,
                        evaluatorRole: 'LECTURER',
                        scores: [{ criterionCode: 'STRUCTURE', score: 0.5 }],
                    },
                    { db: { $transaction: jest.fn((cb) => cb(makeTx())) } },
                ),
            ).rejects.toMatchObject({ status: 403 });

            // Lecturer trying to edit another lecturer's sheet rejected with 403
            await expect(
                saveMemberScoreSheet(
                    {
                        registrationId: 100,
                        evaluatorId: 22,
                        actorId: 21,
                        evaluatorRole: 'LECTURER',
                        scores: [{ criterionCode: 'STRUCTURE', score: 0.5 }],
                    },
                    { db: { $transaction: jest.fn((cb) => cb(makeTx())) } },
                ),
            ).rejects.toMatchObject({ status: 403 });

            // Admin delegation allowed for valid active scoring member
            const adminRes = await saveMemberScoreSheet(
                {
                    registrationId: 100,
                    evaluatorId: 21,
                    actorId: 1,
                    evaluatorRole: 'ADMIN',
                    scores: [{ criterionCode: 'STRUCTURE', score: 0.5 }],
                },
                { db: { $transaction: jest.fn((cb) => cb(makeTx())) } },
            );
            expect(adminRes.finalScore).toBe(0.5);
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
