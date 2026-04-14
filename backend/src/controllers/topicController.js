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
            return res.status(404).json({ success: false, message: 'Khong tim thay de tai.' });
        }

        if (req.user.role === 'STUDENT' && topic.status !== 'APPROVED') {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen xem de tai nay.' });
        }

        if (req.user.role === 'LECTURER' && topic.status === 'DRAFT' && topic.proposedById !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen xem de tai nhap cua nguoi khac.' });
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
            return res.status(400).json({ success: false, message: 'Vui long nhap ten de tai va chon dot do an.' });
        }
        if (!Number.isInteger(semesterIdInt)) {
            return res.status(400).json({ success: false, message: 'Dot do an khong hop le.' });
        }

        const semester = await prisma.semester.findUnique({ where: { id: semesterIdInt }, select: { id: true } });
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
                return res.status(400).json({ success: false, message: 'GVHD phai la giang vien dang hoat dong.' });
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
            message: topicStatus === 'DRAFT' ? 'Da luu ban nhap.'
                : topicStatus === 'PENDING' ? 'Da gui de xuat, cho giang vien duyet.'
                    : 'Tao de tai thanh cong.',
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
            return res.status(404).json({ success: false, message: 'Khong tim thay de tai.' });
        }

        if (role === 'LECTURER' && existing.proposedById !== userId) {
            return res.status(403).json({ success: false, message: 'Ban chi co the sua de tai do minh tao.' });
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        updateData.maxStudents = 1;

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
                return res.status(400).json({ success: false, message: 'GVHD phai la giang vien dang hoat dong.' });
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
                    title: 'De tai da duoc cap nhat',
                    content: `De tai "${topic.title}" da duoc cap nhat boi giang vien/Admin. Vui long xem lai thong tin moi nhat.`,
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

        res.json({ success: true, message: 'Cap nhat de tai thanh cong.', data: topic });
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
            return res.status(404).json({ success: false, message: 'Khong tim thay de tai.' });
        }

        if (existing._count.registrations > 0) {
            return res.status(400).json({ success: false, message: 'Khong the xoa de tai da co sinh vien dang ky.' });
        }

        if (role !== 'ADMIN' && existing.proposedById !== userId) {
            return res.status(403).json({ success: false, message: 'Ban chi co the xoa de tai do minh tao.' });
        }

        await prisma.topic.delete({ where: { id: parseInt(id, 10) } });

        res.json({ success: true, message: 'Xoa de tai thanh cong.' });
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
            return res.status(400).json({ success: false, message: 'Trang thai phai la APPROVED hoac REJECTED.' });
        }

        if (status === 'REJECTED' && !rejectReason) {
            return res.status(400).json({ success: false, message: 'Vui long nhap ly do tu choi.' });
        }

        const existing = await prisma.topic.findUnique({ where: { id: topicId } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Khong tim thay de tai.' });
        }

        if (existing.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: `Chi duyet/tu choi de tai o trang thai PENDING. Hien: ${existing.status}.` });
        }

        if (req.user.role === 'LECTURER' && existing.mentorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Ban chi co quyen duyet de tai do minh huong dan.' });
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
                return res.status(400).json({ success: false, message: `Giang vien da dat gioi han ${maxSlots} sinh vien huong dan.` });
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
            message: status === 'APPROVED' ? 'Da duyet de tai.' : 'Da tu choi de tai.',
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
            return res.status(404).json({ success: false, message: 'Khong tim thay giang vien.' });
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
