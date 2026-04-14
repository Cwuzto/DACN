const prisma = require('../config/database');
const { MAX_LATE_DAYS } = require('../constants/deadlineLimits');
const { MAX_SUBMISSIONS_PER_TASK } = require('../constants/taskLimits');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');

const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

// POST /api/tasks
// LECTURER giao task cho sinh vien
const createTask = async (req, res, next) => {
    try {
        const { registrationId, title, content, dueDate } = req.body;
        const mentorId = req.user.id;

        if (!registrationId || !title) {
            return res.status(400).json({ success: false, message: 'Thieu registrationId hoac title.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: parseInt(registrationId, 10) },
            include: { topic: true, student: true },
        });

        if (!registration) return res.status(404).json({ success: false, message: 'Dang ky khong ton tai.' });
        if (!registration.topic || registration.topic.mentorId !== mentorId) {
            return res.status(403).json({ success: false, message: 'Ban khong phai giang vien huong dan cua sinh vien nay.' });
        }
        if (!['APPROVED', 'IN_PROGRESS'].includes(registration.status)) {
            return res.status(400).json({
                success: false,
                message: 'Chi co the giao nhiem vu cho dang ky da duyet hoac dang thuc hien.',
            });
        }

        const newTask = await prisma.task.create({
            data: {
                registrationId: parseInt(registrationId, 10),
                title,
                content,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'OPEN',
            },
        });

        await safeNotify(
            {
                userId: registration.studentId,
                title: 'Nhiem vu moi',
                content: `Giang vien vua giao nhiem vu moi: ${title}`,
                type: 'TASK_REMINDER',
            },
            'createTask',
        );

        await auditLog(
            mentorId,
            'CREATE_TASK',
            'Task',
            newTask.id,
            { registrationId: registration.id, dueDate: newTask.dueDate },
            getRequestIp(req),
        );

        res.status(201).json({ success: true, message: 'Tao nhiem vu thanh cong.', data: newTask });
    } catch (error) {
        next(error);
    }
};

// GET /api/tasks/registration/:id
const getTasksByRegistration = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.id, 10);
        const { role, id: userId } = req.user;

        if (!Number.isInteger(registrationId)) {
            return res.status(400).json({ success: false, message: 'registrationId khong hop le.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: { topic: { select: { mentorId: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Dang ky khong ton tai.' });
        }

        if (role === 'STUDENT' && registration.studentId !== userId) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen xem danh sach nhiem vu nay.' });
        }

        if (role === 'LECTURER' && registration.topic?.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Ban khong phai giang vien huong dan cua sinh vien nay.' });
        }

        const tasks = await prisma.task.findMany({
            where: { registrationId },
            include: {
                submissions: {
                    include: {
                        student: { select: { fullName: true, code: true } },
                    },
                    orderBy: { submittedAt: 'asc' },
                },
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        });

        res.json({ success: true, data: tasks });
    } catch (error) {
        next(error);
    }
};

