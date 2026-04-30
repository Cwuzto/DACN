const prisma = require('../config/database');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');
const UploadService = require('../services/uploadService');
const { generateScoreSheetPdfBuffer } = require('../services/scoreSheetPdfService');

const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;
const DEFENSE_CENTER_TABS = ['PENDING_ASSIGNMENT', 'ASSIGNED_COUNCIL', 'AWAITING_GRADING', 'COMPLETED'];
const DEFENSE_ELIGIBLE_STATUSES = ['SUBMITTED', 'DEFENDED', 'COMPLETED'];

const RUBRIC_V1 = {
    version: 'v1',
    criteria: [
        { code: 'STRUCTURE', label: 'Cau truc', maxScore: 0.5 },
        { code: 'CITATION_FORMAT', label: 'Trich dan, hinh thuc trinh bay', maxScore: 0.25 },
        { code: 'LANGUAGE', label: 'Ngon ngu', maxScore: 0.25 },
        { code: 'PROBLEM_STATEMENT', label: 'Dat van de, tong quan tinh hinh nghien cuu', maxScore: 1.0 },
        { code: 'RESEARCH_METHOD', label: 'Phuong phap nghien cuu', maxScore: 0.5 },
        { code: 'RESEARCH_CONTENT', label: 'Noi dung nghien cuu', maxScore: 2.5 },
        { code: 'RESEARCH_RESULT', label: 'Ket qua nghien cuu', maxScore: 1.0 },
        { code: 'NOVELTY', label: 'Tinh moi va tinh thoi su', maxScore: 0.25 },
        { code: 'APPLICABILITY', label: 'Tinh ung dung', maxScore: 0.5 },
        { code: 'PUBLICATION', label: 'De tai co bai bao', maxScore: 0.25 },
        { code: 'PRESENTATION_SKILL', label: 'Kha nang trinh bay va hinh thuc bai trinh bay', maxScore: 0.5 },
        { code: 'ATTITUDE', label: 'Thai do, cach ung xu, ban linh', maxScore: 0.5 },
        { code: 'PRESENTATION_CONTENT', label: 'Noi dung trinh bay', maxScore: 1.0 },
        { code: 'QA_RESPONSE', label: 'Tra loi cac cau hoi', maxScore: 1.0 },
    ],
};
const parsePositiveInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const canLecturerGradeRegistration = async (lecturerId, registrationId) => {
    const registration = await prisma.topicRegistration.findUnique({
        where: { id: registrationId },
        include: {
            council: { select: { members: { select: { lecturerId: true } } } },
            topic: { select: { mentorId: true } },
        },
    });

    if (!registration) return { ok: false, reason: 'not_found' };

    const inCouncil = (registration.council?.members || []).some((m) => m.lecturerId === lecturerId);
    const isMentor = registration.topic?.mentorId === lecturerId;

    return { ok: inCouncil || isMentor, registration };
};

const validateAndNormalizeScores = (scores = []) => {
    if (!Array.isArray(scores) || !scores.length) {
        return { ok: false, message: 'scores phải là mảng có ít nhất 1 phần tử.' };
    }

    const criteriaMap = new Map(RUBRIC_V1.criteria.map((c) => [c.code, c]));
    const seen = new Set();
    const normalized = [];

    for (const item of scores) {
        const criterionCode = String(item?.criterionCode || '').trim();
        if (!criteriaMap.has(criterionCode) || seen.has(criterionCode)) {
            return { ok: false, message: `criterionCode không hợp lệ hoặc trùng lặp: ${criterionCode || 'N/A'}` };
        }

        const criterion = criteriaMap.get(criterionCode);
        const parsedScore = Number.parseFloat(item?.score);
        if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > criterion.maxScore) {
            return { ok: false, message: `Score của ${criterionCode} phải nằm trong [0, ${criterion.maxScore}]` };
        }

        normalized.push({
            criterionCode,
            criterionLabel: criterion.label,
            maxScore: criterion.maxScore,
            score: parsedScore,
            comment: item?.comment ? String(item.comment).trim() : null,
        });
        seen.add(criterionCode);
    }

    if (seen.size !== RUBRIC_V1.criteria.length) {
        return { ok: false, message: 'scores chưa đầy đủ các tiêu chí trong barem v1.' };
    }

    const finalScoreRaw = normalized.reduce((sum, row) => sum + row.score, 0);
    const finalScore = Math.round(finalScoreRaw * 100) / 100;

    return { ok: true, normalized, finalScoreRaw, finalScore };
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
            gradingStatus: reg.defenseResult ? 'Đã chấm' : 'Chưa chấm',
            finalScore: reg.defenseResult?.finalScore || null,
            scoreLocked: Boolean(reg.defenseResult?.scoreLocked),
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
                        scoreLocked: true,
                        pdfUrl: true,
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
                scoreLocked: Boolean(registration.defenseResult?.scoreLocked),
                pdfUrl: registration.defenseResult?.pdfUrl || null,
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

