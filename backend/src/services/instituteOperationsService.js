const prismaDefault = require('../config/database');
const { getEffectivePermissions } = require('../auth/capabilityResolver');
const { normalizePermissionCode } = require('../auth/permissionCatalog');
const { resolveResourceScope } = require('../auth/resourceScopeResolver');
const { validateAcademicScope } = require('./academicScopeService');
const { isApprovalEvidenceCurrent } = require('./defenseResultPublicationService');

const VALID_TABS = Object.freeze(['review', 'decisions', 'publish']);
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const TAB_CAPABILITIES = Object.freeze({
    review: [
        'VIEW_BM02_REVIEWS',
        'BM02_REVIEW',
        'VIEW_CHECKPOINTS',
        'BM03_STOP_REVIEW',
        'BM04_REVIEW',
        'VIEW_BM04_EVALUATIONS',
        'BM04_REJECTION_REVIEW',
        'SIGNATURE_APPEAL_REVIEW',
    ],
    decisions: [
        'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'PROJECT_ASSIGNMENT_PUBLISH',
        'TOPIC_ASSIGNMENT_DECISION_ISSUE',
        'BM02A_FINAL_APPROVE',
        'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
        'VIEW_CLEARANCE_CERTIFICATES',
        'CLEARANCE_CERTIFICATE_SIGN',
        'VIEW_DEFENSE_RESULTS_APPROVAL',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'DEFENSE_SCORE_VIEW',
        'DEFENSE_RESULT_APPROVE',
    ],
    publish: [
        'VIEW_DEFENSE_ASSIGNMENTS',
        'VIEW_COUNCIL_ASSIGNMENTS',
        'DEFENSE_COUNCIL_MANAGE',
        'VIEW_RESULT_PUBLICATIONS',
        'RESULT_PUBLICATION_PUBLISH',
    ],
});

class InstituteOperationsError extends Error {
    constructor(code, statusCode, message) {
        super(message || code);
        this.name = 'InstituteOperationsError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

function normalizeCode(code) {
    return normalizePermissionCode(code) || code;
}

function buildActorIdentity(actor) {
    if (!actor || typeof actor !== 'object') return null;
    const baseSource = Array.isArray(actor.basePermissions)
        ? actor.basePermissions
        : (Array.isArray(actor.permissions) ? actor.permissions : []);
    return {
        ...actor,
        basePermissions: baseSource.map(normalizeCode).filter(Boolean),
        activeDelegations: Array.isArray(actor.activeDelegations) ? actor.activeDelegations : [],
    };
}

function getScopedEffectivePermissions(actor, scope = {}) {
    const normalizedActor = buildActorIdentity(actor);
    if (!normalizedActor) return new Set();
    return getEffectivePermissions(normalizedActor, scope);
}

function hasAnyCapability(permSet, codes = []) {
    return codes.some((code) => permSet.has(normalizeCode(code)));
}

function hasActorTabAccess(actor, tab, semesterId = null) {
    const normalizedActor = buildActorIdentity(actor);
    if (!normalizedActor || !normalizedActor.id) return false;

    const requiredCaps = (TAB_CAPABILITIES[tab] || []).map(normalizeCode);
    const baseSet = new Set(normalizedActor.basePermissions);
    if (requiredCaps.some((cap) => baseSet.has(cap))) {
        return true;
    }

    return normalizedActor.activeDelegations.some((delegation) => {
        if (
            delegation.semesterId !== null &&
            delegation.semesterId !== undefined &&
            semesterId !== null &&
            semesterId !== undefined &&
            Number(delegation.semesterId) !== Number(semesterId)
        ) {
            return false;
        }
        const canonical = normalizeCode(delegation.capabilityCode);
        return requiredCaps.includes(canonical);
    });
}

function matchesDepartment(actorDept, resourceDept) {
    if (!resourceDept) return true;
    if (!actorDept) return false;
    return String(actorDept).trim().toUpperCase() === String(resourceDept).trim().toUpperCase();
}

async function resolveRegistrationScopeInfo({ db, registrationId, fallbackSemesterId, fallbackDepartment }) {
    if (fallbackSemesterId && fallbackDepartment !== undefined) {
        return {
            semesterId: fallbackSemesterId,
            department: fallbackDepartment || null,
        };
    }
    const resolved = await resolveResourceScope({
        resourceType: 'REGISTRATION',
        resourceId: registrationId,
        db,
    });
    if (!resolved) {
        return {
            semesterId: fallbackSemesterId || null,
            department: fallbackDepartment || null,
        };
    }
    return {
        semesterId: resolved.semesterId || fallbackSemesterId || null,
        department: resolved.department || fallbackDepartment || null,
    };
}

async function checkRegistrationCapability({
    actor,
    db,
    registrationId,
    semesterId,
    department,
    capabilityCodes,
    now,
}) {
    const scopeInfo = await resolveRegistrationScopeInfo({
        db,
        registrationId,
        fallbackSemesterId: semesterId,
        fallbackDepartment: department,
    });

    if (
        semesterId !== null &&
        semesterId !== undefined &&
        scopeInfo.semesterId !== null &&
        scopeInfo.semesterId !== undefined &&
        Number(scopeInfo.semesterId) !== Number(semesterId)
    ) {
        return false;
    }

    const effective = getScopedEffectivePermissions(actor, {
        semesterId: scopeInfo.semesterId,
        department: scopeInfo.department,
    });

    const matchingCaps = capabilityCodes
        .map(normalizeCode)
        .filter((cap) => effective.has(cap));

    if (matchingCaps.length === 0) return false;

    if (!scopeInfo.department) return true;
    if (matchesDepartment(actor.department, scopeInfo.department)) return true;

    const canUseDbValidation =
        typeof db?.user?.findUnique === 'function' &&
        typeof db?.topicRegistration?.findUnique === 'function';

    for (const cap of matchingCaps) {
        if (canUseDbValidation) {
            try {
                await validateAcademicScope(db, {
                    actorId: actor.id,
                    registrationId,
                    capabilityCode: cap,
                    now,
                });
                return true;
            } catch (_) {
                // Continue checking remaining matching capabilities
            }
        } else {
            const hasDelegation = (actor.activeDelegations || []).some((d) => {
                const canonical = normalizeCode(d.capabilityCode);
                if (canonical !== cap) return false;
                if (
                    d.semesterId !== null &&
                    d.semesterId !== undefined &&
                    Number(d.semesterId) !== Number(scopeInfo.semesterId)
                ) {
                    return false;
                }
                return matchesDepartment(d.department, scopeInfo.department);
            });
            if (hasDelegation) return true;
        }
    }

    return false;
}

function getStudentLabel(registration) {
    return (
        registration?.student?.fullName ||
        registration?.student?.code ||
        `SV-${registration?.id || 'N/A'}`
    );
}

function getTopicTitle(registration) {
    return (
        registration?.adjustedTitle ||
        registration?.bm01ApprovedTitleSnapshot ||
        registration?.topic?.title ||
        'Đề tài đồ án'
    );
}

function getDepartmentFromRegistration(registration) {
    return (
        registration?.topic?.mentor?.department ||
        registration?.topic?.proposedBy?.department ||
        null
    );
}

async function resolveSemester(db, semesterId) {
    if (semesterId !== undefined && semesterId !== null && semesterId !== '') {
        const parsed = Number(semesterId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new InstituteOperationsError('INVALID_SEMESTER_ID', 400, 'semesterId phải là số nguyên dương.');
        }
        const semester = await db.semester.findUnique({
            where: { id: parsed },
            include: { lockedDefenseRubricVersion: true },
        });
        if (!semester) {
            throw new InstituteOperationsError('SEMESTER_NOT_FOUND', 404, 'Không tìm thấy học kỳ.');
        }
        return semester;
    }

    if (typeof db.semester?.findFirst !== 'function') return null;

    const active = await db.semester.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        include: { lockedDefenseRubricVersion: true },
    });
    if (active) return active;

