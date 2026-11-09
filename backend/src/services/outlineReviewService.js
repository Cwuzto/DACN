const crypto = require('crypto');
const path = require('path');
const prisma = require('../config/database');
const {
    BadRequestError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    UnprocessableEntityError,
} = require('../utils/errors');

/**
 * 1. Submit initial outline dossier (v1)
 * Atomic conditional update ensures only the first valid submission is accepted.
 */
async function submitInitialOutline(registrationId, fileData, userId, options = {}) {
    const db = options.db || prisma;
    const now = options.now ? new Date(options.now) : new Date();
    const regId = Number(registrationId);
    const uId = Number(userId);

    return db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: regId },
            include: { semester: true },
        });

        if (!registration) {
            throw new NotFoundError('REGISTRATION_NOT_FOUND');
        }
        if (registration.studentId !== uId) {
            throw new ForbiddenError('FORBIDDEN');
        }
        if (registration.status !== 'APPROVED') {
            throw new BadRequestError('INVALID_REGISTRATION_STATUS');
        }

        const semester = registration.semester;
        if (semester) {
            if (semester.outlineSubmissionOpenAt && now < new Date(semester.outlineSubmissionOpenAt)) {
                throw new BadRequestError('SUBMISSION_WINDOW_NOT_OPEN');
            }
            if (semester.outlineSubmissionDeadline && now > new Date(semester.outlineSubmissionDeadline)) {
                throw new BadRequestError('SUBMISSION_WINDOW_CLOSED');
            }
        }

        const allowedExtensions = Array.isArray(semester?.outlineAllowedExtensions)
            ? semester.outlineAllowedExtensions
            : ['.docx', '.pdf'];
        const ext = path.extname(fileData?.fileName || '').toLowerCase();
        if (!allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
            throw new BadRequestError('INVALID_FILE_EXTENSION');
        }

        const maxSizeBytes = semester?.outlineMaxFileSizeBytes || 20 * 1024 * 1024;
        if (fileData?.fileSize && fileData.fileSize > maxSizeBytes) {
            throw new BadRequestError('FILE_SIZE_EXCEEDS_LIMIT');
        }

        // Find or create BM01_INITIAL_SUBMISSION task
        let task = await tx.task.findFirst({
            where: { registrationId: regId, taskType: 'BM01_INITIAL_SUBMISSION' },
        });
        if (!task) {
            task = await tx.task.create({
                data: {
                    registrationId: regId,
                    title: 'Nộp đề cương đồ án tốt nghiệp (BM01)',
                    taskType: 'BM01_INITIAL_SUBMISSION',
                    status: 'COMPLETED',
                    dueDate: semester?.outlineSubmissionDeadline || null,
                },
            });
        } else {
            await tx.task.update({
                where: { id: task.id },
                data: { status: 'COMPLETED' },
            });
        }

        // Create submission record
        const newSubmission = await tx.submission.create({
            data: {
                registrationId: regId,
                taskId: task.id,
                submittedBy: uId,
                fileUrl: fileData.fileUrl,
                fileName: fileData.fileName,
                submittedAt: now,
            },
        });

        // Atomic conditional update on BM01Evaluation
        const existingEval = await tx.bM01Evaluation.findFirst({
            where: { registrationId: regId },
        });

        if (!existingEval) {
            await tx.bM01Evaluation.create({
                data: {
                    registrationId: regId,
                    attemptNo: 1,
                    submissionId: newSubmission.id,
                    submittedAt: now,
                    submittedById: uId,
                    policyVersionId: registration.periodPolicyVersionId || 1,
                    councilId: registration.outlineCouncilId || null,
                },
            });
        } else {
            const updated = await tx.bM01Evaluation.updateMany({
                where: {
                    registrationId: regId,
                    submissionId: null,
                },
                data: {
                    submissionId: newSubmission.id,
                    submittedAt: now,
                    submittedById: uId,
                },
            });
            if (updated.count === 0) {
                throw new ConflictError('INITIAL_SUBMISSION_ALREADY_USED');
            }
        }

        // Update TopicRegistration status
        await tx.topicRegistration.update({
            where: { id: regId },
            data: {
                status: 'BM01_SUBMITTED',
                stateVersion: { increment: 1 },
            },
        });

        return newSubmission;
    });
}

/**
 * 2. Publish council defense schedule
 * Requires CHAIRMAN role and validates defense date & mode.
 */
