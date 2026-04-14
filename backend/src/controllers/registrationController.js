const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');
const { PENDING_REMINDER_DAYS } = require('../constants/registrationLimits');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');

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

const getActiveSemester = async () => prisma.semester.findFirst({
    where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
    },
    orderBy: { startDate: 'desc' },
    select: { id: true },
});

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
            return res.status(400).json({ success: false, message: 'Vui long chon de tai va dot do an.' });
        }
        if (!Number.isInteger(topicIdInt)) {
            return res.status(400).json({ success: false, message: 'De tai khong hop le.' });
        }
        if (!Number.isInteger(semesterIdInt)) {
            return res.status(400).json({ success: false, message: 'Dot do an khong hop le.' });
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
            return res.status(404).json({ success: false, message: 'Khong tim thay dot do an.' });
        }

        if (!semester.registrationOpen) {
            return res.status(400).json({
                success: false,
                message: 'Dot do an hien dang dong dang ky. Vui long lien he quan tri vien.',
            });
        }

        const now = new Date();
        if (semester.startDate && now < new Date(semester.startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Dot do an chua den thoi gian mo dang ky.',
            });
        }

        if (semester.registrationDeadline && now > new Date(semester.registrationDeadline)) {
            return res.status(400).json({
                success: false,
                message: 'Dot do an da qua han dang ky.',
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
                        'Ban da dang ky de tai trong ky nay. Chi co the doi khi bi tu choi.',
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
                throw createHttpError(400, 'De tai khong ton tai hoac chua duoc duyet.');
            }

            if (topic.semesterId !== semesterIdInt) {
                throw createHttpError(400, 'De tai khong thuoc dot dang ky hien tai.');
            }

            if (topic._count.registrations >= 1) {
                throw createHttpError(400, 'De tai nay da co sinh vien dang ky.');
            }

            const maxSlots = getMentorMaxSlots(topic.mentor?.academicTitle);
            const mentorStudentCount = await tx.topicRegistration.count({
                where: {
                    topic: { mentorId: topic.mentorId, semesterId: semesterIdInt },
                    status: { in: MENTOR_ACTIVE_REGISTRATION_STATUSES },
                },
            });

            if (mentorStudentCount >= maxSlots) {
                throw createHttpError(400, `Giang vien da dat gioi han huong dan (${maxSlots} sinh vien).`);
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
                title: 'Sinh vien dang ky de tai',
                content: `${req.user.fullName} (${req.user.code}) da dang ky de tai "${topicTitle}".`,
                type: 'REGISTRATION',
            },
            'registerTopic',
        );

        res.status(201).json({
            success: true,
            message: 'Dang ky de tai thanh cong! Cho giang vien phe duyet.',
            data: registration,
        });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Co xung dot khi dang ky do thao tac dong thoi. Vui long thu lai.',
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
            const activeSemester = await getActiveSemester();
            targetSemesterId = activeSemester?.id || null;
        }

        if (!targetSemesterId) {
            return res.json({
                success: true,
                data: null,
                message: 'Hien chua co dot do an dang hoat dong.',
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
            return res.json({ success: true, data: null, message: 'Ban chua dang ky de tai nao.' });
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
            const activeSemester = await getActiveSemester();
            if (!activeSemester) {
                return res.json({ success: true, data: [] });
            }
            where.semesterId = activeSemester.id;
        }

        if (status) {
            where.status = status;
        }

        if (unassignedCouncilOnly === 'true') {
            where.councilId = null;
            where.status = { notIn: ['PENDING', 'REJECTED'] };
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
            return res.status(400).json({ success: false, message: 'Hanh dong phai la APPROVE hoac REJECT.' });
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
                    throw createHttpError(404, 'Khong tim thay dang ky.');
                }

                if (currentReg.status !== 'PENDING') {
                    throw createHttpError(400, `Dang ky dang o trang thai: ${currentReg.status}. Chi xu ly khi PENDING.`);
                }

                if (role === 'LECTURER' && currentReg.topic.mentorId !== userId) {
                    throw createHttpError(403, 'Ban khong co quyen duyet dang ky nay.');
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
                    throw createHttpError(400, `Da dat gioi han ${maxSlots} sinh vien huong dan.`);
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
                    title: 'Dang ky de tai duoc duyet',
                    content: `De tai "${reg.topic.title}" da duoc phe duyet. Ban co the bat dau thuc hien.`,
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
                return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
            }

            if (reg.status !== 'PENDING') {
                return res.status(400).json({ success: false, message: `Dang ky dang o trang thai: ${reg.status}. Chi xu ly khi PENDING.` });
            }

            if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
                return res.status(403).json({ success: false, message: 'Ban khong co quyen duyet dang ky nay.' });
            }

            if (!rejectReason) {
                return res.status(400).json({ success: false, message: 'Vui long nhap ly do tu choi.' });
            }

            await prisma.topicRegistration.update({
                where: { id: idInt },
                data: { status: 'REJECTED', rejectReason },
            });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Dang ky de tai bi tu choi',
                    content: `De tai "${reg.topic.title}" bi tu choi. Ly do: ${rejectReason}. Ban co the dang ky de tai khac.`,
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
            message: action === 'APPROVE' ? 'Da phe duyet dang ky.' : 'Da tu choi dang ky.',
        });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Co xung dot khi duyet dang ky do thao tac dong thoi. Vui long thu lai.',
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
            return res.status(400).json({ success: false, message: 'Ly do drop la bat buoc.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }

        if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen drop dang ky nay.' });
        }

        if (!['APPROVED', 'IN_PROGRESS', 'SUBMITTED'].includes(reg.status)) {
            return res.status(400).json({
                success: false,
                message: 'Chi duoc drop khi trang thai la APPROVED, IN_PROGRESS hoac SUBMITTED.',
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
                title: 'Dang ky do an bi huy',
                content: `Dang ky de tai "${reg.topic.title}" da bi huy. Ly do: ${reason}`,
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

        res.json({ success: true, message: 'Da drop dang ky thanh cong.' });
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
            return res.status(400).json({ success: false, message: 'Ly do rut dang ky la bat buoc.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }

        const canAccess = role === 'ADMIN'
            || (role === 'STUDENT' && reg.studentId === userId)
            || (role === 'LECTURER' && reg.topic.mentorId === userId);

        if (!canAccess) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen rut dang ky nay.' });
        }

        if (reg.defenseResult) {
            return res.status(400).json({ success: false, message: 'Khong the rut dang ky da co ket qua bao ve.' });
        }

        if (!ACTIVE_NON_PENDING_STATUSES.includes(reg.status)) {
            return res.status(400).json({
                success: false,
                message: 'Chi duoc rut dang ky o trang thai APPROVED, IN_PROGRESS, SUBMITTED, DEFENDED hoac COMPLETED.',
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
                title: 'Yeu cau rut dang ky de tai',
                content: `${role === 'STUDENT' ? reg.student.fullName : 'Giang vien/Admin'} da rut dang ky de tai "${reg.topic.title}". Ly do: ${reason}`,
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

        res.json({ success: true, message: 'Da rut dang ky thanh cong.' });
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
            return res.status(400).json({ success: false, message: 'action phai la FORCE_APPROVE hoac FORCE_REJECT.' });
        }

        const reg = await fetchRegistrationWithContext(idInt);
        if (!reg) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chi force decision duoc voi dang ky PENDING.' });
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
                    throw createHttpError(400, `Da dat gioi han ${maxSlots} sinh vien huong dan.`);
                }

                await tx.topicRegistration.update({
                    where: { id: idInt },
                    data: { status: 'APPROVED', rejectReason: null },
                });
            }, { isolationLevel: 'Serializable' });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Dang ky de tai duoc duyet boi Admin',
                    content: `Admin da force-approve dang ky de tai "${reg.topic.title}".`,
                    type: 'APPROVAL',
                },
                'forceDecisionRegistration_FORCE_APPROVE',
            );
        } else {
            if (!rejectReason || !String(rejectReason).trim()) {
                return res.status(400).json({ success: false, message: 'Vui long nhap ly do force reject.' });
            }

            await prisma.topicRegistration.update({
                where: { id: idInt },
                data: { status: 'REJECTED', rejectReason: String(rejectReason).trim() },
            });

            await safeNotify(
                {
                    userId: reg.studentId,
                    title: 'Dang ky de tai bi tu choi boi Admin',
                    content: `Admin da force-reject dang ky de tai "${reg.topic.title}". Ly do: ${rejectReason}`,
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

        res.json({ success: true, message: 'Da xu ly force decision thanh cong.' });
    } catch (error) {
        if (isSerializationConflict(error)) {
            return res.status(409).json({
                success: false,
                message: 'Co xung dot khi force approve do thao tac dong thoi. Vui long thu lai.',
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
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }

        if (reg.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen huy dang ky nay.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chi co the huy dang ky khi dang cho duyet.' });
        }

        await prisma.topicRegistration.delete({ where: { id: idInt } });

        res.json({ success: true, message: 'Da huy dang ky de tai.' });
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