    return db.semester.findFirst({
        orderBy: { startDate: 'desc' },
        include: { lockedDefenseRubricVersion: true },
    });
}

// ==========================================
// TAB 1: REVIEW QUEUE SOURCES
// ==========================================

async function collectBM02ReviewItems({ actor, semesterId, db, now }) {
    if (typeof db.bM02Submission?.findMany !== 'function') return [];

    const viewCaps = ['VIEW_BM02_REVIEWS', 'BM02_REVIEW'];
    const actionCaps = ['BM02_REVIEW'];

    const submissions = await db.bM02Submission.findMany({
        where: {
            outcome: { in: ['PENDING_REVIEW', 'EXCEPTION_REVIEW'] },
            currentForRegistration: {
                is: { semesterId },
            },
        },
        include: {
            registration: {
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, department: true } },
                            proposedBy: { select: { id: true, department: true } },
                        },
                    },
                },
            },
        },
        orderBy: { submittedAt: 'asc' },
    });

    const items = [];
    for (const sub of submissions || []) {
        const reg = sub.registration;
        if (!reg) continue;
        const department = getDepartmentFromRegistration(reg);

        const canView = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: viewCaps,
            now,
        });
        if (!canView) continue;

        const canAct = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: actionCaps,
            now,
        });

        const allowedActions = [];
        if (canAct) {
            if (sub.outcome === 'PENDING_REVIEW' && reg.status !== 'BM02_EXCEPTION_REVIEW') {
                allowedActions.push('APPROVE_BM02', 'REQUEST_BM02_REVISION', 'MARK_BM02_EXCEPTION');
            } else if (sub.outcome === 'EXCEPTION_REVIEW' || reg.status === 'BM02_EXCEPTION_REVIEW') {
                allowedActions.push('APPROVE_BM02', 'REQUEST_BM02_REVISION');
            }
        }

        items.push({
            id: `bm02-submission-${sub.id}`,
            kind: 'BM02_REVIEW',
            resourceId: sub.id,
            registrationId: reg.id,
            title: `Thẩm định BM02 (${sub.attemptNo > 1 ? `Nộp lại lần ${sub.attemptNo}` : 'Lần 1'}): ${getStudentLabel(reg)}`,
            subtitle: sub.bm02ProposedTitle || getTopicTitle(reg),
            status: sub.outcome,
            dueAt: sub.revisionDeadlineAt || null,
            allowedActions,
            detailTarget: `/lecturer/institute?tab=review&kind=BM02_REVIEW&resourceId=${sub.id}`,
            department,
            attemptNo: sub.attemptNo,
            submittedAt: sub.submittedAt || null,
        });
    }
    return items;
}

