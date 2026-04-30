const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');
const { PENDING_REMINDER_DAYS } = require('../constants/registrationLimits');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');
const { getDefaultSemester } = require('../utils/semesterResolver');

const SERIALIZATION_ERROR_CODE = 'P2034';
const MENTOR_ACTIVE_REGISTRATION_STATUSES = ['PENDING', 'APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];
const MENTOR_APPROVED_REGISTRATION_STATUSES = ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];
const ACTIVE_NON_PENDING_STATUSES = ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];

const createHttpError = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const isSerializationConflict = (error) => error?.code === SERIALIZATION_ERROR_CODE;
const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;
const getPendingCutoffDate = (days = PENDING_REMINDER_DAYS) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
};

const fetchRegistrationWithContext = async (idInt) => prisma.topicRegistration.findUnique({
    where: { id: idInt },
    include: {
        topic: { include: { mentor: { select: { id: true, academicTitle: true } } } },
        student: { select: { id: true, fullName: true, code: true } },
        defenseResult: { select: { id: true } },
    },
});

/**
 * POST /api/registrations
 */
const registerTopic = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { topicId, semesterId } = req.body;
        const topicIdInt = parseInt(topicId, 10);
        const semesterIdInt = parseInt(semesterId, 10);

        if (!topicId || !semesterId) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn đề tài và đợt đồ án.' });
        }
        if (!Number.isInteger(topicIdInt)) {
            return res.status(400).json({ success: false, message: 'Đề tài không hợp lệ.' });
        }
        if (!Number.isInteger(semesterIdInt)) {
            return res.status(400).json({ success: false, message: 'Đợt đồ án không hợp lệ.' });
        }

        const semester = await prisma.semester.findUnique({
            where: { id: semesterIdInt },
            select: {
                id: true,
                startDate: true,
                registrationDeadline: true,
                registrationOpen: true,
            },
        });

        if (!semester) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đợt đồ án.' });
        }

        if (!semester.registrationOpen) {
            return res.status(400).json({
                success: false,
                message: 'Đợt đồ án hiện đang đóng đăng ký. Vui lòng liên hệ quản trị viên.',
            });
        }

        const now = new Date();
        if (semester.startDate && now < new Date(semester.startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Đợt đồ án chưa đến thời gian mở đăng ký.',
            });
        }

        if (semester.registrationDeadline && now > new Date(semester.registrationDeadline)) {
            return res.status(400).json({
                success: false,
                message: 'Đợt đồ án đã quá hạn đăng ký.',
            });
        }

        const { registration, mentorId, topicTitle } = await prisma.$transaction(async (tx) => {
            const existingReg = await tx.topicRegistration.findUnique({
                where: { studentId_semesterId: { studentId, semesterId: semesterIdInt } },
            });

            if (existingReg) {
                if (existingReg.status === 'REJECTED') {
                    await tx.topicRegistration.delete({ where: { id: existingReg.id } });
                } else {
                    throw createHttpError(
                        400,
                        'Bạn đã đăng ký đề tài trong kỳ này. Chỉ có thể đổi khi bị từ chối.',
                    );
                }
            }

            const topic = await tx.topic.findUnique({
                where: { id: topicIdInt },
                include: {
                    mentor: { select: { id: true, academicTitle: true } },
                    _count: { select: { registrations: true } },
                },
            });

            if (!topic || topic.status !== 'APPROVED') {
                throw createHttpError(400, 'Đề tài không tồn tại hoặc chưa được duyệt.');
            }

            if (topic.semesterId !== semesterIdInt) {
                throw createHttpError(400, 'Đề tài không thuộc đợt đăng ký hiện tại.');
            }

            if (topic._count.registrations >= 1) {
                throw createHttpError(400, 'Đề tài này đã có sinh viên đăng ký.');
            }

            const maxSlots = getMentorMaxSlots(topic.mentor?.academicTitle);
            const mentorStudentCount = await tx.topicRegistration.count({
                where: {
                    topic: { mentorId: topic.mentorId, semesterId: semesterIdInt },
                    status: { in: MENTOR_ACTIVE_REGISTRATION_STATUSES },
                },
            });

            if (mentorStudentCount >= maxSlots) {
                throw createHttpError(400, `Giảng viên đã đạt giới hạn hướng dẫn (${maxSlots} sinh viên).`);
            }

            const created = await tx.topicRegistration.create({
                data: {
                    topicId: topicIdInt,
                    studentId,
                    semesterId: semesterIdInt,
                    status: 'PENDING',
                },
                include: {
                    topic: { select: { title: true, mentor: { select: { fullName: true } } } },
                },
            });

            return {
                registration: created,
                mentorId: topic.mentorId,
                topicTitle: topic.title,
            };
        }, { isolationLevel: 'Serializable' });

        await safeNotify(
            {
                userId: mentorId,
                title: 'Sinh viên đăng ký đề tài',
                content: `${req.user.fullName} (${req.user.code}) đã đăng ký đề tài "${topicTitle}".`,
                type: 'REGISTRATION',
            },
            'registerTopic',
        );

        res.status(201).json({
            success: true,
            message: 'Đăng ký đề tài thành công! Chờ giảng viên phê duyệt.',
            data: registration,
        });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Có xung đột khi đăng ký do thao tác đồng thời. Vui lòng thử lại.',
            });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * GET /api/registrations/my
 */