const getScoreSheet = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { id: true, title: true, mentorId: true } },
                council: { include: { members: { select: { lecturerId: true } } } },
                defenseResult: {
                    include: {
                        criterionScores: {
                            orderBy: { criterionCode: 'asc' },
                        },
                    },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        res.json({
            success: true,
            data: {
                registration: {
                    id: registration.id,
                    status: registration.status,
                    student: registration.student,
                    topic: registration.topic,
                    councilId: registration.councilId,
                },
                rubric: RUBRIC_V1,
                scores: registration.defenseResult?.criterionScores || [],
                defenseResult: registration.defenseResult || null,
                finalScore: registration.defenseResult?.finalScore ?? null,
                scoreLocked: Boolean(registration.defenseResult?.scoreLocked),
            },
        });
    } catch (error) {
        next(error);
    }
};

const saveScoreSheet = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const { scores, generalComment } = req.body;
        const evaluatorId = req.user.id;
        const evaluatorRole = req.user.role;

        const validScore = validateAndNormalizeScores(scores);
        if (!validScore.ok) {
            return res.status(400).json({ success: false, message: validScore.message });
        }

        if (evaluatorRole === 'LECTURER') {
            const access = await canLecturerGradeRegistration(evaluatorId, registrationId);
            if (!access.ok) {
                return res.status(access.reason === 'not_found' ? 404 : 403).json({
                    success: false,
                    message: access.reason === 'not_found' ? 'Không tìm thấy đăng ký.' : 'Bạn không có quyền chấm điểm hồ sơ này.',
                });
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const registration = await tx.topicRegistration.findUnique({
                where: { id: registrationId },
                select: { id: true, status: true, studentId: true, topic: { select: { title: true } } },
            });

            if (!registration) {
                throw new Error('NOT_FOUND_REGISTRATION');
            }

            let defenseResult = await tx.defenseResult.findUnique({
                where: { registrationId },
            });

            if (defenseResult?.scoreLocked) {
                throw new Error('SCORE_LOCKED');
            }

            if (!defenseResult) {
                defenseResult = await tx.defenseResult.create({
                    data: {
                        registrationId,
                        finalScore: validScore.finalScore,
                        comments: generalComment ? String(generalComment).trim() : '',
                        evaluatorId,
                        scoreRubricVersion: RUBRIC_V1.version,
                    },
                });
            } else {
                defenseResult = await tx.defenseResult.update({
                    where: { id: defenseResult.id },
                    data: {
                        finalScore: validScore.finalScore,
                        comments: generalComment !== undefined ? String(generalComment || '').trim() : defenseResult.comments,
                        evaluatorId,
                        scoreRubricVersion: RUBRIC_V1.version,
                    },
                });
            }

            await tx.defenseCriterionScore.deleteMany({
                where: { defenseResultId: defenseResult.id },
            });

            await tx.defenseCriterionScore.createMany({
                data: validScore.normalized.map((row) => ({
                    defenseResultId: defenseResult.id,
                    criterionCode: row.criterionCode,
                    criterionLabel: row.criterionLabel,
                    maxScore: row.maxScore,
                    score: row.score,
                    comment: row.comment,
                })),
            });

            return { registration, defenseResult };
        });

        await safeNotify(
            {
                userId: updated.registration.studentId,
                title: 'Điểm bảo vệ đã được cập nhật',
                content: `Điểm bảo vệ đề tài "${updated.registration.topic?.title || 'N/A'}" đã được cập nhật: ${validScore.finalScore}.`,
                type: 'DEFENSE',
            },
            'saveScoreSheet',
        );

        await auditLog(
            evaluatorId,
            'SAVE_SCORE_SHEET',
            'DefenseResult',
            updated.defenseResult.id,
            {
                registrationId,
                rubricVersion: RUBRIC_V1.version,
                finalScore: validScore.finalScore,
            },
            getRequestIp(req),
        );

        return res.json({
            success: true,
            message: 'Đã lưu bảng điểm online.',
            data: {
                defenseResultId: updated.defenseResult.id,
                finalScore: validScore.finalScore,
                finalScoreRaw: validScore.finalScoreRaw,
                rubricVersion: RUBRIC_V1.version,
            },
        });
    } catch (error) {
        if (error?.message === 'NOT_FOUND_REGISTRATION') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }
        if (error?.message === 'SCORE_LOCKED') {
            return res.status(409).json({ success: false, message: 'Bảng điểm đã khóa, không thể cập nhật.' });
        }
        next(error);
    }
};