async function collectBM03StopReviewItems({ actor, semesterId, db, now }) {
    if (typeof db.instituteStopReview?.findMany !== 'function') return [];

    const viewCaps = ['VIEW_CHECKPOINTS', 'BM03_STOP_REVIEW'];
    const actionCaps = ['BM03_STOP_REVIEW'];

    const stopReviews = await db.instituteStopReview.findMany({
        where: {
            status: { in: ['STOP_REVIEW_PENDING', 'MORE_INFO_REQUIRED'] },
            registration: { semesterId },
        },
        include: {
            registration: {
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, department: true } },
                            proposedBy: { select: { id: true, department: true } },
                        },
                    },
                },
            },
        },
        orderBy: { stopReviewDeadline: 'asc' },
    });

    const items = [];
    for (const review of stopReviews || []) {
        const reg = review.registration;
        if (!reg) continue;
        const department = getDepartmentFromRegistration(reg);

        const canView = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: viewCaps,
            now,
        });
        if (!canView) continue;

        const canAct = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: actionCaps,
            now,
        });

        const allowedActions = [];
        if (canAct) {
            if (review.status === 'STOP_REVIEW_PENDING') {
                allowedActions.push('REQUEST_MORE_INFO', 'DECIDE_STOP_REVIEW');
            } else if (review.status === 'MORE_INFO_REQUIRED') {
                allowedActions.push('DECIDE_STOP_REVIEW');
            }
        }

        items.push({
            id: `bm03-stop-review-${review.id}`,
            kind: 'BM03_STOP_REVIEW',
            resourceId: review.id,
            registrationId: reg.id,
            title: `Thẩm định dừng đề tài BM03 (${review.stage}): ${getStudentLabel(reg)}`,
            subtitle: getTopicTitle(reg),
            status: review.status,
            dueAt: review.stopReviewDeadline || null,
            allowedActions,
            detailTarget: `/lecturer/institute?tab=review&kind=BM03_STOP_REVIEW&resourceId=${review.id}`,
            department,
            submittedAt: review.stopProposalSubmittedAt || null,
        });
    }
    return items;
}

async function collectBM04DefenseReviewItems({ actor, semesterId, db, now }) {
    if (typeof db.instituteDefenseReview?.findMany !== 'function') return [];

    const viewCaps = ['BM04_REVIEW', 'VIEW_BM04_EVALUATIONS', 'BM04_REJECTION_REVIEW'];
    const actionCaps = ['BM04_REJECTION_REVIEW'];

    const defenseReviews = await db.instituteDefenseReview.findMany({
        where: {
            status: 'PENDING_INSTITUTE_REVIEW',
            registration: { semesterId },
        },
        include: {
            registration: {
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, department: true } },
                            proposedBy: { select: { id: true, department: true } },
                        },
                    },
                },
            },
        },
        orderBy: { reviewDeadlineAt: 'asc' },
    });

    const items = [];
    for (const review of defenseReviews || []) {
        const reg = review.registration;
        if (!reg) continue;
        const department = getDepartmentFromRegistration(reg);

        const canView = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: viewCaps,
            now,
        });
        if (!canView) continue;

        const canAct = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: actionCaps,
            now,
        });

        const allowedActions = canAct
            ? ['REQUEST_MORE_INFO', 'DECIDE_DEFENSE_REVIEW']
            : [];

        items.push({
            id: `bm04-defense-review-${review.id}`,
            kind: 'BM04_REJECTION_REVIEW',
            resourceId: review.id,
            registrationId: reg.id,
            title: `Thẩm định đề nghị không cho bảo vệ BM04: ${getStudentLabel(reg)}`,
            subtitle: getTopicTitle(reg),
            status: review.status,
            dueAt: review.reviewDeadlineAt || null,
            allowedActions,
            detailTarget: `/lecturer/institute?tab=review&kind=BM04_REJECTION_REVIEW&resourceId=${review.id}`,
            department,
            submittedAt: review.submittedAt || null,
        });
    }
    return items;
}

