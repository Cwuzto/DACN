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
        throw createHttpError(400, 'LecturerId trong members khĂ´ng há»£p lá»‡.');
    }

    const seen = new Set();
    for (const member of normalized) {
        if (seen.has(member.lecturerId)) {
            throw createHttpError(400, 'Danh sĂ¡ch members Ä‘ang cĂ³ giáº£ng viĂªn bá»‹ trĂ¹ng láº·p.');
        }
        seen.add(member.lecturerId);
    }

    return normalized;
};
const validateCouncilComposition = (members = []) => {
    if (!Array.isArray(members) || members.length !== 3) {
        throw createHttpError(400, 'Má»—i há»™i Ä‘á»“ng pháº£i cĂ³ Ä‘Ăºng 3 giáº£ng viĂªn.');
    }

    const roleSet = new Set(members.map((member) => member.roleInCouncil));
    const expectedRoles = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];
    for (const role of expectedRoles) {
        if (!roleSet.has(role)) {
            throw createHttpError(400, 'Há»™i Ä‘á»“ng pháº£i Ä‘á»§ 3 vai trĂ²: CHAIRMAN, SECRETARY, REVIEWER.');
        }
    }

    if (roleSet.size !== 3) {
        throw createHttpError(400, 'Má»—i vai trĂ² chá»‰ Ä‘Æ°á»£c cĂ³ 1 giáº£ng viĂªn.');
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
        `Cáº£nh bĂ¡o: Giáº£ng viĂªn ${member.lecturer.fullName} Ä‘Ă£ tham gia há»™i Ä‘á»“ng #${member.council.id} (${member.council.name}) cĂ¹ng defenseDate.`
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
            `Conflict of interest: Giáº£ng viĂªn hÆ°á»›ng dáº«n khĂ´ng Ä‘Æ°á»£c cháº¥m sinh viĂªn ${conflict.student.fullName} (${conflict.student.code}) vá»›i Ä‘á» tĂ i "${conflict.topic.title}".`,
        );
    }
};

const getAllCouncils = async (req, res, next) => {
    try {
        const { semesterId } = req.query;
        const where = {};
        if (semesterId) where.semesterId = parseInt(semesterId, 10);

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
                    select: { registrations: true },
                },
            },
            orderBy: { id: 'desc' },
        });

        res.json({ success: true, data: councils });
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
                        topic: { select: { title: true } },
                        student: { select: { fullName: true, code: true } },
                    },
                },
            },
        });

        if (!council) {
            return res.status(404).json({ success: false, message: 'KhĂ´ng tĂ¬m tháº¥y há»™i Ä‘á»“ng.' });
        }

        res.json({ success: true, data: council });
    } catch (error) {
        next(error);
    }
};

