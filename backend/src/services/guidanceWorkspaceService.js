/**
 * guidanceWorkspaceService.js
 *
 * Derives the guidance workspace summary (`nextAction` and ordered `forms` list)
 * strictly from persisted TopicRegistration records, enum states, and actor permissions.
 */

const BM01_TASK_TYPES = new Set(['BM01', 'BM01_INITIAL_SUBMISSION', 'BM01_RESUBMISSION']);

const POST_BM01_STATUSES = new Set([
    'BM01_PASSED',
    'BM02_OPEN',
    'BM02_SUBMITTED',
    'BM02_NEEDS_REVISION',
    'BM02_REVISION_REQUIRED',
    'BM02_RESUBMITTED',
    'BM02_APPROVED',
    'DECISION_ISSUED',
    'IN_PROGRESS',
    'IN_PROGRESS_BM03',
    'BM03_SIGNATURE_PENDING',
    'CHECKPOINT_SIGNATURE_APPEAL_OPEN',
    'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
    'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
    'SIGNATURE_APPEAL_RESOLVED',
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'DEFENDED',
    'DEFENSE_PASSED',
    'DEFENSE_FAILED',
    'COMPLETED',
]);

const POST_BM03_STATUSES = new Set([
    'BM03_PASSED',
    'BM04_REVIEW',
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'DEFENDED',
    'DEFENSE_PASSED',
    'DEFENSE_FAILED',
    'COMPLETED',
]);

const BM05_PROCESSING_STATUSES = new Set([
    'DEFENSE_READY',
    'DEFENSE_ELIGIBLE',
    'AWAITING_SCORES',
    'AWAITING_FINAL_APPROVAL',
    'DEFENDED',
    'DEFENSE_PASSED',
    'DEFENSE_FAILED',
    'PENDING_INSTITUTE_SIGNATURE',
    'COMPLETED',
]);

const toTimestamp = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const pickLatestDate = (...candidates) => {
    let latest = null;
    let latestMs = -Infinity;
    for (const candidate of candidates) {
        const parsed = toTimestamp(candidate);
        if (parsed && parsed.getTime() > latestMs) {
            latest = parsed;
            latestMs = parsed.getTime();
        }
    }
    return latest;
};

const toSet = (input) => {
    if (!input) return new Set();
    if (input instanceof Set) return input;
    if (Array.isArray(input)) return new Set(input);
    return new Set();
};

const createContext = (registration, actor, options = {}) => {
    const allowedSet = toSet(options.allowedActions);
    const permSet = options.actorPermissions
        ? toSet(options.actorPermissions)
        : toSet(actor?.permissions);
    const isAdmin = actor?.role === 'ADMIN';
    const isMentor = (actor?.role === 'LECTURER' || isAdmin)
        && registration?.topic?.mentorId != null
        && Number(registration.topic.mentorId) === Number(actor?.id);

    return {
        registrationId: registration?.id ?? null,
        regStatus: registration?.status || null,
        isAdmin,
        isMentor,
        hasPerm: (code) => isAdmin || permSet.has(code),
        hasAction: (code) => allowedSet.has(code),
    };
};

const isDefenseResultPublished = (registration) => {
    if (registration?.defenseResult?.isPublished === true) {
        return true;
    }
    if (Array.isArray(registration?.resultPublicationItems) && registration.resultPublicationItems.length > 0) {
        return registration.resultPublicationItems.some((item) => {
            const pub = item?.publication;
            if (!pub) return true;
            const validSemester = !registration.semesterId || !pub.semesterId || registration.semesterId === pub.semesterId;
            const validType = ['INITIAL', 'SUPPLEMENTARY', 'CORRECTION'].includes(pub.type);
            return validSemester && validType;
        });
    }
    return false;
};

