const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const { roundDefenseScoreOneDecimal } = require('../utils/defenseTimeWindowUtils');
const { safeNotifyMany } = require('./notificationService');
const rubricService = require('./rubricService');
const { normalizeRubricLevelPolicy } = require('./rubricLevelPolicy');

const DEFENSE_SCORING_SCOPE = 'defense-scoring';
const DEFENSE_MEMBER_SCORE_LOCK_SCOPE = 'defense-member-score-lock';
const DEFENSE_SCOREBOOK_LOCK_SCOPE = 'defense-scorebook-lock';
const DEFENSE_SCOREBOOK_RETURN_SCOPE = 'defense-scorebook-return';
const REQUIRED_COUNCIL_ROLES = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];

const ELIGIBLE_DEFENSE_GRADING_STATUSES = [
    'DEFENSE_READY',
    'DEFENDED',
    'SUBMITTED',
    'AWAITING_SCORES',
    'DEFENSE_ELIGIBLE',
    'ELIGIBLE_BY_INSTITUTE',
];

const RUBRIC_V1 = {
    version: 'v1',
    scoreLevelPolicy: normalizeRubricLevelPolicy(null),
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

const RUBRIC_INCLUDE = {
    categories: {
        orderBy: { orderIndex: 'asc' },
        include: { criteria: { orderBy: { orderIndex: 'asc' } } },
    },
};

const REGISTRATION_SCORING_INCLUDE = {
    semester: { select: { id: true, lockedDefenseRubricVersionId: true } },
    topic: {
        select: {
            id: true,
            title: true,
            mentorId: true,
            semesterId: true,
            semester: { select: { id: true, lockedDefenseRubricVersionId: true } },
        },
    },
    defenseCouncil: {
        select: {
            id: true,
            name: true,
            allowFourthScoringMember: true,
            rubricVersionId: true,
            rubricVersion: { select: { id: true, version: true } },
            semester: { select: { id: true, lockedDefenseRubricVersionId: true } },
            members: {
                select: {
                    id: true,
                    lecturerId: true,
                    roleInCouncil: true,
                    isActive: true,
                    isScoringMember: true,
                },
            },
        },
    },
    council: {
        select: {
            id: true,
            name: true,
            allowFourthScoringMember: true,
            rubricVersionId: true,
            rubricVersion: { select: { id: true, version: true } },
            semester: { select: { id: true, lockedDefenseRubricVersionId: true } },
            members: {
                select: {
                    id: true,
                    lecturerId: true,
                    roleInCouncil: true,
                    isActive: true,
                    isScoringMember: true,
                },
            },
        },
    },
    defenseResult: true,
    memberScores: true,
};

const round2 = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * 100) / 100;
};

/**
 * Xác định phiên bản rubric gắn với hồ sơ đăng ký (không fallback sang active nếu đã chốt phiên bản mà bị thiếu).
 * @param {object} registration
 * @param {object} [db]
 * @returns {Promise<object|null>}
 */
async function resolveRubricForRegistration(registration, db = prisma) {
    if (!db?.rubricVersion?.findUnique) return null;

    let effectiveCouncil = registration?.defenseCouncil || registration?.council;
    if (!effectiveCouncil && (registration?.defenseCouncilId || registration?.councilId) && typeof db.council?.findUnique === 'function') {
        const cId = registration.defenseCouncilId || registration.councilId;
        try {
            effectiveCouncil = await db.council.findUnique({
                where: { id: cId },
                include: { rubricVersion: true, semester: true },
            });
        } catch (_) {
            effectiveCouncil = null;
        }
    }

    // 1. Kiểm tra rubricId được ghim trực tiếp trên hội đồng bảo vệ hoặc học kỳ
    const pinnedRubricId = (
        effectiveCouncil?.rubricVersionId
        || effectiveCouncil?.rubricVersion?.id
        || registration?.semester?.lockedDefenseRubricVersionId
        || registration?.topic?.semester?.lockedDefenseRubricVersionId
        || effectiveCouncil?.semester?.lockedDefenseRubricVersionId
        || null
    );

    if (pinnedRubricId) {
        const foundById = await db.rubricVersion.findUnique({
            where: { id: Number(pinnedRubricId) },
            include: RUBRIC_INCLUDE,
        });
        if (foundById) {
            return foundById;
        }
        throw new WorkflowTransitionError(
            'PINNED_RUBRIC_NOT_FOUND',
            404,
            `Không tìm thấy phiên bản rubric (ID: ${pinnedRubricId}) đã gắn với hội đồng hoặc học kỳ.`,
        );
    }

    // 2. Tìm version từ council, phiếu chấm thành viên hiệu lực, hoặc defenseResult
    const effectiveMemberScore = (registration?.memberScores || []).find(
        (row) => row?.isEffective !== false && row?.scoreRubricVersion && row.scoreRubricVersion !== 'v1',
    ) || (registration?.memberScores || []).find((row) => row?.scoreRubricVersion && row.scoreRubricVersion !== 'v1')
      || (registration?.memberScores || []).find((row) => row?.isEffective !== false && row?.scoreRubricVersion)
      || (registration?.memberScores || []).find((row) => row?.scoreRubricVersion);

    const councilVersionName = effectiveCouncil?.rubricVersion?.version;
    const memberScoreVersionName = effectiveMemberScore?.scoreRubricVersion;
    const defenseResultVersionName = registration?.defenseResult?.scoreRubricVersion;

    let pinnedVersion = councilVersionName || memberScoreVersionName;
    if (!pinnedVersion && defenseResultVersionName) {
        pinnedVersion = defenseResultVersionName;
    }

    if (pinnedVersion) {
        const found = await db.rubricVersion.findUnique({
            where: { version: pinnedVersion },
            include: RUBRIC_INCLUDE,
        });
        if (found) {
            return found;
        }
        // Nếu pinnedVersion là 'v1' do default schema mà trong DB không có bản ghi 'v1',
        // không ném 404 mà tiếp tục thử getActiveRubric()
        if (pinnedVersion !== 'v1') {
            throw new WorkflowTransitionError(
                'PINNED_RUBRIC_NOT_FOUND',
                404,
                `Không tìm thấy phiên bản rubric "${pinnedVersion}" đã gắn với hồ sơ.`,
            );
        }
    }

    if (db === prisma) {
        const active = await rubricService.getActiveRubric();
        return active || null;
    }

    if (typeof db.rubricVersion?.findFirst === 'function') {
        const active = await db.rubricVersion.findFirst({
            where: { isActive: true },
            include: RUBRIC_INCLUDE,
        });
        return active
            ? { ...active, scoreLevelPolicy: normalizeRubricLevelPolicy(active.scoreLevelPolicy) }
            : null;
    }

    return null;
}

/**
 * Chuẩn hóa payload rubric trả về cho API và validator.
 * @param {object|null} resolvedRubric
 * @returns {object}
 */
function formatRubricPayload(resolvedRubric) {
    if (!resolvedRubric) {
        return {
            ...RUBRIC_V1,
            scoreLevelPolicy: normalizeRubricLevelPolicy(null),
        };
    }

    const scoreLevelPolicy = normalizeRubricLevelPolicy(resolvedRubric.scoreLevelPolicy);
    const categories = (resolvedRubric.categories || []).map((cat) => ({
        ...cat,
        criteria: (cat.criteria || []).map((cri) => ({
            ...cri,
            levelGoodDesc: cri.levelGoodDesc ?? null,
            levelFairDesc: cri.levelFairDesc ?? null,
            levelAverageDesc: cri.levelAverageDesc ?? null,
            levelPoorDesc: cri.levelPoorDesc ?? null,
        })),
    }));

    return {
        id: resolvedRubric.id,
        version: resolvedRubric.version,
        title: resolvedRubric.title,
        description: resolvedRubric.description,
        totalMaxScore: resolvedRubric.totalMaxScore,
        scoreLevelPolicy,
        categories,
        criteria: categories.flatMap((cat) =>
            (cat.criteria || []).map((cri) => ({
                code: cri.code,
                label: cri.label,
                description: cri.description ?? null,
                cloCode: cri.cloCode ?? null,
                levelGoodDesc: cri.levelGoodDesc ?? null,
                levelFairDesc: cri.levelFairDesc ?? null,
                levelAverageDesc: cri.levelAverageDesc ?? null,
                levelPoorDesc: cri.levelPoorDesc ?? null,
                maxScore: cri.maxScore,
                categoryCode: cat.code,
                categoryName: cat.name,
                orderIndex: cri.orderIndex,
            }))
        ),
    };
}