async function publishCouncilSchedule(councilId, scheduleData, chairId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const chId = Number(chairId);

    return db.$transaction(async (tx) => {
        const chairMember = await tx.councilMember.findFirst({
            where: {
                councilId: cId,
                userId: chId,
                role: { in: ['CHAIRMAN', 'CHAIR'] },
            },
        });
        if (!chairMember) {
            throw new ForbiddenError('NOT_COUNCIL_CHAIR');
        }

        const council = await tx.council.findUnique({
            where: { id: cId },
            include: { semester: true },
        });
        if (!council) {
            throw new NotFoundError('COUNCIL_NOT_FOUND');
        }

        const defenseDate = scheduleData.defenseDate ? new Date(scheduleData.defenseDate) : council.defenseDate;
        if (!defenseDate) {
            throw new BadRequestError('DEFENSE_DATE_REQUIRED');
        }

        if (
            council.semester?.outlineSubmissionDeadline &&
            defenseDate <= new Date(council.semester.outlineSubmissionDeadline)
        ) {
            throw new BadRequestError('DEFENSE_DATE_BEFORE_SUBMISSION_DEADLINE');
        }

        const meetingMode = scheduleData.meetingMode || council.meetingMode || 'IN_PERSON';
        const location = scheduleData.location !== undefined ? scheduleData.location : council.location;
        const meetingUrl = scheduleData.meetingUrl !== undefined ? scheduleData.meetingUrl : council.meetingUrl;

        if (meetingMode === 'IN_PERSON') {
            if (!location || typeof location !== 'string' || !location.trim()) {
                throw new BadRequestError('LOCATION_REQUIRED_FOR_IN_PERSON');
            }
        } else if (meetingMode === 'MICROSOFT_TEAMS') {
            if (!meetingUrl || typeof meetingUrl !== 'string' || !meetingUrl.trim().toLowerCase().startsWith('https://')) {
                throw new BadRequestError('INVALID_MEETING_URL');
            }
        }

        const updated = await tx.council.update({
            where: { id: cId },
            data: {
                defenseDate,
                meetingMode,
                location: location ? location.trim() : null,
                meetingUrl: meetingUrl ? meetingUrl.trim() : null,
                schedulePublishedAt: options.now ? new Date(options.now) : new Date(),
            },
        });

        return updated;
    });
}

/**
 * 3. Secretary saves draft evaluation results for a student in a batch
 * Applies strict validation matrix.
 */
