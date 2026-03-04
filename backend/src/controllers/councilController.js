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
                    select: { groups: true }
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
                groups: {
                    include: {
                        topic: { select: { title: true } },
                        leader: { select: { fullName: true } }
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
 * Phân công danh sách nhóm vào hội đồng
 */
const assignGroupsToCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { groupIds } = req.body;

        if (!Array.isArray(groupIds)) {
            return res.status(400).json({ success: false, message: 'Danh sách nhóm (groupIds) không hợp lệ.' });
        }

        const existing = await prisma.council.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        // Cập nhật councilId cho các nhóm
        await prisma.group.updateMany({
            where: {
                id: { in: groupIds }
            },
            data: {
                councilId: parseInt(id)
            }
        });

        res.json({ success: true, message: `Đã phân công ${groupIds.length} nhóm vào hội đồng.` });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/councils/:id/remove-group
 * Xóa một nhóm khỏi hội đồng
 */
const removeGroupFromCouncil = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { groupId } = req.body;

        const group = await prisma.group.findUnique({ where: { id: parseInt(groupId) } });
        if (!group || group.councilId !== parseInt(id)) {
            return res.status(404).json({ success: false, message: 'Nhóm không tồn tại hoặc không thuộc hội đồng này.' });
        }

        await prisma.group.update({
            where: { id: parseInt(groupId) },
            data: { councilId: null }
        });

        res.json({ success: true, message: 'Đã gỡ nhóm khỏi hội đồng.' });
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
            include: { _count: { select: { groups: true } } }
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hội đồng.' });
        }

        if (existing._count.groups > 0) {
            return res.status(400).json({ success: false, message: 'Không thể xóa hội đồng đã có nhóm được phân công.' });
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
    assignGroupsToCouncil,
    removeGroupFromCouncil,
    deleteCouncil
};
