const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const { validateAcademicScope } = require('./academicScopeService');
const { roundDefenseScoreOneDecimal } = require('../utils/defenseTimeWindowUtils');
const { resolveEffectiveTopicTitle } = require('./topicTitleResolverService');
const { resolveActiveScoringMembers } = require('./defenseScoringService');

const hashScoreEvidence = (registration) => crypto.createHash('sha256').update(JSON.stringify({
    councilId: registration.defenseCouncilId || registration.councilId || null,
    policyVersionId: registration.periodPolicyVersionId || null,
    result: {
        id: registration.defenseResult?.id,
        score: registration.defenseResult?.finalScore,
        rubric: registration.defenseResult?.scoreRubricVersion,
        lockedAt: registration.defenseResult?.lockedAt,
    },
    memberScores: (registration.memberScores || []).map((score) => ({
        evaluatorId: score.evaluatorId,
        score: score.finalScore,
        rubric: score.scoreRubricVersion,
        lockedAt: score.lockedAt,
    })).sort((a, b) => a.evaluatorId - b.evaluatorId),
})).digest('hex');

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

async function loadLockedEvidence(tx, registrationId) {
    const registration = await tx.topicRegistration.findUnique({
        where: { id: registrationId },
        include: {
            topic: { select: { title: true } },
            student: { select: { code: true, fullName: true } },
            defenseCouncil: { include: { members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } } } },
            council: { include: { members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } } } },
            defenseResult: true,
            memberScores: true,
        },
    });
    if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');

    if (!registration.defenseResult?.scoreLocked) {
        throw new WorkflowTransitionError('LOCKED_DEFENSE_EVIDENCE_REQUIRED', 409, 'Sổ điểm hội đồng chưa được khóa.');
    }

    const isAbsent = registration.defenseResult.attendanceStatus === 'ABSENT';
    if (isAbsent) {
        return registration;
    }

    const council = registration.defenseCouncil || registration.council;
    const activeScorers = resolveActiveScoringMembers(council);
    const activeScorerIds = new Set(
        activeScorers.length > 0
            ? activeScorers.map((m) => m.lecturerId)
            : (council?.members || []).map((m) => m.lecturerId)
    );

    const validScores = (registration.memberScores || []).filter((score) =>
        activeScorerIds.has(score.evaluatorId)
        && score.isEffective !== false
        && score.scoreLocked
        && score.finalScore !== null && score.finalScore !== undefined && Number.isFinite(Number(score.finalScore))
    );

    const requiredCount = activeScorerIds.size;
    const hasValidFinalScore = Number.isFinite(Number(registration.defenseResult.roundedFinalScore))
        || Number.isFinite(Number(registration.defenseResult.finalScore))
        || Number.isFinite(Number(registration.defenseResult.rawAverageScore));

    if (requiredCount < 3 || validScores.length !== requiredCount || !hasValidFinalScore) {
        throw new WorkflowTransitionError('LOCKED_DEFENSE_EVIDENCE_REQUIRED', 409, 'Hồ sơ phải có đủ các phiếu chấm hợp lệ đã khóa và bộ điểm tổng hợp đã khóa.');
    }

    return registration;
}

