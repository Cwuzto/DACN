const prisma = require('../config/database');
const { getDefaultSemester } = require('../utils/semesterResolver');

const MAX_STUDENTS_PER_MENTOR = 10;
const DUE_SOON_HOURS = 72;
const EXCLUDED_SUPERVISED_STATUSES = ['REJECTED', 'DROPPED', 'WITHDRAWN'];
const BM01_PENDING_STATUSES = new Set(['BM01_SUBMITTED', 'BM01_RESUBMITTED', 'BM01_NEEDS_REVISION']);

const SEMESTER_SELECT = {
    id: true,
    name: true,
    status: true,
    startDate: true,
    registrationDeadline: true,
    outlineSubmissionDeadline: true,
    endDate: true,
};

const createServiceError = (code, statusCode, message) => {
    const err = new Error(message);
    err.code = code;
    err.statusCode = statusCode;
    return err;
};

const computePriority = (dueAt, now = new Date()) => {
    if (!dueAt) return 'NORMAL';
    const diffMs = new Date(dueAt).getTime() - now.getTime();
    if (diffMs < 0) return 'OVERDUE';
    if (diffMs <= DUE_SOON_HOURS * 60 * 60 * 1000) return 'DUE_SOON';
    return 'NORMAL';
};

const computeBm01DeadlineState = (dueAt, now = new Date()) => {
    if (!dueAt) return 'NO_DEADLINE';
    return now.getTime() >= new Date(dueAt).getTime() ? 'OVERDUE' : 'ON_TRACK';
};

const extractBm01RegistrationId = (dedupeKey) => {
    if (!dedupeKey || typeof dedupeKey !== 'string') return null;
    const parts = dedupeKey.split(':');
    if (parts[0] !== 'bm01' || parts.length < 3) return null;
    const regId = Number.parseInt(parts[2], 10);
    return Number.isInteger(regId) && regId > 0 ? regId : null;
};

/**
 * Xác thực và phân giải học kỳ cho dashboard giảng viên.
 */
async function resolveLecturerSemester({ actorId, requestedSemesterId, db = prisma }) {
    if (requestedSemesterId !== undefined && requestedSemesterId !== null && String(requestedSemesterId).trim() !== '') {
        const raw = String(requestedSemesterId).trim();
        if (!/^\d+$/.test(raw)) {
            throw createServiceError('INVALID_SEMESTER_ID', 400, 'semesterId không hợp lệ.');
        }
        const parsedId = parseInt(raw, 10);
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            throw createServiceError('INVALID_SEMESTER_ID', 400, 'semesterId không hợp lệ.');
        }

        const semester = await db.semester.findUnique({
            where: { id: parsedId },
            select: SEMESTER_SELECT,
        });
        if (!semester) {
            throw createServiceError('SEMESTER_NOT_FOUND', 404, 'Không tìm thấy học kỳ yêu cầu.');
        }
        if (semester.status === 'DRAFT') {
            throw createServiceError('SEMESTER_ACCESS_FORBIDDEN', 403, 'Bạn không có quyền xem học kỳ ở trạng thái nháp.');
        }
        return semester;
    }

    let activeSemester = null;
    if (db === prisma) {
        activeSemester = await getDefaultSemester(SEMESTER_SELECT);
    } else if (typeof db.semester?.findFirst === 'function') {
        activeSemester = await db.semester.findFirst({
            where: { status: { in: ['ONGOING', 'REGISTRATION', 'DEFENSE'] } },
            select: SEMESTER_SELECT,
            orderBy: { startDate: 'desc' },
        });
    }

    if (!activeSemester || !actorId) {
        return activeSemester || null;
    }

    const [topicCount, regCount] = await Promise.all([
        db.topic.count({
            where: { mentorId: actorId, semesterId: activeSemester.id, status: { not: 'REJECTED' } },
        }),
        db.topicRegistration.count({
            where: { semesterId: activeSemester.id, topic: { mentorId: actorId }, status: { not: 'REJECTED' } },
        }),
    ]);

    if (topicCount === 0 && regCount === 0) {
        const fallbackReg = typeof db.topicRegistration?.findFirst === 'function'
            ? await db.topicRegistration.findFirst({
                where: {
                    topic: { mentorId: actorId },
                    semester: { status: { in: ['REGISTRATION', 'ONGOING', 'DEFENSE'] } },
                    status: { not: 'REJECTED' },
                },
                include: { semester: { select: SEMESTER_SELECT } },
                orderBy: { createdAt: 'desc' },
            })
            : null;

        if (fallbackReg?.semester) {
            return fallbackReg.semester;
        }

        const fallbackTopic = typeof db.topic?.findFirst === 'function'
            ? await db.topic.findFirst({
                where: {
                    mentorId: actorId,
                    semester: { status: { in: ['REGISTRATION', 'ONGOING', 'DEFENSE'] } },
                    status: { not: 'REJECTED' },
                },
                include: { semester: { select: SEMESTER_SELECT } },
                orderBy: { createdAt: 'desc' },
            })
            : null;

        if (fallbackTopic?.semester) {
            return fallbackTopic.semester;
        }
    }

    return activeSemester;
}

