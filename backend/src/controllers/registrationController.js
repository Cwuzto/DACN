const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');

// Giới hạn SV theo học vị

/**
 * POST /api/registrations
 * Sinh viên đăng ký 1 đề tài (cá nhân, không nhóm)
 * Body: { topicId, semesterId }
 */
const registerTopic = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { topicId, semesterId } = req.body;

        if (!topicId || !semesterId) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn đề tài và đợt đồ án.' });
        }

        // 1. Kiểm tra SV đã đăng ký trong kỳ này chưa
        const existingReg = await prisma.topicRegistration.findUnique({
            where: { studentId_semesterId: { studentId, semesterId: parseInt(semesterId) } },
        });

        if (existingReg) {
            if (existingReg.status === 'REJECTED') {
                // Nếu bị từ chối → cho phép đổi đề tài (xóa đăng ký cũ)
                await prisma.topicRegistration.delete({ where: { id: existingReg.id } });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn đã đăng ký đề tài trong kỳ này. Chỉ có thể đổi khi bị từ chối.',
                });
            }
        }

        // 2. Kiểm tra đề tài tồn tại & APPROVED
        const topic = await prisma.topic.findUnique({
            where: { id: parseInt(topicId) },
            include: {
                mentor: { select: { id: true, academicTitle: true } },
                _count: { select: { registrations: true } },
            },
        });

        if (!topic || topic.status !== 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Đề tài không tồn tại hoặc chưa được duyệt.' });
        }

        if (topic.semesterId !== parseInt(semesterId)) {
            return res.status(400).json({ success: false, message: 'Đề tài không thuộc đợt đăng ký hiện tại.' });
        }

        // 3. Kiểm tra còn slot chưa
        if (topic._count.registrations >= topic.maxStudents) {
            return res.status(400).json({ success: false, message: 'Đề tài này đã đủ số lượng sinh viên đăng ký.' });
        }

        // 4. Kiểm tra quota giảng viên
        const maxSlots = getMentorMaxSlots(topic.mentor?.academicTitle);
        const mentorStudentCount = await prisma.topicRegistration.count({
            where: {
                topic: { mentorId: topic.mentorId, semesterId: parseInt(semesterId) },
                status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] },
            },
        });

        if (mentorStudentCount >= maxSlots) {
            return res.status(400).json({ success: false, message: `Giảng viên đã đạt giới hạn hướng dẫn (${maxSlots} sinh viên).` });
        }

        // 5. Tạo đăng ký
        const registration = await prisma.topicRegistration.create({
            data: {
                topicId: parseInt(topicId),
                studentId,
                semesterId: parseInt(semesterId),
                status: 'PENDING',
            },
            include: {
                topic: { select: { title: true, mentor: { select: { fullName: true } } } },
            },
        });

        // 6. Gửi notification cho GV
        await prisma.notification.create({
            data: {
                userId: topic.mentorId,
                title: 'Sinh viên đăng ký đề tài',
                content: `${req.user.fullName} (${req.user.code}) đã đăng ký đề tài "${topic.title}".`,
                type: 'REGISTRATION',
            },
        });

        res.status(201).json({
            success: true,
            message: 'Đăng ký đề tài thành công! Chờ giảng viên phê duyệt.',
            data: registration,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/my
 * Lấy thông tin đăng ký đề tài hiện tại của SV
 */
const getMyRegistration = async (req, res, next) => {
    try {
        const studentId = req.user.id;

        const registration = await prisma.topicRegistration.findFirst({
            where: { studentId },
            include: {
                topic: {
                    include: {
                        mentor: { select: { id: true, fullName: true, code: true, email: true, department: true, academicTitle: true } },
                    },
                },
                milestones: { orderBy: { dueDate: 'asc' } },
                tasks: {
                    include: { submissions: { where: { submittedBy: studentId } } },
                    orderBy: { dueDate: 'asc' },
                },
                defenseResult: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!registration) {
            return res.json({ success: true, data: null, message: 'Bạn chưa đăng ký đề tài nào.' });
        }

        res.json({ success: true, data: registration });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations
 * Danh sách đăng ký (GV xem SV mình hướng dẫn, Admin xem tất cả)
 */
const getAllRegistrations = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { semesterId, status, unassignedCouncilOnly } = req.query;

        const where = {};

        if (role === 'LECTURER') {
            where.topic = { mentorId: userId };
        }

        if (semesterId) where.semesterId = parseInt(semesterId);
        if (status) where.status = status;

        if (unassignedCouncilOnly === 'true') {
            where.councilId = null;
            // Chỉ xếp hội đồng cho sinh viên hợp lệ (ví dụ: đã duyệt)
            where.status = { notIn: ['PENDING', 'REJECTED'] };
        }

        const registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, code: true, email: true } },
                topic: { select: { id: true, title: true } },
                _count: { select: { tasks: true, submissions: true } },
                milestones: { select: { status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Tính progress cho mỗi đăng ký
        const enhanced = registrations.map((reg) => {
            const milestones = reg.milestones || [];
            const passed = milestones.filter(m => m.status === 'PASSED').length;
            const progress = milestones.length > 0 ? Math.round((passed / milestones.length) * 100) : 0;

            return { ...reg, progress, milestones: undefined };
        });

        res.json({ success: true, data: enhanced });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/registrations/:id/approve
 * GV duyệt/từ chối đăng ký đề tài của SV
 * Body: { action: 'APPROVE' | 'REJECT', rejectReason?: string }
 */
const handleRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, rejectReason } = req.body;
        const { role, id: userId } = req.user;

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Hành động phải là APPROVE hoặc REJECT.' });
        }

        const reg = await prisma.topicRegistration.findUnique({
            where: { id: parseInt(id) },
            include: {
                topic: { include: { mentor: { select: { id: true, academicTitle: true } } } },
                student: { select: { id: true, fullName: true, code: true } },
            },
        });

        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: `Đăng ký đang ở trạng thái: ${reg.status}. Chỉ xử lý khi PENDING.` });
        }

        // GV chỉ duyệt SV trong đề tài mình hướng dẫn
        if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt đăng ký này.' });
        }

        if (action === 'APPROVE') {
            // Kiểm tra quota GV
            const mentor = reg.topic.mentor;
            const maxSlots = getMentorMaxSlots(mentor?.academicTitle);
            const currentCount = await prisma.topicRegistration.count({
                where: {
                    topic: { mentorId: mentor.id, semesterId: reg.semesterId },
                    status: { in: ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] },
                },
            });
            if (currentCount >= maxSlots) {
                return res.status(400).json({ success: false, message: `Đã đạt giới hạn ${maxSlots} sinh viên hướng dẫn.` });
            }

            await prisma.topicRegistration.update({
                where: { id: parseInt(id) },
                data: { status: 'APPROVED' },
            });

            // Notify SV
            await prisma.notification.create({
                data: {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài được duyệt',
                    content: `Đề tài "${reg.topic.title}" đã được phê duyệt. Bạn có thể bắt đầu thực hiện.`,
                    type: 'APPROVAL',
                },
            });
        } else {
            if (!rejectReason) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
            }

            await prisma.topicRegistration.update({
                where: { id: parseInt(id) },
                data: { status: 'REJECTED', rejectReason },
            });

            // Notify SV
            await prisma.notification.create({
                data: {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài bị từ chối',
                    content: `Đề tài "${reg.topic.title}" bị từ chối. Lý do: ${rejectReason}. Bạn có thể đăng ký đề tài khác.`,
                    type: 'APPROVAL',
                },
            });
        }

        res.json({
            success: true,
            message: action === 'APPROVE' ? 'Đã phê duyệt đăng ký.' : 'Đã từ chối đăng ký.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/registrations/:id
 * SV hủy đăng ký (chỉ khi PENDING)
 */
const cancelRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;

        const reg = await prisma.topicRegistration.findUnique({ where: { id: parseInt(id) } });

        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (reg.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đăng ký này.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đăng ký khi đang chờ duyệt.' });
        }

        await prisma.topicRegistration.delete({ where: { id: parseInt(id) } });

        res.json({ success: true, message: 'Đã hủy đăng ký đề tài.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerTopic,
    getMyRegistration,
    getAllRegistrations,
    handleRegistration,
    cancelRegistration,
};
