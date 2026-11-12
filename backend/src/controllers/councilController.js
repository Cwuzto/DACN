const prisma = require('../config/database');
const {
    MAX_STUDENTS_PER_COUNCIL,
    MAX_STUDENTS_PER_OUTLINE_COUNCIL,
    MAX_STUDENTS_PER_DEFENSE_COUNCIL,
} = require('../constants/councilLimits');
const { auditLog } = require('../services/auditLogService');
const { runAutoCouncilSetupForSemester } = require('../services/councilAutoSetupService');
const outlineReviewService = require('../services/outlineReviewService');
const {
    runAutoOutlineCouncilSetupForSemester,
    previewAutoOutlineCouncilSetup,
} = require('../services/outlineAutoSetupService');
const { resolveEffectiveTopicTitle } = require('../services/topicTitleResolverService');

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

const getAllCouncils = async (req, res, next) => {
    try {
        const { semesterId, councilType } = req.query;
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

        if (where.councilType && !allowedCouncilTypes.includes(where.councilType)) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem loại hội đồng này.' });
        }
        if (!where.councilType) where.councilType = { in: allowedCouncilTypes };

        const councils = await prisma.council.findMany({
            where,
            include: {
                semester: { select: { name: true } },
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
            },
            orderBy: { id: 'desc' },
        });

        const normalizedCouncils = councils.map((c) => {
            const studentCount = c.councilType === 'OUTLINE_REVIEW'
                ? (c._count.outlineRegistrations || 0)
                : (c._count.defenseRegistrations || c._count.registrations || 0);
            const myMember = c.members?.find((m) => m.lecturerId === req.user.id);
            return {
                ...c,
                myRole: myMember?.roleInCouncil || null,
                _count: {
                    ...c._count,
                    registrations: studentCount,
                },
            };
        });

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

        const enrichedRegistrations = await Promise.all((effectiveRegistrations || []).map(async (reg) => {
            try {
                const resolved = await resolveEffectiveTopicTitle(reg.id);
                return {
                    ...reg,
                    effectiveTitle: resolved?.title || reg.topic?.title || 'Chưa có tên đề tài',
                };
            } catch {
                return {
                    ...reg,
                    effectiveTitle: reg.topic?.title || 'Chưa có tên đề tài',
                };
            }
        }));

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
                    members: { select: { lecturerId: true, roleInCouncil: true } },
                    _count: { select: { registrations: true, outlineRegistrations: true, defenseRegistrations: true } },
                },
            });

            if (!council) {
                throw createHttpError(404, 'Không tìm thấy hội đồng.');
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
                    student: { select: { fullName: true, code: true } },
                    topic: { select: { title: true, mentorId: true } },
                    bm04Evaluation: true,
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
                const allowedStatuses = ['DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE'];
                for (const reg of registrations) {
                    const isStatusAllowed = allowedStatuses.includes(reg.status)
                        || allowedStatuses.includes(reg.bm04Evaluation?.status);
                    const isEligible = isStatusAllowed
                        && (
                            (
                                (reg.bm04Evaluation?.conclusion === 'AGREED_FOR_DEFENSE'
                                    || reg.bm04Evaluation?.defenseRecommendation === 'APPROVE_FOR_DEFENSE'
                                    || reg.bm04Evaluation?.status === 'SIGNED_APPROVED')
                                && reg.bm04Evaluation?.isLocked === true
                            )
                            || reg.bm04Evaluation?.status === 'ELIGIBLE_BY_INSTITUTE'
                            || reg.status === 'ELIGIBLE_BY_INSTITUTE'
                            || reg.status === 'DEFENSE_ELIGIBLE'
                        );
                    if (!isEligible) {
                        throw createHttpError(
                            400,
                            `Sinh viên ${reg.student.fullName} (${reg.student.code}) chưa có kết luận ĐỒNG Ý cho ra bảo vệ tại biểu mẫu BM04 nên chưa đủ điều kiện xếp Hội đồng bảo vệ.`,
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
        const semesterId = parseInt(req.body?.semesterId || req.query?.semesterId, 10);
        if (!Number.isInteger(semesterId) || semesterId <= 0) {
            return res.status(400).json({ success: false, message: 'semesterId khong hop le.' });
        }

        const result = await runAutoCouncilSetupForSemester(semesterId);

        await auditLog(
            req.user.id,
            'AUTO_ASSIGN_COUNCIL',
            'Council',
            null,
            {
                semesterId: result.semesterId,
                totalUnassigned: result.totalUnassigned,
                assigned: result.assigned,
                skipped: result.skipped.length,
                createdCouncils: result.createdCouncils,
                updatedCouncils: result.updatedCouncils,
            },
            getRequestIp(req),
        );

        return res.json({
            success: true,
            message: `Da tu dong phan cong ${result.assigned}/${result.totalUnassigned} sinh vien.`,
            data: result,
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
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
            select: { id: true, councilType: true },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        const targetReg = await prisma.topicRegistration.findUnique({
            where: { id: registrationIdInt },
            select: {
                id: true,
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
            },
        });

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

        if (result.count > 0) {
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
                _count: {
                    select: {
                        registrations: true,
                        outlineRegistrations: true,
                        defenseRegistrations: true,
                    },
                },
            },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        const totalAssignedStudents = (existing._count?.registrations || 0)
            + (existing._count?.outlineRegistrations || 0)
            + (existing._count?.defenseRegistrations || 0);

        if (totalAssignedStudents > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa hội đồng đã có sinh viên được phân công.',
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
        const result = await previewAutoOutlineCouncilSetup(semesterId);

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
        const result = await runAutoOutlineCouncilSetupForSemester(semesterId, {
            proposedCouncils: req.body.proposedCouncils,
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
                members: true,
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        // Secondary Guard: Semester must have locked rubric and published eligible list
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

        let regIdsToOrder = orderedRegistrationIds;
        if (!Array.isArray(regIdsToOrder) || regIdsToOrder.length === 0) {
            regIdsToOrder = council.registrations.map((r) => r.id);
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

        const studentUserIds = council.registrations.map((r) => r.studentId).filter(Boolean);
        if (studentUserIds.length > 0) {
            await prisma.notification.createMany({
                data: studentUserIds.map((userId) => ({
                    userId,
                    title: 'Lịch bảo vệ chính thức đã được công bố',
                    content: `Lịch bảo vệ khóa luận cho hội đồng ${council.name} đã được công bố chính thức. Vui lòng kiểm tra ca bảo vệ và thứ tự của bạn.`,
                    type: 'DEFENSE_SCHEDULE_PUBLISHED',
                })),
            });
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

module.exports = {
    splitConfirmedStudentsIntoShifts,
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

