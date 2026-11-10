const prisma = require('../config/database');
const { resolveEffectiveTopicTitle } = require('./topicTitleResolverService');
const { computeCanonicalPayloadHash, recordSignatureEvent } = require('./electronicSignatureService');
const { generateImmutableAcademicPdf } = require('./academicPdfService');
const { validateAcademicScope } = require('./academicScopeService');

class BM03WorkflowError extends Error {
    constructor(message, code, statusCode = 400) {
        super(message);
        this.name = 'BM03WorkflowError';
        this.code = code;
        this.status = statusCode;
        this.statusCode = statusCode;
    }
}

/**
 * Ensures a BM03ProgressRecord exists for the given registrationId.
 * Sets effectiveTitleSnapshot from resolveEffectiveTopicTitle.
 */
async function getOrCreateBM03Record(registrationId, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const regId = Number(registrationId);
    const now = options.now ? new Date(options.now) : new Date();

    let record = await db.bM03ProgressRecord.findUnique({
        where: { registrationId: regId },
        include: {
            meetings: {
                orderBy: [{ meetingDate: 'asc' }, { id: 'asc' }],
                include: { advisorSignedBy: { select: { id: true, fullName: true } } },
            },
            stageEvaluations: {
                orderBy: { id: 'asc' },
                include: { evaluatedBy: { select: { id: true, fullName: true } } },
            },
            stopReviews: {
                orderBy: { id: 'desc' },
                include: { reviewedBy: { select: { id: true, fullName: true } } },
            },
            registration: {
                include: {
                    topic: { include: { mentor: { select: { id: true, fullName: true, department: true } } } },
                    student: { select: { id: true, fullName: true, code: true } },
                },
            },
            advisorSignedBy: { select: { id: true, fullName: true } },
        },
    });

    if (record) {
        return record;
    }

    const registration = await db.topicRegistration.findUnique({
        where: { id: regId },
        include: {
            topic: { include: { mentor: { select: { id: true, fullName: true, department: true } } } },
            student: { select: { id: true, fullName: true, code: true } },
        },
    });

    if (!registration) {
        throw new BM03WorkflowError('Hồ sơ đăng ký đề tài không tồn tại.', 'REGISTRATION_NOT_FOUND', 404);
    }

    let titleInfo;
    try {
        titleInfo = await resolveEffectiveTopicTitle(regId, now, options);
    } catch (e) {
        titleInfo = null;
    }

    const effectiveTitle = titleInfo?.title || registration.topic?.title || '';

    record = await db.bM03ProgressRecord.create({
        data: {
            registrationId: regId,
            effectiveTitleSnapshot: effectiveTitle,
        },
        include: {
            meetings: true,
            stageEvaluations: true,
            stopReviews: true,
            registration: {
                include: {
                    topic: { include: { mentor: { select: { id: true, fullName: true, department: true } } } },
                    student: { select: { id: true, fullName: true, code: true } },
                },
            },
            advisorSignedBy: true,
        },
    });

    return record;
}

/**
 * Creates a BM03 meeting entry.
 * Advisor-only entry, no student signature per meeting.
 * Editing creates v2 superseding v1 (supersedesEntryId).
 */
