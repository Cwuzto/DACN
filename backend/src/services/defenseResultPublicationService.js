const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');
const { validateAcademicScope } = require('./academicScopeService');

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

async function loadLockedEvidence(tx, registrationId) {
    const registration = await tx.topicRegistration.findUnique({
        where: { id: registrationId },
        include: {
            topic: { select: { title: true } },
            student: { select: { code: true, fullName: true } },
            defenseCouncil: { include: { members: { select: { lecturerId: true } } } },
            council: { include: { members: { select: { lecturerId: true } } } },
            defenseResult: true,
            memberScores: true,
        },
    });
    if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký.');
    const council = registration.defenseCouncil || registration.council;
    const memberIds = new Set((council?.members || []).map((member) => member.lecturerId));
    const validScores = registration.memberScores.filter((score) => memberIds.has(score.evaluatorId)
        && score.scoreLocked && Number.isFinite(Number(score.finalScore)));
    if (memberIds.size !== 3 || validScores.length !== memberIds.size || !registration.defenseResult?.scoreLocked
        || !Number.isFinite(Number(registration.defenseResult.finalScore))) {
        throw new WorkflowTransitionError('LOCKED_DEFENSE_EVIDENCE_REQUIRED', 409, 'Hồ sơ phải có đủ ba phiếu chấm hợp lệ và bộ điểm tổng hợp đã khóa.');
    }
    return registration;
}

function isApprovalEvidenceCurrent(approval) {
    const registration = approval.registration;
    const council = registration?.defenseCouncil || registration?.council;
    const memberIds = new Set((council?.members || []).map((member) => member.lecturerId));
    const validScores = (registration?.memberScores || []).filter((score) => memberIds.has(score.evaluatorId)
        && score.scoreLocked && Number.isFinite(Number(score.finalScore)));

    return memberIds.size === 3
        && validScores.length === memberIds.size
        && new Set(validScores.map((score) => score.evaluatorId)).size === memberIds.size
        && registration.defenseResult?.scoreLocked
        && approval.defenseResultId === registration.defenseResult.id
        && approval.defenseCouncilId === (registration.defenseCouncilId || registration.councilId || null)
        && approval.policyVersionId === (registration.periodPolicyVersionId || null)
        && approval.rubricVersionSnapshot === registration.defenseResult.scoreRubricVersion
        && Number(approval.finalScoreSnapshot) === Number(registration.defenseResult.finalScore)
        && approval.scoreFingerprint === hashScoreEvidence(registration);
}