/**
 * Kiểm tra và chuẩn hóa danh sách điểm tiêu chí cho nháp (partial/empty) hoặc khóa phiếu (đầy đủ).
 * Không bao giờ tự điền 0 cho mục trống; giữ nguyên giá trị 0 hợp lệ; từ chối > 2 chữ số thập phân.
 * @param {Array} scoresInput
 * @param {object} rubricPayload
 * @param {{ requireAllCriteria?: boolean }} [options]
 */
function validateAndNormalizeMemberScores(scoresInput, rubricPayload, { requireAllCriteria = false } = {}) {
    if (!Array.isArray(scoresInput)) {
        throw new WorkflowTransitionError('INVALID_SCORES_PAYLOAD', 400, 'scores phải là một mảng hợp lệ.');
    }

    const criteriaList = rubricPayload?.criteria || [];
    const criteriaMap = new Map(criteriaList.map((c) => [c.code, c]));
    const seen = new Set();
    const normalized = [];

    for (const item of scoresInput) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new WorkflowTransitionError('INVALID_CRITERION_SCORE', 400, 'Phần tử điểm tiêu chí không hợp lệ.');
        }

        const criterionCode = typeof item.criterionCode === 'string' ? item.criterionCode.trim() : '';
        if (!criterionCode || !criteriaMap.has(criterionCode)) {
            throw new WorkflowTransitionError(
                'UNKNOWN_CRITERION_CODE',
                400,
                `Mã tiêu chí không hợp lệ hoặc không thuộc barem chấm điểm: ${criterionCode || 'N/A'}.`,
            );
        }

        if (seen.has(criterionCode)) {
            throw new WorkflowTransitionError(
                'DUPLICATE_CRITERION_CODE',
                400,
                `Mã tiêu chí bị trùng lặp trong phiếu điểm: ${criterionCode}.`,
            );
        }

        const rawScore = item.score;
        if (rawScore === null || rawScore === undefined || typeof rawScore === 'boolean') {
            throw new WorkflowTransitionError(
                'INVALID_CRITERION_SCORE',
                400,
                `Điểm của tiêu chí ${criterionCode} không được để trống.`,
            );
        }

        let parsedScore;
        if (typeof rawScore === 'number') {
            parsedScore = rawScore;
        } else if (typeof rawScore === 'string') {
            const trimmed = rawScore.trim();
            if (!trimmed || !/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
                throw new WorkflowTransitionError(
                    'INVALID_CRITERION_SCORE',
                    400,
                    `Điểm của tiêu chí ${criterionCode} không phải số hợp lệ.`,
                );
            }
            parsedScore = Number(trimmed);
        } else {
            throw new WorkflowTransitionError(
                'INVALID_CRITERION_SCORE',
                400,
                `Điểm của tiêu chí ${criterionCode} không hợp lệ.`,
            );
        }

        if (!Number.isFinite(parsedScore) || parsedScore < 0) {
            throw new WorkflowTransitionError(
                'INVALID_CRITERION_SCORE',
                400,
                `Điểm của tiêu chí ${criterionCode} phải là số hữu hạn >= 0.`,
            );
        }

        const hundredths = Math.round(parsedScore * 100);
        if (Math.abs(parsedScore * 100 - hundredths) > 1e-9) {
            throw new WorkflowTransitionError(
                'INVALID_CRITERION_SCORE',
                400,
                `Điểm của tiêu chí ${criterionCode} chỉ được phép tối đa 2 chữ số thập phân.`,
            );
        }

        const exactScore = hundredths / 100;
        const criterion = criteriaMap.get(criterionCode);
        const criterionMax = Number(criterion.maxScore);
        if (exactScore > criterionMax + 1e-9) {
            throw new WorkflowTransitionError(
                'INVALID_CRITERION_SCORE',
                400,
                `Điểm của tiêu chí ${criterionCode} (${exactScore}) vượt quá điểm tối đa (${criterionMax}).`,
            );
        }

        normalized.push({
            criterionCode,
            criterionLabel: criterion.label,
            maxScore: criterionMax,
            score: exactScore,
            comment: item.comment !== undefined && item.comment !== null ? String(item.comment).trim() : null,
        });
        seen.add(criterionCode);
    }

    if (requireAllCriteria && seen.size !== criteriaList.length) {
        const missing = criteriaList.filter((c) => !seen.has(c.code)).map((c) => c.code);
        throw new WorkflowTransitionError(
            'INCOMPLETE_CRITERION_SCORES',
            400,
            `Phiếu điểm chưa chấm đầy đủ tất cả tiêu chí (${seen.size}/${criteriaList.length}). Thiếu: ${missing.slice(0, 5).join(', ')}.`,
        );
    }

    const finalScore = normalized.length === 0
        ? null
        : round2(normalized.reduce((sum, row) => sum + row.score, 0));

    return {
        normalized,
        finalScore,
        scoredCriteriaCount: normalized.length,
        totalCriteriaCount: criteriaList.length,
    };
}

/**
 * Xác định các thành viên có quyền chấm điểm đang hoạt động trong hội đồng
 * - Mặc định: CHAIRMAN, SECRETARY, REVIEWER (3 thành viên)
 * - Nếu allowFourthScoringMember = true: thêm thành viên thứ 4 (role MEMBER với isScoringMember = true)
 * @param {object} council
 * @returns {Array<object>}
 */
function resolveActiveScoringMembers(council) {
    if (!council || !Array.isArray(council.members)) return [];
    const allowFourth = Boolean(council.allowFourthScoringMember);
    return council.members.filter((m) => {
        if (m.isActive === false) return false;
        if (['CHAIRMAN', 'SECRETARY', 'REVIEWER'].includes(m.roleInCouncil)) {
            return m.isScoringMember !== false;
        }
        if (m.roleInCouncil === 'MEMBER') {
            return allowFourth && m.isScoringMember === true;
        }
        return false;
    });
}

/**
 * Tính điểm trung bình cộng của các thành viên hội đồng hợp lệ
 * @param {Array<{finalScore: number|string, isEffective?: boolean}>} memberScores
 * @param {number} [divisor]
 * @returns {number|null}
 */
const computeAggregateDefenseScore = (memberScores = [], divisor = null) => {
    if (!Array.isArray(memberScores) || memberScores.length === 0) return null;
    const valid = memberScores.filter(
        (row) => row && row.isEffective !== false && row.finalScore !== null && row.finalScore !== undefined && row.finalScore !== '' && Number.isFinite(Number(row.finalScore)),
    );
    if (!valid.length) return null;
    const effectiveDivisor = (Number.isInteger(divisor) && divisor > 0) ? divisor : valid.length;
    const sum = valid.reduce((acc, row) => acc + Number(row.finalScore), 0);
    return round2(sum / effectiveDivisor);
};

/**
 * Kiểm tra xem kết quả bảo vệ của đăng ký này đã được công bố chưa
 */
async function isResultPublished(tx, registrationId) {
    if (!tx || !registrationId) return false;
    if (typeof tx.resultPublicationItem?.findFirst === 'function') {
        const item = await tx.resultPublicationItem.findFirst({
            where: { registrationId },
        });
        if (item) return true;
    }
    return false;
}

/**
 * Lưu bảng điểm nháp (hoặc cập nhật) của một thành viên hội đồng.
 * Cho phép lưu nháp rỗng (`scores: []`) hoặc một phần tiêu chí mà không tự điền 0;
 * không bao giờ ghi điểm chính thức vào `DefenseResult` trước khi khóa sổ đủ 3/4 người.
 */