async function saveDraftResults(councilId, registrationId, resultData, actorId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const regId = Number(registrationId);
    const aId = Number(actorId);

    const { initialOutcome, attendanceStatus = 'PRESENT', comment, revisionRequirements } = resultData;

    if (!['PASS', 'REVISION_REQUIRED', 'FAIL', 'ABSENT'].includes(initialOutcome)) {
        throw new BadRequestError('INVALID_INITIAL_OUTCOME');
    }
    if (!['PRESENT', 'ABSENT', 'EXCUSED'].includes(attendanceStatus)) {
        throw new BadRequestError('INVALID_ATTENDANCE_STATUS');
    }

    // Validation matrix
    if (initialOutcome === 'ABSENT' && !['ABSENT', 'EXCUSED'].includes(attendanceStatus)) {
        throw new BadRequestError('INVALID_ATTENDANCE_STATUS');
    }
    if (attendanceStatus === 'PRESENT' && initialOutcome === 'ABSENT') {
        throw new BadRequestError('OUTCOME_ATTENDANCE_MISMATCH');
    }
    if (initialOutcome === 'REVISION_REQUIRED') {
        if (!revisionRequirements || typeof revisionRequirements !== 'string' || !revisionRequirements.trim()) {
            throw new BadRequestError('REVISION_REQUIREMENTS_REQUIRED');
        }
    }
    if (initialOutcome === 'FAIL') {
        if (!comment || typeof comment !== 'string' || !comment.trim()) {
            throw new BadRequestError('FAIL_COMMENT_REQUIRED');
        }
    }

    return db.$transaction(async (tx) => {
        const member = await tx.councilMember.findFirst({
            where: {
                councilId: cId,
                userId: aId,
                role: { in: ['SECRETARY', 'CHAIRMAN', 'CHAIR'] },
            },
        });
        if (!member) {
            throw new ForbiddenError('UNAUTHORIZED_COUNCIL_ROLE');
        }

        const registration = await tx.topicRegistration.findUnique({
            where: { id: regId },
        });
        if (!registration) {
            throw new NotFoundError('REGISTRATION_NOT_FOUND');
        }

        let currentBatch = await tx.councilResultBatch.findFirst({
            where: { councilId: cId },
            orderBy: { versionNumber: 'desc' },
        });

        if (!currentBatch) {
            currentBatch = await tx.councilResultBatch.create({
                data: {
                    councilId: cId,
                    versionNumber: 1,
                    status: 'DRAFT',
                },
            });
        } else if (!['DRAFT', 'REOPENED'].includes(currentBatch.status)) {
            throw new ConflictError('BATCH_NOT_EDITABLE');
        }

        let evaluation = await tx.bM01Evaluation.findFirst({
            where: {
                batchId: currentBatch.id,
                registrationId: regId,
            },
        });

        if (evaluation) {
            evaluation = await tx.bM01Evaluation.update({
                where: { id: evaluation.id },
                data: {
                    initialOutcome,
                    attendanceStatus,
                    comment: comment ? comment.trim() : null,
                    revisionRequirements: revisionRequirements ? revisionRequirements.trim() : null,
                    reviewedById: aId,
                    reviewedAt: options.now ? new Date(options.now) : new Date(),
                },
            });
        } else {
            const latestOverall = await tx.bM01Evaluation.findFirst({
                where: { registrationId: regId },
                orderBy: { attemptNo: 'desc' },
            });
            const attemptNo = latestOverall ? latestOverall.attemptNo + 1 : 1;

            evaluation = await tx.bM01Evaluation.create({
                data: {
                    registrationId: regId,
                    attemptNo,
                    councilId: cId,
                    batchId: currentBatch.id,
                    policyVersionId: registration.periodPolicyVersionId || 1,
                    initialOutcome,
                    attendanceStatus,
                    comment: comment ? comment.trim() : null,
                    revisionRequirements: revisionRequirements ? revisionRequirements.trim() : null,
                    reviewedById: aId,
                    reviewedAt: options.now ? new Date(options.now) : new Date(),
                },
            });
        }

        return evaluation;
    });
}

/**
 * 4. Secretary completes evaluation review and submits to Chair
 */
async function completeSecretaryReview(councilId, actorId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const aId = Number(actorId);

    return db.$transaction(async (tx) => {
        const member = await tx.councilMember.findFirst({
            where: {
                councilId: cId,
                userId: aId,
                role: { in: ['SECRETARY', 'CHAIRMAN', 'CHAIR'] },
            },
        });
        if (!member) {
            throw new ForbiddenError('UNAUTHORIZED_COUNCIL_ROLE');
        }

        const currentBatch = await tx.councilResultBatch.findFirst({
            where: { councilId: cId },
            orderBy: { versionNumber: 'desc' },
        });
        if (!currentBatch || !['DRAFT', 'REOPENED'].includes(currentBatch.status)) {
            throw new ConflictError('BATCH_NOT_EDITABLE');
        }

        const assignedCount = await tx.topicRegistration.count({
            where: { outlineCouncilId: cId },
        });

        const evaluatedCount = await tx.bM01Evaluation.count({
            where: {
                batchId: currentBatch.id,
                initialOutcome: { not: null },
            },
        });

        if (evaluatedCount < assignedCount || assignedCount === 0) {
            throw new BadRequestError('INCOMPLETE_SECRETARY_EVALUATIONS');
        }

        const updatedBatch = await tx.councilResultBatch.update({
            where: { id: currentBatch.id },
            data: {
                status: 'PENDING_CHAIR',
                secretaryCompletedAt: options.now ? new Date(options.now) : new Date(),
                secretaryCompletedById: aId,
            },
        });

        return updatedBatch;
    });
}

/**
 * 5. Chair returns results to Secretary with reason
 */