// POST /api/tasks/:id/submit
const submitTask = async (req, res, next) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const studentId = req.user.id;
        const { content, fileUrl, fileName } = req.body;

        if (!Number.isInteger(taskId)) {
            return res.status(400).json({ success: false, message: 'Task khong hop le.' });
        }

        if (!content && !fileUrl) {
            return res.status(400).json({ success: false, message: 'Vui long nhap noi dung hoac tai tep truoc khi nop.' });
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { registration: true },
        });

        if (!task) return res.status(404).json({ success: false, message: 'Nhiem vu khong ton tai.' });

        if (task.registration.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen nop bao cao cho nhiem vu nay.' });
        }

        if (task.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Nhiem vu nay da hoan thanh, khong the nop lai.' });
        }

        if (task.status === 'SUBMITTED') {
            return res.status(400).json({
                success: false,
                message: 'Nhiem vu dang cho giang vien nhan xet. Vui long doi phan hoi truoc khi nop lai.',
            });
        }

        const submissionCount = await prisma.submission.count({
            where: { taskId, submittedBy: studentId },
        });

        if (submissionCount >= MAX_SUBMISSIONS_PER_TASK) {
            return res.status(400).json({
                success: false,
                message: `Ban da dat gioi han ${MAX_SUBMISSIONS_PER_TASK} lan nop cho nhiem vu nay.`,
            });
        }

        let lateInfo = { isLate: false, daysLate: 0, maxLateDays: MAX_LATE_DAYS };
        if (task.dueDate) {
            const now = new Date();
            const dueDate = new Date(task.dueDate);
            const diffMs = now.getTime() - dueDate.getTime();
            const daysLate = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMs > 0) {
                if (daysLate > MAX_LATE_DAYS) {
                    return res.status(400).json({
                        success: false,
                        message: `Da qua han nop ${daysLate} ngay. He thong chi cho phep nop tre toi da ${MAX_LATE_DAYS} ngay.`,
                    });
                }
                lateInfo = { isLate: true, daysLate, maxLateDays: MAX_LATE_DAYS };
            }
        }

        const newSubmission = await prisma.submission.create({
            data: {
                taskId,
                registrationId: task.registrationId,
                submittedBy: studentId,
                content: content || null,
                fileUrl: fileUrl || null,
                fileName: fileName || null,
            },
        });

        await prisma.task.update({
            where: { id: taskId },
            data: { status: 'SUBMITTED' },
        });

        res.json({
            success: true,
            message: 'Nop bao cao thanh cong.',
            data: {
                ...newSubmission,
                ...lateInfo,
                attempt: submissionCount + 1,
                maxAttempts: MAX_SUBMISSIONS_PER_TASK,
            },
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/tasks/submission/:id/grade
const gradeSubmission = async (req, res, next) => {
    try {
        const submissionId = parseInt(req.params.id, 10);
        const mentorId = req.user.id;
        const { feedback, decision } = req.body;
        const normalizedDecision = String(decision || 'COMPLETED').toUpperCase();
        const allowedDecisions = ['COMPLETED', 'REVISION'];

        if (!allowedDecisions.includes(normalizedDecision)) {
            return res.status(400).json({
                success: false,
                message: `decision khong hop le. Chi ho tro: ${allowedDecisions.join(', ')}.`,
            });
        }

        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { task: { include: { registration: { include: { topic: true } } } }, student: true },
        });

        if (!submission) return res.status(404).json({ success: false, message: 'Bao cao khong ton tai.' });

        const mentor = submission.task.registration.topic.mentorId;
        if (mentor !== mentorId) {
            return res.status(403).json({ success: false, message: 'Chi giang vien huong dan moi duoc nhan xet.' });
        }

        const updatedSubmission = await prisma.submission.update({
            where: { id: submissionId },
            data: {
                feedback,
                feedbackAt: new Date(),
            },
        });

        await prisma.task.update({
            where: { id: submission.taskId },
            data: { status: normalizedDecision },
        });

        await safeNotify(
            {
                userId: submission.submittedBy,
                title: 'Giang vien da nhan xet',
                content: normalizedDecision === 'REVISION'
                    ? `Bao cao "${submission.task.title}" can chinh sua va nop lai theo nhan xet cua giang vien.`
                    : `Giang vien da nhan xet bao cao cho nhiem vu: ${submission.task.title}`,
                type: 'SUBMISSION',
            },
            'gradeSubmission',
        );

        await auditLog(
            mentorId,
            'GRADE_SUBMISSION',
            'Submission',
            submissionId,
            { taskId: submission.taskId, registrationId: submission.registrationId, decision: normalizedDecision },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: normalizedDecision === 'REVISION'
                ? 'Da luu nhan xet va yeu cau sinh vien chinh sua.'
                : 'Da luu nhan xet.',
            data: updatedSubmission,
        });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/tasks/:id/status
const updateTaskStatus = async (req, res, next) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const { status } = req.body;
        const { role, id: userId } = req.user;
        const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'REVISION', 'COMPLETED', 'OVERDUE'];

        if (!Number.isInteger(taskId)) {
            return res.status(400).json({ success: false, message: 'Task khong hop le.' });
        }
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Trang thai task khong hop le. Chi ho tro: ${allowedStatuses.join(', ')}.`,
            });
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                registration: {
                    include: {
                        topic: { select: { mentorId: true } },
                    },
                },
            },
        });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Nhiem vu khong ton tai.' });
        }

        if (role === 'LECTURER' && task.registration?.topic?.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen cap nhat nhiem vu nay.' });
        }

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: { status },
        });

        await auditLog(
            userId,
            'UPDATE_TASK_STATUS',
            'Task',
            taskId,
            { previousStatus: task.status, nextStatus: status, byRole: role },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Cap nhat trang thai nhiem vu thanh cong.', data: updatedTask });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTask,
    getTasksByRegistration,
    submitTask,
    gradeSubmission,
    updateTaskStatus,
};