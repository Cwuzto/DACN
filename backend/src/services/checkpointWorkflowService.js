const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

const ISSUE_SCOPE = 'checkpoint-issue-command';
const SIGN_SCOPE = 'checkpoint-sign-command';
const OVERDUE_SCOPE = 'checkpoint-overdue-command';
const SUBMIT_APPEAL_SCOPE = 'checkpoint-appeal-submit-command';
const REVIEW_APPEAL_SCOPE = 'checkpoint-appeal-review-command';

function requireCommandKey(prefix, key) {
    if (!key || typeof key !== 'string' || key.trim().length < 8) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400);
    }
    return `${prefix}:${key.trim()}`;
}

function fingerprint(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function addDays(date, days) {
    return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

async function findReceipt(tx, scope, key, hash) {
    const receipt = await tx.idempotencyRecord.findUnique({
        where: { scope_key: { scope, key } },
    });
    if (!receipt) return null;
    if (receipt.commandHash !== hash) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
    }
    return { ...receipt.response, idempotent: true };
}

async function saveReceipt(tx, { scope, key, hash, registrationId, response }) {
    await tx.idempotencyRecord.create({
        data: {
            scope,
            key,
            commandHash: hash,
            registrationId,
            response: jsonValue(response),
        },
    });
}

/**
 * GVHD phát hành và ký trước Checkpoint 1 hoặc 2 của BM03
 */
async function issueCheckpoint(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('cp-issue', input.idempotencyKey);
    const commandHash = fingerprint({
        registrationId: input.registrationId,
        checkpointNo: input.checkpointNo,
        conclusion: input.conclusion,
        comments: input.comments || null,
        evidenceUrl: input.evidenceUrl || null,
        mentorSignature: input.mentorSignature,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, ISSUE_SCOPE, key, commandHash);
        if (retry) return retry;

        const registration = await tx.topicRegistration.findUnique({
            where: { id: input.registrationId },
            include: {
                topic: { select: { mentorId: true, title: true } },
                periodPolicyVersion: { select: { id: true, policy: true } },
            },
        });
        if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);
        if (!registration.periodPolicyVersionId) {
            throw new WorkflowTransitionError('WORKFLOW_POLICY_REQUIRED', 409);
        }

        if (registration.topic?.mentorId !== input.actorId) {
            throw new WorkflowTransitionError('ONLY_CURRENT_MENTOR_ALLOWED', 403);
        }

        const cpNo = parseInt(input.checkpointNo, 10);
        if (cpNo !== 1 && cpNo !== 2) {
            throw new WorkflowTransitionError('INVALID_CHECKPOINT_NUMBER', 400);
        }

        if (!['ALLOWED_TO_CONTINUE', 'NOT_ALLOWED_TO_CONTINUE'].includes(input.conclusion)) {
            throw new WorkflowTransitionError('INVALID_CHECKPOINT_CONCLUSION', 400);
        }

        if (!input.mentorSignature || !String(input.mentorSignature).trim()) {
            throw new WorkflowTransitionError('MENTOR_SIGNATURE_REQUIRED', 400);
        }

        // Kiểm tra thứ tự và trạng thái hợp lệ
        if (cpNo === 1) {
            if (!['DECISION_ISSUED', 'IN_PROGRESS_BM03'].includes(registration.status)) {
                throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
            }
        } else if (cpNo === 2) {
            if (registration.status !== 'IN_PROGRESS_BM03') {
                throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
            }
            // Checkpoint 1 phải đã ký đủ 2 bên và đạt ALLOWED_TO_CONTINUE
            const cp1 = await tx.checkpointEvaluation.findFirst({
                where: {
                    registrationId: registration.id,
                    checkpointNo: 1,
                    studentSignedAt: { not: null },
                    conclusion: 'ALLOWED_TO_CONTINUE',
                },
                orderBy: { attemptNo: 'desc' },
            });
            if (!cp1) {
                throw new WorkflowTransitionError('PREVIOUS_CHECKPOINT_NOT_PASSED', 409);
            }
        }

        // Tính hạn ký của sinh viên (mặc định 3 ngày)
        const signWindowDays = Number(registration.periodPolicyVersion?.policy?.checkpointSignWindowDays) || 3;
        const studentSignDeadlineAt = addDays(now, signWindowDays);

        // Kiểm tra xem đã có phiên bản nào cho checkpointNo này chưa
        const existing = await tx.checkpointEvaluation.findFirst({
            where: { registrationId: registration.id, checkpointNo: cpNo },
            orderBy: { attemptNo: 'desc' },
        });

        if (existing && existing.studentSignedAt) {
            throw new WorkflowTransitionError('CHECKPOINT_ALREADY_SIGNED', 409);
        }

        const attemptNo = existing ? existing.attemptNo + 1 : 1;
        const supersedesEvaluationId = existing ? existing.id : null;

        const evaluation = await tx.checkpointEvaluation.create({
            data: {
                registrationId: registration.id,
                checkpointNo: cpNo,
                attemptNo,
                conclusion: input.conclusion,
                comments: input.comments ? String(input.comments).trim() : null,
                evidenceUrl: input.evidenceUrl || null,
                evidenceName: input.evidenceName || null,
                mentorSignedById: input.actorId,
                mentorSignedAt: now,
                mentorSignature: String(input.mentorSignature).trim(),
                studentSignDeadlineAt,
                notifiedAt: now,
                supersedesEvaluationId,
                policyVersionId: registration.periodPolicyVersionId,
            },
        });

        // Chuyển trạng thái sang BM03_SIGNATURE_PENDING
        let transitionResult = null;
        if (registration.status !== 'BM03_SIGNATURE_PENDING') {
            transitionResult = await transitionRegistration({
                registrationId: registration.id,
                expectedStatus: registration.status,
                expectedStateVersion: registration.stateVersion,
                targetStatus: 'BM03_SIGNATURE_PENDING',
                actorId: input.actorId,
                reason: `GVHD phát hành biên bản BM03 Checkpoint ${cpNo}`,
                idempotencyKey: `${key}:transition`,
            }, { tx });
        }

        const response = {
            evaluationId: evaluation.id,
            checkpointNo: cpNo,
            attemptNo,
            conclusion: evaluation.conclusion,
            studentSignDeadlineAt,
            transitionResult,
        };

        await saveReceipt(tx, {
            scope: ISSUE_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

/**
 * Sinh viên ký xác nhận Checkpoint BM03 (hoàn tất đủ 2 chữ ký)
 */
async function signCheckpoint(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('cp-sign', input.idempotencyKey);
    const commandHash = fingerprint({
        checkpointEvaluationId: input.checkpointEvaluationId,
        studentSignature: input.studentSignature,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, SIGN_SCOPE, key, commandHash);
        if (retry) return retry;

        const evaluation = await tx.checkpointEvaluation.findUnique({
            where: { id: input.checkpointEvaluationId },
            include: {
                registration: {
                    select: {
                        id: true,
                        studentId: true,
                        status: true,
                        stateVersion: true,
                        periodPolicyVersionId: true,
                    },
                },
            },
        });
        if (!evaluation) throw new WorkflowTransitionError('CHECKPOINT_NOT_FOUND', 404);

        const { registration } = evaluation;
        if (registration.studentId !== input.actorId) {
            throw new WorkflowTransitionError('ONLY_STUDENT_ALLOWED', 403);
        }

        if (registration.status !== 'BM03_SIGNATURE_PENDING') {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        }

        if (evaluation.studentSignedAt) {
            throw new WorkflowTransitionError('CHECKPOINT_ALREADY_SIGNED', 409);
        }

        // Kiểm tra hạn ký 3 ngày
        if (evaluation.studentSignDeadlineAt && now > evaluation.studentSignDeadlineAt) {
            throw new WorkflowTransitionError('SIGNATURE_WINDOW_EXPIRED', 409);
        }

        if (!input.studentSignature || !String(input.studentSignature).trim()) {
            throw new WorkflowTransitionError('STUDENT_SIGNATURE_REQUIRED', 400);
        }

        // Cập nhật chữ ký sinh viên
        const updated = await tx.checkpointEvaluation.update({
            where: { id: evaluation.id },
            data: {
                studentSignedById: input.actorId,
                studentSignedAt: now,
                studentSignature: String(input.studentSignature).trim(),
            },
        });

        // Xác định trạng thái kế tiếp khi đã có đủ 2 chữ ký
        let targetStatus;
        if (evaluation.conclusion === 'NOT_ALLOWED_TO_CONTINUE') {
            targetStatus = 'TERMINATED_FAILED_PROGRESS';
        } else if (evaluation.checkpointNo === 1) {
            targetStatus = 'IN_PROGRESS_BM03';
        } else if (evaluation.checkpointNo === 2) {
            targetStatus = 'BM03_PASSED';
        }

        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: 'BM03_SIGNATURE_PENDING',
            expectedStateVersion: registration.stateVersion,
            targetStatus,
            actorId: input.actorId,
            reason: `Sinh viên ký xác nhận biên bản BM03 Checkpoint ${evaluation.checkpointNo}. Kết luận: ${evaluation.conclusion}`,
            idempotencyKey: `${key}:transition`,
        }, { tx });

        const response = {
            evaluationId: updated.id,
            checkpointNo: updated.checkpointNo,
            studentSignedAt: updated.studentSignedAt,
            conclusion: updated.conclusion,
            transitionResult,
        };

        await saveReceipt(tx, {
            scope: SIGN_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

/**
 * Xử lý khi sinh viên quá hạn 3 ngày không ký Checkpoint:
 * Mở cửa sổ 3 ngày để sinh viên nộp CheckpointSignatureAppeal (INV-10, INV-26)
 */
async function handleSignatureOverdue(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('cp-overdue', input.idempotencyKey);
    const commandHash = fingerprint({
        checkpointEvaluationId: input.checkpointEvaluationId,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, OVERDUE_SCOPE, key, commandHash);
        if (retry) return retry;

        const evaluation = await tx.checkpointEvaluation.findUnique({
            where: { id: input.checkpointEvaluationId },
            include: {
                registration: {
                    select: {
                        id: true,
                        studentId: true,
                        status: true,
                        stateVersion: true,
                        periodPolicyVersion: { select: { policy: true } },
                    },
                },
            },
        });
        if (!evaluation) throw new WorkflowTransitionError('CHECKPOINT_NOT_FOUND', 404);

        const { registration } = evaluation;
        if (registration.status !== 'BM03_SIGNATURE_PENDING') {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        }

        if (evaluation.studentSignedAt) {
            throw new WorkflowTransitionError('CHECKPOINT_ALREADY_SIGNED', 409);
        }

        if (!evaluation.studentSignDeadlineAt || now <= evaluation.studentSignDeadlineAt) {
            throw new WorkflowTransitionError('SIGNATURE_WINDOW_NOT_EXPIRED', 409);
        }

        const appealWindowDays = Number(registration.periodPolicyVersion?.policy?.appealWindowDays) || 3;
        const appealDeadlineAt = addDays(now, appealWindowDays);

        // Tạo bản ghi CheckpointSignatureAppeal
        const appeal = await tx.checkpointSignatureAppeal.upsert({
            where: { checkpointEvaluationId: evaluation.id },
            create: {
                checkpointEvaluationId: evaluation.id,
                registrationId: registration.id,
                studentId: registration.studentId,
                appealDeadlineAt,
                status: 'PENDING',
            },
            update: {
                appealDeadlineAt,
                status: 'PENDING',
            },
        });

        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: 'BM03_SIGNATURE_PENDING',
            expectedStateVersion: registration.stateVersion,
            targetStatus: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
            actorId: input.actorId,
            reason: `Quá hạn ký biên bản Checkpoint ${evaluation.checkpointNo}. Mở hạn nộp khiếu nại chữ ký 3 ngày.`,
            idempotencyKey: `${key}:transition`,
        }, { tx });

        const response = {
            appealId: appeal.id,
            checkpointEvaluationId: evaluation.id,
            appealDeadlineAt,
            transitionResult,
        };

        await saveReceipt(tx, {
            scope: OVERDUE_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

/**
 * Sinh viên nộp đơn giải trình/khiếu nại CheckpointSignatureAppeal trong hạn 3 ngày
 */
async function submitSignatureAppeal(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('cp-appeal-submit', input.idempotencyKey);
    const commandHash = fingerprint({
        checkpointEvaluationId: input.checkpointEvaluationId,
        reason: input.reason,
        evidenceUrl: input.evidenceUrl || null,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, SUBMIT_APPEAL_SCOPE, key, commandHash);
        if (retry) return retry;

        const appeal = await tx.checkpointSignatureAppeal.findUnique({
            where: { checkpointEvaluationId: input.checkpointEvaluationId },
            include: {
                registration: {
                    select: {
                        id: true,
                        studentId: true,
                        status: true,
                        stateVersion: true,
                    },
                },
            },
        });
        if (!appeal) throw new WorkflowTransitionError('APPEAL_NOT_FOUND', 404);

        const { registration } = appeal;
        if (registration.studentId !== input.actorId) {
            throw new WorkflowTransitionError('ONLY_STUDENT_ALLOWED', 403);
        }

        if (registration.status !== 'CHECKPOINT_SIGNATURE_APPEAL_OPEN') {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        }

        if (now > appeal.appealDeadlineAt) {
            throw new WorkflowTransitionError('APPEAL_WINDOW_EXPIRED', 409);
        }

        if (!input.reason || !String(input.reason).trim()) {
            throw new WorkflowTransitionError('APPEAL_REASON_REQUIRED', 400);
        }

        const updatedAppeal = await tx.checkpointSignatureAppeal.update({
            where: { id: appeal.id },
            data: {
                reason: String(input.reason).trim(),
                evidenceUrl: input.evidenceUrl || null,
                evidenceName: input.evidenceName || null,
                submittedAt: now,
                status: 'SUBMITTED',
            },
        });

        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: 'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
            expectedStateVersion: registration.stateVersion,
            targetStatus: 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
            actorId: input.actorId,
            reason: 'Sinh viên nộp đơn khiếu nại chữ ký Checkpoint',
            idempotencyKey: `${key}:transition`,
        }, { tx });

        const response = {
            appealId: updatedAppeal.id,
            submittedAt: updatedAppeal.submittedAt,
            status: updatedAppeal.status,
            transitionResult,
        };

        await saveReceipt(tx, {
            scope: SUBMIT_APPEAL_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

/**
 * Thẩm định đơn khiếu nại chữ ký Checkpoint (Admin / Viện trưởng thẩm định)
 * GVHD không được tự thẩm định đơn khiếu nại của SV mình.
 */
async function reviewSignatureAppeal(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('cp-appeal-review', input.idempotencyKey);
    const commandHash = fingerprint({
        appealId: input.appealId,
        decision: input.decision,
        reviewNotes: input.reviewNotes || null,
        resolutionDecision: input.resolutionDecision || null,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, REVIEW_APPEAL_SCOPE, key, commandHash);
        if (retry) return retry;

        const appeal = await tx.checkpointSignatureAppeal.findUnique({
            where: { id: input.appealId },
            include: {
                registration: {
                    select: {
                        id: true,
                        status: true,
                        stateVersion: true,
                        topic: { select: { mentorId: true } },
                    },
                },
            },
        });
        if (!appeal) throw new WorkflowTransitionError('APPEAL_NOT_FOUND', 404);

        const { registration } = appeal;
        if (registration.topic?.mentorId === input.actorId) {
            throw new WorkflowTransitionError('MENTOR_CANNOT_REVIEW_APPEAL', 403);
        }

        if (!['CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED', 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW'].includes(registration.status)) {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        }

        if (!['APPROVED', 'REJECTED'].includes(input.decision)) {
            throw new WorkflowTransitionError('INVALID_REVIEW_DECISION', 400);
        }

        const isApproved = input.decision === 'APPROVED';
        const targetStatus = isApproved ? 'SIGNATURE_APPEAL_RESOLVED' : 'TERMINATED_FAILED_PROGRESS';

        const updatedAppeal = await tx.checkpointSignatureAppeal.update({
            where: { id: appeal.id },
            data: {
                status: isApproved ? 'APPROVED' : 'REJECTED',
                reviewedById: input.actorId,
                reviewedAt: now,
                reviewNotes: input.reviewNotes ? String(input.reviewNotes).trim() : null,
                resolutionDecision: input.resolutionDecision ? String(input.resolutionDecision).trim() : null,
            },
        });

        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: registration.status,
            expectedStateVersion: registration.stateVersion,
            targetStatus,
            actorId: input.actorId,
            reason: `Kết luận thẩm định khiếu nại chữ ký: ${isApproved ? 'CHẤP THUẬN' : 'BÁC ĐƠN'}`,
            idempotencyKey: `${key}:transition`,
        }, { tx });

        const response = {
            appealId: updatedAppeal.id,
            decision: input.decision,
            reviewedAt: updatedAppeal.reviewedAt,
            transitionResult,
        };

        await saveReceipt(tx, {
            scope: REVIEW_APPEAL_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

module.exports = {
    ISSUE_SCOPE,
    SIGN_SCOPE,
    OVERDUE_SCOPE,
    SUBMIT_APPEAL_SCOPE,
    REVIEW_APPEAL_SCOPE,
    issueCheckpoint,
    signCheckpoint,
    handleSignatureOverdue,
    submitSignatureAppeal,
    reviewSignatureAppeal,
};
