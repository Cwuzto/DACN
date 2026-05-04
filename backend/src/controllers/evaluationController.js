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

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const supportsMemberScoresModel = Boolean(prisma?.defenseMemberScore);

const computeRegistrationFinalScore = (memberScores = []) => {
    const valid = memberScores.filter((row) => Number.isFinite(Number(row.finalScore)));
    if (!valid.length) return null;
    const avg = valid.reduce((sum, row) => sum + Number(row.finalScore), 0) / valid.length;
    return round2(avg);
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
        return { ok: false, message: 'scores pháº£i lĂ  máº£ng cĂ³ Ă­t nháº¥t 1 pháº§n tá»­.' };
    }

    const criteriaMap = new Map(RUBRIC_V1.criteria.map((c) => [c.code, c]));
    const seen = new Set();
    const normalized = [];

    for (const item of scores) {
        const criterionCode = String(item?.criterionCode || '').trim();
        if (!criteriaMap.has(criterionCode) || seen.has(criterionCode)) {
            return { ok: false, message: `criterionCode khĂ´ng há»£p lá»‡ hoáº·c trĂ¹ng láº·p: ${criterionCode || 'N/A'}` };
        }

        const criterion = criteriaMap.get(criterionCode);
        const parsedScore = Number.parseFloat(item?.score);
        if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > criterion.maxScore) {
            return { ok: false, message: `Score cá»§a ${criterionCode} pháº£i náº±m trong [0, ${criterion.maxScore}]` };
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
        return { ok: false, message: 'scores chÆ°a Ä‘áº§y Ä‘á»§ cĂ¡c tiĂªu chĂ­ trong barem v1.' };
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
    if (registration.defenseResult?.finalScore !== null && registration.defenseResult?.finalScore !== undefined) return 'COMPLETED';
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
                memberScores: {
                    select: {
                        evaluatorId: true,
                        finalScore: true,
                        scoreLocked: true,
                        updatedAt: true,
                        evaluator: { select: { id: true, fullName: true } },
                    },
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
                ...(supportsMemberScoresModel
                    ? { memberScores: { select: { finalScore: true, scoreLocked: true } } }
                    : {}),
                council: { select: { name: true, defenseDate: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const enhanced = registrations.map((reg) => ({
            ...reg,
            gradingStatus: supportsMemberScoresModel
                ? (reg.memberScores?.length ? 'ÄĂ£ cháº¥m' : 'ChÆ°a cháº¥m')
                : (reg.defenseResult ? 'ÄĂ£ cháº¥m' : 'ChÆ°a cháº¥m'),
            finalScore: supportsMemberScoresModel
                ? (reg.defenseResult?.finalScore ?? computeRegistrationFinalScore(reg.memberScores || []))
                : (reg.defenseResult?.finalScore ?? null),
            scoreLocked: supportsMemberScoresModel
                ? (reg.memberScores?.length ? reg.memberScores.every((s) => s.scoreLocked) : false)
                : Boolean(reg.defenseResult?.scoreLocked),
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
                ...(supportsMemberScoresModel
                    ? {
                        memberScores: {
                            select: {
                                evaluatorId: true,
                                finalScore: true,
                                scoreLocked: true,
                                updatedAt: true,
                                evaluator: { select: { id: true, fullName: true } },
                            },
                        },
                    }
                    : {}),
            },
            orderBy: { createdAt: 'desc' },
        });

        const enriched = rows.map((registration) => {
            const stage = resolveDefenseCenterStage(registration);
            const gradingStatus = supportsMemberScoresModel
                ? (registration.memberScores?.length ? 'GRADED' : 'PENDING')
                : (registration.defenseResult ? 'GRADED' : 'PENDING');
            const semester = registration.topic?.semester || targetSemester;
            const finalScore = supportsMemberScoresModel
                ? (registration.defenseResult?.finalScore ?? computeRegistrationFinalScore(registration.memberScores || []))
                : (registration.defenseResult?.finalScore ?? null);
            const scoreLocked = supportsMemberScoresModel
                ? (Boolean(registration.memberScores?.length) && registration.memberScores.every((row) => row.scoreLocked))
                : Boolean(registration.defenseResult?.scoreLocked);
            const lastMemberUpdate = ((registration.memberScores || [])).reduce((latest, row) => {
                if (!latest) return row.updatedAt;
                return new Date(row.updatedAt).getTime() > new Date(latest).getTime() ? row.updatedAt : latest;
            }, null);

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
                memberScores: supportsMemberScoresModel ? (registration.memberScores || []) : [],
                finalScore: finalScore ?? null,
                scoreLocked,
                pdfUrl: registration.defenseResult?.pdfUrl || null,
                scoredBy: supportsMemberScoresModel
                    ? (registration.memberScores?.[0]?.evaluator || registration.defenseResult?.evaluator || null)
                    : (registration.defenseResult?.evaluator || null),
                lastUpdatedAt: lastMemberUpdate || registration.defenseResult?.updatedAt || registration.updatedAt,
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
        if (!supportsMemberScoresModel) {
            return res.status(409).json({
                success: false,
                message: 'He thong chua cap nhat schema phieu cham theo thanh vien. Vui long chay prisma migrate deploy va restart backend.',
            });
        }
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId khĂ´ng há»£p lá»‡.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true, department: true } },
                topic: { select: { id: true, title: true, mentorId: true } },
                council: {
                    include: {
                        members: {
                            select: {
                                lecturerId: true,
                                roleInCouncil: true,
                                lecturer: { select: { fullName: true } },
                            },
                        },
                    },
                },
                defenseResult: true,
                memberScores: {
                    include: {
                        criterionScores: { orderBy: { criterionCode: 'asc' } },
                        evaluator: { select: { id: true, fullName: true } },
                    },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'KhĂ´ng tĂ¬m tháº¥y Ä‘Äƒng kĂ½.' });
        }

        const requestedEvaluatorId = parsePositiveInt(req.query.evaluatorId);
        const councilMemberIds = new Set((registration.council?.members || []).map((m) => m.lecturerId));
        const evaluatorId = req.user.role === 'ADMIN' && requestedEvaluatorId && councilMemberIds.has(requestedEvaluatorId)
            ? requestedEvaluatorId
            : req.user.id;

        if (req.user.role !== 'ADMIN' && evaluatorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Ban khong co quyen xem phieu diem nay.' });
        }

        const currentMemberScore = (registration.memberScores || []).find((row) => row.evaluatorId === evaluatorId) || null;
        const roleInCouncil = (registration.council?.members || []).find((m) => m.lecturerId === evaluatorId)?.roleInCouncil || null;
        const finalScore = registration.defenseResult?.finalScore ?? computeRegistrationFinalScore(registration.memberScores || []);
        const scoreLocked = currentMemberScore?.scoreLocked || false;

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
                scores: currentMemberScore?.criterionScores || [],
                defenseResult: currentMemberScore || null,
                memberScores: (registration.memberScores || []).map((row) => ({
                    evaluatorId: row.evaluatorId,
                    evaluatorName: row.evaluator?.fullName || null,
                    finalScore: row.finalScore,
                    scoreLocked: row.scoreLocked,
                })),
                currentEvaluator: {
                    id: evaluatorId,
                    fullName: (registration.council?.members || []).find((m) => m.lecturerId === evaluatorId)?.lecturer?.fullName || req.user.fullName || null,
                    roleInCouncil,
                },
                finalScore: finalScore ?? null,
                scoreLocked: Boolean(scoreLocked),
            },
        });
    } catch (error) {
        next(error);
    }
};

