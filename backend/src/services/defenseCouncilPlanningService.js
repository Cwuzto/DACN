/**
 * Service lập phương án phân sinh viên vào hội đồng bảo vệ khóa luận (Read-only In-memory Solver)
 * Tuân thủ quy chuẩn TopicRegistration, không dùng group, UTF-8 no BOM.
 */
const crypto = require('crypto');
const prisma = require('../config/database');
const { getEligibleDefenseRegistrations } = require('./defenseCouncilEligibilityService');
const { getAcceptedExpertise } = require('./topicExpertiseService');
const { normalizeExpertiseAreas } = require('./lecturerExpertiseService');

const MAX_COUNCIL_CAPACITY = 30;
const DEFAULT_TARGET_SIZE = 22;
const DEFAULT_MAX_SEARCH_STEPS = 25000;

/**
 * Thuật toán Luồng Cực Đại (Dinic's Algorithm) cho ghép cặp ràng buộc sinh viên - hội đồng
 */
class DinicMaxFlow {
    constructor(nodeCount) {
        this.n = nodeCount;
        this.head = new Int32Array(nodeCount).fill(-1);
        this.to = [];
        this.cap = [];
        this.flow = [];
        this.next = [];
        this.level = new Int32Array(nodeCount);
        this.ptr = new Int32Array(nodeCount);
    }

    addEdge(from, to, capacity) {
        const e1 = this.to.length;
        this.to.push(to);
        this.cap.push(capacity);
        this.flow.push(0);
        this.next.push(this.head[from]);
        this.head[from] = e1;

        const e2 = this.to.length;
        this.to.push(from);
        this.cap.push(0);
        this.flow.push(0);
        this.next.push(this.head[to]);
        this.head[to] = e2;
    }

    bfs(s, t) {
        this.level.fill(-1);
        this.level[s] = 0;
        const queue = [s];
        let qHead = 0;

        while (qHead < queue.length) {
            const v = queue[qHead++];
            for (let e = this.head[v]; e !== -1; e = this.next[e]) {
                const u = this.to[e];
                if (this.cap[e] - this.flow[e] > 0 && this.level[u] === -1) {
                    this.level[u] = this.level[v] + 1;
                    queue.push(u);
                }
            }
        }
        return this.level[t] !== -1;
    }

    dfs(v, t, pushed) {
        if (pushed === 0) return 0;
        if (v === t) return pushed;

        for (let e = this.ptr[v]; e !== -1; e = this.next[e]) {
            this.ptr[v] = e;
            const u = this.to[e];
            const tr = this.cap[e] - this.flow[e];
            if (this.level[u] === this.level[v] + 1 && tr > 0) {
                const push = this.dfs(u, t, Math.min(pushed, tr));
                if (push > 0) {
                    this.flow[e] += push;
                    this.flow[e ^ 1] -= push;
                    return push;
                }
            }
        }
        return 0;
    }

    computeMaxFlow(s, t) {
        let flow = 0;
        while (this.bfs(s, t)) {
            this.ptr.set(this.head);
            while (true) {
                const pushed = this.dfs(s, t, Infinity);
                if (pushed === 0) break;
                flow += pushed;
            }
        }
        return flow;
    }
}

/**
 * Kiểm tra xem 2 thời điểm có cùng ngày (theo UTC date string) không
 */
function isSameDay(d1, d2) {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1).toISOString().slice(0, 10);
    const date2 = new Date(d2).toISOString().slice(0, 10);
    return date1 === date2;
}

/**
 * Kiểm tra xem giảng viên có khớp chuyên môn đề tài hay không
 */
function checkMemberMatchesExpertise(member, studentExpertiseAreas) {
    if (!studentExpertiseAreas || studentExpertiseAreas.length === 0) {
        return true;
    }
    const memberAreas = normalizeExpertiseAreas(member.expertiseAreas).map((a) => a.toLowerCase());
    return studentExpertiseAreas.some((sa) => memberAreas.includes(sa.toLowerCase()));
}

/**
 * Gán vai trò (CHAIRMAN, SECRETARY, REVIEWER) cho 3 thành viên hội đồng
 * Ưu tiên thành viên khớp chuyên môn nhiều nhất làm REVIEWER
 */
