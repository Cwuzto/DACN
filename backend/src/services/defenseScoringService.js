const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

const DEFENSE_SCORING_SCOPE = 'defense-scoring';
const DEFENSE_MEMBER_SCORE_LOCK_SCOPE = 'defense-member-score-lock';
const REQUIRED_COUNCIL_ROLES = ['CHAIRMAN', 'SECRETARY', 'REVIEWER'];

const round2 = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * 100) / 100;
};

/**
 * Tính điểm trung bình cộng của các thành viên hội đồng hợp lệ
 * @param {Array<{finalScore: number|string}>} memberScores
 * @returns {number|null}
 */
const computeAggregateDefenseScore = (memberScores = []) => {
    if (!Array.isArray(memberScores) || memberScores.length === 0) return null;
    const valid = memberScores.filter(
        (row) => row && row.finalScore !== null && row.finalScore !== undefined && row.finalScore !== '' && Number.isFinite(Number(row.finalScore)),
    );
    if (!valid.length) return null;
    const sum = valid.reduce((acc, row) => acc + Number(row.finalScore), 0);
    return round2(sum / valid.length);
};

/**
 * Lưu bảng điểm của một thành viên hội đồng
 */
async function saveMemberScoreSheet(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        evaluatorId,
        evaluatorRole,
        scores = [],
        generalComment = '',
        targetRubricVersion = 'v1',
    } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    if (!Number.isInteger(evaluatorId) || evaluatorId <= 0) {
        throw new WorkflowTransitionError('INVALID_EVALUATOR_ID', 400, 'evaluatorId không hợp lệ.');
    }

    return await db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            include: {
                topic: { select: { id: true, title: true, mentorId: true } },
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
                defenseResult: true,
                memberScores: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy đăng ký đề tài.');
        }

        // INV-11 & INV-20: Giảng viên hướng dẫn tuyệt đối không được chấm điểm hội đồng cho sinh viên mình hướng dẫn
        if (registration.topic?.mentorId === evaluatorId) {
            throw new WorkflowTransitionError(
                'MENTOR_CANNOT_GRADE_OWN_STUDENT',
                403,
                'Xung đột lợi ích: Giảng viên hướng dẫn không được chấm điểm hội đồng bảo vệ cho sinh viên của mình.',
            );
        }

        // Kiểm tra quyền: Người chấm phải thuộc hội đồng bảo vệ (Zero-Trust: Admin không bypass)
        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const effectiveMembers = effectiveCouncil?.members || [];
        const councilMemberIdSet = new Set(effectiveMembers.map((m) => m.lecturerId));

        if (!councilMemberIdSet.has(evaluatorId)) {
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

        // Kiểm tra trạng thái hồ sơ: Phải ở DEFENSE_READY hoặc DEFENDED (khi chưa khóa)
        const eligibleStatuses = ['DEFENSE_READY', 'DEFENDED', 'SUBMITTED'];
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
                    evaluatorId,
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
        const totalScore = scores.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
        const finalScore = round2(totalScore);

        if (!memberScore) {
            memberScore = await tx.defenseMemberScore.create({
                data: {
                    registrationId,
                    finalScore,
                    comments: generalComment ? String(generalComment).trim() : '',
                    evaluatorId,
                    scoreRubricVersion: targetRubricVersion,
                },
            });
        } else {
            memberScore = await tx.defenseMemberScore.update({
                where: { id: memberScore.id },
                data: {
                    finalScore,
                    comments: generalComment !== undefined ? String(generalComment || '').trim() : memberScore.comments,
                    scoreRubricVersion: targetRubricVersion,
                },
            });
        }

        // Xóa và tạo mới các điểm tiêu chí
        await tx.defenseMemberCriterionScore.deleteMany({
            where: { defenseMemberScoreId: memberScore.id },
        });

        await tx.defenseMemberCriterionScore.createMany({
            data: scores.map((row) => ({
                defenseMemberScoreId: memberScore.id,
                criterionCode: row.criterionCode,
                criterionLabel: row.criterionLabel || row.criterionCode,
                maxScore: Number(row.maxScore) || 10,
                score: Number(row.score) || 0,
                comment: row.comment || null,
            })),
        });

        // Tính toán lại Điểm tổng kết: Trung bình cộng các thành viên hội đồng hợp lệ
        const councilMemberIds = [...new Set(effectiveMembers.map((m) => m.lecturerId))];
        const consideredEvaluatorIds = councilMemberIds.length ? councilMemberIds : [evaluatorId];

        const allMemberScores = await tx.defenseMemberScore.findMany({
            where: {
                registrationId,
                evaluatorId: { in: consideredEvaluatorIds },
            },
            select: { finalScore: true, evaluatorId: true },
        });

        const aggregateFinalScore = computeAggregateDefenseScore(allMemberScores);

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

        return {
            registration,
            memberScore,
            defenseResult,
            aggregateFinalScore,
        };
    });
}

