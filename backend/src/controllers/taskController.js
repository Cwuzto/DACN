const prisma = require('../config/database');

// POST /api/tasks
// LECTURER giao task cho sinh viên
const createTask = async (req, res, next) => {
    try {
        const { registrationId, title, content, dueDate } = req.body;
        const mentorId = req.user.id;

        if (!registrationId || !title) {
            return res.status(400).json({ success: false, message: 'Thiếu registrationId hoặc title.' });
        }

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
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'OPEN',
            },
        });

        await prisma.notification.create({
            data: {
                userId: registration.studentId,
                title: 'Nhiệm vụ mới',
                content: `Giảng viên vừa giao nhiệm vụ mới: ${title}`,
                type: 'TASK_REMINDER',
            },
        });

        res.status(201).json({ success: true, message: 'Tạo nhiệm vụ thành công.', data: newTask });
    } catch (error) {
        next(error);
    }
};

// GET /api/tasks/registration/:id
// Lấy danh sách task của 1 đăng ký theo đúng quyền truy cập
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
// STUDENT nộp báo cáo cho task
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
            include: { registration: true },
        });

        if (!task) return res.status(404).json({ success: false, message: 'Nhiệm vụ không tồn tại.' });

        if (task.registration.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền nộp báo cáo cho nhiệm vụ này.' });
        }

        if (task.status === 'COMPLETED') {
            return res.status(400).json({ success: false, message: 'Nhiệm vụ này đã hoàn thành, không thể nộp lại.' });
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

        res.json({ success: true, message: 'Nộp báo cáo thành công.', data: newSubmission });
    } catch (error) {
        next(error);
    }
};

// POST /api/tasks/submission/:id/grade
// LECTURER nhận xét báo cáo
const gradeSubmission = async (req, res, next) => {
    try {
        const submissionId = parseInt(req.params.id, 10);
        const mentorId = req.user.id;
        const { feedback } = req.body;

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
            data: { status: 'COMPLETED' },
        });

        await prisma.notification.create({
            data: {
                userId: submission.submittedBy,
                title: 'Giảng viên đã nhận xét',
                content: `Giảng viên đã nhận xét báo cáo cho nhiệm vụ: ${submission.task.title}`,
                type: 'SUBMISSION',
            },
        });

        res.json({ success: true, message: 'Đã lưu nhận xét.', data: updatedSubmission });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/tasks/:id/status
// LECTURER/ADMIN cập nhật trạng thái task
const updateTaskStatus = async (req, res, next) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        const { status } = req.body;
        const { role, id: userId } = req.user;
        const allowedStatuses = ['OPEN', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED'];

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

        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: { status },
        });

        res.json({ success: true, message: 'Cập nhật trạng thái nhiệm vụ thành công.', data: updatedTask });
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
