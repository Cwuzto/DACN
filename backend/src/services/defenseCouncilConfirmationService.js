/**
 * Service xác nhận phương án phân bổ hội đồng bảo vệ khóa luận (Defense Council Confirmation)
 * Thực hiện toàn bộ kiểm tra và ghi dữ liệu trong transaction nguyên tử.
 * Tuân thủ quy chuẩn TopicRegistration, 1 sinh viên / 1 đề tài, không dùng group, UTF-8 no BOM.
 */

const prisma = require('../config/database');
const planningService = require('./defenseCouncilPlanningService');
const { getEligibleDefenseRegistrations } = require('./defenseCouncilEligibilityService');
const { normalizeExpertiseAreas } = require('./lecturerExpertiseService');

/**
 * Tạo đối tượng lỗi với mã HTTP status và error code
 */
function createError(statusCode, code, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
}

/**
 * Xác nhận toàn bộ phương án phân bổ hội đồng bảo vệ trong một giao dịch
 * @param {Object} input
 * @param {number|string} input.semesterId - ID học kỳ
 * @param {string} input.fingerprint - Mã băm fingerprint từ bản preview
 * @param {Array<Object>} input.councils - Danh sách các hội đồng được đề xuất / cố định
 * @param {string|Date} [input.date] - Ngày bảo vệ
 * @param {Array<string>} [input.rooms] - Danh sách phòng
 * @param {number} [input.targetSize] - Quy mô mục tiêu
 * @param {Array<number>} [input.orderedRegistrationIds] - Thứ tự sinh viên tùy chọn
 * @param {Object} options
 * @param {Object} [options.db=prisma] - Prisma client
 * @param {number} options.actorId - ID của người dùng thực hiện (phải là ADMIN)
 */