function isApprovalEvidenceCurrent(approval) {
    const registration = approval.registration;
    const council = registration?.defenseCouncil || registration?.council;
    const isAbsent = registration?.defenseResult?.attendanceStatus === 'ABSENT';

    if (isAbsent) {
        return Boolean(registration?.defenseResult?.scoreLocked)
            && approval.outcome === 'FAILED'
            && approval.defenseResultId === registration?.defenseResult?.id
            && approval.defenseCouncilId === (registration?.defenseCouncilId || registration?.councilId || null)
            && approval.policyVersionId === (registration?.periodPolicyVersionId || null)
            && approval.rubricVersionSnapshot === (registration?.defenseResult?.scoreRubricVersion || 'v1')
            && (approval.finalScoreSnapshot === null || approval.finalScoreSnapshot === undefined)
            && approval.scoreFingerprint === hashScoreEvidence(registration);
    }

    const activeScorers = resolveActiveScoringMembers(council);
    const memberIds = new Set(
        activeScorers.length > 0
            ? activeScorers.map((member) => member.lecturerId)
            : (council?.members || []).map((m) => m.lecturerId)
    );

    const validScores = (registration?.memberScores || []).filter((score) =>
        memberIds.has(score.evaluatorId)
        && score.isEffective !== false
        && score.scoreLocked
        && score.finalScore !== null && score.finalScore !== undefined && Number.isFinite(Number(score.finalScore))
    );

    const expectedScore = registration?.defenseResult?.roundedFinalScore != null
        ? Number(registration.defenseResult.roundedFinalScore)
        : (registration?.defenseResult?.rawAverageScore != null
            ? roundDefenseScoreOneDecimal(registration.defenseResult.rawAverageScore)
            : (registration?.defenseResult?.finalScore != null ? Number(registration.defenseResult.finalScore) : null));

    return memberIds.size >= 3
        && validScores.length === memberIds.size
        && new Set(validScores.map((score) => score.evaluatorId)).size === memberIds.size
        && Boolean(registration.defenseResult?.scoreLocked)
        && approval.defenseResultId === registration.defenseResult.id
        && approval.defenseCouncilId === (registration.defenseCouncilId || registration.councilId || null)
        && approval.policyVersionId === (registration.periodPolicyVersionId || null)
        && approval.rubricVersionSnapshot === registration.defenseResult.scoreRubricVersion
        && (approval.finalScoreSnapshot === null ? expectedScore === null : Number(approval.finalScoreSnapshot) === expectedScore)
        && approval.scoreFingerprint === hashScoreEvidence(registration);
}

