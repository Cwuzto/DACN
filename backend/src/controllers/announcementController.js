const prisma = require('../config/database');

/**
 * Lấy danh sách thông báo công khai (kèm phân trang, lọc theo category, tìm kiếm)
 */
const getAnnouncements = async (req, res, next) => {
    try {
        const { category, search, page = 1, limit = 10, all } = req.query;
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
        const skip = (pageNumber - 1) * pageSize;

        const where = {};

        // Nếu không phải ADMIN yêu cầu lấy 'all', chỉ hiển thị các bài isPublished = true
        if (all !== 'true' || req.user?.role !== 'ADMIN') {
            where.isPublished = true;
        }

        if (category && category !== 'ALL') {
            where.category = category;
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [total, announcements] = await Promise.all([
            prisma.publicAnnouncement.count({ where }),
            prisma.publicAnnouncement.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [
                    { isPinned: 'desc' },
                    { createdAt: 'desc' },
                ],
                include: {
                    author: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            }),
        ]);

        res.json({
            success: true,
            data: announcements,
            pagination: {
                page: pageNumber,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Lấy chi tiết một thông báo
 */
const getAnnouncementById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const announcementId = parseInt(id, 10);

        if (Number.isNaN(announcementId)) {
            return res.status(400).json({
                success: false,
                message: 'ID thông báo không hợp lệ.',
            });
        }

        const announcement = await prisma.publicAnnouncement.findUnique({
            where: { id: announcementId },
            include: {
                author: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông báo.',
            });
        }

        if (!announcement.isPublished && req.user?.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Thông báo này chưa được công khai.',
            });
        }

        res.json({
            success: true,
            data: announcement,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Tạo thông báo mới (Admin)
 */
const createAnnouncement = async (req, res, next) => {
    try {
        const { title, content, category, fileUrl, fileName, isPinned, isPublished } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Tiêu đề thông báo là bắt buộc.',
            });
        }

        const newAnnouncement = await prisma.publicAnnouncement.create({
            data: {
                title: title.trim(),
                content: content || null,
                category: category || 'ANNOUNCEMENT',
                fileUrl: fileUrl || null,
                fileName: fileName || null,
                isPinned: typeof isPinned === 'boolean' ? isPinned : false,
                isPublished: typeof isPublished === 'boolean' ? isPublished : true,
                authorId: req.user?.id || null,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });

        res.status(201).json({
            success: true,
            message: 'Tạo thông báo thành công.',
            data: newAnnouncement,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cập nhật thông báo (Admin)
 */
const updateAnnouncement = async (req, res, next) => {
    try {
        const { id } = req.params;
        const announcementId = parseInt(id, 10);

        if (Number.isNaN(announcementId)) {
            return res.status(400).json({
                success: false,
                message: 'ID thông báo không hợp lệ.',
            });
        }

        const existing = await prisma.publicAnnouncement.findUnique({
            where: { id: announcementId },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông báo cần sửa.',
            });
        }

        const { title, content, category, fileUrl, fileName, isPinned, isPublished } = req.body;

        const updated = await prisma.publicAnnouncement.update({
            where: { id: announcementId },
            data: {
                ...(title !== undefined && { title: title.trim() }),
                ...(content !== undefined && { content }),
                ...(category !== undefined && { category }),
                ...(fileUrl !== undefined && { fileUrl }),
                ...(fileName !== undefined && { fileName }),
                ...(typeof isPinned === 'boolean' && { isPinned }),
                ...(typeof isPublished === 'boolean' && { isPublished }),
                updatedAt: new Date(),
            },
            include: {
                author: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                    },
                },
            },
        });

        res.json({
            success: true,
            message: 'Cập nhật thông báo thành công.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Xóa thông báo (Admin)
 */
const deleteAnnouncement = async (req, res, next) => {
    try {
        const { id } = req.params;
        const announcementId = parseInt(id, 10);

        if (Number.isNaN(announcementId)) {
            return res.status(400).json({
                success: false,
                message: 'ID thông báo không hợp lệ.',
            });
        }

        const existing = await prisma.publicAnnouncement.findUnique({
            where: { id: announcementId },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông báo cần xóa.',
            });
        }

        await prisma.publicAnnouncement.delete({
            where: { id: announcementId },
        });

        res.json({
            success: true,
            message: 'Xóa thông báo thành công.',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAnnouncements,
    getAnnouncementById,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
};
