const prisma = require('../config/database');
const { getEffectivePermissions } = require('../auth/capabilityResolver');
const { normalizePermissionCode } = require('../auth/permissionCatalog');
const {
    resolveReportReadScope,
    buildTopicDepartmentWhere,
    buildRegistrationDepartmentWhere,
} = require('../auth/reportReadScope');
const { computePriority } = require('./lecturerOverviewService');

const PRIORITY_RANK = {
    OVERDUE: 0,
    DUE_SOON: 1,
    NORMAL: 2,
    INFO: 3,
};

const WORKFLOW_ORDER = {
    TOPIC_REVIEW: 1,
    OUTLINE_COUNCIL_ASSIGN: 2,
    BM02_REVIEW: 3,
    DEFENSE_COUNCIL_ASSIGN: 4,
    RESULT_LOCK: 5,
    RESULT_APPROVE: 6,
    RESULT_PUBLISH: 7,
};

const normalizeCode = (code) => normalizePermissionCode(code) || code;

const resolveActorActionAccess = ({ actor, semesterId, scope, acceptedPermissions = [] }) => {
    if (!actor || !scope) {
        return { allowed: false, departments: [] };
    }

    const acceptedSet = new Set(acceptedPermissions.map(normalizeCode).filter(Boolean));
    const baseList = Array.isArray(actor.basePermissions)
        ? actor.basePermissions
        : (Array.isArray(actor.permissions) ? actor.permissions : []);

    const hasBasePerm = baseList.some((code) => acceptedSet.has(normalizeCode(code)));
    if (hasBasePerm) {
        return {
            allowed: true,
            departments: scope.global ? null : scope.departments,
        };
    }

    // Check active delegations matching semesterId
    const effectiveNoDept = getEffectivePermissions(actor, { semesterId });
    const hasSemesterWideDelegation = Array.from(acceptedSet).some((code) => effectiveNoDept.has(code));
    if (hasSemesterWideDelegation) {
        return {
            allowed: true,
            departments: scope.global ? null : scope.departments,
        };
    }

    const delegations = Array.isArray(actor.activeDelegations) ? actor.activeDelegations : [];
    const delegatedDepts = new Set();
    for (const delegation of delegations) {
        const canonical = normalizeCode(delegation?.capabilityCode);
        if (!acceptedSet.has(canonical)) continue;
        if (delegation.semesterId !== null && delegation.semesterId !== undefined) {
            if (Number(delegation.semesterId) !== Number(semesterId)) continue;
        }
        const dept = typeof delegation.department === 'string' ? delegation.department.trim() : '';
        if (dept) {
            delegatedDepts.add(dept);
        }
    }

    if (delegatedDepts.size === 0) {
        return { allowed: false, departments: [] };
    }

    if (scope.global) {
        return { allowed: true, departments: Array.from(delegatedDepts) };
    }

    const scopeSet = new Set(scope.departments.map((d) => d.trim().toUpperCase()));
    const intersected = Array.from(delegatedDepts).filter((d) => scopeSet.has(d.trim().toUpperCase()));
    if (intersected.length === 0) {
        return { allowed: false, departments: [] };
    }

    return { allowed: true, departments: intersected };
};

const countUniqueIds = (rows = [], selector = (r) => r?.id) => {
    const ids = new Set();
    for (const row of rows || []) {
        const val = selector(row);
        if (val !== null && val !== undefined) {
            ids.add(val);
        }
    }
    return ids.size;
};

const pickEarliestDueAt = (dates = []) => {
    let earliest = null;
    for (const d of dates) {
        if (!d) continue;
        const parsed = new Date(d);
        if (Number.isNaN(parsed.getTime())) continue;
        if (!earliest || parsed.getTime() < earliest.getTime()) {
            earliest = parsed;
        }
    }
    return earliest ? earliest.toISOString() : null;
};

