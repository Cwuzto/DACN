const crypto = require('crypto');
const prisma = require('../config/database');
const { WorkflowTransitionError } = require('./registrationTransitionService');
const { computeCanonicalPayloadHash, recordSignatureEvent } = require('./electronicSignatureService');
const { validateAcademicScope, isDepartmentUnderInstitute } = require('./academicScopeService');
const { resolveUserCapabilities, getEffectivePermissions } = require('../auth/capabilityResolver');

const ENTITY_TYPE = 'BM02_SUBMISSION';
const SIGNER_ROLES = Object.freeze({
    STUDENT: 'STUDENT',
    ADVISOR: 'ADVISOR',
    DEPARTMENT: 'DEPARTMENT_HEAD',
});

const ADVISOR_SIGN_SCOPE = 'bm02-advisor-sign-command';
const DEPARTMENT_SIGN_SCOPE = 'bm02-department-sign-command';

const VIEW_CAPABILITIES = [
    'BM02_DEPARTMENT_SIGN',
    'BM02_REVIEW',
    'VIEW_BM02_REVIEWS',
    'TOPIC_ASSIGNMENT_DECISION_ISSUE',
    'PROJECT_ASSIGNMENT_PUBLISH',
    'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
    'VIEW_ASSIGNMENT_DECISIONS',
];

function requireIdempotencyKey(prefix, key) {
    if (!key || typeof key !== 'string' || key.trim().length < 8) {
        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Thiếu Idempotency-Key hợp lệ.');
    }
    return `${prefix}:${key.trim()}`;
}