async function createBM03Meeting(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const {
        registrationId,
        advisorId,
        meetingDate,
        meetingMode = 'IN_PERSON',
        locationOrLink,
        discussionContent,
        studentCompletedWork,
        remainingIssues,
        nextTasks,
        expectedDeadline,
        progressRating,
        evidenceFileUrl,
        evidenceFileName,
        supersedesEntryId,
    } = input || {};

    const regId = Number(registrationId);
    const advId = Number(advisorId);

    const registration = await db.topicRegistration.findUnique({
        where: { id: regId },
        include: { topic: true },
    });

    if (!registration) {
        throw new BM03WorkflowError('Hồ sơ đăng ký đề tài không tồn tại.', 'REGISTRATION_NOT_FOUND', 404);
    }

    if (registration.topic?.mentorId !== advId) {
        throw new BM03WorkflowError(
            'Chỉ giảng viên hướng dẫn của đề tài mới có quyền ghi nhật ký buổi hướng dẫn.',
            'NOT_ADVISOR_OF_REGISTRATION',
            403,
        );
    }

    const bm03Record = await getOrCreateBM03Record(regId, options);

    if (bm03Record.isClosedEarly) {
        throw new BM03WorkflowError('Hồ sơ BM03 đã được đóng sớm do dừng đề tài.', 'BM03_ALREADY_CLOSED', 409);
    }

    if (bm03Record.advisorSignedAt) {
        throw new BM03WorkflowError(
            'Hồ sơ BM03 đã được giảng viên hướng dẫn ký toàn phiếu, không thể thêm buổi họp mới.',
            'BM03_ALREADY_SIGNED',
            409,
        );
    }

    if (!meetingDate) {
        throw new BM03WorkflowError('Ngày gặp hướng dẫn là bắt buộc.', 'MISSING_MEETING_DATE', 400);
    }
    if (!discussionContent || !String(discussionContent).trim()) {
        throw new BM03WorkflowError('Nội dung trao đổi là bắt buộc.', 'MISSING_DISCUSSION_CONTENT', 400);
    }
    if (!studentCompletedWork || !String(studentCompletedWork).trim()) {
        throw new BM03WorkflowError('Khối lượng công việc sinh viên đã thực hiện là bắt buộc.', 'MISSING_STUDENT_COMPLETED_WORK', 400);
    }
    if (!nextTasks || !String(nextTasks).trim()) {
        throw new BM03WorkflowError('Nhiệm vụ giao tiếp theo là bắt buộc.', 'MISSING_NEXT_TASKS', 400);
    }

    const validRatings = ['ON_TRACK', 'AT_RISK', 'BEHIND', 'NO_PROGRESS'];
    if (!progressRating || !validRatings.includes(progressRating)) {
        throw new BM03WorkflowError(`Đánh giá tiến độ không hợp lệ. Phải là một trong: ${validRatings.join(', ')}`, 'INVALID_PROGRESS_RATING', 400);
    }

    let versionNumber = 1;
    let prevId = null;

    if (supersedesEntryId) {
        prevId = Number(supersedesEntryId);
        const prevMeeting = await db.bM03MeetingEntry.findUnique({
            where: { id: prevId },
            include: { supersededBy: true },
        });

        if (!prevMeeting || prevMeeting.registrationId !== regId) {
            throw new BM03WorkflowError('Buổi họp cần sửa đổi không tồn tại.', 'SUPERSEDED_MEETING_NOT_FOUND', 404);
        }

        if (prevMeeting.supersededBy) {
            throw new BM03WorkflowError('Buổi họp này đã được sửa đổi bởi phiên bản tiếp theo.', 'MEETING_ALREADY_SUPERSEDED', 409);
        }

        versionNumber = (prevMeeting.versionNumber || 1) + 1;
    }

    const created = await db.bM03MeetingEntry.create({
        data: {
            bm03RecordId: bm03Record.id,
            registrationId: regId,
            versionNumber,
            supersedesEntryId: prevId,
            meetingDate: new Date(meetingDate),
            meetingMode: meetingMode === 'ONLINE' ? 'ONLINE' : 'IN_PERSON',
            locationOrLink: String(locationOrLink || '').trim(),
            discussionContent: String(discussionContent).trim(),
            studentCompletedWork: String(studentCompletedWork).trim(),
            remainingIssues: remainingIssues ? String(remainingIssues).trim() : null,
            nextTasks: String(nextTasks).trim(),
            expectedDeadline: expectedDeadline ? new Date(expectedDeadline) : null,
            progressRating,
            evidenceFileUrl: evidenceFileUrl ? String(evidenceFileUrl) : null,
            evidenceFileName: evidenceFileName ? String(evidenceFileName) : null,
            isLocked: false,
        },
    });

    return created;
}