async function saveMemberScoreSheet(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        evaluatorId,
        actorId,
        evaluatorRole,
        actorRole,
        scores,
        criterionScores,
        generalComment,
        comments,
        targetRubricVersion,
    } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    const effectiveEvaluatorId = evaluatorId || actorId;
    if (!Number.isInteger(effectiveEvaluatorId) || effectiveEvaluatorId <= 0) {
        throw new WorkflowTransitionError('INVALID_EVALUATOR_ID', 400, 'evaluatorId không hợp lệ.');
    }

    const effectiveActorRole = actorRole || evaluatorRole;
    if (actorId && evaluatorId && actorId !== evaluatorId && effectiveActorRole !== 'ADMIN') {
        throw new WorkflowTransitionError(
            'CANNOT_EDIT_OTHER_EVALUATOR_SCORE',
            403,
            'Không thể chỉnh sửa phiếu điểm của giám khảo khác.',
        );
    }

    let rawScoresInput;
    if (criterionScores !== undefined && scores === undefined) {
        rawScoresInput = criterionScores;
    } else if (Array.isArray(criterionScores) && criterionScores.length > 0 && (!Array.isArray(scores) || scores.length === 0)) {
        rawScoresInput = criterionScores;
    } else if (scores !== undefined) {
        rawScoresInput = scores;
    } else {
        rawScoresInput = [];
    }

    const effectiveComment = generalComment !== undefined ? generalComment : comments;

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: REGISTRATION_SCORING_INCLUDE,
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy đăng ký đề tài.');
        }

        // Kiểm tra đã công bố chưa - kết quả là bất biến sau công bố
        const published = await isResultPublished(tx, registrationId);
        if (published) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
                409,
                'Không thể chấm điểm: Kết quả đã được công bố chính thức và là bất biến.',
            );
        }

        // INV-11 & INV-20: Giảng viên hướng dẫn tuyệt đối không được chấm điểm hội đồng cho sinh viên mình hướng dẫn
        if (registration.topic?.mentorId === effectiveEvaluatorId) {
            throw new WorkflowTransitionError(
                'MENTOR_CANNOT_GRADE_OWN_STUDENT',
                403,
                'Xung đột lợi ích: Giảng viên hướng dẫn không được chấm điểm hội đồng bảo vệ cho sinh viên của mình.',
            );
        }

        // Kiểm tra quyền: Người chấm phải là thành viên chấm điểm hợp lệ đang hoạt động trong hội đồng
        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const activeScorers = resolveActiveScoringMembers(effectiveCouncil);
        const scoringLecturerIds = new Set(activeScorers.map((m) => m.lecturerId));
        const allCouncilMembers = effectiveCouncil?.members || [];
        const isActiveCouncilMember = allCouncilMembers.some((m) => m.lecturerId === effectiveEvaluatorId && m.isActive !== false);

        if (!scoringLecturerIds.has(effectiveEvaluatorId)) {
            if (isActiveCouncilMember) {
                throw new WorkflowTransitionError(
                    'EVALUATOR_NOT_SCORING_MEMBER',
                    403,
                    'Thành viên hội đồng này không có quyền chấm điểm (không thuộc danh sách thành viên chấm hợp lệ).',
                );
            }
            throw new WorkflowTransitionError(
                'EVALUATOR_NOT_IN_COUNCIL',
                403,
                'Người chấm không thuộc hội đồng bảo vệ của đề tài này.',
            );
        }

        // Kiểm tra trạng thái khóa điểm hội đồng
        if (registration.defenseResult?.scoreLocked) {
            throw new WorkflowTransitionError(
                'SCORE_LOCKED',
                409,
                'Bảng điểm hội đồng đã được khóa, không thể chỉnh sửa.',
            );
        }

        // Kiểm tra sinh viên có bị đánh dấu ABSENT không
        if (registration.defenseResult?.attendanceStatus === 'ABSENT') {
            throw new WorkflowTransitionError(
                'STUDENT_MARKED_ABSENT',
                409,
                'Sinh viên đã được ghi nhận vắng mặt, không thể chấm điểm.',
            );
        }

        // Kiểm tra trạng thái hồ sơ
        if (!ELIGIBLE_DEFENSE_GRADING_STATUSES.includes(registration.status)) {
            throw new WorkflowTransitionError(
                'INVALID_STATUS_FOR_DEFENSE_GRADING',
                409,
                `Hồ sơ đang ở trạng thái "${registration.status}", chưa đủ điều kiện chấm bảo vệ.`,
            );
        }

        // Kiểm tra phiếu điểm cá nhân có bị khóa riêng không
        let memberScore = await tx.defenseMemberScore.findUnique({
            where: {
                registrationId_evaluatorId: {
                    registrationId,
                    evaluatorId: effectiveEvaluatorId,
                },
            },
        });

        if (memberScore?.scoreLocked) {
            throw new WorkflowTransitionError(
                'SCORE_LOCKED',
                409,
                'Phiếu điểm cá nhân của bạn đã bị khóa, không thể chỉnh sửa.',
            );
        }

        // Giải quyết phiên bản rubric gắn với hồ sơ (không fallback sang active nếu bản đã gắn bị thiếu)
        const resolvedRubric = await resolveRubricForRegistration(registration, tx);
        const rubricPayload = formatRubricPayload(resolvedRubric);
        const resolvedRubricVersion = rubricPayload.version || RUBRIC_V1.version;

        if (
            targetRubricVersion !== undefined
            && targetRubricVersion !== null
            && String(targetRubricVersion).trim() !== ''
            && String(targetRubricVersion).trim() !== resolvedRubricVersion
        ) {
            throw new WorkflowTransitionError(
                'RUBRIC_VERSION_MISMATCH',
                400,
                `Phiên bản rubric gửi lên (${targetRubricVersion}) không khớp với phiên bản đã gắn với hồ sơ (${resolvedRubricVersion}).`,
            );
        }

        // Xác thực điểm tiêu chí cho nháp (cho phép rỗng hoặc một phần)
        const validated = validateAndNormalizeMemberScores(rawScoresInput, rubricPayload, {
            requireAllCriteria: false,
        });

        const currentMember = activeScorers.find((m) => m.lecturerId === effectiveEvaluatorId) ||
            allCouncilMembers.find((m) => m.lecturerId === effectiveEvaluatorId);

        if (!memberScore) {
            memberScore = await tx.defenseMemberScore.create({
                data: {
                    registrationId,
                    evaluatorId: effectiveEvaluatorId,
                    roleInCouncilSnapshot: currentMember?.roleInCouncil || null,
                    isEffective: true,
                    supersededReason: null,
                    finalScore: validated.finalScore,
                    comments: effectiveComment !== undefined && effectiveComment !== null ? String(effectiveComment).trim() : '',
                    scoreRubricVersion: resolvedRubricVersion,
                    scoreLocked: false,
                },
            });
        } else {
            memberScore = await tx.defenseMemberScore.update({
                where: { id: memberScore.id },
                data: {
                    finalScore: validated.finalScore,
                    isEffective: true,
                    supersededReason: null,
                    comments: effectiveComment !== undefined ? String(effectiveComment || '').trim() : memberScore.comments,
                    scoreRubricVersion: resolvedRubricVersion,
                },
            });
        }

        // Luôn xóa tiêu chí cũ và chỉ tạo lại các tiêu chí đã chấm (không tự điền 0 cho mục trống)
        await tx.defenseMemberCriterionScore.deleteMany({
            where: { defenseMemberScoreId: memberScore.id },
        });

        if (validated.normalized.length > 0) {
            await tx.defenseMemberCriterionScore.createMany({
                data: validated.normalized.map((row) => ({
                    defenseMemberScoreId: memberScore.id,
                    criterionCode: row.criterionCode,
                    criterionLabel: row.criterionLabel,
                    maxScore: row.maxScore,
                    score: row.score,
                    comment: row.comment,
                })),
            });
        }

        // Không ghi điểm hội đồng chính thức từ phiếu nháp/chưa khóa sổ.
        // Nếu DefenseResult đã tồn tại trước đó (ví dụ sau trả sổ), xóa điểm tổng cũ để tránh lộ điểm chưa chốt.
        if (registration.defenseResult && typeof tx.defenseResult?.updateMany === 'function') {
            await tx.defenseResult.updateMany({
                where: { registrationId },
                data: {
                    finalScore: null,
                    rawAverageScore: null,
                    roundedFinalScore: null,
                    activeScorerCount: activeScorers.length > 0 ? activeScorers.length : 3,
                    scoreRubricVersion: resolvedRubricVersion,
                },
            });
        }

        return {
            ...memberScore,
            registration,
            memberScore,
            defenseResult: null,
            finalScore: validated.finalScore,
            rubricVersion: resolvedRubricVersion,
            scoredCriteriaCount: validated.scoredCriteriaCount,
            totalCriteriaCount: validated.totalCriteriaCount,
            aggregateFinalScore: null,
            rawAverageScore: null,
            roundedFinalScore: null,
        };
    });
}

/**
 * Khóa phiếu điểm cá nhân của một thành viên hội đồng (bắt buộc đầy đủ tất cả tiêu chí rubric hợp lệ).
 */