function hashCommand(value) {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function jsonValue(value) {
    return JSON.parse(JSON.stringify(value));
}

function getBM02Payload(submission) {
    return {
        registrationId: Number(submission?.registrationId || 0),
        versionNo: Number(submission?.versionNo || 1),
        bm01ApprovedTitle: String(submission?.bm01ApprovedTitle || '').trim(),
        bm02ProposedTitle: String(submission?.bm02ProposedTitle || '').trim(),
        titleChangeReason: String(submission?.titleChangeReason || '').trim(),
        content: String(submission?.content || '').trim(),
    };
}

function computeBM02PayloadHash(submission) {
    return computeCanonicalPayloadHash(getBM02Payload(submission));
}

function getRegistrationScope(registration) {
    const semesterId = registration?.semesterId || registration?.topic?.semesterId || null;
    const department = registration?.topic?.mentor?.department || registration?.topic?.proposedBy?.department || null;
    return { semesterId, department };
}

async function recordStudentBM02Signature(tx, { submission, studentId, ipAddress = null, userAgent = null }) {
    const payloadHash = submission.payloadHash || computeBM02PayloadHash(submission);
    const sigEvent = await recordSignatureEvent({
        registrationId: submission.registrationId,
        entityType: ENTITY_TYPE,
        entityId: submission.id,
        versionNumber: submission.versionNo,
        signerId: studentId,
        signerRole: SIGNER_ROLES.STUDENT,
        action: 'SIGN',
        expectedPayloadHash: payloadHash,
        actualPayload: getBM02Payload(submission),
        ipAddress,
        userAgent,
    }, { tx });

    return { payloadHash, sigEvent };
}

function buildStepVerification(event, expectedEventId, {
    submission,
    expectedPayloadHash,
    expectedSignerId = null,
    expectedRole,
    hashMatchesSubmission,
}) {
    if (!submission.payloadHash || !expectedEventId || !event) {
        return {
            signed: Boolean(event),
            valid: false,
            status: 'NOT_SIGNED',
            eventId: expectedEventId || null,
            signer: event?.signer ? { id: event.signer.id, fullName: event.signer.fullName, code: event.signer.code } : null,
            signedAt: event?.signedAt || null,
            versionNumber: event?.versionNumber || null,
            payloadHash: event?.payloadHash || null,
        };
    }

    const valid = Boolean(
        hashMatchesSubmission
        && event.id === expectedEventId
        && event.entityType === ENTITY_TYPE
        && event.entityId === submission.id
        && event.versionNumber === submission.versionNo
        && event.registrationId === submission.registrationId
        && event.signerRole === expectedRole
        && event.action === 'SIGN'
        && event.payloadHash === expectedPayloadHash
        && (!expectedSignerId || event.signerId === expectedSignerId),
    );

    return {
        signed: true,
        valid,
        status: valid ? 'VERIFIED_INTERNAL' : 'INVALID',
        eventId: event.id,
        signer: event.signer
            ? { id: event.signer.id, fullName: event.signer.fullName, code: event.signer.code }
            : { id: event.signerId },
        signedAt: event.signedAt || null,
        versionNumber: event.versionNumber,
        payloadHash: event.payloadHash,
    };
}

async function verifyBM02SignatureChain(tx, submission, registration = null) {
    const isHistorical = !submission?.payloadHash && !submission?.studentSignatureEventId;
    const computedHash = computeBM02PayloadHash(submission);
    const expectedHash = submission?.payloadHash || null;
    const hashMatchesSubmission = Boolean(expectedHash && expectedHash === computedHash);

    const events = (!isHistorical && typeof tx?.electronicSignatureEvent?.findMany === 'function')
        ? await tx.electronicSignatureEvent.findMany({
            where: {
                entityType: ENTITY_TYPE,
                entityId: submission.id,
                versionNumber: submission.versionNo,
            },
            include: {
                signer: {
                    select: { id: true, fullName: true, code: true },
                },
            },
        })
        : [];

    const eventById = new Map((events || []).map((ev) => [ev.id, ev]));

    const studentEvent = submission?.studentSignatureEventId
        ? eventById.get(submission.studentSignatureEventId) || null
        : null;
    const advisorEvent = submission?.advisorSignatureEventId
        ? eventById.get(submission.advisorSignatureEventId) || null
        : null;
    const departmentEvent = submission?.departmentSignatureEventId
        ? eventById.get(submission.departmentSignatureEventId) || null
        : null;

    const student = buildStepVerification(studentEvent, submission?.studentSignatureEventId, {
        submission,
        expectedPayloadHash: expectedHash,
        expectedSignerId: registration?.studentId || submission?.submittedById || null,
        expectedRole: SIGNER_ROLES.STUDENT,
        hashMatchesSubmission,
    });

    const advisor = buildStepVerification(advisorEvent, submission?.advisorSignatureEventId, {
        submission,
        expectedPayloadHash: expectedHash,
        expectedSignerId: registration?.topic?.mentorId || null,
        expectedRole: SIGNER_ROLES.ADVISOR,
        hashMatchesSubmission,
    });

    const department = buildStepVerification(departmentEvent, submission?.departmentSignatureEventId, {
        submission,
        expectedPayloadHash: expectedHash,
        expectedSignerId: null,
        expectedRole: SIGNER_ROLES.DEPARTMENT,
        hashMatchesSubmission,
    });

    const allValid = Boolean(!isHistorical && student.valid && advisor.valid && department.valid);

    return {
        submissionId: submission.id,
        registrationId: submission.registrationId,
        versionNo: submission.versionNo,
        payloadHash: expectedHash,
        isHistorical,
        allValid,
        student,
        advisor,
        department,
    };
}

async function loadSubmissionWithContext(tx, submissionId) {
    const id = Number(submissionId);
    if (!Number.isInteger(id) || id <= 0) {
        throw new WorkflowTransitionError('INVALID_SUBMISSION_ID', 400, 'ID hồ sơ BM02 không hợp lệ.');
    }

    const submission = await tx.bM02Submission.findUnique({
        where: { id },
        include: {
            registration: {
                include: {
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, department: true } },
                            proposedBy: { select: { id: true, department: true } },
                        },
                    },
                },
            },
        },
    });

    if (!submission) {
        throw new WorkflowTransitionError('BM02_SUBMISSION_NOT_FOUND', 404, 'Không tìm thấy phiên bản BM02.');
    }

    return submission;
}

function assertCurrentPendingSubmission(submission, actionLabel) {
    const reg = submission.registration;
    if (reg?.currentBM02SubmissionId && reg.currentBM02SubmissionId !== submission.id) {
        throw new WorkflowTransitionError('BM02_SUBMISSION_NOT_CURRENT', 409, 'Chỉ được thao tác trên phiên bản BM02 hiện hành.');
    }
    if (submission.outcome !== 'PENDING_REVIEW') {
        throw new WorkflowTransitionError('INVALID_STATUS_FOR_SIGN', 409, `Trạng thái hồ sơ BM02 không hợp lệ để ${actionLabel}.`);
    }
}

