const prisma = require('../config/database');
const { validateAcademicScope } = require('./academicScopeService');
const { computePriority } = require('./lecturerOverviewService');

const PRIORITY_RANK = {
    OVERDUE: 0,
    DUE_SOON: 1,
    NORMAL: 2,
    INFO: 3,
};

const INSTITUTE_BM02_CAPS = ['BM02_REVIEW', 'BM02A_FINAL_APPROVE', 'PROJECT_ASSIGNMENT_PUBLISH'];
const INSTITUTE_COUNCIL_CAPS = ['DEFENSE_COUNCIL_MANAGE', 'OUTLINE_COUNCIL_MANAGE', 'DEFENSE_SCHEDULE_PUBLISH'];
const INSTITUTE_PUBLICATION_CAPS = ['DEFENSE_RESULT_APPROVE', 'RESULT_PUBLICATION_PUBLISH'];

const hasAnyCap = (actor, caps) => {
    if (!actor) return false;
    if (actor.role === 'ADMIN') return true;
    const perms = Array.isArray(actor.permissions) ? actor.permissions : [];
    return caps.some((c) => perms.includes(c));
};

const checkRegistrationScope = async (db, { actor, registrationId, capabilityCode, now }) => {
    if (actor.role === 'ADMIN') return true;
    try {
        await validateAcademicScope(db, {
            actorId: actor.id,
            registrationId,
            capabilityCode,
            now,
        });
        return true;
    } catch {
        return false;
    }
};

const sanitizeNotificationTarget = (referenceUrl) => {
    if (typeof referenceUrl === 'string' && referenceUrl.startsWith('/') && !referenceUrl.startsWith('//')) {
        return referenceUrl;
    }
    return '/lecturer/notifications';
};

/**
 * Sắp xếp và khử trùng lặp hàng đợi theo kind + resourceId + allowedAction.
 */