const getCouncilAuditLogs = async (req, res, next) => {
    try {
        const councilId = parseInt(req.params.id, 10);
        if (!Number.isInteger(councilId) || councilId <= 0) {
            return res.status(400).json({ success: false, message: 'councilId khong hop le.' });
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
        const allowManualCreate = process.env.ALLOW_MANUAL_COUNCIL_CREATE === 'true';
        if (!allowManualCreate) {
            return res.status(403).json({
                success: false,
                message: 'Manual council creation is disabled. Use auto assignment flow.',
            });
        }

        const { semesterId, name, location, defenseDate, members } = req.body;

        if (!semesterId || !name) {
            return res.status(400).json({
                success: false,
                message: 'Vui lĂ²ng cung cáº¥p há»c ká»³ vĂ  tĂªn há»™i Ä‘á»“ng.',
            });
        }

        const semesterIdInt = parseInt(semesterId, 10);
        const defenseDateValue = defenseDate ? new Date(defenseDate) : null;
        const normalizedMembers = normalizeMemberInput(members || []);
        if (normalizedMembers.length) {
            validateCouncilComposition(normalizedMembers);
        }

        const result = await prisma.$transaction(async (tx) => {
            const newCouncil = await tx.council.create({
                data: {
                    semesterId: semesterIdInt,
                    name,
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
            message: 'Táº¡o há»™i Ä‘á»“ng thĂ nh cĂ´ng',
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
        const { name, location, defenseDate, members } = req.body;

        const existing = await prisma.council.findUnique({ where: { id: councilId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'KhĂ´ng tĂ¬m tháº¥y há»™i Ä‘á»“ng.' });
        }

        const defenseDateValue = defenseDate !== undefined
            ? (defenseDate ? new Date(defenseDate) : null)
            : existing.defenseDate;

        const result = await prisma.$transaction(async (tx) => {
            await tx.council.update({
                where: { id: councilId },
                data: {
                    name,
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
            message: 'Cáº­p nháº­t há»™i Ä‘á»“ng thĂ nh cĂ´ng.',
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
                message: 'Danh sĂ¡ch Ä‘Äƒng kĂ½ (registrationIds) khĂ´ng há»£p lá»‡.',
            });
        }

        const councilId = parseInt(id, 10);
        const uniqueRegistrationIds = [...new Set(
            registrationIds.map((value) => parseInt(value, 10)).filter((value) => Number.isInteger(value)),
        )];

        if (uniqueRegistrationIds.length !== registrationIds.length) {
            return res.status(400).json({
                success: false,
                message: 'registrationIds cĂ³ pháº§n tá»­ khĂ´ng há»£p lá»‡ hoáº·c trĂ¹ng láº·p.',
            });
        }

        await prisma.$transaction(async (tx) => {
            const council = await tx.council.findUnique({
                where: { id: councilId },
                include: {
                    members: { select: { lecturerId: true, roleInCouncil: true } },
                    _count: { select: { registrations: true } },
                },
            });

            if (!council) {
                throw createHttpError(404, 'KhĂ´ng tĂ¬m tháº¥y há»™i Ä‘á»“ng.');
            }

            validateCouncilComposition(council.members);

            if (council._count.registrations + uniqueRegistrationIds.length > MAX_STUDENTS_PER_COUNCIL) {
                throw createHttpError(400, `Há»™i Ä‘á»“ng tá»‘i Ä‘a ${MAX_STUDENTS_PER_COUNCIL} sinh viĂªn.`);
            }

            const registrations = await tx.topicRegistration.findMany({
                where: { id: { in: uniqueRegistrationIds } },
                include: {
                    student: { select: { fullName: true, code: true } },
                    topic: { select: { title: true, mentorId: true } },
                },
            });

            if (registrations.length !== uniqueRegistrationIds.length) {
                throw createHttpError(400, 'CĂ³ registration khĂ´ng tá»“n táº¡i.');
            }

            const alreadyAssigned = registrations.find((registration) => registration.councilId !== null);
            if (alreadyAssigned) {
                throw createHttpError(
                    400,
                    `Sinh viĂªn ${alreadyAssigned.student.fullName} (${alreadyAssigned.student.code}) Ä‘Ă£ thuá»™c há»™i Ä‘á»“ng khĂ¡c.`,
                );
            }

            const memberLecturerIds = new Set(council.members.map((member) => member.lecturerId));
            const conflict = registrations.find((registration) => memberLecturerIds.has(registration.topic.mentorId));
            if (conflict) {
                throw createHttpError(
                    400,
                    `Conflict of interest: KhĂ´ng thá»ƒ gĂ¡n sinh viĂªn ${conflict.student.fullName} (${conflict.student.code}) vĂ o há»™i Ä‘á»“ng cĂ³ giáº£ng viĂªn hÆ°á»›ng dáº«n Ä‘á» tĂ i "${conflict.topic.title}".`,
                );
            }

            await tx.topicRegistration.updateMany({
                where: { id: { in: uniqueRegistrationIds } },
                data: { councilId },
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
            message: `ÄĂ£ phĂ¢n cĂ´ng ${uniqueRegistrationIds.length} sinh viĂªn vĂ o há»™i Ä‘á»“ng.`,
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

        const result = await prisma.topicRegistration.updateMany({
            where: {
                id: registrationIdInt,
                councilId,
            },
            data: { councilId: null },
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

        res.json({ success: true, message: 'ÄĂ£ gá»¡ sinh viĂªn khá»i há»™i Ä‘á»“ng.' });
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
            return res.status(404).json({ success: false, message: 'KhĂ´ng tĂ¬m tháº¥y há»™i Ä‘á»“ng.' });
        }

        if (existing._count.registrations > 0) {
            return res.status(400).json({
                success: false,
                message: 'KhĂ´ng thá»ƒ xĂ³a há»™i Ä‘á»“ng Ä‘Ă£ cĂ³ sinh viĂªn Ä‘Æ°á»£c phĂ¢n cĂ´ng.',
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

        res.json({ success: true, message: 'ÄĂ£ xĂ³a há»™i Ä‘á»“ng.' });
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