/**
 * Signs a meeting entry by advisor only.
 * Computes payloadHash, records ElectronicSignatureEvent (BM03_MEETING), sets isLocked = true.
 */
async function signBM03Meeting(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { meetingId, advisorId, signatureImageId, ipAddress, userAgent } = input || {};

    const id = Number(meetingId);
    const advId = Number(advisorId);

    const meeting = await db.bM03MeetingEntry.findUnique({
        where: { id },
        include: {
            registration: {
                include: { topic: true },
            },
        },
    });

    if (!meeting) {
        throw new BM03WorkflowError('Buổi họp hướng dẫn không tồn tại.', 'MEETING_NOT_FOUND', 404);
    }

    if (meeting.registration?.topic?.mentorId !== advId) {
        throw new BM03WorkflowError('Chỉ giảng viên hướng dẫn của đề tài mới có quyền ký buổi hướng dẫn.', 'NOT_ADVISOR_OF_REGISTRATION', 403);
    }

    if (meeting.isLocked) {
        return meeting;
    }

    const payload = {
        meetingId: meeting.id,
        registrationId: meeting.registrationId,
        versionNumber: meeting.versionNumber,
        meetingDate: meeting.meetingDate,
        meetingMode: meeting.meetingMode,
        locationOrLink: meeting.locationOrLink,
        discussionContent: meeting.discussionContent,
        studentCompletedWork: meeting.studentCompletedWork,
        remainingIssues: meeting.remainingIssues,
        nextTasks: meeting.nextTasks,
        expectedDeadline: meeting.expectedDeadline,
        progressRating: meeting.progressRating,
    };

    const payloadHash = computeCanonicalPayloadHash(payload);

    const sigEvent = await recordSignatureEvent({
        registrationId: meeting.registrationId,
        entityType: 'BM03_MEETING',
        entityId: meeting.id,
        versionNumber: meeting.versionNumber,
        signerId: advId,
        signerRole: 'ADVISOR',
        action: 'SIGN',
        expectedPayloadHash: payloadHash,
        signatureImageId,
        ipAddress,
        userAgent,
    }, options);

    const now = options.now ? new Date(options.now) : new Date();

    const updated = await db.bM03MeetingEntry.update({
        where: { id },
        data: {
            isLocked: true,
            advisorSignedById: advId,
            advisorSignedAt: now,
            payloadHash,
            signatureEventId: sigEvent.id,
        },
    });

    return updated;
}

/**
 * Submits midterm or final stage evaluation.
 * If PROPOSE_STOP, creates InstituteStopReview (168h SLA) and marks registration STOP_REVIEW_PENDING.
 */
