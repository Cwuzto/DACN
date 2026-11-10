const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

function commandKey(prefix, key) {
    if (!key || key.length < 8) throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return `${prefix}:${key}`;
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function submitBM02({ registrationId, studentId, bm02ProposedTitle, titleChangeReason, content, fileUrl, fileName, idempotencyKey }, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const receiptScope = 'submit-bm02-command';
    const receiptKey = commandKey('bm02', idempotencyKey);
    const payloadToHash = {
        registrationId,
        studentId,
        content: content || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
    };
    if (bm02ProposedTitle !== undefined) payloadToHash.bm02ProposedTitle = bm02ProposedTitle || null;
    if (titleChangeReason !== undefined) payloadToHash.titleChangeReason = titleChangeReason || null;
    const hash = fingerprint(payloadToHash);
    try {
        const result = await db.$transaction(async (tx) => {
        const existingReceipt = await tx.idempotencyRecord.findUnique({
            where: { scope_key: { scope: receiptScope, key: receiptKey } },
        });
        if (existingReceipt) {
            if (existingReceipt.commandHash !== hash) throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
            return { ...existingReceipt.response, idempotent: true };
        }
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            select: {
                id: true,
                studentId: true,
                status: true,
                stateVersion: true,
                periodPolicyVersionId: true,
                currentBM02SubmissionId: true,
                bm01ApprovedTitleSnapshot: true,
                topic: {
                    select: {
                        id: true,
                        title: true,
                        mentorId: true,
                        mentor: { select: { id: true, fullName: true, email: true } },
                    },
                },
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        studentCode: true,
                        email: true,
                        className: true,
                    },
                },
            },
        });
        if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);
        if (registration.studentId !== studentId) throw new WorkflowTransitionError('FORBIDDEN', 403);
        if (!registration.periodPolicyVersionId) throw new WorkflowTransitionError('WORKFLOW_POLICY_REQUIRED', 409);
        if (!['BM01_PASSED', 'BM02_NEEDS_REVISION'].includes(registration.status)) {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        }

        const bm01ApprovedTitle = registration.bm01ApprovedTitleSnapshot || registration.topic?.title || null;
        const proposedTitle = (bm02ProposedTitle && String(bm02ProposedTitle).trim()) ? String(bm02ProposedTitle).trim() : bm01ApprovedTitle;
        const normalizedReason = titleChangeReason ? String(titleChangeReason).trim() : null;

        if (proposedTitle && bm01ApprovedTitle && proposedTitle !== bm01ApprovedTitle && !normalizedReason) {
            throw new WorkflowTransitionError('TITLE_CHANGE_REASON_REQUIRED', 400);
        }

        const isRevision = registration.status === 'BM02_NEEDS_REVISION';
        const prior = isRevision
            ? await tx.bM02Submission.findUnique({ where: { id: registration.currentBM02SubmissionId } })
            : await tx.bM02Submission.findFirst({
                where: { registrationId },
                orderBy: { versionNo: 'desc' },
                select: { id: true, registrationId: true, versionNo: true, attemptNo: true, outcome: true, revisionDeadlineAt: true },
            });
        if (isRevision && (!prior || prior.registrationId !== registrationId || prior.outcome !== 'REVISION_REQUIRED')) {
            throw new WorkflowTransitionError('BM02_REVISION_NOT_AVAILABLE', 409);
        }
        if (isRevision && prior.attemptNo >= 2) throw new WorkflowTransitionError('BM02_REVISION_QUOTA_EXHAUSTED', 409);
        if (isRevision && (!prior.revisionDeadlineAt || prior.revisionDeadlineAt < now)) {
            const terminal = await tx.bM02Submission.update({
                where: { id: prior.id },
                data: { outcome: 'REJECTED_TERMINAL', reviewedAt: now, notifiedAt: now },
            });
            await transitionRegistration({
                registrationId,
                expectedStatus: registration.status,
                expectedStateVersion: registration.stateVersion,
                targetStatus: 'TERMINATED_BM02',
                actorId: studentId,
                reason: 'BM02 revision deadline expired',
                reference: { command: 'EXPIRE_BM02_REVISION', submissionId: prior.id, deadlineAt: prior.revisionDeadlineAt },
                idempotencyKey: commandKey('expire-bm02', idempotencyKey),
            }, { tx });
            const response = { expired: true, submission: terminal, targetStatus: 'TERMINATED_BM02' };
            await tx.idempotencyRecord.create({
                data: { scope: receiptScope, key: receiptKey, commandHash: hash, registrationId, response: JSON.parse(JSON.stringify(response)) },
            });
            return response;
        }

        const studentSnapshot = registration.student ? {
            id: registration.student.id,
            fullName: registration.student.fullName,
            studentCode: registration.student.studentCode,
            email: registration.student.email,
            className: registration.student.className,
        } : null;

        const mentorSnapshot = registration.topic?.mentor ? {
            id: registration.topic.mentor.id,
            fullName: registration.topic.mentor.fullName,
            email: registration.topic.mentor.email,
        } : null;

        const submission = await tx.bM02Submission.create({
            data: {
                registrationId,
                versionNo: (prior?.versionNo || 0) + 1,
                attemptNo: isRevision ? 2 : 1,
                supersedesId: isRevision ? prior.id : null,
                content: content || null,
                fileUrl: fileUrl || null,
                fileName: fileName || null,
                bm01ApprovedTitle: bm01ApprovedTitle || null,
                bm02ProposedTitle: proposedTitle || null,
                titleChangeReason: normalizedReason,
                studentSnapshot: studentSnapshot || undefined,
                mentorSnapshot: mentorSnapshot || undefined,
                submittedById: studentId,
                policyVersionId: registration.periodPolicyVersionId,
            },
        });

        // Sync Task(taskType='BM02') to SUBMITTED
        if (tx.task) {
            const bm02Task = await tx.task.findFirst({
                where: { registrationId, taskType: 'BM02' },
            });
            if (bm02Task) {
                await tx.task.update({
                    where: { id: bm02Task.id },
                    data: { status: 'SUBMITTED' },
                });
            } else {
                await tx.task.create({
                    data: {
                        registrationId,
                        title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
                        taskType: 'BM02',
                        status: 'SUBMITTED',
                    },
                });
            }
        }

        if (prior) await tx.bM02Submission.update({ where: { id: prior.id }, data: { outcome: 'SUPERSEDED' } });
        const targetStatus = isRevision ? 'BM02_RESUBMITTED' : 'BM02_SUBMITTED';
        await transitionRegistration({
            registrationId, expectedStatus: registration.status, expectedStateVersion: registration.stateVersion,
            targetStatus, actorId: studentId, reason: 'BM02 submitted',
            reference: { command: 'SUBMIT_BM02', submissionId: submission.id },
            idempotencyKey: commandKey('submit-bm02', idempotencyKey),
            changes: { currentBM02SubmissionId: submission.id },
        }, { tx });
        const response = JSON.parse(JSON.stringify(submission));
        await tx.idempotencyRecord.create({
            data: { scope: receiptScope, key: receiptKey, commandHash: hash, registrationId, response },
        });
        return { ...submission, idempotent: false };
        });
        if (result.expired) {
            const error = new WorkflowTransitionError('BM02_REVISION_DEADLINE_EXPIRED', 409);
            error.result = result;
            throw error;
        }
        return result;
    } catch (error) {
        if (error?.code === 'P2002') {
            const receipt = await db.idempotencyRecord.findUnique({ where: { scope_key: { scope: receiptScope, key: receiptKey } } });
            if (receipt?.commandHash === hash) return { ...receipt.response, idempotent: true };
        }
        throw error;
    }
}