async function lockMemberScoreSheet(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        evaluatorId,
        actorId,
        scores,
        criterionScores,
        generalComment,
        comments,
        targetRubricVersion,
        idempotencyKey,
    } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }

    const effectiveEvaluatorId = evaluatorId || actorId;
    if (!Number.isInteger(effectiveEvaluatorId) || effectiveEvaluatorId <= 0) {
        throw new WorkflowTransitionError('INVALID_EVALUATOR_ID', 400, 'evaluatorId không hợp lệ.');
    }

    if (actorId && evaluatorId && actorId !== evaluatorId) {
        throw new WorkflowTransitionError(
            'CANNOT_LOCK_OTHER_EVALUATOR_SCORE',
            403,
            'Không thể khóa phiếu điểm thay cho giám khảo khác.',
        );
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Bắt buộc phải có Idempotency-Key để khóa phiếu điểm.');
    }

    const cleanIdempotencyKey = idempotencyKey.trim();
    const hasInlineScores = scores !== undefined || criterionScores !== undefined;
    const hashInput = {
        registrationId,
        evaluatorId: effectiveEvaluatorId,
    };
    if (hasInlineScores) {
        hashInput.scores = criterionScores !== undefined ? criterionScores : scores;
    }
    if (generalComment !== undefined || comments !== undefined) {
        hashInput.generalComment = generalComment !== undefined ? generalComment : comments;
    }
    const commandHash = crypto.createHash('sha256').update(JSON.stringify(hashInput)).digest('hex');

    return await db.$transaction(async (tx) => {
        // Idempotency check
        if (typeof tx?.idempotencyRecord?.findUnique === 'function') {
            const receipt = await tx.idempotencyRecord.findUnique({
                where: {
                    scope_key: {
                        scope: DEFENSE_MEMBER_SCORE_LOCK_SCOPE,
                        key: cleanIdempotencyKey,
                    },
                },
            });
            if (receipt) {
                if (receipt.commandHash !== commandHash) {
                    throw new WorkflowTransitionError(
                        'IDEMPOTENCY_KEY_REUSED',
                        409,
                        'Idempotency-Key đã được sử dụng cho một thao tác khác.',
                    );
                }
                return { ...receipt.response, idempotent: true };
            }
        }

        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: REGISTRATION_SCORING_INCLUDE,
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy đăng ký đề tài.');
        }

        // Kiểm tra đã công bố chưa - kết quả là bất biến sau công bố
        const published = await isResultPublished(tx, registrationId);
        if (published) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
                409,
                'Không thể khóa phiếu điểm: Kết quả đã được công bố chính thức và là bất biến.',
            );
        }

        // INV-11 & INV-20: Giảng viên hướng dẫn tuyệt đối không được chấm điểm hội đồng cho sinh viên mình hướng dẫn
        if (registration.topic?.mentorId === effectiveEvaluatorId) {
            throw new WorkflowTransitionError(
                'MENTOR_CANNOT_GRADE_OWN_STUDENT',
                403,
                'Xung đột lợi ích: Giảng viên hướng dẫn không được chấm điểm hội đồng bảo vệ cho sinh viên của mình.',
            );
        }

        // Kiểm tra quyền: Người chấm phải là thành viên chấm điểm hợp lệ đang hoạt động
        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const activeScorers = resolveActiveScoringMembers(effectiveCouncil);
        const scoringLecturerIds = new Set(activeScorers.map((m) => m.lecturerId));
        const allCouncilMembers = effectiveCouncil?.members || [];
        const isActiveCouncilMember = allCouncilMembers.some((m) => m.lecturerId === effectiveEvaluatorId && m.isActive !== false);

        if (!scoringLecturerIds.has(effectiveEvaluatorId)) {
            if (isActiveCouncilMember) {
                throw new WorkflowTransitionError(
                    'EVALUATOR_NOT_SCORING_MEMBER',
                    403,
                    'Thành viên hội đồng này không có quyền chấm hoặc khóa phiếu điểm.',
                );
            }
            throw new WorkflowTransitionError(
                'EVALUATOR_NOT_IN_COUNCIL',
                403,
                'Người chấm không thuộc hội đồng bảo vệ của đề tài này.',
            );
        }

        // Kiểm tra trạng thái khóa điểm hội đồng
        if (registration.defenseResult?.scoreLocked) {
            throw new WorkflowTransitionError(
                'SCORE_LOCKED',
                409,
                'Bảng điểm hội đồng đã được khóa, không thể chỉnh sửa hoặc khóa lại.',
            );
        }

        // Kiểm tra sinh viên có bị đánh dấu ABSENT không
        if (registration.defenseResult?.attendanceStatus === 'ABSENT') {
            throw new WorkflowTransitionError(
                'STUDENT_MARKED_ABSENT',
                409,
                'Sinh viên đã được ghi nhận vắng mặt, không thể chấm hoặc khóa điểm.',
            );
        }

        // Kiểm tra trạng thái hồ sơ
        if (!ELIGIBLE_DEFENSE_GRADING_STATUSES.includes(registration.status)) {
            throw new WorkflowTransitionError(
                'INVALID_STATUS_FOR_DEFENSE_GRADING',
                409,
                `Trạng thái đề tài không hợp lệ (${registration.status}). Chỉ được khóa điểm khi ở trạng thái: ${ELIGIBLE_DEFENSE_GRADING_STATUSES.join(', ')}.`,
            );
        }

        // Kiểm tra phiếu điểm cá nhân có bị khóa chưa
        let memberScore = await tx.defenseMemberScore.findUnique({
            where: {
                registrationId_evaluatorId: {
                    registrationId,
                    evaluatorId: effectiveEvaluatorId,
                },
            },
            include: { criterionScores: true },
        });

        if (memberScore?.scoreLocked) {
            throw new WorkflowTransitionError(
                'SCORE_LOCKED',
                409,
                'Phiếu điểm cá nhân của bạn đã bị khóa, không thể chỉnh sửa hoặc khóa đè.',
            );
        }

        // Giải quyết phiên bản rubric gắn với hồ sơ
        const resolvedRubric = await resolveRubricForRegistration(registration, tx);
        const rubricPayload = formatRubricPayload(resolvedRubric);
        const resolvedRubricVersion = rubricPayload.version || RUBRIC_V1.version;

        if (
            targetRubricVersion !== undefined
            && targetRubricVersion !== null
            && String(targetRubricVersion).trim() !== ''
            && String(targetRubricVersion).trim() !== resolvedRubricVersion
        ) {
            throw new WorkflowTransitionError(
                'RUBRIC_VERSION_MISMATCH',
                400,
                `Phiên bản rubric gửi lên (${targetRubricVersion}) không khớp với phiên bản đã gắn với hồ sơ (${resolvedRubricVersion}).`,
            );
        }

        const now = new Date();
        const effectiveComment = generalComment !== undefined ? generalComment : comments;

        if (hasInlineScores) {
            let inlineScoresInput;
            if (criterionScores !== undefined && scores === undefined) {
                inlineScoresInput = criterionScores;
            } else if (Array.isArray(criterionScores) && criterionScores.length > 0 && (!Array.isArray(scores) || scores.length === 0)) {
                inlineScoresInput = criterionScores;
            } else {
                inlineScoresInput = scores;
            }

            const validated = validateAndNormalizeMemberScores(inlineScoresInput, rubricPayload, {
                requireAllCriteria: true,
            });

            const currentMember = activeScorers.find((m) => m.lecturerId === effectiveEvaluatorId) ||
                allCouncilMembers.find((m) => m.lecturerId === effectiveEvaluatorId);

            if (!memberScore) {
                memberScore = await tx.defenseMemberScore.create({
                    data: {
                        registrationId,
                        evaluatorId: effectiveEvaluatorId,
                        roleInCouncilSnapshot: currentMember?.roleInCouncil || null,
                        isEffective: true,
                        supersededReason: null,
                        finalScore: validated.finalScore,
                        comments: effectiveComment !== undefined && effectiveComment !== null ? String(effectiveComment).trim() : '',
                        scoreRubricVersion: resolvedRubricVersion,
                        scoreLocked: true,
                        lockedAt: now,
                        lockedBy: effectiveEvaluatorId,
                    },
                });
            } else {
                memberScore = await tx.defenseMemberScore.update({
                    where: { id: memberScore.id },
                    data: {
                        finalScore: validated.finalScore,
                        isEffective: true,
                        supersededReason: null,
                        comments: effectiveComment !== undefined ? String(effectiveComment || '').trim() : memberScore.comments,
                        scoreRubricVersion: resolvedRubricVersion,
                        scoreLocked: true,
                        lockedAt: now,
                        lockedBy: effectiveEvaluatorId,
                    },
                });
            }

            await tx.defenseMemberCriterionScore.deleteMany({
                where: { defenseMemberScoreId: memberScore.id },
            });

            await tx.defenseMemberCriterionScore.createMany({
                data: validated.normalized.map((row) => ({
                    defenseMemberScoreId: memberScore.id,
                    criterionCode: row.criterionCode,
                    criterionLabel: row.criterionLabel,
                    maxScore: row.maxScore,
                    score: row.score,
                    comment: row.comment,
                })),
            });
        } else {
            if (!memberScore || memberScore.finalScore === null || memberScore.finalScore === undefined) {
                throw new WorkflowTransitionError(
                    'SCORE_NOT_FOUND',
                    400,
                    'Chưa có điểm để khóa. Vui lòng nhập điểm trước khi khóa phiếu.',
                );
            }

            if (memberScore.scoreRubricVersion && memberScore.scoreRubricVersion !== resolvedRubricVersion) {
                throw new WorkflowTransitionError(
                    'RUBRIC_VERSION_MISMATCH',
                    400,
                    `Phiếu nháp đang ở phiên bản rubric (${memberScore.scoreRubricVersion}) không khớp với phiên bản đã gắn (${resolvedRubricVersion}).`,
                );
            }

            let finalScoreToLock = memberScore.finalScore;
            if (Array.isArray(memberScore.criterionScores)) {
                const validatedSaved = validateAndNormalizeMemberScores(memberScore.criterionScores, rubricPayload, {
                    requireAllCriteria: true,
                });
                finalScoreToLock = validatedSaved.finalScore;
            }

            memberScore = await tx.defenseMemberScore.update({
                where: { id: memberScore.id },
                data: {
                    finalScore: finalScoreToLock,
                    scoreRubricVersion: resolvedRubricVersion,
                    scoreLocked: true,
                    lockedAt: now,
                    lockedBy: effectiveEvaluatorId,
                    isEffective: true,
                },
            });
        }

        // Tuyệt đối không ghi điểm trung bình tạm thời thành điểm chính thức trên DefenseResult trước khi khóa sổ
        if (registration.defenseResult && typeof tx.defenseResult?.updateMany === 'function') {
            await tx.defenseResult.updateMany({
                where: { registrationId },
                data: {
                    finalScore: null,
                    rawAverageScore: null,
                    roundedFinalScore: null,
                    activeScorerCount: activeScorers.length > 0 ? activeScorers.length : 3,
                    scoreRubricVersion: resolvedRubricVersion,
                },
            });
        }

        const responsePayload = {
            ...memberScore,
            registrationId,
            evaluatorId: effectiveEvaluatorId,
            memberScoreId: memberScore.id,
            finalScore: memberScore.finalScore,
            scoreRubricVersion: resolvedRubricVersion,
            scoreLocked: true,
            lockedAt: memberScore.lockedAt || now.toISOString(),
            aggregateFinalScore: null,
            rawAverageScore: null,
            roundedFinalScore: null,
        };

        if (typeof tx?.idempotencyRecord?.create === 'function') {
            await tx.idempotencyRecord.create({
                data: {
                    scope: DEFENSE_MEMBER_SCORE_LOCK_SCOPE,
                    key: cleanIdempotencyKey,
                    commandHash,
                    registrationId,
                    response: responsePayload,
                },
            });
        }

        return responsePayload;
    });
}