async function submitStageEvaluation(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { registrationId, advisorId, stage, comments, decision, idempotencyKey } = input || {};

    const regId = Number(registrationId);
    const advId = Number(advisorId);
    const now = options.now ? new Date(options.now) : new Date();

    if (!['MIDTERM', 'FINAL'].includes(stage)) {
        throw new BM03WorkflowError('Giai đoạn đánh giá không hợp lệ (phải là MIDTERM hoặc FINAL).', 'INVALID_STAGE', 400);
    }

    if (stage === 'MIDTERM' && !['CONTINUE', 'PROPOSE_STOP'].includes(decision)) {
        throw new BM03WorkflowError('Kết luận đánh giá giữa kỳ phải là CONTINUE hoặc PROPOSE_STOP.', 'INVALID_DECISION', 400);
    }

    if (stage === 'FINAL' && !['CONTINUE_TO_BM04', 'PROPOSE_STOP'].includes(decision)) {
        throw new BM03WorkflowError('Kết luận đánh giá cuối kỳ phải là CONTINUE_TO_BM04 hoặc PROPOSE_STOP.', 'INVALID_DECISION', 400);
    }

    if (!comments || !String(comments).trim()) {
        throw new BM03WorkflowError('Nhận xét đánh giá giai đoạn là bắt buộc.', 'MISSING_COMMENTS', 400);
    }

    const registration = await db.topicRegistration.findUnique({
        where: { id: regId },
        include: { topic: true },
    });

    if (!registration) {
        throw new BM03WorkflowError('Hồ sơ đăng ký đề tài không tồn tại.', 'REGISTRATION_NOT_FOUND', 404);
    }

    if (registration.topic?.mentorId !== advId) {
        throw new BM03WorkflowError('Chỉ giảng viên hướng dẫn của đề tài mới có quyền thực hiện đánh giá giai đoạn.', 'NOT_ADVISOR_OF_REGISTRATION', 403);
    }

    const bm03Record = await getOrCreateBM03Record(regId, options);

    if (bm03Record.isClosedEarly) {
        throw new BM03WorkflowError('Hồ sơ BM03 đã được đóng sớm do dừng đề tài.', 'BM03_ALREADY_CLOSED', 409);
    }

    if (stage === 'MIDTERM' && bm03Record.midtermStageEvaluationId) {
        throw new BM03WorkflowError('Đã tồn tại đánh giá giữa giai đoạn cho hồ sơ này.', 'STAGE_EVALUATION_ALREADY_EXISTS', 409);
    }

    if (stage === 'FINAL' && bm03Record.finalStageEvaluationId) {
        throw new BM03WorkflowError('Đã tồn tại đánh giá cuối giai đoạn cho hồ sơ này.', 'STAGE_EVALUATION_ALREADY_EXISTS', 409);
    }

    const payload = {
        registrationId: regId,
        stage,
        comments: String(comments).trim(),
        decision,
    };
    const payloadHash = computeCanonicalPayloadHash(payload);

    const stageEvaluation = await db.bM03StageEvaluation.create({
        data: {
            bm03RecordId: bm03Record.id,
            registrationId: regId,
            stage,
            comments: String(comments).trim(),
            decision,
            evaluatedById: advId,
            evaluatedAt: now,
            payloadHash,
        },
    });

    const updateData = {};
    if (stage === 'MIDTERM') {
        updateData.midtermStageEvaluationId = stageEvaluation.id;
    } else if (stage === 'FINAL') {
        updateData.finalStageEvaluationId = stageEvaluation.id;
        if (decision === 'CONTINUE_TO_BM04') {
            updateData.finalConclusion = 'CONTINUE_TO_BM04';
        }
    }

    await db.bM03ProgressRecord.update({
        where: { id: bm03Record.id },
        data: updateData,
    });

    let stopReview = null;
    if (decision === 'PROPOSE_STOP') {
        const deadline168h = new Date(now.getTime() + 168 * 3600 * 1000);
        stopReview = await db.instituteStopReview.create({
            data: {
                bm03RecordId: bm03Record.id,
                stageEvaluationId: stageEvaluation.id,
                registrationId: regId,
                stage,
                status: 'STOP_REVIEW_PENDING',
                stopProposalSubmittedAt: now,
                stopReviewDeadline: deadline168h,
                extensionCount: 0,
                idempotencyKey: idempotencyKey || null,
            },
        });

        await db.topicRegistration.update({
            where: { id: regId },
            data: { status: 'STOP_REVIEW_PENDING' },
        });
    }

    return { stageEvaluation, stopReview };
}

/**
 * Institute requests more information on stop proposal.
 * Extends stopReviewDeadline by +72h (original + 72h).
 * Single extension only; second request fails with 409 EXTENSION_QUOTA_EXHAUSTED.
 */