async function returnResultsToSecretary(councilId, returnReason, chairId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const chId = Number(chairId);

    if (!returnReason || typeof returnReason !== 'string' || !returnReason.trim()) {
        throw new BadRequestError('RETURN_REASON_REQUIRED');
    }

    return db.$transaction(async (tx) => {
        const member = await tx.councilMember.findFirst({
            where: {
                councilId: cId,
                userId: chId,
                role: { in: ['CHAIRMAN', 'CHAIR'] },
            },
        });
        if (!member) {
            throw new ForbiddenError('NOT_COUNCIL_CHAIR');
        }

        const currentBatch = await tx.councilResultBatch.findFirst({
            where: { councilId: cId },
            orderBy: { versionNumber: 'desc' },
        });
        if (!currentBatch || currentBatch.status !== 'PENDING_CHAIR') {
            throw new ConflictError('BATCH_NOT_PENDING_CHAIR');
        }

        const updatedBatch = await tx.councilResultBatch.update({
            where: { id: currentBatch.id },
            data: {
                status: 'DRAFT',
                returnedAt: options.now ? new Date(options.now) : new Date(),
                returnedById: chId,
                returnReason: returnReason.trim(),
            },
        });

        return updatedBatch;
    });
}

/**
 * 6. Chair publishes council results
 * PASS -> BM01_PASSED + BM02 Task
 * REVISION_REQUIRED / FAIL / ABSENT -> BM01_NEEDS_REVISION
 */
async function publishCouncilResults(councilId, chairId, idempotencyKey, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const chId = Number(chairId);
    const scope = 'councils:publish';
    const commandPayload = { councilId: cId, chairId: chId };
    const cmdHash = crypto.createHash('sha256').update(JSON.stringify(commandPayload)).digest('hex');

    return db.$transaction(async (tx) => {
        const member = await tx.councilMember.findFirst({
            where: {
                councilId: cId,
                userId: chId,
                role: { in: ['CHAIRMAN', 'CHAIR'] },
            },
        });
        if (!member) {
            throw new ForbiddenError('NOT_COUNCIL_CHAIR');
        }

        if (idempotencyKey) {
            const existingKey = await tx.idempotencyRecord.findUnique({
                where: { scope_key: { scope, key: idempotencyKey } },
            });
            if (existingKey) {
                if (existingKey.commandHash !== cmdHash) {
                    throw new UnprocessableEntityError('IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH');
                }
                return existingKey.response;
            }
        }

        const currentBatch = await tx.councilResultBatch.findFirst({
            where: { councilId: cId },
            orderBy: { versionNumber: 'desc' },
        });
        if (!currentBatch || currentBatch.status !== 'PENDING_CHAIR') {
            throw new ConflictError('BATCH_NOT_PENDING_CHAIR');
        }

        const updatedBatch = await tx.councilResultBatch.update({
            where: { id: currentBatch.id },
            data: {
                status: 'PUBLISHED',
                chairPublishedAt: options.now ? new Date(options.now) : new Date(),
                chairPublishedById: chId,
            },
        });

        const evaluations = await tx.bM01Evaluation.findMany({
            where: { batchId: currentBatch.id },
        });

        for (const evaluation of evaluations) {
            if (evaluation.initialOutcome === 'PASS') {
                await tx.bM01Evaluation.update({
                    where: { id: evaluation.id },
                    data: {
                        outcome: 'PASSED',
                        revisionApprovalStatus: 'NOT_REQUIRED',
                    },
                });
                await tx.topicRegistration.update({
                    where: { id: evaluation.registrationId },
                    data: {
                        status: 'BM01_PASSED',
                        stateVersion: { increment: 1 },
                    },
                });
                // Create BM02 task
                await tx.task.create({
                    data: {
                        registrationId: evaluation.registrationId,
                        title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
                        taskType: 'BM02',
                        status: 'OPEN',
                    },
                });
            } else {
                await tx.bM01Evaluation.update({
                    where: { id: evaluation.id },
                    data: {
                        outcome: 'NEEDS_REVISION',
                        revisionApprovalStatus: 'PENDING',
                    },
                });
                await tx.topicRegistration.update({
                    where: { id: evaluation.registrationId },
                    data: {
                        status: 'BM01_NEEDS_REVISION',
                        stateVersion: { increment: 1 },
                    },
                });
            }
        }

        if (idempotencyKey) {
            await tx.idempotencyRecord.create({
                data: {
                    scope,
                    key: idempotencyKey,
                    commandHash: cmdHash,
                    response: updatedBatch,
                },
            });
        }

        return updatedBatch;
    });
}

/**
 * 7. Set revision deadline for council and activate BM01_RESUBMISSION task
 */
