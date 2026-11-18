/**
 * Service kiểm tra điều kiện sinh viên và hội đồng bảo vệ khóa luận tốt nghiệp
 */
const prisma = require('../config/database');
const { getAcceptedExpertise } = require('./topicExpertiseService');

const MAX_STUDENTS_PER_DEFENSE_COUNCIL = 30;

const TERMINAL_REGISTRATION_STATUSES = [
    'DEFENSE_PASSED',
    'DEFENDED',
    'COMPLETED',
    'CANCELLED',
    'DROPPED',
    'NOT_ELIGIBLE_FOR_DEFENSE',
    'AUTO_NOT_ELIGIBLE',
];

/**
 * Kiểm tra biểu mẫu BM04 đã đạt và được khóa/duyệt hợp lệ hay chưa
 * hoặc có quyết định tương đương của Viện/hội đồng đề cương
 */
function isBm04Eligible(registration) {
    if (!registration) return false;

    // Quyết định tương đương của Viện / Hội đồng
    if (
        registration.status === 'ELIGIBLE_BY_INSTITUTE' ||
        registration.bm04Evaluation?.status === 'ELIGIBLE_BY_INSTITUTE' ||
        registration.bm04Evaluation?.instituteDefenseReview?.status === 'ELIGIBLE_BY_INSTITUTE' ||
        registration.bm04Evaluation?.instituteDefenseReview?.decision === 'OVERRIDE_ELIGIBLE'
    ) {
        return true;
    }

    const bm04 = registration.bm04Evaluation;
    if (!bm04) {
        // Task COMPLETED đơn lẻ KHÔNG đủ điều kiện nếu chưa có kết luận BM04 hợp lệ
        return false;
    }

    const isLocked = bm04.isLocked === true || bm04.finalized === true;
    if (!isLocked) {
        return false;
    }

    // Đã khóa và có kết luận đồng ý / đạt
    if (
        bm04.conclusion === 'AGREED_FOR_DEFENSE' ||
        bm04.defenseRecommendation === 'APPROVE_FOR_DEFENSE' ||
        bm04.status === 'SIGNED_APPROVED'
    ) {
        return true;
    }

    // Hoặc có finalGrade hợp lệ (>= 5.0)
    const gradeNum = typeof bm04.finalGrade === 'number'
        ? bm04.finalGrade
        : typeof bm04.finalGrade === 'string'
            ? parseFloat(bm04.finalGrade)
            : NaN;
    if (!isNaN(gradeNum) && gradeNum >= 5.0) {
        return true;
    }

    if (registration.status === 'DEFENSE_ELIGIBLE') {
        return true;
    }

    return false;
}

/**
 * Kiểm tra đề tài hợp lệ theo mô hình 1 sinh viên / 1 đề tài
 */
function isTopicValid(registration) {
    if (!registration?.topic) return false;
    if (registration.topic.maxStudents && registration.topic.maxStudents > 1) {
        return false;
    }
    return true;
}

/**
 * Kiểm tra xem sinh viên đã có hội đồng bảo vệ đang hoạt động hay chưa
 */
function hasActiveDefenseCouncil(registration) {
    if (registration.defenseCouncilId) {
        if (registration.defenseCouncil) {
            const dc = registration.defenseCouncil;
            if (dc.isActive !== false && !dc.deletedAt && (dc.councilType === 'DEFENSE_COUNCIL' || !dc.councilType)) {
                return true;
            }
        } else {
            return true;
        }
    }

    if (!registration.defenseCouncilId && registration.councilId) {
        if (registration.council) {
            const c = registration.council;
            if (c.isActive !== false && !c.deletedAt && c.councilType === 'DEFENSE_COUNCIL') {
                return true;
            }
        } else {
            return true;
        }
    }

    return false;
}

/**
 * Lấy danh sách TopicRegistration đủ điều kiện bảo vệ trong học kỳ
 */
