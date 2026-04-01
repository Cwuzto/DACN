const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');
const TOPIC_STATUS_VALUES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];

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
        const semesterIdInt = parseInt(semesterId, 10);

        if (!title || !semesterId) {
            return res.status(400).json({ success: false, message: 'Vui long nhap ten de tai va chon dot do an.' });
        }
        if (!Number.isInteger(semesterIdInt)) {
            return res.status(400).json({ success: false, message: 'Dot do an khong hop le.' });
        }

        const semester = await prisma.semester.findUnique({
            where: { id: semesterIdInt },
            select: { id: true },
        });
        if (!semester) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dot do an.' });
        }

        let topicStatus;
        let finalMentorId;

        if (role === 'LECTURER') {
            topicStatus = status === 'DRAFT' ? 'DRAFT' : 'APPROVED';
            finalMentorId = userId;
        } else if (role === 'STUDENT') {
            if (!mentorId) {
                return res.status(400).json({ success: false, message: 'Vui long chon giang vien huong dan.' });
            }
            topicStatus = 'PENDING';
            finalMentorId = parseInt(mentorId, 10);
        } else {
            if (!mentorId) {
                return res.status(400).json({ success: false, message: 'Admin bat buoc chon giang vien huong dan.' });
            }
            if (status && !TOPIC_STATUS_VALUES.includes(status)) {
                return res.status(400).json({ success: false, message: 'Trang thai de tai khong hop le.' });
            }
            topicStatus = status || 'APPROVED';
            finalMentorId = parseInt(mentorId, 10);
        }

        if (!Number.isInteger(finalMentorId)) {
            return res.status(400).json({ success: false, message: 'Giang vien huong dan khong hop le.' });
        }

        if (role !== 'LECTURER') {
            const mentor = await prisma.user.findUnique({
                where: { id: finalMentorId },
                select: { id: true, role: true, isActive: true },
            });
            if (!mentor || mentor.role !== 'LECTURER' || !mentor.isActive) {
                return res.status(400).json({
                    success: false,
                    message: 'GVHD phai la giang vien dang hoat dong.',
                });
            }
        }

        const topic = await prisma.topic.create({
            data: {
                title,
                description: description || null,
                semesterId: semesterIdInt,
                proposedById: userId,
                mentorId: finalMentorId,
                maxStudents: maxStudents ? parseInt(maxStudents, 10) : 1,
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
            message: topicStatus === 'DRAFT' ? 'Da luu ban nhap.'
                : topicStatus === 'PENDING' ? 'Da gui de xuat, cho giang vien duyet.'
                : 'Tao de tai thanh cong.',
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
        if (maxStudents) updateData.maxStudents = parseInt(maxStudents, 10);
        if (role === 'ADMIN' && mentorId) {
            const mentorIdInt = parseInt(mentorId, 10);
            if (!Number.isInteger(mentorIdInt)) {
                return res.status(400).json({ success: false, message: 'GVHD khong hop le.' });
            }
            const mentor = await prisma.user.findUnique({
                where: { id: mentorIdInt },
                select: { id: true, role: true, isActive: true },
            });
            if (!mentor || mentor.role !== 'LECTURER' || !mentor.isActive) {
                return res.status(400).json({
                    success: false,
                    message: 'GVHD phai la giang vien dang hoat dong.',
                });
            }
            updateData.mentorId = mentorIdInt;
        }

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

const getAvailableMentors = async (_req, res, next) => {
    try {
        const mentors = await prisma.user.findMany({
            where: {
                role: 'LECTURER',
                isActive: true,
            },
            select: {
                id: true,
                fullName: true,
                code: true,
                academicTitle: true,
                department: true,
            },
            orderBy: { fullName: 'asc' },
        });

        res.json({
            success: true,
            data: mentors,
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
    getAvailableMentors,
};