async function approveDefenseResult({ registrationId, actorId, actor, outcome, reason, notes, idempotencyKey, correction = false }, options = {}) {
    const effectiveActorId = actorId || actor?.id || options.actorId || 1;
    const db = options.db || options.tx || prisma;

    const executeInTx = async (tx) => {
        // 1. Kiểm tra đã công bố chưa - một khi đã công bố thì KHÔNG THỂ phê duyệt hay sửa đổi (kể cả correction)
        const published = await isResultPublished(tx, registrationId);
        if (published) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_PUBLISHED_IMMUTABLE',
                409,
                'Không thể phê duyệt hoặc điều chỉnh kết quả: Kết quả đã được công bố chính thức và là bất biến.',
            );
        }

        if (effectiveActorId) {
            await validateAcademicScope(tx, {
                actorId: effectiveActorId,
                registrationId,
                capabilityCode: 'DEFENSE_RESULT_APPROVE',
                now: options.now || new Date(),
            });
        }

        const registration = await loadLockedEvidence(tx, registrationId);

        // Đánh giá kết quả dựa trên attendanceStatus và roundedFinalScore:
        // - Nếu attendanceStatus === 'ABSENT': outcome = 'FAILED'
        // - Nếu roundedFinalScore >= 5.0: outcome = 'PASSED'
        // - Nếu roundedFinalScore < 5.0: outcome = 'FAILED'
        let evaluatedOutcome;
        const isAbsent = registration.defenseResult?.attendanceStatus === 'ABSENT';
        let roundedScore = null;

        if (isAbsent) {
            evaluatedOutcome = 'FAILED';
        } else {
            if (registration.defenseResult?.roundedFinalScore != null) {
                roundedScore = Number(registration.defenseResult.roundedFinalScore);
            } else if (registration.defenseResult?.rawAverageScore != null) {
                roundedScore = roundDefenseScoreOneDecimal(registration.defenseResult.rawAverageScore);
            } else if (registration.defenseResult?.finalScore != null) {
                roundedScore = roundDefenseScoreOneDecimal(registration.defenseResult.finalScore);
            }

            if (roundedScore != null && roundedScore >= 5.0) {
                evaluatedOutcome = 'PASSED';
            } else {
                evaluatedOutcome = 'FAILED';
            }
        }

        if (outcome && outcome !== evaluatedOutcome) {
            throw new WorkflowTransitionError(
                'INVALID_DEFENSE_OUTCOME',
                400,
                'Kết quả phê duyệt không khớp với điểm số hoặc trạng thái điểm danh.',
            );
        }
        const finalOutcome = evaluatedOutcome;

        const validStatuses = correction ? ['DEFENSE_PASSED', 'DEFENSE_FAILED'] : ['AWAITING_FINAL_APPROVAL'];
        if (!validStatuses.includes(registration.status)) {
            throw new WorkflowTransitionError(
                'INVALID_STATUS_FOR_RESULT_APPROVAL',
                409,
                'Hồ sơ chưa ở trạng thái chờ phê duyệt kết quả.',
            );
        }

        const existing = await tx.defenseResultApproval.findFirst({
            where: { registrationId, isEffective: true },
        });
        if (existing && !correction) {
            throw new WorkflowTransitionError(
                'RESULT_ALREADY_APPROVED',
                409,
                'Hồ sơ đã có kết quả phê duyệt hiệu lực.',
            );
        }
        if (correction && (!existing || !reason?.trim())) {
            throw new WorkflowTransitionError(
                'CORRECTION_REASON_REQUIRED',
                400,
                'Điều chỉnh yêu cầu approval hiện hành và lý do bắt buộc.',
            );
        }
        if (existing && correction) {
            await tx.defenseResultApproval.update({
                where: { id: existing.id },
                data: { isEffective: false, invalidatedAt: new Date(), invalidatedReason: reason.trim() },
            });
        }

        const finalScoreSnapshot = isAbsent ? null : roundedScore;

        const approval = await tx.defenseResultApproval.create({
            data: {
                registrationId,
                defenseResultId: registration.defenseResult.id,
                outcome: finalOutcome,
                finalScoreSnapshot,
                scoreFingerprint: hashScoreEvidence(registration),
                rubricVersionSnapshot: registration.defenseResult.scoreRubricVersion || 'v1',
                defenseCouncilId: registration.defenseCouncilId || registration.councilId || null,
                policyVersionId: registration.periodPolicyVersionId || null,
                approvedById: effectiveActorId,
                reason: reason || null,
                notes: notes || null,
                supersedesApprovalId: existing?.id || null,
            },
        });

        const targetStatus = finalOutcome === 'PASSED' ? 'DEFENSE_PASSED' : 'DEFENSE_FAILED';
        const transition = await transitionRegistration({
            registrationId,
            expectedStatus: registration.status,
            expectedStateVersion: registration.stateVersion || 0,
            targetStatus,
            actorId: effectiveActorId,
            reason: reason || `Phê duyệt kết quả bảo vệ: ${finalOutcome}`,
            reference: { defenseResultApprovalId: approval.id },
            idempotencyKey: idempotencyKey || `defense-result-${correction ? 'correction' : 'approval'}-${registrationId}-${registration.stateVersion || 0}`,
        }, { tx });

        await tx.auditLog.create({
            data: {
                userId: effectiveActorId,
                action: correction ? 'DEFENSE_RESULT_CORRECTED' : 'DEFENSE_RESULT_APPROVED',
                entityType: 'DefenseResultApproval',
                entityId: String(approval.id),
                details: { registrationId, outcome: finalOutcome, supersedesApprovalId: existing?.id || null },
            },
        });

        return { approval, transition };
    };

    if (options.tx) {
        return executeInTx(options.tx);
    }
    return db.$transaction(executeInTx, { isolationLevel: 'Serializable' });
}

