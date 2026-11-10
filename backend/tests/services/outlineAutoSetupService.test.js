const {
    runAutoOutlineCouncilSetupForSemester,
    previewAutoOutlineCouncilSetup,
    getNextOutlineCouncilIndex,
} = require('../../src/services/outlineAutoSetupService');

describe('outlineAutoSetupService', () => {
    let mockTx;
    let mockDb;

    beforeEach(() => {
        mockTx = {
            semester: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 1,
                    code: 'HK2026',
                    defenseDate: new Date('2026-12-15'),
                }),
            },
            topicRegistration: {
                findMany: jest.fn(),
                updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            council: {
                findMany: jest.fn().mockResolvedValue([]),
                create: jest.fn().mockImplementation(({ data }) =>
                    Promise.resolve({
                        id: Math.floor(Math.random() * 1000) + 1,
                        ...data,
                    })
                ),
            },
            councilMember: {
                findMany: jest.fn().mockResolvedValue([]),
                deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
                createMany: jest.fn().mockResolvedValue({ count: 3 }),
            },
            user: {
                findMany: jest.fn(),
            },
            auditLog: {
                create: jest.fn().mockResolvedValue({ id: 1 }),
            },
        };

        mockDb = {
            $transaction: jest.fn((callback) => callback(mockTx)),
            semester: mockTx.semester,
            topicRegistration: mockTx.topicRegistration,
            council: mockTx.council,
            councilMember: mockTx.councilMember,
            user: mockTx.user,
            auditLog: mockTx.auditLog,
        };
    });

    describe('input validation and edge cases', () => {
        it('throws an error for non-integer or non-positive semesterId', async () => {
            await expect(runAutoOutlineCouncilSetupForSemester(null, {}, mockDb)).rejects.toThrow('Mã học kỳ không hợp lệ.');
            await expect(runAutoOutlineCouncilSetupForSemester('abc', {}, mockDb)).rejects.toThrow('Mã học kỳ không hợp lệ.');
            await expect(runAutoOutlineCouncilSetupForSemester(-1, {}, mockDb)).rejects.toThrow('Mã học kỳ không hợp lệ.');
            await expect(runAutoOutlineCouncilSetupForSemester(0, {}, mockDb)).rejects.toThrow('Mã học kỳ không hợp lệ.');
        });

        it('identifies and skips registrations missing topic or mentorId', async () => {
            const registrations = [
                { id: 1, studentId: 10, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: null },
                { id: 2, studentId: 20, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 2, mentorId: null } },
                { id: 3, studentId: 30, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 3, mentorId: 101 } },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);
            mockTx.user.findMany.mockResolvedValue([
                { id: 201, fullName: 'GV 1' },
                { id: 202, fullName: 'GV 2' },
                { id: 203, fullName: 'GV 3' },
            ]);

            const result = await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            expect(result.assignedStudents).toBe(1);
            expect(result.createdCouncils).toBe(1);
            expect(result.skippedStudents).toHaveLength(2);
            expect(result.skippedStudents).toEqual([
                { id: 1, studentId: 10, reason: 'NO_MENTOR' },
                { id: 2, studentId: 20, reason: 'NO_MENTOR' },
            ]);
        });

        it('returns zero assigned and populates skippedStudents if all registrations have missing mentors', async () => {
            const registrations = [
                { id: 1, studentId: 10, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: null },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);

            const result = await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            expect(result.createdCouncils).toBe(0);
            expect(result.assignedStudents).toBe(0);
            expect(result.skippedStudents).toHaveLength(1);
            expect(mockTx.council.create).not.toHaveBeenCalled();
        });
    });

    describe('idempotent and safe handling when no students are eligible', () => {
        it('returns zero counts when no registrations match BM01_SUBMITTED with outlineCouncilId null', async () => {
            mockTx.topicRegistration.findMany.mockResolvedValue([]);

            const result = await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            expect(result).toEqual({
                createdCouncils: 0,
                assignedStudents: 0,
                skippedStudents: [],
                warnings: [],
            });

            expect(mockTx.council.create).not.toHaveBeenCalled();
            expect(mockTx.topicRegistration.updateMany).not.toHaveBeenCalled();
            expect(mockTx.councilMember.createMany).not.toHaveBeenCalled();
        });

        it('handles non-existent semester gracefully', async () => {
            mockTx.semester.findUnique.mockResolvedValue(null);

            const result = await runAutoOutlineCouncilSetupForSemester(999, {}, mockDb);

            expect(result.createdCouncils).toBe(0);
            expect(result.assignedStudents).toBe(0);
            expect(result.warnings).toContain('Học kỳ không tồn tại.');
            expect(mockTx.council.create).not.toHaveBeenCalled();
        });
    });

    describe('mentor clustering (students of same mentor placed together)', () => {
        it('clusters students of same mentor together and splits into chunks of <= 10', async () => {
            // 6 students of Mentor 101, 4 students of Mentor 102, 5 students of Mentor 103
            // Passed in interleaved order to test sorting and clustering
            const registrations = [
                { id: 3, studentId: 30, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 3, mentorId: 101, title: 'T3' } },
                { id: 10, studentId: 40, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 10, mentorId: 102, title: 'T10' } },
                { id: 1, studentId: 10, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 1, mentorId: 101, title: 'T1' } },
                { id: 15, studentId: 50, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 15, mentorId: 103, title: 'T15' } },
                { id: 2, studentId: 20, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 2, mentorId: 101, title: 'T2' } },
                { id: 4, studentId: 31, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 4, mentorId: 101, title: 'T4' } },
                { id: 5, studentId: 32, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 5, mentorId: 101, title: 'T5' } },
                { id: 6, studentId: 33, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 6, mentorId: 101, title: 'T6' } },
                { id: 11, studentId: 41, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 11, mentorId: 102, title: 'T11' } },
                { id: 12, studentId: 42, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 12, mentorId: 102, title: 'T12' } },
                { id: 13, studentId: 43, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 13, mentorId: 102, title: 'T13' } },
                { id: 16, studentId: 51, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 16, mentorId: 103, title: 'T16' } },
                { id: 17, studentId: 52, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 17, mentorId: 103, title: 'T17' } },
                { id: 18, studentId: 53, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 18, mentorId: 103, title: 'T18' } },
                { id: 19, studentId: 54, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 19, mentorId: 103, title: 'T19' } },
            ];

            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);

            // Active lecturers available (none are mentors 101, 102, 103)
            const lecturers = [
                { id: 201, fullName: 'GV A' },
                { id: 202, fullName: 'GV B' },
                { id: 203, fullName: 'GV C' },
                { id: 204, fullName: 'GV D' },
            ];
            mockTx.user.findMany.mockResolvedValue(lecturers);

            let createdCouncilSeq = 1;
            mockTx.council.create.mockImplementation(({ data }) =>
                Promise.resolve({
                    id: 100 + createdCouncilSeq++,
                    ...data,
                })
            );

            const result = await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            // Total 15 students: chunk 1 (10 students: 6 from 101 + 4 from 102), chunk 2 (5 students: 5 from 103)
            expect(result.createdCouncils).toBe(2);
            expect(result.assignedStudents).toBe(15);
            expect(result.warnings).toHaveLength(0);

            // Check that chunk 1 has all 6 from mentor 101 + all 4 from mentor 102
            const updateCalls = mockTx.topicRegistration.updateMany.mock.calls;
            expect(updateCalls).toHaveLength(2);

            const chunk1Ids = updateCalls[0][0].where.id.in;
            expect(chunk1Ids).toHaveLength(10);
            expect(chunk1Ids).toEqual([1, 2, 3, 4, 5, 6, 10, 11, 12, 13]);

            const chunk2Ids = updateCalls[1][0].where.id.in;
            expect(chunk2Ids).toHaveLength(5);
            expect(chunk2Ids).toEqual([15, 16, 17, 18, 19]);
        });
    });

    describe('strict conflict of interest exclusion', () => {
        it('never assigns a student mentor to their council', async () => {
            // Chunk of 3 students all mentored by lecturer 101
            const registrations = [
                { id: 1, studentId: 11, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 1, mentorId: 101 } },
                { id: 2, studentId: 12, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 2, mentorId: 101 } },
                { id: 3, studentId: 13, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 3, mentorId: 101 } },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);

            // Lecturers list includes mentor 101 plus 3 other lecturers
            const lecturers = [
                { id: 101, fullName: 'Mentor 101' },
                { id: 102, fullName: 'Lecturer 102' },
                { id: 103, fullName: 'Lecturer 103' },
                { id: 104, fullName: 'Lecturer 104' },
            ];
            mockTx.user.findMany.mockResolvedValue(lecturers);

            mockTx.council.create.mockResolvedValue({
                id: 50,
                name: 'Hội đồng Xét duyệt Đề cương 1',
                councilType: 'OUTLINE_REVIEW',
            });

            await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            expect(mockTx.councilMember.createMany).toHaveBeenCalledTimes(1);
            const memberCreationData = mockTx.councilMember.createMany.mock.calls[0][0].data;

            // Must have 3 members: CHAIRMAN, SECRETARY, REVIEWER
            expect(memberCreationData).toHaveLength(3);
            const assignedLecturerIds = memberCreationData.map((m) => m.lecturerId);

            // Lecturer 101 MUST NOT be in assigned members
            expect(assignedLecturerIds).not.toContain(101);
            expect(assignedLecturerIds).toEqual([102, 103, 104]);

            // Role assignment order verification
            expect(memberCreationData[0].roleInCouncil).toBe('CHAIRMAN');
            expect(memberCreationData[1].roleInCouncil).toBe('SECRETARY');
            expect(memberCreationData[2].roleInCouncil).toBe('REVIEWER');
        });
    });

    describe('lecturer workload balancing', () => {
        it('prioritizes lecturers with lower load across councils', async () => {
            // 20 students mentored by 999 (not in lecturer pool)
            const registrations = Array.from({ length: 20 }, (_, i) => ({
                id: i + 1,
                studentId: i + 1,
                status: 'BM01_SUBMITTED',
                outlineCouncilId: null,
                topic: { id: i + 1, mentorId: 999 },
            }));
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);

            // 5 lecturers: L1, L2, L3, L4, L5. All start with load 0.
            const lecturers = [
                { id: 1, fullName: 'L1' },
                { id: 2, fullName: 'L2' },
                { id: 3, fullName: 'L3' },
                { id: 4, fullName: 'L4' },
                { id: 5, fullName: 'L5' },
            ];
            mockTx.user.findMany.mockResolvedValue(lecturers);

            let councilIdSeq = 1;
            mockTx.council.create.mockImplementation(({ data }) =>
                Promise.resolve({
                    id: councilIdSeq++,
                    ...data,
                })
            );

            await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            // 20 students -> 2 councils -> 2 member assignments
            expect(mockTx.councilMember.createMany).toHaveBeenCalledTimes(2);

            const firstCouncilMembers = mockTx.councilMember.createMany.mock.calls[0][0].data.map((m) => m.lecturerId);
            const secondCouncilMembers = mockTx.councilMember.createMany.mock.calls[1][0].data.map((m) => m.lecturerId);

            // Council 1 takes lowest loads (all 0, sorted by id): 1, 2, 3
            expect(firstCouncilMembers).toEqual([1, 2, 3]);

            // After council 1: loads are L1:1, L2:1, L3:1, L4:0, L5:0
            // Council 2 should pick L4 and L5 first (load 0), then L1 (load 1, lowest id)
            expect(secondCouncilMembers).toEqual([4, 5, 1]);
        });
    });

    describe('warning when not enough non-conflict lecturers', () => {
        it('records warning and leaves members unassigned if candidates < 3', async () => {
            const registrations = [
                { id: 1, studentId: 1, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 1, mentorId: 101 } },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);

            // Only 3 lecturers total, but 101 is the student's mentor -> only 2 eligible candidates
            const lecturers = [
                { id: 101, fullName: 'Mentor 101' },
                { id: 102, fullName: 'Lecturer 102' },
                { id: 103, fullName: 'Lecturer 103' },
            ];
            mockTx.user.findMany.mockResolvedValue(lecturers);

            mockTx.council.create.mockResolvedValue({
                id: 88,
                name: 'Hội đồng Xét duyệt Đề cương 1',
                councilType: 'OUTLINE_REVIEW',
            });

            const result = await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            expect(result.createdCouncils).toBe(1);
            expect(result.assignedStudents).toBe(1);
            expect(result.warnings).toContain('Council 88 does not have enough eligible non-conflict lecturers.');
            expect(mockTx.councilMember.createMany).not.toHaveBeenCalled();
        });
    });

    describe('council name numbering helper and sequence', () => {
        it('computes next council index correctly with getNextOutlineCouncilIndex', () => {
            expect(getNextOutlineCouncilIndex([])).toBe(1);
            expect(getNextOutlineCouncilIndex([{ name: 'Hội đồng Xét duyệt Đề cương 1' }])).toBe(2);
            expect(getNextOutlineCouncilIndex([
                { name: 'Hội đồng Xét duyệt Đề cương 1' },
                { name: 'Hội đồng Xét duyệt Đề cương 5' },
                { name: 'Khác' },
            ])).toBe(6);
        });

        it('continues numbering from existing outline councils in semester', async () => {
            const registrations = [
                { id: 1, studentId: 1, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 1, mentorId: 99 } },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);

            mockTx.council.findMany.mockResolvedValue([
                { id: 10, name: 'Hội đồng Xét duyệt Đề cương 1', councilType: 'OUTLINE_REVIEW', members: [] },
                { id: 11, name: 'Hội đồng Xét duyệt Đề cương 2', councilType: 'OUTLINE_REVIEW', members: [] },
                { id: 12, name: 'Hội đồng Bảo vệ 5', councilType: 'DEFENSE_COUNCIL', members: [] },
            ]);

            mockTx.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'L1' },
                { id: 2, fullName: 'L2' },
                { id: 3, fullName: 'L3' },
            ]);

            await runAutoOutlineCouncilSetupForSemester(1, {}, mockDb);

            expect(mockTx.council.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: 'Hội đồng Xét duyệt Đề cương 3',
                    councilType: 'OUTLINE_REVIEW',
                    meetingMode: 'IN_PERSON',
                }),
            });
        });
    });

    describe('audit logging', () => {
        it('records AuditLog when actorId is provided in options', async () => {
            const registrations = [
                { id: 1, studentId: 1, status: 'BM01_SUBMITTED', outlineCouncilId: null, topic: { id: 1, mentorId: 99 } },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);
            mockTx.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'L1' },
                { id: 2, fullName: 'L2' },
                { id: 3, fullName: 'L3' },
            ]);

            await runAutoOutlineCouncilSetupForSemester(1, { actorId: 999, ipAddress: '127.0.0.1' }, mockDb);

            expect(mockTx.auditLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 999,
                    action: 'AUTO_ASSIGN_OUTLINE_COUNCILS',
                    entityType: 'Council',
                    ipAddress: '127.0.0.1',
                }),
            });
        });
    });

    describe('previewAutoOutlineCouncilSetup (read-only preview)', () => {
        it('throws an error for non-integer or non-positive semesterId', async () => {
            await expect(previewAutoOutlineCouncilSetup(null, mockDb)).rejects.toThrow('Mã học kỳ không hợp lệ.');
            await expect(previewAutoOutlineCouncilSetup('invalid', mockDb)).rejects.toThrow('Mã học kỳ không hợp lệ.');
            await expect(previewAutoOutlineCouncilSetup(0, mockDb)).rejects.toThrow('Mã học kỳ không hợp lệ.');
        });

        it('returns empty proposedCouncils and warning if semester does not exist', async () => {
            mockTx.semester.findUnique.mockResolvedValue(null);

            const result = await previewAutoOutlineCouncilSetup(999, mockDb);

            expect(result).toEqual({
                proposedCouncils: [],
                skippedStudents: [],
                warnings: ['Học kỳ không tồn tại.'],
            });
        });

        it('returns proposed councils with 3 members (CHAIRMAN, SECRETARY, REVIEWER) without writing to DB', async () => {
            const registrations = [
                {
                    id: 1,
                    studentId: 10,
                    status: 'BM01_SUBMITTED',
                    outlineCouncilId: null,
                    student: { id: 10, fullName: 'Sinh Vien A', code: 'SV001' },
                    topic: { id: 1, title: 'De tai 1', mentorId: 101, mentor: { id: 101, fullName: 'GV Huong Dan 1' } },
                },
                {
                    id: 2,
                    studentId: 20,
                    status: 'BM01_SUBMITTED',
                    outlineCouncilId: null,
                    student: { id: 20, fullName: 'Sinh Vien B', code: 'SV002' },
                    topic: { id: 2, title: 'De tai 2', mentorId: 101, mentor: { id: 101, fullName: 'GV Huong Dan 1' } },
                },
                {
                    id: 3,
                    studentId: 30,
                    status: 'BM01_SUBMITTED',
                    outlineCouncilId: null,
                    student: { id: 30, fullName: 'Sinh Vien C', code: 'SV003' },
                    topic: null,
                },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);

            const lecturers = [
                { id: 101, fullName: 'GV Huong Dan 1' },
                { id: 201, fullName: 'GV A' },
                { id: 202, fullName: 'GV B' },
                { id: 203, fullName: 'GV C' },
            ];
            mockTx.user.findMany.mockResolvedValue(lecturers);

            const result = await previewAutoOutlineCouncilSetup(1, mockDb);

            expect(result.skippedStudents).toHaveLength(1);
            expect(result.skippedStudents[0]).toEqual({ id: 3, studentId: 30, reason: 'NO_MENTOR' });
            expect(result.proposedCouncils).toHaveLength(1);

            const council = result.proposedCouncils[0];
            expect(council.tempId).toBe('temp-1');
            expect(council.name).toBe('Hội đồng Xét duyệt Đề cương 1');
            expect(council.registrations).toHaveLength(2);
            expect(council.registrations[0]).toEqual({
                id: 1,
                studentId: 10,
                studentCode: 'SV001',
                studentName: 'Sinh Vien A',
                topicTitle: 'De tai 1',
                mentorId: 101,
                mentorName: 'GV Huong Dan 1',
            });
            expect(council.excludedMentors).toEqual([{ id: 101, fullName: 'GV Huong Dan 1' }]);

            // Ensure 3 members assigned with CHAIRMAN, SECRETARY, REVIEWER
            expect(council.members).toHaveLength(3);
            expect(council.members[0]).toEqual({ lecturerId: 201, lecturerName: 'GV A', roleInCouncil: 'CHAIRMAN' });
            expect(council.members[1]).toEqual({ lecturerId: 202, lecturerName: 'GV B', roleInCouncil: 'SECRETARY' });
            expect(council.members[2]).toEqual({ lecturerId: 203, lecturerName: 'GV C', roleInCouncil: 'REVIEWER' });

            // Verify read-only: no database mutations
            expect(mockTx.council.create).not.toHaveBeenCalled();
            expect(mockTx.topicRegistration.updateMany).not.toHaveBeenCalled();
            expect(mockTx.councilMember.createMany).not.toHaveBeenCalled();
        });

        it('warns when not enough non-conflict lecturers in preview', async () => {
            const registrations = [
                {
                    id: 1,
                    studentId: 10,
                    status: 'BM01_SUBMITTED',
                    outlineCouncilId: null,
                    student: { id: 10, fullName: 'SV 1', code: 'SV1' },
                    topic: { id: 1, title: 'T1', mentorId: 101, mentor: { id: 101, fullName: 'M1' } },
                },
            ];
            mockTx.topicRegistration.findMany.mockResolvedValue(registrations);
            // Only 2 lecturers excluding mentor 101
            mockTx.user.findMany.mockResolvedValue([
                { id: 101, fullName: 'M1' },
                { id: 201, fullName: 'GV 1' },
                { id: 202, fullName: 'GV 2' },
            ]);

            const result = await previewAutoOutlineCouncilSetup(1, mockDb);

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('does not have enough eligible non-conflict lecturers');
            expect(result.proposedCouncils[0].members).toHaveLength(0);
        });
    });

    describe('options.proposedCouncils in runAutoOutlineCouncilSetupForSemester', () => {
        it('persists customized proposed councils when valid', async () => {
            const proposed = [
                {
                    tempId: 'temp-1',
                    name: 'Hội đồng Tùy chỉnh 1',
                    registrationIds: [1, 2],
                    members: [
                        { lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                        { lecturerId: 202, roleInCouncil: 'SECRETARY' },
                        { lecturerId: 203, roleInCouncil: 'REVIEWER' },
                    ],
                },
            ];

            mockTx.council.create.mockResolvedValue({ id: 55, name: 'Hội đồng Tùy chỉnh 1' });

            const result = await runAutoOutlineCouncilSetupForSemester(1, { proposedCouncils: proposed }, mockDb);

            expect(result.createdCouncils).toBe(1);
            expect(result.assignedStudents).toBe(2);

            expect(mockTx.council.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: 'Hội đồng Tùy chỉnh 1',
                    councilType: 'OUTLINE_REVIEW',
                    meetingMode: 'IN_PERSON',
                }),
            });

            expect(mockTx.topicRegistration.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [1, 2] } },
                data: { outlineCouncilId: 55 },
            });

            expect(mockTx.councilMember.createMany).toHaveBeenCalledWith({
                data: [
                    { councilId: 55, lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                    { councilId: 55, lecturerId: 202, roleInCouncil: 'SECRETARY' },
                    { councilId: 55, lecturerId: 203, roleInCouncil: 'REVIEWER' },
                ],
            });
        });

        it('handles proposedCouncils with registrations objects instead of registrationIds array', async () => {
            const proposed = [
                {
                    tempId: 'temp-1',
                    registrations: [{ id: 10 }, { id: 20 }],
                    members: [
                        { lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                        { lecturerId: 202, roleInCouncil: 'SECRETARY' },
                        { lecturerId: 203, roleInCouncil: 'REVIEWER' },
                    ],
                },
            ];

            mockTx.council.create.mockResolvedValue({ id: 60, name: 'Hội đồng Xét duyệt Đề cương 1' });

            const result = await runAutoOutlineCouncilSetupForSemester(1, { proposedCouncils: proposed }, mockDb);

            expect(result.createdCouncils).toBe(1);
            expect(result.assignedStudents).toBe(2);
            expect(mockTx.topicRegistration.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [10, 20] } },
                data: { outlineCouncilId: 60 },
            });
        });

        it('returns zero created councils when proposedCouncils is empty array', async () => {
            const result = await runAutoOutlineCouncilSetupForSemester(1, { proposedCouncils: [] }, mockDb);

            expect(result).toEqual({
                createdCouncils: 0,
                assignedStudents: 0,
                skippedStudents: [],
                warnings: [],
            });
            expect(mockTx.council.create).not.toHaveBeenCalled();
        });

        it('rejects proposedCouncils when members have duplicate lecturers', async () => {
            const proposed = [
                {
                    tempId: 'temp-1',
                    registrationIds: [1],
                    members: [
                        { lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                        { lecturerId: 201, roleInCouncil: 'SECRETARY' }, // Duplicate!
                        { lecturerId: 203, roleInCouncil: 'REVIEWER' },
                    ],
                },
            ];

            await expect(
                runAutoOutlineCouncilSetupForSemester(1, { proposedCouncils: proposed }, mockDb)
            ).rejects.toThrow('Hội đồng phải có đúng 3 giảng viên khác nhau với các vai trò CHAIRMAN, SECRETARY, REVIEWER.');
        });

        it('rejects proposedCouncils when members length is not 3', async () => {
            const proposed = [
                {
                    tempId: 'temp-1',
                    registrationIds: [1],
                    members: [
                        { lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                        { lecturerId: 202, roleInCouncil: 'SECRETARY' },
                    ],
                },
            ];

            await expect(
                runAutoOutlineCouncilSetupForSemester(1, { proposedCouncils: proposed }, mockDb)
            ).rejects.toThrow('Hội đồng phải có đúng 3 giảng viên khác nhau với các vai trò CHAIRMAN, SECRETARY, REVIEWER.');
        });

        it('rejects proposedCouncils when member roles do not match required roles', async () => {
            const proposed = [
                {
                    tempId: 'temp-1',
                    registrationIds: [1],
                    members: [
                        { lecturerId: 201, roleInCouncil: 'CHAIRMAN' },
                        { lecturerId: 202, roleInCouncil: 'SECRETARY' },
                        { lecturerId: 203, roleInCouncil: 'MEMBER' }, // Invalid role, must be REVIEWER
                    ],
                },
            ];

            await expect(
                runAutoOutlineCouncilSetupForSemester(1, { proposedCouncils: proposed }, mockDb)
            ).rejects.toThrow('Hội đồng phải có đúng 3 giảng viên khác nhau với các vai trò CHAIRMAN, SECRETARY, REVIEWER.');
        });
    });
});