function assertPayloadHashMatches(submission, expectedPayloadHash) {
    const currentHash = submission.payloadHash || computeBM02PayloadHash(submission);
    if (!expectedPayloadHash || String(expectedPayloadHash).trim() !== currentHash) {
        throw new WorkflowTransitionError(
            'PAYLOAD_HASH_MISMATCH',
            409,
            'Hash nội dung BM02 không khớp với phiên bản hiện hành. Vui lòng tải lại dữ liệu trước khi ký.',
        );
    }
    return currentHash;
}

async function signBM02Advisor({
    submissionId,
    actorId,
    expectedPayloadHash,
    idempotencyKey,
    ipAddress = null,
    userAgent = null,
}, options = {}) {
    const db = options.db || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const subId = Number(submissionId);
    const actId = Number(actorId);
    const key = requireIdempotencyKey('bm02-adv-sign', idempotencyKey);
    const commandHash = hashCommand({
        submissionId: subId,
        actorId: actId,
        expectedPayloadHash: expectedPayloadHash || null,
    });

    try {
        return await db.$transaction(async (tx) => {
            if (tx.idempotencyRecord) {
                const receipt = await tx.idempotencyRecord.findUnique({
                    where: { scope_key: { scope: ADVISOR_SIGN_SCOPE, key } },
                });
                if (receipt) {
                    if (receipt.commandHash !== commandHash) {
                        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
                    }
                    return { ...receipt.response, idempotent: true };
                }
            }

            const submission = await loadSubmissionWithContext(tx, subId);
            const registration = submission.registration;

            if (registration?.topic?.mentorId !== actId) {
                throw new WorkflowTransitionError(
                    'FORBIDDEN_NOT_ADVISOR',
                    403,
                    'Chỉ giảng viên hướng dẫn của đề tài mới có quyền ký xác nhận BM02.',
                );
            }

            const identity = await resolveUserCapabilities({ userId: actId, at: now, db: tx, bypassCache: true });
            const { semesterId, department } = getRegistrationScope(registration);
            const effective = getEffectivePermissions(identity, { semesterId, department });
            if (!identity || !effective.has('BM02_ADVISOR_SIGN')) {
                throw new WorkflowTransitionError(
                    'FORBIDDEN_BM02_ADVISOR_SIGN',
                    403,
                    'Tài khoản không có quyền BM02_ADVISOR_SIGN.',
                );
            }

            assertCurrentPendingSubmission(submission, 'GVHD ký xác nhận');

            const chain = await verifyBM02SignatureChain(tx, submission, registration);
            if (!chain.student.valid) {
                throw new WorkflowTransitionError(
                    'STUDENT_SIGNATURE_REQUIRED',
                    409,
                    'Sinh viên chưa xác nhận nộp hợp lệ cho phiên bản BM02 này.',
                );
            }
            if (submission.advisorSignatureEventId) {
                throw new WorkflowTransitionError(
                    'ADVISOR_ALREADY_SIGNED',
                    409,
                    'GVHD đã ký xác nhận phiên bản BM02 này.',
                );
            }

            const currentHash = assertPayloadHashMatches(submission, expectedPayloadHash);

            const sigEvent = await recordSignatureEvent({
                registrationId: submission.registrationId,
                entityType: ENTITY_TYPE,
                entityId: submission.id,
                versionNumber: submission.versionNo,
                signerId: actId,
                signerRole: SIGNER_ROLES.ADVISOR,
                action: 'SIGN',
                expectedPayloadHash: currentHash,
                actualPayload: getBM02Payload(submission),
                ipAddress,
                userAgent,
            }, { tx });

            const updatedSubmission = await tx.bM02Submission.update({
                where: { id: submission.id },
                data: { advisorSignatureEventId: sigEvent.id },
            });

            const response = {
                submission: { ...submission, ...updatedSubmission, advisorSignatureEventId: sigEvent.id },
                signatureEvent: sigEvent,
            };

            if (tx.idempotencyRecord) {
                await tx.idempotencyRecord.create({
                    data: {
                        scope: ADVISOR_SIGN_SCOPE,
                        key,
                        commandHash,
                        registrationId: submission.registrationId,
                        response: jsonValue(response),
                    },
                });
            }

            return { ...response, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002' && db.idempotencyRecord) {
            const receipt = await db.idempotencyRecord.findUnique({
                where: { scope_key: { scope: ADVISOR_SIGN_SCOPE, key } },
            });
            if (receipt?.commandHash === commandHash) return { ...receipt.response, idempotent: true };
            throw new WorkflowTransitionError('BM02_CONCURRENT_SIGN', 409);
        }
        throw error;
    }
}

async function signBM02Department({
    submissionId,
    actorId,
    expectedPayloadHash,
    idempotencyKey,
    ipAddress = null,
    userAgent = null,
}, options = {}) {
    const db = options.db || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const subId = Number(submissionId);
    const actId = Number(actorId);
    const key = requireIdempotencyKey('bm02-dept-sign', idempotencyKey);
    const commandHash = hashCommand({
        submissionId: subId,
        actorId: actId,
        expectedPayloadHash: expectedPayloadHash || null,
    });

    try {
        return await db.$transaction(async (tx) => {
            if (tx.idempotencyRecord) {
                const receipt = await tx.idempotencyRecord.findUnique({
                    where: { scope_key: { scope: DEPARTMENT_SIGN_SCOPE, key } },
                });
                if (receipt) {
                    if (receipt.commandHash !== commandHash) {
                        throw new WorkflowTransitionError('IDEMPOTENCY_KEY_REUSED', 409);
                    }
                    return { ...receipt.response, idempotent: true };
                }
            }

            const submission = await loadSubmissionWithContext(tx, subId);
            const registration = submission.registration;

            const identity = await resolveUserCapabilities({ userId: actId, at: now, db: tx, bypassCache: true });
            const { semesterId, department } = getRegistrationScope(registration);
            const effective = getEffectivePermissions(identity, { semesterId, department });

            if (!identity || !effective.has('BM02_DEPARTMENT_SIGN')) {
                throw new WorkflowTransitionError(
                    'FORBIDDEN_BM02_DEPARTMENT_SIGN',
                    403,
                    'Người thực hiện không có quyền ký xác nhận bộ môn (BM02_DEPARTMENT_SIGN) trong phạm vi học kỳ/bộ môn của hồ sơ.',
                );
            }

            if (department) {
                const hasBaseDeptSign = (identity.basePermissions || []).includes('BM02_DEPARTMENT_SIGN');
                const hasDirectDept = Boolean(
                    identity.department
                    && String(identity.department).trim().toUpperCase() === String(department).trim().toUpperCase()
                    && hasBaseDeptSign,
                );
                const hasInstituteScope = Boolean(
                    hasBaseDeptSign
                    && (
                        (identity.department && isDepartmentUnderInstitute(identity.department, department))
                        || (
                            !identity.department
                            && (
                                ['INSTITUTE_DIRECTOR', 'VIEN_TRUONG', 'ADMIN'].includes(identity.role)
                                || (identity.groupCodes || []).includes('VIEN_TRUONG')
                                || (identity.groupCodes || []).includes('INSTITUTE_DIRECTOR')
                            )
                        )
                    ),
                );
                const hasScopedDelegation = (identity.activeDelegations || []).some((d) => {
                    const deptMatch = !d.department
                        || String(d.department).trim().toUpperCase() === String(department).trim().toUpperCase()
                        || isDepartmentUnderInstitute(d.department, department);
                    const semMatch = d.semesterId === null || d.semesterId === undefined || Number(d.semesterId) === Number(semesterId);
                    return d.capabilityCode === 'BM02_DEPARTMENT_SIGN' && deptMatch && semMatch;
                });
                if (!hasDirectDept && !hasInstituteScope && !hasScopedDelegation) {
                    throw new WorkflowTransitionError(
                        'DELEGATION_SCOPE_MISMATCH',
                        403,
                        `Người thực hiện không có thẩm quyền đối với khoa/bộ môn (${department}) của hồ sơ này.`,
                    );
                }
            }

            await validateAcademicScope(tx, {
                actorId: actId,
                registrationId: submission.registrationId,
                capabilityCode: 'BM02_DEPARTMENT_SIGN',
                now,
            });

            assertCurrentPendingSubmission(submission, 'Phụ trách bộ môn ký xác nhận');

            const chain = await verifyBM02SignatureChain(tx, submission, registration);
            if (!chain.student.valid) {
                throw new WorkflowTransitionError(
                    'STUDENT_SIGNATURE_REQUIRED',
                    409,
                    'Sinh viên chưa xác nhận nộp hợp lệ cho phiên bản BM02 này.',
                );
            }
            if (!chain.advisor.valid) {
                throw new WorkflowTransitionError(
                    'ADVISOR_SIGNATURE_REQUIRED',
                    409,
                    'GVHD chưa ký xác nhận phiên bản BM02 này.',
                );
            }
            if (submission.departmentSignatureEventId) {
                throw new WorkflowTransitionError(
                    'DEPARTMENT_ALREADY_SIGNED',
                    409,
                    'Phụ trách bộ môn đã ký xác nhận phiên bản BM02 này.',
                );
            }

            const currentHash = assertPayloadHashMatches(submission, expectedPayloadHash);

            const sigEvent = await recordSignatureEvent({
                registrationId: submission.registrationId,
                entityType: ENTITY_TYPE,
                entityId: submission.id,
                versionNumber: submission.versionNo,
                signerId: actId,
                signerRole: SIGNER_ROLES.DEPARTMENT,
                action: 'SIGN',
                expectedPayloadHash: currentHash,
                actualPayload: getBM02Payload(submission),
                ipAddress,
                userAgent,
            }, { tx });

            const updatedSubmission = await tx.bM02Submission.update({
                where: { id: submission.id },
                data: { departmentSignatureEventId: sigEvent.id },
            });

            const response = {
                submission: { ...submission, ...updatedSubmission, departmentSignatureEventId: sigEvent.id },
                signatureEvent: sigEvent,
            };

            if (tx.idempotencyRecord) {
                await tx.idempotencyRecord.create({
                    data: {
                        scope: DEPARTMENT_SIGN_SCOPE,
                        key,
                        commandHash,
                        registrationId: submission.registrationId,
                        response: jsonValue(response),
                    },
                });
            }

            return { ...response, idempotent: false };
        });
    } catch (error) {
        if (error?.code === 'P2002' && db.idempotencyRecord) {
            const receipt = await db.idempotencyRecord.findUnique({
                where: { scope_key: { scope: DEPARTMENT_SIGN_SCOPE, key } },
            });
            if (receipt?.commandHash === commandHash) return { ...receipt.response, idempotent: true };
            throw new WorkflowTransitionError('BM02_CONCURRENT_SIGN', 409);
        }
        throw error;
    }
}

async function getBM02Verification({ submissionId, actorId }, options = {}) {
    const db = options.db || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const actId = Number(actorId);

    const submission = await loadSubmissionWithContext(db, submissionId);
    const registration = submission.registration;

    const isStudentOwner = registration?.studentId === actId;
    const isAdvisorOwner = registration?.topic?.mentorId === actId;

    if (!isStudentOwner && !isAdvisorOwner) {
        const identity = await resolveUserCapabilities({ userId: actId, at: now, db, bypassCache: true });
        if (!identity) {
            throw new WorkflowTransitionError('FORBIDDEN_VIEW_BM02', 403, 'Bạn không có quyền xem thông tin xác thực BM02 này.');
        }

        const isAdmin = identity.role === 'ADMIN';
        if (!isAdmin) {
            const { semesterId, department } = getRegistrationScope(registration);
            const effective = getEffectivePermissions(identity, { semesterId, department });
            const hasViewCap = VIEW_CAPABILITIES.some((cap) => effective.has(cap));
            if (!hasViewCap) {
                throw new WorkflowTransitionError('FORBIDDEN_VIEW_BM02', 403, 'Bạn không có quyền xem thông tin xác thực BM02 này.');
            }
        }
    }

    return verifyBM02SignatureChain(db, submission, registration);
}

module.exports = {
    ENTITY_TYPE,
    SIGNER_ROLES,
    getBM02Payload,
    computeBM02PayloadHash,
    recordStudentBM02Signature,
    verifyBM02SignatureChain,
    signBM02Advisor,
    signBM02Department,
    getBM02Verification,
};
