const prisma = require('../config/database');
const { getMentorMaxSlots } = require('../constants/mentorCapacity');

// Giá»›i háº¡n SV theo há»c vá»‹

const getActiveSemester = async () => prisma.semester.findFirst({
    where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
    },
    orderBy: { startDate: 'desc' },
    select: { id: true },
});

/**
 * POST /api/registrations
 * Sinh viĂªn Ä‘Äƒng kĂ½ 1 Ä‘á» tĂ i (cĂ¡ nhĂ¢n, khĂ´ng nhĂ³m)
 * Body: { topicId, semesterId }
 */
const registerTopic = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { topicId, semesterId } = req.body;
        const semesterIdInt = parseInt(semesterId, 10);

        if (!topicId || !semesterId) {
            return res.status(400).json({ success: false, message: 'Vui lĂ²ng chá»n Ä‘á» tĂ i vĂ  Ä‘á»£t Ä‘á»“ Ă¡n.' });
        }
        if (!Number.isInteger(semesterIdInt)) {
            return res.status(400).json({ success: false, message: 'Äá»£t Ä‘á»“ Ă¡n khĂ´ng há»£p lá»‡.' });
        }

        // 0. Kiá»ƒm tra Ä‘á»£t Ä‘á»“ Ă¡n cĂ³ má»Ÿ Ä‘Äƒng kĂ½ vĂ  cĂ²n trong thá»i háº¡n khĂ´ng
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
            return res.status(404).json({ success: false, message: 'KhĂ´ng tĂ¬m tháº¥y Ä‘á»£t Ä‘á»“ Ă¡n.' });
        }

        if (!semester.registrationOpen) {
            return res.status(400).json({
                success: false,
                message: 'Äá»£t Ä‘á»“ Ă¡n hiá»‡n Ä‘ang Ä‘Ă³ng Ä‘Äƒng kĂ½. Vui lĂ²ng liĂªn há»‡ quáº£n trá»‹ viĂªn.',
            });
        }

        const now = new Date();
        if (semester.startDate && now < new Date(semester.startDate)) {
            return res.status(400).json({
                success: false,
                message: 'Äá»£t Ä‘á»“ Ă¡n chÆ°a Ä‘áº¿n thá»i gian má»Ÿ Ä‘Äƒng kĂ½.',
            });
        }

        if (semester.registrationDeadline && now > new Date(semester.registrationDeadline)) {
            return res.status(400).json({
                success: false,
                message: 'Äá»£t Ä‘á»“ Ă¡n Ä‘Ă£ quĂ¡ háº¡n Ä‘Äƒng kĂ½.',
            });
        }

        // 1. Kiá»ƒm tra SV Ä‘Ă£ Ä‘Äƒng kĂ½ trong ká»³ nĂ y chÆ°a
        const existingReg = await prisma.topicRegistration.findUnique({
            where: { studentId_semesterId: { studentId, semesterId: semesterIdInt } },
        });

        if (existingReg) {
            if (existingReg.status === 'REJECTED') {
                // Náº¿u bá»‹ tá»« chá»‘i â†’ cho phĂ©p Ä‘á»•i Ä‘á» tĂ i (xĂ³a Ä‘Äƒng kĂ½ cÅ©)
                await prisma.topicRegistration.delete({ where: { id: existingReg.id } });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Báº¡n Ä‘Ă£ Ä‘Äƒng kĂ½ Ä‘á» tĂ i trong ká»³ nĂ y. Chá»‰ cĂ³ thá»ƒ Ä‘á»•i khi bá»‹ tá»« chá»‘i.',
                });
            }
        }

        // 2. Kiá»ƒm tra Ä‘á» tĂ i tá»“n táº¡i & APPROVED
        const topic = await prisma.topic.findUnique({
            where: { id: parseInt(topicId) },
            include: {
                mentor: { select: { id: true, academicTitle: true } },
                _count: { select: { registrations: true } },
            },
        });

        if (!topic || topic.status !== 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Äá» tĂ i khĂ´ng tá»“n táº¡i hoáº·c chÆ°a Ä‘Æ°á»£c duyá»‡t.' });
        }

        if (topic.semesterId !== semesterIdInt) {
            return res.status(400).json({ success: false, message: 'Äá» tĂ i khĂ´ng thuá»™c Ä‘á»£t Ä‘Äƒng kĂ½ hiá»‡n táº¡i.' });
        }

        // 3. Kiá»ƒm tra cĂ²n slot chÆ°a
        if (topic._count.registrations >= topic.maxStudents) {
            return res.status(400).json({ success: false, message: 'Äá» tĂ i nĂ y Ä‘Ă£ Ä‘á»§ sá»‘ lÆ°á»£ng sinh viĂªn Ä‘Äƒng kĂ½.' });
        }

        // 4. Kiá»ƒm tra quota giáº£ng viĂªn
        const maxSlots = getMentorMaxSlots(topic.mentor?.academicTitle);
        const mentorStudentCount = await prisma.topicRegistration.count({
            where: {
                topic: { mentorId: topic.mentorId, semesterId: semesterIdInt },
                status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] },
            },
        });

        if (mentorStudentCount >= maxSlots) {
            return res.status(400).json({ success: false, message: `Giáº£ng viĂªn Ä‘Ă£ Ä‘áº¡t giá»›i háº¡n hÆ°á»›ng dáº«n (${maxSlots} sinh viĂªn).` });
        }

        // 5. Táº¡o Ä‘Äƒng kĂ½
        const registration = await prisma.topicRegistration.create({
            data: {
                topicId: parseInt(topicId),
                studentId,
                semesterId: semesterIdInt,
                status: 'PENDING',
            },
            include: {
                topic: { select: { title: true, mentor: { select: { fullName: true } } } },
            },
        });

        // 6. Gá»­i notification cho GV
        await prisma.notification.create({
            data: {
                userId: topic.mentorId,
                title: 'Sinh viĂªn Ä‘Äƒng kĂ½ Ä‘á» tĂ i',
                content: `${req.user.fullName} (${req.user.code}) Ä‘Ă£ Ä‘Äƒng kĂ½ Ä‘á» tĂ i "${topic.title}".`,
                type: 'REGISTRATION',
            },
        });

        res.status(201).json({
            success: true,
            message: 'ÄÄƒng kĂ½ Ä‘á» tĂ i thĂ nh cĂ´ng! Chá» giáº£ng viĂªn phĂª duyá»‡t.',
            data: registration,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/registrations/my
 * Láº¥y thĂ´ng tin Ä‘Äƒng kĂ½ Ä‘á» tĂ i hiá»‡n táº¡i cá»§a SV
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
 * Danh sĂ¡ch Ä‘Äƒng kĂ½ (GV xem SV mĂ¬nh hÆ°á»›ng dáº«n, Admin xem táº¥t cáº£)
 */
const getAllRegistrations = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { semesterId, status, unassignedCouncilOnly } = req.query;

        const where = {};

        if (role === 'LECTURER') {
            where.topic = { mentorId: userId };
        }

        if (semesterId) {
            where.semesterId = parseInt(semesterId);
        } else if (role === 'LECTURER') {
            const activeSemester = await getActiveSemester();
            if (!activeSemester) {
                return res.json({ success: true, data: [] });
            }
            where.semesterId = activeSemester.id;
        }
        if (status) where.status = status;

        if (unassignedCouncilOnly === 'true') {
            where.councilId = null;
            // Chá»‰ xáº¿p há»™i Ä‘á»“ng cho sinh viĂªn há»£p lá»‡ (vĂ­ dá»¥: Ä‘Ă£ duyá»‡t)
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

        // TĂ­nh progress cho má»—i Ä‘Äƒng kĂ½
        const enhanced = registrations.map((reg) => {
            const milestones = reg.milestones || [];
            const passed = milestones.filter(m => m.status === 'PASSED').length;
            const progress = milestones.length > 0 ? Math.round((passed / milestones.length) * 100) : 0;
            const overdueTaskCount = overdueCountMap.get(reg.id) || 0;

            return {
                ...reg,
                progress,
                overdueTaskCount,
                hasOverdueTask: overdueTaskCount > 0,
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
 * GV duyá»‡t/tá»« chá»‘i Ä‘Äƒng kĂ½ Ä‘á» tĂ i cá»§a SV
 * Body: { action: 'APPROVE' | 'REJECT', rejectReason?: string }
 */
const handleRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { action, rejectReason } = req.body;
        const { role, id: userId } = req.user;

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'HĂ nh Ä‘á»™ng pháº£i lĂ  APPROVE hoáº·c REJECT.' });
        }

        const reg = await prisma.topicRegistration.findUnique({
            where: { id: parseInt(id) },
            include: {
                topic: { include: { mentor: { select: { id: true, academicTitle: true } } } },
                student: { select: { id: true, fullName: true, code: true } },
            },
        });

        if (!reg) {
            return res.status(404).json({ success: false, message: 'KhĂ´ng tĂ¬m tháº¥y Ä‘Äƒng kĂ½.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: `ÄÄƒng kĂ½ Ä‘ang á»Ÿ tráº¡ng thĂ¡i: ${reg.status}. Chá»‰ xá»­ lĂ½ khi PENDING.` });
        }

        // GV chá»‰ duyá»‡t SV trong Ä‘á» tĂ i mĂ¬nh hÆ°á»›ng dáº«n
        if (role === 'LECTURER' && reg.topic.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Báº¡n khĂ´ng cĂ³ quyá»n duyá»‡t Ä‘Äƒng kĂ½ nĂ y.' });
        }

        if (action === 'APPROVE') {
            // Kiá»ƒm tra quota GV
            const mentor = reg.topic.mentor;
            const maxSlots = getMentorMaxSlots(mentor?.academicTitle);
            const currentCount = await prisma.topicRegistration.count({
                where: {
                    topic: { mentorId: mentor.id, semesterId: reg.semesterId },
                    status: { in: ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'] },
                },
            });
            if (currentCount >= maxSlots) {
                return res.status(400).json({ success: false, message: `ÄĂ£ Ä‘áº¡t giá»›i háº¡n ${maxSlots} sinh viĂªn hÆ°á»›ng dáº«n.` });
            }

            await prisma.topicRegistration.update({
                where: { id: parseInt(id) },
                data: { status: 'APPROVED' },
            });

            // Notify SV
            await prisma.notification.create({
                data: {
                    userId: reg.studentId,
                    title: 'ÄÄƒng kĂ½ Ä‘á» tĂ i Ä‘Æ°á»£c duyá»‡t',
                    content: `Äá» tĂ i "${reg.topic.title}" Ä‘Ă£ Ä‘Æ°á»£c phĂª duyá»‡t. Báº¡n cĂ³ thá»ƒ báº¯t Ä‘áº§u thá»±c hiá»‡n.`,
                    type: 'APPROVAL',
                },
            });
        } else {
            if (!rejectReason) {
                return res.status(400).json({ success: false, message: 'Vui lĂ²ng nháº­p lĂ½ do tá»« chá»‘i.' });
            }

            await prisma.topicRegistration.update({
                where: { id: parseInt(id) },
                data: { status: 'REJECTED', rejectReason },
            });

            // Notify SV
            await prisma.notification.create({
                data: {
                    userId: reg.studentId,
                    title: 'ÄÄƒng kĂ½ Ä‘á» tĂ i bá»‹ tá»« chá»‘i',
                    content: `Äá» tĂ i "${reg.topic.title}" bá»‹ tá»« chá»‘i. LĂ½ do: ${rejectReason}. Báº¡n cĂ³ thá»ƒ Ä‘Äƒng kĂ½ Ä‘á» tĂ i khĂ¡c.`,
                    type: 'APPROVAL',
                },
            });
        }

        res.json({
            success: true,
            message: action === 'APPROVE' ? 'ÄĂ£ phĂª duyá»‡t Ä‘Äƒng kĂ½.' : 'ÄĂ£ tá»« chá»‘i Ä‘Äƒng kĂ½.',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/registrations/:id
 * SV há»§y Ä‘Äƒng kĂ½ (chá»‰ khi PENDING)
 */
const cancelRegistration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;

        const reg = await prisma.topicRegistration.findUnique({ where: { id: parseInt(id) } });

        if (!reg) {
            return res.status(404).json({ success: false, message: 'KhĂ´ng tĂ¬m tháº¥y Ä‘Äƒng kĂ½.' });
        }

        if (reg.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Báº¡n khĂ´ng cĂ³ quyá»n há»§y Ä‘Äƒng kĂ½ nĂ y.' });
        }

        if (reg.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Chá»‰ cĂ³ thá»ƒ há»§y Ä‘Äƒng kĂ½ khi Ä‘ang chá» duyá»‡t.' });
        }

        await prisma.topicRegistration.delete({ where: { id: parseInt(id) } });

        res.json({ success: true, message: 'ÄĂ£ há»§y Ä‘Äƒng kĂ½ Ä‘á» tĂ i.' });
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