const buildBM01Summary = (registration, ctx) => {
    const submissions = Array.isArray(registration?.submissions)
        ? registration.submissions.filter((s) => !s?.task?.taskType || BM01_TASK_TYPES.has(s.task.taskType))
        : [];
    const sortedSubs = [...submissions].sort(
        (a, b) => (toTimestamp(b?.submittedAt)?.getTime() || 0) - (toTimestamp(a?.submittedAt)?.getTime() || 0)
    );
    const latestSub = sortedSubs[0] || null;

    const evals = Array.isArray(registration?.bm01Evaluations) ? registration.bm01Evaluations : [];
    const sortedEvals = [...evals].sort(
        (a, b) => (b?.attemptNo || 0) - (a?.attemptNo || 0)
            || (toTimestamp(b?.createdAt)?.getTime() || 0) - (toTimestamp(a?.createdAt)?.getTime() || 0)
    );
    const latestEval = sortedEvals[0] || null;

    const updatedAt = pickLatestDate(
        latestSub?.feedbackAt,
        latestSub?.submittedAt,
        latestEval?.revisionReviewedAt,
        latestEval?.reviewedAt,
        latestEval?.submittedAt,
        latestEval?.createdAt
    );

    const outlineStatus = registration?.outlineReviewStatus;
    let status = 'NOT_STARTED';
    let statusLabel = 'Chưa nộp';
    let nextActor = null;

    if (
        latestEval?.outcome === 'PASSED'
        || outlineStatus === 'PASSED'
        || POST_BM01_STATUSES.has(ctx.regStatus)
    ) {
        status = 'APPROVED';
        statusLabel = 'Đã duyệt';
    } else if (
        latestEval?.outcome === 'TERMINATED'
        || ctx.regStatus === 'TERMINATED_BM01'
        || outlineStatus === 'FAILED'
    ) {
        status = 'TERMINATED';
        statusLabel = 'Không đạt';
    } else if (ctx.regStatus === 'BM01_RESUBMITTED' || latestEval?.revisionApprovalStatus === 'PENDING') {
        status = 'SUBMITTED';
        statusLabel = 'Đã nộp lại';
        nextActor = 'Giảng viên hướng dẫn';
    } else if (
        latestEval?.outcome === 'NEEDS_REVISION'
        || ctx.regStatus === 'BM01_NEEDS_REVISION'
        || outlineStatus === 'REVISION_REQUIRED'
    ) {
        status = 'NEEDS_REVISION';
        statusLabel = 'Cần sửa';
        nextActor = 'Sinh viên';
    } else if (latestSub || ctx.regStatus === 'BM01_SUBMITTED') {
        status = 'SUBMITTED';
        statusLabel = 'Đã nộp';
        nextActor = 'Hội đồng / Giảng viên hướng dẫn';
    }

    const actions = [];
    if (latestSub && (latestSub.fileUrl || latestSub.assetId || latestSub.id)) {
        actions.push({
            code: 'VIEW',
            label: 'Xem PDF đã nộp',
            params: { registrationId: ctx.registrationId, submissionId: latestSub.id ?? null },
        });
    }

    const canReviewBM01 = ctx.hasAction('APPROVE_BM01_REVISION')
        || ((ctx.isMentor || ctx.isAdmin) && (ctx.hasPerm('OUTLINE_APPROVE') || ctx.hasPerm('OUTLINE_REVIEW')));
    if (canReviewBM01 && (status === 'SUBMITTED' || status === 'NEEDS_REVISION' || ctx.hasAction('APPROVE_BM01_REVISION'))) {
        actions.push({
            code: 'REVIEW',
            label: 'Duyệt đề cương',
            params: { registrationId: ctx.registrationId },
        });
    }

    return {
        code: 'BM01',
        title: 'Đề cương chi tiết (BM01)',
        status,
        statusLabel,
        updatedAt,
        nextActor,
        actions,
    };
};

