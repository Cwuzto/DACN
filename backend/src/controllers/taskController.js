const prisma = require('../config/database');

// POST /api/tasks
// LECTURER báo cáo tiến độ/giao task cho sinh viên
const createTask = async (req, res, next) => {
    try {
        const { registrationId, title, content, dueDate } = req.body;
        const mentorId = req.user.id;

        if (!registrationId || !title) {
            return res.status(400).json({ success: false, message: 'Thiếu registrationId hoặc title.' });
        }

        // Kiểm tra registration và quyền của giảng viên
        const registration = await prisma.topicRegistration.findUnique({
            where: { id: parseInt(registrationId) },
            include: { topic: true, student: true }
        });

        if (!registration) return res.status(404).json({ success: false, message: 'Đăng ký không tồn tại.' });
        if (!registration.topic || registration.topic.mentorId !== mentorId) {
            return res.status(403).json({ success: false, message: 'Bạn không phải giảng viên hướng dẫn của sinh viên này.' });
        }

        const newTask = await prisma.task.create({
            data: {
                registrationId: parseInt(registrationId),
                title,
                content,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'OPEN'
            }
        });

        // Thông báo cho sinh viên
        await prisma.notification.create({ 
            data: {
                userId: registration.studentId,
                title: 'Nhiệm vụ mới',
                content: `Giảng viên vừa giao nhiệm vụ mới: ${title}`,
                type: 'TASK_REMINDER'
            }
        });

        res.status(201).json({ success: true, message: 'Tạo nhiệm vụ thành công.', data: newTask });
    } catch (error) {
        next(error);
    }
};

// GET /api/tasks/registration/:id
// Lấy danh sách nhiệm vụ của 1 sinh viên (từ phía sinh viên hoặc giảng viên nhìn vào)
const getTasksByRegistration = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.id);

        // Lấy tasks kèm các báo cáo đã nộp
        const tasks = await prisma.task.findMany({
            where: { registrationId },
            include: {
                submissions: {
                    include: {
                        student: { select: { fullName: true, code: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: tasks });
    } catch (error) {
        next(error);
    }
};

// POST /api/tasks/:id/submit
// STUDENT nộp báo cáo (file text/url cloudinary)
const submitTask = async (req, res, next) => {
    try {
        const taskId = parseInt(req.params.id);
        const studentId = req.user.id;
        const { content, fileUrl, fileName } = req.body;

        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: { registration: true }
        });

        if (!task) return res.status(404).json({ success: false, message: 'Nhiệm vụ không tồn tại.' });

        if (task.registration.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền nộp báo cáo cho nhiệm vụ này.' });
        }

        const newSubmission = await prisma.submission.create({
            data: {
                taskId,
                registrationId: task.registrationId,
                submittedBy: studentId,
                content,
                fileUrl,
                fileName
            }
        });

        // Đổi trạng thái task
        await prisma.task.update({
            where: { id: taskId },
            data: { status: 'SUBMITTED' }
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
        const submissionId = parseInt(req.params.id);
        const mentorId = req.user.id;
        const { feedback } = req.body;

        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { task: { include: { registration: { include: { topic: true } } } }, student: true }
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
                feedbackAt: new Date()
            }
        });

        await prisma.task.update({
            where: { id: submission.taskId },
            data: { status: 'COMPLETED' }
        });

        // Báo cho sinh viên
        await prisma.notification.create({
            data: {
                userId: submission.submittedBy,
                title: 'Giảng viên đã nhận xét',
                content: `Giảng viên đã nhận xét báo cáo cho nhiệm vụ: ${submission.task.title}`,
                type: 'EVALUATION'
            }
        });

        res.json({ success: true, message: 'Đã lưu nhận xét.', data: updatedSubmission });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTask,
    getTasksByRegistration,
    submitTask,
    gradeSubmission
};
