const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');

// Giới hạn SV theo học vị giảng viên

/**
 * GET /api/topics
 * Lấy danh sách đề tài (phân quyền theo role)
 */
const getAllTopics = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { status, semesterId, mentorId, search } = req.query;

        const conditions = [];

        // Student chỉ thấy đề tài APPROVED
        if (role === 'STUDENT') {
            conditions.push({ status: 'APPROVED' });
        }

        // Giảng viên: thấy tất cả trừ DRAFT của người khác
        if (role === 'LECTURER') {
            if (status) {
                conditions.push({ status });
                if (status === 'DRAFT') {
                    conditions.push({ proposedById: userId });
                }
            } else {
                conditions.push({
                    OR: [
                        { status: { not: 'DRAFT' } },
                        { status: 'DRAFT', proposedById: userId },
                    ],
                });
            }
        }

        // Admin: tương tự Lecturer
        if (role === 'ADMIN') {
            if (status) {
                conditions.push({ status });
                if (status === 'DRAFT') {
                    conditions.push({ proposedById: userId });
                }
            } else {
                conditions.push({
                    OR: [
                        { status: { not: 'DRAFT' } },
                        { status: 'DRAFT', proposedById: userId },
                    ],
                });
            }
        }

        if (semesterId) conditions.push({ semesterId: parseInt(semesterId) });
        if (mentorId) conditions.push({ mentorId: parseInt(mentorId) });
        if (search) conditions.push({ title: { contains: search, mode: 'insensitive' } });

        const where = conditions.length > 0 ? { AND: conditions } : {};

        const topics = await prisma.topic.findMany({
            where,
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true, email: true, role: true } },
                mentor: { select: { id: true, fullName: true, code: true, email: true, academicTitle: true } },
                semester: { select: { id: true, name: true } },
                _count: { select: { registrations: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: topics });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/topics/:id
 */
const getTopicById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const topic = await prisma.topic.findUnique({
            where: { id: parseInt(id) },
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true, email: true, role: true } },
                mentor: { select: { id: true, fullName: true, code: true, email: true, academicTitle: true, department: true } },
                semester: { select: { id: true, name: true } },
                registrations: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true, email: true } },
                    },
                },
            },
        });

        if (!topic) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đề tài.' });
        }

        if (req.user.role === 'STUDENT' && topic.status !== 'APPROVED') {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đề tài này.' });
        }

        if (req.user.role === 'LECTURER' && topic.status === 'DRAFT' && topic.proposedById !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đề tài nháp của người khác.' });
        }

        res.json({ success: true, data: topic });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/topics
 * Tạo đề tài:
 * - Lecturer tạo (đăng tải đề tài sẵn): status=APPROVED, mentorId=chính mình
 * - Student đề xuất: status=PENDING, mentorId=GV được chọn, cần GV duyệt
 * - Admin: status tuỳ chọn
 */
const createTopic = async (req, res, next) => {
    try {
        const { title, description, semesterId, mentorId, maxStudents, status } = req.body;
        const { role, id: userId } = req.user;

        if (!title || !semesterId) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đề tài và chọn đợt đồ án.' });
        }

        let topicStatus, finalMentorId;

        if (role === 'LECTURER') {
            // GV đăng tải đề tài → trạng thái APPROVED (hoặc DRAFT)
            topicStatus = (status === 'DRAFT') ? 'DRAFT' : 'APPROVED';
            finalMentorId = userId; // GV tự là mentor
        } else if (role === 'STUDENT') {
            // SV đề xuất → cần chọn GV, trạng thái PENDING
            if (!mentorId) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn giảng viên hướng dẫn.' });
            }
            topicStatus = 'PENDING';
            finalMentorId = parseInt(mentorId);
        } else {
            // Admin
            topicStatus = status || 'APPROVED';
            finalMentorId = mentorId ? parseInt(mentorId) : userId;
        }

        const topic = await prisma.topic.create({
            data: {
                title,
                description: description || null,
                semesterId: parseInt(semesterId),
                proposedById: userId,
                mentorId: finalMentorId,
                maxStudents: maxStudents ? parseInt(maxStudents) : 1,
                status: topicStatus,
            },
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true } },
                mentor: { select: { id: true, fullName: true, code: true } },
                semester: { select: { id: true, name: true } },
            },
        });

        res.status(201).json({
            success: true,
            message: topicStatus === 'DRAFT' ? 'Đã lưu bản nháp.' :
                     topicStatus === 'PENDING' ? 'Đã gửi đề xuất, chờ giảng viên duyệt.' :
                     'Tạo đề tài thành công.',
            data: topic,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/topics/:id
 */
const updateTopic = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, description, mentorId, maxStudents, status } = req.body;
        const { role, id: userId } = req.user;

        const existing = await prisma.topic.findUnique({ where: { id: parseInt(id) } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đề tài.' });
        }

        // Kiểm tra quyền
        if (role === 'LECTURER') {
            if (existing.proposedById !== userId) {
                return res.status(403).json({ success: false, message: 'Bạn chỉ có thể sửa đề tài do mình tạo.' });
            }
            if (existing.status === 'APPROVED') {
                // Cho phép sửa nếu chưa có SV đăng ký
                const regCount = await prisma.topicRegistration.count({ where: { topicId: existing.id } });
                if (regCount > 0) {
                    return res.status(400).json({ success: false, message: 'Không thể sửa đề tài đã có sinh viên đăng ký.' });
                }
            }
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (maxStudents) updateData.maxStudents = parseInt(maxStudents);
        if (role === 'ADMIN' && mentorId) updateData.mentorId = parseInt(mentorId);

        if (status) {
            if (role === 'LECTURER') {
                if (status === 'APPROVED' && (existing.status === 'DRAFT')) updateData.status = 'APPROVED';
                else if (status === 'DRAFT') updateData.status = 'DRAFT';
            } else if (role === 'ADMIN') {
                updateData.status = status;
            }
        }

        const topic = await prisma.topic.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true } },
                mentor: { select: { id: true, fullName: true, code: true } },
                semester: { select: { id: true, name: true } },
            },
        });

        res.json({ success: true, message: 'Cập nhật đề tài thành công.', data: topic });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/topics/:id
 */
