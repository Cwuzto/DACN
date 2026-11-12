const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const { roundDefenseScoreOneDecimal } = require('../utils/defenseTimeWindowUtils');
const { safeNotifyMany } = require('./notificationService');

const DEFENSE_SCORING_SCOPE = 'defense-scoring';
const DEFENSE_MEMBER_SCORE_LOCK_SCOPE = 'defense-member-score-lock';
const DEFENSE_SCOREBOOK_LOCK_SCOPE = 'defense-scorebook-lock';
const DEFENSE_SCOREBOOK_RETURN_SCOPE = 'defense-scorebook-return';
const REQUIRED_COUNCIL_ROLES = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];

const round2 = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * 100) / 100;
};

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
 * Lưu bảng điểm (nháp hoặc cập nhật) của một thành viên hội đồng
 */
async function saveMemberScoreSheet(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        evaluatorId,
        actorId,
        evaluatorRole,
        scores = [],
        criterionScores,
        generalComment = '',
        comments,
        targetRubricVersion = 'v1',
    } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    const effectiveEvaluatorId = evaluatorId || actorId;
    if (!Number.isInteger(effectiveEvaluatorId) || effectiveEvaluatorId <= 0) {
        throw new WorkflowTransitionError('INVALID_EVALUATOR_ID', 400, 'evaluatorId không hợp lệ.');
    }

    const effectiveScores = Array.isArray(criterionScores) && criterionScores.length > 0 ? criterionScores : scores;
    const effectiveComment = generalComment !== undefined ? generalComment : comments;

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: { select: { id: true, title: true, mentorId: true } },
                defenseCouncil: {
                    select: {
                        id: true,
                        name: true,
                        allowFourthScoringMember: true,
                        members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
                        allowFourthScoringMember: true,
                        members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                    },
                },
                defenseResult: true,
                memberScores: true,
            },
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

        // Kiểm tra quyền: Người chấm phải thuộc hội đồng bảo vệ và đang active
        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const activeScorers = resolveActiveScoringMembers(effectiveCouncil);
        const scoringLecturerIds = new Set(activeScorers.map((m) => m.lecturerId));

        // Kiểm tra người chấm có thuộc hội đồng
        const allCouncilMembers = effectiveCouncil?.members || [];
        const isMemberOfCouncil = allCouncilMembers.some((m) => m.lecturerId === effectiveEvaluatorId && m.isActive !== false);

        if (!isMemberOfCouncil && !scoringLecturerIds.has(effectiveEvaluatorId)) {
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
        const eligibleStatuses = [
            'DEFENSE_READY', 'DEFENDED', 'SUBMITTED', 'AWAITING_SCORES',
            'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE',
        ];
        if (!eligibleStatuses.includes(registration.status)) {
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

        // Tính điểm tổng phiếu cá nhân từ các tiêu chí
        const totalScore = effectiveScores.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
        const finalScore = round2(totalScore);

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
                    finalScore,
                    comments: effectiveComment ? String(effectiveComment).trim() : '',
                    scoreRubricVersion: targetRubricVersion,
                    scoreLocked: false,
                },
            });
        } else {
            memberScore = await tx.defenseMemberScore.update({
                where: { id: memberScore.id },
                data: {
                    finalScore,
                    isEffective: true,
                    supersededReason: null,
                    comments: effectiveComment !== undefined ? String(effectiveComment || '').trim() : memberScore.comments,
                    scoreRubricVersion: targetRubricVersion,
                },
            });
        }

        // Xóa và tạo mới các điểm tiêu chí
        if (effectiveScores.length > 0) {
            await tx.defenseMemberCriterionScore.deleteMany({
                where: { defenseMemberScoreId: memberScore.id },
            });

            await tx.defenseMemberCriterionScore.createMany({
                data: effectiveScores.map((row) => ({
                    defenseMemberScoreId: memberScore.id,
                    criterionCode: row.criterionCode || (row.criterionId ? `C_${row.criterionId}` : 'CRITERION'),
                    criterionLabel: row.criterionLabel || row.criterionCode || 'Tiêu chí',
                    maxScore: Number(row.maxScore) || 10,
                    score: Number(row.score) || 0,
                    comment: row.comment || null,
                })),
            });
        }

        // Tính toán lại Điểm tổng kết:
        // Lấy tất cả các phiếu chấm có hiệu lực (isEffective = true) của các thành viên đang hoạt động
        const activeScorerCount = activeScorers.length > 0 ? activeScorers.length : 3;
        const activeScorerIds = activeScorers.map((m) => m.lecturerId);

        const allMemberScores = await tx.defenseMemberScore.findMany({
            where: {
                registrationId,
                evaluatorId: activeScorerIds.length > 0 ? { in: activeScorerIds } : undefined,
                isEffective: true,
            },
            select: { finalScore: true, evaluatorId: true, isEffective: true },
        });

        const activeScorerIdSet = new Set(activeScorerIds);
        const validScores = allMemberScores.filter((s) =>
            s.isEffective !== false &&
            s.finalScore !== null &&
            s.finalScore !== undefined &&
            !isNaN(Number(s.finalScore)) &&
            (activeScorerIdSet.size === 0 || activeScorerIdSet.has(s.evaluatorId))
        );
        const sumScores = validScores.reduce((sum, row) => sum + Number(row.finalScore), 0);

        // Chia cho số thành viên chấm có hiệu lực (3 hoặc 4)
        const rawAverageScore = activeScorerCount > 0 ? sumScores / activeScorerCount : null;
        const roundedFinalScore = roundDefenseScoreOneDecimal(rawAverageScore);

        const defenseResult = await tx.defenseResult.upsert({
            where: { registrationId },
            update: {
                rawAverageScore,
                roundedFinalScore,
                finalScore: roundedFinalScore,
                activeScorerCount,
                evaluatorId: effectiveEvaluatorId,
                scoreRubricVersion: targetRubricVersion,
            },
            create: {
                registrationId,
                rawAverageScore,
                roundedFinalScore,
                finalScore: roundedFinalScore,
                activeScorerCount,
                comments: '',
                evaluatorId: effectiveEvaluatorId,
                scoreRubricVersion: targetRubricVersion,
            },
        });

        return {
            ...memberScore,
            registration,
            memberScore,
            defenseResult,
            aggregateFinalScore: roundedFinalScore,
            rawAverageScore,
            roundedFinalScore,
        };
    });
}

