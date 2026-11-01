const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

const DEFENSE_SCORING_SCOPE = 'defense-scoring';

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Tính điểm trung bình cộng của các thành viên hội đồng hợp lệ
 * @param {Array<{finalScore: number|string}>} memberScores
 * @returns {number|null}
 */
const computeAggregateDefenseScore = (memberScores = []) => {
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

        // Kiểm tra quyền: Người chấm phải thuộc hội đồng bảo vệ (hoặc là ADMIN)
        const effectiveCouncil = registration.defenseCouncil || registration.council;
        const effectiveMembers = effectiveCouncil?.members || [];
        const councilMemberIdSet = new Set(effectiveMembers.map((m) => m.lecturerId));

        if (!councilMemberIdSet.has(evaluatorId) && evaluatorRole !== 'ADMIN') {
            throw new WorkflowTransitionError(
                'EVALUATOR_NOT_IN_COUNCIL',
                403,
                'Người chấm không thuộc hội đồng bảo vệ của đề tài này.',
            );
        }

        // Kiểm tra trạng thái khóa điểm
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
 * Khóa hoặc mở khóa bảng điểm hội đồng bảo vệ
 * - Khóa điểm (LOCK): Yêu cầu đủ thành viên hội đồng đã chấm, tính trung bình cộng và chuyển trạng thái sang AWAITING_FINAL_APPROVAL
 * - Mở khóa (UNLOCK): Chuyển trạng thái từ AWAITING_FINAL_APPROVAL về DEFENSE_READY để thành viên điều chỉnh
 */
async function lockDefenseScores(input, options = {}) {
    const db = options.db || prisma;
    const { registrationId, action, actorId, idempotencyKey } = input;

    if (!Number.isInteger(registrationId) || registrationId <= 0) {
        throw new WorkflowTransitionError('INVALID_REGISTRATION_ID', 400, 'registrationId không hợp lệ.');
    }
    if (!['LOCK', 'UNLOCK'].includes(action)) {
        throw new WorkflowTransitionError('INVALID_ACTION', 400, 'action phải là LOCK hoặc UNLOCK.');
    }

    const lockState = action === 'LOCK';

    return await db.$transaction(async (tx) => {
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
            // Khi khóa điểm: Kiểm tra xem đã có điểm chưa
            if (!registration.memberScores?.length) {
                throw new WorkflowTransitionError(
                    'NO_MEMBER_SCORES',
                    400,
                    'Hồ sơ chưa có điểm bảo vệ nào của hội đồng để khóa.',
                );
            }

            // INV-04 & INV-27: Kiểm tra tính đầy đủ của hội đồng bảo vệ
            if (effectiveCouncil && Array.isArray(effectiveCouncil.members) && effectiveCouncil.members.length > 0) {
                const requiredMemberIds = effectiveCouncil.members.map((m) => m.lecturerId);
                const gradedMemberIds = new Set(
                    registration.memberScores
                        .filter((s) => Number.isFinite(Number(s.finalScore)))
                        .map((s) => s.evaluatorId),
                );

                const missingGraders = requiredMemberIds.filter((id) => !gradedMemberIds.has(id));
                if (missingGraders.length > 0) {
                    throw new WorkflowTransitionError(
                        'MISSING_COUNCIL_MEMBER_SCORES',
                        400,
                        `Chưa thể khóa điểm: Còn ${missingGraders.length} thành viên hội đồng chưa hoàn tất nhập điểm.`,
                    );
                }
            }

            // Tính điểm trung bình cộng chính thức
            const aggregateFinalScore = computeAggregateDefenseScore(registration.memberScores);

            // Khóa điểm chỉ hoàn tất score evidence; kết quả chính thức còn phải qua approval độc lập.
            const targetStatus = 'AWAITING_FINAL_APPROVAL';
            const expectedStatus = registration.status;

            const transitionResult = await transitionRegistration({
                registrationId: registration.id,
                expectedStatus,
                expectedStateVersion: registration.stateVersion || 0,
                targetStatus,
                actorId,
                reason: `Chốt và khóa bảng điểm Hội đồng bảo vệ (Điểm TB cộng: ${aggregateFinalScore ?? 'N/A'})`,
                idempotencyKey: idempotencyKey || `lock-defense-${registration.id}-${registration.stateVersion || 0}`,
            }, { tx });

            // Khóa tất cả các phiếu điểm thành viên và phiếu điểm tổng hợp
            await tx.defenseMemberScore.updateMany({
                where: { registrationId },
                data: {
                    scoreLocked: true,
                    lockedAt: new Date(),
                    lockedBy: actorId,
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
            // Khi mở khóa điểm (UNLOCK): quay về DEFENSE_READY trước khi approval.
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

            // Mở khóa các phiếu điểm thành viên và kết quả
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
    round2,
    computeAggregateDefenseScore,
    saveMemberScoreSheet,
    lockDefenseScores,
};