async function requestMoreInfoForStopReview(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { stopReviewId, reviewerId, note } = input || {};

    const stopId = Number(stopReviewId);
    const revId = Number(reviewerId);
    const now = options.now ? new Date(options.now) : new Date();

    const stopReview = await db.instituteStopReview.findUnique({
        where: { id: stopId },
        include: {
            registration: {
                include: { topic: { include: { mentor: true } } },
            },
        },
    });

    if (!stopReview) {
        throw new BM03WorkflowError('Đề xuất dừng không tồn tại.', 'STOP_REVIEW_NOT_FOUND', 404);
    }

    if (stopReview.extensionCount > 0) {
        throw new BM03WorkflowError('Chỉ được yêu cầu bổ sung thông tin và gia hạn duy nhất 1 lần.', 'EXTENSION_QUOTA_EXHAUSTED', 409);
    }

    if (stopReview.status !== 'STOP_REVIEW_PENDING') {
        throw new BM03WorkflowError('Đề xuất dừng không ở trạng thái chờ thẩm định.', 'INVALID_STOP_REVIEW_STATUS', 409);
    }

    if (now.getTime() > stopReview.stopReviewDeadline.getTime()) {
        throw new BM03WorkflowError('Đã quá hạn thẩm định dừng đề tài.', 'STOP_REVIEW_DEADLINE_EXPIRED', 409);
    }

    if (validateAcademicScope) {
        await validateAcademicScope(db, {
            actorId: revId,
            registrationId: stopReview.registrationId,
            capabilityCode: 'BM03_STOP_REVIEW',
            now,
        });
    }

    const currentDeadline = new Date(stopReview.stopReviewDeadline);
    const newDeadline = new Date(currentDeadline.getTime() + 72 * 3600 * 1000);

    const updateRes = await db.instituteStopReview.updateMany({
        where: {
            id: stopId,
            extensionCount: 0,
            status: 'STOP_REVIEW_PENDING',
            stopReviewDeadline: { gte: now },
        },
        data: {
            status: 'MORE_INFO_REQUIRED',
            extensionCount: 1,
            extendedAt: now,
            moreInfoRequestedById: revId,
            moreInfoRequestNote: note ? String(note).trim() : null,
            stopReviewDeadline: newDeadline,
        },
    });

    if (updateRes.count === 0) {
        throw new BM03WorkflowError('Không thể gia hạn yêu cầu bổ sung thông tin.', 'EXTENSION_FAILED_CONFLICT', 409);
    }

    return await db.instituteStopReview.findUnique({ where: { id: stopId } });
}

/**
 * Institute decides on stop proposal.
 * APPROVE_STOP closes BM03 early & terminates registration (TERMINATED_FAILED_PROGRESS).
 * REJECT_STOP sets STOP_REJECTED and lets student continue (IN_PROGRESS_BM03).
 */
async function decideStopReview(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { stopReviewId, reviewerId, decision, reason } = input || {};

    const stopId = Number(stopReviewId);
    const revId = Number(reviewerId);
    const now = options.now ? new Date(options.now) : new Date();

    if (!['APPROVE_STOP', 'REJECT_STOP'].includes(decision)) {
        throw new BM03WorkflowError('Quyết định thẩm định phải là APPROVE_STOP hoặc REJECT_STOP.', 'INVALID_DECISION', 400);
    }

    const stopReview = await db.instituteStopReview.findUnique({
        where: { id: stopId },
        include: {
            registration: {
                include: { topic: { include: { mentor: true } } },
            },
        },
    });

    if (!stopReview) {
        throw new BM03WorkflowError('Đề xuất dừng không tồn tại.', 'STOP_REVIEW_NOT_FOUND', 404);
    }

    if (!['STOP_REVIEW_PENDING', 'MORE_INFO_REQUIRED'].includes(stopReview.status)) {
        throw new BM03WorkflowError('Đề xuất dừng đã có quyết định hoặc không ở trạng thái thẩm định.', 'INVALID_STOP_REVIEW_STATUS', 409);
    }

    if (validateAcademicScope) {
        await validateAcademicScope(db, {
            actorId: revId,
            registrationId: stopReview.registrationId,
            capabilityCode: 'BM03_STOP_REVIEW',
            now,
        });
    }

    if (decision === 'APPROVE_STOP') {
        const updated = await db.instituteStopReview.update({
            where: { id: stopId },
            data: {
                status: 'STOP_APPROVED',
                decision: 'APPROVE_STOP',
                decisionSource: 'INSTITUTE_REVIEWER',
                reviewedById: revId,
                reviewedAt: now,
                reviewReason: reason ? String(reason).trim() : null,
            },
        });

        await db.bM03ProgressRecord.update({
            where: { id: stopReview.bm03RecordId },
            data: {
                isClosedEarly: true,
                finalConclusion: 'STOPPED',
            },
        });

        await db.topicRegistration.update({
            where: { id: stopReview.registrationId },
            data: {
                status: 'TERMINATED_FAILED_PROGRESS',
            },
        });

        return updated;
    } else {
        const updated = await db.instituteStopReview.update({
            where: { id: stopId },
            data: {
                status: 'STOP_REJECTED',
                decision: 'REJECT_STOP',
                decisionSource: 'INSTITUTE_REVIEWER',
                reviewedById: revId,
                reviewedAt: now,
                reviewReason: reason ? String(reason).trim() : null,
            },
        });

        await db.topicRegistration.update({
            where: { id: stopReview.registrationId },
            data: {
                status: 'IN_PROGRESS_BM03',
            },
        });

        return updated;
    }
}

