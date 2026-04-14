const prisma = require('../config/database');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');

const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;

const getMyGrades = async (req, res, next) => {
    try {
        const studentId = req.user.id;

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

        if (semesterId) where.semesterId = parseInt(semesterId, 10);

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

        const enhanced = registrations.map((reg) => ({
            ...reg,
            gradingStatus: reg.defenseResult ? 'Da cham' : 'Chua cham',
            finalScore: reg.defenseResult?.finalScore || null,
        }));

        res.json({ success: true, data: enhanced });
    } catch (error) {
        next(error);
    }
};

const submitDefenseResult = async (req, res, next) => {
    try {
        const { registrationId, finalScore, comments, scoresheetUrl } = req.body;
        const evaluatorId = req.user.id;

        if (!registrationId || finalScore === undefined || finalScore === null) {
            return res.status(400).json({ success: false, message: 'Vui long nhap day du thong tin.' });
        }

        const registrationIdInt = parseInt(registrationId, 10);
        const parsedScore = parseFloat(finalScore);

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationIdInt },
            include: { topic: true, student: { select: { id: true, fullName: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky de tai.' });
        }

        const existing = await prisma.defenseResult.findUnique({
            where: { registrationId: registrationIdInt },
        });

        let result;
        if (existing) {
            result = await prisma.defenseResult.update({
                where: { registrationId: registrationIdInt },
                data: {
                    finalScore: parsedScore,
                    comments: comments || '',
                    scoresheetUrl: scoresheetUrl || existing.scoresheetUrl,
                    evaluatorId,
                },
            });
        } else {
            result = await prisma.defenseResult.create({
                data: {
                    registrationId: registrationIdInt,
                    finalScore: parsedScore,
                    comments: comments || '',
                    scoresheetUrl: scoresheetUrl || null,
                    evaluatorId,
                },
            });
        }

        await prisma.topicRegistration.update({
            where: { id: registrationIdInt },
            data: { status: 'COMPLETED' },
        });

        await safeNotify(
            {
                userId: registration.studentId,
                title: 'Diem bao ve do an',
                content: `Diem bao ve de tai "${registration.topic.title}" da duoc cap nhat: ${parsedScore} diem.`,
                type: 'DEFENSE',
            },
            'submitDefenseResult',
        );

        await auditLog(
            evaluatorId,
            'GRADE_DEFENSE',
            'DefenseResult',
            result.id,
            { registrationId: registrationIdInt, finalScore: parsedScore },
            getRequestIp(req),
        );

        res.json({ success: true, message: 'Da luu diem bao ve.', data: result });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMyGrades,
    getGradingStudents,
    submitDefenseResult,
};