async function approveDefenseResult({ registrationId, actorId, outcome, reason, notes, idempotencyKey, correction = false }, options = {}) {
    if (!['PASSED', 'FAILED'].includes(outcome)) {
        throw new WorkflowTransitionError('INVALID_DEFENSE_OUTCOME', 400, 'Kết quả phê duyệt không hợp lệ.');
    }
    const db = options.db || prisma;
    return db.$transaction(async (tx) => {
        await validateAcademicScope(tx, {
            actorId,
            registrationId,
            capabilityCode: 'DEFENSE_RESULT_APPROVE',
            now: options.now || new Date(),
        });
        const registration = await loadLockedEvidence(tx, registrationId);
        const validStatuses = correction ? ['DEFENSE_PASSED', 'DEFENSE_FAILED'] : ['AWAITING_FINAL_APPROVAL'];
        if (!validStatuses.includes(registration.status)) {
            throw new WorkflowTransitionError('INVALID_STATUS_FOR_RESULT_APPROVAL', 409, 'Hồ sơ chưa ở trạng thái chờ phê duyệt kết quả.');
        }
        const existing = await tx.defenseResultApproval.findFirst({ where: { registrationId, isEffective: true } });
        if (existing && !correction) throw new WorkflowTransitionError('RESULT_ALREADY_APPROVED', 409, 'Hồ sơ đã có kết quả phê duyệt hiệu lực.');
        if (correction && (!existing || !reason?.trim())) throw new WorkflowTransitionError('CORRECTION_REASON_REQUIRED', 400, 'Điều chỉnh yêu cầu approval hiện hành và lý do bắt buộc.');
        if (existing && correction) {
            await tx.defenseResultApproval.update({
                where: { id: existing.id },
                data: { isEffective: false, invalidatedAt: new Date(), invalidatedReason: reason.trim() },
            });
        }

        const approval = await tx.defenseResultApproval.create({
            data: {
                registrationId,
                defenseResultId: registration.defenseResult.id,
                outcome,
                finalScoreSnapshot: Number(registration.defenseResult.finalScore),
                scoreFingerprint: hashScoreEvidence(registration),
                rubricVersionSnapshot: registration.defenseResult.scoreRubricVersion,
                defenseCouncilId: registration.defenseCouncilId || registration.councilId || null,
                policyVersionId: registration.periodPolicyVersionId || null,
                approvedById: actorId,
                reason: reason || null,
                notes: notes || null,
                supersedesApprovalId: existing?.id || null,
            },
        });
        const transition = await transitionRegistration({
            registrationId,
            expectedStatus: registration.status,
            expectedStateVersion: registration.stateVersion || 0,
            targetStatus: outcome === 'PASSED' ? 'DEFENSE_PASSED' : 'DEFENSE_FAILED',
            actorId,
            reason: reason || `Phê duyệt kết quả bảo vệ: ${outcome}`,
            reference: { defenseResultApprovalId: approval.id },
            idempotencyKey: idempotencyKey || `defense-result-${correction ? 'correction' : 'approval'}-${registrationId}-${registration.stateVersion || 0}`,
        }, { tx });
        await tx.auditLog.create({ data: { userId: actorId, action: correction ? 'DEFENSE_RESULT_CORRECTED' : 'DEFENSE_RESULT_APPROVED', entityType: 'DefenseResultApproval', entityId: String(approval.id), details: { registrationId, outcome, supersedesApprovalId: existing?.id || null } } });
        return { approval, transition };
    }, { isolationLevel: 'Serializable' });
}

async function getEligibleApprovals(tx, semesterId) {
    const approvals = await tx.defenseResultApproval.findMany({
        where: { isEffective: true, registration: { semesterId } },
        include: {
            registration: {
                include: {
                    student: { select: { code: true, fullName: true } },
                    topic: { select: { title: true } },
                    defenseCouncil: { include: { members: { select: { lecturerId: true } } } },
                    council: { include: { members: { select: { lecturerId: true } } } },
                    defenseResult: true,
                    memberScores: true,
                },
            },
        },
    });
    return approvals.filter(isApprovalEvidenceCurrent);
}

