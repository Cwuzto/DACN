const prisma = require('../config/database');
const { auditLog } = require('../services/auditLogService');
const { safeNotify } = require('../services/notificationService');
const UploadService = require('../services/uploadService');
const { generateScoreSheetPdfBuffer } = require('../services/scoreSheetPdfService');
const rubricService = require('../services/rubricService');
const { reviewBM01, submitBM01Initial, submitBM01Revision } = require('../services/bm01WorkflowService');
const {
    issueCheckpoint,
    signCheckpoint,
    handleSignatureOverdue,
    submitSignatureAppeal,
    reviewSignatureAppeal,
} = require('../services/checkpointWorkflowService');
const { WorkflowTransitionError } = require('../services/registrationTransitionService');
const { lockDefenseScores } = require('../services/defenseScoringService');
const { approveDefenseResult, createResultPublication, getEligibleApprovals, listResultPublications, getDefenseResultApproval, getStudentPublishedResult } = require('../services/defenseResultPublicationService');

const getRequestIp = (req) => req.ip || req.headers['x-forwarded-for'] || null;
const getIdempotencyKey = (req) => req.get?.('Idempotency-Key') || req.headers?.['idempotency-key'];
const sendWorkflowError = (res, error) => {
    if (error instanceof WorkflowTransitionError) {
        return res.status(error.status).json({ success: false, code: error.code, message: error.message });
    }
    return false;
};
const DEFENSE_CENTER_TABS = ['PENDING_ASSIGNMENT', 'ASSIGNED_COUNCIL', 'AWAITING_GRADING', 'COMPLETED'];
const DEFENSE_ELIGIBLE_STATUSES = ['DEFENSE_READY', 'SUBMITTED', 'DEFENDED', 'COMPLETED'];

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

const resolveRubricForRegistration = async (registration) => {
    if (!prisma?.rubricVersion?.findUnique) return null;

    const existingVersion = registration?.defenseResult?.scoreRubricVersion ||
        registration?.memberScores?.[0]?.scoreRubricVersion;

    if (existingVersion) {
        const found = await prisma.rubricVersion.findUnique({
            where: { version: existingVersion },
            include: {
                categories: {
                    orderBy: { orderIndex: 'asc' },
                    include: { criteria: { orderBy: { orderIndex: 'asc' } } },
                },
            },
        });
        if (found) return found;
    }

    const active = await rubricService.getActiveRubric();
    if (active) return active;

    return null;
};

const formatRubricPayload = (resolvedRubric) => {
    if (!resolvedRubric) return RUBRIC_V1;
    return {
        id: resolvedRubric.id,
        version: resolvedRubric.version,
        title: resolvedRubric.title,
        description: resolvedRubric.description,
        totalMaxScore: resolvedRubric.totalMaxScore,
        categories: resolvedRubric.categories || [],
        criteria: (resolvedRubric.categories || []).flatMap((cat) =>
            (cat.criteria || []).map((cri) => ({
                code: cri.code,
                label: cri.label,
                description: cri.description,
                maxScore: cri.maxScore,
                categoryCode: cat.code,
                categoryName: cat.name,
                orderIndex: cri.orderIndex,
            }))
        ),
    };
};
const parsePositiveInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const supportsMemberScoresModel = Boolean(prisma?.defenseMemberScore);

const computeRegistrationFinalScore = (memberScores = []) => {
    const valid = memberScores.filter(
        (row) => row && row.finalScore !== null && row.finalScore !== undefined && row.finalScore !== '' && Number.isFinite(Number(row.finalScore)),
    );
    if (!valid.length) return null;
    const avg = valid.reduce((sum, row) => sum + Number(row.finalScore), 0) / valid.length;
    return round2(avg);
};

const canLecturerGradeRegistration = async (lecturerId, registrationId) => {
    const registration = await prisma.topicRegistration.findUnique({
        where: { id: registrationId },
        include: {
            defenseCouncil: { select: { members: { select: { lecturerId: true } } } },
            council: { select: { members: { select: { lecturerId: true } } } },
            topic: { select: { mentorId: true } },
        },
    });

    if (!registration) return { ok: false, reason: 'not_found' };

    // INV-11 & INV-20: Giảng viên hướng dẫn không được chấm điểm hội đồng cho sinh viên mình hướng dẫn
    if (registration.topic?.mentorId === lecturerId) {
        return { ok: false, reason: 'mentor_conflict' };
    }

    const effectiveMembers = registration.defenseCouncil?.members || registration.council?.members || [];
    const inCouncil = effectiveMembers.some((m) => m.lecturerId === lecturerId);

    return { ok: inCouncil, registration };
};