const buildBM02Summary = (registration, ctx) => {
    const sub = registration?.currentBM02Submission
        || (Array.isArray(registration?.bm02Submissions) && registration.bm02Submissions[0])
        || null;

    const updatedAt = sub ? pickLatestDate(sub.reviewedAt, sub.submittedAt) : null;

    let status = 'NOT_STARTED';
    let statusLabel = 'Chưa nộp';
    let nextActor = ['BM01_PASSED', 'BM02_OPEN'].includes(ctx.regStatus) ? 'Sinh viên' : null;

    if (sub) {
        switch (sub.outcome) {
            case 'APPROVED':
                status = 'APPROVED';
                statusLabel = 'Đã duyệt';
                nextActor = null;
                break;
            case 'REVISION_REQUIRED':
                status = 'NEEDS_REVISION';
                statusLabel = 'Cần sửa';
                nextActor = 'Sinh viên';
                break;
            case 'REJECTED_TERMINAL':
                status = 'REJECTED';
                statusLabel = 'Từ chối';
                nextActor = null;
                break;
            case 'EXCEPTION_REVIEW':
            case 'PENDING_REVIEW':
            default:
                status = 'PENDING_REVIEW';
                statusLabel = 'Chờ thẩm định';
                nextActor = 'Khoa / Bộ môn';
                break;
        }
    }

    const actions = [];
    if (sub) {
        actions.push(
            {
                code: 'VIEW',
                label: 'Xem chi tiết',
                params: { registrationId: ctx.registrationId, submissionId: sub.id ?? null },
            },
            {
                code: 'VIEW_PRINT',
                label: 'Xem bản in',
                params: { registrationId: ctx.registrationId, submissionId: sub.id ?? null },
            }
        );

        const canReviewBM02 = ctx.hasPerm('BM02_REVIEW')
            || ctx.hasPerm('BM02_DEPARTMENT_SIGN')
            || (ctx.isMentor && ctx.hasPerm('BM02_ADVISOR_SIGN'));
        if (status === 'PENDING_REVIEW' && canReviewBM02) {
            actions.push({
                code: 'REVIEW',
                label: 'Thẩm định đơn',
                params: { registrationId: ctx.registrationId, submissionId: sub.id ?? null },
            });
        }
    }

    return {
        code: 'BM02',
        title: 'Đơn đăng ký nhận đề tài (BM02)',
        status,
        statusLabel,
        updatedAt,
        nextActor,
        actions,
    };
};

const BM02A_STATUS_MAP = {
    STUDENT_PREPARING: { status: 'IN_PROGRESS', statusLabel: 'Đang soạn', nextActor: 'Sinh viên' },
    PENDING_ADVISOR: { status: 'PENDING_ADVISOR', statusLabel: 'Chờ GVHD duyệt', nextActor: 'Giảng viên hướng dẫn' },
    RETURNED_FOR_CORRECTION: { status: 'NEEDS_REVISION', statusLabel: 'Cần sửa', nextActor: 'Sinh viên' },
    PENDING_DEPARTMENT_APPROVAL: { status: 'PENDING_DEPARTMENT', statusLabel: 'Chờ bộ môn duyệt', nextActor: 'Bộ môn / Khoa' },
    APPROVED_PENDING_APPENDIX: { status: 'APPROVED', statusLabel: 'Đã duyệt (chờ phụ lục)', nextActor: 'Phòng Đào tạo / Khoa' },
    ASSIGNED_TO_APPENDIX: { status: 'APPROVED', statusLabel: 'Đã duyệt (chờ phụ lục)', nextActor: 'Phòng Đào tạo / Khoa' },
    ADJUSTMENT_ISSUED: { status: 'ISSUED', statusLabel: 'Đã ban hành điều chỉnh', nextActor: null },
    REJECTED_FINAL: { status: 'REJECTED', statusLabel: 'Từ chối', nextActor: null },
    EXPIRED: { status: 'EXPIRED', statusLabel: 'Hết hạn', nextActor: null },
};

const UNSUBMITTED_BM02A_STATUSES = new Set(['STUDENT_PREPARING', 'DRAFT']);