async function collectSignatureAppealItems({ actor, semesterId, db, now }) {
    if (typeof db.checkpointSignatureAppeal?.findMany !== 'function') return [];

    const viewCaps = ['VIEW_CHECKPOINTS', 'SIGNATURE_APPEAL_REVIEW'];
    const actionCaps = ['SIGNATURE_APPEAL_REVIEW'];

    const appeals = await db.checkpointSignatureAppeal.findMany({
        where: {
            status: { in: ['PENDING', 'SUBMITTED'] },
            registration: { semesterId },
        },
        include: {
            registration: {
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, department: true } },
                            proposedBy: { select: { id: true, department: true } },
                        },
                    },
                },
            },
        },
        orderBy: { appealDeadlineAt: 'asc' },
    });

    const items = [];
    for (const appeal of appeals || []) {
        const reg = appeal.registration;
        if (!reg) continue;
        const department = getDepartmentFromRegistration(reg);

        const canView = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: viewCaps,
            now,
        });
        if (!canView) continue;

        const canAct = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: actionCaps,
            now,
        });

        const isMentor = reg.topic?.mentorId && Number(reg.topic.mentorId) === Number(actor.id);
        const isReviewableRegStatus = [
            'CHECKPOINT_SIGNATURE_APPEAL_SUBMITTED',
            'CHECKPOINT_SIGNATURE_APPEAL_REVIEW',
        ].includes(reg.status);

        const allowedActions =
            canAct && !isMentor && isReviewableRegStatus
                ? ['REVIEW_SIGNATURE_APPEAL']
                : [];

        items.push({
            id: `signature-appeal-${appeal.id}`,
            kind: 'SIGNATURE_APPEAL_REVIEW',
            resourceId: appeal.id,
            registrationId: reg.id,
            title: `Khiếu nại chữ ký checkpoint: ${getStudentLabel(reg)}`,
            subtitle: getTopicTitle(reg),
            status: appeal.status,
            dueAt: appeal.appealDeadlineAt || null,
            allowedActions,
            detailTarget: `/lecturer/institute?tab=review&kind=SIGNATURE_APPEAL_REVIEW&resourceId=${appeal.id}`,
            department,
            submittedAt: appeal.submittedAt || appeal.createdAt || null,
        });
    }
    return items;
}

// ==========================================
// TAB 2: DECISIONS QUEUE SOURCES
// ==========================================