async function issueAssignmentDecision({ registrationId, issuedById, decisionNumber, issuedAt = new Date(), idempotencyKey }, options = {}) {
    const db = options.db || options.tx || prisma;
    const key = commandKey('issue-assignment-decision', idempotencyKey);

    const executeIssue = async (tx) => {
        const existing = await tx.assignmentDecision.findUnique({ where: { idempotencyKey: key } });
        if (existing) {
            if (existing.registrationId !== registrationId
                || existing.decisionNumber !== decisionNumber
                || existing.issuedById !== issuedById) {
                throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
            }
            return { ...existing, idempotent: true };
        }
        const registration = await tx.topicRegistration.findUnique({
            where: { id: registrationId },
            select: { id: true, status: true, stateVersion: true, periodPolicyVersionId: true, currentBM02SubmissionId: true },
        });
        if (!registration?.periodPolicyVersionId || !registration.currentBM02SubmissionId) throw new WorkflowTransitionError('BM02_CURRENT_APPROVAL_REQUIRED', 409);
        const bm02 = await tx.bM02Submission.findUnique({ where: { id: registration.currentBM02SubmissionId } });
        if (!bm02 || bm02.outcome !== 'APPROVED' || (bm02.registrationId !== undefined && bm02.registrationId !== registration.id)) {
            throw new WorkflowTransitionError('BM02_CURRENT_APPROVAL_REQUIRED', 409);
        }
        if (registration.periodPolicyVersionId && bm02.policyVersionId && bm02.policyVersionId !== registration.periodPolicyVersionId) {
            throw new WorkflowTransitionError('BM02_POLICY_VERSION_MISMATCH', 409);
        }
        if (!['BM02_SUBMITTED', 'BM02_RESUBMITTED', 'BM02_APPROVED'].includes(registration.status)) throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        const decision = await tx.assignmentDecision.create({
            data: { registrationId, bm02SubmissionId: bm02.id, decisionNumber, issuedAt, effectiveAt: issuedAt, issuedById, policyVersionId: registration.periodPolicyVersionId, idempotencyKey: key },
        });
        await transitionRegistration({
            registrationId, expectedStatus: registration.status, expectedStateVersion: registration.stateVersion,
            targetStatus: 'DECISION_ISSUED', actorId: issuedById, reason: `Assignment decision ${decisionNumber}`,
            reference: { command: 'ISSUE_ASSIGNMENT_DECISION', decisionId: decision.id, bm02SubmissionId: bm02.id },
            idempotencyKey: commandKey('transition-decision', idempotencyKey),
            changes: { decisionNumber, decisionDate: issuedAt, decisionPublishedAt: issuedAt },
        }, { tx });
        return { ...decision, idempotent: false };
    };

    try {
        if (options.tx) {
            return await executeIssue(options.tx);
        }
        return await db.$transaction(async (tx) => executeIssue(tx));
    } catch (error) {
        if (error?.code === 'P2002') {
            const existing = await db.assignmentDecision.findUnique({ where: { idempotencyKey: key } });
            if (existing) return { ...existing, idempotent: true };
        }
        throw error;
    }
}

