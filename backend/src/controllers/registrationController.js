const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');
const { PENDING_REMINDER_DAYS } = require('../constants/registrationLimits');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');
const { getDefaultSemester } = require('../utils/semesterResolver');
const { hasCompletedGraduationProject, STUDENT_RESTRICTION_MESSAGE } = require('../utils/studentAccountRestriction');

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
        const restricted = await hasCompletedGraduationProject(studentId);

        if (restricted) {
            return res.status(403).json({ success: false, message: STUDENT_RESTRICTION_MESSAGE });
        }

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
                    projectCatalog: { select: { id: true, name: true } },
                },
            });

            if (!topic || topic.status !== 'APPROVED') {
                throw createHttpError(400, 'Đề tài không tồn tại hoặc chưa được duyệt.');
            }

            if (topic.semesterId !== semesterIdInt) {
                throw createHttpError(400, 'Đề tài không thuộc đợt đăng ký hiện tại.');
            }

            if (!topic.projectCatalogId) {
                throw createHttpError(400, 'Đề tài chưa được gắn tên đồ án. Vui lòng liên hệ quản trị viên.');
            }

            const enrollment = await tx.studentProjectEnrollment.findFirst({
                where: {
                    studentId,
                    semesterId: semesterIdInt,
                    projectCatalogId: topic.projectCatalogId,
                    status: 'ACTIVE',
                },
                select: { id: true },
            });

            if (!enrollment) {
                throw createHttpError(
                    400,
                    `Bạn chưa đăng ký môn "${topic.projectCatalog?.name || 'đồ án này'}" trong đợt hiện tại nên không thể đăng ký đề tài.`,
                );
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
                    topic: {
                        select: {
                            title: true,
                            mentor: { select: { fullName: true } },
                            projectCatalog: { select: { id: true, name: true } },
                        },
                    },
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
        const restricted = await hasCompletedGraduationProject(studentId);

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
                meetingLogs: {
                    include: {
                        creator: { select: { fullName: true, code: true } },
                    },
                    orderBy: { meetingDate: 'desc' },
                },
                tasks: {
                    include: { submissions: { where: { submittedBy: studentId } } },
                    orderBy: { dueDate: 'asc' },
                },
                council: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                outlineCouncil: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                defenseCouncil: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
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
 * GET /api/registrations/my-project-enrollments
 */
const getMyProjectEnrollments = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const semesterIdQuery = req.query.semesterId ? parseInt(req.query.semesterId, 10) : null;
        let targetSemesterId = semesterIdQuery;
        const restricted = await hasCompletedGraduationProject(studentId);

        if (!targetSemesterId) {
            const defaultSemester = await getDefaultSemester({ id: true });
            targetSemesterId = defaultSemester?.id || null;
        }

        if (!targetSemesterId) {
            return res.json({
                success: true,
                data: [],
                meta: {
                    semesterId: null,
                    accountRestricted: restricted,
                    accountRestrictionReason: restricted ? STUDENT_RESTRICTION_MESSAGE : null,
                },
                message: 'Hiện chưa có đợt đồ án hoạt động.',
            });
        }

        const rows = await prisma.studentProjectEnrollment.findMany({
            where: {
                studentId,
                semesterId: targetSemesterId,
            },
            include: {
                projectCatalog: { select: { id: true, code: true, name: true, isActive: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json({
            success: true,
            data: rows,
            meta: {
                semesterId: targetSemesterId,
                accountRestricted: restricted,
                accountRestrictionReason: restricted ? STUDENT_RESTRICTION_MESSAGE : null,
            },
        });
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
        const { semesterId, status, unassignedCouncilOnly, councilType, stalePendingOnly } = req.query;

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
            if (councilType === 'OUTLINE_REVIEW') {
                where.outlineCouncilId = null;
                where.status = { in: ['REGISTERED', 'BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'APPROVED', 'IN_PROGRESS'] };
            } else {
                where.defenseCouncilId = null;
                where.status = { in: ['DEFENSE_READY', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] };
            }
        }

        if (stalePendingOnly === 'true') {
            where.status = 'PENDING';
            where.createdAt = { lte: getPendingCutoffDate() };
        }

        const registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, code: true, email: true } },
                topic: { select: { id: true, title: true, mentorId: true, mentor: { select: { id: true, fullName: true } } } },
                council: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                outlineCouncil: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                defenseCouncil: { select: { id: true, name: true, councilType: true, defenseDate: true, location: true } },
                _count: { select: { submissions: true } },
                tasks: { select: { id: true, status: true, isBypassed: true, taskType: true } },
                meetingLogs: { select: { id: true, meetingDate: true }, orderBy: { meetingDate: 'desc' } },
                bm04Evaluation: true,
                titleAdjustments: { orderBy: { requestedAt: 'desc' } },
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
            const tasks = reg.tasks || [];
            const completedOrBypassed = tasks.filter((t) => t.status === 'COMPLETED' || t.isBypassed).length;
            const progress = tasks.length > 0 ? Math.round((completedOrBypassed / tasks.length) * 100) : 0;
            const overdueTaskCount = overdueCountMap.get(reg.id) || 0;
            const pendingDays = reg.status === 'PENDING'
                ? Math.floor((now.getTime() - new Date(reg.createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            const meetingLogs = reg.meetingLogs || [];
            const lastMeetingDate = meetingLogs.length > 0 ? meetingLogs[0].meetingDate : null;
            let daysSinceLastMeeting = null;
            if (lastMeetingDate) {
                daysSinceLastMeeting = Math.floor((now.getTime() - new Date(lastMeetingDate).getTime()) / (1000 * 60 * 60 * 24));
            }

            return {
                ...reg,
                progress,
                overdueTaskCount,
                hasOverdueTask: overdueTaskCount > 0,
                isStalePending: reg.status === 'PENDING' && pendingDays > PENDING_REMINDER_DAYS,
                pendingDays,
                totalMeetings: meetingLogs.length,
                lastMeetingDate,
                daysSinceLastMeeting,
                isMeetingWarning: daysSinceLastMeeting !== null && daysSinceLastMeeting > 21,
                tasks: undefined,
                meetingLogs: undefined,
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

/**
 * PATCH /api/registrations/:id/outline-review
 * Cập nhật kết quả xét duyệt đề cương của Hội đồng
 */
const updateOutlineReview = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, feedback } = req.body;

        const registrationId = parseInt(id, 10);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'ID đăng ký không hợp lệ.' });
        }

        const validStatuses = ['PENDING', 'PASSED', 'REVISION_REQUIRED', 'FAILED'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái xét duyệt đề cương không hợp lệ.' });
        }

        const existing = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                outlineCouncil: {
                    include: { members: true },
                },
            },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy lượt đăng ký.' });
        }

        const isSuperAdmin = req.user.role === 'ADMIN';
        const isCouncilMember = existing.outlineCouncil?.members?.some((m) => m.lecturerId === req.user.id);

        if (!isSuperAdmin && !isCouncilMember) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền cập nhật kết quả xét duyệt đề cương này.',
            });
        }

        let nextRegistrationStatus = existing.status;
        if (status === 'PASSED') {
            nextRegistrationStatus = 'BM01_PASSED';
        } else if (status === 'REVISION_REQUIRED' || status === 'FAILED') {
            nextRegistrationStatus = 'BM01_NEEDS_REVISION';
        }

        const updated = await prisma.$transaction(async (tx) => {
            const regUpdated = await tx.topicRegistration.update({
                where: { id: registrationId },
                data: {
                    ...(status ? { outlineReviewStatus: status, status: nextRegistrationStatus } : {}),
                    ...(feedback !== undefined ? { outlineFeedback: feedback } : {}),
                },
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    outlineCouncil: { select: { id: true, name: true } },
                    topic: { select: { id: true, title: true } },
                },
            });

            if (status === 'PASSED') {
                await tx.task.updateMany({
                    where: { registrationId, taskType: 'BM01' },
                    data: { status: 'COMPLETED' },
                });
            } else if (status === 'REVISION_REQUIRED') {
                await tx.task.updateMany({
                    where: { registrationId, taskType: 'BM01' },
                    data: { status: 'REVISION' },
                });
            }

            return regUpdated;
        });

        if (status && existing.studentId) {
            await safeNotify(
                {
                    userId: existing.studentId,
                    title: status === 'PASSED' ? 'Đề cương BM01 đã được Hội đồng chấm ĐẠT' : 'Đề cương BM01 cần chỉnh sửa và thẩm định lại',
                    content: status === 'PASSED'
                        ? `Hội đồng xét duyệt đề cương đã chấm ĐẠT cho đề tài "${existing.topic?.title || ''}". Bạn có thể tiến hành nộp BM02.`
                        : `Hội đồng xét duyệt đề cương yêu cầu chỉnh sửa đề cương. Góp ý: ${feedback || 'Vui lòng sửa và nộp lại cho GVHD thẩm định.'}`,
                    type: 'APPROVAL',
                },
                'updateOutlineReview',
            );
        }

        res.json({
            success: true,
            message: status === 'PASSED'
                ? 'Đã ghi nhận kết quả ĐẠT cho đề cương. Đề tài chuyển sang trạng thái BM01_PASSED.'
                : 'Đã ghi nhận yêu cầu chỉnh sửa đề cương. Đề tài chuyển sang trạng thái BM01_NEEDS_REVISION.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/registrations/:id/bm04-review
 * GVHD lập phiếu nhận xét BM04 và đưa ra quyết định Gatekeeping (AGREED / DISAGREED)
 */
const reviewBM04 = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.id, 10);
        const { decision, feedback, score } = req.body;
        const { id: userId, role } = req.user;

        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'ID đăng ký không hợp lệ.' });
        }

        if (!['AGREED', 'DISAGREED'].includes(decision)) {
            return res.status(400).json({
                success: false,
                message: 'Quyết định BM04 bắt buộc phải là AGREED (Đồng ý bảo vệ) hoặc DISAGREED (Không đồng ý).',
            });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: { select: { mentorId: true, title: true } },
                student: { select: { id: true, fullName: true, code: true } },
                meetingLogs: { orderBy: { meetingDate: 'desc' } },
                tasks: {
                    where: { taskType: { in: ['BM03_CHECKPOINT_1', 'BM03_CHECKPOINT_2', 'BM03_CHECKPOINT'] } },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Đăng ký đề tài không tồn tại.' });
        }

        if (role !== 'ADMIN' && registration.topic?.mentorId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ Giảng viên hướng dẫn trực tiếp mới có quyền lập Phiếu nhận xét BM04.',
            });
        }

        // Must be in active progress
        if (!['IN_PROGRESS', 'APPROVED'].includes(registration.status)) {
            return res.status(400).json({
                success: false,
                message: `Đăng ký đang ở trạng thái "${registration.status}", không thể lập phiếu BM04.`,
            });
        }

        const meetingCount = registration.meetingLogs?.length || 0;
        const labCount = registration.meetingLogs?.filter((m) => m.meetingType === 'LAB').length || 0;
        const onlineCount = registration.meetingLogs?.filter((m) => m.meetingType === 'ONLINE').length || 0;

        const summaryEvidence = `Tổng số buổi làm việc ghi nhận: ${meetingCount} buổi (${labCount} buổi tại Lab, ${onlineCount} buổi online).`;
        const fullFeedback = `${summaryEvidence}\nNhận xét GVHD: ${feedback ? feedback.trim() : 'Đạt yêu cầu bảo vệ.'}`;

        const nextStatus = decision === 'AGREED' ? 'SUBMITTED' : 'DROPPED';

        const updated = await prisma.topicRegistration.update({
            where: { id: registrationId },
            data: {
                status: nextStatus,
                outlineFeedback: fullFeedback,
            },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { id: true, title: true } },
            },
        });

        // Notify student
        await safeNotify({
            userId: registration.studentId,
            title: decision === 'AGREED' ? 'GVHD đã duyệt ĐỒNG Ý cho ra bảo vệ (BM04)' : 'GVHD đánh giá KHÔNG ĐỒNG Ý cho ra bảo vệ (BM04)',
            content: decision === 'AGREED'
                ? `Chúc mừng bạn! Thầy/Cô đã ký phiếu nhận xét BM04 ĐỒNG Ý cho đề tài "${registration.topic.title}" ra Hội đồng bảo vệ.`
                : 'Thầy/Cô đánh giá chưa đủ điều kiện cho ra bảo vệ đồ án kỳ này. Vui lòng liên hệ GVHD để biết thêm chi tiết.',
            type: 'DEFENSE',
        }, 'reviewBM04');

        await auditLog(
            userId,
            'REVIEW_BM04',
            'TopicRegistration',
            registrationId,
            { decision, score, meetingCount, fullFeedback },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: decision === 'AGREED'
                ? 'Đã lập phiếu BM04 thành công: ĐỒNG Ý cho sinh viên ra Hội đồng bảo vệ.'
                : 'Đã lập phiếu BM04: Đánh giá KHÔNG ĐỒNG Ý bảo vệ.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/registrations/:id/bypass-outline
 * Quản trị viên / Viện Trưởng phê duyệt miễn thẩm định đề cương (Bypass BM01-BM02)
 */
const bypassOutlineReview = async (req, res, next) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ Quản trị viên / Viện Trưởng mới có quyền phê duyệt miễn thẩm định đề cương.',
            });
        }

        const registrationId = parseInt(req.params.id, 10);
        const { reason } = req.body;
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'ID đăng ký không hợp lệ.' });
        }
        if (!reason || !String(reason).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập lý do miễn thẩm định đề cương (Bypass BM01-BM02).',
            });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { id: true, title: true, mentorId: true } },
                tasks: true,
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký đề tài.' });
        }

        if (['REJECTED', 'DROPPED', 'WITHDRAWN'].includes(registration.status)) {
            return res.status(400).json({
                success: false,
                message: `Đăng ký đang ở trạng thái "${registration.status}", không thể thực hiện miễn thẩm định đề cương.`,
            });
        }

        const cleanReason = String(reason).trim();
        const auditDetails = {
            previousStatus: registration.status,
            previousOutlineReviewStatus: registration.outlineReviewStatus,
            reason: cleanReason,
            bypassedBy: req.user.id,
        };

        const result = await prisma.$transaction(async (tx) => {
            // 1. Cập nhật đăng ký: status -> IN_PROGRESS, outlineReviewStatus -> PASSED
            const updatedRegistration = await tx.topicRegistration.update({
                where: { id: registrationId },
                data: {
                    status: 'IN_PROGRESS',
                    outlineReviewStatus: 'PASSED',
                    outlineFeedback: `[MIỄN THẨM ĐỊNH / BYPASS BM01-BM02]: ${cleanReason}`,
                },
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    topic: { select: { id: true, title: true, mentor: { select: { id: true, fullName: true } } } },
                },
            });

            // 2. Cập nhật hoặc khởi tạo các task BM01/BM02 đánh dấu isBypassed = true
            const bmTasks = registration.tasks.filter((t) => ['BM01', 'BM02'].includes(t.taskType));
            if (bmTasks.length > 0) {
                await tx.task.updateMany({
                    where: {
                        id: { in: bmTasks.map((t) => t.id) },
                    },
                    data: {
                        status: 'COMPLETED',
                        isBypassed: true,
                        bypassReason: cleanReason,
                        bypassedBy: req.user.id,
                    },
                });
            } else {
                await tx.task.createMany({
                    data: [
                        {
                            registrationId,
                            title: 'BM01: Đề cương đề tài (Miễn thẩm định)',
                            content: `Được miễn thẩm định theo quyết định của Viện/Khoa. Lý do: ${cleanReason}`,
                            taskType: 'BM01',
                            status: 'COMPLETED',
                            isBypassed: true,
                            bypassReason: cleanReason,
                            bypassedBy: req.user.id,
                        },
                        {
                            registrationId,
                            title: 'BM02: Đơn đăng ký đề tài chính thức (Miễn thẩm định)',
                            content: `Được miễn thẩm định theo quyết định của Viện/Khoa. Lý do: ${cleanReason}`,
                            taskType: 'BM02',
                            status: 'COMPLETED',
                            isBypassed: true,
                            bypassReason: cleanReason,
                            bypassedBy: req.user.id,
                        },
                    ],
                });
            }

            // 3. Tự động sinh sẵn nhiệm vụ BM03 Checkpoint nếu chưa tồn tại
            const hasBm03Checkpoint1 = registration.tasks.some((t) => t.taskType === 'BM03_CHECKPOINT_1');
            const hasBm03Checkpoint2 = registration.tasks.some((t) => t.taskType === 'BM03_CHECKPOINT_2');
            const tasksToCreate = [];
            if (!hasBm03Checkpoint1) {
                tasksToCreate.push({
                    registrationId,
                    title: 'BM03: Báo cáo tiến độ Đợt 1 (Checkpoint 1)',
                    content: 'Báo cáo tiến độ nghiên cứu và sản phẩm giai đoạn 1 với Giảng viên hướng dẫn.',
                    taskType: 'BM03_CHECKPOINT_1',
                    status: 'OPEN',
                });
            }
            if (!hasBm03Checkpoint2) {
                tasksToCreate.push({
                    registrationId,
                    title: 'BM03: Báo cáo tiến độ Đợt 2 (Checkpoint 2)',
                    content: 'Báo cáo tiến độ hoàn thiện hệ thống giai đoạn 2 trước khi lập nhận xét BM04.',
                    taskType: 'BM03_CHECKPOINT_2',
                    status: 'OPEN',
                });
            }
            if (tasksToCreate.length > 0) {
                await tx.task.createMany({ data: tasksToCreate });
            }

            return updatedRegistration;
        });

        // Gửi thông báo cho Sinh viên
        await safeNotify(
            {
                userId: registration.studentId,
                title: 'Đề tài được miễn thẩm định đề cương (Bypass BM01-BM02)',
                content: `Đề tài "${registration.topic.title}" đã được Viện Trưởng / Quản trị viên duyệt miễn thẩm định đề cương và chuyển sang trạng thái Đang thực hiện. Lý do: ${cleanReason}.`,
                type: 'APPROVAL',
            },
            'bypassOutlineReview_student',
        );

        // Gửi thông báo cho GVHD
        if (registration.topic?.mentorId) {
            await safeNotify(
                {
                    userId: registration.topic.mentorId,
                    title: 'Đề tài hướng dẫn được miễn thẩm định đề cương',
                    content: `Đề tài "${registration.topic.title}" của sinh viên ${registration.student?.fullName || ''} đã được duyệt miễn thẩm định BM01-BM02 và chuyển sang trạng thái Đang thực hiện (IN_PROGRESS).`,
                    type: 'APPROVAL',
                },
                'bypassOutlineReview_mentor',
            );
        }

        await auditLog(
            req.user.id,
            'BYPASS_OUTLINE_REVIEW',
            'TopicRegistration',
            registrationId,
            auditDetails,
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Đã phê duyệt miễn thẩm định đề cương (Bypass BM01-BM02) thành công. Đề tài chuyển sang trạng thái Đang thực hiện.',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/registrations/batch-bypass-outline
 * Quản trị viên / Viện Trưởng duyệt miễn thẩm định đề cương hàng loạt
 */
const batchBypassOutlineReview = async (req, res, next) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ Quản trị viên / Viện Trưởng mới có quyền phê duyệt miễn thẩm định đề cương.',
            });
        }

        const { registrationIds, reason } = req.body;
        if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'registrationIds phải là mảng có ít nhất 1 phần tử.',
            });
        }

        const cleanReason = reason && String(reason).trim()
            ? String(reason).trim()
            : 'Được miễn thẩm định theo quyết định đợt của Viện / Khoa.';

        const uniqueIds = [...new Set(
            registrationIds.map((v) => parseInt(v, 10)).filter((v) => Number.isInteger(v) && v > 0),
        )];

        if (uniqueIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có ID đăng ký hợp lệ.',
            });
        }

        let updatedCount = 0;
        const results = [];

        for (const regId of uniqueIds) {
            try {
                const registration = await prisma.topicRegistration.findUnique({
                    where: { id: regId },
                    include: {
                        student: { select: { id: true, fullName: true, code: true } },
                        topic: { select: { id: true, title: true, mentorId: true } },
                        tasks: true,
                    },
                });

                if (!registration || ['REJECTED', 'DROPPED', 'WITHDRAWN'].includes(registration.status)) {
                    results.push({ id: regId, success: false, reason: 'Trạng thái không hợp lệ hoặc không tìm thấy' });
                    continue;
                }

                await prisma.$transaction(async (tx) => {
                    await tx.topicRegistration.update({
                        where: { id: regId },
                        data: {
                            status: 'IN_PROGRESS',
                            outlineReviewStatus: 'PASSED',
                            outlineFeedback: `[MIỄN THẨM ĐỊNH / BYPASS BM01-BM02]: ${cleanReason}`,
                        },
                    });

                    const bmTasks = registration.tasks.filter((t) => ['BM01', 'BM02'].includes(t.taskType));
                    if (bmTasks.length > 0) {
                        await tx.task.updateMany({
                            where: { id: { in: bmTasks.map((t) => t.id) } },
                            data: {
                                status: 'COMPLETED',
                                isBypassed: true,
                                bypassReason: cleanReason,
                                bypassedBy: req.user.id,
                            },
                        });
                    } else {
                        await tx.task.createMany({
                            data: [
                                {
                                    registrationId: regId,
                                    title: 'BM01: Đề cương đề tài (Miễn thẩm định)',
                                    content: `Được miễn thẩm định theo quyết định của Viện/Khoa. Lý do: ${cleanReason}`,
                                    taskType: 'BM01',
                                    status: 'COMPLETED',
                                    isBypassed: true,
                                    bypassReason: cleanReason,
                                    bypassedBy: req.user.id,
                                },
                                {
                                    registrationId: regId,
                                    title: 'BM02: Đơn đăng ký đề tài chính thức (Miễn thẩm định)',
                                    content: `Được miễn thẩm định theo quyết định của Viện/Khoa. Lý do: ${cleanReason}`,
                                    taskType: 'BM02',
                                    status: 'COMPLETED',
                                    isBypassed: true,
                                    bypassReason: cleanReason,
                                    bypassedBy: req.user.id,
                                },
                            ],
                        });
                    }

                    // Ensure BM03 checkpoint tasks
                    const hasBm03Checkpoint1 = registration.tasks.some((t) => t.taskType === 'BM03_CHECKPOINT_1');
                    const hasBm03Checkpoint2 = registration.tasks.some((t) => t.taskType === 'BM03_CHECKPOINT_2');
                    const tasksToCreate = [];
                    if (!hasBm03Checkpoint1) {
                        tasksToCreate.push({
                            registrationId: regId,
                            title: 'BM03: Báo cáo tiến độ Đợt 1 (Checkpoint 1)',
                            content: 'Báo cáo tiến độ nghiên cứu và sản phẩm giai đoạn 1 với Giảng viên hướng dẫn.',
                            taskType: 'BM03_CHECKPOINT_1',
                            status: 'OPEN',
                        });
                    }
                    if (!hasBm03Checkpoint2) {
                        tasksToCreate.push({
                            registrationId: regId,
                            title: 'BM03: Báo cáo tiến độ Đợt 2 (Checkpoint 2)',
                            content: 'Báo cáo tiến độ hoàn thiện hệ thống giai đoạn 2 trước khi lập nhận xét BM04.',
                            taskType: 'BM03_CHECKPOINT_2',
                            status: 'OPEN',
                        });
                    }
                    if (tasksToCreate.length > 0) {
                        await tx.task.createMany({ data: tasksToCreate });
                    }
                });

                await safeNotify(
                    {
                        userId: registration.studentId,
                        title: 'Đề tài được miễn thẩm định đề cương (Bypass BM01-BM02)',
                        content: `Đề tài "${registration.topic.title}" đã được Viện Trưởng / Quản trị viên duyệt miễn thẩm định đề cương và chuyển sang trạng thái Đang thực hiện.`,
                        type: 'APPROVAL',
                    },
                    'batchBypassOutlineReview_student',
                );

                if (registration.topic?.mentorId) {
                    await safeNotify(
                        {
                            userId: registration.topic.mentorId,
                            title: 'Đề tài hướng dẫn được miễn thẩm định đề cương',
                            content: `Đề tài "${registration.topic.title}" của sinh viên ${registration.student?.fullName || ''} đã được duyệt miễn thẩm định BM01-BM02.`,
                            type: 'APPROVAL',
                        },
                        'batchBypassOutlineReview_mentor',
                    );
                }

                updatedCount++;
                results.push({ id: regId, success: true });
            } catch (err) {
                results.push({ id: regId, success: false, error: err.message });
            }
        }

        await auditLog(
            req.user.id,
            'BATCH_BYPASS_OUTLINE_REVIEW',
            'TopicRegistration',
            null,
            { totalRequested: uniqueIds.length, updatedCount, reason: cleanReason },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: `Đã duyệt miễn thẩm định đề cương thành công cho ${updatedCount}/${uniqueIds.length} đề tài.`,
            data: { updatedCount, totalRequested: uniqueIds.length, results },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/registrations/bm02-submit
 * Sinh viên nộp đơn đăng ký đề tài chính thức BM02 sau khi BM01 đã ĐẠT
 */
const submitBM02 = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { registrationId, officialTitle, content, fileUrl, fileName } = req.body;

        const regIdInt = parseInt(registrationId, 10);
        if (!Number.isInteger(regIdInt) || regIdInt <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: regIdInt },
            include: { topic: true, student: true },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        if (registration.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền nộp BM02 cho đề tài này.' });
        }

        const isBM01Passed = registration.outlineReviewStatus === 'PASSED' || registration.status === 'BM01_PASSED';
        if (!isBM01Passed) {
            return res.status(400).json({
                success: false,
                message: 'Đề cương BM01 chưa được chấm ĐẠT. Bạn cần hoàn thành xét duyệt BM01 trước khi nộp BM02.',
            });
        }

        let bm02Task = await prisma.task.findFirst({
            where: { registrationId: regIdInt, taskType: 'BM02' },
        });

        if (!bm02Task) {
            bm02Task = await prisma.task.create({
                data: {
                    registrationId: regIdInt,
                    title: 'BM02 - Phiếu giao nhiệm vụ đồ án',
                    content: 'Nộp phiếu giao nhiệm vụ đồ án chính thức có đầy đủ nội dung chi tiết và xác nhận từ GVHD.',
                    taskType: 'BM02',
                    status: 'COMPLETED',
                },
            });
        } else {
            await prisma.task.update({
                where: { id: bm02Task.id },
                data: { status: 'COMPLETED' },
            });
        }

        const submission = await prisma.submission.create({
            data: {
                taskId: bm02Task.id,
                registrationId: regIdInt,
                submittedBy: studentId,
                content: content || null,
                fileUrl: fileUrl || null,
                fileName: fileName || null,
            },
        });

        if (officialTitle && String(officialTitle).trim()) {
            await prisma.topic.update({
                where: { id: registration.topicId },
                data: { title: String(officialTitle).trim() },
            });
        }

        const updated = await prisma.topicRegistration.update({
            where: { id: regIdInt },
            data: {
                status: 'BM02_SUBMITTED',
            },
            include: { topic: true },
        });

        if (registration.topic?.mentorId) {
            await safeNotify(
                {
                    userId: registration.topic.mentorId,
                    title: 'Sinh viên đã nộp BM02 đăng ký đề tài chính thức',
                    content: `Sinh viên ${registration.student?.fullName || ''} đã nộp BM02 cho đề tài "${updated.topic.title}". Hồ sơ đang chờ Quyết định giao đề tài của Viện.`,
                    type: 'SUBMISSION',
                },
                'submitBM02',
            );
        }

        await auditLog(
            studentId,
            'SUBMIT_BM02',
            'TopicRegistration',
            regIdInt,
            { officialTitle: officialTitle || registration.topic.title, submissionId: submission.id },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Đã nộp đơn đăng ký đề tài chính thức BM02 thành công. Hồ sơ đang chờ Trưởng Viện ban hành Quyết định.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/registrations/adjust-title
 * Sinh viên gửi yêu cầu điều chỉnh tên đề tài trong thời hạn 7 ngày sau Quyết định của Viện
 */
const requestTitleAdjustment = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { registrationId, newTitle, reason } = req.body;

        const regIdInt = parseInt(registrationId, 10);
        if (!Number.isInteger(regIdInt) || regIdInt <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        if (!newTitle || !String(newTitle).trim()) {
            return res.status(400).json({ success: false, message: 'Tên đề tài mới không được để trống.' });
        }

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({ success: false, message: 'Lý do xin điều chỉnh tên đề tài là bắt buộc.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: regIdInt },
            include: { topic: true, student: true },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        if (registration.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xin điều chỉnh cho đề tài này.' });
        }

        if (!registration.decisionDate) {
            return res.status(400).json({
                success: false,
                message: 'Đề tài chưa có Quyết định giao đề tài chính thức từ Viện, chưa thể xin điều chỉnh tên.',
            });
        }

        const decisionTime = new Date(registration.decisionDate).getTime();
        const now = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const deadline = new Date(decisionTime + sevenDaysMs);

        if (now > deadline.getTime()) {
            return res.status(400).json({
                success: false,
                message: `Đã quá thời hạn 7 ngày cho phép điều chỉnh tên đề tài (Hạn chót: ${deadline.toLocaleDateString('vi-VN')}).`,
            });
        }

        const pendingAdjustment = await prisma.topicTitleAdjustment.findFirst({
            where: { registrationId: regIdInt, status: 'PENDING' },
        });

        if (pendingAdjustment) {
            return res.status(400).json({
                success: false,
                message: 'Bạn đã có một đơn xin đổi tên đề tài đang chờ GVHD xét duyệt.',
            });
        }

        const adjustment = await prisma.topicTitleAdjustment.create({
            data: {
                registrationId: regIdInt,
                originalTitle: registration.topic.title,
                newTitle: String(newTitle).trim(),
                reason: String(reason).trim(),
                deadline,
                status: 'PENDING',
            },
        });

        if (registration.topic?.mentorId) {
            await safeNotify(
                {
                    userId: registration.topic.mentorId,
                    title: 'Sinh viên xin điều chỉnh tên đề tài',
                    content: `Sinh viên ${registration.student?.fullName || ''} đã gửi đơn xin đổi tên đề tài từ "${registration.topic.title}" sang "${newTitle}". Vui lòng xem xét.`,
                    type: 'APPROVAL',
                },
                'requestTitleAdjustment',
            );
        }

        await auditLog(
            studentId,
            'REQUEST_TITLE_ADJUSTMENT',
            'TopicTitleAdjustment',
            adjustment.id,
            { registrationId: regIdInt, newTitle, reason },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Đã gửi đơn xin điều chỉnh tên đề tài thành công. Đang chờ GVHD phê duyệt.',
            data: adjustment,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/registrations/adjust-title/:id/review
 * GVHD phê duyệt hoặc từ chối đơn xin đổi tên đề tài
 */
const reviewTitleAdjustment = async (req, res, next) => {
    try {
        const adjustmentId = parseInt(req.params.id, 10);
        const { action, rejectionReason } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        if (!Number.isInteger(adjustmentId) || adjustmentId <= 0) {
            return res.status(400).json({ success: false, message: 'ID đơn điều chỉnh không hợp lệ.' });
        }

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phải là APPROVE hoặc REJECT.' });
        }

        const adjustment = await prisma.topicTitleAdjustment.findUnique({
            where: { id: adjustmentId },
            include: {
                registration: {
                    include: { topic: true, student: true },
                },
            },
        });

        if (!adjustment) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn xin điều chỉnh tên đề tài.' });
        }

        if (adjustment.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: `Đơn này đã được xử lý (trạng thái: ${adjustment.status}).` });
        }

        const isMentor = adjustment.registration.topic?.mentorId === userId;
        const isAdmin = role === 'ADMIN';

        if (!isMentor && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Chỉ giảng viên hướng dẫn của đề tài mới có quyền duyệt đơn này.' });
        }

        const isApproved = action === 'APPROVE';

        const updated = await prisma.$transaction(async (tx) => {
            const adjUpdated = await tx.topicTitleAdjustment.update({
                where: { id: adjustmentId },
                data: {
                    status: isApproved ? 'APPROVED' : 'REJECTED',
                    reviewedById: userId,
                    reviewedAt: new Date(),
                    rejectionReason: !isApproved ? (rejectionReason ? String(rejectionReason).trim() : 'Không đồng ý điều chỉnh') : null,
                },
            });

            if (isApproved) {
                await tx.topicRegistration.update({
                    where: { id: adjustment.registrationId },
                    data: { adjustedTitle: adjustment.newTitle },
                });

                await tx.topic.update({
                    where: { id: adjustment.registration.topicId },
                    data: { title: adjustment.newTitle },
                });
            }

            return adjUpdated;
        });

        await safeNotify(
            {
                userId: adjustment.registration.studentId,
                title: isApproved ? 'Đơn xin đổi tên đề tài đã được GVHD duyệt' : 'Đơn xin đổi tên đề tài bị từ chối',
                content: isApproved
                    ? `GVHD đã đồng ý đổi tên đề tài của bạn thành: "${adjustment.newTitle}". Tên này sẽ được áp dụng cho toàn bộ giai đoạn sau.`
                    : `GVHD đã từ chối yêu cầu đổi tên đề tài. Lý do: ${rejectionReason || 'Không chấp thuận'}`,
                type: 'APPROVAL',
            },
            'reviewTitleAdjustment',
        );

        await auditLog(
            userId,
            'REVIEW_TITLE_ADJUSTMENT',
            'TopicTitleAdjustment',
            adjustmentId,
            { action, newTitle: adjustment.newTitle },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: isApproved ? 'Đã duyệt thay đổi tên đề tài thành công.' : 'Đã từ chối đơn điều chỉnh tên đề tài.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/adjust-title/my
 * Sinh viên xem danh sách các yêu cầu điều chỉnh tên đề tài của mình
 */
const getMyTitleAdjustments = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const adjustments = await prisma.topicTitleAdjustment.findMany({
            where: {
                registration: { studentId },
            },
            include: {
                reviewedBy: { select: { id: true, fullName: true, email: true } },
                registration: {
                    include: { topic: { select: { id: true, title: true } } },
                },
            },
            orderBy: { requestedAt: 'desc' },
        });

        res.json({ success: true, data: adjustments });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/adjust-title/pending
 * GVHD xem danh sách các yêu cầu đổi tên đề tài đang chờ duyệt
 */
const getPendingTitleAdjustments = async (req, res, next) => {
    try {
        const lecturerId = req.user.id;
        const role = req.user.role;

        const whereClause = { status: 'PENDING' };
        if (role !== 'ADMIN') {
            whereClause.registration = { topic: { mentorId: lecturerId } };
        }

        const adjustments = await prisma.topicTitleAdjustment.findMany({
            where: whereClause,
            include: {
                registration: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true, email: true } },
                        topic: { select: { id: true, title: true } },
                    },
                },
            },
            orderBy: { requestedAt: 'asc' },
        });

        res.json({ success: true, data: adjustments });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    registerTopic,
    getMyRegistration,
    getMyProjectEnrollments,
    getAllRegistrations,
    handleRegistration,
    dropRegistration,
    withdrawRegistration,
    forceDecisionRegistration,
    cancelRegistration,
    updateOutlineReview,
    reviewBM04,
    bypassOutlineReview,
    batchBypassOutlineReview,
    submitBM02,
    requestTitleAdjustment,
    reviewTitleAdjustment,
    getMyTitleAdjustments,
    getPendingTitleAdjustments,
};