async function confirmDefenseCouncilPlan(
    { semesterId, fingerprint, councils, date, rooms, targetSize, orderedRegistrationIds },
    { db = prisma, actorId } = {}
) {
    // 1. Kiểm tra actor thực hiện thao tác (chỉ ADMIN)
    if (!actorId) {
        throw createError(403, 'FORBIDDEN', 'Chưa xác thực người dùng thực hiện thao tác.');
    }

    const actor = await db.user.findUnique({
        where: { id: actorId },
        select: { id: true, role: true, isActive: true },
    });

    if (!actor || actor.role !== 'ADMIN' || !actor.isActive) {
        throw createError(
            403,
            'FORBIDDEN',
            'Chỉ Quản trị viên (ADMIN) mới có quyền xác nhận phương án phân công hội đồng bảo vệ.'
        );
    }

    // 2. Kiểm tra tính hợp lệ của tham số đầu vào
    const semId = Number(semesterId);
    if (!Number.isInteger(semId) || semId <= 0) {
        throw createError(400, 'INVALID_SEMESTER_ID', 'Mã học kỳ không hợp lệ.');
    }

    if (!fingerprint || typeof fingerprint !== 'string') {
        throw createError(400, 'FINGERPRINT_REQUIRED', 'Mã băm fingerprint là bắt buộc.');
    }

    if (!Array.isArray(councils) || councils.length === 0) {
        throw createError(400, 'COUNCILS_REQUIRED', 'Danh sách hội đồng không được để trống.');
    }

    // 3. Thực hiện toàn bộ quy trình kiểm tra và ghi nhận trong giao dịch nguyên tử
    return await db.$transaction(async (tx) => {
        // A. Suy luận tham số cần thiết để tính lại bản xem trước hiện tại
        const semester = await tx.semester.findUnique({
            where: { id: semId },
            select: { id: true, defenseDate: true, defenseCouncilTargetSize: true },
        });

        if (!semester) {
            throw createError(404, 'SEMESTER_NOT_FOUND', 'Không tìm thấy học kỳ.');
        }

        const effectiveDate = date ||
            councils.find((c) => c.date || c.defenseDate)?.date ||
            councils.find((c) => c.date || c.defenseDate)?.defenseDate ||
            semester.defenseDate;

        const effectiveRooms = (Array.isArray(rooms) && rooms.length > 0)
            ? rooms
            : [...new Set(councils.map((c) => c.room || c.location).filter(Boolean))];

        const effectiveTarget = Number.isInteger(Number(targetSize))
            ? Number(targetSize)
            : (semester.defenseCouncilTargetSize || 22);

        // B. Chạy lại buildDefenseCouncilPlan để kiểm tra tính tươi mới của snapshot (Fingerprint check)
        const currentPlan = await planningService.buildDefenseCouncilPlan(
            {
                semesterId: semId,
                date: effectiveDate,
                rooms: effectiveRooms,
                targetSize: effectiveTarget,
                orderedRegistrationIds,
            },
            { db: tx }
        );

        if (currentPlan.status !== 'FEASIBLE' || currentPlan.fingerprint !== fingerprint) {
            throw createError(
                409,
                'PLAN_FINGERPRINT_STALE',
                'Dữ liệu nguồn đã thay đổi kể từ bản xem trước, vui lòng tạo lại bản xem trước.'
            );
        }

        // C. Kiểm tra tập sinh viên: Không cho phép xác nhận một phần
        const allEligibleRegistrations = await getEligibleDefenseRegistrations(semId, { db: tx });
        const eligibleRegIds = new Set(allEligibleRegistrations.map((r) => r.id));

        const planRegIds = new Set();
        for (const c of councils) {
            const students = c.students || [];
            for (const s of students) {
                const regId = Number(s.registrationId || s.id);
                if (planRegIds.has(regId)) {
                    throw createError(
                        400,
                        'DUPLICATE_STUDENT_IN_PLAN',
                        `Sinh viên (ID: ${regId}) bị phân công trùng lặp giữa các hội đồng.`
                    );
                }
                planRegIds.add(regId);
            }
        }

        if (planRegIds.size !== eligibleRegIds.size || [...eligibleRegIds].some((id) => !planRegIds.has(id))) {
            throw createError(
                400,
                'INCOMPLETE_ASSIGNMENT',
                'Tất cả sinh viên đủ điều kiện phải được xếp đầy đủ vào các hội đồng, không cho phép xác nhận một phần.'
            );
        }

        if ([...planRegIds].some((id) => !eligibleRegIds.has(id))) {
            throw createError(
                400,
                'INVALID_STUDENT_IN_PLAN',
                'Có sinh viên trong phương án không thuộc danh sách đủ điều kiện bảo vệ của học kỳ.'
            );
        }

        // D. Kiểm tra các ràng buộc cứng trên từng hội đồng
        const regRecords = await tx.topicRegistration.findMany({
            where: { id: { in: [...planRegIds] } },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: {
                    select: {
                        id: true,
                        title: true,
                        mentorId: true,
                        acceptedExpertise: true,
                    },
                },
            },
        });
        const regRecordMap = new Map(regRecords.map((r) => [r.id, r]));

        // Tải thông tin chuyên môn của tất cả giảng viên trong plan từ DB để kiểm tra chính xác
        const allMemberLecturerIds = [];
        for (const c of councils) {
            for (const m of c.members || []) {
                const lId = Number(m.lecturerId || m.id);
                if (lId) allMemberLecturerIds.push(lId);
            }
        }
        const dbLecturers = await tx.user.findMany({
            where: { id: { in: allMemberLecturerIds } },
            select: { id: true, fullName: true, expertiseAreas: true },
        });
        const dbLecturerMap = new Map(dbLecturers.map((l) => [l.id, l]));

        const roomDateSet = new Set();
        const lecturerCouncilMap = new Map();

        for (const c of councils) {
            const students = c.students || [];
            // Ràng buộc quy mô tối đa 30
            if (students.length > planningService.MAX_COUNCIL_CAPACITY) {
                throw createError(
                    400,
                    'MAX_CAPACITY_EXCEEDED',
                    `Hội đồng "${c.name}" vượt quá quy mô tối đa ${planningService.MAX_COUNCIL_CAPACITY} sinh viên.`
                );
            }

            // Ràng buộc phòng và ngày
            const cRoom = String(c.room || c.location || '').trim().toUpperCase();
            const cDate = (c.date || c.defenseDate || effectiveDate)
                ? new Date(c.date || c.defenseDate || effectiveDate).toISOString().slice(0, 10)
                : '';

            if (!cRoom || !cDate) {
                throw createError(
                    400,
                    'MISSING_DATE_OR_ROOM',
                    `Hội đồng "${c.name}" chưa có ngày bảo vệ hoặc phòng bảo vệ hợp lệ.`
                );
            }

            const roomDateKey = `${cDate}_${cRoom}`;
            if (roomDateSet.has(roomDateKey)) {
                throw createError(
                    400,
                    'ROOM_COLLISION',
                    `Phòng bảo vệ "${cRoom}" bị trùng lặp trong ngày ${cDate}.`
                );
            }
            roomDateSet.add(roomDateKey);

            // Ràng buộc thành viên: tối thiểu 3 thành viên
            const rawMembers = c.members || [];
            if (rawMembers.length < 3) {
                throw createError(
                    400,
                    'MIN_MEMBERS_REQUIRED',
                    `Hội đồng "${c.name}" phải có ít nhất 3 thành viên.`
                );
            }

            const members = rawMembers.map((m) => {
                const lId = Number(m.lecturerId || m.id);
                const dbL = dbLecturerMap.get(lId);
                return {
                    ...m,
                    id: lId,
                    lecturerId: lId,
                    fullName: m.fullName || dbL?.fullName || '',
                    expertiseAreas: m.expertiseAreas || dbL?.expertiseAreas || [],
                };
            });

            const memberLecturerIds = new Set();
            for (const m of members) {
                const lId = Number(m.lecturerId || m.id);
                if (lecturerCouncilMap.has(lId)) {
                    throw createError(
                        400,
                        'LECTURER_DOUBLE_BOOKED',
                        `Một giảng viên (ID: ${lId}) chỉ được tham gia tối đa một hội đồng bảo vệ trong đợt.`
                    );
                }
                lecturerCouncilMap.set(lId, c.name);
                memberLecturerIds.add(lId);
            }

            // Ràng buộc đề tài sinh viên: không xung đột GVHD và khớp chuyên môn
            for (const s of students) {
                const regId = Number(s.registrationId || s.id);
                const reg = regRecordMap.get(regId);
                const mentorId = reg?.topic?.mentorId;

                if (mentorId && memberLecturerIds.has(mentorId)) {
                    throw createError(
                        400,
                        'MENTOR_CONFLICT',
                        `Xung đột GVHD: Giảng viên hướng dẫn không được tham gia hội đồng chấm sinh viên "${reg?.student?.fullName || regId}".`
                    );
                }

                const acceptedAreas = normalizeExpertiseAreas(
                    reg?.topic?.acceptedExpertise || s.acceptedExpertise
                );
                if (acceptedAreas.length > 0) {
                    const hasMatch = members.some((m) =>
                        planningService.checkMemberMatchesExpertise(m, acceptedAreas)
                    );
                    if (!hasMatch) {
                        throw createError(
                            400,
                            'EXPERTISE_MISMATCH',
                            `Đề tài "${reg?.topic?.title}" không có thành viên hội đồng nào khớp chuyên môn đã chấp nhận.`
                        );
                    }
                }
            }
        }

        // E. Tạo các hội đồng mới trong DB và gán sinh viên
        const now = new Date();
        const createdCouncilIds = [];
        let assignedRegistrationCount = 0;

        for (const c of councils) {
            // Nếu là hội đồng cố định từ trước, cập nhật xác nhận nếu chưa có
            if (c.isFixed && c.id) {
                await tx.council.update({
                    where: { id: c.id },
                    data: {
                        assignmentConfirmedAt: c.assignmentConfirmedAt || now,
                        assignmentConfirmedById: c.assignmentConfirmedById || actorId,
                    },
                });
                continue;
            }

            // Tạo hội đồng mới
            const newCouncil = await tx.council.create({
                data: {
                    semesterId: semId,
                    name: c.name,
                    councilType: 'DEFENSE_COUNCIL',
                    location: c.room || c.location,
                    defenseDate: new Date(c.date || c.defenseDate || effectiveDate),
                    assignmentConfirmedAt: now,
                    assignmentConfirmedById: actorId,
                    isActive: true,
                },
            });
            createdCouncilIds.push(newCouncil.id);

            // Tạo thành viên hội đồng
            for (const m of c.members) {
                await tx.councilMember.create({
                    data: {
                        councilId: newCouncil.id,
                        lecturerId: Number(m.lecturerId || m.id),
                        roleInCouncil: m.role || m.roleInCouncil,
                        isScoringMember: true,
                        isActive: true,
                        assignedById: actorId,
                    },
                });
            }

            // Gán sinh viên vào hội đồng (chống double-assign đồng thời)
            for (const s of c.students) {
                const regId = Number(s.registrationId || s.id);
                const shift = s.defenseSessionShift || s.shift || 'MORNING';
                const orderInShift = Number(s.defenseOrderInShift || s.orderInShift || 1);
                const sequenceNo = Number(s.defenseSequenceNo || s.sequenceNo || 1);

                const updateRes = await tx.topicRegistration.updateMany({
                    where: {
                        id: regId,
                        defenseCouncilId: null, // Chỉ cập nhật nếu chưa bị gán
                    },
                    data: {
                        defenseCouncilId: newCouncil.id,
                        councilId: newCouncil.id, // Tương thích ngược
                        defenseSessionShift: shift,
                        defenseOrderInShift: orderInShift,
                        defenseSequenceNo: sequenceNo,
                    },
                });

                if (updateRes.count === 0) {
                    throw createError(
                        409,
                        'STUDENT_ALREADY_ASSIGNED',
                        `Sinh viên (ID: ${regId}) đã được phân vào hội đồng khác hoặc trạng thái đã bị thay đổi.`
                    );
                }
                assignedRegistrationCount += 1;
            }
        }

        return {
            success: true,
            createdCouncilIds,
            assignedRegistrationCount,
        };
    });
}

module.exports = {
    confirmDefenseCouncilPlan,
};