async function createDecisionAmendment({
    assignmentDecisionId,
    signedById,
    amendmentNumber,
    reason,
    changes,
    effectiveAt = new Date(),
    idempotencyKey,
}, options = {}) {
    const db = options.db || prisma;
    const key = commandKey('decision-amendment', idempotencyKey);
    if (!amendmentNumber || !String(amendmentNumber).trim()
        || !reason || !String(reason).trim()
        || !changes || typeof changes !== 'object' || Array.isArray(changes)
        || Object.keys(changes).length === 0) {
        throw new WorkflowTransitionError('DECISION_AMENDMENT_INPUT_INVALID', 400);
    }

    const normalized = {
        assignmentDecisionId,
        signedById,
        amendmentNumber: String(amendmentNumber).trim(),
        reason: String(reason).trim(),
        changes,
        effectiveAt: new Date(effectiveAt),
    };
    const matches = (existing) => existing.assignmentDecisionId === normalized.assignmentDecisionId
        && existing.signedById === normalized.signedById
        && existing.amendmentNumber === normalized.amendmentNumber
        && existing.reason === normalized.reason
        && JSON.stringify(existing.changes) === JSON.stringify(normalized.changes)
        && new Date(existing.effectiveAt).getTime() === normalized.effectiveAt.getTime();

    try {
        return await db.$transaction(async (tx) => {
            const existing = await tx.decisionAmendment.findUnique({ where: { idempotencyKey: key } });
            if (existing) {
                if (!matches(existing)) throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
                return { ...existing, idempotent: true };
            }
            const decision = await tx.assignmentDecision.findUnique({
                where: { id: assignmentDecisionId },
                select: { id: true },
            });
            if (!decision) throw new WorkflowTransitionError('ASSIGNMENT_DECISION_NOT_FOUND', 404);

            const amendment = await tx.decisionAmendment.create({
                data: { ...normalized, idempotencyKey: key },
            });
            return { ...amendment, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002') {
            const existing = await db.decisionAmendment.findUnique({ where: { idempotencyKey: key } });
            if (existing && matches(existing)) return { ...existing, idempotent: true };
            throw new WorkflowTransitionError('DECISION_AMENDMENT_CONFLICT', 409);
        }
        throw error;
    }
}

/**
 * Creates a TopicAssignmentDecision (status: DRAFT) with snapshot items.
 */
async function createTopicDecision({
    semesterId,
    decisionNumber,
    decisionDate = new Date(),
    fileUrl,
    fileName,
    registrationIds,
    issuedById,
    idempotencyKey,
}, options = {}) {
    const db = options.db || options.tx || prisma;
    const key = commandKey('create-topic-decision', idempotencyKey);
    const semId = Number(semesterId);
    const uId = Number(issuedById);

    if (!semId || !decisionNumber || !Array.isArray(registrationIds) || registrationIds.length === 0) {
        throw new WorkflowTransitionError('INVALID_INPUT', 400);
    }

    const executeCreate = async (tx) => {
        if (tx.idempotencyRecord) {
            const existingReceipt = await tx.idempotencyRecord.findUnique({
                where: { scope_key: { scope: 'topic-decision:create', key } },
            });
            if (existingReceipt) {
                return { ...existingReceipt.response, idempotent: true };
            }
        }

        const existingDec = await tx.topicAssignmentDecision.findUnique({
            where: { decisionNumber: String(decisionNumber).trim() },
        });
        if (existingDec) {
            if (existingDec.idempotencyKey === key) {
                return { ...existingDec, idempotent: true };
            }
            throw new WorkflowTransitionError('DECISION_NUMBER_ALREADY_EXISTS', 409);
        }

        const semester = await tx.semester.findUnique({
            where: { id: semId },
        });
        if (!semester) throw new WorkflowTransitionError('SEMESTER_NOT_FOUND', 404);

        let policyVersionId = semester.lockedPolicyVersionId;
        if (!policyVersionId && tx.periodWorkflowPolicyVersion) {
            const activePolicy = await tx.periodWorkflowPolicyVersion.findFirst({
                where: { semesterId: semId, isActive: true },
                orderBy: { version: 'desc' },
            });
            if (activePolicy) policyVersionId = activePolicy.id;
        }
        if (!policyVersionId) {
            throw new WorkflowTransitionError('WORKFLOW_POLICY_REQUIRED', 409);
        }

        // Validate all registrations
        const eligibleItems = [];
        for (const regId of registrationIds) {
            const reg = await tx.topicRegistration.findUnique({
                where: { id: Number(regId) },
                include: {
                    currentBM02Submission: true,
                    topic: { include: { mentor: true } },
                    student: true,
                },
            });
            if (!reg) throw new WorkflowTransitionError(`REGISTRATION_NOT_FOUND_${regId}`, 404);
            if (reg.semesterId !== semId) {
                throw new WorkflowTransitionError('SEMESTER_MISMATCH', 400);
            }
            if (!reg.currentBM02Submission || reg.currentBM02Submission.outcome !== 'APPROVED') {
                throw new WorkflowTransitionError('BM02_NOT_APPROVED', 409);
            }

            const existingItem = await tx.topicAssignmentDecisionItem.findUnique({
                where: { registrationId: reg.id },
            });
            if (existingItem) {
                throw new WorkflowTransitionError('REGISTRATION_ALREADY_IN_DECISION', 409);
            }

            const approvedTitle = reg.currentBM02Submission.bm02ProposedTitle
                || reg.currentBM02Submission.bm01ApprovedTitle
                || reg.topic?.title
                || '';

            eligibleItems.push({
                registrationId: reg.id,
                bm02SubmissionId: reg.currentBM02Submission.id,
                approvedTitleSnapshot: approvedTitle,
                studentCodeSnapshot: reg.student?.studentCode || '',
                studentNameSnapshot: reg.student?.fullName || '',
                mentorNameSnapshot: reg.topic?.mentor?.fullName || '',
            });
        }

        const decision = await tx.topicAssignmentDecision.create({
            data: {
                semesterId: semId,
                decisionNumber: String(decisionNumber).trim(),
                decisionDate: new Date(decisionDate),
                fileUrl: fileUrl || null,
                fileName: fileName || null,
                issuedById: uId,
                policyVersionId,
                status: 'DRAFT',
                idempotencyKey: key,
            },
        });

        const items = [];
        for (const itemData of eligibleItems) {
            const item = await tx.topicAssignmentDecisionItem.create({
                data: {
                    decisionId: decision.id,
                    ...itemData,
                },
            });
            items.push(item);
        }

        const response = {
            ...decision,
            items,
            idempotent: false,
        };

        if (tx.idempotencyRecord) {
            await tx.idempotencyRecord.create({
                data: {
                    scope: 'topic-decision:create',
                    key,
                    commandHash: fingerprint({ semesterId: semId, decisionNumber, registrationIds }),
                    response: JSON.parse(JSON.stringify(response)),
                },
            });
        }

        return response;
    };

    if (options.tx) return await executeCreate(options.tx);
    return await db.$transaction(async (tx) => executeCreate(tx));
}

/**
 * Publishes a TopicAssignmentDecision (status: PUBLISHED).
 * Sets decisionPublishedAt = publishedAt,
 * transitions registrations to DECISION_ISSUED,
 * calculates titleAdjustmentDeadline = decisionPublishedAt + 168h.
 */
async function publishTopicDecision({
    decisionId,
    publishedById,
    publishedAt = new Date(),
    idempotencyKey,
}, options = {}) {
    const db = options.db || options.tx || prisma;
    const key = commandKey('publish-topic-decision', idempotencyKey);
    const dId = Number(decisionId);
    const pubAt = new Date(publishedAt);
    const deadline = new Date(pubAt.getTime() + 168 * 3600 * 1000); // 168h = 7 days

    const executePublish = async (tx) => {
        if (tx.idempotencyRecord) {
            const existingReceipt = await tx.idempotencyRecord.findUnique({
                where: { scope_key: { scope: 'topic-decision:publish', key } },
            });
            if (existingReceipt) {
                return { ...existingReceipt.response, idempotent: true };
            }
        }

        const decision = await tx.topicAssignmentDecision.findUnique({
            where: { id: dId },
            include: {
                items: true,
                semester: true,
            },
        });
        if (!decision) throw new WorkflowTransitionError('TOPIC_ASSIGNMENT_DECISION_NOT_FOUND', 404);
        if (decision.status === 'PUBLISHED') {
            const res = {
                ...decision,
                titleAdjustmentDeadline: new Date(new Date(decision.decisionPublishedAt).getTime() + 168 * 3600 * 1000),
                idempotent: true,
            };
            return res;
        }

        const updatedDecision = await tx.topicAssignmentDecision.update({
            where: { id: dId },
            data: {
                status: 'PUBLISHED',
                decisionPublishedAt: pubAt,
            },
        });

        for (const item of (decision.items || [])) {
            const reg = await tx.topicRegistration.findUnique({
                where: { id: item.registrationId },
                select: { id: true, status: true, stateVersion: true, semesterId: true, periodPolicyVersionId: true },
            });
            if (reg) {
                await transitionRegistration({
                    registrationId: reg.id,
                    expectedStatus: reg.status,
                    expectedStateVersion: reg.stateVersion,
                    targetStatus: 'DECISION_ISSUED',
                    actorId: Number(publishedById),
                    reason: `Topic Assignment Decision ${decision.decisionNumber} published`,
                    reference: { command: 'PUBLISH_TOPIC_DECISION', decisionId: dId },
                    idempotencyKey: commandKey('publish-trans', `${dId}-${item.registrationId}-${idempotencyKey}`),
                    changes: {
                        decisionNumber: decision.decisionNumber,
                        decisionDate: decision.decisionDate,
                        decisionPublishedAt: pubAt,
                    },
                }, { tx });
            }

            // Sync AssignmentDecision for backward compatibility if not existing
            const legacyKey = `compat-assign-dec:${decision.id}:${item.registrationId}`;
            const existingLegacy = await tx.assignmentDecision.findUnique({
                where: { idempotencyKey: legacyKey },
            });
            if (!existingLegacy) {
                await tx.assignmentDecision.create({
                    data: {
                        registrationId: item.registrationId,
                        bm02SubmissionId: item.bm02SubmissionId,
                        decisionNumber: decision.decisionNumber,
                        issuedAt: decision.decisionDate,
                        effectiveAt: pubAt,
                        issuedById: Number(publishedById),
                        policyVersionId: decision.policyVersionId,
                        idempotencyKey: legacyKey,
                    },
                });
            }

            // Sync BM03 checkpoint task if not exists
            if (tx.task) {
                const hasBM03 = await tx.task.findFirst({
                    where: { registrationId: item.registrationId, taskType: 'BM03_CHECKPOINT_1' },
                });
                if (!hasBM03) {
                    await tx.task.create({
                        data: {
                            registrationId: item.registrationId,
                            title: 'BM03 - Báo cáo tiến độ Đợt 1 (Tuần 6)',
                            content: 'Báo cáo tiến độ thực hiện đồ án đợt 1: khối lượng công việc hoàn thành và kế hoạch giai đoạn tiếp theo.',
                            taskType: 'BM03_CHECKPOINT_1',
                            status: 'OPEN',
                        },
                    });
                }
            }
        }

        const response = {
            ...updatedDecision,
            titleAdjustmentDeadline: deadline,
            idempotent: false,
        };

        if (tx.idempotencyRecord) {
            await tx.idempotencyRecord.create({
                data: {
                    scope: 'topic-decision:publish',
                    key,
                    commandHash: fingerprint({ decisionId: dId, publishedById, publishedAt: pubAt }),
                    response: JSON.parse(JSON.stringify(response)),
                },
            });
        }

        return response;
    };

    if (options.tx) return await executePublish(options.tx);
    return await db.$transaction(async (tx) => executePublish(tx));
}

module.exports = {
    submitBM02,
    issueAssignmentDecision,
    createDecisionAmendment,
    createTopicDecision,
    publishTopicDecision,
};
