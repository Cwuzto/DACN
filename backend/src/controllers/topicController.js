const prisma = require('../config/database');

// ============================
// TOPIC CONTROLLER
// CRUD + Duyệt/Từ chối đề tài
// ============================

/**
 * GET /api/topics
 * Lấy danh sách đề tài (phân quyền theo role)
 * Query params: ?status=APPROVED&semesterId=1&mentorId=2&search=keyword
 */
const getAllTopics = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { status, semesterId, mentorId, search } = req.query;

        // Xây dựng điều kiện where
        const conditions = [];

        // Student chỉ thấy đề tài APPROVED
        if (role === 'STUDENT') {
            conditions.push({ status: 'APPROVED' });
        }

        // Giảng viên không thấy DRAFT của người khác
        if (role === 'LECTURER') {
            if (status) {
                conditions.push({ status });
                // Nếu lọc DRAFT, chỉ thấy DRAFT của chính mình
                if (status === 'DRAFT') {
                    conditions.push({ proposedById: userId });
                }
            } else {
                // Không có filter: thấy tất cả trừ DRAFT của người khác
                conditions.push({
                    OR: [
                        { status: { not: 'DRAFT' } },
                        { status: 'DRAFT', proposedById: userId },
                    ],
                });
            }
        }

        // Admin: lọc theo status, nếu DRAFT chỉ thấy của chính mình
        if (role === 'ADMIN') {
            if (status) {
                conditions.push({ status });
                if (status === 'DRAFT') {
                    conditions.push({ proposedById: userId });
                }
            } else {
                // Không có filter: thấy tất cả trừ DRAFT của người khác
                conditions.push({
                    OR: [
                        { status: { not: 'DRAFT' } },
                        { status: 'DRAFT', proposedById: userId },
                    ],
                });
            }
        }

        // Lọc theo học kỳ
        if (semesterId) {
            conditions.push({ semesterId: parseInt(semesterId) });
        }

        // Lọc theo giảng viên hướng dẫn
        if (mentorId) {
            conditions.push({ mentorId: parseInt(mentorId) });
        }

        // Tìm kiếm theo tên đề tài
        if (search) {
            conditions.push({ title: { contains: search, mode: 'insensitive' } });
        }

        const where = conditions.length > 0 ? { AND: conditions } : {};

        const topics = await prisma.topic.findMany({
            where,
            include: {
                proposedBy: {
                    select: { id: true, fullName: true, code: true, email: true },
                },
                mentor: {
                    select: { id: true, fullName: true, code: true, email: true },
                },
                semester: {
                    select: { id: true, name: true },
                },
                _count: {
                    select: { groups: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: topics,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/topics/:id
 * Xem chi tiết 1 đề tài
 */
const getTopicById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const topic = await prisma.topic.findUnique({
            where: { id: parseInt(id) },
            include: {
                proposedBy: {
                    select: { id: true, fullName: true, code: true, email: true },
                },
                mentor: {
                    select: { id: true, fullName: true, code: true, email: true },
                },
                semester: {
                    select: { id: true, name: true },
                },
                groups: {
                    include: {
                        leader: { select: { id: true, fullName: true, code: true } },
                        members: {
                            include: {
                                student: { select: { id: true, fullName: true, code: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!topic) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đề tài.',
            });
        }

        // Student không được xem đề tài chưa duyệt
        if (req.user.role === 'STUDENT' && topic.status !== 'APPROVED') {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem đề tài này.',
            });
        }

        // Lecturer không được xem DRAFT của người khác
        if (req.user.role === 'LECTURER' && topic.status === 'DRAFT' && topic.proposedById !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem đề tài nháp của người khác.',
            });
        }

        res.json({
            success: true,
            data: topic,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/topics
 * Tạo đề tài mới
 * - Admin tạo: status = APPROVED (hoặc tuỳ chọn)
 * - Lecturer tạo: status = DRAFT hoặc PENDING (tuỳ body.status)
 */
const createTopic = async (req, res, next) => {
    try {
        const { title, description, semesterId, mentorId, maxGroups, status } = req.body;
        const { role, id: userId } = req.user;

        // Validate bắt buộc
        if (!title || !semesterId) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập tên đề tài và chọn đợt đồ án.',
            });
        }

        // Xác định status
        let topicStatus;
        if (role === 'ADMIN') {
            topicStatus = status || 'APPROVED';
        } else if (role === 'LECTURER') {
            // Lecturer: chỉ được DRAFT hoặc PENDING
            topicStatus = (status === 'DRAFT') ? 'DRAFT' : 'PENDING';
        } else {
            // Student: bắt buộc PENDING
            topicStatus = 'PENDING';
        }

        // Xác định mentorId: Admin có thể chỉ định, Lecturer mặc định là chính mình
        const finalMentorId = (role === 'ADMIN' && mentorId) ? parseInt(mentorId) : userId;

        const topic = await prisma.topic.create({
            data: {
                title,
                description: description || null,
                semesterId: parseInt(semesterId),
                proposedById: userId,
                mentorId: finalMentorId,
                maxGroups: maxGroups ? parseInt(maxGroups) : 1,
                status: topicStatus,
            },
            include: {
                proposedBy: {
                    select: { id: true, fullName: true, code: true },
                },
                mentor: {
                    select: { id: true, fullName: true, code: true },
                },
                semester: {
                    select: { id: true, name: true },
                },
            },
        });

        res.status(201).json({
            success: true,
            message: topicStatus === 'DRAFT' ? 'Đã lưu bản nháp đề tài.' : 'Tạo đề tài thành công.',
            data: topic,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/topics/:id
 * Cập nhật đề tài
 * - Admin: sửa được mọi đề tài
 * - Lecturer: chỉ sửa được đề tài DRAFT/PENDING/REJECTED của mình
 */
const updateTopic = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, mentorId, maxGroups, status } = req.body;
        const { role, id: userId } = req.user;

        const existing = await prisma.topic.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đề tài.',
            });
        }

        // Admin chỉ được sửa DRAFT của chính mình
        if (role === 'ADMIN') {
            if (existing.status !== 'DRAFT' || existing.proposedById !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Quản trị viên chỉ có thể sửa bản nháp do mình tạo.',
                });
            }
        }

        // Lecturer chỉ sửa đề tài do mình đề xuất và chưa được duyệt
        if (role === 'LECTURER') {
            if (existing.proposedById !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chỉ có thể sửa đề tài do mình đề xuất.',
                });
            }
            if (existing.status === 'APPROVED') {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể sửa đề tài đã được duyệt.',
                });
            }
        }

        // Xây dựng data update
        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (maxGroups) updateData.maxGroups = parseInt(maxGroups);

        // Admin có thể đổi mentor
        if (role === 'ADMIN' && mentorId) {
            updateData.mentorId = parseInt(mentorId);
        }

        // Admin gửi duyệt DRAFT -> APPROVED hoặc lưu DRAFT
        if (role === 'ADMIN' && status) {
            if (status === 'APPROVED' && existing.status === 'DRAFT') {
                updateData.status = 'APPROVED';
            } else if (status === 'PENDING' && existing.status === 'DRAFT') {
                updateData.status = 'PENDING';
            } else if (status === 'DRAFT') {
                updateData.status = 'DRAFT';
            }
        }

        // Lecturer gửi duyệt (DRAFT -> PENDING) hoặc lưu lại DRAFT
        if (role === 'LECTURER' && status) {
            if (status === 'PENDING' && (existing.status === 'DRAFT' || existing.status === 'REJECTED')) {
                updateData.status = 'PENDING';
                updateData.rejectReason = null; // Xóa lý do từ chối cũ
            } else if (status === 'DRAFT') {
                updateData.status = 'DRAFT';
            }
        }

        const topic = await prisma.topic.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                proposedBy: {
                    select: { id: true, fullName: true, code: true },
                },
                mentor: {
                    select: { id: true, fullName: true, code: true },
                },
                semester: {
                    select: { id: true, name: true },
                },
            },
        });

        res.json({
            success: true,
            message: 'Cập nhật đề tài thành công.',
            data: topic,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/topics/:id
 * Xóa đề tài
 * - Admin: xóa mọi đề tài (trừ đề tài đã có nhóm đăng ký)
 * - Lecturer: chỉ xóa DRAFT của mình
 */
const deleteTopic = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role, id: userId } = req.user;

        const existing = await prisma.topic.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { groups: true } } },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đề tài.',
            });
        }

        // Kiểm tra đã có nhóm đăng ký
        if (existing._count.groups > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa đề tài đã có nhóm đăng ký.',
            });
        }

        // Admin và Lecturer chỉ xóa DRAFT của mình
        if (role === 'ADMIN' || role === 'LECTURER') {
            if (existing.proposedById !== userId || existing.status !== 'DRAFT') {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn chỉ có thể xóa bản nháp đề tài do mình tạo.',
                });
            }
        }

        await prisma.topic.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: 'Xóa đề tài thành công.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/topics/:id/status
 * Duyệt hoặc Từ chối đề tài (Chỉ Admin)
 * Body: { status: 'APPROVED' | 'REJECTED', rejectReason?: '...' }
 */
const changeTopicStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rejectReason } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái chỉ có thể là APPROVED hoặc REJECTED.',
            });
        }

        if (status === 'REJECTED' && !rejectReason) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập lý do từ chối.',
            });
        }

        const existing = await prisma.topic.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy đề tài.',
            });
        }

        if (existing.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: `Chỉ có thể duyệt/từ chối đề tài đang ở trạng thái "Chờ duyệt". Đề tài này đang ở trạng thái: ${existing.status}.`,
            });
        }

        // LECTURER chỉ được duyệt đề tài mình hướng dẫn
        if (req.user.role === 'LECTURER' && existing.mentorId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Bạn chỉ có quyền duyệt đề tài do mình hướng dẫn.',
            });
        }

        // Nếu duyệt đề tài (APPROVED) cho sinh viên đề xuất, tìm nhóm của sinh viên đó để gán topicId
        let groupIdToAssign = null;
        if (status === 'APPROVED') {
            const studentGroup = await prisma.group.findFirst({
                where: {
                    leaderId: existing.proposedById,
                    semesterId: existing.semesterId,
                }
            });
            if (studentGroup) {
                groupIdToAssign = studentGroup.id;
            }
        }

        const topic = await prisma.$transaction(async (tx) => {
            const updatedTopic = await tx.topic.update({
                where: { id: parseInt(id) },
                data: {
                    status,
                    rejectReason: status === 'REJECTED' ? rejectReason : null,
                },
                include: {
                    proposedBy: { select: { id: true, fullName: true, code: true } },
                    mentor: { select: { id: true, fullName: true, code: true } },
                    semester: { select: { id: true, name: true } },
                },
            });

            // Gán đề tài cho nhóm sinh viên đề xuất
            if (groupIdToAssign) {
                // Kiểm tra xem nhóm đã có đề tài chưa
                const group = await tx.group.findUnique({ where: { id: groupIdToAssign } });
                if (group && !group.topicId) {
                    await tx.group.update({
                        where: { id: groupIdToAssign },
                        data: { topicId: updatedTopic.id }
                    });
                }
            }
            return updatedTopic;
        });

        res.json({
            success: true,
            message: status === 'APPROVED' ? 'Đã duyệt đề tài.' : 'Đã từ chối đề tài.',
            data: topic,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/topics/approvals
 * Lấy danh sách đề tài sinh viên đề xuất đang chờ duyệt (hoặc đã duyệt/từ chối)
 * dành cho Giảng viên (và Admin)
 */
const getTopicApprovals = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { status } = req.query;

        const where = {
            proposedBy: { role: 'STUDENT' } // Chỉ lấy đề tài do sinh viên đề xuất
        };

        if (role === 'LECTURER') {
            where.mentorId = userId; // Giảng viên chỉ xem đề tài mình HD
        }

        if (status) {
            where.status = status;
        } else {
            where.status = { not: 'DRAFT' }; // Không xem đề tài nháp
        }

        const topics = await prisma.topic.findMany({
            where,
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true } },
                mentor: { select: { id: true, fullName: true, code: true } },
                semester: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' }
        });

        // Với mỗi đề tài do sinh viên đề xuất, lấy thông tin nhóm của sinh viên đó
        const dataWithGroups = await Promise.all(topics.map(async (topic) => {
            const group = await prisma.group.findFirst({
                where: {
                    leaderId: topic.proposedById,
                    semesterId: topic.semesterId
                },
                include: {
                    members: {
                        include: { student: { select: { id: true, fullName: true, code: true } } }
                    }
                }
            });

            return {
                ...topic,
                studentGroup: group
            };
        }));

        res.json({
            success: true,
            data: dataWithGroups
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllTopics,
    getTopicById,
    createTopic,
    updateTopic,
    deleteTopic,
    changeTopicStatus,
    getTopicApprovals,
};
