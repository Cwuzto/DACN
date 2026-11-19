const prisma = require('../config/database');
const {
    MAX_STUDENTS_PER_COUNCIL,
    MAX_STUDENTS_PER_OUTLINE_COUNCIL,
    MAX_STUDENTS_PER_DEFENSE_COUNCIL,
} = require('../constants/councilLimits');
const { auditLog } = require('../services/auditLogService');
const { runAutoCouncilSetupForSemester } = require('../services/councilAutoSetupService');
const { validateDefenseAssignment } = require('../services/defenseCouncilEligibilityService');
const { buildDefenseCouncilPlan } = require('../services/defenseCouncilPlanningService');
const { confirmDefenseCouncilPlan } = require('../services/defenseCouncilConfirmationService');
const outlineReviewService = require('../services/outlineReviewService');
const {
    runAutoOutlineCouncilSetupForSemester,
    previewAutoOutlineCouncilSetup,
} = require('../services/outlineAutoSetupService');
const { resolveEffectiveTopicTitle } = require('../services/topicTitleResolverService');
const { safeNotifyMany } = require('../services/notificationService');

const splitConfirmedStudentsIntoShifts = (registrationIds = []) => {
    if (!Array.isArray(registrationIds)) return [];
    const N = registrationIds.length;
    const morningCount = Math.ceil(N / 2);
    return registrationIds.map((reg, index) => {
        const registrationId = typeof reg === 'object' && reg !== null ? (reg.id || reg.registrationId) : reg;
        const isMorning = index < morningCount;
        return {
            registrationId,
            defenseSequenceNo: index + 1,
            defenseSessionShift: isMorning ? 'MORNING' : 'AFTERNOON',
            defenseOrderInShift: isMorning ? (index + 1) : (index - morningCount + 1),
        };
    });
};

const handleOutlineError = (error, res, next) => {
    if (error.statusCode === 409 && error.details?.blockingRegistrations) {
        return res.status(409).json({
            success: false,
            message: error.message,
            blockingRegistrations: error.details.blockingRegistrations,
        });
    }
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            ...(error.details && typeof error.details === 'object' ? error.details : {}),
        });
    }
    next(error);
};

const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

const createHttpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const normalizeMemberInput = (members = []) => {
    const normalized = members.map((member) => ({
        lecturerId: parseInt(member.lecturerId, 10),
        roleInCouncil: member.roleInCouncil,
    }));

    const invalid = normalized.find((member) => !Number.isInteger(member.lecturerId));
    if (invalid) {
        throw createHttpError(400, 'LecturerId trong members không hợp lệ.');
    }

    const seen = new Set();
    for (const member of normalized) {
        if (seen.has(member.lecturerId)) {
            throw createHttpError(400, 'Danh sách members đang có giảng viên bị trùng lặp.');
        }
        seen.add(member.lecturerId);
    }

    return normalized;
};

const validateCouncilComposition = (members = [], options = {}) => {
    if (!Array.isArray(members)) {
        throw createHttpError(400, 'Danh sách thành viên hội đồng không hợp lệ.');
    }
    const allowFourth = options.allowFourthScoringMember === true || members.length === 4;
    if (members.length < 3 || members.length > (allowFourth ? 4 : 3)) {
        throw createHttpError(400, allowFourth ? 'Hội đồng phải có 3 hoặc 4 giảng viên.' : 'Mỗi hội đồng phải có đúng 3 giảng viên.');
    }

    const roleCounts = {};
    for (const member of members) {
        roleCounts[member.roleInCouncil] = (roleCounts[member.roleInCouncil] || 0) + 1;
    }

    const expectedRoles = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];
    for (const role of expectedRoles) {
        if (!roleCounts[role] || roleCounts[role] !== 1) {
            throw createHttpError(400, 'Hội đồng phải đủ 3 vai trò: CHAIRMAN, SECRETARY, REVIEWER.');
        }
    }

    if (members.length === 4) {
        if (roleCounts['MEMBER'] !== 1) {
            throw createHttpError(400, 'Thành viên thứ 4 của hội đồng phải có vai trò là MEMBER.');
        }
    }
};

const findScheduleWarnings = async (tx, { semesterId, councilId, defenseDate, lecturerIds }) => {
    if (!defenseDate || !lecturerIds?.length) {
        return [];
    }

    const conflictingMembers = await tx.councilMember.findMany({
        where: {
            lecturerId: { in: lecturerIds },
            council: {
                semesterId,
                defenseDate,
                ...(councilId ? { id: { not: councilId } } : {}),
            },
        },
        include: {
            lecturer: { select: { fullName: true } },
            council: { select: { id: true, name: true } },
        },
    });

    return conflictingMembers.map((member) => (
        `Cảnh báo: Giảng viên ${member.lecturer.fullName} đã tham gia hội đồng #${member.council.id} (${member.council.name}) cùng defenseDate.`
    ));
};

const validateCouncilMembersAgainstAssignedStudents = async (tx, councilId, lecturerIds) => {
    if (!lecturerIds?.length) {
        return;
    }

    const registrations = await tx.topicRegistration.findMany({
        where: {
            OR: [
                { councilId },
                { outlineCouncilId: councilId },
                { defenseCouncilId: councilId },
            ],
        },
        include: {
            student: { select: { fullName: true, code: true } },
            topic: { select: { mentorId: true, title: true } },
        },
    });

    const lecturerSet = new Set(lecturerIds);
    const conflict = registrations.find((registration) => lecturerSet.has(registration.topic.mentorId));

    if (conflict) {
        throw createHttpError(
            400,
            `Conflict of interest: Giảng viên hướng dẫn không được chấm sinh viên ${conflict.student.fullName} (${conflict.student.code}) với đề tài "${conflict.topic.title}".`,
        );
    }
};

const DEFENSE_FINISHED_REG_STATUSES = new Set([
    'AWAITING_FINAL_APPROVAL',
    'DEFENDED',
    'DEFENSE_PASSED',
    'DEFENSE_FAILED',
    'COMPLETED',
]);

const isDefenseRegistrationFinished = (reg) => Boolean(
    reg?.defenseResult?.scoreLocked
    || reg?.defenseResult?.isLocked
    || reg?.defenseResult?.isPublished
    || DEFENSE_FINISHED_REG_STATUSES.has(reg?.status),
);

const isDefenseCouncilFinished = (council, now = new Date()) => {
    if (!council || council.councilType === 'OUTLINE_REVIEW') {
        return false;
    }
    if (council.semester?.status === 'COMPLETED') {
        return true;
    }
    if (council.scoreBookLocked) {
        return true;
    }
    const candidates = Array.isArray(council.registrations) ? council.registrations : [];
    if (candidates.length > 0) {
        return candidates.every(isDefenseRegistrationFinished);
    }
    if (council.defenseDate) {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return new Date(council.defenseDate) < startOfToday;
    }
    return false;
};

