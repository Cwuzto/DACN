const prisma = require('../config/database');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');

const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;
const DEFENSE_CENTER_TABS = ['PENDING_ASSIGNMENT', 'ASSIGNED_COUNCIL', 'AWAITING_GRADING', 'COMPLETED'];
const DEFENSE_ELIGIBLE_STATUSES = ['SUBMITTED', 'DEFENDED', 'COMPLETED'];

const parsePositiveInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getTargetSemesterForDefenseCenter = async (semesterIdRaw) => {
    const semesterId = parsePositiveInt(semesterIdRaw);
    if (semesterId) {
        const selected = await prisma.semester.findUnique({
            where: { id: semesterId },
            select: { id: true, name: true, startDate: true, endDate: true, defenseDate: true },
        });
        return selected;
    }

    const now = new Date();
    const active = await prisma.semester.findFirst({
        where: {
            startDate: { lte: now },
            endDate: { gte: now },
        },
        orderBy: { startDate: 'desc' },
        select: { id: true, name: true, startDate: true, endDate: true, defenseDate: true },
    });

    if (active) return active;

    const latestFinished = await prisma.semester.findFirst({
        where: { endDate: { lt: now } },
        orderBy: { endDate: 'desc' },
        select: { id: true, name: true, startDate: true, endDate: true, defenseDate: true },
    });

    if (latestFinished) return latestFinished;

    return prisma.semester.findFirst({
        orderBy: { endDate: 'desc' },
        select: { id: true, name: true, startDate: true, endDate: true, defenseDate: true },
    });
};

const resolveDefenseCenterStage = (registration) => {
    if (registration.defenseResult) return 'COMPLETED';
    if (!registration.councilId) return 'PENDING_ASSIGNMENT';

    const now = Date.now();
    const councilDefenseTime = registration.council?.defenseDate
        ? new Date(registration.council.defenseDate).getTime()
        : null;
    const semesterDefenseTime = registration.topic?.semester?.defenseDate
        ? new Date(registration.topic.semester.defenseDate).getTime()
        : null;
    const expectedDefenseTime = councilDefenseTime || semesterDefenseTime;

    if (registration.status === 'DEFENDED') return 'AWAITING_GRADING';
    if (expectedDefenseTime && expectedDefenseTime <= now) return 'AWAITING_GRADING';

    return 'ASSIGNED_COUNCIL';
};

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