const saveScoreSheet = async (req, res, next) => {
    try {
        if (!supportsMemberScoresModel) {
            return res.status(409).json({
                success: false,
                message: 'He thong chua cap nhat schema phieu cham theo thanh vien. Vui long chay prisma migrate deploy va restart backend.',
            });
        }
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId khong hop le.' });
        }

        const { scores, generalComment } = req.body;
        const targetEvaluatorId = parsePositiveInt(req.body?.evaluatorId);
        const evaluatorId = req.user.role === 'ADMIN' && targetEvaluatorId ? targetEvaluatorId : req.user.id;
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
                    message: access.reason === 'not_found' ? 'Khong tim thay dang ky.' : 'Ban khong co quyen cham diem ho so nay.',
                });
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            const registration = await tx.topicRegistration.findUnique({
                where: { id: registrationId },
                select: {
                    id: true,
                    status: true,
                    studentId: true,
                    topic: { select: { title: true } },
                    council: { select: { members: { select: { lecturerId: true } } } },
                },
            });

            if (!registration) {
                throw new Error('NOT_FOUND_REGISTRATION');
            }

            const councilMemberIdSet = new Set((registration.council?.members || []).map((m) => m.lecturerId));
            if (!councilMemberIdSet.has(evaluatorId)) {
                throw new Error('EVALUATOR_NOT_IN_COUNCIL');
            }

            let memberScore = await tx.defenseMemberScore.findUnique({
                where: {
                    registrationId_evaluatorId: {
                        registrationId,
                        evaluatorId,
                    },
                },
            });

            if (memberScore?.scoreLocked) {
                throw new Error('SCORE_LOCKED');
            }

            if (!memberScore) {
                memberScore = await tx.defenseMemberScore.create({
                    data: {
                        registrationId,
                        finalScore: validScore.finalScore,
                        comments: generalComment ? String(generalComment).trim() : '',
                        evaluatorId,
                        scoreRubricVersion: RUBRIC_V1.version,
                    },
                });
            } else {
                memberScore = await tx.defenseMemberScore.update({
                    where: { id: memberScore.id },
                    data: {
                        finalScore: validScore.finalScore,
                        comments: generalComment !== undefined ? String(generalComment || '').trim() : memberScore.comments,
                        scoreRubricVersion: RUBRIC_V1.version,
                    },
                });
            }

            await tx.defenseMemberCriterionScore.deleteMany({
                where: { defenseMemberScoreId: memberScore.id },
            });

            await tx.defenseMemberCriterionScore.createMany({
                data: validScore.normalized.map((row) => ({
                    defenseMemberScoreId: memberScore.id,
                    criterionCode: row.criterionCode,
                    criterionLabel: row.criterionLabel,
                    maxScore: row.maxScore,
                    score: row.score,
                    comment: row.comment,
                })),
            });

            const councilMemberIds = [...new Set((registration.council?.members || []).map((m) => m.lecturerId))];
            const consideredEvaluatorIds = councilMemberIds.length ? councilMemberIds : [evaluatorId];
            const allMemberScores = await tx.defenseMemberScore.findMany({
                where: {
                    registrationId,
                    evaluatorId: { in: consideredEvaluatorIds },
                },
                select: { finalScore: true },
            });
            const aggregateFinalScore = computeRegistrationFinalScore(allMemberScores);

            const defenseResult = await tx.defenseResult.upsert({
                where: { registrationId },
                update: {
                    finalScore: aggregateFinalScore,
                    evaluatorId,
                    scoreRubricVersion: RUBRIC_V1.version,
                },
                create: {
                    registrationId,
                    finalScore: aggregateFinalScore,
                    comments: '',
                    evaluatorId,
                    scoreRubricVersion: RUBRIC_V1.version,
                },
            });

            return { registration, memberScore, defenseResult, aggregateFinalScore };
        });

        await safeNotify(
            {
                userId: updated.registration.studentId,
                title: 'Diem bao ve da duoc cap nhat',
                content: `Diem bao ve de tai "${updated.registration.topic?.title || 'N/A'}" da duoc cap nhat: ${updated.aggregateFinalScore ?? validScore.finalScore}.`,
                type: 'DEFENSE',
            },
            'saveScoreSheet',
        );

        await auditLog(
            evaluatorId,
            'SAVE_SCORE_SHEET',
            'DefenseMemberScore',
            updated.memberScore.id,
            {
                registrationId,
                rubricVersion: RUBRIC_V1.version,
                finalScore: validScore.finalScore,
                aggregateFinalScore: updated.aggregateFinalScore,
            },
            getRequestIp(req),
        );

        return res.json({
            success: true,
            message: 'Da luu bang diem online.',
            data: {
                defenseResultId: updated.defenseResult.id,
                finalScore: validScore.finalScore,
                aggregateFinalScore: updated.aggregateFinalScore,
                finalScoreRaw: validScore.finalScoreRaw,
                rubricVersion: RUBRIC_V1.version,
            },
        });
    } catch (error) {
        if (error?.message === 'NOT_FOUND_REGISTRATION') {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }
        if (error?.message === 'EVALUATOR_NOT_IN_COUNCIL') {
            return res.status(400).json({ success: false, message: 'Nguoi cham khong thuoc hoi dong cua de tai nay.' });
        }
        if (error?.message === 'SCORE_LOCKED') {
            return res.status(409).json({ success: false, message: 'Bang diem da khoa, khong the cap nhat.' });
        }
        next(error);
    }
};
const remindDefenseGrading = async (req, res, next) => {
    try {
        const { registrationIds } = req.body;
        if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
            return res.status(400).json({ success: false, message: 'registrationIds pháº£i lĂ  máº£ng cĂ³ Ă­t nháº¥t 1 pháº§n tá»­.' });
        }

        const uniqueIds = [...new Set(
            registrationIds.map((value) => parseInt(value, 10)).filter((value) => Number.isInteger(value) && value > 0),
        )];

        if (uniqueIds.length !== registrationIds.length) {
            return res.status(400).json({ success: false, message: 'registrationIds cĂ³ pháº§n tá»­ khĂ´ng há»£p lá»‡ hoáº·c trĂ¹ng láº·p.' });
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
                ...(supportsMemberScoresModel ? { memberScores: { select: { id: true } } } : { defenseResult: { select: { id: true } } }),
            },
        });

        let sent = 0;
        let skipped = 0;

        for (const reg of registrations) {
            const reachedLimit = supportsMemberScoresModel
                ? ((reg.memberScores || []).length >= 3)
                : Boolean(reg.defenseResult);
            if (!reg.council || reachedLimit) {
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
                        title: 'Nháº¯c nháº­p Ä‘iá»ƒm báº£o vá»‡',
                        content: `Vui lĂ²ng nháº­p Ä‘iá»ƒm cho sinh viĂªn ${reg.student?.fullName || 'N/A'} (${reg.student?.code || 'N/A'}) - Ä‘á» tĂ i "${reg.topic?.title || 'N/A'}" táº¡i há»™i Ä‘á»“ng ${reg.council.name}.`,
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
            message: `ÄĂ£ gá»­i nháº¯c cháº¥m Ä‘iá»ƒm cho ${sent} há»“ sÆ¡.`,
            data: { sent, skipped },
        });
    } catch (error) {
        next(error);
    }
};