async function getEligibleDefenseRegistrations(semesterId, { db = prisma } = {}) {
    const semId = Number(semesterId);
    if (!Number.isInteger(semId) || semId <= 0) {
        return [];
    }

    const registrations = await db.topicRegistration.findMany({
        where: {
            semesterId: semId,
        },
        include: {
            student: { select: { id: true, fullName: true, code: true, email: true } },
            topic: {
                select: {
                    id: true,
                    title: true,
                    description: true,
                    mentorId: true,
                    maxStudents: true,
                    mentor: { select: { id: true, fullName: true, email: true } },
                },
            },
            bm04Evaluation: {
                include: {
                    instituteDefenseReview: true,
                },
            },
            defenseCouncil: {
                select: { id: true, isActive: true, deletedAt: true, councilType: true },
            },
            council: {
                select: { id: true, isActive: true, deletedAt: true, councilType: true },
            },
            tasks: {
                where: { taskType: 'BM04' },
                select: { id: true, status: true },
            },
        },
        orderBy: { id: 'asc' },
    });

    return registrations.filter((reg) => {
        if (reg.semesterId !== semId) return false;
        if (!isTopicValid(reg)) return false;
        if (hasActiveDefenseCouncil(reg)) return false;
        if (!isBm04Eligible(reg)) return false;
        if (TERMINAL_REGISTRATION_STATUSES.includes(reg.status)) return false;
        return true;
    });
}

/**
 * Trích xuất mảng chuyên môn chuẩn hóa từ các dạng dữ liệu khác nhau
 */
function extractExpertiseAreas(source) {
    if (!source) return [];
    if (Array.isArray(source)) {
        return source.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof source === 'string') {
        const trimmed = source.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map((s) => String(s).trim()).filter(Boolean);
                }
            } catch {
                // fall through
            }
        }
        return trimmed.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

/**
 * Kiểm tra tính hợp lệ khi gán sinh viên vào hội đồng bảo vệ
 * @param {Object} params
 * @param {Object} params.registration - TopicRegistration cần gán
 * @param {Object} params.council - Hội đồng mục tiêu
 * @param {Array} params.members - Danh sách thành viên hội đồng
 * @param {Object} [params.semester] - Học kỳ
 * @param {Object} [options]
 * @param {Object} [options.db] - Prisma client hoặc mock
 * @returns {Promise<{ ok: boolean, reasons: string[] }>}
 */