/**
 * Khóa phiếu điểm cá nhân của một thành viên hội đồng
 */
async function lockMemberScoreSheet(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        evaluatorId,
        actorId,
        evaluatorRole,
        scores,
        criterionScores,
        generalComment,
        comments,
        targetRubricVersion = 'v1',
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
    const hashInput = {
        registrationId,
        evaluatorId: effectiveEvaluatorId,
    };
    if (scores || criterionScores) hashInput.scores = scores || criterionScores;
    if (generalComment || comments) hashInput.generalComment = generalComment || comments;
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
            include: {
                topic: { select: { id: true, title: true, mentorId: true } },
                defenseCouncil: {
                    select: {
                        id: true,
                        name: true,
                        allowFourthScoringMember: true,
                        members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
                        allowFourthScoringMember: true,
                        members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                    },
                },
                defenseResult: true,
                memberScores: true,
            },
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

        // Kiểm tra quyền: Người chấm phải thuộc hội đồng bảo vệ
        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const activeScorers = resolveActiveScoringMembers(effectiveCouncil);
        const allCouncilMembers = effectiveCouncil?.members || [];
        const isMemberOfCouncil = allCouncilMembers.some((m) => m.lecturerId === effectiveEvaluatorId && m.isActive !== false);

        if (!isMemberOfCouncil) {
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
        const eligibleStatuses = [
            'DEFENSE_READY', 'DEFENDED', 'SUBMITTED', 'AWAITING_SCORES',
            'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE',
        ];
        if (!eligibleStatuses.includes(registration.status)) {
            throw new WorkflowTransitionError(
                'INVALID_STATUS_FOR_DEFENSE_GRADING',
                409,
                `Trạng thái đề tài không hợp lệ (${registration.status}). Chỉ được khóa điểm khi ở trạng thái: ${eligibleStatuses.join(', ')}.`,
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
        });

        if (memberScore?.scoreLocked) {
            throw new WorkflowTransitionError(
                'SCORE_LOCKED',
                409,
                'Phiếu điểm cá nhân của bạn đã bị khóa, không thể chỉnh sửa hoặc khóa đè.',
            );
        }

        const now = new Date();
        const effectiveScores = Array.isArray(criterionScores) && criterionScores.length > 0 ? criterionScores : scores;
        const effectiveComment = generalComment !== undefined ? generalComment : comments;

        if (effectiveScores && Array.isArray(effectiveScores) && effectiveScores.length > 0) {
            for (const row of effectiveScores) {
                const s = Number(row.score);
                if (row.score === null || row.score === undefined || isNaN(s) || s < 0) {
                    throw new WorkflowTransitionError(
                        'INVALID_CRITERION_SCORE',
                        400,
                        `Điểm tiêu chí ${row.criterionCode || ''} không hợp lệ (phải là số thực >= 0).`,
                    );
                }
            }
            const totalScore = effectiveScores.reduce((sum, item) => sum + Number(item.score), 0);
            const finalScore = round2(totalScore);
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
                        finalScore,
                        comments: effectiveComment ? String(effectiveComment).trim() : '',
                        scoreRubricVersion: targetRubricVersion,
                        scoreLocked: true,
                        lockedAt: now,
                        lockedBy: effectiveEvaluatorId,
                    },
                });
            } else {
                memberScore = await tx.defenseMemberScore.update({
                    where: { id: memberScore.id },
                    data: {
                        finalScore,
                        isEffective: true,
                        supersededReason: null,
                        comments: effectiveComment !== undefined ? String(effectiveComment || '').trim() : memberScore.comments,
                        scoreRubricVersion: targetRubricVersion,
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
                data: effectiveScores.map((row) => ({
                    defenseMemberScoreId: memberScore.id,
                    criterionCode: row.criterionCode || (row.criterionId ? `C_${row.criterionId}` : 'CRITERION'),
                    criterionLabel: row.criterionLabel || row.criterionCode || 'Tiêu chí',
                    maxScore: Number(row.maxScore) || 10,
                    score: Number(row.score),
                    comment: row.comment || null,
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
            memberScore = await tx.defenseMemberScore.update({
                where: { id: memberScore.id },
                data: {
                    scoreLocked: true,
                    lockedAt: now,
                    lockedBy: effectiveEvaluatorId,
                    isEffective: true,
                },
            });
        }

        // Cập nhật lại điểm trung bình tạm thời
        const activeScorerCount = activeScorers.length > 0 ? activeScorers.length : 3;
        const activeScorerIds = activeScorers.map((m) => m.lecturerId);

        const allMemberScores = await tx.defenseMemberScore.findMany({
            where: {
                registrationId,
                evaluatorId: activeScorerIds.length > 0 ? { in: activeScorerIds } : undefined,
                isEffective: true,
            },
            select: { finalScore: true, evaluatorId: true },
        });

        const activeScorerIdSet = new Set(activeScorerIds);
        const validScores = allMemberScores.filter((s) =>
            s.isEffective !== false &&
            s.finalScore !== null &&
            s.finalScore !== undefined &&
            !isNaN(Number(s.finalScore)) &&
            (activeScorerIdSet.size === 0 || activeScorerIdSet.has(s.evaluatorId))
        );
        const sumScores = validScores.reduce((sum, row) => sum + Number(row.finalScore), 0);
        const rawAverageScore = activeScorerCount > 0 ? sumScores / activeScorerCount : null;
        const roundedFinalScore = roundDefenseScoreOneDecimal(rawAverageScore);

        await tx.defenseResult.upsert({
            where: { registrationId },
            update: {
                rawAverageScore,
                roundedFinalScore,
                finalScore: roundedFinalScore,
                activeScorerCount,
                evaluatorId: effectiveEvaluatorId,
                scoreRubricVersion: targetRubricVersion,
            },
            create: {
                registrationId,
                rawAverageScore,
                roundedFinalScore,
                finalScore: roundedFinalScore,
                activeScorerCount,
                comments: '',
                evaluatorId: effectiveEvaluatorId,
                scoreRubricVersion: targetRubricVersion,
            },
        });

        const responsePayload = {
            ...memberScore,
            registrationId,
            evaluatorId: effectiveEvaluatorId,
            memberScoreId: memberScore.id,
            finalScore: memberScore.finalScore,
            scoreLocked: true,
            lockedAt: memberScore.lockedAt || now.toISOString(),
            aggregateFinalScore: roundedFinalScore,
            rawAverageScore,
            roundedFinalScore,
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
                        members: { select: { lecturerId: true, roleInCouncil: true, isActive: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
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
                        allowFourthScoringMember: true,
                        members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                    },
                },
                council: {
                    select: {
                        id: true,
                        name: true,
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
                        if (['RESULT_LOCK', 'DEFENSE_SCORE_LOCK'].includes(p.permission?.code)) {
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

            const validScores = activeScorers.map((scorer) => {
                const ms = effectiveMemberScores.find((s) => s.evaluatorId === scorer.lecturerId);
                return Number(ms.finalScore);
            });

            const sum = validScores.reduce((acc, score) => acc + score, 0);
            rawAverageScore = sum / activeScorerCount;
            roundedFinalScore = roundDefenseScoreOneDecimal(rawAverageScore);
        }

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
                : `Chủ tịch Hội đồng khóa sổ điểm (Điểm TB: ${roundedFinalScore})`,
            idempotencyKey: idempotencyKey || `lock-defense-${registration.id}-${registration.stateVersion || 0}`,
        }, { tx });

        const now = new Date();

        const defenseResult = await tx.defenseResult.upsert({
            where: { registrationId },
            create: {
                registrationId,
                finalScore: isAbsent ? null : roundedFinalScore,
                rawAverageScore: isAbsent ? null : rawAverageScore,
                roundedFinalScore: isAbsent ? null : roundedFinalScore,
                activeScorerCount,
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
                scoreLocked: true,
                lockedAt: now,
                lockedBy: actorId,
            },
        });

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
            permissions.includes('RESULT_LOCK') || permissions.includes('DEFENSE_SCORE_LOCK')
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
    round2,
    resolveActiveScoringMembers,
    computeAggregateDefenseScore,
    saveMemberScoreSheet,
    lockMemberScoreSheet,
    saveAndLockMemberScore: lockMemberScoreSheet,
    markStudentAbsentByChairman,
    lockDefenseScoreBookByChairman,
    returnScoreBookBeforePublication,
    lockDefenseScores,
};