async function getEligibleApprovals(tx, semesterId) {
    const approvals = await tx.defenseResultApproval.findMany({
        where: { isEffective: true, registration: { semesterId } },
        include: {
            registration: {
                include: {
                    student: { select: { code: true, fullName: true } },
                    topic: { select: { title: true } },
                    defenseCouncil: { include: { members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } } } },
                    council: { include: { members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } } } },
                    defenseResult: true,
                    memberScores: true,
                },
            },
        },
    });
    return approvals.filter(isApprovalEvidenceCurrent);
}

async function createResultPublication({ semesterId, actorId, actor, type, publicationType, title, notes, reason, previousPublicationId, correctionItems, idempotencyKey }, options = {}) {
    const effType = type || publicationType;
    if (effType === 'CORRECTION') {
        throw new WorkflowTransitionError(
            'CORRECTION_AFTER_PUBLICATION_FORBIDDEN',
            409,
            'Cấm công bố điều chỉnh (CORRECTION). Kết quả sau khi công bố là bất biến vĩnh viễn.',
        );
    }
    if (!['INITIAL', 'SUPPLEMENTARY'].includes(effType)) {
        throw new WorkflowTransitionError(
            'INVALID_PUBLICATION_TYPE',
            400,
            'Loại công bố không hợp lệ. Chỉ cho phép INITIAL hoặc SUPPLEMENTARY.',
        );
    }
    if (!idempotencyKey) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key là bắt buộc.');
    }
    if (effType !== 'INITIAL' && !reason?.trim()) {
        throw new WorkflowTransitionError('PUBLICATION_REASON_REQUIRED', 400, 'Lý do là bắt buộc cho công bố bổ sung.');
    }
    if (effType === 'INITIAL' && previousPublicationId) {
        throw new WorkflowTransitionError('INITIAL_PUBLICATION_LINEAGE_FORBIDDEN', 400, 'Công bố ban đầu không được có phiên tiền nhiệm.');
    }
    if (effType !== 'INITIAL' && !previousPublicationId) {
        throw new WorkflowTransitionError('PUBLICATION_LINEAGE_REQUIRED', 400, 'Công bố bổ sung phải chỉ rõ phiên công bố tiền nhiệm.');
    }

    const effectiveActorId = actorId || actor?.id || 1;
    const db = options.db || options.tx || prisma;

    const executeInTx = async (tx) => {
        const replay = await tx.resultPublication.findUnique({
            where: { semesterId_publishedById_idempotencyKey: { semesterId, publishedById: effectiveActorId, idempotencyKey } },
            include: { items: true },
        });
        if (replay) return { publication: replay, idempotent: true };

        const previousPublication = previousPublicationId
            ? await tx.resultPublication.findUnique({ where: { id: Number(previousPublicationId) }, select: { id: true, semesterId: true } })
            : null;
        if (previousPublication && previousPublication.semesterId !== semesterId) {
            throw new WorkflowTransitionError('INVALID_PUBLICATION_LINEAGE', 409, 'Phiên công bố tiền nhiệm không thuộc học kỳ đang công bố.');
        }
        if (previousPublicationId && !previousPublication) {
            throw new WorkflowTransitionError('PUBLICATION_NOT_FOUND', 404, 'Không tìm thấy phiên công bố tiền nhiệm.');
        }
        if (effType === 'INITIAL') {
            const existingInitial = await tx.resultPublication.findFirst({ where: { semesterId, type: 'INITIAL' }, select: { id: true } });
            if (existingInitial) throw new WorkflowTransitionError('INITIAL_PUBLICATION_ALREADY_EXISTS', 409, 'Học kỳ đã có phiên công bố ban đầu. Hãy dùng công bố bổ sung.');
        }

        const approvals = await getEligibleApprovals(tx, semesterId);
        const priorItems = await tx.resultPublicationItem.findMany({
            where: { registration: { semesterId } },
            select: { id: true, publicationId: true, registrationId: true, sourceApprovalId: true },
        });

        const selected = approvals.filter((approval) => !priorItems.some((item) => item.registrationId === approval.registrationId));

        if (!selected.length) {
            throw new WorkflowTransitionError('NO_ELIGIBLE_APPROVALS', 409, 'Không có kết quả đã phê duyệt hợp lệ để công bố.');
        }

        const publication = await tx.resultPublication.create({
            data: {
                semesterId,
                type: effType,
                reason: reason?.trim() || null,
                previousPublicationId: previousPublicationId || null,
                publishedById: effectiveActorId,
                idempotencyKey,
            },
        });

        const now = new Date();
        const itemsData = [];
        for (const approval of selected) {
            let effectiveTopicTitle = approval.registration.topic?.title;
            try {
                const titleInfo = await resolveEffectiveTopicTitle(approval.registrationId, now, { tx });
                if (titleInfo && titleInfo.title) {
                    effectiveTopicTitle = titleInfo.title;
                }
            } catch (_) {
                // fallback to topic.title
            }

            itemsData.push({
                publicationId: publication.id,
                registrationId: approval.registrationId,
                sourceApprovalId: approval.id,
                replacesPublicationItemId: null,
                outcomeSnapshot: approval.outcome,
                finalScoreSnapshot: approval.finalScoreSnapshot != null ? Number(approval.finalScoreSnapshot) : null,
                studentCodeSnapshot: approval.registration.student.code,
                studentNameSnapshot: approval.registration.student.fullName,
                topicTitleSnapshot: effectiveTopicTitle || 'Đề tài',
            });
        }

        await tx.resultPublicationItem.createMany({ data: itemsData });

        await tx.auditLog.create({
            data: {
                userId: effectiveActorId,
                action: 'RESULT_PUBLICATION_CREATED',
                entityType: 'ResultPublication',
                entityId: String(publication.id),
                details: { semesterId, type: effType, itemCount: selected.length },
            },
        });

        return {
            publication: await tx.resultPublication.findUnique({
                where: { id: publication.id },
                include: { items: true },
            }),
            idempotent: false,
        };
    };

    if (options.tx) {
        return executeInTx(options.tx);
    }
    return db.$transaction(executeInTx, { isolationLevel: 'Serializable' });
}