async function setRevisionDeadline(councilId, deadline, chairId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const chId = Number(chairId);
    const dl = new Date(deadline);
    const now = options.now ? new Date(options.now) : new Date();

    if (isNaN(dl.getTime()) || dl <= now) {
        throw new BadRequestError('INVALID_DEADLINE');
    }

    return db.$transaction(async (tx) => {
        const member = await tx.councilMember.findFirst({
            where: {
                councilId: cId,
                userId: chId,
                role: { in: ['CHAIRMAN', 'CHAIR'] },
            },
        });
        if (!member) {
            throw new ForbiddenError('NOT_COUNCIL_CHAIR');
        }

        const updatedCouncil = await tx.council.update({
            where: { id: cId },
            data: { revisionSubmissionDeadline: dl },
        });

        const students = await tx.topicRegistration.findMany({
            where: {
                outlineCouncilId: cId,
                status: 'BM01_NEEDS_REVISION',
            },
        });

        for (const reg of students) {
            const existingTask = await tx.task.findFirst({
                where: {
                    registrationId: reg.id,
                    taskType: 'BM01_RESUBMISSION',
                },
            });
            if (existingTask) {
                await tx.task.update({
                    where: { id: existingTask.id },
                    data: {
                        dueDate: dl,
                        status: 'OPEN',
                    },
                });
            } else {
                await tx.task.create({
                    data: {
                        registrationId: reg.id,
                        title: 'Nộp lại đề cương đồ án tốt nghiệp (BM01)',
                        taskType: 'BM01_RESUBMISSION',
                        dueDate: dl,
                        status: 'OPEN',
                    },
                });
            }
        }

        return updatedCouncil;
    });
}

/**
 * 8. Submit resubmission outline (v2)
 * Atomic conditional update ensures only 1 resubmission is permitted.
 */
async function submitResubmissionOutline(registrationId, fileData, userId, options = {}) {
    const db = options.db || prisma;
    const regId = Number(registrationId);
    const uId = Number(userId);
    const now = options.now ? new Date(options.now) : new Date();

    return db.$transaction(async (tx) => {
        const registration = await tx.topicRegistration.findUnique({
            where: { id: regId },
            include: { outlineCouncil: true },
        });

        if (!registration) {
            throw new NotFoundError('REGISTRATION_NOT_FOUND');
        }
        if (registration.studentId !== uId) {
            throw new ForbiddenError('FORBIDDEN');
        }
        if (registration.status !== 'BM01_NEEDS_REVISION') {
            throw new BadRequestError('INVALID_REGISTRATION_STATUS');
        }

        const deadline = registration.outlineCouncil?.revisionSubmissionDeadline;
        if (!deadline || now > new Date(deadline)) {
            throw new BadRequestError('RESUBMISSION_DEADLINE_PASSED');
        }

        let task = await tx.task.findFirst({
            where: {
                registrationId: regId,
                taskType: 'BM01_RESUBMISSION',
            },
        });
        if (!task) {
            task = await tx.task.create({
                data: {
                    registrationId: regId,
                    title: 'Nộp lại đề cương đồ án tốt nghiệp (BM01)',
                    taskType: 'BM01_RESUBMISSION',
                    status: 'COMPLETED',
                },
            });
        } else {
            await tx.task.update({
                where: { id: task.id },
                data: { status: 'COMPLETED' },
            });
        }

        const newSubmission = await tx.submission.create({
            data: {
                registrationId: regId,
                taskId: task.id,
                submittedBy: uId,
                fileUrl: fileData?.fileUrl,
                fileName: fileData?.fileName,
                submittedAt: now,
            },
        });

        // Atomic conditional update on BM01Evaluation
        const updated = await tx.bM01Evaluation.updateMany({
            where: {
                registrationId: regId,
                revisionSubmissionId: null,
            },
            data: {
                revisionSubmissionId: newSubmission.id,
            },
        });
        if (updated.count === 0) {
            throw new ConflictError('RESUBMISSION_ALREADY_USED');
        }

        await tx.topicRegistration.update({
            where: { id: regId },
            data: {
                status: 'BM01_RESUBMITTED',
                stateVersion: { increment: 1 },
            },
        });

        return newSubmission;
    });
}

/**
 * 9. Chair reviews resubmitted outline (APPROVE -> BM01_PASSED, REJECT -> TERMINATED_BM01)
 */
