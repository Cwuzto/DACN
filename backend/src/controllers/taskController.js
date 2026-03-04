const prisma = require('../config/database');

// POST /api/tasks
// LECTURER báo cáo tiến độ/giao task cho nhóm
const createTask = async (req, res, next) => {
    try {
        const { groupId, title, content, dueDate } = req.body;
        const mentorId = req.user.id;

        if (!groupId || !title) {
            return res.status(400).json({ success: false, message: 'Thiếu groupId hoặc title.' });
        }

        // Kiểm tra group và quyền của giảng viên
        const group = await prisma.group.findUnique({
            where: { id: parseInt(groupId) },
            include: { topic: true, members: { select: { studentId: true } } }
        });

        if (!group) return res.status(404).json({ success: false, message: 'Nhóm không tồn tại.' });
        if (!group.topic || group.topic.mentorId !== mentorId) {
            return res.status(403).json({ success: false, message: 'Bạn không phải giảng viên hướng dẫn của nhóm này.' });
        }

        const newTask = await prisma.task.create({
            data: {
                groupId: group.id,
                title,
                content,
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'OPEN'
            }
        });

        // Gắn thông báo cho tất cả thành viên trong nhóm
        const notifications = group.members.map(member => ({
            userId: member.studentId,
            title: 'Task mới',
            content: `Giảng viên vừa giao task mới: ${title}`,
            type: 'TASK_REMINDER'
        }));
        await prisma.notification.createMany({ data: notifications });

        res.status(201).json({ success: true, message: 'Tạo task thành công.', data: newTask });
    } catch (error) {
        next(error);
    }
};

// GET /api/tasks/group/:id
// Lấy danh sách task của 1 nhóm (từ phía sinh viên hoặc giảng viên nhìn vào)
const getTasksByGroup = async (req, res, next) => {
    try {
        const groupId = parseInt(req.params.id);

        // Lấy tasks kèm các báo cáo đã nộp
        const tasks = await prisma.task.findMany({
            where: { groupId },
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
            include: { group: { include: { members: true } } }
        });

        if (!task) return res.status(404).json({ success: false, message: 'Task không tồn tại.' });

        // Kiểm tra xem sinh viên có trong nhóm của task này không
        const isMember = task.group.members.some(m => m.studentId === studentId && m.status === 'ACCEPTED');
        if (!isMember) {
            return res.status(403).json({ success: false, message: 'Bạn không nằm trong nhóm này.' });
        }

        const newSubmission = await prisma.submission.create({
            data: {
                taskId,
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
// LECTURER chấm điểm báo cáo
const gradeSubmission = async (req, res, next) => {
    try {
        const submissionId = parseInt(req.params.id);
        const mentorId = req.user.id;
        const { feedback } = req.body;

        const submission = await prisma.submission.findUnique({
            where: { id: submissionId },
            include: { task: { include: { group: { include: { topic: true } } } }, student: true }
        });

        if (!submission) return res.status(404).json({ success: false, message: 'Báo cáo không tồn tại.' });

        const mentor = submission.task.group.topic.mentorId;
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
                userId: submission.studentId,
                title: 'Giảng viên đã nhận xét',
                content: `Giảng viên đã nhận xét báo cáo cho task: ${submission.task.title}`,
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
    getTasksByGroup,
    submitTask,
    gradeSubmission
};