/**
 * Tổng hợp số liệu, hàng đợi việc cần xử lý và danh sách sinh viên của GVHD trong một học kỳ.
 */
async function buildMentorOverview({ actorId, semesterId, semester = null, now = new Date(), db = prisma }) {
    if (!semesterId || !actorId) {
        return {
            mentorSummary: {
                supervisedCount: 0,
                maxStudents: MAX_STUDENTS_PER_MENTOR,
                pendingFeedbackCount: 0,
                actionableCount: 0,
                upcomingDeadlineCount: 0,
            },
            attentionItems: [],
            watchItems: [],
            students: [],
        };
    }

    const [
        registrations,
        pendingFeedbackCount,
        pendingFeedbackPreview,
        pendingBm02aRequests,
        upcomingDeadlineCount,
        resolvedSemester,
    ] = await Promise.all([
        db.topicRegistration.findMany({
            where: {
                semesterId,
                topic: { mentorId: actorId },
                status: { notIn: EXCLUDED_SUPERVISED_STATUSES },
            },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: { select: { id: true, title: true, mentorId: true } },
                tasks: {
                    where: { status: { not: 'COMPLETED' } },
                    orderBy: { dueDate: 'asc' },
                    take: 3,
                },
                bm01Evaluations: {
                    select: { id: true, submissionId: true },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'asc' },
        }),
        db.submission.count({
            where: {
                feedback: null,
                task: { status: 'SUBMITTED' },
                registration: {
                    semesterId,
                    topic: { mentorId: actorId },
                },
            },
        }),
        db.submission.findMany({
            where: {
                feedback: null,
                task: { status: 'SUBMITTED' },
                registration: {
                    semesterId,
                    topic: { mentorId: actorId },
                },
            },
            include: {
                task: { select: { id: true, title: true } },
                student: { select: { id: true, fullName: true, code: true } },
                registration: {
                    select: {
                        id: true,
                        topic: { select: { title: true } },
                    },
                },
            },
            orderBy: { submittedAt: 'desc' },
            take: 5,
        }),
        typeof db.bM02AAdjustmentRequest?.findMany === 'function'
            ? db.bM02AAdjustmentRequest.findMany({
                where: {
                    status: 'PENDING_ADVISOR',
                    registration: {
                        semesterId,
                        topic: { mentorId: actorId },
                    },
                },
                include: {
                    registration: {
                        select: {
                            id: true,
                            student: { select: { fullName: true, code: true } },
                            topic: { select: { title: true } },
                        },
                    },
                    versions: {
                        orderBy: { versionNumber: 'desc' },
                        take: 1,
                    },
                },
                orderBy: { titleAdjustmentDeadline: 'asc' },
                take: 10,
            })
            : Promise.resolve([]),
        db.task.count({
            where: {
                dueDate: { gt: now },
                registration: {
                    semesterId,
                    topic: { mentorId: actorId },
                    status: { notIn: EXCLUDED_SUPERVISED_STATUSES },
                },
            },
        }),
        semester
            ? Promise.resolve(semester)
            : (typeof db.semester?.findUnique === 'function'
                ? db.semester.findUnique({
                    where: { id: semesterId },
                    select: { id: true, outlineSubmissionDeadline: true },
                })
                : Promise.resolve(null)),
    ]);

    const regList = Array.isArray(registrations) ? registrations : [];
    const previewSubs = Array.isArray(pendingFeedbackPreview) ? pendingFeedbackPreview : [];
    const bm02aRequests = (Array.isArray(pendingBm02aRequests) ? pendingBm02aRequests : [])
        .filter((req) => !req.status || req.status === 'PENDING_ADVISOR');

    const attentionItems = [];
    let pendingRegCount = 0;
    let bm01PendingCount = 0;

    for (const reg of regList) {
        const studentLabel = reg.student?.fullName || reg.student?.code || `SV-${reg.id}`;
        const topicTitle = reg.adjustedTitle || reg.topic?.title || 'Đề tài';

        if (reg.status === 'PENDING') {
            pendingRegCount++;
            attentionItems.push({
                id: `mentor-reg-pending-${reg.id}`,
                source: 'MENTOR',
                kind: 'REGISTRATION_PENDING',
                title: `Duyệt đăng ký đề tài: ${studentLabel}`,
                description: topicTitle,
                semesterId,
                registrationId: reg.id,
                dueAt: null,
                priority: 'NORMAL',
                isActionable: true,
                target: '/lecturer/topics',
                allowedAction: 'REVIEW_REGISTRATION',
            });
        } else if (BM01_PENDING_STATUSES.has(reg.status)) {
            bm01PendingCount++;
            attentionItems.push({
                id: `mentor-bm01-${reg.id}`,
                source: 'MENTOR',
                kind: 'BM01_REVIEW_PENDING',
                title: `Xét duyệt đề cương BM01: ${studentLabel}`,
                description: topicTitle,
                semesterId,
                registrationId: reg.id,
                dueAt: null,
                priority: 'NORMAL',
                isActionable: true,
                target: '/lecturer/progress',
                allowedAction: 'REVIEW_BM01',
            });
        }
    }

    for (const req of bm02aRequests) {
        const studentLabel = req.registration?.student?.fullName || req.registration?.student?.code || 'Sinh viên';
        const currentVersion = Array.isArray(req.versions)
            ? (req.versions.find((v) => v.versionNumber === req.currentVersionNumber) || req.versions[0])
            : null;
        attentionItems.push({
            id: `mentor-bm02a-${req.id}`,
            source: 'MENTOR',
            kind: 'TITLE_ADJUSTMENT_PENDING',
            title: `Duyệt điều chỉnh tên đề tài: ${studentLabel}`,
            description: currentVersion?.proposedTitle || req.registration?.topic?.title || '',
            semesterId,
            requestId: req.id,
            registrationId: req.registrationId,
            dueAt: req.titleAdjustmentDeadline || null,
            priority: computePriority(req.titleAdjustmentDeadline, now),
            isActionable: true,
            target: `/lecturer/title-adjustments?requestId=${req.id}`,
            allowedAction: 'REVIEW_TITLE_ADJUSTMENT',
        });
    }

    for (const sub of previewSubs) {
        const studentLabel = sub.student?.fullName || sub.student?.code || 'Sinh viên';
        attentionItems.push({
            id: `mentor-submission-${sub.id}`,
            source: 'MENTOR',
            kind: 'SUBMISSION_FEEDBACK_PENDING',
            title: `Phản hồi bài nộp: ${sub.task?.title || 'Nhiệm vụ'}`,
            description: `${studentLabel} — ${sub.registration?.topic?.title || 'Đề tài'}`,
            semesterId,
            registrationId: sub.registration?.id || null,
            dueAt: null,
            priority: 'NORMAL',
            isActionable: true,
            target: '/lecturer/submissions',
            allowedAction: 'PROVIDE_FEEDBACK',
        });
    }

    const pendingBm02aByRegId = new Map();
    for (const req of bm02aRequests) {
        if (req.registrationId && !pendingBm02aByRegId.has(req.registrationId)) {
            pendingBm02aByRegId.set(req.registrationId, req);
        }
    }

    const students = regList.map((reg) => {
        const nextTask = Array.isArray(reg.tasks) && reg.tasks.length > 0 ? reg.tasks[0] : null;
        const pendingReq = pendingBm02aByRegId.get(reg.id) || null;
        const bm02aRequestId = pendingReq?.id || null;
        const allowedActions = [];
        if (reg.status === 'PENDING') allowedActions.push('REVIEW_REGISTRATION');
        if (BM01_PENDING_STATUSES.has(reg.status)) allowedActions.push('REVIEW_BM01');
        if (bm02aRequestId) allowedActions.push('REVIEW_TITLE_ADJUSTMENT');

        return {
            registrationId: reg.id,
            studentId: reg.studentId,
            studentName: reg.student?.fullName || '',
            studentCode: reg.student?.code || '',
            topicTitle: reg.adjustedTitle || reg.topic?.title || '',
            status: reg.status,
            nextMilestone: nextTask?.title || null,
            nextMilestoneAt: nextTask?.dueDate || null,
            bm02aRequestId,
            allowedActions,
        };
    });

    const watchRegs = regList.filter(
        (reg) =>
            reg.status === 'APPROVED' &&
            !(Array.isArray(reg.bm01Evaluations) && reg.bm01Evaluations.some((e) => Boolean(e?.submissionId || e?.id)))
    );

    let reminderNotifications = [];
    if (watchRegs.length > 0 && typeof db.notification?.findMany === 'function') {
        const watchStudentIds = Array.from(
            new Set(watchRegs.map((reg) => reg.studentId).filter((id) => Number.isInteger(id)))
        );
        reminderNotifications = await db.notification.findMany({
            where: {
                dedupeKey: { startsWith: 'bm01:' },
                ...(watchStudentIds.length > 0 ? { userId: { in: watchStudentIds } } : {}),
            },
            select: {
                id: true,
                userId: true,
                dedupeKey: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    const lastReminderAtByRegId = new Map();
    for (const notif of Array.isArray(reminderNotifications) ? reminderNotifications : []) {
        const regId = extractBm01RegistrationId(notif?.dedupeKey);
        if (!regId || !notif?.createdAt) continue;
        const notifTime = new Date(notif.createdAt).getTime();
        if (Number.isNaN(notifTime)) continue;
        const existing = lastReminderAtByRegId.get(regId);
        if (!existing || notifTime > new Date(existing).getTime()) {
            lastReminderAtByRegId.set(regId, notif.createdAt);
        }
    }

    const bm01DueAt = resolvedSemester?.outlineSubmissionDeadline || null;
    const bm01DeadlineState = computeBm01DeadlineState(bm01DueAt, now);

    const watchItems = watchRegs.map((reg) => ({
        kind: 'BM01_NOT_SUBMITTED',
        registrationId: reg.id,
        studentId: reg.studentId,
        studentName: reg.student?.fullName || '',
        studentCode: reg.student?.code || '',
        topicTitle: reg.adjustedTitle || reg.topic?.title || '',
        dueAt: bm01DueAt,
        deadlineState: bm01DeadlineState,
        lastReminderAt: lastReminderAtByRegId.get(reg.id) || null,
        target: `/lecturer/students/${reg.id}`,
    }));

    const realPendingFeedback = Number.isInteger(pendingFeedbackCount) ? pendingFeedbackCount : previewSubs.length;
    const actionableCount = realPendingFeedback + pendingRegCount + bm01PendingCount + bm02aRequests.length;

    return {
        mentorSummary: {
            supervisedCount: regList.length,
            maxStudents: MAX_STUDENTS_PER_MENTOR,
            pendingFeedbackCount: realPendingFeedback,
            actionableCount,
            upcomingDeadlineCount: Number.isInteger(upcomingDeadlineCount) ? upcomingDeadlineCount : 0,
        },
        attentionItems,
        watchItems,
        students,
    };
}

/**
 * Hợp nhất dữ liệu GVHD và hàng đợi Viện trưởng có kiểm tra quyền + scope.
 */
async function buildUnifiedLecturerOverview({ actor, semesterId, semester = null, now = new Date(), db = prisma }) {
    const { buildInstituteAttention, sortAndDedupeAttentionItems } = require('./instituteAttentionSource');
    const actorId = actor?.id;

    const [mentorOverview, instituteItems] = await Promise.all([
        buildMentorOverview({ actorId, semesterId, semester, now, db }),
        buildInstituteAttention({ actor, semesterId, now, db }),
    ]);

    const mergedAttention = sortAndDedupeAttentionItems([
        ...(mentorOverview.attentionItems || []),
        ...(instituteItems || []),
    ]);

    const instituteActionableCount = (instituteItems || []).filter((i) => i.isActionable).length;

    return {
        mentorSummary: {
            ...mentorOverview.mentorSummary,
            actionableCount: mentorOverview.mentorSummary.actionableCount + instituteActionableCount,
        },
        attentionItems: mergedAttention,
        watchItems: mentorOverview.watchItems || [],
        students: mentorOverview.students,
    };
}

module.exports = {
    MAX_STUDENTS_PER_MENTOR,
    computePriority,
    resolveLecturerSemester,
    buildMentorOverview,
    buildUnifiedLecturerOverview,
};