async function reviewResubmission(councilId, registrationId, decision, revisionFeedback, chairId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const regId = Number(registrationId);
    const chId = Number(chairId);
    const now = options.now ? new Date(options.now) : new Date();

    if (!['APPROVE', 'REJECT'].includes(decision)) {
        throw new BadRequestError('INVALID_DECISION');
    }

    return db.$transaction(async (tx) => {
        const member = await tx.councilMember.findFirst({
            where: {
                councilId: cId,
                userId: chId,
                role: { in: ['CHAIRMAN', 'CHAIR'] },
            },
        });
        if (!member) {
            throw new ForbiddenError('NOT_COUNCIL_CHAIR');
        }

        const registration = await tx.topicRegistration.findUnique({
            where: { id: regId },
        });
        if (!registration || registration.outlineCouncilId !== cId || registration.status !== 'BM01_RESUBMITTED') {
            throw new BadRequestError('INVALID_REGISTRATION_STATUS');
        }

        const evaluation = await tx.bM01Evaluation.findFirst({
            where: { registrationId: regId },
            orderBy: { attemptNo: 'desc' },
        });
        if (!evaluation) {
            throw new NotFoundError('EVALUATION_NOT_FOUND');
        }

        if (decision === 'APPROVE') {
            await tx.bM01Evaluation.update({
                where: { id: evaluation.id },
                data: {
                    revisionApprovalStatus: 'APPROVED',
                    outcome: 'PASSED',
                    revisionFeedback: revisionFeedback ? revisionFeedback.trim() : null,
                    revisionReviewedAt: now,
                    revisionReviewedById: chId,
                },
            });

            const updatedReg = await tx.topicRegistration.update({
                where: { id: regId },
                data: {
                    status: 'BM01_PASSED',
                    stateVersion: { increment: 1 },
                },
            });

            await tx.task.create({
                data: {
                    registrationId: regId,
                    title: 'Nộp đơn đăng ký đề tài chính thức (BM02)',
                    taskType: 'BM02',
                    status: 'OPEN',
                },
            });

            return updatedReg;
        }

        // Decision REJECT
        if (!revisionFeedback || typeof revisionFeedback !== 'string' || !revisionFeedback.trim()) {
            throw new BadRequestError('REVISION_FEEDBACK_REQUIRED');
        }

        await tx.bM01Evaluation.update({
            where: { id: evaluation.id },
            data: {
                revisionApprovalStatus: 'REJECTED',
                outcome: 'TERMINATED',
                revisionFeedback: revisionFeedback.trim(),
                revisionReviewedAt: now,
                revisionReviewedById: chId,
            },
        });

        const updatedReg = await tx.topicRegistration.update({
            where: { id: regId },
            data: {
                status: 'TERMINATED_BM01',
                stateVersion: { increment: 1 },
            },
        });

        return updatedReg;
    });
}

/**
 * 10. Reopen council results
 * Guards against reopen when any student has downstream BM02 submissions/progress.
 * Creates an append-only snapshot with new batch version.
 */