async function createResultPublication({ semesterId, actorId, type, reason, previousPublicationId, correctionItems, idempotencyKey }, options = {}) {
    if (!['INITIAL', 'SUPPLEMENTARY', 'CORRECTION'].includes(type)) throw new WorkflowTransitionError('INVALID_PUBLICATION_TYPE', 400, 'Loại công bố không hợp lệ.');
    if (!idempotencyKey) throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key là bắt buộc.');
    if (type !== 'INITIAL' && !reason?.trim()) throw new WorkflowTransitionError('PUBLICATION_REASON_REQUIRED', 400, 'Lý do là bắt buộc cho công bố bổ sung hoặc điều chỉnh.');
    if (type === 'INITIAL' && previousPublicationId) throw new WorkflowTransitionError('INITIAL_PUBLICATION_LINEAGE_FORBIDDEN', 400, 'Công bố ban đầu không được có phiên tiền nhiệm.');
    if (type !== 'INITIAL' && !previousPublicationId) throw new WorkflowTransitionError('PUBLICATION_LINEAGE_REQUIRED', 400, 'Công bố bổ sung hoặc điều chỉnh phải chỉ rõ phiên công bố tiền nhiệm.');
    const db = options.db || prisma;
    return db.$transaction(async (tx) => {
        const replay = await tx.resultPublication.findUnique({ where: { semesterId_publishedById_idempotencyKey: { semesterId, publishedById: actorId, idempotencyKey } }, include: { items: true } });
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
        if (type === 'INITIAL') {
            const existingInitial = await tx.resultPublication.findFirst({ where: { semesterId, type: 'INITIAL' }, select: { id: true } });
            if (existingInitial) throw new WorkflowTransitionError('INITIAL_PUBLICATION_ALREADY_EXISTS', 409, 'Học kỳ đã có phiên công bố ban đầu. Hãy dùng công bố bổ sung hoặc điều chỉnh.');
        }
        const approvals = await getEligibleApprovals(tx, semesterId);
        const priorItems = await tx.resultPublicationItem.findMany({ where: { registration: { semesterId } }, select: { id: true, publicationId: true, registrationId: true, sourceApprovalId: true } });
        let selected = approvals;
        if (type !== 'CORRECTION') selected = approvals.filter((approval) => !priorItems.some((item) => item.registrationId === approval.registrationId));
        if (type === 'CORRECTION') {
            if (!previousPublicationId || !Array.isArray(correctionItems) || !correctionItems.length) throw new WorkflowTransitionError('CORRECTION_LINEAGE_REQUIRED', 400, 'Công bố điều chỉnh phải chỉ rõ publication/item trước đó.');
            const requested = new Map(correctionItems.map((item) => [Number(item.registrationId), Number(item.replacesPublicationItemId)]));
            selected = approvals.filter((approval) => requested.has(approval.registrationId)
                && priorItems.some((item) => item.id === requested.get(approval.registrationId)
                    && item.publicationId === Number(previousPublicationId)
                    && item.registrationId === approval.registrationId
                    && item.sourceApprovalId !== approval.id));
            if (selected.length !== requested.size) throw new WorkflowTransitionError('INVALID_CORRECTION_SCOPE', 409, 'Phạm vi điều chỉnh không hợp lệ hoặc approval chưa thay đổi.');
        }
        if (!selected.length) throw new WorkflowTransitionError('NO_ELIGIBLE_APPROVALS', 409, 'Không có kết quả đã phê duyệt hợp lệ để công bố.');
        const publication = await tx.resultPublication.create({ data: { semesterId, type, reason: reason?.trim() || null, previousPublicationId: previousPublicationId || null, publishedById: actorId, idempotencyKey } });
        await tx.resultPublicationItem.createMany({ data: selected.map((approval) => ({
            publicationId: publication.id,
            registrationId: approval.registrationId,
            sourceApprovalId: approval.id,
            replacesPublicationItemId: type === 'CORRECTION' ? Number(correctionItems.find((item) => Number(item.registrationId) === approval.registrationId).replacesPublicationItemId) : null,
            outcomeSnapshot: approval.outcome,
            finalScoreSnapshot: approval.finalScoreSnapshot,
            studentCodeSnapshot: approval.registration.student.code,
            studentNameSnapshot: approval.registration.student.fullName,
            topicTitleSnapshot: approval.registration.topic.title,
        })) });
        await tx.auditLog.create({ data: { userId: actorId, action: type === 'CORRECTION' ? 'RESULT_PUBLICATION_CORRECTED' : 'RESULT_PUBLICATION_CREATED', entityType: 'ResultPublication', entityId: String(publication.id), details: { semesterId, type, itemCount: selected.length } } });
        return { publication: await tx.resultPublication.findUnique({ where: { id: publication.id }, include: { items: true } }), idempotent: false };
    }, { isolationLevel: 'Serializable' });
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
        where: { registration: { studentId } },
        include: { publication: { select: { id: true, semesterId: true, type: true, publishedAt: true } } },
        orderBy: { createdAt: 'desc' },
    });
}

module.exports = { approveDefenseResult, createResultPublication, getEligibleApprovals, hashScoreEvidence, isApprovalEvidenceCurrent, listResultPublications, getDefenseResultApproval, getStudentPublishedResult };