const getMyRegistration = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const semesterIdQuery = req.query.semesterId ? parseInt(req.query.semesterId, 10) : null;
        let targetSemesterId = semesterIdQuery;

        if (!targetSemesterId) {
            const defaultSemester = await getDefaultSemester({ id: true });
            targetSemesterId = defaultSemester?.id || null;
        }

        if (!targetSemesterId) {
            return res.json({
                success: true,
                data: null,
                message: 'Hiện chưa có đợt đồ án đang hoạt động.',
            });
        }

        const registration = await prisma.topicRegistration.findFirst({
            where: {
                studentId,
                semesterId: targetSemesterId,
            },
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
 */
const getAllRegistrations = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { semesterId, status, unassignedCouncilOnly, stalePendingOnly } = req.query;

        const where = {};

        if (role === 'LECTURER') {
            where.topic = { mentorId: userId };
        }

        if (semesterId) {
            where.semesterId = parseInt(semesterId, 10);
        } else if (role === 'LECTURER') {
            const defaultSemester = await getDefaultSemester({ id: true });
            if (!defaultSemester) {
                return res.json({ success: true, data: [] });
            }
            where.semesterId = defaultSemester.id;
        }

        if (status) {
            where.status = status;
        }

        if (unassignedCouncilOnly === 'true') {
            where.councilId = null;
            where.status = { in: ['SUBMITTED', 'DEFENDED', 'COMPLETED'] };
        }

        if (stalePendingOnly === 'true') {
            where.status = 'PENDING';
            where.createdAt = { lte: getPendingCutoffDate() };
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

        const registrationIds = registrations.map((reg) => reg.id);
        const overdueCounts = registrationIds.length > 0
            ? await prisma.task.groupBy({
                by: ['registrationId'],
                where: {
                    registrationId: { in: registrationIds },
                    dueDate: { lt: new Date() },
                    status: { in: ['OPEN', 'IN_PROGRESS'] },
                },
                _count: { _all: true },
            })
            : [];

        const overdueCountMap = new Map(
            overdueCounts.map((item) => [item.registrationId, item._count._all || 0]),
        );

        const now = new Date();
        const enhanced = registrations.map((reg) => {
            const milestones = reg.milestones || [];
            const passed = milestones.filter((milestone) => milestone.status === 'PASSED').length;
            const progress = milestones.length > 0 ? Math.round((passed / milestones.length) * 100) : 0;
            const overdueTaskCount = overdueCountMap.get(reg.id) || 0;
            const pendingDays = reg.status === 'PENDING'
                ? Math.floor((now.getTime() - new Date(reg.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            return {
                ...reg,
                progress,
                overdueTaskCount,
                hasOverdueTask: overdueTaskCount > 0,
                isStalePending: reg.status === 'PENDING' && pendingDays > PENDING_REMINDER_DAYS,
                pendingDays,
                milestones: undefined,
            };
        });

        res.json({ success: true, data: enhanced });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/registrations/:id/approve
 */
const handleRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const idInt = parseInt(id, 10);
        const { action, rejectReason } = req.body;
        const { role, id: userId } = req.user;

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Hành động phải là APPROVE hoặc REJECT.' });
        }

        if (action === 'APPROVE') {
            const reg = await prisma.$transaction(async (tx) => {
                const currentReg = await tx.topicRegistration.findUnique({
                    where: { id: idInt },
                    include: {
                        topic: { include: { mentor: { select: { id: true, academicTitle: true } } } },
                        student: { select: { id: true, fullName: true, code: true } },
                    },
                });

                if (!currentReg) {
                    throw createHttpError(404, 'Không tìm thấy đăng ký.');
                }

                if (currentReg.status !== 'PENDING') {
                    throw createHttpError(400, `Đăng ký đang ở trạng thái: ${currentReg.status}. Chỉ xử lý khi PENDING.`);
                }

                if (role === 'LECTURER' && currentReg.topic.mentorId !== userId) {
                    throw createHttpError(403, 'Bạn không có quyền duyệt đăng ký này.');
                }

                const mentor = currentReg.topic.mentor;
                const maxSlots = getMentorMaxSlots(mentor?.academicTitle);
                const currentCount = await tx.topicRegistration.count({
                    where: {
                        topic: { mentorId: mentor.id, semesterId: currentReg.semesterId },
                        status: { in: MENTOR_APPROVED_REGISTRATION_STATUSES },
                    },
                });

                if (currentCount >= maxSlots) {
                    throw createHttpError(400, `Đã đạt giới hạn ${maxSlots} sinh viên hướng dẫn.`);
                }

                await tx.topicRegistration.update({
                    where: { id: idInt },
                    data: { status: 'APPROVED', rejectReason: null },
                });

                return currentReg;
            }, { isolationLevel: 'Serializable' });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài được duyệt',
                    content: `Đề tài "${reg.topic.title}" đã được phê duyệt. Bạn có thể bắt đầu thực hiện.`,
                    type: 'APPROVAL',
                },
                'handleRegistration_APPROVE',
            );

            await auditLog(
                userId,
                'APPROVE_REGISTRATION',
                'TopicRegistration',
                idInt,
                { byRole: role },
                getRequestIp(req),
            );
        } else {
            const reg = await fetchRegistrationWithContext(idInt);

            if (!reg) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
            }

            if (reg.status !== 'PENDING') {
                return res.status(400).json({ success: false, message: `Đăng ký đang ở trạng thái: ${reg.status}. Chỉ xử lý khi PENDING.` });
            }

            if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt đăng ký này.' });
            }

            if (!rejectReason) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối.' });
            }

            await prisma.topicRegistration.update({
                where: { id: idInt },
                data: { status: 'REJECTED', rejectReason },
            });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài bị từ chối',
                    content: `Đề tài "${reg.topic.title}" bị từ chối. Lý do: ${rejectReason}. Bạn có thể đăng ký đề tài khác.`,
                    type: 'APPROVAL',
                },
                'handleRegistration_REJECT',
            );

            await auditLog(
                userId,
                'REJECT_REGISTRATION',
                'TopicRegistration',
                idInt,
                { byRole: role, reason: rejectReason },
                getRequestIp(req),
            );
        }

        res.json({
            success: true,
            message: action === 'APPROVE' ? 'Đã phê duyệt đăng ký.' : 'Đã từ chối đăng ký.',
        });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Có xung đột khi duyệt đăng ký do thao tác đồng thời. Vui lòng thử lại.',
            });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * PATCH /api/registrations/:id/drop
 */