const buildBM02ASummary = (registration, ctx) => {
    const rawRequests = Array.isArray(registration?.bm02aRequests) ? registration.bm02aRequests : [];
    const requests = rawRequests.filter((req) => req && req.status && !UNSUBMITTED_BM02A_STATUSES.has(req.status));
    if (requests.length === 0) return null;

    const sorted = [...requests].sort(
        (a, b) => (toTimestamp(b?.createdAt)?.getTime() || 0) - (toTimestamp(a?.createdAt)?.getTime() || 0)
            || (b?.id || 0) - (a?.id || 0)
    );
    const latest = sorted[0];
    const mapped = BM02A_STATUS_MAP[latest.status] || {
        status: 'IN_PROGRESS',
        statusLabel: 'Đang xử lý',
        nextActor: null,
    };

    const actions = [
        {
            code: 'VIEW',
            label: requests.length > 1 ? `Xem yêu cầu (${requests.length})` : 'Xem yêu cầu',
            params: { registrationId: ctx.registrationId, requestId: latest.id ?? null },
        },
        {
            code: 'VIEW_PRINT',
            label: 'Xem bản in',
            params: { registrationId: ctx.registrationId, requestId: latest.id ?? null },
        },
    ];

    const canAdvisorReview = latest.status === 'PENDING_ADVISOR'
        && (ctx.isAdmin || (ctx.isMentor && ctx.hasPerm('BM02A_ADVISOR_SIGN')));
    const canDeptReview = latest.status === 'PENDING_DEPARTMENT_APPROVAL'
        && ctx.hasPerm('BM02A_FINAL_APPROVE');

    if (canAdvisorReview || canDeptReview) {
        actions.push({
            code: 'REVIEW',
            label: canAdvisorReview ? 'Duyệt điều chỉnh tên đề tài' : 'Phê duyệt điều chỉnh',
            params: { registrationId: ctx.registrationId, requestId: latest.id ?? null },
        });
    }

    return {
        code: 'BM02-A',
        title: 'Đơn điều chỉnh tên đề tài (BM02-A)',
        status: mapped.status,
        statusLabel: mapped.statusLabel,
        updatedAt: pickLatestDate(latest.updatedAt, latest.createdAt),
        nextActor: mapped.nextActor,
        actions,
    };
};

const buildBM03Summary = (registration, ctx) => {
    const bm03Record = registration?.bm03Record || null;
    const entries = Array.isArray(registration?.bm03MeetingEntries)
        ? registration.bm03MeetingEntries
        : Array.isArray(registration?.meetingLogs)
            ? registration.meetingLogs
            : [];
    const checkpoints = Array.isArray(registration?.checkpointEvaluations)
        ? registration.checkpointEvaluations
        : [];

    const hasAnyData = Boolean(bm03Record) || entries.length > 0 || checkpoints.length > 0;

    const entryDates = entries.flatMap((e) => [e?.createdAt, e?.meetingDate]);
    const checkpointDates = checkpoints.flatMap((c) => [c?.updatedAt, c?.studentSignedAt, c?.mentorSignedAt, c?.createdAt]);
    const updatedAt = hasAnyData
        ? pickLatestDate(
            bm03Record?.updatedAt,
            bm03Record?.advisorSignedAt,
            bm03Record?.studentAckAt,
            bm03Record?.createdAt,
            ...entryDates,
            ...checkpointDates
        )
        : null;

    let status = 'NOT_STARTED';
    let statusLabel = 'Chưa bắt đầu';
    let nextActor = null;

    const isStudentAckDone = bm03Record?.studentAckStatus === 'ACKNOWLEDGED'
        || bm03Record?.studentAckStatus === 'ACKNOWLEDGED_WITH_COMMENT';

    if (!hasAnyData) {
        status = 'NOT_STARTED';
        statusLabel = 'Chưa bắt đầu';
    } else if (
        bm03Record?.advisorSignedAt
        && (isStudentAckDone || POST_BM03_STATUSES.has(ctx.regStatus))
    ) {
        status = 'SIGNED';
        statusLabel = 'Đã chốt';
    } else if (
        (bm03Record?.advisorSignedAt && bm03Record?.studentAckStatus === 'PENDING_STUDENT_ACKNOWLEDGEMENT')
        || ctx.regStatus === 'BM03_SIGNATURE_PENDING'
    ) {
        status = 'PENDING_SIGNATURE';
        statusLabel = 'Chờ sinh viên xác nhận';
        nextActor = 'Sinh viên';
    } else {
        status = 'IN_PROGRESS';
        statusLabel = 'Đang ghi nhận';
        nextActor = 'Giảng viên hướng dẫn';
    }

    const actions = [];
    const canOpenProgress = ctx.isAdmin
        || (ctx.isMentor && (
            ctx.hasPerm('BM03_REVIEW')
            || ctx.hasPerm('BM03_MEETING_RECORD')
            || ctx.hasPerm('BM03_STAGE_EVALUATE')
            || ctx.hasAction('ISSUE_CHECKPOINT_1')
            || ctx.hasAction('ISSUE_CHECKPOINT_2')
        ));

    if (canOpenProgress) {
        actions.push({
            code: 'OPEN_PROGRESS',
            label: 'Mở theo dõi tiến độ',
            params: { registrationId: ctx.registrationId },
        });
    }

    if (Boolean(bm03Record) || entries.length > 0) {
        actions.push({
            code: 'VIEW_PRINT',
            label: 'Xem bản in',
            params: { registrationId: ctx.registrationId },
        });
    }

    return {
        code: 'BM03',
        title: 'Nhật ký & theo dõi tiến độ (BM03)',
        status,
        statusLabel,
        updatedAt,
        nextActor,
        actions,
    };
};

