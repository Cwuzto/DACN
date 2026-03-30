const prisma = require('../config/database');

/**
 * GET /api/councils
 * Lấy danh sách hội đồng
 * Query: ?semesterId=1
 */
const getAllCouncils = async (req, res, next) => {
    try {
        const { semesterId } = req.query;
        const where = {};
        if (semesterId) {
            where.semesterId = parseInt(semesterId);
        }

        const councils = await prisma.council.findMany({
            where,
            include: {
                semester: { select: { name: true } },
                members: {
                    include: {
                        lecturer: { select: { id: true, fullName: true, avatarUrl: true, code: true } }
                    }
                },
                _count: {
                    select: { evaluations: true }
                }
            },
            orderBy: { id: 'desc' }
        });

        res.json({
            success: true,
            data: councils
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/councils/:id
 * Lấy chi tiết 1 hội đồng
 */
const getCouncilById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const council = await prisma.council.findUnique({
            where: { id: parseInt(id) },
            include: {
                semester: { select: { name: true } },
                members: {
                    include: {
                        lecturer: { select: { id: true, fullName: true, avatarUrl: true, code: true } }
                    }
                },
                evaluations: {
                    include: {
                        registration: {
                            include: {
                                topic: { select: { title: true } },
                                student: { select: { fullName: true, code: true } }
                            }
                        }
                    }
                }
            }
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
 * Tạo hội đồng bảo vệ và thêm thành viên
 */
const createCouncil = async (req, res, next) => {
    try {
        const { semesterId, name, location, defenseDate, members } = req.body;
        // members format expected: [{ lecturerId: 1, roleInCouncil: 'CHAIRMAN' }, ...]

        if (!semesterId || !name) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp học kỳ và tên hội đồng.' });
        }

        const council = await prisma.$transaction(async (tx) => {
            const newCouncil = await tx.council.create({
                data: {
                    semesterId: parseInt(semesterId),
                    name,
                    location,
                    // If defenseDate is provided, convert; otherwise keep null
                    defenseDate: defenseDate ? new Date(defenseDate) : null,
                }
            });

            if (members && members.length > 0) {
                const councilMembers = members.map(m => ({
                    councilId: newCouncil.id,
                    lecturerId: m.lecturerId,
                    roleInCouncil: m.roleInCouncil
                }));
                await tx.councilMember.createMany({
                    data: councilMembers
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
 * Cập nhật định dạng / thông tin hội đồng
 */
const updateCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, location, defenseDate, members } = req.body;

        const existing = await prisma.council.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.council.update({
                where: { id: parseInt(id) },
                data: {
                    name,
                    location,
                    // If defenseDate is provided, convert; otherwise keep existing/null
                    defenseDate: defenseDate !== undefined ? (defenseDate ? new Date(defenseDate) : null) : existing.defenseDate
                }
            });

            if (members !== undefined) {
                // Remove old members
                await tx.councilMember.deleteMany({ where: { councilId: parseInt(id) } });

                // Add new members
                if (members.length > 0) {
                    const councilMembers = members.map(m => ({
                        councilId: parseInt(id),
                        lecturerId: m.lecturerId,
                        roleInCouncil: m.roleInCouncil
                    }));
                    await tx.councilMember.createMany({
                        data: councilMembers
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
 * Phân công danh sách đăng ký vào hội đồng
 */
const assignRegistrationsToCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { registrationIds } = req.body;

        if (!Array.isArray(registrationIds)) {
            return res.status(400).json({ success: false, message: 'Danh sách đăng ký (registrationIds) không hợp lệ.' });
        }

        const existing = await prisma.council.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        // Với mỗi registrationId, upsert DefenseResult với councilId
        await prisma.$transaction(async (tx) => {
            for (const regId of registrationIds) {
                await tx.defenseResult.upsert({
                    where: { registrationId: parseInt(regId) },
                    create: {
                        registrationId: parseInt(regId),
                        councilId: parseInt(id)
                    },
                    update: {
                        councilId: parseInt(id)
                    }
                });
            }
        });

        res.json({ success: true, message: `Đã phân công ${registrationIds.length} sinh viên vào hội đồng.` });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/councils/:id/remove-registration
 * Xóa một sinh viên khỏi hội đồng
 */
const removeRegistrationFromCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { registrationId } = req.body;

        await prisma.defenseResult.updateMany({
            where: {
                registrationId: parseInt(registrationId),
                councilId: parseInt(id)
            },
            data: { councilId: null }
        });

        res.json({ success: true, message: 'Đã gỡ sinh viên khỏi hội đồng.' });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/councils/:id
 * Xóa hội đồng
 */
const deleteCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await prisma.council.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { evaluations: true } } }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        if (existing._count.evaluations > 0) {
            return res.status(400).json({ success: false, message: 'Không thể xóa hội đồng đã có sinh viên được phân công.' });
        }

        await prisma.$transaction(async (tx) => {
            // Delete members first
            await tx.councilMember.deleteMany({ where: { councilId: parseInt(id) } });
            // Delete council
            await tx.council.delete({ where: { id: parseInt(id) } });
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
    deleteCouncil
};
