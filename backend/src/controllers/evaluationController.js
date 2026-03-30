const prisma = require('../config/database');

/**
 * GET /api/evaluations/my-grades
 * SV xem điểm bảo vệ của mình
 */
const getMyGrades = async (req, res, next) => {
    try {
        const studentId = req.user.id;

        // Tìm tất cả các đăng ký đề tài của SV
        const registrations = await prisma.topicRegistration.findMany({
            where: { studentId },
            include: {
                topic: {
                    include: { mentor: { select: { fullName: true } } },
                },
                defenseResult: {
                    include: { evaluator: { select: { fullName: true, role: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: registrations });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/evaluations/grading-students
 * GV/Admin xem danh sách SV cần chấm điểm bảo vệ
 */
const getGradingStudents = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const { semesterId } = req.query;

        const where = {
            status: { in: ['DEFENDED', 'COMPLETED', 'SUBMITTED'] },
        };

        if (role === 'LECTURER') {
            where.topic = { mentorId: userId };
        }

        if (semesterId) where.semesterId = parseInt(semesterId);

        const registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { id: true, title: true } },
                defenseResult: true,
                council: { select: { name: true, defenseDate: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Phân loại trạng thái chấm điểm
        const enhanced = registrations.map(reg => ({
            ...reg,
            gradingStatus: reg.defenseResult ? 'Đã chấm' : 'Chưa chấm',
            finalScore: reg.defenseResult?.finalScore || null,
        }));

        res.json({ success: true, data: enhanced });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/evaluations/defense-result
 * Nhập điểm cuối cùng + upload ảnh bảng chấm điểm
 * Body: { registrationId, finalScore, comments, scoresheetUrl }
 */
const submitDefenseResult = async (req, res, next) => {
    try {
        const { registrationId, finalScore, comments, scoresheetUrl } = req.body;
        const evaluatorId = req.user.id;

        if (!registrationId || finalScore === undefined || finalScore === null) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: parseInt(registrationId) },
            include: { topic: true, student: { select: { id: true, fullName: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký đề tài.' });
        }

        // Upsert: tạo mới hoặc cập nhật
        const existing = await prisma.defenseResult.findUnique({
            where: { registrationId: parseInt(registrationId) },
        });

        let result;
        if (existing) {
            result = await prisma.defenseResult.update({
                where: { registrationId: parseInt(registrationId) },
                data: {
                    finalScore: parseFloat(finalScore),
                    comments: comments || '',
                    scoresheetUrl: scoresheetUrl || existing.scoresheetUrl,
                    evaluatorId,
                },
            });
        } else {
            result = await prisma.defenseResult.create({
                data: {
                    registrationId: parseInt(registrationId),
                    finalScore: parseFloat(finalScore),
                    comments: comments || '',
                    scoresheetUrl: scoresheetUrl || null,
                    evaluatorId,
                },
            });
        }

        // Cập nhật trạng thái registration → COMPLETED
        await prisma.topicRegistration.update({
            where: { id: parseInt(registrationId) },
            data: { status: 'COMPLETED' },
        });

        // Notify SV
        await prisma.notification.create({
            data: {
                userId: registration.studentId,
                title: 'Điểm bảo vệ đồ án',
                content: `Điểm bảo vệ đề tài "${registration.topic.title}" đã được cập nhật: ${finalScore} điểm.`,
                type: 'DEFENSE',
            },
        });

        res.json({ success: true, message: 'Đã lưu điểm bảo vệ.', data: result });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMyGrades,
    getGradingStudents,
    submitDefenseResult,
};