const setDefenseScoreLock = async (req, res, next) => {
    try {
        if (!supportsMemberScoresModel) {
            return res.status(409).json({
                success: false,
                message: 'He thong chua cap nhat schema phieu cham theo thanh vien. Vui long chay prisma migrate deploy va restart backend.',
            });
        }
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
            include: { memberScores: { select: { id: true } } },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }

        if (!registration.memberScores?.length) {
            return res.status(400).json({ success: false, message: 'Ho so chua co diem bao ve de khoa/mo khoa.' });
        }

        const lockState = action === 'LOCK';
        const nextStatus = lockState ? 'COMPLETED' : 'DEFENDED';

        const updated = await prisma.$transaction(async (tx) => {
            const updatedRegistration = await tx.topicRegistration.update({
                where: { id: registrationId },
                data: { status: nextStatus },
                select: { id: true, status: true, updatedAt: true },
            });

            await tx.defenseMemberScore.updateMany({
                where: { registrationId },
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
            message: action === 'LOCK' ? 'Da khoa diem bao ve.' : 'Da mo khoa diem bao ve.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};
const exportScoreSheetPdf = async (req, res, next) => {
    try {
        if (!supportsMemberScoresModel) {
            return res.status(409).json({
                success: false,
                message: 'He thong chua cap nhat schema phieu cham theo thanh vien. Vui long chay prisma migrate deploy va restart backend.',
            });
        }
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId khong hop le.' });
        }

        const requestedEvaluatorId = parsePositiveInt(req.body?.evaluatorId || req.query?.evaluatorId);

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { fullName: true, code: true, department: true } },
                topic: { select: { title: true } },
                council: {
                    select: {
                        name: true,
                        defenseDate: true,
                        members: {
                            select: {
                                lecturerId: true,
                                roleInCouncil: true,
                                lecturer: { select: { fullName: true } },
                            },
                        },
                    },
                },
                defenseResult: true,
                memberScores: {
                    include: {
                        criterionScores: true,
                        evaluator: { select: { fullName: true } },
                        lockedByUser: { select: { fullName: true } },
                    },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Khong tim thay dang ky.' });
        }

        const adminFallbackEvaluatorId = registration.memberScores?.[0]?.evaluatorId || null;
        const evaluatorId = req.user.role === 'ADMIN'
            ? (requestedEvaluatorId || adminFallbackEvaluatorId)
            : req.user.id;
        const memberScore = (registration.memberScores || []).find((row) => row.evaluatorId === evaluatorId);
        if (!memberScore || memberScore.finalScore === null || memberScore.finalScore === undefined) {
            return res.status(400).json({ success: false, message: 'Ban chua co phieu cham hop le de xuat PDF.' });
        }

        const roleInCouncil = registration.council?.members?.find((m) => m.lecturerId === evaluatorId)?.roleInCouncil || null;
        const aggregateFinalScore = registration.defenseResult?.finalScore ?? computeRegistrationFinalScore(registration.memberScores || []);

        const pdfBuffer = await generateScoreSheetPdfBuffer({
            registration,
            defenseResult: memberScore,
            rubricVersion: memberScore.scoreRubricVersion || RUBRIC_V1.version,
            scorerInfo: {
                name: memberScore.evaluator?.fullName || req.user.fullName || 'N/A',
                roleInCouncil,
            },
            aggregateFinalScore,
        });

        const uploadResult = await UploadService.uploadBuffer(
            pdfBuffer,
            'scoresheets',
            'application/pdf',
            `scoresheet_registration_${registrationId}_evaluator_${evaluatorId}.pdf`,
        );
        const pdfUrl = uploadResult.secure_url;

        const updated = await prisma.defenseMemberScore.update({
            where: { id: memberScore.id },
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

        await prisma.defenseResult.upsert({
            where: { registrationId },
            update: {
                finalScore: aggregateFinalScore,
                pdfUrl,
                pdfGeneratedAt: new Date(),
                evaluatorId,
                scoreRubricVersion: memberScore.scoreRubricVersion || RUBRIC_V1.version,
            },
            create: {
                registrationId,
                finalScore: aggregateFinalScore,
                comments: '',
                evaluatorId,
                pdfUrl,
                pdfGeneratedAt: new Date(),
                scoreRubricVersion: memberScore.scoreRubricVersion || RUBRIC_V1.version,
            },
        });

        await auditLog(
            req.user.id,
            'EXPORT_SCORE_SHEET_PDF',
            'DefenseMemberScore',
            memberScore.id,
            {
                registrationId,
                rubricVersion: memberScore.scoreRubricVersion || RUBRIC_V1.version,
                finalScore: memberScore.finalScore,
                aggregateFinalScore,
                pdfUrl: updated.pdfUrl,
                mode: 'generated_html_puppeteer_with_fallback',
            },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: 'Da xuat bang diem PDF thanh cong.',
            data: updated,
        });
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
};