const getAdminDefenseCenter = async (req, res, next) => {
    try {
        const { semesterId, tab, search, councilId, mentorId } = req.query;
        const targetSemester = await getTargetSemesterForDefenseCenter(semesterId);

        if (!targetSemester) {
            return res.json({
                success: true,
                data: [],
                meta: {
                    targetSemester: null,
                    counts: DEFENSE_CENTER_TABS.reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
                },
            });
        }

        const where = {
            semesterId: targetSemester.id,
            status: { in: DEFENSE_ELIGIBLE_STATUSES },
        };

        const parsedCouncilId = parsePositiveInt(councilId);
        if (parsedCouncilId) where.councilId = parsedCouncilId;

        const parsedMentorId = parsePositiveInt(mentorId);
        if (parsedMentorId) where.topic = { mentorId: parsedMentorId };

        if (search && String(search).trim()) {
            const keyword = String(search).trim();
            where.OR = [
                { student: { fullName: { contains: keyword, mode: 'insensitive' } } },
                { student: { code: { contains: keyword, mode: 'insensitive' } } },
                { topic: { title: { contains: keyword, mode: 'insensitive' } } },
                { topic: { mentor: { fullName: { contains: keyword, mode: 'insensitive' } } } },
            ];
        }

        const rows = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, code: true, email: true } },
                topic: {
                    select: {
                        id: true,
                        title: true,
                        mentor: { select: { id: true, fullName: true, code: true } },
                        semester: { select: { id: true, name: true, defenseDate: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
                        location: true,
                        defenseDate: true,
                        members: {
                            select: {
                                lecturerId: true,
                                roleInCouncil: true,
                                lecturer: { select: { fullName: true, code: true } },
                            },
                        },
                    },
                },
                defenseResult: {
                    select: {
                        id: true,
                        finalScore: true,
                        updatedAt: true,
                        evaluator: { select: { id: true, fullName: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const enriched = rows.map((registration) => {
            const stage = resolveDefenseCenterStage(registration);
            const gradingStatus = registration.defenseResult ? 'GRADED' : 'PENDING';
            const semester = registration.topic?.semester || targetSemester;

            return {
                registrationId: registration.id,
                status: registration.status,
                workflowStage: stage,
                gradingStatus,
                student: registration.student,
                topic: registration.topic,
                mentor: registration.topic?.mentor || null,
                semester,
                council: registration.council,
                defenseResult: registration.defenseResult,
                finalScore: registration.defenseResult?.finalScore ?? null,
                scoredBy: registration.defenseResult?.evaluator || null,
                lastUpdatedAt: registration.defenseResult?.updatedAt || registration.updatedAt,
            };
        });

        const counts = DEFENSE_CENTER_TABS.reduce((acc, key) => {
            acc[key] = enriched.filter((item) => item.workflowStage === key).length;
            return acc;
        }, {});

        const filtered = tab && DEFENSE_CENTER_TABS.includes(tab)
            ? enriched.filter((item) => item.workflowStage === tab)
            : enriched;

        res.json({
            success: true,
            data: filtered,
            meta: {
                targetSemester,
                counts,
                total: filtered.length,
            },
        });
    } catch (error) {
        next(error);
    }
};

const remindDefenseGrading = async (req, res, next) => {
    try {
        const { registrationIds } = req.body;
        if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
            return res.status(400).json({ success: false, message: 'registrationIds phai la mang co it nhat 1 phan tu.' });
        }

        const uniqueIds = [...new Set(
            registrationIds.map((value) => parseInt(value, 10)).filter((value) => Number.isInteger(value) && value > 0),
        )];

        if (uniqueIds.length !== registrationIds.length) {
            return res.status(400).json({ success: false, message: 'registrationIds co phan tu khong hop le hoac trung lap.' });
        }

        const registrations = await prisma.topicRegistration.findMany({
            where: {
                id: { in: uniqueIds },
                status: { in: DEFENSE_ELIGIBLE_STATUSES },
            },
            include: {
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
                council: {
                    select: {
                        id: true,
                        name: true,
                        members: { select: { lecturerId: true } },
                    },
                },
                defenseResult: { select: { id: true } },
            },
        });

        let sent = 0;
        let skipped = 0;

        for (const reg of registrations) {
            if (!reg.council || reg.defenseResult) {
                skipped += 1;
                continue;
            }

            const uniqueLecturers = [...new Set((reg.council.members || []).map((member) => member.lecturerId))];
            if (!uniqueLecturers.length) {
                skipped += 1;
                continue;
            }

            for (const lecturerId of uniqueLecturers) {
                await safeNotify(
                    {
                        userId: lecturerId,
                        title: 'Nhac nhap diem bao ve',
                        content: `Vui long nhap diem cho sinh vien ${reg.student?.fullName || 'N/A'} (${reg.student?.code || 'N/A'}) - de tai "${reg.topic?.title || 'N/A'}" tai hoi dong ${reg.council.name}.`,
                        type: 'DEFENSE',
                        referenceUrl: `defense-center:registration:${reg.id}`,
                    },
                    'remindDefenseGrading',
                );
            }

            sent += 1;
        }

        await auditLog(
            req.user.id,
            'REMIND_DEFENSE_GRADING',
            'TopicRegistration',
            null,
            { registrationIds: uniqueIds, sent, skipped },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: `Da gui nhac cham diem cho ${sent} ho so.`,
            data: { sent, skipped },
        });
    } catch (error) {
        next(error);
    }
};

const setDefenseScoreLock = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.id, 10);
        const { action } = req.body;

        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId khong hop le.' });
        }

        if (!['LOCK', 'UNLOCK'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phai la LOCK hoac UNLOCK.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: { defenseResult: { select: { id: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }

        if (!registration.defenseResult) {
            return res.status(400).json({ success: false, message: 'Ho so chua co diem bao ve de khoa/mo khoa.' });
        }

        const nextStatus = action === 'LOCK' ? 'COMPLETED' : 'DEFENDED';
        const updated = await prisma.topicRegistration.update({
            where: { id: registrationId },
            data: { status: nextStatus },
            select: { id: true, status: true, updatedAt: true },
        });

        await auditLog(
            req.user.id,
            action === 'LOCK' ? 'LOCK_DEFENSE_SCORE' : 'UNLOCK_DEFENSE_SCORE',
            'TopicRegistration',
            registrationId,
            { previousStatus: registration.status, nextStatus },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: action === 'LOCK' ? 'Da khoa diem bao ve.' : 'Da mo khoa diem bao ve.',
            data: updated,
        });
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
    getAdminDefenseCenter,
    remindDefenseGrading,
    setDefenseScoreLock,
    submitDefenseResult,
};