async function reopenCouncilResults(councilId, reason, adminId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const admId = Number(adminId);
    const now = options.now ? new Date(options.now) : new Date();

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
        throw new BadRequestError('REOPEN_REASON_REQUIRED');
    }

    return db.$transaction(async (tx) => {
        const currentBatch = await tx.councilResultBatch.findFirst({
            where: { councilId: cId },
            orderBy: { versionNumber: 'desc' },
        });
        if (!currentBatch || currentBatch.status !== 'PUBLISHED') {
            throw new ConflictError('BATCH_NOT_PUBLISHED');
        }

        const registrations = await tx.topicRegistration.findMany({
            where: { outlineCouncilId: cId },
            include: {
                student: { select: { fullName: true } },
                bm02Submissions: true,
            },
        });

        const blockingRegistrations = [];
        const bm02Statuses = [
            'BM02_SUBMITTED',
            'BM02_NEEDS_REVISION',
            'BM02_RESUBMITTED',
            'BM02_APPROVED',
            'DECISION_ISSUED',
            'IN_PROGRESS',
        ];

        for (const reg of registrations) {
            const hasSubmissions = Array.isArray(reg.bm02Submissions) && reg.bm02Submissions.length > 0;
            const isStatusBM02 = bm02Statuses.includes(reg.status);
            if (hasSubmissions || isStatusBM02) {
                blockingRegistrations.push({
                    registrationId: reg.id,
                    studentName: reg.student?.fullName || 'Sinh viên',
                    bm02Status: reg.status,
                });
            }
        }

        if (blockingRegistrations.length > 0) {
            throw new ConflictError('BM02_DEPENDENCY_EXISTS', { blockingRegistrations });
        }

        // Supersede previous batch
        await tx.councilResultBatch.update({
            where: { id: currentBatch.id },
            data: { status: 'SUPERSEDED' },
        });

        // Create new batch with version + 1
        const newBatch = await tx.councilResultBatch.create({
            data: {
                councilId: cId,
                versionNumber: currentBatch.versionNumber + 1,
                status: 'REOPENED',
                reopenedAt: now,
                reopenedById: admId,
                reopenReason: reason.trim(),
            },
        });

        // Clone evaluations to new batch
        const oldEvaluations = await tx.bM01Evaluation.findMany({
            where: { batchId: currentBatch.id },
        });

        for (const prev of oldEvaluations) {
            await tx.bM01Evaluation.create({
                data: {
                    registrationId: prev.registrationId,
                    attemptNo: prev.attemptNo + 1,
                    supersedesId: prev.id,
                    batchId: newBatch.id,
                    councilId: prev.councilId || cId,
                    policyVersionId: prev.policyVersionId,
                    initialOutcome: prev.initialOutcome,
                    attendanceStatus: prev.attendanceStatus,
                    comment: prev.comment,
                    revisionRequirements: prev.revisionRequirements,
                    submissionId: prev.submissionId,
                    revisionSubmissionId: prev.revisionSubmissionId,
                    outcome: prev.outcome,
                    revisionApprovalStatus: prev.revisionApprovalStatus,
                },
            });
        }

        return newBatch;
    });
}

/**
 * 11. Finalize overdue resubmissions for a single council
 */
async function finalizeOverdueResubmissions(councilId, actorId, options = {}) {
    const db = options.db || prisma;
    const cId = Number(councilId);
    const now = options.now ? new Date(options.now) : new Date();

    return db.$transaction(async (tx) => {
        const council = await tx.council.findUnique({
            where: { id: cId },
        });
        if (!council) {
            throw new NotFoundError('COUNCIL_NOT_FOUND');
        }

        if (!council.revisionSubmissionDeadline || now <= new Date(council.revisionSubmissionDeadline)) {
            return { terminatedCount: 0, affectedRegistrationIds: [] };
        }

        const candidates = await tx.topicRegistration.findMany({
            where: {
                outlineCouncilId: cId,
                status: 'BM01_NEEDS_REVISION',
            },
            include: {
                bm01Evaluations: {
                    orderBy: { attemptNo: 'desc' },
                    take: 1,
                },
                tasks: {
                    where: {
                        taskType: 'BM01_RESUBMISSION',
                        status: 'OPEN',
                    },
                },
            },
        });

        const overdueRegistrations = candidates.filter((reg) => {
            const latestEval = reg.bm01Evaluations?.[0];
            return !latestEval?.revisionSubmissionId;
        });

        if (overdueRegistrations.length === 0) {
            return { terminatedCount: 0, affectedRegistrationIds: [] };
        }

        const regIds = overdueRegistrations.map((r) => r.id);
        const evalIds = overdueRegistrations
            .map((r) => r.bm01Evaluations?.[0]?.id)
            .filter(Boolean);
        const taskIds = overdueRegistrations
            .flatMap((r) => r.tasks?.map((t) => t.id) || [])
            .filter(Boolean);

        await tx.topicRegistration.updateMany({
            where: { id: { in: regIds } },
            data: { status: 'TERMINATED_BM01' },
        });

        if (taskIds.length > 0) {
            await tx.task.updateMany({
                where: { id: { in: taskIds } },
                data: { status: 'OVERDUE' },
            });
        }

        if (evalIds.length > 0) {
            await tx.bM01Evaluation.updateMany({
                where: { id: { in: evalIds } },
                data: {
                    outcome: 'TERMINATED',
                    revisionApprovalStatus: 'REJECTED',
                },
            });
        }

        return {
            terminatedCount: regIds.length,
            affectedRegistrationIds: regIds,
        };
    });
}

module.exports = {
    submitInitialOutline,
    publishCouncilSchedule,
    saveDraftResults,
    completeSecretaryReview,
    returnResultsToSecretary,
    publishCouncilResults,
    setRevisionDeadline,
    submitResubmissionOutline,
    reviewResubmission,
    reopenCouncilResults,
    finalizeOverdueResubmissions,
};