function assignCouncilRoles(members, assignedStudents) {
    const scoredMembers = members.map((m) => {
        const memberAreas = normalizeExpertiseAreas(m.expertiseAreas).map((a) => a.toLowerCase());
        let matchCount = 0;
        for (const s of assignedStudents) {
            const studentAreas = (s.acceptedExpertise || []).map((a) => a.toLowerCase());
            if (studentAreas.some((sa) => memberAreas.includes(sa))) {
                matchCount += 1;
            }
        }
        return { member: m, matchCount };
    });

    // Sắp xếp ưu tiên: khớp chuyên môn cao nhất trước; nếu bằng nhau, ID nhỏ hơn
    scoredMembers.sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        return a.member.id - b.member.id;
    });

    const reviewer = scoredMembers[0].member;
    const others = [scoredMembers[1].member, scoredMembers[2].member];
    others.sort((a, b) => a.id - b.id);
    const chairman = others[0];
    const secretary = others[1];

    return [
        {
            lecturerId: chairman.id,
            id: chairman.id,
            fullName: chairman.fullName,
            academicTitle: chairman.academicTitle || null,
            role: 'CHAIRMAN',
            roleInCouncil: 'CHAIRMAN',
            expertiseAreas: normalizeExpertiseAreas(chairman.expertiseAreas),
        },
        {
            lecturerId: secretary.id,
            id: secretary.id,
            fullName: secretary.fullName,
            academicTitle: secretary.academicTitle || null,
            role: 'SECRETARY',
            roleInCouncil: 'SECRETARY',
            expertiseAreas: normalizeExpertiseAreas(secretary.expertiseAreas),
        },
        {
            lecturerId: reviewer.id,
            id: reviewer.id,
            fullName: reviewer.fullName,
            academicTitle: reviewer.academicTitle || null,
            role: 'REVIEWER',
            roleInCouncil: 'REVIEWER',
            expertiseAreas: normalizeExpertiseAreas(reviewer.expertiseAreas),
        },
    ];
}

/**
 * Chia danh sách sinh viên hội đồng thành 2 ca: Sáng (07:00-11:00) và Chiều (13:00-17:00)
 * K sinh viên: Sáng có ceil(K/2), Chiều có floor(K/2). Ví dụ 22 -> 11/11, 23 -> 12/11
 */
function splitConfirmedStudentsIntoShifts(students, orderedRegistrationIds = []) {
    let sortedStudents = [...students];

    if (Array.isArray(orderedRegistrationIds) && orderedRegistrationIds.length > 0) {
        const orderMap = new Map();
        orderedRegistrationIds.forEach((id, index) => {
            orderMap.set(Number(id), index);
        });
        sortedStudents.sort((a, b) => {
            const idA = a.registrationId || a.id;
            const idB = b.registrationId || b.id;
            const idxA = orderMap.has(idA) ? orderMap.get(idA) : 999999;
            const idxB = orderMap.has(idB) ? orderMap.get(idB) : 999999;
            if (idxA !== idxB) return idxA - idxB;
            return idA - idB;
        });
    } else {
        sortedStudents.sort((a, b) => (a.registrationId || a.id) - (b.registrationId || b.id));
    }

    const K = sortedStudents.length;
    const morningCount = Math.ceil(K / 2);
    const afternoonCount = Math.floor(K / 2);

    const morningStudents = sortedStudents.slice(0, morningCount).map((s, idx) => ({
        ...s,
        defenseSessionShift: 'MORNING',
        shift: 'MORNING',
        defenseOrderInShift: idx + 1,
        orderInShift: idx + 1,
        defenseSequenceNo: idx + 1,
        sequenceNo: idx + 1,
    }));

    const afternoonStudents = sortedStudents.slice(morningCount).map((s, idx) => ({
        ...s,
        defenseSessionShift: 'AFTERNOON',
        shift: 'AFTERNOON',
        defenseOrderInShift: idx + 1,
        orderInShift: idx + 1,
        defenseSequenceNo: morningCount + idx + 1,
        sequenceNo: morningCount + idx + 1,
    }));

    return {
        morningShift: {
            time: '07:00 - 11:00',
            students: morningStudents,
        },
        afternoonShift: {
            time: '13:00 - 17:00',
            students: afternoonStudents,
        },
        students: [...morningStudents, ...afternoonStudents],
    };
}

/**
 * Tìm số thứ tự tiếp theo cho tên hội đồng ("Hội đồng N")
 */
function getNextCouncilIndex(councils = []) {
    const regex = /^Hội đồng\s+(\d+)$/i;
    let maxIndex = 0;
    for (const c of councils) {
        const match = String(c.name || '').trim().match(regex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxIndex) {
                maxIndex = num;
            }
        }
    }
    return maxIndex + 1;
}