/**
 * Ghi nhận sinh viên vắng mặt bảo vệ bởi Chủ tịch Hội đồng (Branch B)
 */
async function markStudentAbsentByChairman(input, options = {}) {
    const db = options.db || prisma;
    const { registrationId, chairmanId, absentMinutesText, idempotencyKey } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    if (!Number.isInteger(chairmanId) || chairmanId <= 0) {
        throw new WorkflowTransitionError('INVALID_CHAIRMAN_ID', 400, 'chairmanId không hợp lệ.');
    }

    if (!absentMinutesText || typeof absentMinutesText !== 'string' || absentMinutesText.trim().length === 0) {
        throw new WorkflowTransitionError('ABSENT_MINUTES_REQUIRED', 400, 'Biên bản xác nhận sinh viên vắng mặt là bắt buộc.');
    }

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                defenseCouncil: {
                    select: {
                        id: true,
                        name: true,
                        rubricVersionId: true,
                        rubricVersion: { select: { id: true, version: true } },
                        members: { select: { lecturerId: true, roleInCouncil: true, isActive: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
                        rubricVersionId: true,
                        rubricVersion: { select: { id: true, version: true } },
                        members: { select: { lecturerId: true, roleInCouncil: true, isActive: true } },
                    },
                },
                defenseResult: true,
                memberScores: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy đăng ký đề tài.');
        }

        // Kiểm tra quyền: Chỉ Chủ tịch Hội đồng (CHAIRMAN) mới có quyền thực hiện
        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const councilMembers = effectiveCouncil?.members || [];
        const chairman = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN' && m.isActive !== false);

        if (!chairman || chairman.lecturerId !== chairmanId) {
            throw new WorkflowTransitionError(
                'ONLY_CHAIRMAN_CAN_MARK_ABSENT',
                403,
                'Chỉ Chủ tịch Hội đồng mới có quyền lập biên bản và xác nhận sinh viên vắng mặt.',
            );
        }

        // Kiểm tra đã công bố chưa
        const published = await isResultPublished(tx, registrationId);
        if (published) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
                409,
                'Không thể đánh dấu vắng mặt: Kết quả đã được công bố chính thức và là bất biến.',
            );
        }

        // Kiểm tra trạng thái khóa điểm hội đồng
        if (registration.defenseResult?.scoreLocked) {
            throw new WorkflowTransitionError(
                'SCORE_LOCKED',
                409,
                'Bảng điểm hội đồng đã được khóa, không thể thay đổi thông tin điểm danh.',
            );
        }

        const now = new Date();

        // Đánh dấu các phiếu thành viên (nếu có ai lỡ lưu nháp trước đó) thành isEffective = false, supersededReason = 'STUDENT_ABSENT'
        await tx.defenseMemberScore.updateMany({
            where: { registrationId },
            data: {
                isEffective: false,
                supersededReason: 'STUDENT_ABSENT',
            },
        });

        const resolvedRubric = await resolveRubricForRegistration(registration, tx);
        const rubricPayload = formatRubricPayload(resolvedRubric);
        const resolvedRubricVersion = rubricPayload?.version || (
            effectiveCouncil?.rubricVersion?.version
            || (effectiveCouncil?.rubricVersionId ? String(effectiveCouncil.rubricVersionId) : null)
            || 'v1'
        );

        // Ghi nhận vắng mặt vào DefenseResult: rawAverageScore = null, roundedFinalScore = null
        // TUYỆT ĐỐI KHÔNG TẠO PHIẾU CHẤM GIẢ, KHÔNG GÁN ĐIỂM 0 GIẢ
        const defenseResult = await tx.defenseResult.upsert({
            where: { registrationId },
            update: {
                attendanceStatus: 'ABSENT',
                absentMinutesText: absentMinutesText.trim(),
                absentConfirmedByChairId: chairmanId,
                absentConfirmedAt: now,
                rawAverageScore: null,
                roundedFinalScore: null,
                finalScore: null,
                scoreRubricVersion: resolvedRubricVersion,
            },
            create: {
                registrationId,
                attendanceStatus: 'ABSENT',
                absentMinutesText: absentMinutesText.trim(),
                absentConfirmedByChairId: chairmanId,
                absentConfirmedAt: now,
                rawAverageScore: null,
                roundedFinalScore: null,
                finalScore: null,
                evaluatorId: chairmanId,
                scoreRubricVersion: resolvedRubricVersion,
            },
        });

        return defenseResult;
    });
}

/**
 * Khóa sổ điểm hội đồng bảo vệ bởi Chủ tịch Hội đồng (hoặc Admin có thẩm quyền)
 * - Tách rõ 2 nhánh:
 *   + Nhánh A (PRESENT): Bắt buộc 100% thành viên chấm có hiệu lực (3 hoặc 4 người) đã khóa phiếu cá nhân
 *   + Nhánh B (ABSENT): Cho phép Chủ tịch khóa sổ ngay khi có biên bản xác nhận vắng mặt mà không đòi hỏi 3-4 phiếu chấm
 */