/**
 * Advisor signs whole BM03 form.
 * Requires final stage conclusion (CONTINUE_TO_BM04 or STOPPED).
 * Sets studentAckStatus = 'PENDING_STUDENT_ACKNOWLEDGEMENT', studentAckDeadlineAt = now + 48h.
 */
async function advisorSignWholeBM03(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { bm03RecordId, advisorId, signatureImageId, ipAddress, userAgent } = input || {};

    const id = Number(bm03RecordId);
    const advId = Number(advisorId);
    const now = options.now ? new Date(options.now) : new Date();

    const record = await db.bM03ProgressRecord.findUnique({
        where: { id },
        include: {
            registration: {
                include: { topic: true },
            },
            finalStageEvaluation: true,
        },
    });

    if (!record) {
        throw new BM03WorkflowError('Hồ sơ BM03 không tồn tại.', 'BM03_RECORD_NOT_FOUND', 404);
    }

    if (record.registration?.topic?.mentorId !== advId) {
        throw new BM03WorkflowError('Chỉ giảng viên hướng dẫn của đề tài mới có quyền ký toàn phiếu BM03.', 'NOT_ADVISOR_OF_REGISTRATION', 403);
    }

    if (!record.finalConclusion || !['CONTINUE_TO_BM04', 'STOPPED'].includes(record.finalConclusion)) {
        throw new BM03WorkflowError('Chỉ được ký toàn phiếu BM03 khi đã có kết luận cuối cùng (CONTINUE_TO_BM04 hoặc STOPPED).', 'FINAL_CONCLUSION_REQUIRED', 409);
    }

    if (record.advisorSignedAt) {
        return record;
    }

    const payload = {
        bm03RecordId: record.id,
        registrationId: record.registrationId,
        effectiveTitleSnapshot: record.effectiveTitleSnapshot,
        finalConclusion: record.finalConclusion,
        isClosedEarly: record.isClosedEarly,
    };
    const payloadHash = computeCanonicalPayloadHash(payload);

    const sigEvent = await recordSignatureEvent({
        registrationId: record.registrationId,
        entityType: 'BM03_RECORD',
        entityId: record.id,
        versionNumber: 1,
        signerId: advId,
        signerRole: 'ADVISOR',
        action: 'SIGN',
        expectedPayloadHash: payloadHash,
        signatureImageId,
        ipAddress,
        userAgent,
    }, options);

    const deadline48h = new Date(now.getTime() + 48 * 3600 * 1000);

    const updated = await db.bM03ProgressRecord.update({
        where: { id: record.id },
        data: {
            advisorSignedById: advId,
            advisorSignedAt: now,
            advisorPayloadHash: payloadHash,
            advisorSignatureEventId: sigEvent.id,
            studentAckStatus: 'PENDING_STUDENT_ACKNOWLEDGEMENT',
            studentAckDeadlineAt: deadline48h,
        },
    });

    return updated;
}