const getAllCouncils = async (req, res, next) => {
    try {
        const { semesterId, councilType, forGrading } = req.query;
        const isForGrading = forGrading === 'true' || forGrading === '1';
        const where = {};
        if (semesterId) where.semesterId = parseInt(semesterId, 10);
        if (councilType && ['OUTLINE_REVIEW', 'DEFENSE_COUNCIL'].includes(councilType)) {
            where.councilType = councilType;
        }

        const allowedCouncilTypes = [];
        const userPerms = req.user.permissions || [];
        const hasBroadAccess = userPerms.includes('VIEW_COUNCIL_ASSIGNMENTS') ||
                               userPerms.includes('NOTIFICATION_MANAGE') ||
                               userPerms.includes('PROJECT_OVERSIGHT_MANAGE');

        if (hasBroadAccess || userPerms.includes('OUTLINE_COUNCIL_MANAGE')) {
            allowedCouncilTypes.push('OUTLINE_REVIEW');
        } else if (userPerms.includes('OUTLINE_REVIEW')) {
            allowedCouncilTypes.push('OUTLINE_REVIEW');
            where.members = { some: { lecturerId: req.user.id } };
        }

        if (hasBroadAccess || userPerms.includes('DEFENSE_COUNCIL_MANAGE')) {
            allowedCouncilTypes.push('DEFENSE_COUNCIL');
        } else if (userPerms.includes('VIEW_DEFENSE_GRADING')) {
            allowedCouncilTypes.push('DEFENSE_COUNCIL');
            where.members = { some: { lecturerId: req.user.id } };
        }

        if (isForGrading) {
            where.members = { some: { lecturerId: req.user.id, isActive: true } };
        }

        if (where.councilType && !allowedCouncilTypes.includes(where.councilType)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem loại hội đồng này.' });
        }
        if (!where.councilType) where.councilType = { in: allowedCouncilTypes };

        const include = {
            semester: { select: { id: true, code: true, name: true, status: true, defenseDate: true, endDate: true } },
            members: {
                include: {
                    lecturer: { select: { id: true, fullName: true, avatarUrl: true, code: true } },
                },
            },
            resultBatches: {
                orderBy: { versionNumber: 'desc' },
                take: 1,
            },
            _count: {
                select: { registrations: true, outlineRegistrations: true, defenseRegistrations: true },
            },
        };

        if (isForGrading) {
            include.defenseRegistrations = {
                include: {
                    student: { select: { id: true, fullName: true, code: true, email: true } },
                    topic: {
                        select: {
                            id: true,
                            title: true,
                            mentorId: true,
                            mentor: { select: { id: true, fullName: true } },
                        },
                    },
                    defenseResult: true,
                    memberScores: {
                        where: { isEffective: true },
                        select: { id: true, evaluatorId: true, scoreLocked: true, finalScore: true },
                    },
                },
                orderBy: [{ defenseSessionShift: 'asc' }, { defenseOrderInShift: 'asc' }, { id: 'asc' }],
            };
        }

        const councils = await prisma.council.findMany({
            where,
            include,
            orderBy: isForGrading ? [{ defenseDate: 'asc' }, { id: 'desc' }] : { id: 'desc' },
        });

        let normalizedCouncils = councils.map((c) => {
            const studentCount = c.councilType === 'OUTLINE_REVIEW'
                ? (c._count.outlineRegistrations || 0)
                : (c._count.defenseRegistrations || c._count.registrations || 0);
            const myMember = c.members?.find((m) => m.lecturerId === req.user.id);
            const activeScorerCount = (c.members || []).filter((m) => m.isActive !== false && m.isScoringMember !== false).length || 3;

            const base = {
                ...c,
                myRole: myMember?.roleInCouncil || null,
                _count: {
                    ...c._count,
                    registrations: studentCount,
                },
            };

            if (isForGrading && c.councilType !== 'OUTLINE_REVIEW') {
                const rawRegs = c.defenseRegistrations || c.registrations || [];
                base.registrations = rawRegs.map((reg) => ({
                    ...reg,
                    defenseShift: reg.defenseSessionShift || reg.defenseShift || null,
                    orderInShift: reg.defenseOrderInShift || reg.orderInShift || null,
                    attendanceStatus: reg.defenseResult?.attendanceStatus || reg.attendanceStatus || 'PRESENT',
                    isScoreBookLocked: Boolean(reg.defenseResult?.scoreLocked || reg.isScoreBookLocked),
                    lockedScoreCount: (reg.memberScores || []).filter((m) => m.scoreLocked || m.isLocked).length,
                    totalScorers: activeScorerCount,
                }));
            }

            return base;
        });

        if (isForGrading) {
            const now = new Date();
            normalizedCouncils = normalizedCouncils.filter((c) => !isDefenseCouncilFinished(c, now));
        }

        res.json({ success: true, data: normalizedCouncils });
    } catch (error) {
        next(error);
    }
};

const getCouncilById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const council = await prisma.council.findUnique({
            where: { id: parseInt(id, 10) },
            include: {
                semester: { select: { name: true } },
                members: {
                    include: {
                        lecturer: { select: { id: true, fullName: true, avatarUrl: true, code: true } },
                    },
                },
                registrations: {
                    include: {
                        topic: { select: { id: true, title: true, mentorId: true, mentor: { select: { id: true, fullName: true } } } },
                        student: { select: { id: true, fullName: true, code: true, email: true } },
                    },
                },
                outlineRegistrations: {
                    include: {
                        topic: { select: { id: true, title: true, mentorId: true, mentor: { select: { id: true, fullName: true } } } },
                        student: { select: { id: true, fullName: true, code: true, email: true } },
                        bm01Evaluations: {
                            orderBy: { id: 'desc' },
                            include: {
                                submission: true,
                                revisionSubmission: true,
                            },
                        },
                    },
                },
                defenseRegistrations: {
                    include: {
                        topic: { select: { id: true, title: true, mentorId: true, mentor: { select: { id: true, fullName: true } } } },
                        student: { select: { id: true, fullName: true, code: true, email: true } },
                        defenseResult: true,
                        memberScores: true,
                    },
                },
                resultBatches: {
                    orderBy: { versionNumber: 'desc' },
                    include: {
                        evaluations: true,
                        secretaryCompletedBy: { select: { id: true, fullName: true } },
                        chairPublishedBy: { select: { id: true, fullName: true } },
                        returnedBy: { select: { id: true, fullName: true } },
                        reopenedBy: { select: { id: true, fullName: true } },
                    },
                },
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        const effectiveRegistrations = council.councilType === 'OUTLINE_REVIEW'
            ? council.outlineRegistrations
            : (council.defenseRegistrations?.length > 0 ? council.defenseRegistrations : council.registrations);

        const myMember = council.members?.find((m) => m.lecturerId === req.user.id);
        const userPerms = req.user?.permissions || [];
        const hasBroadAccess = req.user?.role === 'ADMIN'
            || userPerms.includes('VIEW_COUNCIL_ASSIGNMENTS')
            || userPerms.includes('NOTIFICATION_MANAGE')
            || userPerms.includes('PROJECT_OVERSIGHT_MANAGE')
            || (council.councilType === 'OUTLINE_REVIEW' && userPerms.includes('OUTLINE_COUNCIL_MANAGE'))
            || (council.councilType === 'DEFENSE_COUNCIL' && userPerms.includes('DEFENSE_COUNCIL_MANAGE'));

        if (!hasBroadAccess && !myMember) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không phải thành viên của hội đồng này nên không có quyền truy cập.',
            });
        }

        const enrichedRegistrations = [];
        for (const reg of (effectiveRegistrations || [])) {
            try {
                const resolved = await resolveEffectiveTopicTitle(reg.id);
                enrichedRegistrations.push({
                    ...reg,
                    effectiveTitle: resolved?.title || reg.topic?.title || 'Chưa có tên đề tài',
                });
            } catch {
                enrichedRegistrations.push({
                    ...reg,
                    effectiveTitle: reg.topic?.title || 'Chưa có tên đề tài',
                });
            }
        }

        res.json({
            success: true,
            data: {
                ...council,
                myRole: myMember?.roleInCouncil || null,
                registrations: enrichedRegistrations,
            },
        });
    } catch (error) {
        next(error);
    }
};

const getCouncilAuditLogs = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        if (!Number.isInteger(councilId) || councilId <= 0) {
            return res.status(400).json({ success: false, message: 'councilId không hợp lệ.' });
        }

        const logs = await prisma.auditLog.findMany({
            where: {
                entityType: 'Council',
                entityId: String(councilId),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        code: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });

        return res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
};