const buildItem = ({
    kind,
    count,
    title,
    description,
    dueAt = null,
    now,
    target,
    requiredPermission,
    sourceStatus,
}) => ({
    kind,
    count,
    title,
    description,
    dueAt,
    priority: dueAt ? computePriority(dueAt, now) : 'NORMAL',
    target,
    requiredPermission,
    sourceStatus,
});

/**
 * Tổng hợp danh mục việc cần xử lý thuộc thẩm quyền Admin/Viện theo học kỳ và phạm vi quyền của actor.
 */
async function buildAdminDashboardActions({ actor, semesterId, db = prisma, now = new Date(), scope: providedScope = null } = {}) {
    const parsedSemesterId = semesterId !== null && semesterId !== undefined ? Number(semesterId) : null;
    if (!actor || !parsedSemesterId || !Number.isInteger(parsedSemesterId) || parsedSemesterId <= 0) {
        return { semesterId: parsedSemesterId || null, items: [] };
    }

    const scope = providedScope || await resolveReportReadScope({ actor, db });
    if (!scope) {
        return { semesterId: parsedSemesterId, items: [] };
    }

    const items = [];

    // 1. TOPIC_REVIEW: Chỉ đếm Topic ở trạng thái PENDING chờ thẩm định (tuyệt đối không đếm TopicRegistration.PENDING chờ GVHD)
    const topicAccess = resolveActorActionAccess({
        actor,
        semesterId: parsedSemesterId,
        scope,
        acceptedPermissions: ['TOPIC_REVIEW'],
    });
    if (topicAccess.allowed && typeof db.topic?.findMany === 'function') {
        const pendingTopics = await db.topic.findMany({
            where: {
                semesterId: parsedSemesterId,
                status: 'PENDING',
                ...(topicAccess.departments ? buildTopicDepartmentWhere(topicAccess.departments) : {}),
            },
            select: { id: true },
        });
        const count = countUniqueIds(pendingTopics);
        if (count > 0) {
            items.push(buildItem({
                kind: 'TOPIC_REVIEW',
                count,
                title: 'Duyệt đề tài chờ thẩm định',
                description: `${count} đề tài đang chờ thẩm định chuyên môn.`,
                dueAt: null,
                now,
                target: `/admin/topics?status=PENDING&semesterId=${parsedSemesterId}`,
                requiredPermission: 'TOPIC_REVIEW',
                sourceStatus: 'PENDING',
            }));
        }
    }

    // 2. OUTLINE_COUNCIL_ASSIGN: Hồ sơ đã nộp BM01 và chưa có hội đồng đề cương
    const outlineAccess = resolveActorActionAccess({
        actor,
        semesterId: parsedSemesterId,
        scope,
        acceptedPermissions: ['OUTLINE_COUNCIL_MANAGE'],
    });
    if (outlineAccess.allowed && typeof db.topicRegistration?.findMany === 'function') {
        const outlineRegs = await db.topicRegistration.findMany({
            where: {
                semesterId: parsedSemesterId,
                status: 'BM01_SUBMITTED',
                outlineCouncilId: null,
                ...(outlineAccess.departments ? buildRegistrationDepartmentWhere(outlineAccess.departments) : {}),
            },
            select: { id: true },
        });
        const count = countUniqueIds(outlineRegs);
        if (count > 0) {
            items.push(buildItem({
                kind: 'OUTLINE_COUNCIL_ASSIGN',
                count,
                title: 'Phân hội đồng đề cương',
                description: `${count} hồ sơ đã nộp BM01 đủ điều kiện phân hội đồng đề cương.`,
                dueAt: null,
                now,
                target: `/admin/outline-councils?semesterId=${parsedSemesterId}`,
                requiredPermission: 'OUTLINE_COUNCIL_MANAGE',
                sourceStatus: 'BM01_SUBMITTED',
            }));
        }
    }

    // 3. BM02_REVIEW: BM01 đã đạt, BM02 đã nộp và đang chờ thẩm định
    const bm02Access = resolveActorActionAccess({
        actor,
        semesterId: parsedSemesterId,
        scope,
        acceptedPermissions: ['BM02_REVIEW'],
    });
    if (bm02Access.allowed && typeof db.topicRegistration?.findMany === 'function') {
        const bm02Regs = await db.topicRegistration.findMany({
            where: {
                semesterId: parsedSemesterId,
                status: { in: ['BM02_SUBMITTED', 'BM02_RESUBMITTED', 'BM02_EXCEPTION_REVIEW'] },
                ...(bm02Access.departments ? buildRegistrationDepartmentWhere(bm02Access.departments) : {}),
            },
            select: {
                id: true,
                currentBM02Submission: {
                    select: { outcome: true, revisionDeadlineAt: true },
                },
            },
        });
        const eligibleBm02 = (bm02Regs || []).filter((reg) => {
            const outcome = reg?.currentBM02Submission?.outcome;
            return !outcome || outcome === 'PENDING_REVIEW' || outcome === 'EXCEPTION_REVIEW';
        });
        const count = countUniqueIds(eligibleBm02);
        if (count > 0) {
            const dueAt = pickEarliestDueAt(eligibleBm02.map((r) => r?.currentBM02Submission?.revisionDeadlineAt));
            items.push(buildItem({
                kind: 'BM02_REVIEW',
                count,
                title: 'Thẩm định đơn đăng ký BM02',
                description: `${count} hồ sơ BM02 đã nộp đang chờ thẩm định.`,
                dueAt,
                now,
                target: `/admin/project-enrollments?semesterId=${parsedSemesterId}&status=BM02_SUBMITTED`,
                requiredPermission: 'BM02_REVIEW',
                sourceStatus: 'BM02_SUBMITTED',
            }));
        }
    }

    // 4. DEFENSE_COUNCIL_ASSIGN: Chỉ hồ sơ DEFENSE_READY và chưa có hội đồng bảo vệ
    const defenseCouncilAccess = resolveActorActionAccess({
        actor,
        semesterId: parsedSemesterId,
        scope,
        acceptedPermissions: ['DEFENSE_COUNCIL_MANAGE'],
    });
    if (defenseCouncilAccess.allowed && typeof db.topicRegistration?.findMany === 'function') {
        const defenseRegs = await db.topicRegistration.findMany({
            where: {
                semesterId: parsedSemesterId,
                status: 'DEFENSE_READY',
                defenseCouncilId: null,
                councilId: null,
                ...(defenseCouncilAccess.departments ? buildRegistrationDepartmentWhere(defenseCouncilAccess.departments) : {}),
            },
            select: { id: true },
        });
        const count = countUniqueIds(defenseRegs);
        if (count > 0) {
            items.push(buildItem({
                kind: 'DEFENSE_COUNCIL_ASSIGN',
                count,
                title: 'Phân hội đồng bảo vệ',
                description: `${count} hồ sơ sẵn sàng bảo vệ chưa được phân hội đồng.`,
                dueAt: null,
                now,
                target: `/admin/defense-councils?semesterId=${parsedSemesterId}`,
                requiredPermission: 'DEFENSE_COUNCIL_MANAGE',
                sourceStatus: 'DEFENSE_READY',
            }));
        }
    }

    // 5. RESULT_LOCK: Hồ sơ đã có điểm thành viên nhưng chưa khóa sổ điểm
    const lockAccess = resolveActorActionAccess({
        actor,
        semesterId: parsedSemesterId,
        scope,
        acceptedPermissions: ['RESULT_LOCK'],
    });
    if (lockAccess.allowed && typeof db.topicRegistration?.findMany === 'function') {
        const lockCandidates = await db.topicRegistration.findMany({
            where: {
                semesterId: parsedSemesterId,
                status: { in: ['AWAITING_SCORES', 'DEFENDED'] },
                memberScores: { some: {} },
                ...(lockAccess.departments ? buildRegistrationDepartmentWhere(lockAccess.departments) : {}),
            },
            select: {
                id: true,
                defenseCouncil: { select: { scoreBookLocked: true } },
                council: { select: { scoreBookLocked: true } },
                defenseResult: { select: { scoreLocked: true } },
                resultPublicationItems: { select: { id: true } },
            },
        });
        const unlocked = (lockCandidates || []).filter((reg) => {
            const isPublished = Array.isArray(reg.resultPublicationItems) && reg.resultPublicationItems.length > 0;
            if (isPublished) return false;
            const effectiveCouncil = reg.defenseCouncil || reg.council;
            const councilLocked = Boolean(effectiveCouncil?.scoreBookLocked);
            const resultLocked = Boolean(reg.defenseResult?.scoreLocked);
            return !councilLocked && !resultLocked;
        });
        const count = countUniqueIds(unlocked);
        if (count > 0) {
            items.push(buildItem({
                kind: 'RESULT_LOCK',
                count,
                title: 'Khóa sổ điểm bảo vệ',
                description: `${count} hồ sơ đã có điểm hội đồng chờ khóa sổ điểm.`,
                dueAt: null,
                now,
                target: `/admin/grading?tab=lock&semesterId=${parsedSemesterId}`,
                requiredPermission: 'RESULT_LOCK',
                sourceStatus: 'AWAITING_SCORES',
            }));
        }
    }

    // 6. RESULT_APPROVE: Hồ sơ ở trạng thái AWAITING_FINAL_APPROVAL, đã khóa sổ điểm và chưa công bố
    const approveAccess = resolveActorActionAccess({
        actor,
        semesterId: parsedSemesterId,
        scope,
        acceptedPermissions: ['DEFENSE_RESULT_APPROVE'],
    });
    if (approveAccess.allowed && typeof db.topicRegistration?.findMany === 'function') {
        const approveCandidates = await db.topicRegistration.findMany({
            where: {
                semesterId: parsedSemesterId,
                status: 'AWAITING_FINAL_APPROVAL',
                ...(approveAccess.departments ? buildRegistrationDepartmentWhere(approveAccess.departments) : {}),
            },
            select: {
                id: true,
                defenseCouncil: { select: { scoreBookLocked: true } },
                council: { select: { scoreBookLocked: true } },
                defenseResult: { select: { scoreLocked: true } },
                resultPublicationItems: { select: { id: true } },
            },
        });
        const eligibleApprove = (approveCandidates || []).filter((reg) => {
            const isPublished = Array.isArray(reg.resultPublicationItems) && reg.resultPublicationItems.length > 0;
            if (isPublished) return false;
            const effectiveCouncil = reg.defenseCouncil || reg.council;
            const isScoreBookLocked = effectiveCouncil
                ? Boolean(effectiveCouncil.scoreBookLocked)
                : Boolean(reg.defenseResult?.scoreLocked);
            return isScoreBookLocked;
        });
        const count = countUniqueIds(eligibleApprove);
        if (count > 0) {
            items.push(buildItem({
                kind: 'RESULT_APPROVE',
                count,
                title: 'Phê duyệt kết quả bảo vệ',
                description: `${count} hồ sơ đã khóa sổ điểm chờ phê duyệt kết quả.`,
                dueAt: null,
                now,
                target: `/admin/grading?tab=approve&semesterId=${parsedSemesterId}`,
                requiredPermission: 'DEFENSE_RESULT_APPROVE',
                sourceStatus: 'AWAITING_FINAL_APPROVAL',
            }));
        }
    }

    // 7. RESULT_PUBLISH: Kết quả đã phê duyệt hiệu lực nhưng chưa công bố
    const publishAccess = resolveActorActionAccess({
        actor,
        semesterId: parsedSemesterId,
        scope,
        acceptedPermissions: ['RESULT_PUBLICATION_PUBLISH', 'RESULT_PUBLISH'],
    });
    if (publishAccess.allowed && typeof db.defenseResultApproval?.findMany === 'function') {
        const approvals = await db.defenseResultApproval.findMany({
            where: {
                isEffective: true,
                registration: {
                    semesterId: parsedSemesterId,
                    ...(publishAccess.departments ? buildRegistrationDepartmentWhere(publishAccess.departments) : {}),
                },
            },
            select: {
                id: true,
                registrationId: true,
                publicationItems: { select: { id: true } },
            },
        });
        const unpublished = (approvals || []).filter(
            (approval) => !Array.isArray(approval.publicationItems) || approval.publicationItems.length === 0
        );
        const count = countUniqueIds(unpublished, (a) => a?.registrationId ?? a?.id);
        if (count > 0) {
            items.push(buildItem({
                kind: 'RESULT_PUBLISH',
                count,
                title: 'Công bố kết quả bảo vệ',
                description: `${count} kết quả đã phê duyệt chờ công bố chính thức.`,
                dueAt: null,
                now,
                target: `/admin/grading?tab=publish&semesterId=${parsedSemesterId}`,
                requiredPermission: 'RESULT_PUBLICATION_PUBLISH',
                sourceStatus: 'APPROVED_PENDING_PUBLICATION',
            }));
        }
    }

    items.sort((a, b) => {
        const rankA = PRIORITY_RANK[a.priority] ?? 99;
        const rankB = PRIORITY_RANK[b.priority] ?? 99;
        if (rankA !== rankB) return rankA - rankB;

        const timeA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;

        const orderA = WORKFLOW_ORDER[a.kind] ?? 99;
        const orderB = WORKFLOW_ORDER[b.kind] ?? 99;
        return orderA - orderB;
    });

    const buildAdminSemesterRoadmap = async ({ semesterId: semId, scope: readScope, db: database, now: currentTime }) => {
        const refNow = currentTime instanceof Date ? currentTime : new Date(currentTime || Date.now());
        const deptFilter = readScope && !readScope.global && Array.isArray(readScope.departments)
            ? buildRegistrationDepartmentWhere(readScope.departments)
            : {};

        const semester = typeof database.semester?.findUnique === 'function'
            ? await database.semester.findUnique({
                where: { id: semId },
                select: {
                    id: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                    registrationDeadline: true,
                    outlineSubmissionOpenAt: true,
                    outlineSubmissionDeadline: true,
                    midtermReportDate: true,
                    bm03MidtermEvaluationOpenAt: true,
                    bm03FinalizationOpenAt: true,
                    defenseDate: true,
                },
            })
            : null;

        let statusCounts = new Map();
        if (typeof database.topicRegistration?.groupBy === 'function') {
            const grouped = await database.topicRegistration.groupBy({
                by: ['status'],
                where: {
                    semesterId: semId,
                    status: { notIn: ['REJECTED', 'DROPPED', 'WITHDRAWN'] },
                    ...deptFilter,
                },
                _count: { id: true },
            });
            statusCounts = new Map((grouped || []).map((row) => [row.status, row._count?.id || 0]));
        }

        const sumStatuses = (statuses) => statuses.reduce((acc, st) => acc + (statusCounts.get(st) || 0), 0);

        const stage1Count = sumStatuses(['PENDING', 'APPROVED', 'REGISTERED']);
        const stage2Count = sumStatuses(['BM01_SUBMITTED', 'BM01_NEEDS_REVISION', 'BM01_RESUBMITTED', 'BM01_PASSED']);
        const stage3Count = sumStatuses(['BM02_OPEN', 'BM02_SUBMITTED', 'BM02_NEEDS_REVISION', 'BM02_REVISION_REQUIRED', 'BM02_RESUBMITTED', 'BM02_APPROVED', 'BM02_EXCEPTION_REVIEW', 'DECISION_ISSUED']);
        const stage4Count = sumStatuses(['IN_PROGRESS', 'IN_PROGRESS_BM03', 'BM03_SIGNATURE_PENDING', 'CHECKPOINT_SIGNATURE_APPEAL_OPEN', 'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED', 'CHECKPOINT_SIGNATURE_APPEAL_REVIEW', 'SIGNATURE_APPEAL_RESOLVED', 'BM03_PASSED']);
        const stage5Count = sumStatuses(['BM04_REVIEW', 'DEFENSE_READY', 'DEFENSE_ELIGIBLE', 'ELIGIBLE_BY_INSTITUTE']);
        const stage6Count = sumStatuses(['AWAITING_SCORES', 'AWAITING_FINAL_APPROVAL', 'DEFENDED', 'DEFENSE_PASSED', 'PENDING_INSTITUTE_SIGNATURE', 'ARCHIVE_INCOMPLETE', 'ARCHIVE_REJECTED', 'COMPLETED']);

        const deriveStageState = (count, downstreamCount, dateVal) => {
            if (downstreamCount > 0 && count === 0) return 'COMPLETED';
            if (count > 0) return 'ACTIVE';
            if (dateVal && new Date(dateVal).getTime() <= refNow.getTime()) return 'COMPLETED';
            return 'UPCOMING';
        };

        return [
            {
                step: 1,
                key: 'REGISTRATION',
                title: '1. Đăng ký đề tài',
                date: semester?.registrationDeadline || semester?.startDate || null,
                datePrefix: semester?.registrationDeadline ? 'Hạn ĐK' : 'Bắt đầu',
                count: stage1Count,
                state: deriveStageState(stage1Count, stage2Count + stage3Count + stage4Count + stage5Count + stage6Count, semester?.registrationDeadline),
                target: `/admin/project-enrollments?semesterId=${semId}`,
            },
            {
                step: 2,
                key: 'BM01',
                title: '2. Đề cương BM01',
                date: semester?.outlineSubmissionDeadline || semester?.outlineSubmissionOpenAt || null,
                datePrefix: semester?.outlineSubmissionDeadline ? 'Hạn nộp' : 'Mở nộp',
                count: stage2Count,
                state: deriveStageState(stage2Count, stage3Count + stage4Count + stage5Count + stage6Count, semester?.outlineSubmissionDeadline),
                target: `/admin/outline-councils?semesterId=${semId}`,
            },
            {
                step: 3,
                key: 'BM02',
                title: '3. Đơn BM02 & QĐ',
                date: null,
                datePrefix: 'Mốc',
                count: stage3Count,
                state: deriveStageState(stage3Count, stage4Count + stage5Count + stage6Count, null),
                target: `/admin/project-enrollments?semesterId=${semId}`,
            },
            {
                step: 4,
                key: 'BM03',
                title: '4. Tiến độ BM03',
                date: semester?.bm03MidtermEvaluationOpenAt || semester?.midtermReportDate || null,
                datePrefix: 'Giữa kỳ',
                count: stage4Count,
                state: deriveStageState(stage4Count, stage5Count + stage6Count, semester?.bm03FinalizationOpenAt),
                target: `/admin/oversight?semesterId=${semId}`,
            },
            {
                step: 5,
                key: 'BM04',
                title: '5. Nhận xét BM04',
                date: semester?.bm03FinalizationOpenAt || null,
                datePrefix: 'Mở từ',
                count: stage5Count,
                state: deriveStageState(stage5Count, stage6Count, null),
                target: `/admin/defense-councils?semesterId=${semId}`,
            },
            {
                step: 6,
                key: 'BM05',
                title: '6. Bảo vệ & Lưu chiểu',
                date: semester?.defenseDate || semester?.endDate || null,
                datePrefix: semester?.defenseDate ? 'Dự kiến' : 'Kết thúc',
                count: stage6Count,
                state: stage6Count > 0 ? (semester?.status === 'COMPLETED' || semester?.status === 'FINISHED' ? 'COMPLETED' : 'ACTIVE') : 'UPCOMING',
                target: `/admin/grading?semesterId=${semId}`,
            },
        ];
    };

    const roadmap = await buildAdminSemesterRoadmap({
        semesterId: parsedSemesterId,
        scope,
        db,
        now,
    });

    return {
        semesterId: parsedSemesterId,
        items,
        roadmap,
    };
}

module.exports = {
    buildAdminDashboardActions,
};