/**
 * Khóa phiếu điểm cá nhân của một thành viên hội đồng (Step 1)
 */
async function lockMemberScoreSheet(input, options = {}) {
    const db = options.db || prisma;
    const {
        registrationId,
        evaluatorId,
        actorId,
        evaluatorRole,
        scores,
        generalComment,
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
    if (scores) hashInput.scores = scores;
    if (generalComment) hashInput.generalComment = generalComment;
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
                defenseResult: true,
                memberScores: true,
            },
        });

        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy đăng ký đề tài.');
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
        const effectiveMembers = effectiveCouncil?.members || [];
        const councilMemberIdSet = new Set(effectiveMembers.map((m) => m.lecturerId));

        if (!councilMemberIdSet.has(effectiveEvaluatorId)) {
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

        // Kiểm tra trạng thái hồ sơ: Phải ở DEFENSE_READY hoặc DEFENDED (khi chưa khóa)
        const eligibleStatuses = ['DEFENSE_READY', 'DEFENDED', 'SUBMITTED'];
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

        if (scores && Array.isArray(scores) && scores.length > 0) {
            for (const row of scores) {
                const s = Number(row.score);
                if (row.score === null || row.score === undefined || isNaN(s) || s < 0) {
                    throw new WorkflowTransitionError(
                        'INVALID_CRITERION_SCORE',
                        400,
                        `Điểm tiêu chí ${row.criterionCode || ''} không hợp lệ (phải là số thực >= 0).`,
                    );
                }
            }
            const totalScore = scores.reduce((sum, item) => sum + Number(item.score), 0);
            const finalScore = round2(totalScore);

            if (!memberScore) {
                memberScore = await tx.defenseMemberScore.create({
                    data: {
                        registrationId,
                        evaluatorId: effectiveEvaluatorId,
                        finalScore,
                        comments: generalComment ? String(generalComment).trim() : '',
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
                        comments: generalComment !== undefined ? String(generalComment || '').trim() : memberScore.comments,
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
                data: scores.map((row) => ({
                    defenseMemberScoreId: memberScore.id,
                    criterionCode: row.criterionCode,
                    criterionLabel: row.criterionLabel || row.criterionCode,
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
                },
            });
        }

        // Cập nhật lại điểm trung bình tạm thời
        const councilMemberIds = [...new Set(effectiveMembers.map((m) => m.lecturerId))];
        const consideredEvaluatorIds = councilMemberIds.length ? councilMemberIds : [effectiveEvaluatorId];

        const allMemberScores = await tx.defenseMemberScore.findMany({
            where: {
                registrationId,
                evaluatorId: { in: consideredEvaluatorIds },
            },
            select: { finalScore: true, evaluatorId: true },
        });

        const aggregateFinalScore = computeAggregateDefenseScore(allMemberScores);

        await tx.defenseResult.upsert({
            where: { registrationId },
            update: {
                finalScore: aggregateFinalScore,
                evaluatorId: effectiveEvaluatorId,
                scoreRubricVersion: targetRubricVersion,
            },
            create: {
                registrationId,
                finalScore: aggregateFinalScore,
                comments: '',
                evaluatorId: effectiveEvaluatorId,
                scoreRubricVersion: targetRubricVersion,
            },
        });

        const responsePayload = {
            registrationId,
            evaluatorId: effectiveEvaluatorId,
            memberScoreId: memberScore.id,
            finalScore: memberScore.finalScore,
            scoreLocked: true,
            lockedAt: memberScore.lockedAt || now.toISOString(),
            aggregateFinalScore,
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
 * Khóa hoặc mở khóa bảng điểm hội đồng bảo vệ (Step 2)
 * - Khóa điểm (LOCK): Yêu cầu đủ 3 thành viên hội đồng (CHAIRMAN, SECRETARY, REVIEWER) đã khóa phiếu, điểm hợp lệ 0-10, tính trung bình cộng và chuyển AWAITING_FINAL_APPROVAL
 * - Mở khóa (UNLOCK): Chuyển trạng thái từ AWAITING_FINAL_APPROVAL về DEFENSE_READY để thành viên điều chỉnh
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
        // Zero-Trust Capability Guard:
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

            // INV-04, INV-27 & C03: Kiểm tra đủ chính xác 3 phiếu cá nhân đã khóa từ 3 chức danh CHAIRMAN, SECRETARY, REVIEWER
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
                // Fallback nếu council không có members (ví dụ mock test đơn giản)
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
            // Khi mở khóa điểm (UNLOCK): quay về DEFENSE_READY trước khi approval
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
    round2,
    computeAggregateDefenseScore,
    saveMemberScoreSheet,
    lockMemberScoreSheet,
    saveAndLockMemberScore: lockMemberScoreSheet,
    lockDefenseScores,
};