const remindDefenseGrading = async (req, res, next) => {
    try {
        const { registrationIds } = req.body;
        if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
            return res.status(400).json({ success: false, message: 'registrationIds phải là mảng có ít nhất 1 phần tử.' });
        }

        const uniqueIds = [...new Set(
            registrationIds.map((value) => parseInt(value, 10)).filter((value) => Number.isInteger(value) && value > 0),
        )];

        if (uniqueIds.length !== registrationIds.length) {
            return res.status(400).json({ success: false, message: 'registrationIds có phần tử không hợp lệ hoặc trùng lặp.' });
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
                        title: 'Nhắc nhập điểm bảo vệ',
                        content: `Vui lòng nhập điểm cho sinh viên ${reg.student?.fullName || 'N/A'} (${reg.student?.code || 'N/A'}) - đề tài "${reg.topic?.title || 'N/A'}" tại hội đồng ${reg.council.name}.`,
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
            message: `Đã gửi nhắc chấm điểm cho ${sent} hồ sơ.`,
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
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        if (!['LOCK', 'UNLOCK'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phải là LOCK hoặc UNLOCK.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: { defenseResult: { select: { id: true, scoreLocked: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (!registration.defenseResult) {
            return res.status(400).json({ success: false, message: 'Hồ sơ chưa có điểm bảo vệ để khóa/mở khóa.' });
        }

        const lockState = action === 'LOCK';
        const nextStatus = lockState ? 'COMPLETED' : 'DEFENDED';

        const updated = await prisma.$transaction(async (tx) => {
            const updatedRegistration = await tx.topicRegistration.update({
                where: { id: registrationId },
                data: { status: nextStatus },
                select: { id: true, status: true, updatedAt: true },
            });

            await tx.defenseResult.update({
                where: { id: registration.defenseResult.id },
                data: {
                    scoreLocked: lockState,
                    lockedAt: lockState ? new Date() : null,
                    lockedBy: lockState ? req.user.id : null,
                },
            });

            return updatedRegistration;
        });

        await auditLog(
            req.user.id,
            action === 'LOCK' ? 'LOCK_SCORE_SHEET' : 'UNLOCK_SCORE_SHEET',
            'TopicRegistration',
            registrationId,
            { previousStatus: registration.status, nextStatus, scoreLocked: lockState },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: action === 'LOCK' ? 'Đã khóa điểm bảo vệ.' : 'Đã mở khóa điểm bảo vệ.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

const exportScoreSheetPdf = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
                council: { select: { name: true, defenseDate: true } },
                defenseResult: {
                    include: {
                        criterionScores: true,
                        evaluator: { select: { fullName: true } },
                        lockedByUser: { select: { fullName: true } },
                    },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký.' });
        }

        if (!registration.defenseResult || registration.defenseResult.finalScore === null || registration.defenseResult.finalScore === undefined) {
            return res.status(400).json({ success: false, message: 'Hồ sơ chưa có điểm hợp lệ để xuất PDF.' });
        }

        const pdfBuffer = await generateScoreSheetPdfBuffer({
            registration,
            defenseResult: registration.defenseResult,
            rubricVersion: registration.defenseResult.scoreRubricVersion || RUBRIC_V1.version,
        });

        const uploadResult = await UploadService.uploadBuffer(
            pdfBuffer,
            'scoresheets',
            'application/pdf',
            `scoresheet_registration_${registrationId}.pdf`,
        );
        const pdfUrl = uploadResult.secure_url;

        const updated = await prisma.defenseResult.update({
            where: { id: registration.defenseResult.id },
            data: {
                pdfUrl,
                pdfGeneratedAt: new Date(),
            },
            select: {
                id: true,
                pdfUrl: true,
                pdfGeneratedAt: true,
            },
        });

        await auditLog(
            req.user.id,
            'EXPORT_SCORE_SHEET_PDF',
            'DefenseResult',
            registration.defenseResult.id,
            {
                registrationId,
                rubricVersion: registration.defenseResult.scoreRubricVersion || RUBRIC_V1.version,
                finalScore: registration.defenseResult.finalScore,
                pdfUrl: updated.pdfUrl,
                mode: 'generated_pdfkit',
            },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Đã xuất bảng điểm PDF thành công.',
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
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin.' });
        }

        const registrationIdInt = parseInt(registrationId, 10);
        const parsedScore = parseFloat(finalScore);

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationIdInt },
            include: { topic: true, student: { select: { id: true, fullName: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký đề tài.' });
        }

        const existing = await prisma.defenseResult.findUnique({
            where: { registrationId: registrationIdInt },
        });

        if (existing?.scoreLocked) {
            return res.status(409).json({ success: false, message: 'Bảng điểm đã khóa, không thể cập nhật.' });
        }

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
                    scoreRubricVersion: RUBRIC_V1.version,
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
                title: 'Điểm bảo vệ đồ án',
                content: `Điểm bảo vệ đề tài "${registration.topic.title}" đã được cập nhật: ${parsedScore} điểm.`,
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

        res.json({ success: true, message: 'Đã lưu điểm bảo vệ.', data: result });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getMyGrades,
    getGradingStudents,
    getAdminDefenseCenter,
    getScoreSheet,
    saveScoreSheet,
    remindDefenseGrading,
    setDefenseScoreLock,
    exportScoreSheetPdf,
    submitDefenseResult,
};