const createCouncil = async (req, res, next) => {
    try {
        const { semesterId, name, councilType, location, defenseDate, members, allowFourthScoringMember } = req.body;

        if (!semesterId || !name) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp học kỳ và tên hội đồng.',
            });
        }

        const semesterIdInt = parseInt(semesterId, 10);
        const semester = await prisma.semester.findUnique({
            where: { id: semesterIdInt },
            select: { id: true, status: true },
        });
        if (!semester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đợt đồ án.' });
        }
        if (semester.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                code: 'SEMESTER_ALREADY_COMPLETED',
                message: 'Đợt đồ án này đã hoàn thành, không thể tạo thêm hội đồng.',
            });
        }

        const defenseDateValue = defenseDate ? new Date(defenseDate) : null;
        const normalizedMembers = normalizeMemberInput(members || []);
        if (normalizedMembers.length) {
            validateCouncilComposition(normalizedMembers, { allowFourthScoringMember });
        }

        const validCouncilTypes = ['OUTLINE_REVIEW', 'DEFENSE_COUNCIL'];
        const councilTypeValue = councilType && validCouncilTypes.includes(councilType) ? councilType : 'DEFENSE_COUNCIL';

        let memberDetails = [];
        if (normalizedMembers.length) {
            const lecturerIds = normalizedMembers.map((member) => member.lecturerId);
            const lecturers = await prisma.user.findMany({
                where: { id: { in: lecturerIds } },
                select: { id: true, fullName: true, code: true },
            });
            const lecturerMap = new Map(lecturers.map((l) => [l.id, l]));
            memberDetails = normalizedMembers.map((member) => {
                const lec = lecturerMap.get(member.lecturerId);
                return {
                    roleInCouncil: member.roleInCouncil,
                    lecturerId: member.lecturerId,
                    fullName: lec?.fullName || 'N/A',
                    code: lec?.code || null,
                };
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const newCouncil = await tx.council.create({
                data: {
                    semesterId: semesterIdInt,
                    name,
                    councilType: councilTypeValue,
                    location,
                    defenseDate: defenseDateValue,
                    allowFourthScoringMember: Boolean(allowFourthScoringMember),
                },
            });

            if (normalizedMembers.length) {
                await tx.councilMember.createMany({
                    data: normalizedMembers.map((member) => ({
                        councilId: newCouncil.id,
                        lecturerId: member.lecturerId,
                        roleInCouncil: member.roleInCouncil,
                        isScoringMember: true,
                    })),
                });
            }

            const warnings = await findScheduleWarnings(tx, {
                semesterId: semesterIdInt,
                councilId: newCouncil.id,
                defenseDate: defenseDateValue,
                lecturerIds: normalizedMembers.map((member) => member.lecturerId),
            });

            return { council: newCouncil, warnings };
        });

        await auditLog(
            req.user.id,
            'CREATE_COUNCIL',
            'Council',
            result.council.id,
            {
                summary: `Khởi tạo hội đồng "${name}"`,
                councilName: name,
                councilType: councilTypeValue,
                location: location || 'Chưa xếp phòng',
                defenseDate: defenseDateValue,
                memberCount: normalizedMembers.length,
                members: memberDetails,
                semesterId: semesterIdInt,
            },
            getRequestIp(req),
        );

        res.status(201).json({
            success: true,
            message: 'Tạo hội đồng thành công',
            data: result.council,
            warnings: result.warnings,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const updateCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const councilId = parseInt(id, 10);
        const { name, councilType, location, defenseDate, members, allowFourthScoringMember } = req.body;

        const existing = await prisma.council.findUnique({
            where: { id: councilId },
            include: {
                semester: { select: { status: true } },
                members: {
                    include: {
                        lecturer: {
                            select: { id: true, fullName: true, code: true },
                        },
                    },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        if (existing.semester?.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                code: 'SEMESTER_ALREADY_COMPLETED',
                message: 'Đợt đồ án này đã hoàn thành. Toàn bộ thông tin hội đồng được khóa cố định để bảo toàn lịch sử học vụ.',
            });
        }

        if (existing.schedulePublishedAt) {
            return res.status(409).json({
                success: false,
                code: 'COUNCIL_SCHEDULE_ALREADY_PUBLISHED',
                message: 'Hội đồng đã công bố lịch bảo vệ chính thức và không thể thay đổi thông tin chung hoặc thành viên.',
            });
        }

        const defenseDateValue = defenseDate !== undefined
            ? (defenseDate ? new Date(defenseDate) : null)
            : existing.defenseDate;

        const changes = [];
        if (name !== undefined && name !== existing.name) {
            changes.push({
                field: 'name',
                label: 'Tên hội đồng',
                from: existing.name,
                to: name,
            });
        }
        if (location !== undefined && location !== existing.location) {
            changes.push({
                field: 'location',
                label: 'Địa điểm / Phòng họp',
                from: existing.location || 'Chưa xếp phòng',
                to: location || 'Chưa xếp phòng',
            });
        }
        if (defenseDate !== undefined) {
            const oldDateStr = existing.defenseDate ? new Date(existing.defenseDate).toISOString() : null;
            const newDateStr = defenseDateValue ? defenseDateValue.toISOString() : null;
            if (oldDateStr !== newDateStr) {
                changes.push({
                    field: 'defenseDate',
                    label: 'Ngày họp',
                    from: existing.defenseDate || null,
                    to: defenseDateValue || null,
                });
            }
        }

        let updatedMemberDetails = undefined;
        let normalizedMembers = [];
        const finalAllowFourth = allowFourthScoringMember !== undefined
            ? Boolean(allowFourthScoringMember)
            : Boolean(existing.allowFourthScoringMember);

        if (members !== undefined) {
            normalizedMembers = normalizeMemberInput(members);
            const newLecturerIds = normalizedMembers.map((m) => m.lecturerId);
            const newLecturers = newLecturerIds.length > 0 ? await prisma.user.findMany({
                where: { id: { in: newLecturerIds } },
                select: { id: true, fullName: true, code: true },
            }) : [];
            const newLecturerMap = new Map(newLecturers.map((l) => [l.id, l]));
            updatedMemberDetails = normalizedMembers.map((m) => {
                const lec = newLecturerMap.get(m.lecturerId);
                return {
                    roleInCouncil: m.roleInCouncil,
                    lecturerId: m.lecturerId,
                    fullName: lec?.fullName || 'N/A',
                    code: lec?.code || null,
                };
            });

            const ROLE_NAMES = {
                CHAIRMAN: 'Chủ tịch HĐ',
                SECRETARY: 'Thư ký HĐ',
                REVIEWER: 'UV Phản biện',
                MEMBER: 'Ủy viên HĐ',
            };
            const formatMemberDisplay = (m) => (m ? (m.code ? `${m.fullName} (${m.code})` : m.fullName) : 'Chưa phân công');
            const rolesToCheck = ['CHAIRMAN', 'SECRETARY', 'REVIEWER', 'MEMBER'];
            for (const roleKey of rolesToCheck) {
                const oldMember = existing.members?.find((m) => m.roleInCouncil === roleKey);
                const newMember = updatedMemberDetails.find((m) => m.roleInCouncil === roleKey);
                const oldLecturer = oldMember ? { fullName: oldMember.lecturer?.fullName, code: oldMember.lecturer?.code, lecturerId: oldMember.lecturerId } : null;
                const oldId = oldMember?.lecturerId;
                const newId = newMember?.lecturerId;
                if (oldId !== newId) {
                    changes.push({
                        field: `member_${roleKey.toLowerCase()}`,
                        role: roleKey,
                        label: ROLE_NAMES[roleKey] || roleKey,
                        from: formatMemberDisplay(oldLecturer),
                        to: formatMemberDisplay(newMember),
                    });
                }
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            await tx.council.update({
                where: { id: councilId },
                data: {
                    name,
                    ...(councilType !== undefined && { councilType }),
                    location,
                    defenseDate: defenseDateValue,
                    ...(allowFourthScoringMember !== undefined && { allowFourthScoringMember: Boolean(allowFourthScoringMember) }),
                },
            });

            let lecturerIdsForWarning = [];

            if (members !== undefined) {
                validateCouncilComposition(normalizedMembers, { allowFourthScoringMember: finalAllowFourth });
                lecturerIdsForWarning = normalizedMembers.map((member) => member.lecturerId);

                await validateCouncilMembersAgainstAssignedStudents(tx, councilId, lecturerIdsForWarning);

                await tx.councilMember.deleteMany({ where: { councilId } });
                if (normalizedMembers.length > 0) {
                    await tx.councilMember.createMany({
                        data: normalizedMembers.map((member) => ({
                            councilId,
                            lecturerId: member.lecturerId,
                            roleInCouncil: member.roleInCouncil,
                            isScoringMember: true,
                        })),
                    });
                }
            } else {
                const currentMembers = await tx.councilMember.findMany({
                    where: { councilId },
                    select: { lecturerId: true },
                });
                lecturerIdsForWarning = currentMembers.map((member) => member.lecturerId);
            }

            const warnings = await findScheduleWarnings(tx, {
                semesterId: existing.semesterId,
                councilId,
                defenseDate: defenseDateValue,
                lecturerIds: lecturerIdsForWarning,
            });

            return { warnings };
        });

        await auditLog(
            req.user.id,
            'UPDATE_COUNCIL',
            'Council',
            councilId,
            {
                updateType: members !== undefined ? 'MEMBERS_UPDATE' : 'INFO_UPDATE',
                summary: members !== undefined ? 'Cập nhật thành viên hội đồng' : 'Cập nhật thông tin hội đồng',
                hasMembersPayload: members !== undefined,
                changes,
                members: updatedMemberDetails,
            },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Cập nhật hội đồng thành công.',
            warnings: result.warnings,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const assignRegistrationsToCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { registrationIds } = req.body;

        if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Danh sách đăng ký (registrationIds) không hợp lệ.',
            });
        }

        const councilId = parseInt(id, 10);
        const uniqueRegistrationIds = [...new Set(
            registrationIds.map((value) => parseInt(value, 10)).filter((value) => Number.isInteger(value)),
        )];

        if (uniqueRegistrationIds.length !== registrationIds.length) {
            return res.status(400).json({
                success: false,
                message: 'registrationIds có phần tử không hợp lệ hoặc trùng lặp.',
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const council = await tx.council.findUnique({
                where: { id: councilId },
                include: {
                    semester: { select: { id: true, status: true } },
                    members: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            lecturerId: true,
                            roleInCouncil: true,
                            isActive: true,
                            isScoringMember: true,
                            lecturer: { select: { id: true, fullName: true, email: true, expertiseAreas: true } },
                        },
                    },
                    _count: { select: { registrations: true, outlineRegistrations: true, defenseRegistrations: true } },
                },
            });

            if (!council) {
                throw createHttpError(404, 'Không tìm thấy hội đồng.');
            }

            if (council.semester?.status === 'COMPLETED') {
                throw createHttpError(400, 'Đợt đồ án này đã hoàn thành. Toàn bộ thông tin hội đồng được khóa cố định để bảo toàn lịch sử học vụ.');
            }

            if (council.schedulePublishedAt) {
                const err = createHttpError(409, 'Lịch bảo vệ của hội đồng đã được công bố chính thức. Không thể thêm sinh viên vào hội đồng đã công bố lịch.');
                err.code = 'COUNCIL_SCHEDULE_ALREADY_PUBLISHED';
                throw err;
            }

            validateCouncilComposition(council.members, { allowFourthScoringMember: council.allowFourthScoringMember });

            const currentStudentCount = council.councilType === 'OUTLINE_REVIEW'
                ? (council._count.outlineRegistrations || 0)
                : (council._count.defenseRegistrations || council._count.registrations || 0);

            const maxLimit = council.councilType === 'OUTLINE_REVIEW'
                ? MAX_STUDENTS_PER_OUTLINE_COUNCIL
                : MAX_STUDENTS_PER_DEFENSE_COUNCIL;

            if (currentStudentCount + uniqueRegistrationIds.length > maxLimit) {
                throw createHttpError(400, `Hội đồng tối đa ${maxLimit} sinh viên.`);
            }

            const registrations = await tx.topicRegistration.findMany({
                where: { id: { in: uniqueRegistrationIds } },
                include: {
                    student: { select: { id: true, fullName: true, code: true, email: true } },
                    topic: {
                        select: {
                            id: true,
                            title: true,
                            mentorId: true,
                            maxStudents: true,
                            mentor: { select: { id: true, fullName: true } },
                        },
                    },
                    bm04Evaluation: {
                        include: {
                            instituteDefenseReview: true,
                        },
                    },
                    tasks: {
                        where: { taskType: 'BM04' },
                        select: { id: true, status: true },
                    },
                },
            });

            if (registrations.length !== uniqueRegistrationIds.length) {
                throw createHttpError(400, 'Có đăng ký không tồn tại.');
            }

            let alreadyAssigned;
            if (council.councilType === 'OUTLINE_REVIEW') {
                alreadyAssigned = registrations.find((registration) => Boolean(registration.outlineCouncilId));
            } else {
                alreadyAssigned = registrations.find((registration) => Boolean(registration.defenseCouncilId || registration.councilId));
            }

            if (alreadyAssigned) {
                const councilTypeName = council.councilType === 'OUTLINE_REVIEW' ? 'xét duyệt đề cương' : 'chấm bảo vệ';
                throw createHttpError(
                    400,
                    `Sinh viên ${alreadyAssigned.student.fullName} (${alreadyAssigned.student.code}) đã thuộc hội đồng ${councilTypeName} khác.`,
                );
            }

            const memberLecturerIds = new Set(council.members.map((member) => member.lecturerId));
            const conflict = registrations.find((registration) => memberLecturerIds.has(registration.topic.mentorId));
            if (conflict) {
                throw createHttpError(
                    400,
                    `Conflict of interest: Không thể gán sinh viên ${conflict.student.fullName} (${conflict.student.code}) vào hội đồng có giảng viên hướng dẫn đề tài "${conflict.topic.title}".`,
                );
            }

            if (council.councilType === 'DEFENSE_COUNCIL') {
                for (const reg of registrations) {
                    const validation = await validateDefenseAssignment({
                        registration: reg,
                        council,
                        members: council.members,
                        semester: council.semester,
                    }, { db: tx });
                    if (!validation.ok) {
                        throw createHttpError(
                            400,
                            validation.reasons[0] || `Sinh viên ${reg.student?.fullName || reg.id} không đủ điều kiện gán vào hội đồng bảo vệ.`,
                        );
                    }
                }
            }

            const updateData = {};
            if (council.councilType === 'OUTLINE_REVIEW') {
                updateData.outlineCouncilId = councilId;
                updateData.outlineReviewStatus = 'PENDING';
            } else {
                updateData.defenseCouncilId = councilId;
                updateData.councilId = councilId;
            }

            await tx.topicRegistration.updateMany({
                where: { id: { in: uniqueRegistrationIds } },
                data: updateData,
            });

            return {
                assignedStudents: registrations.map((r) => ({
                    registrationId: r.id,
                    studentCode: r.student?.code || null,
                    studentName: r.student?.fullName || 'N/A',
                    topicTitle: r.topic?.title || 'Chưa có tên đề tài',
                })),
            };
        });

        await auditLog(
            req.user.id,
            'ASSIGN_COUNCIL',
            'Council',
            councilId,
            {
                summary: `Phân công ${result.assignedStudents.length} sinh viên vào hội đồng`,
                studentCount: result.assignedStudents.length,
                registrationIds: uniqueRegistrationIds,
                students: result.assignedStudents,
            },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: `Đã phân công ${uniqueRegistrationIds.length} sinh viên vào hội đồng.`,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const autoAssignRegistrationsToCouncils = async (req, res, next) => {
    try {
        return res.status(400).json({
            success: false,
            code: 'USE_ASSIGNMENT_PREVIEW',
            message: 'Chức năng tự động gán trực tiếp đã bị ngừng. Vui lòng sử dụng tính năng Xem trước và xác nhận phương án bảo vệ (Assignment Preview).',
        });
    } catch (error) {
        next(error);
    }
};

const removeRegistrationFromCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { registrationId } = req.body;
        const councilId = parseInt(id, 10);
        const registrationIdInt = parseInt(registrationId, 10);

        const council = await prisma.council.findUnique({
            where: { id: councilId },
            select: {
                id: true,
                councilType: true,
                semesterId: true,
                schedulePublishedAt: true,
                scheduleConfirmedAt: true,
                semester: { select: { status: true } },
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        if (council.semester?.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                code: 'SEMESTER_ALREADY_COMPLETED',
                message: 'Đợt đồ án này đã hoàn thành. Toàn bộ thông tin hội đồng được khóa cố định để bảo toàn lịch sử học vụ.',
            });
        }

        const targetReg = await prisma.topicRegistration.findUnique({
            where: { id: registrationIdInt },
            select: {
                id: true,
                status: true,
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
                defenseResult: { select: { id: true } },
                defenseMemberScores: { select: { id: true } },
                bM01Evaluations: { select: { id: true, outlineCouncilId: true } },
            },
        });

        if (!targetReg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký.' });
        }

        if (council.councilType === 'DEFENSE_COUNCIL') {
            const hasDefenseScore = Boolean(targetReg.defenseResult || (targetReg.defenseMemberScores && targetReg.defenseMemberScores.length > 0));
            const isDefendedStatus = ['DEFENDED', 'DEFENSE_PASSED', 'DEFENSE_FAILED', 'COMPLETED'].includes(targetReg.status);
            if (hasDefenseScore || isDefendedStatus) {
                return res.status(400).json({
                    success: false,
                    code: 'CANNOT_REMOVE_GRADED_STUDENT',
                    message: `Không thể gỡ sinh viên ${targetReg.student?.fullName || ''} đã có điểm hoặc đã hoàn thành bảo vệ khỏi hội đồng.`,
                });
            }
            if (council.schedulePublishedAt || council.scheduleConfirmedAt) {
                return res.status(400).json({
                    success: false,
                    code: 'COUNCIL_SCHEDULE_ALREADY_PUBLISHED',
                    message: 'Lịch bảo vệ của hội đồng đã được công bố hoặc xác nhận. Vui lòng hủy công bố lịch trước khi điều chỉnh danh sách sinh viên.',
                });
            }
        } else if (council.councilType === 'OUTLINE_REVIEW') {
            const hasOutlineEvaluation = (targetReg.bM01Evaluations || []).some(
                (ev) => ev.outlineCouncilId === councilId
            );
            if (hasOutlineEvaluation) {
                return res.status(400).json({
                    success: false,
                    code: 'CANNOT_REMOVE_EVALUATED_STUDENT',
                    message: `Không thể gỡ sinh viên ${targetReg.student?.fullName || ''} đã được Hội đồng đánh giá đề cương BM01.`,
                });
            }
        }

        const where = { id: registrationIdInt };
        const updateData = {};
        if (council.councilType === 'OUTLINE_REVIEW') {
            where.outlineCouncilId = councilId;
            updateData.outlineCouncilId = null;
        } else {
            where.OR = [{ defenseCouncilId: councilId }, { councilId }];
            updateData.defenseCouncilId = null;
            updateData.councilId = null;
        }

        const result = await prisma.topicRegistration.updateMany({
            where,
            data: updateData,
        });

        if (result && result.count > 0) {
            await auditLog(
                req.user.id,
                'REMOVE_REGISTRATION_FROM_COUNCIL',
                'Council',
                councilId,
                {
                    summary: targetReg?.student
                        ? `Gỡ sinh viên ${targetReg.student.fullName} (${targetReg.student.code}) khỏi hội đồng`
                        : 'Gỡ sinh viên khỏi hội đồng',
                    registrationId: registrationIdInt,
                    studentCode: targetReg?.student?.code || null,
                    studentName: targetReg?.student?.fullName || null,
                    topicTitle: targetReg?.topic?.title || null,
                },
                getRequestIp(req),
            );
        }

        res.json({ success: true, message: 'Đã gỡ sinh viên khỏi hội đồng.' });
    } catch (error) {
        next(error);
    }
};

const deleteCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id, 10);

        const existing = await prisma.council.findUnique({
            where: { id: parsedId },
            include: {
                semester: { select: { status: true } },
                _count: {
                    select: {
                        registrations: true,
                        outlineRegistrations: true,
                        defenseRegistrations: true,
                        resultBatches: true,
                    },
                },
            },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        if (existing.semester?.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                code: 'SEMESTER_ALREADY_COMPLETED',
                message: 'Đợt đồ án này đã hoàn thành. Toàn bộ thông tin hội đồng được khóa cố định để bảo toàn lịch sử học vụ.',
            });
        }

        if (existing.schedulePublishedAt) {
            return res.status(409).json({
                success: false,
                code: 'COUNCIL_SCHEDULE_ALREADY_PUBLISHED',
                message: 'Không thể xóa hội đồng đã công bố lịch bảo vệ chính thức.',
            });
        }

        const totalAssignedStudents = (existing._count?.registrations || 0)
            + (existing._count?.outlineRegistrations || 0)
            + (existing._count?.defenseRegistrations || 0);

        if (totalAssignedStudents > 0) {
            return res.status(400).json({
                success: false,
                code: 'COUNCIL_HAS_STUDENTS',
                message: 'Không thể xóa hội đồng đã có sinh viên được phân công.',
            });
        }

        if ((existing._count?.resultBatches || 0) > 0) {
            return res.status(400).json({
                success: false,
                code: 'COUNCIL_HAS_HISTORY',
                message: 'Không thể xóa hội đồng đã có sổ điểm hoặc biên bản bảo vệ.',
            });
        }

        const [hasDefenseResult, hasOutlineEval] = await Promise.all([
            prisma.defenseResult.findFirst({ where: { councilId: parsedId } }),
            prisma.bM01Evaluation.findFirst({ where: { outlineCouncilId: parsedId } }),
        ]);

        if (hasDefenseResult || hasOutlineEval) {
            return res.status(400).json({
                success: false,
                code: 'COUNCIL_HAS_EVALUATIONS',
                message: 'Không thể xóa hội đồng đã có lịch sử chấm điểm hoặc đánh giá đề tài.',
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.councilMember.deleteMany({ where: { councilId: parsedId } });
            await tx.council.delete({ where: { id: parsedId } });
        });

        await auditLog(
            req.user.id,
            'DELETE_COUNCIL',
            'Council',
            parsedId,
            { hadRegistrations: totalAssignedStudents },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã xóa hội đồng.' });
    } catch (error) {
        next(error);
    }
};

const previewAutoAssignOutlineCouncils = async (req, res, next) => {
    try {
        const semesterId = parseInt(req.body.semesterId, 10);
        const targetSize = req.body.targetSize !== undefined ? Number(req.body.targetSize) : undefined;
        const result = targetSize !== undefined
            ? await previewAutoOutlineCouncilSetup(semesterId, { targetSize })
            : await previewAutoOutlineCouncilSetup(semesterId);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const autoAssignOutlineCouncils = async (req, res, next) => {
    try {
        const semesterId = parseInt(req.body.semesterId, 10);
        const targetSize = req.body.targetSize !== undefined ? Number(req.body.targetSize) : undefined;
        const sem = await prisma.semester.findUnique({
            where: { id: semesterId },
            select: { id: true, status: true },
        });
        if (sem?.status === 'COMPLETED') {
            return res.status(400).json({
                success: false,
                code: 'SEMESTER_ALREADY_COMPLETED',
                message: 'Đợt đồ án này đã hoàn thành, không thể tự động phân công hội đồng đề cương.',
            });
        }

        const result = await runAutoOutlineCouncilSetupForSemester(semesterId, {
            proposedCouncils: req.body.proposedCouncils,
            targetSize,
            actorId: req.user.id,
            ipAddress: getRequestIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Tự động phân công hội đồng đề cương thành công.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const reopenCouncilResults = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const result = await outlineReviewService.reopenCouncilResults(councilId, reason, req.user.id);

        await auditLog(
            req.user.id,
            'REOPEN_COUNCIL_RESULTS',
            'Council',
            councilId,
            {
                summary: 'Mở khóa kết quả xét duyệt đề cương',
                reason: reason || 'Không có lý do',
            },
            getRequestIp(req),
        );

        res.status(200).json({
            success: true,
            message: 'Đã mở khóa kết quả hội đồng.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const publishCouncilSchedule = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const scheduleData = req.body;
        const result = await outlineReviewService.publishCouncilSchedule(councilId, scheduleData, req.user.id);

        await auditLog(
            req.user.id,
            'PUBLISH_COUNCIL_SCHEDULE',
            'Council',
            councilId,
            {
                summary: 'Công bố lịch họp hội đồng',
                defenseDate: scheduleData?.defenseDate,
                location: scheduleData?.location,
                meetingMode: scheduleData?.meetingMode,
                meetingLink: scheduleData?.meetingLink,
            },
            getRequestIp(req),
        );

        res.status(200).json({
            success: true,
            message: 'Công bố lịch bảo vệ đề cương thành công.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const saveDraftResults = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const registrationId = parseInt(req.params.registrationId, 10);
        const resultData = req.body;
        const result = await outlineReviewService.saveDraftResults(councilId, registrationId, resultData, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Lưu nháp đánh giá thành công.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const completeSecretaryReview = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const result = await outlineReviewService.completeSecretaryReview(councilId, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Thư ký đã hoàn tất đánh giá hội đồng.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const returnResultsToSecretary = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const { returnReason } = req.body;
        const result = await outlineReviewService.returnResultsToSecretary(councilId, returnReason, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Đã trả lại kết quả cho thư ký.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const publishCouncilResults = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const idempotencyKey = req.headers['idempotency-key'] || req.header('Idempotency-Key');
        const result = await outlineReviewService.publishCouncilResults(councilId, req.user.id, idempotencyKey);

        await auditLog(
            req.user.id,
            'PUBLISH_COUNCIL_RESULTS',
            'Council',
            councilId,
            {
                summary: 'Công bố kết quả xét duyệt đề cương',
            },
            getRequestIp(req),
        );

        res.status(200).json({
            success: true,
            message: 'Công bố kết quả hội đồng thành công.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const setRevisionDeadline = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const { revisionDeadline } = req.body;
        const result = await outlineReviewService.setRevisionDeadline(councilId, revisionDeadline, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Đã cập nhật hạn nộp lại đề cương.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const reviewResubmission = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const registrationId = parseInt(req.params.registrationId, 10);
        const { decision, revisionFeedback } = req.body;
        const result = await outlineReviewService.reviewResubmission(
            councilId,
            registrationId,
            decision,
            revisionFeedback,
            req.user.id
        );

        res.status(200).json({
            success: true,
            message: 'Đã xét duyệt đề cương nộp lại.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const finalizeResubmissions = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const result = await outlineReviewService.finalizeOverdueResubmissions(councilId, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Đã chốt danh sách quá hạn.',
            data: result,
        });
    } catch (error) {
        handleOutlineError(error, res, next);
    }
};

const publishDefenseEligibleList = async (req, res, next) => {
    try {
        const semesterIdInt = parseInt(req.params.semesterId, 10);
        if (!Number.isInteger(semesterIdInt) || semesterIdInt <= 0) {
            return res.status(400).json({ success: false, message: 'semesterId không hợp lệ.' });
        }

        const semester = await prisma.semester.findUnique({
            where: { id: semesterIdInt },
            include: {
                lockedDefenseRubricVersion: true,
            },
        });

        if (!semester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy học kỳ.' });
        }

        // Primary Guard: Check if semester has an active locked rubric
        let lockedRubricId = semester.lockedDefenseRubricVersionId;
        if (!lockedRubricId || !semester.lockedDefenseRubricVersion || !semester.lockedDefenseRubricVersion.lockedAt) {
            const activeLockedRubric = await prisma.rubricVersion.findFirst({
                where: {
                    OR: [
                        { id: lockedRubricId || 0 },
                        { isActive: true, lockedAt: { not: null } },
                    ],
                },
            });

            if (!activeLockedRubric || !activeLockedRubric.lockedAt || Math.abs(activeLockedRubric.totalMaxScore - 10.0) > 0.001) {
                return res.status(409).json({
                    success: false,
                    code: 'RUBRIC_NOT_LOCKED',
                    message: 'Không thể công bố danh sách bảo vệ khi học kỳ chưa có barem chấm (Rubric) được khóa với tổng điểm 10.0.',
                });
            }
            lockedRubricId = activeLockedRubric.id;
        }

        const eligibleRegistrations = await prisma.topicRegistration.findMany({
            where: {
                semesterId: semesterIdInt,
                OR: [
                    { status: 'DEFENSE_READY' },
                    { status: 'DEFENSE_ELIGIBLE' },
                    { status: 'ELIGIBLE_BY_INSTITUTE' },
                    {
                        bm04Evaluation: {
                            isLocked: true,
                            conclusion: 'AGREED_FOR_DEFENSE',
                        },
                    },
                ],
            },
            include: {
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
            },
        });

        const now = new Date();
        const updatedSemester = await prisma.semester.update({
            where: { id: semesterIdInt },
            data: {
                lockedDefenseRubricVersionId: lockedRubricId,
                defenseEligibleListPublishedAt: now,
                defenseEligibleListPublishedById: req.user.id,
            },
        });

        await auditLog(
            req.user.id,
            'PUBLISH_DEFENSE_ELIGIBLE_LIST',
            'Semester',
            semesterIdInt,
            {
                summary: `Công bố danh sách ${eligibleRegistrations.length} sinh viên đủ điều kiện ra bảo vệ`,
                eligibleCount: eligibleRegistrations.length,
                lockedRubricVersionId: lockedRubricId,
                publishedAt: now,
            },
            getRequestIp(req),
        );

        const eligibleStudentIds = eligibleRegistrations
            .map((r) => r.studentId || r.student?.id)
            .filter(Boolean);

        if (eligibleStudentIds.length > 0) {
            await safeNotifyMany(
                eligibleStudentIds.map((userId) => ({
                    userId,
                    title: 'Đủ điều kiện bảo vệ khóa luận tốt nghiệp',
                    content: 'Chúc mừng! Bạn đã đủ điều kiện ra bảo vệ khóa luận tốt nghiệp đợt này. Vui lòng kiểm tra và chuẩn bị 4 thành phần tài liệu bảo vệ.',
                    type: 'DEFENSE',
                })),
                'publishDefenseEligibleList'
            );
        }

        return res.json({
            success: true,
            message: `Đã công bố danh sách ${eligibleRegistrations.length} sinh viên đủ điều kiện ra bảo vệ.`,
            data: {
                semester: updatedSemester,
                eligibleCount: eligibleRegistrations.length,
                lockedRubricVersionId: lockedRubricId,
            },
        });
    } catch (error) {
        next(error);
    }
};

const confirmAndPublishDefenseSchedule = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const { orderedRegistrationIds } = req.body;

        const council = await prisma.council.findUnique({
            where: { id: councilId },
            include: {
                semester: {
                    include: {
                        lockedDefenseRubricVersion: true,
                    },
                },
                registrations: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true } },
                        topic: { select: { title: true } },
                    },
                },
                defenseRegistrations: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true } },
                        topic: { select: { title: true } },
                    },
                },
                members: true,
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        // 1. Guard bất biến: Không cho phép công bố lại hoặc thay đổi ngầm sau khi đã công bố
        if (council.schedulePublishedAt) {
            return res.status(409).json({
                success: false,
                code: 'SCHEDULE_ALREADY_PUBLISHED',
                message: 'Lịch bảo vệ của hội đồng đã được công bố chính thức và không thể thay đổi ngầm.',
            });
        }

        // 2. Secondary Guard: Semester must have locked rubric and published eligible list
        const semester = council.semester;
        const hasLockedRubric = Boolean(
            semester?.lockedDefenseRubricVersionId ||
            (semester?.lockedDefenseRubricVersion && semester.lockedDefenseRubricVersion.lockedAt)
        );
        if (!hasLockedRubric) {
            return res.status(409).json({
                success: false,
                code: 'RUBRIC_NOT_LOCKED',
                message: 'Barem chấm bảo vệ (Rubric) của học kỳ chưa được khóa. Không thể công bố lịch bảo vệ.',
            });
        }

        if (!semester?.defenseEligibleListPublishedAt) {
            return res.status(409).json({
                success: false,
                code: 'ELIGIBLE_LIST_NOT_PUBLISHED',
                message: 'Danh sách sinh viên đủ điều kiện bảo vệ của học kỳ chưa được công bố.',
            });
        }

        // 3. Guard: Hội đồng phải đã được xác nhận phân công (assignmentConfirmedAt không null)
        if (!council.assignmentConfirmedAt) {
            return res.status(409).json({
                success: false,
                code: 'ASSIGNMENT_NOT_CONFIRMED',
                message: 'Hội đồng chưa được xác nhận phân công bảo vệ. Vui lòng xác nhận phân công trước khi công bố lịch.',
            });
        }

        // 4. Guard: Đã có đầy đủ phòng và ngày bảo vệ
        if (!council.location || !council.defenseDate) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_DATE_OR_ROOM',
                message: 'Hội đồng chưa có ngày bảo vệ hoặc phòng bảo vệ hợp lệ.',
            });
        }

        // 5. Guard: Danh sách sinh viên và thứ tự sắp xếp hợp lệ
        const assignedRegistrations = (council.defenseRegistrations?.length ? council.defenseRegistrations : council.registrations) || [];
        if (assignedRegistrations.length === 0) {
            return res.status(400).json({
                success: false,
                code: 'NO_STUDENTS_ASSIGNED',
                message: 'Hội đồng chưa có sinh viên nào được phân công.',
            });
        }

        let regIdsToOrder = orderedRegistrationIds;
        if (Array.isArray(regIdsToOrder) && regIdsToOrder.length > 0) {
            const assignedIds = new Set(assignedRegistrations.map((r) => r.id));
            const inputIds = new Set(regIdsToOrder.map(Number));
            if (inputIds.size !== assignedIds.size || [...inputIds].some((id) => !assignedIds.has(id))) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_ORDERED_REGISTRATION_IDS',
                    message: 'Danh sách thứ tự sinh viên phải khớp chính xác với danh sách sinh viên của hội đồng.',
                });
            }
        } else {
            regIdsToOrder = assignedRegistrations.map((r) => r.id);
        }

        const shiftSplits = splitConfirmedStudentsIntoShifts(regIdsToOrder);
        const now = new Date();

        await prisma.$transaction(async (tx) => {
            for (const item of shiftSplits) {
                await tx.topicRegistration.update({
                    where: { id: item.registrationId },
                    data: {
                        defenseSequenceNo: item.defenseSequenceNo,
                        defenseSessionShift: item.defenseSessionShift,
                        defenseOrderInShift: item.defenseOrderInShift,
                        defenseSchedulePublishedAt: now,
                    },
                });
            }

            await tx.council.update({
                where: { id: councilId },
                data: {
                    scheduleConfirmedAt: now,
                    scheduleConfirmedById: req.user.id,
                    schedulePublishedAt: now,
                    schedulePublishedById: req.user.id,
                },
            });
        });

        const studentUserIds = assignedRegistrations.map((r) => r.studentId).filter(Boolean);
        if (studentUserIds.length > 0) {
            await safeNotifyMany(
                studentUserIds.map((userId) => ({
                    userId,
                    title: 'Lịch bảo vệ chính thức đã được công bố',
                    content: `Lịch bảo vệ khóa luận cho hội đồng ${council.name} đã được công bố chính thức. Vui lòng kiểm tra ca bảo vệ và thứ tự của bạn.`,
                    type: 'DEFENSE_SCHEDULE_PUBLISHED',
                })),
                'confirmAndPublishDefenseSchedule:students'
            );
        }

        const memberUserIds = (council.members || [])
            .filter((m) => m.isActive !== false)
            .map((m) => m.userId || m.lecturerId)
            .filter(Boolean);
        if (memberUserIds.length > 0) {
            await safeNotifyMany(
                memberUserIds.map((userId) => ({
                    userId,
                    title: `Lịch bảo vệ chính thức - Hội đồng ${council.name}`,
                    content: `Lịch bảo vệ khóa luận cho hội đồng ${council.name} đã được công bố chính thức. Phiên bảo vệ gồm ${shiftSplits.length} sinh viên chia ca Sáng/Chiều.`,
                    type: 'DEFENSE_SCHEDULE_PUBLISHED',
                })),
                'confirmAndPublishDefenseSchedule:members'
            );
        }

        await auditLog(
            req.user.id,
            'CONFIRM_AND_PUBLISH_DEFENSE_SCHEDULE',
            'Council',
            councilId,
            {
                summary: `Xác nhận và công bố lịch bảo vệ cho hội đồng ${council.name} (${shiftSplits.length} sinh viên)`,
                councilId,
                totalStudents: shiftSplits.length,
                schedule: shiftSplits,
                publishedAt: now,
            },
            getRequestIp(req),
        );

        const updated = await prisma.council.findUnique({
            where: { id: councilId },
            include: {
                registrations: {
                    include: {
                        student: { select: { fullName: true, code: true } },
                        topic: { select: { title: true } },
                    },
                    orderBy: [{ defenseSessionShift: 'asc' }, { defenseOrderInShift: 'asc' }],
                },
            },
        });

        return res.json({
            success: true,
            message: `Đã công bố lịch bảo vệ thành công cho ${shiftSplits.length} sinh viên.`,
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

const adjustStudentDefenseSchedule = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const registrationId = parseInt(req.params.registrationId, 10);
        const { newShift, newOrderInShift, reason } = req.body;

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Lý do điều chỉnh lịch (reason) bắt buộc phải được cung cấp và không được để trống.',
            });
        }

        if (!['MORNING', 'AFTERNOON'].includes(newShift)) {
            return res.status(400).json({
                success: false,
                message: 'Ca bảo vệ mới (newShift) phải là MORNING hoặc AFTERNOON.',
            });
        }

        const newOrder = parseInt(newOrderInShift, 10);
        if (!Number.isInteger(newOrder) || newOrder <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Thứ tự trong ca (newOrderInShift) phải là số nguyên dương.',
            });
        }

        const council = await prisma.council.findUnique({
            where: { id: councilId },
            include: {
                members: {
                    where: { isActive: true },
                    select: { id: true, lecturerId: true, userId: true, isActive: true },
                },
            },
        });
        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        const reg = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
            },
        });
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký.' });
        }

        const oldShift = reg.defenseSessionShift;
        const oldOrderInShift = reg.defenseOrderInShift;
        const cleanReason = String(reason).trim();

        const updated = await prisma.$transaction(async (tx) => {
            const updatedReg = await tx.topicRegistration.update({
                where: { id: registrationId },
                data: {
                    defenseSessionShift: newShift,
                    defenseOrderInShift: newOrder,
                },
            });

            await tx.defenseScheduleAdjustmentLog.create({
                data: {
                    registrationId,
                    councilId,
                    oldShift: oldShift || null,
                    newShift,
                    oldOrderInShift: oldOrderInShift || null,
                    newOrderInShift: newOrder,
                    reason: cleanReason,
                    adjustedById: req.user.id,
                },
            });

            return updatedReg;
        });

        if (reg.studentId) {
            await prisma.notification.create({
                data: {
                    userId: reg.studentId,
                    title: 'Lịch bảo vệ của bạn đã được điều chỉnh',
                    content: `Lịch bảo vệ của bạn đã được chuyển sang ca ${newShift === 'MORNING' ? 'Sáng' : 'Chiều'}, STT: ${newOrder}. Lý do: ${cleanReason}`,
                    type: 'DEFENSE_SCHEDULE_ADJUSTED',
                },
            });
        }

        const memberUserIds = (council.members || [])
            .filter((m) => m.isActive !== false)
            .map((m) => m.userId || m.lecturerId)
            .filter(Boolean);

        if (memberUserIds.length > 0) {
            await safeNotifyMany(
                memberUserIds.map((userId) => ({
                    userId,
                    title: `Điều chỉnh ca bảo vệ - Hội đồng ${council.name || councilId}`,
                    content: `Ca bảo vệ của sinh viên ${reg.student?.fullName || 'N/A'} (${reg.student?.code || ''}) đã được điều chỉnh sang ca ${newShift === 'MORNING' ? 'Sáng' : 'Chiều'} (STT: ${newOrder}). Lý do: ${cleanReason}`,
                    type: 'DEFENSE_SCHEDULE_ADJUSTED',
                })),
                'adjustStudentDefenseSchedule:members'
            );
        }

        await auditLog(
            req.user.id,
            'ADJUST_DEFENSE_SCHEDULE',
            'TopicRegistration',
            registrationId,
            {
                summary: `Điều chỉnh ca bảo vệ cho sinh viên ${reg.student?.fullName || ''} (${oldShift || 'N/A'} -> ${newShift})`,
                councilId,
                registrationId,
                oldShift,
                newShift,
                oldOrderInShift,
                newOrderInShift: newOrder,
                reason: cleanReason,
            },
            getRequestIp(req),
        );

        return res.json({
            success: true,
            message: 'Điều chỉnh lịch bảo vệ sinh viên thành công.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

const replaceDefenseCouncilMember = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        const { oldMemberId, newLecturerId, reason, confirmLockedSheetOverride } = req.body;

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Lý do thay thế thành viên (reason) bắt buộc phải được cung cấp.',
            });
        }

        const newLecId = parseInt(newLecturerId, 10);
        if (!Number.isInteger(newLecId) || newLecId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'newLecturerId phải là số nguyên dương.',
            });
        }

        const council = await prisma.council.findUnique({
            where: { id: councilId },
            include: {
                members: {
                    where: { isActive: true },
                    include: { lecturer: { select: { id: true, fullName: true } } },
                },
                registrations: {
                    include: { topic: { select: { mentorId: true } } },
                },
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        if (council.scoreBookLocked) {
            return res.status(400).json({
                success: false,
                message: 'Hội đồng đã khóa sổ điểm. Không thể thay thế thành viên chấm.',
            });
        }

        const oldMemberIdParsed = parseInt(oldMemberId, 10);
        const oldMember = council.members.find((m) => m.id === oldMemberIdParsed || m.lecturerId === oldMemberIdParsed);
        if (!oldMember) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thành viên hội đồng cần thay thế hoặc thành viên không còn hoạt động.',
            });
        }

        const registrationsInCouncil = await prisma.topicRegistration.findMany({
            where: {
                OR: [{ defenseCouncilId: councilId }, { councilId: councilId }],
            },
            include: {
                topic: { select: { mentorId: true, title: true } },
                student: { select: { fullName: true } },
            },
        });

        const conflict = registrationsInCouncil.find((r) => r.topic?.mentorId === newLecId);
        if (conflict) {
            return res.status(400).json({
                success: false,
                message: `Conflict of interest: Giảng viên mới đang là giảng viên hướng dẫn của đề tài "${conflict.topic?.title || ''}".`,
            });
        }

        if (council.members.some((m) => m.lecturerId === newLecId && m.id !== oldMember.id)) {
            return res.status(400).json({
                success: false,
                message: 'Giảng viên này đã là thành viên trong hội đồng.',
            });
        }

        const lockedScores = await prisma.defenseMemberScore.findMany({
            where: {
                evaluatorId: oldMember.lecturerId,
                scoreLocked: true,
                isEffective: true,
            },
        });

        if (lockedScores.length > 0 && confirmLockedSheetOverride !== true) {
            return res.status(409).json({
                success: false,
                code: 'LOCKED_SHEET_OVERRIDE_CONFIRMATION_REQUIRED',
                message: 'Thành viên này đã có phiếu chấm điểm được khóa. Bạn phải xác nhận ghi đè (confirmLockedSheetOverride: true) để thay thế.',
            });
        }

        const cleanReason = String(reason).trim();
        const now = new Date();

        const result = await prisma.$transaction(async (tx) => {
            await tx.defenseMemberScore.updateMany({
                where: {
                    evaluatorId: oldMember.lecturerId,
                    isEffective: true,
                },
                data: {
                    isEffective: false,
                    supersededReason: cleanReason,
                },
            });

            const updatedOldMember = await tx.councilMember.update({
                where: { id: oldMember.id },
                data: {
                    isActive: false,
                    replacementReason: cleanReason,
                    replacedAt: now,
                },
            });

            const newMember = await tx.councilMember.create({
                data: {
                    councilId,
                    lecturerId: newLecId,
                    roleInCouncil: oldMember.roleInCouncil,
                    isScoringMember: true,
                    isActive: true,
                    assignedById: req.user.id,
                },
                include: {
                    lecturer: { select: { id: true, fullName: true, email: true, code: true } },
                },
            });

            await tx.councilMember.update({
                where: { id: oldMember.id },
                data: { replacedByMemberId: newMember.id },
            });

            return { replacedMember: updatedOldMember, newMember };
        });

        await auditLog(
            req.user.id,
            'REPLACE_COUNCIL_MEMBER',
            'Council',
            councilId,
            {
                summary: `Thay thế thành viên ${oldMember.roleInCouncil} trong hội đồng ${council.name}`,
                oldMemberId: oldMember.id,
                oldLecturerId: oldMember.lecturerId,
                newLecturerId: newLecId,
                role: oldMember.roleInCouncil,
                reason: cleanReason,
            },
            getRequestIp(req),
        );

        return res.json({
            success: true,
            message: 'Thay thế thành viên hội đồng thành công.',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/councils/:id/schedule-adjustments
 * Lấy danh sách lịch sử điều chỉnh ca/thứ tự bảo vệ của hội đồng
 */
const getScheduleAdjustments = async (req, res, next) => {
    try {
        const councilId = Number(req.params.id);
        if (!Number.isInteger(councilId) || councilId <= 0) {
            return res.status(400).json({ success: false, message: 'councilId không hợp lệ.' });
        }

        const council = await prisma.council.findUnique({
            where: { id: councilId },
            include: {
                members: { select: { lecturerId: true } },
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        const userId = req.user?.userId || req.user?.id;
        const isMember = council.members?.some((m) => m.lecturerId === userId);
        const userPerms = req.user?.permissions || [];
        const hasPermission = req.user?.role === 'ADMIN'
            || isMember
            || userPerms.includes('VIEW_COUNCIL_ASSIGNMENTS')
            || userPerms.includes('VIEW_DEFENSE_ASSIGNMENTS')
            || userPerms.includes('DEFENSE_COUNCIL_MANAGE');

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem nhật ký điều chỉnh lịch của hội đồng này.',
            });
        }

        const adjustments = await prisma.defenseScheduleAdjustmentLog.findMany({
            where: { councilId },
            orderBy: { createdAt: 'desc' },
            include: {
                adjustedBy: { select: { id: true, fullName: true, role: true } },
                registration: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true } },
                        topic: { select: { title: true } },
                    },
                },
            },
        });

        const formattedAdjustments = adjustments.map((adj) => ({
            ...adj,
            registration: adj.registration ? {
                ...adj.registration,
                student: adj.registration.student ? {
                    ...adj.registration.student,
                    studentCode: adj.registration.student.studentCode || adj.registration.student.code,
                } : null,
            } : null,
        }));

        return res.json({ success: true, data: formattedAdjustments });
    } catch (error) {
        next(error);
    }
};