const deleteTopic = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role, id: userId } = req.user;

        const existing = await prisma.topic.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { registrations: true } } },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đề tài.' });
        }

        if (existing._count.registrations > 0) {
            return res.status(400).json({ success: false, message: 'Không thể xóa đề tài đã có sinh viên đăng ký.' });
        }

        if (role !== 'ADMIN' && existing.proposedById !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ có thể xóa đề tài do mình tạo.' });
        }

        await prisma.topic.delete({ where: { id: parseInt(id) } });

        res.json({ success: true, message: 'Xóa đề tài thành công.' });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/topics/:id/status
 * Duyệt/Từ chối đề tài do SV đề xuất (Giảng viên duyệt, không phải Admin)
 */
const changeTopicStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rejectReason } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái phải là APPROVED hoặc REJECTED.' });
        }

        if (status === 'REJECTED' && !rejectReason) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
        }

        const existing = await prisma.topic.findUnique({ where: { id: parseInt(id) } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đề tài.' });
        }

        if (existing.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: `Chỉ duyệt/từ chối đề tài ở trạng thái "Chờ duyệt". Hiện: ${existing.status}.` });
        }

        // GV chỉ được duyệt đề tài mình hướng dẫn
        if (req.user.role === 'LECTURER' && existing.mentorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ có quyền duyệt đề tài do mình hướng dẫn.' });
        }

        // Nếu duyệt: kiểm tra quota GV
        if (status === 'APPROVED') {
            const mentor = await prisma.user.findUnique({ where: { id: existing.mentorId } });
            const maxSlots = getMentorMaxSlots(mentor?.academicTitle);
            const currentCount = await prisma.topicRegistration.count({
                where: { topic: { mentorId: existing.mentorId, semesterId: existing.semesterId }, status: { in: ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] } }
            });
            if (currentCount >= maxSlots) {
                return res.status(400).json({ success: false, message: `Giảng viên đã đạt giới hạn ${maxSlots} sinh viên hướng dẫn.` });
            }
        }

        const topic = await prisma.topic.update({
            where: { id: parseInt(id) },
            data: {
                status,
                rejectReason: status === 'REJECTED' ? rejectReason : null,
            },
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true } },
                mentor: { select: { id: true, fullName: true, code: true } },
            },
        });

        // Nếu duyệt đề tài SV đề xuất → tự động tạo TopicRegistration
        if (status === 'APPROVED') {
            const proposer = await prisma.user.findUnique({ where: { id: existing.proposedById } });
            if (proposer?.role === 'STUDENT') {
                // Kiểm tra SV chưa có registration trong kỳ này
                const hasReg = await prisma.topicRegistration.findUnique({
                    where: { studentId_semesterId: { studentId: proposer.id, semesterId: existing.semesterId } }
                });
                if (!hasReg) {
                    await prisma.topicRegistration.create({
                        data: {
                            topicId: existing.id,
                            studentId: proposer.id,
                            semesterId: existing.semesterId,
                            status: 'APPROVED',
                        }
                    });
                }
            }
        }

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
 * Danh sách đề tài SV đề xuất chờ duyệt (GV / Admin)
 */
const getTopicApprovals = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { status } = req.query;

        const where = {
            proposedBy: { role: 'STUDENT' },
        };

        if (role === 'LECTURER') where.mentorId = userId;
        if (status) where.status = status;
        else where.status = { not: 'DRAFT' };

        const topics = await prisma.topic.findMany({
            where,
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true, email: true } },
                mentor: { select: { id: true, fullName: true, code: true } },
                semester: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: topics });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/topics/mentor-capacity/:mentorId
 * Kiểm tra capacity của 1 GV (SV gọi khi chọn GV)
 */
const getMentorCapacity = async (req, res, next) => {
    try {
        const { mentorId } = req.params;
        const { semesterId } = req.query;

        const mentor = await prisma.user.findUnique({
            where: { id: parseInt(mentorId) },
            select: { id: true, fullName: true, academicTitle: true },
        });

        if (!mentor) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên.' });
        }

        const maxSlots = getMentorMaxSlots(mentor.academicTitle);

        // Đếm SV hiện tại đang được GV hướng dẫn trong kỳ này
        const whereClause = {
            topic: { mentorId: parseInt(mentorId) },
            status: { in: ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] },
        };
        if (semesterId) whereClause.semesterId = parseInt(semesterId);

        const currentCount = await prisma.topicRegistration.count({ where: whereClause });

        res.json({
            success: true,
            data: {
                mentorId: mentor.id,
                fullName: mentor.fullName,
                academicTitle: mentor.academicTitle,
                maxSlots,
                currentCount,
                available: maxSlots - currentCount,
            },
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
    getMentorCapacity,
};