/**
 * Student acknowledges or declines to acknowledge BM03 form within 48h.
 * Records signature event, generates immutable PDF, transitions registration to BM03_PASSED,
 * and opens Task(BM04).
 */
async function studentAcknowledgeBM03(input, options = {}) {
    const db = options.tx || options.prisma || prisma;
    const { bm03RecordId, studentId, action, comment, ipAddress, userAgent } = input || {};

    const id = Number(bm03RecordId);
    const stuId = Number(studentId);
    const now = options.now ? new Date(options.now) : new Date();

    const validActions = ['ACKNOWLEDGED', 'ACKNOWLEDGED_WITH_COMMENT', 'DECLINED_TO_ACKNOWLEDGE'];
    if (!action || !validActions.includes(action)) {
        throw new BM03WorkflowError(`Hành động xác nhận không hợp lệ. Phải là một trong: ${validActions.join(', ')}`, 'INVALID_ACTION', 400);
    }

    if (action === 'DECLINED_TO_ACKNOWLEDGE' && (!comment || !String(comment).trim())) {
        throw new BM03WorkflowError('Bắt buộc nhập lý do khi từ chối xác nhận BM03.', 'MISSING_DECLINE_REASON', 400);
    }

    const record = await db.bM03ProgressRecord.findUnique({
        where: { id },
        include: {
            registration: {
                include: {
                    topic: { include: { mentor: true } },
                    student: true,
                },
            },
            advisorSignedBy: true,
            meetings: {
                orderBy: { meetingDate: 'asc' },
                include: { advisorSignedBy: true },
            },
            stageEvaluations: {
                orderBy: { evaluatedAt: 'asc' },
                include: { evaluatedBy: true },
            },
        },
    });

    if (!record) {
        throw new BM03WorkflowError('Hồ sơ BM03 không tồn tại.', 'BM03_RECORD_NOT_FOUND', 404);
    }

    if (record.registration?.studentId !== stuId) {
        throw new BM03WorkflowError('Sinh viên không phải chủ sở hữu hồ sơ này.', 'STUDENT_NOT_REGISTRATION_OWNER', 403);
    }

    if (record.studentAckStatus !== 'PENDING_STUDENT_ACKNOWLEDGEMENT') {
        throw new BM03WorkflowError('Hồ sơ BM03 không ở trạng thái chờ sinh viên xác nhận.', 'INVALID_ACK_STATUS', 409);
    }

    if (record.studentAckDeadlineAt && now.getTime() > record.studentAckDeadlineAt.getTime()) {
        throw new BM03WorkflowError('Thời hạn 48 giờ để sinh viên xác nhận BM03 đã hết hạn.', 'ACKNOWLEDGEMENT_DEADLINE_EXPIRED', 409);
    }

    let sigAction = 'ACKNOWLEDGE';
    if (action === 'DECLINED_TO_ACKNOWLEDGE') {
        sigAction = 'DECLINE_ACKNOWLEDGE';
    } else if (action === 'ACKNOWLEDGED_WITH_COMMENT') {
        sigAction = 'ACKNOWLEDGE_WITH_COMMENT';
    }

    const sigEvent = await recordSignatureEvent({
        registrationId: record.registrationId,
        entityType: 'BM03_RECORD',
        entityId: record.id,
        versionNumber: 1,
        signerId: stuId,
        signerRole: 'STUDENT',
        action: sigAction,
        expectedPayloadHash: record.advisorPayloadHash,
        rejectionOrReturnReason: action === 'DECLINED_TO_ACKNOWLEDGE' ? String(comment).trim() : null,
        ipAddress,
        userAgent,
    }, options);

    const sections = [
        {
            heading: '1. THÔNG TIN CHUNG',
            lines: [
                `Tên đề tài: ${record.effectiveTitleSnapshot}`,
                `Sinh viên: ${record.registration?.student?.fullName || ''} (${record.registration?.student?.code || ''})`,
                `GVHD: ${record.registration?.topic?.mentor?.fullName || ''}`,
            ],
        },
        {
            heading: '2. NHẬT KÝ CÁC BUỔI HƯỚNG DẪN',
            lines: (record.meetings || []).map((m, idx) =>
                `Buổi ${idx + 1} (${new Date(m.meetingDate).toISOString().split('T')[0]} - ${m.meetingMode}): ${m.discussionContent} | Đánh giá: ${m.progressRating}`
            ),
        },
        {
            heading: '3. ĐÁNH GIÁ GIAI ĐOẠN',
            lines: (record.stageEvaluations || []).map((ev) =>
                `Giai đoạn ${ev.stage}: ${ev.decision} - ${ev.comments}`
            ),
        },
        {
            heading: '4. KẾT LUẬN CUỐI CÙNG & XÁC NHẬN CỦA SINH VIÊN',
            lines: [
                `Kết luận cuối cùng: ${record.finalConclusion || ''}`,
                `Trạng thái xác nhận của sinh viên: ${action}`,
                comment ? `Ý kiến / lý do của sinh viên: ${comment}` : 'Sinh viên không có ý kiến bổ sung.',
            ],
        },
    ];

    const signatures = [
        {
            roleLabel: 'Giảng viên hướng dẫn',
            signerName: record.advisorSignedBy?.fullName || record.registration?.topic?.mentor?.fullName || 'GVHD',
            signedAt: record.advisorSignedAt,
            payloadHash: record.advisorPayloadHash,
        },
        {
            roleLabel: 'Sinh viên thực hiện',
            signerName: record.registration?.student?.fullName || 'Sinh viên',
            signedAt: now,
            payloadHash: record.advisorPayloadHash,
            systemNote: action === 'DECLINED_TO_ACKNOWLEDGE' ? `Từ chối xác nhận: ${comment}` : undefined,
        },
    ];

    const pdfResult = await generateImmutableAcademicPdf({
        docType: 'BM03',
        registrationId: record.registrationId,
        entityId: record.id,
        versionNumber: 1,
        title: 'PHIẾU THEO DÕI QUÁ TRÌNH THỰC HIỆN ĐỒ ÁN (BM03)',
        sections,
        signatures,
    }, options);

    const updated = await db.bM03ProgressRecord.update({
        where: { id: record.id },
        data: {
            studentAckStatus: action,
            studentAckAt: now,
            studentComment: comment ? String(comment).trim() : null,
            studentSignatureEventId: sigEvent.id,
            finalPdfFileUrl: pdfResult?.fileUrl || null,
        },
    });

    if (record.finalConclusion === 'CONTINUE_TO_BM04') {
        await db.topicRegistration.update({
            where: { id: record.registrationId },
            data: { status: 'BM03_PASSED' },
        });

        const existingTask = await db.task.findFirst({
            where: {
                registrationId: record.registrationId,
                taskType: 'BM04',
            },
        });

        if (existingTask) {
            await db.task.update({
                where: { id: existingTask.id },
                data: { status: 'OPEN' },
            });
        } else {
            await db.task.create({
                data: {
                    registrationId: record.registrationId,
                    title: 'Phiếu nhận xét của GVHD (BM04)',
                    content: 'Đánh giá kết quả thực hiện đồ án tốt nghiệp của sinh viên',
                    taskType: 'BM04',
                    status: 'OPEN',
                },
            });
        }
    }

    return updated;
}

module.exports = {
    BM03WorkflowError,
    getOrCreateBM03Record,
    createBM03Meeting,
    signBM03Meeting,
    submitStageEvaluation,
    requestMoreInfoForStopReview,
    decideStopReview,
    advisorSignWholeBM03,
    studentAcknowledgeBM03,
};
