const prisma = require('../config/database');

/**
 * GET /api/councils
 * Query: ?semesterId=1
 */
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

/**
 * GET /api/councils/:id
 */
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
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        res.json({ success: true, data: council });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/councils
 */
const createCouncil = async (req, res, next) => {
    try {
        const { semesterId, name, location, defenseDate, members } = req.body;

        if (!semesterId || !name) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp học kỳ và tên hội đồng.',
            });
        }

        const council = await prisma.$transaction(async (tx) => {
            const newCouncil = await tx.council.create({
                data: {
                    semesterId: parseInt(semesterId, 10),
                    name,
                    location,
                    defenseDate: defenseDate ? new Date(defenseDate) : null,
                },
            });

            if (members?.length) {
                await tx.councilMember.createMany({
                    data: members.map((member) => ({
                        councilId: newCouncil.id,
                        lecturerId: member.lecturerId,
                        roleInCouncil: member.roleInCouncil,
                    })),
                });
            }

            return newCouncil;
        });

        res.status(201).json({ success: true, message: 'Tạo hội đồng thành công', data: council });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/councils/:id
 */
const updateCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, location, defenseDate, members } = req.body;

        const existing = await prisma.council.findUnique({ where: { id: parseInt(id, 10) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.council.update({
                where: { id: parseInt(id, 10) },
                data: {
                    name,
                    location,
                    defenseDate: defenseDate !== undefined
                        ? (defenseDate ? new Date(defenseDate) : null)
                        : existing.defenseDate,
                },
            });

            if (members !== undefined) {
                await tx.councilMember.deleteMany({ where: { councilId: parseInt(id, 10) } });
                if (members.length > 0) {
                    await tx.councilMember.createMany({
                        data: members.map((member) => ({
                            councilId: parseInt(id, 10),
                            lecturerId: member.lecturerId,
                            roleInCouncil: member.roleInCouncil,
                        })),
                    });
                }
            }
        });

        res.json({ success: true, message: 'Cập nhật hội đồng thành công.' });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/councils/:id/assign
 */
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

        const council = await prisma.council.findUnique({ where: { id: parseInt(id, 10) } });
        if (!council) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        await prisma.topicRegistration.updateMany({
            where: { id: { in: registrationIds.map((value) => parseInt(value, 10)) } },
            data: { councilId: parseInt(id, 10) },
        });

        res.json({
            success: true,
            message: `Đã phân công ${registrationIds.length} sinh viên vào hội đồng.`,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/councils/:id/remove-registration
 */
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

        res.json({ success: true, message: 'Đã gỡ sinh viên khỏi hội đồng.' });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/councils/:id
 */
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

        res.json({ success: true, message: 'Đã xóa hội đồng.' });
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