async function lockDefenseScoreBookByChairman(input, options = {}) {
    const db = options.db || prisma;
    const { registrationId, actorId, idempotencyKey } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    if (!Number.isInteger(actorId) || actorId <= 0) {
        throw new WorkflowTransitionError('INVALID_ACTOR_ID', 400, 'actorId không hợp lệ.');
    }

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                defenseCouncil: {
                    select: {
                        id: true,
                        name: true,
                        rubricVersionId: true,
                        rubricVersion: { select: { id: true, version: true } },
                        allowFourthScoringMember: true,
                        members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
                        rubricVersionId: true,
                        rubricVersion: { select: { id: true, version: true } },
                        allowFourthScoringMember: true,
                        members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                    },
                },
                memberScores: true,
                defenseResult: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        // Kiểm tra đã công bố chưa
        const published = await isResultPublished(tx, registrationId);
        if (published) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
                409,
                'Không thể khóa sổ điểm: Kết quả đã được công bố chính thức và là bất biến.',
            );
        }

        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const councilMembers = effectiveCouncil?.members || [];
        const chairman = councilMembers.find((m) => m.roleInCouncil === 'CHAIRMAN' && m.isActive !== false);

        // Kiểm tra thẩm quyền: Phải là Chủ tịch Hội đồng hoặc Admin có RESULT_LOCK
        let isAuthorized = chairman && chairman.lecturerId === actorId;

        if (!isAuthorized) {
            // Kiểm tra permissions của actor
            if (typeof tx?.userPermissionGroup?.findMany === 'function') {
                const userGroups = await tx.userPermissionGroup.findMany({
                    where: { userId: actorId },
                    include: { permissionGroup: { include: { permissions: { include: { permission: true } } } } },
                });
                for (const g of userGroups) {
                    for (const p of g.permissionGroup?.permissions || []) {
                        if (p.permission?.code === 'RESULT_LOCK') {
                            isAuthorized = true;
                            break;
                        }
                    }
                    if (isAuthorized) break;
                }
            }
        }

        if (!isAuthorized) {
            throw new WorkflowTransitionError(
                'CHAIRMAN_PERMISSION_REQUIRED',
                403,
                'Chỉ Chủ tịch Hội đồng (hoặc Quản trị viên có thẩm quyền) mới có quyền khóa sổ điểm.',
            );
        }

        const activeScorers = resolveActiveScoringMembers(effectiveCouncil);
        const activeScorerCount = activeScorers.length > 0 ? activeScorers.length : 3;
        const isAbsent = registration.defenseResult?.attendanceStatus === 'ABSENT';

        let rawAverageScore = null;
        let roundedFinalScore = null;
        let validScores = [];

        if (isAbsent) {
            // NHÁNH B: Sinh viên vắng mặt (ABSENT)
            // Phải có biên bản xác nhận vắng mặt
            if (!registration.defenseResult?.absentMinutesText) {
                throw new WorkflowTransitionError(
                    'ABSENT_MINUTES_NOT_CONFIRMED',
                    400,
                    'Chưa thể khóa sổ điểm: Hồ sơ vắng mặt chưa có biên bản xác nhận từ Chủ tịch.',
                );
            }
            // Không yêu cầu phiếu điểm thành viên, không tạo điểm giả
            rawAverageScore = null;
            roundedFinalScore = null;
        } else {
            // NHÁNH A: Sinh viên có mặt (PRESENT)
            // BẮT BUỘC đủ 100% thành viên chấm có hiệu lực (3 hoặc 4 người) đã khóa phiếu cá nhân
            if (activeScorers.length === 0) {
                throw new WorkflowTransitionError(
                    'INVALID_COUNCIL_COMPOSITION',
                    400,
                    'Hội đồng bảo vệ chưa có thành viên chấm điểm hợp lệ.',
                );
            }

            const effectiveMemberScores = (registration.memberScores || []).filter((s) => s.isEffective !== false);

            for (const scorer of activeScorers) {
                const memberScore = effectiveMemberScores.find((s) => s.evaluatorId === scorer.lecturerId);
                if (!memberScore || !memberScore.scoreLocked) {
                    throw new WorkflowTransitionError(
                        'INCOMPLETE_MEMBER_SCORES',
                        409,
                        `Chưa thể khóa sổ điểm: Còn thiếu phiếu điểm đã khóa của thành viên ${scorer.roleInCouncil}.`,
                    );
                }

                const rawScore = memberScore.finalScore;
                if (rawScore === null || rawScore === undefined || rawScore === '') {
                    throw new WorkflowTransitionError(
                        'INVALID_MEMBER_SCORE',
                        400,
                        `Chưa thể khóa sổ điểm: Điểm của ${scorer.roleInCouncil} không được để trống.`,
                    );
                }
                const numScore = Number(rawScore);
                if (isNaN(numScore) || !Number.isFinite(numScore) || numScore < 0 || numScore > 10) {
                    throw new WorkflowTransitionError(
                        'INVALID_MEMBER_SCORE',
                        400,
                        `Chưa thể khóa sổ điểm: Điểm của ${scorer.roleInCouncil} không hợp lệ (phải là số thực từ 0.0 đến 10.0).`,
                    );
                }
            }

            validScores = activeScorers.map((scorer) => {
                const ms = effectiveMemberScores.find((s) => s.evaluatorId === scorer.lecturerId);
                return Number(ms.finalScore);
            });

            const sum = validScores.reduce((acc, score) => acc + score, 0);
            rawAverageScore = sum / activeScorerCount;
            roundedFinalScore = roundDefenseScoreOneDecimal(rawAverageScore);
        }

        const maxScore = !isAbsent && validScores.length > 0 ? Math.max(...validScores) : 0;
        const minScore = !isAbsent && validScores.length > 0 ? Math.min(...validScores) : 0;
        const scoreDelta = maxScore - minScore;
        const discrepancyNote = scoreDelta >= 1.5 ? `, Độ lệch GK: ${scoreDelta.toFixed(1)}đ (HĐ đã họp thống nhất)` : '';

        const targetStatus = 'AWAITING_FINAL_APPROVAL';
        const expectedStatus = registration.status;

        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus,
            expectedStateVersion: registration.stateVersion || 0,
            targetStatus,
            actorId,
            reason: isAbsent
                ? 'Chủ tịch Hội đồng khóa sổ điểm cho sinh viên vắng mặt'
                : `Chủ tịch Hội đồng khóa sổ điểm (Điểm TB: ${roundedFinalScore}${discrepancyNote})`,
            idempotencyKey: idempotencyKey || `lock-defense-${registration.id}-${registration.stateVersion || 0}`,
        }, { tx });

        const now = new Date();

        const resolvedRubric = await resolveRubricForRegistration(registration, tx);
        const rubricPayload = formatRubricPayload(resolvedRubric);
        const resolvedRubricVersion = rubricPayload.version || (
            effectiveCouncil?.rubricVersion?.version
            || (effectiveCouncil?.rubricVersionId ? String(effectiveCouncil.rubricVersionId) : null)
            || (registration.memberScores?.find((m) => m.scoreRubricVersion)?.scoreRubricVersion)
            || 'v1'
        );

        const defenseResult = await tx.defenseResult.upsert({
            where: { registrationId },
            create: {
                registrationId,
                finalScore: isAbsent ? null : roundedFinalScore,
                rawAverageScore: isAbsent ? null : rawAverageScore,
                roundedFinalScore: isAbsent ? null : roundedFinalScore,
                activeScorerCount,
                scoreRubricVersion: resolvedRubricVersion,
                scoreLocked: true,
                lockedAt: now,
                lockedBy: actorId,
                evaluatorId: actorId,
            },
            update: {
                finalScore: isAbsent ? null : roundedFinalScore,
                rawAverageScore: isAbsent ? null : rawAverageScore,
                roundedFinalScore: isAbsent ? null : roundedFinalScore,
                activeScorerCount,
                scoreRubricVersion: resolvedRubricVersion,
                scoreLocked: true,
                lockedAt: now,
                lockedBy: actorId,
            },
        });

        // Cập nhật đồng bộ cờ khóa sổ điểm của Hội đồng trong cùng transaction
        const councilId = registration.defenseCouncilId || registration.councilId || effectiveCouncil?.id;
        if (councilId && typeof tx.council?.update === 'function') {
            await tx.council.update({
                where: { id: councilId },
                data: {
                    scoreBookLocked: true,
                    scoreBookLockedAt: now,
                    scoreBookLockedById: actorId,
                },
            });
        }

        return {
            ...defenseResult,
            id: registration.id,
            status: targetStatus,
            finalScore: isAbsent ? null : roundedFinalScore,
            rawAverageScore: isAbsent ? null : rawAverageScore,
            roundedFinalScore: isAbsent ? null : roundedFinalScore,
            scoreLocked: true,
            transitionResult,
        };
    });
}