const buildBM04Summary = (registration, ctx) => {
    const bm04 = registration?.bm04Evaluation || null;
    const updatedAt = bm04 ? pickLatestDate(bm04.updatedAt, bm04.signedAt, bm04.createdAt) : null;

    let status = 'NOT_STARTED';
    let statusLabel = 'Chưa lập';
    let nextActor = ctx.hasAction('SUBMIT_BM04') ? 'Giảng viên hướng dẫn' : null;

    if (bm04) {
        if (bm04.status === 'DRAFT') {
            status = 'DRAFT';
            statusLabel = 'Nháp';
            nextActor = 'Giảng viên hướng dẫn';
        } else if (bm04.status === 'PENDING_INSTITUTE_REVIEW') {
            status = 'PENDING_REVIEW';
            statusLabel = 'Chờ viện thẩm định';
            nextActor = 'Viện / Khoa';
        } else if (
            ['SIGNED_APPROVED', 'NOT_ELIGIBLE_FOR_DEFENSE', 'ELIGIBLE_BY_INSTITUTE', 'AUTO_NOT_ELIGIBLE'].includes(bm04.status)
            || bm04.isLocked
        ) {
            status = 'SIGNED';
            statusLabel = 'Đã ký';
            nextActor = null;
        } else {
            status = 'IN_PROGRESS';
            statusLabel = 'Đang xử lý';
            nextActor = 'Giảng viên hướng dẫn';
        }
    }

    const actions = [];
    const canCreateOrEdit = ctx.hasAction('SUBMIT_BM04')
        || ((ctx.isAdmin || (ctx.isMentor && (ctx.hasPerm('BM04_SUBMIT') || ctx.hasPerm('BM04_CREATE_AND_SIGN'))))
            && (!bm04 || bm04.status === 'DRAFT')
            && ['BM03_PASSED', 'BM04_REVIEW'].includes(ctx.regStatus));

    if (canCreateOrEdit) {
        actions.push({
            code: 'REVIEW',
            label: bm04 ? 'Tiếp tục lập BM04' : 'Lập phiếu BM04',
            params: { registrationId: ctx.registrationId },
        });
    }

    if (bm04 && bm04.status !== 'DRAFT') {
        actions.push({
            code: 'VIEW_PRINT',
            label: 'Xem bản in',
            params: { registrationId: ctx.registrationId },
        });
    }

    return {
        code: 'BM04',
        title: 'Phiếu nhận xét của GVHD (BM04)',
        status,
        statusLabel,
        updatedAt,
        nextActor,
        actions,
    };
};