function sortAndDedupeAttentionItems(items = []) {
    const seen = new Set();
    const unique = [];

    for (const item of items) {
        if (!item) continue;
        const key = `${item.kind || ''}::${item.resourceId ?? item.registrationId ?? item.id}::${item.allowedAction || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
    }

    return unique.sort((a, b) => {
        const rankA = PRIORITY_RANK[a.priority] ?? 99;
        const rankB = PRIORITY_RANK[b.priority] ?? 99;
        if (rankA !== rankB) return rankA - rankB;

        const timeA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;

        return String(a.id || '').localeCompare(String(b.id || ''));
    });
}

/**
 * Tổng hợp việc thuộc thẩm quyền Viện trưởng (có kiểm tra capability + scope) và thông báo cá nhân.
 */
async function buildInstituteAttention({ actor, semesterId, now = new Date(), db = prisma }) {
    if (!actor || !actor.id) return [];

    const items = [];
    const canBm02 = Boolean(semesterId) && hasAnyCap(actor, INSTITUTE_BM02_CAPS);
    const canCouncil = Boolean(semesterId) && hasAnyCap(actor, INSTITUTE_COUNCIL_CAPS);
    const canPublish = Boolean(semesterId) && hasAnyCap(actor, INSTITUTE_PUBLICATION_CAPS);
    const isInstituteActor = canBm02 || canCouncil || canPublish;

    // 1. BM02 chờ thẩm định / ban hành quyết định
    if (canBm02 && typeof db.topicRegistration?.findMany === 'function') {
        const bm02Regs = await db.topicRegistration.findMany({
            where: {
                semesterId,
                status: { in: ['BM02_SUBMITTED', 'BM02_RESUBMITTED', 'BM02_EXCEPTION_REVIEW', 'BM02_APPROVED'] },
            },
            include: {
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
            },
            orderBy: { updatedAt: 'asc' },
            take: 10,
        });

        for (const reg of bm02Regs || []) {
            const isApproved = reg.status === 'BM02_APPROVED';
            const cap = isApproved ? 'PROJECT_ASSIGNMENT_PUBLISH' : 'BM02_REVIEW';
            const inScope = await checkRegistrationScope(db, {
                actor,
                registrationId: reg.id,
                capabilityCode: cap,
                now,
            });
            if (!inScope) continue;

            const studentLabel = reg.student?.fullName || reg.student?.code || `SV-${reg.id}`;
            items.push({
                id: `institute-bm02-${reg.id}`,
                source: 'INSTITUTE_DIRECTOR',
                kind: isApproved ? 'DECISION_ISSUE_PENDING' : 'BM02_REVIEW_PENDING',
                resourceId: reg.id,
                title: isApproved
                    ? `Ban hành QĐ giao đề tài: ${studentLabel}`
                    : `Thẩm định BM02: ${studentLabel}`,
                description: reg.topic?.title || 'Hồ sơ đăng ký đề tài',
                semesterId,
                registrationId: reg.id,
                dueAt: null,
                priority: 'NORMAL',
                isActionable: true,
                target: '/lecturer/institute',
                allowedAction: isApproved ? 'ISSUE_DECISION' : 'REVIEW_BM02',
            });
        }
    }

    // 2. Hội đồng chưa công bố lịch
    if (canCouncil && typeof db.council?.findMany === 'function') {
        const councils = await db.council.findMany({
            where: {
                semesterId,
                schedulePublishedAt: null,
            },
            orderBy: { defenseDate: 'asc' },
            take: 10,
        });

        for (const council of councils || []) {
            const isOutline = council.councilType === 'OUTLINE_REVIEW';
            const requiredCap = isOutline ? 'OUTLINE_COUNCIL_MANAGE' : 'DEFENSE_COUNCIL_MANAGE';
            if (!hasAnyCap(actor, [requiredCap, 'DEFENSE_SCHEDULE_PUBLISH'])) continue;

            items.push({
                id: `institute-council-${council.id}`,
                source: 'INSTITUTE_DIRECTOR',
                kind: 'COUNCIL_SCHEDULE_PENDING',
                resourceId: council.id,
                title: `Công bố lịch ${isOutline ? 'HĐ xét duyệt đề cương' : 'HĐ bảo vệ'}: ${council.name}`,
                description: council.defenseDate ? 'Đã ấn định ngày họp, chờ công bố lịch' : 'Chờ xếp lịch hội đồng',
                semesterId,
                dueAt: council.defenseDate || null,
                priority: computePriority(council.defenseDate, now),
                isActionable: true,
                target: isOutline ? '/admin/outline-councils' : '/admin/defense-councils',
                allowedAction: 'PUBLISH_SCHEDULE',
            });
        }
    }

    // 3. Kết quả bảo vệ chờ phê duyệt / công bố (tuyệt đối không select điểm BM05 chưa công bố)
    if (canPublish && typeof db.topicRegistration?.findMany === 'function') {
        const awaitingRegs = await db.topicRegistration.findMany({
            where: {
                semesterId,
                status: 'AWAITING_FINAL_APPROVAL',
            },
            select: {
                id: true,
                semesterId: true,
                status: true,
                updatedAt: true,
                student: { select: { fullName: true, code: true } },
                topic: { select: { title: true } },
            },
            orderBy: { updatedAt: 'asc' },
            take: 10,
        });

        for (const reg of awaitingRegs || []) {
            const inScope = await checkRegistrationScope(db, {
                actor,
                registrationId: reg.id,
                capabilityCode: 'DEFENSE_RESULT_APPROVE',
                now,
            });
            if (!inScope) continue;

            const studentLabel = reg.student?.fullName || reg.student?.code || `SV-${reg.id}`;
            items.push({
                id: `institute-approval-${reg.id}`,
                source: 'INSTITUTE_DIRECTOR',
                kind: 'DEFENSE_RESULT_APPROVAL_PENDING',
                resourceId: reg.id,
                title: `Phê duyệt công bố kết quả: ${studentLabel}`,
                description: reg.topic?.title || 'Hồ sơ chờ phê duyệt kết quả bảo vệ',
                semesterId,
                registrationId: reg.id,
                dueAt: null,
                priority: 'NORMAL',
                isActionable: true,
                target: '/admin/grading',
                allowedAction: 'APPROVE_DEFENSE_RESULT',
            });
        }
    }

    // 4. Thông báo cá nhân của actor (chỉ đọc, không deadline, không biến isRead thành trạng thái hoàn thành)
    if (typeof db.notification?.findMany === 'function') {
        const notifications = await db.notification.findMany({
            where: { userId: actor.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        for (const notif of notifications || []) {
            items.push({
                id: `notification-${notif.id}`,
                source: isInstituteActor ? 'INSTITUTE_DIRECTOR' : 'MENTOR',
                kind: 'NOTIFICATION',
                resourceId: notif.id,
                title: notif.title,
                description: notif.content,
                semesterId: null,
                dueAt: null,
                priority: 'INFO',
                isActionable: false,
                isRead: Boolean(notif.isRead),
                target: sanitizeNotificationTarget(notif.referenceUrl),
            });
        }
    }

    return sortAndDedupeAttentionItems(items);
}

module.exports = {
    buildInstituteAttention,
    sortAndDedupeAttentionItems,
};
