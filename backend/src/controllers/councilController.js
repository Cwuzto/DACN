const prisma = require('../config/database');
const { MAX_STUDENTS_PER_COUNCIL } = require('../constants/councilLimits');
const { auditLog } = require('../services/auditLogService');

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
        throw createHttpError(400, 'LecturerId trong members khong hop le.');
    }

    const seen = new Set();
    for (const member of normalized) {
        if (seen.has(member.lecturerId)) {
            throw createHttpError(400, 'Danh sach members dang co giang vien bi trung lap.');
        }
        seen.add(member.lecturerId);
    }

    return normalized;
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
        `Canh bao: Giang vien ${member.lecturer.fullName} da tham gia hoi dong #${member.council.id} (${member.council.name}) cung defenseDate.`
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
            `Conflict of interest: Giang vien huong dan khong duoc cham sinh vien ${conflict.student.fullName} (${conflict.student.code}) voi de tai "${conflict.topic.title}".`,
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
            return res.status(404).json({ success: false, message: 'Khong tim thay hoi dong.' });
        }

        res.json({ success: true, data: council });
    } catch (error) {
        next(error);
    }
};

const createCouncil = async (req, res, next) => {
    try {
        const { semesterId, name, location, defenseDate, members } = req.body;

        if (!semesterId || !name) {
            return res.status(400).json({
                success: false,
                message: 'Vui long cung cap hoc ky va ten hoi dong.',
            });
        }

        const semesterIdInt = parseInt(semesterId, 10);
        const defenseDateValue = defenseDate ? new Date(defenseDate) : null;
        const normalizedMembers = normalizeMemberInput(members || []);

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
            message: 'Tao hoi dong thanh cong',
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
            return res.status(404).json({ success: false, message: 'Khong tim thay hoi dong.' });
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
            message: 'Cap nhat hoi dong thanh cong.',
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
                message: 'Danh sach dang ky (registrationIds) khong hop le.',
            });
        }

        const councilId = parseInt(id, 10);
        const uniqueRegistrationIds = [...new Set(
            registrationIds.map((value) => parseInt(value, 10)).filter((value) => Number.isInteger(value)),
        )];

        if (uniqueRegistrationIds.length !== registrationIds.length) {
            return res.status(400).json({
                success: false,
                message: 'registrationIds co phan tu khong hop le hoac trung lap.',
            });
        }

        await prisma.$transaction(async (tx) => {
            const council = await tx.council.findUnique({
                where: { id: councilId },
                include: {
                    members: { select: { lecturerId: true } },
                    _count: { select: { registrations: true } },
                },
            });

            if (!council) {
                throw createHttpError(404, 'Khong tim thay hoi dong.');
            }

            if (council._count.registrations + uniqueRegistrationIds.length > MAX_STUDENTS_PER_COUNCIL) {
                throw createHttpError(400, `Hoi dong toi da ${MAX_STUDENTS_PER_COUNCIL} sinh vien.`);
            }

            const registrations = await tx.topicRegistration.findMany({
                where: { id: { in: uniqueRegistrationIds } },
                include: {
                    student: { select: { fullName: true, code: true } },
                    topic: { select: { title: true, mentorId: true } },
                },
            });

            if (registrations.length !== uniqueRegistrationIds.length) {
                throw createHttpError(400, 'Co registration khong ton tai.');
            }

            const alreadyAssigned = registrations.find((registration) => registration.councilId !== null);
            if (alreadyAssigned) {
                throw createHttpError(
                    400,
                    `Sinh vien ${alreadyAssigned.student.fullName} (${alreadyAssigned.student.code}) da thuoc hoi dong khac.`,
                );
            }

            const memberLecturerIds = new Set(council.members.map((member) => member.lecturerId));
            const conflict = registrations.find((registration) => memberLecturerIds.has(registration.topic.mentorId));
            if (conflict) {
                throw createHttpError(
                    400,
                    `Conflict of interest: Khong the gan sinh vien ${conflict.student.fullName} (${conflict.student.code}) vao hoi dong co giang vien huong dan de tai "${conflict.topic.title}".`,
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
            message: `Da phan cong ${uniqueRegistrationIds.length} sinh vien vao hoi dong.`,
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

        await prisma.topicRegistration.updateMany({
            where: {
                id: parseInt(registrationId, 10),
                councilId: parseInt(id, 10),
            },
            data: { councilId: null },
        });

        res.json({ success: true, message: 'Da go sinh vien khoi hoi dong.' });
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
            return res.status(404).json({ success: false, message: 'Khong tim thay hoi dong.' });
        }

        if (existing._count.registrations > 0) {
            return res.status(400).json({
                success: false,
                message: 'Khong the xoa hoi dong da co sinh vien duoc phan cong.',
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.councilMember.deleteMany({ where: { councilId: parsedId } });
            await tx.council.delete({ where: { id: parsedId } });
        });

        res.json({ success: true, message: 'Da xoa hoi dong.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllCouncils,
    getCouncilById,
    createCouncil,
    updateCouncil,
    assignRegistrationsToCouncil,
    removeRegistrationFromCouncil,
    deleteCouncil,
};
