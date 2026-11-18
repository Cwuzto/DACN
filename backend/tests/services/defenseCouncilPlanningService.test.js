/**
 * Unit tests cho defenseCouncilPlanningService
 */
const {
    buildDefenseCouncilPlan,
    splitConfirmedStudentsIntoShifts,
    calculateFingerprint,
    buildFingerprintPayload,
    MAX_COUNCIL_CAPACITY,
} = require('../../src/services/defenseCouncilPlanningService');

describe('defenseCouncilPlanningService', () => {
    describe('splitConfirmedStudentsIntoShifts', () => {
        test('phân bổ 22 sinh viên thành ca sáng 11 và ca chiều 11', () => {
            const students = Array.from({ length: 22 }, (_, i) => ({
                id: i + 1,
                registrationId: i + 1,
                studentName: `Sinh viên ${i + 1}`,
            }));

            const result = splitConfirmedStudentsIntoShifts(students);

            expect(result.morningShift.students).toHaveLength(11);
            expect(result.afternoonShift.students).toHaveLength(11);
            expect(result.students).toHaveLength(22);

            // Kiểm tra số thứ tự trong ca và toàn hội đồng
            expect(result.morningShift.students[0].orderInShift).toBe(1);
            expect(result.morningShift.students[0].sequenceNo).toBe(1);
            expect(result.morningShift.students[0].shift).toBe('MORNING');

            expect(result.morningShift.students[10].orderInShift).toBe(11);
            expect(result.morningShift.students[10].sequenceNo).toBe(11);

            expect(result.afternoonShift.students[0].orderInShift).toBe(1);
            expect(result.afternoonShift.students[0].sequenceNo).toBe(12);
            expect(result.afternoonShift.students[0].shift).toBe('AFTERNOON');

            expect(result.afternoonShift.students[10].orderInShift).toBe(11);
            expect(result.afternoonShift.students[10].sequenceNo).toBe(22);
        });

        test('phân bổ 23 sinh viên thành ca sáng 12 và ca chiều 11 (lẻ ca sáng thêm 1)', () => {
            const students = Array.from({ length: 23 }, (_, i) => ({
                id: i + 1,
                registrationId: i + 1,
                studentName: `Sinh viên ${i + 1}`,
            }));

            const result = splitConfirmedStudentsIntoShifts(students);

            expect(result.morningShift.students).toHaveLength(12);
            expect(result.afternoonShift.students).toHaveLength(11);
            expect(result.students).toHaveLength(23);

            expect(result.morningShift.students[11].orderInShift).toBe(12);
            expect(result.morningShift.students[11].sequenceNo).toBe(12);

            expect(result.afternoonShift.students[0].orderInShift).toBe(1);
            expect(result.afternoonShift.students[0].sequenceNo).toBe(13);
            expect(result.afternoonShift.students[10].orderInShift).toBe(11);
            expect(result.afternoonShift.students[10].sequenceNo).toBe(23);
        });

        test('bảo toàn thứ tự ưu tiên theo orderedRegistrationIds', () => {
            const students = [
                { id: 10, registrationId: 10, studentName: 'SV 10' },
                { id: 20, registrationId: 20, studentName: 'SV 20' },
                { id: 30, registrationId: 30, studentName: 'SV 30' },
                { id: 40, registrationId: 40, studentName: 'SV 40' },
            ];

            const orderedIds = [30, 10, 40, 20];
            const result = splitConfirmedStudentsIntoShifts(students, orderedIds);

            expect(result.morningShift.students.map((s) => s.id)).toEqual([30, 10]);
            expect(result.afternoonShift.students.map((s) => s.id)).toEqual([40, 20]);
        });
    });

    describe('calculateFingerprint', () => {
        test('tính fingerprint đồng nhất khi cùng input', () => {
            const payload1 = buildFingerprintPayload({
                semesterId: 1,
                date: '2026-12-15',
                rooms: ['A101', 'A102'],
                targetSize: 22,
                eligibleRegistrations: [
                    { id: 2, studentId: 102, status: 'BM04_PASSED', topicId: 202, topic: { title: 'T2', mentorId: 5 } },
                    { id: 1, studentId: 101, status: 'DEFENSE_READY', topicId: 201, topic: { title: 'T1', mentorId: 4 } },
                ],
                availableLecturers: [
                    { id: 2, expertiseAreas: ['Xử lý ảnh'] },
                    { id: 1, expertiseAreas: ['AI'] },
                ],
            });

            // Payload 2 đảo lộn thứ tự truyền vào nhưng dữ liệu nguồn như nhau
            const payload2 = buildFingerprintPayload({
                semesterId: 1,
                date: '2026-12-15',
                rooms: ['A102', 'A101'],
                targetSize: 22,
                eligibleRegistrations: [
                    { id: 1, studentId: 101, status: 'DEFENSE_READY', topicId: 201, topic: { title: 'T1', mentorId: 4 } },
                    { id: 2, studentId: 102, status: 'BM04_PASSED', topicId: 202, topic: { title: 'T2', mentorId: 5 } },
                ],
                availableLecturers: [
                    { id: 1, expertiseAreas: ['AI'] },
                    { id: 2, expertiseAreas: ['Xử lý ảnh'] },
                ],
            });

            const hash1 = calculateFingerprint(payload1);
            const hash2 = calculateFingerprint(payload2);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        });

        test('thay đổi dữ liệu nguồn sinh fingerprint khác', () => {
            const baseInput = {
                semesterId: 1,
                date: '2026-12-15',
                rooms: ['A101'],
                targetSize: 22,
                eligibleRegistrations: [{ id: 1, studentId: 101, status: 'DEFENSE_READY', topicId: 201 }],
                availableLecturers: [{ id: 1, expertiseAreas: ['AI'] }],
            };

            const hash1 = calculateFingerprint(buildFingerprintPayload(baseInput));
            const hash2 = calculateFingerprint(
                buildFingerprintPayload({ ...baseInput, targetSize: 20 })
            );

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('buildDefenseCouncilPlan - Kiểm tra tài nguyên và điều kiện thất bại (INFEASIBLE)', () => {
        let mockDb;

        beforeEach(() => {
            mockDb = {
                semester: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 1,
                        code: 'HK2026',
                        defenseDate: new Date('2026-12-15'),
                    }),
                },
                council: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
                topicRegistration: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
                user: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
                topicExpertiseAssessment: {
                    findUnique: jest.fn().mockResolvedValue(null),
                },
            };
        });

        test('trả về INFEASIBLE khi thiếu ngày bảo vệ cả ở tham số và Semester', async () => {
            mockDb.semester.findUnique.mockResolvedValue({ id: 1, defenseDate: null });

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, rooms: ['A101'] },
                { db: mockDb }
            );

            expect(result.status).toBe('INFEASIBLE');
            expect(result.reasons).toContain('Ngày bảo vệ chưa được cấu hình cho học kỳ và không được truyền vào');
        });

        test('trả về INFEASIBLE khi targetSize ngoài khoảng 1-30', async () => {
            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['A101'], targetSize: 35 },
                { db: mockDb }
            );

            expect(result.status).toBe('INFEASIBLE');
            expect(result.reasons[0]).toMatch(/Mục tiêu quy mô sinh viên \/ hội đồng phải từ 1 đến 30/);
        });

        test('trả về INFEASIBLE khi số phòng khả dụng không đủ cho số hội đồng dự kiến', async () => {
            // 44 sinh viên với target 22 -> cần 2 hội đồng
            const students = Array.from({ length: 44 }, (_, i) => ({
                id: i + 1,
                studentId: 100 + i,
                status: 'DEFENSE_READY',
                assignmentStatus: 'ACTIVE',
                semesterId: 1,
                bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                topic: { id: 200 + i, title: `Đề tài ${i}`, mentorId: 999 },
            }));
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            // Chỉ cung cấp 1 phòng
            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['A101'], targetSize: 22 },
                { db: mockDb }
            );

            expect(result.status).toBe('INFEASIBLE');
            expect(result.reasons).toContain('Số phòng khả dụng không đủ cho số hội đồng dự kiến');
        });

        test('trả về INFEASIBLE khi số giảng viên không đủ lập đủ số hội đồng', async () => {
            // 44 sinh viên với target 22 -> 2 hội đồng -> cần tối thiểu 6 giảng viên
            const students = Array.from({ length: 44 }, (_, i) => ({
                id: i + 1,
                studentId: 100 + i,
                status: 'DEFENSE_READY',
                assignmentStatus: 'ACTIVE',
                semesterId: 1,
                bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                topic: { id: 200 + i, title: `Đề tài ${i}`, mentorId: 999 },
            }));
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            // Chỉ có 4 giảng viên
            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV 1', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 2, fullName: 'GV 2', role: 'LECTURER', isActive: true, expertiseAreas: ['Web'] },
                { id: 3, fullName: 'GV 3', role: 'LECTURER', isActive: true, expertiseAreas: ['Mobile'] },
                { id: 4, fullName: 'GV 4', role: 'LECTURER', isActive: true, expertiseAreas: ['Data'] },
            ]);

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['A101', 'A102'], targetSize: 22 },
                { db: mockDb }
            );

            expect(result.status).toBe('INFEASIBLE');
            expect(result.reasons).toContain('Số giảng viên không đủ để lập hội đồng');
        });

        test('trả về INFEASIBLE khi đề tài có chuyên môn mà không giảng viên nào có', async () => {
            const students = [
                {
                    id: 1,
                    studentId: 101,
                    status: 'DEFENSE_READY',
                    assignmentStatus: 'ACTIVE',
                    semesterId: 1,
                    bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                    topic: {
                        id: 201,
                        title: 'Blockchain bảo mật lượng tử',
                        mentorId: 99,
                        acceptedExpertise: ['Quantum Computing'],
                    },
                },
            ];
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV 1', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 2, fullName: 'GV 2', role: 'LECTURER', isActive: true, expertiseAreas: ['Web'] },
                { id: 3, fullName: 'GV 3', role: 'LECTURER', isActive: true, expertiseAreas: ['Mobile'] },
            ]);

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['A101'], targetSize: 22 },
                { db: mockDb }
            );

            expect(result.status).toBe('INFEASIBLE');
            expect(result.reasons[0]).toMatch(/Không có giảng viên nào khớp chuyên môn/);
        });
    });

    describe('buildDefenseCouncilPlan - Phân bổ thành công và thỏa mãn các ràng buộc', () => {
        let mockDb;

        beforeEach(() => {
            mockDb = {
                semester: {
                    findUnique: jest.fn().mockResolvedValue({
                        id: 1,
                        code: 'HK2026',
                        defenseDate: new Date('2026-12-15'),
                    }),
                },
                council: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
                topicRegistration: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
                user: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
                topicExpertiseAssessment: {
                    findUnique: jest.fn().mockResolvedValue(null),
                },
            };
        });

        test('phân bổ 22 sinh viên vào 1 hội đồng chia ca 11/11, không xung đột GVHD, phòng riêng', async () => {
            const mentorId = 10;
            const students = Array.from({ length: 22 }, (_, i) => ({
                id: i + 1,
                studentId: 100 + i,
                status: 'DEFENSE_READY',
                assignmentStatus: 'ACTIVE',
                semesterId: 1,
                bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                topic: {
                    id: 200 + i,
                    title: `Đề tài AI ${i + 1}`,
                    mentorId: mentorId,
                    mentor: { id: mentorId, fullName: 'Thầy Mentor' },
                    acceptedExpertise: ['AI'],
                },
            }));
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            // Cung cấp 4 giảng viên: GV 1, 2, 3 (khớp AI) và GV 10 (Mentor)
            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV AI 1', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 2, fullName: 'GV AI 2', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 3, fullName: 'GV AI 3', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 10, fullName: 'Thầy Mentor', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
            ]);

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['Phòng A101'], targetSize: 22 },
                { db: mockDb }
            );

            expect(result.status).toBe('FEASIBLE');
            expect(result.councils).toHaveLength(1);

            const council = result.councils[0];
            expect(council.name).toBe('Hội đồng 1');
            expect(council.room).toBe('Phòng A101');
            expect(council.studentCount).toBe(22);
            expect(council.morningShift.students).toHaveLength(11);
            expect(council.afternoonShift.students).toHaveLength(11);

            // 1. Không có xung đột GVHD: Thầy Mentor (id 10) KHÔNG được nằm trong hội đồng
            const memberIds = council.members.map((m) => m.lecturerId);
            expect(memberIds).not.toContain(10);
            expect(memberIds.sort((a, b) => a - b)).toEqual([1, 2, 3]);

            // 2. Hội đồng gồm 3 vai trò: CHAIRMAN, SECRETARY, REVIEWER
            const roles = council.members.map((m) => m.role);
            expect(roles).toContain('CHAIRMAN');
            expect(roles).toContain('SECRETARY');
            expect(roles).toContain('REVIEWER');

            // 3. Mỗi sinh viên đều được phân bổ và có giải thích
            expect(council.students).toHaveLength(22);
            council.students.forEach((s) => {
                expect(s.explanation).toContain('Không xung đột GVHD');
            });
        });

        test('phân bổ 23 sinh viên với targetSize 23 chia ca 12 sáng / 11 chiều', async () => {
            const students = Array.from({ length: 23 }, (_, i) => ({
                id: i + 1,
                studentId: 100 + i,
                status: 'DEFENSE_READY',
                assignmentStatus: 'ACTIVE',
                semesterId: 1,
                bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                topic: {
                    id: 200 + i,
                    title: `Đề tài Mạng ${i + 1}`,
                    mentorId: 99,
                    mentor: { id: 99, fullName: 'Mentor Ngoài' },
                    acceptedExpertise: ['An toàn mạng'],
                },
            }));
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV 1', role: 'LECTURER', isActive: true, expertiseAreas: ['An toàn mạng'] },
                { id: 2, fullName: 'GV 2', role: 'LECTURER', isActive: true, expertiseAreas: ['An toàn mạng'] },
                { id: 3, fullName: 'GV 3', role: 'LECTURER', isActive: true, expertiseAreas: ['An toàn mạng'] },
            ]);

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['Phòng B102'], targetSize: 23 },
                { db: mockDb }
            );

            expect(result.status).toBe('FEASIBLE');
            expect(result.councils).toHaveLength(1);
            const council = result.councils[0];
            expect(council.studentCount).toBe(23);
            expect(council.morningShift.students).toHaveLength(12);
            expect(council.afternoonShift.students).toHaveLength(11);
        });

        test('kết quả tìm nghiệm có tính tất định (deterministic output) cùng input cho cùng kết quả', async () => {
            const students = Array.from({ length: 10 }, (_, i) => ({
                id: i + 1,
                studentId: 100 + i,
                status: 'DEFENSE_READY',
                assignmentStatus: 'ACTIVE',
                semesterId: 1,
                bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                topic: {
                    id: 200 + i,
                    title: `Đề tài ${i + 1}`,
                    mentorId: i % 2 === 0 ? 10 : 99,
                    acceptedExpertise: ['AI'],
                },
            }));
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV 1', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 2, fullName: 'GV 2', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 3, fullName: 'GV 3', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 10, fullName: 'GV 10', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
            ]);

            const run1 = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['A101'], targetSize: 10 },
                { db: mockDb }
            );
            const run2 = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['A101'], targetSize: 10 },
                { db: mockDb }
            );

            expect(run1.status).toBe('FEASIBLE');
            expect(run2.status).toBe('FEASIBLE');
            expect(run1.fingerprint).toBe(run2.fingerprint);
            expect(run1.councils[0].members.map((m) => m.lecturerId)).toEqual(
                run2.councils[0].members.map((m) => m.lecturerId)
            );
            expect(run1.councils[0].students.map((s) => s.id)).toEqual(
                run2.councils[0].students.map((s) => s.id)
            );
        });

        test('phân bổ 100 sinh viên với targetSize 22 tạo 5 hội đồng, mỗi hội đồng phòng riêng, GV không trùng', async () => {
            // 100 sinh viên
            const students = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                studentId: 1000 + i,
                status: 'DEFENSE_READY',
                assignmentStatus: 'ACTIVE',
                semesterId: 1,
                bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                topic: {
                    id: 2000 + i,
                    title: `Đề tài Phần mềm ${i + 1}`,
                    mentorId: 99, // mentor bên ngoài
                    mentor: { id: 99, fullName: 'Mentor Ngoài' },
                    acceptedExpertise: ['Kỹ nghệ phần mềm'],
                },
            }));
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            // Cần tối thiểu 5 hội đồng * 3 = 15 giảng viên
            const lecturers = Array.from({ length: 15 }, (_, i) => ({
                id: i + 1,
                fullName: `TS. Giảng viên ${i + 1}`,
                role: 'LECTURER',
                isActive: true,
                expertiseAreas: ['Kỹ nghệ phần mềm'],
            }));
            mockDb.user.findMany.mockResolvedValue(lecturers);

            const rooms = ['P101', 'P102', 'P103', 'P104', 'P105'];

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms, targetSize: 22 },
                { db: mockDb }
            );

            expect(result.status).toBe('FEASIBLE');
            expect(result.councils).toHaveLength(5);
            expect(result.coverage.totalEligible).toBe(100);
            expect(result.coverage.assigned).toBe(100);

            // Kiểm tra: Mỗi hội đồng 1 phòng riêng, không trùng phòng
            const assignedRooms = result.councils.map((c) => c.room);
            const uniqueRooms = new Set(assignedRooms);
            expect(uniqueRooms.size).toBe(5);

            // Kiểm tra: Mỗi giảng viên chỉ ở tối đa 1 hội đồng bảo vệ trong học kỳ
            const allAssignedLecturerIds = result.councils.flatMap((c) => c.members.map((m) => m.lecturerId));
            expect(allAssignedLecturerIds).toHaveLength(15);
            const uniqueLecturers = new Set(allAssignedLecturerIds);
            expect(uniqueLecturers.size).toBe(15);

            // Kiểm tra: Không hội đồng nào vượt quá trần cứng 30 sinh viên
            result.councils.forEach((c) => {
                expect(c.studentCount).toBeLessThanOrEqual(MAX_COUNCIL_CAPACITY);
                expect(c.studentCount).toBeGreaterThan(0);
            });

            // Tổng số sinh viên được gán qua các ca đúng 100
            const totalAssignedStudents = result.councils.reduce((sum, c) => sum + c.studentCount, 0);
            expect(totalAssignedStudents).toBe(100);
        });

        test('bảo toàn hội đồng bảo vệ đã công bố lịch (fixed council)', async () => {
            // Giả lập 1 hội đồng đã công bố lịch với 2 sinh viên (SV 1, SV 2) ở phòng P201
            const fixedCouncil = {
                id: 10,
                name: 'Hội đồng 1',
                semesterId: 1,
                councilType: 'DEFENSE_COUNCIL',
                isActive: true,
                schedulePublishedAt: new Date('2026-11-10'),
                defenseDate: new Date('2026-12-15'),
                location: 'P201',
                members: [
                    { id: 101, lecturerId: 1, roleInCouncil: 'CHAIRMAN', lecturer: { id: 1, fullName: 'GV 1', expertiseAreas: ['AI'] } },
                    { id: 102, lecturerId: 2, roleInCouncil: 'SECRETARY', lecturer: { id: 2, fullName: 'GV 2', expertiseAreas: ['AI'] } },
                    { id: 103, lecturerId: 3, roleInCouncil: 'REVIEWER', lecturer: { id: 3, fullName: 'GV 3', expertiseAreas: ['AI'] } },
                ],
                defenseRegistrations: [
                    { id: 1, studentId: 501, student: { fullName: 'SV Đã Xếp 1' }, topic: { id: 601, title: 'Đề tài 1' } },
                    { id: 2, studentId: 502, student: { fullName: 'SV Đã Xếp 2' }, topic: { id: 602, title: 'Đề tài 2' } },
                ],
            };
            mockDb.council.findMany.mockResolvedValue([fixedCouncil]);

            // Sinh viên cần xếp mới: SV 3, SV 4
            const newStudents = [
                {
                    id: 3,
                    studentId: 503,
                    status: 'DEFENSE_READY',
                    assignmentStatus: 'ACTIVE',
                    semesterId: 1,
                    bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                    topic: { id: 603, title: 'Đề tài 3', mentorId: 99, acceptedExpertise: ['AI'] },
                },
                {
                    id: 4,
                    studentId: 504,
                    status: 'DEFENSE_READY',
                    assignmentStatus: 'ACTIVE',
                    semesterId: 1,
                    bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                    topic: { id: 604, title: 'Đề tài 4', mentorId: 99, acceptedExpertise: ['AI'] },
                },
            ];
            mockDb.topicRegistration.findMany.mockResolvedValue(newStudents);

            // Danh sách giảng viên: gồm cả GV 1, 2, 3 (đã ở hội đồng cố định) và GV 4, 5, 6 (mới)
            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV 1', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 2, fullName: 'GV 2', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 3, fullName: 'GV 3', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 4, fullName: 'GV 4', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 5, fullName: 'GV 5', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 6, fullName: 'GV 6', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
            ]);

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['P201', 'P202'], targetSize: 22 },
                { db: mockDb }
            );

            expect(result.status).toBe('FEASIBLE');
            expect(result.councils).toHaveLength(2);

            // Hội đồng cố định được bảo toàn
            const fixedResult = result.councils.find((c) => c.isFixed === true);
            expect(fixedResult).toBeDefined();
            expect(fixedResult.name).toBe('Hội đồng 1');
            expect(fixedResult.room).toBe('P201');

            // Hội đồng mới không được dùng phòng P201 và không được dùng giảng viên 1, 2, 3
            const proposedResult = result.councils.find((c) => c.isFixed === false);
            expect(proposedResult).toBeDefined();
            expect(proposedResult.name).toBe('Hội đồng 2');
            expect(proposedResult.room).toBe('P202');
            expect(proposedResult.members.map((m) => m.lecturerId).sort((a, b) => a - b)).toEqual([4, 5, 6]);

            // Tổng độ phủ bao gồm cả sinh viên cố định và mới
            expect(result.coverage.totalEligible).toBe(4);
            expect(result.coverage.assigned).toBe(4);
        });

        test('giải thuật vượt qua fixture mà thuật toán gán tham lam (greedy) thất bại', async () => {
            /**
             * Kịch bản:
             * 2 hội đồng, targetSize = 2.
             * HĐ 1 có GV {1, 2, 3}.
             * HĐ 2 có GV {4, 5, 6}.
             * Sinh viên:
             * SV A (mentor 4): BẮT BUỘC sang HĐ 1 (vì mentor 4 ở HĐ 2).
             * SV D (mentor 1): BẮT BUỘC sang HĐ 2 (vì mentor 1 ở HĐ 1).
             * SV B (mentor 99): Có thể ở cả HĐ 1 hoặc 2.
             * SV C (mentor 99): Có thể ở cả HĐ 1 hoặc 2.
             *
             * Nếu gán tham lam theo thứ tự [B, C, A, D]:
             * B vào HĐ 1 (HĐ 1 có 1 SV).
             * C vào HĐ 1 (HĐ 1 đầy với 2 SV).
             * A đến lượt cần vào HĐ 1 nhưng HĐ 1 đã đầy! Tham lam báo THẤT BẠI.
             *
             * Solver với Dinic Max Flow sẽ đẩy luồng để gán:
             * HĐ 1: {A, B} và HĐ 2: {C, D} -> THÀNH CÔNG!
             */
            const students = [
                {
                    id: 1, // SV B
                    studentId: 101,
                    status: 'DEFENSE_READY',
                    assignmentStatus: 'ACTIVE',
                    semesterId: 1,
                    bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                    topic: { id: 201, title: 'Đề tài B', mentorId: 99, acceptedExpertise: ['AI'] },
                },
                {
                    id: 2, // SV C
                    studentId: 102,
                    status: 'DEFENSE_READY',
                    assignmentStatus: 'ACTIVE',
                    semesterId: 1,
                    bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                    topic: { id: 202, title: 'Đề tài C', mentorId: 99, acceptedExpertise: ['AI'] },
                },
                {
                    id: 3, // SV A (mentor 4)
                    studentId: 103,
                    status: 'DEFENSE_READY',
                    assignmentStatus: 'ACTIVE',
                    semesterId: 1,
                    bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                    topic: { id: 203, title: 'Đề tài A', mentorId: 4, acceptedExpertise: ['AI'] },
                },
                {
                    id: 4, // SV D (mentor 1)
                    studentId: 104,
                    status: 'DEFENSE_READY',
                    assignmentStatus: 'ACTIVE',
                    semesterId: 1,
                    bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                    topic: { id: 204, title: 'Đề tài D', mentorId: 1, acceptedExpertise: ['AI'] },
                },
            ];
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV 1', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 2, fullName: 'GV 2', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 3, fullName: 'GV 3', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 4, fullName: 'GV 4', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 5, fullName: 'GV 5', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 6, fullName: 'GV 6', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
            ]);

            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['R1', 'R2'], targetSize: 2 },
                { db: mockDb }
            );

            expect(result.status).toBe('FEASIBLE');
            expect(result.councils).toHaveLength(2);

            // Kiểm tra không có xung đột GVHD ở bất kỳ hội đồng nào
            result.councils.forEach((council) => {
                const memberIds = new Set(council.members.map((m) => m.lecturerId));
                council.students.forEach((s) => {
                    expect(memberIds.has(s.mentorId)).toBe(false);
                });
            });
        });

        test('trả về SEARCH_LIMIT khi vượt quá giới hạn bước duyệt maxSearchSteps', async () => {
            const students = Array.from({ length: 4 }, (_, i) => ({
                id: i + 1,
                studentId: 100 + i,
                status: 'DEFENSE_READY',
                assignmentStatus: 'ACTIVE',
                semesterId: 1,
                bm04Evaluation: { isLocked: true, status: 'SIGNED_APPROVED' },
                topic: { id: 200 + i, title: `Đề tài ${i}`, mentorId: 99, acceptedExpertise: ['AI'] },
            }));
            mockDb.topicRegistration.findMany.mockResolvedValue(students);

            mockDb.user.findMany.mockResolvedValue([
                { id: 1, fullName: 'GV 1', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 2, fullName: 'GV 2', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 3, fullName: 'GV 3', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 4, fullName: 'GV 4', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 5, fullName: 'GV 5', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
                { id: 6, fullName: 'GV 6', role: 'LECTURER', isActive: true, expertiseAreas: ['AI'] },
            ]);

            // Cố ý đặt maxSearchSteps = 0 để kích hoạt giới hạn tìm kiếm
            const result = await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['R1', 'R2'], targetSize: 2 },
                { db: mockDb, maxSearchSteps: 0 }
            );

            expect(result.status).toBe('SEARCH_LIMIT');
            expect(result.reasons[0]).toMatch(/SEARCH_LIMIT/);
        });

        test('thao tác hoàn toàn chỉ đọc, tuyệt đối không gọi mutation ghi vào DB', async () => {
            mockDb.topicRegistration.findMany.mockResolvedValue([]);
            mockDb.user.findMany.mockResolvedValue([]);

            await buildDefenseCouncilPlan(
                { semesterId: 1, date: '2026-12-15', rooms: ['A101'] },
                { db: mockDb }
            );

            // Kiểm tra mockDb không bị gọi bất kỳ lệnh mutation nào
            expect(mockDb.topicRegistration.create).toBeUndefined();
            expect(mockDb.topicRegistration.update).toBeUndefined();
            expect(mockDb.topicRegistration.updateMany).toBeUndefined();
            expect(mockDb.council.create).toBeUndefined();
            expect(mockDb.council.update).toBeUndefined();
        });
    });
});