async function listResultPublications(semesterId) {
    return prisma.resultPublication.findMany({
        where: { semesterId },
        include: {
            publishedBy: { select: { id: true, fullName: true } },
            previousPublication: { select: { id: true, type: true, publishedAt: true } },
            items: { select: { id: true, registrationId: true, outcomeSnapshot: true, finalScoreSnapshot: true, studentCodeSnapshot: true, studentNameSnapshot: true, topicTitleSnapshot: true, replacesPublicationItemId: true } },
        },
        orderBy: { publishedAt: 'desc' },
    });
}

async function getDefenseResultApproval(registrationId) {
    return prisma.defenseResultApproval.findFirst({
        where: { registrationId },
        include: {
            approvedBy: { select: { id: true, fullName: true, code: true } },
            defenseResult: { select: { id: true, scoreLocked: true, lockedAt: true } },
        },
        orderBy: { approvedAt: 'desc' },
    });
}

async function getStudentPublishedResult(studentId) {
    return prisma.resultPublicationItem.findFirst({
        where: {
            registration: { studentId },
            publication: {
                type: { in: ['INITIAL', 'SUPPLEMENTARY'] },
            },
        },
        include: {
            publication: { select: { id: true, semesterId: true, type: true, publishedAt: true } },
            registration: {
                select: {
                    id: true,
                    status: true,
                    topic: { select: { id: true, title: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
}

module.exports = {
    approveDefenseResult,
    createResultPublication,
    getEligibleApprovals,
    hashScoreEvidence,
    isApprovalEvidenceCurrent,
    listResultPublications,
    getDefenseResultApproval,
    getStudentPublishedResult,
    isResultPublished,
};
