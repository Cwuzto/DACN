const {
    getEligibleDefenseRegistrations,
    validateDefenseAssignment,
    isBm04Eligible,
    MAX_STUDENTS_PER_DEFENSE_COUNCIL,
} = require('../../src/services/defenseCouncilEligibilityService');

describe('defenseCouncilEligibilityService', () => {
    describe('1. isBm04Eligible (BM04 conclusion & lock guards)', () => {
        test('rejects registration when BM04 task is COMPLETED but bm04Evaluation does not exist', () => {
            const reg = {
                id: 1,
                status: 'IN_PROGRESS',
                tasks: [{ taskType: 'BM04', status: 'COMPLETED' }],
                bm04Evaluation: null,
            };
            expect(isBm04Eligible(reg)).toBe(false);
        });

        test('rejects registration when BM04 task is COMPLETED and status is DEFENSE_READY but bm04Evaluation is missing', () => {
            const reg = {
                id: 2,
                status: 'DEFENSE_READY',
                tasks: [{ taskType: 'BM04', status: 'COMPLETED' }],
                bm04Evaluation: null,
            };
            expect(isBm04Eligible(reg)).toBe(false);
        });

        test('rejects unlocked/draft BM04 evaluation even if conclusion is AGREED_FOR_DEFENSE', () => {
            const reg = {
                id: 3,
                status: 'IN_PROGRESS',
                bm04Evaluation: {
                    isLocked: false,
                    finalized: false,
                    conclusion: 'AGREED_FOR_DEFENSE',
                    status: 'DRAFT',
                },
            };
            expect(isBm04Eligible(reg)).toBe(false);
        });

        test('rejects locked BM04 evaluation when conclusion is NOT_AGREED_FOR_DEFENSE', () => {
            const reg = {
                id: 4,
                status: 'IN_PROGRESS',
                bm04Evaluation: {
                    isLocked: true,
                    conclusion: 'NOT_AGREED_FOR_DEFENSE',
                    status: 'NOT_ELIGIBLE_FOR_DEFENSE',
                },
            };
            expect(isBm04Eligible(reg)).toBe(false);
        });

        test('accepts locked BM04 evaluation with conclusion AGREED_FOR_DEFENSE', () => {
            const reg = {
                id: 5,
                status: 'DEFENSE_READY',
                bm04Evaluation: {
                    isLocked: true,
                    conclusion: 'AGREED_FOR_DEFENSE',
                    status: 'SIGNED_APPROVED',
                },
            };
            expect(isBm04Eligible(reg)).toBe(true);
        });

        test('accepts locked BM04 evaluation with defenseRecommendation APPROVE_FOR_DEFENSE', () => {
            const reg = {
                id: 6,
                status: 'DEFENSE_READY',
                bm04Evaluation: {
                    finalized: true,
                    defenseRecommendation: 'APPROVE_FOR_DEFENSE',
                },
            };
            expect(isBm04Eligible(reg)).toBe(true);
        });

        test('accepts locked BM04 evaluation with valid finalGrade >= 5.0', () => {
            const reg = {
                id: 7,
                status: 'IN_PROGRESS',
                bm04Evaluation: {
                    isLocked: true,
                    finalGrade: 7.5,
                },
            };
            expect(isBm04Eligible(reg)).toBe(true);
        });

        test('accepts registration with Institute override decision (ELIGIBLE_BY_INSTITUTE)', () => {
            const reg1 = {
                id: 8,
                status: 'ELIGIBLE_BY_INSTITUTE',
                bm04Evaluation: {
                    isLocked: true,
                    conclusion: 'NOT_AGREED_FOR_DEFENSE',
                },
            };
            expect(isBm04Eligible(reg1)).toBe(true);

            const reg2 = {
                id: 9,
                status: 'IN_PROGRESS',
                bm04Evaluation: {
                    isLocked: true,
                    conclusion: 'NOT_AGREED_FOR_DEFENSE',
                    instituteDefenseReview: {
                        status: 'ELIGIBLE_BY_INSTITUTE',
                        decision: 'OVERRIDE_ELIGIBLE',
                    },
                },
            };
            expect(isBm04Eligible(reg2)).toBe(true);
        });
    });

    describe('2. getEligibleDefenseRegistrations', () => {
        const semesterId = 10;

        test('returns only registrations matching all eligibility criteria', async () => {
            const mockDb = {
                topicRegistration: {
                    findMany: jest.fn().mockResolvedValue([
                        // Valid 1
                        {
                            id: 101,
                            semesterId,
                            status: 'DEFENSE_READY',
                            topic: { id: 1, maxStudents: 1, mentorId: 20 },
                            bm04Evaluation: { isLocked: true, conclusion: 'AGREED_FOR_DEFENSE' },
                            defenseCouncilId: null,
                            councilId: null,
                        },
                        // Invalid: wrong semester
                        {
                            id: 102,
                            semesterId: 999,
                            status: 'DEFENSE_READY',
                            topic: { id: 2, maxStudents: 1, mentorId: 21 },
                            bm04Evaluation: { isLocked: true, conclusion: 'AGREED_FOR_DEFENSE' },
                            defenseCouncilId: null,
                        },
                        // Invalid: topic maxStudents > 1 (group model violation)
                        {
                            id: 103,
                            semesterId,
                            status: 'DEFENSE_READY',
                            topic: { id: 3, maxStudents: 2, mentorId: 22 },
                            bm04Evaluation: { isLocked: true, conclusion: 'AGREED_FOR_DEFENSE' },
                            defenseCouncilId: null,
                        },
                        // Invalid: task COMPLETED alone without valid BM04
                        {
                            id: 104,
                            semesterId,
                            status: 'COMPLETED',
                            topic: { id: 4, maxStudents: 1, mentorId: 23 },
                            tasks: [{ taskType: 'BM04', status: 'COMPLETED' }],
                            bm04Evaluation: null,
                            defenseCouncilId: null,
                        },
                        // Invalid: already assigned to an active defense council
                        {
                            id: 105,
                            semesterId,
                            status: 'DEFENSE_READY',
                            topic: { id: 5, maxStudents: 1, mentorId: 24 },
                            bm04Evaluation: { isLocked: true, conclusion: 'AGREED_FOR_DEFENSE' },
                            defenseCouncilId: 50,
                            defenseCouncil: { id: 50, isActive: true, deletedAt: null, councilType: 'DEFENSE_COUNCIL' },
                        },
                        // Valid 2: previously assigned to a deleted/inactive council
                        {
                            id: 106,
                            semesterId,
                            status: 'DEFENSE_READY',
                            topic: { id: 6, maxStudents: 1, mentorId: 25 },
                            bm04Evaluation: { isLocked: true, conclusion: 'AGREED_FOR_DEFENSE' },
                            defenseCouncilId: 51,
                            defenseCouncil: { id: 51, isActive: false, deletedAt: new Date(), councilType: 'DEFENSE_COUNCIL' },
                        },
                        // Invalid: terminal status DEFENSE_PASSED
                        {
                            id: 107,
                            semesterId,
                            status: 'DEFENSE_PASSED',
                            topic: { id: 7, maxStudents: 1, mentorId: 26 },
                            bm04Evaluation: { isLocked: true, conclusion: 'AGREED_FOR_DEFENSE' },
                            defenseCouncilId: null,
                        },
                    ]),
                },
            };

            const result = await getEligibleDefenseRegistrations(semesterId, { db: mockDb });
            expect(result).toHaveLength(2);
            expect(result.map((r) => r.id)).toEqual([101, 106]);
        });
    });

    describe('3. validateDefenseAssignment (Hard Constraints)', () => {
        const semester = { id: 10, status: 'ONGOING' };
        const validCouncil = {
            id: 1,
            semesterId: 10,
            councilType: 'DEFENSE_COUNCIL',
            isActive: true,
            deletedAt: null,
            currentCount: 5,
        };
        const validMembers = [
            { lecturerId: 101, roleInCouncil: 'CHAIRMAN', expertiseAreas: ['Trí tuệ nhân tạo'] },
            { lecturerId: 102, roleInCouncil: 'SECRETARY', expertiseAreas: ['Học máy'] },
            { lecturerId: 103, roleInCouncil: 'REVIEWER', expertiseAreas: ['Xử lý ngôn ngữ tự nhiên'] },
        ];
        const validRegistration = {
            id: 501,
            semesterId: 10,
            status: 'DEFENSE_READY',
            topic: {
                id: 701,
                title: 'Nghiên cứu nhận dạng thực thể y tế',
                mentorId: 200, // not in members
                maxStudents: 1,
                acceptedExpertise: ['Trí tuệ nhân tạo'],
            },
            bm04Evaluation: {
                isLocked: true,
                conclusion: 'AGREED_FOR_DEFENSE',
            },
        };

        test('passes when all conditions are strictly satisfied', async () => {
            const res = await validateDefenseAssignment({
                registration: validRegistration,
                council: validCouncil,
                members: validMembers,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(res.ok).toBe(true);
            expect(res.reasons).toEqual([]);
        });

        test('rejects when mentor is in council (Conflict of Interest)', async () => {
            const conflictRegistration = {
                ...validRegistration,
                topic: {
                    ...validRegistration.topic,
                    mentorId: 101, // 101 is CHAIRMAN!
                },
            };

            const res = await validateDefenseAssignment({
                registration: conflictRegistration,
                council: validCouncil,
                members: validMembers,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(res.ok).toBe(false);
            expect(res.reasons.some((r) => r.includes('Conflict of interest'))).toBe(true);
        });

        test('rejects when a council lecturer belongs to 2 defense councils in same semester', async () => {
            // Case A: via in-memory flag / property
            const membersWithDuplicate = [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', hasOtherDefenseCouncil: true },
                { lecturerId: 102, roleInCouncil: 'SECRETARY' },
                { lecturerId: 103, roleInCouncil: 'REVIEWER' },
            ];
            const resA = await validateDefenseAssignment({
                registration: validRegistration,
                council: validCouncil,
                members: membersWithDuplicate,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(resA.ok).toBe(false);
            expect(resA.reasons.some((r) => r.includes('đã tham gia hội đồng bảo vệ khác'))).toBe(true);

            // Case B: via db query
            const mockDb = {
                councilMember: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            lecturerId: 102,
                            councilId: 99,
                            lecturer: { fullName: 'TS. Nguyễn Văn B' },
                            council: { name: 'Hội đồng 99' },
                        },
                    ]),
                },
            };
            const resB = await validateDefenseAssignment({
                registration: validRegistration,
                council: validCouncil,
                members: validMembers,
                semester,
            }, { db: mockDb });

            expect(resB.ok).toBe(false);
            expect(resB.reasons.some((r) => r.includes('đã tham gia hội đồng bảo vệ khác'))).toBe(true);
        });

        test('rejects when council exceeds max capacity of 30 students', async () => {
            const fullCouncil = {
                ...validCouncil,
                currentCount: 30, // MAX reached
            };

            const res = await validateDefenseAssignment({
                registration: validRegistration,
                council: fullCouncil,
                members: validMembers,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(res.ok).toBe(false);
            expect(res.reasons.some((r) => r.includes('đạt sức chứa tối đa'))).toBe(true);
        });

        test('rejects when council has no member matching topic accepted expertise', async () => {
            const nonMatchingMembers = [
                { lecturerId: 101, roleInCouncil: 'CHAIRMAN', expertiseAreas: ['Hệ thống nhúng'] },
                { lecturerId: 102, roleInCouncil: 'SECRETARY', expertiseAreas: ['Mạng máy tính'] },
                { lecturerId: 103, roleInCouncil: 'REVIEWER', expertiseAreas: ['An toàn thông tin'] },
            ];

            const res = await validateDefenseAssignment({
                registration: validRegistration, // topic acceptedExpertise is ['Trí tuệ nhân tạo']
                council: validCouncil,
                members: nonMatchingMembers,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(res.ok).toBe(false);
            expect(res.reasons.some((r) => r.includes('không có thành viên hội đồng nào khớp chuyên môn'))).toBe(true);
        });

        test('rejects when BM04 task is COMPLETED alone without valid conclusion', async () => {
            const unapprovedReg = {
                ...validRegistration,
                bm04Evaluation: null, // missing conclusion
                tasks: [{ taskType: 'BM04', status: 'COMPLETED' }],
            };

            const res = await validateDefenseAssignment({
                registration: unapprovedReg,
                council: validCouncil,
                members: validMembers,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(res.ok).toBe(false);
            expect(res.reasons.some((r) => r.includes('chưa đủ điều kiện bảo vệ'))).toBe(true);
        });

        test('rejects when council is inactive or deleted', async () => {
            const inactiveCouncil = {
                ...validCouncil,
                isActive: false,
            };

            const res = await validateDefenseAssignment({
                registration: validRegistration,
                council: inactiveCouncil,
                members: validMembers,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(res.ok).toBe(false);
            expect(res.reasons.some((r) => r.includes('không còn hoạt động'))).toBe(true);
        });

        test('rejects when semester mismatch occurs', async () => {
            const differentSemesterCouncil = {
                ...validCouncil,
                semesterId: 999,
            };

            const res = await validateDefenseAssignment({
                registration: validRegistration, // semesterId: 10
                council: differentSemesterCouncil,
                members: validMembers,
                semester,
            }, { db: { councilMember: { findMany: jest.fn().mockResolvedValue([]) } } });

            expect(res.ok).toBe(false);
            expect(res.reasons.some((r) => r.includes('không thuộc cùng học kỳ'))).toBe(true);
        });
    });
});
