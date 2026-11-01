const crypto = require('crypto');
const prisma = require('../config/database');
const { WorkflowTransitionError } = require('./registrationTransitionService');

const TRANSFER_SCOPE = 'mentor-transfer-command';

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

const TERMINAL_STATUSES = [
    'TERMINATED_BM01',
    'TERMINATED_BM02',
    'TERMINATED_FAILED_PROGRESS',
    'TERMINATED_BM04',
    'DEFENSE_FAILED',
    'DROPPED',
    'WITHDRAWN',
    'COMPLETED',
];

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
 * Thực hiện chuyển giao GVHD hướng dẫn cho một đề tài đang thực hiện
 */
async function transferMentor(input, options = {}) {
    const db = options.db || prisma;
    const now = options.now || new Date();
    const key = requireCommandKey('mentor-transfer', input.idempotencyKey);
    const commandHash = fingerprint({
        registrationId: input.registrationId,
        newMentorId: input.newMentorId,
        reason: input.reason,
        actorId: input.actorId,
    });

    return await db.$transaction(async (tx) => {
        const retry = await findReceipt(tx, TRANSFER_SCOPE, key, commandHash);
        if (retry) return retry;

        const registration = await tx.topicRegistration.findUnique({
            where: { id: input.registrationId },
            include: {
                topic: true,
                bm04Evaluation: true,
            },
        });
        if (!registration) throw new WorkflowTransitionError('REGISTRATION_NOT_FOUND', 404);

        if (TERMINAL_STATUSES.includes(registration.status)) {
            throw new WorkflowTransitionError('CANNOT_TRANSFER_TERMINAL_REGISTRATION', 409);
        }

        // BM04 đã ký khóa thì không được chuyển GVHD nữa
        if (registration.bm04Evaluation && registration.bm04Evaluation.isLocked) {
            throw new WorkflowTransitionError('BM04_ALREADY_LOCKED_CANNOT_TRANSFER', 409);
        }

        const newMentorId = parseInt(input.newMentorId, 10);
        if (!Number.isInteger(newMentorId) || newMentorId <= 0) {
            throw new WorkflowTransitionError('INVALID_NEW_MENTOR_ID', 400);
        }

        const previousMentorId = registration.topic.mentorId;
        if (newMentorId === previousMentorId) {
            throw new WorkflowTransitionError('NEW_MENTOR_SAME_AS_CURRENT', 400);
        }

        const newMentor = await tx.user.findUnique({
            where: { id: newMentorId },
            select: { id: true, fullName: true, role: true, isActive: true },
        });
        if (!newMentor || newMentor.role !== 'LECTURER' || !newMentor.isActive) {
            throw new WorkflowTransitionError('INVALID_NEW_MENTOR_USER', 400);
        }

        if (!input.reason || !String(input.reason).trim()) {
            throw new WorkflowTransitionError('TRANSFER_REASON_REQUIRED', 400);
        }

        // Kiểm tra Quota của GVHD mới trong học kỳ này (tối đa 10 SV)
        const activeRegistrationsCount = await tx.topicRegistration.count({
            where: {
                semesterId: registration.semesterId,
                status: { notIn: ['DROPPED', 'WITHDRAWN', 'REJECTED', 'TERMINATED_BM01', 'TERMINATED_BM02', 'TERMINATED_FAILED_PROGRESS', 'TERMINATED_BM04'] },
                topic: { mentorId: newMentorId },
            },
        });
        if (activeRegistrationsCount >= 10) {
            throw new WorkflowTransitionError('NEW_MENTOR_QUOTA_EXCEEDED', 409);
        }

        // Tạo bản ghi MentorTransfer
        const transferRecord = await tx.mentorTransfer.create({
            data: {
                registrationId: registration.id,
                previousMentorId,
                newMentorId,
                reason: String(input.reason).trim(),
                effectiveAt: now,
                approvedById: input.actorId,
                idempotencyKey: key,
            },
        });

        // Cập nhật mentorId trên Topic
        await tx.topic.update({
            where: { id: registration.topicId },
            data: { mentorId: newMentorId },
        });

        const response = {
            transferId: transferRecord.id,
            registrationId: registration.id,
            previousMentorId,
            newMentorId,
            effectiveAt: transferRecord.effectiveAt,
        };

        await saveReceipt(tx, {
            scope: TRANSFER_SCOPE,
            key,
            hash: commandHash,
            registrationId: registration.id,
            response,
        });

        return response;
    });
}

module.exports = {
    TRANSFER_SCOPE,
    transferMentor,
};