const validateAndNormalizeScores = (scores = [], rubricPayload = null) => {
    if (!Array.isArray(scores) || !scores.length) {
        return { ok: false, message: 'scores phải là mảng có ít nhất 1 phần tử.' };
    }

    const rubric = rubricPayload || RUBRIC_V1;
    const criteriaList = rubric.criteria || [];
    const criteriaMap = new Map(criteriaList.map((c) => [c.code, c]));
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

    if (seen.size !== criteriaList.length) {
        return { ok: false, message: `scores chưa đầy đủ các tiêu chí trong barem ${rubric.version || 'v1'}.` };
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
    const effectiveCouncilId = registration.defenseCouncilId || registration.councilId;
    if (!effectiveCouncilId) return 'PENDING_ASSIGNMENT';

    const now = Date.now();
    const councilDefenseDate = registration.defenseCouncil?.defenseDate || registration.council?.defenseDate;
    const councilDefenseTime = councilDefenseDate ? new Date(councilDefenseDate).getTime() : null;
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
                council: {
                    include: {
                        members: {
                            include: {
                                lecturer: { select: { id: true, fullName: true, code: true, academicTitle: true } },
                            },
                        },
                    },
                },
                defenseCouncil: {
                    include: {
                        members: {
                            include: {
                                lecturer: { select: { id: true, fullName: true, code: true, academicTitle: true } },
                            },
                        },
                    },
                },
                outlineCouncil: {
                    include: {
                        members: {
                            include: {
                                lecturer: { select: { id: true, fullName: true, code: true, academicTitle: true } },
                            },
                        },
                    },
                },
                defenseResult: {
                    include: { evaluator: { select: { fullName: true, role: true } } },
                },
                memberScores: {
                    select: {
                        evaluatorId: true,
                        finalScore: true,
                        scoreLocked: true,
                        comments: true,
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
        const { semesterId, projectCatalogId, councilId } = req.query;

        const where = {
            status: { in: ['DEFENDED', 'COMPLETED', 'SUBMITTED'] },
        };

        if (role === 'LECTURER') {
            where.OR = [
                { council: { members: { some: { lecturerId: userId } } } },
                { defenseCouncil: { members: { some: { lecturerId: userId } } } },
            ];
        }

        const parsedSemesterId = parsePositiveInt(semesterId);
        if (parsedSemesterId) where.semesterId = parsedSemesterId;

        const parsedCouncilId = parsePositiveInt(councilId);
        if (parsedCouncilId) {
            where.OR = [
                { councilId: parsedCouncilId },
                { defenseCouncilId: parsedCouncilId },
            ];
        }

        const parsedProjectCatalogId = parsePositiveInt(projectCatalogId);
        if (parsedProjectCatalogId) {
            where.topic = {
                ...(where.topic || {}),
                projectCatalogId: parsedProjectCatalogId,
            };
        }

        const registrations = await prisma.topicRegistration.findMany({
            where,
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: {
                    select: {
                        id: true,
                        title: true,
                        projectCatalogId: true,
                        projectCatalog: { select: { id: true, code: true, name: true } },
                        semester: { select: { id: true, name: true, status: true } },
                    },
                },
                defenseResult: true,
                ...(supportsMemberScoresModel
                    ? { memberScores: { select: { finalScore: true, scoreLocked: true } } }
                    : {}),
                council: {
                    select: {
                        id: true,
                        name: true,
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
                defenseCouncil: {
                    select: {
                        id: true,
                        name: true,
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
            },
            orderBy: { createdAt: 'desc' },
        });

        const enhanced = registrations.map((reg) => ({
            ...reg,
            council: reg.defenseCouncil || reg.council,
            gradingStatus: supportsMemberScoresModel
                ? (reg.memberScores?.length ? 'Đã chấm' : 'Chưa chấm')
                : (reg.defenseResult ? 'Đã chấm' : 'Chưa chấm'),
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
        const { semesterId, councilId, mentorId, search, tab } = req.query;
        const targetSemester = await getTargetSemesterForDefenseCenter(semesterId);

        if (!targetSemester) {
            return res.status(404).json({ success: false, message: 'Khong tim thay hoc ky phu hop.' });
        }

        const where = {
            semesterId: targetSemester.id,
            status: { in: DEFENSE_ELIGIBLE_STATUSES },
        };

        const parsedCouncilId = parsePositiveInt(councilId);
        if (parsedCouncilId) {
            where.OR = [
                { councilId: parsedCouncilId },
                { defenseCouncilId: parsedCouncilId },
            ];
        }

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
                defenseCouncil: {
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
            const effectiveCouncil = registration.defenseCouncil || registration.council;
            const stage = resolveDefenseCenterStage({ ...registration, council: effectiveCouncil });
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
                council: effectiveCouncil,
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
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true, department: true } },
                topic: { select: { id: true, title: true, mentorId: true } },
                defenseCouncil: {
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
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký đề tài.' });
        }

        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const effectiveMembers = effectiveCouncil?.members || [];
        const requestedEvaluatorId = parsePositiveInt(req.query.evaluatorId);
        const councilMemberIds = new Set(effectiveMembers.map((m) => m.lecturerId));
        const evaluatorId = req.user.role === 'ADMIN' && requestedEvaluatorId && councilMemberIds.has(requestedEvaluatorId)
            ? requestedEvaluatorId
            : req.user.id;

        if (req.user.role !== 'ADMIN' && evaluatorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem phiếu điểm này.' });
        }

        const currentMemberScore = (registration.memberScores || []).find((row) => row.evaluatorId === evaluatorId) || null;
        const roleInCouncil = effectiveMembers.find((m) => m.lecturerId === evaluatorId)?.roleInCouncil || null;
        const finalScore = registration.defenseResult?.finalScore ?? computeRegistrationFinalScore(registration.memberScores || []);
        const scoreLocked = currentMemberScore?.scoreLocked || false;

        const resolvedRubric = await resolveRubricForRegistration(registration);
        const rubricPayload = formatRubricPayload(resolvedRubric);

        res.json({
            success: true,
            data: {
                registration: {
                    id: registration.id,
                    status: registration.status,
                    student: registration.student,
                    topic: registration.topic,
                    councilId: effectiveCouncil?.id || registration.defenseCouncilId || registration.councilId,
                },
                rubric: rubricPayload,
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
                    fullName: effectiveMembers.find((m) => m.lecturerId === evaluatorId)?.lecturer?.fullName || req.user.fullName || null,
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
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const { scores, generalComment } = req.body;
        const targetEvaluatorId = parsePositiveInt(req.body?.evaluatorId);
        const evaluatorId = req.user.role === 'ADMIN' && targetEvaluatorId ? targetEvaluatorId : req.user.id;
        const evaluatorRole = req.user.role;

        const targetRegistration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                defenseResult: { select: { scoreRubricVersion: true } },
                memberScores: { select: { scoreRubricVersion: true }, take: 1 },
            },
        });

        if (!targetRegistration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký đề tài.' });
        }

        const resolvedRubric = await resolveRubricForRegistration(targetRegistration);
        const rubricPayload = formatRubricPayload(resolvedRubric);
        const targetRubricVersion = rubricPayload.version || RUBRIC_V1.version;

        const validScore = validateAndNormalizeScores(scores, rubricPayload);
        if (!validScore.ok) {
            return res.status(400).json({ success: false, message: validScore.message });
        }

        if (evaluatorRole === 'LECTURER') {
            const access = await canLecturerGradeRegistration(evaluatorId, registrationId);
            if (!access.ok) {
                if (access.reason === 'mentor_conflict') {
                    return res.status(403).json({
                        success: false,
                        code: 'MENTOR_CANNOT_GRADE_OWN_STUDENT',
                        message: 'Xung đột lợi ích: Giảng viên hướng dẫn không được chấm điểm hội đồng bảo vệ cho sinh viên của mình.',
                    });
                }
                return res.status(access.reason === 'not_found' ? 404 : 403).json({
                    success: false,
                    message: access.reason === 'not_found' ? 'Không tìm thấy đăng ký.' : 'Bạn không có quyền chấm điểm hồ sơ này (chỉ thành viên hội đồng mới có quyền).',
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
                    topic: { select: { title: true, mentorId: true } },
                    defenseCouncil: { select: { members: { select: { lecturerId: true } } } },
                    council: { select: { members: { select: { lecturerId: true } } } },
                },
            });

            if (!registration) {
                throw new Error('NOT_FOUND_REGISTRATION');
            }

            if (registration.topic?.mentorId === evaluatorId) {
                throw new Error('MENTOR_CANNOT_GRADE_OWN_STUDENT');
            }

            const effectiveMembers = registration.defenseCouncil?.members || registration.council?.members || [];
            const councilMemberIdSet = new Set(effectiveMembers.map((m) => m.lecturerId));
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
                        scoreRubricVersion: targetRubricVersion,
                    },
                });
            } else {
                memberScore = await tx.defenseMemberScore.update({
                    where: { id: memberScore.id },
                    data: {
                        finalScore: validScore.finalScore,
                        comments: generalComment !== undefined ? String(generalComment || '').trim() : memberScore.comments,
                        scoreRubricVersion: targetRubricVersion,
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

            const councilMemberIds = [...new Set(effectiveMembers.map((m) => m.lecturerId))];
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
                    scoreRubricVersion: targetRubricVersion,
                },
                create: {
                    registrationId,
                    finalScore: aggregateFinalScore,
                    comments: '',
                    evaluatorId,
                    scoreRubricVersion: targetRubricVersion,
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
        if (error?.message === 'MENTOR_CANNOT_GRADE_OWN_STUDENT') {
            return res.status(403).json({
                success: false,
                code: 'MENTOR_CANNOT_GRADE_OWN_STUDENT',
                message: 'Xung đột lợi ích: Giảng viên hướng dẫn không được chấm điểm hội đồng cho sinh viên của mình.',
            });
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
                defenseCouncil: {
                    select: {
                        id: true,
                        name: true,
                        members: { select: { lecturerId: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
                        members: { select: { lecturerId: true } },
                    },
                },
                memberScores: { select: { id: true } },
            },
        });

        let sent = 0;
        let skipped = 0;

        for (const reg of registrations) {
            const effectiveCouncil = reg.defenseCouncil || reg.council;
            const reachedLimit = (reg.memberScores || []).length >= 3;
            if (!effectiveCouncil || reachedLimit) {
                skipped += 1;
                continue;
            }

            const uniqueLecturers = [...new Set((effectiveCouncil.members || []).map((member) => member.lecturerId))];
            if (!uniqueLecturers.length) {
                skipped += 1;
                continue;
            }

            for (const lecturerId of uniqueLecturers) {
                await safeNotify(
                    {
                        userId: lecturerId,
                        title: 'Nhắc nhập điểm bảo vệ',
                        content: `Vui lòng nhập điểm cho sinh viên ${reg.student?.fullName || 'N/A'} (${reg.student?.code || 'N/A'}) - đề tài "${reg.topic?.title || 'N/A'}" tại hội đồng ${effectiveCouncil.name}.`,
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
        const registrationId = parseInt(req.params.id, 10);
        const { action } = req.body;

        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId khong hop le.' });
        }

        if (!['LOCK', 'UNLOCK'].includes(action)) {
            return res.status(400).json({ success: false, message: 'action phai la LOCK hoac UNLOCK.' });
        }

        const updated = await lockDefenseScores({
            registrationId,
            action,
            actorId: req.user.id,
            idempotencyKey: getIdempotencyKey(req) || `defense-score-lock-${registrationId}-${action}-${Date.now()}`,
        });

        await auditLog(
            req.user.id,
            action === 'LOCK' ? 'LOCK_SCORE_SHEET' : 'UNLOCK_SCORE_SHEET',
            'TopicRegistration',
            registrationId,
            { nextStatus: updated.status, scoreLocked: action === 'LOCK' },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: action === 'LOCK' ? 'Da khoa diem bao ve va chuyen sang cho phe duyet ket qua.' : 'Da mo khoa diem bao ve.',
            data: updated,
        });
    } catch (error) {
        next(error);
    }
};

const approveDefenseResultAction = async (req, res, next) => {
    try {
        const result = await approveDefenseResult({
            registrationId: parsePositiveInt(req.params.id),
            actorId: req.user.id,
            outcome: req.body.outcome,
            reason: req.body.reason,
            notes: req.body.notes,
            idempotencyKey: getIdempotencyKey(req),
        });
        return res.status(201).json({ success: true, message: 'Đã phê duyệt kết quả bảo vệ.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const getDefenseResultApprovalAction = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.id);
        if (!registrationId) return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        const approval = await getDefenseResultApproval(registrationId);
        if (!approval) return res.status(404).json({ success: false, message: 'Chưa có quyết định phê duyệt kết quả bảo vệ.' });
        return res.json({ success: true, data: approval });
    } catch (error) {
        next(error);
    }
};

const correctDefenseResultAction = async (req, res, next) => {
    try {
        const result = await approveDefenseResult({
            registrationId: parsePositiveInt(req.params.id), actorId: req.user.id, outcome: req.body.outcome,
            reason: req.body.reason, notes: req.body.notes, idempotencyKey: getIdempotencyKey(req), correction: true,
        });
        return res.status(201).json({ success: true, message: 'Đã tạo quyết định điều chỉnh kết quả.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const previewResultPublication = async (req, res, next) => {
    try {
        const semesterId = parsePositiveInt(req.params.semesterId);
        if (!semesterId) return res.status(400).json({ success: false, message: 'semesterId không hợp lệ.' });
        const approvals = await getEligibleApprovals(prisma, semesterId);
        const published = await prisma.resultPublicationItem.findMany({ where: { registration: { semesterId } }, select: { registrationId: true } });
        const publishedIds = new Set(published.map((item) => item.registrationId));
        return res.json({
            success: true,
            data: {
                eligible: approvals.filter((approval) => !publishedIds.has(approval.registrationId)),
                correctionEligible: approvals.filter((approval) => publishedIds.has(approval.registrationId)),
                alreadyPublishedRegistrationIds: [...publishedIds],
            },
        });
    } catch (error) {
        next(error);
    }
};

const publishDefenseResults = async (req, res, next) => {
    try {
        const semesterId = parsePositiveInt(req.params.semesterId);
        if (!semesterId) return res.status(400).json({ success: false, message: 'semesterId không hợp lệ.' });
        const result = await createResultPublication({
            semesterId,
            actorId: req.user.id,
            type: req.body.type,
            reason: req.body.reason,
            previousPublicationId: req.body.previousPublicationId,
            correctionItems: req.body.correctionItems,
            idempotencyKey: getIdempotencyKey(req),
        });
        return res.status(result.idempotent ? 200 : 201).json({ success: true, message: 'Đã công bố kết quả theo snapshot.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const getResultPublicationHistory = async (req, res, next) => {
    try {
        const semesterId = parsePositiveInt(req.params.semesterId);
        if (!semesterId) return res.status(400).json({ success: false, message: 'semesterId không hợp lệ.' });
        return res.json({ success: true, data: await listResultPublications(semesterId) });
    } catch (error) { next(error); }
};

const getMyPublishedDefenseResult = async (req, res, next) => {
    try {
        const item = await getStudentPublishedResult(req.user.id);
        return res.json({ success: true, data: item || null });
    } catch (error) { next(error); }
};
const exportScoreSheetPdf = async (req, res, next) => {
    try {
        const registrationId = parsePositiveInt(req.params.registrationId);
        if (!registrationId) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const requestedEvaluatorId = parsePositiveInt(req.body?.evaluatorId || req.query?.evaluatorId);

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { fullName: true, code: true, department: true } },
                topic: { select: { title: true } },
                defenseCouncil: {
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
            return res.status(404).json({ success: false, message: 'Không tìm thấy đăng ký đề tài.' });
        }

        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const adminFallbackEvaluatorId = registration.memberScores?.[0]?.evaluatorId || null;
        const evaluatorId = req.user.role === 'ADMIN'
            ? (requestedEvaluatorId || adminFallbackEvaluatorId)
            : req.user.id;
        const memberScore = (registration.memberScores || []).find((row) => row.evaluatorId === evaluatorId);
        if (!memberScore || memberScore.finalScore === null || memberScore.finalScore === undefined) {
            return res.status(400).json({ success: false, message: 'Bạn chưa có phiếu chấm hợp lệ để xuất PDF.' });
        }

        const roleInCouncil = effectiveCouncil?.members?.find((m) => m.lecturerId === evaluatorId)?.roleInCouncil || null;
        const aggregateFinalScore = registration.defenseResult?.finalScore ?? computeRegistrationFinalScore(registration.memberScores || []);

        const pdfBuffer = await generateScoreSheetPdfBuffer({
            registration: { ...registration, council: effectiveCouncil },
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
/**
 * POST /api/evaluations/bm01-resubmit/:registrationId
 * Sinh viên nộp lại đề cương BM01 đã chỉnh sửa sau khi Hội đồng đánh giá Chưa đạt hoặc Vắng
 */
const resubmitBM01 = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        const { content, fileUrl, fileName } = req.body;
        const studentId = req.user.id;

        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: { topic: true, student: true },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        const result = await submitBM01Revision({
            registrationId,
            studentId,
            content,
            fileUrl,
            fileName,
            idempotencyKey: getIdempotencyKey(req),
        });

        if (!result.idempotent && registration.topic?.mentorId) {
            await safeNotify(
                {
                    userId: registration.topic.mentorId,
                    title: 'Đề cương BM01 đã được sinh viên nộp lại',
                    content: `Sinh viên ${registration.student?.fullName || ''} đã nộp lại đề cương chỉnh sửa cho đề tài "${registration.topic.title}". Vui lòng thẩm định lại.`,
                    type: 'SUBMISSION',
                },
                'resubmitBM01',
            );
        }

        if (!result.idempotent) {
            await auditLog(
                studentId,
                'RESUBMIT_BM01',
                'TopicRegistration',
                registrationId,
                { submissionId: result.submission.id, evaluationId: result.evaluation.id },
                getRequestIp(req),
            );
        }

        res.json({
            success: true,
            message: 'Đã nộp lại đề cương BM01 thành công. Đề cương đang chờ GVHD thẩm định lại.',
            data: result,
        });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const submitBM01 = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        const { content, fileUrl, fileName } = req.body;
        const result = await submitBM01Initial({
            registrationId,
            studentId: req.user.id,
            content,
            fileUrl,
            fileName,
            idempotencyKey: getIdempotencyKey(req),
        });
        if (!result.idempotent) {
            await auditLog(
                req.user.id,
                'SUBMIT_BM01',
                'TopicRegistration',
                registrationId,
                { submissionId: result.submission.id },
                getRequestIp(req),
            );
        }
        return res.status(201).json({
            success: true,
            message: 'Đã nộp đề cương BM01 và chuyển hồ sơ sang chờ Hội đồng thẩm định.',
            data: result,
        });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/evaluations/bm01-gvhd-approve/:registrationId
 * GVHD thẩm định lần hai; đạt thì mở BM02, không đạt thì dừng hồ sơ.
 */
const approveResubmittedBM01 = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        const { feedback, outcome = 'PASSED' } = req.body;
        const userId = req.user.id;

        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: registrationId },
            include: { topic: true, student: true },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        const isMentor = registration.topic?.mentorId === userId;
        if (!isMentor) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ giảng viên hướng dẫn hiện hành mới có quyền duyệt lại đề cương.',
            });
        }

        const result = await reviewBM01({
            registrationId,
            reviewerId: userId,
            attemptNo: 2,
            outcome,
            feedback,
            idempotencyKey: getIdempotencyKey(req),
        });

        if (!result.idempotent) await safeNotify(
            {
                userId: registration.studentId,
                title: outcome === 'PASSED'
                    ? 'Đề cương BM01 đã được GVHD duyệt ĐẠT'
                    : 'Đề cương BM01 không đạt sau lần chỉnh sửa',
                content: outcome === 'PASSED'
                    ? `GVHD đã duyệt ĐẠT đề cương chỉnh sửa cho đề tài "${registration.topic.title}". Bạn hiện đã đủ điều kiện để nộp BM02 (Phiếu đăng ký đề tài chính thức).`
                    : `GVHD kết luận đề cương chỉnh sửa của đề tài "${registration.topic.title}" không đạt. Hồ sơ đã dừng theo quy định BM01.`,
                type: 'APPROVAL',
            },
            'approveResubmittedBM01',
        );

        if (!result.idempotent) {
            await auditLog(
                userId,
                'APPROVE_RESUBMITTED_BM01',
                'TopicRegistration',
                registrationId,
                { feedback: feedback || null, outcome, evaluationId: result.evaluation.id },
                getRequestIp(req),
            );
        }

        res.json({
            success: true,
            message: outcome === 'PASSED'
                ? 'Đã thẩm định và duyệt ĐẠT đề cương BM01 thành công. Sinh viên đã được mở khóa nộp BM02.'
                : 'Đã ghi nhận BM01 không đạt lần hai. Hồ sơ chuyển sang TERMINATED_BM01.',
            data: result,
        });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

/**
 * POST /api/evaluations/bm04-submit
 * GVHD trực tiếp khởi tạo, chấm 4 tiêu chí, tick Đồng ý/Không đồng ý và ký khóa vĩnh viễn phiếu BM04
 */
const submitBM04Evaluation = async (req, res, next) => {
    try {
        const {
            registrationId,
            thesisFormatScore,
            researchContentScore,
            applicabilityScore,
            attitudeScore,
            conclusion,
            generalNotes,
            lecturerSignature,
        } = req.body;
        const userId = req.user.id;
        const role = req.user.role;

        const regIdInt = parseInt(registrationId, 10);
        if (!Number.isInteger(regIdInt) || regIdInt <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        if (!['AGREED_FOR_DEFENSE', 'NOT_AGREED_FOR_DEFENSE'].includes(conclusion)) {
            return res.status(400).json({
                success: false,
                message: 'Kết luận BM04 bắt buộc phải là AGREED_FOR_DEFENSE hoặc NOT_AGREED_FOR_DEFENSE.',
            });
        }

        if (!thesisFormatScore || !researchContentScore || !applicabilityScore || !attitudeScore) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ nhận xét cho cả 4 tiêu chí đánh giá bắt buộc.',
            });
        }

        if (!lecturerSignature || !String(lecturerSignature).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Chữ ký xác nhận của GVHD là bắt buộc.',
            });
        }

        const registration = await prisma.topicRegistration.findUnique({
            where: { id: regIdInt },
            include: { topic: true, student: true, bm04Evaluation: true, archive: true },
        });

        if (!registration) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ đăng ký đề tài.' });
        }

        const isMentor = role === 'LECTURER' && registration.topic?.mentorId === userId;

        if (!isMentor) {
            return res.status(403).json({
                success: false,
                message: 'Chỉ giảng viên hướng dẫn của đề tài này mới có quyền lập và ký phiếu BM04.',
            });
        }

        if (registration.bm04Evaluation && registration.bm04Evaluation.isLocked) {
            return res.status(400).json({
                success: false,
                message: 'Phiếu nhận xét BM04 này đã được ký xác nhận và khóa vĩnh viễn, không thể cập nhật lại.',
            });
        }

        if (registration.status !== 'BM03_PASSED') {
            return res.status(409).json({
                success: false,
                code: 'INVALID_TRANSITION',
                message: 'Chỉ được lập BM04 khi hồ sơ đang ở trạng thái BM03_PASSED.',
            });
        }

        const isAgreed = conclusion === 'AGREED_FOR_DEFENSE';
        if (isAgreed) {
            const preDefenseArchiveComplete = Boolean(
                registration.archive?.reportFileUrl
                && registration.archive?.sourceCodeUrl
                && (registration.archive?.slideFileUrl || registration.archive?.demoVideoUrl),
            );
            if (!preDefenseArchiveComplete) {
                return res.status(409).json({
                    success: false,
                    code: 'PRE_DEFENSE_ARCHIVE_INCOMPLETE',
                    message: 'Chưa đủ bộ lưu chiểu trước bảo vệ: báo cáo PDF, source/repository và slide hoặc video demo.',
                });
            }
        }

        const nextStatus = isAgreed ? 'DEFENSE_READY' : 'TERMINATED_BM04';

        const result = await prisma.$transaction(async (tx) => {
            const evaluation = await tx.bM04Evaluation.upsert({
                where: { registrationId: regIdInt },
                create: {
                    registrationId: regIdInt,
                    semesterId: registration.semesterId,
                    studentId: registration.studentId,
                    lecturerId: userId,
                    thesisFormatScore: String(thesisFormatScore).trim(),
                    researchContentScore: String(researchContentScore).trim(),
                    applicabilityScore: String(applicabilityScore).trim(),
                    attitudeScore: String(attitudeScore).trim(),
                    conclusion: isAgreed ? 'AGREED_FOR_DEFENSE' : 'NOT_AGREED_FOR_DEFENSE',
                    generalNotes: generalNotes ? String(generalNotes).trim() : null,
                    lecturerSignature: String(lecturerSignature).trim(),
                    signedAt: new Date(),
                    isLocked: true,
                    policyVersionId: registration.periodPolicyVersionId,
                },
                update: {
                    thesisFormatScore: String(thesisFormatScore).trim(),
                    researchContentScore: String(researchContentScore).trim(),
                    applicabilityScore: String(applicabilityScore).trim(),
                    attitudeScore: String(attitudeScore).trim(),
                    conclusion: isAgreed ? 'AGREED_FOR_DEFENSE' : 'NOT_AGREED_FOR_DEFENSE',
                    generalNotes: generalNotes ? String(generalNotes).trim() : null,
                    lecturerSignature: String(lecturerSignature).trim(),
                    signedAt: new Date(),
                    isLocked: true,
                    policyVersionId: registration.periodPolicyVersionId,
                },
            });

            await tx.topicRegistration.update({
                where: { id: regIdInt },
                data: { status: nextStatus },
            });

            if (tx.registrationStateHistory?.create) {
                await tx.registrationStateHistory.create({
                    data: {
                        registrationId: regIdInt,
                        fromStatus: registration.status,
                        toStatus: nextStatus,
                        fromStateVersion: registration.stateVersion || 0,
                        toStateVersion: (registration.stateVersion || 0) + 1,
                        actorId: userId,
                        reason: isAgreed
                            ? 'GVHD ký khóa BM04 ĐỒNG Ý cho ra bảo vệ'
                            : 'GVHD ký khóa BM04 KHÔNG ĐỒNG Ý cho ra bảo vệ (dừng đồ án)',
                    },
                });
            }

            await tx.task.updateMany({
                where: { registrationId: regIdInt, taskType: 'BM04' },
                data: { status: 'COMPLETED' },
            });

            return evaluation;
        });

        await safeNotify(
            {
                userId: registration.studentId,
                title: isAgreed ? 'GVHD đã đồng ý cho bạn ra bảo vệ' : 'Kết quả thẩm định BM04: Không đồng ý bảo vệ',
                content: isAgreed
                    ? `GVHD đã hoàn tất phiếu nhận xét BM04 và ĐỒNG Ý cho bạn ra bảo vệ đề tài "${registration.topic.title}". Trạng thái: Sẵn sàng bảo vệ.`
                    : `GVHD đã hoàn tất phiếu nhận xét BM04 với kết luận KHÔNG ĐỒNG Ý cho bảo vệ đề tài "${registration.topic.title}".`,
                type: 'APPROVAL',
            },
            'submitBM04Evaluation',
        );

        await auditLog(
            userId,
            'SUBMIT_BM04_EVALUATION',
            'BM04Evaluation',
            result.id,
            { registrationId: regIdInt, conclusion, isLocked: true },
            getRequestIp(req),
        );

        res.json({
            success: true,
            message: isAgreed
                ? 'Đã lập phiếu BM04 và ký khóa thành công. Sinh viên đã tự động chuyển sang trạng thái Sẵn sàng bảo vệ (DEFENSE_READY).'
                : 'Đã lập phiếu BM04 và ghi nhận kết luận không cho phép bảo vệ.',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/evaluations/bm04/:registrationId
 * Xem chi tiết phiếu BM04 ở chế độ chỉ đọc
 */
const getBM04Evaluation = async (req, res, next) => {
    try {
        const registrationId = parseInt(req.params.registrationId, 10);
        if (!Number.isInteger(registrationId) || registrationId <= 0) {
            return res.status(400).json({ success: false, message: 'registrationId không hợp lệ.' });
        }

        const evaluation = await prisma.bM04Evaluation.findUnique({
            where: { registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true, email: true } },
                lecturer: { select: { id: true, fullName: true, code: true, email: true, academicTitle: true } },
                registration: {
                    include: {
                        topic: { select: { id: true, title: true } },
                        semester: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!evaluation) {
            return res.status(404).json({ success: false, message: 'Chưa có phiếu đánh giá BM04 cho đề tài này.' });
        }

        const canView = req.user.role === 'ADMIN'
            || (req.user.role === 'STUDENT' && evaluation.studentId === req.user.id)
            || (req.user.role === 'LECTURER' && evaluation.lecturerId === req.user.id);

        if (!canView) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem phiếu đánh giá BM04 này.',
            });
        }

        res.json({
            success: true,
            data: evaluation,
        });
    } catch (error) {
        next(error);
    }
};

const issueCheckpointEvaluation = async (req, res, next) => {
    try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
            return res.status(400).json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Yêu cầu Idempotency-Key header.' });
        }
        const { registrationId, checkpointNo, conclusion, comments, evidenceUrl, evidenceName, mentorSignature } = req.body;
        const result = await issueCheckpoint({
            registrationId: parseInt(registrationId, 10),
            checkpointNo: parseInt(checkpointNo, 10),
            conclusion,
            comments,
            evidenceUrl,
            evidenceName,
            mentorSignature,
            actorId: req.user.id,
            idempotencyKey,
        });
        res.json({ success: true, message: 'Đã phát hành biên bản BM03 Checkpoint thành công.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const signCheckpointEvaluation = async (req, res, next) => {
    try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
            return res.status(400).json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Yêu cầu Idempotency-Key header.' });
        }
        const { checkpointEvaluationId, studentSignature } = req.body;
        const result = await signCheckpoint({
            checkpointEvaluationId: parseInt(checkpointEvaluationId, 10),
            studentSignature,
            actorId: req.user.id,
            idempotencyKey,
        });
        res.json({ success: true, message: 'Đã ký xác nhận biên bản BM03 Checkpoint thành công.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const handleCheckpointOverdue = async (req, res, next) => {
    try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
            return res.status(400).json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Yêu cầu Idempotency-Key header.' });
        }
        const { checkpointEvaluationId } = req.body;
        const result = await handleSignatureOverdue({
            checkpointEvaluationId: parseInt(checkpointEvaluationId, 10),
            actorId: req.user.id,
            idempotencyKey,
        });
        res.json({ success: true, message: 'Đã chuyển sang trạng thái quá hạn ký Checkpoint.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const submitCheckpointAppeal = async (req, res, next) => {
    try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
            return res.status(400).json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Yêu cầu Idempotency-Key header.' });
        }
        const { checkpointEvaluationId, reason, evidenceUrl, evidenceName } = req.body;
        const result = await submitSignatureAppeal({
            checkpointEvaluationId: parseInt(checkpointEvaluationId, 10),
            reason,
            evidenceUrl,
            evidenceName,
            actorId: req.user.id,
            idempotencyKey,
        });
        res.json({ success: true, message: 'Đã nộp đơn khiếu nại chữ ký Checkpoint thành công.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const reviewCheckpointAppeal = async (req, res, next) => {
    try {
        const idempotencyKey = getIdempotencyKey(req);
        if (!idempotencyKey) {
            return res.status(400).json({ success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Yêu cầu Idempotency-Key header.' });
        }
        const { appealId, decision, reviewNotes, resolutionDecision } = req.body;
        const result = await reviewSignatureAppeal({
            appealId: parseInt(appealId, 10),
            decision,
            reviewNotes,
            resolutionDecision,
            actorId: req.user.id,
            idempotencyKey,
        });
        res.json({ success: true, message: 'Đã hoàn tất thẩm định khiếu nại chữ ký Checkpoint.', data: result });
    } catch (error) {
        if (sendWorkflowError(res, error)) return;
        next(error);
    }
};

const getCheckpointEvaluations = async (req, res, next) => {
    try {
        const regIdInt = parseInt(req.params.registrationId, 10);
        const evaluations = await prisma.checkpointEvaluation.findMany({
            where: { registrationId: regIdInt },
            include: {
                mentorSignedBy: { select: { id: true, fullName: true, code: true } },
                studentSignedBy: { select: { id: true, fullName: true, code: true } },
                appeal: {
                    include: {
                        reviewedBy: { select: { id: true, fullName: true } },
                    },
                },
            },
            orderBy: [{ checkpointNo: 'asc' }, { attemptNo: 'asc' }],
        });
        res.json({ success: true, data: evaluations });
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
    getDefenseResultApprovalAction,
    approveDefenseResultAction,
    correctDefenseResultAction,
    previewResultPublication,
    publishDefenseResults,
    getResultPublicationHistory,
    getMyPublishedDefenseResult,
    exportScoreSheetPdf,
    submitBM01,
    resubmitBM01,
    approveResubmittedBM01,
    submitBM04Evaluation,
    getBM04Evaluation,
    issueCheckpointEvaluation,
    signCheckpointEvaluation,
    handleCheckpointOverdue,
    submitCheckpointAppeal,
    reviewCheckpointAppeal,
    getCheckpointEvaluations,
};