/**
 * Xây dựng payload chuẩn hóa để tính Fingerprint SHA-256
 */
function buildFingerprintPayload({
    semesterId,
    date,
    rooms,
    targetSize,
    eligibleRegistrations = [],
    fixedCouncils = [],
    availableLecturers = [],
}) {
    const canonicalRegistrations = (eligibleRegistrations || [])
        .map((r) => ({
            id: r.id,
            studentId: r.studentId,
            status: r.status,
            bm04: r.bm04Evaluation
                ? {
                    id: r.bm04Evaluation.id,
                    conclusion: r.bm04Evaluation.conclusion,
                    status: r.bm04Evaluation.status,
                    isLocked: r.bm04Evaluation.isLocked,
                }
                : null,
            topicId: r.topicId || r.topic?.id,
            topicTitle: r.topic?.title || '',
            acceptedExpertise: (r.acceptedExpertise || []).slice().sort(),
            mentorId: r.topic?.mentorId || null,
        }))
        .sort((a, b) => a.id - b.id);

    const canonicalLecturers = (availableLecturers || [])
        .map((l) => ({
            id: l.id,
            expertiseAreas: normalizeExpertiseAreas(l.expertiseAreas).slice().sort(),
        }))
        .sort((a, b) => a.id - b.id);

    const canonicalFixedCouncils = (fixedCouncils || [])
        .map((c) => ({
            id: c.id,
            location: c.location || '',
            defenseDate: c.defenseDate ? new Date(c.defenseDate).toISOString().slice(0, 10) : '',
            memberIds: (c.members || []).map((m) => m.lecturerId || m.id).sort((a, b) => a - b),
            registrationIds: (c.defenseRegistrations || c.registrations || []).map((r) => r.id).sort((a, b) => a - b),
        }))
        .sort((a, b) => a.id - b.id);

    const canonicalRooms = (rooms || []).map((r) => String(r).trim()).sort();
    const formattedDate = date ? new Date(date).toISOString().slice(0, 10) : '';

    return {
        semesterId: Number(semesterId),
        date: formattedDate,
        targetSize: Number(targetSize),
        rooms: canonicalRooms,
        registrations: canonicalRegistrations,
        lecturers: canonicalLecturers,
        fixedCouncils: canonicalFixedCouncils,
    };
}

/**
 * Tính mã băm Fingerprint SHA-256 từ payload chuẩn hóa
 */
