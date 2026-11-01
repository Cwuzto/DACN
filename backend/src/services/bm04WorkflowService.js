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
 * GVHD lập và ký khóa phiếu nhận xét BM04
 */
async function submitBM04(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('bm04-submit', input.idempotencyKey);
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
        if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);

        if (registration.topic?.mentorId !== input.actorId) {
            throw new WorkflowTransitionError('ONLY_CURRENT_MENTOR_ALLOWED', 403);
        }

        if (registration.bm04Evaluation && registration.bm04Evaluation.isLocked) {
            throw new WorkflowTransitionError('BM04_ALREADY_LOCKED', 400);
        }

        if (registration.status !== 'BM03_PASSED' && registration.status !== 'BM04_REVIEW') {
            throw new WorkflowTransitionError('INVALID_TRANSITION', 409);
        }

        if (!['AGREED_FOR_DEFENSE', 'NOT_AGREED_FOR_DEFENSE'].includes(input.conclusion)) {
            throw new WorkflowTransitionError('INVALID_BM04_CONCLUSION', 400);
        }

        if (!input.thesisFormatScore || !input.researchContentScore || !input.applicabilityScore || !input.attitudeScore) {
            throw new WorkflowTransitionError('MISSING_CRITERIA_FEEDBACK', 400);
        }

        if (!input.lecturerSignature || !String(input.lecturerSignature).trim()) {
            throw new WorkflowTransitionError('LECTURER_SIGNATURE_REQUIRED', 400);
        }

        const isAgreed = input.conclusion === 'AGREED_FOR_DEFENSE';

        if (isAgreed) {
            // Yêu cầu nộp lưu chiểu trước bảo vệ đầy đủ: PDF + source repo + (slide hoặc video) (INV-03)
            const preDefenseArchiveComplete = Boolean(
                registration.archive?.reportFileUrl
                && registration.archive?.sourceCodeUrl
                && (registration.archive?.slideFileUrl || registration.archive?.demoVideoUrl),
            );
            if (!preDefenseArchiveComplete) {
                throw new WorkflowTransitionError('PRE_DEFENSE_ARCHIVE_INCOMPLETE', 409);
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

        // Cập nhật trạng thái qua transition service
        const transitionResult = await transitionRegistration({
            registrationId: registration.id,
            expectedStatus: registration.status,
            expectedStateVersion: registration.stateVersion,
            targetStatus,
            actorId: input.actorId,
            reason: isAgreed
                ? 'GVHD ký khóa BM04 ĐỒNG Ý cho ra bảo vệ'
                : 'GVHD ký khóa BM04 KHÔNG ĐỒNG Ý cho ra bảo vệ (dừng đồ án)',
            idempotencyKey: `${key}:transition`,
        }, { tx });

        // Cập nhật task BM04 nếu có
        await tx.task.updateMany({
            where: { registrationId: registration.id, taskType: 'BM04' },
            data: { status: 'COMPLETED' },
        });

        const response = {
            evaluationId: evaluation.id,
            conclusion: evaluation.conclusion,
            isLocked: evaluation.isLocked,
            signedAt: evaluation.signedAt,
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
