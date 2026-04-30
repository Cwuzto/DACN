const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');
const { auditLog } = require('../services/auditLogService');
const { safeNotifyMany } = require('../services/notificationService');

const TOPIC_STATUS_VALUES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];
const ACTIVE_REGISTRATION_STATUSES = ['PENDING', 'APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];
const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

const getAllTopics = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { status, semesterId, mentorId, search } = req.query;

        const conditions = [];

        if (role === 'STUDENT') {
            conditions.push({ status: 'APPROVED' });
        }

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

        if (semesterId) conditions.push({ semesterId: parseInt(semesterId, 10) });
        if (mentorId) conditions.push({ mentorId: parseInt(mentorId, 10) });
        if (search) {
            conditions.push({
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    {
                        registrations: {
                            some: {
                                student: {
                                    fullName: { contains: search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                    {
                        registrations: {
                            some: {
                                student: {
                                    code: { contains: search, mode: 'insensitive' },
                                },
                            },
                        },
                    },
                ],
            });
        }

        const where = conditions.length > 0 ? { AND: conditions } : {};

        const topics = await prisma.topic.findMany({
            where,
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true, email: true, role: true } },
                mentor: { select: { id: true, fullName: true, code: true, email: true, academicTitle: true } },
                semester: { select: { id: true, name: true } },
                _count: { select: { registrations: true } },
                registrations: {
                    where: {
                        status: { not: 'REJECTED' },
                    },
                    select: {
                        id: true,
                        status: true,
                        student: { select: { id: true, fullName: true, code: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: topics });
    } catch (error) {
        next(error);
    }
};

const getTopicById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const topic = await prisma.topic.findUnique({
            where: { id: parseInt(id, 10) },
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

const createTopic = async (req, res, next) => {
    try {
        const { title, description, semesterId, mentorId, status } = req.body;
        const { role, id: userId } = req.user;
        const semesterIdInt = parseInt(semesterId, 10);

        if (!title || !semesterId) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên đề tài và chọn đợt đồ án.' });
        }
        if (!Number.isInteger(semesterIdInt)) {
            return res.status(400).json({ success: false, message: 'Đợt đồ án không hợp lệ.' });
        }

        const semester = await prisma.semester.findUnique({ where: { id: semesterIdInt }, select: { id: true } });
        if (!semester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đợt đồ án.' });
        }

        let topicStatus;
        let finalMentorId;

        if (role === 'LECTURER') {
            topicStatus = status === 'DRAFT' ? 'DRAFT' : 'APPROVED';
            finalMentorId = userId;
        } else if (role === 'STUDENT') {
            if (!mentorId) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn giảng viên hướng dẫn.' });
            }
            topicStatus = 'PENDING';
            finalMentorId = parseInt(mentorId, 10);
        } else {
            if (!mentorId) {
                return res.status(400).json({ success: false, message: 'Admin bắt buộc chọn giảng viên hướng dẫn.' });
            }
            if (status && !TOPIC_STATUS_VALUES.includes(status)) {
                return res.status(400).json({ success: false, message: 'Trạng thái đề tài không hợp lệ.' });
            }
            topicStatus = status || 'APPROVED';
            finalMentorId = parseInt(mentorId, 10);
        }

        if (!Number.isInteger(finalMentorId)) {
            return res.status(400).json({ success: false, message: 'Giảng viên hướng dẫn không hợp lệ.' });
        }

        if (role !== 'LECTURER') {
            const mentor = await prisma.user.findUnique({
                where: { id: finalMentorId },
                select: { id: true, role: true, isActive: true },
            });
            if (!mentor || mentor.role !== 'LECTURER' || !mentor.isActive) {
                return res.status(400).json({ success: false, message: 'GVHD phải là giảng viên đang hoạt động.' });
            }
        }

        const topic = await prisma.topic.create({
            data: {
                title,
                description: description || null,
                semesterId: semesterIdInt,
                proposedById: userId,
                mentorId: finalMentorId,
                maxStudents: 1,
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
            message: topicStatus === 'DRAFT' ? 'Đã lưu bản nháp.'
                : topicStatus === 'PENDING' ? 'Đã gửi đề xuất, chờ giảng viên duyệt.'
                    : 'Tạo đề tài thành công.',
            data: topic,
        });
    } catch (error) {
        next(error);
    }
};

const updateTopic = async (req, res, next) => {
    try {
        const { id } = req.params;
        const topicId = parseInt(id, 10);
        const { title, description, mentorId, status } = req.body;
        const { role, id: userId } = req.user;

        const existing = await prisma.topic.findUnique({ where: { id: topicId } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đề tài.' });
        }

        if (role === 'LECTURER' && existing.proposedById !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ có thể sửa đề tài do mình tạo.' });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        updateData.maxStudents = 1;

        if (role === 'ADMIN' && mentorId) {
            const mentorIdInt = parseInt(mentorId, 10);
            if (!Number.isInteger(mentorIdInt)) {
                return res.status(400).json({ success: false, message: 'GVHD không hợp lệ.' });
            }
            const mentor = await prisma.user.findUnique({
                where: { id: mentorIdInt },
                select: { id: true, role: true, isActive: true },
            });
            if (!mentor || mentor.role !== 'LECTURER' || !mentor.isActive) {
                return res.status(400).json({ success: false, message: 'GVHD phải là giảng viên đang hoạt động.' });
            }
            updateData.mentorId = mentorIdInt;
        }

        if (status) {
            if (role === 'LECTURER') {
                if (status === 'APPROVED' && existing.status === 'DRAFT') updateData.status = 'APPROVED';
                else if (status === 'DRAFT') updateData.status = 'DRAFT';
            } else if (role === 'ADMIN') {
                updateData.status = status;
            }
        }

        const topic = await prisma.topic.update({
            where: { id: topicId },
            data: updateData,
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true } },
                mentor: { select: { id: true, fullName: true, code: true } },
                semester: { select: { id: true, name: true } },
            },
        });

        const affectedRegs = await prisma.topicRegistration.findMany({
            where: {
                topicId,
                status: { in: ACTIVE_REGISTRATION_STATUSES },
            },
            select: { studentId: true },
        });

        if (affectedRegs.length > 0) {
            await safeNotifyMany(
                affectedRegs.map((reg) => ({
                    userId: reg.studentId,
                    title: 'Đề tài đã được cập nhật',
                    content: `Đề tài "${topic.title}" đã được cập nhật bởi giảng viên/Admin. Vui lòng xem lại thông tin mới nhất.`,
                    type: 'SYSTEM',
                })),
                'updateTopic',
            );
        }

        await auditLog(
            userId,
            'UPDATE_TOPIC',
            'Topic',
            topicId,
            { updateData, notifiedStudents: affectedRegs.length },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Cập nhật đề tài thành công.', data: topic });
    } catch (error) {
        next(error);
    }
};

const deleteTopic = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { role, id: userId } = req.user;

        const existing = await prisma.topic.findUnique({
            where: { id: parseInt(id, 10) },
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

        await prisma.topic.delete({ where: { id: parseInt(id, 10) } });

        res.json({ success: true, message: 'Xóa đề tài thành công.' });
    } catch (error) {
        next(error);
    }
};

const changeTopicStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const topicId = parseInt(id, 10);
        const { status, rejectReason } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái phải là APPROVED hoặc REJECTED.' });
        }

        if (status === 'REJECTED' && !rejectReason) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
        }

        const existing = await prisma.topic.findUnique({ where: { id: topicId } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đề tài.' });
        }

        if (existing.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: `Chỉ duyệt/từ chối đề tài ở trạng thái PENDING. Hiện: ${existing.status}.` });
        }

        if (req.user.role === 'LECTURER' && existing.mentorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ có quyền duyệt đề tài do mình hướng dẫn.' });
        }

        if (status === 'APPROVED') {
            const mentor = await prisma.user.findUnique({ where: { id: existing.mentorId } });
            const maxSlots = getMentorMaxSlots(mentor?.academicTitle);
            const currentCount = await prisma.topicRegistration.count({
                where: {
                    topic: { mentorId: existing.mentorId, semesterId: existing.semesterId },
                    status: { in: ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] },
                },
            });
            if (currentCount >= maxSlots) {
                return res.status(400).json({ success: false, message: `Giảng viên đã đạt giới hạn ${maxSlots} sinh viên hướng dẫn.` });
            }
        }

        const topic = await prisma.topic.update({
            where: { id: topicId },
            data: {
                status,
                rejectReason: status === 'REJECTED' ? rejectReason : null,
            },
            include: {
                proposedBy: { select: { id: true, fullName: true, code: true } },
                mentor: { select: { id: true, fullName: true, code: true } },
            },
        });

        if (status === 'APPROVED') {
            const proposer = await prisma.user.findUnique({ where: { id: existing.proposedById } });
            if (proposer?.role === 'STUDENT') {
                const hasReg = await prisma.topicRegistration.findUnique({
                    where: { studentId_semesterId: { studentId: proposer.id, semesterId: existing.semesterId } },
                });
                if (!hasReg) {
                    await prisma.topicRegistration.create({
                        data: {
                            topicId: existing.id,
                            studentId: proposer.id,
                            semesterId: existing.semesterId,
                            status: 'APPROVED',
                        },
                    });
                }
            }
        }

        await auditLog(
            req.user.id,
            status === 'APPROVED' ? 'APPROVE_TOPIC' : 'REJECT_TOPIC',
            'Topic',
            topicId,
            { rejectReason: status === 'REJECTED' ? rejectReason : null },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: status === 'APPROVED' ? 'Đã duyệt đề tài.' : 'Đã từ chối đề tài.',
            data: topic,
        });
    } catch (error) {
        next(error);
    }
};

const getMentorCapacity = async (req, res, next) => {
    try {
        const { mentorId } = req.params;
        const { semesterId } = req.query;

        const mentor = await prisma.user.findUnique({
            where: { id: parseInt(mentorId, 10) },
            select: { id: true, fullName: true, academicTitle: true },
        });

        if (!mentor) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên.' });
        }

        const maxSlots = getMentorMaxSlots(mentor.academicTitle);

        const whereClause = {
            topic: { mentorId: parseInt(mentorId, 10) },
            status: { in: ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] },
        };
        if (semesterId) whereClause.semesterId = parseInt(semesterId, 10);

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

        res.json({ success: true, data: mentors });
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
    getMentorCapacity,
    getAvailableMentors,
};