function calculateFingerprint(payload) {
    const serialized = JSON.stringify(payload);
    return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Kiểm tra tính khả thi và gán sinh viên vào các hội đồng bằng Max Flow
 */
function tryAssignStudentsToCouncils(students, proposedCouncilMembers) {
    const N = students.length;
    const M = proposedCouncilMembers.length;
    if (N === 0) return { ok: true, assignments: [] };

    const minCap = Math.floor(N / M);
    const maxCapIdeal = Math.ceil(N / M);

    // Thử từ sức chứa lý tưởng maxCapIdeal tăng dần đến trần cứng 30
    for (let capLimit = maxCapIdeal; capLimit <= MAX_COUNCIL_CAPACITY; capLimit += 1) {
        // Node 0: Source
        // Node 1..N: Students
        // Node N+1..N+M: Councils
        // Node N+M+1: Sink
        const sourceNode = 0;
        const sinkNode = N + M + 1;
        const mf = new DinicMaxFlow(N + M + 2);

        // Nguồn đến sinh viên
        for (let i = 0; i < N; i += 1) {
            mf.addEdge(sourceNode, 1 + i, 1);
        }

        // Sinh viên đến hội đồng thỏa điều kiện
        for (let i = 0; i < N; i += 1) {
            const student = students[i];
            const mentorId = student.mentorId;
            const studentAreas = student.acceptedExpertise || [];

            for (let j = 0; j < M; j += 1) {
                const members = proposedCouncilMembers[j];
                // Ràng buộc 1: Không xung đột GVHD
                const hasMentorConflict = members.some((m) => m.id === mentorId);
                if (hasMentorConflict) continue;

                // Ràng buộc 2: Khớp chuyên môn (nếu đề tài có chuyên môn)
                const hasExpertise = members.some((m) => checkMemberMatchesExpertise(m, studentAreas));
                if (!hasExpertise) continue;

                // Thỏa mãn cả 2 ràng buộc -> tạo cạnh
                mf.addEdge(1 + i, 1 + N + j, 1);
            }
        }

        // Hội đồng đến Đích với sức chứa capLimit
        for (let j = 0; j < M; j += 1) {
            mf.addEdge(1 + N + j, sinkNode, capLimit);
        }

        const totalFlow = mf.computeMaxFlow(sourceNode, sinkNode);
        if (totalFlow === N) {
            // Đã gán thành công tất cả sinh viên! Trích xuất kết quả gán
            const councilAssignments = Array.from({ length: M }, () => []);

            for (let i = 0; i < N; i += 1) {
                const studentNode = 1 + i;
                for (let e = mf.head[studentNode]; e !== -1; e = mf.next[e]) {
                    const u = mf.to[e];
                    if (u >= 1 + N && u <= N + M && mf.flow[e] === 1) {
                        const councilIdx = u - (1 + N);
                        councilAssignments[councilIdx].push(students[i]);
                        break;
                    }
                }
            }

            return {
                ok: true,
                assignments: councilAssignments,
                capLimit,
            };
        }
    }

    return { ok: false };
}

/**
 * Sinh tất cả các bộ 3 giảng viên có thể từ danh sách giảng viên
 */
function generateCandidateTriples(lecturers, students) {
    const triples = [];
    const L = lecturers.length;

    for (let i = 0; i < L - 2; i += 1) {
        for (let j = i + 1; j < L - 1; j += 1) {
            for (let k = j + 1; k < L; k += 1) {
                const triple = [lecturers[i], lecturers[j], lecturers[k]];
                const tripleIds = new Set([lecturers[i].id, lecturers[j].id, lecturers[k].id]);

                // Đánh giá sơ bộ điểm phù hợp của bộ ba:
                // Số sinh viên có thể nhận (không xung đột GVHD và khớp chuyên môn)
                let compatibleCount = 0;
                for (const s of students) {
                    if (tripleIds.has(s.mentorId)) continue;
                    if (checkMemberMatchesExpertise(lecturers[i], s.acceptedExpertise) ||
                        checkMemberMatchesExpertise(lecturers[j], s.acceptedExpertise) ||
                        checkMemberMatchesExpertise(lecturers[k], s.acceptedExpertise)) {
                        compatibleCount += 1;
                    }
                }

                triples.push({
                    members: triple,
                    memberIds: tripleIds,
                    score: compatibleCount,
                    minId: Math.min(lecturers[i].id, lecturers[j].id, lecturers[k].id),
                });
            }
        }
    }

    // Sắp xếp ưu tiên các bộ ba có điểm tương thích cao trước
    triples.sort((a, b) => b.score - a.score || a.minId - b.minId);
    return triples;
}

/**
 * Lập phương án phân bổ hội đồng bảo vệ (Read-only In-memory)
 * @param {Object} params
 * @param {number|string} params.semesterId - ID học kỳ
 * @param {string|Date} [params.date] - Ngày bảo vệ (mặc định lấy từ Semester)
 * @param {Array<string>} params.rooms - Danh sách phòng khả dụng
 * @param {number} [params.targetSize=22] - Mức mục tiêu sinh viên / hội đồng (1-30)
 * @param {Array<number>} [params.orderedRegistrationIds] - Danh sách ID sinh viên ưu tiên thứ tự
 * @param {Object} [options]
 * @param {Object} [options.db] - Prisma client hoặc mock
 * @param {number} [options.maxSearchSteps=25000] - Giới hạn bước duyệt
 */
async function buildDefenseCouncilPlan(
    { semesterId, date, rooms, targetSize = DEFAULT_TARGET_SIZE, orderedRegistrationIds },
    { db = prisma, maxSearchSteps = DEFAULT_MAX_SEARCH_STEPS } = {}
) {
    const semId = Number(semesterId);
    if (!Number.isInteger(semId) || semId <= 0) {
        return {
            status: 'INFEASIBLE',
            reasons: ['Mã học kỳ không hợp lệ'],
        };
    }

    // 1. Kiểm tra targetSize
    const target = Number.isInteger(Number(targetSize)) ? Number(targetSize) : DEFAULT_TARGET_SIZE;
    if (target < 1 || target > MAX_COUNCIL_CAPACITY) {
        return {
            status: 'INFEASIBLE',
            reasons: [`Mục tiêu quy mô sinh viên / hội đồng phải từ 1 đến ${MAX_COUNCIL_CAPACITY}`],
        };
    }

    // 2. Kiểm tra ngày bảo vệ
    let defenseDate = date;
    if (!defenseDate) {
        const semester = await db.semester.findUnique({
            where: { id: semId },
            select: { defenseDate: true },
        });
        defenseDate = semester?.defenseDate;
    }
    if (!defenseDate) {
        return {
            status: 'INFEASIBLE',
            reasons: ['Ngày bảo vệ chưa được cấu hình cho học kỳ và không được truyền vào'],
        };
    }
    const defenseDateFormatted = new Date(defenseDate).toISOString().slice(0, 10);

    // 3. Đọc danh sách hội đồng đã cố định (đã công bố lịch hoặc đã chốt)
    const existingCouncils = await db.council.findMany({
        where: {
            semesterId: semId,
            councilType: 'DEFENSE_COUNCIL',
            isActive: true,
            deletedAt: null,
        },
        include: {
            members: {
                where: { isActive: true },
                include: { lecturer: true },
            },
            defenseRegistrations: {
                include: {
                    student: true,
                    topic: { include: { mentor: true } },
                    bm04Evaluation: true,
                },
            },
            registrations: {
                include: {
                    student: true,
                    topic: { include: { mentor: true } },
                    bm04Evaluation: true,
                },
            },
        },
        orderBy: { id: 'asc' },
    });

    // Hội đồng đã công bố lịch hoặc đã xác nhận được coi là cố định
    const fixedCouncils = existingCouncils.filter(
        (c) => c.schedulePublishedAt !== null || c.scheduleConfirmedAt !== null || c.isFixed === true
    );

    const fixedStudentIds = new Set();
    const fixedLecturerIds = new Set();
    const fixedRooms = new Set();

    for (const fc of fixedCouncils) {
        if (fc.location && isSameDay(fc.defenseDate, defenseDateFormatted)) {
            fixedRooms.add(String(fc.location).trim().toUpperCase());
        }
        for (const m of fc.members || []) {
            const lId = m.lecturerId || m.id;
            if (lId) fixedLecturerIds.add(lId);
        }
        const assignedList = fc.defenseRegistrations?.length ? fc.defenseRegistrations : fc.registrations || [];
        for (const reg of assignedList) {
            fixedStudentIds.add(reg.id);
        }
    }

    // 4. Lấy danh sách sinh viên đủ điều kiện
    const allEligibleRegistrations = await getEligibleDefenseRegistrations(semId, { db });

    // Trích xuất chuyên môn được chấp nhận cho từng sinh viên
    const enrichedEligible = [];
    for (const reg of allEligibleRegistrations) {
        let accepted = reg.topic?.acceptedExpertise || reg.acceptedExpertise;
        const topicId = reg.topicId || reg.topic?.id;
        if (!accepted && topicId) {
            try {
                accepted = await getAcceptedExpertise(topicId, { db });
            } catch {
                accepted = null;
            }
        }
        const normalizedAccepted = normalizeExpertiseAreas(accepted);

        enrichedEligible.push({
            id: reg.id,
            registrationId: reg.id,
            studentId: reg.studentId || reg.student?.id,
            studentName: reg.student?.fullName || '',
            studentCode: reg.student?.studentCode || reg.student?.code || '',
            topicId,
            topicTitle: reg.topic?.title || '',
            mentorId: reg.topic?.mentorId,
            mentorName: reg.topic?.mentor?.fullName || '',
            acceptedExpertise: normalizedAccepted,
            status: reg.status,
            bm04Evaluation: reg.bm04Evaluation,
            topic: reg.topic,
            student: reg.student,
        });
    }

    // Lọc ra các sinh viên chưa được xếp vào hội đồng cố định nào
    const remainingStudents = enrichedEligible.filter((s) => !fixedStudentIds.has(s.id));
    const N = remainingStudents.length;
    const totalEligibleCount = fixedStudentIds.size + N;

    // 5. Đọc danh sách giảng viên khả dụng
    const allLecturers = await db.user.findMany({
        where: {
            role: 'LECTURER',
            isActive: true,
        },
        select: {
            id: true,
            fullName: true,
            academicTitle: true,
            expertiseAreas: true,
        },
        orderBy: { id: 'asc' },
    });

    const availableLecturers = allLecturers
        .filter((l) => !fixedLecturerIds.has(l.id))
        .filter((l) => normalizeExpertiseAreas(l.expertiseAreas).length > 0);

    // Chuẩn hóa phòng khả dụng (loại bỏ phòng đã bị hội đồng cố định chiếm cùng ngày)
    const rawRooms = Array.isArray(rooms) ? rooms : [];
    const cleanedRooms = [...new Set(rawRooms.map((r) => String(r).trim()).filter(Boolean))];
    const availableRooms = cleanedRooms.filter((r) => !fixedRooms.has(r.toUpperCase()));

    // Tính Fingerprint cho phương án
    const fingerprintPayload = buildFingerprintPayload({
        semesterId: semId,
        date: defenseDateFormatted,
        rooms: cleanedRooms,
        targetSize: target,
        eligibleRegistrations: enrichedEligible,
        fixedCouncils,
        availableLecturers,
    });
    const fingerprint = calculateFingerprint(fingerprintPayload);

    // Định dạng danh sách hội đồng cố định để trả về kết quả
    const formattedFixedCouncils = fixedCouncils.map((fc) => {
        const assignedList = fc.defenseRegistrations?.length ? fc.defenseRegistrations : fc.registrations || [];
        const studentDetails = assignedList.map((reg) => ({
            registrationId: reg.id,
            id: reg.id,
            studentId: reg.studentId || reg.student?.id,
            studentName: reg.student?.fullName || '',
            studentCode: reg.student?.studentCode || reg.student?.code || '',
            topicId: reg.topicId || reg.topic?.id,
            topicTitle: reg.topic?.title || '',
            mentorId: reg.topic?.mentorId,
            mentorName: reg.topic?.mentor?.fullName || '',
            explanation: `Hội đồng đã công bố lịch/cố định từ trước (${fc.name}).`,
        }));

        const shiftSplit = splitConfirmedStudentsIntoShifts(studentDetails, orderedRegistrationIds);

        return {
            id: fc.id,
            name: fc.name,
            isFixed: true,
            date: fc.defenseDate ? new Date(fc.defenseDate).toISOString().slice(0, 10) : defenseDateFormatted,
            defenseDate: fc.defenseDate ? new Date(fc.defenseDate).toISOString().slice(0, 10) : defenseDateFormatted,
            room: fc.location || '',
            location: fc.location || '',
            members: (fc.members || []).map((m) => ({
                lecturerId: m.lecturerId || m.id,
                id: m.lecturerId || m.id,
                fullName: m.lecturer?.fullName || '',
                role: m.roleInCouncil,
                roleInCouncil: m.roleInCouncil,
                expertiseAreas: normalizeExpertiseAreas(m.lecturer?.expertiseAreas || m.expertiseAreas),
            })),
            studentCount: studentDetails.length,
            morningShift: shiftSplit.morningShift,
            afternoonShift: shiftSplit.afternoonShift,
            students: shiftSplit.students,
        };
    });

    // Nếu không còn sinh viên nào cần xếp
    if (N === 0) {
        return {
            status: 'FEASIBLE',
            fingerprint,
            councils: formattedFixedCouncils,
            coverage: {
                totalEligible: totalEligibleCount,
                assigned: totalEligibleCount,
            },
            explanations: ['Toàn bộ sinh viên đủ điều kiện đã được xếp trong các hội đồng cố định.'],
        };
    }

    // 6. Kiểm tra tài nguyên tối thiểu
    const expectedCouncilsCount = Math.ceil(N / target);

    if (availableRooms.length < expectedCouncilsCount) {
        return {
            status: 'INFEASIBLE',
            reasons: ['Số phòng khả dụng không đủ cho số hội đồng dự kiến'],
        };
    }

    if (availableLecturers.length < 3 * expectedCouncilsCount) {
        return {
            status: 'INFEASIBLE',
            reasons: ['Số giảng viên không đủ để lập hội đồng'],
        };
    }

    // Kiểm tra sớm: có đề tài nào có chuyên môn mà KHÔNG giảng viên khả dụng nào có?
    for (const student of remainingStudents) {
        const areas = student.acceptedExpertise || [];
        if (areas.length > 0) {
            const hasAnyLecturer = availableLecturers.some((l) => checkMemberMatchesExpertise(l, areas));
            if (!hasAnyLecturer) {
                return {
                    status: 'INFEASIBLE',
                    reasons: [`Không có giảng viên nào khớp chuyên môn cho đề tài: "${student.topicTitle}"`],
                };
            }
        }
    }

    // 7. Giải thuật tìm nghiệm phân bổ thỏa mãn ràng buộc (Constrained Search)
    const candidateTriples = generateCandidateTriples(availableLecturers, remainingStudents);
    if (candidateTriples.length < expectedCouncilsCount) {
        return {
            status: 'INFEASIBLE',
            reasons: ['Số bộ ba giảng viên khả dụng không đủ để lập số hội đồng dự kiến'],
        };
    }

    let searchSteps = 0;
    let searchLimitExceeded = false;
    let bestSolution = null;

    // Hàm đệ quy duyệt tìm các tổ hợp bộ ba rời rạc cho M hội đồng
    function searchDisjointTriples(councilIdx, startIndex, usedLecturerIds, chosenTriples) {
        if (councilIdx === expectedCouncilsCount) {
            searchSteps += 1;
            if (searchSteps > maxSearchSteps) {
                searchLimitExceeded = true;
                return true; // Dừng tìm kiếm do vượt giới hạn
            }

            // Đã chọn xong M bộ ba rời rạc. Kiểm tra gán sinh viên bằng Max Flow
            const memberGroups = chosenTriples.map((t) => t.members);
            const assignResult = tryAssignStudentsToCouncils(remainingStudents, memberGroups);

            if (assignResult.ok) {
                // Đánh giá điểm giải pháp (càng cân bằng và khớp phản biện càng tốt)
                let reviewerMatchScore = 0;
                let targetDeviation = 0;

                for (let c = 0; c < expectedCouncilsCount; c += 1) {
                    const cStudents = assignResult.assignments[c];
                    targetDeviation += Math.abs(cStudents.length - target);
                    const roles = assignCouncilRoles(memberGroups[c], cStudents);
                    const revRole = roles.find((r) => r.role === 'REVIEWER');
                    if (revRole) {
                        for (const s of cStudents) {
                            if (checkMemberMatchesExpertise(revRole, s.acceptedExpertise)) {
                                reviewerMatchScore += 1;
                            }
                        }
                    }
                }

                const totalScore = reviewerMatchScore * 100 - targetDeviation;

                if (!bestSolution || totalScore > bestSolution.score) {
                    bestSolution = {
                        score: totalScore,
                        triples: [...chosenTriples],
                        assignments: assignResult.assignments.map((a) => [...a]),
                    };
                }

                // Nếu đạt giải pháp cân bằng hoàn hảo (độ lệch tối thiểu), có thể dừng sớm
                if (targetDeviation <= expectedCouncilsCount) {
                    return true;
                }
            }

            return false;
        }

        for (let i = startIndex; i < candidateTriples.length; i += 1) {
            searchSteps += 1;
            if (searchSteps > maxSearchSteps) {
                searchLimitExceeded = true;
                return true;
            }

            const candidate = candidateTriples[i];
            let hasOverlap = false;
            for (const id of candidate.memberIds) {
                if (usedLecturerIds.has(id)) {
                    hasOverlap = true;
                    break;
                }
            }
            if (hasOverlap) continue;

            // Đánh dấu giảng viên đã sử dụng
            for (const id of candidate.memberIds) {
                usedLecturerIds.add(id);
            }
            chosenTriples.push(candidate);

            const stopEarly = searchDisjointTriples(councilIdx + 1, i + 1, usedLecturerIds, chosenTriples);

            // Backtrack
            chosenTriples.pop();
            for (const id of candidate.memberIds) {
                usedLecturerIds.delete(id);
            }

            if (stopEarly && bestSolution) {
                return true;
            }
        }

        return false;
    }

    searchDisjointTriples(0, 0, new Set(), []);

    if (searchLimitExceeded && !bestSolution) {
        return {
            status: 'SEARCH_LIMIT',
            reasons: ['Vượt quá giới hạn tìm kiếm phân bổ hội đồng (SEARCH_LIMIT)'],
        };
    }

    if (!bestSolution) {
        return {
            status: 'INFEASIBLE',
            reasons: ['Không tìm được phương án thỏa mãn đồng thời ràng buộc chuyên môn và không xung đột GVHD'],
        };
    }

    // 8. Đóng gói kết quả thành công
    let nextCouncilIdx = getNextCouncilIndex(fixedCouncils);
    const proposedCouncils = [];
    const explanations = [];

    for (let c = 0; c < expectedCouncilsCount; c += 1) {
        const councilName = `Hội đồng ${nextCouncilIdx}`;
        nextCouncilIdx += 1;
        const councilRoom = availableRooms[c];
        const rawMembers = bestSolution.triples[c].members;
        const assignedStudents = bestSolution.assignments[c];

        // Gán vai trò (CHAIRMAN, SECRETARY, REVIEWER)
        const councilMembers = assignCouncilRoles(rawMembers, assignedStudents);
        const reviewer = councilMembers.find((m) => m.role === 'REVIEWER');

        // Tạo chi tiết sinh viên và lý do gán
        const studentDetails = assignedStudents.map((s) => {
            const matchedMembers = councilMembers.filter((m) =>
                checkMemberMatchesExpertise(m, s.acceptedExpertise)
            );
            const reviewerMatched = reviewer && checkMemberMatchesExpertise(reviewer, s.acceptedExpertise);

            let reasonText = `Phân vào ${councilName} (Phòng ${councilRoom}): Không xung đột GVHD (${s.mentorName || s.mentorId}); `;
            if (s.acceptedExpertise.length === 0) {
                reasonText += 'Đề tài không yêu cầu chuyên môn đặc thù.';
            } else if (reviewerMatched) {
                reasonText += `Khớp chuyên môn [${s.acceptedExpertise.join(', ')}] với Phản biện (${reviewer.fullName}).`;
            } else if (matchedMembers.length > 0) {
                reasonText += `Khớp chuyên môn [${s.acceptedExpertise.join(', ')}] với ${matchedMembers[0].role} (${matchedMembers[0].fullName}).`;
            } else {
                reasonText += 'Đạt tiêu chuẩn phân bổ.';
            }

            return {
                registrationId: s.id,
                id: s.id,
                studentId: s.studentId,
                studentName: s.studentName,
                studentCode: s.studentCode,
                topicId: s.topicId,
                topicTitle: s.topicTitle,
                mentorId: s.mentorId,
                mentorName: s.mentorName,
                acceptedExpertise: s.acceptedExpertise,
                matchedExpertise: s.acceptedExpertise.filter((ae) =>
                    normalizeExpertiseAreas(reviewer?.expertiseAreas).some((ra) => ra.toLowerCase() === ae.toLowerCase())
                ),
                matchedRole: reviewerMatched ? 'REVIEWER' : (matchedMembers[0]?.role || null),
                matchedLecturerId: reviewerMatched ? reviewer.lecturerId : (matchedMembers[0]?.lecturerId || null),
                explanation: reasonText,
            };
        });

        // Chia ca Sáng / Chiều
        const shiftSplit = splitConfirmedStudentsIntoShifts(studentDetails, orderedRegistrationIds);

        proposedCouncils.push({
            id: null,
            name: councilName,
            isFixed: false,
            date: defenseDateFormatted,
            defenseDate: defenseDateFormatted,
            room: councilRoom,
            location: councilRoom,
            members: councilMembers,
            studentCount: studentDetails.length,
            morningShift: shiftSplit.morningShift,
            afternoonShift: shiftSplit.afternoonShift,
            students: shiftSplit.students,
        });

        explanations.push(
            `${councilName} (Phòng ${councilRoom}): ${studentDetails.length} sinh viên ` +
            `(Sáng: ${shiftSplit.morningShift.students.length}, Chiều: ${shiftSplit.afternoonShift.students.length}). ` +
            `Chủ tịch: ${councilMembers.find((m) => m.role === 'CHAIRMAN')?.fullName}, ` +
            `Thư ký: ${councilMembers.find((m) => m.role === 'SECRETARY')?.fullName}, ` +
            `Phản biện: ${councilMembers.find((m) => m.role === 'REVIEWER')?.fullName}.`
        );
    }

    const allCouncils = [...formattedFixedCouncils, ...proposedCouncils];

    return {
        status: 'FEASIBLE',
        fingerprint,
        councils: allCouncils,
        coverage: {
            totalEligible: totalEligibleCount,
            assigned: totalEligibleCount,
        },
        explanations: [
            `Đã phân bổ thành công toàn bộ ${totalEligibleCount} sinh viên vào ${allCouncils.length} hội đồng bảo vệ.`,
            ...explanations,
        ],
    };
}

module.exports = {
    MAX_COUNCIL_CAPACITY,
    DEFAULT_TARGET_SIZE,
    DinicMaxFlow,
    isSameDay,
    checkMemberMatchesExpertise,
    assignCouncilRoles,
    splitConfirmedStudentsIntoShifts,
    buildFingerprintPayload,
    calculateFingerprint,
    buildDefenseCouncilPlan,
};
