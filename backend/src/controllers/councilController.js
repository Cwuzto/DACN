const prisma = require('../config/database');
const { MAX_STUDENTS_PER_COUNCIL } = require('../constants/councilLimits');
const { auditLog } = require('../services/auditLogService');
const { runAutoCouncilSetupForSemester } = require('../services/councilAutoSetupService');

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
const validateCouncilComposition = (members = []) => {
    if (!Array.isArray(members) || members.length !== 3) {
        throw createHttpError(400, 'Mỗi hội đồng phải có đúng 3 giảng viên.');
    }

    const roleSet = new Set(members.map((member) => member.roleInCouncil));
    const expectedRoles = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];
    for (const role of expectedRoles) {
        if (!roleSet.has(role)) {
            throw createHttpError(400, 'Hội đồng phải đủ 3 vai trò: CHAIRMAN, SECRETARY, REVIEWER.');
        }
    }

    if (roleSet.size !== 3) {
        throw createHttpError(400, 'Mỗi vai trò chỉ được có 1 giảng viên.');
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
        where: { councilId },
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

        const councils = await prisma.council.findMany({
            where,
            include: {
                semester: { select: { name: true } },
                members: {
                    include: {
                        lecturer: { select: { id: true, fullName: true, avatarUrl: true, code: true } },
                    },
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
            return {
                ...c,
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
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        const effectiveRegistrations = council.councilType === 'OUTLINE_REVIEW'
            ? council.outlineRegistrations
            : (council.defenseRegistrations?.length > 0 ? council.defenseRegistrations : council.registrations);

        res.json({
            success: true,
            data: {
                ...council,
                registrations: effectiveRegistrations,
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
        const { semesterId, name, councilType, location, defenseDate, members } = req.body;

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
            validateCouncilComposition(normalizedMembers);
        }

        const validCouncilTypes = ['OUTLINE_REVIEW', 'DEFENSE_COUNCIL'];
        const councilTypeValue = councilType && validCouncilTypes.includes(councilType) ? councilType : 'DEFENSE_COUNCIL';

        const result = await prisma.$transaction(async (tx) => {
            const newCouncil = await tx.council.create({
                data: {
                    semesterId: semesterIdInt,
                    name,
                    councilType: councilTypeValue,
                    location,
                    defenseDate: defenseDateValue,
                },
            });

            if (normalizedMembers.length) {
                await tx.councilMember.createMany({
                    data: normalizedMembers.map((member) => ({
                        councilId: newCouncil.id,
                        lecturerId: member.lecturerId,
                        roleInCouncil: member.roleInCouncil,
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
            { semesterId: semesterIdInt, memberCount: normalizedMembers.length },
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
        const { name, councilType, location, defenseDate, members } = req.body;

        const existing = await prisma.council.findUnique({ where: { id: councilId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        const defenseDateValue = defenseDate !== undefined
            ? (defenseDate ? new Date(defenseDate) : null)
            : existing.defenseDate;

        const result = await prisma.$transaction(async (tx) => {
            await tx.council.update({
                where: { id: councilId },
                data: {
                    name,
                    ...(councilType !== undefined && { councilType }),
                    location,
                    defenseDate: defenseDateValue,
                },
            });

            let lecturerIdsForWarning = [];

            if (members !== undefined) {
                const normalizedMembers = normalizeMemberInput(members);
                validateCouncilComposition(normalizedMembers);
                lecturerIdsForWarning = normalizedMembers.map((member) => member.lecturerId);

                await validateCouncilMembersAgainstAssignedStudents(tx, councilId, lecturerIdsForWarning);

                await tx.councilMember.deleteMany({ where: { councilId } });
                if (normalizedMembers.length > 0) {
                    await tx.councilMember.createMany({
                        data: normalizedMembers.map((member) => ({
                            councilId,
                            lecturerId: member.lecturerId,
                            roleInCouncil: member.roleInCouncil,
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
            { hasMembersPayload: members !== undefined },
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

        await prisma.$transaction(async (tx) => {
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

            validateCouncilComposition(council.members);

            const currentStudentCount = council.councilType === 'OUTLINE_REVIEW'
                ? (council._count.outlineRegistrations || 0)
                : (council._count.defenseRegistrations || council._count.registrations || 0);

            if (currentStudentCount + uniqueRegistrationIds.length > MAX_STUDENTS_PER_COUNCIL) {
                throw createHttpError(400, `Hội đồng tối đa ${MAX_STUDENTS_PER_COUNCIL} sinh viên.`);
            }

            const registrations = await tx.topicRegistration.findMany({
                where: { id: { in: uniqueRegistrationIds } },
                include: {
                    student: { select: { fullName: true, code: true } },
                    topic: { select: { title: true, mentorId: true } },
                },
            });

            if (registrations.length !== uniqueRegistrationIds.length) {
                throw createHttpError(400, 'Có đăng ký không tồn tại.');
            }

            let alreadyAssigned;
            if (council.councilType === 'OUTLINE_REVIEW') {
                alreadyAssigned = registrations.find((registration) => Boolean(registration.outlineCouncilId));
            } else {
                alreadyAssigned = registrations.find((registration) => Boolean(registration.defenseCouncilId));
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
                const bm04Tasks = await tx.task.findMany({
                    where: {
                        registrationId: { in: uniqueRegistrationIds },
                        taskType: 'BM04',
                    },
                    select: { registrationId: true, status: true },
                });
                const bm04ByReg = new Map(bm04Tasks.map((t) => [t.registrationId, t.status]));
                for (const reg of registrations) {
                    const bm04Status = bm04ByReg.get(reg.id);
                    if (!bm04Status || bm04Status !== 'COMPLETED') {
                        throw createHttpError(
                            400,
                            `Sinh viên ${reg.student.fullName} (${reg.student.code}) chưa hoàn thành biểu mẫu BM04 nên chưa đủ điều kiện bảo vệ hội đồng.`,
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
        });

        await auditLog(
            req.user.id,
            'ASSIGN_COUNCIL',
            'Council',
            councilId,
            { registrationIds: uniqueRegistrationIds },
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
                { registrationId: registrationIdInt },
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
            include: { _count: { select: { registrations: true } } },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        if (existing._count.registrations > 0) {
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
            { hadRegistrations: existing._count.registrations },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã xóa hội đồng.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllCouncils,
    getCouncilById,
    getCouncilAuditLogs,
    createCouncil,
    updateCouncil,
    assignRegistrationsToCouncil,
    autoAssignRegistrationsToCouncils,
    removeRegistrationFromCouncil,
    deleteCouncil,
};