async function collectAssignmentDecisionItems({ actor, semesterId, db, now }) {
    const viewCaps = [
        'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'PROJECT_ASSIGNMENT_PUBLISH',
        'TOPIC_ASSIGNMENT_DECISION_ISSUE',
    ];
    const actionCaps = ['PROJECT_ASSIGNMENT_PUBLISH', 'TOPIC_ASSIGNMENT_DECISION_ISSUE'];

    const items = [];

    if (typeof db.topicAssignmentDecision?.findMany === 'function') {
        const draftDecisions = await db.topicAssignmentDecision.findMany({
            where: {
                semesterId,
                status: 'DRAFT',
            },
            include: {
                items: {
                    include: {
                        registration: {
                            include: {
                                topic: {
                                    include: {
                                        mentor: { select: { department: true } },
                                        proposedBy: { select: { department: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        for (const decision of draftDecisions || []) {
            const firstReg = decision.items?.[0]?.registration;
            const department = firstReg ? getDepartmentFromRegistration(firstReg) : null;
            const effective = getScopedEffectivePermissions(actor, { semesterId, department });

            const canView = hasAnyCapability(effective, viewCaps) &&
                (!department || matchesDepartment(actor.department, department) ||
                    (actor.activeDelegations || []).some((d) =>
                        viewCaps.map(normalizeCode).includes(normalizeCode(d.capabilityCode)) &&
                        matchesDepartment(d.department, department)));

            if (!canView) continue;

            const canAct = hasAnyCapability(effective, actionCaps) &&
                (!department || matchesDepartment(actor.department, department) ||
                    (actor.activeDelegations || []).some((d) =>
                        actionCaps.map(normalizeCode).includes(normalizeCode(d.capabilityCode)) &&
                        matchesDepartment(d.department, department)));

            items.push({
                id: `topic-decision-${decision.id}`,
                kind: 'ASSIGNMENT_DECISION',
                resourceId: decision.id,
                registrationId: firstReg?.id || null,
                title: `Ban hành Quyết định giao đề tài: ${decision.decisionNumber}`,
                subtitle: `${decision.items?.length || 0} hồ sơ`,
                status: decision.status,
                dueAt: null,
                allowedActions: canAct ? ['PUBLISH_TOPIC_DECISION'] : [],
                detailTarget: `/lecturer/institute?tab=decisions&kind=ASSIGNMENT_DECISION&resourceId=${decision.id}`,
                department,
            });
        }
    }

    if (typeof db.topicRegistration?.findMany === 'function') {
        const approvedRegs = await db.topicRegistration.findMany({
            where: {
                semesterId,
                status: 'BM02_APPROVED',
            },
            include: {
                student: { select: { id: true, fullName: true, code: true } },
                topic: {
                    include: {
                        mentor: { select: { id: true, fullName: true, department: true } },
                        proposedBy: { select: { id: true, department: true } },
                    },
                },
                topicAssignmentDecisionItem: true,
            },
            orderBy: { updatedAt: 'asc' },
        });

        for (const reg of approvedRegs || []) {
            if (reg.topicAssignmentDecisionItem) continue;
            const department = getDepartmentFromRegistration(reg);

            const canView = await checkRegistrationCapability({
                actor,
                db,
                registrationId: reg.id,
                semesterId,
                department,
                capabilityCodes: viewCaps,
                now,
            });
            if (!canView) continue;

            const canAct = await checkRegistrationCapability({
                actor,
                db,
                registrationId: reg.id,
                semesterId,
                department,
                capabilityCodes: actionCaps,
                now,
            });

            items.push({
                id: `assignment-decision-pending-${reg.id}`,
                kind: 'ASSIGNMENT_DECISION',
                resourceId: reg.id,
                registrationId: reg.id,
                title: `Chờ lập QĐ giao đề tài: ${getStudentLabel(reg)}`,
                subtitle: getTopicTitle(reg),
                status: 'BM02_APPROVED',
                dueAt: null,
                allowedActions: canAct ? ['ISSUE_TOPIC_DECISION'] : [],
                detailTarget: `/lecturer/institute?tab=decisions&kind=ASSIGNMENT_DECISION&registrationId=${reg.id}`,
                department,
            });
        }
    }

    return items;
}

async function collectAppendixItems({ actor, semesterId, db, now }) {
    const viewCaps = [
        'VIEW_TOPIC_ASSIGNMENT_DECISIONS',
        'VIEW_ASSIGNMENT_DECISIONS',
        'BM02A_FINAL_APPROVE',
        'TITLE_ADJUSTMENT_APPENDIX_ISSUE',
    ];
    const items = [];

    if (typeof db.titleAdjustmentAppendix?.findMany === 'function') {
        const draftAppendices = await db.titleAdjustmentAppendix.findMany({
            where: {
                status: 'DRAFT',
                decision: { semesterId },
            },
            include: {
                decision: true,
                items: {
                    include: {
                        registration: {
                            include: {
                                topic: {
                                    include: {
                                        mentor: { select: { department: true } },
                                        proposedBy: { select: { department: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        for (const appendix of draftAppendices || []) {
            const firstReg = appendix.items?.[0]?.registration;
            const department = firstReg ? getDepartmentFromRegistration(firstReg) : null;
            const effective = getScopedEffectivePermissions(actor, { semesterId, department });

            const canView = hasAnyCapability(effective, viewCaps) &&
                (!department || matchesDepartment(actor.department, department) ||
                    (actor.activeDelegations || []).some((d) =>
                        viewCaps.map(normalizeCode).includes(normalizeCode(d.capabilityCode)) &&
                        matchesDepartment(d.department, department)));
            if (!canView) continue;

            const canIssue = effective.has('TITLE_ADJUSTMENT_APPENDIX_ISSUE') &&
                (!department || matchesDepartment(actor.department, department) ||
                    (actor.activeDelegations || []).some((d) =>
                        normalizeCode(d.capabilityCode) === 'TITLE_ADJUSTMENT_APPENDIX_ISSUE' &&
                        matchesDepartment(d.department, department)));

            items.push({
                id: `title-appendix-${appendix.id}`,
                kind: 'TITLE_ADJUSTMENT_APPENDIX',
                resourceId: appendix.id,
                registrationId: firstReg?.id || null,
                title: `Ban hành Phụ lục điều chỉnh tên đề tài: ${appendix.appendixNumber}`,
                subtitle: `${appendix.items?.length || 0} hồ sơ điều chỉnh`,
                status: appendix.status,
                dueAt: null,
                allowedActions: canIssue ? ['ISSUE_APPENDIX'] : [],
                detailTarget: `/lecturer/institute?tab=decisions&kind=TITLE_ADJUSTMENT_APPENDIX&resourceId=${appendix.id}`,
                department,
            });
        }
    }

    if (typeof db.bM02AAdjustmentRequest?.findMany === 'function') {
        const pendingRequests = await db.bM02AAdjustmentRequest.findMany({
            where: {
                status: { in: ['PENDING_DEPARTMENT_APPROVAL', 'APPROVED_PENDING_APPENDIX'] },
                decision: { semesterId },
            },
            include: {
                registration: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true } },
                        topic: {
                            include: {
                                mentor: { select: { id: true, fullName: true, department: true } },
                                proposedBy: { select: { id: true, department: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        for (const reqItem of pendingRequests || []) {
            const reg = reqItem.registration;
            if (!reg) continue;
            const department = getDepartmentFromRegistration(reg);

            const canView = await checkRegistrationCapability({
                actor,
                db,
                registrationId: reg.id,
                semesterId,
                department,
                capabilityCodes: viewCaps,
                now,
            });
            if (!canView) continue;

            const requiredActionCap =
                reqItem.status === 'PENDING_DEPARTMENT_APPROVAL'
                    ? 'BM02A_FINAL_APPROVE'
                    : 'TITLE_ADJUSTMENT_APPENDIX_ISSUE';

            const canAct = await checkRegistrationCapability({
                actor,
                db,
                registrationId: reg.id,
                semesterId,
                department,
                capabilityCodes: [requiredActionCap],
                now,
            });

            const allowedActions = [];
            if (canAct) {
                if (reqItem.status === 'PENDING_DEPARTMENT_APPROVAL') {
                    allowedActions.push('APPROVE_BM02A_DEPARTMENT');
                } else if (reqItem.status === 'APPROVED_PENDING_APPENDIX') {
                    allowedActions.push('CREATE_APPENDIX_DRAFT');
                }
            }

            items.push({
                id: `bm02a-request-${reqItem.id}`,
                kind: 'TITLE_ADJUSTMENT_APPENDIX',
                resourceId: reqItem.id,
                registrationId: reg.id,
                title: `Điều chỉnh tên đề tài BM02-A: ${getStudentLabel(reg)}`,
                subtitle: getTopicTitle(reg),
                status: reqItem.status,
                dueAt: reqItem.titleAdjustmentDeadline || null,
                allowedActions,
                detailTarget: `/lecturer/institute?tab=decisions&kind=TITLE_ADJUSTMENT_APPENDIX&resourceId=${reqItem.id}`,
                department,
            });
        }
    }

    return items;
}

async function collectClearanceCertificateItems({ actor, semesterId, db, now }) {
    if (typeof db.projectArchive?.findMany !== 'function') return [];

    const viewCaps = ['VIEW_CLEARANCE_CERTIFICATES', 'CLEARANCE_CERTIFICATE_SIGN'];
    const actionCaps = ['CLEARANCE_CERTIFICATE_SIGN'];

    const archives = await db.projectArchive.findMany({
        where: {
            certificateSignedAt: null,
            registration: {
                semesterId,
                status: 'PENDING_INSTITUTE_SIGNATURE',
            },
        },
        include: {
            registration: {
                include: {
                    student: { select: { id: true, fullName: true, code: true } },
                    topic: {
                        include: {
                            mentor: { select: { id: true, fullName: true, department: true } },
                            proposedBy: { select: { id: true, department: true } },
                        },
                    },
                },
            },
        },
        orderBy: { submittedAt: 'asc' },
    });

    const items = [];
    for (const archive of archives || []) {
        const reg = archive.registration;
        if (!reg) continue;
        const department = getDepartmentFromRegistration(reg);

        const canView = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: viewCaps,
            now,
        });
        if (!canView) continue;

        const canAct = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: actionCaps,
            now,
        });

        const isReadyToSign =
            reg.status === 'PENDING_INSTITUTE_SIGNATURE' &&
            archive.mentorReviewStatus === 'APPROVED' &&
            archive.academicAffairsReviewStatus === 'APPROVED' &&
            !archive.certificateSignedAt;

        items.push({
            id: `clearance-certificate-${archive.id}`,
            kind: 'CLEARANCE_CERTIFICATE',
            resourceId: archive.id,
            registrationId: reg.id,
            title: `Ký giấy xác nhận hoàn thành đồ án: ${getStudentLabel(reg)}`,
            subtitle: getTopicTitle(reg),
            status: reg.status,
            dueAt: archive.windowClosesAt || null,
            allowedActions: canAct && isReadyToSign ? ['SIGN_CLEARANCE_CERTIFICATE'] : [],
            detailTarget: `/lecturer/institute?tab=decisions&kind=CLEARANCE_CERTIFICATE&resourceId=${archive.id}`,
            department,
        });
    }

    return items;
}

async function collectDefenseResultApprovalItems({ actor, semesterId, db, now }) {
    if (typeof db.topicRegistration?.findMany !== 'function') return [];

    const viewCaps = [
        'VIEW_DEFENSE_RESULTS_APPROVAL',
        'VIEW_DEFENSE_RESULT_APPROVALS',
        'DEFENSE_SCORE_VIEW',
        'DEFENSE_RESULT_APPROVE',
    ];
    const actionCaps = ['DEFENSE_RESULT_APPROVE'];

    const registrations = await db.topicRegistration.findMany({
        where: {
            semesterId,
            status: 'AWAITING_FINAL_APPROVAL',
        },
        include: {
            student: { select: { id: true, fullName: true, code: true } },
            topic: {
                include: {
                    mentor: { select: { id: true, fullName: true, department: true } },
                    proposedBy: { select: { id: true, department: true } },
                },
            },
            defenseCouncil: { select: { id: true, name: true, scoreBookLocked: true } },
            resultPublicationItems: { select: { id: true } },
        },
        orderBy: { updatedAt: 'asc' },
    });

    const items = [];
    for (const reg of registrations || []) {
        const department = getDepartmentFromRegistration(reg);

        const canView = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: viewCaps,
            now,
        });
        if (!canView) continue;

        const canAct = await checkRegistrationCapability({
            actor,
            db,
            registrationId: reg.id,
            semesterId,
            department,
            capabilityCodes: actionCaps,
            now,
        });

        const isAlreadyPublished = Array.isArray(reg.resultPublicationItems) && reg.resultPublicationItems.length > 0;
        const isScoreBookLocked = reg.defenseCouncil ? Boolean(reg.defenseCouncil.scoreBookLocked) : true;
        const isEligibleForApproval =
            reg.status === 'AWAITING_FINAL_APPROVAL' &&
            isScoreBookLocked &&
            !isAlreadyPublished;

        // Intentionally omit BM05 scores and unpublished comments from queue payload
        items.push({
            id: `defense-result-approval-${reg.id}`,
            kind: 'DEFENSE_RESULT_APPROVAL',
            resourceId: reg.id,
            registrationId: reg.id,
            title: `Phê duyệt kết quả bảo vệ: ${getStudentLabel(reg)}`,
            subtitle: getTopicTitle(reg),
            status: reg.status,
            dueAt: null,
            allowedActions: canAct && isEligibleForApproval ? ['APPROVE_DEFENSE_RESULT'] : [],
            detailTarget: `/lecturer/institute?tab=decisions&kind=DEFENSE_RESULT_APPROVAL&registrationId=${reg.id}`,
            department,
            councilName: reg.defenseCouncil?.name || null,
        });
    }

    return items;
}

// ==========================================
// TAB 3: PUBLISH QUEUE SOURCES
// ==========================================

async function collectEligibleDefenseListPublishItems({ actor, semester, db }) {
    if (!semester) return [];

    const viewCaps = ['VIEW_DEFENSE_ASSIGNMENTS', 'VIEW_COUNCIL_ASSIGNMENTS', 'DEFENSE_COUNCIL_MANAGE'];
    const actionCaps = ['DEFENSE_COUNCIL_MANAGE'];

    const effective = getScopedEffectivePermissions(actor, { semesterId: semester.id });
    if (!hasAnyCapability(effective, viewCaps)) return [];

    const canAct = hasAnyCapability(effective, actionCaps);

    let eligibleCount = 0;
    if (typeof db.topicRegistration?.count === 'function') {
        eligibleCount = await db.topicRegistration.count({
            where: {
                semesterId: semester.id,
                OR: [
                    { status: 'DEFENSE_READY' },
                    { status: 'DEFENSE_ELIGIBLE' },
                    { status: 'ELIGIBLE_BY_INSTITUTE' },
                    {
                        bm04Evaluation: {
                            isLocked: true,
                            conclusion: 'AGREED_FOR_DEFENSE',
                        },
                    },
                ],
            },
        });
    }

    const lockedRubric = semester.lockedDefenseRubricVersion;
    const hasLockedRubric = Boolean(
        lockedRubric &&
        lockedRubric.lockedAt &&
        Math.abs(Number(lockedRubric.totalMaxScore) - 10.0) <= 0.001,
    );
    const isAlreadyPublished = Boolean(semester.defenseEligibleListPublishedAt);

    const allowedActions =
        canAct && hasLockedRubric && !isAlreadyPublished && eligibleCount > 0
            ? ['PUBLISH_DEFENSE_ELIGIBLE_LIST']
            : [];

    return [
        {
            id: `eligible-defense-list-${semester.id}`,
            kind: 'DEFENSE_ELIGIBLE_LIST_PUBLICATION',
            resourceId: semester.id,
            registrationId: null,
            title: `Công bố danh sách đủ điều kiện bảo vệ (${semester.code || semester.name})`,
            subtitle: `${eligibleCount} sinh viên đủ điều kiện`,
            status: isAlreadyPublished
                ? 'PUBLISHED'
                : (hasLockedRubric ? 'READY_TO_PUBLISH' : 'RUBRIC_NOT_LOCKED'),
            dueAt: null,
            allowedActions,
            detailTarget: `/lecturer/institute?tab=publish&kind=DEFENSE_ELIGIBLE_LIST_PUBLICATION&resourceId=${semester.id}`,
            publishedAt: semester.defenseEligibleListPublishedAt || null,
            eligibleCount,
        },
    ];
}

async function collectResultPublicationItems({ actor, semester, db, now }) {
    if (!semester) return [];

    const viewCaps = ['VIEW_RESULT_PUBLICATIONS', 'RESULT_PUBLICATION_PUBLISH'];
    const actionCaps = ['RESULT_PUBLICATION_PUBLISH'];

    const semesterId = semester.id;
    const effectiveSemester = getScopedEffectivePermissions(actor, { semesterId });
    if (!hasAnyCapability(effectiveSemester, viewCaps)) return [];

    const items = [];

    if (typeof db.defenseResultApproval?.findMany === 'function') {
        const approvals = await db.defenseResultApproval.findMany({
            where: {
                isEffective: true,
                registration: { semesterId },
            },
            include: {
                registration: {
                    include: {
                        student: { select: { id: true, fullName: true, code: true } },
                        topic: {
                            include: {
                                mentor: { select: { id: true, department: true } },
                                proposedBy: { select: { id: true, department: true } },
                            },
                        },
                        defenseCouncil: {
                            include: {
                                members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                            },
                        },
                        council: {
                            include: {
                                members: { select: { id: true, lecturerId: true, roleInCouncil: true, isActive: true, isScoringMember: true } },
                            },
                        },
                        defenseResult: true,
                        memberScores: true,
                    },
                },
                publicationItems: { select: { id: true } },
            },
            orderBy: { approvedAt: 'asc' },
        });

        for (const approval of approvals || []) {
            const reg = approval.registration;
            if (!reg) continue;
            const department = getDepartmentFromRegistration(reg);

            const canView = await checkRegistrationCapability({
                actor,
                db,
                registrationId: reg.id,
                semesterId,
                department,
                capabilityCodes: viewCaps,
                now,
            });
            if (!canView) continue;

            const canAct = await checkRegistrationCapability({
                actor,
                db,
                registrationId: reg.id,
                semesterId,
                department,
                capabilityCodes: actionCaps,
                now,
            });

            const alreadyPublished = Array.isArray(approval.publicationItems) && approval.publicationItems.length > 0;
            const currentEvidenceValid = isApprovalEvidenceCurrent(approval);
            const canPublish = canAct && !alreadyPublished && currentEvidenceValid;

            // Never expose finalScoreSnapshot or unpublished BM05 scores/comments
            items.push({
                id: `result-publication-candidate-${approval.id}`,
                kind: 'RESULT_PUBLICATION',
                resourceId: approval.id,
                registrationId: reg.id,
                title: `Công bố kết quả bảo vệ: ${getStudentLabel(reg)}`,
                subtitle: getTopicTitle(reg),
                status: alreadyPublished
                    ? 'PUBLISHED'
                    : (currentEvidenceValid ? 'APPROVED_PENDING_PUBLICATION' : 'EVIDENCE_STALE'),
                dueAt: null,
                allowedActions: canPublish ? ['PUBLISH_DEFENSE_RESULTS'] : [],
                detailTarget: `/lecturer/institute?tab=publish&kind=RESULT_PUBLICATION&resourceId=${approval.id}`,
                department,
                approvedAt: approval.approvedAt || null,
            });
        }
    }

    return items;
}

// ==========================================
// TAB AGGREGATORS & PAGINATION
// ==========================================

async function collectItemsForTab({ actor, tab, semester, db, now }) {
    if (!semester) return [];
    const semesterId = semester.id;

    if (tab === 'review') {
        const [bm02, bm03, bm04, appeals] = await Promise.all([
            collectBM02ReviewItems({ actor, semesterId, db, now }),
            collectBM03StopReviewItems({ actor, semesterId, db, now }),
            collectBM04DefenseReviewItems({ actor, semesterId, db, now }),
            collectSignatureAppealItems({ actor, semesterId, db, now }),
        ]);
        return [...bm02, ...bm03, ...bm04, ...appeals];
    }

    if (tab === 'decisions') {
        const [decisions, appendices, clearances, approvals] = await Promise.all([
            collectAssignmentDecisionItems({ actor, semesterId, db, now }),
            collectAppendixItems({ actor, semesterId, db, now }),
            collectClearanceCertificateItems({ actor, semesterId, db, now }),
            collectDefenseResultApprovalItems({ actor, semesterId, db, now }),
        ]);
        return [...decisions, ...appendices, ...clearances, ...approvals];
    }

    if (tab === 'publish') {
        const [eligibleList, resultPublications] = await Promise.all([
            collectEligibleDefenseListPublishItems({ actor, semester, db }),
            collectResultPublicationItems({ actor, semester, db, now }),
        ]);
        return [...eligibleList, ...resultPublications];
    }

    return [];
}

function sortQueueItems(items) {
    return [...items].sort((a, b) => {
        const timeA = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;
        return String(a.id).localeCompare(String(b.id));
    });
}

function parsePagination({ page, pageSize }) {
    const parsedPage = page === undefined || page === null || page === ''
        ? DEFAULT_PAGE
        : Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
        throw new InstituteOperationsError('INVALID_PAGE', 400, 'page phải là số nguyên dương.');
    }

    const parsedPageSize = pageSize === undefined || pageSize === null || pageSize === ''
        ? DEFAULT_PAGE_SIZE
        : Number(pageSize);
    if (!Number.isInteger(parsedPageSize) || parsedPageSize < 1) {
        throw new InstituteOperationsError('INVALID_PAGE_SIZE', 400, 'pageSize phải là số nguyên dương.');
    }

    return {
        page: parsedPage,
        pageSize: Math.min(parsedPageSize, MAX_PAGE_SIZE),
    };
}

async function getInstituteOperations({
    actor,
    tab = 'review',
    semesterId,
    status,
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_PAGE_SIZE,
    db = prismaDefault,
    now = new Date(),
} = {}) {
    if (!actor || !actor.id) {
        throw new InstituteOperationsError('AUTHENTICATION_REQUIRED', 401, 'Chưa xác thực.');
    }

    const normalizedTab = String(tab || 'review').trim();
    if (!VALID_TABS.includes(normalizedTab)) {
        throw new InstituteOperationsError('INVALID_TAB', 400, 'tab không hợp lệ. Chỉ chấp nhận review, decisions hoặc publish.');
    }

    const paginationParams = parsePagination({ page, pageSize });
    const semester = await resolveSemester(db, semesterId);
    const resolvedSemesterId = semester ? semester.id : null;

    if (!hasActorTabAccess(actor, normalizedTab, resolvedSemesterId)) {
        throw new InstituteOperationsError('TAB_ACCESS_FORBIDDEN', 403, 'Bạn không có quyền truy cập phân hệ này.');
    }

    const counts = { review: 0, decisions: 0, publish: 0 };
    let activeTabItems = [];

    for (const candidateTab of VALID_TABS) {
        if (!hasActorTabAccess(actor, candidateTab, resolvedSemesterId)) {
            counts[candidateTab] = 0;
            continue;
        }
        const collected = await collectItemsForTab({
            actor,
            tab: candidateTab,
            semester,
            db,
            now,
        });
        const filtered = status
            ? collected.filter((item) => item.status === status)
            : collected;
        counts[candidateTab] = filtered.length;
        if (candidateTab === normalizedTab) {
            activeTabItems = sortQueueItems(filtered);
        }
    }

    const total = activeTabItems.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / paginationParams.pageSize);
    const startIndex = (paginationParams.page - 1) * paginationParams.pageSize;
    const paginatedItems = activeTabItems.slice(startIndex, startIndex + paginationParams.pageSize);

    return {
        tab: normalizedTab,
        semester: semester
            ? {
                id: semester.id,
                code: semester.code,
                name: semester.name,
                status: semester.status,
            }
            : null,
        items: paginatedItems,
        pagination: {
            page: paginationParams.page,
            pageSize: paginationParams.pageSize,
            total,
            totalPages,
        },
        counts,
        generatedAt: now.toISOString(),
    };
}

module.exports = {
    VALID_TABS,
    MAX_PAGE_SIZE,
    InstituteOperationsError,
    getInstituteOperations,
};