const buildBM05Summary = (registration, ctx) => {
    const published = isDefenseResultPublished(registration);

    if (!published) {
        const isProcessing = Boolean(registration?.defenseCouncilId)
            || Boolean(registration?.defenseCouncil)
            || Boolean(registration?.defenseSchedulePublishedAt)
            || BM05_PROCESSING_STATUSES.has(ctx.regStatus);

        return {
            code: 'BM05',
            title: 'Kết quả bảo vệ & đánh giá (BM05)',
            status: isProcessing ? 'IN_PROGRESS' : 'NOT_STARTED',
            statusLabel: isProcessing ? 'Đang xử lý' : 'Chưa có kết quả',
            updatedAt: null,
            nextActor: isProcessing ? 'Hội đồng bảo vệ' : null,
            actions: [],
        };
    }

    const pubItems = Array.isArray(registration?.resultPublicationItems) ? registration.resultPublicationItems : [];
    const pubDates = pubItems.flatMap((item) => [item?.publication?.publishedAt, item?.createdAt]);
    const updatedAt = pickLatestDate(
        ...pubDates,
        registration?.defenseResult?.updatedAt,
        registration?.defenseResult?.lockedAt
    );

    return {
        code: 'BM05',
        title: 'Kết quả bảo vệ & đánh giá (BM05)',
        status: 'PUBLISHED',
        statusLabel: 'Đã công bố',
        updatedAt,
        nextActor: null,
        actions: [
            {
                code: 'VIEW_PRINT',
                label: 'Xem kết quả / Bản in',
                params: { registrationId: ctx.registrationId },
            },
        ],
    };
};

const resolveNextAction = (forms, ctx) => {
    const findAction = (formCode, actionCode) =>
        forms.find((f) => f.code === formCode)?.actions.find((a) => a.code === actionCode) || null;

    const bm02aReview = findAction('BM02-A', 'REVIEW');
    if (bm02aReview) return bm02aReview;

    const bm01Review = findAction('BM01', 'REVIEW');
    if (bm01Review) return bm01Review;

    const bm02Review = findAction('BM02', 'REVIEW');
    if (bm02Review) return bm02Review;

    const bm04Review = findAction('BM04', 'REVIEW');
    if (bm04Review) return bm04Review;

    const bm03Open = findAction('BM03', 'OPEN_PROGRESS');
    const isBM03Active = ['DECISION_ISSUED', 'IN_PROGRESS', 'IN_PROGRESS_BM03'].includes(ctx.regStatus)
        || ctx.hasAction('ISSUE_CHECKPOINT_1')
        || ctx.hasAction('ISSUE_CHECKPOINT_2');
    if (bm03Open && isBM03Active) {
        return bm03Open;
    }

    return null;
};

/**
 * Build the guidance workspace summary for a single TopicRegistration and actor.
 *
 * @param {object} registration - TopicRegistration record with loaded BM relations
 * @param {object} actor - Authenticated user object
 * @param {object} [options] - Optional { allowedActions, actorPermissions }
 * @returns {{ nextAction: object|null, forms: Array<object> }}
 */
function buildGuidanceWorkspace(registration, actor, options = {}) {
    const ctx = createContext(registration, actor, options);

    const bm01 = buildBM01Summary(registration, ctx);
    const bm02 = buildBM02Summary(registration, ctx);
    const bm02a = buildBM02ASummary(registration, ctx);
    const bm03 = buildBM03Summary(registration, ctx);
    const bm04 = buildBM04Summary(registration, ctx);
    const bm05 = buildBM05Summary(registration, ctx);

    const forms = [bm01, bm02];
    if (bm02a) {
        forms.push(bm02a);
    }
    forms.push(bm03, bm04, bm05);

    return {
        nextAction: resolveNextAction(forms, ctx),
        forms,
    };
}

module.exports = {
    buildGuidanceWorkspace,
    isDefenseResultPublished,
};
