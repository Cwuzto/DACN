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
        const { registrationId, title, content, taskType, dueDate } = req.body;
        const mentorId = req.user.id;

        if (!registrationId || !title) {
            return res.status(400).json({ success: false, message: 'Thiếu registrationId hoặc title.' });
        }

        const validTaskTypes = ['BM01', 'BM02', 'BM03_CHECKPOINT_1', 'BM03_CHECKPOINT_2', 'BM03_CHECKPOINT', 'REPORT_DRAFT', 'BM04', 'GENERIC'];
        const taskTypeValue = taskType && validTaskTypes.includes(taskType) ? taskType : 'GENERIC';

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: parseInt(registrationId, 10) },
            include: { topic: true, student: true },
        });

        if (!registration) return res.status(404).json({ success: false, message: 'Đăng ký không tồn tại.' });
        if (!registration.topic || registration.topic.mentorId !== mentorId) {
            return res.status(403).json({ success: false, message: 'Bạn không phải giảng viên hướng dẫn của sinh viên này.' });
        }
        if (!['APPROVED', 'IN_PROGRESS'].includes(registration.status)) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể giao nhiệm vụ cho đăng ký đã duyệt hoặc đang thực hiện.',
            });
        }

        const newTask = await prisma.task.create({
            data: {
                registrationId: parseInt(registrationId, 10),
                title,
                content,
                taskType: taskTypeValue,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'OPEN',
            },
        });

        await safeNotify(
            {
                userId: registration.studentId,
                title: 'Nhiệm vụ mới',
                content: `Giảng viên vừa giao nhiệm vụ mới: ${title}`,
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

        res.status(201).json({ success: true, message: 'Tạo nhiệm vụ thành công.', data: newTask });
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
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: { topic: { select: { mentorId: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Đăng ký không tồn tại.' });
        }

        if (role === 'STUDENT' && registration.studentId !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem danh sách nhiệm vụ này.' });
        }

        if (role === 'LECTURER' && registration.topic?.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không phải giảng viên hướng dẫn của sinh viên này.' });
        }

        let tasks = await prisma.task.findMany({
            where: { registrationId },
            include: {
                submissions: {
                    include: {
                        student: { select: { fullName: true, code: true } },
                    },
                    orderBy: { submittedAt: 'desc' },
                },
            },
            orderBy: [{ createdAt: 'asc' }, { dueDate: 'asc' }],
        });

        // Auto-initialize standard BM tasks if none exist and registration is active
        if (tasks.length === 0 && ['APPROVED', 'IN_PROGRESS', 'SUBMITTED', 'DEFENDED', 'COMPLETED'].includes(registration.status)) {
            const standardTasksData = [
                {
                    registrationId,
                    title: 'BM01 - Đề cương chi tiết đồ án',
                    content: 'Nộp đề cương chi tiết đồ án gồm: mục tiêu, phạm vi nghiên cứu, phương pháp/công nghệ và kế hoạch thực hiện.',
                    taskType: 'BM01',
                    status: 'OPEN',
                },
                {
                    registrationId,
                    title: 'BM02 - Phiếu giao nhiệm vụ đồ án',
                    content: 'Nộp phiếu giao nhiệm vụ đồ án chính thức có đầy đủ nội dung chi tiết và xác nhận từ GVHD.',
                    taskType: 'BM02',
                    status: 'OPEN',
                },
                {
                    registrationId,
                    title: 'BM03 - Báo cáo tiến độ Đợt 1 (Tuần 6)',
                    content: 'Báo cáo tiến độ thực hiện đồ án đợt 1: khối lượng công việc hoàn thành (mục tiêu >= 40%), khó khăn vướng mắc và kế hoạch giai đoạn tiếp theo.',
                    taskType: 'BM03_CHECKPOINT_1',
                    status: 'OPEN',
                },
                {
                    registrationId,
                    title: 'BM03 - Báo cáo tiến độ Đợt 2 (Tuần 10)',
                    content: 'Báo cáo tiến độ thực hiện đồ án đợt 2: hoàn thiện sản phẩm và bản thảo báo cáo (mục tiêu >= 80%).',
                    taskType: 'BM03_CHECKPOINT_2',
                    status: 'OPEN',
                },
                {
                    registrationId,
                    title: 'Báo cáo toàn văn bản thảo (Thuyết minh đồ án)',
                    content: 'Nộp toàn văn báo cáo thuyết minh đồ án và liên kết sản phẩm/mã nguồn để GVHD thẩm định trước bảo vệ.',
                    taskType: 'REPORT_DRAFT',
                    status: 'OPEN',
                },
            ];

            await prisma.task.createMany({
                data: standardTasksData,
            });

            tasks = await prisma.task.findMany({
                where: { registrationId },
                include: {
                    submissions: {
                        include: {
                            student: { select: { fullName: true, code: true } },
                        },
                        orderBy: { submittedAt: 'desc' },
                    },
                },
                orderBy: [{ createdAt: 'asc' }],
            });
        }

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
            return res.status(400).json({ success: false, message: 'Task không hợp lệ.' });
        }

        if (!content && !fileUrl) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung hoặc tải tệp trước khi nộp.' });
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

        if (!task) return res.status(404).json({ success: false, message: 'Nhiệm vụ không tồn tại.' });

        if (task.registration.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền nộp báo cáo cho nhiệm vụ này.' });
        }

        if (task.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Nhiệm vụ này đã hoàn thành, không thể nộp lại.' });
        }

        if (task.status === 'SUBMITTED') {
            return res.status(400).json({
                success: false,
                message: 'Nhiệm vụ đang chờ giảng viên nhận xét. Vui lòng đợi phản hồi trước khi nộp lại.',
            });
        }

        // Sequential validation for standard BM workflow with bypass support
        if (task.taskType === 'BM02') {
            const bm01Task = await prisma.task.findFirst({
                where: { registrationId: task.registrationId, taskType: 'BM01' },
            });
            if (bm01Task && bm01Task.status !== 'COMPLETED' && !bm01Task.isBypassed) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn cần hoàn thành hoặc được miễn duyệt BM01 (Đề cương) trước khi nộp BM02.',
                });
            }
        } else if (task.taskType === 'BM03_CHECKPOINT_1' || task.taskType === 'BM03_CHECKPOINT') {
            const bm02Task = await prisma.task.findFirst({
                where: { registrationId: task.registrationId, taskType: 'BM02' },
            });
            if (bm02Task && bm02Task.status !== 'COMPLETED' && !bm02Task.isBypassed) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn cần hoàn thành hoặc được miễn duyệt BM02 (Giao nhiệm vụ) trước khi nộp BM03.',
                });
            }
        } else if (task.taskType === 'BM03_CHECKPOINT_2') {
            const cp1Task = await prisma.task.findFirst({
                where: { registrationId: task.registrationId, taskType: { in: ['BM03_CHECKPOINT_1', 'BM03_CHECKPOINT'] } },
            });
            if (cp1Task && cp1Task.status !== 'COMPLETED' && !cp1Task.isBypassed) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn cần hoàn thành Báo cáo tiến độ Đợt 1 trước khi nộp Đợt 2.',
                });
            }
        } else if (task.taskType === 'REPORT_DRAFT' || task.taskType === 'BM04') {
            const cp2Task = await prisma.task.findFirst({
                where: { registrationId: task.registrationId, taskType: { in: ['BM03_CHECKPOINT_2', 'BM03_CHECKPOINT_1', 'BM03_CHECKPOINT'] } },
            });
            if (cp2Task && cp2Task.status !== 'COMPLETED' && !cp2Task.isBypassed) {
                return res.status(400).json({
                    success: false,
                    message: 'Bạn cần hoàn thành các mốc báo cáo tiến độ trước khi nộp Báo cáo bản thảo.',
                });
            }
        }

        const submissionCount = await prisma.submission.count({
            where: { taskId, submittedBy: studentId },
        });

        if (submissionCount >= MAX_SUBMISSIONS_PER_TASK) {
            return res.status(400).json({
                success: false,
                message: `Bạn đã đạt giới hạn ${MAX_SUBMISSIONS_PER_TASK} lần nộp cho nhiệm vụ này.`,
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
                        message: `Đã quá hạn nộp ${daysLate} ngày. Hệ thống chỉ cho phép nộp trễ tối đa ${MAX_LATE_DAYS} ngày.`,
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

        if (task.registration?.topic?.mentorId) {
            await safeNotify(
                {
                    userId: task.registration.topic.mentorId,
                    title: 'Sinh viên vừa nộp bài',
                    content: `Sinh viên vừa nộp bài cho nhiệm vụ: ${task.title}`,
                    type: 'SUBMISSION',
                    referenceUrl: '/lecturer/progress',
                },
                'submitTaskNotifyMentor',
            );
        }

        res.json({
            success: true,
            message: 'Nộp báo cáo thành công.',
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
                message: `decision không hợp lệ. Chỉ hỗ trợ: ${allowedDecisions.join(', ')}.`,
            });
        }

        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { task: { include: { registration: { include: { topic: true } } } }, student: true },
        });

        if (!submission) return res.status(404).json({ success: false, message: 'Báo cáo không tồn tại.' });

        const mentor = submission.task.registration.topic.mentorId;
        if (mentor !== mentorId) {
            return res.status(403).json({ success: false, message: 'Chỉ giảng viên hướng dẫn mới được nhận xét.' });
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

        // Trigger registration status progression on task completion
        if (normalizedDecision === 'COMPLETED') {
            if (submission.task.taskType === 'BM01' && submission.task.registration?.status === 'APPROVED') {
                await prisma.topicRegistration.update({
                    where: { id: submission.registrationId },
                    data: { status: 'IN_PROGRESS' },
                });
            } else if (submission.task.taskType === 'BM04') {
                await prisma.topicRegistration.update({
                    where: { id: submission.registrationId },
                    data: { status: 'SUBMITTED' },
                });
            }
        }

        await safeNotify(
            {
                userId: submission.submittedBy,
                title: 'Giảng viên đã nhận xét',
                content: normalizedDecision === 'REVISION'
                    ? `Báo cáo "${submission.task.title}" cần chỉnh sửa và nộp lại theo nhận xét của giảng viên.`
                    : `Giảng viên đã nhận xét và duyệt báo cáo cho nhiệm vụ: ${submission.task.title}`,
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
                ? 'Đã lưu nhận xét và yêu cầu sinh viên chỉnh sửa.'
                : 'Đã lưu nhận xét và phê duyệt thành công.',
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
        const { status, dueDate, reviewComment } = req.body;
        const { role, id: userId } = req.user;
        const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'REVISION', 'COMPLETED', 'OVERDUE'];

        if (!Number.isInteger(taskId)) {
            return res.status(400).json({ success: false, message: 'Task không hợp lệ.' });
        }
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Trạng thái task không hợp lệ. Chỉ hỗ trợ: ${allowedStatuses.join(', ')}.`,
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
            return res.status(404).json({ success: false, message: 'Nhiệm vụ không tồn tại.' });
        }

        if (role === 'LECTURER' && task.registration?.topic?.mentorId !== userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật nhiệm vụ này.' });
        }

        const nextDueDate = dueDate ? new Date(dueDate) : null;
        if (dueDate && Number.isNaN(nextDueDate.getTime())) {
            return res.status(400).json({ success: false, message: 'dueDate khong hop le.' });
        }

        if (status === 'REVISION' && !nextDueDate) {
            return res.status(400).json({ success: false, message: 'Khong dat yeu cau can han nop moi.' });
        }

        const updateData = { status };
        if (dueDate) updateData.dueDate = nextDueDate;

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: updateData,
        });

        if (reviewComment && task.registration?.studentId) {
            const dueDateText = updateData.dueDate
                ? new Date(updateData.dueDate).toLocaleString('vi-VN')
                : (task.dueDate ? new Date(task.dueDate).toLocaleString('vi-VN') : 'khong co');
            await safeNotify(
                {
                    userId: task.registration.studentId,
                    title: status === 'REVISION' ? 'Nhiem vu can lam lai' : 'Nhiem vu dat yeu cau',
                    content: status === 'REVISION'
                        ? `Nhiem vu "${task.title}" duoc danh gia khong dat. Han nop moi: ${dueDateText}. Nhan xet: ${reviewComment}`
                        : `Nhiem vu "${task.title}" duoc danh gia dat. Nhan xet: ${reviewComment}`,
                    type: 'TASK_REMINDER',
                },
                'updateTaskStatusReview',
            );
        }

        await auditLog(
            userId,
            'UPDATE_TASK_STATUS',
            'Task',
            taskId,
            { previousStatus: task.status, nextStatus: status, byRole: role, dueDate: updateData.dueDate || null, reviewComment: reviewComment || null },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Cập nhật trạng thái nhiệm vụ thành công.', data: updatedTask });
    } catch (error) {
        next(error);
    }
};

// POST /api/tasks/remind
// LECTURER/Admin nhac nop bai hang loat cho task qua han/chua nop
const remindTasks = async (req, res, next) => {
    try {
        const { taskIds, message: customMessage } = req.body;
        const { role, id: userId } = req.user;

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui long truyen danh sach taskIds.' });
        }

        const uniqueTaskIds = Array.from(
            new Set(
                taskIds
                    .map((id) => parseInt(id, 10))
                    .filter((id) => Number.isInteger(id)),
            ),
        );

        if (uniqueTaskIds.length === 0) {
            return res.status(400).json({ success: false, message: 'taskIds khong hop le.' });
        }

        const tasks = await prisma.task.findMany({
            where: { id: { in: uniqueTaskIds } },
            include: {
                registration: {
                    include: {
                        topic: { select: { mentorId: true } },
                    },
                },
            },
        });

        if (!tasks.length) {
            return res.status(404).json({ success: false, message: 'Khong tim thay task nao phu hop.' });
        }

        const unauthorized = role === 'LECTURER'
            ? tasks.filter((task) => task.registration?.topic?.mentorId !== userId)
            : [];
        if (unauthorized.length > 0) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen nhac nop cho mot so task.' });
        }

        let sent = 0;
        let skipped = 0;
        const now = new Date();

        for (const task of tasks) {
            if (['COMPLETED', 'SUBMITTED'].includes(task.status)) {
                skipped += 1;
                continue;
            }

            const dueDateText = task.dueDate
                ? new Date(task.dueDate).toLocaleString('vi-VN')
                : 'khong co han nop';
            const content = customMessage?.trim()
                || `Nhac nop nhiem vu "${task.title}" (han: ${dueDateText}). Vui long cap nhat va nop bai som.`;

            await safeNotify(
                {
                    userId: task.registration.studentId,
                    title: 'Nhac nop nhiem vu',
                    content,
                    type: 'TASK_REMINDER',
                    createdAt: now,
                },
                'remindTasks',
            );
            sent += 1;
        }

        return res.json({
            success: true,
            message: `Da gui nhac nop cho ${sent} nhiem vu.`,
            data: { requested: uniqueTaskIds.length, sent, skipped },
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/tasks/:id/bypass
const bypassTask = async (req, res, next) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const { reason } = req.body;
        const { id: userId, role } = req.user;

        if (!Number.isInteger(taskId) || taskId <= 0) {
            return res.status(400).json({ success: false, message: 'ID task không hợp lệ.' });
        }

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                registration: {
                    include: {
                        topic: { select: { mentorId: true, title: true } },
                    },
                },
            },
        });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Nhiệm vụ không tồn tại.' });
        }

        if (role !== 'ADMIN' && task.registration?.topic?.mentorId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ Giảng viên hướng dẫn hoặc Quản trị viên mới có quyền miễn thẩm định (Bypass).',
            });
        }

        // Only allow bypass for soft gates
        if (!['BM01', 'BM02'].includes(task.taskType)) {
            return res.status(400).json({
                success: false,
                message: `Chỉ cho phép miễn thẩm định đối với các biểu mẫu đầu vào (BM01, BM02). Nhiệm vụ loại ${task.taskType} là chốt chặn bắt buộc không thể bỏ qua.`,
            });
        }

        const updated = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: 'COMPLETED',
                isBypassed: true,
                bypassReason: reason ? reason.trim() : 'Miễn thẩm định theo quy định của đề tài / đợt đồ án',
                bypassedBy: userId,
            },
        });

        // Transition registration to IN_PROGRESS if currently APPROVED
        if (task.registration?.status === 'APPROVED') {
            await prisma.topicRegistration.update({
                where: { id: task.registrationId },
                data: { status: 'IN_PROGRESS' },
            });
        }

        // Notify student
        await safeNotify({
            userId: task.registration.studentId,
            title: 'Nhiệm vụ đã được miễn thẩm định (Bypass)',
            content: `Nhiệm vụ "${task.title}" đã được GVHD/Admin xác nhận miễn thẩm định. Lý do: ${updated.bypassReason}`,
            type: 'TASK_REMINDER',
        }, 'bypassTask');

        await auditLog(
            userId,
            'BYPASS_TASK',
            'Task',
            taskId,
            { registrationId: task.registrationId, taskType: task.taskType, reason: updated.bypassReason },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: `Đã xác nhận miễn thẩm định (Bypass) cho nhiệm vụ ${task.title}.`,
            data: updated,
        });
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
    remindTasks,
    bypassTask,
};