const getDefenseAssignmentPreview = async (req, res, next) => {
    try {
        const { semesterId, date, rooms, targetSize, orderedRegistrationIds } = req.body;
        const result = await buildDefenseCouncilPlan(
            { semesterId, date, rooms, targetSize, orderedRegistrationIds },
            { db: prisma }
        );
        return res.status(200).json({
            success: result.status === 'FEASIBLE',
            ...result,
        });
    } catch (error) {
        next(error);
    }
};

const confirmDefenseAssignmentPlan = async (req, res, next) => {
    try {
        const { semesterId, fingerprint, councils, date, rooms, targetSize, orderedRegistrationIds } = req.body;
        const result = await confirmDefenseCouncilPlan(
            { semesterId, fingerprint, councils, date, rooms, targetSize, orderedRegistrationIds },
            { db: prisma, actorId: req.user.id }
        );
        return res.status(200).json(result);
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                code: error.code || 'CONFIRM_ERROR',
                message: error.message,
            });
        }
        next(error);
    }
};

module.exports = {
    splitConfirmedStudentsIntoShifts,
    getDefenseAssignmentPreview,
    confirmDefenseAssignmentPlan,
    getAllCouncils,
    getCouncilById,
    getCouncilAuditLogs,
    createCouncil,
    updateCouncil,
    assignRegistrationsToCouncil,
    autoAssignRegistrationsToCouncils,
    removeRegistrationFromCouncil,
    deleteCouncil,
    previewAutoAssignOutlineCouncils,
    autoAssignOutlineCouncils,
    reopenCouncilResults,
    publishCouncilSchedule,
    saveDraftResults,
    completeSecretaryReview,
    returnResultsToSecretary,
    publishCouncilResults,
    setRevisionDeadline,
    reviewResubmission,
    finalizeResubmissions,
    publishDefenseEligibleList,
    confirmAndPublishDefenseSchedule,
    adjustStudentDefenseSchedule,
    replaceDefenseCouncilMember,
    getScheduleAdjustments,
};