/**
 * Trả sổ điểm trước công bố bởi Quản trị viên (Admin Scorebook Return)
 * - Mở khóa đúng những phiếu được chọn (reopenMemberScoreIds) với versionNumber + 1
 * - Hạ cờ khóa sổ của DefenseResult
 * - Ghi nhận log vào DefenseScoreBookReturnLog kèm previousStateSnapshot
 * - Chuyển trạng thái hồ sơ về AWAITING_SCORES
 */
async function returnScoreBookBeforePublication(input, options = {}) {
    const db = options.db || prisma;
    const { registrationId, adminId, reason, reopenMemberScoreIds = [], idempotencyKey } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    if (!Number.isInteger(adminId) || adminId <= 0) {
        throw new WorkflowTransitionError('INVALID_ADMIN_ID', 400, 'adminId không hợp lệ.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        throw new WorkflowTransitionError('RETURN_REASON_REQUIRED', 400, 'Lý do trả sổ điểm là bắt buộc.');
    }
    if (!Array.isArray(reopenMemberScoreIds) || reopenMemberScoreIds.length === 0) {
        throw new WorkflowTransitionError(
            'REOPEN_MEMBER_SCORES_REQUIRED',
            400,
            'Danh sách phiếu điểm cần mở lại (reopenMemberScoreIds) là bắt buộc.',
        );
    }

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                defenseCouncil: { include: { members: true } },
                council: { include: { members: true } },
                defenseResult: true,
                memberScores: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        // Kiểm tra điều kiện: Kết quả chưa được công bố
        const published = await isResultPublished(tx, registrationId);
        if (published) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
                409,
                'Không thể trả sổ điểm: Kết quả đã được công bố chính thức và là bất biến.',
            );
        }

        // Kiểm tra sổ điểm đã được khóa chưa
        if (!registration.defenseResult?.scoreLocked) {
            throw new WorkflowTransitionError(
                'SCOREBOOK_NOT_LOCKED',
                400,
                'Sổ điểm chưa được khóa, không thể thực hiện trả sổ.',
            );
        }

        const fromLedgerVersion = registration.defenseResult.ledgerVersion || 1;
        const toLedgerVersion = fromLedgerVersion + 1;
        const now = new Date();

        // Tạo snapshot trạng thái trước khi mở khóa
        const previousStateSnapshot = {
            defenseResult: {
                finalScore: registration.defenseResult.finalScore,
                rawAverageScore: registration.defenseResult.rawAverageScore,
                roundedFinalScore: registration.defenseResult.roundedFinalScore,
                ledgerVersion: fromLedgerVersion,
                scoreLocked: registration.defenseResult.scoreLocked,
                lockedAt: registration.defenseResult.lockedAt,
                lockedBy: registration.defenseResult.lockedBy,
            },
            memberScores: (registration.memberScores || []).map((ms) => ({
                id: ms.id,
                evaluatorId: ms.evaluatorId,
                finalScore: ms.finalScore,
                versionNumber: ms.versionNumber,
                scoreLocked: ms.scoreLocked,
                isEffective: ms.isEffective,
            })),
        };

        // Mở khóa đúng những phiếu được chọn
        const reopenIdSet = new Set(reopenMemberScoreIds);
        for (const ms of registration.memberScores || []) {
            if (reopenIdSet.has(ms.id)) {
                await tx.defenseMemberScore.update({
                    where: { id: ms.id },
                    data: {
                        scoreLocked: false,
                        versionNumber: (ms.versionNumber || 1) + 1,
                        reopenedAt: now,
                        reopenedById: adminId,
                        reopenReason: reason.trim(),
                    },
                });
            }
        }

        // Hạ cờ khóa sổ của DefenseResult
        const updatedDefenseResult = await tx.defenseResult.update({
            where: { registrationId },
            data: {
                scoreLocked: false,
                lockedAt: null,
                lockedBy: null,
                ledgerVersion: toLedgerVersion,
            },
        });

        // Ghi nhận lịch sử vào bảng DefenseScoreBookReturnLog
        const councilId = registration.defenseCouncilId || registration.councilId || registration.defenseCouncil?.id || registration.council?.id;

        // Mở lại trạng thái khóa sổ của Hội đồng
        if (councilId && typeof tx.council?.update === 'function') {
            await tx.council.update({
                where: { id: councilId },
                data: {
                    scoreBookLocked: false,
                    scoreBookLockedAt: null,
                    scoreBookLockedById: null,
                },
            });
        }

        const returnLog = await tx.defenseScoreBookReturnLog.create({
            data: {
                councilId: councilId || 0,
                registrationId,
                fromLedgerVersion,
                toLedgerVersion,
                returnedByAdminId: adminId,
                reason: reason.trim(),
                reopenedMemberScoreIds: reopenMemberScoreIds,
                previousStateSnapshot,
            },
        });

        // Chuyển trạng thái hồ sơ về AWAITING_SCORES
        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: registration.status,
            expectedStateVersion: registration.stateVersion || 0,
            targetStatus: 'AWAITING_SCORES',
            actorId: adminId,
            reason: `Admin trả sổ điểm về hội đồng: ${reason.trim()}`,
            idempotencyKey: idempotencyKey || `return-scorebook-${registration.id}-${toLedgerVersion}`,
        }, { tx });

        const council = registration.defenseCouncil || registration.council;
        let councilMembers = council?.members || [];
        if ((!councilMembers || councilMembers.length === 0) && councilId && tx.councilMember?.findMany) {
            try {
                councilMembers = await tx.councilMember.findMany({
                    where: { councilId, isActive: true },
                });
            } catch (_) {
                councilMembers = [];
            }
        }

        const memberUserIds = (councilMembers || [])
            .map((m) => m.userId || m.lecturerId)
            .filter(Boolean);

        if (memberUserIds.length > 0) {
            await safeNotifyMany(
                memberUserIds.map((userId) => ({
                    userId,
                    title: 'Sổ điểm hội đồng đã được hoàn trả để rà soát',
                    content: `Sổ điểm bảo vệ sinh viên ${registration.student?.fullName || ''} đã được Quản trị viên hoàn trả về hội đồng. Lý do: ${reason.trim()}`,
                    type: 'DEFENSE',
                })),
                'returnScoreBookBeforePublication'
            );
        }

        return {
            defenseResult: updatedDefenseResult,
            returnLog,
            transitionResult,
        };
    });
}

/**
 * Khóa hoặc mở khóa bảng điểm hội đồng bảo vệ (Legacy helper)
 */