const dropRegistration = async (req, res, next) => {
    try {
        const idInt = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const { role, id: userId } = req.user;

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Lý do drop là bắt buộc.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền drop đăng ký này.' });
        }

        if (!['APPROVED', 'IN_PROGRESS', 'SUBMITTED'].includes(reg.status)) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ được drop khi trạng thái là APPROVED, IN_PROGRESS hoặc SUBMITTED.',
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.topicRegistration.update({
                where: { id: idInt },
                data: {
                    status: 'DROPPED',
                    rejectReason: String(reason).trim(),
                    councilId: null,
                },
            });

            await tx.task.updateMany({
                where: {
                    registrationId: idInt,
                    status: { not: 'COMPLETED' },
                },
                data: { status: 'OVERDUE' },
            });
        });

        await safeNotify(
            {
                userId: reg.studentId,
                title: 'Đăng ký đồ án bị hủy',
                content: `Đăng ký đề tài "${reg.topic.title}" đã bị hủy. Lý do: ${reason}`,
                type: 'APPROVAL',
            },
            'dropRegistration',
        );

        await auditLog(
            userId,
            'DROP_REGISTRATION',
            'TopicRegistration',
            idInt,
            { byRole: role, reason: String(reason).trim() },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã drop đăng ký thành công.' });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/registrations/:id/withdraw
 */
const withdrawRegistration = async (req, res, next) => {
    try {
        const idInt = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const { role, id: userId } = req.user;

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Lý do rút đăng ký là bắt buộc.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        const canAccess = role === 'ADMIN'
            || (role === 'STUDENT' && reg.studentId === userId)
            || (role === 'LECTURER' && reg.topic.mentorId === userId);

        if (!canAccess) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền rút đăng ký này.' });
        }

        if (reg.defenseResult) {
            return res.status(400).json({ success: false, message: 'Không thể rút đăng ký đã có kết quả bảo vệ.' });
        }

        if (!ACTIVE_NON_PENDING_STATUSES.includes(reg.status)) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ được rút đăng ký ở trạng thái APPROVED, IN_PROGRESS, SUBMITTED, DEFENDED hoặc COMPLETED.',
            });
        }

        await prisma.topicRegistration.update({
            where: { id: idInt },
            data: {
                status: 'WITHDRAWN',
                rejectReason: String(reason).trim(),
                councilId: null,
            },
        });

        await safeNotify(
            {
                userId: role === 'STUDENT' ? reg.topic.mentorId : reg.studentId,
                title: 'Yêu cầu rút đăng ký đề tài',
                content: `${role === 'STUDENT' ? reg.student.fullName : 'Giảng viên/Admin'} đã rút đăng ký đề tài "${reg.topic.title}". Lý do: ${reason}`,
                type: 'REGISTRATION',
            },
            'withdrawRegistration',
        );

        await auditLog(
            userId,
            'WITHDRAW_REGISTRATION',
            'TopicRegistration',
            idInt,
            { byRole: role, reason: String(reason).trim() },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã rút đăng ký thành công.' });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/registrations/:id/force-decision
 */
const forceDecisionRegistration = async (req, res, next) => {
    try {
        const idInt = parseInt(req.params.id, 10);
        const { action, rejectReason } = req.body;
        const adminId = req.user.id;

        if (!['FORCE_APPROVE', 'FORCE_REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phải là FORCE_APPROVE hoặc FORCE_REJECT.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chỉ force decision được với đăng ký PENDING.' });
        }

        if (action === 'FORCE_APPROVE') {
            await prisma.$transaction(async (tx) => {
                const maxSlots = getMentorMaxSlots(reg.topic.mentor?.academicTitle);
                const currentCount = await tx.topicRegistration.count({
                    where: {
                        topic: { mentorId: reg.topic.mentorId, semesterId: reg.semesterId },
                        status: { in: MENTOR_APPROVED_REGISTRATION_STATUSES },
                    },
                });

                if (currentCount >= maxSlots) {
                    throw createHttpError(400, `Đã đạt giới hạn ${maxSlots} sinh viên hướng dẫn.`);
                }

                await tx.topicRegistration.update({
                    where: { id: idInt },
                    data: { status: 'APPROVED', rejectReason: null },
                });
            }, { isolationLevel: 'Serializable' });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài được duyệt bởi Admin',
                    content: `Admin đã force-approve đăng ký đề tài "${reg.topic.title}".`,
                    type: 'APPROVAL',
                },
                'forceDecisionRegistration_FORCE_APPROVE',
            );
        } else {
            if (!rejectReason || !String(rejectReason).trim()) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do force reject.' });
            }

            await prisma.topicRegistration.update({
                where: { id: idInt },
                data: { status: 'REJECTED', rejectReason: String(rejectReason).trim() },
            });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Đăng ký đề tài bị từ chối bởi Admin',
                    content: `Admin đã force-reject đăng ký đề tài "${reg.topic.title}". Lý do: ${rejectReason}`,
                    type: 'APPROVAL',
                },
                'forceDecisionRegistration_FORCE_REJECT',
            );
        }

        await auditLog(
            adminId,
            action,
            'TopicRegistration',
            idInt,
            { reason: rejectReason || null },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Đã xử lý force decision thành công.' });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Có xung đột khi force approve do thao tác đồng thời. Vui lòng thử lại.',
            });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * DELETE /api/registrations/:id
 */
const cancelRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;
        const idInt = parseInt(id, 10);

        const reg = await prisma.topicRegistration.findUnique({ where: { id: idInt } });

        if (!reg) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (reg.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đăng ký này.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đăng ký khi đang chờ duyệt.' });
        }

        await prisma.topicRegistration.delete({ where: { id: idInt } });

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
    dropRegistration,
    withdrawRegistration,
    forceDecisionRegistration,
    cancelRegistration,
};
