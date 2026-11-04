const crypto = require('crypto');
const prisma = require('../config/database');
const { transitionRegistration, WorkflowTransitionError } = require('./registrationTransitionService');

const BM04_SUBMIT_SCOPE = 'bm04-submit-command';

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

async function findReceipt(tx, scope, key, hash) {
    if (!tx.idempotencyRecord?.findUnique) return null;
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
    if (!tx.idempotencyRecord?.create) return;
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
 * GVHD lập và ký khóa phiếu nhận xét BM04
 * Supports both signatures:
 *   submitBM04(input, options)
 *   submitBM04(registrationId, mentorId, payload, options)
 */
async function submitBM04(firstArg, secondArg, thirdArg, fourthArg) {
    let input;
    let options;

    if (typeof firstArg === 'object' && firstArg !== null && !Array.isArray(firstArg)) {
        input = { ...firstArg };
        options = secondArg || {};
    } else {
        const registrationId = parseInt(firstArg, 10);
        const mentorId = parseInt(secondArg, 10);
        const payload = thirdArg || {};
        options = fourthArg || {};
        input = {
            registrationId,
            actorId: mentorId,
            ...payload,
        };
    }

    const db = options.db || prisma;
    const now = options.now || new Date();

    const rawKey = input.idempotencyKey || options.idempotencyKey || `bm04-${input.registrationId}-${input.actorId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const key = requireCommandKey('bm04-submit', rawKey);

    const commandHash = fingerprint({
        registrationId: input.registrationId,
        thesisFormatScore: input.thesisFormatScore,
        researchContentScore: input.researchContentScore,
        applicabilityScore: input.applicabilityScore,
        attitudeScore: input.attitudeScore,
        conclusion: input.conclusion,
        generalNotes: input.generalNotes || null,
        lecturerSignature: input.lecturerSignature,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, BM04_SUBMIT_SCOPE, key, commandHash);
        if (retry) return retry;

        const registration = await tx.topicRegistration.findUnique({
            where: { id: input.registrationId },
            include: {
                topic: true,
                student: true,
                bm04Evaluation: true,
                archive: true,
                periodPolicyVersion: true,
            },
        });
        if (!registration) {
            throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404, 'Không tìm thấy hồ sơ đăng ký đề tài.');
        }

        if (registration.topic?.mentorId !== input.actorId) {
            throw new WorkflowTransitionError('ONLY_CURRENT_MENTOR_ALLOWED', 403, 'Chỉ giảng viên hướng dẫn của đề tài này mới có quyền lập và ký phiếu BM04.');
        }

        if (registration.bm04Evaluation && registration.bm04Evaluation.isLocked) {
            throw new WorkflowTransitionError('BM04_ALREADY_LOCKED', 400, 'Phiếu nhận xét BM04 này đã được ký xác nhận và khóa vĩnh viễn, không thể cập nhật lại.');
        }

        if (registration.status !== 'BM03_PASSED') {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409, 'Chỉ được lập BM04 khi hồ sơ đang ở trạng thái BM03_PASSED.');
        }

        if (!['AGREED_FOR_DEFENSE', 'NOT_AGREED_FOR_DEFENSE', 'NOT_AGREED'].includes(input.conclusion)) {
            throw new WorkflowTransitionError('INVALID_BM04_CONCLUSION', 400, 'Kết luận BM04 bắt buộc phải là AGREED_FOR_DEFENSE hoặc NOT_AGREED_FOR_DEFENSE.');
        }

        if (!input.thesisFormatScore || !input.researchContentScore || !input.applicabilityScore || !input.attitudeScore) {
            throw new WorkflowTransitionError('MISSING_CRITERIA_FEEDBACK', 400, 'Vui lòng điền đầy đủ nhận xét cho cả 4 tiêu chí đánh giá bắt buộc.');
        }

        if (!input.lecturerSignature || !String(input.lecturerSignature).trim()) {
            throw new WorkflowTransitionError('LECTURER_SIGNATURE_REQUIRED', 400, 'Chữ ký xác nhận của GVHD là bắt buộc.');
        }

        const isAgreed = input.conclusion === 'AGREED_FOR_DEFENSE';

        if (isAgreed) {
            const archive = registration.archive;
            const hasValidPreDefenseArchive = Boolean(
                archive &&
                (archive.phase === 'PRE_DEFENSE' || (!archive.phase && (archive.reportFileUrl || archive.sourceCodeUrl))) &&
                (archive.status === 'SUBMITTED' || (!archive.status && (archive.reportFileUrl || archive.sourceCodeUrl))) &&
                (archive.reportFileUrl || archive.sourceCodeUrl || archive.slideFileUrl || archive.demoVideoUrl),
            );

            if (!hasValidPreDefenseArchive) {
                throw new WorkflowTransitionError(
                    'PRE_DEFENSE_ARCHIVE_REQUIRED',
                    400,
                    'Sinh viên chưa nộp tài liệu lưu chiểu sơ bộ trước bảo vệ (bản thảo báo cáo/slide/mã nguồn). Không thể ký duyệt BM04 cho phép bảo vệ.',
                );
            }
        }

        const targetStatus = isAgreed ? 'DEFENSE_READY' : 'TERMINATED_BM04';

        const evaluation = await tx.bM04Evaluation.upsert({
            where: { registrationId: registration.id },
            create: {
                registrationId: registration.id,
                semesterId: registration.semesterId,
                studentId: registration.studentId,
                lecturerId: input.actorId,
                thesisFormatScore: String(input.thesisFormatScore).trim(),
                researchContentScore: String(input.researchContentScore).trim(),
                applicabilityScore: String(input.applicabilityScore).trim(),
                attitudeScore: String(input.attitudeScore).trim(),
                conclusion: isAgreed ? 'AGREED_FOR_DEFENSE' : 'NOT_AGREED_FOR_DEFENSE',
                generalNotes: input.generalNotes ? String(input.generalNotes).trim() : null,
                lecturerSignature: String(input.lecturerSignature).trim(),
                signedAt: now,
                isLocked: true,
                policyVersionId: registration.periodPolicyVersionId,
            },
            update: {
                thesisFormatScore: String(input.thesisFormatScore).trim(),
                researchContentScore: String(input.researchContentScore).trim(),
                applicabilityScore: String(input.applicabilityScore).trim(),
                attitudeScore: String(input.attitudeScore).trim(),
                conclusion: isAgreed ? 'AGREED_FOR_DEFENSE' : 'NOT_AGREED_FOR_DEFENSE',
                generalNotes: input.generalNotes ? String(input.generalNotes).trim() : null,
                lecturerSignature: String(input.lecturerSignature).trim(),
                signedAt: now,
                isLocked: true,
                policyVersionId: registration.periodPolicyVersionId,
            },
        });

        // Cập nhật trạng thái qua transition service tăng stateVersion nguyên tử (CAS)
        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: registration.status,
            expectedStateVersion: registration.stateVersion ?? 0,
            targetStatus,
            actorId: input.actorId,
            reason: isAgreed
                ? 'GVHD ký khóa BM04 ĐỒNG Ý cho ra bảo vệ'
                : 'GVHD ký khóa BM04 KHÔNG ĐỒNG Ý cho ra bảo vệ (dừng đồ án)',
            idempotencyKey: `${key}:transition`,
        }, { tx });

        // Cập nhật task BM04 nếu có
        if (tx.task?.updateMany) {
            await tx.task.updateMany({
                where: { registrationId: registration.id, taskType: 'BM04' },
                data: { status: 'COMPLETED' },
            });
        }

        // Ghi nhận audit log trong transaction nếu tx.auditLog có sẵn
        if (tx.auditLog?.create) {
            await tx.auditLog.create({
                data: {
                    userId: input.actorId,
                    action: 'SUBMIT_BM04_EVALUATION',
                    entityType: 'BM04Evaluation',
                    entityId: String(evaluation.id),
                    details: { registrationId: registration.id, conclusion: evaluation.conclusion, isLocked: true },
                },
            });
        }

        const response = {
            ...evaluation,
            id: evaluation.id,
            evaluationId: evaluation.id,
            registrationId: registration.id,
            conclusion: evaluation.conclusion,
            isLocked: evaluation.isLocked,
            signedAt: evaluation.signedAt,
            targetStatus,
            transitionResult,
        };

        await saveReceipt(tx, {
            scope: BM04_SUBMIT_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

module.exports = {
    BM04_SUBMIT_SCOPE,
    submitBM04,
};