async function validateDefenseAssignment({ registration, council, members = [], semester }, { db = prisma } = {}) {
    const reasons = [];

    if (!council) {
        return { ok: false, reasons: ['Hội đồng không tồn tại.'] };
    }

    if (council.isActive === false || council.deletedAt) {
        reasons.push('Hội đồng không còn hoạt động hoặc đã bị xóa.');
    }

    if (council.councilType && council.councilType !== 'DEFENSE_COUNCIL') {
        reasons.push('Hội đồng không phải là hội đồng bảo vệ (DEFENSE_COUNCIL).');
    }

    const targetSemesterId = council.semesterId || semester?.id;
    if (registration?.semesterId && targetSemesterId && registration.semesterId !== targetSemesterId) {
        reasons.push('Hội đồng và đề tài đăng ký không thuộc cùng học kỳ.');
    }

    if (council.semester?.status === 'COMPLETED' || semester?.status === 'COMPLETED') {
        reasons.push('Đợt đồ án này đã hoàn thành.');
    }

    if (registration) {
        if (!isTopicValid(registration)) {
            reasons.push('Đề tài không hợp lệ hoặc số lượng sinh viên vượt quá 1.');
        }

        if (!isBm04Eligible(registration)) {
            reasons.push('Sinh viên chưa đủ điều kiện bảo vệ (chưa có kết luận BM04 hợp lệ hoặc quyết định của Viện).');
        }

        if (registration.defenseCouncilId && council.id && registration.defenseCouncilId !== council.id) {
            reasons.push('Sinh viên đã được gán vào hội đồng bảo vệ khác.');
        }

        // 2. Conflict of interest: Giảng viên hướng dẫn không được nằm trong hội đồng
        const mentorId = registration.topic?.mentorId || registration.mentorId;
        if (mentorId && Array.isArray(members)) {
            const hasMentorConflict = members.some((m) => m.lecturerId === mentorId);
            if (hasMentorConflict) {
                reasons.push('Conflict of interest: Giảng viên hướng dẫn không được là thành viên của hội đồng bảo vệ.');
            }
        }
    }

    // 3. Mỗi giảng viên trong hội đồng không được tham gia nhiều hơn 1 hội đồng bảo vệ trong cùng học kỳ
    for (const m of members) {
        if (m.isAssignedToOtherCouncil || m.hasOtherDefenseCouncil || (m.councilCountInSemester && m.councilCountInSemester > 1)) {
            const lecName = m.lecturer?.fullName || m.lecturerId;
            reasons.push(`Giảng viên ${lecName} đã tham gia hội đồng bảo vệ khác trong cùng học kỳ.`);
        }
    }

    if (db?.councilMember?.findMany && targetSemesterId) {
        const lecturerIds = members.map((m) => m.lecturerId).filter(Boolean);
        if (lecturerIds.length > 0) {
            const otherMemberships = await db.councilMember.findMany({
                where: {
                    lecturerId: { in: lecturerIds },
                    ...(council.id ? { councilId: { not: council.id } } : {}),
                    council: {
                        semesterId: targetSemesterId,
                        councilType: 'DEFENSE_COUNCIL',
                        isActive: true,
                        deletedAt: null,
                    },
                },
                include: {
                    lecturer: { select: { fullName: true } },
                    council: { select: { name: true } },
                },
            });

            if (Array.isArray(otherMemberships) && otherMemberships.length > 0) {
                for (const om of otherMemberships) {
                    const lecName = om.lecturer?.fullName || om.lecturerId;
                    const cName = om.council?.name || om.councilId;
                    reasons.push(`Giảng viên ${lecName} đã tham gia hội đồng bảo vệ khác (${cName}) trong cùng học kỳ.`);
                }
            }
        }
    }

    // 4. Đề tài phải có ít nhất 1 thành viên hội đồng khớp chuyên môn đã được chấp nhận (nếu có)
    if (registration) {
        let acceptedAreas = registration.topic?.acceptedExpertise || registration.acceptedExpertise;
        const topicId = registration.topicId || registration.topic?.id;
        if (!acceptedAreas && topicId) {
            try {
                acceptedAreas = await getAcceptedExpertise(topicId, { db });
            } catch {
                acceptedAreas = null;
            }
        }

        const normalizedAccepted = extractExpertiseAreas(acceptedAreas).map((a) => a.toLowerCase());
        if (normalizedAccepted.length > 0) {
            let userMap = new Map();
            const missingLecturerIds = members
                .filter((m) => !m.expertiseAreas && !m.lecturer?.expertiseAreas && m.lecturerId)
                .map((m) => m.lecturerId);

            if (missingLecturerIds.length > 0 && db?.user?.findMany) {
                const users = await db.user.findMany({
                    where: { id: { in: missingLecturerIds } },
                    select: { id: true, expertiseAreas: true },
                });
                if (Array.isArray(users)) {
                    users.forEach((u) => userMap.set(u.id, u.expertiseAreas));
                }
            }

            let hasExpertiseMatch = false;
            for (const member of members) {
                const rawAreas = member.expertiseAreas || member.lecturer?.expertiseAreas || userMap.get(member.lecturerId);
                const memberAreas = extractExpertiseAreas(rawAreas).map((a) => a.toLowerCase());
                if (memberAreas.some((ma) => normalizedAccepted.includes(ma))) {
                    hasExpertiseMatch = true;
                    break;
                }
            }

            if (!hasExpertiseMatch) {
                reasons.push('Đề tài không có thành viên hội đồng nào khớp chuyên môn đã được chấp nhận.');
            }
        }
    }

    // 5. Sức chứa hội đồng: tối đa 30 sinh viên
    let currentStudentCount = 0;
    if (typeof council.currentCount === 'number') {
        currentStudentCount = council.currentCount;
    } else if (typeof council.studentCount === 'number') {
        currentStudentCount = council.studentCount;
    } else if (council._count?.defenseRegistrations !== undefined) {
        currentStudentCount = council._count.defenseRegistrations;
    } else if (council._count?.registrations !== undefined) {
        currentStudentCount = council._count.registrations;
    } else if (Array.isArray(council.registrations)) {
        currentStudentCount = council.registrations.length;
    } else if (Array.isArray(council.defenseRegistrations)) {
        currentStudentCount = council.defenseRegistrations.length;
    } else if (council.id && db?.topicRegistration?.count) {
        currentStudentCount = await db.topicRegistration.count({
            where: {
                OR: [
                    { defenseCouncilId: council.id },
                    { councilId: council.id },
                ],
            },
        });
    }

    if (currentStudentCount >= MAX_STUDENTS_PER_DEFENSE_COUNCIL) {
        reasons.push(`Hội đồng đã đạt sức chứa tối đa (${MAX_STUDENTS_PER_DEFENSE_COUNCIL} sinh viên).`);
    }

    return {
        ok: reasons.length === 0,
        reasons,
    };
}

module.exports = {
    MAX_STUDENTS_PER_DEFENSE_COUNCIL,
    isBm04Eligible,
    isTopicValid,
    getEligibleDefenseRegistrations,
    validateDefenseAssignment,
};