async function lockDefenseScores(input, options = {}) {
    const db = options.db || prisma;
    const { registrationId, action, actorId, actorRole, actorPermissions, idempotencyKey } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    if (!['LOCK', 'UNLOCK'].includes(action)) {
        throw new WorkflowTransitionError('INVALID_ACTION', 400, 'action phải là LOCK hoặc UNLOCK.');
    }

    const lockState = action === 'LOCK';

    return await db.$transaction(async (tx) => {
        let permissions = actorPermissions;
        if (!permissions && actorId && typeof tx?.userPermissionGroup?.findMany === 'function') {
            const userGroups = await tx.userPermissionGroup.findMany({
                where: { userId: actorId },
                include: { permissionGroup: { include: { permissions: { include: { permission: true } } } } },
            });
            const permSet = new Set();
            userGroups.forEach((g) => {
                (g.permissionGroup?.permissions || []).forEach((p) => {
                    if (p.permission?.code) permSet.add(p.permission.code);
                });
            });
            permissions = [...permSet];
        }

        const hasLockCapability = Array.isArray(permissions) && (
            permissions.includes('RESULT_LOCK')
        );

        if (actorRole === 'ADMIN' && !hasLockCapability) {
            throw new WorkflowTransitionError(
                'RESULT_LOCK_REQUIRED',
                403,
                'Tài khoản Quản trị viên (ADMIN) không có capability RESULT_LOCK để khóa sổ điểm.',
            );
        }

        if (Array.isArray(permissions) && !hasLockCapability) {
            throw new WorkflowTransitionError(
                'RESULT_LOCK_REQUIRED',
                403,
                'Người thực hiện không có capability RESULT_LOCK để khóa sổ điểm.',
            );
        }

        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                defenseCouncil: {
                    select: {
                        id: true,
                        name: true,
                        members: { select: { lecturerId: true, roleInCouncil: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
                        members: { select: { lecturerId: true, roleInCouncil: true } },
                    },
                },
                memberScores: true,
                defenseResult: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
        }

        // Kiểm tra đã công bố chưa - kết quả là bất biến sau công bố
        const published = await isResultPublished(tx, registrationId);
        if (published) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
                409,
                'Không thể thay đổi trạng thái khóa điểm: Kết quả đã được công bố chính thức và là bất biến.',
            );
        }

        const effectiveCouncil = registration.defenseCouncil || registration.council;

        if (lockState) {
            if (!registration.memberScores?.length) {
                throw new WorkflowTransitionError(
                    'NO_MEMBER_SCORES',
                    400,
                    'Hồ sơ chưa có điểm bảo vệ nào của hội đồng để khóa.',
                );
            }

            let aggregateFinalScore;

            if (effectiveCouncil && Array.isArray(effectiveCouncil.members) && effectiveCouncil.members.length > 0) {
                const councilMembersByRole = {};
                for (const role of REQUIRED_COUNCIL_ROLES) {
                    const member = effectiveCouncil.members.find((m) => m.roleInCouncil === role);
                    if (!member) {
                        throw new WorkflowTransitionError(
                            'INVALID_COUNCIL_COMPOSITION',
                            400,
                            `Hội đồng bảo vệ thiếu chức danh bắt buộc: ${role}.`,
                        );
                    }
                    councilMembersByRole[role] = member;
                }

                // 1. Check that all 3 roles have submitted score sheets
                for (const role of REQUIRED_COUNCIL_ROLES) {
                    const member = councilMembersByRole[role];
                    const memberScore = (registration.memberScores || []).find((s) => s.evaluatorId === member.lecturerId);
                    if (!memberScore) {
                        throw new WorkflowTransitionError(
                            'MISSING_COUNCIL_MEMBER_SCORES',
                            400,
                            `Chưa thể khóa điểm: Còn thiếu phiếu điểm của thành viên ${role}.`,
                        );
                    }
                }

                // 2. Check that all 3 member scores are locked and have valid scores
                const lockedMemberScores = [];
                for (const role of REQUIRED_COUNCIL_ROLES) {
                    const member = councilMembersByRole[role];
                    const memberScore = (registration.memberScores || []).find((s) => s.evaluatorId === member.lecturerId);

                    if (!memberScore.scoreLocked) {
                        throw new WorkflowTransitionError(
                            'MEMBER_SCORE_NOT_LOCKED',
                            400,
                            `Chưa thể khóa điểm: Phiếu điểm của thành viên ${role} chưa được khóa cá nhân.`,
                        );
                    }

                    const rawScore = memberScore.finalScore;
                    if (rawScore === null || rawScore === undefined || rawScore === '') {
                        throw new WorkflowTransitionError(
                            'INVALID_MEMBER_SCORE',
                            400,
                            `Chưa thể khóa điểm: Điểm của ${role} không được để trống (null hoặc undefined).`,
                        );
                    }

                    const numScore = Number(rawScore);
                    if (isNaN(numScore) || !Number.isFinite(numScore) || numScore < 0 || numScore > 10) {
                        throw new WorkflowTransitionError(
                            'INVALID_MEMBER_SCORE',
                            400,
                            `Chưa thể khóa điểm: Điểm của ${role} không hợp lệ (phải là số thực từ 0.0 đến 10.0, không được NaN).`,
                        );
                    }

                    lockedMemberScores.push(numScore);
                }

                const sum = lockedMemberScores.reduce((acc, score) => acc + score, 0);
                aggregateFinalScore = round2(sum / 3);
            } else {
                aggregateFinalScore = computeAggregateDefenseScore(registration.memberScores);
            }

            if (aggregateFinalScore === null || !Number.isFinite(aggregateFinalScore)) {
                throw new WorkflowTransitionError(
                    'INVALID_MEMBER_SCORE',
                    400,
                    'Không thể tính điểm trung bình hợp lệ từ các phiếu điểm.',
                );
            }

            const targetStatus = 'AWAITING_FINAL_APPROVAL';
            const expectedStatus = registration.status;

            const transitionResult = await transitionRegistration({
                registrationId: registration.id,
                expectedStatus,
                expectedStateVersion: registration.stateVersion || 0,
                targetStatus,
                actorId,
                reason: `Chốt và khóa bảng điểm Hội đồng bảo vệ (Điểm TB cộng: ${aggregateFinalScore})`,
                idempotencyKey: idempotencyKey || `lock-defense-${registration.id}-${registration.stateVersion || 0}`,
            }, { tx });

            await tx.defenseMemberScore.updateMany({
                where: { registrationId },
                data: {
                    scoreLocked: true,
                },
            });

            await tx.defenseResult.upsert({
                where: { registrationId },
                create: {
                    registrationId,
                    finalScore: aggregateFinalScore,
                    scoreLocked: true,
                    lockedAt: new Date(),
                    lockedBy: actorId,
                    evaluatorId: actorId,
                },
                update: {
                    finalScore: aggregateFinalScore,
                    scoreLocked: true,
                    lockedAt: new Date(),
                    lockedBy: actorId,
                },
            });

            const councilId = registration.defenseCouncilId || registration.councilId || effectiveCouncil?.id;
            if (councilId && typeof tx.council?.update === 'function') {
                await tx.council.update({
                    where: { id: councilId },
                    data: {
                        scoreBookLocked: true,
                        scoreBookLockedAt: new Date(),
                        scoreBookLockedById: actorId,
                    },
                });
            }

            return {
                id: registration.id,
                status: targetStatus,
                finalScore: aggregateFinalScore,
                scoreLocked: true,
                transitionResult,
            };
        } else {
            if (registration.status !== 'AWAITING_FINAL_APPROVAL') {
                throw new WorkflowTransitionError(
                    'INVALID_STATUS_FOR_UNLOCK',
                    400,
                    `Chỉ có thể mở khóa khi hồ sơ ở trạng thái AWAITING_FINAL_APPROVAL (hiện tại: ${registration.status}).`,
                );
            }

            const targetStatus = 'DEFENSE_READY';

            const transitionResult = await transitionRegistration({
                registrationId: registration.id,
                expectedStatus: 'AWAITING_FINAL_APPROVAL',
                expectedStateVersion: registration.stateVersion || 0,
                targetStatus,
                actorId,
                reason: 'Mở khóa bảng điểm Hội đồng bảo vệ để điều chỉnh điểm',
                idempotencyKey: idempotencyKey || `unlock-defense-${registration.id}-${registration.stateVersion || 0}`,
            }, { tx });

            await tx.defenseMemberScore.updateMany({
                where: { registrationId },
                data: {
                    scoreLocked: false,
                    lockedAt: null,
                    lockedBy: null,
                },
            });

            await tx.defenseResult.updateMany({
                where: { registrationId },
                data: {
                    scoreLocked: false,
                    lockedAt: null,
                    lockedBy: null,
                },
            });

            const councilId = registration.defenseCouncilId || registration.councilId || effectiveCouncil?.id;
            if (councilId && typeof tx.council?.update === 'function') {
                await tx.council.update({
                    where: { id: councilId },
                    data: {
                        scoreBookLocked: false,
                        scoreBookLockedAt: null,
                        scoreBookLockedById: null,
                    },
                });
            }

            return {
                id: registration.id,
                status: targetStatus,
                scoreLocked: false,
                transitionResult,
            };
        }
    });
}

module.exports = {
    DEFENSE_SCORING_SCOPE,
    DEFENSE_MEMBER_SCORE_LOCK_SCOPE,
    DEFENSE_SCOREBOOK_LOCK_SCOPE,
    DEFENSE_SCOREBOOK_RETURN_SCOPE,
    RUBRIC_V1,
    RUBRIC_INCLUDE,
    round2,
    resolveActiveScoringMembers,
    resolveRubricForRegistration,
    formatRubricPayload,
    validateAndNormalizeMemberScores,
    computeAggregateDefenseScore,
    saveMemberScoreSheet,
    lockMemberScoreSheet,
    saveAndLockMemberScore: lockMemberScoreSheet,
    markStudentAbsentByChairman,
    lockDefenseScoreBookByChairman,
    returnScoreBookBeforePublication,
    lockDefenseScores,
};
